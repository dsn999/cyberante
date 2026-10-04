// ============================================================================
// CYBERANTE: Authoritative Room State Machine (Option A Multi-Exchange)
// ============================================================================

import {
  ClientMessage,
  GamePhase,
  ServerMessage,
  GAME_CONSTANTS,
  MatchEngine,
} from '@cyberante/shared';
import { WebSocket } from 'ws';

export interface RoomParticipant {
  ws: WebSocket;
  playerId: string;
  name: string;
  connected: boolean;
}

export class Room {
  public readonly id: string;
  public readonly roomCode: string;
  private participants: Map<string, RoomParticipant> = new Map();
  private engine: MatchEngine | null = null;
  private phaseTimer: NodeJS.Timeout | null = null;
  private phaseEndTime: number = 0;
  private readyPlayers: Set<string> = new Set();
  public onEmpty?: () => void;

  constructor(id: string, roomCode: string) {
    this.id = id;
    this.roomCode = roomCode;
  }

  public get playerCount(): number {
    return this.participants.size;
  }

  public addPlayer(playerId: string, name: string, ws: WebSocket): boolean {
    if (this.participants.size >= 2) {
      return false;
    }

    this.participants.set(playerId, { ws, playerId, name, connected: true });

    if (this.participants.size === 2) {
      this.startMatch();
    } else {
      this.sendStateTick();
    }

    return true;
  }

  public removePlayer(playerId: string): void {
    const participant = this.participants.get(playerId);
    if (participant) {
      participant.connected = false;
      this.sendStateTick();
    }

    const allDisconnected = Array.from(this.participants.values()).every(p => !p.connected);
    if (allDisconnected) {
      this.clearTimer();
      if (this.onEmpty) {
        this.onEmpty();
      }
    }
  }

  public handleClientMessage(playerId: string, msg: ClientMessage): void {
    const participant = this.participants.get(playerId);
    if (!participant || !this.engine) return;

    switch (msg.type) {
      case 'CMD_NUDGE_RANK': {
        const ok = this.engine.nudgeRank(playerId, msg.cardId, msg.direction);
        if (!ok) {
          this.sendToPlayer(playerId, { type: 'ERROR_REJECTED', reason: 'Invalid rank nudge or insufficient Flux' });
          return;
        }
        this.sendStateTick();
        break;
      }

      case 'CMD_BLEED_SUIT': {
        const ok = this.engine.bleedSuit(playerId, msg.cardId, msg.targetSuit);
        if (!ok) {
          this.sendToPlayer(playerId, { type: 'ERROR_REJECTED', reason: 'Invalid suit bleed or insufficient Flux' });
          return;
        }
        this.sendStateTick();
        break;
      }

      case 'CMD_BURN_CAST': {
        const ok = this.engine.burnCard(playerId, msg.cardId);
        if (!ok) {
          this.sendToPlayer(playerId, { type: 'ERROR_REJECTED', reason: 'Cannot burn card or already burned this exchange' });
          return;
        }
        this.sendStateTick();
        break;
      }

      case 'CMD_READY': {
        if (this.engine.phase !== 'SHAPING') return;
        this.readyPlayers.add(playerId);
        if (this.readyPlayers.size >= 2) {
          this.clearTimer();
          this.transitionToCommitment();
        }
        break;
      }

      case 'CMD_COMMIT_HAND': {
        const ok = this.engine.commitHand(playerId, msg.assaultCardIds, msg.aegisCardIds, msg.stance);
        if (!ok) {
          this.sendToPlayer(playerId, { type: 'ERROR_REJECTED', reason: 'Invalid hand commitment or cards not owned' });
          return;
        }

        this.sendStateTick();

        if (this.engine.areBothCommitted()) {
          this.clearTimer();
          this.transitionToClash();
        }
        break;
      }

      case 'CMD_REMATCH': {
        if (this.engine.phase === 'MATCH_OVER') {
          this.startMatch();
        }
        break;
      }
    }
  }

