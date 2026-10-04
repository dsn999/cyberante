import { describe, expect, it } from 'vitest';
import {
  ClassicalBotAI, BOT_PROFILES, SeededPRNG, MatchEngine, applyBotShaping,
  evaluateAssaultHand, evaluateAegisHand, nudgeRank,
  type Card, type BotConfig, type BotDecision, type BotPersonality, type PRNG,
} from '@cyberante/shared';

function cards(values: Array<[Card['rank'], Card['suit']]>): Card[] {
  return values.map(([rank, suit], i) => ({ id: `card_${i}`, rank, suit }));
}
const weak = cards([[2, 'SPADES'], [5, 'HEARTS'], [8, 'DIAMONDS'], [11, 'CLUBS'], [14, 'SPADES']]);
const strong = cards([[14, 'SPADES'], [13, 'SPADES'], [12, 'SPADES'], [5, 'HEARTS'], [2, 'CLUBS']]);
const profiles: BotPersonality[] = ['CIPHER_ZERO', 'VEKTOR_AGGRO', 'AEGIS_WALL'];
class Rolls implements PRNG {
  calls = 0;
  constructor(private readonly values: number[] = [0.99]) {}
  random(): number { return this.values[this.calls++ % this.values.length]; }
  nextInt(min: number, max: number): number { return Math.floor(this.random() * (max - min)) + min; }
}
function utility(assault: [Card, Card, Card], aegis: [Card, Card], config: BotConfig): number {
  const eval3 = evaluateAssaultHand(assault);
  return eval3.baseDamage * config.assaultBias + evaluateAegisHand(aegis).mitigation * config.aegisBias + eval3.score * 0.0001;
}
// Independent enumeration is an oracle for every one of the ten partitions.
function partitions(hand: Card[]) {
  const result: Array<{ assault: [Card, Card, Card]; aegis: [Card, Card] }> = [];
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 4; j++) for (let k = j + 1; k < 5; k++) {
    result.push({ assault: [hand[i], hand[j], hand[k]], aegis: hand.filter((_c, idx) => idx !== i && idx !== j && idx !== k) as [Card, Card] });
  }
  return result;
}
function checkDecision(decision: BotDecision, hand: Card[]) {
  expect(decision.assaultCards).toHaveLength(3); expect(decision.aegisCards).toHaveLength(2);
  expect(decision.assaultCardIds).toEqual(decision.assaultCards.map(c => c.id));
  expect(decision.aegisCardIds).toEqual(decision.aegisCards.map(c => c.id));
  expect(decision.stance).toBe(decision.chosenStance);
  const ids = [...decision.assaultCardIds, ...decision.aegisCardIds];
  expect(new Set(ids).size).toBe(5); expect([...ids].sort()).toEqual(hand.map(c => c.id).sort());
  expect(decision.nudges).toEqual(decision.fluxActions.map(a => ({ cardId: a.cardId, direction: a.direction })));
  expect(decision.cardToBurn?.id).toBe(decision.burnCardId);
  const shaped = hand.map(card => {
    const action = decision.fluxActions.find(a => a.cardId === card.id);
    return action?.type === 'NUDGE' && action.direction ? nudgeRank(card, action.direction) : card;
  });
  const byId = (a: Card, b: Card) => a.id.localeCompare(b.id);
  expect([...decision.assaultCards, ...decision.aegisCards].sort(byId)).toEqual([...shaped].sort(byId));
}

