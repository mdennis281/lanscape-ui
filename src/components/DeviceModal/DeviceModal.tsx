import { useState, useRef, useMemo } from 'react';
import { Modal } from '../Modal';
import type { DeviceResult, PortServiceDetail, ServiceResponseGroup } from '../../types';
import { getWebSocketService } from '../../services/websocket';
import { useScanStore } from '../../store/scanStore';

interface DeviceModalProps {
  device: DeviceResult | null;
  onClose: () => void;
}

// Clickable port badge
function PortBadge({ 
  port, 
  hasServiceInfo,
  isSelected,
  isLoading,
  onClick 
}: { 
  port: number; 
  hasServiceInfo: boolean;
  isSelected: boolean;
  isLoading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`port-badge clickable ${hasServiceInfo ? 'has-response' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      title={hasServiceInfo ? 'Click to view service detail' : 'No service info available'}
      disabled={isLoading}
    >
      {isLoading && isSelected ? <i className="fa-solid fa-spinner fa-spin" /> : port}
    </button>
  );
}

// Detail view for one response and the probe that triggered it
function ResponseDetail({ group }: { group: ServiceResponseGroup }) {
  return (
    <div className="response-detail">
      {group.probes.length > 0 && (
        <div className="response-detail-probes">
          <div className="probe-section-label">Probe Sent</div>
          <div className="probe-list">
            {group.probes.map((probe, i) => (
              <pre className="probe-content request" key={i}>{probe}</pre>
            ))}
          </div>
        </div>
      )}
      <div className="response-detail-content">
        <div className="probe-section-label">Response Received</div>
        {group.response ? (
          <pre className="probe-content response">{group.response}</pre>
        ) : (
          <div className="no-response-text">No response received</div>
        )}
      </div>
    </div>
  );
}

// Response panel with prev/next navigation for switching between responses
function ResponsePanel({ 
  portDetail,
  isLoading,
  error,
  isClosing,
  onAnimationEnd 
}: { 
  portDetail: PortServiceDetail | null;
  isLoading: boolean;
  error: string | null;
  isClosing: boolean;
  onAnimationEnd: () => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  const responses = useMemo(() => portDetail?.responses ?? [], [portDetail]);

  // Clamp index when responses change
  const idx = Math.min(activeIdx, Math.max(responses.length - 1, 0));
  const activeGroup = responses[idx] ?? null;

  const goPrev = () => setActiveIdx(i => Math.max(i - 1, 0));
  const goNext = () => setActiveIdx(i => Math.min(i + 1, responses.length - 1));

  return (
    <div 
      className={`port-response-panel ${isClosing ? 'closing' : ''}`}
      onAnimationEnd={onAnimationEnd}
    >
      {isLoading && (
        <div className="port-response-loading">
          <i className="fa-solid fa-spinner fa-spin" />
          <span>Loading service detail...</span>
        </div>
      )}
      {error && (
        <div className="port-response-error">
          <i className="fa-solid fa-circle-exclamation" />
          <span>{error}</span>
        </div>
      )}
      {portDetail && !isLoading && (
        <>
          <div className="port-response-header">
            <span className="port-label">
              Port {portDetail.port}
              {portDetail.is_tls && <span className="tls-badge">TLS</span>}
            </span>
            <span className="probe-stats">
              {portDetail.probes_sent} sent / {portDetail.probes_received} received
            </span>
          </div>
          {responses.length > 0 ? (
            <div className="port-response-body">
              {/* Navigation bar */}
              <div className="response-nav">
                <button
                  className="response-nav-btn"
                  onClick={goPrev}
                  disabled={idx === 0}
                  aria-label="Previous response"
                >
                  <i className="fa-solid fa-chevron-left" />
                </button>
                <div className="response-nav-info">
                  <span className="response-nav-counter">{idx + 1} / {responses.length}</span>
                  {activeGroup && (
                    <span className="response-nav-service">
                      {activeGroup.service}
                      {activeGroup.is_tls && <span className="tls-badge">TLS</span>}
                    </span>
                  )}
                </div>
                <button
                  className="response-nav-btn"
                  onClick={goNext}
                  disabled={idx === responses.length - 1}
                  aria-label="Next response"
                >
                  <i className="fa-solid fa-chevron-right" />
                </button>
              </div>
              {/* Active response detail */}
              {activeGroup && <ResponseDetail group={activeGroup} />}
            </div>
          ) : (
            <div className="port-response-body">
              <div className="no-response-text">No responses captured</div>
            </div>
          )}
        </>
      )}
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
  
  // Lazy-loaded port detail state
  const [portDetail, setPortDetail] = useState<PortServiceDetail | null>(null);
  const [loadingPort, setLoadingPort] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const currentScanId = useScanStore(s => s.currentScanId);
  
  if (!device) return null;

  const ports = device.ports || [];
  const services = device.services || {};
  const serviceInfo = device.service_info || [];

  // Create a lookup set of ports that have service info
  const portsWithServiceInfo = new Set(serviceInfo.map(info => info.port));
  
  // Fetch port detail from backend
  const loadPortDetail = async (port: number) => {
    if (!currentScanId || !device) return;
    setLoadingPort(port);
    setLoadError(null);
    setPortDetail(null);
    try {
      const ws = getWebSocketService();
      if (!ws) throw new Error('WebSocket not connected');
      const response = await ws.getPortDetail(currentScanId, device.ip, port);
      setPortDetail(response.data as PortServiceDetail);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message 
        : (err as { error?: string })?.error || 'Failed to load port detail';
      setLoadError(errorMsg);
    } finally {
      setLoadingPort(null);
    }
  };
  
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
      loadPortDetail(port);
    }
  };
  
  // Handle animation end
  const handleAnimationEnd = () => {
    if (isClosing) {
      setIsClosing(false);
      if (pendingPortRef.current !== null) {
        // Switch to the pending port
        const nextPort = pendingPortRef.current;
        setVisiblePort(nextPort);
        pendingPortRef.current = null;
        loadPortDetail(nextPort);
      } else {
        // Just closing
        setVisiblePort(null);
        setPortDetail(null);
        setLoadError(null);
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
                              hasServiceInfo={portsWithServiceInfo.has(port)}
                              isSelected={port === selectedPort}
                              isLoading={port === loadingPort}
                              onClick={() => togglePort(port)}
                            />
                          ))}
                        </div>
                        {visibleInGroup !== null && (
                          <ResponsePanel 
                            portDetail={portDetail}
                            isLoading={loadingPort === visibleInGroup}
                            error={loadError}
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
                              hasServiceInfo={portsWithServiceInfo.has(port)}
                              isSelected={port === selectedPort}
                              isLoading={port === loadingPort}
                              onClick={() => togglePort(port)}
                            />
                          ))}
                        </div>
                        {visiblePort !== null && ports.includes(visiblePort) && (
                          <ResponsePanel 
                            portDetail={portDetail}
                            isLoading={loadingPort === visiblePort}
                            error={loadError}
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
