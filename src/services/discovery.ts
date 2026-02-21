/**
 * mDNS discovery helper.
 *
 * Calls the ``/api/discover`` endpoint on the *same origin* that served
 * the frontend.  This endpoint is provided by the Python HTTP proxy
 * (SPAHandler) and returns a list of LANscape backends found on the
 * local network via mDNS/DNS-SD.
 *
 * When the frontend is served from a different origin (e.g. during
 * development or standalone Electron mode) the request will silently
 * return an empty array.
 */

/** Shape of a single discovered backend instance. */
export interface DiscoveredBackend {
  host: string;
  ws_port: number;
  http_port: number;
  version: string;
  hostname: string;
}

/**
 * Probe whether a discovered backend is actually reachable by attempting a
 * WebSocket handshake.  The socket is closed immediately on success.
 *
 * @param backend  The backend to probe.
 * @param timeoutMs  How long to wait before declaring unreachable (default 2 s).
 * @returns ``true`` if the handshake succeeded, ``false`` otherwise.
 */
export function probeBackend(
  backend: DiscoveredBackend,
  timeoutMs = 2000,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      resolve(ok);
    };

    const ws = new WebSocket(`ws://${backend.host}:${backend.ws_port}`);
    const timer = setTimeout(() => settle(false), timeoutMs);
    ws.onopen  = () => settle(true);
    ws.onerror = () => settle(false);
  });
}

/**
 * Fetch the list of LANscape backends discovered via mDNS.
 *
 * @returns Array of discovered backends, or an empty array on any failure.
 */
export async function fetchDiscoveredBackends(): Promise<DiscoveredBackend[]> {
  try {
    const res = await fetch('/api/discover', {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return [];

    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];

    return data as DiscoveredBackend[];
  } catch {
    // Endpoint not available (CORS, network error, timeout, etc.)
    return [];
  }
}
