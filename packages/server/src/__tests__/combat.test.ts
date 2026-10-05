import { describe, it, expect } from 'vitest';
import { resolveCombatRound, MatchEngine, SeededPRNG, type Card, type CombatantInput, type Stance } from '@cyberante/shared';

function combatant(playerId: string, overrides: Partial<CombatantInput> = {}): CombatantInput {
  return {
    playerId,
    assaultCards: [
      { id: `${playerId}_a0`, suit: 'SPADES', rank: 8 },
      { id: `${playerId}_a1`, suit: 'HEARTS', rank: 8 },
      { id: `${playerId}_a2`, suit: 'CLUBS', rank: 3 },
    ],
    aegisCards: [
      { id: `${playerId}_d0`, suit: 'SPADES', rank: 2 },
      { id: `${playerId}_d1`, suit: 'HEARTS', rank: 7 },
    ],
    stance: 'BRACE', currentGuardHp: 20, activeBarrier: 0,
    ...overrides,
  };
}

describe('Spec-02 stance, burn and knockout boundaries', () => {
  const matrix: Array<[Stance, Stance, number, number, number, number, number, number]> = [
    ['BRACE', 'BRACE', 5, 5, 3, 3, 0, 0],
    ['BRACE', 'OVERCHARGE', 5, 10, 8, 5, 0, 0],
    ['BRACE', 'PARRY', 5, 3, 4, 3, 3, 0],
    ['OVERCHARGE', 'BRACE', 10, 5, 5, 8, 0, 0],
    ['OVERCHARGE', 'OVERCHARGE', 10, 10, 10, 10, 0, 0],
    ['OVERCHARGE', 'PARRY', 10, 3, 8, 8, 5, 0],
    ['PARRY', 'BRACE', 3, 5, 3, 4, 0, 3],
    ['PARRY', 'OVERCHARGE', 3, 10, 8, 8, 0, 5],
    ['PARRY', 'PARRY', 3, 3, 3, 3, 2, 2],
  ];
  it.each(matrix)('%s vs %s resolves exact damage and reflection', (s1, s2, raw1, raw2, dmg1, dmg2, ref1, ref2) => {
    const r = resolveCombatRound(combatant('left', { stance: s1 }), combatant('right', { stance: s2 }), 3, 2);
    expect(r).toMatchObject({
      p1PlayerId: 'left', p2PlayerId: 'right', exchangeNumber: 3, roundNumber: 2,
      p1RawDamage: raw1, p2RawDamage: raw2,
      p1NetDamageReceived: dmg1, p2NetDamageReceived: dmg2,
      p1ReflectedDamage: ref1, p2ReflectedDamage: ref2,
      p1HpRemaining: 20 - dmg1, p2HpRemaining: 20 - dmg2,
      isRoundOver: false, roundWinnerId: null, matchWinnerId: null,
    });
  });

  it('keeps barriers effective on Overcharge and floors odd Sunder shields', () => {
    const a = combatant('left', { stance: 'OVERCHARGE', activeBarrier: 3 });
    const b = combatant('right', { burnType: 'CLUB_SUNDER' });
    expect(resolveCombatRound(a, b).p1NetDamageReceived).toBe(4); // 5 - floor(3/2), own Aegis is 0.
    expect(resolveCombatRound({ ...a, activeBarrier: 3 }, { ...b, burnType: null }).p1NetDamageReceived).toBe(2);
  });

  it('Veil suppresses Overcharge damage without restoring its forfeited Aegis', () => {
    const r = resolveCombatRound(combatant('left', { stance: 'OVERCHARGE' }), combatant('right', { burnType: 'SPADE_VEIL' }));
    expect(r).toMatchObject({ p1RawDamage: 5, p1NetDamageReceived: 5, p2NetDamageReceived: 3 });
  });

  it('Veil disables opposing Parry reflection while retaining half-damage offense', () => {
    const r = resolveCombatRound(combatant('left', { burnType: 'SPADE_VEIL' }), combatant('right', { stance: 'PARRY' }));
    expect(r).toMatchObject({ p1ReflectedDamage: 0, p2RawDamage: 3, p1NetDamageReceived: 1 });
  });

  it('Parry does not reflect a strong Brace hand but does reflect a strong Overcharge', () => {
    const strong = combatant('left');
    strong.assaultCards = strong.assaultCards.map((c, i) => ({ ...c, rank: ([7, 8, 9] as const)[i] })) as [Card, Card, Card];
    const defender = combatant('right', { stance: 'PARRY' });
    expect(resolveCombatRound(strong, defender).p1ReflectedDamage).toBe(0);
    expect(resolveCombatRound({ ...strong, stance: 'OVERCHARGE' }, defender).p1ReflectedDamage).toBe(10);
    expect(resolveCombatRound(defender, strong).p2ReflectedDamage).toBe(0);
    expect(resolveCombatRound(defender, { ...strong, stance: 'OVERCHARGE' }).p2ReflectedDamage).toBe(10);
  });

  it('Parry reflects high-card damage even when a barrier fully absorbs the attack', () => {
    const weak = combatant('left');
    weak.assaultCards[1] = { ...weak.assaultCards[1], rank: 12 };
    const r = resolveCombatRound(weak, combatant('right', { stance: 'PARRY', activeBarrier: 11 }));
    expect(r).toMatchObject({ p1RawDamage: 2, p1ReflectedDamage: 1, p2NetDamageReceived: 0 });
  });

  it('clamps blocked damage to zero and floors Siphon healing from net assault damage', () => {
    const a = combatant('left', { burnType: 'HEART_SIPHON', currentGuardHp: 10, activeBarrier: 11 });
    const r = resolveCombatRound(a, combatant('right'));
    expect(r).toMatchObject({ p1NetDamageReceived: 0, p2NetDamageReceived: 3, p1SiphonHeal: 1, p1HpRemaining: 11 });
    expect(resolveCombatRound(a, combatant('right', { activeBarrier: 11 })).p1SiphonHeal).toBe(0);
  });

  it('caps Siphon at 20 HP and never resurrects a defeated attacker', () => {
    const a = combatant('left', { burnType: 'HEART_SIPHON', activeBarrier: 11 });
    expect(resolveCombatRound(a, combatant('right')).p1HpRemaining).toBe(20);
    const r = resolveCombatRound({ ...a, currentGuardHp: 3, activeBarrier: 0 }, combatant('right'));
    expect(r).toMatchObject({ p1HpRemaining: 0, p1SiphonHeal: 0, isRoundOver: true, roundWinnerId: 'right' });
  });

  it('excludes reflected damage from Siphon recovery', () => {
    const r = resolveCombatRound(combatant('left', { stance: 'PARRY', burnType: 'HEART_SIPHON', currentGuardHp: 10 }), combatant('right'));
    expect(r).toMatchObject({ p2NetDamageReceived: 4, p2ReflectedDamage: 3, p1SiphonHeal: 0, p1HpRemaining: 7 });
  });

  it('breaks simultaneous lethal by Assault score in either seat', () => {
    const a = combatant('left', { currentGuardHp: 1 });
    const b = combatant('right', { currentGuardHp: 1 });
    b.assaultCards[0] = { ...b.assaultCards[0], rank: 9 };
    b.assaultCards[1] = { ...b.assaultCards[1], rank: 9 };
    expect(resolveCombatRound(a, b)).toMatchObject({ p1HpRemaining: 0, p2HpRemaining: 0, roundWinnerId: 'right', isRoundOver: true });
    expect(resolveCombatRound(b, a).roundWinnerId).toBe('right');
  });

  it('continues an exactly tied simultaneous knockout at 1 HP each', () => {
    const r = resolveCombatRound(combatant('left', { currentGuardHp: 1 }), combatant('right', { currentGuardHp: 1 }));
    expect(r).toMatchObject({ p1HpRemaining: 1, p2HpRemaining: 1, isRoundOver: false, roundWinnerId: null });
  });

  it('does not mutate frozen combatants and produces deterministic replay', () => {
    const a = combatant('left', { burnType: 'CLUB_SUNDER' });
    const b = combatant('right', { stance: 'PARRY', activeBarrier: 7 });
    const snapshot = structuredClone([a, b]);
    for (const c of [a, b]) {
      c.assaultCards.forEach(Object.freeze); c.aegisCards.forEach(Object.freeze);
      Object.freeze(c.assaultCards); Object.freeze(c.aegisCards); Object.freeze(c);
    }
    const result = resolveCombatRound(a, b);
    expect(resolveCombatRound(a, b)).toEqual(result);
    expect([a, b]).toEqual(snapshot);
  });

  it.each(['SPADE_VEIL', 'DIAMOND_BARRIER', 'HEART_SIPHON', 'CLUB_SUNDER'] as const)('resolves %s identically after swapping seats', burnType => {
    const a = combatant('left', { burnType, currentGuardHp: 10, activeBarrier: burnType === 'DIAMOND_BARRIER' ? 7 : 0 });
    const b = combatant('right', { stance: 'OVERCHARGE', activeBarrier: 3 });
    const forward = resolveCombatRound(a, b);
    const reverse = resolveCombatRound(b, a);
    expect(reverse.p1RawDamage).toBe(forward.p2RawDamage);
    expect(reverse.p2RawDamage).toBe(forward.p1RawDamage);
    expect(reverse.p1NetDamageReceived).toBe(forward.p2NetDamageReceived);
    expect(reverse.p2NetDamageReceived).toBe(forward.p1NetDamageReceived);
    expect(reverse.p1ReflectedDamage).toBe(forward.p2ReflectedDamage);
    expect(reverse.p2ReflectedDamage).toBe(forward.p1ReflectedDamage);
    expect(reverse.p1SiphonHeal).toBe(forward.p2SiphonHeal);
    expect(reverse.p2SiphonHeal).toBe(forward.p1SiphonHeal);
    expect(reverse.p1HpRemaining).toBe(forward.p2HpRemaining);
    expect(reverse.p2HpRemaining).toBe(forward.p1HpRemaining);
    expect(reverse.roundWinnerId).toBe(forward.roundWinnerId);
  });
});

