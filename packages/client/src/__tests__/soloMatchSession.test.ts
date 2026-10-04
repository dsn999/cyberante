import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerMessage } from '@cyberante/shared';
import { SoloMatchSession } from '../game/SoloMatchSession';

type Tick = Extract<ServerMessage, { type: 'STATE_TICK' }>;

describe('offline match lifecycle', () => {
  let session: SoloMatchSession;
  let messages: ServerMessage[];
  const tick = (): Tick => messages.filter((m): m is Tick => m.type === 'STATE_TICK').at(-1)!;
  beforeEach(() => {
    vi.useFakeTimers();
    messages = [];
    session = new SoloMatchSession('CIPHER_ZERO', 42, message => messages.push(message));
    session.start();
  });
  afterEach(() => { session.destroy(); vi.useRealTimers(); });

  it('deals before shaping and keeps opponent cards private', () => {
    expect(tick().phase).toBe('DEAL');
    expect(tick().timeRemainingMs).toBe(2000);
    expect(tick().selfCards).toHaveLength(5);
    expect(tick().players.bot).not.toHaveProperty('cards');
    expect(session.nudgeRank(tick().selfCards[0].id, 'UP')).toBe(false);
    expect(session.ready()).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(tick().phase).toBe('SHAPING');
    expect(tick().timeRemainingMs).toBe(15000);
    expect(session.nudgeRank(tick().selfCards[0].id, 'UP')).toBe(true);
    expect(tick().players.player.fluxRemaining).toBe(2);
  });

  it('honors a 1–1.5 second bot pause before commitment', () => {
    vi.advanceTimersByTime(2000);
    expect(session.ready()).toBe(true);
    expect(session.ready()).toBe(false);
    for (let elapsed = 0; elapsed < 1500 && tick().phase === 'SHAPING'; elapsed++) vi.advanceTimersByTime(1);
    expect(tick().phase).toBe('COMMITMENT');
    const cards = tick().selfCards;
    const commitmentStart = Date.now();
    expect(session.commitHand([cards[0].id, cards[1].id, cards[2].id], [cards[3].id, cards[4].id], 'BRACE')).toBe(true);
    const remainingPause = commitmentStart + 999 - Date.now();
    if (remainingPause > 0) vi.advanceTimersByTime(remainingPause);
    expect(tick().phase).toBe('COMMITMENT');
    vi.advanceTimersByTime(501);
    expect(tick().phase).toBe('CLASH_REVEAL');
    expect(messages.filter(m => m.type === 'ROUND_OUTCOME')).toHaveLength(1);
  });

  it('auto-locks idle humans, reveals for four seconds, then resolves for three', () => {
    vi.advanceTimersByTime(27000);
    expect(tick().phase).toBe('CLASH_REVEAL');
    expect(tick().players.player.hasCommitted).toBe(true);
    const hp = tick().players.player.guardHp;
    const outcome = messages.find(m => m.type === 'ROUND_OUTCOME')!;
    expect(outcome.type).toBe('ROUND_OUTCOME');
    vi.advanceTimersByTime(3999);
    expect(tick().phase).toBe('CLASH_REVEAL');
    vi.advanceTimersByTime(1);
    expect(tick().phase).toBe('ROUND_RESOLVE');
    vi.advanceTimersByTime(3000);
    expect(tick().phase).toBe('DEAL');
    if (outcome.type === 'ROUND_OUTCOME' && !outcome.resolution.isRoundOver) {
      expect(tick().players.player.guardHp).toBe(hp);
      expect(tick().exchangeNumber).toBe(2);
    }
    expect(tick().players.player.hasCommitted).toBe(false);
    expect(tick().players.player.fluxRemaining).toBe(3);
  });

  it('completes a best of three without user input and can rematch', () => {
    for (let i = 0; i < 150 && tick().phase !== 'MATCH_OVER'; i++) vi.advanceTimersByTime(34000);
    expect(tick().phase).toBe('MATCH_OVER');
    expect(tick().players[tick().matchWinnerId!].roundWins).toBe(2);
    const count = messages.length;
    vi.advanceTimersByTime(120000);
    expect(messages).toHaveLength(count);
    expect(session.rematch()).toBe(true);
    expect(tick().phase).toBe('DEAL');
    expect(tick().roundNumber).toBe(1);
    expect(tick().players.player.guardHp).toBe(20);
    expect(tick().players.player.roundWins).toBe(0);
  });

  it('cancels pending bot and phase callbacks on exit', () => {
    vi.advanceTimersByTime(2000);
    session.ready();
    session.destroy();
    const count = messages.length;
    vi.advanceTimersByTime(120000);
    expect(messages).toHaveLength(count);
    expect(vi.getTimerCount()).toBe(0);
    expect(session.ready()).toBe(false);
    expect(session.rematch()).toBe(false);
    expect(session.burnCard(tick().selfCards[0].id)).toBe(false);
  });

  it('emits deterministic outcomes for a fixed seed', () => {
    vi.advanceTimersByTime(27000);
    const first = messages.find(m => m.type === 'ROUND_OUTCOME');
    const secondMessages: ServerMessage[] = [];
    const second = new SoloMatchSession('CIPHER_ZERO', 42, m => secondMessages.push(m));
    second.start();
    vi.advanceTimersByTime(27000);
    expect(secondMessages.find(m => m.type === 'ROUND_OUTCOME')).toEqual(first);
    second.destroy();
  });
});
