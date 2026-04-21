/**
 * StageConfigPanel — shared config panel for viewing or editing a single stage.
 *
 * Reused in both AddStageModal (edit mode) and StageEditorModal (view or edit).
 * When readOnly is true, all form inputs are disabled.
 * When a user edits any field, the auto flag and reason are cleared automatically.
 */

import { getStageMeta } from './stageRegistry';
import { StageSettingsForm } from './StageSettingsForm';
import { estimateStageTime, estimateUnit, formatEstimate } from './stageEstimates';
import type { StageEntry, PortListSummary } from '../../types';

interface StageConfigPanelProps {
  stage: StageEntry;
  onChange?: (updated: StageEntry) => void;
  readOnly?: boolean;
  portLists?: PortListSummary[];
}

export function StageConfigPanel({ stage, onChange, readOnly, portLists }: StageConfigPanelProps) {
  const meta = getStageMeta(stage.stage_type);
  const estimate = estimateStageTime(stage.stage_type, stage.config, portLists);
  const unit = estimateUnit(stage.stage_type);

  const handleConfigChange = (config: Record<string, unknown>) => {
    if (!onChange) return;
    // Clear auto flag whenever the user edits any setting
    const { auto: _auto, reason: _reason, ...rest } = stage;
    onChange({ ...rest, config });
  };

  return (
    <div className="add-stage-config">
      <div className="add-stage-config-header">
        <i className={`${meta.icon} add-stage-config-icon`} />
        <div>
          <div className="add-stage-config-label">
            {meta.label}
            {stage.auto && (
              <span className="stage-card-auto-badge stage-card-auto-badge--inline">Auto</span>
            )}
          </div>
          <div className="add-stage-config-desc">
            {stage.auto && stage.reason ? stage.reason : meta.description}
          </div>
        </div>
        {!readOnly && (
          <span
            className="stage-card-estimate"
            data-tooltip-id="tooltip"
            data-tooltip-content={`Worst-case ${formatEstimate(estimate)} ${unit}`}
          >
            <i className="fa-solid fa-clock" />
            {formatEstimate(estimate)}
          </span>
        )}
      </div>
      <div className="add-stage-config-form">
        <StageSettingsForm
          stageType={stage.stage_type}
          config={stage.config}
          onChange={handleConfigChange}
          portLists={portLists}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
}
