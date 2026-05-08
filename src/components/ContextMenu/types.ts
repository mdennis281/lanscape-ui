export interface ContextMenuItem {
  label: string;
  /** Optional second-line description (used by nested-menu submenu entries) */
  description?: string;
  icon?: string;
  onClick?: () => void;
  disabled?: boolean;
  /**
   * Submenu items — when present, clicking the entry navigates into a nested
   * view with a back button (replaces the prior side-panel hover behaviour).
   */
  items?: ContextMenuItem[];
}

export interface ContextMenuSection {
  label?: string;
  items: ContextMenuItem[];
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ContextMenuAnchor {
  /** Bounding rect to anchor the menu below (or above on flip). */
  rect: DOMRect;
}

export interface ContextMenuProps {
  sections: ContextMenuSection[];
  /** Mouse position (right-click). One of position/anchor must be provided. */
  position?: ContextMenuPosition;
  /** Element rect to anchor below — used for popover-style menus. */
  anchor?: ContextMenuAnchor;
  /**
   * Body max-height in px, or 'auto' (default). 'auto' clamps to whatever
   * vertical room is available between the menu top and viewport bottom,
   * so the body scrolls instead of overflowing off-screen.
   */
  maxHeight?: number | 'auto';
  onClose: () => void;
}
