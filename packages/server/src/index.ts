// ============================================================================
// CYBERANTE: Server Entry Point (HTTP + WebSockets)
// ============================================================================

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomManager } from './RoomManager';
import { ClientMessage, GAME_CONSTANTS } from '@cyberante/shared';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : GAME_CONSTANTS.DEFAULT_WS_PORT;

const server = http.createServer((req, res) => {
  // Simple health check and CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
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

      if (msg.type === 'CMD_JOIN_ROOM') {
        const room = roomManager.joinOrCreateRoom(msg.roomCode || null);
        currentRoomCode = room.roomCode;
        currentPlayerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const joined = room.addPlayer(currentPlayerId, msg.playerName || 'Operative', ws);
        if (!joined) {
          ws.send(JSON.stringify({ type: 'ERROR_REJECTED', reason: 'Room is full' }));
          return;
        }

        ws.send(
          JSON.stringify({
            type: 'STATE_INIT',
            playerId: currentPlayerId,
            matchId: room.id,
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
