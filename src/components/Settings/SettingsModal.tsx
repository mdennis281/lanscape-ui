import { useState, useEffect } from 'react';

import { Modal } from '../Modal';
import { useScanStore } from '../../store';
import type { ScanConfig, LookupType } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Preset = 'fast' | 'balanced' | 'accurate';

// Help icon component for tooltips
function HelpTip({ text }: { text: string }) {
  return (
    <i 
      className="fa-regular fa-circle-question help-tip"
      data-tooltip-id="tooltip"
      data-tooltip-content={text}
    />
  );
}

// Lookup type options with descriptions
const LOOKUP_TYPES: { value: LookupType; label: string; help: string }[] = [
  { 
    value: 'ICMP', 
    label: 'ICMP (Ping)',
    help: 'Send ICMP echo requests (ping) to detect if devices are online. Works on most networks but may be blocked by firewalls.'
  },
  { 
    value: 'ARP_LOOKUP', 
    label: 'ARP Lookup',
    help: 'Send ARP requests to discover devices. Most reliable for local networks but requires admin/root privileges. Also retrieves MAC addresses.'
  },
  { 
    value: 'ICMP_THEN_ARP', 
    label: 'ICMP then ARP Cache',
    help: 'Ping the device first, then check the local ARP cache for MAC address. Good balance of reliability and speed without requiring admin privileges.'
  },
  { 
    value: 'POKE_THEN_ARP', 
    label: 'Poke then ARP Cache',
    help: 'Send a TCP SYN packet to common ports to trigger an ARP entry, then read from ARP cache.'
  },
];

