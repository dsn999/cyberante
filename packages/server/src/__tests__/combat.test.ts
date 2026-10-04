import { describe, it, expect } from 'vitest';
import { resolveCombatRound, Card } from '@cyberante/shared';

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
