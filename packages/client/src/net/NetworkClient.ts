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
    if (serverUrl) {
      this.serverUrl = serverUrl;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // If running on Vite dev server (port 5173), target default port 8080.
      // In production, client is served from the same host:port as WebSocket server.
      if (window.location.port === '5173') {
        const host = window.location.hostname || 'localhost';
        this.serverUrl = `${protocol}//${host}:8080`;
      } else {
        this.serverUrl = `${protocol}//${window.location.host}`;
      }
    }
  }

  public connect(roomCode: string = '', playerName: string = 'Operative'): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          if (roomCode && roomCode.trim().length > 0) {
            this.send({
              type: 'CMD_JOIN_ROOM',
              roomCode: roomCode.trim(),
              playerName,
            });
          } else {
            this.send({
              type: 'CMD_CREATE_ROOM',
              playerName,
            });
          }
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
          console.log('WebSocket closed.');
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
      this.send({ type: 'CMD_LEAVE_ROOM' });
      this.ws.close();
      this.ws = null;
    }
  }

  private notifyHandlers(msg: ServerMessage): void {
    for (const handler of this.messageHandlers) {
      handler(msg);
    }
  }
}