  private startMatch(): void {
    const players = Array.from(this.participants.values());
    if (players.length < 2) return;

    const p1 = players[0];
    const p2 = players[1];

    this.engine = new MatchEngine(p1.playerId, p1.name, p2.playerId, p2.name);
    this.engine.startMatch();

    // Notify both players of match start with roomCode
    this.sendToPlayer(p1.playerId, {
      type: 'STATE_INIT',
      playerId: p1.playerId,
      matchId: this.id,
      roomCode: this.roomCode,
      opponentName: p2.name,
    });

    this.sendToPlayer(p2.playerId, {
      type: 'STATE_INIT',
      playerId: p2.playerId,
      matchId: this.id,
      roomCode: this.roomCode,
      opponentName: p1.name,
    });

    this.startExchangeFlow();
  }

  private startExchangeFlow(): void {
    if (!this.engine) return;
    this.readyPlayers.clear();

    this.transitionPhase('DEAL', GAME_CONSTANTS.DEAL_TIME_MS, () => {
      this.transitionPhase('SHAPING', GAME_CONSTANTS.SHAPING_TIME_MS, () => {
        this.transitionToCommitment();
      });
    });
  }

  private transitionToCommitment(): void {
    if (!this.engine) return;
    this.transitionPhase('COMMITMENT', GAME_CONSTANTS.COMMITMENT_TIME_MS, () => {
      this.engine?.autoLockUncommitted();
      this.transitionToClash();
    });
  }

  private transitionToClash(): void {
    if (!this.engine) return;
    const resolution = this.engine.resolveClash();

    this.broadcast({
      type: 'ROUND_OUTCOME',
      resolution,
    });

    this.transitionPhase('CLASH_REVEAL', GAME_CONSTANTS.CLASH_REVEAL_TIME_MS, () => {
      this.transitionPhase('ROUND_RESOLVE', GAME_CONSTANTS.ROUND_RESOLVE_TIME_MS, () => {
        if (!this.engine) return;

        if (this.engine.matchWinnerId) {
          this.engine.phase = 'MATCH_OVER';
          this.sendStateTick();
        } else {
          // Advance to next exchange (either same round or new round)
          this.engine.startExchange();
          this.startExchangeFlow();
        }
      });
    });
  }

  private transitionPhase(nextPhase: GamePhase, durationMs: number, onComplete: () => void): void {
    this.clearTimer();
    if (this.engine) {
      this.engine.phase = nextPhase;
    }
    this.phaseEndTime = Date.now() + durationMs;
    this.sendStateTick();

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

  private sendStateTick(): void {
    const timeRemainingMs = Math.max(0, this.phaseEndTime - Date.now());
    const phase: GamePhase = this.engine ? this.engine.phase : 'LOBBY_WAIT';
    const roundNumber = this.engine ? this.engine.currentRound : 1;
    const exchangeNumber = this.engine ? this.engine.currentExchange : 1;
    const publicStates = this.engine ? this.engine.getPublicState() : {};

    for (const [id, participant] of this.participants.entries()) {
      if (participant.ws.readyState === WebSocket.OPEN) {
        const privateState = this.engine?.getPlayer(id);
        const msg: ServerMessage = {
          type: 'STATE_TICK',
          phase,
          timeRemainingMs,
          roundNumber,
          exchangeNumber,
          players: publicStates,
          selfCards: privateState ? privateState.cards : [],
        };
        participant.ws.send(JSON.stringify(msg));
      }
    }
  }

  private sendToPlayer(playerId: string, msg: ServerMessage): void {
    const participant = this.participants.get(playerId);
    if (participant && participant.ws.readyState === WebSocket.OPEN) {
      participant.ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: ServerMessage): void {
    const payload = JSON.stringify(msg);
    for (const participant of this.participants.values()) {
      if (participant.ws.readyState === WebSocket.OPEN) {
        participant.ws.send(payload);
      }
    }
  }
}
