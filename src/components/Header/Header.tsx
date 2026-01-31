import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useScanStore } from '../../store';
import { getWebSocketService } from '../../services';
import { SubnetInput } from './SubnetInput';
import type { SubnetTestResult } from '../../types';

export function Header() {
  const { 
    subnetInput, 
    status,
    config,
    currentScanId,
    setCurrentScanId,
    clearDevices,
    setShowSettings, 
    setStatus,
  } = useScanStore();
  const [isLoading, setIsLoading] = useState(false);
  const [subnetValidation, setSubnetValidation] = useState<SubnetTestResult | null>(null);

  const isScanning = status?.is_running ?? false;

  // Validate subnet when input changes
  const validateSubnet = useCallback(async (subnet: string) => {
    if (!subnet.trim()) {
      setSubnetValidation(null);
      return;
    }

    const ws = getWebSocketService();
    if (!ws) return;

    try {
      const response = await ws.testSubnet(subnet);
      if (response.success && response.data) {
        setSubnetValidation(response.data as SubnetTestResult);
      }
    } catch {
      setSubnetValidation({ valid: false, msg: 'Validation failed', count: -1 });
    }
  }, []);

  // Debounced validation
  useEffect(() => {
    const timer = setTimeout(() => {
      validateSubnet(subnetInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [subnetInput, validateSubnet]);

  const canSubmit = isScanning || (subnetInput.trim() && subnetValidation?.valid);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ws = getWebSocketService();
    if (!ws || !canSubmit) return;

    setIsLoading(true);
    try {
      if (isScanning && currentScanId) {
        // Terminate the current scan
        await ws.terminateScan(currentScanId);
        setCurrentScanId(null);
        setStatus({
          is_running: false,
          stage: 'terminated',
          progress: status?.progress ?? 0,
          total_hosts: status?.total_hosts ?? 0,
          scanned_hosts: status?.scanned_hosts ?? 0,
          found_hosts: status?.found_hosts ?? 0,
          runtime: status?.runtime ?? 0,
          remaining: 0,
        });
      } else {
        // Clear previous results and start a new scan
        clearDevices();
        setStatus({
          is_running: true,
          stage: 'starting',
          progress: 0,
          total_hosts: subnetValidation?.count ?? 0,
          scanned_hosts: 0,
          found_hosts: 0,
          runtime: 0,
          remaining: 0,
        });
        
        // Spread config first, then override subnet with user input
        const response = await ws.startScan({
          ...config,
          subnet: subnetInput.trim(),
        });
        // Store the scan ID from the response
        if (response.success && response.data) {
          const data = response.data as { scan_id: string };
          setCurrentScanId(data.scan_id);
          // Subscribe to updates for this scan
          await ws.subscribeScan(data.scan_id);
        }
      }
    } catch (error) {
      console.error('Scan action failed:', error);
      setStatus({
        is_running: false,
        stage: 'error',
        progress: status?.progress ?? 0,
        total_hosts: status?.total_hosts ?? 0,
        scanned_hosts: status?.scanned_hosts ?? 0,
        found_hosts: status?.found_hosts ?? 0,
        runtime: status?.runtime ?? 0,
        remaining: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <header className="header">
      <div className="header-content">
        <a href="/" className="header-logo">
          <span className="logo-text">
            <span className="logo-accent">LAN</span>scape
          </span>
        </a>

        <form className="subnet-form" onSubmit={handleSubmit}>
          <SubnetInput 
            disabled={isLoading} 
            onSettingsClick={() => setShowSettings(true)}
            validation={subnetValidation}
          />
          <button
            type="submit"
            className={`btn ${isScanning ? 'btn-danger' : 'btn-primary'} scan-submit-btn`}
            disabled={isLoading || !canSubmit}
          >
            {isLoading && <span className="spinner"></span>}
            {!isLoading && (
              <>
                <i className={`fa-solid ${isScanning ? 'fa-circle-stop' : 'fa-circle-play'}`}></i>
                <span>{isScanning ? 'Stop' : 'Scan'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </header>
  );
}
