// ============================================================================
// CYBERANTE: Classical Deterministic Game AI (Offline Solo Mode & Balance Sim)
// ============================================================================

import {
  Card,
  Stance,
  BotDecision,
} from '../types.js';
import { evaluateAssaultHand, evaluateAegisHand } from '../pokerEvaluator.js';
import { nudgeRank } from '../fluxEngine.js';
import { PRNG, DefaultPRNG } from '../MatchEngine.js';
import { BotConfig, BOT_PROFILES } from './BotProfiles.js';

export class ClassicalBotAI {
  private config: BotConfig;
  private prng: PRNG;

  constructor(
    profileName: keyof typeof BOT_PROFILES = 'CIPHER_ZERO',
    prng: PRNG = new DefaultPRNG()
  ) {
    this.config = BOT_PROFILES[profileName];
    this.prng = prng;
  }

  public setProfile(profileName: keyof typeof BOT_PROFILES): void {
    this.config = BOT_PROFILES[profileName];
  }

  public getProfile(): BotConfig {
    return this.config;
  }

  /**
   * Generates optimal tactical decision for the given 5-card hand.
   */
  public evaluateHand(
    hand: Card[],
    ownGuardHp: number,
    opponentGuardHp: number,
    availableFlux: number = 3,
    canBurn: boolean = true
  ): BotDecision {
    if (hand.length !== 5) {
      throw new Error(`Bot requires exactly 5 cards to evaluate hand, received ${hand.length}`);
    }

    const currentCards = hand.map(c => ({ ...c }));
    const fluxActions: BotDecision['fluxActions'] = [];
    let burnCardId: string | undefined = undefined;

    // 1. Evaluate tactical Burn-to-Cast
    if (canBurn && this.prng.random() < this.config.burnAggression) {
      const candidateBurn = this.findBurnCandidate(currentCards, ownGuardHp);
      if (candidateBurn) {
        burnCardId = candidateBurn.id;
      }
    }

    // 2. Evaluate Flux Transmutation (Nudge)
    let remainingFlux = availableFlux;
    if (remainingFlux >= 1) {
      const bestNudge = this.findBestNudge(currentCards, remainingFlux);
      if (bestNudge) {
        fluxActions.push({
          type: 'NUDGE',
          cardId: bestNudge.cardId,
          direction: bestNudge.direction,
        });
        remainingFlux -= 1;

        const targetIdx = currentCards.findIndex(c => c.id === bestNudge.cardId);
        if (targetIdx !== -1) {
          currentCards[targetIdx] = nudgeRank(currentCards[targetIdx], bestNudge.direction);
        }
      }
    }

    // 3. Evaluate all 10 possible 3-card assault / 2-card aegis combinations
    const splits = this.generateAllSplits(currentCards);
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

    // 4. Select Stance based on profile, lethal opportunities, and Guard HP
    let stance: Stance = 'BRACE';
    const assaultEval = evaluateAssaultHand(bestSplit.assault);

    // Lethal finisher check: if assault base damage * 2.0 >= opponent HP, favor Overcharge
    if (assaultEval.baseDamage * 2.0 >= opponentGuardHp && ownGuardHp > 6) {
      stance = 'OVERCHARGE';
    } else {
      const roll = this.prng.random();
      if (roll < this.config.overchargeTendency && ownGuardHp > 8) {
        stance = 'OVERCHARGE';
      } else if (roll < this.config.overchargeTendency + this.config.parryTendency) {
        stance = 'PARRY';
      } else {
        stance = 'BRACE';
      }
    }

    const assaultCards: [Card, Card, Card] = [bestSplit.assault[0], bestSplit.assault[1], bestSplit.assault[2]];
    const aegisCards: [Card, Card] = [bestSplit.aegis[0], bestSplit.aegis[1]];
    const nudges = fluxActions
      .filter(a => a.type === 'NUDGE' && a.direction)
      .map(a => ({ cardId: a.cardId, direction: a.direction! }));
    const candidateBurn = burnCardId ? hand.find(c => c.id === burnCardId) || null : null;

    return {
      fluxActions,
      burnCardId,
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
      // Spec-05 compatibility aliases
      assaultCards,
      aegisCards,
      chosenStance: stance,
      cardToBurn: candidateBurn,
      nudges,
    };
  }

  private findBurnCandidate(cards: Card[], ownGuardHp: number): Card | null {
    if (ownGuardHp <= 10) {
      const diamond = cards.find(c => c.suit === 'DIAMONDS');
      if (diamond) return diamond;
    }
    const sorted = [...cards].sort((a, b) => a.rank - b.rank);
    return sorted[0] || null;
  }

  private findBestNudge(cards: Card[], flux: number): { cardId: string; direction: 'UP' | 'DOWN' } | null {
    if (flux < 1) return null;

    const baseSplits = this.generateAllSplits(cards);
    let currentBest = this.getMaxSplitScore(baseSplits);

    let bestMove: { cardId: string; direction: 'UP' | 'DOWN' } | null = null;
    let maxDelta = 0;

    for (const card of cards) {
      for (const dir of ['UP', 'DOWN'] as const) {
        const mutatedCards = cards.map(c => c.id === card.id ? nudgeRank(c, dir) : c);
        const splits = this.generateAllSplits(mutatedCards);
        const score = this.getMaxSplitScore(splits);
        const delta = score - currentBest;

        if (delta > 2.0 && delta > maxDelta) {
          maxDelta = delta;
          bestMove = { cardId: card.id, direction: dir };
        }
      }
    }

    return bestMove;
  }

  private getMaxSplitScore(splits: Array<{ assault: [Card, Card, Card]; aegis: [Card, Card] }>): number {
    let max = -Infinity;
    for (const s of splits) {
      const a = evaluateAssaultHand(s.assault);
      const d = evaluateAegisHand(s.aegis);
      const val = a.baseDamage * this.config.assaultBias + d.mitigation * this.config.aegisBias;
      if (val > max) max = val;
    }
    return max;
  }

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
