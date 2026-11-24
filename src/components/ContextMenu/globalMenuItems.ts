import type { ContextMenuSection } from './types';

/**
 * Returns the global section appended to every custom context menu.
 * The Shift+Click hint is dropped for touch, where there is no Shift.
 */
export function getGlobalSection(touch = false): ContextMenuSection {
  return {
    items: [
      {
        label: 'Reload UI',
        icon: 'fa-solid fa-rotate-right',
        onClick: () => window.location.reload(),
      },
      ...(touch
        ? []
        : [{
            label: 'Browser menu (Shift+Click)',
            icon: 'fa-solid fa-arrow-up-right-from-square',
            disabled: true,
          }]),
    ],
  };
}
