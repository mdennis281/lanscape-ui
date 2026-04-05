/**
 * Per-stage settings forms rendered inside an expanded StageCard.
 */

import type { PortListSummary } from '../../types';

// ── Shared types ─────────────────────────────────────────────────────

interface StageSettingsProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  portLists?: PortListSummary[];
}

function HelpTip({ text }: { text: string }) {
  return (
    <i
      className="fa-regular fa-circle-question help-tip"
      data-tooltip-id="tooltip"
      data-tooltip-content={text}
    />
  );
}

// ── Nested config helpers ────────────────────────────────────────────

function nested(config: Record<string, unknown>, key: string): Record<string, unknown> {
  return (config[key] as Record<string, unknown>) ?? {};
}

function setNested(
  config: Record<string, unknown>,
  key: string,
  field: string,
  value: unknown
): Record<string, unknown> {
  return { ...config, [key]: { ...nested(config, key), [field]: value } };
}

// ── Per-stage forms ──────────────────────────────────────────────────

function ThreadCountField({ config, onChange }: StageSettingsProps) {
  return (
    <div className="form-group">
      <label className="form-label">
        Threads <HelpTip text="Concurrent worker threads for this stage" />
      </label>
      <input
        type="number"
        className="form-input form-input-sm"
        min="1"
        max="512"
        value={(config.t_cnt as number) ?? ''}
        placeholder="auto"
        onChange={(e) => {
          const v = e.target.value;
          onChange({ ...config, t_cnt: v ? parseInt(v) || undefined : undefined });
        }}
      />
    </div>
  );
}

function HostnameFields({ config, onChange }: StageSettingsProps) {
  const hn = nested(config, 'hostname_config');
  return (
    <div className="stage-settings-group">
      <div className="stage-settings-group-title">Hostname Resolution</div>
      <div className="stage-settings-row">
        <div className="form-group">
          <label className="form-label">
            Retries <HelpTip text="Number of DNS lookup retries" />
          </label>
          <input
            type="number"
            className="form-input form-input-sm"
            min="0"
            max="10"
            value={(hn.retries as number) ?? ''}
            placeholder="1"
            onChange={(e) => {
              const v = e.target.value;
              onChange(setNested(config, 'hostname_config', 'retries', v ? parseInt(v) : undefined));
            }}
          />
        </div>
        <div className="form-group">
          <label className="form-label">
            Retry Delay <HelpTip text="Seconds between DNS retries" />
          </label>
          <input
            type="number"
            className="form-input form-input-sm"
            min="0"
            step="0.1"
            value={(hn.retry_delay as number) ?? ''}
            placeholder="1.5"
            onChange={(e) => {
              const v = e.target.value;
              onChange(setNested(config, 'hostname_config', 'retry_delay', v ? parseFloat(v) : undefined));
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── ICMP Discovery ───────────────────────────────────────────────────

function ICMPDiscoverySettings({ config, onChange }: StageSettingsProps) {
  const pc = nested(config, 'ping_config');
  return (
    <div className="stage-settings-body">
      <ThreadCountField config={config} onChange={onChange} />
      <div className="stage-settings-group">
        <div className="stage-settings-group-title">Ping Config</div>
        <div className="calc-row">
          <div className="calc-field">
            <label className="calc-label">
              Ping Count <HelpTip text="Number of ICMP echo packets sent per attempt" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="1" max="10"
              value={(pc.ping_count as number) ?? ''} placeholder="1"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'ping_config', 'ping_count', v ? parseInt(v) : undefined));
              }}
            />
          </div>
          <span className="calc-op">&times;</span>
          <div className="calc-field">
            <label className="calc-label">
              Attempts <HelpTip text="Number of times to retry if no response is received" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="1" max="10"
              value={(pc.attempts as number) ?? ''} placeholder="2"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'ping_config', 'attempts', v ? parseInt(v) : undefined));
              }}
            />
          </div>
          <span className="calc-op">=</span>
          <div className="calc-field">
            <label className="calc-label">Max / Device</label>
            <input
              type="number" className="form-input form-input-sm calc-result" disabled
              value={((pc.ping_count as number) ?? 1) * ((pc.attempts as number) ?? 2)}
            />
          </div>
        </div>
        <div className="stage-settings-row">
          <div className="form-group">
            <label className="form-label">
              Timeout (s) <HelpTip text="How long to wait for a ping response before considering it failed" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="0.1" step="0.1"
              value={(pc.timeout as number) ?? ''} placeholder="1.0"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'ping_config', 'timeout', v ? parseFloat(v) : undefined));
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Retry Delay (s) <HelpTip text="Time to wait between retry attempts" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="0" step="0.1"
              value={(pc.retry_delay as number) ?? ''} placeholder="0.25"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'ping_config', 'retry_delay', v ? parseFloat(v) : undefined));
              }}
            />
          </div>
        </div>
      </div>
      <HostnameFields config={config} onChange={onChange} />
    </div>
  );
}

