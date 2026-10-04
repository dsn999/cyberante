// ============================================================================
// CYBERANTE: Server Entry Point (HTTP + WebSockets + Static Client Serving)
// ============================================================================

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './RoomManager.js';
import { ClientMessage, GAME_CONSTANTS } from '@cyberante/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : GAME_CONSTANTS.DEFAULT_WS_PORT;
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.glsl': 'text/plain',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime(), rooms: roomManager.activeRoomCount }));
    return;
  }

  // Serve static client bundle if built
  if (fs.existsSync(CLIENT_DIST)) {
    let filePath = path.join(CLIENT_DIST, pathname === '/' ? 'index.html' : pathname);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(CLIENT_DIST, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('CYBERANTE Game Server - Online');
});

const wss = new WebSocketServer({ server });
const roomManager = new RoomManager();

wss.on('connection', (ws: WebSocket) => {
  let currentRoomCode: string | null = null;
  let currentPlayerId: string | null = null;

  ws.on('message', (data: string | Buffer) => {
    try {
      if (typeof data !== 'string' && !Buffer.isBuffer(data)) {
        ws.send(JSON.stringify({ type: 'ERROR_REJECTED', reason: 'Invalid payload type' }));
        return;
      }
      if (data.length > 4096) {
        ws.send(JSON.stringify({ type: 'ERROR_REJECTED', reason: 'Payload exceeds 4KB limit' }));
        return;
      }

      const raw = data.toString();
      const msg = JSON.parse(raw);
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
        ws.send(JSON.stringify({ type: 'ERROR_REJECTED', reason: 'Malformed message object' }));
        return;
      }

      const clientMsg = msg as ClientMessage;

      if (clientMsg.type === 'CMD_CREATE_ROOM') {
        const room = roomManager.createRoom();
        currentRoomCode = room.roomCode;
        currentPlayerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const sessionToken = `st_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

        room.addPlayer(currentPlayerId, clientMsg.playerName || 'Operative', ws, sessionToken);

        ws.send(
          JSON.stringify({
            type: 'STATE_INIT',
            playerId: currentPlayerId,
            matchId: room.id,
            roomCode: room.roomCode,
            opponentName: 'Waiting for Operative...',
            sessionToken,
          })
        );
        return;
      }

      if (clientMsg.type === 'CMD_JOIN_ROOM') {
        const targetCode = clientMsg.roomCode ? clientMsg.roomCode.trim() : null;
        const room = roomManager.joinOrCreateRoom(targetCode);

        if (!room) {
          ws.send(JSON.stringify({ type: 'ERROR_REJECTED', reason: `Room "${targetCode}" not found` }));
          return;
        }

        currentRoomCode = room.roomCode;
        currentPlayerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const sessionToken = `st_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

        const joined = room.addPlayer(currentPlayerId, clientMsg.playerName || 'Operative', ws, sessionToken);
        if (!joined) {
          ws.send(JSON.stringify({ type: 'ERROR_REJECTED', reason: 'Room is full (max 2 players)' }));
          return;
        }
        // Note: room.startMatch() has already sent STATE_INIT to both players upon filling the room!
        return;
      }

      if (clientMsg.type === 'CMD_RECONNECT') {
        const targetCode = clientMsg.roomCode ? clientMsg.roomCode.trim() : null;
        const room = targetCode ? roomManager.getRoom(targetCode) : null;
        if (!room) {
          ws.send(JSON.stringify({ type: 'ERROR_REJECTED', reason: `Room "${targetCode}" not found` }));
          return;
        }
        const ok = room.reconnectPlayer(clientMsg.playerId, clientMsg.sessionToken, ws);
        if (!ok) {
          ws.send(
            JSON.stringify({
              type: 'ERROR_REJECTED',
              reason: 'Failed to reconnect: invalid credentials or session expired',
            })
          );
          return;
        }
        currentRoomCode = room.roomCode;
        currentPlayerId = clientMsg.playerId;
        return;
      }

      if (currentRoomCode && currentPlayerId) {
        const room = roomManager.getRoom(currentRoomCode);
        if (room) {
          room.handleClientMessage(currentPlayerId, clientMsg);
        }
      }
    } catch (err) {
      console.error('Error processing websocket message:', err);
      ws.send(JSON.stringify({ type: 'ERROR_REJECTED', reason: 'Malformed message payload' }));
    }
  });

  ws.on('close', () => {
    if (currentRoomCode && currentPlayerId) {
      const room = roomManager.getRoom(currentRoomCode);
      if (room) {
        room.removePlayer(currentPlayerId);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`[CYBERANTE] Server listening on http://localhost:${PORT}`);
});
