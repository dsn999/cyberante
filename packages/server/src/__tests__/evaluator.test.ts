import { describe, it, expect } from 'vitest';
import {
  evaluateAssaultHand,
  evaluateAegisHand,
  Card,
  nudgeRank,
  bleedSuit,
} from '@cyberante/shared';

describe('Poker Evaluator - 3-Card Assault', () => {
  it('identifies Straight Flush correctly', () => {
    const cards: [Card, Card, Card] = [
      { id: '1', suit: 'SPADES', rank: 14 },
      { id: '2', suit: 'SPADES', rank: 13 },
      { id: '3', suit: 'SPADES', rank: 12 },
    ];
    const res = evaluateAssaultHand(cards);
    expect(res.tier).toBe('STRAIGHT_FLUSH');
    expect(res.baseDamage).toBe(18);
  });

  it('identifies Ace-low Straight (A-2-3)', () => {
    const cards: [Card, Card, Card] = [
      { id: '1', suit: 'HEARTS', rank: 14 },
      { id: '2', suit: 'CLUBS', rank: 2 },
      { id: '3', suit: 'DIAMONDS', rank: 3 },
    ];
    const res = evaluateAssaultHand(cards);
    expect(res.tier).toBe('STRAIGHT');
    expect(res.baseDamage).toBe(10);
  });

  it('identifies Three of a Kind', () => {
    const cards: [Card, Card, Card] = [
      { id: '1', suit: 'HEARTS', rank: 8 },
      { id: '2', suit: 'CLUBS', rank: 8 },
      { id: '3', suit: 'SPADES', rank: 8 },
    ];
    const res = evaluateAssaultHand(cards);
    expect(res.tier).toBe('THREE_OF_A_KIND');
    expect(res.baseDamage).toBe(14);
  });

  it('identifies Flush', () => {
    const cards: [Card, Card, Card] = [
      { id: '1', suit: 'CLUBS', rank: 10 },
      { id: '2', suit: 'CLUBS', rank: 7 },
      { id: '3', suit: 'CLUBS', rank: 2 },
    ];
    const res = evaluateAssaultHand(cards);
    expect(res.tier).toBe('FLUSH');
    expect(res.baseDamage).toBe(8);
  });

  it('identifies Pair', () => {
    const cards: [Card, Card, Card] = [
      { id: '1', suit: 'CLUBS', rank: 10 },
      { id: '2', suit: 'HEARTS', rank: 10 },
      { id: '3', suit: 'SPADES', rank: 4 },
    ];
    const res = evaluateAssaultHand(cards);
    expect(res.tier).toBe('PAIR');
    expect(res.baseDamage).toBe(5);
  });

  it('identifies High Card', () => {
    const cards: [Card, Card, Card] = [
      { id: '1', suit: 'CLUBS', rank: 12 },
      { id: '2', suit: 'HEARTS', rank: 8 },
      { id: '3', suit: 'SPADES', rank: 3 },
    ];
    const res = evaluateAssaultHand(cards);
    expect(res.tier).toBe('HIGH_CARD');
    expect(res.baseDamage).toBe(2);
  });
});

describe('Poker Evaluator - 2-Card Aegis', () => {
  it('evaluates Pair mitigation (8 block)', () => {
    const cards: [Card, Card] = [
      { id: '1', suit: 'HEARTS', rank: 9 },
      { id: '2', suit: 'SPADES', rank: 9 },
    ];
    const res = evaluateAegisHand(cards);
    expect(res.tier).toBe('PAIR');
    expect(res.mitigation).toBe(8);
  });

  it('evaluates Suited mitigation (4 block)', () => {
    const cards: [Card, Card] = [
      { id: '1', suit: 'HEARTS', rank: 13 },
      { id: '2', suit: 'HEARTS', rank: 6 },
    ];
    const res = evaluateAegisHand(cards);
    expect(res.tier).toBe('SUITED');
    expect(res.mitigation).toBe(4);
  });

  it('evaluates Offsuit High Card mitigation (2 block)', () => {
    const cards: [Card, Card] = [
      { id: '1', suit: 'HEARTS', rank: 14 },
      { id: '2', suit: 'CLUBS', rank: 5 },
    ];
    const res = evaluateAegisHand(cards);
    expect(res.tier).toBe('HIGH_CARD');
    expect(res.mitigation).toBe(2);
  });
});

describe('Flux Transmutations', () => {
  it('nudges rank up with Ace wrap', () => {
    const card: Card = { id: 'c1', suit: 'SPADES', rank: 14 };
    const nudged = nudgeRank(card, 'UP');
    expect(nudged.rank).toBe(2);
  });

  it('nudges rank down with Ace wrap', () => {
    const card: Card = { id: 'c1', suit: 'SPADES', rank: 2 };
    const nudged = nudgeRank(card, 'DOWN');
    expect(nudged.rank).toBe(14);
  });

  it('bleeds suit along chromatic ring', () => {
    const card: Card = { id: 'c1', suit: 'SPADES', rank: 10 };
    const bled = bleedSuit(card, 'CLUBS');
    expect(bled.suit).toBe('CLUBS');
  });
});
