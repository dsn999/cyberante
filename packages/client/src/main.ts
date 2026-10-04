// ============================================================================
// CYBERANTE: Client Master Entry & Mode Orchestrator
// ============================================================================

import { VectorScene } from './render/VectorScene';
import { MainMenuOverlay } from './ui/MainMenuOverlay';
import { GameBoardOverlay } from './ui/GameBoardOverlay';
import { RulesModal } from './ui/RulesModal';
import { TutorialManager } from './tutorial/TutorialManager';
import { ClassicalBotAI } from './ai/ClassicalBotAI';
import { NetworkClient } from './net/NetworkClient';
import { musicPlayer } from './audio/ProceduralMusic';
import { masterAudio } from './audio/AudioEngine';
import {
  Card,
  GamePhase,
  Stance,
  Suit,
  MatchEngine,
  SeededPRNG,
  RoundResolution,
} from '@cyberante/shared';

class CyberanteGame {
  private scene: VectorScene;
  private mainMenu: MainMenuOverlay;
  private gameBoard: GameBoardOverlay;
  private rulesModal: RulesModal;
  private tutorial: TutorialManager;
  private botAI: ClassicalBotAI;
  private networkClient: NetworkClient;

  // Local game state for Offline Solo Mode
  private isSoloMode: boolean = false;
  private localEngine: MatchEngine | null = null;
  private localTimerId: number | null = null;
  private selfPlayerId: string = 'player';

