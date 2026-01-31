import { useScanStore } from '../../store';
import { getCurrentWSServer } from '../../utils';

export function Footer() {
  const appInfo = useScanStore((state) => state.appInfo);
  const connectionStatus = useScanStore((state) => state.connectionStatus);
  const setShowAbout = useScanStore((state) => state.setShowAbout);
  const setShowConnection = useScanStore((state) => state.setShowConnection);

  const wsServer = getCurrentWSServer();
  const statusLabels: Record<string, string> = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    error: 'Connection Error',
  };

  return (
    <footer className="footer">
      <div className="footer-left">
        <span>LANscape {appInfo?.version || ''}</span>
      </div>
      <div className="footer-right">
        <button
          className="footer-status footer-icon-btn"
          onClick={() => setShowConnection(true)}
          data-tooltip-id="tooltip"
          data-tooltip-content={`${statusLabels[connectionStatus]} (${wsServer})`}
        >
          <span className={`status-dot ${connectionStatus} ${connectionStatus === 'connecting' ? 'pulse' : ''}`}></span>
        </button>
        <button
          className="footer-icon-btn"
          onClick={() => setShowAbout(true)}
          data-tooltip-id="tooltip"
          data-tooltip-content="About LANscape"
        >
          <i className="fa-solid fa-circle-info"></i>
        </button>
        <a
          href="https://github.com/mdennis281/LANscape"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-icon-btn"
          data-tooltip-id="tooltip"
          data-tooltip-content="GitHub Repository"
        >
          <i className="fa-brands fa-github"></i>
        </a>
      </div>
    </footer>
  );
}
