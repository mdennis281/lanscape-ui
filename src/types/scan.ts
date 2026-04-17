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

export interface NeighborTableConfig {
  refresh_interval?: number;
  command_timeout?: number;
}

export interface HostnameConfig {
  retries?: number;
  retry_delay?: number;
}

export type StageType =
  | 'icmp_discovery'
  | 'arp_discovery'
  | 'poke_arp_discovery'
  | 'icmp_arp_discovery'
  | 'ipv6_ndp_discovery'
  | 'ipv6_mdns_discovery'
  | 'port_scan';

export interface ICMPDiscoveryConfig {
  ping_config?: PingConfig;
  hostname_config?: HostnameConfig;
  t_cnt?: number;
}

export interface ARPDiscoveryConfig {
  arp_config?: ArpConfig;
  hostname_config?: HostnameConfig;
  t_cnt?: number;
}

export interface PokeARPDiscoveryConfig {
  poke_config?: PokeConfig;
  arp_cache_config?: ArpCacheConfig;
  hostname_config?: HostnameConfig;
  t_cnt?: number;
}

export interface ICMPARPDiscoveryConfig {
  ping_config?: PingConfig;
  arp_cache_config?: ArpCacheConfig;
  hostname_config?: HostnameConfig;
  t_cnt?: number;
}

export interface IPv6NDPDiscoveryConfig {
  neighbor_table_config?: NeighborTableConfig;
  hostname_config?: HostnameConfig;
  t_cnt?: number;
  interface?: string;
}

export interface IPv6MDNSDiscoveryConfig {
  timeout?: number;
  hostname_config?: HostnameConfig;
  interface?: string;
}

export interface PortScanStageConfig {
  port_list?: string;
  port_scan_config?: PortScanConfig;
  service_scan_config?: ServiceScanConfig;
  scan_services?: boolean;
  t_cnt_device?: number;
  t_cnt_port?: number;
}

export type AnyStageConfig =
  | ICMPDiscoveryConfig
  | ARPDiscoveryConfig
  | PokeARPDiscoveryConfig
  | ICMPARPDiscoveryConfig
  | IPv6NDPDiscoveryConfig
  | IPv6MDNSDiscoveryConfig
  | PortScanStageConfig;

export interface StageEntry {
  stage_type: StageType;
  config: Record<string, unknown>;
  auto?: boolean;
  reason?: string;
}

export interface ResilienceConfig {
  t_multiplier?: number;
  failure_retry_cnt?: number;
  failure_multiplier_decrease?: number;
  failure_debounce_sec?: number;
}

export interface PipelineConfig {
  subnet?: string;
  stages: StageEntry[];
  resilience?: ResilienceConfig;
  hostname_config?: HostnameConfig;
}

export interface StageProgress {
  stage_name: string;
  stage_type: StageType;
  total: number;
  completed: number;
  finished: boolean;
  runtime: number;
  counter_label: string;
}

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
  stages?: StageProgress[];
  current_stage_index?: number | null;
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
  ports_to_scan?: number;
  services?: Record<string, number[]>;
  service_info?: ServiceInfo[];
  caught_errors?: Array<string | { basic: string; traceback?: string }>;
}

// ── Scan history (context switching) ─────────────────────────────────

export interface ScanHistoryEntry {
  scan_id: string;
  subnet: string;
  running: boolean;
  stage: string;
  percent_complete: number;
  devices_alive: number;
  devices_total: number;
  runtime: number;
  stages?: StageProgress[];
}

// ── Network / tools ──────────────────────────────────────────────────

export interface SubnetInfo {
  subnet: string;
  interface?: string;
  description?: string;
}

export interface AutoStageRecommendation {
  stage_type: StageType;
  preset: string;
  config: Record<string, unknown>;
  reason: string;
}

export interface SubnetTestResult {
  valid: boolean;
  msg: string;
  count: number;
  error?: string;
  is_ipv6?: boolean;
  is_local?: boolean;
  matching_interface?: string | null;
}

// ── App info ─────────────────────────────────────────────────────────

export interface AppInfo {
  version: string;
  name: string;
  arp_supported?: boolean;
  update_available?: boolean;
  latest_version?: string;
  runtime_args?: Record<string, unknown>;
}
