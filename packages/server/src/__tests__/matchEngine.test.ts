import { describe, it, expect, vi } from 'vitest';
import { MatchEngine, SeededPRNG, SUIT_RING, type Card, type GamePhase, type Stance } from '@cyberante/shared';
import { CryptoPRNG } from '../Deck.js';
import { Room } from '../Room.js';
import { WebSocket } from 'ws';

function createEngine(seed = 42): MatchEngine {
  const engine = new MatchEngine('p1', 'A', 'p2', 'B', new SeededPRNG(seed));
  engine.startMatch();
  return engine;
}

function partition(engine: MatchEngine, id = 'p1'): [[string, string, string], [string, string]] {
  const c = engine.getPlayer(id)!.cards;
  return [[c[0].id, c[1].id, c[2].id], [c[3].id, c[4].id]];
}

// Shields keep both players alive while exercising real deck consumption across exchanges.
function finishWithoutDamage(engine: MatchEngine): void {
  engine.phase = 'COMMITMENT'; engine.autoLockUncommitted();
  engine.getPlayer('p1')!.activeBarrier = 100; engine.getPlayer('p2')!.activeBarrier = 100;
  expect(engine.resolveClash().isRoundOver).toBe(false);
  engine.phase = 'ROUND_RESOLVE'; engine.startExchange();
}

describe('Spec-03 engine deck lifecycle', () => {
  it('deals ten private cards from one deck and retains the remaining cards', () => {
    const e = createEngine(); const seen = new Set<string>();
    for (let exchange = 1; exchange <= 4; exchange++) {
      expect(e.phase).toBe('DEAL'); expect(e.remainingDeckCount).toBe(52 - 10 * exchange);
      for (const id of ['p1', 'p2']) {
        expect(e.getPlayer(id)!.cards).toHaveLength(5);
        for (const c of e.getPlayer(id)!.cards) {
          expect(seen.has(`${c.suit}:${c.rank}`)).toBe(false); seen.add(`${c.suit}:${c.rank}`);
        }
      }
      if (exchange < 4) finishWithoutDamage(e);
    }
  });

  it('uses exactly twelve remaining cards for the next deal and both burns', () => {
    const e = createEngine();
    for (let i = 0; i < 3; i++) finishWithoutDamage(e);
    expect(e.remainingDeckCount).toBe(12);
    const oldIds = new Set([...e.getPlayer('p1')!.cards, ...e.getPlayer('p2')!.cards].map(c => c.id));
    finishWithoutDamage(e);
    expect(e.remainingDeckCount).toBe(2);
    e.phase = 'SHAPING';
    for (const id of ['p1', 'p2']) expect(e.burnCard(id, e.getPlayer(id)!.cards[0].id)).toBe(true);
    expect(e.remainingDeckCount).toBe(0);
    expect(new Set([...e.getPlayer('p1')!.cards, ...e.getPlayer('p2')!.cards].map(c => c.id)).size).toBe(10);
    finishWithoutDamage(e);
    expect(e.remainingDeckCount).toBe(42);
    expect([...e.getPlayer('p1')!.cards, ...e.getPlayer('p2')!.cards].every(c => !oldIds.has(c.id))).toBe(true);
  });

  it.each([1, 2])('rebuilds before dealing when %i burns leave fewer than twelve cards', burns => {
    const e = createEngine();
    for (let i = 0; i < 3; i++) finishWithoutDamage(e);
    e.phase = 'SHAPING';
    for (const id of ['p1', 'p2'].slice(0, burns)) expect(e.burnCard(id, e.getPlayer(id)!.cards[0].id)).toBe(true);
    expect(e.remainingDeckCount).toBe(12 - burns);
    finishWithoutDamage(e); expect(e.remainingDeckCount).toBe(42);
  });

  it('uses injected server crypto for multiplayer shuffles', () => {
    const spy = vi.spyOn(CryptoPRNG.prototype, 'nextInt').mockImplementation((_min, max) => max - 1);
    const room = new Room('TEST');
    const socket = () => ({ readyState: WebSocket.OPEN, send: vi.fn(), close: vi.fn() }) as unknown as WebSocket;
    try {
      room.addPlayer(socket(), 'A'); room.addPlayer(socket(), 'B');
      expect(spy).toHaveBeenCalledTimes(51);
      expect(spy).toHaveBeenNthCalledWith(1, 0, 52); expect(spy).toHaveBeenLastCalledWith(0, 2);
    } finally { room.destroy(); spy.mockRestore(); }
  });

  it('replays a sequence including burns, transmutations, reshuffles and outcomes', () => {
    function replay() {
      const e = createEngine(1337); const events = [];
      for (let i = 0; i < 6; i++) {
        e.phase = 'SHAPING';
        const c = e.getPlayer('p1')!.cards[0];
        expect(e.nudgeRank('p1', c.id, 'UP')).toBe(true);
        expect(e.bleedSuit('p1', c.id, SUIT_RING[c.suit][0])).toBe(true);
        expect(e.burnCard('p2', e.getPlayer('p2')!.cards[0].id)).toBe(true);
        const cards = structuredClone([e.getPlayer('p1')!.cards, e.getPlayer('p2')!.cards]);
        e.phase = 'COMMITMENT'; e.autoLockUncommitted();
        e.getPlayer('p1')!.activeBarrier = 100; e.getPlayer('p2')!.activeBarrier = 100;
        events.push({ cards, outcome: e.resolveClash(), remaining: e.remainingDeckCount });
        e.phase = 'ROUND_RESOLVE'; e.startExchange();
      }
      return events;
    }
    expect(replay()).toEqual(replay());
  });
});