describe('Spec-05 profiles, search and contract', () => {
  it('defines the exact three prescribed weight sets and isolates returned profiles', () => {
    const expected = [[0.6, 0.5, 0.25, 0.35, 0.4], [0.85, 0.25, 0.6, 0.15, 0.7], [0.5, 0.75, 0.1, 0.55, 0.5]];
    const bot = new ClassicalBotAI(); expect(bot.getProfile().personality).toBe('CIPHER_ZERO');
    profiles.forEach((name, i) => {
      bot.setProfile(name); const p = bot.getProfile();
      expect(p).toEqual(BOT_PROFILES[name]); expect(p.personality).toBe(name);
      expect([p.assaultBias, p.aegisBias, p.overchargeTendency, p.parryTendency, p.burnAggression]).toEqual(expected[i]);
      expect(p.name.length).toBeGreaterThan(0); expect(p.tagline.length).toBeGreaterThan(0);
      p.assaultBias = 999; expect(bot.getProfile().assaultBias).toBe(expected[i][0]);
    });
    expect(() => bot.setProfile('UNKNOWN' as BotPersonality)).toThrow();
    expect(() => new ClassicalBotAI('toString' as BotPersonality)).toThrow();
  });

  it.each(profiles)('maximizes the exact utility over ten unique partitions for %s', profile => {
    const prng = new SeededPRNG(42); const bot = new ClassicalBotAI(profile, new SeededPRNG(42));
    for (let h = 0; h < 100; h++) {
      const hand = Array.from({ length: 5 }, (_, i) => ({ id: `${h}_${i}`, rank: prng.nextInt(2, 15) as Card['rank'], suit: (['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'] as const)[prng.nextInt(0, 4)] }));
      const options = partitions(hand); expect(options).toHaveLength(10);
      expect(new Set(options.map(o => o.assault.map(c => c.id).sort().join(','))).size).toBe(10);
      const best = options.reduce((a, b) => utility(b.assault, b.aegis, bot.getProfile()) > utility(a.assault, a.aegis, bot.getProfile()) ? b : a);
      const d = bot.evaluateHand(hand, 20, 20, 0, false); checkDecision(d, hand);
      expect(d.assaultCardIds).toEqual(best.assault.map(c => c.id)); expect(d.aegisCardIds).toEqual(best.aegis.map(c => c.id));
    }
  });

  it('uses the Assault score term rather than the first equal damage/block split', () => {
    const hand = cards([[2, 'SPADES'], [6, 'HEARTS'], [10, 'CLUBS'], [14, 'DIAMONDS'], [9, 'HEARTS']]);
    const d = new ClassicalBotAI().evaluateHand(hand, 20, 20, 0, false);
    const best = partitions(hand).sort((a, b) => utility(b.assault, b.aegis, BOT_PROFILES.CIPHER_ZERO) - utility(a.assault, a.aegis, BOT_PROFILES.CIPHER_ZERO))[0];
    expect(d.assaultCardIds).toEqual(best.assault.map(c => c.id));
    expect(d.assaultCardIds).not.toEqual(hand.slice(0, 3).map(c => c.id));
  });

  it.each([0, 1, 4, 6])('rejects hand size %i', size => expect(() => new ClassicalBotAI().evaluateHand(Array.from({ length: size }, () => weak[0]), 20, 20)).toThrow());
  it('rejects duplicate IDs, invalid card values, Flux and HP without consuming randomness', () => {
    const rng = new Rolls(); const bot = new ClassicalBotAI('CIPHER_ZERO', rng);
    expect(() => bot.evaluateHand([weak[0], weak[0], ...weak.slice(2)], 20, 20)).toThrow();
    expect(() => bot.evaluateHand([{ ...weak[0], rank: 15 } as unknown as Card, ...weak.slice(1)], 20, 20)).toThrow();
    expect(() => bot.evaluateHand([{ ...weak[0], suit: 'OTHER' } as unknown as Card, ...weak.slice(1)], 20, 20)).toThrow();
    for (const flux of [-1, 0.5, NaN, Infinity]) expect(() => bot.evaluateHand(weak, 20, 20, flux)).toThrow();
    expect(() => bot.evaluateHand(weak, NaN, 20)).toThrow(); expect(() => bot.evaluateHand(weak, 20, -1)).toThrow(); expect(rng.calls).toBe(0);
  });

  it('preserves frozen input arrays/cards and returns independent card objects', () => {
    const hand = strong.map(c => Object.freeze({ ...c })); Object.freeze(hand); const before = structuredClone(hand);
    const d = new ClassicalBotAI('VEKTOR_AGGRO', new Rolls([0])).evaluateHand(hand, 8, 20, 3, true);
    expect(hand).toEqual(before); checkDecision(d, hand);
    d.assaultCards[0].rank = 2;
    if (d.cardToBurn) d.cardToBurn.rank = 2;
    expect(hand).toEqual(before);
  });

  it('has a deterministic default and repeatable explicit PRNG consumption', () => {
    expect(new ClassicalBotAI().evaluateHand(weak, 12, 20)).toEqual(new ClassicalBotAI().evaluateHand(weak, 12, 20));
    const rng = new Rolls([0, 0.9]); const bot = new ClassicalBotAI('CIPHER_ZERO', rng);
    bot.evaluateHand(weak, 20, 20, 0, true); expect(rng.calls).toBe(2);
    bot.evaluateHand(strong, 20, 20, 0, false); expect(rng.calls).toBe(2);
    bot.evaluateHand(weak, 5, 20, 0, false); expect(rng.calls).toBe(3);
  });
});

