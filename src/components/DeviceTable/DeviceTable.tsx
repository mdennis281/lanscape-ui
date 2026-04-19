import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useScanStore } from '../../store';
import { DeviceStage } from './DeviceStage';
import { ContextMenu, useContextMenu, getGlobalSection } from '../ContextMenu';
import { ExportModal } from '../ExportModal';
import type { ContextMenuSection } from '../ContextMenu';
import type { DeviceResult } from '../../types';

interface DeviceTableProps {
  onDeviceClick?: (device: DeviceResult) => void;
}

// ── CSV generation ───────────────────────────────────────────────────

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function devicesToCSV(devices: DeviceResult[]): string {
  const headers = ['IP', 'Hostname', 'MAC', 'Vendor', 'Ports'];
  const rows = devices.map((d) => [
    d.ip,
    d.hostname || '',
    d.mac_addr || '',
    d.manufacturer || '',
    (d.ports?.slice().sort((a, b) => a - b).join('; ')) || '',
  ].map(escapeCSV).join(','));
  return [headers.join(','), ...rows].join('\n');
}

// Simple animation delay calculator - just assigns stagger based on position in batch
const ANIMATION_DURATION = 500; // ms - how long before we remove the "new" class
const STAGGER_DELAY = 30; // ms between each row

// Convert IP address to numeric value for proper sorting
function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] || 0) << 24) + ((parts[1] || 0) << 16) + ((parts[2] || 0) << 8) + (parts[3] || 0);
}

