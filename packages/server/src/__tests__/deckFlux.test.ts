import { describe, it, expect } from 'vitest';
import {
  Deck, CryptoPRNG,
} from '../Deck.js';
import {
  Card,
  nudgeRank,
  bleedSuit,
  evaluateBurn,
  canNudgeRank,
  canBleedSuit,
  canBurnCard,
  SUIT_RING,
  GAME_CONSTANTS,
  SeededPRNG,
  DefaultPRNG,
  type Rank,
  type Suit,
} from '@cyberante/shared';

describe('Deck & Flux Transmutation Engine', () => {
  it('generates a full 52-card standard deck and deals cards', () => {
    const deck = new Deck();
    expect(deck.remainingCount).toBe(52);

    const hand = deck.deal(5);
    expect(hand.length).toBe(5);
    expect(deck.remainingCount).toBe(47);

    // Each card has valid suit and rank
    for (const card of hand) {
      expect(['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS']).toContain(card.suit);
      expect(card.rank).toBeGreaterThanOrEqual(2);
      expect(card.rank).toBeLessThanOrEqual(14);
    }
  });

  it('draws single replacement cards for Burn-to-Cast', () => {
    const deck = new Deck();
    const c1 = deck.drawOne();
    expect(c1).toBeDefined();
    expect(deck.remainingCount).toBe(51);
  });

  it('handles Pip Nudge rank transitions and Ace wrapping', () => {
    const cardMid: Card = { id: 'c1', suit: 'SPADES', rank: 7 };
    expect(nudgeRank(cardMid, 'UP').rank).toBe(8);
    expect(nudgeRank(cardMid, 'DOWN').rank).toBe(6);

    // King -> Ace
    const cardKing: Card = { id: 'c2', suit: 'HEARTS', rank: 13 };
    expect(nudgeRank(cardKing, 'UP').rank).toBe(14);

    // Ace wrapping: 14 UP -> 2, 2 DOWN -> 14
    const cardAce: Card = { id: 'c3', suit: 'DIAMONDS', rank: 14 };
    expect(nudgeRank(cardAce, 'UP').rank).toBe(2);

    const cardTwo: Card = { id: 'c4', suit: 'CLUBS', rank: 2 };
    expect(nudgeRank(cardTwo, 'DOWN').rank).toBe(14);
  });

  it('handles chromatic Suit Bleed transitions along the cyclic ring', () => {
    const spade: Card = { id: 'c1', suit: 'SPADES', rank: 10 };
    // Spades can bleed to Clubs or Hearts
    expect(bleedSuit(spade, 'CLUBS').suit).toBe('CLUBS');
    expect(bleedSuit(spade, 'HEARTS').suit).toBe('HEARTS');

    // Spades cannot bleed across to Diamonds directly
    expect(() => bleedSuit(spade, 'DIAMONDS')).toThrow();

    // Verify all suit ring adjacencies
    expect(SUIT_RING.SPADES).toEqual(['CLUBS', 'HEARTS']);
    expect(SUIT_RING.CLUBS).toEqual(['SPADES', 'DIAMONDS']);
    expect(SUIT_RING.DIAMONDS).toEqual(['CLUBS', 'HEARTS']);
    expect(SUIT_RING.HEARTS).toEqual(['DIAMONDS', 'SPADES']);
  });

  it('evaluates Burn-to-Cast effects across all 4 suits', () => {
    // Spade -> Veil
    const spade: Card = { id: 'c1', suit: 'SPADES', rank: 10 };
    expect(evaluateBurn(spade).burnType).toBe('SPADE_VEIL');

    // Heart -> Siphon
    const heart: Card = { id: 'c2', suit: 'HEARTS', rank: 5 };
    expect(evaluateBurn(heart).burnType).toBe('HEART_SIPHON');

    // Club -> Sunder
    const club: Card = { id: 'c3', suit: 'CLUBS', rank: 9 };
    expect(evaluateBurn(club).burnType).toBe('CLUB_SUNDER');

    // Diamond -> Barrier (Ace=11, Face=10, Pip=rank)
    const diamondAce: Card = { id: 'c4', suit: 'DIAMONDS', rank: 14 };
    const diamondKing: Card = { id: 'c5', suit: 'DIAMONDS', rank: 13 };
    const diamond7: Card = { id: 'c6', suit: 'DIAMONDS', rank: 7 };

    expect(evaluateBurn(diamondAce)).toEqual({ burnType: 'DIAMOND_BARRIER', barrierAmount: 11 });
    expect(evaluateBurn(diamondKing)).toEqual({ burnType: 'DIAMOND_BARRIER', barrierAmount: 10 });
    expect(evaluateBurn(diamond7)).toEqual({ burnType: 'DIAMOND_BARRIER', barrierAmount: 7 });
  });

  it('enforces Flux cost constraints', () => {
    const state = { remainingFlux: 3, hasBurnedThisRound: false };
    expect(canNudgeRank(state)).toBe(true);
    expect(canBleedSuit(state)).toBe(true);
    expect(canBurnCard(state)).toBe(true);

    const lowFlux = { remainingFlux: 1, hasBurnedThisRound: true };
    expect(canNudgeRank(lowFlux)).toBe(true);
    expect(canBleedSuit(lowFlux)).toBe(false); // Bleed costs 2
    expect(canBurnCard(lowFlux)).toBe(false); // Max 1 burn per exchange
  });
});

