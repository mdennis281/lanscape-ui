/**
 * Domain types for scan configuration, results, and backend metadata.
 */

// ── Config sub-types (matching backend Pydantic models) ──────────────

export interface PingConfig {
  attempts?: number;
  ping_count?: number;
  timeout?: number;
  retry_delay?: number;
}

export interface ArpConfig {
  attempts?: number;
  timeout?: number;
}

export interface ArpCacheConfig {
  attempts?: number;
  wait_before?: number;
}

export interface PokeConfig {
  attempts?: number;
  timeout?: number;
}

export interface PortScanConfig {
  timeout?: number;
  retries?: number;
  retry_delay?: number;
}

export interface ServiceScanConfig {
  timeout?: number;
  lookup_type?: 'LAZY' | 'BASIC' | 'AGGRESSIVE';
  max_concurrent_probes?: number;
}

export type LookupType = 'ICMP' | 'ARP_LOOKUP' | 'POKE_THEN_ARP' | 'ICMP_THEN_ARP';

// ── Scan configuration ───────────────────────────────────────────────

export interface ScanConfig {
  subnet?: string;
  port_list?: string;
  t_multiplier?: number;
  t_cnt_port_scan?: number;
  t_cnt_port_test?: number;
  t_cnt_isalive?: number;

  task_scan_ports?: boolean;
  task_scan_port_services?: boolean;

  lookup_type?: LookupType[];

  ping_config?: PingConfig;
  arp_config?: ArpConfig;
  arp_cache_config?: ArpCacheConfig;
  poke_config?: PokeConfig;
  port_scan_config?: PortScanConfig;
  service_scan_config?: ServiceScanConfig;
}

/** Default configs keyed by preset name (e.g. "fast", "balanced", "accurate"). */
export type DefaultConfigs = Record<string, ScanConfig>;

// ── Port lists ───────────────────────────────────────────────────────

export interface PortListSummary {
  name: string;
  count: number;
}

// ── Scan status & errors ─────────────────────────────────────────────

export interface ScanStatus {
  scan_id?: string;
  is_running: boolean;
  stage: string;
  progress: number;
  total_hosts: number;
  scanned_hosts: number;
  found_hosts: number;
  ports_scanned: number;
  ports_total: number;
  runtime: number;
  remaining: number;
}

export interface ScanErrorInfo {
  basic: string;
  traceback?: string;
}

export interface ScanWarningInfo {
  type: string;
  message: string;
  old_multiplier?: number;
  new_multiplier?: number;
  decrease_percent?: number;
  timestamp?: number;
  failed_job?: string;
  error_message?: string;
  stage?: string;
  retry_attempt?: number;
  max_retries?: number;
}

export interface ScanSummary {
  scan_id: string;
  running: boolean;
  stage: string;
  percent_complete: number;
  runtime: number;
  devices: {
    total: number;
    scanned: number;
    alive: number;
  };
}

export interface ScanMetadata {
  scan_id: string;
  subnet: string;
  port_list: string;
  running: boolean;
  stage: string;
  percent_complete: number;
  devices_total: number;
  devices_scanned: number;
  devices_alive: number;
  port_list_length: number;
  ports_scanned: number;
  ports_total: number;
  start_time: number;
  end_time?: number;
  run_time: number;
  errors: ScanErrorInfo[];
  warnings?: ScanWarningInfo[];
}

// ── Device results ───────────────────────────────────────────────────

export interface ServiceInfo {
  port: number;
  service: string;
  probes_sent?: number;
  probes_received?: number;
  is_tls?: boolean;
}

export interface ServiceResponseGroup {
  response: string | null;
  service: string;
  probes: string[];
  is_tls: boolean;
}

export interface PortServiceDetail {
  port: number;
  service: string;
  probes_sent: number;
  probes_received: number;
  is_tls: boolean;
  responses: ServiceResponseGroup[];
}

export interface DeviceResult {
  ip: string;
  alive?: boolean;
  hostname?: string;
  macs?: string[];
  mac_addr?: string;
  manufacturer?: string;
  ipv4_addresses?: string[];
  ipv6_addresses?: string[];
  ports?: number[];
  stage?: string;
  ports_scanned?: number;
  services?: Record<string, number[]>;
  service_info?: ServiceInfo[];
  caught_errors?: Array<string | { basic: string; traceback?: string }>;
}

// ── Network / tools ──────────────────────────────────────────────────

export interface SubnetInfo {
  subnet: string;
  interface?: string;
  description?: string;
}

export interface SubnetTestResult {
  valid: boolean;
  msg: string;
  count: number;
  error?: string;
}

// ── App info ─────────────────────────────────────────────────────────

export interface AppInfo {
  version: string;
  name: string;
  arp_supported: boolean;
  update_available?: boolean;
  latest_version?: string;
  runtime_args?: Record<string, unknown>;
}
