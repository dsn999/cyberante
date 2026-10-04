// CYBERANTE: Authoritative Room State Machine (Option A Multi-Exchange)
import { GAME_CONSTANTS, MatchEngine, type ClientMessage, type GamePhase, type ServerMessage } from '@cyberante/shared';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { WebSocket } from 'ws';
import { CryptoPRNG } from './Deck.js';
import { isClientMessage } from './messageValidation.js';

export const DISCONNECT_GRACE_MS = 30_000;

interface RoomParticipant {
  ws: WebSocket;
  playerId: string;
  name: string;
  sessionToken: string;
  connected: boolean;
  departed: boolean;
  disconnectDeadline: number | null;
  disconnectTimer: NodeJS.Timeout | null;
}

export class Room {
  public readonly roomCode: string;
  public readonly id = randomUUID();
  private participants = new Map<string, RoomParticipant>();
  private engine: MatchEngine | null = null;
  private phaseTimer: NodeJS.Timeout | null = null;
  private phaseEndTime = 0;
  private readyPlayers = new Set<string>();
  private rematchPlayers = new Set<string>();
  private destroyed = false;

  constructor(roomCode: string, private readonly onEmpty?: () => void) {
    this.roomCode = roomCode;
  }

  public get isFull(): boolean { return this.participants.size === 2; }
  public get isEmpty(): boolean { return [...this.participants.values()].every(p => p.departed); }

  public addPlayer(ws: WebSocket, playerName: string): string | null {
    if (this.destroyed || this.isFull) {
      this.sendSocket(ws, { type: 'ERROR_REJECTED', reason: 'Room is full' });
      ws.close(1008, 'Room is full');
      return null;
    }
    if (!isClientMessage({ type: 'CMD_CREATE_ROOM', playerName })) {
      this.sendSocket(ws, { type: 'ERROR_REJECTED', reason: 'Invalid player name' });
      return null;
    }
    if ([...this.participants.values()].some(p => p.ws === ws)) return null;
    const playerId = this.participants.has('player_1') ? 'player_2' : 'player_1';
    this.participants.set(playerId, {
      ws, playerId, name: playerName.trim(), sessionToken: randomBytes(32).toString('hex'),
      connected: true, departed: false, disconnectDeadline: null, disconnectTimer: null,
    });
    // The joining player gets one init. The host gets an updated opponent name.
    this.sendInit(playerId);
    if (this.isFull) {
      this.sendInit('player_1');
      this.startMatch();
    } else this.sendStateTick();
    return playerId;
  }

  /** Deliberate departure: no resume grace, and immediate forfeit. */
  public removePlayer(playerId: string): void {
    const p = this.participants.get(playerId);
    if (this.destroyed || !p || p.departed) return;
    this.clearDisconnectTimer(p);
    p.departed = true;
    this.setConnected(p, false);
    this.forfeit(playerId);
    this.sendStateTick();
    this.cleanUpIfEmpty();
  }

  /** Unexpected close; socket identity prevents stale closes from evicting a replacement. */
  public disconnectPlayer(playerId: string, ws: WebSocket): void {
    const p = this.participants.get(playerId);
    if (this.destroyed || !p || p.ws !== ws || !p.connected || p.departed) return;
    this.setConnected(p, false);
    p.disconnectDeadline = Date.now() + DISCONNECT_GRACE_MS;
    p.disconnectTimer = setTimeout(() => {
      p.disconnectTimer = null;
      if (this.destroyed || p.connected || p.departed) return;
      p.departed = true;
      this.forfeit(playerId);
      this.sendStateTick();
      this.cleanUpIfEmpty();
    }, DISCONNECT_GRACE_MS);
    this.sendStateTick();
  }

  public ownsSocket(playerId: string, ws: WebSocket): boolean {
    const p = this.participants.get(playerId);
    return !this.destroyed && !!p && p.ws === ws && p.connected && !p.departed;
  }

