/**
 * StagePalette — Grid of available stage type buttons.
 * Click to add a stage to the pipeline.
 */

import { STAGE_REGISTRY, type StageMeta } from './stageRegistry';
import type { StageEntry } from '../../types';

interface StagePaletteProps {
  onAdd: (stage: StageEntry) => void;
}

export function StagePalette({ onAdd }: StagePaletteProps) {
  const handleAdd = (meta: StageMeta) => {
    onAdd({
      stage_type: meta.type,
      config: { ...meta.defaultConfig },
    });
  };

  const discovery = STAGE_REGISTRY.filter((s) => s.category === 'discovery');
  const scanning = STAGE_REGISTRY.filter((s) => s.category === 'scanning');

  return (
    <div className="stage-palette">
      <div className="stage-palette-section">
        <span className="stage-palette-label">Discovery</span>
        <div className="stage-palette-grid">
          {discovery.map((meta) => (
            <button
              key={meta.type}
              className="stage-palette-btn"
              onClick={() => handleAdd(meta)}
              data-tooltip-id="tooltip"
              data-tooltip-content={meta.description}
            >
              <i className={meta.icon} />
              <span>{meta.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="stage-palette-section">
        <span className="stage-palette-label">Scanning</span>
        <div className="stage-palette-grid">
          {scanning.map((meta) => (
            <button
              key={meta.type}
              className="stage-palette-btn"
              onClick={() => handleAdd(meta)}
              data-tooltip-id="tooltip"
              data-tooltip-content={meta.description}
            >
              <i className={meta.icon} />
              <span>{meta.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
