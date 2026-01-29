/**
 * Electron preload script.
 * 
 * Exposes a safe API to the renderer process via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Get WebSocket server port
  getWsPort: (): Promise<number> => ipcRenderer.invoke('get-ws-port'),

  // Get Python environment status
  getPythonStatus: (): Promise<{
    initialized: boolean;
    serverRunning: boolean;
    version: string;
  }> => ipcRenderer.invoke('get-python-status'),

  // Restart WebSocket server
  restartWsServer: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('restart-ws-server'),

  // Reinstall LANscape
  reinstallLanscape: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('reinstall-lanscape'),

  // Listen for Python status updates
  onPythonStatus: (callback: (status: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: string) => callback(status);
    ipcRenderer.on('python-status', handler);
    return () => ipcRenderer.removeListener('python-status', handler);
  },

  // Listen for Python errors
  onPythonError: (callback: (error: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error);
    ipcRenderer.on('python-error', handler);
    return () => ipcRenderer.removeListener('python-error', handler);
  },

  // Listen for Python ready event
  onPythonReady: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('python-ready', handler);
    return () => ipcRenderer.removeListener('python-ready', handler);
  },

  // Platform info
  platform: process.platform,
});

// Type declarations for the exposed API
declare global {
  interface Window {
    electronAPI?: {
      getWsPort: () => Promise<number>;
      getPythonStatus: () => Promise<{
        initialized: boolean;
        serverRunning: boolean;
        version: string;
        port: number;
      }>;
      restartWsServer: () => Promise<{ success: boolean; error?: string }>;
      reinstallLanscape: () => Promise<{ success: boolean; error?: string }>;
      onPythonStatus: (callback: (status: string) => void) => () => void;
      onPythonError: (callback: (error: string) => void) => () => void;
      onPythonReady: (callback: () => void) => () => void;
      platform: NodeJS.Platform;
    };
  }
}
