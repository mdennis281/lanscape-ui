import { useState, useEffect, useRef, useCallback } from 'react';
import { useScanStore, useUIStore } from '../../store';
import { Odometer, OdometerTime } from './Odometer';
import { StageTimeline } from './StageTimeline';
import type { ActiveStageCounter } from './useStageManager';

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

  // When viewing a completed scan (not running), sync to its runtime value
  useEffect(() => {
    if (!isRunning) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync completed scan runtime from server
      setLocalRuntime(serverRuntime);
    }
  }, [isRunning, serverRuntime]);

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
  const serverRuntime = status?.runtime ?? 0;
  const remaining = status?.remaining ?? 0;
  const progress = status?.progress ?? 0;

  // Counter state driven by StageTimeline via callback
  const [counter, setCounter] = useState<ActiveStageCounter>({ completed: 0, total: 0, label: 'IPs scanned' });
  const handleActiveStageChange = useCallback((c: ActiveStageCounter) => setCounter(c), []);

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
  const counterDigits = Math.max(digitCount(counter.total), 1);

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
          <Odometer value={counter.completed} digits={counterDigits} className="scan-stat-value" />
          <span className="scan-stat-sep">/</span>
          <Odometer value={counter.total} digits={counterDigits} className="scan-stat-value muted" />
          <span className="scan-stat-label">{counter.label}</span>
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

        {/* Stage timeline — animated stage indicators with add-stage modal */}
        <StageTimeline onActiveStageChange={handleActiveStageChange} />
      </div>
    </div>
    </>
  );
}