// Service scan strategies with descriptions
const SERVICE_STRATEGIES: { value: string; label: string; help: string }[] = [
  { 
    value: 'LAZY', 
    label: 'Lazy - Few probes, fastest',
    help: 'Tries only a few common service probes. Fastest but may miss some services.'
  },
  { 
    value: 'BASIC', 
    label: 'Basic - Common probes',
    help: 'Uses common probes plus port-specific probes based on well-known port assignments.'
  },
  { 
    value: 'AGGRESSIVE', 
    label: 'Aggressive - All probes',
    help: 'Tries all known probes in parallel. Most thorough but slowest and generates more traffic.'
  },
];

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const config = useScanStore((state) => state.config);
  const defaultConfigs = useScanStore((state) => state.defaultConfigs);
  const setConfig = useScanStore((state) => state.setConfig);
  const arpSupported = useScanStore((state) => state.appInfo?.arp_supported ?? true);
  const portLists = useScanStore((state) => state.portLists);
  
  const [localConfig, setLocalConfig] = useState<ScanConfig>({});
  const [activePreset, setActivePreset] = useState<Preset | null>(null);

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config, isOpen]);

  const handlePreset = (preset: Preset) => {
    if (defaultConfigs?.[preset]) {
      setLocalConfig({ ...defaultConfigs[preset] });
      setActivePreset(preset);
    }
  };

  const handleChange = <K extends keyof ScanConfig>(key: K, value: ScanConfig[K]) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
    setActivePreset(null);
  };

  // Helper for nested config updates
  const handleNestedChange = <
    K extends 'ping_config' | 'arp_config' | 'arp_cache_config' | 'poke_config' | 'port_scan_config' | 'service_scan_config'
  >(
    configKey: K,
    field: string,
    value: unknown
  ) => {
    setLocalConfig((prev) => ({
      ...prev,
      [configKey]: {
        ...(prev[configKey] || {}),
        [field]: value,
      },
    }));
    setActivePreset(null);
  };

  const handleLookupTypeToggle = (type: LookupType) => {
    const current = localConfig.lookup_type || [];
    const newTypes = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    handleChange('lookup_type', newTypes.length > 0 ? newTypes : ['ICMP_THEN_ARP']);
  };

  const handleSave = () => {
    setConfig(localConfig as ScanConfig);
    onClose();
  };

  const handleReset = () => {
    if (defaultConfigs?.balanced) {
      setLocalConfig({ ...defaultConfigs.balanced });
      setActivePreset('balanced');
    }
  };

  // Compute total thread counts for display
  const totalPortTests = (localConfig.t_cnt_port_scan || 4) * (localConfig.t_cnt_port_test || 16);
  const totalPingAttempts = (localConfig.ping_config?.attempts || 2) * (localConfig.ping_config?.ping_count || 1);

  // Check if specific lookup types are selected to show/hide relevant sections
  const lookupTypes = localConfig.lookup_type || [];
  const showPingSection = lookupTypes.some(t => t === 'ICMP' || t === 'ICMP_THEN_ARP');
  const showArpSection = lookupTypes.some(t => t === 'ARP_LOOKUP');
  const showArpCacheSection = lookupTypes.some(t => t === 'ICMP_THEN_ARP' || t === 'POKE_THEN_ARP');
  const showPokeSection = lookupTypes.some(t => t === 'POKE_THEN_ARP');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Scan Settings"
      size="large"
      footer={
        <>
          <button className="btn btn-secondary" onClick={handleReset}>
            Reset
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </>
      }
    >
      {/* Presets */}
      <div className="settings-section">
        <div className="settings-section-title">Presets</div>
        <div className="settings-preset-buttons">
          <button
            className={`preset-btn ${activePreset === 'fast' ? 'active' : ''}`}
            onClick={() => handlePreset('fast')}
          >
            <span className="preset-btn-label">
              <i className="fa-solid fa-bolt"></i> Fast
            </span>
            <span className="preset-btn-desc">Quick scan, low accuracy</span>
          </button>
          <button
            className={`preset-btn ${activePreset === 'balanced' ? 'active' : ''}`}
            onClick={() => handlePreset('balanced')}
          >
            <span className="preset-btn-label">
              <i className="fa-solid fa-scale-balanced"></i> Balanced
            </span>
            <span className="preset-btn-desc">Good balance of speed & accuracy</span>
          </button>
          <button
            className={`preset-btn ${activePreset === 'accurate' ? 'active' : ''}`}
            onClick={() => handlePreset('accurate')}
          >
            <span className="preset-btn-label">
              <i className="fa-solid fa-bullseye"></i> Accurate
            </span>
            <span className="preset-btn-desc">Thorough scan, slower</span>
          </button>
        </div>
      </div>

      {/* Device Detection */}
      <div className="settings-section">
        <div className="settings-section-title">
          Device Detection
          <HelpTip text="Configure how LANscape discovers devices on your network. Multiple methods can be selected - they run in order until a device is found." />
        </div>
        
        <div className="form-group">
          <label className="form-label">
            Lookup Type
            <HelpTip text="Methods used to detect if a device is online. Select one or more - they will be tried in order." />
          </label>
          <div className="checkbox-group">
            {LOOKUP_TYPES.map((type) => {
              const isArpType = type.value === 'ARP_LOOKUP';
              const disabled = isArpType && !arpSupported;
              
              return (
                <label 
                  key={type.value} 
                  className={`form-checkbox ${disabled ? 'disabled' : ''}`}
                  data-tooltip-id="tooltip"
                  data-tooltip-content={disabled ? 'ARP lookup not supported on this system (requires admin/root)' : type.help}
                  data-tooltip-place="right"
                >
                  <input
                    type="checkbox"
                    checked={lookupTypes.includes(type.value)}
                    onChange={() => handleLookupTypeToggle(type.value)}
                    disabled={disabled}
                  />
                  <span>{type.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            Device Lookup Threads
            <HelpTip text="Number of concurrent threads for device discovery. Higher values scan faster but use more system resources and network bandwidth." />
          </label>
          <input
            type="number"
            className="form-input form-input-sm"
            min="1"
            max="512"
            value={localConfig.t_cnt_isalive || 24}
            onChange={(e) => handleChange('t_cnt_isalive', parseInt(e.target.value) || 24)}
          />
        </div>
      </div>

      {/* Ping Settings - shown when ICMP types selected */}
      {showPingSection && (
        <div className="settings-section settings-subsection">
          <div className="settings-section-title">
            Device Detection <span className="text-muted">/</span> Ping Settings
            <HelpTip text="Configure ICMP ping behavior for device discovery. More attempts increase reliability but slow down scanning." />
          </div>
          <div className="form-group">
            <label className="form-label">
              Ping Count / Device
              <HelpTip text="Total pings = Ping Count × Retries. More pings are more reliable but slower." />
            </label>
            <div className="calc-row">
              <div className="calc-field">
                <span className="calc-label">Ping Request Count</span>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  max="10"
                  value={localConfig.ping_config?.ping_count || 1}
                  onChange={(e) => handleNestedChange('ping_config', 'ping_count', parseInt(e.target.value) || 1)}
                  data-tooltip-id="tooltip"
                  data-tooltip-content="Number of ICMP packets sent per attempt"
                />
              </div>
              <span className="calc-op">×</span>
              <div className="calc-field">
                <span className="calc-label">Retries</span>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  max="10"
                  value={localConfig.ping_config?.attempts || 2}
                  onChange={(e) => handleNestedChange('ping_config', 'attempts', parseInt(e.target.value) || 2)}
                  data-tooltip-id="tooltip"
                  data-tooltip-content="Number of times to retry if no response"
                />
              </div>
              <span className="calc-op">=</span>
              <div className="calc-field">
                <span className="calc-label">Max / Device</span>
                <input
                  type="number"
                  className="form-input calc-result"
                  value={totalPingAttempts}
                  disabled
                  data-tooltip-id="tooltip"
                  data-tooltip-content="Maximum total pings per device"
                />
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Timeout (sec)
                <HelpTip text="How long to wait for a ping response before considering it failed." />
              </label>
              <input
                type="number"
                className="form-input"
                min="0.1"
                max="10"
                step="0.1"
                value={localConfig.ping_config?.timeout || 1}
                onChange={(e) => handleNestedChange('ping_config', 'timeout', parseFloat(e.target.value) || 1)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Retry Delay (sec)
                <HelpTip text="Time to wait between retry attempts. Allows network congestion to clear." />
              </label>
              <input
                type="number"
                className="form-input"
                min="0"
                max="5"
                step="0.1"
                value={localConfig.ping_config?.retry_delay || 0.25}
                onChange={(e) => handleNestedChange('ping_config', 'retry_delay', parseFloat(e.target.value) || 0.25)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ARP Settings - shown when ARP_LOOKUP selected */}
      {showArpSection && (
        <div className="settings-section settings-subsection">
          <div className="settings-section-title">
            Device Detection <span className="text-muted">/</span> ARP Settings
            <HelpTip text="Configure ARP (Address Resolution Protocol) scanning. ARP is very reliable on local networks and also retrieves MAC addresses." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Attempts
                <HelpTip text="Number of ARP requests to send per device. More attempts are more reliable on congested networks." />
              </label>
              <input
                type="number"
                className="form-input"
                min="1"
                max="10"
                value={localConfig.arp_config?.attempts || 1}
                onChange={(e) => handleNestedChange('arp_config', 'attempts', parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Timeout (sec)
                <HelpTip text="How long to wait for an ARP response. Local network responses are usually under 100ms." />
              </label>
              <input
                type="number"
                className="form-input"
                min="0.1"
                max="10"
                step="0.1"
                value={localConfig.arp_config?.timeout || 2}
                onChange={(e) => handleNestedChange('arp_config', 'timeout', parseFloat(e.target.value) || 2)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ARP Cache Settings - shown when _THEN_ARP types selected */}
      {showArpCacheSection && (
        <div className="settings-section settings-subsection">
          <div className="settings-section-title">
            Device Detection <span className="text-muted">/</span> ARP Cache Settings
            <HelpTip text="Configure how the system reads from the local ARP cache. After pinging or poking a device, its MAC address appears in the cache." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Attempts
                <HelpTip text="Number of times to check the ARP cache. The entry may take a moment to appear." />
              </label>
              <input
                type="number"
                className="form-input"
                min="1"
                max="10"
                value={localConfig.arp_cache_config?.attempts || 1}
                onChange={(e) => handleNestedChange('arp_cache_config', 'attempts', parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Wait Before (sec)
                <HelpTip text="Time to wait before checking the cache. Gives the ARP entry time to be created after the initial probe." />
              </label>
              <input
                type="number"
                className="form-input"
                min="0"
                max="5"
                step="0.1"
                value={localConfig.arp_cache_config?.wait_before || 0.2}
                onChange={(e) => handleNestedChange('arp_cache_config', 'wait_before', parseFloat(e.target.value) || 0.2)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Poke Settings - shown when POKE_THEN_ARP selected */}
      {showPokeSection && (
        <div className="settings-section settings-subsection">
          <div className="settings-section-title">
            Device Detection <span className="text-muted">/</span> Poke Settings
            <HelpTip text="Configure TCP 'poke' behavior. A poke sends TCP SYN packets to common ports to trigger an ARP cache entry, useful when ICMP ping is blocked." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Attempts
                <HelpTip text="Number of poke attempts per device. Each attempt tries multiple common ports." />
              </label>
              <input
                type="number"
                className="form-input"
                min="1"
                max="10"
                value={localConfig.poke_config?.attempts || 1}
                onChange={(e) => handleNestedChange('poke_config', 'attempts', parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Timeout (sec)
                <HelpTip text="How long to wait for TCP connection attempts. Doesn't need a successful connection - just needs to trigger ARP." />
              </label>
              <input
                type="number"
                className="form-input"
                min="0.1"
                max="10"
                step="0.1"
                value={localConfig.poke_config?.timeout || 2}
                onChange={(e) => handleNestedChange('poke_config', 'timeout', parseFloat(e.target.value) || 2)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Port Testing */}
      <div className="settings-section">
        <div className="settings-section-title">
          Port Testing
          <HelpTip text="Configure how ports are scanned on discovered devices. Port scanning checks which network services are available on each device." />
        </div>
        
        <div className="form-group">
          <label className="form-label">
            Concurrent Threads
            <HelpTip text="Total concurrent port tests = Device Threads × Port Threads. Higher values scan faster but use more resources." />
          </label>
          <div className="calc-row">
            <div className="calc-field">
              <span className="calc-label">Device Threads</span>
              <input
                type="number"
                className="form-input"
                min="1"
                max="100"
                value={localConfig.t_cnt_port_scan || 4}
                onChange={(e) => handleChange('t_cnt_port_scan', parseInt(e.target.value) || 4)}
                data-tooltip-id="tooltip"
                data-tooltip-content="Number of devices to scan ports on simultaneously"
              />
            </div>
            <span className="calc-op">×</span>
            <div className="calc-field">
              <span className="calc-label">Port Threads</span>
              <input
                type="number"
                className="form-input"
                min="1"
                max="256"
                value={localConfig.t_cnt_port_test || 16}
                onChange={(e) => handleChange('t_cnt_port_test', parseInt(e.target.value) || 16)}
                data-tooltip-id="tooltip"
                data-tooltip-content="Number of ports to test simultaneously per device"
              />
            </div>
            <span className="calc-op">=</span>
            <div className="calc-field">
              <span className="calc-label">Total</span>
              <input
                type="number"
                className="form-input calc-result"
                value={totalPortTests}
                disabled
                data-tooltip-id="tooltip"
                data-tooltip-content="Total concurrent port connection attempts across all devices"
              />
            </div>
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">
            Port List
            <HelpTip text="Predefined list of ports to scan. Larger lists find more services but take longer to scan." />
          </label>
          <select
            className="form-input form-select"
            value={localConfig.port_list || 'medium'}
            onChange={(e) => handleChange('port_list', e.target.value)}
          >
            {portLists.map((pl) => (
              <option key={pl.name} value={pl.name}>
                {pl.name} ({pl.count.toLocaleString()} ports)
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              Port Timeout (sec)
              <HelpTip text="How long to wait for a port connection. Lower values are faster but may miss slow-responding services." />
            </label>
            <input
              type="number"
              className="form-input"
              min="0.1"
              max="10"
              step="0.1"
              value={localConfig.port_scan_config?.timeout || 1}
              onChange={(e) => handleNestedChange('port_scan_config', 'timeout', parseFloat(e.target.value) || 1)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Retries
              <HelpTip text="Number of times to retry a failed port connection. Useful on unreliable networks." />
            </label>
            <input
              type="number"
              className="form-input"
              min="0"
              max="5"
              value={localConfig.port_scan_config?.retries || 0}
              onChange={(e) => handleNestedChange('port_scan_config', 'retries', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Retry Delay (sec)
              <HelpTip text="Time to wait between port retry attempts." />
            </label>
            <input
              type="number"
              className="form-input"
              min="0"
              max="5"
              step="0.1"
              value={localConfig.port_scan_config?.retry_delay || 0.1}
              onChange={(e) => handleNestedChange('port_scan_config', 'retry_delay', parseFloat(e.target.value) || 0.1)}
            />
          </div>
        </div>
      </div>

      {/* Service Scanning - shown when task_scan_port_services enabled */}
      {localConfig.task_scan_port_services && (
        <div className="settings-section settings-subsection">
          <div className="settings-section-title">
            Service Scanning
            <HelpTip text="After finding open ports, service scanning sends protocol-specific probes to identify what service is running (e.g., HTTP, SSH, MySQL)." />
          </div>
          <div className="form-group">
            <label className="form-label">
              Strategy
              <HelpTip text="Controls how many probes are sent to identify services. More probes = better identification but slower scanning." />
            </label>
            <select
              className="form-input form-select"
              value={localConfig.service_scan_config?.lookup_type || 'BASIC'}
              onChange={(e) => handleNestedChange('service_scan_config', 'lookup_type', e.target.value)}
            >
              {SERVICE_STRATEGIES.map((s) => (
                <option 
                  key={s.value} 
                  value={s.value}
                  title={s.help}
                >
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Timeout (sec)
                <HelpTip text="How long to wait for a service to respond to a probe. Some services may be slow to respond." />
              </label>
              <input
                type="number"
                className="form-input"
                min="0.5"
                max="30"
                step="0.5"
                value={localConfig.service_scan_config?.timeout || 5}
                onChange={(e) => handleNestedChange('service_scan_config', 'timeout', parseFloat(e.target.value) || 5)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Max Concurrent Probes
                <HelpTip text="Maximum number of service probes to run in parallel per port. Higher values are faster but may overwhelm some services." />
              </label>
              <input
                type="number"
                className="form-input"
                min="1"
                max="50"
                value={localConfig.service_scan_config?.max_concurrent_probes || 10}
                onChange={(e) => handleNestedChange('service_scan_config', 'max_concurrent_probes', parseInt(e.target.value) || 10)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Stages (Task Toggles) */}
      <div className="settings-section">
        <div className="settings-section-title">
          Stages
          <HelpTip text="Control which detection stages run during a scan. Each stage adds more information but increases scan time." />
        </div>
        <label className="form-checkbox disabled">
          <input type="checkbox" checked disabled />
          <span>Find Devices</span>
          <HelpTip text="Discover devices on the network using Ping, ARP, ARP Cache, and Poke methods. Always enabled as the core discovery stage." />
        </label>
        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={localConfig.task_scan_ports ?? true}
            onChange={(e) => handleChange('task_scan_ports', e.target.checked)}
          />
          <span>Scan Ports</span>
          <HelpTip text="Test common ports on discovered devices to find open services. Uses the ports configured in Port Testing section." />
        </label>
        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={localConfig.task_scan_port_services ?? true}
            onChange={(e) => handleChange('task_scan_port_services', e.target.checked)}
            disabled={!localConfig.task_scan_ports}
          />
          <span>Scan Port Services</span>
          <HelpTip text="Identify what service is running on open ports (HTTP, SSH, MySQL, etc). Requires Scan Ports to be enabled." />
        </label>
      </div>
    </Modal>
  );
}
