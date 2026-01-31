import { useState } from 'react';
import { Modal } from '../Modal';
import { useScanStore } from '../../store';
import type { ScanErrorInfo } from '../../types';

interface ErrorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ErrorItemProps {
  error: ScanErrorInfo;
  index: number;
}

function ErrorItem({ error, index }: ErrorItemProps) {
  const [expanded, setExpanded] = useState(false);

  // Handle both object and string error formats
  const errorMessage = typeof error === 'string' 
    ? error 
    : (error?.basic || JSON.stringify(error) || 'Unknown error');
  const errorTraceback = typeof error === 'object' ? error?.traceback : undefined;

  return (
    <div className="error-item">
      <div 
        className="error-item-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
      >
        <i className={`fa-solid fa-chevron-${expanded ? 'down' : 'right'} error-item-chevron`} />
        <span className="error-item-index">#{index + 1}</span>
        <span className="error-item-summary">{errorMessage}</span>
      </div>
      {expanded && errorTraceback && (
        <div className="error-item-traceback">
          <pre>{errorTraceback}</pre>
        </div>
      )}
    </div>
  );
}

export function ErrorsModal({ isOpen, onClose }: ErrorsModalProps) {
  const scanErrors = useScanStore((state) => state.scanErrors);
  const status = useScanStore((state) => state.status);

  const errorCount = scanErrors.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Scan Errors (${errorCount})`}
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
      <div className="errors-modal-content">
        {/* Summary banner */}
        <div className="errors-summary-banner">
          <i className="fa-solid fa-triangle-exclamation" />
          <span>
            {errorCount} error{errorCount !== 1 ? 's' : ''} occurred during 
            {status?.stage === 'complete' ? ' the scan' : ' scanning'}
          </span>
        </div>

        {/* Error description */}
        <p className="text-muted errors-description">
          These errors were encountered while scanning devices. Click on an error to view the full traceback.
          Some devices may have been skipped due to these errors.
        </p>

        {/* Error list */}
        <div className="errors-list">
          {scanErrors.length === 0 ? (
            <div className="errors-empty">
              <i className="fa-regular fa-circle-check text-success" />
              <span>No errors recorded</span>
            </div>
          ) : (
            scanErrors.map((error, index) => (
              <ErrorItem key={index} error={error} index={index} />
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
