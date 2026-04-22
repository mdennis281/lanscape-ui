/**
 * WebSocket Service - handles connection to LANscape WebSocket server
 */

import type { 
  WSMessage, 
  WSRequest, 
  WSResponse, 
  WSError, 
  WSEvent
} from '../types';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketServiceConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onStatusChange?: (status: ConnectionStatus) => void;
  onEvent?: (event: WSEvent) => void;
  onError?: (error: WSError) => void;
}

type RequestCallback = {
  resolve: (response: WSResponse) => void;
  reject: (error: WSError) => void;
  timeout: ReturnType<typeof setTimeout>;
};

class WebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketServiceConfig;
  private status: ConnectionStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRequests = new Map<string, RequestCallback>();
  private requestIdCounter = 0;
  private clientId: string;
  private suppressReconnect = false;

  constructor(config: WebSocketServiceConfig) {
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      ...config,
    };
    // Generate a unique client ID for this session
    this.clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getClientId(): string {
    return this.clientId;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestIdCounter}`;
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.config.onStatusChange?.(status);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.suppressReconnect = false;
      this.setStatus('connecting');

      let settled = false;

      try {
        const ws = new WebSocket(this.config.url);
        this.ws = ws;

        // Add timeout for connection attempt
        const connectTimeout = setTimeout(() => {
          if (!settled && this.ws === ws) {
            settled = true;
            ws.close(); // triggers onclose which handles reconnect
            reject(new Error('WebSocket connection timeout'));
          }
        }, 4000); // 4 second timeout

        ws.onopen = () => {
          // Guard against stale sockets: a previous failed attempt may close
          // after a newer connection has already succeeded.
          if (this.ws !== ws) return;
          clearTimeout(connectTimeout);
          if (!settled) {
            settled = true;
            this.setStatus('connected');
            this.reconnectAttempts = 0;
            resolve();
          }
        };

        ws.onclose = (event) => {
          // Ignore close events from sockets that have already been replaced.
          if (this.ws !== ws) return;
          clearTimeout(connectTimeout);
          // Reject if we haven't resolved yet (connection failed before opening)
          if (!settled) {
            settled = true;
            reject(new Error(`WebSocket connection failed (code: ${event.code})`));
          }
          // Always mark disconnected and retry — 'error' is only set when
          // scheduleReconnect exhausts all attempts.
          this.setStatus('disconnected');
          this.scheduleReconnect();
        };

        ws.onerror = () => {
          // Don't reject here - onerror is always followed by onclose
          // Let onclose handle the rejection
        };

        ws.onmessage = (event) => {
          if (this.ws !== ws) return;
          this.handleMessage(event.data);
        };
      } catch (error) {
        console.error('WebSocket creation failed:', error);
        this.setStatus('error');
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.suppressReconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Reject all pending requests
    for (const [, callback] of this.pendingRequests) {
      clearTimeout(callback.timeout);
      callback.reject({
        type: 'error',
        error: 'Connection closed',
      });
    }
    this.pendingRequests.clear();
    
    this.setStatus('disconnected');
  }

  /**
   * Change the WebSocket URL and reconnect.
   * Does NOT reload the page.
   */
  updateUrl(url: string): void {
    this.config.url = url;
    this.reconnectAttempts = 0;
    this.suppressReconnect = false;
  }

  getUrl(): string {
    return this.config.url;
  }

  /**
   * Cancel any pending auto-reconnect without fully disconnecting.
   * Use this when the user starts manually editing the connection string
   * so auto-reconnect doesn't fight with their input.
   */
  cancelReconnect(): void {
    this.suppressReconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    // If we're currently in a connecting state from auto-reconnect, surface that
    if (this.status === 'connecting' && this.ws) {
      this.ws.close();
      this.ws = null;
      this.setStatus('disconnected');
    }
  }

  /** Whether the service is currently auto-reconnecting. */
  isReconnecting(): boolean {
    return this.reconnectTimer !== null || (this.status === 'connecting' && this.reconnectAttempts > 0);
  }

  private scheduleReconnect(): void {
    if (this.suppressReconnect) {
      return;
    }
    const maxAttempts = this.config.maxReconnectAttempts ?? 10;
    // 0 means unlimited retries (never give up)
    if (maxAttempts > 0 && this.reconnectAttempts >= maxAttempts) {
      this.setStatus('error');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, capped at 15s
    const baseDelay = 1000;
    const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), 15000);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.connect().catch(() => {
        // Will be handled by onclose
      });
    }, delay);
  }

  private handleMessage(data: string): void {
    try {
      const message: WSMessage = JSON.parse(data);

      switch (message.type) {
        case 'response':
          this.handleResponse(message);
          break;
        case 'error':
          this.handleErrorMessage(message);
          break;
        case 'event':
          this.handleEvent(message);
          break;
        default:
          console.warn('Unknown message type:', message);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleResponse(response: WSResponse): void {
    if (response.id && this.pendingRequests.has(response.id)) {
      const callback = this.pendingRequests.get(response.id)!;
      clearTimeout(callback.timeout);
      this.pendingRequests.delete(response.id);
      callback.resolve(response);
    }
  }

  private handleErrorMessage(error: WSError): void {
    if (error.id && this.pendingRequests.has(error.id)) {
      const callback = this.pendingRequests.get(error.id)!;
      clearTimeout(callback.timeout);
      this.pendingRequests.delete(error.id);
      callback.reject(error);
    } else {
      this.config.onError?.(error);
    }
  }

  private handleEvent(event: WSEvent): void {
    // Capture the server-assigned client_id from connection.established
    if (event.event === 'connection.established') {
      const data = event.data as Record<string, unknown>;
      if (data?.client_id) {
        this.clientId = data.client_id as string;
      }
    }
    this.config.onEvent?.(event);
  }

  async send(
    action: string,
    params?: Record<string, unknown>,
    timeout = 30000
  ): Promise<WSResponse> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject({
          type: 'error',
          action,
          error: 'WebSocket not connected',
        } as WSError);
        return;
      }

      const requestId = this.generateRequestId();

      const request: WSRequest = {
        type: 'request',
        action,
        params,
        id: requestId,
      };

      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject({
          type: 'error',
          action,
          id: requestId,
          error: 'Request timeout',
        } as WSError);
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      this.ws.send(JSON.stringify(request));
    });
  }

  // Convenience methods for each handler

  // Scan handler methods
  async startScan(config: Record<string, unknown>): Promise<WSResponse> {
    return this.send('scan.start', config);
  }

  async getScan(scanId: string): Promise<WSResponse> {
    return this.send('scan.get', { scan_id: scanId });
  }

  async getScanDelta(scanId: string): Promise<WSResponse> {
    return this.send('scan.get_delta', { scan_id: scanId, client_id: this.clientId });
  }

  async getPortDetail(scanId: string, ip: string, port: number): Promise<WSResponse> {
    return this.send('scan.get_port_detail', { scan_id: scanId, ip, port });
  }

  async getScanSummary(scanId: string): Promise<WSResponse> {
    return this.send('scan.summary', { scan_id: scanId });
  }

  async terminateScan(scanId: string): Promise<WSResponse> {
    return this.send('scan.terminate', { scan_id: scanId });
  }

  async subscribeScan(scanId: string): Promise<WSResponse> {
    return this.send('scan.subscribe', { scan_id: scanId, client_id: this.clientId });
  }

  async unsubscribeScan(scanId: string): Promise<WSResponse> {
    return this.send('scan.unsubscribe', { scan_id: scanId, client_id: this.clientId });
  }

  async listScans(): Promise<WSResponse> {
    return this.send('scan.list');
  }

  async getScanHistory(): Promise<WSResponse> {
    return this.send('scan.history');
  }

  async appendStages(scanId: string, stages: { stage_type: string; config: Record<string, unknown> }[]): Promise<WSResponse> {
    return this.send('scan.append_stages', { scan_id: scanId, stages });
  }

  async updateStage(scanId: string, index: number, stageType: string, config: Record<string, unknown>): Promise<WSResponse> {
    return this.send('scan.update_stage', { scan_id: scanId, index, stage_type: stageType, config });
  }

  // Port handler methods
  async listPorts(): Promise<WSResponse> {
    return this.send('port.list');
  }

  async listPortsSummary(): Promise<WSResponse> {
    return this.send('port.list_summary');
  }

  async getPort(portListName: string): Promise<WSResponse> {
    return this.send('port.get', { name: portListName });
  }

  // Tools handler methods
  async testSubnet(subnet: string): Promise<WSResponse> {
    return this.send('tools.subnet_test', { subnet });
  }

  async listSubnets(): Promise<WSResponse> {
    return this.send('tools.subnet_list');
  }

  async getStageDefaults(): Promise<WSResponse> {
    return this.send('tools.stage_defaults');
  }

  async getStagePresets(): Promise<WSResponse> {
    return this.send('tools.stage_presets');
  }

  async getStageEstimate(stageType: string, config: Record<string, unknown>): Promise<WSResponse> {
    return this.send('tools.stage_estimate', { stage_type: stageType, config });
  }

  async isArpSupported(): Promise<WSResponse> {
    return this.send('tools.arp_supported');
  }

  async getAutoStages(subnet: string): Promise<WSResponse> {
    return this.send('tools.auto_stages', { subnet });
  }

  async getAppInfo(): Promise<WSResponse> {
    return this.send('tools.app_info');
  }

  async checkForUpdates(): Promise<WSResponse> {
    return this.send('tools.update_check');
  }

  // Debug handler methods
  async getJobStats(): Promise<WSResponse> {
    return this.send('debug.job_stats');
  }

  async resetJobStats(): Promise<WSResponse> {
    return this.send('debug.job_stats_reset');
  }

  async clearArpTable(): Promise<WSResponse> {
    return this.send('debug.clear_arp');
  }

  async clearNdpTable(): Promise<WSResponse> {
    return this.send('debug.clear_ndp');
  }
}

// Singleton instance
let wsServiceInstance: WebSocketService | null = null;

export function getWebSocketService(): WebSocketService | null {
  return wsServiceInstance;
}

export function createWebSocketService(
  config: WebSocketServiceConfig
): WebSocketService {
  if (wsServiceInstance) {
    wsServiceInstance.disconnect();
  }
  wsServiceInstance = new WebSocketService(config);
  return wsServiceInstance;
}

export { WebSocketService };
