import { randomInt } from 'node:crypto';
import { Room } from './Room.js';

const CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  private rooms = new Map<string, Room>();

  public generateUniqueRoomCode(): string {
    if (this.rooms.size >= CODE_CHARACTERS.length ** 4) throw new Error('Room code capacity exhausted');
    // Random start followed by a bounded scan handles collisions without an unbounded retry loop.
    const capacity = CODE_CHARACTERS.length ** 4;
    const start = randomInt(capacity);
    for (let offset = 0; offset < capacity; offset++) {
      let value = (start + offset) % capacity;
      let code = '';
      for (let i = 0; i < 4; i++) {
        code = CODE_CHARACTERS[value % CODE_CHARACTERS.length] + code;
        value = Math.floor(value / CODE_CHARACTERS.length);
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Room code capacity exhausted');
  }

  public createRoom(): Room {
    const code = this.generateUniqueRoomCode();
    const room = new Room(code, () => this.removeRoom(code));
    this.rooms.set(code, room);
    return room;
  }

  public getRoom(roomCode: string): Room | null {
    return this.rooms.get(roomCode.trim().toUpperCase()) ?? null;
  }

  public removeRoom(roomCode: string): void {
    const code = roomCode.trim().toUpperCase();
    this.rooms.get(code)?.destroy();
    this.rooms.delete(code);
  }

  public get activeRoomCount(): number { return this.rooms.size; }

  public destroy(): void {
    for (const room of this.rooms.values()) room.destroy();
    this.rooms.clear();
  }
}
