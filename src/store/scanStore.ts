/**
 * Scan domain state — devices, scan status, config, and related data.
 */

import { create } from 'zustand';
import type {
  ScanConfig,
  DeviceResult,
  ScanStatus,
  WSEvent,
  SubnetInfo,
  DefaultConfigs,
  PortListSummary,
  ScanErrorInfo,
  ScanWarningInfo,
} from '../types';
import { processScanEvent } from './eventProcessor';

interface ScanState {
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

  // Handle WebSocket events via the extracted event processor
  handleEvent: (event: WSEvent) => void;
}

export const useScanStore = create<ScanState>((set, get) => ({
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

  // Scan-level errors
  scanErrors: [],
  setScanErrors: (scanErrors) => set({ scanErrors }),
  clearScanErrors: () => set({ scanErrors: [] }),

  // Scan-level warnings
  scanWarnings: [],
  setScanWarnings: (scanWarnings) => set({ scanWarnings }),
  clearScanWarnings: () => set({ scanWarnings: [] }),

  // Handle WebSocket events — delegates to the event processor
  handleEvent: (event) => {
    const state = get();
    const patch = processScanEvent(event, {
      status: state.status,
      devices: state.devices,
    });

    const update: Partial<ScanState> = {};

    if (patch.clearErrorsAndWarnings) {
      update.scanErrors = [];
      update.scanWarnings = [];
    }
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.devices !== undefined) update.devices = patch.devices;
    if (patch.scanErrors !== undefined) update.scanErrors = patch.scanErrors;
    if (patch.scanWarnings !== undefined) update.scanWarnings = patch.scanWarnings;

    if (Object.keys(update).length > 0) {
      set(update);
    }
  },
}));
