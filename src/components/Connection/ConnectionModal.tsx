import { useState, useEffect } from 'react';

import { Modal } from '../Modal';
import { useScanStore } from '../../store';
import { getCurrentWSServer, updateQueryParam } from '../../utils';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectionModal({ isOpen, onClose }: ConnectionModalProps) {
  const connectionStatus = useScanStore((state) => state.connectionStatus);
  const appInfo = useScanStore((state) => state.appInfo);
  
  const [wsServer, setWsServer] = useState('');

  useEffect(() => {
    if (isOpen) {
      setWsServer(getCurrentWSServer());
    }
  }, [isOpen]);

  const handleConnect = () => {
    if (wsServer.trim()) {
      updateQueryParam('ws-server', wsServer.trim());
      window.location.reload();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && wsServer.trim()) {
      handleConnect();
    }
  };

  const statusLabels: Record<string, string> = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    error: 'Connection Error',
  };

  const statusColors: Record<string, string> = {
    connected: 'var(--color-success)',
    connecting: 'var(--color-warning)',
    disconnected: 'var(--color-text-muted)',
    error: 'var(--color-error)',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Server Connection"
      size="small"
    >
      <div className="connection-modal">
        {/* Current Status */}
        <div className="connection-status-section">
          <div className="connection-status-row">
            <span className="connection-status-label">Status:</span>
            <span 
              className="connection-status-value"
              style={{ color: statusColors[connectionStatus] }}
            >
              <span className={`status-dot ${connectionStatus} ${connectionStatus === 'connecting' ? 'pulse' : ''}`}></span>
              {statusLabels[connectionStatus]}
            </span>
          </div>
          {appInfo && (
            <div className="connection-status-row">
              <span className="connection-status-label">Server Version:</span>
              <span className="connection-status-value">{appInfo.version}</span>
            </div>
          )}
        </div>

        {/* Server Input */}
        <div className="form-group">
          <label className="form-label">WebSocket Server</label>
          <div className="form-row-inline">
            <input
              type="text"
              className="form-input"
              placeholder="localhost:8766"
              value={wsServer}
              onChange={(e) => setWsServer(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button 
              className="btn btn-primary btn-sm" 
              onClick={handleConnect}
              disabled={!wsServer.trim()}
            >
              Connect
            </button>
          </div>
          <small className="form-hint">
            Enter the WebSocket server address (page will reload)
          </small>
        </div>
      </div>
    </Modal>
  );
}