describe('Spec-02 exchange cap and sudden death', () => {
  it('continues before exchange 10 and selects higher remaining HP at the cap', () => {
    const a = combatant('left', { currentGuardHp: 20 });
    const b = combatant('right', { currentGuardHp: 19 });
    expect(resolveCombatRound(a, b, 9).isRoundOver).toBe(false);
    expect(resolveCombatRound(a, b, 10)).toMatchObject({ isRoundOver: true, roundWinnerId: 'left', p1HpRemaining: 17, p2HpRemaining: 16 });
    expect(resolveCombatRound(b, a, 10).roundWinnerId).toBe('left');
  });

  it('leaves tied cap HP visible until the engine starts sudden death at 1 HP', () => {
    expect(resolveCombatRound(combatant('left'), combatant('right'), 10)).toMatchObject({ isRoundOver: false, roundWinnerId: null, p1HpRemaining: 17, p2HpRemaining: 17 });
  });

  it('preserves normal knockout precedence at exchange 10', () => {
    expect(resolveCombatRound(combatant('left', { currentGuardHp: 1 }), combatant('right'), 10).roundWinnerId).toBe('right');
  });

  it('compares net damage before Assault score when both attacks are lethal', () => {
    const a = combatant('left', { currentGuardHp: 1, burnType: 'CLUB_SUNDER' });
    const b = combatant('right', { currentGuardHp: 1 });
    b.assaultCards[0] = { ...b.assaultCards[0], rank: 9 };
    b.assaultCards[1] = { ...b.assaultCards[1], rank: 9 };
    const r = resolveCombatRound(a, b, 11);
    expect(r).toMatchObject({ p1NetDamageReceived: 3, p2NetDamageReceived: 4, roundWinnerId: 'left', isRoundOver: true });
    expect(r.p1Eval3.score).toBeLessThan(r.p2Eval3.score);
    expect(resolveCombatRound(b, a, 11).roundWinnerId).toBe('left');
  });

  it('compares outgoing net damage independently of input HP and Siphon recovery', () => {
    const a = combatant('left', { burnType: 'HEART_SIPHON' });
    const b = combatant('right', { activeBarrier: 1 });
    a.assaultCards[0] = { ...a.assaultCards[0], rank: 9 };
    a.assaultCards[1] = { ...a.assaultCards[1], rank: 9 };
    // The calculator accepts current HP as input; winner ordering must not use healed HP.
    const r = resolveCombatRound(a, b, 11);
    expect(r).toMatchObject({ p1HpRemaining: 18, p2HpRemaining: 18, p1SiphonHeal: 1, roundWinnerId: 'right' });
    expect(r.p1Eval3.score).toBeGreaterThan(r.p2Eval3.score);
  });

  it('breaks equal damage by Assault score, then Aegis score', () => {
    const a = combatant('left', { currentGuardHp: 1 });
    const b = combatant('right', { currentGuardHp: 1 });
    b.assaultCards[0] = { ...b.assaultCards[0], rank: 9 };
    b.assaultCards[1] = { ...b.assaultCards[1], rank: 9 };
    expect(resolveCombatRound(a, b, 11).roundWinnerId).toBe('right');
    b.assaultCards = structuredClone(a.assaultCards);
    b.aegisCards[1] = { ...b.aegisCards[1], rank: 10 };
    expect(resolveCombatRound(a, b, 11).roundWinnerId).toBe('right');
    expect(resolveCombatRound(b, a, 11).roundWinnerId).toBe('right');
  });

  it.each([11, 12])('repeats an exact tie at exchange %i without awarding a point', exchange => {
    expect(resolveCombatRound(combatant('left', { currentGuardHp: 1 }), combatant('right', { currentGuardHp: 1 }), exchange))
      .toMatchObject({ isRoundOver: false, roundWinnerId: null, p1HpRemaining: 1, p2HpRemaining: 1 });
  });

  it('lets MatchEngine preserve tied outcomes and begin repeated sudden death', () => {
    const engine = new MatchEngine('left', 'A', 'right', 'B', new SeededPRNG(42));
    engine.startMatch(); engine.currentExchange = 10; engine.phase = 'COMMITMENT';
    engine.phase = 'COMMITMENT';
    for (const id of ['left', 'right']) {
      const player = engine.getPlayer(id)!;
      const c = combatant(id);
      player.cards = [...c.assaultCards, ...c.aegisCards];
      engine.commitHand(id, c.assaultCards.map(card => card.id) as [string, string, string], c.aegisCards.map(card => card.id) as [string, string], 'BRACE');
    }
    expect(engine.resolveClash().isRoundOver).toBe(false);
    engine.phase = 'ROUND_RESOLVE';
    engine.startExchange();
    expect(engine.currentExchange).toBe(11);
    expect(engine.getPlayer('left')!.guardHp).toBe(1);
    engine.phase = 'COMMITMENT';
    for (const id of ['left', 'right']) {
      const player = engine.getPlayer(id)!;
      const c = combatant(id);
      player.cards = [...c.assaultCards, ...c.aegisCards];
      engine.commitHand(id, c.assaultCards.map(card => card.id) as [string, string, string], c.aegisCards.map(card => card.id) as [string, string], 'BRACE');
    }
    expect(engine.resolveClash()).toMatchObject({ isRoundOver: false, roundWinnerId: null });
    expect(engine.getPlayer('left')!.roundWins).toBe(0);
    expect(engine.getPlayer('right')!.roundWins).toBe(0);
    engine.phase = 'ROUND_RESOLVE';
    engine.startExchange();
    expect(engine.currentExchange).toBe(12);
    expect(engine.getPlayer('right')!.guardHp).toBe(1);
  });
});

