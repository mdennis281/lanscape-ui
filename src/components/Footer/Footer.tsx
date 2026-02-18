import { useScanStore } from '../../store';
import { getCurrentWSServer, formatVersion } from '../../utils';

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
        <span>{appInfo?.version ? formatVersion(appInfo.version) : ''}</span>
        {appInfo?.update_available && (
          <button
            className="footer-update-btn"
            onClick={() => setShowAbout(true)}
            data-tooltip-id="tooltip"
            data-tooltip-content={`Update available: ${appInfo.latest_version}`}
          >
            <i className="fa-solid fa-arrow-up"></i> Update
          </button>
        )}
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
