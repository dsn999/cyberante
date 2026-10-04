// ============================================================================
// CYBERANTE: Combat Resolution & Damage Calculator
// ============================================================================

import { Card, Stance, HandEvaluation3, HandEvaluation2, RoundResolution } from './types';
import { GAME_CONSTANTS } from './constants';
import { evaluateAssaultHand, evaluateAegisHand } from './pokerEvaluator';

export interface CombatantInput {
  playerId: string;
  assaultCards: [Card, Card, Card];
  aegisCards: [Card, Card];
  stance: Stance;
  currentGuardHp: number;
  activeBarrier: number;
  hasSunderActive?: boolean; // Club burn
  hasSiphonActive?: boolean; // Heart burn
  hasVeilActive?: boolean;   // Spade burn
}

export function resolveCombatRound(
  c1: CombatantInput,
  c2: CombatantInput
): RoundResolution {
  const eval3_1 = evaluateAssaultHand(c1.assaultCards);
  const eval2_1 = evaluateAegisHand(c1.aegisCards);

  const eval3_2 = evaluateAssaultHand(c2.assaultCards);
  const eval2_2 = evaluateAegisHand(c2.aegisCards);

  // Stance multipliers (unless suppressed by opponent Static Veil)
  const mult1 = c2.hasVeilActive ? 1.0 : getStanceMultiplier(c1.stance);
  const mult2 = c1.hasVeilActive ? 1.0 : getStanceMultiplier(c2.stance);

  // Raw assault damage
  const rawDmg1 = Math.round(eval3_1.baseDamage * mult1);
  const rawDmg2 = Math.round(eval3_2.baseDamage * mult2);

  // Mitigation (Overcharge sets Aegis mitigation to 0)
  let mit1 = c1.stance === 'OVERCHARGE' ? 0 : eval2_1.mitigation;
  let mit2 = c2.stance === 'OVERCHARGE' ? 0 : eval2_2.mitigation;

  // Apply Sunder (Club Burn cuts opponent mitigation by 50%)
  if (c2.hasSunderActive) {
    mit1 = Math.floor(mit1 * 0.5);
  }
  if (c1.hasSunderActive) {
    mit2 = Math.floor(mit2 * 0.5);
  }

  // Base net damage
  let netTo2 = Math.max(0, rawDmg1 - mit2 - c2.activeBarrier);
  let netTo1 = Math.max(0, rawDmg2 - mit1 - c1.activeBarrier);

  // Parry Reflection Logic:
  // If player chose PARRY and incoming opponent assault < FLUSH (i.e. Pair or High Card),
  // reflect 50% of raw damage back to attacker.
  let reflectedTo1 = 0;
  let reflectedTo2 = 0;

  if (c1.stance === 'PARRY' && isAssaultBelowFlush(eval3_2)) {
    reflectedTo2 = Math.round(rawDmg2 * GAME_CONSTANTS.STANCE_PARRY_REFLECT_RATIO);
  }
  if (c2.stance === 'PARRY' && isAssaultBelowFlush(eval3_1)) {
    reflectedTo1 = Math.round(rawDmg1 * GAME_CONSTANTS.STANCE_PARRY_REFLECT_RATIO);
  }

  const totalDamageTo1 = netTo1 + reflectedTo1;
  const totalDamageTo2 = netTo2 + reflectedTo2;

  let hp1 = Math.max(0, c1.currentGuardHp - totalDamageTo1);
  let hp2 = Math.max(0, c2.currentGuardHp - totalDamageTo2);

  // Siphon Seed: 50% of damage dealt converted to Guard HP recovery
  if (c1.hasSiphonActive && netTo2 > 0) {
    hp1 = Math.min(GAME_CONSTANTS.STARTING_GUARD_HP, hp1 + Math.floor(netTo2 * 0.5));
  }
  if (c2.hasSiphonActive && netTo1 > 0) {
    hp2 = Math.min(GAME_CONSTANTS.STARTING_GUARD_HP, hp2 + Math.floor(netTo1 * 0.5));
  }

  let roundWinnerId: string | null = null;
  if (hp1 > hp2) {
    roundWinnerId = c1.playerId;
  } else if (hp2 > hp1) {
    roundWinnerId = c2.playerId;
  }

  return {
    p1Assault: c1.assaultCards,
    p1Aegis: c1.aegisCards,
    p1Stance: c1.stance,
    p1Eval3: eval3_1,
    p1Eval2: eval2_1,

    p2Assault: c2.assaultCards,
    p2Aegis: c2.aegisCards,
    p2Stance: c2.stance,
    p2Eval3: eval3_2,
    p2Eval2: eval2_2,

    p1RawDamage: rawDmg1,
    p2RawDamage: rawDmg2,
    p1NetDamageReceived: totalDamageTo1,
    p2NetDamageReceived: totalDamageTo2,
    p1ReflectedDamage: reflectedTo1,
    p2ReflectedDamage: reflectedTo2,
    p1HpRemaining: hp1,
    p2HpRemaining: hp2,

    roundWinnerId,
    matchWinnerId: null, // Computed at match coordinator level based on Bo3 wins
  };
}

function getStanceMultiplier(stance: Stance): number {
  switch (stance) {
    case 'OVERCHARGE': return GAME_CONSTANTS.STANCE_OVERCHARGE_MULTIPLIER;
    case 'PARRY': return GAME_CONSTANTS.STANCE_PARRY_MULTIPLIER;
    default: return 1.0;
  }
}

function isAssaultBelowFlush(eval3: HandEvaluation3): boolean {
  return eval3.tier === 'PAIR' || eval3.tier === 'HIGH_CARD';
}
