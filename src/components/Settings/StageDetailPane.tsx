/**
 * StageDetailPane — Shows the selected stage's configuration below the pipeline.
 * Animated in/out by the parent (SettingsModal) via framer-motion AnimatePresence.
 */

import { getStageMeta } from './stageRegistry';
import { StageSettingsForm } from './StageSettingsForm';
import { estimateStageTime, estimateUnit, formatEstimate, parseSubnetIpCount } from './stageEstimates';
import { useUIStore } from '../../store';
import type { StageEntry, PortListSummary } from '../../types';

interface StageDetailPaneProps {
  stage: StageEntry;
  index: number;
  onChange: (config: Record<string, unknown>) => void;
  onClose: () => void;
  portLists?: PortListSummary[];
}

export function StageDetailPane({ stage, index, onChange, onClose, portLists }: StageDetailPaneProps) {
  const meta = getStageMeta(stage.stage_type);
  const estimate = estimateStageTime(stage.stage_type, stage.config, portLists);
  const unit = estimateUnit(stage.stage_type);

  const subnetInput = useUIStore((s) => s.subnetInput);
  const subnetIpCount = parseSubnetIpCount(subnetInput) ?? undefined;

  return (
    <div className="stage-detail-pane">
      <div className="stage-detail-header">
        <span className="stage-detail-index">{index + 1}</span>
        <i className={`${meta.icon} stage-detail-icon`} />
        <div className="stage-detail-title-block">
          <div className="stage-detail-title">
            {meta.label}
            {stage.auto && <span className="stage-card-auto-badge stage-card-auto-badge--inline">Auto</span>}
          </div>
          <div className="stage-detail-desc">
            {stage.auto && stage.reason ? stage.reason : meta.description}
          </div>
        </div>
        <span
          className="stage-card-estimate"
          data-tooltip-id="tooltip"
          data-tooltip-content={`Worst-case ${formatEstimate(estimate)} ${unit}`}
        >
          <i className="fa-solid fa-clock" />
          {formatEstimate(estimate)}
        </span>
        <button
          className="stage-detail-close"
          onClick={onClose}
          data-tooltip-id="tooltip"
          data-tooltip-content="Close"
          aria-label="Close stage detail"
        >
          <i className="fa-solid fa-xmark" />
        </button>
      </div>
      <div className="stage-detail-body">
        <StageSettingsForm
          stageType={stage.stage_type}
          config={stage.config}
          onChange={onChange}
          portLists={portLists}
          subnetIpCount={subnetIpCount}
        />
      </div>
    </div>
  );
}
