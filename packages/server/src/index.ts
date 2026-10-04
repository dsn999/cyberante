// CYBERANTE: Single-port HTTP and authoritative WebSocket transport.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { GAME_CONSTANTS, type ServerMessage } from '@cyberante/shared';
import { RoomManager } from './RoomManager.js';
import type { Room } from './Room.js';
import { isClientMessage } from './messageValidation.js';

const CLIENT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
const MAX_COMMAND_BYTES = 4096;
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.map': 'application/json', '.glsl': 'text/plain',
};

/** Construct without listening so tests can exercise the real transport on an ephemeral port. */
export function createGameServer(options: { clientDist?: string } = {}) {
  const roomManager = new RoomManager();
  const clientDist = path.resolve(options.clientDist ?? CLIENT_DIST);
  let closing = false;
  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD, OPTIONS' }); res.end(); return;
    }
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end(); return; }
    if (pathname.includes('\0')) { res.writeHead(400); res.end(); return; }
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok', rooms: roomManager.activeRoomCount }));
      return;
    }
    // Containment is checked after decoding, and again after resolving symlinks.
    let filePath = path.resolve(clientDist, `.${pathname === '/' ? '/index.html' : pathname}`);
    const inside = (candidate: string, root: string) => candidate === root || candidate.startsWith(root + path.sep);
    if (!inside(filePath, clientDist)) { res.writeHead(403); res.end(); return; }
    try {
      const root = await fs.realpath(clientDist);
      try {
        if (!(await fs.stat(filePath)).isFile()) throw new Error('Not a file');
      } catch {
        if (path.extname(pathname)) { res.writeHead(404); res.end(); return; }
        filePath = path.join(clientDist, 'index.html');
      }
      filePath = await fs.realpath(filePath);
      if (!inside(filePath, root)) { res.writeHead(403); res.end(); return; }
      const content = await fs.readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream', 'Content-Length': content.length });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      res.writeHead(code === 'ENOENT' ? 404 : 500);
      res.end('Client bundle unavailable');
    }
  });

  // Application limit is 4KB. A bounded receiver envelope lets ordinary oversized
  // commands receive ERROR_REJECTED; larger frames are closed with ws code 1009.
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    let pathname: string;
    try { pathname = new URL(req.url ?? '/', 'http://localhost').pathname; }
    catch { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); return; }
    if (closing || (pathname !== '/' && pathname !== '/ws')) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws: WebSocket) => {
    let binding: { room: Room; playerId: string } | null = null;
    const send = (msg: ServerMessage) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); };
    const reject = (reason: string) => send({ type: 'ERROR_REJECTED', reason });
    ws.on('error', () => { /* ws closes protocol/receiver errors; close handles the seat. */ });
    ws.on('message', (data, isBinary) => {
      if (closing) return;
      const bytes = Array.isArray(data) ? Buffer.concat(data) : Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (bytes.byteLength > MAX_COMMAND_BYTES) { reject('Payload exceeds 4KB limit'); return; }
      if (isBinary) { reject('Binary messages are not supported'); return; }
      let value: unknown;
      try { value = JSON.parse(bytes.toString('utf8')); }
      catch { reject('Malformed message payload'); return; }
      if (!isClientMessage(value)) {
        const type = value && typeof value === 'object' ? (value as Record<string, unknown>).type : null;
        reject(type === 'CMD_COMMIT_HAND' ? 'Invalid hand partition' : 'Malformed message payload'); return;
      }
      const msg = value;
      if (msg.type === 'CMD_CREATE_ROOM' || msg.type === 'CMD_JOIN_ROOM' || msg.type === 'CMD_RECONNECT') {
        if (binding) { reject('Already assigned to a room'); return; }
        if (msg.type === 'CMD_RECONNECT') {
          const room = roomManager.getRoom(msg.roomCode);
          if (!room) { reject('Room not found'); return; }
          if (!room.reconnectPlayer(msg.playerId, msg.sessionToken, ws)) {
            reject('Failed to reconnect: invalid credentials or session expired'); return;
          }
          binding = { room, playerId: msg.playerId };
          return;
        }
        const room = msg.type === 'CMD_CREATE_ROOM' ? roomManager.createRoom() : roomManager.getRoom(msg.roomCode);
        if (!room) { reject('Room not found'); return; }
        const playerId = room.addPlayer(ws, msg.playerName);
        if (playerId) binding = { room, playerId };
        return;
      }
      if (!binding || !binding.room.ownsSocket(binding.playerId, ws)) { reject('Join a room before sending actions'); return; }
      binding.room.handleMessage(binding.playerId, msg);
      if (msg.type === 'CMD_LEAVE_ROOM') binding = null;
    });
    ws.on('close', () => { binding?.room.disconnectPlayer(binding.playerId, ws); });
  });

  let closePromise: Promise<void> | null = null;
  function close(): Promise<void> {
    if (closePromise) return closePromise;
    closing = true;
    roomManager.destroy();
    for (const ws of wss.clients) ws.terminate();
    closePromise = new Promise<void>((resolve, reject) => {
      wss.close(() => {
        if (!server.listening) { resolve(); return; }
        server.close(err => err ? reject(err) : resolve());
        server.closeIdleConnections();
      });
    });
    return closePromise;
  }
  return { server, wss, roomManager, close };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? GAME_CONSTANTS.DEFAULT_WS_PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535');
  const game = createGameServer();
  game.server.listen(port, () => {
    const address = game.server.address();
    const actualPort = address && typeof address !== 'string' ? address.port : port;
    console.log(`[CYBERANTE] Server listening on http://localhost:${actualPort}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void game.close().catch(err => { console.error(err); process.exitCode = 1; }); });
  }
}
