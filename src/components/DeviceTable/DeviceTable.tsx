import { useState, useMemo } from 'react';
import { useScanStore } from '../../store';
import { DeviceStage } from './DeviceStage';
import type { DeviceResult } from '../../types';

interface DeviceTableProps {
  onDeviceClick?: (device: DeviceResult) => void;
}

export function DeviceTable({ onDeviceClick }: DeviceTableProps) {
  const devices = useScanStore((state) => state.devices);
  const [filter, setFilter] = useState('');

  const filteredDevices = useMemo(() => {
    if (!filter.trim()) return devices;
    
    const searchTerm = filter.toLowerCase();
    return devices.filter((device) => 
      device.ip.toLowerCase().includes(searchTerm) ||
      device.hostname?.toLowerCase().includes(searchTerm) ||
      device.mac_addr?.toLowerCase().includes(searchTerm) ||
      device.manufacturer?.toLowerCase().includes(searchTerm)
    );
  }, [devices, filter]);

  return (
    <div className="table-container">
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
          <i className="fa-solid fa-radar"></i>
          <h3>No devices found</h3>
          <p>
            {devices.length === 0
              ? 'Enter a subnet and click Scan to discover devices on your network.'
              : 'No devices match your filter criteria.'}
          </p>
        </div>
      ) : (
        <table className="device-table">
          <thead>
            <tr>
              <th>Stage</th>
              <th>IP Address</th>
              <th className="hostname-cell">Hostname</th>
              <th>MAC Address</th>
              <th className="vendor-cell">Vendor</th>
              <th>Ports</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map((device) => (
              <tr 
                key={device.ip} 
                className="device-row"
                onClick={() => onDeviceClick?.(device)}
              >
                <td>
                  <DeviceStage device={device} />
                </td>
                <td className="ip-cell">{device.ip}</td>
                <td className="hostname-cell">{device.hostname || '—'}</td>
                <td className="mac-cell">{device.mac_addr || '—'}</td>
                <td className="vendor-cell">{device.manufacturer || '—'}</td>
                <td>
                  {device.ports && device.ports.length > 0 ? (
                    <span 
                      className="text-primary ports-cell"
                      data-tooltip-id="tooltip"
                      data-tooltip-content={device.ports.sort((a, b) => a - b).join(', ')}
                    >
                      {device.ports.length} open
                    </span>
                  ) : (
                    <span className="ports-cell">0 open</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
