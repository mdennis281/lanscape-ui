/**
 * iOS / iPadOS web-app quirks that CSS alone cannot handle.
 *
 * Background, so nobody has to rediscover it: `index.html` deliberately does
 * NOT set `viewport-fit=cover`. With it, an installed iOS web app's window
 * shrinks by the status bar on the first keyboard raise and never recovers
 * (WebKit #237961), and the bottom band is never painted again. Without it,
 * iOS lays the window out below the status bar, which is the layout we want,
 * but every `env(safe-area-inset-*)` then reads 0. The home indicator is still
 * there, so its clearance is measured here and published as `--home-indicator`.
 */

/** iPhone, iPod, or an iPad (iPadOS asks for the desktop site and calls itself a Mac). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Launched from the home screen rather than in a Safari tab. */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Hold the page at 1:1 in a Safari tab.
 *
 * The installed app obeys `user-scalable=no`; Safari tabs have ignored it since
 * iOS 10. Cancelling WebKit's non-standard `gesture*` events is the one lever
 * left. No other engine fires them, so this is inert elsewhere. Double-tap zoom
 * has no event to cancel and is handled by `touch-action: manipulation` in CSS.
 */
export function lockPageZoom(): void {
  // `passive: false` is mandatory: a passive listener's preventDefault is a no-op.
  const block = (e: Event) => e.preventDefault();
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, block, { passive: false });
  }
}

/** Height of the home-indicator band on Face ID iPhones, in CSS px. */
const HOME_INDICATOR_PX = 34;
/** A status bar this tall or taller means a notch / Dynamic Island phone. */
const NOTCHED_STATUS_BAR_PX = 40;

/**
 * Publish `--home-indicator` for the installed iOS app.
 *
 * Without `viewport-fit=cover` the window starts below the status bar, so
 * `screen.height - innerHeight` IS the status bar. A tall one (>= 40px) means a
 * Face ID phone, which has a home indicator overlapping the bottom of the
 * window. A Safari tab is skipped: its own toolbar already clears the indicator.
 *
 * While the keyboard is up the visual viewport is shorter than the window and
 * the reading is meaningless, so the last good value is kept.
 */
export function trackHomeIndicator(): void {
  if (!isIOS() || !isStandalone()) return;

  const root = document.documentElement;
  let last = -1;

  const measure = () => {
    const vv = window.visualViewport;
    const keyboardUp = !!vv && (window.innerHeight - vv.height > 1 || Math.round(vv.offsetTop) !== 0);
    if (keyboardUp) return;

    const statusBar = window.screen.height - window.innerHeight;
    const inset = statusBar >= NOTCHED_STATUS_BAR_PX ? HOME_INDICATOR_PX : 0;
    if (inset !== last) {
      last = inset;
      root.style.setProperty('--home-indicator', `${inset}px`);
    }
  };

  measure();
  window.addEventListener('resize', measure);
  window.visualViewport?.addEventListener('resize', measure);
}