export function DeviceTable({ onDeviceClick }: DeviceTableProps) {
  const devices = useScanStore((state) => state.devices);
  const scanStage = useScanStore((state) => state.status?.stage || '');
  const [filter, setFilter] = useState('');
  const [portsExpanded, setPortsExpanded] = useState(false);
  
  // Context menu
  const ctxMenu = useContextMenu();
  const ctxDeviceRef = useRef<DeviceResult | null>(null);

  // Export modal
  const [exportModal, setExportModal] = useState<{
    title: string;
    content: string;
    filename: string;
    language: 'json' | 'plaintext';
  } | null>(null);

  const openExport = useCallback((title: string, content: string, filename: string, language: 'json' | 'plaintext' = 'json') => {
    setExportModal({ title, content, filename, language });
  }, []);

  // ── Build context menu sections ──────────────────────────────────

  const getDeviceSections = useCallback((device: DeviceResult): ContextMenuSection[] => {
    const allIps = Array.from(new Set([
      device.ip,
      ...(device.ipv4_addresses || []),
      ...(device.ipv6_addresses || []),
    ]));

    return [
      {
        label: device.hostname || device.ip,
        items: [
          {
            label: 'View Details',
            icon: 'fa-solid fa-eye',
            onClick: () => onDeviceClick?.(device),
          },
          {
            label: 'Export',
            icon: 'fa-solid fa-file-export',
            items: [
              {
                label: 'JSON',
                icon: 'fa-solid fa-braces',
                onClick: () => openExport(
                  `Export — ${device.ip}`,
                  JSON.stringify(device, null, 2),
                  `${device.ip}.json`,
                ),
              },
            ],
          },
          {
            label: 'Copy',
            icon: 'fa-solid fa-copy',
            items: [
              {
                label: 'IP',
                onClick: () => { navigator.clipboard.writeText(device.ip); },
              },
              {
                label: 'MAC',
                disabled: !device.mac_addr,
                onClick: () => { if (device.mac_addr) navigator.clipboard.writeText(device.mac_addr); },
              },
              {
                label: 'IP list (CSV)',
                onClick: () => { navigator.clipboard.writeText(allIps.join(', ')); },
              },
            ],
          },
        ],
      },
    ];
  }, [onDeviceClick, openExport]);

  const getScanSections = useCallback((): ContextMenuSection[] => {
    return [
      {
        label: 'Scan',
        items: [
          {
            label: 'Export',
            icon: 'fa-solid fa-file-export',
            items: [
              {
                label: 'JSON',
                icon: 'fa-solid fa-braces',
                onClick: () => openExport(
                  'Export — Scan Results',
                  JSON.stringify(devices, null, 2),
                  'lanscape-scan.json',
                ),
              },
              {
                label: 'CSV',
                icon: 'fa-solid fa-file-csv',
                onClick: () => openExport(
                  'Export — Scan Results',
                  devicesToCSV(devices),
                  'lanscape-scan.csv',
                  'plaintext',
                ),
              },
            ],
          },
        ],
      },
    ];
  }, [devices, openExport]);

  const handleRowContextMenu = useCallback((e: React.MouseEvent, device: DeviceResult) => {
    ctxDeviceRef.current = device;
    ctxMenu.handleContextMenu(e, () => [
      ...getDeviceSections(device),
      ...getScanSections(),
      getGlobalSection(),
    ]);
  }, [ctxMenu, getDeviceSections, getScanSections]);

  const handleTableContextMenu = useCallback((e: React.MouseEvent) => {
    // Only fire if not on a device row (rows handle their own)
    const target = e.target as HTMLElement;
    if (target.closest('.device-row')) return;
    ctxMenu.handleContextMenu(e, () => [
      ...getScanSections(),
      getGlobalSection(),
    ]);
  }, [ctxMenu, getScanSections]);
  
  // Track which device IPs are "new" (recently added) with their animation delay
  const [newDevices, setNewDevices] = useState<Map<string, number>>(new Map());
  const seenDevicesRef = useRef<Set<string>>(new Set());
  const pendingNewRef = useRef<string[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Reset tracking when devices are cleared (new scan)
    if (devices.length === 0) {
      seenDevicesRef.current.clear();
      pendingNewRef.current = [];
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      return;
    }

    // Find devices we haven't seen yet
    for (const device of devices) {
      if (!seenDevicesRef.current.has(device.ip)) {
        seenDevicesRef.current.add(device.ip);
        pendingNewRef.current.push(device.ip);
      }
    }
    
    // Batch updates - wait a tick to collect all new devices from this render
    if (pendingNewRef.current.length > 0 && !flushTimerRef.current) {
      flushTimerRef.current = setTimeout(() => {
        const batch = pendingNewRef.current;
        pendingNewRef.current = [];
        flushTimerRef.current = null;
        
        // Add all new devices with staggered delays
        setNewDevices(prev => {
          const next = new Map(prev);
          batch.forEach((ip, index) => {
            next.set(ip, index * STAGGER_DELAY);
          });
          return next;
        });
        
        // Remove them after animation completes
        const maxDelay = batch.length * STAGGER_DELAY + ANIMATION_DURATION;
        setTimeout(() => {
          setNewDevices(prev => {
            const next = new Map(prev);
            batch.forEach(ip => next.delete(ip));
            return next;
          });
        }, maxDelay);
      }, 0);
    }
  }, [devices]);

  const filteredDevices = useMemo(() => {
    let result = devices;
    
    if (filter.trim()) {
      const searchTerm = filter.toLowerCase();
      result = devices.filter((device) => 
        device.ip.toLowerCase().includes(searchTerm) ||
        device.hostname?.toLowerCase().includes(searchTerm) ||
        device.mac_addr?.toLowerCase().includes(searchTerm) ||
        device.manufacturer?.toLowerCase().includes(searchTerm)
      );
    }
    
    // Sort by IP address (numeric by octets)
    return [...result].sort((a, b) => ipToNumber(a.ip) - ipToNumber(b.ip));
  }, [devices, filter]);

  return (
    <div className="table-container" onContextMenu={handleTableContextMenu}>
      <div className="table-header">
        <span className="table-title">
          <i className="fa-solid fa-desktop"></i> Discovered Devices ({devices.length})
        </span>
        <input
          type="text"
          className="table-filter"
          placeholder="Filter devices..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {filteredDevices.length === 0 ? (
        <div className="empty-state">
          <i className="fa-solid fa-satellite-dish"></i>
          <h3>No devices found</h3>
          <p>
            {devices.length === 0
              ? 'Enter a subnet and click Scan to discover devices on your network.'
              : 'No devices match your filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="table-scroll">
        <table className="device-table">
          <thead>
            <tr>
              <th>Stage</th>
              <th>IP Address</th>
              <th className="hostname-cell">Hostname</th>
              <th>MAC Address</th>
              <th className="vendor-cell">Vendor</th>
              <th className="ports-header">
                Ports
                <button 
                  className="ports-toggle-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPortsExpanded(!portsExpanded);
                  }}
                  data-tooltip-id="tooltip"
                  data-tooltip-content={portsExpanded ? 'Collapse ports' : 'Expand ports'}
                >
                  <i className={`fa-solid fa-${portsExpanded ? 'compress' : 'expand'}`}></i>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map((device) => {
              const delay = newDevices.get(device.ip);
              const isNew = delay !== undefined;
              const portsSorted = device.ports?.slice().sort((a, b) => a - b) || [];
              
              // Collect all IPs (excluding the primary one shown in the cell)
              const allIps = [
                ...(device.ipv4_addresses || []),
                ...(device.ipv6_addresses || [])
              ].filter(ip => ip !== device.ip);
              const hasExtraIps = allIps.length > 0;
              
              return (
                <tr 
                  key={device.ip} 
                  className={`device-row${isNew ? ' device-row-new' : ''}`}
                  style={isNew ? { animationDelay: `${delay}ms` } : undefined}
                  onClick={() => onDeviceClick?.(device)}
                  onContextMenu={(e) => handleRowContextMenu(e, device)}
                >
                  <td>
                    <DeviceStage device={device} />
                  </td>
                  <td 
                    className="ip-cell"
                    data-tooltip-id={hasExtraIps ? "tooltip" : undefined}
                    data-tooltip-content={hasExtraIps ? `Also: ${allIps.join(', ')}` : undefined}
                  >
                    {device.ip}
                    {hasExtraIps && (
                      <span className="ip-extra-badge" title={allIps.join(', ')}>
                        +{allIps.length}
                      </span>
                    )}
                  </td>
                  <td className="hostname-cell">{device.hostname || '—'}</td>
                  <td className="mac-cell">{device.mac_addr || '—'}</td>
                  <td className="vendor-cell">{device.manufacturer || '—'}</td>
                  <td className={portsExpanded ? 'ports-expanded' : ''}>
                    {/* Show dash only if no port scan has touched this device yet */}
                    {portsSorted.length === 0 &&
                     !scanStage.toLowerCase().includes('port') && 
                     !scanStage.toLowerCase().includes('service') && 
                     scanStage !== 'complete' && 
                     scanStage !== 'terminated' &&
                     !device.ports_to_scan ? (
                      <span className="ports-cell">—</span>
                    ) : portsSorted.length > 0 ? (
                      portsExpanded ? (
                        <span className="ports-list">{portsSorted.join(', ')}</span>
                      ) : (
                        <span 
                          className="text-primary ports-cell"
                          data-tooltip-id="tooltip"
                          data-tooltip-content={portsSorted.join(', ')}
                        >
                          {portsSorted.length} open
                        </span>
                      )
                    ) : (
                      <span 
                        className="ports-cell text-muted" 
                        style={{ opacity: 0.4 }}
                        data-tooltip-id="tooltip"
                        data-tooltip-content="No ports found"
                      >
                        <i className="fa-regular fa-empty-set"></i>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {ctxMenu.visible && (
        <ContextMenu sections={ctxMenu.sections} position={ctxMenu.position} onClose={ctxMenu.close} />
      )}

      {exportModal && (
        <ExportModal
          isOpen
          onClose={() => setExportModal(null)}
          title={exportModal.title}
          content={exportModal.content}
          filename={exportModal.filename}
          language={exportModal.language}
        />
      )}
    </div>
  );
}
