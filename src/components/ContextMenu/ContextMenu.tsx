import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ContextMenuProps, ContextMenuItem } from './types';

const MENU_PADDING = 6; // px from viewport edge

export function ContextMenu({ sections, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Edge-clamp: mutate DOM directly after layout to avoid a second render
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let { x, y } = position;
    if (x + rect.width > window.innerWidth - MENU_PADDING) {
      x = window.innerWidth - rect.width - MENU_PADDING;
    }
    if (y + rect.height > window.innerHeight - MENU_PADDING) {
      y = window.innerHeight - rect.height - MENU_PADDING;
    }
    if (x < MENU_PADDING) x = MENU_PADDING;
    if (y < MENU_PADDING) y = MENU_PADDING;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, [position]);

  // Close on click-outside, scroll, Escape, blur
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleDismiss = () => onClose();

    document.addEventListener('mousedown', handleClick, true);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('blur', handleDismiss);
    return () => {
      document.removeEventListener('mousedown', handleClick, true);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('blur', handleDismiss);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="ctx-menu"
      style={{ left: position.x, top: position.y }}
    >
      {sections.map((section, si) => (
        <div key={si}>
          {si > 0 && <div className="ctx-menu-divider" />}
          {section.label && (
            <div className="ctx-menu-section-label">{section.label}</div>
          )}
          {section.items.map((item, ii) => (
            <MenuItem key={ii} item={item} onClose={onClose} />
          ))}
        </div>
      ))}
    </div>,
    document.body,
  );
}

// ── Single menu item (supports submenus) ─────────────────────────────

function MenuItem({ item, onClose }: { item: ContextMenuItem; onClose: () => void }) {
  const [showSub, setShowSub] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hasSubmenu = item.items && item.items.length > 0;

  const openSub = useCallback(() => {
    clearTimeout(timerRef.current);
    setShowSub(true);
  }, []);

  const closeSub = useCallback(() => {
    timerRef.current = setTimeout(() => setShowSub(false), 150);
  }, []);

  const handleClick = () => {
    if (item.disabled) return;
    if (hasSubmenu) return; // submenus open on hover only
    item.onClick?.();
    onClose();
  };

  return (
    <div
      ref={itemRef}
      className={`ctx-menu-item${item.disabled ? ' ctx-menu-item--disabled' : ''}${hasSubmenu ? ' ctx-menu-item--submenu' : ''}`}
      onClick={handleClick}
      onMouseEnter={hasSubmenu ? openSub : undefined}
      onMouseLeave={hasSubmenu ? closeSub : undefined}
    >
      {item.icon ? (
        <i className={`ctx-menu-item-icon ${item.icon}`} />
      ) : (
        <span className="ctx-menu-item-icon" />
      )}
      <span className="ctx-menu-item-label">{item.label}</span>
      {hasSubmenu && <i className="ctx-menu-chevron fa-solid fa-chevron-right" />}

      {hasSubmenu && showSub && (
        <Submenu items={item.items!} parentRef={itemRef} onClose={onClose} onMouseEnter={openSub} onMouseLeave={closeSub} />
      )}
    </div>
  );
}

// ── Submenu panel ────────────────────────────────────────────────────

function Submenu({
  items,
  parentRef,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: {
  items: ContextMenuItem[];
  parentRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const subRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left?: number; right?: number; top: number }>({ top: 0 });

  useEffect(() => {
    const parentEl = parentRef.current;
    const subEl = subRef.current;
    if (!parentEl || !subEl) return;

    const parentRect = parentEl.getBoundingClientRect();
    const subRect = subEl.getBoundingClientRect();

    let top = 0;
    // Flip up if overflows bottom
    if (parentRect.top + subRect.height > window.innerHeight - MENU_PADDING) {
      top = -(subRect.height - parentRect.height);
    }

    // Default: open to the right
    if (parentRect.right + subRect.width > window.innerWidth - MENU_PADDING) {
      // Flip left
      setPos({ right: parentRect.width - 2, top });
    } else {
      setPos({ left: parentRect.width - 2, top });
    }
  }, [parentRef]);

  return (
    <div
      ref={subRef}
      className="ctx-menu ctx-menu--sub"
      style={{ position: 'absolute', ...pos }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {items.map((item, i) => (
        <MenuItem key={i} item={item} onClose={onClose} />
      ))}
    </div>
  );
}
