// ============================================================================
// CYBERANTE: Pure Deterministic Match Engine (Option A Multi-Exchange)
// ============================================================================

import type {
  Card,
  GamePhase,
  PlayerPrivateState,
  PlayerPublicState,
  RoundResolution,
  Stance,
  Suit,
  Rank,
} from './types.js';
import { GAME_CONSTANTS } from './constants.js';
import { evaluateAssaultHand, evaluateAegisHand } from './pokerEvaluator.js';
import { resolveCombatRound } from './combatCalculator.js';
import { nudgeRank, bleedSuit, evaluateBurn } from './fluxEngine.js';

export interface PRNG {
  random(): number;
  nextInt(min: number, max: number): number;
}

/**
 * Seedable 32-bit PRNG (Mulberry32) for deterministic simulations and replays.
 */
export class SeededPRNG implements PRNG {
  private state: number;

  constructor(seed: number = 1337) {
    if (!Number.isSafeInteger(seed)) throw new Error('Seed must be a safe integer');
    this.state = seed >>> 0;
  }

  public random(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextInt(min: number, max: number): number {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max <= min || !Number.isSafeInteger(max - min)) {
      throw new Error('PRNG bounds must define a nonempty safe integer range');
    }
    return Math.floor(this.random() * (max - min)) + min;
  }
}

/** Deterministic fallback. Live callers inject server CSPRNG or a securely seeded PRNG. */
export class DefaultPRNG extends SeededPRNG {}

