import { useState, useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ContextMenuPosition, ContextMenuSection } from './types';

interface ContextMenuState {
  visible: boolean;
  position: ContextMenuPosition;
}

interface UseContextMenuReturn {
  /** Whether the menu is currently visible */
  visible: boolean;
  /** Current menu position */
  position: ContextMenuPosition;
  /** Close the menu */
  close: () => void;
  /**
   * Create an onContextMenu handler.
   * Pass a callback that returns the sections to display.
   * Shift+Right Click bypasses the custom menu and shows the native browser menu.
   */
  handleContextMenu: (
    e: ReactMouseEvent,
    getSections: () => ContextMenuSection[],
  ) => void;
  /** The sections to render (set by latest handleContextMenu call) */
  sections: ContextMenuSection[];
}

export function useContextMenu(): UseContextMenuReturn {
  const [state, setState] = useState<ContextMenuState>({
    visible: false,
    position: { x: 0, y: 0 },
  });
  const [sections, setSections] = useState<ContextMenuSection[]>([]);


  const close = useCallback(() => {
    setState({ visible: false, position: { x: 0, y: 0 } });
  }, []);

  const handleContextMenu = useCallback(
    (e: ReactMouseEvent, getSections: () => ContextMenuSection[]) => {
      // Shift+Right Click → let native browser menu through
      if (e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      setSections(getSections());
      setState({ visible: true, position: { x: e.clientX, y: e.clientY } });
    },
    [],
  );

  return {
    visible: state.visible,
    position: state.position,
    close,
    handleContextMenu,
    sections,
  };
}
