/**
 * Stage metadata registry — maps StageType values to display info,
 * default configs, and presets for the pipeline builder UI.
 *
 * Default configs are fetched from the backend via `tools.stage_defaults`
 * and applied at startup via {@link applyStageDefaults}.
 * Presets (fast/balanced/accurate) are fetched via `tools.stage_presets`
 * and applied via {@link applyStagePresets}.
 */

import type { StageType } from '../../types';

export type PresetName = 'fast' | 'balanced' | 'accurate';

export interface StageMeta {
  type: StageType;
  label: string;
  description: string;
  icon: string;
  category: 'discovery' | 'scanning';
  defaultConfig: Record<string, unknown>;
  presets: Record<PresetName, Record<string, unknown>>;
}

export const STAGE_REGISTRY: StageMeta[] = [
  {
    type: 'icmp_discovery',
    label: 'ICMP (Ping)',
    description: 'Discover hosts via ICMP echo requests',
    icon: 'fa-solid fa-satellite-dish',
    category: 'discovery',
    defaultConfig: {},
    presets: {} as Record<PresetName, Record<string, unknown>>,
  },
  {
    type: 'arp_discovery',
    label: 'ARP Lookup',
    description: 'Discover hosts via ARP requests',
    icon: 'fa-solid fa-network-wired',
    category: 'discovery',
    defaultConfig: {},
    presets: {} as Record<PresetName, Record<string, unknown>>,
  },
  {
    type: 'poke_arp_discovery',
    label: 'Poke + ARP',
    description: 'TCP poke followed by ARP cache check',
    icon: 'fa-solid fa-hand-pointer',
    category: 'discovery',
    defaultConfig: {},
    presets: {} as Record<PresetName, Record<string, unknown>>,
  },
  {
    type: 'icmp_arp_discovery',
    label: 'ICMP + ARP',
    description: 'ICMP echo followed by ARP cache check',
    icon: 'fa-solid fa-arrows-split-up-and-left',
    category: 'discovery',
    defaultConfig: {},
    presets: {} as Record<PresetName, Record<string, unknown>>,
  },
  {
    type: 'ipv6_ndp_discovery',
    label: 'IPv6 NDP',
    description: 'Discover IPv6 hosts via Neighbor Discovery Protocol',
    icon: 'fa-solid fa-globe',
    category: 'discovery',
    defaultConfig: {},
    presets: {} as Record<PresetName, Record<string, unknown>>,
  },
  {
    type: 'ipv6_mdns_discovery',
    label: 'IPv6 mDNS',
    description: 'Discover IPv6 hosts via multicast DNS',
    icon: 'fa-solid fa-tower-broadcast',
    category: 'discovery',
    defaultConfig: {},
    presets: {} as Record<PresetName, Record<string, unknown>>,
  },
  {
    type: 'port_scan',
    label: 'Port Scan',
    description: 'Scan discovered hosts for open ports and services',
    icon: 'fa-solid fa-door-open',
    category: 'scanning',
    defaultConfig: {},
    presets: {} as Record<PresetName, Record<string, unknown>>,
  },
];

/**
 * Apply backend-provided default configs to the stage registry.
 * Called once on initial connection.
 */
export function applyStageDefaults(defaults: Record<string, Record<string, unknown>>): void {
  for (const meta of STAGE_REGISTRY) {
    const cfg = defaults[meta.type];
    if (cfg) {
      meta.defaultConfig = { ...cfg };
    }
  }
}

/**
 * Apply backend-provided presets to the stage registry.
 * Called once on initial connection alongside {@link applyStageDefaults}.
 */
export function applyStagePresets(
  presets: Record<string, Record<string, Record<string, unknown>>>,
): void {
  for (const meta of STAGE_REGISTRY) {
    const stagePresets = presets[meta.type];
    if (stagePresets) {
      meta.presets = stagePresets as Record<PresetName, Record<string, unknown>>;
    }
  }
}

export function getStageMeta(type: StageType): StageMeta {
  return STAGE_REGISTRY.find((s) => s.type === type)!;
}
