import { Modal } from '../Modal/Modal';
import { getStageMeta } from '../Settings/stageRegistry';
import type { StageEntry, AutoStageRecommendation } from '../../types';

interface ConfigPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUseRecommended: () => void;
  onKeepCurrent: () => void;
  recommendedStages: AutoStageRecommendation[];
  currentStages: StageEntry[];
}

export function ConfigPromptModal({
  isOpen,
  onClose,
  onUseRecommended,
  onKeepCurrent,
  recommendedStages,
  currentStages,
}: ConfigPromptModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Scan Configuration Changed"
      size="small"
      footer={
        <div className="modal-footer-actions">
          <button className="btn btn-secondary" onClick={onKeepCurrent}>
            Keep Current
          </button>
          <button className="btn btn-primary" onClick={onUseRecommended}>
            Use Recommended
          </button>
        </div>
      }
    >
      <p style={{ marginBottom: '0.75rem' }}>
        The recommended scan pipeline for this subnet differs from your current configuration.
      </p>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.35rem' }}>
            Recommended
          </strong>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {recommendedStages.map((s, i) => {
              const meta = getStageMeta(s.stage_type);
              return (
                <li key={i} style={{ padding: '0.2rem 0', fontSize: '0.85rem' }}>
                  <i className={meta.icon} style={{ marginRight: '0.4rem', opacity: 0.6, width: '1rem', textAlign: 'center' }} />
                  {meta.label}
                </li>
              );
            })}
          </ul>
        </div>

        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: '0.8rem', opacity: 0.7, display: 'block', marginBottom: '0.35rem' }}>
            Current
          </strong>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {currentStages.map((s, i) => {
              const meta = getStageMeta(s.stage_type);
              return (
                <li key={i} style={{ padding: '0.2rem 0', fontSize: '0.85rem' }}>
                  <i className={meta.icon} style={{ marginRight: '0.4rem', opacity: 0.6, width: '1rem', textAlign: 'center' }} />
                  {meta.label}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
