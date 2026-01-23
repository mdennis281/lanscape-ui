import { useScanStore } from '../../store';
import { Odometer, OdometerTime, OdometerTimePlaceholder } from './Odometer';

// Calculate number of digits needed to display a number
function digitCount(n: number): number {
  if (n === 0) return 1;
  return Math.floor(Math.log10(Math.abs(n))) + 1;
}

export function Overview() {
  const status = useScanStore((state) => state.status);

  const isRunning = status?.is_running ?? false;
  const scannedHosts = status?.scanned_hosts ?? 0;
  const totalHosts = status?.total_hosts ?? 0;
  const runtime = status?.runtime ?? 0;
  const remaining = status?.remaining ?? 0;
  const stage = status?.stage ?? 'idle';
  const progress = status?.progress ?? 0;

  const pctComplete = progress * 100;
  const showRemaining = pctComplete >= 10;
  
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
          <OdometerTime seconds={runtime} className="scan-stat-value" />
          {isRunning && (
            <>
              <span className="scan-stat-sep">/</span>
              {showRemaining ? (
                <OdometerTime seconds={remaining} className="scan-stat-value muted" />
              ) : (
                <OdometerTimePlaceholder className="scan-stat-value" />
              )}
            </>
          )}
        </div>

        <div className="scan-stat-spacer" />

        {/* Stage */}
        <div className={`scan-stat stage ${stage === 'complete' ? 'success' : ''} ${isRunning ? 'active' : ''}`}>
          {isRunning && <i className="fa-solid fa-circle-notch fa-spin scan-stat-icon" />}
          {stage === 'complete' && <i className="fa-solid fa-check scan-stat-icon" />}
          {!isRunning && stage !== 'complete' && <i className="fa-solid fa-minus scan-stat-icon" />}
          <span className="scan-stat-stage">{stage}</span>
        </div>
      </div>
    </div>
  );
}
