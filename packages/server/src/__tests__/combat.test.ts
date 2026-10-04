import { describe, it, expect } from 'vitest';
import { resolveCombatRound, Card } from '@cyberante/shared';

describe('Combat Calculator', () => {
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

  it('resolves standard Brace vs Brace clash', () => {
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
    expect(outcome.roundWinnerId).toBe('p1');
  });

  it('doubles damage on Overcharge but zeroes Aegis mitigation', () => {
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

    // p1 deals: 36 - 4 = 32 damage to p2 (lethal)
    // p2 deals: 5 - 0 = 5 damage to p1
    expect(outcome.p2NetDamageReceived).toBe(32);
    expect(outcome.p1NetDamageReceived).toBe(5);
    expect(outcome.p2HpRemaining).toBe(0);
    expect(outcome.p1HpRemaining).toBe(15);
  });

  it('Parry reflects 50% damage against low assault tiers (Pair/High Card)', () => {
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
        assaultCards: p2Assault, // Pair of 8s (below Flush)
        aegisCards: p2Aegis,
        stance: 'PARRY',
        currentGuardHp: 20,
        activeBarrier: 0,
      }
    );

    // p1 assault is Straight Flush (>= Flush), so p2 cannot reflect p1
    // But p2 is Parry: p2 raw attack is 5 * 0.5 = 3
    expect(outcome.p2ReflectedDamage).toBe(0);
  });
});
