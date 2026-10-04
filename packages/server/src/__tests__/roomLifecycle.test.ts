import { describe, it, expect, vi } from 'vitest';
import { Room } from '../Room.js';
import { WebSocket } from 'ws';

describe('Room Lifecycle & Matchmaking', () => {
  it('initializes room and accepts two players', () => {
    const room = new Room('room_test_1', 'TEST');

    const mockWs1 = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    } as unknown as WebSocket;

    const mockWs2 = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    } as unknown as WebSocket;

    const joined1 = room.addPlayer('p1', 'Alice', mockWs1);
    const joined2 = room.addPlayer('p2', 'Bob', mockWs2);

    expect(joined1).toBe(true);
    expect(joined2).toBe(true);

    // Third player should be rejected
    const mockWs3 = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    } as unknown as WebSocket;
    const joined3 = room.addPlayer('p3', 'Charlie', mockWs3);
    expect(joined3).toBe(false);
  });
});
