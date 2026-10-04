import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { once } from 'node:events';
import { request } from 'node:http';
import { mkdtemp, writeFile, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import type { ServerMessage } from '@cyberante/shared';
import { createGameServer } from '../index.js';

type Game = ReturnType<typeof createGameServer>;
type Init = Extract<ServerMessage, { type: 'STATE_INIT' }>;
type Tick = Extract<ServerMessage, { type: 'STATE_TICK' }>;

class Peer {
  readonly messages: ServerMessage[] = [];
  private listeners = new Set<() => void>();
  constructor(readonly ws: WebSocket) {
    ws.on('message', raw => {
      this.messages.push(JSON.parse(raw.toString()));
      for (const notify of this.listeners) notify();
    });
    ws.on('error', () => {});
  }
  send(value: unknown) { this.ws.send(JSON.stringify(value)); }
  async wait<T extends ServerMessage>(predicate: (msg: ServerMessage) => msg is T, after?: number): Promise<T>;
  async wait(predicate: (msg: ServerMessage) => boolean, after?: number): Promise<ServerMessage>;
  async wait(predicate: (msg: ServerMessage) => boolean, after = 0): Promise<ServerMessage> {
    const found = this.messages.slice(after).find(predicate);
    if (found) return found;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.listeners.delete(check); reject(new Error(`Message timeout; received ${JSON.stringify(this.messages)}`)); }, 3000);
      const check = () => {
        const found = this.messages.slice(after).find(predicate);
        if (found) { clearTimeout(timer); this.listeners.delete(check); resolve(found); }
      };
      this.listeners.add(check); check();
    });
  }
}
const isInit = (m: ServerMessage): m is Init => m.type === 'STATE_INIT';
const isTick = (m: ServerMessage): m is Tick => m.type === 'STATE_TICK';

let game: Game;
let port: number;
let peers: Peer[];
let fixtureDir: string;
beforeEach(async () => {
  fixtureDir = await mkdtemp(path.join(tmpdir(), 'cyberante-http-'));
  await mkdir(path.join(fixtureDir, 'assets'));
  await writeFile(path.join(fixtureDir, 'index.html'), '<html>CYBERANTE</html>');
  for (const [name, body] of [['app.js', 'console.log("CYBERANTE")'], ['style.css', 'body{}'], ['icon.svg', '<svg/>'], ['data.json', '{}'], ['favicon.ico', 'ico']]) await writeFile(path.join(fixtureDir, 'assets', name), body);
  game = createGameServer({ clientDist: fixtureDir }); peers = [];
  game.server.listen(0, '127.0.0.1'); await once(game.server, 'listening');
  port = (game.server.address() as AddressInfo).port;
});
afterEach(async () => {
  for (const peer of peers) peer.ws.terminate();
  await game.close();
  await rm(fixtureDir, { recursive: true, force: true });
});
async function connect(wsPath = '/ws') {
  const peer = new Peer(new WebSocket(`ws://127.0.0.1:${port}${wsPath}`)); peers.push(peer);
  await once(peer.ws, 'open'); return peer;
}
async function pair() {
  const a = await connect('/'); a.send({ type: 'CMD_CREATE_ROOM', playerName: 'Alice' });
  const host = await a.wait(isInit);
  const b = await connect(); b.send({ type: 'CMD_JOIN_ROOM', roomCode: host.roomCode.toLowerCase(), playerName: 'Bob' });
  const guest = await b.wait(isInit);
  await a.wait(m => m.type === 'STATE_TICK' && m.phase === 'DEAL');
  await b.wait(m => m.type === 'STATE_TICK' && m.phase === 'DEAL');
  return { a, b, host, guest };
}
async function httpGet(urlPath: string, method = 'GET') {
  return new Promise<{ status: number; type?: string; body: string }>((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path: urlPath, method }, res => {
      const chunks: Buffer[] = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode!, type: res.headers['content-type'], body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject); req.end();
  });
}

