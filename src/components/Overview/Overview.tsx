import { useState, useEffect, useRef } from 'react';
import { useScanStore, useUIStore } from '../../store';
import { Odometer, OdometerTime } from './Odometer';
import { AddStageModal } from './AddStageModal';
import { getStageMeta } from '../Settings/stageRegistry';
import type { StageProgress, StageEntry } from '../../types';

// Calculate number of digits needed to display a number
function digitCount(n: number): number {
  if (n === 0) return 1;
  return Math.floor(Math.log10(Math.abs(n))) + 1;
}

/**
 * Hook for smooth local runtime counting.
 * 
 * Instead of jumping to server-sent runtime values (which causes choppy updates),
 * this hook starts a local timer when the scan begins and increments smoothly
 * every second. On scan complete, it syncs to the final server value.
 */
function useLocalRuntime(isRunning: boolean, serverRuntime: number): number {
  const [localRuntime, setLocalRuntime] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const initialOffsetRef = useRef(0);

  // When scan starts, capture the start time and any initial offset from server
  useEffect(() => {
    if (isRunning) {
      // Scan just started - begin local counting
      startTimeRef.current = Date.now();
      initialOffsetRef.current = serverRuntime; // Usually 0 or 1
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync to scan lifecycle
      setLocalRuntime(serverRuntime);
    } else {
      // Scan stopped - sync to final server value
      startTimeRef.current = null;
      setLocalRuntime(serverRuntime);
    }
  }, [isRunning]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally only react to isRunning, not serverRuntime

  // Increment local runtime smoothly while scan is running (0.1s precision)
  useEffect(() => {
    if (!isRunning || startTimeRef.current === null) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current!) / 1000;
      setLocalRuntime(initialOffsetRef.current + elapsed);
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning]);

  return localRuntime;
}

