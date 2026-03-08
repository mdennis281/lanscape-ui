/**
 * WebSocket Protocol Types — matching lanscape/ui/ws/protocol.py
 *
 * The protocol uses a simple format:
 * - action: string like "scan.start", "tools.subnet_list"
 * - params: optional dict of parameters
 * - id: optional message ID for correlation
 */

export type MessageType =
  | 'request'
  | 'response'
  | 'error'
  | 'event';

/** Sent from client to server. */
export interface WSRequest {
  type: 'request';
  action: string;
  params?: Record<string, unknown>;
  id?: string;
}

/** Sent from server to client. */
export interface WSResponse {
  type: 'response';
  action: string;
  data?: unknown;
  success: boolean;
  id?: string;
}

/** Sent from server when an error occurs. */
export interface WSError {
  type: 'error';
  action?: string;
  error: string;
  traceback?: string;
  id?: string;
}

/** Server-initiated push notification. */
export interface WSEvent {
  type: 'event';
  event: string;
  data?: unknown;
}

export type WSMessage = WSRequest | WSResponse | WSError | WSEvent;
