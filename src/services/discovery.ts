/**
 * Discovery helper.
 *
 * Calls the ``/api/discover`` endpoint on the *same origin* that served
 * the frontend.  This endpoint is provided by the Python HTTP proxy
 * (SPAHandler) and returns information about the server including
 * mDNS-discovered backends, the default connection route, and whether
 * mDNS is enabled.
 *
 * When the frontend is served from a different origin (e.g. during
 * development or standalone Electron mode) the request will silently
 * return a fallback response.
 */

/** Shape of a single discovered backend instance. */
export interface DiscoveredBackend {
  host: string;
  ws_port: number;
  http_port: number;
  version: string;
  hostname: string;
}

/** Full response from ``/api/discover``. */
export interface DiscoverResponse {
  mdns_enabled: boolean;
  default_route: string;
  instances: DiscoveredBackend[];
}

const FALLBACK_RESPONSE: DiscoverResponse = {
  mdns_enabled: false,
  default_route: '',
  instances: [],
};

/**
 * Fetch discovery info from the backend.
 *
 * @returns The full discover response, or a safe fallback on any failure.
 */
export async function fetchDiscoverInfo(): Promise<DiscoverResponse> {
  try {
    const res = await fetch('/api/discover', {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return FALLBACK_RESPONSE;

    const data: unknown = await res.json();

    // Support the new object shape
    if (
      data !== null &&
      typeof data === 'object' &&
      'instances' in data
    ) {
      return data as DiscoverResponse;
    }

    // Backwards-compat: if the backend somehow returns a bare array
    if (Array.isArray(data)) {
      return {
        mdns_enabled: true,
        default_route: '',
        instances: data as DiscoveredBackend[],
      };
    }

    return FALLBACK_RESPONSE;
  } catch {
    // Endpoint not available (CORS, network error, timeout, etc.)
    return FALLBACK_RESPONSE;
  }
}
