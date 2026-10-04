// ============================================================================
// CYBERANTE: Client Master Entry & Mode Orchestrator
// ============================================================================

import { VectorScene } from './render/VectorScene';
import { MainMenuOverlay } from './ui/MainMenuOverlay';
import { GameBoardOverlay } from './ui/GameBoardOverlay';
import { RulesModal } from './ui/RulesModal';
import { TutorialManager } from './tutorial/TutorialManager';
import { SoloMatchSession } from './game/SoloMatchSession';
import { NetworkClient } from './net/NetworkClient';
import { musicPlayer } from './audio/ProceduralMusic';
import { masterAudio } from './audio/AudioEngine';
import { sfx } from './audio/SoundEffects';
import {
  Stance,
  Suit,
  BotPersonality,
  ServerMessage,
  RoundResolution,
} from '@cyberante/shared';

class CyberanteGame {
  private scene: VectorScene;
  private mainMenu: MainMenuOverlay;
  private gameBoard: GameBoardOverlay;
  private rulesModal: RulesModal;
  private tutorial: TutorialManager;
  private networkClient: NetworkClient;

  // Local game state for Offline Solo Mode
  private isSoloMode: boolean = false;
  private soloSession: SoloMatchSession | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | undefined;
  private deadline = 0;
  private mode: 'menu' | 'solo' | 'online' | 'tutorial' = 'menu';
  private generation = 0;
  private joinTimer: ReturnType<typeof setTimeout> | undefined;
  private joined = false;
  private selfPlayerId: string = 'player';
  private previousHand = '';
  private previousPhase = '';

  constructor() {
    const uiRoot = document.getElementById('ui-overlay') || document.getElementById('ui-root') || document.body;

    // Initialize 3D Vector Scene
    this.scene = new VectorScene('canvas-container');

    // Initialize Rules Modal
    this.rulesModal = new RulesModal(uiRoot);

    // Initialize Tutorial
    this.tutorial = new TutorialManager(uiRoot, () => {
      this.returnToMenu();
    });

    // Initialize Network Client
    this.networkClient = new NetworkClient();
    this.setupNetworkHandlers();

    // Initialize Game Board HUD
    this.gameBoard = new GameBoardOverlay(uiRoot, {
      onNudgeRank: (cardId, dir) => this.handleNudge(cardId, dir),
      onBleedSuit: (cardId, suit) => this.handleBleed(cardId, suit),
      onBurnCard: (cardId) => this.handleBurn(cardId),
      onCommitHand: (assault, aegis, stance) => this.handleCommit(assault, aegis, stance),
      onToggleRules: () => this.rulesModal.toggle(),
      onToggleCrt: () => {},
      onReady: () => {
        if (this.isSoloMode) this.soloSession?.ready();
        else this.networkClient.send({ type: 'CMD_READY' });
      },
      onRematch: () => {
        if (this.isSoloMode) this.soloSession?.rematch();
        else this.networkClient.send({ type: 'CMD_REMATCH' });
      },
      onExit: () => this.returnToMenu(),
    });

    // Initialize Main Menu
    this.mainMenu = new MainMenuOverlay(uiRoot, {
      onStartSolo: (profile) => {
        this.unlockAudio();
        this.startSoloMatch(profile);
      },
      onCreateMultiplayer: (name) => this.createMultiplayerMatch(name),
      onJoinMultiplayer: (code, name) => this.joinMultiplayerMatch(code, name),
      onToggleRules: () => this.rulesModal.toggle(),
      onStartTutorial: () => this.startTutorial(),
    });
    uiRoot.addEventListener('pointerdown', () => {
      this.unlockAudio();
      if (this.mode === 'solo' || this.mode === 'online') musicPlayer.start();
    });
    if (this.networkClient.hasSession) this.resumeMultiplayerMatch();
  }

  private resumeMultiplayerMatch(): void {
    this.mode = 'online';
    this.mainMenu.hide();
    this.gameBoard.show();
    this.gameBoard.setConnected(false);
    this.startCountdown();
    // Transport recovery owns retries and its thirty-second deadline.
    void this.networkClient.connect().catch(() => {});
  }

  private unlockAudio(): void {
    masterAudio.init();
    masterAudio.resume();
  }