describe('Spec-03 deck boundaries and PRNG', () => {
  it('contains every standard card exactly once with unique IDs', () => {
    const cards = new Deck().deal(52);
    expect(new Set(cards.map(c => c.id)).size).toBe(52);
    expect(new Set(cards.map(c => `${c.suit}:${c.rank}`)).size).toBe(52);
    for (const suit of ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS']) {
      expect(cards.filter(c => c.suit === suit).map(c => c.rank).sort((a, b) => a - b))
        .toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    }
    for (let rank = 2; rank <= 14; rank++) expect(cards.filter(c => c.rank === rank)).toHaveLength(4);
    expect(cards.map(c => c.id)).not.toEqual([...cards].sort((a, b) => Number(a.id.split('_')[1]) - Number(b.id.split('_')[1])).map(c => c.id));
  });

  it('rejects overdealing and empty draws without fabricating cards', () => {
    const deck = new Deck();
    deck.deal(5); deck.deal(5);
    expect(deck.remainingCount).toBe(42);
    expect(() => deck.deal(50)).toThrow();
    expect(deck.remainingCount).toBe(42);
    expect(deck.deal(0)).toEqual([]);
    deck.deal(42);
    expect(() => deck.drawOne()).toThrow('empty deck');
    expect(deck.remainingCount).toBe(0);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid deal count %s without consuming cards', count => {
    const deck = new Deck();
    expect(() => deck.deal(count)).toThrow();
    expect(deck.remainingCount).toBe(52);
  });

  it('rebuilds a deck with fresh IDs and preserves cards when reshuffling', () => {
    const deck = new Deck();
    const old = new Set(deck.deal(52).map(c => c.id));
    deck.reset(); deck.shuffle();
    const cards = deck.deal(52);
    expect(cards.every(c => !old.has(c.id))).toBe(true);
    expect(new Set(cards.map(c => `${c.suit}:${c.rank}`)).size).toBe(52);
  });

  it('replays seeded sequences and keeps integer bounds exclusive', () => {
    for (const seed of [0, 42, -1, 4294967295]) {
      const a = new SeededPRNG(seed); const b = new SeededPRNG(seed);
      for (let i = 0; i < 100; i++) {
        const r = a.random(); expect(r).toBe(b.random());
        expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThan(1);
        const n = a.nextInt(-3, 7); expect(n).toBe(b.nextInt(-3, 7));
        expect(Number.isInteger(n)).toBe(true); expect(n).toBeGreaterThanOrEqual(-3); expect(n).toBeLessThan(7);
      }
    }
    expect(new DefaultPRNG().random()).toBe(new DefaultPRNG().random());
    expect(new SeededPRNG(1).random()).not.toBe(new SeededPRNG(2).random());
  });

  it.each([[0, 0], [2, 1], [0.5, 3], [0, Infinity], [NaN, 1]])('rejects invalid PRNG bounds %s..%s', (min, max) => {
    expect(() => new SeededPRNG(42).nextInt(min, max)).toThrow();
    expect(() => new CryptoPRNG().nextInt(min, max)).toThrow();
  });

  it('provides a server crypto adapter with the PRNG range contract', () => {
    const rng = new CryptoPRNG();
    for (let i = 0; i < 100; i++) {
      expect(rng.nextInt(8, 9)).toBe(8);
      const r = rng.random(); expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThan(1);
    }
  });
});

describe('Spec-03 complete Flux boundaries', () => {
  it('nudges all thirteen ranks both ways without mutating card identity', () => {
    for (let rank = 2; rank <= 14; rank++) {
      const card: Card = Object.freeze({ id: `rank${rank}`, rank: rank as Rank, suit: 'SPADES' });
      const up = nudgeRank(card, 'UP'); const down = nudgeRank(card, 'DOWN');
      expect(up).toEqual({ ...card, rank: rank === 14 ? 2 : rank + 1 });
      expect(down).toEqual({ ...card, rank: rank === 2 ? 14 : rank - 1 });
      expect(up).not.toBe(card); expect(down).not.toBe(card);
    }
    expect(() => nudgeRank({ id: 'a', rank: 2, suit: 'SPADES' }, 'SIDEWAYS' as 'UP')).toThrow();
  });

  it('accepts exactly both ring neighbors for every suit and rejects self/opposite', () => {
    const suits: Suit[] = ['SPADES', 'CLUBS', 'DIAMONDS', 'HEARTS'];
    for (const suit of suits) {
      const card: Card = Object.freeze({ id: 'same-id', suit, rank: 7 });
      for (const target of suits) {
        if (SUIT_RING[suit].includes(target)) {
          const result = bleedSuit(card, target);
          expect(result).toEqual({ ...card, suit: target }); expect(result).not.toBe(card);
        } else expect(() => bleedSuit(card, target)).toThrow();
      }
      expect(card.suit).toBe(suit);
    }
  });

  it('scales Diamond shields for every rank and does not mutate the burned card', () => {
    for (let rank = 2; rank <= 14; rank++) {
      const card: Card = Object.freeze({ id: 'diamond', suit: 'DIAMONDS', rank: rank as Rank });
      expect(evaluateBurn(card)).toEqual({ burnType: 'DIAMOND_BARRIER', barrierAmount: rank === 14 ? 11 : Math.min(rank, 10) });
      expect(card.rank).toBe(rank);
    }
  });

  it('disables paid actions at zero Flux and burn after its first use', () => {
    const state = { remainingFlux: 0, hasBurnedThisRound: true };
    expect(canNudgeRank(state)).toBe(false); expect(canBleedSuit(state)).toBe(false); expect(canBurnCard(state)).toBe(false);
    expect(GAME_CONSTANTS.FLUX_COST_NUDGE).toBe(1); expect(GAME_CONSTANTS.FLUX_COST_BLEED).toBe(2);
  });
});
