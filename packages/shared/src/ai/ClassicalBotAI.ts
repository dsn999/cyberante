// CYBERANTE: Classical deterministic bot shared by solo and headless simulation.
import type { Card, Stance, BotDecision, BotPersonality, HandEvaluation3, HandTier3 } from '../types.js';
import { GAME_CONSTANTS, SUIT_RING } from '../constants.js';
import { evaluateAssaultHand, evaluateAegisHand } from '../pokerEvaluator.js';
import { nudgeRank } from '../fluxEngine.js';
import { DefaultPRNG, type MatchEngine, type PRNG } from '../MatchEngine.js';
import { BOT_PROFILES, type BotConfig } from './BotProfiles.js';

const ASSAULT_INDICES = [
  [0, 1, 2], [0, 1, 3], [0, 1, 4], [0, 2, 3], [0, 2, 4],
  [0, 3, 4], [1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4],
] as const;
const TIER_ORDER: Record<HandTier3, number> = {
  HIGH_CARD: 0, PAIR: 1, FLUSH: 2, STRAIGHT: 3, THREE_OF_A_KIND: 4, STRAIGHT_FLUSH: 5,
};
interface Partition {
  assault: [Card, Card, Card];
  aegis: [Card, Card];
  evaluation: HandEvaluation3;
  utility: number;
}

export class ClassicalBotAI {
  private config: BotConfig;

  constructor(profileName: BotPersonality = 'CIPHER_ZERO', private readonly prng: PRNG = new DefaultPRNG()) {
    this.config = this.profile(profileName);
  }

  public setProfile(profileName: BotPersonality): void { this.config = this.profile(profileName); }
  public getProfile(): BotConfig { return { ...this.config }; }

  public evaluateHand(
    hand: Card[], ownGuardHp: number, opponentGuardHp: number,
    availableFlux: number = GAME_CONSTANTS.STARTING_FLUX, canBurn = true
  ): BotDecision {
    if (!Array.isArray(hand) || hand.length !== 5) throw new Error('Bot requires exactly 5 cards');
    if (hand.some(c => !c || typeof c.id !== 'string' || !c.id || !Number.isInteger(c.rank) ||
        c.rank < 2 || c.rank > 14 || !Object.hasOwn(SUIT_RING, c.suit)) || new Set(hand.map(c => c.id)).size !== 5) {
      throw new Error('Bot requires five valid cards with distinct IDs');
    }
    if (!Number.isSafeInteger(availableFlux) || availableFlux < 0) throw new Error('Flux must be a nonnegative integer');
    if (![ownGuardHp, opponentGuardHp].every(hp => Number.isFinite(hp) && hp >= 0)) throw new Error('Guard HP must be finite and nonnegative');
    const cards = hand.map(c => ({ ...c }));
    let best = this.bestPartition(cards);
    const burn = canBurn && this.prng.random() < this.config.burnAggression
      ? this.burnCandidate(cards, ownGuardHp, opponentGuardHp) : null;
    const fluxActions: BotDecision['fluxActions'] = [];

    if (availableFlux >= GAME_CONSTANTS.FLUX_COST_NUDGE) {
      let bestNudge: { cardId: string; direction: 'UP' | 'DOWN'; partition: Partition } | null = null;
      // An Aegis-only nudge cannot upgrade this partition's Assault tier.
      for (let index = 0; index < best.assault.length; index++) {
        // Burn is applied first by callers, so never propose a mutation of its retired ID.
        const card = best.assault[index];
        if (card.id === burn?.id) continue;
        for (const direction of ['UP', 'DOWN'] as const) {
          const assault = [...best.assault] as [Card, Card, Card];
          assault[index] = nudgeRank(card, direction);
          const candidate = this.partition(assault, best.aegis);
          if (TIER_ORDER[candidate.evaluation.tier] > TIER_ORDER[best.evaluation.tier] &&
              candidate.utility - best.utility >= 3.0 &&
              (!bestNudge || candidate.utility > bestNudge.partition.utility)) {
            bestNudge = { cardId: card.id, direction, partition: candidate };
          }
        }
      }
      if (bestNudge) {
        fluxActions.push({ type: 'NUDGE', cardId: bestNudge.cardId, direction: bestNudge.direction });
        best = bestNudge.partition;
      }
    }

    const stance = this.stance(best.evaluation.baseDamage, ownGuardHp, opponentGuardHp);
    const nudges = fluxActions.map(action => ({ cardId: action.cardId, direction: action.direction! }));
    return {
      assaultCards: best.assault, aegisCards: best.aegis, chosenStance: stance,
      assaultCardIds: best.assault.map(c => c.id) as [string, string, string],
      aegisCardIds: best.aegis.map(c => c.id) as [string, string], stance,
      fluxActions, nudges, burnCardId: burn?.id, cardToBurn: burn ? { ...burn } : null,
    };
  }

