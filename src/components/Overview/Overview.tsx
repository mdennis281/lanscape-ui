import { useState, useEffect, useRef } from 'react';
import { useScanStore, useUIStore } from '../../store';
import { Odometer, OdometerTime } from './Odometer';
import { getStageMeta } from '../Settings/stageRegistry';
import type { StageProgress } from '../../types';

// Calculate number of digits needed to display a number
function digitCount(n: number): number {
  if (n === 0) return 1;
  return Math.floor(Math.log10(Math.abs(n))) + 1;
}

// Stages where port scanning is active
const PORT_SCAN_STAGES = ['testing ports', 'complete', 'terminated'];

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
  const setShowErrors = useUIStore((state) => state.setShowErrors);
  const setShowWarnings = useUIStore((state) => state.setShowWarnings);

  const isRunning = status?.is_running ?? false;
  const scannedHosts = status?.scanned_hosts ?? 0;
  const totalHosts = status?.total_hosts ?? 0;
  const portsTotal = status?.ports_total ?? 0;
  const serverRuntime = status?.runtime ?? 0;
  const remaining = status?.remaining ?? 0;
  const stage = status?.stage ?? 'idle';
  const progress = status?.progress ?? 0;

  // Use local runtime for smooth counting instead of choppy server updates
  const runtime = useLocalRuntime(isRunning, serverRuntime);

  // When scan completes normally (stage='complete'), snap ports_scanned to ports_total
  // so the odometer animates to the final count instead of stopping short.
  // Don't snap on termination - show actual ports scanned.
  const rawPortsScanned = status?.ports_scanned ?? 0;
  const scanCompleted = stage === 'complete';
  const portsScanned = (scanCompleted && portsTotal > 0) ? portsTotal : rawPortsScanned;

  // Show port progress once we enter port scanning
  const showPortProgress = PORT_SCAN_STAGES.includes(stage);

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
  
  // Use total hosts to determine digit count (so scanned aligns properly)
  const hostDigits = Math.max(digitCount(totalHosts), 1);
  const portDigits = Math.max(digitCount(portsTotal), 1);

  // Per-stage progress from pipeline mode
  const stageProgresses = status?.stages;
  const currentStageIndex = status?.current_stage_index;

  return (
    <>
    <div className="scan-stats">
      {/* Progress bar background */}
      {isRunning && (
        <div className="scan-stats-progress" style={{ width: `${pctComplete}%` }} />
      )}
      
      <div className="scan-stats-content">
        {/* Counter with slide transition between devices and ports */}
        <div className="scan-stat-slider">
          <div className={`scan-stat-slide ${showPortProgress ? 'slide-out' : 'slide-in'}`}>
            <div className="scan-stat">
              <Odometer value={scannedHosts} digits={hostDigits} className="scan-stat-value" />
              <span className="scan-stat-sep">/</span>
              <Odometer value={totalHosts} digits={hostDigits} className="scan-stat-value muted" />
              <span className="scan-stat-label">IPs scanned</span>
            </div>
          </div>
          <div className={`scan-stat-slide ${showPortProgress ? 'slide-in' : 'slide-out-down'}`}>
            <div className="scan-stat">
              <Odometer value={portsScanned} digits={portDigits} className="scan-stat-value" />
              <span className="scan-stat-sep">/</span>
              <Odometer value={portsTotal} digits={portDigits} className="scan-stat-value muted" />
              <span className="scan-stat-label">ports scanned</span>
            </div>
          </div>
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
        {stageProgresses && stageProgresses.length > 0 && (
          <StageIndicators stages={stageProgresses} currentIndex={currentStageIndex ?? null} />
        )}
      </div>
    </div>
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
}: {
  stages: StageProgress[];
  currentIndex: number | null;
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
    </div>
  );
}
