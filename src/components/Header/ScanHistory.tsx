import { useState, useEffect, useRef, useCallback } from 'react';
import { useScanStore } from '../../store';
import type { ScanHistoryEntry } from '../../types';

function formatRuntime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function stageBadgeClass(stage: string): string {
  switch (stage) {
    case 'complete':
      return 'history-badge history-badge--complete';
    case 'terminated':
      return 'history-badge history-badge--terminated';
    default:
      return 'history-badge history-badge--running';
  }
}

function stageLabel(stage: string): string {
  if (!stage) return 'Idle';
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

export function ScanHistory({ onNewScan }: { onNewScan?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    scanHistory,
    currentScanId,
    fetchScanHistory,
    switchToScan,
    isLoadingHistory,
  } = useScanStore();

  const hasHistory = scanHistory.length > 0;
  const isSingleCurrent =
    scanHistory.length === 1 && scanHistory[0].scan_id === currentScanId;
  const hasMultiple = scanHistory.length > 1;

  // Determine button visual state
  const buttonState = !hasHistory
    ? 'disabled'
    : isSingleCurrent
      ? 'current'
      : 'active';

  const handleToggle = useCallback(async () => {
    if (!hasHistory) return;
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening) {
      await fetchScanHistory();
    }
  }, [hasHistory, isOpen, fetchScanHistory]);

  const handleSelect = useCallback(
    async (scanId: string) => {
      setIsOpen(false);
      await switchToScan(scanId);
    },
    [switchToScan],
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const historyTooltip = !hasHistory
    ? 'No scans found'
    : isSingleCurrent
      ? 'Current scan'
      : `${scanHistory.length} scans`;

  return (
    <div className="scan-history-wrapper">
      <span
        data-tooltip-id="tooltip"
        data-tooltip-content={historyTooltip}
        className="scan-history-btn-wrap"
      >
        <button
          type="button"
          ref={buttonRef}
          className={`scan-history-btn scan-history-btn--${buttonState}`}
          onClick={handleToggle}
          disabled={!hasHistory}
        >
          <i className="fa-solid fa-clock-rotate-left" />
          {hasMultiple && (
            <span className="scan-history-count">{scanHistory.length}</span>
          )}
        </button>
      </span>

      <div
        ref={dropdownRef}
        className={`scan-history-dropdown ${isOpen ? 'scan-history-dropdown--open' : ''}`}
      >
        <div className="scan-history-dropdown-header">
          <span>Scan History</span>
          <div className="scan-history-dropdown-actions">
            {isLoadingHistory && <span className="scan-history-loading" />}
            <button
              type="button"
              className="scan-history-new-btn"
              onClick={() => {
                setIsOpen(false);
                onNewScan?.();
              }}
              data-tooltip-id="tooltip"
              data-tooltip-content="New scan"
            >
              <i className="fa-solid fa-plus" />
            </button>
          </div>
        </div>

        <div className="scan-history-list">
          {scanHistory.map((entry: ScanHistoryEntry) => {
            const isCurrent = entry.scan_id === currentScanId;
            return (
              <button
                type="button"
                key={entry.scan_id}
                className={`scan-history-entry ${isCurrent ? 'scan-history-entry--current' : ''}`}
                onClick={() => !isCurrent && handleSelect(entry.scan_id)}
                disabled={isCurrent}
              >
                <div className="scan-history-entry-top">
                  <span className="scan-history-subnet">
                    {entry.subnet || 'Unknown subnet'}
                  </span>
                  <span className={stageBadgeClass(entry.stage)}>
                    {stageLabel(entry.stage)}
                  </span>
                </div>

                <div className="scan-history-entry-mid">
                  <span className="scan-history-devices">
                    <i className="fa-solid fa-laptop" />
                    {entry.devices_alive}
                    {entry.devices_total > 0 && (
                      <span className="scan-history-devices-total">
                        / {entry.devices_total}
                      </span>
                    )}
                  </span>
                  <span className="scan-history-runtime">
                    <i className="fa-regular fa-clock" />
                    {formatRuntime(entry.runtime)}
                  </span>
                </div>

                {entry.stages && entry.stages.length > 0 && (
                  <div className="scan-history-stages">
                    {entry.stages.map((s, i) => (
                      <span
                        key={i}
                        className={`scan-history-stage-pip ${s.finished ? 'scan-history-stage-pip--done' : ''} ${
                          !s.finished && s.completed > 0 ? 'scan-history-stage-pip--active' : ''
                        }`}
                        title={`${s.stage_name}: ${s.completed}/${s.total}`}
                      />
                    ))}
                  </div>
                )}

                {isCurrent && (
                  <div className="scan-history-current-label">Current</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
