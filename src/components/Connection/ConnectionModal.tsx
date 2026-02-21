import { useState, useEffect } from 'react';

import { Modal } from '../Modal';
import { useScanStore } from '../../store';
import { getCurrentWSServer, updateQueryParam } from '../../utils';
import { fetchDiscoveredBackends } from '../../services/discovery';
import type { DiscoveredBackend } from '../../services/discovery';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When true the modal acts as a blocking overlay (no close button). */
  blocking?: boolean;
}

export function ConnectionModal({ isOpen, onClose, blocking = false }: ConnectionModalProps) {
  const connectionStatus = useScanStore((state) => state.connectionStatus);
  const connectionError = useScanStore((state) => state.connectionError);
  const appInfo = useScanStore((state) => state.appInfo);
  const wsService = useScanStore((state) => state.wsService);
  
  const [wsServer, setWsServer] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isAttempting, setIsAttempting] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredBackend[]>([]);

  // Reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting form on open
      setWsServer(getCurrentWSServer());
      setLocalError(null);
      setIsAttempting(false);
    }
  }, [isOpen]);

  // Poll for discovered backends while modal is open
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const poll = async () => {
      const backends = await fetchDiscoveredBackends();
      if (!cancelled) setDiscovered(backends);
    };

    // Fetch immediately, then poll every 5 seconds
    poll();
    const interval = setInterval(poll, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOpen]);

  // Clear local error when connection succeeds
  useEffect(() => {
    if (connectionStatus === 'connected') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing on connect
      setLocalError(null);
      setIsAttempting(false);
    }
  }, [connectionStatus]);

  const handleConnect = async () => {
    const server = wsServer.trim();
    if (!server || !wsService) return;

    setLocalError(null);
    setIsAttempting(true);

    // Build a proper ws:// URL from user input
    const wsUrl = server.startsWith('ws://') || server.startsWith('wss://')
      ? server
      : `ws://${server}`;

    // Persist the choice in query params (so reloads remember it)
    updateQueryParam('ws-server', server);

    // Disconnect any existing socket, update URL, and reconnect in-place
    wsService.disconnect();
    wsService.updateUrl(wsUrl);

    try {
      await wsService.connect();
      // Connection succeeded — onStatusChange in App.tsx will handle re-init
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLocalError(msg);
      setIsAttempting(false);
    }
  };

  const handleRetry = async () => {
    if (!wsService) return;
    setLocalError(null);
    setIsAttempting(true);
    try {
      await wsService.connect();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLocalError(msg);
      setIsAttempting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && wsServer.trim() && !isAttempting) {
      handleConnect();
    }
  };

  const handleSelectBackend = (backend: DiscoveredBackend) => {
    const server = `${backend.host}:${backend.ws_port}`;
    setWsServer(server);
    // Auto-connect immediately
    if (!wsService) return;
    setLocalError(null);
    setIsAttempting(true);

    const wsUrl = `ws://${server}`;
    updateQueryParam('ws-server', server);
    wsService.disconnect();
    wsService.updateUrl(wsUrl);
    wsService.connect().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      setLocalError(msg);
      setIsAttempting(false);
    });
  };

  const displayError = localError || connectionError;
  const isConnecting = isAttempting || connectionStatus === 'connecting';
  const isConnected = connectionStatus === 'connected';

  const statusLabels: Record<string, string> = {
    connected: 'Connected',
    connecting: 'Connecting…',
    disconnected: 'Disconnected',
    error: 'Connection Error',
  };

  const statusColors: Record<string, string> = {
    connected: 'var(--color-success)',
    connecting: 'var(--color-warning)',
    disconnected: 'var(--color-text-muted)',
    error: 'var(--color-error)',
  };

  // Derive display status — show "connecting" while we're attempting
  const displayStatus = isAttempting ? 'connecting' : connectionStatus;

  return (
    <Modal
      isOpen={isOpen}
      onClose={blocking ? () => {} : onClose}
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
              style={{ color: statusColors[displayStatus] }}
            >
              <span className={`status-dot ${displayStatus} ${isConnecting ? 'pulse' : ''}`}></span>
              {statusLabels[displayStatus]}
            </span>
          </div>
          {appInfo && (
            <div className="connection-status-row">
              <span className="connection-status-label">Backend Version:</span>
              <span className="connection-status-value">v{appInfo.version}</span>
            </div>
          )}
          <div className="connection-status-row">
            <span className="connection-status-label">Frontend Version:</span>
            <span className="connection-status-value">{__APP_VERSION__}</span>
          </div>
        </div>

        {/* Error Display */}
        {displayError && !isConnecting && (
          <div className="connection-error">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>{displayError}</span>
          </div>
        )}

        {/* Connecting Indicator */}
        {isConnecting && (
          <div className="connection-connecting">
            <div className="loading-bar">
              <div className="loading-bar-fill loading-bar-indeterminate" />
            </div>
          </div>
        )}

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
              disabled={isConnecting}
            />
            <button 
              className="btn btn-primary btn-sm" 
              onClick={handleConnect}
              disabled={!wsServer.trim() || isConnecting}
            >
              {isConnecting ? 'Connecting…' : 'Connect'}
            </button>
          </div>
          {!isConnecting && !isConnected && wsServer === getCurrentWSServer() && (
            <button 
              className="btn btn-secondary btn-sm connection-retry-btn"
              onClick={handleRetry}
              disabled={isConnecting}
            >
              <i className="fa-solid fa-rotate-right"></i> Retry Current Server
            </button>
          )}
        </div>

        {/* Discovered Backends (mDNS) */}
        {discovered.length > 0 && (
          <div className="discovered-section">
            <label className="form-label">
              <i className="fa-solid fa-tower-broadcast"></i> Discovered on Network
            </label>
            <div className="discovered-list">
              {discovered.map((b) => {
                const addr = `${b.host}:${b.ws_port}`;
                const isCurrent = addr === getCurrentWSServer();
                return (
                  <button
                    key={addr}
                    className={`discovered-item ${isCurrent ? 'current' : ''}`}
                    onClick={() => handleSelectBackend(b)}
                    disabled={isConnecting}
                    title={`Connect to ${b.hostname} (${addr})`}
                  >
                    <div className="discovered-item-info">
                      <span className="discovered-item-name">{b.hostname}</span>
                      <span className="discovered-item-addr">{addr}</span>
                    </div>
                    <span className="discovered-item-version">v{b.version}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
