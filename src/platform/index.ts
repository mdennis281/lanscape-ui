import { isIOS, lockPageZoom, trackHomeIndicator } from './ios';
import { installLongPressContextMenu, isLongPressEvent } from './longPress';

/**
 * Was this `contextmenu` raised by a finger rather than a mouse?
 *
 * Covers both our iOS long-press recogniser and Android Chrome's native one,
 * which reports the press as a touch `PointerEvent`.
 */
export function isTouchContextMenu(e: Event): boolean {
  return isLongPressEvent(e) || (e as Partial<PointerEvent>).pointerType === 'touch';
}

/** Install the platform shims. Call once, before the first render. */
export function initPlatform(): void {
  if (!isIOS()) return;
  lockPageZoom();
  trackHomeIndicator();
  installLongPressContextMenu();
}