  private startTutorial(): void {
    this.unlockAudio();
    this.returnToMenu();
    this.mode = 'tutorial';
    this.mainMenu.hide();
    this.tutorial.start();
  }

  // --------------------------------------------------------------------------
  // Solo Mode (Offline Deterministic MatchEngine)
  // --------------------------------------------------------------------------
  private startSoloMatch(profile: BotPersonality = 'CIPHER_ZERO'): void {
    this.returnToMenu();
    this.isSoloMode = true;
    this.mode = 'solo';
    this.selfPlayerId = 'player';
    this.mainMenu.hide();
    this.gameBoard.show();
    this.gameBoard.setConnected(true);
    musicPlayer.start();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    this.soloSession = new SoloMatchSession(profile, seed, message => this.handleMessage(message));
    this.soloSession.start();
    this.startCountdown();
  }

  private returnToMenu(): void {
    this.generation++;
    this.mode = 'menu';
    this.joined = false;
    clearTimeout(this.joinTimer);
    this.soloSession?.destroy();
    this.soloSession = null;
    this.networkClient.disconnect();
    clearInterval(this.countdownTimer);
    this.countdownTimer = undefined;
    this.isSoloMode = false;
    this.gameBoard.resetView();
    this.previousHand = '';
    this.previousPhase = '';
    this.deadline = 0;
    this.gameBoard.hide();
    this.tutorial.hide();
    this.rulesModal.hide();
    musicPlayer.stop();
    this.mainMenu.show();
  }