// ── ARP Discovery ────────────────────────────────────────────────────

function ARPDiscoverySettings({ config, onChange }: StageSettingsProps) {
  const ac = nested(config, 'arp_config');
  return (
    <div className="stage-settings-body">
      <ThreadCountField config={config} onChange={onChange} />
      <div className="stage-settings-group">
        <div className="stage-settings-group-title">ARP Config</div>
        <div className="stage-settings-row">
          <div className="form-group">
            <label className="form-label">
              Attempts <HelpTip text="Number of ARP requests to send per device" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="1" max="10"
              value={(ac.attempts as number) ?? ''} placeholder="1"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'arp_config', 'attempts', v ? parseInt(v) : undefined));
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Timeout (s) <HelpTip text="How long to wait for an ARP response" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="0.1" step="0.1"
              value={(ac.timeout as number) ?? ''} placeholder="2.0"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'arp_config', 'timeout', v ? parseFloat(v) : undefined));
              }}
            />
          </div>
        </div>
      </div>
      <HostnameFields config={config} onChange={onChange} />
    </div>
  );
}

// ── Poke + ARP Discovery ────────────────────────────────────────────

function PokeARPDiscoverySettings({ config, onChange }: StageSettingsProps) {
  const pk = nested(config, 'poke_config');
  const ac = nested(config, 'arp_cache_config');
  return (
    <div className="stage-settings-body">
      <ThreadCountField config={config} onChange={onChange} />
      <div className="stage-settings-group">
        <div className="stage-settings-group-title">Poke Config</div>
        <div className="stage-settings-row">
          <div className="form-group">
            <label className="form-label">
              Attempts <HelpTip text="Number of TCP SYN poke attempts per device" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="1" max="10"
              value={(pk.attempts as number) ?? ''} placeholder="1"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'poke_config', 'attempts', v ? parseInt(v) : undefined));
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Timeout (s) <HelpTip text="How long to wait for a poke response" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="0.1" step="0.1"
              value={(pk.timeout as number) ?? ''} placeholder="2.0"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'poke_config', 'timeout', v ? parseFloat(v) : undefined));
              }}
            />
          </div>
        </div>
      </div>
      <div className="stage-settings-group">
        <div className="stage-settings-group-title">ARP Cache Config</div>
        <div className="stage-settings-row">
          <div className="form-group">
            <label className="form-label">
              Attempts <HelpTip text="Number of ARP cache lookups after poke" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="1" max="10"
              value={(ac.attempts as number) ?? ''} placeholder="1"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'arp_cache_config', 'attempts', v ? parseInt(v) : undefined));
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Wait Before (s) <HelpTip text="Time to wait before checking the ARP cache" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="0" step="0.1"
              value={(ac.wait_before as number) ?? ''} placeholder="0.2"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'arp_cache_config', 'wait_before', v ? parseFloat(v) : undefined));
              }}
            />
          </div>
        </div>
      </div>
      <HostnameFields config={config} onChange={onChange} />
    </div>
  );
}

// ── ICMP + ARP Discovery ─────────────────────────────────────────────