  public reconnectPlayer(playerId: string, sessionToken: string, ws: WebSocket): boolean {
    const p = this.participants.get(playerId);
    if (this.destroyed || !p || p.connected || p.departed || p.disconnectDeadline === null ||
        Date.now() >= p.disconnectDeadline || !/^[a-f0-9]{64}$/.test(sessionToken)) return false;
    if (!timingSafeEqual(Buffer.from(p.sessionToken, 'hex'), Buffer.from(sessionToken, 'hex'))) return false;
    this.clearDisconnectTimer(p);
    p.ws = ws;
    this.setConnected(p, true);
    this.sendInit(playerId);
    this.sendStateTick();
    // Restore the reveal after a mid-clash reconnect; never reveal a prior hand during DEAL.
    const last = this.engine?.lastResolution;
    if (this.engine && last && last.roundNumber === this.engine.currentRound &&
        last.exchangeNumber === this.engine.currentExchange &&
        (['CLASH_REVEAL', 'ROUND_RESOLVE'].includes(this.engine.phase) ||
          (this.engine.phase === 'MATCH_OVER' && last.matchWinnerId === this.engine.matchWinnerId))) {
      this.sendTo(playerId, { type: 'ROUND_OUTCOME', resolution: last });
    }
    return true;
  }

  public handleMessage(playerId: string, msg: ClientMessage): void {
    const p = this.participants.get(playerId);
    if (this.destroyed || !p || !p.connected || p.departed) return;
    const commandType = msg?.type;
    if (!isClientMessage(msg)) {
      this.reject(playerId, commandType === 'CMD_COMMIT_HAND' ? 'Invalid hand partition' : 'Malformed message payload');
      return;
    }
    if (msg.type === 'CMD_LEAVE_ROOM') { this.removePlayer(playerId); return; }
    if (!this.engine) { this.reject(playerId, 'Match has not started'); return; }
    const engine = this.engine;
    switch (msg.type) {
      case 'CMD_NUDGE_RANK':
      case 'CMD_BLEED_SUIT':
      case 'CMD_BURN_CAST': {
        if (engine.phase !== 'SHAPING') {
          this.reject(playerId, 'Actions only permitted during SHAPING phase'); return;
        }
        const ok = msg.type === 'CMD_NUDGE_RANK' ? engine.nudgeRank(playerId, msg.cardId, msg.direction) :
          msg.type === 'CMD_BLEED_SUIT' ? engine.bleedSuit(playerId, msg.cardId, msg.targetSuit) :
          engine.burnCard(playerId, msg.cardId);
        if (!ok) { this.reject(playerId, 'Invalid shaping action, insufficient Flux, or burn already used'); return; }
        this.sendStateTick();
        return;
      }
      case 'CMD_READY':
        if (engine.phase !== 'SHAPING') { this.reject(playerId, 'Ready only permitted during SHAPING phase'); return; }
        this.readyPlayers.add(playerId);
        if (this.readyPlayers.size === 2) this.transitionToCommitment();
        return;
      case 'CMD_COMMIT_HAND':
        if (!engine.commitHand(playerId, msg.assaultCardIds, msg.aegisCardIds, msg.stance)) {
          this.reject(playerId, 'Invalid hand partition'); return;
        }
        this.sendStateTick();
        if (engine.areBothCommitted()) this.transitionToClash();
        return;
      case 'CMD_REMATCH':
        if (engine.phase !== 'MATCH_OVER' || ![...this.participants.values()].every(p => p.connected && !p.departed)) {
          this.reject(playerId, 'Rematch requires both connected players after MATCH_OVER'); return;
        }
        this.rematchPlayers.add(playerId);
        if (this.rematchPlayers.size === 2) this.startMatch();
        return;
      default: this.reject(playerId, 'Already assigned to a room');
    }
  }

  public broadcast(msg: ServerMessage): void {
    for (const p of this.participants.values()) this.sendTo(p.playerId, msg);
  }

  public sendTo(playerId: string, msg: ServerMessage): void {
    const p = this.participants.get(playerId);
    if (!this.destroyed && p?.connected && !p.departed) this.sendSocket(p.ws, msg);
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clearPhaseTimer();
    for (const p of this.participants.values()) {
      this.clearDisconnectTimer(p);
      if (p.connected && p.ws.readyState === WebSocket.OPEN) p.ws.close(1001, 'Room closed');
    }
    this.participants.clear();
    this.readyPlayers.clear();
    this.rematchPlayers.clear();
    this.engine = null;
  }

