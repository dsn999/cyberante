// ============================================================================
// CYBERANTE: WebSocket Client Transport
// ============================================================================

import { ClientMessage, ServerMessage } from '@cyberante/shared';

export type ServerMessageHandler = (msg: ServerMessage) => void;

export class NetworkClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private messageHandlers: Set<ServerMessageHandler> = new Set();
  private reconnectTimer: number | null = null;

  constructor(serverUrl?: string) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    this.serverUrl = serverUrl || `${protocol}//${host}:8080`;
  }

  public connect(roomCode: string = '', playerName: string = 'Operative'): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          this.send({
            type: 'CMD_JOIN_ROOM',
            roomCode,
            playerName,
          });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg: ServerMessage = JSON.parse(event.data);
            this.notifyHandlers(msg);
          } catch (err) {
            console.error('Failed to parse server message:', err);
          }
        };

        this.ws.onerror = (err) => {
          console.warn('WebSocket error encountered:', err);
          reject(err);
        };

        this.ws.onclose = () => {
          console.log('WebSocket closed. Attempting reconnect in 3s...');
          this.scheduleReconnect(roomCode, playerName);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  public send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public onMessage(handler: ServerMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  public disconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private notifyHandlers(msg: ServerMessage): void {
    for (const handler of this.messageHandlers) {
      handler(msg);
    }
  }

  private scheduleReconnect(roomCode: string, playerName: string): void {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(roomCode, playerName).catch(() => {});
    }, 3000);
  }
}
