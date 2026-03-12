/**
 * Event processor — translates incoming WSEvent payloads into partial
 * ScanState updates.  Kept separate from the store so it's easy to test
 * and doesn't bloat the store definition.
 */

import type {
  WSEvent,
  DeviceResult,
  ScanStatus,
  ScanErrorInfo,
  ScanWarningInfo,
} from '../types';

/** The slice of scan state the processor needs to read. */
export interface ScanStateSnapshot {
  status: ScanStatus | null;
  devices: DeviceResult[];
}

/** A partial update to be merged into the scan store. */
export interface ScanStatePatch {
  status?: ScanStatus;
  devices?: DeviceResult[];
  scanErrors?: ScanErrorInfo[];
  scanWarnings?: ScanWarningInfo[];
  /** When true, caller should clear scanErrors and scanWarnings. */
  clearErrorsAndWarnings?: boolean;
}

/**
 * Given a single WSEvent and the current scan state snapshot, compute
 * the set of store mutations needed.
 *
 * The caller is responsible for actually calling `set()` and for
 * individual-device updates (since that interacts with the store's
 * device list).
 */
export function processScanEvent(
  event: WSEvent,
  snapshot: ScanStateSnapshot,
): ScanStatePatch {
  const { event: eventName, data } = event;
  const eventData = data as Record<string, unknown> | undefined;

  if (!eventName.startsWith('scan.')) return {};

  const action = eventName.split('.')[1];
  const patch: ScanStatePatch = {};

  switch (action) {
    case 'started':
      patch.clearErrorsAndWarnings = true;
      if (eventData?.status) {
        patch.status = eventData.status as ScanStatus;
      }
      break;

    case 'stopped':
      patch.status = {
        ...snapshot.status,
        is_running: false,
        stage: 'stopped',
      } as ScanStatus;
      break;

    case 'complete':
    case 'terminated': {
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

      // Collect device updates
      let updatedDevices = [...snapshot.devices];
      if (finishedDelta?.devices) {
        for (const device of finishedDelta.devices) {
          const idx = updatedDevices.findIndex((d) => d.ip === device.ip);
          if (idx >= 0) {
            updatedDevices[idx] = device;
          } else {
            updatedDevices.push(device);
          }
        }
      }

      // Use the event action as the authoritative stage for completion events
      // to guard against a stale stage value from the backend (race condition)
      const finalStage = action === 'complete' ? 'complete'
        : action === 'terminated' ? 'terminated'
        : finishedDelta?.metadata?.stage ?? action;

      // Mark all devices with the final stage
      updatedDevices = updatedDevices.map((d) => ({
        ...d,
        stage: finalStage,
      }));
      patch.devices = updatedDevices;

      const meta = finishedDelta?.metadata;
      const currentStatus = snapshot.status;
      patch.status = {
        ...currentStatus,
        is_running: false,
        stage: finalStage,
        runtime: meta?.run_time ?? currentStatus?.runtime ?? 0,
        scanned_hosts: meta?.devices_scanned ?? currentStatus?.scanned_hosts ?? 0,
        total_hosts: meta?.devices_total ?? currentStatus?.total_hosts ?? 0,
        found_hosts: meta?.devices_alive ?? updatedDevices.length,
        progress: action === 'complete' ? 1 : currentStatus?.progress ?? 0,
        remaining: 0,
      } as ScanStatus;
      break;
    }

    case 'update':
    case 'delta': {
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
          ports_scanned?: number;
          ports_total?: number;
          errors?: ScanErrorInfo[];
          warnings?: ScanWarningInfo[];
          metadata?: {
            running?: boolean;
            stage?: string;
            run_time?: number;
            devices_scanned?: number;
            devices_total?: number;
            devices_alive?: number;
            percent_complete?: number;
            ports_scanned?: number;
            ports_total?: number;
            errors?: ScanErrorInfo[];
            warnings?: ScanWarningInfo[];
          };
        };
        has_changes?: boolean;
      } | undefined;

      // Handle both flat and nested metadata structures
      const outerMeta = delta?.metadata;
      const innerMeta = outerMeta?.metadata;
      const scanMeta = innerMeta ?? outerMeta;

      // Collect device updates
      if (delta?.devices) {
        const updatedDevices = [...snapshot.devices];
        for (const device of delta.devices) {
          const idx = updatedDevices.findIndex((d) => d.ip === device.ip);
          if (idx >= 0) {
            updatedDevices[idx] = device;
          } else {
            updatedDevices.push(device);
          }
        }
        patch.devices = updatedDevices;
      }

      if (scanMeta) {
        const currentStatus = snapshot.status;
        const currentDevices = patch.devices ?? snapshot.devices;
        const scanned = scanMeta.devices_scanned ?? currentStatus?.scanned_hosts ?? 0;
        const total = scanMeta.devices_total ?? currentStatus?.total_hosts ?? 0;
        const runtimeSec = scanMeta.run_time ?? currentStatus?.runtime ?? 0;
        const pctComplete = scanMeta.percent_complete ?? 0;
        const remainingSec =
          pctComplete > 0 ? (runtimeSec * (100 - pctComplete)) / pctComplete : 0;

        patch.status = {
          ...currentStatus,
          is_running: scanMeta.running ?? currentStatus?.is_running ?? false,
          stage: scanMeta.stage ?? currentStatus?.stage ?? 'Idle',
          runtime: runtimeSec,
          scanned_hosts: scanned,
          total_hosts: total,
          found_hosts: scanMeta.devices_alive ?? currentDevices.length,
          ports_scanned: scanMeta.ports_scanned ?? currentStatus?.ports_scanned ?? 0,
          ports_total: scanMeta.ports_total ?? currentStatus?.ports_total ?? 0,
          progress: pctComplete / 100,
          remaining: remainingSec,
        } as ScanStatus;

        if (scanMeta.errors && scanMeta.errors.length > 0) {
          patch.scanErrors = scanMeta.errors;
        }
        if (scanMeta.warnings && scanMeta.warnings.length > 0) {
          patch.scanWarnings = scanMeta.warnings as ScanWarningInfo[];
        }
      }
      break;
    }

    case 'results':
      if (eventData?.devices) {
        patch.devices = eventData.devices as DeviceResult[];
      }
      if (eventData?.status) {
        patch.status = eventData.status as ScanStatus;
      }
      break;
  }

  return patch;
}
