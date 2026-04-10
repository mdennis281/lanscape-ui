/**
 * Connection state — WebSocket status, errors, service reference, and app info.
 */

import { create } from 'zustand';
import type { AppInfo } from '../types';
import type { ConnectionStatus, WebSocketService } from '../services/websocket';

interface ConnectionState {
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  connectionError: string | null;
  setConnectionError: (error: string | null) => void;

  /** Stored so legacy callers can access the service from the store. Prefer
   *  importing `getWebSocketService()` from `services/websocket` instead. */
  wsService: WebSocketService | null;
  setWsService: (ws: WebSocketService | null) => void;

  appInfo: AppInfo | null;
  setAppInfo: (info: AppInfo | null) => void;
  mergeAppInfo: (partial: Partial<AppInfo>) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connectionStatus: 'disconnected',
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  connectionError: null,
  setConnectionError: (connectionError) => set({ connectionError }),

  wsService: null,
  setWsService: (wsService) => set({ wsService }),

  appInfo: null,
  setAppInfo: (appInfo) => set({ appInfo }),
  mergeAppInfo: (partial) => set((state) => ({
    appInfo: state.appInfo ? { ...state.appInfo, ...partial } : partial as AppInfo,
  })),
}));
