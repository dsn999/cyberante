// ============================================================================
// CYBERANTE: Classical Bot Personalities & Heuristic Weights
// ============================================================================

import { BotPersonality } from '@cyberante/shared';

export interface BotConfig {
  name: string;
  personality: BotPersonality;
  tagline: string;
  assaultBias: number;    // Weight on maximizing assault line damage (0.0 to 1.0)
  aegisBias: number;      // Weight on maximizing aegis line mitigation (0.0 to 1.0)
  overchargeTendency: number; // Probability of selecting Overcharge when favorable
  parryTendency: number;      // Probability of selecting Parry to counter player
  burnAggression: number;     // Tendency to sacrifice cards for tactical buffs
}

export const BOT_PROFILES: Record<BotPersonality, BotConfig> = {
  CIPHER_ZERO: {
    name: 'CIPHER-0',
    personality: 'CIPHER_ZERO',
    tagline: 'Standard Tactical Heuristic Engine',
    assaultBias: 0.6,
    aegisBias: 0.5,
    overchargeTendency: 0.25,
    parryTendency: 0.35,
    burnAggression: 0.4,
  },
  VEKTOR_AGGRO: {
    name: 'VEKTOR-AGGRO',
    personality: 'VEKTOR_AGGRO',
    tagline: 'High-Lethality All-In Striker',
    assaultBias: 0.9,
    aegisBias: 0.2,
    overchargeTendency: 0.65,
    parryTendency: 0.1,
    burnAggression: 0.7,
  },
  AEGIS_WALL: {
    name: 'AEGIS-WALL',
    personality: 'AEGIS_WALL',
    tagline: 'Defensive Absorption & Parry Specialist',
    assaultBias: 0.3,
    aegisBias: 0.9,
    overchargeTendency: 0.05,
    parryTendency: 0.6,
    burnAggression: 0.5,
  },
};