describe('Spec-03 action and commitment integrity', () => {
  it.each(['LOBBY_WAIT', 'DEAL', 'COMMITMENT', 'CLASH_REVEAL', 'ROUND_RESOLVE', 'MATCH_OVER'] as GamePhase[])('rejects shaping actions in %s without changing state', phase => {
    const e = createEngine(); e.phase = phase; const c = e.getPlayer('p1')!.cards[0];
    const before = structuredClone(e.getPlayer('p1')); const count = e.remainingDeckCount;
    expect(e.nudgeRank('p1', c.id, 'UP')).toBe(false);
    expect(e.bleedSuit('p1', c.id, SUIT_RING[c.suit][0])).toBe(false);
    expect(e.burnCard('p1', c.id)).toBe(false);
    expect(e.getPlayer('p1')).toEqual(before); expect(e.remainingDeckCount).toBe(count);
  });

  it('rejects foreign/missing cards, malformed directions, and nonadjacent suit changes without debit', () => {
    const e = createEngine(); e.phase = 'SHAPING'; const c = e.getPlayer('p1')!.cards[0];
    const foreign = e.getPlayer('p2')!.cards[0].id; const before = structuredClone(e.getPlayer('p1'));
    for (const id of ['missing', foreign]) {
      expect(e.nudgeRank('p1', id, 'UP')).toBe(false); expect(e.burnCard('p1', id)).toBe(false);
      expect(e.bleedSuit('p1', id, SUIT_RING[c.suit][0])).toBe(false);
    }
    expect(e.nudgeRank('p1', c.id, 'WRONG' as 'UP')).toBe(false);
    expect(e.bleedSuit('p1', c.id, c.suit)).toBe(false);
    expect(e.nudgeRank('stranger', c.id, 'UP')).toBe(false);
    expect(e.getPlayer('p1')).toEqual(before);
  });

  it('debits exactly three Flux and rejects further actions without negative balances', () => {
    const e = createEngine(); e.phase = 'SHAPING'; const c = e.getPlayer('p1')!.cards[0];
    expect(e.bleedSuit('p1', c.id, SUIT_RING[c.suit][0])).toBe(true);
    expect(e.getPlayer('p1')!.fluxRemaining).toBe(1);
    expect(e.bleedSuit('p1', c.id, c.suit)).toBe(false);
    expect(e.nudgeRank('p1', c.id, 'DOWN')).toBe(true);
    expect(e.getPlayer('p1')!.fluxRemaining).toBe(0);
    expect(e.nudgeRank('p1', c.id, 'UP')).toBe(false);
    expect(e.bleedSuit('p1', c.id, c.suit)).toBe(false);
    expect(e.getPlayer('p1')!.fluxRemaining).toBe(0);
  });

  it('burns once with one distinct replacement and resets shaping state next exchange', () => {
    const e = createEngine(); e.phase = 'SHAPING'; const p = e.getPlayer('p1')!;
    const unburnedIds = p.cards.slice(1).map(card => card.id);
    const c = p.cards[0]; p.cards[0] = { ...c, suit: 'DIAMONDS', rank: 14 };
    expect(e.burnCard('p1', c.id)).toBe(true);
    expect(p.cards).toHaveLength(5); expect(p.cards[0].id).not.toBe(c.id);
    expect(p.cards.slice(1).map(card => card.id)).toEqual(unburnedIds);
    expect(p).toMatchObject({ activeBurn: 'DIAMOND_BARRIER', activeBarrier: 11, hasBurnedCard: true, fluxRemaining: 3 });
    expect(e.remainingDeckCount).toBe(41);
    expect(e.burnCard('p1', p.cards[1].id)).toBe(false); expect(e.remainingDeckCount).toBe(41);
    expect(e.nudgeRank('p1', p.cards[1].id, 'UP')).toBe(true);
    finishWithoutDamage(e);
    expect(p).toMatchObject({ activeBurn: null, activeBarrier: 0, hasBurnedCard: false, fluxRemaining: 3, hasCommitted: false, chosenStance: null });
  });

  it.each(['LOBBY_WAIT', 'DEAL', 'SHAPING', 'CLASH_REVEAL', 'ROUND_RESOLVE', 'MATCH_OVER'] as GamePhase[])('rejects commitment in %s', phase => {
    const e = createEngine(); e.phase = phase;
    expect(e.commitHand('p1', ...partition(e), 'BRACE')).toBe(false);
    expect(e.getPlayer('p1')!.hasCommitted).toBe(false);
  });

  it('rejects malformed, duplicate, foreign and stale partitions', () => {
    const e = createEngine(); e.phase = 'SHAPING'; const stale = partition(e);
    expect(e.burnCard('p1', stale[0][0])).toBe(true); e.phase = 'COMMITMENT';
    expect(e.commitHand('p1', ...stale, 'BRACE')).toBe(false);
    const [a, d] = partition(e);
    expect(e.commitHand('p1', [a[0], a[0], a[2]], d, 'BRACE')).toBe(false);
    expect(e.commitHand('p1', [e.getPlayer('p2')!.cards[0].id, a[1], a[2]], d, 'BRACE')).toBe(false);
    expect(e.commitHand('p1', [...a, d[0]] as unknown as [string, string, string], [d[1]] as unknown as [string, string], 'BRACE')).toBe(false);
    expect(e.commitHand('p1', a, d, 'INVALID' as Stance)).toBe(false);
    expect(e.getPlayer('p1')!.hasCommitted).toBe(false);
  });

  it('copies commitment arrays, rejects overwrite and freezes further shaping actions', () => {
    const e = createEngine(); e.phase = 'COMMITMENT'; const [a, d] = partition(e);
    expect(e.commitHand('p1', a, d, 'PARRY')).toBe(true); const saved = [...a]; a.reverse(); d.reverse();
    expect(e.getPlayer('p1')!.assaultCardIds).toEqual(saved);
    expect(e.commitHand('p1', ...partition(e), 'BRACE')).toBe(false);
    e.phase = 'SHAPING';
    expect(e.nudgeRank('p1', a[0], 'UP')).toBe(false); expect(e.burnCard('p1', a[0])).toBe(false);
    expect(e.bleedSuit('p1', a[0], 'CLUBS')).toBe(false);
  });
});

