// ============================================================================
// CYBERANTE: Authoritative Room State Machine
// ============================================================================

import {
  Card,
  ClientMessage,
  GamePhase,
  PlayerPrivateState,
  PlayerPublicState,
  ServerMessage,
  Stance,
  GAME_CONSTANTS,
  evaluateAssaultHand,
  resolveCombatRound,
  nudgeRank,
  bleedSuit,
  evaluateBurn,
} from '@cyberante/shared';
import { Deck } from './Deck';
import { WebSocket } from 'ws';

export interface RoomParticipant {
  ws: WebSocket;
  state: PlayerPrivateState;
}

export class Room {
  public readonly id: string;
  public readonly roomCode: string;
  private phase: GamePhase = 'LOBBY_WAIT';
  private participants: Map<string, RoomParticipant> = new Map();
  private deck: Deck = new Deck();
  private phaseTimer: NodeJS.Timeout | null = null;
  private phaseEndTime: number = 0;
  private currentRound: number = 1;

  constructor(id: string, roomCode: string) {
    this.id = id;
    this.roomCode = roomCode;
  }

  public addPlayer(playerId: string, name: string, ws: WebSocket): boolean {
    if (this.participants.size >= 2) {
      return false;
    }

    const state: PlayerPrivateState = {
      playerId,
      name,
      guardHp: GAME_CONSTANTS.STARTING_GUARD_HP,
      fluxRemaining: GAME_CONSTANTS.STARTING_FLUX,
      roundWins: 0,
      hasBurnedCard: false,
      hasCommitted: false,
      activeBarrier: 0,
      connected: true,
      cards: [],
      assaultCardIds: null,
      aegisCardIds: null,
      chosenStance: null,
    };

    this.participants.set(playerId, { ws, state });

    if (this.participants.size === 2) {
      this.startMatch();
    } else {
      this.broadcastStateTick();
    }

    return true;
  }

  public removePlayer(playerId: string): void {
    const participant = this.participants.get(playerId);
    if (participant) {
      participant.state.connected = false;
      this.broadcastStateTick();
    }
  }

  public handleClientMessage(playerId: string, msg: ClientMessage): void {
    const participant = this.participants.get(playerId);
    if (!participant) return;
    const { state } = participant;

    switch (msg.type) {
      case 'CMD_NUDGE_RANK': {
        if (this.phase !== 'SHAPING') return;
        if (state.fluxRemaining < GAME_CONSTANTS.FLUX_COST_NUDGE) return;

        const cardIdx = state.cards.findIndex(c => c.id === msg.cardId);
        if (cardIdx === -1) return;

        state.cards[cardIdx] = nudgeRank(state.cards[cardIdx], msg.direction);
        state.fluxRemaining -= GAME_CONSTANTS.FLUX_COST_NUDGE;
        this.broadcastStateTick();
        break;
      }

      case 'CMD_BLEED_SUIT': {
        if (this.phase !== 'SHAPING') return;
        if (state.fluxRemaining < GAME_CONSTANTS.FLUX_COST_BLEED) return;

        const cardIdx = state.cards.findIndex(c => c.id === msg.cardId);
        if (cardIdx === -1) return;

        try {
          state.cards[cardIdx] = bleedSuit(state.cards[cardIdx], msg.targetSuit);
          state.fluxRemaining -= GAME_CONSTANTS.FLUX_COST_BLEED;
          this.broadcastStateTick();
        } catch {
          // Illegal bleed transition ignored
        }
        break;
      }

      case 'CMD_BURN_CAST': {
        if (this.phase !== 'SHAPING') return;
        if (state.hasBurnedCard) return;

        const cardIdx = state.cards.findIndex(c => c.id === msg.cardId);
        if (cardIdx === -1) return;

        const burnedCard = state.cards[cardIdx];
        const { barrierAmount } = evaluateBurn(burnedCard);
        if (barrierAmount) {
          state.activeBarrier += barrierAmount;
        }

        // Draw replacement card from deck
        state.cards[cardIdx] = this.deck.drawOne();
        state.hasBurnedCard = true;
        this.broadcastStateTick();
        break;
      }

      case 'CMD_COMMIT_HAND': {
        if (this.phase !== 'COMMITMENT') return;
        state.assaultCardIds = msg.assaultCardIds;
        state.aegisCardIds = msg.aegisCardIds;
        state.chosenStance = msg.stance;
        state.hasCommitted = true;

        this.broadcastStateTick();

        // Check if both players have committed
        const allCommitted = Array.from(this.participants.values()).every(p => p.state.hasCommitted);
        if (allCommitted) {
          this.clearTimer();
          this.transitionToClash();
        }
        break;
      }
    }
  }

  private startMatch(): void {
    this.currentRound = 1;
    this.startRound();
  }

