// ============================================================================
// CYBERANTE: Combat Resolution & Damage Calculator (Option A Multi-Exchange)
// ============================================================================

import { Card, Stance, HandEvaluation3, HandEvaluation2, RoundResolution, BurnType } from './types.js';
import { GAME_CONSTANTS } from './constants.js';
import { evaluateAssaultHand, evaluateAegisHand } from './pokerEvaluator.js';

export interface CombatantInput {
  playerId: string;
  assaultCards: [Card, Card, Card];
  aegisCards: [Card, Card];
  stance: Stance;
  currentGuardHp: number;
  activeBarrier: number;
  burnType?: BurnType | null;
}

export function resolveCombatRound(
  c1: CombatantInput,
  c2: CombatantInput,
  exchangeNumber: number = 1,
  roundNumber: number = 1
): RoundResolution {
  const eval3_1 = evaluateAssaultHand(c1.assaultCards);
  const eval2_1 = evaluateAegisHand(c1.aegisCards);

  const eval3_2 = evaluateAssaultHand(c2.assaultCards);
  const eval2_2 = evaluateAegisHand(c2.aegisCards);

  const p1VeilActive = c1.burnType === 'SPADE_VEIL';
  const p2VeilActive = c2.burnType === 'SPADE_VEIL';

  const p1SunderActive = c1.burnType === 'CLUB_SUNDER';
  const p2SunderActive = c2.burnType === 'CLUB_SUNDER';

  const p1SiphonActive = c1.burnType === 'HEART_SIPHON';
  const p2SiphonActive = c2.burnType === 'HEART_SIPHON';

  // Stance multipliers:
  // If opponent has Static Veil active, stance bonuses are suppressed (Overcharge capped to 1.0x)
  let mult1 = getStanceMultiplier(c1.stance);
  let mult2 = getStanceMultiplier(c2.stance);

  if (p2VeilActive && c1.stance === 'OVERCHARGE') {
    mult1 = 1.0;
  }
  if (p1VeilActive && c2.stance === 'OVERCHARGE') {
    mult2 = 1.0;
  }

  // Raw assault damage
  const rawDmg1 = Math.round(eval3_1.baseDamage * mult1);
  const rawDmg2 = Math.round(eval3_2.baseDamage * mult2);

  // Aegis mitigation (Overcharge reduces Aegis mitigation to 0)
  let mit1 = c1.stance === 'OVERCHARGE' ? 0 : eval2_1.mitigation;
  let mit2 = c2.stance === 'OVERCHARGE' ? 0 : eval2_2.mitigation;

  // Active barriers
  let bar1 = c1.activeBarrier;
  let bar2 = c2.activeBarrier;

  // Sunder shreds opponent's Aegis mitigation and barrier by 50%
  if (p2SunderActive) {
    mit1 = Math.floor(mit1 * 0.5);
    bar1 = Math.floor(bar1 * 0.5);
  }
  if (p1SunderActive) {
    mit2 = Math.floor(mit2 * 0.5);
    bar2 = Math.floor(bar2 * 0.5);
  }

  // Net assault damage to defender
  const netTo2 = Math.max(0, rawDmg1 - mit2 - bar2);
  const netTo1 = Math.max(0, rawDmg2 - mit1 - bar1);

  // Parry Reflection Logic:
  // Parry reflects 50% of raw damage if:
  // 1) Opponent selected OVERCHARGE (clean read on aggressive stance!)
  // OR 2) Opponent assault tier is weak (Pair or High Card)
  // Suppressed if attacker deployed Static Veil
  let reflectedTo1 = 0;
  let reflectedTo2 = 0;

  if (c1.stance === 'PARRY' && !p2VeilActive) {
    if (c2.stance === 'OVERCHARGE' || isAssaultBelowFlush(eval3_2)) {
      reflectedTo2 = Math.round(rawDmg2 * GAME_CONSTANTS.STANCE_PARRY_REFLECT_RATIO);
    }
  }

  if (c2.stance === 'PARRY' && !p1VeilActive) {
    if (c1.stance === 'OVERCHARGE' || isAssaultBelowFlush(eval3_1)) {
      reflectedTo1 = Math.round(rawDmg1 * GAME_CONSTANTS.STANCE_PARRY_REFLECT_RATIO);
    }
  }

  const totalDamageTo1 = netTo1 + reflectedTo1;
  const totalDamageTo2 = netTo2 + reflectedTo2;

  let hp1 = Math.max(0, c1.currentGuardHp - totalDamageTo1);
  let hp2 = Math.max(0, c2.currentGuardHp - totalDamageTo2);

  // Siphon Seed: 50% of net damage dealt converted directly to Guard HP recovery (only if combatant survived)
  let p1SiphonHeal = 0;
  let p2SiphonHeal = 0;

  if (p1SiphonActive && netTo2 > 0 && hp1 > 0) {
    p1SiphonHeal = Math.floor(netTo2 * 0.5);
    hp1 = Math.min(GAME_CONSTANTS.STARTING_GUARD_HP, hp1 + p1SiphonHeal);
  }

  if (p2SiphonActive && netTo1 > 0 && hp2 > 0) {
    p2SiphonHeal = Math.floor(netTo1 * 0.5);
    hp2 = Math.min(GAME_CONSTANTS.STARTING_GUARD_HP, hp2 + p2SiphonHeal);
  }

  // Option A Round KO Check:
  // If at least one combatant reaches 0 Guard HP, the round is over.
  let isRoundOver = false;
  let roundWinnerId: string | null = null;

  if (hp1 === 0 && hp2 > 0) {
    isRoundOver = true;
    roundWinnerId = c2.playerId;
  } else if (hp2 === 0 && hp1 > 0) {
    isRoundOver = true;
    roundWinnerId = c1.playerId;
  } else if (hp1 === 0 && hp2 === 0) {
    // Simultaneous knockout tiebreak:
    isRoundOver = true;
    if (eval3_1.score > eval3_2.score) {
      roundWinnerId = c1.playerId;
    } else if (eval3_2.score > eval3_1.score) {
      roundWinnerId = c2.playerId;
    } else {
      // Identical hand score tiebreak: sudden death (both set to 1 HP)
      hp1 = 1;
      hp2 = 1;
      isRoundOver = false;
      roundWinnerId = null;
    }
  }

  return {
    exchangeNumber,
    roundNumber,
    isRoundOver,

    p1Assault: c1.assaultCards,
    p1Aegis: c1.aegisCards,
    p1Stance: c1.stance,
    p1Eval3: eval3_1,
    p1Eval2: eval2_1,
    p1Burn: c1.burnType || null,

    p2Assault: c2.assaultCards,
    p2Aegis: c2.aegisCards,
    p2Stance: c2.stance,
    p2Eval3: eval3_2,
    p2Eval2: eval2_2,
    p2Burn: c2.burnType || null,

    p1RawDamage: rawDmg1,
    p2RawDamage: rawDmg2,
    p1NetDamageReceived: totalDamageTo1,
    p2NetDamageReceived: totalDamageTo2,
    p1ReflectedDamage: reflectedTo1,
    p2ReflectedDamage: reflectedTo2,
    p1SiphonHeal,
    p2SiphonHeal,
    p1HpRemaining: hp1,
    p2HpRemaining: hp2,

    roundWinnerId,
    matchWinnerId: null, // Managed at MatchEngine / Room level
  };
}

function getStanceMultiplier(stance: Stance): number {
  switch (stance) {
    case 'OVERCHARGE': return GAME_CONSTANTS.STANCE_OVERCHARGE_MULTIPLIER;
    case 'PARRY': return GAME_CONSTANTS.STANCE_PARRY_MULTIPLIER;
    default: return GAME_CONSTANTS.STANCE_BRACE_MULTIPLIER;
  }
}

function isAssaultBelowFlush(eval3: HandEvaluation3): boolean {
  return eval3.tier === 'PAIR' || eval3.tier === 'HIGH_CARD';
}
