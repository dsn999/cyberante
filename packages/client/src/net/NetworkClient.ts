import type { ClientMessage, ServerMessage, Stance, Suit } from '@cyberante/shared';

export type ServerMessageHandler = (message: ServerMessage) => void;
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'sessionExpired';
interface Session { roomCode: string; playerId: string; sessionToken: string }
interface NetworkEvents {
  message: ServerMessage;
  status: ConnectionStatus;
}

/** Transport and authenticated seat recovery. Credentials stay in this tab. */
export class NetworkClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private messageHandlers = new Set<ServerMessageHandler>();
  private statusHandlers = new Set<(status: ConnectionStatus) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private handshakeTimer: ReturnType<typeof setTimeout> | undefined;
  private openTimer: ReturnType<typeof setTimeout> | undefined;
  private recoveryTimer: ReturnType<typeof setTimeout> | undefined;
  private cancelOpen: (() => void) | undefined;
  private session: Session | null = null;
  private recoveryDeadline = 0;
  private recovering = false;
  private attempts = 0;

  constructor(serverUrl?: string) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.serverUrl = serverUrl ?? `${protocol}//${window.location.host}/ws`;
    this.readSession();
  }

  public get isConnected(): boolean { return this.ws?.readyState === WebSocket.OPEN && !this.recovering; }
  public get hasSession(): boolean { return this.session !== null; }
  private get storageKey(): string { return `cyberante.session:${this.serverUrl}`; }

  public on<K extends keyof NetworkEvents>(event: K, callback: (value: NetworkEvents[K]) => void): () => void {
    if (event === 'message') return this.onMessage(callback as ServerMessageHandler);
    const handler = callback as (status: ConnectionStatus) => void;
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  public onMessage(handler: ServerMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  public connect(url?: string): Promise<void> {
    if (this.ws) return Promise.reject(new Error('A connection is already active'));
    if (url && url !== this.serverUrl) {
      this.session = null;
      this.serverUrl = url;
      this.readSession();
    }
    if (this.session) {
      this.recovering = true;
      this.beginRecovery();
      this.status('reconnecting');
    }
    return new Promise((resolve, reject) => {
      let opened = false;
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(this.openTimer);
        this.cancelOpen = undefined;
        if (error) reject(error); else resolve();
      };
      this.cancelOpen = () => finish(new Error('Connection cancelled'));
      let socket: WebSocket;
      try { socket = new WebSocket(this.serverUrl); }
      catch (error) {
        finish(error instanceof Error ? error : new Error('Connection failed'));
        if (this.session) this.retry();
        return;
      }
      this.ws = socket;
      this.openTimer = setTimeout(() => {
        if (this.ws !== socket) return;
        finish(new Error('Connection timed out'));
        socket.close();
      }, 5000);
      socket.onopen = () => {
        if (this.ws !== socket) return;
        opened = true;
        finish();
        if (this.recovering && this.session) {
          this.transmit({ type: 'CMD_RECONNECT', ...this.session });
          this.handshakeTimer = setTimeout(() => {
            if (this.ws === socket && this.recovering) socket.close();
          }, 5000);
        } else this.status('connected');
      };
      socket.onmessage = event => {
        if (this.ws !== socket || typeof event.data !== 'string') return;
        let message: ServerMessage;
        try {
          const parsed: unknown = JSON.parse(event.data);
          if (!parsed || typeof parsed !== 'object' || !('type' in parsed)
            || !['STATE_INIT', 'STATE_TICK', 'ROUND_OUTCOME', 'ERROR_REJECTED'].includes(String(parsed.type))) return;
          message = parsed as ServerMessage;
        } catch { return; }
        if (message.type === 'STATE_INIT') {
          if (message.sessionToken) {
            this.session = { roomCode: message.roomCode, playerId: message.playerId, sessionToken: message.sessionToken };
            this.persistSession();
          }
          clearTimeout(this.handshakeTimer);
          const wasRecovering = this.recovering;
          this.recovering = false;
          this.recoveryDeadline = 0;
          clearTimeout(this.recoveryTimer);
          this.attempts = 0;
          if (wasRecovering) this.status('connected');
        } else if (message.type === 'ERROR_REJECTED' && this.recovering) {
          this.expireSession();
          return;
        }
        this.messageHandlers.forEach(handler => handler(message));
      };
      socket.onerror = () => {
        if (this.ws !== socket) return;
        if (!opened) finish(new Error('Unable to connect to the multiplayer server'));
        socket.close();
      };
      socket.onclose = () => {
        if (this.ws !== socket) return;
        this.ws = null;
        clearTimeout(this.openTimer);
        clearTimeout(this.handshakeTimer);
        finish(new Error('Connection closed'));
        if (this.session) this.retry();
        else this.status('disconnected');
      };
    });
  }

  private retry(): void {
    this.beginRecovery();
    if (Date.now() >= this.recoveryDeadline) { this.expireSession(); return; }
    this.recovering = true;
    this.status('reconnecting');
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(500 * 2 ** this.attempts++, 2000, this.recoveryDeadline - Date.now());
    this.reconnectTimer = setTimeout(() => {
      if (!this.session) return;
      if (Date.now() >= this.recoveryDeadline) { this.expireSession(); return; }
      this.connect().catch(() => {
        // Socket close schedules retries; constructor failures have no close event.
        if (!this.ws && this.session) this.retry();
      });
    }, delay);
  }

  private beginRecovery(): void {
    if (this.recoveryDeadline) return;
    this.recoveryDeadline = Date.now() + 30000;
    this.recoveryTimer = setTimeout(() => this.expireSession(), 30000);
  }

  private expireSession(): void {
    this.disconnect();
    this.status('sessionExpired');
  }

  public disconnect(): void {
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.handshakeTimer);
    clearTimeout(this.openTimer);
    clearTimeout(this.recoveryTimer);
    this.cancelOpen?.();
    this.cancelOpen = undefined;
    if (this.ws?.readyState === WebSocket.OPEN && !this.recovering) this.transmit({ type: 'CMD_LEAVE_ROOM' });
    const oldSocket = this.ws;
    this.ws = null; // Ignore late events from a socket belonging to a previous mode.
    oldSocket?.close();
    this.session = null;
    this.recovering = false;
    this.recoveryDeadline = 0;
    this.attempts = 0;
    this.persistSession();
  }

  public send(message: ClientMessage): void { if (this.isConnected) this.transmit(message); }
  private transmit(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }
  public createRoom(playerName: string): void { this.send({ type: 'CMD_CREATE_ROOM', playerName }); }
  public joinRoom(roomCode: string, playerName: string): void {
    this.send({ type: 'CMD_JOIN_ROOM', roomCode: roomCode.trim().toUpperCase(), playerName });
  }
  public nudgeRank(cardId: string, direction: 'UP' | 'DOWN'): void { this.send({ type: 'CMD_NUDGE_RANK', cardId, direction }); }
  public bleedSuit(cardId: string, targetSuit: Suit): void { this.send({ type: 'CMD_BLEED_SUIT', cardId, targetSuit }); }
  public burnCard(cardId: string): void { this.send({ type: 'CMD_BURN_CAST', cardId }); }
  public ready(): void { this.send({ type: 'CMD_READY' }); }
  public commitHand(assaultCardIds: [string, string, string], aegisCardIds: [string, string], stance: Stance): void {
    this.send({ type: 'CMD_COMMIT_HAND', assaultCardIds, aegisCardIds, stance });
  }
  public rematch(): void { this.send({ type: 'CMD_REMATCH' }); }

  private status(status: ConnectionStatus): void { this.statusHandlers.forEach(handler => handler(status)); }
  private readSession(): void {
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(this.storageKey) ?? 'null');
      if (parsed && typeof parsed === 'object' && 'roomCode' in parsed && 'playerId' in parsed && 'sessionToken' in parsed
        && typeof parsed.roomCode === 'string' && /^[A-Z0-9]{4}$/.test(parsed.roomCode)
        && typeof parsed.playerId === 'string' && typeof parsed.sessionToken === 'string' && /^[a-f0-9]{64}$/.test(parsed.sessionToken)) {
        this.session = { roomCode: parsed.roomCode, playerId: parsed.playerId, sessionToken: parsed.sessionToken };
      }
    } catch { /* Storage may be unavailable in private contexts. */ }
  }
  private persistSession(): void {
    try {
      if (this.session) sessionStorage.setItem(this.storageKey, JSON.stringify(this.session));
      else sessionStorage.removeItem(this.storageKey);
    } catch { /* In-memory recovery remains available. */ }
  }
}