describe('Spec-05 fixed-partition Pip Nudge', () => {
  const hand = cards([[10, 'SPADES'], [10, 'CLUBS'], [9, 'HEARTS'], [2, 'SPADES'], [7, 'DIAMONDS']]);
  it('schedules one affordable tier upgrade with at least three utility points', () => {
    const bot = new ClassicalBotAI('VEKTOR_AGGRO', new Rolls()); const base = bot.evaluateHand(hand, 20, 20, 0, false);
    const d = bot.evaluateHand(hand, 20, 20, 3, false); checkDecision(d, hand);
    expect(d.fluxActions).toEqual([{ type: 'NUDGE', cardId: hand[2].id, direction: 'UP' }]);
    expect(evaluateAssaultHand(base.assaultCards).tier).toBe('PAIR'); expect(evaluateAssaultHand(d.assaultCards).tier).toBe('THREE_OF_A_KIND');
    expect(utility(d.assaultCards, d.aegisCards, bot.getProfile()) - utility(base.assaultCards, base.aegisCards, bot.getProfile())).toBeGreaterThanOrEqual(3);
    expect(d.assaultCardIds).toEqual(base.assaultCardIds); expect(d.aegisCardIds).toEqual(base.aegisCardIds);
    expect(bot.evaluateHand(hand, 20, 20, 1, false).fluxActions).toEqual(d.fluxActions);
    expect(base.fluxActions).toEqual([]);
  });

  it('rejects an Assault tier upgrade worth less than three utility points', () => {
    const hand = cards([[5, 'SPADES'], [14, 'HEARTS'], [10, 'CLUBS'], [9, 'DIAMONDS'], [5, 'HEARTS']]);
    const bot = new ClassicalBotAI('AEGIS_WALL', new Rolls()); const base = bot.evaluateHand(hand, 20, 20, 0, false);
    expect(evaluateAssaultHand(base.assaultCards).tier).toBe('HIGH_CARD');
    const shaped = base.assaultCards.map(c => c.rank === 9 ? nudgeRank(c, 'UP') : c) as [Card, Card, Card];
    expect(evaluateAssaultHand(shaped).tier).toBe('PAIR');
    const delta = utility(shaped, base.aegisCards, bot.getProfile()) - utility(base.assaultCards, base.aegisCards, bot.getProfile());
    expect(delta).toBeGreaterThan(0); expect(delta).toBeLessThan(3);
    expect(bot.evaluateHand(hand, 20, 20, 3, false).nudges).toEqual([]);
  });

  it('supports Ace-wrap when it completes the selected Assault straight', () => {
    const hand = cards([[14, 'SPADES'], [3, 'HEARTS'], [4, 'CLUBS'], [9, 'DIAMONDS'], [9, 'HEARTS']]);
    const bot = new ClassicalBotAI('AEGIS_WALL', new Rolls()); const d = bot.evaluateHand(hand, 20, 20, 3, false);
    expect(d.nudges).toContainEqual({ cardId: hand[0].id, direction: 'UP' });
    expect(evaluateAssaultHand(d.assaultCards).tier).toBe('STRAIGHT');
  });

  it('does not repartition the hand to find a nudge absent from the initial Assault', () => {
    const hand = cards([[2, 'SPADES'], [3, 'HEARTS'], [8, 'SPADES'], [8, 'CLUBS'], [14, 'DIAMONDS']]);
    const bot = new ClassicalBotAI('CIPHER_ZERO', new Rolls()); const base = bot.evaluateHand(hand, 20, 20, 0, false);
    const shaped = bot.evaluateHand(hand, 20, 20, 3, false);
    expect(shaped.assaultCardIds).toEqual(base.assaultCardIds); expect(shaped.aegisCardIds).toEqual(base.aegisCardIds);
  });

  it.each(profiles)('matches an independent fixed-partition nudge search for %s', profile => {
    const bot = new ClassicalBotAI(profile, new SeededPRNG(42)); const random = new SeededPRNG(1234);
    for (let h = 0; h < 100; h++) {
      const hand = Array.from({ length: 5 }, (_, i) => ({ id: `${h}_${i}`, rank: random.nextInt(2, 15) as Card['rank'], suit: (['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'] as const)[random.nextInt(0, 4)] }));
      const base = bot.evaluateHand(hand, 20, 20, 0, false); const config = bot.getProfile();
      const baseUtility = utility(base.assaultCards, base.aegisCards, config);
      let expected: { type: 'NUDGE'; cardId: string; direction: 'UP' | 'DOWN' } | null = null;
      let max = -Infinity;
      for (const card of base.assaultCards) for (const direction of ['UP', 'DOWN'] as const) {
        const assault = base.assaultCards.map(c => c.id === card.id ? nudgeRank(c, direction) : c) as [Card, Card, Card];
        const score = utility(assault, base.aegisCards, config);
        if (evaluateAssaultHand(assault).baseDamage > evaluateAssaultHand(base.assaultCards).baseDamage && score - baseUtility >= 3 && score > max) {
          max = score; expected = { type: 'NUDGE', cardId: card.id, direction };
        }
      }
      const d = bot.evaluateHand(hand, 20, 20, 3, false);
      expect(d.fluxActions).toEqual(expected ? [expected] : []); checkDecision(d, hand);
    }
  });
});