  private profile(name: BotPersonality): BotConfig {
    if (!Object.hasOwn(BOT_PROFILES, name)) throw new Error(`Unknown bot profile: ${name}`);
    return { ...BOT_PROFILES[name] };
  }

  private bestPartition(cards: Card[]): Partition {
    let best: Partition | null = null;
    for (const [i, j, k] of ASSAULT_INDICES) {
      const assault: [Card, Card, Card] = [cards[i], cards[j], cards[k]];
      const aegis = cards.filter((_c, index) => index !== i && index !== j && index !== k) as [Card, Card];
      const candidate = this.partition(assault, aegis);
      if (!best || candidate.utility > best.utility) best = candidate;
    }
    return best!;
  }

  private partition(assault: [Card, Card, Card], aegis: [Card, Card]): Partition {
    const evaluation = evaluateAssaultHand(assault);
    return { assault, aegis, evaluation, utility: evaluation.baseDamage * this.config.assaultBias +
      evaluateAegisHand(aegis).mitigation * this.config.aegisBias + evaluation.score * 0.0001 };
  }

  private burnCandidate(cards: Card[], ownHp: number, opponentHp: number): Card | null {
    const diamond = ownHp <= 10 ? cards.find(c => c.suit === 'DIAMONDS') : undefined;
    if (diamond) return diamond;
    const club = this.config.personality === 'VEKTOR_AGGRO' ? cards.find(c => c.suit === 'CLUBS') : undefined;
    if (club) return club;
    const heart = ownHp <= 14 ? cards.find(c => c.suit === 'HEARTS') : undefined;
    if (heart) return heart;
    return opponentHp > ownHp ? cards.find(c => c.suit === 'SPADES') ?? null : null;
  }

  private stance(baseDamage: number, ownHp: number, opponentHp: number): Stance {
    if (baseDamage * GAME_CONSTANTS.STANCE_OVERCHARGE_MULTIPLIER >= opponentHp && ownHp > 6) return 'OVERCHARGE';
    const roll = this.prng.random();
    if (ownHp <= 5) return roll < this.config.parryTendency * 1.2 ? 'PARRY' : 'BRACE';
    if (roll < this.config.overchargeTendency) return 'OVERCHARGE';
    if (roll < this.config.overchargeTendency + this.config.parryTendency) return 'PARRY';
    return 'BRACE';
  }
}

/** Apply a shaping proposal before re-evaluating the actual hand for commitment. */
export function applyBotShaping(engine: MatchEngine, playerId: string, decision: BotDecision): void {
  if (decision.burnCardId && !engine.burnCard(playerId, decision.burnCardId)) {
    throw new Error('Bot burn was rejected');
  }
  for (const action of decision.fluxActions) {
    const accepted = action.type === 'NUDGE' && action.direction
      ? engine.nudgeRank(playerId, action.cardId, action.direction)
      : action.type === 'BLEED' && action.targetSuit
        ? engine.bleedSuit(playerId, action.cardId, action.targetSuit) : false;
    if (!accepted) throw new Error('Bot Flux action was rejected');
  }
}
