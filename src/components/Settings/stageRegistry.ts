/**
 * Stage metadata registry — maps StageType values to display info and
 * default configs for the pipeline builder UI.
 */

import type { StageType } from '../../types';

export interface StageMeta {
  type: StageType;
  label: string;
  description: string;
  icon: string;
  category: 'discovery' | 'scanning';
  defaultConfig: Record<string, unknown>;
}

export const STAGE_REGISTRY: StageMeta[] = [
  {
    type: 'icmp_discovery',
    label: 'ICMP (Ping)',
    description: 'Discover hosts via ICMP echo requests',
    icon: 'fa-solid fa-satellite-dish',
    category: 'discovery',
    defaultConfig: {},
  },
  {
    type: 'arp_discovery',
    label: 'ARP Lookup',
    description: 'Discover hosts via ARP requests',
    icon: 'fa-solid fa-network-wired',
    category: 'discovery',
    defaultConfig: {},
  },
  {
    type: 'poke_arp_discovery',
    label: 'Poke + ARP',
    description: 'TCP poke followed by ARP cache check',
    icon: 'fa-solid fa-hand-pointer',
    category: 'discovery',
    defaultConfig: {},
  },
  {
    type: 'icmp_arp_discovery',
    label: 'ICMP + ARP',
    description: 'ICMP echo followed by ARP cache check',
    icon: 'fa-solid fa-arrows-split-up-and-left',
    category: 'discovery',
    defaultConfig: {},
  },
  {
    type: 'ipv6_ndp_discovery',
    label: 'IPv6 NDP',
    description: 'Discover IPv6 hosts via Neighbor Discovery Protocol',
    icon: 'fa-solid fa-globe',
    category: 'discovery',
    defaultConfig: {},
  },
  {
    type: 'ipv6_mdns_discovery',
    label: 'IPv6 mDNS',
    description: 'Discover IPv6 hosts via multicast DNS',
    icon: 'fa-solid fa-tower-broadcast',
    category: 'discovery',
    defaultConfig: {},
  },
  {
    type: 'port_scan',
    label: 'Port Scan',
    description: 'Scan discovered hosts for open ports and services',
    icon: 'fa-solid fa-door-open',
    category: 'scanning',
    defaultConfig: {
      port_list: 'medium',
      scan_services: true,
    },
  },
];

export function getStageMeta(type: StageType): StageMeta {
  return STAGE_REGISTRY.find((s) => s.type === type)!;
}
