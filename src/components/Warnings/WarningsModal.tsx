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

function WarningItem({ warning, index }: WarningItemProps) {
  const [expanded, setExpanded] = useState(false);

  const hasDetails = warning.old_multiplier !== undefined && warning.new_multiplier !== undefined;

  return (
    <div className="warning-item">
      <div 
        className="warning-item-header"
        onClick={() => hasDetails && setExpanded(!expanded)}
        role={hasDetails ? "button" : undefined}
        tabIndex={hasDetails ? 0 : undefined}
        onKeyDown={(e) => hasDetails && e.key === 'Enter' && setExpanded(!expanded)}
      >
        {hasDetails && (
          <i className={`fa-solid fa-chevron-${expanded ? 'down' : 'right'} warning-item-chevron`} />
        )}
        <span className="warning-item-index">#{index + 1}</span>
        <span className="warning-item-summary">{warning.message}</span>
      </div>
      {expanded && hasDetails && (
        <div className="warning-item-details">
          <div className="warning-detail-row">
            <span className="warning-detail-label">Multiplier:</span>
            <span className="warning-detail-value">
              {Math.round((warning.old_multiplier ?? 0) * 100)}% → {Math.round((warning.new_multiplier ?? 0) * 100)}%
            </span>
          </div>
          <div className="warning-detail-row">
            <span className="warning-detail-label">Reduction:</span>
            <span className="warning-detail-value warning-decrease">
              -{warning.decrease_percent?.toFixed(0) ?? 0}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function WarningsModal({ isOpen, onClose }: WarningsModalProps) {
  const scanWarnings = useScanStore((state) => state.scanWarnings);
  const status = useScanStore((state) => state.status);

  const warningCount = scanWarnings.length;

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
          <span>
            {warningCount} warning{warningCount !== 1 ? 's' : ''} occurred during 
            {status?.stage === 'complete' ? ' the scan' : ' scanning'}
          </span>
        </div>

        {/* Warning description */}
        <p className="text-muted warnings-description">
          These warnings indicate the scan encountered resource constraints and reduced thread concurrency.
          The scan completed but may have taken longer than expected.
        </p>

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
