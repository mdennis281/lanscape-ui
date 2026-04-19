import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { useConnectionStore, useScanStore, useUIStore } from '../../store';
import { getWebSocketService } from '../../services';
import { SubnetInput } from './SubnetInput';
import { ScanHistory } from './ScanHistory';
import { ConfigPromptModal } from './ConfigPromptModal';
import { ScanModeModal } from './ScanModeModal';
import { ContextMenu, useContextMenu, getGlobalSection } from '../ContextMenu';
import type { SubnetTestResult, AutoStageRecommendation } from '../../types';

export function Header() {
  const formRef = useRef<HTMLFormElement>(null);
  const logoMenu = useContextMenu();

  const connectionStatus = useConnectionStore((s) => s.connectionStatus);

  const {
    status,
    pipelineConfig,
    currentScanId,
    setCurrentScanId,
    clearDevices,
    clearScanErrors,
    clearScanWarnings,
    setStatus,
    addScanToHistory,
    autoStagesEnabled,
    fetchAutoStages,
    clearAutoStages,
    applyAutoStages,
  } = useScanStore();

  const subnetInput = useUIStore((s) => s.subnetInput);
  const setShowSettings = useUIStore((s) => s.setShowSettings);
  const setShowDebug = useUIStore((s) => s.setShowDebug);

  const [isLoading, setIsLoading] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [subnetValidation, setSubnetValidation] = useState<SubnetTestResult | null>(null);
  const [showConfigPrompt, setShowConfigPrompt] = useState(false);
  const [pendingAutoStages, setPendingAutoStages] = useState<AutoStageRecommendation[] | null>(null);
  const [showScanModeModal, setShowScanModeModal] = useState(false);

  const isScanning = status?.is_running ?? false;
  const hasStages = pipelineConfig.stages.length > 0;

  // Validate subnet when input changes
  const validateSubnet = useCallback(async (subnet: string) => {
    if (!subnet.trim()) {
      setSubnetValidation(null);
      clearAutoStages();
      return;
    }

    const ws = getWebSocketService();
    if (!ws) return;

    try {
      const response = await ws.testSubnet(subnet);
      if (response.success && response.data) {
        const result = response.data as SubnetTestResult;
        setSubnetValidation(result);

        // Fetch auto-stage recommendations when subnet is valid
        if (result.valid && autoStagesEnabled) {
          fetchAutoStages(subnet);
        }
      }
    } catch {
      // WS was likely disconnected — clear validation instead of showing an
      // error.  The effect below will re-validate once the connection is back.
      setSubnetValidation(null);
    }
  }, [autoStagesEnabled, fetchAutoStages, clearAutoStages]);

  // Debounced validation — re-runs when input changes *or* when the WS
  // connection is (re-)established so we recover from transient drops.
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    const timer = setTimeout(() => {
      validateSubnet(subnetInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [subnetInput, validateSubnet, connectionStatus]);

  const canSubmit = isScanning || (subnetInput.trim() && subnetValidation?.valid && hasStages);

  // Shared logic: clear state and transition to a fresh scan slate
  const proceedWithNewScan = useCallback(() => {
    if (currentScanId) {
      // Only unsubscribe if the scan is finished — running scans stay
      // subscribed so their events keep updating the history dropdown.
      if (!isScanning) {
        const ws = getWebSocketService();
        ws?.unsubscribeScan(currentScanId).catch(() => {});
      }
    }
    clearDevices();
    clearScanErrors();
    clearScanWarnings();
    setCurrentScanId(null);
    setStatus(null);
  }, [currentScanId, isScanning, clearDevices, clearScanErrors, clearScanWarnings, setCurrentScanId, setStatus]);

  // Called when user clicks "New Scan" in the history dropdown
  const handleNewScan = useCallback(async () => {
    if (!currentScanId || !autoStagesEnabled || !subnetInput.trim()) {
      proceedWithNewScan();
      return;
    }

    const ws = getWebSocketService();
    if (!ws) {
      proceedWithNewScan();
      return;
    }

    try {
      const response = await ws.getAutoStages(subnetInput.trim());
      if (response.success && response.data) {
        const data = response.data as { stages: AutoStageRecommendation[] };
        if (data.stages?.length) {
          const currentTypes = new Set(pipelineConfig.stages.map((s) => s.stage_type));
          const recommendedTypes = new Set(data.stages.map((s) => s.stage_type));

          const isDifferent =
            currentTypes.size !== recommendedTypes.size ||
            [...currentTypes].some((t) => !recommendedTypes.has(t));

          if (isDifferent) {
            setPendingAutoStages(data.stages);
            setShowConfigPrompt(true);
            return;
          }
        }
      }
    } catch {
      // Best effort — proceed without prompt
    }

    proceedWithNewScan();
  }, [currentScanId, autoStagesEnabled, subnetInput, pipelineConfig.stages, proceedWithNewScan]);

  // Config prompt modal handlers
  const handleUseRecommended = useCallback(() => {
    setShowConfigPrompt(false);
    if (pendingAutoStages) {
      applyAutoStages(pendingAutoStages);
    }
    setPendingAutoStages(null);
    proceedWithNewScan();
  }, [pendingAutoStages, applyAutoStages, proceedWithNewScan]);

  const handleKeepCurrent = useCallback(() => {
    setShowConfigPrompt(false);
    setPendingAutoStages(null);
    proceedWithNewScan();
  }, [proceedWithNewScan]);

  // Contextual tooltip for the submit button when disabled
  const getSubmitTooltip = (): string | undefined => {
    if (isTerminating) return 'Terminating scan, waiting for completion before starting a new scan';
    if (isScanning) return undefined; // Stop is always allowed
    if (!hasStages) return 'No scan stages set, configure them in settings';
    if (!subnetInput.trim()) return 'Enter a subnet to scan';
    if (subnetValidation && !subnetValidation.valid) return 'Invalid subnet';
    return undefined;
  };

  // Core scan-start logic — called directly or after modal choice
  const executeStartScan = useCallback(async () => {
    const ws = getWebSocketService();
    if (!ws) return;

    setIsLoading(true);
    try {
      clearDevices();
      clearScanErrors();
      clearScanWarnings();
      setStatus({
        is_running: true,
        stage: 'starting',
        progress: 0,
        total_hosts: subnetValidation?.count ?? 0,
        scanned_hosts: 0,
        found_hosts: 0,
        ports_scanned: 0,
        ports_total: 0,
        runtime: 0,
        remaining: 0,
      });

      // Read latest pipeline config from store (may have just been updated by applyAutoStages)
      const latestConfig = useScanStore.getState().pipelineConfig;
      const scanPayload = {
        ...latestConfig,
        subnet: subnetInput.trim(),
      };
      const response = await ws.startScan(scanPayload);
      if (response.success && response.data) {
        const data = response.data as { scan_id: string };
        setCurrentScanId(data.scan_id);
        addScanToHistory(data.scan_id, subnetInput.trim(), subnetValidation?.count ?? 0);
        await ws.subscribeScan(data.scan_id);
      }
    } catch (error) {
      console.error('Scan start failed:', error);
      setStatus({
        is_running: false,
        stage: 'error',
        progress: status?.progress ?? 0,
        total_hosts: status?.total_hosts ?? 0,
        scanned_hosts: status?.scanned_hosts ?? 0,
        found_hosts: status?.found_hosts ?? 0,
        ports_scanned: status?.ports_scanned ?? 0,
        ports_total: status?.ports_total ?? 0,
        runtime: status?.runtime ?? 0,
        remaining: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [subnetInput, subnetValidation, clearDevices, clearScanErrors, clearScanWarnings, setStatus, setCurrentScanId, addScanToHistory, status]);

  // Scan mode modal handlers
  const handleScanModeExisting = useCallback(() => {
    setShowScanModeModal(false);
    executeStartScan();
  }, [executeStartScan]);

  const handleScanModeAuto = useCallback(async () => {
    setShowScanModeModal(false);
    const ws = getWebSocketService();
    if (!ws) {
      executeStartScan();
      return;
    }

    try {
      const response = await ws.getAutoStages(subnetInput.trim());
      if (response.success && response.data) {
        const data = response.data as { stages: AutoStageRecommendation[] };
        if (data.stages?.length) {
          applyAutoStages(data.stages);
        }
      }
    } catch {
      // Best effort — proceed with whatever stages are set
    }

    executeStartScan();
  }, [subnetInput, applyAutoStages, executeStartScan]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ws = getWebSocketService();
    if (!ws || !canSubmit) return;

    if (isScanning && currentScanId) {
      // Terminate the current scan
      setIsLoading(true);
      try {
        setIsTerminating(true);
        await ws.terminateScan(currentScanId);
        setCurrentScanId(null);
        setStatus({
          is_running: false,
          stage: 'terminated',
          progress: status?.progress ?? 0,
          total_hosts: status?.total_hosts ?? 0,
          scanned_hosts: status?.scanned_hosts ?? 0,
          found_hosts: status?.found_hosts ?? 0,
          ports_scanned: status?.ports_scanned ?? 0,
          ports_total: status?.ports_total ?? 0,
          runtime: status?.runtime ?? 0,
          remaining: 0,
        });
        setIsTerminating(false);
      } catch (error) {
        console.error('Scan termination failed:', error);
        setIsTerminating(false);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // If there's a completed scan being viewed, ask the user which mode to use
    if (currentScanId && !isScanning && hasStages) {
      setShowScanModeModal(true);
      return;
    }

    // No existing scan — start directly
    executeStartScan();
  };

  return (
    <header className="header">
      <div className="header-content">
        <a 
          href="/" 
          className="header-logo"
          onContextMenu={(e) => logoMenu.handleContextMenu(e, () => [
            {
              items: [
                { label: 'Debug Panel', icon: 'fa-solid fa-bug', onClick: () => setShowDebug(true) },
              ],
            },
            getGlobalSection(),
          ])}
        >
          <span className="logo-text">
            <span className="logo-accent">LAN</span>scape
          </span>
        </a>
        {logoMenu.visible && (
          <ContextMenu sections={logoMenu.sections} position={logoMenu.position} onClose={logoMenu.close} />
        )}

        <form className="subnet-form" onSubmit={handleSubmit} ref={formRef}>
          <ScanHistory onNewScan={handleNewScan} />
          <SubnetInput 
            disabled={isLoading} 
            onSettingsClick={() => setShowSettings(true)}
            validation={subnetValidation}
            onSubmit={() => formRef.current?.requestSubmit()}
          />
          <span
            data-tooltip-id="tooltip"
            data-tooltip-content={getSubmitTooltip()}
            className="scan-submit-wrapper"
          >
            <button
              type="submit"
              className={`btn ${isScanning ? 'btn-danger' : 'btn-primary'} scan-submit-btn`}
              disabled={isLoading || isTerminating || !canSubmit}
            >
              {isLoading && <span className="spinner"></span>}
              {!isLoading && (
                <>
                  <i className={`fa-solid ${isScanning ? 'fa-circle-stop' : 'fa-circle-play'}`}></i>
                  <span>{isScanning ? 'Stop' : 'Scan'}</span>
                </>
              )}
            </button>
          </span>
        </form>
      </div>

      <ConfigPromptModal
        isOpen={showConfigPrompt}
        onClose={() => { setShowConfigPrompt(false); setPendingAutoStages(null); }}
        onUseRecommended={handleUseRecommended}
        onKeepCurrent={handleKeepCurrent}
        recommendedStages={pendingAutoStages ?? []}
        currentStages={pipelineConfig.stages}
      />

      <ScanModeModal
        isOpen={showScanModeModal}
        onClose={() => setShowScanModeModal(false)}
        onUseExisting={handleScanModeExisting}
        onUseAuto={handleScanModeAuto}
        currentStages={pipelineConfig.stages}
      />
    </header>
  );
}
