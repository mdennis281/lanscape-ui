/**
 * PresetBar — The quick-select strip at the top of Scan Settings.
 *
 * Shows built-in presets (Fast / Balanced / Accurate), plus any user-saved
 * presets. The currently active preset is highlighted; if the user tweaks
 * a setting the highlight fades to a "modified" state with a save affordance.
 *
 * Users can:
 *  • Click a preset to instantly load it
 *  • Save their current config as a new named preset
 *  • Overwrite or delete their own presets (not built-ins)
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ScanConfig, DefaultConfigs } from '../../types';
import { JsonEditorModal } from '../JsonEditor';
import {
  getAllPresets,
  resolvePresetConfig,
  createUserPreset,
  updateUserPreset,
  deleteUserPreset,
  configMatchesPreset,
  setActivePresetId,
  getActivePresetId,
  type Preset,
  type UserPreset,
} from '../../services/presets';

// ── Props ────────────────────────────────────────────────────────────

interface PresetBarProps {
  /** The live (possibly modified) config in the settings form. */
  localConfig: ScanConfig;
  /** Backend-provided default configs keyed by preset name. */
  defaultConfigs: DefaultConfigs | null;
  /** Called when the user picks a preset — parent should setLocalConfig. */
  onApplyPreset: (config: ScanConfig, presetId: string) => void;
}

// ── Icon picker palette ──────────────────────────────────────────────

const ICON_OPTIONS = [
  'fa-solid fa-sliders',
  'fa-solid fa-house',
  'fa-solid fa-server',
  'fa-solid fa-shield-halved',
  'fa-solid fa-network-wired',
  'fa-solid fa-flask',
  'fa-solid fa-microchip',
  'fa-solid fa-gauge-high',
  'fa-solid fa-eye',
  'fa-solid fa-star',
  'fa-solid fa-heart',
  'fa-solid fa-wrench',
];

// ── Component ────────────────────────────────────────────────────────