describe('Spec-04 real WebSocket authority', () => {
  it('hosts, joins, shapes, commits and reveals one outcome to both seats', async () => {
    const { a, b, host, guest } = await pair();
    expect(host.playerId).toBe('player_1'); expect(guest.playerId).toBe('player_2');
    expect(host.matchId).toBe(guest.matchId); expect(game.roomManager.activeRoomCount).toBe(1);
    expect(b.messages.filter(isInit)).toHaveLength(1); expect(a.messages.filter(isInit)).toHaveLength(2);
    const shaping = (m: ServerMessage) => m.type === 'STATE_TICK' && m.phase === 'SHAPING';
    await a.wait(shaping); await b.wait(shaping);
    const aTick = a.messages.filter(isTick).at(-1)!; const bTick = b.messages.filter(isTick).at(-1)!;
    for (const [self, other] of [[a, bTick], [b, aTick]] as const) {
      for (const tick of self.messages.filter(isTick)) for (const card of other.selfCards) expect(JSON.stringify(tick)).not.toContain(card.id);
    }
    const after = a.messages.length;
    a.send({ type: 'CMD_NUDGE_RANK', cardId: aTick.selfCards[0].id, direction: 'UP', guardHp: 999, damage: 999 });
    const nudged = await a.wait(isTick, after); expect(nudged.players.player_1.fluxRemaining).toBe(2);
    a.send({ type: 'CMD_READY' }); b.send({ type: 'CMD_READY' });
    await a.wait(m => m.type === 'STATE_TICK' && m.phase === 'COMMITMENT');
    await b.wait(m => m.type === 'STATE_TICK' && m.phase === 'COMMITMENT');
    for (const peer of [a, b]) {
      const c = peer.messages.filter(isTick).at(-1)!.selfCards;
      peer.send({ type: 'CMD_COMMIT_HAND', assaultCardIds: [c[0].id, c[1].id, c[2].id], aegisCardIds: [c[3].id, c[4].id], stance: 'BRACE' });
    }
    const outcome = await a.wait(m => m.type === 'ROUND_OUTCOME');
    expect(await b.wait(m => m.type === 'ROUND_OUTCOME')).toEqual(outcome);
    expect(a.messages.filter(m => m.type === 'ROUND_OUTCOME')).toHaveLength(1);
    expect(b.messages.filter(m => m.type === 'ROUND_OUTCOME')).toHaveLength(1);
  });

  it('rejects nonexistent and full rooms without creating phantom seats', async () => {
    const { host } = await pair(); const third = await connect();
    const closed = once(third.ws, 'close'); third.send({ type: 'CMD_JOIN_ROOM', roomCode: host.roomCode, playerName: 'C' });
    expect(await third.wait(m => m.type === 'ERROR_REJECTED')).toEqual({ type: 'ERROR_REJECTED', reason: 'Room is full' });
    const [code] = await closed; expect(code).toBe(1008);
    const missing = await connect(); missing.send({ type: 'CMD_JOIN_ROOM', roomCode: game.roomManager.generateUniqueRoomCode(), playerName: 'D' });
    expect(await missing.wait(m => m.type === 'ERROR_REJECTED')).toEqual({ type: 'ERROR_REJECTED', reason: 'Room not found' });
    expect(game.roomManager.activeRoomCount).toBe(1);
  });

  it('rejects malformed schemas, binary input and byte-oversized payloads before room allocation', async () => {
    const peer = await connect();
    const invalid: unknown[] = [null, [], 'CMD_READY', {}, { type: 'UNKNOWN' }, { type: 'CMD_CREATE_ROOM', playerName: {} },
      { type: 'CMD_JOIN_ROOM', roomCode: '', playerName: 'A' }, { type: 'CMD_JOIN_ROOM', roomCode: 'TEST', playerName: ['A'] },
      { type: 'CMD_NUDGE_RANK', cardId: 'x', direction: 'WRONG' }, { type: 'CMD_BLEED_SUIT', cardId: 'x', targetSuit: 'OTHER' },
      { type: 'CMD_COMMIT_HAND', assaultCardIds: [1, 2, 3], aegisCardIds: ['x', 'y'], stance: 'BRACE' },
      { type: 'CMD_RECONNECT', roomCode: 'TEST', playerId: 'player_1', sessionToken: 123 }];
    for (const value of invalid) {
      const after = peer.messages.length; peer.send(value); expect((await peer.wait(m => m.type === 'ERROR_REJECTED', after)).type).toBe('ERROR_REJECTED');
    }
    let after = peer.messages.length; peer.ws.send('{'); await peer.wait(m => m.type === 'ERROR_REJECTED', after);
    after = peer.messages.length; peer.ws.send(Buffer.from('{}')); expect(await peer.wait(m => m.type === 'ERROR_REJECTED', after)).toMatchObject({ reason: 'Binary messages are not supported' });
    after = peer.messages.length; peer.ws.send(JSON.stringify({ type: 'CMD_CREATE_ROOM', playerName: 'A', padding: 'é'.repeat(2050) }));
    expect(await peer.wait(m => m.type === 'ERROR_REJECTED', after)).toMatchObject({ reason: 'Payload exceeds 4KB limit' });
    expect(game.roomManager.activeRoomCount).toBe(0);
    after = peer.messages.length; peer.send({ type: 'CMD_READY' }); expect(await peer.wait(m => m.type === 'ERROR_REJECTED', after)).toMatchObject({ reason: 'Join a room before sending actions' });
    peer.send({ type: 'CMD_CREATE_ROOM', playerName: 'A' }); await peer.wait(isInit);
  });

  it('closes a receiver-level oversized frame and keeps the server healthy', async () => {
    const peer = await connect(); const closed = once(peer.ws, 'close'); peer.ws.send('x'.repeat(65537));
    const [code] = await closed; expect(code).toBe(1009);
    expect((await httpGet('/health')).status).toBe(200);
  });

  it('prevents duplicate binding and connected-seat takeover, then resumes a dropped socket', async () => {
    const { a, b, host } = await pair();
    let after = a.messages.length; a.send({ type: 'CMD_CREATE_ROOM', playerName: 'Duplicate' });
    expect(await a.wait(m => m.type === 'ERROR_REJECTED', after)).toMatchObject({ reason: 'Already assigned to a room' });
    expect(game.roomManager.activeRoomCount).toBe(1);
    const replacement = await connect(); replacement.send({ type: 'CMD_RECONNECT', roomCode: host.roomCode, playerId: host.playerId, sessionToken: host.sessionToken });
    expect(await replacement.wait(m => m.type === 'ERROR_REJECTED')).toMatchObject({ reason: 'Failed to reconnect: invalid credentials or session expired' });
    const closed = once(a.ws, 'close'); after = b.messages.length; a.ws.terminate(); await closed;
    await b.wait(m => m.type === 'STATE_TICK' && !m.players.player_1.connected, after);
    after = replacement.messages.length;
    const bAfter = b.messages.length;
    replacement.send({ type: 'CMD_RECONNECT', roomCode: host.roomCode, playerId: host.playerId, sessionToken: host.sessionToken });
    expect(await replacement.wait(isInit, after)).toMatchObject({ playerId: 'player_1', matchId: host.matchId });
    const resumed = await replacement.wait(isTick, after); expect(resumed.players.player_1.connected).toBe(true); expect(resumed.selfCards).toHaveLength(5);
    await b.wait(m => m.type === 'STATE_TICK' && m.players.player_1.connected, bAfter);
  });

  it('deliberate exit forfeits immediately and lets the socket create a new room', async () => {
    const { a, b } = await pair(); a.send({ type: 'CMD_LEAVE_ROOM' });
    const over = await b.wait(m => m.type === 'STATE_TICK' && m.phase === 'MATCH_OVER');
    expect(over).toMatchObject({ matchWinnerId: 'player_2', timeRemainingMs: 0 });
    const after = a.messages.length; a.send({ type: 'CMD_CREATE_ROOM', playerName: 'Again' });
    const next = await a.wait(isInit, after); expect(next.playerId).toBe('player_1'); expect(game.roomManager.activeRoomCount).toBe(2);
    b.send({ type: 'CMD_LEAVE_ROOM' });
    // A health request follows the leave frame after the peer sends its next message.
    b.send({ type: 'CMD_READY' }); await b.wait(m => m.type === 'ERROR_REJECTED');
    expect(game.roomManager.activeRoomCount).toBe(1);
  });

  it('shutdown closes sockets and destroys active rooms', async () => {
    const { a, b } = await pair(); const aClosed = once(a.ws, 'close'); const bClosed = once(b.ws, 'close');
    await game.close(); await Promise.all([aClosed, bClosed]);
    expect(game.server.listening).toBe(false); expect(game.roomManager.activeRoomCount).toBe(0);
    await game.close();
  });
});

