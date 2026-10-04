// ============================================================================
// CYBERANTE: Room Manager & Matchmaking Registry
// ============================================================================

import { Room } from './Room';
import { WebSocket } from 'ws';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  /**
   * Generates a 4-character alphanumeric room code (e.g. 'CYBR', 'ANTE').
   */
  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public createRoom(): Room {
    let code = this.generateRoomCode();
    while (this.rooms.has(code)) {
      code = this.generateRoomCode();
    }

    const roomId = `room_${Date.now()}_${code}`;
    const room = new Room(roomId, code);
    this.rooms.set(code, room);
    return room;
  }

  public getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  public joinOrCreateRoom(roomCode: string | null): Room {
    if (roomCode) {
      const existing = this.getRoom(roomCode);
      if (existing) return existing;
    }
    return this.createRoom();
  }

  public removeRoom(roomCode: string): void {
    this.rooms.delete(roomCode.toUpperCase());
  }
}
