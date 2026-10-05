import { describe, it, expect } from 'vitest';
import {
  evaluateAssaultHand,
  evaluateAegisHand,
  Card,
  nudgeRank,
  bleedSuit,
  type Rank,
  type Suit,
  type HandTier3,
  type HandTier2,
} from '@cyberante/shared';

function assault(ranks: [Rank, Rank, Rank], suited = false): [Card, Card, Card] {
  const suits: [Suit, Suit, Suit] = suited ? ['SPADES', 'SPADES', 'SPADES'] : ['SPADES', 'HEARTS', 'CLUBS'];
  return ranks.map((rank, i) => ({ id: `a${i}`, rank, suit: suits[i] })) as [Card, Card, Card];
}

function aegis(ranks: [Rank, Rank], suited = false): [Card, Card] {
  return ranks.map((rank, i) => ({ id: `d${i}`, rank, suit: suited || i === 0 ? 'SPADES' : 'HEARTS' })) as [Card, Card];
}

describe('Spec-02 evaluation scores and boundaries', () => {
  const cases: Array<[HandTier3, [Rank, Rank, Rank], boolean, number, number]> = [
    ['STRAIGHT_FLUSH', [12, 14, 13], true, 18, 60014],
    ['STRAIGHT_FLUSH', [2, 14, 3], true, 18, 60003],
    ['THREE_OF_A_KIND', [8, 8, 8], false, 14, 50008],
    ['STRAIGHT', [12, 14, 13], false, 10, 40014],
    ['STRAIGHT', [2, 14, 3], false, 10, 40003],
    ['FLUSH', [2, 10, 7], true, 8, 32674],
    ['PAIR', [10, 4, 10], false, 5, 20164],
    ['PAIR', [8, 14, 8], false, 5, 20142],
    ['HIGH_CARD', [3, 12, 8], false, 2, 13203],
    // Ace wraps for nudges, but K-A-2 is not a poker straight.
    ['HIGH_CARD', [13, 14, 2], false, 2, 13794],
  ];

  it.each(cases)('%s scores ranks %j (suited=%s)', (tier, ranks, suited, damage, score) => {
    const cards = assault(ranks, suited);
    const snapshot = structuredClone(cards);
    cards.forEach(Object.freeze);
    Object.freeze(cards);
    const permutations = [
      [cards[0], cards[1], cards[2]], [cards[0], cards[2], cards[1]],
      [cards[1], cards[0], cards[2]], [cards[1], cards[2], cards[0]],
      [cards[2], cards[0], cards[1]], [cards[2], cards[1], cards[0]],
    ] as Array<[Card, Card, Card]>;
    for (const permutation of permutations) {
      const result = evaluateAssaultHand(permutation);
      expect(result).toMatchObject({ tier, baseDamage: damage, score });
      expect(result.cards.map(c => c.rank)).toEqual([...ranks].sort((a, b) => b - a));
    }
    expect(cards).toEqual(snapshot);
  });

  it('describes an Ace-low straight flush without calling it Ace-high', () => {
    expect(evaluateAssaultHand(assault([14, 2, 3], true)).description).toBe('Straight Flush (A-2-3)');
  });
  it('describes Jack pairs and preserves their kicker score', () => {
    expect(evaluateAssaultHand(assault([11, 2, 11]))).toMatchObject({
      tier: 'PAIR', description: 'Pair of Jacks', score: 20178, baseDamage: 5,
    });
  });

  const defenseCases: Array<[HandTier2, [Rank, Rank], boolean, number, number]> = [
    ['PAIR', [9, 9], false, 8, 2009],
    ['PAIR', [9, 9], true, 8, 2009],
    ['SUITED', [6, 13], true, 4, 1214],
    ['HIGH_CARD', [5, 14], false, 2, 229],
  ];
  it.each(defenseCases)('%s scores Aegis ranks %j (suited=%s)', (tier, ranks, suited, mitigation, score) => {
    const cards = aegis(ranks, suited);
    const snapshot = structuredClone(cards);
    cards.forEach(Object.freeze);
    Object.freeze(cards);
    for (const pair of [cards, [cards[1], cards[0]] as [Card, Card]]) {
      expect(evaluateAegisHand(pair)).toMatchObject({ tier, mitigation, score });
    }
    expect(cards).toEqual(snapshot);
  });

  it('orders equal tiers by every lexicographic kicker', () => {
    for (const suited of [false, true]) {
      const low = evaluateAssaultHand(assault([12, 8, 3], suited));
      expect(evaluateAssaultHand(assault([12, 8, 4], suited)).score).toBeGreaterThan(low.score);
      expect(evaluateAssaultHand(assault([12, 9, 2], suited)).score).toBeGreaterThan(low.score);
      expect(evaluateAssaultHand(assault([13, 7, 2], suited)).score).toBeGreaterThan(low.score);
    }
    expect(evaluateAssaultHand(assault([8, 8, 4])).score).toBeGreaterThan(evaluateAssaultHand(assault([8, 8, 3])).score);
    expect(evaluateAssaultHand(assault([9, 9, 2])).score).toBeGreaterThan(evaluateAssaultHand(assault([8, 8, 14])).score);
    expect(evaluateAssaultHand(assault([9, 9, 9])).score).toBeGreaterThan(evaluateAssaultHand(assault([8, 8, 8])).score);
    for (const suited of [false, true]) {
      expect(evaluateAssaultHand(assault([2, 3, 4], suited)).score).toBeGreaterThan(evaluateAssaultHand(assault([14, 2, 3], suited)).score);
      expect(evaluateAegisHand(aegis([13, 7], suited)).score).toBeGreaterThan(evaluateAegisHand(aegis([13, 6], suited)).score);
      expect(evaluateAegisHand(aegis([14, 2], suited)).score).toBeGreaterThan(evaluateAegisHand(aegis([13, 12], suited)).score);
    }
    expect(evaluateAegisHand(aegis([10, 10])).score).toBeGreaterThan(evaluateAegisHand(aegis([9, 9])).score);
  });
});

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