function ICMPARPDiscoverySettings({ config, onChange }: StageSettingsProps) {
  const pc = nested(config, 'ping_config');
  const ac = nested(config, 'arp_cache_config');
  return (
    <div className="stage-settings-body">
      <ThreadCountField config={config} onChange={onChange} />
      <div className="stage-settings-group">
        <div className="stage-settings-group-title">Ping Config</div>
        <div className="calc-row">
          <div className="calc-field">
            <label className="calc-label">
              Ping Count <HelpTip text="Number of ICMP echo packets sent per attempt" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="1" max="10"
              value={(pc.ping_count as number) ?? ''} placeholder="1"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'ping_config', 'ping_count', v ? parseInt(v) : undefined));
              }}
            />
          </div>
          <span className="calc-op">&times;</span>
          <div className="calc-field">
            <label className="calc-label">
              Attempts <HelpTip text="Number of times to retry if no response is received" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="1" max="10"
              value={(pc.attempts as number) ?? ''} placeholder="2"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'ping_config', 'attempts', v ? parseInt(v) : undefined));
              }}
            />
          </div>
          <span className="calc-op">=</span>
          <div className="calc-field">
            <label className="calc-label">Max / Device</label>
            <input
              type="number" className="form-input form-input-sm calc-result" disabled
              value={((pc.ping_count as number) ?? 1) * ((pc.attempts as number) ?? 2)}
            />
          </div>
        </div>
        <div className="stage-settings-row">
          <div className="form-group">
            <label className="form-label">
              Timeout (s) <HelpTip text="How long to wait for a ping response before considering it failed" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="0.1" step="0.1"
              value={(pc.timeout as number) ?? ''} placeholder="1.0"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'ping_config', 'timeout', v ? parseFloat(v) : undefined));
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Retry Delay (s) <HelpTip text="Time to wait between retry attempts" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="0" step="0.1"
              value={(pc.retry_delay as number) ?? ''} placeholder="0.25"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'ping_config', 'retry_delay', v ? parseFloat(v) : undefined));
              }}
            />
          </div>
        </div>
      </div>
      <div className="stage-settings-group">
        <div className="stage-settings-group-title">ARP Cache Config</div>
        <div className="stage-settings-row">
          <div className="form-group">
            <label className="form-label">
              Attempts <HelpTip text="Number of ARP cache lookups after ping" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="1" max="10"
              value={(ac.attempts as number) ?? ''} placeholder="1"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'arp_cache_config', 'attempts', v ? parseInt(v) : undefined));
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Wait Before (s) <HelpTip text="Time to wait before checking the ARP cache" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="0" step="0.1"
              value={(ac.wait_before as number) ?? ''} placeholder="0.2"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'arp_cache_config', 'wait_before', v ? parseFloat(v) : undefined));
              }}
            />
          </div>
        </div>
      </div>
      <HostnameFields config={config} onChange={onChange} />
    </div>
  );
}

// ── IPv6 NDP Discovery ───────────────────────────────────────────────

function IPv6NDPDiscoverySettings({ config, onChange }: StageSettingsProps) {
  const nt = nested(config, 'neighbor_table_config');
  return (
    <div className="stage-settings-body">
      <ThreadCountField config={config} onChange={onChange} />
      <div className="form-group">
        <label className="form-label">
          Interface <HelpTip text="Network interface to use (leave empty for auto-detect)" />
        </label>
        <input
          type="text" className="form-input form-input-sm"
          value={(config.interface as string) ?? ''}
          placeholder="auto"
          onChange={(e) => onChange({ ...config, interface: e.target.value || undefined })}
        />
      </div>
      <div className="stage-settings-group">
        <div className="stage-settings-group-title">Neighbor Table Config</div>
        <div className="stage-settings-row">
          <div className="form-group">
            <label className="form-label">
              Refresh Interval (s) <HelpTip text="How often to refresh the neighbor table during discovery" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="0.1" step="0.1"
              value={(nt.refresh_interval as number) ?? ''} placeholder="2.0"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'neighbor_table_config', 'refresh_interval', v ? parseFloat(v) : undefined));
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Command Timeout (s) <HelpTip text="How long to wait for NDP system commands to complete" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="1" step="0.5"
              value={(nt.command_timeout as number) ?? ''} placeholder="5.0"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'neighbor_table_config', 'command_timeout', v ? parseFloat(v) : undefined));
              }}
            />
          </div>
        </div>
      </div>
      <HostnameFields config={config} onChange={onChange} />
    </div>
  );
}

// ── IPv6 mDNS Discovery ──────────────────────────────────────────────

function IPv6MDNSDiscoverySettings({ config, onChange }: StageSettingsProps) {
  return (
    <div className="stage-settings-body">
      <div className="form-group">
        <label className="form-label">
          Timeout (s) <HelpTip text="How long to listen for mDNS responses" />
        </label>
        <input
          type="number" className="form-input form-input-sm" min="1" step="0.5"
          value={(config.timeout as number) ?? ''} placeholder="5.0"
          onChange={(e) => {
            const v = e.target.value;
            onChange({ ...config, timeout: v ? parseFloat(v) : undefined });
          }}
        />
      </div>
      <div className="form-group">
        <label className="form-label">
          Interface <HelpTip text="Network interface to use (leave empty for auto-detect)" />
        </label>
        <input
          type="text" className="form-input form-input-sm"
          value={(config.interface as string) ?? ''}
          placeholder="auto"
          onChange={(e) => onChange({ ...config, interface: e.target.value || undefined })}
        />
      </div>
      <HostnameFields config={config} onChange={onChange} />
    </div>
  );
}

