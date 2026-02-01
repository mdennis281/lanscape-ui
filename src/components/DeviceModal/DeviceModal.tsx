import { useState, useRef } from 'react';
import { Modal } from '../Modal';
import type { DeviceResult, ServiceInfo } from '../../types';

interface DeviceModalProps {
  device: DeviceResult | null;
  onClose: () => void;
}

// Clickable port badge
function PortBadge({ 
  port, 
  hasResponse,
  isSelected, 
  onClick 
}: { 
  port: number; 
  hasResponse: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`port-badge clickable ${hasResponse ? 'has-response' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      title={hasResponse ? 'Click to view response' : 'No response captured'}
    >
      {port}
    </button>
  );
}

// Response panel that slides in/out
function ResponsePanel({ 
  serviceInfo, 
  isClosing,
  onAnimationEnd 
}: { 
  serviceInfo?: ServiceInfo;
  isClosing: boolean;
  onAnimationEnd: () => void;
}) {
  return (
    <div 
      className={`port-response-panel ${isClosing ? 'closing' : ''}`}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="port-response-header">
        <span className="port-label">Port {serviceInfo?.port}</span>
        <span className="probe-stats">
          {serviceInfo?.probes_sent ?? 0} probes sent / {serviceInfo?.probes_received ?? 0} received
        </span>
      </div>
      <div className="port-response-body">
        {/* Request Section */}
        <div className="probe-section">
          <div className="probe-section-label">Request</div>
          <pre className="probe-content request">
            {serviceInfo?.request || '(no request sent)'}
          </pre>
        </div>
        {/* Response Section */}
        <div className="probe-section">
          <div className="probe-section-label">Response</div>
          {serviceInfo?.response ? (
            <pre className="probe-content response">
              {serviceInfo.response}
            </pre>
          ) : (
            <div className="no-response-text">No response captured</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DeviceModal({ device, onClose }: DeviceModalProps) {
  // Single selected port across all services
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  // Track which port's panel is currently visible (for animation)
  const [visiblePort, setVisiblePort] = useState<number | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const pendingPortRef = useRef<number | null>(null);
  
  if (!device) return null;

  const ports = device.ports || [];
  const services = device.services || {};
  const serviceInfo = device.service_info || [];
  
  // Create a lookup map from port to service info
  const serviceInfoByPort = new Map<number, ServiceInfo>();
  serviceInfo.forEach(info => {
    serviceInfoByPort.set(info.port, info);
  });
  
  // Handle port toggle with animation
  const togglePort = (port: number) => {
    if (selectedPort === port) {
      // Closing the current port
      setIsClosing(true);
      setSelectedPort(null);
      pendingPortRef.current = null;
    } else if (visiblePort !== null) {
      // Switching to a different port - close first, then open
      setIsClosing(true);
      setSelectedPort(port);
      pendingPortRef.current = port;
    } else {
      // Opening a new port (nothing currently open)
      setSelectedPort(port);
      setVisiblePort(port);
    }
  };
  
  // Handle animation end
  const handleAnimationEnd = () => {
    if (isClosing) {
      setIsClosing(false);
      if (pendingPortRef.current !== null) {
        // Switch to the pending port
        setVisiblePort(pendingPortRef.current);
        pendingPortRef.current = null;
      } else {
        // Just closing
        setVisiblePort(null);
      }
    }
  };
  
  // Check if any port in a service group is selected
  const getVisiblePortInGroup = (servicePorts: number[]): number | null => {
    return servicePorts.find(p => p === visiblePort) ?? null;
  };
  
  // Check if group has a selection (for layout purposes)
  const groupHasSelection = (servicePorts: number[]): boolean => {
    return servicePorts.some(p => p === visiblePort || p === selectedPort);
  };

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

        {/* Consolidated Ports & Services Section */}
        {ports.length > 0 && (
          <div className="device-section">
            <div className="device-section-title">Ports &amp; Services</div>
            <div className="services-list">
              {Object.keys(services).length > 0 ? (
                // Group ports by service
                Object.entries(services).map(([serviceName, servicePorts]) => {
                  const visibleInGroup = getVisiblePortInGroup(servicePorts);
                  const hasSelection = groupHasSelection(servicePorts);
                  
                  return (
                    <div className={`service-group ${hasSelection ? 'has-selection' : ''}`} key={serviceName}>
                      <div className="service-group-header">
                        <i className="fa-solid fa-server"></i>
                        <span className="service-name">{serviceName}</span>
                      </div>
                      <div className="service-group-content">
                        <div className={`service-ports-list ${hasSelection ? 'vertical' : ''}`}>
                          {servicePorts.map((port) => (
                            <PortBadge
                              key={port}
                              port={port}
                              hasResponse={!!serviceInfoByPort.get(port)?.response}
                              isSelected={port === selectedPort}
                              onClick={() => togglePort(port)}
                            />
                          ))}
                        </div>
                        {visibleInGroup !== null && (
                          <ResponsePanel 
                            serviceInfo={serviceInfoByPort.get(visibleInGroup)} 
                            isClosing={isClosing}
                            onAnimationEnd={handleAnimationEnd}
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                // No services identified, just show ports
                (() => {
                  const hasSelection = (visiblePort !== null || selectedPort !== null) && 
                    ports.includes(visiblePort ?? selectedPort ?? -1);
                  return (
                    <div className={`service-group ${hasSelection ? 'has-selection' : ''}`}>
                      <div className="service-group-header">
                        <i className="fa-solid fa-network-wired"></i>
                        <span className="service-name">Open Ports</span>
                      </div>
                      <div className="service-group-content">
                        <div className={`service-ports-list ${hasSelection ? 'vertical' : ''}`}>
                          {ports.map((port) => (
                            <PortBadge
                              key={port}
                              port={port}
                              hasResponse={!!serviceInfoByPort.get(port)?.response}
                              isSelected={port === selectedPort}
                              onClick={() => togglePort(port)}
                            />
                          ))}
                        </div>
                        {visiblePort !== null && ports.includes(visiblePort) && (
                          <ResponsePanel 
                            serviceInfo={serviceInfoByPort.get(visiblePort)} 
                            isClosing={isClosing}
                            onAnimationEnd={handleAnimationEnd}
                          />
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
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
