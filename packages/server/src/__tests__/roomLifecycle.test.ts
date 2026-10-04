import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { MatchEngine, type ClientMessage, type ServerMessage } from '@cyberante/shared';
import { Room, DISCONNECT_GRACE_MS } from '../Room.js';
import { RoomManager } from '../RoomManager.js';
import { CryptoPRNG } from '../Deck.js';

function socket() {
  const messages: ServerMessage[] = [];
  const ws = { readyState: WebSocket.OPEN, send: vi.fn((raw: string) => messages.push(JSON.parse(raw))), close: vi.fn() } as unknown as WebSocket;
  return { ws, messages };
}
type Peer = ReturnType<typeof socket>;
function tick(peer: Peer) {
  return peer.messages.filter((m): m is Extract<ServerMessage, { type: 'STATE_TICK' }> => m.type === 'STATE_TICK').at(-1)!;
}
function init(peer: Peer) {
  return peer.messages.find((m): m is Extract<ServerMessage, { type: 'STATE_INIT' }> => m.type === 'STATE_INIT')!;
}
function commit(room: Room, peer: Peer, stance: 'BRACE' | 'OVERCHARGE' = 'BRACE') {
  const c = tick(peer).selfCards;
  room.handleMessage(init(peer).playerId, { type: 'CMD_COMMIT_HAND', assaultCardIds: [c[0].id, c[1].id, c[2].id], aegisCardIds: [c[3].id, c[4].id], stance });
}
// Explicit fixtures only for combat outcomes; transport assertions always inspect sent messages.
function engine(room: Room): MatchEngine { return (room as unknown as { engine: MatchEngine }).engine; }

let rooms: Room[];
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); rooms = []; });
afterEach(() => { for (const room of rooms) room.destroy(); vi.restoreAllMocks(); expect(vi.getTimerCount()).toBe(0); vi.useRealTimers(); });
function setup() {
  const room = new Room('TEST'); rooms.push(room);
  const a = socket(); const b = socket();
  room.addPlayer(a.ws, 'Alice'); room.addPlayer(b.ws, 'Bob');
  return { room, a, b };
}
function ready(room: Room) {
  room.handleMessage('player_1', { type: 'CMD_READY' }); room.handleMessage('player_2', { type: 'CMD_READY' });
}

