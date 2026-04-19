export interface ContextMenuItem {
  label: string;
  icon?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Submenu items — shown on hover */
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

export interface ContextMenuProps {
  sections: ContextMenuSection[];
  position: ContextMenuPosition;
  onClose: () => void;
}
