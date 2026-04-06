/**
 * StageCard — A single stage entry in the pipeline list.
 * Shows a header with the stage name, icon, and drag handle.
 * Expands to show per-stage settings when clicked.
 */

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getStageMeta } from './stageRegistry';
import { estimateStageTime, estimateUnit, formatEstimate } from './stageEstimates';
import { StageSettingsForm } from './StageSettingsForm';
import type { StageEntry, PortListSummary } from '../../types';

interface StageCardProps {
  stage: StageEntry;
  index: number;
  id: string;
  onRemove: () => void;
  onConfigChange: (config: Record<string, unknown>) => void;
  portLists?: PortListSummary[];
}

export function StageCard({ stage, index, id, onRemove, onConfigChange, portLists }: StageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = getStageMeta(stage.stage_type);
  const estimate = estimateStageTime(stage.stage_type, stage.config, portLists);
  const unit = estimateUnit(stage.stage_type);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`stage-card${expanded ? ' stage-card--expanded' : ''}`}
    >
      <div className="stage-card-header">
        <button
          className="stage-card-drag"
          {...attributes}
          {...listeners}
          data-tooltip-id="tooltip"
          data-tooltip-content="Drag to reorder"
        >
          <i className="fa-solid fa-grip-vertical" />
        </button>
        <span className="stage-card-index">{index + 1}</span>
        <i className={`${meta.icon} stage-card-icon`} />
        <span className="stage-card-label">{meta.label}</span>
        <span
          className="stage-card-estimate"
          data-tooltip-id="tooltip"
          data-tooltip-content={`Worst-case ${formatEstimate(estimate)} ${unit}`}
        >
          <i className="fa-solid fa-clock" />
          {formatEstimate(estimate)}
        </span>
        <div className="stage-card-actions">
          <button
            className="stage-card-btn"
            onClick={() => setExpanded(!expanded)}
            data-tooltip-id="tooltip"
            data-tooltip-content={expanded ? 'Collapse settings' : 'Expand settings'}
          >
            <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`} />
          </button>
          <button
            className="stage-card-btn stage-card-btn--danger"
            onClick={onRemove}
            data-tooltip-id="tooltip"
            data-tooltip-content="Remove stage"
          >
            <i className="fa-solid fa-trash-can" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="stage-card-body">
          <StageSettingsForm
            stageType={stage.stage_type}
            config={stage.config}
            onChange={onConfigChange}
            portLists={portLists}
          />
        </div>
      )}
    </div>
  );
}
