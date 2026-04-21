const DEFAULT_METRICS_URL = 'https://lanscape.app/api/metrics/launch';
const REQUEST_TIMEOUT_MS = 2000;
let metricSent = false;

function getMetricsUrl(): string {
  return import.meta.env.VITE_METRICS_URL || DEFAULT_METRICS_URL;
}

function getClientPlatform(): string {
  if (window.electronAPI) {
    return window.electronAPI.platform;
  }

  return navigator.platform || 'unknown';
}

export async function sendLaunchMetric(backendVersion: string): Promise<void> {
  if (metricSent) return;
  metricSent = true;

  try {
    await fetch(getMetricsUrl(), {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      keepalive: true,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        'ui-version': __APP_VERSION__,
        'backend-version': backendVersion,
        'x-client-kind': window.electronAPI ? 'electron' : 'browser',
        'x-platform': getClientPlatform(),
      },
    });
  } catch {
    // Offline-first: never block launch or surface telemetry failures.
  }
}