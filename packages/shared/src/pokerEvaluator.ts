// ============================================================================
// CYBERANTE: Deterministic Poker Hand Evaluator (3-Card Assault & 2-Card Aegis)
// ============================================================================

import type { Card, HandEvaluation3, HandEvaluation2, HandTier3, HandTier2, Rank } from './types.js';
import { GAME_CONSTANTS } from './constants.js';

/**
 * Evaluates a 3-Card Assault Hand according to 3-Card Poker ranking rules:
 * Straight Flush > Three of a Kind > Straight > Flush > Pair > High Card
 */
export function evaluateAssaultHand(cards: [Card, Card, Card]): HandEvaluation3 {
  // Sort descending by rank (14 down to 2)
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const r0 = sorted[0].rank;
  const r1 = sorted[1].rank;
  const r2 = sorted[2].rank;

  const isFlush = sorted[0].suit === sorted[1].suit && sorted[1].suit === sorted[2].suit;

  // Check straight: normal (e.g. 9-8-7) or ace-low wheel (A-3-2 => 14, 3, 2)
  const isNormalStraight = (r0 - r1 === 1) && (r1 - r2 === 1);
  const isAceLowStraight = r0 === 14 && r1 === 3 && r2 === 2;
  const isStraight = isNormalStraight || isAceLowStraight;

  // Check three of a kind
  const isThreeOfAKind = (r0 === r1) && (r1 === r2);

  // Check pair
  const isPair = (r0 === r1) || (r1 === r2) || (r0 === r2);

  let tier: HandTier3 = 'HIGH_CARD';
  let baseDamage: number = GAME_CONSTANTS.DAMAGE_HIGH_CARD;
  let score = 0;
  let description = '';

  if (isStraight && isFlush) {
    tier = 'STRAIGHT_FLUSH';
    baseDamage = GAME_CONSTANTS.DAMAGE_STRAIGHT_FLUSH;
    score = 60000 + (isAceLowStraight ? 3 : r0);
    description = `Straight Flush (${isAceLowStraight ? 'A-2-3' : `${r0}-high`})`;
  } else if (isThreeOfAKind) {
    tier = 'THREE_OF_A_KIND';
    baseDamage = GAME_CONSTANTS.DAMAGE_THREE_OF_A_KIND;
    score = 50000 + r0;
    description = `Three of a Kind (${rankName(r0)}s)`;
  } else if (isStraight) {
    tier = 'STRAIGHT';
    baseDamage = GAME_CONSTANTS.DAMAGE_STRAIGHT;
    score = 40000 + (isAceLowStraight ? 3 : r0);
    description = `Straight (${isAceLowStraight ? 'A-2-3' : `${r0}-high`})`;
  } else if (isFlush) {
    tier = 'FLUSH';
    baseDamage = GAME_CONSTANTS.DAMAGE_FLUSH;
    score = 30000 + r0 * 256 + r1 * 16 + r2;
    description = `Flush (${r0}-high)`;
  } else if (isPair) {
    tier = 'PAIR';
    baseDamage = GAME_CONSTANTS.DAMAGE_PAIR;
    const pairRank = (r0 === r1 || r0 === r2) ? r0 : r1;
    const kicker = (r0 === r1) ? r2 : (r1 === r2 ? r0 : r1);
    score = 20000 + pairRank * 16 + kicker;
    description = `Pair of ${rankName(pairRank)}s`;
  } else {
    tier = 'HIGH_CARD';
    baseDamage = GAME_CONSTANTS.DAMAGE_HIGH_CARD;
    score = 10000 + r0 * 256 + r1 * 16 + r2;
    description = `High Card (${rankName(r0)})`;
  }

  return {
    tier,
    baseDamage,
    score,
    description,
    cards: [sorted[0], sorted[1], sorted[2]],
  };
}

/**
 * Evaluates a 2-Card Aegis Hand according to 2-Card Mitigation rules:
 * Pair > Suited High Card > Offsuit High Card
 */
export function evaluateAegisHand(cards: [Card, Card]): HandEvaluation2 {
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const r0 = sorted[0].rank;
  const r1 = sorted[1].rank;

  const isPair = r0 === r1;
  const isSuited = sorted[0].suit === sorted[1].suit;

  let tier: HandTier2 = 'HIGH_CARD';
  let mitigation: number = GAME_CONSTANTS.MITIGATION_HIGH_CARD;
  let score = 0;
  let description = '';

  if (isPair) {
    tier = 'PAIR';
    mitigation = GAME_CONSTANTS.MITIGATION_PAIR;
    score = 2000 + r0;
    description = `Aegis Pair of ${rankName(r0)}s`;
  } else if (isSuited) {
    tier = 'SUITED';
    mitigation = GAME_CONSTANTS.MITIGATION_SUITED;
    score = 1000 + r0 * 16 + r1;
    description = `Suited Aegis (${rankName(r0)}-${rankName(r1)})`;
  } else {
    tier = 'HIGH_CARD';
    mitigation = GAME_CONSTANTS.MITIGATION_HIGH_CARD;
    score = r0 * 16 + r1;
    description = `High Card Aegis (${rankName(r0)})`;
  }

  return {
    tier,
    mitigation,
    score,
    description,
    cards: [sorted[0], sorted[1]],
  };
}

function rankName(rank: Rank): string {
  switch (rank) {
    case 14: return 'Ace';
    case 13: return 'King';
    case 12: return 'Queen';
    case 11: return 'Jack';
    default: return rank.toString();
  }
}
