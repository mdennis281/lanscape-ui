/**
 * Utility functions for parsing query parameters and configuring WebSocket URL
 */

/**
 * Parse query parameters from the current URL
 */
export function parseQueryParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

/**
 * Get WebSocket URL from query parameters or environment variable
 * 
 * Query parameter format:
 * - ?ws-server=localhost:8767
 * - ?ws-server=192.168.1.100:8766
 * - ?ws-server=example.com:8766
 * 
 * @returns WebSocket URL string
 */
export function getWebSocketURL(): string {
  const params = parseQueryParams();
  const wsServer = params.get('ws-server');
  
  let url: string;
  
  if (wsServer) {
    // Ensure it starts with ws:// protocol
    if (wsServer.startsWith('ws://') || wsServer.startsWith('wss://')) {
      url = wsServer;
    } else {
      // Add ws:// protocol if not specified
      url = `ws://${wsServer}`;
    }
  } else {
    // Fall back to environment variable or default
    url = import.meta.env.VITE_WS_URL || 'ws://localhost:8766';
  }
  
  // Validate the URL format
  try {
    const wsUrl = new URL(url);
    if (wsUrl.protocol !== 'ws:' && wsUrl.protocol !== 'wss:') {
      console.error('Invalid WebSocket protocol:', wsUrl.protocol);
      return 'ws://localhost:8766'; // fallback
    }
    console.log('WebSocket URL validated:', url);
    return url;
  } catch (error) {
    console.error('Invalid WebSocket URL format:', url, error);
    return 'ws://localhost:8766'; // fallback to default
  }
}

/**
 * Update URL query parameters without page reload
 */
export function updateQueryParam(key: string, value: string | null): void {
  const url = new URL(window.location.href);
  
  if (value === null) {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  
  window.history.replaceState({}, '', url.toString());
}

/**
 * Get the current WebSocket server from URL for display
 */
export function getCurrentWSServer(): string {
  const params = parseQueryParams();
  const wsServer = params.get('ws-server');
  
  if (wsServer) {
    return wsServer.replace(/^wss?:\/\//, '');
  }
  
  const envUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8766';
  return envUrl.replace(/^wss?:\/\//, '');
}