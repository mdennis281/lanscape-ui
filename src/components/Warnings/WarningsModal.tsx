import { useState } from 'react';
import Markdown from 'react-markdown';
import { Modal } from '../Modal';
import { useScanStore } from '../../store';
import type { ScanWarningInfo } from '../../types';

interface WarningsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Human-readable labels for warning categories */
const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  concurrency: { label: 'Concurrency', icon: 'fa-solid fa-gauge-high' },
  stage_skip: { label: 'Skipped Stages', icon: 'fa-solid fa-forward' },
  capability: { label: 'Capability', icon: 'fa-solid fa-puzzle-piece' },
  resilience: { label: 'Resilience', icon: 'fa-solid fa-shield-halved' },
};

function getCategoryMeta(category: string) {
  return CATEGORY_LABELS[category] ?? { label: category, icon: 'fa-solid fa-circle-info' };
}

/** Group warnings by category, preserving order of first occurrence. */
function groupByCategory(warnings: ScanWarningInfo[]): Map<string, ScanWarningInfo[]> {
  const groups = new Map<string, ScanWarningInfo[]>();
  for (const w of warnings) {
    const key = w.category;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(w);
  }
  return groups;
}

function WarningItem({ warning }: { warning: ScanWarningInfo }) {
  const [expanded, setExpanded] = useState(false);
  const hasBody = !!warning.body;

  return (
    <div className="warning-item">
      <div
        className="warning-item-header"
        onClick={() => hasBody && setExpanded(!expanded)}
        role={hasBody ? 'button' : undefined}
        tabIndex={hasBody ? 0 : undefined}
        onKeyDown={(e) => hasBody && e.key === 'Enter' && setExpanded(!expanded)}
      >
        <span className="warning-item-title">
          <Markdown>{warning.title}</Markdown>
        </span>
        {hasBody && (
          <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} warning-item-chevron`} />
        )}
      </div>
      {expanded && warning.body && (
        <div className="warning-item-body">
          <Markdown>{warning.body}</Markdown>
        </div>
      )}
    </div>
  );
}

export function WarningsModal({ isOpen, onClose }: WarningsModalProps) {
  const scanWarnings = useScanStore((state) => state.scanWarnings);
  const status = useScanStore((state) => state.status);

  const warningCount = scanWarnings.length;
  const grouped = groupByCategory(scanWarnings);

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
          </div>
        </div>

        {/* Warning groups */}
        <div className="warnings-list">
          {warningCount === 0 ? (
            <div className="warnings-empty">
              <i className="fa-regular fa-circle-check text-success" />
              <span>No warnings recorded</span>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([category, warnings]) => {
              const meta = getCategoryMeta(category);
              return (
                <div key={category} className="warnings-group">
                  <div className="warnings-group-header">
                    <i className={meta.icon} />
                    <span>{meta.label}</span>
                    <span className="warnings-group-count">{warnings.length}</span>
                  </div>
                  <div className="warnings-group-items">
                    {warnings.map((warning, i) => (
                      <WarningItem key={i} warning={warning} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
