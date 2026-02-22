import { useState } from 'react';
import { useScanStore } from '../../store';
import { Odometer, OdometerTime } from './Odometer';

// Calculate number of digits needed to display a number
function digitCount(n: number): number {
  if (n === 0) return 1;
  return Math.floor(Math.log10(Math.abs(n))) + 1;
}

export function Overview() {
  const status = useScanStore((state) => state.status);
  const scanErrors = useScanStore((state) => state.scanErrors);
  const scanWarnings = useScanStore((state) => state.scanWarnings);
  const setShowErrors = useScanStore((state) => state.setShowErrors);
  const setShowWarnings = useScanStore((state) => state.setShowWarnings);

  const isRunning = status?.is_running ?? false;
  const scannedHosts = status?.scanned_hosts ?? 0;
  const totalHosts = status?.total_hosts ?? 0;
  const runtime = status?.runtime ?? 0;
  const remaining = status?.remaining ?? 0;
  const stage = status?.stage ?? 'idle';
  const progress = status?.progress ?? 0;

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

  const pctComplete = progress * 100;
  const showRemaining = pctComplete >= 10;
  const errorCount = scanErrors.length;
  const warningCount = scanWarnings.length;
  
  // Use total hosts to determine digit count (so scanned aligns properly)
  const hostDigits = Math.max(digitCount(totalHosts), 1);

  return (
    <div className="scan-stats">
      {/* Progress bar background */}
      {isRunning && (
        <div className="scan-stats-progress" style={{ width: `${pctComplete}%` }} />
      )}
      
      <div className="scan-stats-content">
        {/* Devices scanned */}
        <div className="scan-stat">
          <Odometer value={scannedHosts} digits={hostDigits} className="scan-stat-value" />
          <span className="scan-stat-sep">/</span>
          <Odometer value={totalHosts} digits={hostDigits} className="scan-stat-value muted" />
          <span className="scan-stat-label">scanned</span>
        </div>

        <div className="scan-stat-spacer" />

        {/* Time */}
        <div className="scan-stat">
          <i className="fa-regular fa-clock scan-stat-icon" />
          <OdometerTime seconds={runtime} className="scan-stat-value" resetKey={scanResetKey} />
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

        {/* Stage */}
        <div className={`scan-stat stage ${stage === 'complete' ? 'success' : ''} ${isRunning ? 'active' : ''}`}>
          {isRunning && <i className="fa-solid fa-circle-notch fa-spin scan-stat-icon" />}
          {stage === 'complete' && <i className="fa-regular fa-circle-check scan-stat-icon" />}
          {!isRunning && stage !== 'complete' && <i className="fa-regular fa-circle scan-stat-icon" />}
          <span className="scan-stat-stage">{stage}</span>
        </div>
      </div>
    </div>
  );
}
