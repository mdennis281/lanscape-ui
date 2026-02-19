import { useState } from 'react';
import { Modal } from '../Modal';
import { useScanStore } from '../../store';
import { formatVersion } from '../../utils';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UpdateModal({ isOpen, onClose }: UpdateModalProps) {
  const appInfo = useScanStore((state) => state.appInfo);
  const [copied, setCopied] = useState(false);

  if (!appInfo?.update_available || !appInfo.latest_version) {
    return null;
  }

  const pipCommand = `pip install lanscape==${appInfo.latest_version}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pipCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for insecure contexts
      const textarea = document.createElement('textarea');
      textarea.value = pipCommand;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Available" size="small">
      <div className="update-modal">
        <div className="update-modal-icon">
          <i className="fa-solid fa-circle-up"></i>
        </div>

        <div className="update-modal-versions">
          <div className="update-modal-version">
            <span className="update-modal-label">Installed</span>
            <span className="update-modal-value">{formatVersion(appInfo.version)}</span>
          </div>
          <div className="update-modal-arrow">
            <i className="fa-solid fa-arrow-right"></i>
          </div>
          <div className="update-modal-version">
            <span className="update-modal-label">Latest</span>
            <span className="update-modal-value update-modal-latest">
              {formatVersion(appInfo.latest_version)}
            </span>
          </div>
        </div>

        <div className="update-modal-command-section">
          <span className="update-modal-label">Run this command to update:</span>
          <div className="update-modal-command">
            <code>{pipCommand}</code>
            <button
              className="update-modal-copy"
              onClick={handleCopy}
              data-tooltip-id="tooltip"
              data-tooltip-content={copied ? 'Copied!' : 'Copy to clipboard'}
            >
              <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
            </button>
          </div>
        </div>

        <a
          href="https://github.com/mdennis281/LANscape/releases"
          target="_blank"
          rel="noopener noreferrer"
          className="update-modal-changelog"
        >
          <i className="fa-solid fa-scroll"></i> View Release Notes
        </a>
      </div>
    </Modal>
  );
}
