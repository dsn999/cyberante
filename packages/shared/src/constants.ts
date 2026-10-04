// ============================================================================
// CYBERANTE: Game Constants & Balance Formulas
// ============================================================================

import { Suit } from './types.js';

export const GAME_CONSTANTS = {
  // Pacing & Match Structure (Option A: Bo3 Match, Multi-Exchange HP Depletion)
  BEST_OF_ROUNDS: 3,
  ROUNDS_TO_WIN: 2,
  STARTING_GUARD_HP: 20,
  STARTING_FLUX: 3,
  MAX_EXCHANGES_PER_ROUND: 10,

  // Phase Timers
  DEAL_TIME_MS: 2000,
  SHAPING_TIME_MS: 15000,
  COMMITMENT_TIME_MS: 10000,
  CLASH_REVEAL_TIME_MS: 4000,
  ROUND_RESOLVE_TIME_MS: 3000,

  // Flux Costs
  FLUX_COST_NUDGE: 1,
  FLUX_COST_BLEED: 2,

  // 3-Card Assault Base Damage
  DAMAGE_STRAIGHT_FLUSH: 18,
  DAMAGE_THREE_OF_A_KIND: 14,
  DAMAGE_STRAIGHT: 10,
  DAMAGE_FLUSH: 8,
  DAMAGE_PAIR: 5,
  DAMAGE_HIGH_CARD: 2,

  // 2-Card Aegis Mitigation Values
  MITIGATION_PAIR: 8,
  MITIGATION_SUITED: 4,
  MITIGATION_HIGH_CARD: 2,

  // Stance Multipliers & Mechanics
  STANCE_BRACE_MULTIPLIER: 1.0,
  STANCE_OVERCHARGE_MULTIPLIER: 2.0,
  STANCE_PARRY_MULTIPLIER: 0.5,
  STANCE_PARRY_REFLECT_RATIO: 0.5,

  // Port Configuration
  DEFAULT_WS_PORT: 8080,
  DEFAULT_HTTP_PORT: 3000,
} as const;

// Chromatic Suit Ring for Suit Bleed: Spades <-> Clubs <-> Diamonds <-> Hearts <-> Spades
export const SUIT_RING: Record<Suit, [Suit, Suit]> = {
  SPADES: ['CLUBS', 'HEARTS'],
  CLUBS: ['SPADES', 'DIAMONDS'],
  DIAMONDS: ['CLUBS', 'HEARTS'],
  HEARTS: ['DIAMONDS', 'SPADES'],
};

// Unicode Suit Glyphs for UI and Accessibility
export const SUIT_GLYPHS: Record<Suit, string> = {
  SPADES: '♠',
  HEARTS: '♥',
  DIAMONDS: '♦',
  CLUBS: '♣',
};

export const SUIT_COLORS: Record<Suit, string> = {
  SPADES: '#00f3ff',   // Neon Cyan
  CLUBS: '#00ff88',    // Neon Emerald
  DIAMONDS: '#ffb700', // Neon Amber
  HEARTS: '#ff0055',   // Neon Magenta
};