describe('Spec-04 room contracts and handshake', () => {
  it('assigns fixed seats and exactly one init to the joiner', () => {
    const room = new Room('TEST'); rooms.push(room);
    const a = socket(); const b = socket(); const third = socket();
    expect(room.isEmpty).toBe(true);
    expect(room.addPlayer(a.ws, ' Alice ')).toBe('player_1');
    expect(tick(a).phase).toBe('LOBBY_WAIT'); expect(init(a).opponentName).toBe('Waiting...');
    expect(init(a).sessionToken).toMatch(/^[a-f0-9]{64}$/);
    expect(room.addPlayer(b.ws, 'Bob')).toBe('player_2');
    expect(room.isFull).toBe(true); expect(room.isEmpty).toBe(false);
    expect(a.messages.filter(m => m.type === 'STATE_INIT')).toHaveLength(2);
    expect(b.messages.filter(m => m.type === 'STATE_INIT')).toHaveLength(1);
    expect(a.messages.filter(m => m.type === 'STATE_INIT').at(-1)).toMatchObject({ opponentName: 'Bob' });
    expect(init(b)).toMatchObject({ playerId: 'player_2', matchId: init(a).matchId, roomCode: 'TEST', opponentName: 'Alice' });
    expect(init(a).sessionToken).not.toBe(init(b).sessionToken);
    expect(tick(a)).toMatchObject({ phase: 'DEAL', timeRemainingMs: 2000, roundNumber: 1, exchangeNumber: 1 });
    expect(room.addPlayer(third.ws, 'Charlie')).toBeNull();
    expect(third.messages).toEqual([{ type: 'ERROR_REJECTED', reason: 'Room is full' }]);
    expect(third.ws.close).toHaveBeenCalledWith(1008, 'Room is full');
  });

  it('creates unique normalized registry entries and removes rooms with cleanup', () => {
    const manager = new RoomManager();
    const created = Array.from({ length: 100 }, () => manager.createRoom());
    rooms.push(...created);
    expect(new Set(created.map(r => r.roomCode)).size).toBe(100);
    for (const r of created) expect(r.roomCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    const r = created[0]; const a = socket(); const b = socket(); r.addPlayer(a.ws, 'A'); r.addPlayer(b.ws, 'B');
    expect(manager.activeRoomCount).toBe(100); expect(manager.getRoom(` ${r.roomCode.toLowerCase()} `)).toBe(r);
    expect(manager.getRoom(manager.generateUniqueRoomCode())).toBeNull();
    manager.removeRoom(r.roomCode); expect(manager.activeRoomCount).toBe(99); expect(vi.getTimerCount()).toBe(0);
    manager.destroy(); expect(manager.activeRoomCount).toBe(0);
  });

  it('generates unused codes when registry entries already exist', () => {
    const manager = new RoomManager();
    const first = manager.createRoom(); rooms.push(first);
    expect(manager.generateUniqueRoomCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
    expect(manager.generateUniqueRoomCode()).not.toBe(first.roomCode);
    manager.destroy();
  });

  it('invokes onEmpty once on deliberate departures and stays destroyed', () => {
    const empty = vi.fn(); const r = new Room('TEST', empty); rooms.push(r);
    const a = socket(); const b = socket(); r.addPlayer(a.ws, 'A'); r.addPlayer(b.ws, 'B');
    r.removePlayer('player_1'); expect(empty).not.toHaveBeenCalled();
    expect(tick(b)).toMatchObject({ phase: 'MATCH_OVER', matchWinnerId: 'player_2', timeRemainingMs: 0 });
    r.removePlayer('player_2'); r.removePlayer('player_2'); r.destroy();
    expect(empty).toHaveBeenCalledTimes(1); expect(r.isEmpty).toBe(true); expect(vi.getTimerCount()).toBe(0);
    expect(r.addPlayer(socket().ws, 'C')).toBeNull();
  });
});

describe('Spec-04 phase authority, masking and fallback', () => {
  it('runs all timed phases and carries HP into the next exchange', () => {
    const { room, a, b } = setup();
    engine(room).getPlayer('player_1')!.activeBarrier = 100;
    engine(room).getPlayer('player_2')!.activeBarrier = 100;
    vi.advanceTimersByTime(1999); expect(tick(a).phase).toBe('DEAL');
    vi.advanceTimersByTime(1); expect(tick(a)).toMatchObject({ phase: 'SHAPING', timeRemainingMs: 15000 });
    vi.advanceTimersByTime(15000); expect(tick(a)).toMatchObject({ phase: 'COMMITMENT', timeRemainingMs: 10000 });
    vi.advanceTimersByTime(10000); expect(tick(a)).toMatchObject({ phase: 'CLASH_REVEAL', timeRemainingMs: 4000 });
    const outcome = a.messages.find(m => m.type === 'ROUND_OUTCOME')!;
    expect(outcome).toEqual(b.messages.find(m => m.type === 'ROUND_OUTCOME'));
    if (outcome.type !== 'ROUND_OUTCOME') throw new Error('Missing reveal');
    expect(outcome.resolution.p1Assault).toHaveLength(3); expect(outcome.resolution.p2Aegis).toHaveLength(2);
    expect(outcome.resolution.p1Stance).toBe('BRACE'); expect(outcome.resolution.p2Stance).toBe('BRACE');
    vi.advanceTimersByTime(4000); expect(tick(a).phase).toBe('ROUND_RESOLVE');
    vi.advanceTimersByTime(3000); expect(tick(a)).toMatchObject({ phase: 'DEAL', roundNumber: 1, exchangeNumber: 2 });
    expect(tick(a).players.player_1.guardHp).toBe(outcome.resolution.p1HpRemaining);
    expect(tick(a).players.player_2.guardHp).toBe(outcome.resolution.p2HpRemaining);
    expect(tick(a).players.player_1).toMatchObject({ fluxRemaining: 3, hasCommitted: false, activeBarrier: 0 });
  });

  it('advances once on mutual ready/commit and cancels replaced timers', () => {
    const { room, a, b } = setup(); vi.advanceTimersByTime(2000);
    room.handleMessage('player_1', { type: 'CMD_READY' }); room.handleMessage('player_1', { type: 'CMD_READY' });
    expect(tick(a).phase).toBe('SHAPING');
    room.handleMessage('player_2', { type: 'CMD_READY' }); expect(tick(a).phase).toBe('COMMITMENT');
    commit(room, a); expect(tick(a).players.player_1.hasCommitted).toBe(true); expect(tick(a).phase).toBe('COMMITMENT');
    commit(room, b); expect(tick(a).phase).toBe('CLASH_REVEAL'); expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(7000); expect(tick(a).phase).toBe('DEAL');
    expect(a.messages.filter(m => m.type === 'ROUND_OUTCOME')).toHaveLength(1);
  });

  it('never sends opponent cards, partitions, stance or tokens before clash', () => {
    const { room, a, b } = setup(); vi.advanceTimersByTime(2000);
    const c = tick(a).selfCards[0]; room.handleMessage('player_1', { type: 'CMD_NUDGE_RANK', cardId: c.id, direction: 'UP' });
    ready(room); commit(room, a, 'OVERCHARGE');
    for (const [self, opponent] of [[a, b], [b, a]]) {
      const foreignIds = tick(opponent).selfCards.map(c => c.id);
      for (const msg of self.messages) {
        if (msg.type !== 'STATE_TICK') continue;
        expect(msg.selfCards.every(c => !foreignIds.includes(c.id))).toBe(true);
        const publicOther = msg.players[init(opponent).playerId];
        if (msg.phase !== 'LOBBY_WAIT') expect(publicOther).toBeDefined();
        for (const key of ['cards', 'assaultCardIds', 'aegisCardIds', 'chosenStance', 'sessionToken']) expect(publicOther ?? {}).not.toHaveProperty(key);
        const wire = JSON.stringify(msg); for (const id of foreignIds) expect(wire).not.toContain(id);
      }
      expect(self.messages.some(m => m.type === 'ROUND_OUTCOME')).toBe(false);
    }
    commit(room, b); expect(a.messages.filter(m => m.type === 'ROUND_OUTCOME')).toHaveLength(1);
  });

  it('uses the optimal timeout split and preserves a submitted stance', () => {
    const { room, a, b } = setup();
    engine(room).getPlayer('player_1')!.cards = [
      { id: 'a', rank: 12, suit: 'SPADES' }, { id: 'b', rank: 8, suit: 'CLUBS' },
      { id: 'c', rank: 13, suit: 'SPADES' }, { id: 'd', rank: 8, suit: 'HEARTS' }, { id: 'e', rank: 14, suit: 'SPADES' },
    ];
    vi.advanceTimersByTime(2000); ready(room); commit(room, b, 'OVERCHARGE');
    vi.advanceTimersByTime(10000);
    const msg = a.messages.find(m => m.type === 'ROUND_OUTCOME');
    if (msg?.type !== 'ROUND_OUTCOME') throw new Error('Missing outcome');
    expect(msg.resolution.p1Assault.map(c => c.id)).toEqual(['a', 'c', 'e']);
    expect(msg.resolution.p1Aegis.map(c => c.id)).toEqual(['b', 'd']);
    expect(msg.resolution.p1Stance).toBe('BRACE'); expect(msg.resolution.p2Stance).toBe('OVERCHARGE');
  });

  it('retains knockout state through display, resets next round and ends Bo3', () => {
    vi.spyOn(CryptoPRNG.prototype, 'nextInt').mockImplementation((_min, max) => max - 1);
    const { room, a, b } = setup();
    function winRound() {
      vi.advanceTimersByTime(2000); ready(room);
      engine(room).getPlayer('player_2')!.guardHp = 1;
      engine(room).getPlayer('player_1')!.activeBarrier = 100;
      commit(room, a, 'OVERCHARGE'); commit(room, b);
    }
    winRound(); expect(tick(a).players.player_2.guardHp).toBe(0); expect(tick(a).roundNumber).toBe(1);
    expect(tick(a).players.player_1.roundWins).toBe(1);
    vi.advanceTimersByTime(4000); expect(tick(a).players.player_2.guardHp).toBe(0);
    vi.advanceTimersByTime(3000); expect(tick(a)).toMatchObject({ phase: 'DEAL', roundNumber: 2, exchangeNumber: 1 });
    expect(tick(a).players.player_2.guardHp).toBe(20);
    winRound(); vi.advanceTimersByTime(7000);
    expect(tick(a)).toMatchObject({ phase: 'MATCH_OVER', matchWinnerId: 'player_1', timeRemainingMs: 0 });
    expect(tick(a).players.player_1.roundWins).toBe(2); expect(vi.getTimerCount()).toBe(0);
    room.disconnectPlayer('player_1', a.ws); const replacement = socket();
    expect(room.reconnectPlayer('player_1', init(a).sessionToken!, replacement.ws)).toBe(true);
    expect(tick(replacement)).toMatchObject({ phase: 'MATCH_OVER', matchWinnerId: 'player_1' });
    expect(replacement.messages.filter(m => m.type === 'ROUND_OUTCOME')).toHaveLength(1);
    room.handleMessage('player_1', { type: 'CMD_REMATCH' }); expect(tick(a).phase).toBe('MATCH_OVER');
    room.handleMessage('player_2', { type: 'CMD_REMATCH' });
    expect(tick(replacement)).toMatchObject({ phase: 'DEAL', roundNumber: 1, exchangeNumber: 1, matchWinnerId: null });
    expect(tick(replacement).players.player_1).toMatchObject({ guardHp: 20, roundWins: 0 });
  });

  it.each(['CMD_NUDGE_RANK', 'CMD_BLEED_SUIT', 'CMD_BURN_CAST'] as const)('rejects %s outside SHAPING', type => {
    const { room, a } = setup(); const c = tick(a).selfCards[0];
    room.handleMessage('player_1', { type, cardId: c.id, direction: 'UP', targetSuit: 'CLUBS' } as ClientMessage);
    expect(a.messages.at(-1)).toEqual({ type: 'ERROR_REJECTED', reason: 'Actions only permitted during SHAPING phase' });
    expect(engine(room).getPlayer('player_1')!.fluxRemaining).toBe(3);
  });

  it('rejects bad/stale/foreign partitions and duplicate commitments without state changes', () => {
    const { room, a, b } = setup(); commit(room, a); expect(a.messages.at(-1)).toMatchObject({ reason: 'Invalid hand partition' });
    vi.advanceTimersByTime(2000); const stale = tick(a).selfCards.map(c => c.id);
    room.handleMessage('player_1', { type: 'CMD_BURN_CAST', cardId: stale[0] }); ready(room);
    const bad: unknown[] = [
      { assaultCardIds: stale.slice(0, 4), aegisCardIds: stale.slice(4) },
      { assaultCardIds: stale.slice(0, 3), aegisCardIds: stale.slice(3) },
      { assaultCardIds: [tick(b).selfCards[0].id, stale[1], stale[2]], aegisCardIds: stale.slice(3) },
      { assaultCardIds: [stale[1], stale[1], stale[2]], aegisCardIds: stale.slice(3) },
      { assaultCardIds: null, aegisCardIds: 5 },
    ];
    for (const part of bad) {
      room.handleMessage('player_1', { type: 'CMD_COMMIT_HAND', stance: 'BRACE', ...(part as object) } as ClientMessage);
      expect(a.messages.at(-1)).toMatchObject({ reason: 'Invalid hand partition' }); expect(tick(a).players.player_1.hasCommitted).toBe(false);
    }
    commit(room, a); commit(room, a); expect(a.messages.at(-1)).toMatchObject({ reason: 'Invalid hand partition' });
    expect(engine(room).getPlayer('player_1')!.hasCommitted).toBe(true);
  });

  it('rejects invalid shaping without changing either player', () => {
    const { room, a, b } = setup(); vi.advanceTimersByTime(2000);
    const before = structuredClone(engine(room).getPublicState());
    for (const msg of [
      { type: 'CMD_NUDGE_RANK', cardId: tick(b).selfCards[0].id, direction: 'UP' },
      { type: 'CMD_NUDGE_RANK', cardId: tick(a).selfCards[0].id, direction: 'WRONG' },
      { type: 'CMD_BLEED_SUIT', cardId: tick(a).selfCards[0].id, targetSuit: tick(a).selfCards[0].suit },
      { type: 'CMD_BURN_CAST', cardId: 'missing' },
    ]) {
      room.handleMessage('player_1', msg as ClientMessage);
      expect(a.messages.at(-1)?.type).toBe('ERROR_REJECTED');
      expect(engine(room).getPublicState()).toEqual(before);
    }
  });
});

describe('Spec-04 disconnect, resume, forfeit and cleanup', () => {
  it('resumes a disconnected seat before deadline with current countdown and connected flags', () => {
    const { room, a, b } = setup(); room.disconnectPlayer('player_1', a.ws);
    expect(tick(b).players.player_1.connected).toBe(false); expect(room.isFull).toBe(true);
    vi.advanceTimersByTime(1000); const replacement = socket();
    expect(room.reconnectPlayer('player_1', init(a).sessionToken!, replacement.ws)).toBe(true);
    expect(init(replacement)).toMatchObject({ playerId: 'player_1', matchId: init(a).matchId });
    expect(tick(replacement)).toMatchObject({ phase: 'DEAL', timeRemainingMs: 1000 });
    expect(tick(b).players.player_1.connected).toBe(true); expect(vi.getTimerCount()).toBe(1);
    room.disconnectPlayer('player_1', a.ws); expect(room.ownsSocket('player_1', replacement.ws)).toBe(true);
  });

  it('rejects wrong token, unknown seat, connected-seat takeover and expired deadlines', () => {
    const { room, a } = setup(); const replacement = socket(); const token = init(a).sessionToken!;
    expect(room.reconnectPlayer('player_1', token, replacement.ws)).toBe(false);
    room.disconnectPlayer('player_1', a.ws);
    expect(room.reconnectPlayer('player_1', '0'.repeat(64), replacement.ws)).toBe(false);
    expect(room.reconnectPlayer('player_2', token, replacement.ws)).toBe(false);
    expect(room.reconnectPlayer('unknown', token, replacement.ws)).toBe(false);
    expect(room.reconnectPlayer('player_1', 'x', replacement.ws)).toBe(false);
    // Move the clock without executing timers to prove validation checks the deadline itself.
    vi.setSystemTime(DISCONNECT_GRACE_MS);
    expect(room.reconnectPlayer('player_1', token, replacement.ws)).toBe(false);
  });

  it('forfeits after 30 seconds and cancels the phase timer permanently', () => {
    const { room, a, b } = setup(); room.disconnectPlayer('player_1', a.ws);
    vi.advanceTimersByTime(29999); expect(tick(b).phase).not.toBe('MATCH_OVER');
    vi.advanceTimersByTime(1); expect(tick(b)).toMatchObject({ phase: 'MATCH_OVER', matchWinnerId: 'player_2', timeRemainingMs: 0 });
    expect(vi.getTimerCount()).toBe(0); const count = b.messages.length;
    vi.advanceTimersByTime(60000); expect(b.messages).toHaveLength(count);
    expect(room.reconnectPlayer('player_1', init(a).sessionToken!, socket().ws)).toBe(false);
  });

  it('preserves both dropped seats through their own grace deadlines and cleans up exactly once', () => {
    const manager = new RoomManager(); const room = manager.createRoom(); rooms.push(room);
    const a = socket(); const b = socket(); room.addPlayer(a.ws, 'A'); room.addPlayer(b.ws, 'B');
    room.disconnectPlayer('player_1', a.ws); vi.advanceTimersByTime(1000); room.disconnectPlayer('player_2', b.ws);
    vi.advanceTimersByTime(29000); expect(manager.activeRoomCount).toBe(1);
    const replacement = socket(); expect(room.reconnectPlayer('player_2', init(b).sessionToken!, replacement.ws)).toBe(true);
    expect(tick(replacement)).toMatchObject({ phase: 'MATCH_OVER', matchWinnerId: 'player_2' });
    expect(replacement.messages.some(msg => msg.type === 'ROUND_OUTCOME')).toBe(false);
    room.disconnectPlayer('player_2', replacement.ws); vi.advanceTimersByTime(30000);
    expect(manager.activeRoomCount).toBe(0); expect(vi.getTimerCount()).toBe(0);
  });

  it('retains simultaneous disconnects until grace expires, including a waiting host', () => {
    const empty = vi.fn(); const { room, a, b } = setup();
    room.disconnectPlayer('player_1', a.ws); room.disconnectPlayer('player_2', b.ws);
    vi.advanceTimersByTime(29999); expect(room.isEmpty).toBe(false);
    vi.advanceTimersByTime(1); expect(room.isEmpty).toBe(true); expect(vi.getTimerCount()).toBe(0);
    const lobby = new Room('WAIT', empty); rooms.push(lobby); const host = socket(); lobby.addPlayer(host.ws, 'A');
    lobby.disconnectPlayer('player_1', host.ws); vi.advanceTimersByTime(29999); expect(empty).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(empty).toHaveBeenCalledTimes(1);
  });

  it('marks a missing host disconnected when a second player joins during grace', () => {
    const room = new Room('TEST'); rooms.push(room); const a = socket(); const b = socket();
    room.addPlayer(a.ws, 'A'); room.disconnectPlayer('player_1', a.ws); room.addPlayer(b.ws, 'B');
    expect(tick(b).players.player_1.connected).toBe(false);
  });

  it('replays the revealed outcome on reconnect without revealing the next hand early', () => {
    const { room, a, b } = setup(); vi.advanceTimersByTime(2000); ready(room); commit(room, a); commit(room, b);
    room.disconnectPlayer('player_1', a.ws); const replacement = socket();
    expect(room.reconnectPlayer('player_1', init(a).sessionToken!, replacement.ws)).toBe(true);
    expect(replacement.messages.filter(m => m.type === 'ROUND_OUTCOME')).toHaveLength(1);
    vi.advanceTimersByTime(7000); room.disconnectPlayer('player_1', replacement.ws); const third = socket();
    expect(room.reconnectPlayer('player_1', init(a).sessionToken!, third.ws)).toBe(true);
    expect(third.messages.filter(m => m.type === 'ROUND_OUTCOME')).toHaveLength(0);
  });

  it('deliberate exit bypasses grace, invalidates token and rejects rematch with absent seats', () => {
    const { room, a, b } = setup(); room.handleMessage('player_1', { type: 'CMD_LEAVE_ROOM' });
    expect(tick(b)).toMatchObject({ phase: 'MATCH_OVER', matchWinnerId: 'player_2' }); expect(vi.getTimerCount()).toBe(0);
    expect(room.reconnectPlayer('player_1', init(a).sessionToken!, socket().ws)).toBe(false);
    room.handleMessage('player_2', { type: 'CMD_REMATCH' }); expect(b.messages.at(-1)?.type).toBe('ERROR_REJECTED');
    room.removePlayer('player_2'); expect(room.isEmpty).toBe(true);
  });

  it('destroy cancels all phase/grace handles and ignores subsequent operations', () => {
    const { room, a, b } = setup(); room.disconnectPlayer('player_1', a.ws); room.disconnectPlayer('player_2', b.ws);
    expect(vi.getTimerCount()).toBe(3); room.destroy(); room.destroy(); expect(vi.getTimerCount()).toBe(0);
    const before = b.messages.length; vi.advanceTimersByTime(100000);
    room.handleMessage('player_2', { type: 'CMD_READY' }); room.disconnectPlayer('player_2', b.ws);
    expect(b.messages).toHaveLength(before);
  });
});
