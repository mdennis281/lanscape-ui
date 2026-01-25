import { Modal } from '../Modal';
import type { DeviceResult } from '../../types';

interface DeviceModalProps {
  device: DeviceResult | null;
  onClose: () => void;
}

export function DeviceModal({ device, onClose }: DeviceModalProps) {
  if (!device) return null;

  const ports = device.ports || [];
  const services = device.services || {};

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Device Details  IP: ${device.ip}`}
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="device-modal-content">
        {/* Overview Section */}
        <div className="device-section">
          <div className="device-section-title">Overview</div>
          <div className="device-info-grid">
            <div className="device-info-row">
              <span className="device-info-label">IP Address</span>
              <span className="device-info-value">{device.ip}</span>
            </div>
            <div className="device-info-row">
              <span className="device-info-label">Hostname</span>
              <span className="device-info-value">{device.hostname || '—'}</span>
            </div>
            <div className="device-info-row">
              <span className="device-info-label">MAC Address</span>
              <span className="device-info-value">{device.mac_addr || '—'}</span>
            </div>
            <div className="device-info-row">
              <span className="device-info-label">Manufacturer</span>
              <span className="device-info-value">{device.manufacturer || '—'}</span>
            </div>
            <div className="device-info-row">
              <span className="device-info-label">Stage</span>
              <span className="device-info-value">
                <span className={`status-badge ${device.stage === 'complete' ? 'success' : 'warning'}`}>
                  {device.stage || 'unknown'}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Open Ports Section */}
        {ports.length > 0 && (
          <div className="device-section">
            <div className="device-section-title">Open Ports</div>
            <div className="port-badges">
              {ports.map((port) => (
                <span className="port-badge" key={port}>
                  <i className="fa-solid fa-network-wired"></i> {port}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Services Section */}
        {Object.keys(services).length > 0 && (
          <div className="device-section">
            <div className="device-section-title">Services</div>
            <div className="services-list">
              {Object.entries(services).map(([serviceName, servicePorts]) => (
                <div className="service-item" key={serviceName}>
                  <span className="service-name">
                    <i className="fa-solid fa-server"></i> {serviceName}
                  </span>
                  <span className="service-ports">
                    {servicePorts.map((port) => (
                      <span className="port-badge small" key={port}>{port}</span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Errors Section */}
        {device.caught_errors && device.caught_errors.length > 0 && (
          <div className="device-section">
            <div className="device-section-title error">Errors</div>
            <div className="errors-list">
              {device.caught_errors.map((err, idx) => {
                // Handle both string format and object format
                const errorMessage = typeof err === 'string' ? err : err.basic;
                return (
                  <div className="error-item" key={idx}>
                    <i className="fa-solid fa-circle-exclamation"></i>
                    <span>{errorMessage}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No errors message */}
        {(!device.caught_errors || device.caught_errors.length === 0) && (
          <div className="device-section">
            <div className="device-section-title">Errors</div>
            <div className="no-errors">No errors captured.</div>
          </div>
        )}
      </div>
    </Modal>
  );
}
