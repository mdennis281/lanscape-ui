/**
 * Global application state using Zustand
 */

import { create } from 'zustand';
import type { 
  ScanConfig, 
  DeviceResult, 
  ScanStatus, 
  AppInfo,
  WSEvent,
  SubnetInfo,
  DefaultConfigs,
  PortListSummary,
  ScanErrorInfo,
  ScanWarningInfo
} from '../types';
import type { ConnectionStatus } from '../services/websocket';
import type { WebSocketService } from '../services/websocket';

interface ScanState {
  // Connection status
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;
  connectionError: string | null;
  setConnectionError: (error: string | null) => void;

  // WebSocket service reference (for reconnection)
  wsService: WebSocketService | null;
  setWsService: (ws: WebSocketService | null) => void;

  // App info
  appInfo: AppInfo | null;
  setAppInfo: (info: AppInfo | null) => void;

  // Available subnets from backend
  subnets: SubnetInfo[];
  setSubnets: (subnets: SubnetInfo[]) => void;

  // Default configs from backend
  defaultConfigs: DefaultConfigs | null;
  setDefaultConfigs: (configs: DefaultConfigs | null) => void;

  // Port lists from backend
  portLists: PortListSummary[];
  setPortLists: (portLists: PortListSummary[]) => void;

  // Current scan
  currentScanId: string | null;
  setCurrentScanId: (scanId: string | null) => void;

  // Scan config
  config: ScanConfig | null;
  setConfig: (config: ScanConfig | null) => void;
  updateConfig: (partial: Partial<ScanConfig>) => void;

  // Scan status
  status: ScanStatus | null;
  setStatus: (status: ScanStatus | null) => void;

  // Scan results
  devices: DeviceResult[];
  setDevices: (devices: DeviceResult[]) => void;
  updateDevice: (device: DeviceResult) => void;
  removeDevice: (ip: string) => void;
  clearDevices: () => void;

  // Scan-level errors
  scanErrors: ScanErrorInfo[];
  setScanErrors: (errors: ScanErrorInfo[]) => void;
  clearScanErrors: () => void;

  // Scan-level warnings
  scanWarnings: ScanWarningInfo[];
  setScanWarnings: (warnings: ScanWarningInfo[]) => void;
  clearScanWarnings: () => void;

  // UI state
  selectedDevice: DeviceResult | null;
  setSelectedDevice: (device: DeviceResult | null) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showAbout: boolean;
  setShowAbout: (show: boolean) => void;
  showUpdate: boolean;
  setShowUpdate: (show: boolean) => void;
  showErrors: boolean;
  setShowErrors: (show: boolean) => void;
  showWarnings: boolean;
  setShowWarnings: (show: boolean) => void;
  showConnection: boolean;
  setShowConnection: (show: boolean) => void;

  // Subnet input
  subnetInput: string;
  setSubnetInput: (subnet: string) => void;

  // Handle WebSocket events
  handleEvent: (event: WSEvent) => void;
}

