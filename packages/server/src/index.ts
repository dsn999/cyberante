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

  ws.on('message', (data: string) => {
    try {
      const msg: ClientMessage = JSON.parse(data.toString());

      if (msg.type === 'CMD_CREATE_ROOM') {
        const room = roomManager.createRoom();
        currentRoomCode = room.roomCode;
        currentPlayerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        room.addPlayer(currentPlayerId, msg.playerName || 'Operative', ws);

        ws.send(
          JSON.stringify({
            type: 'STATE_INIT',
            playerId: currentPlayerId,
            matchId: room.id,
            roomCode: room.roomCode,
            opponentName: 'Waiting for Operative...',
          })
        );
        return;
      }

      if (msg.type === 'CMD_JOIN_ROOM') {
        const targetCode = msg.roomCode ? msg.roomCode.trim() : null;
        const room = roomManager.joinOrCreateRoom(targetCode);

        if (!room) {
          ws.send(JSON.stringify({ type: 'ERROR_REJECTED', reason: `Room "${targetCode}" not found` }));
          return;
        }

        currentRoomCode = room.roomCode;
        currentPlayerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const joined = room.addPlayer(currentPlayerId, msg.playerName || 'Operative', ws);
        if (!joined) {
          ws.send(JSON.stringify({ type: 'ERROR_REJECTED', reason: 'Room is full (max 2 players)' }));
          return;
        }

        ws.send(
          JSON.stringify({
            type: 'STATE_INIT',
            playerId: currentPlayerId,
            matchId: room.id,
            roomCode: room.roomCode,
            opponentName: 'Opponent',
          })
        );
        return;
      }

      if (currentRoomCode && currentPlayerId) {
        const room = roomManager.getRoom(currentRoomCode);
        if (room) {
          room.handleClientMessage(currentPlayerId, msg);
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