  constructor() {
    const uiRoot = document.getElementById('ui-overlay') || document.getElementById('ui-root') || document.body;

    // Initialize 3D Vector Scene
    this.scene = new VectorScene('canvas-container');

    // Initialize Rules Modal
    this.rulesModal = new RulesModal(uiRoot);

    // Initialize Tutorial
    this.tutorial = new TutorialManager(uiRoot, () => {
      this.mainMenu.show();
    });

    // Initialize Classical Bot AI
    this.botAI = new ClassicalBotAI('CIPHER_ZERO');

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
    });

    // Initialize Main Menu
    this.mainMenu = new MainMenuOverlay(uiRoot, {
      onPlaySolo: () => {
        this.unlockAudio();
        this.startSoloMatch();
      },
      onPlayMultiplayer: (code) => {
        this.unlockAudio();
        this.startMultiplayerMatch(code);
      },
      onStartTutorial: () => {
        this.unlockAudio();
        this.tutorial.start();
      },
    });
  }

  private unlockAudio(): void {
    masterAudio.init();
    masterAudio.resume();
  }

  // --------------------------------------------------------------------------
  // Solo Mode (Offline Deterministic MatchEngine)
  // --------------------------------------------------------------------------
  private startSoloMatch(): void {
    this.isSoloMode = true;
    this.selfPlayerId = 'player';
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    this.botAI = new ClassicalBotAI('CIPHER_ZERO', new SeededPRNG(seed ^ 0x9e3779b9));
    this.localEngine = new MatchEngine('player', 'Operative', 'bot', 'CIPHER-0', new SeededPRNG(seed));
    this.localEngine.startMatch();
    this.localEngine.phase = 'SHAPING';

    this.mainMenu.hide();
    this.gameBoard.show();
    musicPlayer.start();
    musicPlayer.setPhase('SHAPING');

    this.updateSoloBoard();
  }

  private updateSoloBoard(): void {
    if (!this.localEngine) return;

    const p1 = this.localEngine.getPlayer('player')!;
    const p2 = this.localEngine.getPlayer('bot')!;

    this.gameBoard.updateState(
      this.localEngine.phase,
      15000,
      p1.guardHp,
      p1.fluxRemaining,
      p2.guardHp,
      p1.cards,
      this.localEngine.currentRound,
      this.localEngine.currentExchange,
      p1.roundWins,
      p2.roundWins,
      p1.activeBarrier
    );
  }

  // --------------------------------------------------------------------------
  // Multiplayer Mode (WebSockets)
  // --------------------------------------------------------------------------
  private startMultiplayerMatch(roomCode: string): void {
    this.isSoloMode = false;
    this.mainMenu.hide();
    this.gameBoard.show();
    musicPlayer.start();

    this.networkClient.connect(roomCode, 'Operative').catch((err) => {
      alert(`Could not connect to multiplayer server: ${err.message}. Defaulting to Solo Mode.`);
      this.startSoloMatch();
    });
  }

  private setupNetworkHandlers(): void {
    this.networkClient.onMessage((msg) => {
      if (msg.type === 'STATE_INIT') {
        this.selfPlayerId = msg.playerId;
        this.gameBoard.showBanner(`MATCH READY • ROOM ${msg.roomCode}`);
      } else if (msg.type === 'STATE_TICK') {
        const myPublic = msg.players[this.selfPlayerId];
        const oppPublic = Object.values(msg.players).find(p => p.playerId !== this.selfPlayerId);

        if (myPublic) {
          this.gameBoard.updateState(
            msg.phase,
            msg.timeRemainingMs,
            myPublic.guardHp,
            myPublic.fluxRemaining,
            oppPublic ? oppPublic.guardHp : 20,
            msg.selfCards,
            msg.roundNumber,
            msg.exchangeNumber,
            myPublic.roundWins,
            oppPublic ? oppPublic.roundWins : 0,
            myPublic.activeBarrier
          );
        }
        musicPlayer.setPhase(msg.phase);
      } else if (msg.type === 'ROUND_OUTCOME') {
        this.handleClashOutcome(msg.resolution);
      } else if (msg.type === 'ERROR_REJECTED') {
        this.gameBoard.showBanner(`ERROR: ${msg.reason}`);
      }
    });
  }

  private handleClashOutcome(resolution: RoundResolution): void {
    this.scene.triggerShockwave(0, 0, 2.0);
    this.scene.triggerSparks(0, 0, 0x00f3ff);

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
    if (this.isSoloMode && this.localEngine) {
      const ok = this.localEngine.nudgeRank('player', cardId, direction);
      if (ok) this.updateSoloBoard();
    } else {
      this.networkClient.send({ type: 'CMD_NUDGE_RANK', cardId, direction });
    }
  }

  private handleBleed(cardId: string, targetSuit: Suit): void {
    if (this.isSoloMode && this.localEngine) {
      const ok = this.localEngine.bleedSuit('player', cardId, targetSuit);
      if (ok) this.updateSoloBoard();
    } else {
      this.networkClient.send({ type: 'CMD_BLEED_SUIT', cardId, targetSuit });
    }
  }

  private handleBurn(cardId: string): void {
    if (this.isSoloMode && this.localEngine) {
      const ok = this.localEngine.burnCard('player', cardId);
      if (ok) this.updateSoloBoard();
    } else {
      this.networkClient.send({ type: 'CMD_BURN_CAST', cardId });
    }
  }

  private handleCommit(assault: [string, string, string], aegis: [string, string], stance: Stance): void {
    if (this.isSoloMode && this.localEngine) {
      if (this.localEngine.phase !== 'SHAPING' && this.localEngine.phase !== 'COMMITMENT') return;
      const botState = this.localEngine.getPlayer('bot')!;
      const playerState = this.localEngine.getPlayer('player')!;

      // Bot shaping finishes before either hand is committed.
      if (this.localEngine.phase === 'SHAPING') {
        const decision = this.botAI.evaluateHand(botState.cards, botState.guardHp,
          playerState.guardHp, botState.fluxRemaining, !botState.hasBurnedCard);
        if (decision.burnCardId) this.localEngine.burnCard('bot', decision.burnCardId);
        for (const act of decision.fluxActions) {
          // A proposed nudge on a burned card is obsolete after its replacement draw.
          if (!botState.cards.some(card => card.id === act.cardId)) continue;
          if (act.type === 'NUDGE' && act.direction) this.localEngine.nudgeRank('bot', act.cardId, act.direction);
          if (act.type === 'BLEED' && act.targetSuit) this.localEngine.bleedSuit('bot', act.cardId, act.targetSuit);
        }
        this.localEngine.phase = 'COMMITMENT';
      }
      if (!this.localEngine.commitHand('player', assault, aegis, stance)) {
        this.gameBoard.showBanner('Invalid hand commitment');
        this.updateSoloBoard();
        return;
      }
      const finalDecision = this.botAI.evaluateHand(botState.cards, botState.guardHp, playerState.guardHp, 0, false);
      if (!this.localEngine.commitHand('bot', finalDecision.assaultCardIds, finalDecision.aegisCardIds, finalDecision.stance)) {
        this.localEngine.autoLockUncommitted();
      }

      // 3. Resolve Clash!
      const outcome = this.localEngine.resolveClash();
      this.handleClashOutcome(outcome);
      this.updateSoloBoard();

      // Automatically advance to next exchange after 3.5s
      setTimeout(() => {
        if (this.localEngine && !this.localEngine.matchWinnerId) {
          this.localEngine.phase = 'ROUND_RESOLVE';
          this.localEngine.startExchange();
          this.localEngine.phase = 'SHAPING';
          this.updateSoloBoard();
        } else if (this.localEngine) {
          this.localEngine.phase = 'MATCH_OVER';
        }
      }, 3500);
    } else {
      this.networkClient.send({
        type: 'CMD_COMMIT_HAND',
        assaultCardIds: assault,
        aegisCardIds: aegis,
        stance,
      });
    }
  }
}

// Bootstrap application once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  new CyberanteGame();
});
