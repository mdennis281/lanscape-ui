/**
 * Utility functions for parsing query parameters and configuring WebSocket URL
 */

import '../types/electron'; // Import electron types for global Window augmentation

// Cache the port once resolved
let cachedPort: number | null = null;

/**
 * Parse query parameters from the current URL
 */
export function parseQueryParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

/**
 * Get the WebSocket port - from Electron if available, otherwise from URL/env
 */
export async function getWebSocketPort(): Promise<number> {
  // Return cached port if available
  if (cachedPort !== null) {
    return cachedPort;
  }

  // If running in Electron, get the port from the main process
  if (window.electronAPI) {
    try {
      cachedPort = await window.electronAPI.getWsPort();
      console.log('Got WebSocket port from Electron:', cachedPort);
      return cachedPort;
    } catch (error) {
      console.error('Failed to get port from Electron:', error);
    }
  }

  // Parse from URL query parameter
  const params = parseQueryParams();
  const wsServer = params.get('ws-server');
  if (wsServer) {
    try {
      const url = wsServer.startsWith('ws://') || wsServer.startsWith('wss://')
        ? wsServer
        : `ws://${wsServer}`;
      const parsed = new URL(url);
      cachedPort = parseInt(parsed.port, 10) || 8766;
      return cachedPort;
    } catch {
      // Invalid URL, fall through to default
    }
  }

  // Fall back to environment variable or default
  const envUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8766';
  try {
    const parsed = new URL(envUrl);
    cachedPort = parseInt(parsed.port, 10) || 8766;
  } catch {
    cachedPort = 8766;
  }
  
  return cachedPort;
}

/**
 * Set the cached port (used by startup screen when receiving port from Electron)
 */
export function setWebSocketPort(port: number): void {
  cachedPort = port;
}

/**
 * Get WebSocket URL from query parameters or environment variable
 * 
 * Query parameter format:
 * - ?ws-server=localhost:8767
 * - ?ws-server=192.168.1.100:8766
 * - ?ws-server=example.com:8766
 * 
 * @param port - Optional port override (used when port is known from Electron)
 * @returns WebSocket URL string
 */
export function getWebSocketURL(port?: number): string {
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
  } else if (port !== undefined) {
    // Use the provided port (from Electron)
    url = `ws://localhost:${port}`;
  } else if (cachedPort !== null) {
    // Use cached port
    url = `ws://localhost:${cachedPort}`;
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