describe('Spec-05 burn priority and stance boundaries', () => {
  const hand = cards([[8, 'CLUBS'], [12, 'SPADES'], [14, 'DIAMONDS'], [4, 'HEARTS'], [6, 'CLUBS']]);
  it.each([
    ['CIPHER_ZERO', 10, 20, 2], ['AEGIS_WALL', 10, 20, 2], ['VEKTOR_AGGRO', 10, 20, 2],
    ['VEKTOR_AGGRO', 11, 20, 0], ['CIPHER_ZERO', 14, 20, 3], ['AEGIS_WALL', 14, 20, 3],
    ['CIPHER_ZERO', 15, 20, 1], ['CIPHER_ZERO', 20, 20, null], ['AEGIS_WALL', 20, 20, null],
  ] as const)('%s HP %i vs %i burns the prescribed suit', (profile, own, opponent, index) => {
    const d = new ClassicalBotAI(profile, new Rolls([0])).evaluateHand(hand, own, opponent, 3, true);
    expect(d.burnCardId).toBe(index === null ? undefined : hand[index].id);
    expect(d.fluxActions.every(a => a.cardId !== d.burnCardId)).toBe(true);
  });
  it('gates burns with the exact probability and canBurn flag', () => {
    for (const profile of profiles) {
      const limit = BOT_PROFILES[profile].burnAggression;
      expect(new ClassicalBotAI(profile, new Rolls([limit])).evaluateHand(hand, 8, 20, 0, true).burnCardId).toBeUndefined();
      expect(new ClassicalBotAI(profile, new Rolls([limit - 0.00001])).evaluateHand(hand, 8, 20, 0, true).burnCardId).toBe(hand[2].id);
      expect(new ClassicalBotAI(profile, new Rolls([0])).evaluateHand(hand, 8, 20, 0, false).burnCardId).toBeUndefined();
    }
  });
  it('falls through absent suits without burning an arbitrary low card', () => {
    const noDiamond = cards([[8, 'CLUBS'], [12, 'SPADES'], [4, 'HEARTS'], [6, 'CLUBS'], [9, 'SPADES']]);
    expect(new ClassicalBotAI('CIPHER_ZERO', new Rolls([0])).evaluateHand(noDiamond, 8, 20, 0, true).burnCardId).toBe(noDiamond[2].id);
    expect(new ClassicalBotAI('VEKTOR_AGGRO', new Rolls([0])).evaluateHand(noDiamond, 8, 20, 0, true).burnCardId).toBe(noDiamond[0].id);
    expect(new ClassicalBotAI('CIPHER_ZERO', new Rolls([0])).evaluateHand(noDiamond, 15, 15, 0, true).burnCardId).toBeUndefined();
  });
  it('uses a lethal finisher only above six HP', () => {
    expect(new ClassicalBotAI('CIPHER_ZERO', new Rolls([0.99])).evaluateHand(strong, 7, 20, 0, false).stance).toBe('OVERCHARGE');
    expect(new ClassicalBotAI('CIPHER_ZERO', new Rolls([0.99])).evaluateHand(strong, 6, 20, 0, false).stance).toBe('BRACE');
  });
  it.each(profiles)('uses boosted Parry or Brace at critical HP for %s', profile => {
    const threshold = BOT_PROFILES[profile].parryTendency * 1.2;
    expect(new ClassicalBotAI(profile, new Rolls([threshold - 0.00001])).evaluateHand(weak, 5, 20, 0, false).stance).toBe('PARRY');
    expect(new ClassicalBotAI(profile, new Rolls([threshold])).evaluateHand(weak, 5, 20, 0, false).stance).toBe('BRACE');
    expect(new ClassicalBotAI(profile, new Rolls([0])).evaluateHand(strong, 1, 1, 0, false).stance).toBe('PARRY');
  });
  it.each(profiles)('uses exact tendency thresholds at noncritical HP for %s', profile => {
    const p = BOT_PROFILES[profile];
    expect(new ClassicalBotAI(profile, new Rolls([p.overchargeTendency - 0.00001])).evaluateHand(weak, 6, 20, 0, false).stance).toBe('OVERCHARGE');
    expect(new ClassicalBotAI(profile, new Rolls([p.overchargeTendency])).evaluateHand(weak, 6, 20, 0, false).stance).toBe('PARRY');
    expect(new ClassicalBotAI(profile, new Rolls([p.overchargeTendency + p.parryTendency])).evaluateHand(weak, 6, 20, 0, false).stance).toBe('BRACE');
  });
});

