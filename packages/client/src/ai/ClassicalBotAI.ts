// ============================================================================
// CYBERANTE: Classical Deterministic Game AI (Offline Solo Mode)
// ============================================================================

import {
  Card,
  Stance,
  BotDecision,
  evaluateAssaultHand,
  evaluateAegisHand,
} from '@cyberante/shared';
import { BotConfig, BOT_PROFILES } from './BotProfiles';

export class ClassicalBotAI {
  private config: BotConfig;

  constructor(profileName: keyof typeof BOT_PROFILES = 'CIPHER_ZERO') {
    this.config = BOT_PROFILES[profileName];
  }

  public setProfile(profileName: keyof typeof BOT_PROFILES): void {
    this.config = BOT_PROFILES[profileName];
  }

  /**
   * Generates optimal tactical decision for the given 5-card hand.
   */
  public evaluateHand(
    hand: Card[],
    ownGuardHp: number,
    opponentGuardHp: number
  ): BotDecision {
    if (hand.length !== 5) {
      throw new Error(`Bot requires exactly 5 cards to evaluate hand, received ${hand.length}`);
    }

    // 1. Evaluate all 10 possible 3-card assault / 2-card aegis combinations
    const splits = this.generateAllSplits(hand);
    let bestScore = -Infinity;
    let bestSplit = splits[0];

    for (const split of splits) {
      const assaultEval = evaluateAssaultHand(split.assault);
      const aegisEval = evaluateAegisHand(split.aegis);

      const score =
        assaultEval.baseDamage * this.config.assaultBias +
        aegisEval.mitigation * this.config.aegisBias;

      if (score > bestScore) {
        bestScore = score;
        bestSplit = split;
      }
    }

    // 2. Select Stance based on profile, lethal opportunities, and Guard HP
    let stance: Stance = 'BRACE';
    const assaultEval = evaluateAssaultHand(bestSplit.assault);

    // Lethal finisher check: if assault base damage * 2.0 >= opponent HP, favor Overcharge
    if (assaultEval.baseDamage * 2.0 >= opponentGuardHp && ownGuardHp > 8) {
      stance = 'OVERCHARGE';
    } else {
      const roll = Math.random();
      if (roll < this.config.overchargeTendency && ownGuardHp > 10) {
        stance = 'OVERCHARGE';
      } else if (roll < this.config.overchargeTendency + this.config.parryTendency) {
        stance = 'PARRY';
      } else {
        stance = 'BRACE';
      }
    }

    return {
      fluxActions: [],
      assaultCardIds: [
        bestSplit.assault[0].id,
        bestSplit.assault[1].id,
        bestSplit.assault[2].id,
      ],
      aegisCardIds: [
        bestSplit.aegis[0].id,
        bestSplit.aegis[1].id,
      ],
      stance,
    };
  }

  /**
   * Generates all 10 unique partitions of 5 cards into 3 Assault and 2 Aegis cards.
   */
  private generateAllSplits(cards: Card[]): Array<{
    assault: [Card, Card, Card];
    aegis: [Card, Card];
  }> {
    const results: Array<{ assault: [Card, Card, Card]; aegis: [Card, Card] }> = [];
    const n = cards.length;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          const assault: [Card, Card, Card] = [cards[i], cards[j], cards[k]];
          const aegisCards = cards.filter((_, idx) => idx !== i && idx !== j && idx !== k);
          const aegis: [Card, Card] = [aegisCards[0], aegisCards[1]];
          results.push({ assault, aegis });
        }
      }
    }

    return results;
  }
}
