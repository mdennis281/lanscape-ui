/**
 * Type declarations for Electron preload API.
 * 
 * These types match the API exposed in electron/preload.ts
 */

export interface PythonStatus {
  initialized: boolean;
  serverRunning: boolean;
  version: string;
  port: number;
}

export interface ElectronAPI {
  getWsPort: () => Promise<number>;
  getPythonStatus: () => Promise<PythonStatus>;
  restartWsServer: () => Promise<{ success: boolean; error?: string }>;
  reinstallLanscape: () => Promise<{ success: boolean; error?: string }>;
  onPythonStatus: (callback: (status: string) => void) => () => void;
  onPythonError: (callback: (error: string) => void) => () => void;
  onPythonReady: (callback: () => void) => () => void;
  platform: 'aix' | 'android' | 'darwin' | 'freebsd' | 'haiku' | 'linux' | 'openbsd' | 'sunos' | 'win32' | 'cygwin' | 'netbsd';
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
