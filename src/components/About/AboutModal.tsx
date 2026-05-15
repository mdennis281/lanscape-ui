import { type ReactNode } from 'react';
import { Modal } from '../Modal';
import { useConnectionStore, useUIStore } from '../../store';
import { formatVersion } from '../../utils';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function humanise(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatArgValue(value: unknown): ReactNode {
  if (typeof value === 'boolean') {
    return (
      <span className={`about-modal-pill ${value ? 'is-on' : 'is-off'}`}>
        {value ? 'On' : 'Off'}
      </span>
    );
  }
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted">—</span>;
  }
  return String(value);
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  const appInfo = useConnectionStore((state) => state.appInfo);
  const setShowUpdate = useUIStore((state) => state.setShowUpdate);

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

  const handleShowUpdate = () => {
    onClose();
    setShowUpdate(true);
  };

  const runtimeArgs = appInfo.runtime_args ?? {};
  const argMeta = appInfo.runtime_arg_meta ?? {};
  const argEntries = Object.entries(runtimeArgs).sort(([a], [b]) =>
    a.localeCompare(b),
  );

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
      <div className="about-modal">
        <div className="about-modal-header">
          <img
            src="./android-chrome-192x192.png"
            alt="LANscape"
            className="about-modal-logo"
          />
          <h3 className="about-modal-name">{appInfo.name}</h3>
          <div className="about-modal-version">{formatVersion(appInfo.version)}</div>
        </div>

        <div className="about-modal-description">
          <p>
            LANscape was born from my frustration with existing local network
            scanning tools alongside my desire to dive deeper into technologies
            like Address Resolution Protocol (ARP), threadpooling, &amp; Python
            packaging. I set out to create something faster, lightweight,
            &amp; easier to use.
          </p>
          <p>
            This project has been a learning journey, &amp; I hope it helps you
            discover more about your network as well. Enjoy!
          </p>
        </div>

        {appInfo.update_available && appInfo.latest_version && (
          <div className="about-modal-update">
            <div>
              <i className="fa-solid fa-circle-up text-success"></i>{' '}
              <span className="text-success">
                Update available: {formatVersion(appInfo.latest_version)}
              </span>
            </div>
            <button
              className="btn btn-small"
              style={{
                background: 'var(--secondary-accent)',
                color: '#fff',
                border: 'none',
                padding: '4px 10px',
                fontSize: '12px',
                cursor: 'pointer',
                borderRadius: 'var(--border-radius-sm)',
              }}
              onClick={handleShowUpdate}
            >
              View Details
            </button>
          </div>
        )}

        <div className="about-modal-runtime-args">
          <div className="about-modal-section-title">Runtime Arguments</div>
          {argEntries.length > 0 ? (
            <div className="about-modal-table-wrap">
              <table className="about-modal-table">
                <thead>
                  <tr>
                    <th>Argument</th>
                    <th>Flag</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {argEntries.map(([key, value]) => {
                    const meta = argMeta[key];
                    const flag = meta?.flag ?? null;
                    const help = meta?.help ?? null;
                    const tooltipHtml = help
                      ? (flag
                        ? `<div class="about-modal-tooltip"><code>${escapeHtml(flag)}</code><span>${escapeHtml(help)}</span></div>`
                        : `<div class="about-modal-tooltip"><span>${escapeHtml(help)}</span></div>`)
                      : null;

                    return (
                      <tr
                        key={key}
                        data-tooltip-id={tooltipHtml ? 'tooltip' : undefined}
                        data-tooltip-html={tooltipHtml ?? undefined}
                      >
                        <td className="about-modal-arg-label">
                          {humanise(key)}
                        </td>
                        <td className="about-modal-arg-flag">
                          {flag ? (
                            <code>{flag}</code>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="about-modal-arg-value">
                          {formatArgValue(value)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">No runtime arguments</p>
          )}
        </div>

        <a
          href="https://github.com/mdennis281/LANscape"
          target="_blank"
          rel="noopener noreferrer"
          className="about-modal-footer-link"
        >
          <i className="fa-brands fa-github"></i> View on GitHub
        </a>
      </div>
    </Modal>
  );
}
