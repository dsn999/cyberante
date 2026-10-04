import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkClient } from '../net/NetworkClient';

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: string[] = [];
  constructor(public url: string) { Socket.instances.push(this); }
  send(message: string): void { this.sent.push(message); }
  close(): void { this.readyState = 3; this.onclose?.(); }
  open(): void { this.readyState = 1; this.onopen?.(); }
  message(message: unknown): void { this.onmessage?.({ data: JSON.stringify(message) }); }
}
const init = { type: 'STATE_INIT', roomCode: 'ABCD', playerId: 'player_2', matchId: 'match', opponentName: 'Host', sessionToken: 'a'.repeat(64) };
const latest = (): Socket => Socket.instances.at(-1)!;

describe('WebSocket transport and seat recovery', () => {
  let client: NetworkClient;
  let storage: Map<string, string>;
  beforeEach(() => {
    vi.useFakeTimers();
    Socket.instances = [];
    storage = new Map();
    vi.stubGlobal('window', { location: { protocol: 'https:', host: 'game.example' } });
    vi.stubGlobal('WebSocket', Socket);
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    client = new NetworkClient();
  });
  afterEach(() => { client.disconnect(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('uses the current HTTPS host and /ws, with separate create/join commands', async () => {
    const connecting = client.connect();
    expect(latest().url).toBe('wss://game.example/ws');
    latest().open();
    await connecting;
    expect(client.isConnected).toBe(true);
    expect(latest().sent).toEqual([]);
    client.createRoom('Host');
    client.joinRoom(' abcd ', 'Guest');
    expect(latest().sent.map(message => JSON.parse(message))).toEqual([
      { type: 'CMD_CREATE_ROOM', playerName: 'Host' },
      { type: 'CMD_JOIN_ROOM', roomCode: 'ABCD', playerName: 'Guest' },
    ]);
  });

  it('reconnects with the private token and blocks actions until seat recovery succeeds', async () => {
    const status: string[] = [];
    client.on('status', s => status.push(s));
    const opening = client.connect(); latest().open(); await opening;
    latest().message(init);
    latest().close();
    expect(status.at(-1)).toBe('reconnecting');
    expect(client.isConnected).toBe(false);
    vi.advanceTimersByTime(500);
    latest().open();
    expect(JSON.parse(latest().sent[0])).toEqual({ type: 'CMD_RECONNECT', roomCode: 'ABCD', playerId: 'player_2', sessionToken: init.sessionToken });
    client.ready();
    expect(latest().sent).toHaveLength(1);
    latest().message(init);
    expect(client.isConnected).toBe(true);
    expect(status.at(-1)).toBe('connected');
    client.ready();
    expect(JSON.parse(latest().sent[1])).toEqual({ type: 'CMD_READY' });
  });

  it('keeps credentials in session storage for reload recovery', async () => {
    const opening = client.connect(); latest().open(); await opening;
    latest().message(init);
    const restored = new NetworkClient();
    expect(restored.hasSession).toBe(true);
    const recovery = restored.connect(); latest().open(); await recovery;
    expect(JSON.parse(latest().sent[0]).type).toBe('CMD_RECONNECT');
    restored.disconnect();
  });

  it('deliberate exit leaves the room, clears credentials and cancels retries', async () => {
    const opening = client.connect(); latest().open(); await opening;
    const old = latest(); old.message(init);
    client.disconnect();
    expect(JSON.parse(old.sent.at(-1)!)).toEqual({ type: 'CMD_LEAVE_ROOM' });
    expect(storage.size).toBe(0);
    expect(client.hasSession).toBe(false);
    vi.advanceTimersByTime(60000);
    expect(Socket.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('expires rejected reconnect credentials and ignores late messages', async () => {
    const statuses: string[] = [];
    const messages: unknown[] = [];
    client.on('status', s => statuses.push(s));
    client.onMessage(m => messages.push(m));
    const opening = client.connect(); latest().open(); await opening;
    const old = latest(); old.message(init); old.close();
    vi.advanceTimersByTime(500); latest().open();
    latest().message({ type: 'ERROR_REJECTED', reason: 'Session expired' });
    expect(statuses.at(-1)).toBe('sessionExpired');
    expect(storage.size).toBe(0);
    const count = messages.length;
    old.message(init);
    expect(messages).toHaveLength(count);
    expect(client.hasSession).toBe(false);
  });

  it('bounds recovery attempts to thirty seconds', async () => {
    const statuses: string[] = [];
    client.on('status', s => statuses.push(s));
    const opening = client.connect(); latest().open(); await opening;
    latest().message(init); latest().close();
    // Every reconnect opens, but the server never acknowledges the seat.
    const disconnectedAt = Date.now();
    for (let i = 0; i < 60 && client.hasSession; i++) {
      vi.advanceTimersByTime(500);
      if (latest().readyState === 0) latest().open();
    }
    expect(Date.now() - disconnectedAt).toBe(30000);
    expect(client.hasSession).toBe(false);
    expect(statuses.at(-1)).toBe('sessionExpired');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('expires recovery exactly at the thirty-second deadline even during a handshake', async () => {
    const opening = client.connect(); latest().open(); await opening;
    latest().message(init); latest().close();
    vi.advanceTimersByTime(29999);
    expect(client.hasSession).toBe(true);
    vi.advanceTimersByTime(1);
    expect(client.hasSession).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries reload recovery if constructing the socket fails', async () => {
    storage.set('cyberante.session:wss://game.example/ws', JSON.stringify(init));
    client = new NetworkClient();
    vi.stubGlobal('WebSocket', class { static OPEN = 1; constructor() { throw new Error('Offline'); } });
    await expect(client.connect()).rejects.toThrow('Offline');
    vi.stubGlobal('WebSocket', Socket);
    vi.advanceTimersByTime(500);
    latest().open();
    expect(JSON.parse(latest().sent[0])).toEqual({ type: 'CMD_RECONNECT', roomCode: 'ABCD', playerId: 'player_2', sessionToken: init.sessionToken });
    latest().message(init);
    expect(client.isConnected).toBe(true);
  });

  it('rejects initial socket timeouts and cancellation without leaving pending promises', async () => {
    const opening = client.connect();
    const assertion = expect(opening).rejects.toThrow('timed out');
    vi.advanceTimersByTime(5000);
    await assertion;
    const second = client.connect();
    const cancelled = expect(second).rejects.toThrow('cancelled');
    client.disconnect();
    await cancelled;
    expect(vi.getTimerCount()).toBe(0);
  });
});
