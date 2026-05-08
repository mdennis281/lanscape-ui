/**
 * Client-side stage time estimation.
 *
 * Mirrors the backend logic in `lanscape/core/stage_estimates.py`.
 * Returns estimated seconds for one unit of work (one IP for discovery,
 * one device for port scan). The caller multiplies by subnet/device count.
 */

import type { StageType, PortListSummary } from '../../types';

// ── Nested config helpers ────────────────────────────────────────────

function nested(config: Record<string, unknown>, key: string): Record<string, unknown> {
  return (config[key] as Record<string, unknown>) ?? {};
}

function num(obj: Record<string, unknown>, key: string, fallback: number): number {
  const v = obj[key];
  return typeof v === 'number' ? v : fallback;
}

// ── Per-stage estimators ─────────────────────────────────────────────

function icmpEstimate(config: Record<string, unknown>): number {
  const pc = nested(config, 'ping_config');
  const attempts = num(pc, 'attempts', 2);
  const timeout = num(pc, 'timeout', 1.0);
  const retryDelay = num(pc, 'retry_delay', 0.25);
  return attempts * (timeout + retryDelay);
}

function arpEstimate(config: Record<string, unknown>): number {
  const ac = nested(config, 'arp_config');
  return num(ac, 'attempts', 1) * num(ac, 'timeout', 2.0);
}

function pokeArpEstimate(config: Record<string, unknown>): number {
  const pc = nested(config, 'poke_config');
  const cc = nested(config, 'arp_cache_config');
  return num(pc, 'attempts', 1) * num(pc, 'timeout', 2.0) + num(cc, 'wait_before', 0.2);
}

function icmpArpEstimate(config: Record<string, unknown>): number {
  const pc = nested(config, 'ping_config');
  const attempts = num(pc, 'attempts', 2);
  const timeout = num(pc, 'timeout', 1.0);
  const retryDelay = num(pc, 'retry_delay', 0.25);
  return attempts * (timeout + retryDelay);
}

function ipv6NdpEstimate(config: Record<string, unknown>): number {
  const ntc = nested(config, 'neighbor_table_config');
  return 10.0 + num(ntc, 'refresh_interval', 2.0);
}

function ipv6MdnsEstimate(config: Record<string, unknown>): number {
  return num(config, 'timeout', 5.0);
}

function portScanEstimate(
  config: Record<string, unknown>,
  portLists?: PortListSummary[],
): number {
  const portListName = (config.port_list as string) ?? 'medium';
  const portEntry = portLists?.find((p) => p.name === portListName);
  const portCount = portEntry?.count ?? 148;

  const psc = nested(config, 'port_scan_config');
  const timeout = num(psc, 'timeout', 1.0);
  const retries = num(psc, 'retries', 0);
  const retryDelay = num(psc, 'retry_delay', 0.1);

  let perPort = timeout * (1 + retries) + retryDelay * retries;

  const scanServices = config.scan_services !== false;
  if (scanServices) {
    const ssc = nested(config, 'service_scan_config');
    perPort += num(ssc, 'timeout', 5.0);
  }

  const tCntPort = num(config, 't_cnt_port', 16);
  const batches = Math.ceil(portCount / Math.max(1, tCntPort));
  return batches * perPort;
}

// ── Estimator registry ───────────────────────────────────────────────

type EstimatorFn = (config: Record<string, unknown>, portLists?: PortListSummary[]) => number;

const ESTIMATORS: Record<StageType, EstimatorFn> = {
  icmp_discovery: icmpEstimate,
  arp_discovery: arpEstimate,
  poke_arp_discovery: pokeArpEstimate,
  icmp_arp_discovery: icmpArpEstimate,
  ipv6_ndp_discovery: ipv6NdpEstimate,
  ipv6_mdns_discovery: ipv6MdnsEstimate,
  port_scan: portScanEstimate,
};

/**
 * Estimate seconds for one unit of work.
 * Discovery stages: one IP (worst-case, no hostname resolution).
 * Port scan: one device (all ports, worst-case timeouts).
 * IPv6 stages: fixed overhead.
 */
export function estimateStageTime(
  stageType: StageType,
  config: Record<string, unknown>,
  portLists?: PortListSummary[],
): number {
  const fn = ESTIMATORS[stageType];
  if (!fn) return 0;
  return Math.round(fn(config, portLists) * 100) / 100;
}

/** Unit label describing what the per-job estimate measures. */
export function estimateUnit(stageType: StageType): string {
  if (stageType === 'port_scan') return '/ device';
  if (stageType.startsWith('ipv6_')) return 'fixed';
  return '/ IP';
}

/** Format seconds as a human-readable string (e.g., "2.5s", "1m 30s"). */
export function formatEstimate(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds * 10) / 10}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/**
 * Parse an IPv4 CIDR subnet string and return the number of usable host IPs.
 * Returns null if the string isn't valid IPv4 CIDR.
 */
export function parseSubnetIpCount(subnet: string): number | null {
  const m = subnet.trim().match(/^(\d{1,3}\.){3}\d{1,3}\/(\d+)$/);
  if (!m) return null;
  const prefix = parseInt(subnet.split('/')[1]);
  if (prefix < 0 || prefix > 32) return null;
  const total = Math.pow(2, 32 - prefix);
  return prefix >= 31 ? total : Math.max(0, total - 2);
}

/**
 * Estimate total scan time for an entire subnet.
 * Discovery stages: parallelised by t_cnt threads.
 * IPv6 stages: fixed overhead, not IP-count dependent — returns that fixed value.
 * Port scan: returns null (depends on device count, not IP count).
 */
export function estimateTotalForSubnet(
  stageType: StageType,
  config: Record<string, unknown>,
  ipCount: number,
  portLists?: PortListSummary[],
): number | null {
  if (stageType === 'port_scan') return null;
  const perUnit = estimateStageTime(stageType, config, portLists);
  if (stageType.startsWith('ipv6_')) return perUnit;
  const tCnt = (config.t_cnt as number) ?? 96;
  return Math.ceil(ipCount / Math.max(1, tCnt)) * perUnit;
}
