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

      this.setStatus('connecting');
      console.log(`Attempting to connect to: ${this.config.url}`);

      let settled = false;

      try {
        this.ws = new WebSocket(this.config.url);
        
        // Add timeout for connection attempt
        const connectTimeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            console.error('WebSocket connection timeout');
            this.ws?.close();
            this.setStatus('error');
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000); // 10 second timeout

        this.ws.onopen = () => {
          clearTimeout(connectTimeout);
          if (!settled) {
            settled = true;
            console.log('WebSocket connection established');
            this.setStatus('connected');
            this.reconnectAttempts = 0;
            resolve();
          }
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectTimeout);
          console.log('WebSocket connection closed:', event.code, event.reason);
          // Only reject if we haven't resolved yet (connection failed before opening)
          if (!settled) {
            settled = true;
            this.setStatus('error');
            reject(new Error(`WebSocket connection failed (code: ${event.code})`));
          } else {
            this.setStatus('disconnected');
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (event) => {
          // Don't reject here - onerror is always followed by onclose
          // Let onclose handle the rejection
          console.error('WebSocket error details:', {
            event,
            readyState: this.ws?.readyState,
            url: this.config.url,
            timestamp: new Date().toISOString()
          });
        };

        this.ws.onmessage = (event) => {
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

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts ?? 10)) {
      console.error('Max reconnection attempts reached');
      this.setStatus('error');
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Reconnection attempt ${this.reconnectAttempts}...`);
      this.connect().catch(() => {
        // Will be handled by onclose
      });
    }, this.config.reconnectInterval);
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
        console.log('Received server client_id:', this.clientId);
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

  async getConfigDefaults(): Promise<WSResponse> {
    return this.send('tools.config_defaults');
  }

  async isArpSupported(): Promise<WSResponse> {
    return this.send('tools.arp_supported');
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