export function PresetBar({ localConfig, defaultConfigs, onApplyPreset }: PresetBarProps) {
  const [presets, setPresets] = useState<Preset[]>(getAllPresets);
  const [activeId, setActiveId] = useState<string | null>(getActivePresetId);

  // "Save new" flow
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveIcon, setSaveIcon] = useState(ICON_OPTIONS[0]);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const saveInputRef = useRef<HTMLInputElement>(null);

  // Context menu for user presets
  const [contextMenu, setContextMenu] = useState<{
    presetId: string;
    x: number;
    y: number;
  } | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  // Rename inline
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // JSON viewer
  const [jsonViewPreset, setJsonViewPreset] = useState<Preset | null>(null);

  // ── Refresh presets from storage ─────────────────────────────────

  const refresh = useCallback(() => setPresets(getAllPresets()), []);

  // ── Track whether the live config has drifted from the active preset ─

  const isModified = useMemo(() => {
    if (!activeId) return false;
    const preset = presets.find((p) => p.id === activeId);
    if (!preset) return false;
    const presetCfg = resolvePresetConfig(preset, defaultConfigs);
    if (!presetCfg) return false;
    return !configMatchesPreset(localConfig, presetCfg);
  }, [localConfig, activeId, presets, defaultConfigs]);

  // ── Close context menu on outside click ──────────────────────────

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  // Focus inputs when they appear
  useEffect(() => {
    if (showSaveForm) saveInputRef.current?.focus();
  }, [showSaveForm]);
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  // ── Handlers ─────────────────────────────────────────────────────

  const handleSelect = (preset: Preset) => {
    const cfg = resolvePresetConfig(preset, defaultConfigs);
    if (!cfg) return;
    setActiveId(preset.id);
    setActivePresetId(preset.id);
    onApplyPreset({ ...cfg }, preset.id);
    setContextMenu(null);
  };

  const handleSaveNew = () => {
    const name = saveName.trim();
    if (!name) return;
    const newPreset = createUserPreset(name, localConfig, saveIcon);
    setActiveId(newPreset.id);
    setActivePresetId(newPreset.id);
    refresh();
    setShowSaveForm(false);
    setSaveName('');
    setSaveIcon(ICON_OPTIONS[0]);
  };

  const handleOverwrite = (id: string) => {
    updateUserPreset(id, { config: localConfig });
    setContextMenu(null);
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteUserPreset(id);
    if (activeId === id) setActiveId(null);
    setContextMenu(null);
    refresh();
  };

  const handleContextMenu = (e: React.MouseEvent, presetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ presetId, x: e.clientX, y: e.clientY });
  };

  const handleRenameSubmit = () => {
    if (renamingId && renameValue.trim()) {
      updateUserPreset(renamingId, { name: renameValue.trim() });
      refresh();
    }
    setRenamingId(null);
    setContextMenu(null);
  };

  // ── Render ───────────────────────────────────────────────────────

  const builtIns = presets.filter((p) => p.builtIn);
  const userPresets = presets.filter((p) => !p.builtIn) as UserPreset[];

  return (
    <div className="preset-bar">
      {/* Built-in presets */}
      <div className="preset-bar-group">
        {builtIns.map((preset) => {
          // When drifted, no preset gets highlighted — the + button does
          const isActive = activeId === preset.id && !isModified;
          return (
            <button
              key={preset.id}
              className={
                'preset-chip' +
                (isActive ? ' preset-chip--active' : '')
              }
              onClick={() => handleSelect(preset)}
              onContextMenu={(e) => handleContextMenu(e, preset.id)}
              data-tooltip-id="tooltip"
              data-tooltip-content={`${preset.description} (right-click to view as JSON)`}
            >
              <i className={preset.icon} />
              <span>{preset.name}</span>
            </button>
          );
        })}
      </div>

      {/* Divider between built-in and user presets */}
      {userPresets.length > 0 && <div className="preset-bar-divider" />}

      {/* User presets */}
      {userPresets.length > 0 && (
        <div className="preset-bar-group">
          {userPresets.map((preset) => {
            const isActive = activeId === preset.id && !isModified;

            if (renamingId === preset.id) {
              return (
                <form
                  key={preset.id}
                  className="preset-chip preset-chip--editing"
                  onSubmit={(e) => { e.preventDefault(); handleRenameSubmit(); }}
                >
                  <input
                    ref={renameInputRef}
                    className="preset-rename-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={(e) => { if (e.key === 'Escape') setRenamingId(null); }}
                    maxLength={24}
                  />
                </form>
              );
            }

            return (
              <button
                key={preset.id}
                className={
                  'preset-chip preset-chip--user' +
                  (isActive ? ' preset-chip--active' : '')
                }
                onClick={() => handleSelect(preset)}
                onContextMenu={(e) => handleContextMenu(e, preset.id)}
                data-tooltip-id="tooltip"
                data-tooltip-content={`${preset.description} (right-click to manage)`}
              >
                <i className={preset.icon} />
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Save new button / form — highlighted when config drifted */}
      <div className="preset-bar-actions">
        {!showSaveForm ? (
          <button
            className={
              'preset-chip preset-chip--add' +
              (isModified ? ' preset-chip--add-highlight' : '')
            }
            onClick={() => setShowSaveForm(true)}
            data-tooltip-id="tooltip"
            data-tooltip-content={
              isModified
                ? 'Settings modified — save as a custom profile'
                : 'Save current settings as a new preset'
            }
          >
            <i className="fa-solid fa-plus" />
          </button>
        ) : (
          <form
            className="preset-save-form"
            onSubmit={(e) => { e.preventDefault(); handleSaveNew(); }}
          >
            <button
              type="button"
              className="preset-save-icon-btn"
              onClick={() => setShowIconPicker(!showIconPicker)}
              data-tooltip-id="tooltip"
              data-tooltip-content="Choose icon"
            >
              <i className={saveIcon} />
            </button>
            {showIconPicker && (
              <div className="preset-icon-picker">
                {ICON_OPTIONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={'preset-icon-option' + (icon === saveIcon ? ' active' : '')}
                    onClick={() => { setSaveIcon(icon); setShowIconPicker(false); }}
                  >
                    <i className={icon} />
                  </button>
                ))}
              </div>
            )}
            <input
              ref={saveInputRef}
              className="preset-save-input"
              placeholder="Preset name…"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setShowSaveForm(false); }}
              maxLength={24}
            />
            <button
              type="submit"
              className="preset-save-confirm"
              disabled={!saveName.trim()}
              data-tooltip-id="tooltip"
              data-tooltip-content="Save preset"
            >
              <i className="fa-solid fa-check" />
            </button>
            <button
              type="button"
              className="preset-save-cancel"
              onClick={() => { setShowSaveForm(false); setShowIconPicker(false); }}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </form>
        )}
      </div>

      {/* Context menu for user presets */}
      {contextMenu && (() => {
        const ctxPreset = presets.find((p) => p.id === contextMenu.presetId);
        const isUserPreset = ctxPreset && !ctxPreset.builtIn;
        return (
          <div
            ref={contextRef}
            className="preset-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              className="preset-context-item"
              onClick={() => {
                if (ctxPreset) setJsonViewPreset(ctxPreset);
                setContextMenu(null);
              }}
            >
              <i className="fa-solid fa-code" /> View as JSON
            </button>
            {isUserPreset && (
              <>
                <div className="preset-context-divider" />
                <button
                  className="preset-context-item"
                  onClick={() => handleOverwrite(contextMenu.presetId)}
                >
                  <i className="fa-solid fa-floppy-disk" /> Update with current
                </button>
                <button
                  className="preset-context-item"
                  onClick={() => {
                    if (ctxPreset) {
                      setRenamingId(ctxPreset.id);
                      setRenameValue(ctxPreset.name);
                    }
                    setContextMenu(null);
                  }}
                >
                  <i className="fa-solid fa-pen" /> Rename
                </button>
                <div className="preset-context-divider" />
                <button
                  className="preset-context-item preset-context-item--danger"
                  onClick={() => handleDelete(contextMenu.presetId)}
                >
                  <i className="fa-solid fa-trash" /> Delete
                </button>
              </>
            )}
          </div>
        );
      })()}
      {/* JSON viewer modal */}
      <JsonEditorModal
        isOpen={!!jsonViewPreset}
        onClose={() => setJsonViewPreset(null)}
        title={jsonViewPreset ? `${jsonViewPreset.name} — Scan Config` : ''}
        value={jsonViewPreset ? resolvePresetConfig(jsonViewPreset, defaultConfigs) : {}}
        readOnly
      />
    </div>
  );
}
