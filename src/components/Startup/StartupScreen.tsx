/**
 * Startup screen component that shows backend initialization progress.
 * 
 * Displays Python environment setup, LANscape installation, and WebSocket
 * server startup status when running in Electron.
 */

import { useState, useEffect } from 'react';
import '../../types/electron'; // Import electron types for global Window augmentation
import { setWebSocketPort } from '../../utils/url';
import './StartupScreen.css';

interface StartupScreenProps {
  onReady: () => void;
  onSkip?: () => void;
}

interface StatusLogEntry {
  message: string;
  timestamp: Date;
  type: 'info' | 'error' | 'success';
}

export function StartupScreen({ onReady, onSkip }: StartupScreenProps) {
  const [statusLog, setStatusLog] = useState<StatusLogEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);

  // Map status messages to progress percentages
  const getProgressFromStatus = (status: string): number => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('creating python')) return 10;
    if (statusLower.includes('environment found')) return 20;
    if (statusLower.includes('installing lanscape')) return 30;
    if (statusLower.includes('lanscape v')) return 60;
    if (statusLower.includes('starting websocket')) return 80;
    if (statusLower.includes('websocket server running')) return 100;
    return progress; // Keep current progress if unknown
  };

  useEffect(() => {
    const electronAPI = window.electronAPI;

    // If not in Electron, skip startup screen
    if (!electronAPI) {
      console.log('Not running in Electron, skipping startup screen');
      onReady();
      return;
    }

    // Immediately fetch and cache the WebSocket port
    electronAPI.getWsPort().then((port) => {
      console.log('WebSocket port from Electron:', port);
      setWebSocketPort(port);
      addLogEntry(`Using WebSocket port: ${port}`, 'info');
    });

    // Add initial log entry
    addLogEntry('Starting LANscape backend...', 'info');

    // Listen for status updates
    const unsubStatus = electronAPI.onPythonStatus((status: string) => {
      console.log('Python status:', status);
      setCurrentStatus(status);
      setProgress(getProgressFromStatus(status));
      addLogEntry(status, 'info');
    });

    // Listen for errors
    const unsubError = electronAPI.onPythonError((errorMsg: string) => {
      console.error('Python error:', errorMsg);
      setError(errorMsg);
      addLogEntry(errorMsg, 'error');
    });

    // Listen for ready event
    const unsubReady = electronAPI.onPythonReady(() => {
      console.log('Python ready!');
      setProgress(100);
      addLogEntry('Backend ready!', 'success');
      setIsReady(true);
      // Auto-proceed after a short delay
      setTimeout(() => {
        onReady();
      }, 500);
    });

    // Check if already initialized
    electronAPI.getPythonStatus().then((status) => {
      // Also cache the port from status
      if (status.port) {
        setWebSocketPort(status.port);
      }
      if (status.serverRunning) {
        console.log('Server already running on port', status.port);
        setProgress(100);
        addLogEntry('Backend already running', 'success');
        setIsReady(true);
        onReady();
      }
    });

    return () => {
      unsubStatus();
      unsubError();
      unsubReady();
    };
  }, [onReady]);

  const addLogEntry = (message: string, type: 'info' | 'error' | 'success') => {
    setStatusLog((prev) => [...prev, { message, timestamp: new Date(), type }]);
  };

  const handleRetry = async () => {
    setError(null);
    setStatusLog([]);
    setProgress(0);
    addLogEntry('Retrying...', 'info');

    const electronAPI = window.electronAPI;
    if (electronAPI) {
      const result = await electronAPI.restartWsServer();
      if (!result.success && result.error) {
        setError(result.error);
        addLogEntry(result.error, 'error');
      }
    }
  };

  const handleReinstall = async () => {
    setError(null);
    setStatusLog([]);
    setProgress(0);
    addLogEntry('Reinstalling LANscape...', 'info');

    const electronAPI = window.electronAPI;
    if (electronAPI) {
      const result = await electronAPI.reinstallLanscape();
      if (!result.success && result.error) {
        setError(result.error);
        addLogEntry(result.error, 'error');
      }
    }
  };

  return (
    <div className="startup-screen">
      <div className="startup-container">
        {/* Logo/Brand */}
        <div className="startup-header">
          <div className="startup-logo">
            <img src="./android-chrome-192x192.png" alt="LANscape" className="startup-logo-img" />
          </div>
          <h1 className="startup-title">LANscape</h1>
          <p className="startup-subtitle">Local Network Scanner</p>
        </div>

        {/* Progress Section */}
        <div className="startup-progress-section">
          <div className="startup-status">{currentStatus}</div>
          
          <div className="startup-progress-bar">
            <div 
              className="startup-progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="startup-progress-text">{progress}%</div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="startup-error">
            <i className="fas fa-exclamation-triangle"></i>
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="startup-actions">
          {error && (
            <>
              <button className="startup-btn startup-btn-primary" onClick={handleRetry}>
                <i className="fas fa-redo"></i> Retry
              </button>
              <button className="startup-btn startup-btn-secondary" onClick={handleReinstall}>
                <i className="fas fa-download"></i> Reinstall
              </button>
            </>
          )}
          {onSkip && !isReady && (
            <button className="startup-btn startup-btn-ghost" onClick={onSkip}>
              Skip
            </button>
          )}
        </div>

        {/* Status Log (collapsible) */}
        <details className="startup-log-details">
          <summary className="startup-log-summary">
            <i className="fas fa-terminal"></i> View Log ({statusLog.length} entries)
          </summary>
          <div className="startup-log">
            {statusLog.map((entry, index) => (
              <div key={index} className={`startup-log-entry startup-log-${entry.type}`}>
                <span className="startup-log-time">
                  {entry.timestamp.toLocaleTimeString()}
                </span>
                <span className="startup-log-message">{entry.message}</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
