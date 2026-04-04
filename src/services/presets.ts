/**
 * Scan Config Preset Service
 *
 * Manages built-in and user-created scan configuration presets with
 * localStorage persistence. Built-in presets (fast/balanced/accurate)
 * come from the backend; user presets are stored locally.
 */

import type { ScanConfig, DefaultConfigs, PipelineConfig, StageEntry, StageType } from '../types';

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
  config: PipelineConfig;
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

// ── ScanConfig → PipelineConfig migration ────────────────────────────

const LOOKUP_TYPE_TO_STAGE: Record<string, StageType> = {
  ICMP: 'icmp_discovery',
  ARP_LOOKUP: 'arp_discovery',
  POKE_THEN_ARP: 'poke_arp_discovery',
  ICMP_THEN_ARP: 'icmp_arp_discovery',
};

/** Convert a legacy ScanConfig to a PipelineConfig. */
export function scanConfigToPipeline(sc: ScanConfig): PipelineConfig {
  const stages: StageEntry[] = [];

  // Map lookup types to discovery stages
  if (sc.lookup_type) {
    for (const lt of sc.lookup_type) {
      const stageType = LOOKUP_TYPE_TO_STAGE[lt];
      if (!stageType) continue;

      const config: Record<string, unknown> = {};
      if (sc.t_cnt_isalive != null) config.t_cnt = sc.t_cnt_isalive;

      if (stageType === 'icmp_discovery' || stageType === 'icmp_arp_discovery') {
        if (sc.ping_config) config.ping_config = sc.ping_config;
      }
      if (stageType === 'arp_discovery') {
        if (sc.arp_config) config.arp_config = sc.arp_config;
      }
      if (stageType === 'poke_arp_discovery') {
        if (sc.poke_config) config.poke_config = sc.poke_config;
        if (sc.arp_cache_config) config.arp_cache_config = sc.arp_cache_config;
      }
      if (stageType === 'icmp_arp_discovery') {
        if (sc.arp_cache_config) config.arp_cache_config = sc.arp_cache_config;
      }

      stages.push({ stage_type: stageType, config });
    }
  }

  // Map port scanning to port_scan stage
  if (sc.task_scan_ports) {
    const config: Record<string, unknown> = {};
    if (sc.port_list) config.port_list = sc.port_list;
    if (sc.port_scan_config) config.port_scan_config = sc.port_scan_config;
    if (sc.service_scan_config) config.service_scan_config = sc.service_scan_config;
    if (sc.task_scan_port_services != null) config.scan_services = sc.task_scan_port_services;
    if (sc.t_cnt_port_scan != null) config.t_cnt_device = sc.t_cnt_port_scan;
    if (sc.t_cnt_port_test != null) config.t_cnt_port = sc.t_cnt_port_test;
    stages.push({ stage_type: 'port_scan', config });
  }

  const pipeline: PipelineConfig = { stages };
  if (sc.subnet) pipeline.subnet = sc.subnet;
  if (sc.t_multiplier != null) {
    pipeline.resilience = { t_multiplier: sc.t_multiplier };
  }

  return pipeline;
}

/** Check if a stored config object is legacy ScanConfig (no `stages` key). */
function isLegacyScanConfig(obj: unknown): obj is ScanConfig {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    !Array.isArray(obj) &&
    !('stages' in obj)
  );
}

// ── Persistence helpers ──────────────────────────────────────────────

function loadUserPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Migrate any legacy ScanConfig presets to PipelineConfig
    let migrated = false;
    const presets = (parsed as UserPreset[]).map((p) => {
      if (isLegacyScanConfig(p.config)) {
        migrated = true;
        return { ...p, config: scanConfigToPipeline(p.config) };
      }
      return p;
    });
    if (migrated) saveUserPresets(presets);

    return presets;
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
 * Resolve the PipelineConfig for a preset.
 * Built-in presets are converted from the backend defaultConfigs.
 */
export function resolvePresetConfig(
  preset: Preset,
  defaultConfigs: DefaultConfigs | null
): PipelineConfig | null {
  if (preset.builtIn) {
    const sc = defaultConfigs?.[preset.id];
    if (!sc) return null;
    return scanConfigToPipeline(sc);
  }
  return preset.config;
}

/**
 * Create a new user preset from the current config.
 */
export function createUserPreset(
  name: string,
  config: PipelineConfig,
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
  updates: { name?: string; config?: PipelineConfig; icon?: string; description?: string }
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
  config: PipelineConfig,
  presetConfig: PipelineConfig
): boolean {
  return JSON.stringify(config) === JSON.stringify(presetConfig);
}

// ── Last-used config persistence ─────────────────────────────────────

/**
 * Persist the exact config the user saved, so it survives page reload
 * even if they've drifted from a preset.
 */
export function saveLastConfig(config: PipelineConfig): void {
  localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(config));
}

/**
 * Retrieve the last config the user explicitly saved.
 */
export function getLastConfig(): PipelineConfig | null {
  try {
    const raw = localStorage.getItem(LAST_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Migrate legacy last-config
    if (isLegacyScanConfig(parsed)) return scanConfigToPipeline(parsed);
    return parsed as PipelineConfig;
  } catch {
    return null;
  }
}

/**
 * Save current config and, if the active preset is a user preset,
 * auto-update that preset to match. Call this from the modal's Save button.
 */
export function persistConfigOnSave(config: PipelineConfig): void {
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
