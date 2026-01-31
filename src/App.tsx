import { useEffect, useCallback, useState } from 'react';
import { Tooltip } from 'react-tooltip';
import { 
  Header, 
  Overview, 
  DeviceTable, 
  DeviceModal,
  SettingsModal, 
  AboutModal,
  ErrorsModal,
  Footer,
  StartupScreen
} from './components';
import { OdometerDebug } from './components/Overview/OdometerDebug';
import { createWebSocketService } from './services';
import { useScanStore } from './store';
import { getWebSocketURL } from './utils';
import type { DeviceResult, WSEvent, SubnetInfo, DefaultConfigs } from './types';
import './types/electron'; // Import electron types for global Window augmentation
import 'react-tooltip/dist/react-tooltip.css';
import './styles/main.css';

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
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const {
    connectionStatus,
    setConnectionStatus,
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
    showErrors,
    setShowErrors,
    setSubnetInput,
  } = useScanStore();

  const onEvent = useCallback((event: WSEvent) => {
    handleEvent(event);
  }, [handleEvent]);

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
        }
      },
      onEvent,
    });

    ws.connect()
      .then(async () => {
        if (cancelled) return; // Effect was cleaned up, ignore
        
        try {
          // Fetch initial data from backend
          const [subnetListRes, configDefaultsRes, arpSupportedRes, portListsRes] = await Promise.all([
            ws.listSubnets(),
            ws.getConfigDefaults(),
            ws.isArpSupported(),
            ws.listPortsSummary(),
          ]);

          if (cancelled) return; // Check again after async operations

          // Set available subnets
          if (subnetListRes.success && Array.isArray(subnetListRes.data)) {
            const subnets = subnetListRes.data as SubnetInfo[];
            setSubnets(subnets);
            // Set the first subnet as default input
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
            // Set the 'balanced' config as current config (it's the default preset)
            if (configs.balanced) {
              setConfig(configs.balanced);
            }
          }

          // Set app info including ARP support
          if (arpSupportedRes.success) {
            setAppInfo({
              version: '0.0.0', // Will be updated when we add version endpoint
              name: 'LANscape',
              arp_supported: (arpSupportedRes.data as { supported: boolean })?.supported ?? false,
            });
          }

          setIsLoading(false);
        } catch (error) {
          if (cancelled) return;
          console.error('Failed to load initial data:', error);
          setLoadError('Failed to load initial data from server');
          setIsLoading(false);
        }
      })
      .catch((error) => {
        if (cancelled) return; // Ignore errors from cancelled connections (StrictMode)
        console.error('Failed to connect to WebSocket:', error);
        setLoadError(`Failed to connect to WebSocket server: ${error.message || 'Unknown error'}`);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      ws.disconnect();
    };
  }, [setConnectionStatus, setAppInfo, setConfig, setSubnets, setDefaultConfigs, setSubnetInput, onEvent, showStartup]);

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
            <p className="loading-status">Connecting to server...</p>
            {connectionStatus === 'connecting' && (
              <div className="loading-bar">
                <div className="loading-bar-fill loading-bar-indeterminate" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show error state if connection failed
  if (loadError) {
    return (
      <div className="app-container app-error">
        <div className="loading-screen">
          <div className="loading-header">
            <div className="loading-logo">
              <img src="./android-chrome-192x192.png" alt="LANscape" className="loading-logo-img" />
            </div>
            <h1 className="loading-title">LANscape</h1>
            <p className="loading-subtitle">Local Network Scanner</p>
          </div>
          <div className="loading-error">
            <i className="fas fa-exclamation-triangle"></i>
            <span>{loadError}</span>
          </div>
          <button className="loading-btn" onClick={() => window.location.reload()}>
            <i className="fas fa-redo"></i> Retry
          </button>
        </div>
      </div>
    );
  }

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
      
      <ErrorsModal 
        isOpen={showErrors} 
        onClose={() => setShowErrors(false)} 
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
