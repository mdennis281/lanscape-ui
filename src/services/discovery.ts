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