const ALL_SUITS: Suit[] = ['SPADES', 'HEARTS', 'DIAMONDS', 'CLUBS'];
const ALL_RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export class MatchEngine {
  public phase: GamePhase = 'LOBBY_WAIT';
  public currentRound: number = 1;
  public currentExchange: number = 1;
  public matchWinnerId: string | null = null;
  public lastResolution: RoundResolution | null = null;

  private p1: PlayerPrivateState;
  private p2: PlayerPrivateState;
  private deck: Card[] = [];
  private prng: PRNG;
  private idCounter: number = 1;
  private exchangeResolved = false;

  constructor(
    p1Id: string = 'player_1',
    p1Name: string = 'Operative Alpha',
    p2Id: string = 'player_2',
    p2Name: string = 'Operative Beta',
    prng: PRNG = new DefaultPRNG()
  ) {
    if (p1Id === p2Id) throw new Error('Player IDs must be distinct');
    this.prng = prng;
    this.p1 = this.createInitialPlayerState(p1Id, p1Name);
    this.p2 = this.createInitialPlayerState(p2Id, p2Name);
  }

  public startMatch(): void {
    this.currentRound = 1;
    this.currentExchange = 1;
    this.matchWinnerId = null;
    this.lastResolution = null;

    this.p1 = this.createInitialPlayerState(this.p1.playerId, this.p1.name);
    this.p2 = this.createInitialPlayerState(this.p2.playerId, this.p2.name);
    this.resetDeck();
    this.dealExchange();
  }

  public startExchange(): void {
    if (this.matchWinnerId || this.phase !== 'ROUND_RESOLVE' || !this.exchangeResolved || !this.lastResolution) {
      throw new Error('Next exchange requires a resolved exchange and an unfinished match');
    }
    if (this.lastResolution.isRoundOver) {
      this.currentRound += 1;
      this.currentExchange = 1;
      this.p1.guardHp = GAME_CONSTANTS.STARTING_GUARD_HP;
      this.p2.guardHp = GAME_CONSTANTS.STARTING_GUARD_HP;
    } else {
      this.currentExchange += 1;
      if (this.currentExchange > GAME_CONSTANTS.MAX_EXCHANGES_PER_ROUND) {
        this.p1.guardHp = 1;
        this.p2.guardHp = 1;
      }
    }
    this.dealExchange();
  }

  public get remainingDeckCount(): number {
    return this.deck.length;
  }

  private dealExchange(): void {
    // Ten dealt cards plus one replacement per player. Old hands are retired before dealing.
    if (this.deck.length < 12) this.resetDeck();
    this.exchangeResolved = false;
    this.p1.cards = this.dealCards(5);
    this.p2.cards = this.dealCards(5);

    this.p1.fluxRemaining = GAME_CONSTANTS.STARTING_FLUX;
    this.p2.fluxRemaining = GAME_CONSTANTS.STARTING_FLUX;

    this.p1.hasBurnedCard = false;
    this.p2.hasBurnedCard = false;
    this.p1.activeBurn = null;
    this.p2.activeBurn = null;

    this.p1.hasCommitted = false;
    this.p2.hasCommitted = false;

    this.p1.activeBarrier = 0;
    this.p2.activeBarrier = 0;

    this.p1.assaultCardIds = null;
    this.p1.aegisCardIds = null;
    this.p1.chosenStance = null;

    this.p2.assaultCardIds = null;
    this.p2.aegisCardIds = null;
    this.p2.chosenStance = null;

    this.phase = 'DEAL';
  }

  public nudgeRank(playerId: string, cardId: string, direction: 'UP' | 'DOWN'): boolean {
    if (this.phase !== 'SHAPING' || this.exchangeResolved || this.matchWinnerId) return false;
    if (direction !== 'UP' && direction !== 'DOWN') return false;
    const player = this.getPlayer(playerId);
    if (!player || player.hasCommitted || player.fluxRemaining < GAME_CONSTANTS.FLUX_COST_NUDGE) return false;

    const cardIdx = player.cards.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return false;

    player.cards[cardIdx] = nudgeRank(player.cards[cardIdx], direction);
    player.fluxRemaining -= GAME_CONSTANTS.FLUX_COST_NUDGE;
    return true;
  }

  public bleedSuit(playerId: string, cardId: string, targetSuit: Suit): boolean {
    if (this.phase !== 'SHAPING' || this.exchangeResolved || this.matchWinnerId) return false;
    const player = this.getPlayer(playerId);
    if (!player || player.hasCommitted || player.fluxRemaining < GAME_CONSTANTS.FLUX_COST_BLEED) return false;

    const cardIdx = player.cards.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return false;

    try {
      player.cards[cardIdx] = bleedSuit(player.cards[cardIdx], targetSuit);
      player.fluxRemaining -= GAME_CONSTANTS.FLUX_COST_BLEED;
      return true;
    } catch {
      return false;
    }
  }

  public burnCard(playerId: string, cardId: string): boolean {
    if (this.phase !== 'SHAPING' || this.exchangeResolved || this.matchWinnerId) return false;
    const player = this.getPlayer(playerId);
    if (!player || player.hasCommitted || player.hasBurnedCard || this.deck.length === 0) return false;

    const cardIdx = player.cards.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return false;

    const burnedCard = player.cards[cardIdx];
    const { burnType, barrierAmount } = evaluateBurn(burnedCard);

    const replacement = this.drawOne();
    player.activeBurn = burnType;
    if (barrierAmount) {
      player.activeBarrier += barrierAmount;
    }

    // Draw replacement card from deck
    player.cards[cardIdx] = replacement;
    player.hasBurnedCard = true;
    return true;
  }

  public commitHand(
    playerId: string,
    assaultCardIds: [string, string, string],
    aegisCardIds: [string, string],
    stance: Stance
  ): boolean {
    if (this.phase !== 'COMMITMENT' || this.exchangeResolved || this.matchWinnerId) return false;
    const player = this.getPlayer(playerId);
    if (!player) return false;
    if (player.hasCommitted) return false; // Prevent overwriting

    // Validate array lengths
    if (!Array.isArray(assaultCardIds) || assaultCardIds.length !== 3) return false;
    if (!Array.isArray(aegisCardIds) || aegisCardIds.length !== 2) return false;

    // Validate stance
    if (stance !== 'BRACE' && stance !== 'OVERCHARGE' && stance !== 'PARRY') return false;

    // Validate that IDs are distinct and belong to player's current hand
    const allIds = [...assaultCardIds, ...aegisCardIds];
    const uniqueIds = new Set(allIds);
    if (uniqueIds.size !== 5) return false;

    if (player.cards.length !== 5 || allIds.some(id => typeof id !== 'string')) return false;
    const handIds = new Set(player.cards.map(c => c.id));
    for (const id of allIds) {
      if (!handIds.has(id)) return false;
    }

    player.assaultCardIds = [...assaultCardIds];
    player.aegisCardIds = [...aegisCardIds];
    player.chosenStance = stance;
    player.hasCommitted = true;

    // If both committed, phase is ready to transition to clash
    return true;
  }

  public areBothCommitted(): boolean {
    return this.p1.hasCommitted && this.p2.hasCommitted;
  }

  public autoLockUncommitted(): void {
    if (this.phase !== 'COMMITMENT' || this.exchangeResolved || this.matchWinnerId) {
      throw new Error('Auto-lock is only permitted during COMMITMENT');
    }
    if (!this.p1.hasCommitted) {
      this.autoLockPlayer(this.p1);
    }
    if (!this.p2.hasCommitted) {
      this.autoLockPlayer(this.p2);
    }
  }

  public resolveClash(): RoundResolution {
    if (this.exchangeResolved && this.lastResolution) return this.lastResolution;
    if (this.phase !== 'COMMITMENT' || !this.areBothCommitted() || this.matchWinnerId) {
      throw new Error('Clash requires both players committed during COMMITMENT');
    }
    const p1Assault = this.getCardsByIds(this.p1, this.p1.assaultCardIds!) as [Card, Card, Card];
    const p1Aegis = this.getCardsByIds(this.p1, this.p1.aegisCardIds!) as [Card, Card];

    const p2Assault = this.getCardsByIds(this.p2, this.p2.assaultCardIds!) as [Card, Card, Card];
    const p2Aegis = this.getCardsByIds(this.p2, this.p2.aegisCardIds!) as [Card, Card];

    const resolution = resolveCombatRound(
      {
        playerId: this.p1.playerId,
        assaultCards: p1Assault,
        aegisCards: p1Aegis,
        stance: this.p1.chosenStance || 'BRACE',
        currentGuardHp: this.p1.guardHp,
        activeBarrier: this.p1.activeBarrier,
        burnType: this.p1.activeBurn,
      },
      {
        playerId: this.p2.playerId,
        assaultCards: p2Assault,
        aegisCards: p2Aegis,
        stance: this.p2.chosenStance || 'BRACE',
        currentGuardHp: this.p2.guardHp,
        activeBarrier: this.p2.activeBarrier,
        burnType: this.p2.activeBurn,
      },
      this.currentExchange,
      this.currentRound
    );

    // Update remaining Guard HP from combat resolution
    this.p1.guardHp = resolution.p1HpRemaining;
    this.p2.guardHp = resolution.p2HpRemaining;

    // Check if round KO occurred
    if (resolution.isRoundOver) {
      if (resolution.roundWinnerId === this.p1.playerId) {
        this.p1.roundWins += 1;
      } else if (resolution.roundWinnerId === this.p2.playerId) {
        this.p2.roundWins += 1;
      }

      if (this.p1.roundWins >= GAME_CONSTANTS.ROUNDS_TO_WIN) {
        this.matchWinnerId = this.p1.playerId;
        resolution.matchWinnerId = this.p1.playerId;
      } else if (this.p2.roundWins >= GAME_CONSTANTS.ROUNDS_TO_WIN) {
        this.matchWinnerId = this.p2.playerId;
        resolution.matchWinnerId = this.p2.playerId;
      }
      // Note: We intentionally delay currentRound increment and Guard HP reset to 20
      // until startExchange() is called for the subsequent round. This preserves
      // the KO display state during CLASH_REVEAL and ROUND_RESOLVE.
    }

    this.lastResolution = resolution;
    this.exchangeResolved = true;
    this.phase = 'CLASH_REVEAL';
    return resolution;
  }

  public getPlayer(playerId: string): PlayerPrivateState | null {
    if (this.p1.playerId === playerId) return this.p1;
    if (this.p2.playerId === playerId) return this.p2;
    return null;
  }

  public getPublicState(): Record<string, PlayerPublicState> {
    return {
      [this.p1.playerId]: {
        playerId: this.p1.playerId,
        name: this.p1.name,
        guardHp: this.p1.guardHp,
        fluxRemaining: this.p1.fluxRemaining,
        roundWins: this.p1.roundWins,
        hasBurnedCard: this.p1.hasBurnedCard,
        activeBurn: this.p1.activeBurn,
        hasCommitted: this.p1.hasCommitted,
        activeBarrier: this.p1.activeBarrier,
        connected: this.p1.connected,
      },
      [this.p2.playerId]: {
        playerId: this.p2.playerId,
        name: this.p2.name,
        guardHp: this.p2.guardHp,
        fluxRemaining: this.p2.fluxRemaining,
        roundWins: this.p2.roundWins,
        hasBurnedCard: this.p2.hasBurnedCard,
        activeBurn: this.p2.activeBurn,
        hasCommitted: this.p2.hasCommitted,
        activeBarrier: this.p2.activeBarrier,
        connected: this.p2.connected,
      },
    };
  }

  private autoLockPlayer(player: PlayerPrivateState): void {
    // Generate all 10 possible splits and pick optimal partition per Spec-04:
    // Highest Assault score, breaking ties by Aegis score, fallback to first partition.
    const cards = player.cards;
    if (cards.length !== 5) throw new Error('Auto-lock requires exactly five cards');
    let bestAssaultScore = -Infinity;
    let bestAegisScore = -Infinity;
    let bestAssault: [string, string, string] = [cards[0].id, cards[1].id, cards[2].id];
    let bestAegis: [string, string] = [cards[3].id, cards[4].id];

    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        for (let k = j + 1; k < 5; k++) {
          const assaultCards: [Card, Card, Card] = [cards[i], cards[j], cards[k]];
          const aegisCards = cards.filter((_, idx) => idx !== i && idx !== j && idx !== k) as [Card, Card];

          const aEval = evaluateAssaultHand(assaultCards);
          const dEval = evaluateAegisHand(aegisCards);

          if (
            aEval.score > bestAssaultScore ||
            (aEval.score === bestAssaultScore && dEval.score > bestAegisScore)
          ) {
            bestAssaultScore = aEval.score;
            bestAegisScore = dEval.score;
            bestAssault = [cards[i].id, cards[j].id, cards[k].id];
            bestAegis = [aegisCards[0].id, aegisCards[1].id];
          }
        }
      }
    }

    player.assaultCardIds = bestAssault;
    player.aegisCardIds = bestAegis;
    player.chosenStance = 'BRACE';
    player.hasCommitted = true;
  }

  private getCardsByIds(player: PlayerPrivateState, ids: string[]): Card[] {
    return ids.map(id => {
      const card = player.cards.find(c => c.id === id);
      if (!card) throw new Error('Committed card is no longer in the hand');
      return card;
    });
  }

  private resetDeck(): void {
    this.deck = [];
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        this.deck.push({
          id: `card_${this.idCounter++}_${suit}_${rank}`,
          suit,
          rank,
        });
      }
    }
    // Fisher-Yates shuffle with PRNG
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = this.prng.nextInt(0, i + 1);
      const temp = this.deck[i];
      this.deck[i] = this.deck[j];
      this.deck[j] = temp;
    }
  }

  private dealCards(count: number): Card[] {
    if (!Number.isSafeInteger(count) || count < 0 || count > this.deck.length) {
      throw new Error('Invalid deal count or insufficient cards');
    }
    return this.deck.splice(0, count);
  }

  private drawOne(): Card {
    const card = this.deck.shift();
    if (!card) throw new Error('Cannot draw from an empty deck');
    return card;
  }

  private createInitialPlayerState(playerId: string, name: string): PlayerPrivateState {
    return {
      playerId,
      name,
      guardHp: GAME_CONSTANTS.STARTING_GUARD_HP,
      fluxRemaining: GAME_CONSTANTS.STARTING_FLUX,
      roundWins: 0,
      hasBurnedCard: false,
      activeBurn: null,
      hasCommitted: false,
      activeBarrier: 0,
      connected: true,
      cards: [],
      assaultCardIds: null,
      aegisCardIds: null,
      chosenStance: null,
    };
  }
}
