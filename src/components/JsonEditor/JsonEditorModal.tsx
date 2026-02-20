/**
 * JsonEditorModal — Reusable modal wrapping Monaco Editor for JSON viewing/editing.
 *
 * Supports:
 *  • Read-only mode (viewing) and editable mode
 *  • Syntax highlighting, bracket matching, minimap
 *  • JSON validation with inline error markers
 *  • Optional onSave callback — receives parsed object when the user clicks Save
 *  • Copy-to-clipboard
 *  • Dark theme matching the app
 */

import { useRef, useState, useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

// ── Props ────────────────────────────────────────────────────────────

interface JsonEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Modal title — e.g. "Fast — Scan Config" */
  title: string;
  /** The object (or string) to display as JSON. */
  value: unknown;
  /** If true the editor is read-only (default: true). */
  readOnly?: boolean;
  /** Called with the parsed object when the user clicks Save. */
  onSave?: (parsed: unknown) => void;
}

// ── Component ────────────────────────────────────────────────────────

export function JsonEditorModal({
  isOpen,
  onClose,
  title,
  value,
  readOnly = true,
  onSave,
}: JsonEditorModalProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const mouseDownTarget = useRef<EventTarget | null>(null);
  const [copied, setCopied] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Format the initial value
  const formattedJson = typeof value === 'string'
    ? value
    : JSON.stringify(value, null, 2) ?? '';

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    // Auto-format on mount
    setTimeout(() => {
      editor.getAction('editor.action.formatDocument')?.run();
    }, 100);
  };

  const handleCopy = useCallback(() => {
    const content = editorRef.current?.getValue() ?? formattedJson;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [formattedJson]);

  const handleSave = useCallback(() => {
    if (!onSave) return;
    const content = editorRef.current?.getValue() ?? '';
    try {
      const parsed = JSON.parse(content);
      setParseError(null);
      onSave(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }, [onSave]);

  if (!isOpen) return null;

  const canSave = !readOnly && !!onSave;

  return (
    <div className="modal-backdrop json-editor-backdrop" onMouseDown={(e: ReactMouseEvent) => {
      mouseDownTarget.current = e.target;
    }} onMouseUp={(e: ReactMouseEvent) => {
      if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) onClose();
      mouseDownTarget.current = null;
    }}>
      <div className="modal modal-large json-editor-modal">
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            <i className="fa-solid fa-code json-editor-icon" />
            {title}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <i className="fa-regular fa-circle-xmark" />
          </button>
        </div>

        {/* Editor body */}
        <div className="json-editor-body">
          <Editor
            height="100%"
            defaultLanguage="json"
            defaultValue={formattedJson}
            theme="vs-dark"
            options={{
              readOnly,
              minimap: { enabled: true },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              tabSize: 2,
              renderLineHighlight: 'all',
              bracketPairColorization: { enabled: true },
              formatOnPaste: true,
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
            }}
            onMount={handleMount}
          />
        </div>

        {/* Footer */}
        <div className="modal-footer json-editor-footer">
          {parseError && (
            <span className="json-editor-error">
              <i className="fa-solid fa-triangle-exclamation" />
              {parseError}
            </span>
          )}

          <div className="json-editor-actions">
            <button
              className="btn btn-secondary"
              onClick={handleCopy}
              data-tooltip-id="tooltip"
              data-tooltip-content="Copy JSON to clipboard"
            >
              <i className={copied ? 'fa-solid fa-check' : 'fa-regular fa-clipboard'} />
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            {canSave && (
              <button
                className="btn btn-primary"
                onClick={handleSave}
                data-tooltip-id="tooltip"
                data-tooltip-content="Save changes"
              >
                <i className="fa-solid fa-floppy-disk" />
                <span>Save</span>
              </button>
            )}

            <button
              className="btn btn-secondary"
              onClick={onClose}
            >
              <span>{canSave ? 'Cancel' : 'Close'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
