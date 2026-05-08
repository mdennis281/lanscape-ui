import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import type { ContextMenuProps, ContextMenuItem, ContextMenuSection } from './types';

const MENU_PADDING = 6;       // distance from viewport edges
const ANCHOR_GAP = 6;         // distance between anchor and menu
const MIN_AUTO_HEIGHT = 160;  // floor for 'auto' max-height — keeps menus usable on tiny viewports

interface NavEntry {
  /** Title shown in the back-button header */
  label: string;
  items: ContextMenuItem[];
}

const slideVariants: Variants = {
  initial: (dir: number) => ({ opacity: 0, x: dir > 0 ? 28 : -28 }),
  animate: { opacity: 1, x: 0 },
  exit:    (dir: number) => ({ opacity: 0, x: dir > 0 ? -28 : 28 }),
};

const slideTransition = { duration: 0.18, ease: [0.4, 0, 0.2, 1] as const };

export function ContextMenu({
  sections,
  position,
  anchor,
  maxHeight = 'auto',
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Navigation stack — empty = root view; each entry = nested submenu
  const [stack, setStack] = useState<NavEntry[]>([]);
  // Slide direction: 1 = entering forward (deeper), -1 = going back
  const [direction, setDirection] = useState(1);

  const navigateTo = (item: ContextMenuItem) => {
    if (!item.items?.length) return;
    setDirection(1);
    setStack((s) => [...s, { label: item.label, items: item.items! }]);
  };
  const goBack = () => {
    setDirection(-1);
    setStack((s) => s.slice(0, -1));
  };

  const current = stack[stack.length - 1];
  const isRoot = !current;

  // Position + size clamp. Runs whenever position/anchor changes or stack
  // depth changes (nested view may have different intrinsic height).
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;

    let x = 0;
    let y = 0;
    if (position) {
      x = position.x;
      y = position.y;
    } else if (anchor) {
      x = anchor.rect.left;
      y = anchor.rect.bottom + ANCHOR_GAP;
    }

    // Apply maxHeight to the scrollable body so the chrome (back button) is
    // never clipped. 'auto' = whatever vertical room remains below the menu.
    const body = el.querySelector<HTMLElement>('.ctx-menu-body');
    if (body) {
      if (maxHeight === 'auto') {
        const available = window.innerHeight - y - MENU_PADDING;
        body.style.maxHeight = `${Math.max(MIN_AUTO_HEIGHT, available)}px`;
      } else {
        body.style.maxHeight = `${maxHeight}px`;
      }
    }

    // Now measure post-layout and clamp the menu inside the viewport.
    const rect = el.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - MENU_PADDING) {
      x = window.innerWidth - rect.width - MENU_PADDING;
    }
    if (y + rect.height > window.innerHeight - MENU_PADDING) {
      // For anchored popovers, prefer flipping above the anchor.
      if (anchor) {
        const flipped = anchor.rect.top - rect.height - ANCHOR_GAP;
        y = flipped >= MENU_PADDING ? flipped : window.innerHeight - rect.height - MENU_PADDING;
      } else {
        y = window.innerHeight - rect.height - MENU_PADDING;
      }
    }
    if (x < MENU_PADDING) x = MENU_PADDING;
    if (y < MENU_PADDING) y = MENU_PADDING;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, [position, anchor, maxHeight, stack.length]);

  // Close on outside click / Escape / outside-scroll / blur. Scrolls inside
  // the menu must NOT close it (the body is scrollable when content overflows).
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = (e: Event) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      onClose();
    };
    const handleBlur = () => onClose();

    document.addEventListener('mousedown', handleClick, true);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('mousedown', handleClick, true);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('blur', handleBlur);
    };
  }, [onClose]);

  return createPortal(
    <div ref={menuRef} className="ctx-menu">
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={isRoot ? 'root' : `level-${stack.length}-${current!.label}`}
          custom={direction}
          variants={slideVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={slideTransition}
          className="ctx-menu-view"
        >
          {isRoot ? (
            <RootView sections={sections} onClose={onClose} onEnter={navigateTo} />
          ) : (
            <SubmenuView
              entry={current!}
              onBack={goBack}
              onClose={onClose}
              onEnter={navigateTo}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}

// ── Views ────────────────────────────────────────────────────────────

function RootView({
  sections,
  onClose,
  onEnter,
}: {
  sections: ContextMenuSection[];
  onClose: () => void;
  onEnter: (item: ContextMenuItem) => void;
}) {
  return (
    <div className="ctx-menu-body">
      {sections.map((section, si) => (
        <div key={si}>
          {si > 0 && <div className="ctx-menu-divider" />}
          {section.label && (
            <div className="ctx-menu-section-label">{section.label}</div>
          )}
          {section.items.map((item, ii) => (
            <MenuItem key={ii} item={item} onClose={onClose} onEnter={onEnter} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SubmenuView({
  entry,
  onBack,
  onClose,
  onEnter,
}: {
  entry: NavEntry;
  onBack: () => void;
  onClose: () => void;
  onEnter: (item: ContextMenuItem) => void;
}) {
  return (
    <>
      <button type="button" className="ctx-menu-back" onClick={onBack}>
        <i className="ctx-menu-back-icon fa-solid fa-chevron-left" />
        <span className="ctx-menu-back-label">{entry.label}</span>
      </button>
      <div className="ctx-menu-divider" />
      <div className="ctx-menu-body">
        {entry.items.map((item, i) => (
          <MenuItem key={i} item={item} onClose={onClose} onEnter={onEnter} />
        ))}
      </div>
    </>
  );
}

// ── Menu item ────────────────────────────────────────────────────────

function MenuItem({
  item,
  onClose,
  onEnter,
}: {
  item: ContextMenuItem;
  onClose: () => void;
  onEnter: (item: ContextMenuItem) => void;
}) {
  const hasSubmenu = !!item.items?.length;

  const handleClick = () => {
    if (item.disabled) return;
    if (hasSubmenu) {
      onEnter(item);
    } else {
      item.onClick?.();
      onClose();
    }
  };

  return (
    <button
      type="button"
      className={[
        'ctx-menu-item',
        item.disabled ? 'ctx-menu-item--disabled' : '',
        hasSubmenu ? 'ctx-menu-item--submenu' : '',
        item.description ? 'ctx-menu-item--detailed' : '',
      ].filter(Boolean).join(' ')}
      onClick={handleClick}
      disabled={item.disabled}
    >
      {item.icon ? (
        <i className={`ctx-menu-item-icon ${item.icon}`} />
      ) : (
        <span className="ctx-menu-item-icon" />
      )}
      <span className="ctx-menu-item-text">
        <span className="ctx-menu-item-label">{item.label}</span>
        {item.description && (
          <span className="ctx-menu-item-desc">{item.description}</span>
        )}
      </span>
      {hasSubmenu && <i className="ctx-menu-chevron fa-solid fa-chevron-right" />}
    </button>
  );
}
