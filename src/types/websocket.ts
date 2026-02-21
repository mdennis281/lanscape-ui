/**
 * WebSocket Protocol Types - matching lanscape/ui/ws/protocol.py
 * 
 * The protocol uses a simple format:
 * - action: string like "scan.start", "tools.subnet_list"
 * - params: optional dict of parameters
 * - id: optional message ID for correlation
 */

export type MessageType = 
  | 'request'
  | 'response'
  | 'error'
  | 'event';

/**
 * Available actions grouped by handler
 */
export type ScanAction =
  | 'scan.start'
  | 'scan.start_sync'
  | 'scan.get'
  | 'scan.get_delta'
  | 'scan.get_port_detail'
  | 'scan.summary'
  | 'scan.terminate'
  | 'scan.subscribe'
  | 'scan.unsubscribe'
  | 'scan.list';

export type PortAction =
  | 'port.list'
  | 'port.list_summary'
  | 'port.get'
  | 'port.create'
  | 'port.update'
  | 'port.delete';

export type ToolsAction =
  | 'tools.subnet_test'
  | 'tools.subnet_list'
  | 'tools.config_defaults'
  | 'tools.arp_supported'
  | 'tools.app_info';

export type WSAction = ScanAction | PortAction | ToolsAction;

/**
 * WebSocket Request - sent from client to server
 */
export interface WSRequest {
  type: 'request';
  action: string;
  params?: Record<string, unknown>;
  id?: string;
}

/**
 * WebSocket Response - sent from server to client
 */
export interface WSResponse {
  type: 'response';
  action: string;
  data?: unknown;
  success: boolean;
  id?: string;
}

/**
 * WebSocket Error - sent from server when an error occurs
 */
export interface WSError {
  type: 'error';
  action?: string;
  error: string;
  traceback?: string;
  id?: string;
}

/**
 * WebSocket Event - server-initiated push notification
 */
export interface WSEvent {
  type: 'event';
  event: string;
  data?: unknown;
}

export type WSMessage = WSRequest | WSResponse | WSError | WSEvent;

// Scan-specific types

// Nested config types matching backend Pydantic models
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

// Lookup types enum values
export type LookupType = 'ICMP' | 'ARP_LOOKUP' | 'POKE_THEN_ARP' | 'ICMP_THEN_ARP';

// Port list summary from port.list_summary
export interface PortListSummary {
  name: string;
  count: number;
}

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

// Scan-level error info from ScanErrorInfo model
export interface ScanErrorInfo {
  basic: string;
  traceback?: string;
}

// Scan-level warning info for resource constraints
export interface ScanWarningInfo {
  type: string;
  message: string;
  old_multiplier?: number;
  new_multiplier?: number;
  decrease_percent?: number;
  timestamp?: number;
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

// Scan metadata from the new Pydantic model structure
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
  start_time: number;
  end_time?: number;
  run_time: number;
  errors: ScanErrorInfo[];
  warnings?: ScanWarningInfo[];
}

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
  ports?: number[];
  stage?: string;
  ports_scanned?: number;
  services?: Record<string, number[]>;
  service_info?: ServiceInfo[];
  // caught_errors can be plain strings or objects with basic/traceback
  caught_errors?: Array<string | { basic: string; traceback?: string }>;
}

export interface PortResult {
  port: number;
  service?: string;
  state: 'open' | 'closed' | 'filtered';
}

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

// App info type
export interface AppInfo {
  version: string;
  name: string;
  arp_supported: boolean;
  update_available?: boolean;
  latest_version?: string;
  runtime_args?: Record<string, unknown>;
}

// Default configs type from tools.config_defaults
export type DefaultConfigs = Record<string, ScanConfig>;

// Scan status for legacy compatibility
export interface ScanStatus {
  scan_id?: string;
  is_running: boolean;
  stage: string;
  progress: number;
  total_hosts: number;
  scanned_hosts: number;
  found_hosts: number;
  runtime: number;
  remaining: number;
}
