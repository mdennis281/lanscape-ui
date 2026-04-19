/**
 * ExportModal — Unified preview-and-download modal for JSON and CSV exports.
 *
 * Uses Monaco Editor in read-only mode to preview the content.
 * Footer provides Copy (clipboard), Download (blob), and Close actions.
 */

import { useRef, useState, useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

// ── Props ────────────────────────────────────────────────────────────

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** The text content to preview (pre-formatted JSON or CSV string). */
  content: string;
  /** Filename used for the blob download (e.g. "scan.json", "scan.csv"). */
  filename: string;
  /** Monaco language for syntax highlighting. Default: "json" */
  language?: 'json' | 'plaintext';
}

// ── Component ────────────────────────────────────────────────────────

export function ExportModal({
  isOpen,
  onClose,
  title,
  content,
  filename,
  language = 'json',
}: ExportModalProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const mouseDownTarget = useRef<EventTarget | null>(null);
  const [copied, setCopied] = useState(false);

  const handleMount: OnMount = (ed) => {
    editorRef.current = ed;
    if (language === 'json') {
      setTimeout(() => {
        ed.getAction('editor.action.formatDocument')?.run();
      }, 100);
    }
  };

  const handleCopy = useCallback(() => {
    const text = editorRef.current?.getValue() ?? content;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  const handleDownload = useCallback(() => {
    const text = editorRef.current?.getValue() ?? content;
    const mimeType = language === 'json' ? 'application/json' : 'text/csv';
    const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [content, filename, language]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop export-modal-backdrop"
      onMouseDown={(e: ReactMouseEvent) => { mouseDownTarget.current = e.target; }}
      onMouseUp={(e: ReactMouseEvent) => {
        if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) onClose();
        mouseDownTarget.current = null;
      }}
    >
      <div className="modal modal-large export-modal">
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            <i className="fa-solid fa-file-export export-modal-icon" />
            {title}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <i className="fa-regular fa-circle-xmark" />
          </button>
        </div>

        {/* Editor body */}
        <div className="export-modal-body">
          <Editor
            height="100%"
            defaultLanguage={language}
            defaultValue={content}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: true },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              tabSize: 2,
              renderLineHighlight: 'all',
              bracketPairColorization: { enabled: true },
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
            }}
            onMount={handleMount}
          />
        </div>

        {/* Footer */}
        <div className="modal-footer export-modal-footer">
          <button className="btn btn-secondary" onClick={handleCopy}>
            <i className={copied ? 'fa-solid fa-check' : 'fa-regular fa-clipboard'} />
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button className="btn btn-primary" onClick={handleDownload}>
            <i className="fa-solid fa-download" />
            <span>Download</span>
          </button>

          <button className="btn btn-secondary" onClick={onClose}>
            <span>Close</span>
          </button>
        </div>
      </div>
    </div>
  );
}