describe('Spec-04 single-port static serving', () => {
  it('serves root, SPA routes, assets with MIME types, HEAD and health', async () => {
    for (const route of ['/', '/join/TEST']) expect(await httpGet(route)).toMatchObject({ status: 200, type: 'text/html', body: '<html>CYBERANTE</html>' });
    for (const [file, type] of [['app.js', 'application/javascript'], ['style.css', 'text/css'], ['icon.svg', 'image/svg+xml'], ['data.json', 'application/json'], ['favicon.ico', 'image/x-icon']]) {
      expect(await httpGet(`/assets/${file}`)).toMatchObject({ status: 200, type });
    }
    expect(await httpGet('/', 'HEAD')).toMatchObject({ status: 200, body: '' });
    expect(await httpGet('/health')).toMatchObject({ status: 200, type: 'application/json' });
    expect((await httpGet('/assets/missing.js')).status).toBe(404);
    expect((await httpGet('/', 'POST')).status).toBe(405);
    expect((await httpGet('/', 'OPTIONS')).status).toBe(204);
  });

  it('rejects malformed URLs, decoded traversal and escaping symlinks', async () => {
    expect((await httpGet('/%ZZ')).status).toBe(400);
    expect((await httpGet('/%00')).status).toBe(400);
    expect((await httpGet('/..%2fsecret')).status).toBe(403);
    await symlink(path.join(fixtureDir, '..'), path.join(fixtureDir, 'escape'));
    expect((await httpGet('/escape')).status).toBe(200); // Directory requests use SPA fallback.
    await symlink('/etc/hosts', path.join(fixtureDir, 'outside.txt'));
    expect((await httpGet('/outside.txt')).status).toBe(403);
  });

  it('rejects upgrade routes other than root and /ws', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/other`);
    const response = new Promise<number>(resolve => ws.once('unexpected-response', (_req, res) => { res.resume(); resolve(res.statusCode!); ws.terminate(); }));
    ws.on('error', () => {});
    expect(await response).toBe(404);
  });
});

// These process checks follow the required build-before-test gate and use the emitted entry point.
describe('Spec-04 compiled production entry point', () => {
  it.each(['SIGTERM', 'SIGINT'] as const)('serves the built client and exits cleanly on %s with an active room', async signal => {
    const { spawn } = await import('node:child_process');
    const { fileURLToPath } = await import('node:url');
    const entry = fileURLToPath(new URL('../../dist/index.js', import.meta.url));
    const child = spawn(process.execPath, [entry], { env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = ''; child.stderr.on('data', data => { stderr += data.toString(); });
    try {
      const childPort = await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Production server did not listen')), 3000);
        const fail = (err: Error) => { clearTimeout(timer); reject(err); };
        child.once('error', fail);
        child.stdout.on('data', data => {
          const match = data.toString().match(/localhost:(\d+)/);
          if (match) { clearTimeout(timer); child.removeListener('error', fail); resolve(Number(match[1])); }
        });
      });
      const response = await fetch(`http://127.0.0.1:${childPort}/`);
      expect(response.status).toBe(200); const html = await response.text(); expect(html).toContain('CYBERANTE');
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+\.js)"/g)].map(match => match[1]);
      expect(assets.length).toBeGreaterThanOrEqual(2);
      for (const asset of assets) {
        const assetResponse = await fetch(`http://127.0.0.1:${childPort}${asset}`);
        expect(assetResponse.status).toBe(200); expect(assetResponse.headers.get('content-type')).toBe('application/javascript');
        await assetResponse.arrayBuffer();
      }
      const a = new Peer(new WebSocket(`ws://127.0.0.1:${childPort}/ws`)); peers.push(a); await once(a.ws, 'open');
      a.send({ type: 'CMD_CREATE_ROOM', playerName: 'A' }); const host = await a.wait(isInit);
      const b = new Peer(new WebSocket(`ws://127.0.0.1:${childPort}/ws`)); peers.push(b); await once(b.ws, 'open');
      b.send({ type: 'CMD_JOIN_ROOM', roomCode: host.roomCode, playerName: 'B' }); await b.wait(isInit);
      await b.wait(m => m.type === 'STATE_TICK' && m.phase === 'DEAL');
      const exit = once(child, 'exit'); child.kill(signal);
      const [code, exitSignal] = await Promise.race([exit, new Promise<never>((_resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Shutdown left live handles')), 3000);
        child.once('exit', () => clearTimeout(timer));
      })]);
      expect(code).toBe(0); expect(exitSignal).toBeNull(); expect(stderr).toBe('');
    } finally {
      if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await once(child, 'exit'); }
    }
  });
});
