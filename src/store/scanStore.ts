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
  PortListSummary
} from '../types';
import type { ConnectionStatus } from '../services/websocket';

interface ScanState {
  // Connection status
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

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

  // UI state
  selectedDevice: DeviceResult | null;
  setSelectedDevice: (device: DeviceResult | null) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showAbout: boolean;
  setShowAbout: (show: boolean) => void;

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

        case 'complete': {
          // Handle completion - server sends delta format with metadata
          const completeDelta = eventData as {
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
          if (completeDelta?.devices) {
            for (const device of completeDelta.devices) {
              get().updateDevice(device);
            }
          }

          // Mark all devices as complete (in case some didn't get final update)
          const allDevices = get().devices.map(d => ({
            ...d,
            stage: 'complete'
          }));
          set({ devices: allDevices });

          // Update status to complete
          const currentStatus = get().status;
          const meta = completeDelta?.metadata;
          set({ 
            status: {
              ...currentStatus,
              is_running: false,
              stage: 'complete',
              runtime: meta?.run_time ?? currentStatus?.runtime ?? 0,
              scanned_hosts: meta?.devices_scanned ?? currentStatus?.scanned_hosts ?? 0,
              total_hosts: meta?.devices_total ?? currentStatus?.total_hosts ?? 0,
              found_hosts: meta?.devices_alive ?? allDevices.length,
              progress: 1, // 100%
              remaining: 0,
            } as ScanStatus
          });
          break;
        }

        case 'update':
        case 'delta':
          // Handle delta updates from server
          // Server metadata format from ScannerResults.export():
          // { running, stage, run_time, devices_scanned, devices_total, start_time, percent_complete, ... }
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
            };
            has_changes?: boolean;
          } | undefined;

          if (delta?.devices) {
            for (const device of delta.devices) {
              get().updateDevice(device);
            }
          }
          if (delta?.metadata) {
            const currentStatus = get().status;
            const currentDevices = get().devices;
            const scanned = delta.metadata.devices_scanned ?? currentStatus?.scanned_hosts ?? 0;
            const total = delta.metadata.devices_total ?? currentStatus?.total_hosts ?? 0;
            const runtimeSec = delta.metadata.run_time ?? currentStatus?.runtime ?? 0;
            
            // Use backend's calculated percent_complete (considers port scanning threads, etc.)
            const pctComplete = delta.metadata.percent_complete ?? 0;
            const remainingSec = pctComplete > 0
              ? (runtimeSec * (100 - pctComplete)) / pctComplete
              : 0;
            
            set({ 
              status: {
                ...currentStatus,
                is_running: delta.metadata.running ?? currentStatus?.is_running ?? false,
                stage: delta.metadata.stage ?? currentStatus?.stage ?? 'Idle',
                runtime: runtimeSec,
                scanned_hosts: scanned,
                total_hosts: total,
                // found_hosts is the count of alive devices
                found_hosts: delta.metadata.devices_alive ?? currentDevices.length,
                progress: pctComplete / 100, // Store as 0-1
                remaining: remainingSec,
              } as ScanStatus
            });
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
