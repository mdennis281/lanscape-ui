/**
 * Startup version freshness check.
 *
 * Compares the baked-in __APP_VERSION__ (set at build time by Vite) against
 * the version.json that the backend is serving from its react_build directory.
 * If they differ the browser is running a stale cached build — all caches are
 * purged, service workers are unregistered, and the page is force-reloaded.
 */

interface VersionPayload {
  ui_version: string;
  build_time: string;
}

/**
 * Check whether the running frontend matches the build the backend is
 * serving.  When a mismatch is detected (e.g. after a pip upgrade),
 * all browser caches and service workers are purged and the page reloads.
 *
 * Call this **before** mounting the React tree so the user never sees
 * a flash of the stale UI.
 *
 * No-ops silently when:
 * - Running inside Electron (no SW / file:// caching issues)
 * - The fetch fails (dev server, offline, backend not ready yet)
 * - version.json is missing on the backend (pre-versioning build)
 */
export async function checkVersionFreshness(): Promise<void> {
  // Electron serves its own bundled build — no stale-cache problem.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).electronAPI) return;

  try {
    const resp = await fetch('./api/version', { cache: 'no-store' });
    if (!resp.ok) return;

    const data: VersionPayload = await resp.json();

    // 0.0.0 means the backend has no version.json (old build or dev mode).
    if (data.ui_version === '0.0.0') return;

    if (data.ui_version === __APP_VERSION__) return;

    console.warn(
      `[LANscape] UI version mismatch — ` +
      `running ${__APP_VERSION__}, server has ${data.ui_version}. ` +
      `Clearing caches and reloading…`
    );

    // Nuke all caches
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }

    // Force a true network reload (bypasses memory/disk cache)
    window.location.reload();
  } catch {
    // Fetch failed — dev mode, backend not up yet, network error.
    // Not actionable; let the app continue normally.
  }
}
