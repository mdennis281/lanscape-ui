/**
 * useStageManager — manages stage lifecycle with animation intent tracking.
 *
 * Provides `add`, `replace`, `replaceAll`, and `updateRunningStage` operations
 * that trigger appropriate animation intents for the StageTimeline component.
 * Uses component-level diffing to auto-detect stage changes from the store
 * (e.g. auto-stage recommendations) without coupling to store internals.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useScanStore } from '../../store';
import { getWebSocketService } from '../../services';
import type { StageEntry, StageProgress, StageType } from '../../types';

// ── Types ──────────────────────────────────────────────────────────

export type AnimationIntent = 'enter' | 'exit' | 'replace' | 'idle';

export interface StageItem {
  /** Stable key for AnimatePresence tracking */
  key: string;
  /** Animation intent for the current render cycle */
  intent: AnimationIntent;
  /** Index in the original array */
  index: number;
}

export interface ActiveStageCounter {
  completed: number;
  total: number;
  label: string;
}

export interface StageManagerResult {
  /** Keyed stage items with animation intents (for live mode) */
  liveItems: StageItem[];
  /** Keyed stage items with animation intents (for preview mode) */
  previewItems: StageItem[];
  /** The scan-switch key — changes when scanId changes to trigger exit/enter */
  switchKey: string;
  /** Active stage counter data for the Overview header */
  activeCounter: ActiveStageCounter;
  /** Add a stage (pre-scan: config, running: append via WS) */
  add: (stage: StageEntry) => Promise<void>;
  /** Replace a stage at index (pre-scan only) */
  replace: (index: number, newStage: StageEntry) => void;
  /** Smart-diff replace all stages (pre-scan only, used by auto-stages) */
  replaceAll: (newStages: StageEntry[]) => void;
  /** Update a pending stage on a running scan via WS */
  updateRunningStage: (index: number, stageType: StageType, config: Record<string, unknown>) => Promise<void>;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Generate a stable key for a stage entry (pre-scan config stage). */
function previewStageKey(entry: StageEntry, index: number): string {
  return `preview-${entry.stage_type}-${index}`;
}

/** Generate a stable key for a live stage progress entry. */
function liveStageKey(sp: StageProgress, index: number): string {
  return `live-${sp.stage_type}-${index}`;
}

/** Fingerprint a stage entry for diffing (type + serialized config). */
function stageFingerprint(entry: StageEntry): string {
  return `${entry.stage_type}:${JSON.stringify(entry.config)}`;
}

// ── Hook ───────────────────────────────────────────────────────────

export function useStageManager(): StageManagerResult {
  const status = useScanStore((s) => s.status);
  const pipelineConfig = useScanStore((s) => s.pipelineConfig);
  const currentScanId = useScanStore((s) => s.currentScanId);
  const addStageToStore = useScanStore((s) => s.addStage);
  const setPipelineConfig = useScanStore((s) => s.setPipelineConfig);

  const isRunning = status?.is_running ?? false;
  const stage = status?.stage ?? 'idle';
  const stageProgresses = status?.stages;
  const currentStageIndex = status?.current_stage_index;

  // ── Animation intent state ───────────────────────────────────────

  // Map of key → intent, cleared after one render cycle
  const [intents, setIntents] = useState<Record<string, AnimationIntent>>({});
  const intentsRef = useRef(intents);
  intentsRef.current = intents;

  // Clear intents after they've been consumed (one render cycle)
  useEffect(() => {
    if (Object.keys(intents).length > 0) {
      const timer = setTimeout(() => setIntents({}), 50);
      return () => clearTimeout(timer);
    }
  }, [intents]);

  // ── Previous stage tracking for auto-diff ────────────────────────

  const prevPreviewRef = useRef<string[]>([]);
  const prevLiveRef = useRef<string[]>([]);
  const prevScanIdRef = useRef<string | null>(null);

  // Detect preview stage changes (auto-stages, config changes)
  const currentPreviewFingerprints = pipelineConfig.stages.map(stageFingerprint);
  const prevPreview = prevPreviewRef.current;

  // A pure reorder has the same multiset of fingerprints — skip animation diff for it
  const isReorder =
    currentPreviewFingerprints.length === prevPreview.length &&
    currentPreviewFingerprints.length > 0 &&
    [...currentPreviewFingerprints].sort().join('\x00') === [...prevPreview].sort().join('\x00') &&
    currentPreviewFingerprints.some((fp, i) => fp !== prevPreview[i]);

  // Only auto-diff when not caused by our own operations (intents would already be set)
  if (
    !isReorder && (
      Object.keys(intentsRef.current).length === 0 &&
      currentPreviewFingerprints.length !== prevPreview.length ||
      currentPreviewFingerprints.some((fp, i) => fp !== prevPreview[i])
    )
  ) {
    const newIntents: Record<string, AnimationIntent> = {};

    if (prevPreview.length > 0 || currentPreviewFingerprints.length > 0) {
      // Diff: determine what changed
      const maxLen = Math.max(prevPreview.length, currentPreviewFingerprints.length);
      for (let i = 0; i < maxLen; i++) {
        const key = i < pipelineConfig.stages.length
          ? previewStageKey(pipelineConfig.stages[i], i)
          : `preview-removed-${i}`;

        if (i >= prevPreview.length) {
          // New stage added
          newIntents[key] = 'enter';
        } else if (i >= currentPreviewFingerprints.length) {
          // Stage removed — exit intent on old key
          // (AnimatePresence handles this via key removal)
        } else if (prevPreview[i] !== currentPreviewFingerprints[i]) {
          // Stage changed at this position
          const prevType = prevPreview[i]?.split(':')[0];
          const currType = currentPreviewFingerprints[i]?.split(':')[0];
          newIntents[key] = prevType === currType ? 'replace' : 'enter';
        }
      }
    }

    if (Object.keys(newIntents).length > 0) {
      // Use functional update to avoid stale closure issues
      setIntents(newIntents);
    }
  }
  prevPreviewRef.current = currentPreviewFingerprints;

  // Detect live stage list changes (new stages appearing during scan)
  const currentLiveKeys = stageProgresses?.map((sp, i) => liveStageKey(sp, i)) ?? [];
  const prevLive = prevLiveRef.current;
  if (currentLiveKeys.length > prevLive.length && prevLive.length > 0) {
    const newIntents: Record<string, AnimationIntent> = {};
    for (let i = prevLive.length; i < currentLiveKeys.length; i++) {
      newIntents[currentLiveKeys[i]] = 'enter';
    }
    if (Object.keys(newIntents).length > 0) {
      setIntents((prev) => ({ ...prev, ...newIntents }));
    }
  }
  prevLiveRef.current = currentLiveKeys;

  // ── Scan switch key ──────────────────────────────────────────────

  const switchKey = currentScanId ?? 'no-scan';
  const scanSwitched = prevScanIdRef.current !== null && prevScanIdRef.current !== currentScanId;
  prevScanIdRef.current = currentScanId;

  // ── Build keyed items ────────────────────────────────────────────

  const previewItems: StageItem[] = pipelineConfig.stages.map((entry, i) => {
    const key = previewStageKey(entry, i);
    return { key, intent: intents[key] ?? 'idle', index: i };
  });

  const liveItems: StageItem[] = stageProgresses?.map((sp, i) => {
    const key = liveStageKey(sp, i);
    return {
      key,
      intent: scanSwitched ? 'enter' : (intents[key] ?? 'idle'),
      index: i,
    };
  }) ?? [];

  // ── Active stage counter ─────────────────────────────────────────

  const currentStage = (stageProgresses && currentStageIndex != null)
    ? stageProgresses[currentStageIndex]
    : null;
  const lastStage = stageProgresses?.length
    ? stageProgresses[stageProgresses.length - 1]
    : null;
  // Skip over skipped stages when determining the active counter source
  const activeStage = (currentStage && !currentStage.skipped)
    ? currentStage
    : (lastStage && !lastStage.skipped)
      ? lastStage
      : stageProgresses?.findLast((s) => !s.skipped) ?? null;

  const counterCompleted = activeStage?.completed ?? 0;
  const counterTotal = activeStage?.total ?? 0;
  const counterLabel = activeStage?.counter_label ?? 'IPs scanned';

  const scanCompleted = stage === 'complete';
  const counterValue = (scanCompleted && counterTotal > 0) ? counterTotal : counterCompleted;

  const activeCounter: ActiveStageCounter = {
    completed: counterValue,
    total: counterTotal,
    label: counterLabel,
  };

  // ── Actions ──────────────────────────────────────────────────────

  const add = useCallback(async (stageEntry: StageEntry) => {
    if (currentScanId && isRunning) {
      const ws = getWebSocketService();
      if (!ws) return;
      await ws.appendStages(currentScanId, [{ stage_type: stageEntry.stage_type, config: stageEntry.config }]);
      addStageToStore(stageEntry);
      // Intent is set via live stage list diff detection above
    } else {
      addStageToStore(stageEntry);
      // Intent is set via preview diff detection above
    }
  }, [currentScanId, isRunning, addStageToStore]);

  const replace = useCallback((index: number, newStage: StageEntry) => {
    const stages = [...pipelineConfig.stages];
    stages[index] = newStage;
    setPipelineConfig({ ...pipelineConfig, stages });
    // Intent is set via preview diff detection
  }, [pipelineConfig, setPipelineConfig]);

  const replaceAll = useCallback((newStages: StageEntry[]) => {
    setPipelineConfig({ ...pipelineConfig, stages: newStages });
    // Intent is set via preview diff detection (smart diff compares fingerprints)
  }, [pipelineConfig, setPipelineConfig]);

  const updateRunningStage = useCallback(async (
    index: number,
    stageType: StageType,
    config: Record<string, unknown>,
  ) => {
    if (!currentScanId) return;
    const ws = getWebSocketService();
    if (!ws) return;
    await ws.updateStage(currentScanId, index, stageType, config);

    // Set replace intent on the updated stage
    const key = stageProgresses?.[index]
      ? liveStageKey(stageProgresses[index], index)
      : `live-${stageType}-${index}`;
    setIntents((prev) => ({ ...prev, [key]: 'replace' }));
  }, [currentScanId, stageProgresses]);

  return {
    liveItems,
    previewItems,
    switchKey,
    activeCounter,
    add,
    replace,
    replaceAll,
    updateRunningStage,
  };
}
