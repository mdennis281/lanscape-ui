/**
 * SettingsFooter — Contextual animated footer buttons for the Settings modal.
 *
 * All five buttons are always mounted in the DOM. Visibility is toggled via a
 * CSS class so that buttons smoothly scale + collapse/expand rather than
 * popping in/out when React adds or removes elements.
 *
 * Button visibility by state:
 *  • No changes:        [Close]
 *  • Switched preset:   [Cancel] [Revert] [Use]
 *  • Modified settings: [Cancel] [Revert] [Save] [Use]
 */

interface SettingsFooterProps {
  /** Config has been modified from what was in the store on open */
  hasChanges: boolean;
  /** The active preset has drifted (individual settings tweaked) */
  isDrifted: boolean;
  /** Close the modal without doing anything */
  onClose: () => void;
  /** Revert localConfig back to what the store had on open (without closing) */
  onRevert: () => void;
  /** Open the save-to-profile dialog */
  onSave: () => void;
  /** Apply settings for this session without persisting to a profile */
  onUse: () => void;
}

export function SettingsFooter({
  hasChanges,
  isDrifted,
  onClose,
  onRevert,
  onSave,
  onUse,
}: SettingsFooterProps) {
  const vis = {
    close: !hasChanges,
    cancel: hasChanges,
    revert: hasChanges,
    save: hasChanges && isDrifted,
    use: hasChanges,
  };

  const hidden = (show: boolean): string =>
    show ? '' : ' settings-footer-btn--hidden';

  return (
    <div className="settings-footer">
      {/* Close — only when nothing has changed */}
      <button
        className={`btn btn-secondary settings-footer-btn${hidden(vis.close)}`}
        onClick={onClose}
        tabIndex={vis.close ? 0 : -1}
        data-tooltip-id="tooltip"
        data-tooltip-content="Close settings"
      >
        <i className="fa-solid fa-xmark" />
        <span>Close</span>
      </button>

      {/* Cancel — revert and close */}
      <button
        className={`btn btn-secondary settings-footer-btn${hidden(vis.cancel)}`}
        onClick={onClose}
        tabIndex={vis.cancel ? 0 : -1}
        data-tooltip-id="tooltip"
        data-tooltip-content="Revert changes and close"
      >
        <i className="fa-solid fa-xmark" />
        <span>Cancel</span>
      </button>

      {/* Revert — reset without closing */}
      <button
        className={`btn btn-secondary settings-footer-btn${hidden(vis.revert)}`}
        onClick={onRevert}
        tabIndex={vis.revert ? 0 : -1}
        data-tooltip-id="tooltip"
        data-tooltip-content="Revert changes without closing"
      >
        <i className="fa-solid fa-rotate-left" />
        <span>Revert</span>
      </button>

      {/* Save — only when drifted from the active preset */}
      <button
        className={`btn btn-primary settings-footer-btn${hidden(vis.save)}`}
        onClick={onSave}
        tabIndex={vis.save ? 0 : -1}
        data-tooltip-id="tooltip"
        data-tooltip-content="Save to a custom profile"
      >
        <i className="fa-solid fa-floppy-disk" />
        <span>Save</span>
      </button>

      {/* Use — apply without saving to a profile */}
      <button
        className={`btn btn-success settings-footer-btn${hidden(vis.use)}`}
        onClick={onUse}
        tabIndex={vis.use ? 0 : -1}
        data-tooltip-id="tooltip"
        data-tooltip-content="Use these settings without saving to a profile"
      >
        <i className="fa-solid fa-check" />
        <span>Use</span>
      </button>
    </div>
  );
}
