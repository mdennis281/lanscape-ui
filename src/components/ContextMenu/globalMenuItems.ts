import type { ContextMenuSection } from './types';

/**
 * Returns the global section appended to every custom context menu.
 */
export function getGlobalSection(): ContextMenuSection {
  return {
    items: [
      {
        label: 'Reload UI',
        icon: 'fa-solid fa-rotate-right',
        onClick: () => window.location.reload(),
      },
      {
        label: 'Browser menu (Shift+Click)',
        icon: 'fa-solid fa-arrow-up-right-from-square',
        disabled: true,
      },
    ],
  };
}
