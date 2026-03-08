/**
 * UI chrome state — modal visibility, selections, and transient UI values.
 */

import { create } from 'zustand';
import type { DeviceResult } from '../types';

interface UIState {
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

  /** Subnet string the user typed in the header. */
  subnetInput: string;
  setSubnetInput: (subnet: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
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

  subnetInput: '',
  setSubnetInput: (subnetInput) => set({ subnetInput }),
}));
