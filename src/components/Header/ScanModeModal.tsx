import { Modal } from '../Modal/Modal';
import { getStageMeta } from '../Settings/stageRegistry';
import type { StageEntry } from '../../types';

interface ScanModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUseExisting: () => void;
  onUseAuto: () => void;
  currentStages: StageEntry[];
}

export function ScanModeModal({
  isOpen,
  onClose,
  onUseExisting,
  onUseAuto,
  currentStages,
}: ScanModeModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Scan Mode"
      size="small"
      footer={
        <div className="modal-footer-actions">
          <button className="btn btn-secondary" onClick={onUseExisting}>
            <i className="fa-solid fa-layer-group" style={{ opacity: 0.7 }} />
            Use Existing Stages
          </button>
          <button className="btn btn-warning" onClick={onUseAuto}>
            <i className="fa-solid fa-bolt" style={{ opacity: 0.7 }} />
            Auto Mode
          </button>
        </div>
      }
    >
      <p style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
        Would you like to keep your current pipeline or let auto mode select stages for this subnet?
      </p>

      <div>
        <strong style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.35rem' }}>
          Current Pipeline
        </strong>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {currentStages.map((s, i) => {
            const meta = getStageMeta(s.stage_type);
            return (
              <li key={i} style={{ padding: '0.2rem 0', fontSize: '0.85rem' }}>
                <i className={meta.icon} style={{ marginRight: '0.4rem', opacity: 0.6, width: '1rem', textAlign: 'center' }} />
                {meta.label}
                {s.auto && (
                  <span className="stage-card-auto-badge" style={{ marginLeft: '0.4rem' }}>Auto</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
