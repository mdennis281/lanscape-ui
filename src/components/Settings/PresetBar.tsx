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
import type { PipelineConfig } from '../../types';
import { JsonEditorModal } from '../JsonEditor';
import { ContextMenu, useContextMenu } from '../ContextMenu';
import type { ContextMenuSection } from '../ContextMenu';
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
  localConfig: PipelineConfig;
  /** Called when the user picks a preset — parent should setLocalConfig. */
  onApplyPreset: (config: PipelineConfig, presetId: string) => void;
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

export function PresetBar({ localConfig, onApplyPreset }: PresetBarProps) {
  const [presets, setPresets] = useState<Preset[]>(getAllPresets);
  const [activeId, setActiveId] = useState<string | null>(getActivePresetId);

  // "Save new" flow
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveIcon, setSaveIcon] = useState(ICON_OPTIONS[0]);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const saveInputRef = useRef<HTMLInputElement>(null);

  // Right-click menu for presets — uses the shared global ContextMenu so it
  // matches the look/feel of menus elsewhere in the app (Reload UI footer,
  // nested submenus, viewport clamping, etc).
  const ctxMenu = useContextMenu();

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
    const presetCfg = resolvePresetConfig(preset, localConfig.stages);
    if (!presetCfg) return false;
    return !configMatchesPreset(localConfig, presetCfg);
  }, [localConfig, activeId, presets]);

  // Focus inputs when they appear
  useEffect(() => {
    if (showSaveForm) saveInputRef.current?.focus();
  }, [showSaveForm]);
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  // ── Handlers ─────────────────────────────────────────────────────

  const handleSelect = (preset: Preset) => {
    const cfg = resolvePresetConfig(preset, localConfig.stages);
    if (!cfg) return;
    setActiveId(preset.id);
    setActivePresetId(preset.id);
    onApplyPreset(structuredClone(cfg), preset.id);
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
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteUserPreset(id);
    if (activeId === id) setActiveId(null);
    refresh();
  };

  // Build the right-click menu sections for a given preset. Both built-ins
  // and user presets share the JSON viewer; user presets get extra mgmt items.
  const buildPresetMenu = useCallback(
    (preset: Preset): ContextMenuSection[] => {
      const sections: ContextMenuSection[] = [
        {
          label: preset.name,
          items: [
            {
              label: 'View as JSON',
              icon: 'fa-solid fa-code',
              onClick: () => setJsonViewPreset(preset),
            },
          ],
        },
      ];
      if (!preset.builtIn) {
        sections.push({
          items: [
            {
              label: 'Update with current',
              icon: 'fa-solid fa-floppy-disk',
              onClick: () => handleOverwrite(preset.id),
            },
            {
              label: 'Rename',
              icon: 'fa-solid fa-pen',
              onClick: () => {
                setRenamingId(preset.id);
                setRenameValue(preset.name);
              },
            },
            {
              label: 'Delete',
              icon: 'fa-solid fa-trash',
              onClick: () => handleDelete(preset.id),
            },
          ],
        });
      }
      return sections;
    },
    // handleOverwrite/handleDelete close over localConfig+activeId, but they're
    // re-created every render; ctxMenu.handleContextMenu invokes the callback
    // synchronously on right-click, so stale closures aren't a concern here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localConfig, activeId],
  );

  const handleContextMenu = (e: React.MouseEvent, preset: Preset) => {
    ctxMenu.handleContextMenu(e, () => buildPresetMenu(preset));
  };

  const handleRenameSubmit = () => {
    if (renamingId && renameValue.trim()) {
      updateUserPreset(renamingId, { name: renameValue.trim() });
      refresh();
    }
    setRenamingId(null);
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
              onContextMenu={(e) => handleContextMenu(e, preset)}
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
                onContextMenu={(e) => handleContextMenu(e, preset)}
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

      {/* Right-click menu — shared global ContextMenu (auto-appends Reload UI etc) */}
      {ctxMenu.visible && (
        <ContextMenu
          sections={ctxMenu.sections}
          position={ctxMenu.position}
          onClose={ctxMenu.close}
        />
      )}

      {/* JSON viewer modal */}
      <JsonEditorModal
        isOpen={!!jsonViewPreset}
        onClose={() => setJsonViewPreset(null)}
        title={jsonViewPreset ? `${jsonViewPreset.name} — Scan Config` : ''}
        value={jsonViewPreset ? resolvePresetConfig(jsonViewPreset, localConfig.stages) : {}}
        readOnly
      />
    </div>
  );
}