export function Overview() {
  const status = useScanStore((state) => state.status);
  const scanErrors = useScanStore((state) => state.scanErrors);
  const scanWarnings = useScanStore((state) => state.scanWarnings);
  const currentScanId = useScanStore((state) => state.currentScanId);
  const pipelineConfig = useScanStore((state) => state.pipelineConfig);
  const setShowErrors = useUIStore((state) => state.setShowErrors);
  const setShowWarnings = useUIStore((state) => state.setShowWarnings);

  const isRunning = status?.is_running ?? false;
  const serverRuntime = status?.runtime ?? 0;
  const remaining = status?.remaining ?? 0;
  const stage = status?.stage ?? 'idle';
  const progress = status?.progress ?? 0;

  // Per-stage progress from pipeline mode
  const stageProgresses = status?.stages;
  const currentStageIndex = status?.current_stage_index;

  // Derive current stage (running) or last stage (complete) for header counter
  const currentStage = (stageProgresses && currentStageIndex != null)
    ? stageProgresses[currentStageIndex]
    : null;
  const lastStage = stageProgresses?.length
    ? stageProgresses[stageProgresses.length - 1]
    : null;
  const activeStage = currentStage ?? lastStage;

  // Counter values driven by the active stage
  const counterCompleted = activeStage?.completed ?? 0;
  const counterTotal = activeStage?.total ?? 0;
  const counterLabel = activeStage?.counter_label ?? 'IPs scanned';

  // When scan completes normally (stage='complete'), snap completed to total
  // so the odometer animates to the final count instead of stopping short.
  const scanCompleted = stage === 'complete';
  const counterValue = (scanCompleted && counterTotal > 0) ? counterTotal : counterCompleted;

  // Use local runtime for smooth counting instead of choppy server updates
  const runtime = useLocalRuntime(isRunning, serverRuntime);

  // Track scan start to reset odometer instantly.
  // Uses React's recommended "adjust state during render" pattern
  // instead of useEffect to avoid setting state in effects.
  const [scanResetKey, setScanResetKey] = useState(0);
  const [prevIsRunning, setPrevIsRunning] = useState(false);

  if (isRunning !== prevIsRunning) {
    setPrevIsRunning(isRunning);
    if (isRunning) {
      setScanResetKey((k) => k + 1);
    }
  }

  // Lock the time odometer when scan stops (shows final time with jiggle)
  const timeLocked = !isRunning && serverRuntime > 0;

  const pctComplete = progress * 100;
  const showRemaining = pctComplete >= 10;
  const errorCount = scanErrors.length;
  const warningCount = scanWarnings.length;
  
  // Use counter total to determine digit count (so completed aligns properly)
  const counterDigits = Math.max(digitCount(counterTotal), 1);

  // Add-stage modal state (lifted here so it renders outside .scan-stats)
  const [showAddStage, setShowAddStage] = useState(false);

  return (
    <>
    <div className="scan-stats">
      {/* Progress bar background */}
      {isRunning && (
        <div className="scan-stats-progress" style={{ width: `${pctComplete}%` }} />
      )}
      
      <div className="scan-stats-content">
        {/* Counter driven by the active stage */}
        <div className="scan-stat">
          <Odometer value={counterValue} digits={counterDigits} className="scan-stat-value" />
          <span className="scan-stat-sep">/</span>
          <Odometer value={counterTotal} digits={counterDigits} className="scan-stat-value muted" />
          <span className="scan-stat-label">{counterLabel}</span>
        </div>

        <div className="scan-stat-spacer" />

        {/* Time */}
        <div className="scan-stat">
          <i className="fa-regular fa-clock scan-stat-icon" />
          <OdometerTime seconds={runtime} className="scan-stat-value" resetKey={scanResetKey} locked={timeLocked} />
          {isRunning && showRemaining && (
            <>
              <span className="scan-stat-sep">/</span>
              <OdometerTime seconds={remaining} className="scan-stat-value muted" resetKey={scanResetKey} />
            </>
          )}
        </div>

        <div className="scan-stat-spacer" />

        {/* Error indicator - shown when there are scan-level errors */}
        {errorCount > 0 && (
          <div 
            className="scan-stat error-indicator"
            onClick={() => setShowErrors(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setShowErrors(true)}
            title="View scan errors"
          >
            <i className="fa-solid fa-triangle-exclamation scan-stat-icon" />
            <span className="error-count">{errorCount}</span>
          </div>
        )}

        {/* Warning indicator - shown when there are scan-level warnings */}
        {warningCount > 0 && (
          <div 
            className="scan-stat warning-indicator"
            onClick={() => setShowWarnings(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setShowWarnings(true)}
            title="View scan warnings"
          >
            <i className="fa-solid fa-circle-exclamation scan-stat-icon" />
            <span className="warning-count">{warningCount}</span>
          </div>
        )}

        {/* Stage indicators */}
        {stageProgresses && stageProgresses.length > 0 ? (
          <StageIndicators
            stages={stageProgresses}
            currentIndex={currentStageIndex ?? null}
            showAddButton={!!currentScanId}
            onAddStage={() => setShowAddStage(true)}
          />
        ) : (
          <StagePreview stages={pipelineConfig.stages} onAddStage={() => setShowAddStage(true)} />
        )}
      </div>
    </div>

    {/* Add-stage modal — rendered outside .scan-stats to avoid overflow clipping */}
    <AddStageModal
      isOpen={showAddStage}
      onClose={() => setShowAddStage(false)}
      scanId={currentScanId ?? undefined}
    />
    </>
  );
}

function formatStageRuntime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function StageIndicators({
  stages,
  currentIndex,
  showAddButton,
  onAddStage,
}: {
  stages: StageProgress[];
  currentIndex: number | null;
  showAddButton: boolean;
  onAddStage: () => void;
}) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="stage-indicators">
      {stages.map((sp, i) => {
        const meta = getStageMeta(sp.stage_type);
        const pct = sp.total > 0 ? (sp.completed / sp.total) * 100 : 0;
        const isCurrent = currentIndex === i;
        const isDone = sp.finished;
        const offset = circumference - (pct / 100) * circumference;

        let tooltipContent: string;
        if (isDone) {
          tooltipContent = `${meta.label}: ${formatStageRuntime(sp.runtime)}`;
        } else if (isCurrent) {
          tooltipContent = `${meta.label}: ${Math.round(pct)}%`;
        } else {
          tooltipContent = meta.label;
        }

        let stateClass = 'stage-indicator--pending';
        if (isDone) stateClass = 'stage-indicator--done';
        else if (isCurrent) stateClass = 'stage-indicator--active';

        return (
          <div
            key={i}
            className={`stage-indicator ${stateClass}`}
            data-tooltip-id="tooltip"
            data-tooltip-content={tooltipContent}
          >
            <svg className="stage-indicator-ring" viewBox="0 0 32 32">
              <circle className="stage-indicator-bg" cx="16" cy="16" r={radius} />
              {isDone ? (
                <circle
                  className="stage-indicator-fill stage-indicator-fill--done"
                  cx="16" cy="16" r={radius}
                  strokeDasharray={circumference}
                  strokeDashoffset={0}
                />
              ) : (
                <circle
                  className="stage-indicator-fill"
                  cx="16" cy="16" r={radius}
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                />
              )}
            </svg>
            <i className={`${meta.icon} stage-indicator-icon`} />
          </div>
        );
      })}

      {/* Add stage button */}
      {showAddButton && (
        <button
          className="stage-indicator-add"
          onClick={onAddStage}
          data-tooltip-id="tooltip"
          data-tooltip-content="Add stage"
        >
          <i className="fa-solid fa-plus" />
        </button>
      )}
    </div>
  );
}

function StagePreview({
  stages,
  onAddStage,
}: {
  stages: StageEntry[];
  onAddStage: () => void;
}) {
  return (
    <div className="stage-indicators stage-indicators--preview">
      {stages.map((entry, i) => {
        const meta = getStageMeta(entry.stage_type);
        return (
          <div
            key={i}
            className="stage-indicator stage-indicator--preview"
            data-tooltip-id="tooltip"
            data-tooltip-content={meta.label}
          >
            <svg className="stage-indicator-ring" viewBox="0 0 32 32">
              <circle className="stage-indicator-bg" cx="16" cy="16" r={14} />
            </svg>
            <i className={`${meta.icon} stage-indicator-icon`} />
          </div>
        );
      })}
      <button
        className="stage-indicator-add"
        onClick={onAddStage}
        data-tooltip-id="tooltip"
        data-tooltip-content="Add stage"
      >
        <i className="fa-solid fa-plus" />
      </button>
    </div>
  );
}