  private startRound(): void {
    this.deck.reset();

    for (const { state } of this.participants.values()) {
      state.cards = this.deck.deal(5);
      state.fluxRemaining = GAME_CONSTANTS.STARTING_FLUX;
      state.hasBurnedCard = false;
      state.hasCommitted = false;
      state.activeBarrier = 0;
      state.assaultCardIds = null;
      state.aegisCardIds = null;
      state.chosenStance = null;
    }

    this.transitionPhase('DEAL', GAME_CONSTANTS.DEAL_TIME_MS, () => {
      this.transitionPhase('SHAPING', GAME_CONSTANTS.SHAPING_TIME_MS, () => {
        this.transitionPhase('COMMITMENT', GAME_CONSTANTS.COMMITMENT_TIME_MS, () => {
          this.autoLockUncommitted();
          this.transitionToClash();
        });
      });
    });
  }

  private autoLockUncommitted(): void {
    for (const { state } of this.participants.values()) {
      if (!state.hasCommitted) {
        // Fallback: 3 highest rank cards to Assault, 2 remaining to Aegis, Brace stance
        const sorted = [...state.cards].sort((a, b) => b.rank - a.rank);
        state.assaultCardIds = [sorted[0].id, sorted[1].id, sorted[2].id];
        state.aegisCardIds = [sorted[3].id, sorted[4].id];
        state.chosenStance = 'BRACE';
        state.hasCommitted = true;
      }
    }
  }

  private transitionToClash(): void {
    const players = Array.from(this.participants.values());
    if (players.length < 2) return;

    const p1 = players[0].state;
    const p2 = players[1].state;

    const getCards = (state: PlayerPrivateState, ids: string[]): Card[] =>
      ids.map(id => state.cards.find(c => c.id === id)!);

    const p1Assault = getCards(p1, p1.assaultCardIds!) as [Card, Card, Card];
    const p1Aegis = getCards(p1, p1.aegisCardIds!) as [Card, Card];

    const p2Assault = getCards(p2, p2.assaultCardIds!) as [Card, Card, Card];
    const p2Aegis = getCards(p2, p2.aegisCardIds!) as [Card, Card];

    const resolution = resolveCombatRound(
      {
        playerId: p1.playerId,
        assaultCards: p1Assault,
        aegisCards: p1Aegis,
        stance: p1.chosenStance || 'BRACE',
        currentGuardHp: p1.guardHp,
        activeBarrier: p1.activeBarrier,
      },
      {
        playerId: p2.playerId,
        assaultCards: p2Assault,
        aegisCards: p2Aegis,
        stance: p2.chosenStance || 'BRACE',
        currentGuardHp: p2.guardHp,
        activeBarrier: p2.activeBarrier,
      }
    );

    // Update Round Guard and Wins
    p1.guardHp = resolution.p1HpRemaining;
    p2.guardHp = resolution.p2HpRemaining;

    if (resolution.roundWinnerId === p1.playerId) {
      p1.roundWins += 1;
    } else if (resolution.roundWinnerId === p2.playerId) {
      p2.roundWins += 1;
    }

    if (p1.roundWins >= GAME_CONSTANTS.ROUNDS_TO_WIN) {
      resolution.matchWinnerId = p1.playerId;
    } else if (p2.roundWins >= GAME_CONSTANTS.ROUNDS_TO_WIN) {
      resolution.matchWinnerId = p2.playerId;
    }

    this.phase = 'CLASH_REVEAL';
    this.broadcast({
      type: 'ROUND_OUTCOME',
      resolution,
    });

    this.transitionPhase('ROUND_RESOLVE', GAME_CONSTANTS.ROUND_RESOLVE_TIME_MS, () => {
      if (resolution.matchWinnerId) {
        this.phase = 'MATCH_OVER';
        this.broadcastStateTick();
      } else {
        this.currentRound += 1;
        this.startRound();
      }
    });
  }

  private transitionPhase(nextPhase: GamePhase, durationMs: number, onComplete: () => void): void {
    this.clearTimer();
    this.phase = nextPhase;
    this.phaseEndTime = Date.now() + durationMs;
    this.broadcastStateTick();

    this.phaseTimer = setTimeout(() => {
      onComplete();
    }, durationMs);
  }

  private clearTimer(): void {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  private broadcastStateTick(): void {
    const timeRemainingMs = Math.max(0, this.phaseEndTime - Date.now());
    const publicStates: Record<string, PlayerPublicState> = {};

    for (const [id, { state }] of this.participants.entries()) {
      publicStates[id] = {
        playerId: state.playerId,
        name: state.name,
        guardHp: state.guardHp,
        fluxRemaining: state.fluxRemaining,
        roundWins: state.roundWins,
        hasBurnedCard: state.hasBurnedCard,
        hasCommitted: state.hasCommitted,
        activeBarrier: state.activeBarrier,
        connected: state.connected,
      };
    }

    for (const [id, { ws, state }] of this.participants.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        const msg: ServerMessage = {
          type: 'STATE_TICK',
          phase: this.phase,
          timeRemainingMs,
          players: publicStates,
          selfCards: state.cards,
        };
        ws.send(JSON.stringify(msg));
      }
    }
  }

  private broadcast(msg: ServerMessage): void {
    const payload = JSON.stringify(msg);
    for (const { ws } of this.participants.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}
