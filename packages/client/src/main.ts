import './ui/ui.css';
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
import { masterAudio } from './audio/AudioEngine';
import {
  Stance,
  Suit,
  BotPersonality,
  ServerMessage,
  RoundResolution,
  Card,
  SUIT_COLORS,
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
  private previousCards: readonly Card[] = [];
  private previousPhase = '';
  private announcedWinner: string | undefined;
  private clashKey = '';

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
      onSelectionChange: () => {
        if (this.mode === 'tutorial' && this.tutorial.currentStepIndex === 0) this.tutorial.onUserAction('COMMIT_HAND');
      },
      onStanceSelect: stance => {
        if (this.mode === 'tutorial') this.tutorial.onUserAction('SELECT_STANCE', { stance });
      },
      onToggleRules: () => this.rulesModal.toggle(),
      onToggleCrt: () => { this.scene.toggleCrt(); },
      onToggleReducedMotion: () => { this.scene.toggleReducedMotion(); },
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

    this.scene.setCardViewport(document.getElementById('arena-preview')!);
    this.tutorial.readSelection = () => this.gameBoard.selectedHand;
    this.tutorial.onStateChange = state => {
      this.gameBoard.setTrainingLesson(state.stepIndex + 1);
      this.gameBoard.show(); this.gameBoard.setConnected(true);
      const phase = state.complete ? 'CLASH_REVEAL' : state.stepIndex === 3 ? 'COMMITMENT' : 'SHAPING';
      this.gameBoard.updateState(phase, 0, state.resolution?.p1HpRemaining ?? 20, state.flux,
        state.resolution?.p2HpRemaining ?? 20, state.cards, 1, state.stepIndex + 1, 0, 0, state.barrier);
      this.gameBoard.setControls(phase, state.complete, state.burn !== null);
      this.gameBoard.setNames('Training Operative', 'Training Drone', true);
      if (state.stepIndex === 0) this.gameBoard.clearHandSelection();
      this.scene.setCards(state.cards);
      masterAudio.music.setPhase(phase);
    };
    this.tutorial.onClash = resolution => {
      this.selfPlayerId = 'training-player'; this.handleClashOutcome(resolution);
      document.getElementById('clash-reveal')?.scrollIntoView({ block: 'center', behavior: 'auto' });
    };

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
      onToggleCrt: () => { this.scene.toggleCrt(); },
      onToggleReducedMotion: () => { this.scene.toggleReducedMotion(); },
    });
    uiRoot.addEventListener('pointerdown', () => {
      this.unlockAudio();
      if (this.mode === 'solo' || this.mode === 'online' || this.mode === 'tutorial') masterAudio.music.start();
    });
    window.addEventListener('pagehide', event => { if (!event.persisted) this.scene.destroy(); });
    if (this.networkClient.hasSession) this.resumeMultiplayerMatch();
  }

  private resumeMultiplayerMatch(): void {
    this.mode = 'online';
    this.scene.setTitleMode(false);
    this.mainMenu.hide();
    this.gameBoard.show();
    this.gameBoard.setConnected(false);
    this.startCountdown();
    // Transport recovery owns retries and its thirty-second deadline.
    void this.networkClient.connect().catch(() => {});
  }

  private unlockAudio(): void {
    masterAudio.init();
    void masterAudio.resume();
  }

  private startTutorial(): void {
    this.unlockAudio();
    this.returnToMenu();
    this.mode = 'tutorial';
    this.scene.setTitleMode(false);
    this.mainMenu.hide();
    this.tutorial.start();
    masterAudio.music.start();
  }

  // --------------------------------------------------------------------------
  // Solo Mode (Offline Deterministic MatchEngine)
  // --------------------------------------------------------------------------
  private startSoloMatch(profile: BotPersonality = 'CIPHER_ZERO'): void {
    this.returnToMenu();
    this.isSoloMode = true;
    this.mode = 'solo';
    this.scene.setTitleMode(false);
    this.selfPlayerId = 'player';
    this.mainMenu.hide();
    this.gameBoard.show();
    this.gameBoard.setConnected(true);
    masterAudio.music.start();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    this.soloSession = new SoloMatchSession(profile, seed, message => this.handleMessage(message));
    this.soloSession.start();
    this.startCountdown();
  }

  private returnToMenu(): void {
    this.generation++;
    this.mode = 'menu';
    this.scene.setTitleMode(true);
    this.scene.particles?.clear();
    this.joined = false;
    clearTimeout(this.joinTimer);
    this.soloSession?.destroy();
    this.soloSession = null;
    this.networkClient.disconnect();
    clearInterval(this.countdownTimer);
    this.countdownTimer = undefined;
    this.isSoloMode = false;
    this.gameBoard.setTrainingLesson(null);
    this.gameBoard.resetView();
    this.previousHand = '';
    this.previousCards = [];
    this.previousPhase = '';
    this.announcedWinner = undefined;
    this.clashKey = '';
    this.deadline = 0;
    this.gameBoard.hide();
    this.tutorial.hide();
    this.rulesModal.hide();
    masterAudio.music.stop();
    masterAudio.music.setPhase('LOBBY_WAIT');
    masterAudio.sfx.stop();
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
    this.scene.setTitleMode(false);
    const generation = this.generation;
    this.mainMenu.hide();
    this.gameBoard.show();
    this.gameBoard.setConnected(false);
    masterAudio.music.start();

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
      if (msg.phase === 'DEAL') {
        this.announcedWinner = undefined;
        if (this.previousPhase === 'MATCH_OVER') this.clashKey = '';
      }
      const self = msg.players[this.selfPlayerId];
      const opponent = Object.values(msg.players).find(p => p.playerId !== this.selfPlayerId);
      if (self) {
        const hand = JSON.stringify(msg.selfCards);
        if (msg.phase === 'SHAPING' && this.previousPhase === 'SHAPING' && hand !== this.previousHand) {
          const retired = this.previousCards.find(old => !msg.selfCards.some(card => card.id === old.id));
          if (retired) {
            const pos = this.cardPosition(retired.id);
            this.scene.triggerBurn(pos.x, pos.y, Number.parseInt(SUIT_COLORS[retired.suit].slice(1), 16));
          } else for (const card of msg.selfCards) {
            const old = this.previousCards.find(previous => previous.id === card.id);
            if (old && (old.rank !== card.rank || old.suit !== card.suit)) {
              const pos = this.cardPosition(card.id);
              this.scene.triggerSparks(pos.x, pos.y, Number.parseInt(SUIT_COLORS[card.suit].slice(1), 16));
            }
          }
        }
        this.previousHand = hand;
        this.previousCards = msg.selfCards;
        if (!['CLASH_REVEAL', 'ROUND_RESOLVE', 'MATCH_OVER'].includes(msg.phase)) this.scene.setCards(msg.selfCards);
        this.previousPhase = msg.phase;
        this.gameBoard.setNames(self.name, opponent?.name ?? 'Waiting for opponent', opponent?.connected ?? true);
        this.deadline = msg.timeRemainingMs ? Date.now() + msg.timeRemainingMs : 0;
        this.gameBoard.updateState(msg.phase, msg.timeRemainingMs, self.guardHp,
          self.fluxRemaining, opponent?.guardHp ?? 20, msg.selfCards,
          msg.roundNumber, msg.exchangeNumber, self.roundWins, opponent?.roundWins ?? 0,
          self.activeBarrier);
        this.gameBoard.setControls(msg.phase, self.hasCommitted, self.hasBurnedCard);
        this.gameBoard.setRematchAvailable(this.mode === 'solo' || Boolean(opponent?.connected));
        if (msg.phase === 'MATCH_OVER') {
          this.gameBoard.showBanner(msg.matchWinnerId === this.selfPlayerId ? 'MATCH VICTORY!' : 'MATCH DEFEAT!', 0);
          this.announceMatch(msg.matchWinnerId);
        }
      }
      masterAudio.music.setPhase(msg.phase);
    } else if (msg.type === 'ROUND_OUTCOME') {
      this.handleClashOutcome(msg.resolution);
    } else if (msg.type === 'ERROR_REJECTED') {
      if (this.mode === 'online' && !this.joined) {
        this.returnToMenu();
        this.mainMenu.showError(msg.reason);
        return;
      }
      this.gameBoard.clearPendingActions();
      this.gameBoard.showBanner(`ERROR: ${msg.reason}`);
    }
  }

  private handleClashOutcome(resolution: RoundResolution): void {
    this.gameBoard.showResolution(resolution, this.selfPlayerId);
    const isSelfP1 = resolution.p1PlayerId === this.selfPlayerId;
    const ownCards = isSelfP1 ? [...resolution.p1Assault, ...resolution.p1Aegis] : [...resolution.p2Assault, ...resolution.p2Aegis];
    const opponentCards = isSelfP1 ? [...resolution.p2Assault, ...resolution.p2Aegis] : [...resolution.p1Assault, ...resolution.p1Aegis];
    this.scene.setCards(ownCards, opponentCards);
    const clashKey = `${resolution.roundNumber}:${resolution.exchangeNumber}`;
    if (this.clashKey !== clashKey) {
      this.clashKey = clashKey;
      this.scene.triggerClashExplosion(resolution.p1Stance, resolution.p2Stance,
        Math.max(resolution.p1NetDamageReceived, resolution.p2NetDamageReceived) / 10 + 0.5);
      masterAudio.sfx.playClashLaser();
      if (Math.max(resolution.p1NetDamageReceived, resolution.p2NetDamageReceived) > 0) {
        masterAudio.sfx.playDamageImpact(resolution.p1HpRemaining <= 0 || resolution.p2HpRemaining <= 0);
      }
    }
    this.announceMatch(resolution.matchWinnerId);

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

  private cardPosition(cardId: string): { x: number; y: number } {
    const face = Array.from(document.querySelectorAll<HTMLElement>('.card-face')).find(element => element.dataset.cardId === cardId);
    if (!face) return { x: 0, y: 0 };
    const rect = face.getBoundingClientRect();
    return this.scene.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  private announceMatch(winnerId: string | null | undefined): void {
    if (!winnerId || winnerId === this.announcedWinner) return;
    this.announcedWinner = winnerId;
    if (winnerId === this.selfPlayerId) masterAudio.sfx.playVictory();
    else masterAudio.sfx.playDefeat();
  }

  // --------------------------------------------------------------------------
  // User Tactical Actions
  // --------------------------------------------------------------------------
  private handleNudge(cardId: string, direction: 'UP' | 'DOWN'): void {
    if (this.mode === 'tutorial') {
      const before = this.tutorial.state.cards.find(card => card.id === cardId)?.rank;
      this.tutorial.onUserAction('NUDGE_RANK', { cardId, direction });
      if (this.tutorial.state.cards.find(card => card.id === cardId)?.rank !== before) {
        const pos = this.cardPosition(cardId); this.scene.triggerSparks(pos.x, pos.y);
      }
      return;
    }
    if (this.isSoloMode) {
      this.soloSession?.nudgeRank(cardId, direction);
    } else this.networkClient.send({ type: 'CMD_NUDGE_RANK', cardId, direction });
  }

  private handleBleed(cardId: string, targetSuit: Suit): void {
    if (this.mode === 'tutorial') { this.tutorial.onUserAction('BLEED_SUIT', { cardId, targetSuit }); return; }
    if (this.isSoloMode) {
      this.soloSession?.bleedSuit(cardId, targetSuit);
    } else this.networkClient.send({ type: 'CMD_BLEED_SUIT', cardId, targetSuit });
  }

  private handleBurn(cardId: string): void {
    if (this.mode === 'tutorial') {
      const card = this.tutorial.state.cards.find(card => card.id === cardId);
      const pos = this.cardPosition(cardId);
      this.tutorial.onUserAction('BURN_CARD', { cardId });
      if (card && !this.tutorial.state.cards.some(current => current.id === cardId)) this.scene.triggerBurn(pos.x, pos.y, Number.parseInt(SUIT_COLORS[card.suit].slice(1), 16));
      return;
    }
    if (this.isSoloMode) {
      this.soloSession?.burnCard(cardId);
    } else this.networkClient.send({ type: 'CMD_BURN_CAST', cardId });
  }

  private handleCommit(assault: [string, string, string], aegis: [string, string], stance: Stance): void {
    if (this.mode === 'tutorial') { this.tutorial.onUserAction('COMMIT_HAND', { assaultIds: assault, aegisIds: aegis, stance }); return; }
    if (this.isSoloMode) this.soloSession?.commitHand(assault, aegis, stance);
    else this.networkClient.send({ type: 'CMD_COMMIT_HAND', assaultCardIds: assault, aegisCardIds: aegis, stance });
  }

}

// Bootstrap application once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  new CyberanteGame();
});
