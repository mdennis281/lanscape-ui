/**
 * AddStageModal — lets users pick a stage type, configure it,
 * and append it to a running or completed scan.
 */

import { useState } from 'react';
import { Modal } from '../Modal';
import { STAGE_REGISTRY, type StageMeta } from '../Settings/stageRegistry';
import { StageSettingsForm } from '../Settings/StageSettingsForm';
import { estimateStageTime, estimateUnit, formatEstimate } from '../Settings/stageEstimates';
import { useScanStore } from '../../store';
import { getWebSocketService } from '../../services';
import type { StageType, PortListSummary } from '../../types';

interface AddStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  scanId?: string;
}

const discovery = STAGE_REGISTRY.filter((s) => s.category === 'discovery');
const scanning = STAGE_REGISTRY.filter((s) => s.category === 'scanning');

export function AddStageModal({ isOpen, onClose, scanId }: AddStageModalProps) {
  const portLists = useScanStore((s) => s.portLists);
  const addStage = useScanStore((s) => s.addStage);
  const [selected, setSelected] = useState<StageMeta | null>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({});

  // Reset state when modal opens
  const [prevOpen, setPrevOpen] = useState(false);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setSelected(null);
      setConfig({});
    }
  }

  const handleSelect = (meta: StageMeta) => {
    setSelected(meta);
    setConfig({ ...meta.defaultConfig });
  };

  const handleAdd = async () => {
    if (!selected) return;
    if (scanId) {
      // Live mode: append to running/completed scan via backend
      const ws = getWebSocketService();
      if (!ws) return;
      await ws.appendStages(scanId, [{ stage_type: selected.type, config }]);
    } else {
      // Config mode: add to frontend pipeline config
      addStage({ stage_type: selected.type, config });
    }
    onClose();
  };

  const footer = selected ? (
    <>
      <button className="btn btn-secondary" onClick={() => setSelected(null)}>
        <i className="fa-solid fa-arrow-left" /> Back
      </button>
      <button className="btn btn-primary" onClick={handleAdd}>
        <i className="fa-solid fa-plus" /> Add Stage
      </button>
    </>
  ) : undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Stage" size="medium" footer={footer}>
      {!selected ? (
        <StageTypeGrid onSelect={handleSelect} />
      ) : (
        <SelectedStageConfig
          meta={selected}
          config={config}
          onChange={setConfig}
          portLists={portLists}
        />
      )}
    </Modal>
  );
}

function StageTypeGrid({ onSelect }: { onSelect: (meta: StageMeta) => void }) {
  return (
    <div className="add-stage-grid">
      <div className="add-stage-section">
        <div className="add-stage-section-title">
          <i className="fa-solid fa-magnifying-glass" /> Device Discovery
        </div>
        <p className="add-stage-section-desc">
          Find devices on the network using different protocols
        </p>
        <div className="add-stage-options">
          {discovery.map((meta) => (
            <button
              key={meta.type}
              className="add-stage-option"
              onClick={() => onSelect(meta)}
            >
              <i className={`${meta.icon} add-stage-option-icon`} />
              <div className="add-stage-option-text">
                <span className="add-stage-option-label">{meta.label}</span>
                <span className="add-stage-option-desc">{meta.description}</span>
              </div>
              <i className="fa-solid fa-chevron-right add-stage-option-arrow" />
            </button>
          ))}
        </div>
      </div>

      <div className="add-stage-section">
        <div className="add-stage-section-title">
          <i className="fa-solid fa-door-open" /> Port Scanning
        </div>
        <p className="add-stage-section-desc">
          Scan discovered hosts for open ports and services
        </p>
        <div className="add-stage-options">
          {scanning.map((meta) => (
            <button
              key={meta.type}
              className="add-stage-option"
              onClick={() => onSelect(meta)}
            >
              <i className={`${meta.icon} add-stage-option-icon`} />
              <div className="add-stage-option-text">
                <span className="add-stage-option-label">{meta.label}</span>
                <span className="add-stage-option-desc">{meta.description}</span>
              </div>
              <i className="fa-solid fa-chevron-right add-stage-option-arrow" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SelectedStageConfig({
  meta,
  config,
  onChange,
  portLists,
}: {
  meta: StageMeta;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  portLists: PortListSummary[];
}) {
  const estimate = estimateStageTime(meta.type as StageType, config, portLists);
  const unit = estimateUnit(meta.type as StageType);

  return (
    <div className="add-stage-config">
      <div className="add-stage-config-header">
        <i className={`${meta.icon} add-stage-config-icon`} />
        <div>
          <div className="add-stage-config-label">{meta.label}</div>
          <div className="add-stage-config-desc">{meta.description}</div>
        </div>
        <span
          className="stage-card-estimate"
          data-tooltip-id="tooltip"
          data-tooltip-content={`Worst-case ${formatEstimate(estimate)} ${unit}`}
        >
          <i className="fa-solid fa-clock" />
          {formatEstimate(estimate)}
        </span>
      </div>
      <div className="add-stage-config-form">
        <StageSettingsForm
          stageType={meta.type as StageType}
          config={config}
          onChange={onChange}
          portLists={portLists}
        />
      </div>
    </div>
  );
}
