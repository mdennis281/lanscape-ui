/**
 * Touch long-press → `contextmenu`, for iOS.
 *
 * iOS Safari never fires `contextmenu`, so every right-click menu in the app
 * (device rows, stages, presets, the logo) would be unreachable on an iPhone.
 * Rather than wiring a hook into each of those call sites, this installs ONE
 * document-level recogniser that turns a still touch hold into a synthetic
 * `contextmenu` on the element under the finger. React's `onContextMenu`
 * handlers receive it like any other, so every existing and future menu works
 * on touch with no call-site changes.
 *
 * Android Chrome already raises `contextmenu` from its own long-press, so this
 * is only installed on iOS. Otherwise both would fire and open the menu twice.
 *
 * Rules:
 *  - Touch only. A mouse or pen already has a right button.
 *  - A press that drifts more than `HOLD_SLOP_PX` is a scroll and is abandoned.
 *    So is one that iOS hands to its own gesture (`pointercancel`).
 *  - If a handler opened something (called `preventDefault`), the tail of the
 *    gesture (the compat `mousedown`/`mouseup`/`click` iOS sends on release) is
 *    swallowed. Otherwise lifting the finger would immediately "click" the row
 *    under it, or land on the menu that just opened beneath it. The swallow
 *    ends at the next `pointerdown`, so it can never latch.
 */

/**
 * How long a finger must stay put to count as a hold (ms). Long enough that an
 * unhurried tap stays a tap, short enough to beat iOS's own text-selection
 * press.
 */
const HOLD_MS = 450;
/** How far the finger may drift during a hold before it counts as a scroll (px). */
const HOLD_SLOP_PX = 10;

/** Synthetic events this module dispatched. Lets a menu tell a long-press from a right-click. */
const longPressEvents = new WeakSet<Event>();

/** Was this `contextmenu` raised by a touch long-press (rather than a mouse)? */
export function isLongPressEvent(e: Event): boolean {
  return longPressEvents.has(e);
}

/** Never start a hold on something that has its own long-press behaviour (text editing). */
const NATIVE_HOLD_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

export function installLongPressContextMenu(): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let origin: { x: number; y: number } | null = null;
  let target: Element | null = null;
  let swallowTail = false;

  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    origin = null;
    target = null;
  };

  const fire = () => {
    timer = undefined;
    if (!target || !origin) return;
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: origin.x,
      clientY: origin.y,
      button: 2,
    });
    longPressEvents.add(event);
    const handled = !target.dispatchEvent(event);
    if (handled) {
      swallowTail = true;
      navigator.vibrate?.(10);
    }
    origin = null;
    target = null;
  };

  document.addEventListener(
    'pointerdown',
    (e) => {
      swallowTail = false;
      cancel();
      if (e.pointerType !== 'touch' || !e.isPrimary) return;
      const el = e.target instanceof Element ? e.target : null;
      if (!el || el.closest(NATIVE_HOLD_SELECTOR)) return;
      origin = { x: e.clientX, y: e.clientY };
      target = el;
      timer = setTimeout(fire, HOLD_MS);
    },
    { capture: true, passive: true },
  );

  document.addEventListener(
    'pointermove',
    (e) => {
      if (!timer || !origin) return;
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > HOLD_SLOP_PX) cancel();
    },
    { capture: true, passive: true },
  );

  for (const type of ['pointerup', 'pointercancel'] as const) {
    document.addEventListener(type, cancel, { capture: true, passive: true });
  }
  // Any scroll means the finger is panning, not holding.
  window.addEventListener('scroll', () => timer && cancel(), { capture: true, passive: true });

  // Registered on `window` in capture so they run before every document-level
  // listener, including the context menu's own outside-click closer.
  const swallow = (e: Event) => {
    if (!swallowTail) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'click') swallowTail = false;
  };
  for (const type of ['mousedown', 'mouseup', 'click'] as const) {
    window.addEventListener(type, swallow, { capture: true });
  }
}