// ── Port Scan ────────────────────────────────────────────────────────

const SERVICE_STRATEGIES = [
  { value: 'LAZY', label: 'Lazy — Few probes, fastest' },
  { value: 'BASIC', label: 'Basic — Common probes' },
  { value: 'AGGRESSIVE', label: 'Aggressive — All probes' },
];

function PortScanSettings({ config, onChange, portLists }: StageSettingsProps) {
  const psc = nested(config, 'port_scan_config');
  const ssc = nested(config, 'service_scan_config');
  const scanServices = (config.scan_services as boolean) ?? true;

  return (
    <div className="stage-settings-body">
      <div className="form-group">
        <label className="form-label">
          Port List <HelpTip text="Predefined list of ports to scan. Larger lists find more services but take longer." />
        </label>
        <select
          className="form-input form-input-sm"
          value={(config.port_list as string) ?? 'medium'}
          onChange={(e) => onChange({ ...config, port_list: e.target.value })}
        >
          {(portLists ?? []).map((pl) => (
            <option key={pl.name} value={pl.name}>
              {pl.name} ({pl.count} ports)
            </option>
          ))}
        </select>
      </div>
      <div className="calc-row">
        <div className="calc-field">
          <label className="calc-label">
            Device Threads <HelpTip text="Number of devices to scan ports on simultaneously" />
          </label>
          <input
            type="number" className="form-input form-input-sm" min="1" max="128"
            value={(config.t_cnt_device as number) ?? ''} placeholder="auto"
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...config, t_cnt_device: v ? parseInt(v) : undefined });
            }}
          />
        </div>
        <span className="calc-op">&times;</span>
        <div className="calc-field">
          <label className="calc-label">
            Port Threads <HelpTip text="Number of ports to test simultaneously per device" />
          </label>
          <input
            type="number" className="form-input form-input-sm" min="1" max="512"
            value={(config.t_cnt_port as number) ?? ''} placeholder="auto"
            onChange={(e) => {
              const v = e.target.value;
              onChange({ ...config, t_cnt_port: v ? parseInt(v) : undefined });
            }}
          />
        </div>
        <span className="calc-op">=</span>
        <div className="calc-field">
          <label className="calc-label">Total Threads</label>
          <input
            type="number" className="form-input form-input-sm calc-result" disabled
            value={((config.t_cnt_device as number) ?? 4) * ((config.t_cnt_port as number) ?? 16)}
          />
        </div>
      </div>
      <div className="stage-settings-group">
        <div className="stage-settings-group-title">Port Scan Config</div>
        <div className="stage-settings-row">
          <div className="form-group">
            <label className="form-label">
              Timeout (s) <HelpTip text="How long to wait for a port connection before considering it closed" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="0.1" step="0.1"
              value={(psc.timeout as number) ?? ''} placeholder="1.0"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'port_scan_config', 'timeout', v ? parseFloat(v) : undefined));
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Retries <HelpTip text="Number of times to retry a failed port connection" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="0" max="5"
              value={(psc.retries as number) ?? ''} placeholder="0"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'port_scan_config', 'retries', v ? parseInt(v) : undefined));
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Retry Delay (s) <HelpTip text="Time to wait between port scan retries" />
            </label>
            <input
              type="number" className="form-input form-input-sm" min="0" step="0.1"
              value={(psc.retry_delay as number) ?? ''} placeholder="0.1"
              onChange={(e) => {
                const v = e.target.value;
                onChange(setNested(config, 'port_scan_config', 'retry_delay', v ? parseFloat(v) : undefined));
              }}
            />
          </div>
        </div>
      </div>
      <div className="stage-settings-group">
        <div className="stage-settings-group-title">
          Service Scanning
          <label className="form-checkbox form-checkbox--inline">
            <input
              type="checkbox"
              checked={scanServices}
              onChange={(e) => onChange({ ...config, scan_services: e.target.checked })}
            />
            <span>Enabled</span>
          </label>
        </div>
        {scanServices && (
          <div className="stage-settings-row">
            <div className="form-group">
              <label className="form-label">
                Strategy <HelpTip text="LAZY: few probes, fastest. BASIC: common probes. AGGRESSIVE: all probes, most thorough." />
              </label>
              <select
                className="form-input form-input-sm"
                value={(ssc.lookup_type as string) ?? 'BASIC'}
                onChange={(e) => onChange(setNested(config, 'service_scan_config', 'lookup_type', e.target.value))}
              >
                {SERVICE_STRATEGIES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                Timeout (s) <HelpTip text="How long to wait for a service probe response" />
              </label>
              <input
                type="number" className="form-input form-input-sm" min="1" step="0.5"
                value={(ssc.timeout as number) ?? ''} placeholder="5.0"
                onChange={(e) => {
                  const v = e.target.value;
                  onChange(setNested(config, 'service_scan_config', 'timeout', v ? parseFloat(v) : undefined));
                }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Max Probes <HelpTip text="Maximum number of concurrent service identification probes" />
              </label>
              <input
                type="number" className="form-input form-input-sm" min="1" max="50"
                value={(ssc.max_concurrent_probes as number) ?? ''} placeholder="10"
                onChange={(e) => {
                  const v = e.target.value;
                  onChange(setNested(config, 'service_scan_config', 'max_concurrent_probes', v ? parseInt(v) : undefined));
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dispatcher ───────────────────────────────────────────────────────

import type { StageType } from '../../types';
import { getStageMeta } from './stageRegistry';
import type { PresetName } from './stageRegistry';

const PRESET_OPTIONS: { key: PresetName; label: string; icon: string }[] = [
  { key: 'fast', label: 'Fast', icon: 'fa-solid fa-rabbit-running' },
  { key: 'balanced', label: 'Balanced', icon: 'fa-solid fa-scale-balanced' },
  { key: 'accurate', label: 'Accurate', icon: 'fa-solid fa-bullseye' },
];

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a == null || b == null) return false;
  if (typeof a !== 'object') return false;
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
  for (const k of keys) {
    if (!deepEqual(aObj[k], bObj[k])) return false;
  }
  return true;
}

function detectActivePreset(
  config: Record<string, unknown>,
  presets: Record<PresetName, Record<string, unknown>>,
): PresetName | null {
  for (const name of PRESET_OPTIONS.map((p) => p.key)) {
    if (presets[name] && deepEqual(config, presets[name])) return name;
  }
  return null;
}

export function StageSettingsForm({
  stageType,
  config,
  onChange,
  portLists,
}: {
  stageType: StageType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  portLists?: PortListSummary[];
}) {
  const meta = getStageMeta(stageType);
  const hasPresets = meta.presets && Object.keys(meta.presets).length > 0;
  const activePreset = hasPresets ? detectActivePreset(config, meta.presets) : null;

  const formContent = (() => {
    switch (stageType) {
      case 'icmp_discovery':
        return <ICMPDiscoverySettings config={config} onChange={onChange} />;
      case 'arp_discovery':
        return <ARPDiscoverySettings config={config} onChange={onChange} />;
      case 'poke_arp_discovery':
        return <PokeARPDiscoverySettings config={config} onChange={onChange} />;
      case 'icmp_arp_discovery':
        return <ICMPARPDiscoverySettings config={config} onChange={onChange} />;
      case 'ipv6_ndp_discovery':
        return <IPv6NDPDiscoverySettings config={config} onChange={onChange} />;
      case 'ipv6_mdns_discovery':
        return <IPv6MDNSDiscoverySettings config={config} onChange={onChange} />;
      case 'port_scan':
        return <PortScanSettings config={config} onChange={onChange} portLists={portLists} />;
    }
  })();

  return (
    <>
      {hasPresets && (
        <div className="preset-selector">
          {PRESET_OPTIONS.map((p) => (
            <button
              key={p.key}
              className={`preset-btn${activePreset === p.key ? ' preset-btn--active' : ''}`}
              onClick={() => onChange({ ...meta.presets[p.key] })}
              data-tooltip-id="tooltip"
              data-tooltip-content={`Apply ${p.label} preset`}
            >
              <i className={p.icon} /> {p.label}
            </button>
          ))}
          {activePreset === null && (
            <span className="preset-custom-badge">Custom</span>
          )}
        </div>
      )}
      {formContent}
    </>
  );
}
