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
  Footer,
  StartupScreen
} from './components';
import { OdometerDebug } from './components/Overview/OdometerDebug';
import { createWebSocketService } from './services';
import type { WebSocketService } from './services';
import { useScanStore } from './store';
import { getWebSocketURL } from './utils';
import type { DeviceResult, WSEvent, SubnetInfo, DefaultConfigs, ScanConfig } from './types';
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
  /** Retry state shown on the loading screen during initial connection attempts. */
  const [loadingRetry, setLoadingRetry] = useState<{ attempt: number; max: number; failed: boolean }>({
    attempt: 0, max: 8, failed: false,
  });
  /** Tracks whether the app has ever fully loaded (for detecting mid-session drops). */
  const hasLoadedOnce = useRef(false);
  /** Ref to the current WS service for the reconnect-reload helper. */
  const wsRef = useRef<WebSocketService | null>(null);
  
  const {
    connectionStatus,
    setConnectionStatus,
    setConnectionError,
    setWsService,
    setAppInfo,
    setConfig,
    setSubnets,
    setDefaultConfigs,
    setPortLists,
    handleEvent,
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
    setSubnetInput,
  } = useScanStore();

  const onEvent = useCallback((event: WSEvent) => {
    handleEvent(event);
  }, [handleEvent]);

  /**
   * Fetch initial data from backend after a (re-)connection is established.
   * Extracted so we can call it both on first load and after a reconnect.
   */
  const loadInitialData = useCallback(async (ws: WebSocketService) => {
    const [subnetListRes, configDefaultsRes, appInfoRes, portListsRes] = await Promise.all([
      ws.listSubnets(),
      ws.getConfigDefaults(),
      ws.getAppInfo(),
      ws.listPortsSummary(),
    ]);

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

    // Set default configs
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

    // Set app info from backend
    if (appInfoRes.success && appInfoRes.data) {
      setAppInfo(appInfoRes.data as {
        version: string;
        name: string;
        arp_supported: boolean;
        update_available?: boolean;
        latest_version?: string;
        runtime_args?: Record<string, unknown>;
      });
    }
  }, [setSubnets, setSubnetInput, setPortLists, setDefaultConfigs, setConfig, setAppInfo]);

  // When status transitions back to 'connected' after the initial load,
  // re-fetch data (handles reconnects and server-URL changes).
  useEffect(() => {
    if (connectionStatus !== 'connected' || !hasLoadedOnce.current) return;
    const ws = wsRef.current;
    if (!ws) return;

    loadInitialData(ws).catch((err) => {
      console.error('Failed to reload data after reconnect:', err);
    });
  }, [connectionStatus, loadInitialData]);

  useEffect(() => {
    // Don't connect to WebSocket until startup is complete
    if (showStartup) {
      return;
    }

    const wsUrl = getWebSocketURL();
    console.log('Connecting to WebSocket:', wsUrl);
    
    let cancelled = false;
    
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

    const MAX_INITIAL_RETRIES = 8;
    const RETRY_DELAY_MS = 2500;

    const attemptConnect = async () => {
      for (let attempt = 1; attempt <= MAX_INITIAL_RETRIES; attempt++) {
        if (cancelled) return;

        // eslint-disable-next-line react-hooks/set-state-in-effect -- updating retry progress
        setLoadingRetry({ attempt, max: MAX_INITIAL_RETRIES, failed: false });

        try {
          await ws.connect();
          if (cancelled) return;

          // Connected — load initial data
          await loadInitialData(ws);
          if (cancelled) return;

          hasLoadedOnce.current = true;
          setIsLoading(false);
          return; // success
        } catch (error) {
          if (cancelled) return;
          console.warn(`Initial connection attempt ${attempt}/${MAX_INITIAL_RETRIES} failed:`, error);

          // Wait before next attempt (unless it was the last)
          if (attempt < MAX_INITIAL_RETRIES) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          }
        }
      }

      // All retries exhausted
      if (!cancelled) {
        console.error('All initial connection attempts failed');
        // eslint-disable-next-line react-hooks/set-state-in-effect -- final failure state
        setLoadingRetry({ attempt: MAX_INITIAL_RETRIES, max: MAX_INITIAL_RETRIES, failed: true });
        setConnectionError('Unable to reach the backend server');
      }
    };

    attemptConnect();

    return () => {
      cancelled = true;
      ws.disconnect();
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
            {loadingRetry.failed ? (
              <>
                <div className="loading-error">
                  <i className="fa-solid fa-plug-circle-xmark"></i>
                  <span>Could not connect to backend server</span>
                </div>
                <button className="loading-btn" onClick={() => setShowConnection(true)}>
                  <i className="fa-solid fa-gear"></i>
                  Connection Settings
                </button>
              </>
            ) : (
              <>
                <p className="loading-status">
                  Connecting to server{loadingRetry.attempt > 1 ? ` (attempt ${loadingRetry.attempt}/${loadingRetry.max})` : ''}…
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
      
      <main className="app-main">
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
