import { Modal } from '../Modal';
import { useScanStore } from '../../store';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const appInfo = useScanStore((state) => state.appInfo);

  if (!appInfo) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="About LANscape">
        <div className="text-center">
          <span className="spinner"></span>
          <p className="mt-2 text-muted">Loading...</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="About LANscape"
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="text-center mb-4">
        <i className="fa-solid fa-network-wired" style={{ fontSize: '48px', color: 'var(--primary-accent)' }}></i>
        <h3 className="mt-2">{appInfo.name}</h3>
        <p className="text-muted">Version {appInfo.version}</p>
      </div>

      {appInfo.update_available && (
        <div className="mb-4" style={{ 
          padding: '12px', 
          background: 'rgba(48, 209, 88, 0.1)', 
          borderRadius: 'var(--border-radius-sm)',
          border: '1px solid var(--secondary-accent)'
        }}>
          <i className="fa-solid fa-arrow-up-right-from-square text-success"></i>{' '}
          <span className="text-success">Update available: {appInfo.latest_version}</span>
        </div>
      )}

      <div className="settings-section">
        <div className="settings-section-title">Runtime Arguments</div>
        {appInfo.runtime_args && Object.keys(appInfo.runtime_args).length > 0 ? (
          <div className="device-detail-grid">
            {Object.entries(appInfo.runtime_args).map(([key, value]) => (
              <div className="device-detail-item" key={key}>
                <div className="device-detail-label">{key}</div>
                <div className="device-detail-value">{String(value)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted">No runtime arguments</p>
        )}
      </div>

      <div className="mt-4 text-center">
        <a 
          href="https://github.com/your-repo/lanscape" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary"
        >
          <i className="fa-brands fa-github"></i> View on GitHub
        </a>
      </div>
    </Modal>
  );
}