export const useScanStore = create<ScanState>((set, get) => ({
  // Connection status
  connectionStatus: 'disconnected',
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  connectionError: null,
  setConnectionError: (connectionError) => set({ connectionError }),

  // WebSocket service reference
  wsService: null,
  setWsService: (wsService) => set({ wsService }),

  // App info
  appInfo: null,
  setAppInfo: (appInfo) => set({ appInfo }),

  // Available subnets
  subnets: [],
  setSubnets: (subnets) => set({ subnets }),

  // Default configs
  defaultConfigs: null,
  setDefaultConfigs: (defaultConfigs) => set({ defaultConfigs }),

  // Port lists from backend
  portLists: [],
  setPortLists: (portLists) => set({ portLists }),

  // Current scan ID
  currentScanId: null,
  setCurrentScanId: (currentScanId) => set({ currentScanId }),

  // Scan config
  config: null,
  setConfig: (config) => set({ config }),
  updateConfig: (partial) => {
    const current = get().config;
    if (current) {
      set({ config: { ...current, ...partial } });
    }
  },

  // Scan status
  status: null,
  setStatus: (status) => set({ status }),

  // Scan results
  devices: [],
  setDevices: (devices) => set({ devices }),
  updateDevice: (device) => {
    const devices = get().devices;
    const index = devices.findIndex((d) => d.ip === device.ip);
    if (index >= 0) {
      const newDevices = [...devices];
      newDevices[index] = device;
      set({ devices: newDevices });
    } else {
      set({ devices: [...devices, device] });
    }
  },
  removeDevice: (ip) => {
    set({ devices: get().devices.filter((d) => d.ip !== ip) });
  },
  clearDevices: () => set({ devices: [] }),

  // UI state
  selectedDevice: null,
  setSelectedDevice: (selectedDevice) => set({ selectedDevice }),
  showSettings: false,
  setShowSettings: (showSettings) => set({ showSettings }),
  showAbout: false,
  setShowAbout: (showAbout) => set({ showAbout }),
  showUpdate: false,
  setShowUpdate: (showUpdate) => set({ showUpdate }),
  showErrors: false,
  setShowErrors: (showErrors) => set({ showErrors }),
  showWarnings: false,
  setShowWarnings: (showWarnings) => set({ showWarnings }),
  showConnection: false,
  setShowConnection: (showConnection) => set({ showConnection }),

  // Scan-level errors
  scanErrors: [],
  setScanErrors: (scanErrors) => set({ scanErrors }),
  clearScanErrors: () => set({ scanErrors: [] }),

  // Scan-level warnings
  scanWarnings: [],
  setScanWarnings: (scanWarnings) => set({ scanWarnings }),
  clearScanWarnings: () => set({ scanWarnings: [] }),

  // Subnet input
  subnetInput: '',
  setSubnetInput: (subnetInput) => set({ subnetInput }),

  // Handle WebSocket events
  handleEvent: (event) => {
    const { event: eventName, data } = event;
    // Cast data to record for property access
    const eventData = data as Record<string, unknown> | undefined;

    // Event names are like "scan.update", "scan.complete"
    if (eventName.startsWith('scan.')) {
      const action = eventName.split('.')[1];
      
      switch (action) {
        case 'started':
          // Clear previous scan errors and warnings when a new scan starts
          set({ scanErrors: [], scanWarnings: [] });
          if (eventData?.status) {
            set({ status: eventData.status as ScanStatus });
          }
          break;

        case 'stopped':
          set({ 
            status: {
              ...get().status,
              is_running: false,
              stage: 'stopped',
            } as ScanStatus
          });
          break;

        case 'complete':
        case 'terminated': {
          // Handle completion or termination - server sends delta format with metadata
          const finishedDelta = eventData as {
            devices?: DeviceResult[];
            metadata?: {
              running?: boolean;
              stage?: string;
              run_time?: number;
              devices_scanned?: number;
              devices_total?: number;
              devices_alive?: number;
            };
          } | undefined;

          // Update any final device changes
          if (finishedDelta?.devices) {
            for (const device of finishedDelta.devices) {
              get().updateDevice(device);
            }
          }

          // Determine the final stage from metadata or event type
          const finalStage = finishedDelta?.metadata?.stage ?? action;

          // Mark all devices with the final stage
          const allDevices = get().devices.map(d => ({
            ...d,
            stage: finalStage
          }));
          set({ devices: allDevices });

          // Update status with actual stage from server
          const currentStatus = get().status;
          const meta = finishedDelta?.metadata;
          set({ 
            status: {
              ...currentStatus,
              is_running: false,
              stage: finalStage,
              runtime: meta?.run_time ?? currentStatus?.runtime ?? 0,
              scanned_hosts: meta?.devices_scanned ?? currentStatus?.scanned_hosts ?? 0,
              total_hosts: meta?.devices_total ?? currentStatus?.total_hosts ?? 0,
              found_hosts: meta?.devices_alive ?? allDevices.length,
              progress: action === 'complete' ? 1 : currentStatus?.progress ?? 0,
              remaining: 0,
            } as ScanStatus
          });
          break;
        }

        case 'update':
        case 'delta':
          // Handle delta updates from server
          // Server sends: { devices: [...], metadata: {...}, has_changes: bool }
          const delta = eventData as {
            devices?: DeviceResult[];
            metadata?: {
              running?: boolean;
              stage?: string;
              run_time?: number;
              devices_scanned?: number;
              devices_total?: number;
              devices_alive?: number;
              percent_complete?: number;
              errors?: ScanErrorInfo[];
              warnings?: ScanWarningInfo[];
              // Nested metadata from ScanResults structure
              metadata?: {
                running?: boolean;
                stage?: string;
                run_time?: number;
                devices_scanned?: number;
                devices_total?: number;
                devices_alive?: number;
                percent_complete?: number;
                errors?: ScanErrorInfo[];
                warnings?: ScanWarningInfo[];
              };
            };
            has_changes?: boolean;
          } | undefined;

          // Handle both flat and nested metadata structures
          // The delta tracker sends metadata that may have a nested metadata field
          const outerMeta = delta?.metadata;
          const innerMeta = outerMeta?.metadata;
          // Use inner if available (nested structure), otherwise use outer (flat structure)
          const scanMeta = innerMeta ?? outerMeta;

          if (delta?.devices) {
            for (const device of delta.devices) {
              get().updateDevice(device);
            }
          }
          if (scanMeta) {
            const currentStatus = get().status;
            const currentDevices = get().devices;
            const scanned = scanMeta.devices_scanned ?? currentStatus?.scanned_hosts ?? 0;
            const total = scanMeta.devices_total ?? currentStatus?.total_hosts ?? 0;
            const runtimeSec = scanMeta.run_time ?? currentStatus?.runtime ?? 0;
            
            // Use backend's calculated percent_complete (considers port scanning threads, etc.)
            const pctComplete = scanMeta.percent_complete ?? 0;
            const remainingSec = pctComplete > 0
              ? (runtimeSec * (100 - pctComplete)) / pctComplete
              : 0;
            
            set({ 
              status: {
                ...currentStatus,
                is_running: scanMeta.running ?? currentStatus?.is_running ?? false,
                stage: scanMeta.stage ?? currentStatus?.stage ?? 'Idle',
                runtime: runtimeSec,
                scanned_hosts: scanned,
                total_hosts: total,
                // found_hosts is the count of alive devices
                found_hosts: scanMeta.devices_alive ?? currentDevices.length,
                progress: pctComplete / 100, // Store as 0-1
                remaining: remainingSec,
              } as ScanStatus
            });

            // Update scan-level errors if present
            if (scanMeta.errors && scanMeta.errors.length > 0) {
              console.log('Scan errors received:', JSON.stringify(scanMeta.errors, null, 2));
              set({ scanErrors: scanMeta.errors });
            }

            // Update scan-level warnings if present
            if (scanMeta.warnings && scanMeta.warnings.length > 0) {
              set({ scanWarnings: scanMeta.warnings as ScanWarningInfo[] });
            }
          }
          break;

        case 'results':
          // Full results update
          if (eventData?.devices) {
            set({ devices: eventData.devices as DeviceResult[] });
          }
          if (eventData?.status) {
            set({ status: eventData.status as ScanStatus });
          }
          break;
      }
    }
  },
}));