describe('Spec-03 match progression', () => {
  it('auto-locks the best Assault and preserves an existing commitment', () => {
    const e = createEngine();
    e.getPlayer('p1')!.cards = [
      { id: 'a', suit: 'SPADES', rank: 12 },
      { id: 'b', suit: 'HEARTS', rank: 8 },
      { id: 'c', suit: 'SPADES', rank: 13 },
      { id: 'd', suit: 'CLUBS', rank: 8 },
      { id: 'e', suit: 'SPADES', rank: 14 },
    ];
    e.phase = 'COMMITMENT';
    expect(e.commitHand('p2', ...partition(e, 'p2'), 'PARRY')).toBe(true);
    const committed = structuredClone(e.getPlayer('p2'));
    e.autoLockUncommitted();
    expect(e.getPlayer('p1')).toMatchObject({
      assaultCardIds: ['a', 'c', 'e'], aegisCardIds: ['b', 'd'],
      chosenStance: 'BRACE', hasCommitted: true,
    });
    expect(e.getPlayer('p2')).toEqual(committed);
    expect(e.areBothCommitted()).toBe(true);
  });

  it('guards premature clash, auto-lock and repeated exchange starts', () => {
    const e = createEngine(); const count = e.remainingDeckCount;
    expect(() => e.resolveClash()).toThrow(); expect(e.phase).toBe('DEAL');
    expect(() => e.autoLockUncommitted()).toThrow(); expect(() => e.startExchange()).toThrow();
    e.phase = 'COMMITMENT'; expect(() => e.resolveClash()).toThrow();
    e.autoLockUncommitted(); e.getPlayer('p1')!.activeBarrier = 100; e.getPlayer('p2')!.activeBarrier = 100;
    const r = e.resolveClash(); const before = structuredClone(e.getPublicState());
    e.phase = 'COMMITMENT'; expect(e.resolveClash()).toBe(r); expect(e.getPublicState()).toEqual(before);
    expect(e.remainingDeckCount).toBe(count);
    e.phase = 'ROUND_RESOLVE'; e.startExchange();
    e.phase = 'ROUND_RESOLVE'; expect(() => e.startExchange()).toThrow();
    expect(e.currentExchange).toBe(2); expect(e.remainingDeckCount).toBe(32);
  });

  it('carries HP within a round, preserves knockout display, resets next round, and ends at two wins', () => {
    const e = createEngine();
    function resolveFixture(p2Hp: number) {
      const p1 = e.getPlayer('p1')!; const p2 = e.getPlayer('p2')!;
      const strong: [Card, Card, Card] = [
        { id: 'a', suit: 'SPADES', rank: 14 }, { id: 'b', suit: 'SPADES', rank: 13 }, { id: 'c', suit: 'SPADES', rank: 12 },
      ];
      const weak: [Card, Card, Card] = [
        { id: 'f', suit: 'HEARTS', rank: 8 }, { id: 'g', suit: 'CLUBS', rank: 8 }, { id: 'h', suit: 'SPADES', rank: 3 },
      ];
      p1.cards = [...strong, { id: 'd', suit: 'CLUBS', rank: 2 }, { id: 'e', suit: 'HEARTS', rank: 7 }];
      p2.cards = [...weak, { id: 'i', suit: 'CLUBS', rank: 2 }, { id: 'j', suit: 'HEARTS', rank: 7 }];
      p2.guardHp = p2Hp; e.phase = 'COMMITMENT';
      expect(e.commitHand('p1', ...partition(e), 'BRACE')).toBe(true);
      expect(e.commitHand('p2', ...partition(e, 'p2'), 'BRACE')).toBe(true);
      return e.resolveClash();
    }
    expect(resolveFixture(20).isRoundOver).toBe(false);
    expect(e.getPlayer('p1')!.guardHp).toBe(17); expect(e.getPlayer('p2')!.guardHp).toBe(4);
    e.phase = 'ROUND_RESOLVE'; e.startExchange();
    expect(e.currentRound).toBe(1); expect(e.currentExchange).toBe(2);
    expect(e.getPlayer('p1')!.guardHp).toBe(17); expect(e.getPlayer('p2')!.guardHp).toBe(4);
    const ko = resolveFixture(4);
    expect(ko.roundWinnerId).toBe('p1'); expect(e.getPlayer('p2')!.guardHp).toBe(0);
    expect(e.currentRound).toBe(1); expect(e.getPlayer('p1')!.roundWins).toBe(1);
    e.phase = 'ROUND_RESOLVE'; e.startExchange();
    expect(e.currentRound).toBe(2); expect(e.currentExchange).toBe(1);
    expect(e.getPlayer('p1')!.guardHp).toBe(20); expect(e.getPlayer('p2')!.guardHp).toBe(20);
    const final = resolveFixture(1); expect(final.matchWinnerId).toBe('p1'); expect(e.matchWinnerId).toBe('p1');
    expect(e.getPlayer('p1')!.roundWins).toBe(2); expect(e.resolveClash()).toBe(final);
    e.phase = 'ROUND_RESOLVE'; expect(() => e.startExchange()).toThrow();
    e.startMatch(); expect(e.phase).toBe('DEAL'); expect(e.currentRound).toBe(1);
    expect(e.getPlayer('p1')!.roundWins).toBe(0); expect(e.lastResolution).toBeNull(); expect(e.remainingDeckCount).toBe(42);
  });
});
