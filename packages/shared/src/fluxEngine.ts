// ============================================================================
// CYBERANTE: Flux Transmutation & Burn-to-Cast Engine
// ============================================================================

import type { Card, Rank, Suit, BurnType } from './types.js';
import { GAME_CONSTANTS, SUIT_RING } from './constants.js';

export interface FluxState {
  remainingFlux: number;
  hasBurnedThisRound: boolean;
}

export function canNudgeRank(state: FluxState): boolean {
  return state.remainingFlux >= GAME_CONSTANTS.FLUX_COST_NUDGE;
}

export function canBleedSuit(state: FluxState): boolean {
  return state.remainingFlux >= GAME_CONSTANTS.FLUX_COST_BLEED;
}

export function canBurnCard(state: FluxState): boolean {
  return !state.hasBurnedThisRound;
}

/**
 * Nudges a card's rank up or down by 1.
 * Wraps around Ace: 2 DOWN becomes 14 (Ace), 14 UP becomes 2.
 */
export function nudgeRank(card: Card, direction: 'UP' | 'DOWN'): Card {
  if (direction !== 'UP' && direction !== 'DOWN') throw new Error('Invalid nudge direction');
  let nextRank: Rank;

  if (direction === 'UP') {
    nextRank = card.rank === 14 ? 2 : ((card.rank + 1) as Rank);
  } else {
    nextRank = card.rank === 2 ? 14 : ((card.rank - 1) as Rank);
  }

  return {
    ...card,
    rank: nextRank,
  };
}

/**
 * Transmutes a card's suit into an adjacent suit along the chromatic ring.
 */
export function bleedSuit(card: Card, targetSuit: Suit): Card {
  const allowed = SUIT_RING[card.suit];
  if (!allowed.includes(targetSuit)) {
    throw new Error(`Cannot bleed suit from ${card.suit} to ${targetSuit}. Allowed: ${allowed.join(', ')}`);
  }

  return {
    ...card,
    suit: targetSuit,
  };
}

/**
 * Evaluates the burn effect corresponding to a card's suit.
 */
export function evaluateBurn(card: Card): { burnType: BurnType; barrierAmount?: number } {
  switch (card.suit) {
    case 'SPADES':
      return { burnType: 'SPADE_VEIL' };
    case 'DIAMONDS': {
      // Barrier = Pip value (Face cards = 10, Ace = 11)
      const barrier = card.rank === 14 ? 11 : (card.rank >= 10 ? 10 : card.rank);
      return { burnType: 'DIAMOND_BARRIER', barrierAmount: barrier };
    }
    case 'HEARTS':
      return { burnType: 'HEART_SIPHON' };
    case 'CLUBS':
      return { burnType: 'CLUB_SUNDER' };
  }
}
