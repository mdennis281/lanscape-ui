import { useState } from 'react';
import { Modal } from '../Modal';
import { useScanStore } from '../../store';
import type { ScanWarningInfo } from '../../types';

interface WarningsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WarningItemProps {
  warning: ScanWarningInfo;
  index: number;
}

/** Map scan stage strings to human-readable labels */
function formatStage(stage?: string): string {
  if (!stage) return 'Unknown';
  const map: Record<string, string> = {
    'scanning devices': 'Device Discovery',
    'testing ports': 'Port Scanning',
    'complete': 'Finalization',
    'terminating': 'Terminating',
  };
  return map[stage] ?? stage;
}

function WarningItem({ warning, index }: WarningItemProps) {
  const [expanded, setExpanded] = useState(false);

  const hasMultiplier = warning.old_multiplier !== undefined && warning.new_multiplier !== undefined;
  const hasJobContext = !!warning.failed_job;
  const hasDetails = hasMultiplier || hasJobContext;

  // Build a short human-readable summary
  const summary = hasJobContext
    ? `Job failed on ${warning.failed_job}`
    : warning.message;

  return (
    <div className="warning-item">
      <div 
        className="warning-item-header"
        onClick={() => hasDetails && setExpanded(!expanded)}
        role={hasDetails ? "button" : undefined}
        tabIndex={hasDetails ? 0 : undefined}
        onKeyDown={(e) => hasDetails && e.key === 'Enter' && setExpanded(!expanded)}
      >
        <span className="warning-item-index">#{index + 1}</span>
        <span className="warning-item-summary">{summary}</span>
        {hasDetails && (
          <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} warning-item-chevron`} />
        )}
      </div>
      {expanded && hasDetails && (
        <div className="warning-item-details">
          {/* Error context */}
          {warning.error_message && (
            <div className="warning-detail-row">
              <span className="warning-detail-label">Error</span>
              <span className="warning-detail-value warning-error-msg">{warning.error_message}</span>
            </div>
          )}

          {/* Stage */}
          {warning.stage && (
            <div className="warning-detail-row">
              <span className="warning-detail-label">Stage</span>
              <span className="warning-detail-value">{formatStage(warning.stage)}</span>
            </div>
          )}

          {/* Retry info */}
          {warning.retry_attempt !== undefined && (
            <div className="warning-detail-row">
              <span className="warning-detail-label">Attempt</span>
              <span className="warning-detail-value">
                {warning.retry_attempt} / {(warning.max_retries ?? 0) + 1}
              </span>
            </div>
          )}

          {/* Multiplier impact */}
          {hasMultiplier && (
            <div className="warning-detail-row">
              <span className="warning-detail-label">Concurrency</span>
              <span className="warning-detail-value">
                {Math.round((warning.old_multiplier ?? 0) * 100)}%
                <i className="fa-solid fa-arrow-right warning-arrow" />
                <span className="warning-decrease">
                  {Math.round((warning.new_multiplier ?? 0) * 100)}%
                </span>
                <span className="warning-decrease-badge">
                  &minus;{warning.decrease_percent?.toFixed(0) ?? 0}%
                </span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WarningsModal({ isOpen, onClose }: WarningsModalProps) {
  const scanWarnings = useScanStore((state) => state.scanWarnings);
  const status = useScanStore((state) => state.status);

  const warningCount = scanWarnings.length;

  // Count unique failed jobs
  const failedJobs = new Set(scanWarnings.map(w => w.failed_job).filter(Boolean));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Scan Warnings (${warningCount})`}
      size="large"
      footer={
        <div className="modal-footer-actions">
          <a 
            href="https://github.com/mdennis281/LANscape/issues" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            <i className="fa-brands fa-github" /> Report Issue
          </a>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="warnings-modal-content">
        {/* Summary banner */}
        <div className="warnings-summary-banner">
          <i className="fa-solid fa-triangle-exclamation" />
          <div className="warnings-summary-text">
            <span>
              {warningCount} warning{warningCount !== 1 ? 's' : ''} occurred during
              {status?.stage === 'complete' ? ' the scan' : ' scanning'}
            </span>
            {failedJobs.size > 0 && (
              <span className="warnings-summary-detail">
                {failedJobs.size} job{failedJobs.size !== 1 ? 's' : ''} required retries &mdash; thread concurrency was reduced to compensate.
              </span>
            )}
          </div>
        </div>

        {/* Warning list */}
        <div className="warnings-list">
          {scanWarnings.length === 0 ? (
            <div className="warnings-empty">
              <i className="fa-regular fa-circle-check text-success" />
              <span>No warnings recorded</span>
            </div>
          ) : (
            scanWarnings.map((warning, index) => (
              <WarningItem key={index} warning={warning} index={index} />
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
