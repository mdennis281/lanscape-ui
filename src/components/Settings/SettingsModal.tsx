import { useState, useMemo, useCallback } from 'react';

import { Modal } from '../Modal';
import { PresetBar } from './PresetBar';
import { SettingsFooter } from './SettingsFooter';
import { StagePalette } from './StagePalette';
import { StageList } from './StageList';
import { useScanStore } from '../../store';
import {
  setActivePresetId,
  persistConfigOnSave,
  getActivePresetId,
  getPresetById,
  createUserPreset,
  updateUserPreset,
  resolvePresetConfig,
} from '../../services/presets';
import type { PipelineConfig, StageEntry } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function HelpTip({ text }: { text: string }) {
  return (
    <i
      className="fa-regular fa-circle-question help-tip"
      data-tooltip-id="tooltip"
      data-tooltip-content={text}
    />
  );
}

const EMPTY_PIPELINE: PipelineConfig = { stages: [] };

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const pipelineConfig = useScanStore((s) => s.pipelineConfig);
  const defaultConfigs = useScanStore((s) => s.defaultConfigs);
  const setPipelineConfig = useScanStore((s) => s.setPipelineConfig);
  const portLists = useScanStore((s) => s.portLists);

  const [localConfig, setLocalConfig] = useState<PipelineConfig>(EMPTY_PIPELINE);

  // Re-initialise local config each time the modal opens.
  const [prevIsOpen, setPrevIsOpen] = useState(false);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setLocalConfig(
        pipelineConfig.stages.length > 0
          ? structuredClone(pipelineConfig)
          : EMPTY_PIPELINE
      );
    }
  }

  // ── Stage manipulation (local) ────────────────────────────────────

  const handleAddStage = useCallback((stage: StageEntry) => {
    setLocalConfig((prev) => ({
      ...prev,
      stages: [...prev.stages, stage],
    }));
  }, []);

  const handleRemoveStage = useCallback((index: number) => {
    setLocalConfig((prev) => ({
      ...prev,
      stages: prev.stages.filter((_, i) => i !== index),
    }));
  }, []);

  const handleReorderStages = useCallback((from: number, to: number) => {
    setLocalConfig((prev) => {
      const stages = [...prev.stages];
      const [moved] = stages.splice(from, 1);
      stages.splice(to, 0, moved);
      return { ...prev, stages };
    });
  }, []);

  const handleStageConfigChange = useCallback((index: number, config: Record<string, unknown>) => {
    setLocalConfig((prev) => {
      const stages = [...prev.stages];
      stages[index] = { ...stages[index], config };
      return { ...prev, stages };
    });
  }, []);

  // ── Resilience config helpers ─────────────────────────────────────

  const handleResilienceChange = useCallback((field: string, value: unknown) => {
    setLocalConfig((prev) => ({
      ...prev,
      resilience: { ...(prev.resilience ?? {}), [field]: value },
    }));
  }, []);

  const handleHostnameChange = useCallback((field: string, value: unknown) => {
    setLocalConfig((prev) => ({
      ...prev,
      hostname_config: { ...(prev.hostname_config ?? {}), [field]: value },
    }));
  }, []);

  // ── Preset handling ───────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleApplyPreset = useCallback((cfg: PipelineConfig, _presetId?: string) => {
    setLocalConfig(structuredClone(cfg));
  }, []);

  // ── Footer state logic ────────────────────────────────────────────

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveNewName, setSaveNewName] = useState('');

  const hasChanges = useMemo(
    () => JSON.stringify(localConfig) !== JSON.stringify(pipelineConfig),
    [localConfig, pipelineConfig]
  );

  const isDrifted = useMemo(() => {
    const activeId = getActivePresetId();
    if (!activeId) return hasChanges;
    const preset = getPresetById(activeId);
    if (!preset) return hasChanges;
    const presetCfg = resolvePresetConfig(preset, defaultConfigs);
    if (!presetCfg) return hasChanges;
    return JSON.stringify(localConfig) !== JSON.stringify(presetCfg);
  }, [localConfig, defaultConfigs, hasChanges]);

  const activeUserPreset = useMemo(() => {
    const activeId = getActivePresetId();
    if (!activeId) return null;
    const preset = getPresetById(activeId);
    if (!preset || preset.builtIn) return null;
    return preset;
  }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [localConfig, defaultConfigs]);

  const handleClose = useCallback(() => {
    setShowSaveDialog(false);
    onClose();
  }, [onClose]);

  const handleRevert = useCallback(() => {
    setLocalConfig(
      pipelineConfig.stages.length > 0
        ? structuredClone(pipelineConfig)
        : EMPTY_PIPELINE
    );
  }, [pipelineConfig]);

  const handleSaveClick = useCallback(() => {
    setSaveNewName('');
    setShowSaveDialog(true);
  }, []);

  const handleUse = useCallback(() => {
    setPipelineConfig(localConfig);
    persistConfigOnSave(localConfig);
    setShowSaveDialog(false);
    onClose();
  }, [localConfig, setPipelineConfig, onClose]);

  const handleSaveToProfile = () => {
    if (!activeUserPreset) return;
    updateUserPreset(activeUserPreset.id, { config: localConfig });
    setPipelineConfig(localConfig);
    persistConfigOnSave(localConfig);
    setShowSaveDialog(false);
    onClose();
  };

  const handleSaveAsNew = () => {
    const name = saveNewName.trim();
    if (!name) return;
    const newPreset = createUserPreset(name, localConfig);
    setActivePresetId(newPreset.id);
    setPipelineConfig(localConfig);
    persistConfigOnSave(localConfig);
    setShowSaveDialog(false);
    onClose();
  };

  const res = localConfig.resilience ?? {};
  const hn = localConfig.hostname_config ?? {};

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Scan Settings"
      size="large"
      footer={
        <SettingsFooter
          hasChanges={hasChanges}
          isDrifted={isDrifted}
          onClose={handleClose}
          onRevert={handleRevert}
          onSave={handleSaveClick}
          onUse={handleUse}
        />
      }
    >
      {/* Save to custom profile dialog */}
      {showSaveDialog && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <div className="confirm-header">
              <i className="fa-solid fa-floppy-disk confirm-icon confirm-icon--save" />
              <h3>Save Custom Profile</h3>
            </div>
            <p className="confirm-message">
              Save your current pipeline configuration as a reusable profile.
            </p>

            <div className="confirm-actions">
              {activeUserPreset && (
                <button className="btn btn-primary confirm-btn-full" onClick={handleSaveToProfile}>
                  <i className="fa-solid fa-floppy-disk" /> Save to &ldquo;{activeUserPreset.name}&rdquo;
                </button>
              )}

              <div className="confirm-save-new">
                <input
                  className="confirm-name-input"
                  placeholder="New profile name…"
                  value={saveNewName}
                  onChange={(e) => setSaveNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAsNew(); }}
                  maxLength={24}
                  autoFocus={!activeUserPreset}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSaveAsNew}
                  disabled={!saveNewName.trim()}
                >
                  <i className="fa-solid fa-plus" /> Save as New
                </button>
              </div>

              <div className="confirm-divider" />

              <button className="btn btn-secondary confirm-btn-full" onClick={() => setShowSaveDialog(false)}>
                <i className="fa-solid fa-arrow-left" /> Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preset bar */}
      <PresetBar
        localConfig={localConfig}
        defaultConfigs={defaultConfigs}
        onApplyPreset={handleApplyPreset}
      />

      {/* Stage Palette — add stages */}
      <div className="settings-section">
        <div className="settings-section-title">
          Add Stages
          <HelpTip text="Click a stage type to add it to the pipeline. Stages run in order from top to bottom." />
        </div>
        <StagePalette onAdd={handleAddStage} />
      </div>

      {/* Pipeline — ordered list of stages */}
      <div className="settings-section">
        <div className="settings-section-title">
          Pipeline
          <HelpTip text="Drag to reorder stages. Expand each stage to configure its settings." />
          {localConfig.stages.length > 0 && (
            <span className="text-muted stage-count">
              {localConfig.stages.length} stage{localConfig.stages.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <StageList
          stages={localConfig.stages}
          onRemove={handleRemoveStage}
          onReorder={handleReorderStages}
          onConfigChange={handleStageConfigChange}
          portLists={portLists}
        />
      </div>

      {/* Global settings — resilience & hostname */}
      <div className="settings-section-group">
        <div className="settings-section">
          <div className="settings-section-title">
            Resilience
            <HelpTip text="Controls how the scanner handles failures and retries across all stages." />
          </div>
          <div className="form-group">
            <label className="form-label">
              Thread Multiplier <HelpTip text="Global multiplier applied to all stage thread counts. Lower values reduce system load." />
            </label>
            <input
              type="number" className="form-input form-input-sm"
              min="0.1" step="0.1"
              value={(res.t_multiplier as number) ?? ''}
              placeholder="1.0"
              onChange={(e) => {
                const v = e.target.value;
                handleResilienceChange('t_multiplier', v ? parseFloat(v) : undefined);
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Failure Retry Count <HelpTip text="Number of times to retry a stage after failure before giving up" />
            </label>
            <input
              type="number" className="form-input form-input-sm"
              min="0" max="10"
              value={(res.failure_retry_cnt as number) ?? ''}
              placeholder="2"
              onChange={(e) => {
                const v = e.target.value;
                handleResilienceChange('failure_retry_cnt', v ? parseInt(v) : undefined);
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Multiplier Decrease <HelpTip text="Amount to reduce the thread multiplier after each failure" />
            </label>
            <input
              type="number" className="form-input form-input-sm"
              min="0" step="0.05" max="1"
              value={(res.failure_multiplier_decrease as number) ?? ''}
              placeholder="0.25"
              onChange={(e) => {
                const v = e.target.value;
                handleResilienceChange('failure_multiplier_decrease', v ? parseFloat(v) : undefined);
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Debounce (s) <HelpTip text="Minimum time between failure-triggered retries to avoid rapid cycling" />
            </label>
            <input
              type="number" className="form-input form-input-sm"
              min="0" step="0.5"
              value={(res.failure_debounce_sec as number) ?? ''}
              placeholder="5.0"
              onChange={(e) => {
                const v = e.target.value;
                handleResilienceChange('failure_debounce_sec', v ? parseFloat(v) : undefined);
              }}
            />
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">
            Hostname Resolution
            <HelpTip text="Global hostname lookup settings applied across all stages." />
          </div>
          <div className="form-group">
            <label className="form-label">
              Retries <HelpTip text="Number of DNS lookup retries for hostname resolution" />
            </label>
            <input
              type="number" className="form-input form-input-sm"
              min="0" max="10"
              value={(hn.retries as number) ?? ''}
              placeholder="1"
              onChange={(e) => {
                const v = e.target.value;
                handleHostnameChange('retries', v ? parseInt(v) : undefined);
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Retry Delay (s) <HelpTip text="Seconds to wait between DNS lookup retries" />
            </label>
            <input
              type="number" className="form-input form-input-sm"
              min="0" step="0.1"
              value={(hn.retry_delay as number) ?? ''}
              placeholder="1.5"
              onChange={(e) => {
                const v = e.target.value;
                handleHostnameChange('retry_delay', v ? parseFloat(v) : undefined);
              }}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}