describe('Spec-05 checked shaping and final partition', () => {
  it.each(profiles)('applies every proposal and commits fresh post-burn cards for %s', profile => {
    for (let seed = 0; seed < 100; seed++) {
      const e = new MatchEngine('p1', 'A', 'p2', 'B', new SeededPRNG(seed)); e.startMatch(); e.phase = 'SHAPING';
      const p = e.getPlayer('p1')!; const bot = new ClassicalBotAI(profile, new Rolls([0]));
      const before = structuredClone(p.cards); const d = bot.evaluateHand(p.cards, 8, 20, p.fluxRemaining, true);
      expect(p.cards).toEqual(before);
      applyBotShaping(e, 'p1', d); expect(p.cards).toHaveLength(5);
      if (d.burnCardId) expect(p.cards.some(c => c.id === d.burnCardId)).toBe(false);
      const final = bot.evaluateHand(p.cards, p.guardHp, 20, 0, false); checkDecision(final, p.cards);
      expect(final.fluxActions).toEqual([]); expect(final.burnCardId).toBeUndefined();
      e.phase = 'COMMITMENT'; expect(e.commitHand('p1', final.assaultCardIds, final.aegisCardIds, final.stance)).toBe(true);
    }
  });
  it('fails visibly on rejected actions instead of skipping them', () => {
    const e = new MatchEngine(); e.startMatch(); const p = e.getPlayer('player_1')!;
    const d = new ClassicalBotAI().evaluateHand(p.cards, 20, 20, 0, false);
    expect(() => applyBotShaping(e, p.playerId, { ...d, burnCardId: p.cards[0].id })).toThrow('Bot burn was rejected');
    expect(() => applyBotShaping(e, p.playerId, { ...d, fluxActions: [{ type: 'NUDGE', cardId: p.cards[0].id, direction: 'UP' }] })).toThrow('Bot Flux action was rejected');
  });
});

describe('Spec-05 evaluation timing', () => {
  it.each(profiles)('evaluates %s synchronously below the one millisecond budget', profile => {
    const random = new SeededPRNG(2026);
    const hands = Array.from({ length: 10 }, (_, h) => Array.from({ length: 5 }, (_, i) => ({ id: `${h}_${i}`, rank: random.nextInt(2, 15) as Card['rank'], suit: (['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'] as const)[random.nextInt(0, 4)] })));
    const bot = new ClassicalBotAI(profile, new SeededPRNG(42));
    for (let i = 0; i < 200; i++) bot.evaluateHand(hands[i % 10], 1 + i % 20, 20, 3, true);
    const samples: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const start = performance.now(); const d = bot.evaluateHand(hands[i % 10], 1 + i % 20, 20, 3, true);
      samples.push(performance.now() - start);
      if (typeof d !== 'object' || !d.assaultCards) throw new Error('Evaluation must return a synchronous decision');
    }
    samples.sort((a, b) => a - b);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const p95 = samples[Math.floor(samples.length * 0.95)];
    console.log(`${profile} evaluation: mean=${mean.toFixed(4)}ms p95=${p95.toFixed(4)}ms max=${samples.at(-1)!.toFixed(4)}ms (1000 warmed samples)`);
    expect(mean).toBeLessThan(1); expect(p95).toBeLessThan(1);
    expect(samples.at(-1)!).toBeLessThan(1);
  });
});