describe('Combat Calculator (Option A Multi-Exchange)', () => {
  const p1Assault: [Card, Card, Card] = [
    { id: '1', suit: 'SPADES', rank: 14 },
    { id: '2', suit: 'SPADES', rank: 13 },
    { id: '3', suit: 'SPADES', rank: 12 },
  ]; // Straight Flush: 18 base dmg

  const p1Aegis: [Card, Card] = [
    { id: '4', suit: 'HEARTS', rank: 7 },
    { id: '5', suit: 'CLUBS', rank: 2 },
  ]; // High card: 2 block

  const p2Assault: [Card, Card, Card] = [
    { id: '6', suit: 'DIAMONDS', rank: 8 },
    { id: '7', suit: 'HEARTS', rank: 8 },
    { id: '8', suit: 'CLUBS', rank: 3 },
  ]; // Pair: 5 base dmg

  const p2Aegis: [Card, Card] = [
    { id: '9', suit: 'CLUBS', rank: 10 },
    { id: '10', suit: 'CLUBS', rank: 4 },
  ]; // Suited: 4 block

  it('resolves standard Brace vs Brace non-lethal exchange', () => {
    const outcome = resolveCombatRound(
      {
        playerId: 'p1',
        assaultCards: p1Assault,
        aegisCards: p1Aegis,
        stance: 'BRACE',
        currentGuardHp: 20,
        activeBarrier: 0,
      },
      {
        playerId: 'p2',
        assaultCards: p2Assault,
        aegisCards: p2Aegis,
        stance: 'BRACE',
        currentGuardHp: 20,
        activeBarrier: 0,
      }
    );

    // p1 deals: 18 - 4 (p2 aegis) = 14 damage to p2
    // p2 deals: 5 - 2 (p1 aegis) = 3 damage to p1
    expect(outcome.p2NetDamageReceived).toBe(14);
    expect(outcome.p1NetDamageReceived).toBe(3);
    expect(outcome.p2HpRemaining).toBe(6);
    expect(outcome.p1HpRemaining).toBe(17);
    // In Option A, exchange did not reduce anyone to 0 HP yet
    expect(outcome.isRoundOver).toBe(false);
    expect(outcome.roundWinnerId).toBeNull();
  });

  it('doubles damage on Overcharge and causes Round KO when HP hits 0', () => {
    const outcome = resolveCombatRound(
      {
        playerId: 'p1',
        assaultCards: p1Assault,
        aegisCards: p1Aegis,
        stance: 'OVERCHARGE', // 18 * 2.0 = 36 dmg, 0 aegis
        currentGuardHp: 20,
        activeBarrier: 0,
      },
      {
        playerId: 'p2',
        assaultCards: p2Assault,
        aegisCards: p2Aegis,
        stance: 'BRACE',
        currentGuardHp: 20,
        activeBarrier: 0,
      }
    );

    // p1 deals: 36 - 4 = 32 damage to p2 (lethal KO)
    // p2 deals: 5 - 0 = 5 damage to p1
    expect(outcome.p2NetDamageReceived).toBe(32);
    expect(outcome.p1NetDamageReceived).toBe(5);
    expect(outcome.p2HpRemaining).toBe(0);
    expect(outcome.p1HpRemaining).toBe(15);
    expect(outcome.isRoundOver).toBe(true);
    expect(outcome.roundWinnerId).toBe('p1');
  });

  it('Parry reflects 50% damage against Overcharge stance read', () => {
    const outcome = resolveCombatRound(
      {
        playerId: 'p1',
        assaultCards: p1Assault, // Straight Flush
        aegisCards: p1Aegis,
        stance: 'OVERCHARGE', // 18 * 2 = 36 raw dmg
        currentGuardHp: 20,
        activeBarrier: 0,
      },
      {
        playerId: 'p2',
        assaultCards: p2Assault,
        aegisCards: p2Aegis,
        stance: 'PARRY', // Tactical read on Overcharge!
        currentGuardHp: 20,
        activeBarrier: 0,
      }
    );

    // p2 reflects 50% of p1's 36 raw damage = 18 reflected damage back to p1!
    expect(outcome.p1ReflectedDamage).toBe(18);
    expect(outcome.p1NetDamageReceived).toBeGreaterThanOrEqual(18);
  });

  it('Club Sunder shreds opponent mitigation and active barrier by 50%', () => {
    const outcome = resolveCombatRound(
      {
        playerId: 'p1',
        assaultCards: p1Assault,
        aegisCards: p1Aegis,
        stance: 'BRACE',
        currentGuardHp: 20,
        activeBarrier: 0,
        burnType: 'CLUB_SUNDER', // Shreds p2 defenses by 50%
      },
      {
        playerId: 'p2',
        assaultCards: p2Assault,
        aegisCards: p2Aegis, // 4 mitigation
        stance: 'BRACE',
        currentGuardHp: 20,
        activeBarrier: 10, // 10 barrier
      }
    );

    // p2 defense is normally 4 mit + 10 barrier = 14.
    // Under Sunder: mit = floor(4 * 0.5) = 2, barrier = floor(10 * 0.5) = 5. Total defense = 7.
    // p1 raw dmg: 18. Net to p2: 18 - 7 = 11.
    expect(outcome.p2NetDamageReceived).toBe(11);
  });

  it('Spade Static Veil suppresses opponent Overcharge offensive multiplier', () => {
    const outcome = resolveCombatRound(
      {
        playerId: 'p1',
        assaultCards: p1Assault,
        aegisCards: p1Aegis,
        stance: 'BRACE',
        currentGuardHp: 20,
        activeBarrier: 0,
        burnType: 'SPADE_VEIL', // Veil on p1 suppresses p2 Overcharge
      },
      {
        playerId: 'p2',
        assaultCards: p2Assault, // Pair: 5 base
        aegisCards: p2Aegis,
        stance: 'OVERCHARGE', // Normally 5 * 2.0 = 10, but Veil forces mult to 1.0 -> 5
        currentGuardHp: 20,
        activeBarrier: 0,
      }
    );

    expect(outcome.p2RawDamage).toBe(5);
  });

  it('Heart Siphon heals 50% of net damage dealt back to Guard HP', () => {
    const outcome = resolveCombatRound(
      {
        playerId: 'p1',
        assaultCards: p1Assault, // 18 raw
        aegisCards: p1Aegis,
        stance: 'BRACE',
        currentGuardHp: 10, // damaged to 10
        activeBarrier: 0,
        burnType: 'HEART_SIPHON',
      },
      {
        playerId: 'p2',
        assaultCards: p2Assault, // 5 raw
        aegisCards: p2Aegis, // 4 block
        stance: 'BRACE',
        currentGuardHp: 20,
        activeBarrier: 0,
      }
    );

    // Net to p2: 18 - 4 = 14.
    // Siphon heals floor(14 * 0.5) = 7.
    // Net to p1: 5 - 2 = 3 damage.
    // p1 HP: 10 - 3 + 7 = 14.
    expect(outcome.p1SiphonHeal).toBe(7);
    expect(outcome.p1HpRemaining).toBe(14);
  });
});
