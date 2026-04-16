import { useEffect, useCallback, useState, useRef } from 'react';
import { Tooltip } from 'react-tooltip';
import { 
  Header, 
  Overview, 
  DeviceTable, 
  DeviceModal,
  SettingsModal, 
  AboutModal,
  UpdateModal,
  ErrorsModal,
  WarningsModal,
  ConnectionModal,
  DebugModal,
  Footer,
  StartupScreen
} from './components';
import { OdometerDebug } from './components/Overview/OdometerDebug';
import { createWebSocketService } from './services';
import type { WebSocketService } from './services';
import { useConnectionStore, useScanStore, useUIStore } from './store';
import { resolveWebSocketURL } from './utils';
import type { DeviceResult, WSEvent, SubnetInfo, DefaultConfigs, ScanConfig, AppInfo } from './types';
import { applyStageDefaults, applyStagePresets } from './components/Settings/stageRegistry';
import './types/electron'; // Import electron types for global Window augmentation
import '@awesome.me/kit-d0b7f59243/icons/css/fontawesome.min.css';
import '@awesome.me/kit-d0b7f59243/icons/css/solid.min.css';
import '@awesome.me/kit-d0b7f59243/icons/css/regular.min.css';
import '@awesome.me/kit-d0b7f59243/icons/css/brands.min.css';
import 'react-tooltip/dist/react-tooltip.css';
import './styles/main.scss';

// Check for debug mode
const isOdometerDebug = new URLSearchParams(window.location.search).get('debug') === 'odometer';

// Check if running in Electron
const isElectron = !!window.electronAPI;

function App() {
  // If debug mode, show debug UI
  if (isOdometerDebug) {
    return <OdometerDebug />;
  }

  return <MainApp />;
}

