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
  PipelineConfig,
  StageEntry,
  ScanHistoryEntry,
  ScanMetadata,
} from '../types';
import { processScanEvent } from './eventProcessor';
import { getWebSocketService } from '../services';

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

  // Pipeline config
  pipelineConfig: PipelineConfig;
  setPipelineConfig: (config: PipelineConfig) => void;
  addStage: (stage: StageEntry) => void;
  removeStage: (index: number) => void;
  reorderStages: (from: number, to: number) => void;
  updateStageConfig: (index: number, config: Record<string, unknown>) => void;

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

  // Scan history (context switching)
  scanHistory: ScanHistoryEntry[];
  setScanHistory: (history: ScanHistoryEntry[]) => void;
  addScanToHistory: (scanId: string, subnet: string, totalHosts: number) => void;
  updateHistoryEntry: (entry: ScanHistoryEntry) => void;
  isLoadingHistory: boolean;
  isTransitioning: boolean;
  fetchScanHistory: () => Promise<void>;
  switchToScan: (scanId: string) => Promise<void>;
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

  // Pipeline config
  pipelineConfig: { stages: [] },
  setPipelineConfig: (pipelineConfig) => set({ pipelineConfig }),
  addStage: (stage) => {
    const { pipelineConfig } = get();
    set({
      pipelineConfig: {
        ...pipelineConfig,
        stages: [...pipelineConfig.stages, stage],
      },
    });
  },
  removeStage: (index) => {
    const { pipelineConfig } = get();
    set({
      pipelineConfig: {
        ...pipelineConfig,
        stages: pipelineConfig.stages.filter((_, i) => i !== index),
      },
    });
  },
  reorderStages: (from, to) => {
    const { pipelineConfig } = get();
    const stages = [...pipelineConfig.stages];
    const [moved] = stages.splice(from, 1);
    stages.splice(to, 0, moved);
    set({ pipelineConfig: { ...pipelineConfig, stages } });
  },
  updateStageConfig: (index, config) => {
    const { pipelineConfig } = get();
    const stages = [...pipelineConfig.stages];
    stages[index] = { ...stages[index], config };
    set({ pipelineConfig: { ...pipelineConfig, stages } });
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

    // Keep history entries in sync with live events
    const eventName = (event as { event?: string }).event ?? '';

    if (
      (eventName === 'scan.complete' ||
        eventName === 'scan.terminated' ||
        eventName === 'scan.update' ||
        eventName === 'scan.delta') &&
      state.currentScanId
    ) {
      const updatedStatus = update.status ?? state.status;
      const currentDevices = update.devices ?? state.devices;
      if (updatedStatus) {
        const entry: ScanHistoryEntry = {
          scan_id: state.currentScanId,
          subnet: '',
          running: updatedStatus.is_running,
          stage: updatedStatus.stage,
          percent_complete: updatedStatus.progress * 100,
          devices_alive: currentDevices.length,
          devices_total: updatedStatus.total_hosts,
          runtime: updatedStatus.runtime,
          stages: updatedStatus.stages,
        };
        get().updateHistoryEntry(entry);
      }
    }
  },

  // ── Scan history ───────────────────────────────────────────────────

  scanHistory: [],
  setScanHistory: (scanHistory) => set({ scanHistory }),
  addScanToHistory: (scanId, subnet, totalHosts) => {
    const history = get().scanHistory;
    if (history.some((h) => h.scan_id === scanId)) return;
    const entry: ScanHistoryEntry = {
      scan_id: scanId,
      subnet,
      running: true,
      stage: 'starting',
      percent_complete: 0,
      devices_alive: 0,
      devices_total: totalHosts,
      runtime: 0,
      stages: [],
    };
    set({ scanHistory: [entry, ...history] });
  },
  updateHistoryEntry: (entry) => {
    const history = get().scanHistory;
    const idx = history.findIndex((h) => h.scan_id === entry.scan_id);
    if (idx >= 0) {
      const updated = [...history];
      // Preserve subnet from summary (events don't carry it)
      updated[idx] = { ...updated[idx], ...entry, subnet: updated[idx].subnet || entry.subnet };
      set({ scanHistory: updated });
    } else {
      // Entry not found — add it (upsert)
      set({ scanHistory: [entry, ...history] });
    }
  },
  isLoadingHistory: false,
  isTransitioning: false,

  fetchScanHistory: async () => {
    const ws = getWebSocketService();
    if (!ws) return;

    set({ isLoadingHistory: true });
    try {
      const historyResp = await ws.getScanHistory();
      if (!historyResp.success || !historyResp.data) return;

      const { scan_ids } = historyResp.data as { scan_ids: string[] };
      const existing = get().scanHistory;
      const existingIds = new Set(existing.map((h) => h.scan_id));

      // Fetch summaries for any new IDs
      const newEntries: ScanHistoryEntry[] = [];
      for (const id of scan_ids) {
        if (!existingIds.has(id)) {
          try {
            const summaryResp = await ws.getScanSummary(id);
            if (summaryResp.success && summaryResp.data) {
              const data = summaryResp.data as {
                metadata: ScanMetadata;
              };
              const meta = data.metadata;
              newEntries.push({
                scan_id: meta.scan_id,
                subnet: meta.subnet,
                running: meta.running,
                stage: meta.stage,
                percent_complete: meta.percent_complete,
                devices_alive: meta.devices_alive,
                devices_total: meta.devices_total,
                runtime: meta.run_time,
                stages: (meta as unknown as { stages?: ScanHistoryEntry['stages'] }).stages,
              });
            }
          } catch {
            // Skip entries we can't fetch
          }
        }
      }

      // Merge: keep order from server (newest first), update existing entries
      const merged: ScanHistoryEntry[] = [];
      for (const id of scan_ids) {
        const existingEntry = existing.find((h) => h.scan_id === id);
        const newEntry = newEntries.find((h) => h.scan_id === id);
        if (existingEntry) {
          merged.push(existingEntry);
        } else if (newEntry) {
          merged.push(newEntry);
        }
      }

      set({ scanHistory: merged });
    } finally {
      set({ isLoadingHistory: false });
    }
  },

  switchToScan: async (scanId: string) => {
    const ws = getWebSocketService();
    if (!ws) return;

    const state = get();
    if (scanId === state.currentScanId) return;

    // Phase 1: begin transition
    set({ isTransitioning: true });

    // Unsubscribe from current scan if we have one
    if (state.currentScanId) {
      try {
        await ws.unsubscribeScan(state.currentScanId);
      } catch {
        // Best effort
      }
    }

    // Brief delay for exit animation
    await new Promise((r) => setTimeout(r, 200));

    // Phase 2: clear and load new data
    set({
      devices: [],
      status: null,
      scanErrors: [],
      scanWarnings: [],
    });

    try {
      const response = await ws.getScan(scanId);
      if (response.success && response.data) {
        const data = response.data as {
          metadata: ScanMetadata;
          devices: DeviceResult[];
          config?: PipelineConfig;
        };
        const meta = data.metadata;

        const stateUpdate: Partial<ScanState> = {
          currentScanId: scanId,
          devices: data.devices ?? [],
          status: {
            scan_id: scanId,
            is_running: meta.running,
            stage: meta.stage,
            progress: meta.percent_complete / 100,
            total_hosts: meta.devices_total,
            scanned_hosts: meta.devices_scanned,
            found_hosts: meta.devices_alive,
            ports_scanned: meta.ports_scanned,
            ports_total: meta.ports_total,
            runtime: meta.run_time,
            remaining: 0,
            stages: (meta as unknown as { stages?: ScanStatus['stages'] }).stages,
            current_stage_index: (meta as unknown as { current_stage_index?: number | null }).current_stage_index,
          },
          scanErrors: meta.errors ?? [],
          scanWarnings: meta.warnings ?? [],
        };

        // Override pipeline config with the scan's config so settings stay in sync
        if (data.config && data.config.stages) {
          stateUpdate.pipelineConfig = data.config;
        }

        set(stateUpdate);

        // Subscribe to live updates if scan is still running
        if (meta.running) {
          await ws.subscribeScan(scanId);
        }
      }
    } catch (err) {
      console.error('Failed to switch scan:', err);
    }

    // Phase 3: end transition (entry animation kicks in)
    set({ isTransitioning: false });
  },
}));
