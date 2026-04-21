/**
 * StageEditorModal — View or edit a single pipeline stage configuration.
 *
 * In readOnly mode (scan active or completed), all form fields are disabled
 * and no Save button is shown. In edit mode, saving clears the auto flag
 * and updates the pipeline config via onSave.
 */

import { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { StageConfigPanel } from '../Settings/StageConfigPanel';
import { getStageMeta } from '../Settings/stageRegistry';
import { useScanStore } from '../../store';
import type { StageEntry } from '../../types';

interface StageEditorModalProps {
  stage: StageEntry | null;
  stageIndex: number;
  readOnly: boolean;
  saveLabel?: string;
  onSave?: (index: number, updated: StageEntry) => void;
  onClose: () => void;
}

export function StageEditorModal({
  stage,
  stageIndex,
  readOnly,
  saveLabel = 'Save',
  onSave,
  onClose,
}: StageEditorModalProps) {
  const portLists = useScanStore((s) => s.portLists);
  const [localStage, setLocalStage] = useState<StageEntry | null>(stage);

  // Reset local state whenever a new stage is opened
  useEffect(() => {
    if (stage !== null) setLocalStage(stage);
  }, [stage]);

  if (!stage || !localStage) return null;

  const meta = getStageMeta(stage.stage_type);
  const title = `${meta.label} — Config`;

  const handleSave = () => {
    if (!localStage) return;
    onSave?.(stageIndex, localStage);
    onClose();
  };

  const footer = (
    <>
      {!readOnly && (
        <button className="btn btn-primary" onClick={handleSave}>
          <i className="fa-solid fa-check" /> {saveLabel}
        </button>
      )}
      <button className="btn btn-secondary" onClick={onClose}>
        Close
      </button>
    </>
  );

  return (
    <Modal isOpen onClose={onClose} title={title} size="medium" footer={footer}>
      <StageConfigPanel
        stage={localStage}
        onChange={readOnly ? undefined : setLocalStage}
        readOnly={readOnly}
        portLists={portLists}
      />
    </Modal>
  );
}