function MainApp() {
  // Show startup screen when running in Electron
  const [showStartup, setShowStartup] = useState(isElectron);
  const [isLoading, setIsLoading] = useState(true);
  /** Status message displayed during phased loading. */
  const [loadingStatus, setLoadingStatus] = useState('Connecting to server…');
  /** Tracks whether the app has ever fully loaded (for detecting mid-session drops). */
  const hasLoadedOnce = useRef(false);
  /** Ref to the current WS service for the reconnect-reload helper. */
  const wsRef = useRef<WebSocketService | null>(null);
  
  // --- Connection store ---
  const {
    connectionStatus,
    setConnectionStatus,
    setConnectionError,
    setWsService,
    setAppInfo,
    mergeAppInfo,
  } = useConnectionStore();

  // --- Scan store ---
  const {
    setConfig,
    setSubnets,
    setDefaultConfigs,
    setPortLists,
    handleEvent,
    fetchScanHistory,
  } = useScanStore();

  const isTransitioning = useScanStore((s) => s.isTransitioning);

  // --- UI store ---
  const {
    selectedDevice,
    setSelectedDevice,
    showSettings,
    setShowSettings,
    showAbout,
    setShowAbout,
    showUpdate,
    setShowUpdate,
    showErrors,
    setShowErrors,
    showWarnings,
    setShowWarnings,
    showConnection,
    setShowConnection,
    showDebug,
    setShowDebug,
    setSubnetInput,
  } = useUIStore();

  const onEvent = useCallback((event: WSEvent) => {
    handleEvent(event);
  }, [handleEvent]);

  /**
   * Fetch initial data from backend after a (re-)connection is established.
   * Runs in phases so the loading screen can show meaningful status updates.
   */
  const loadInitialData = useCallback(async (ws: WebSocketService) => {
    // ── Phase 1: Fast batch (instant responses) ──────────────────────
    setLoadingStatus('Loading configuration…');

    const [subnetListRes, configDefaultsRes, appInfoRes, portListsRes, stageDefaultsRes, stagePresetsRes] = await Promise.all([
      ws.listSubnets(),
      ws.getConfigDefaults(),
      ws.getAppInfo(),
      ws.listPortsSummary(),
      ws.getStageDefaults(),
      ws.getStagePresets(),
    ]);

    // Apply stage-level defaults to the stage registry
    if (stageDefaultsRes.success && stageDefaultsRes.data) {
      applyStageDefaults(stageDefaultsRes.data as Record<string, Record<string, unknown>>);
    }

    // Apply stage presets (fast/balanced/accurate) to the stage registry
    if (stagePresetsRes.success && stagePresetsRes.data) {
      applyStagePresets(stagePresetsRes.data as Record<string, Record<string, Record<string, unknown>>>);
    }

    // Set available subnets
    if (subnetListRes.success && Array.isArray(subnetListRes.data)) {
      const subnets = subnetListRes.data as SubnetInfo[];
      setSubnets(subnets);
      if (subnets.length > 0) {
        setSubnetInput(subnets[0].subnet);
      }
    }

    // Set port lists
    if (portListsRes.success && Array.isArray(portListsRes.data)) {
      setPortLists(portListsRes.data as { name: string; count: number }[]);
    }

    // Set default configs (ARP-optimistic — may be re-fetched in Phase 2)
    if (configDefaultsRes.success && configDefaultsRes.data) {
      const configs = configDefaultsRes.data as DefaultConfigs;
      setDefaultConfigs(configs);

      // 1. Try the exact config the user last saved (preserves tweaks)
      const lastConfig = (() => {
        try {
          const raw = localStorage.getItem('lanscape:lastConfig');
          return raw ? (JSON.parse(raw) as ScanConfig) : null;
        } catch { return null; }
      })();

      if (lastConfig) {
        setConfig(lastConfig);
      } else {
        // 2. Fall back to resolving the active preset
        const savedPresetId = localStorage.getItem('lanscape:activePreset');
        let restored = false;

        if (savedPresetId) {
          if (configs[savedPresetId]) {
            setConfig(configs[savedPresetId]);
            restored = true;
          } else {
            try {
              const raw = localStorage.getItem('lanscape:userPresets');
              if (raw) {
                const userPresets = JSON.parse(raw) as { id: string; config: ScanConfig }[];
                const match = userPresets.find((p) => p.id === savedPresetId);
                if (match?.config) {
                  setConfig(match.config);
                  restored = true;
                }
              }
            } catch { /* ignore malformed data */ }
          }
        }

        if (!restored && configs.balanced) {
          setConfig(configs.balanced);
          localStorage.setItem('lanscape:activePreset', 'balanced');
        }
      }
    }

    // Set fast app info from backend (no ARP/update fields yet)
    if (appInfoRes.success && appInfoRes.data) {
      setAppInfo(appInfoRes.data as AppInfo);
    }

    // Restore scan history from backend (ScanManager retains state across refreshes)
    await fetchScanHistory();

    // ── Phase 2: ARP capability check ────────────────────────────────
    setLoadingStatus('Checking system capabilities…');

    const arpRes = await ws.isArpSupported();
    const arpSupported = !!(arpRes.success && arpRes.data && (arpRes.data as { supported: boolean }).supported);
    mergeAppInfo({ arp_supported: arpSupported });

    // If ARP is not supported, re-fetch configs with fallback presets
    if (!arpSupported) {
      const fallbackRes = await ws.getConfigDefaults({ arp_supported: false });
      if (fallbackRes.success && fallbackRes.data) {
        const configs = fallbackRes.data as DefaultConfigs;
        setDefaultConfigs(configs);

        // Re-apply config only if user hasn't saved a custom config
        const hasLastConfig = !!localStorage.getItem('lanscape:lastConfig');
        if (!hasLastConfig) {
          const savedPresetId = localStorage.getItem('lanscape:activePreset') ?? 'balanced';
          if (configs[savedPresetId]) {
            setConfig(configs[savedPresetId]);
          }
        }
      }
    }

    // ── Phase 3: Update check ────────────────────────────────────────
    setLoadingStatus('Checking for updates…');

    const updateRes = await ws.checkForUpdates();
    if (updateRes.success && updateRes.data) {
      const { update_available, latest_version } = updateRes.data as {
        update_available: boolean;
        latest_version: string | null;
      };
      mergeAppInfo({ update_available, latest_version: latest_version ?? undefined });
    }
  }, [setSubnets, setSubnetInput, setPortLists, setDefaultConfigs, setConfig, setAppInfo, mergeAppInfo, fetchScanHistory]);

  // When status transitions back to 'connected' after the initial load,
  // re-fetch data (handles reconnects and server-URL changes).
  // Also handles completing initial load when auto-reconnect succeeds.
  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    const ws = wsRef.current;
    if (!ws) return;

    if (!hasLoadedOnce.current) {
      // First successful connection (from auto-reconnect after initial failure)
      loadInitialData(ws)
        .then(() => {
          hasLoadedOnce.current = true;
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load initial data after reconnect:', err);
        });
    } else {
      // Subsequent reconnection
      loadInitialData(ws).catch((err) => {
        console.error('Failed to reload data after reconnect:', err);
      });
    }
  }, [connectionStatus, loadInitialData]);

  useEffect(() => {
    // Don't connect to WebSocket until startup is complete
    if (showStartup) {
      return;
    }

    let cancelled = false;

    const boot = async () => {
      // Resolve the best WS URL (may query mDNS discovery)
      const wsUrl = await resolveWebSocketURL();
      if (cancelled) return;

      const ws = createWebSocketService({
        url: wsUrl,
        onStatusChange: (status) => {
          if (!cancelled) {
            setConnectionStatus(status);
            // Auto-show connection modal on disconnect/error after initial load
            if ((status === 'disconnected' || status === 'error') && hasLoadedOnce.current) {
              setShowConnection(true);
            }
            // Auto-close blocking connection modal on successful reconnect
            if (status === 'connected') {
              setConnectionError(null);
              setShowConnection(false);
            }
          }
        },
        onEvent,
      });

      wsRef.current = ws;
      setWsService(ws);

      try {
        await ws.connect();
        if (cancelled) return;

        // Switch from indeterminate to determinate progress
        setLoadingStatus('Loading configuration…');

        // Connected — load initial data
        await loadInitialData(ws);
        if (cancelled) return;

        hasLoadedOnce.current = true;
        setIsLoading(false);
      } catch {
        if (cancelled) return;
        // First attempt failed — the WS service's built-in auto-reconnect
        // (exponential backoff) keeps trying in the background.
        // The connectionStatus effect will finish loading once it connects.
      }
    };

    boot();

    return () => {
      cancelled = true;
      if (wsRef.current) wsRef.current.disconnect();
    };
  }, [setConnectionStatus, setConnectionError, setWsService, setAppInfo, setConfig, setSubnets, setDefaultConfigs, setSubnetInput, setPortLists, setShowConnection, onEvent, showStartup, loadInitialData]);

  const handleDeviceClick = (device: DeviceResult) => {
    setSelectedDevice(device);
  };

  const handleStartupReady = useCallback(() => {
    setShowStartup(false);
  }, []);

  // Show startup screen while Python backend is initializing (Electron only)
  if (showStartup) {
    return <StartupScreen onReady={handleStartupReady} />;
  }

  // Show loading state until WebSocket is connected and data is loaded
  if (isLoading) {
    return (
      <div className="app-container app-loading">
        <div className="loading-screen">
          <div className="loading-header">
            <div className="loading-logo">
              <img src="./android-chrome-192x192.png" alt="LANscape" className="loading-logo-img" />
            </div>
            <h1 className="loading-title">LANscape</h1>
            <p className="loading-subtitle">Local Network Scanner</p>
          </div>
          <div className="loading-progress">
            {connectionStatus === 'error' && !hasLoadedOnce.current ? (
              <>
                <div className="loading-error">
                  <i className="fa-solid fa-plug-circle-xmark"></i>
                  <span>Unable to reach backend server</span>
                </div>
                <button className="loading-btn" onClick={() => setShowConnection(true)}>
                  <i className="fa-solid fa-gear"></i>
                  Connection Settings
                </button>
              </>
            ) : (
              <>
                <p className="loading-status">
                  {loadingStatus}
                </p>
                <div className="loading-bar">
                  <div className="loading-bar-fill loading-bar-indeterminate" />
                </div>
                <button className="loading-btn-link" onClick={() => setShowConnection(true)}>
                  <i className="fa-solid fa-gear"></i>
                  Connection Settings
                </button>
              </>
            )}
          </div>
        </div>
        {/* Connection modal shown as blocking overlay when initial connect fails */}
        <ConnectionModal
          isOpen={showConnection}
          onClose={() => setShowConnection(false)}
          blocking
        />
      </div>
    );
  }

  // Determine whether to show the connection-lost overlay.
  // This is true when connection drops mid-session OR on initial failure.
  const connectionLost = showConnection && connectionStatus !== 'connected';

  return (
    <div className="app-container">
      <Header />
      
      <main className={`app-main ${isTransitioning ? 'scan-transitioning' : 'scan-visible'}`}>
        <Overview />
        <DeviceTable onDeviceClick={handleDeviceClick} />
      </main>

      <Footer />

      {/* Modals */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
      
      <AboutModal 
        isOpen={showAbout} 
        onClose={() => setShowAbout(false)} 
      />

      <UpdateModal
        isOpen={showUpdate}
        onClose={() => setShowUpdate(false)}
      />
      
      <ErrorsModal 
        isOpen={showErrors} 
        onClose={() => setShowErrors(false)} 
      />

      <WarningsModal
        isOpen={showWarnings}
        onClose={() => setShowWarnings(false)}
      />

      <DebugModal
        isOpen={showDebug}
        onClose={() => setShowDebug(false)}
      />

      {/* Connection modal — blocking when connection is lost, closeable when manually opened */}
      <ConnectionModal
        isOpen={showConnection}
        onClose={() => setShowConnection(false)}
        blocking={connectionLost}
      />
      
      {selectedDevice && (
        <DeviceModal 
          device={selectedDevice} 
          onClose={() => setSelectedDevice(null)} 
        />
      )}
      
      {/* Global tooltip - any element with data-tooltip-id="tooltip" will use this */}
      <Tooltip id="tooltip" />
    </div>
  );
}

export default App;