  private startCountdown(): void {
    clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      this.gameBoard.updateCountdown(this.deadline ? Math.max(0, this.deadline - Date.now()) : 0);
    }, 100);
  }

  // --------------------------------------------------------------------------
  // Multiplayer Mode (WebSockets)
  // --------------------------------------------------------------------------
  private createMultiplayerMatch(playerName: string): void {
    this.unlockAudio();
    this.startMultiplayerMatch('', playerName);
  }

  private joinMultiplayerMatch(roomCode: string, playerName: string): void {
    this.unlockAudio();
    this.startMultiplayerMatch(roomCode, playerName);
  }

  private startMultiplayerMatch(roomCode: string, playerName: string): void {
    this.returnToMenu();
    this.isSoloMode = false;
    this.mode = 'online';
    const generation = this.generation;
    this.mainMenu.hide();
    this.gameBoard.show();
    this.gameBoard.setConnected(false);
    musicPlayer.start();

    this.startCountdown();
    this.joinTimer = setTimeout(() => {
      if (this.mode !== 'online' || generation !== this.generation || this.joined) return;
      this.returnToMenu();
      this.mainMenu.showError('The room did not respond. Please try again.');
    }, 10000);
    this.networkClient.connect().then(() => {
      if (this.mode !== 'online' || generation !== this.generation) return;
      if (roomCode) this.networkClient.joinRoom(roomCode, playerName);
      else this.networkClient.createRoom(playerName);
    }).catch((err) => {
      if (this.mode !== 'online' || generation !== this.generation) return;
      this.returnToMenu();
      this.mainMenu.showError(`Could not connect: ${err.message}`);
    });
  }

  private setupNetworkHandlers(): void {
    this.networkClient.on('status', status => {
      if (this.mode !== 'online') return;
      this.gameBoard.setConnected(status === 'connected');
      if (status === 'reconnecting') this.gameBoard.showBanner('Connection lost • reconnecting…', 0);
      else if (status === 'connected') this.gameBoard.showBanner('Connected');
      else if (status === 'sessionExpired') {
        this.returnToMenu();
        this.mainMenu.showError('Your room session expired. Join or host another room.');
      }
    });
    this.networkClient.onMessage(message => {
      if (this.mode === 'online') this.handleMessage(message);
    });
  }

  private handleMessage(msg: ServerMessage): void {
    if (msg.type === 'STATE_INIT') {
      clearTimeout(this.joinTimer);
      this.joined = true;
      this.gameBoard.setRoom(msg.roomCode);
      this.selfPlayerId = msg.playerId;
      this.gameBoard.showBanner(`MATCH READY • ROOM ${msg.roomCode}`);
    } else if (msg.type === 'STATE_TICK') {
      const self = msg.players[this.selfPlayerId];
      const opponent = Object.values(msg.players).find(p => p.playerId !== this.selfPlayerId);
      if (self) {
        const hand = JSON.stringify(msg.selfCards);
        if (msg.phase === 'SHAPING' && this.previousPhase === 'SHAPING' && hand !== this.previousHand) {
          this.scene.triggerSparks(0, 0, 0x00f3ff);
        }
        this.previousHand = hand;
        this.previousPhase = msg.phase;
        this.gameBoard.setNames(self.name, opponent?.name ?? 'Waiting for opponent', opponent?.connected ?? true);
        this.deadline = msg.timeRemainingMs ? Date.now() + msg.timeRemainingMs : 0;
        this.gameBoard.updateState(msg.phase, msg.timeRemainingMs, self.guardHp,
          self.fluxRemaining, opponent?.guardHp ?? 20, msg.selfCards,
          msg.roundNumber, msg.exchangeNumber, self.roundWins, opponent?.roundWins ?? 0,
          self.activeBarrier);
        this.gameBoard.setControls(msg.phase, self.hasCommitted, self.hasBurnedCard);
        if (msg.phase === 'MATCH_OVER') {
          this.gameBoard.showBanner(msg.matchWinnerId === this.selfPlayerId ? 'MATCH VICTORY!' : 'MATCH DEFEAT!', 0);
        }
      }
      musicPlayer.setPhase(msg.phase);
    } else if (msg.type === 'ROUND_OUTCOME') {
      this.handleClashOutcome(msg.resolution);
    } else if (msg.type === 'ERROR_REJECTED') {
      if (this.mode === 'online' && !this.joined) {
        this.returnToMenu();
        this.mainMenu.showError(msg.reason);
        return;
      }
      this.gameBoard.showBanner(`ERROR: ${msg.reason}`);
    }
  }

  private handleClashOutcome(resolution: RoundResolution): void {
    this.gameBoard.showResolution(resolution, this.selfPlayerId);
    this.scene.triggerShockwave(0, 0, 2.0);
    this.scene.triggerSparks(0, 0, 0x00f3ff);
    sfx.playClashDamage(Math.max(resolution.p1NetDamageReceived, resolution.p2NetDamageReceived));

    const isP1 = resolution.p1PlayerId
      ? this.selfPlayerId === resolution.p1PlayerId
      : (this.selfPlayerId === 'player' || this.selfPlayerId === 'p1');
    const myDamageDealt = isP1 ? resolution.p1RawDamage : resolution.p2RawDamage;
    const myDamageTaken = isP1 ? resolution.p1NetDamageReceived : resolution.p2NetDamageReceived;

    let banner = `CLASH RESOLVED! DEALT: ${myDamageDealt} | RECEIVED: ${myDamageTaken}`;
    if (resolution.matchWinnerId) {
      banner = resolution.matchWinnerId === this.selfPlayerId ? 'MATCH VICTORY!' : 'MATCH DEFEAT!';
    } else if (resolution.isRoundOver) {
      banner = resolution.roundWinnerId === this.selfPlayerId ? 'ROUND WON!' : 'ROUND LOST!';
    }

    this.gameBoard.showBanner(banner, 4000);
  }

  // --------------------------------------------------------------------------
  // User Tactical Actions
  // --------------------------------------------------------------------------
  private handleNudge(cardId: string, direction: 'UP' | 'DOWN'): void {
    if (this.isSoloMode) {
      this.soloSession?.nudgeRank(cardId, direction);
    } else this.networkClient.send({ type: 'CMD_NUDGE_RANK', cardId, direction });
  }

  private handleBleed(cardId: string, targetSuit: Suit): void {
    if (this.isSoloMode) {
      this.soloSession?.bleedSuit(cardId, targetSuit);
    } else this.networkClient.send({ type: 'CMD_BLEED_SUIT', cardId, targetSuit });
  }

  private handleBurn(cardId: string): void {
    if (this.isSoloMode) {
      this.soloSession?.burnCard(cardId);
    } else this.networkClient.send({ type: 'CMD_BURN_CAST', cardId });
  }

  private handleCommit(assault: [string, string, string], aegis: [string, string], stance: Stance): void {
    if (this.isSoloMode) this.soloSession?.commitHand(assault, aegis, stance);
    else this.networkClient.send({ type: 'CMD_COMMIT_HAND', assaultCardIds: assault, aegisCardIds: aegis, stance });
  }

}

// Bootstrap application once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  new CyberanteGame();
});
