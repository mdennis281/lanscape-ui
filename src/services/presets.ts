/**
 * Scan Config Preset Service
 *
 * Manages built-in and user-created scan configuration presets with
 * localStorage persistence. Built-in presets (fast/balanced/accurate)
 * come from the backend; user presets are stored locally.
 */

import type { ScanConfig, DefaultConfigs } from '../types';

// ── Types ────────────────────────────────────────────────────────────

export interface PresetMeta {
  id: string;
  name: string;
  icon: string;
  description: string;
  builtIn: boolean;
}

export interface UserPreset extends PresetMeta {
  builtIn: false;
  config: ScanConfig;
  createdAt: number;
  updatedAt: number;
}

export interface BuiltInPreset extends PresetMeta {
  builtIn: true;
}

export type Preset = BuiltInPreset | UserPreset;

// ── Constants ────────────────────────────────────────────────────────

const STORAGE_KEY = 'lanscape:userPresets';
const ACTIVE_PRESET_KEY = 'lanscape:activePreset';
const LAST_CONFIG_KEY = 'lanscape:lastConfig';

export const BUILT_IN_PRESETS: BuiltInPreset[] = [
  {
    id: 'fast',
    name: 'Fast',
    icon: 'fa-solid fa-bolt',
    description: 'Quick scan, low accuracy',
    builtIn: true,
  },
  {
    id: 'balanced',
    name: 'Balanced',
    icon: 'fa-solid fa-scale-balanced',
    description: 'Speed & accuracy',
    builtIn: true,
  },
  {
    id: 'accurate',
    name: 'Accurate',
    icon: 'fa-solid fa-bullseye',
    description: 'Thorough scan, slower',
    builtIn: true,
  },
];

// ── Persistence helpers ──────────────────────────────────────────────

function loadUserPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as UserPreset[];
  } catch {
    return [];
  }
}

function saveUserPresets(presets: UserPreset[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Get all presets: built-ins first, then user presets sorted by creation date.
 */
export function getAllPresets(): Preset[] {
  return [...BUILT_IN_PRESETS, ...loadUserPresets()];
}

/**
 * Get only user-created presets.
 */
export function getUserPresets(): UserPreset[] {
  return loadUserPresets();
}

/**
 * Look up a single preset by id.
 * For built-in presets, the config must be resolved from defaultConfigs separately.
 */
export function getPresetById(id: string): Preset | undefined {
  return getAllPresets().find((p) => p.id === id);
}

/**
 * Resolve the ScanConfig for a preset.
 * Built-in presets need the backend defaultConfigs; user presets carry their own.
 */
export function resolvePresetConfig(
  preset: Preset,
  defaultConfigs: DefaultConfigs | null
): ScanConfig | null {
  if (preset.builtIn) {
    return defaultConfigs?.[preset.id] ?? null;
  }
  return preset.config;
}

/**
 * Create a new user preset from the current config.
 */
export function createUserPreset(
  name: string,
  config: ScanConfig,
  icon?: string,
  description?: string
): UserPreset {
  const now = Date.now();
  const id = `user_${now}`;
  const preset: UserPreset = {
    id,
    name,
    icon: icon || 'fa-solid fa-sliders',
    description: description || 'Custom preset',
    builtIn: false,
    config: structuredClone(config),
    createdAt: now,
    updatedAt: now,
  };
  const existing = loadUserPresets();
  existing.push(preset);
  saveUserPresets(existing);
  return preset;
}

/**
 * Overwrite an existing user preset's config (and optionally name/desc).
 */
export function updateUserPreset(
  id: string,
  updates: { name?: string; config?: ScanConfig; icon?: string; description?: string }
): UserPreset | null {
  const presets = loadUserPresets();
  const idx = presets.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  const preset = presets[idx];
  if (updates.name !== undefined) preset.name = updates.name;
  if (updates.description !== undefined) preset.description = updates.description;
  if (updates.icon !== undefined) preset.icon = updates.icon;
  if (updates.config !== undefined) preset.config = structuredClone(updates.config);
  preset.updatedAt = Date.now();

  presets[idx] = preset;
  saveUserPresets(presets);
  return preset;
}

/**
 * Delete a user preset. Built-in presets cannot be deleted.
 */
export function deleteUserPreset(id: string): boolean {
  const presets = loadUserPresets();
  const filtered = presets.filter((p) => p.id !== id);
  if (filtered.length === presets.length) return false;
  saveUserPresets(filtered);
  // Clear active if it was the deleted one
  if (getActivePresetId() === id) {
    clearActivePresetId();
  }
  return true;
}

// ── Active preset tracking ───────────────────────────────────────────

/**
 * Remember which preset the user last applied, across sessions.
 */
export function setActivePresetId(id: string): void {
  localStorage.setItem(ACTIVE_PRESET_KEY, id);
}

export function getActivePresetId(): string | null {
  return localStorage.getItem(ACTIVE_PRESET_KEY);
}

export function clearActivePresetId(): void {
  localStorage.removeItem(ACTIVE_PRESET_KEY);
}

/**
 * Deep-compare a config against a preset config to see if the user has
 * drifted from it (i.e. made manual changes).
 */
export function configMatchesPreset(
  config: ScanConfig,
  presetConfig: ScanConfig
): boolean {
  return JSON.stringify(config) === JSON.stringify(presetConfig);
}

// ── Last-used config persistence ─────────────────────────────────────

/**
 * Persist the exact config the user saved, so it survives page reload
 * even if they've drifted from a preset.
 */
export function saveLastConfig(config: ScanConfig): void {
  localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(config));
}

/**
 * Retrieve the last config the user explicitly saved.
 */
export function getLastConfig(): ScanConfig | null {
  try {
    const raw = localStorage.getItem(LAST_CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ScanConfig;
  } catch {
    return null;
  }
}

/**
 * Save current config and, if the active preset is a user preset,
 * auto-update that preset to match. Call this from the modal's Save button.
 */
export function persistConfigOnSave(config: ScanConfig): void {
  saveLastConfig(config);

  const activeId = getActivePresetId();
  if (!activeId) return;

  // Auto-update user presets so they stay in sync
  const userPresets = loadUserPresets();
  const idx = userPresets.findIndex((p) => p.id === activeId);
  if (idx !== -1) {
    userPresets[idx].config = structuredClone(config);
    userPresets[idx].updatedAt = Date.now();
    saveUserPresets(userPresets);
  }
}
