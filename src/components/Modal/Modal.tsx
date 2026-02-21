import { useRef } from 'react';
import type { ReactNode, MouseEvent } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export function Modal({ isOpen, onClose, title, children, footer, size = 'medium' }: ModalProps) {
  const mouseDownTarget = useRef<EventTarget | null>(null);

  if (!isOpen) return null;

  const handleMouseDown = (e: MouseEvent) => {
    mouseDownTarget.current = e.target;
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) {
      onClose();
    }
    mouseDownTarget.current = null;
  };

  return (
    <div className="modal-backdrop" onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}>
      <div className={`modal modal-${size}`}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>
            <i className="fa-regular fa-circle-xmark"></i>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