  private sendSocket(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  private reject(playerId: string, reason: string): void {
    this.sendTo(playerId, { type: 'ERROR_REJECTED', reason });
  }

  private sendInit(playerId: string): void {
    const p = this.participants.get(playerId)!;
    const opponent = [...this.participants.values()].find(other => other.playerId !== playerId);
    this.sendTo(playerId, {
      type: 'STATE_INIT', playerId, matchId: this.id, roomCode: this.roomCode,
      opponentName: opponent?.name ?? 'Waiting...', sessionToken: p.sessionToken,
    });
  }

  private setConnected(p: RoomParticipant, connected: boolean): void {
    p.connected = connected;
    const state = this.engine?.getPlayer(p.playerId);
    if (state) state.connected = connected;
  }

  private forfeit(playerId: string): void {
    if (!this.engine || this.engine.matchWinnerId) return;
    const opponent = [...this.participants.values()].find(p => p.playerId !== playerId && !p.departed);
    this.clearPhaseTimer();
    this.engine.matchWinnerId = opponent?.playerId ?? null;
    this.engine.phase = 'MATCH_OVER';
  }

  private cleanUpIfEmpty(): void {
    if (!this.isEmpty) return;
    this.destroy();
    this.onEmpty?.();
  }

  private clearDisconnectTimer(p: RoomParticipant): void {
    if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
    p.disconnectTimer = null;
    p.disconnectDeadline = null;
  }

  private startMatch(): void {
    if (this.destroyed) return;
    const p1 = this.participants.get('player_1')!;
    const p2 = this.participants.get('player_2')!;
    this.rematchPlayers.clear();
    this.engine = new MatchEngine(p1.playerId, p1.name, p2.playerId, p2.name, new CryptoPRNG());
    this.engine.startMatch();
    this.setConnected(p1, p1.connected);
    this.setConnected(p2, p2.connected);
    this.startExchangeFlow();
  }

  private startExchangeFlow(): void {
    this.readyPlayers.clear();
    this.transitionPhase('DEAL', GAME_CONSTANTS.DEAL_TIME_MS, () => {
      this.transitionPhase('SHAPING', GAME_CONSTANTS.SHAPING_TIME_MS, () => this.transitionToCommitment());
    });
  }

  private transitionToCommitment(): void {
    this.transitionPhase('COMMITMENT', GAME_CONSTANTS.COMMITMENT_TIME_MS, () => {
      this.engine!.autoLockUncommitted();
      this.transitionToClash();
    });
  }

  private transitionToClash(): void {
    const resolution = this.engine!.resolveClash();
    this.broadcast({ type: 'ROUND_OUTCOME', resolution });
    this.transitionPhase('CLASH_REVEAL', GAME_CONSTANTS.CLASH_REVEAL_TIME_MS, () => {
      this.transitionPhase('ROUND_RESOLVE', GAME_CONSTANTS.ROUND_RESOLVE_TIME_MS, () => {
        if (this.engine!.matchWinnerId) {
          this.engine!.phase = 'MATCH_OVER';
          this.sendStateTick();
        } else {
          this.engine!.startExchange();
          this.startExchangeFlow();
        }
      });
    });
  }

  private transitionPhase(phase: GamePhase, duration: number, next: () => void): void {
    this.clearPhaseTimer();
    if (this.destroyed || !this.engine) return;
    this.engine.phase = phase;
    this.phaseEndTime = Date.now() + duration;
    this.sendStateTick();
    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      if (!this.destroyed && this.engine?.phase === phase) next();
    }, duration);
  }

  private clearPhaseTimer(): void {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = null;
    this.phaseEndTime = 0;
  }

  private sendStateTick(): void {
    const engine = this.engine;
    const players = engine?.getPublicState() ?? Object.fromEntries([...this.participants.values()].map(p => [p.playerId, {
      playerId: p.playerId, name: p.name, connected: p.connected, guardHp: 20,
      fluxRemaining: 3, roundWins: 0, hasBurnedCard: false, activeBurn: null, hasCommitted: false, activeBarrier: 0,
    }]));
    for (const p of this.participants.values()) this.sendTo(p.playerId, {
      type: 'STATE_TICK', phase: engine?.phase ?? 'LOBBY_WAIT',
      timeRemainingMs: Math.max(0, this.phaseEndTime - Date.now()),
      roundNumber: engine?.currentRound ?? 1, exchangeNumber: engine?.currentExchange ?? 1,
      players, selfCards: engine?.getPlayer(p.playerId)?.cards ?? [],
      matchWinnerId: engine?.matchWinnerId ?? null,
    });
  }
}
