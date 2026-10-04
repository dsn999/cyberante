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
    this.localEngine = new MatchEngine('player', 'Operative', 'bot', 'CIPHER-0');
    this.localEngine.startMatch();

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
      // 1. Commit player hand
      this.localEngine.commitHand('player', assault, aegis, stance);

      // 2. Evaluate bot hand & tactical decisions
      const botState = this.localEngine.getPlayer('bot')!;
      const playerState = this.localEngine.getPlayer('player')!;

      const botDecision = this.botAI.evaluateHand(
        botState.cards,
        botState.guardHp,
        playerState.guardHp,
        botState.fluxRemaining,
        !botState.hasBurnedCard
      );

      // Apply bot burn
      if (botDecision.burnCardId) {
        this.localEngine.burnCard('bot', botDecision.burnCardId);
      }

      // Apply bot nudges
      for (const act of botDecision.fluxActions) {
        if (act.type === 'NUDGE' && act.direction) {
          this.localEngine.nudgeRank('bot', act.cardId, act.direction);
        }
      }

      // Re-evaluate partitions with current post-burn/nudge cards
      const finalBotDecision = (botDecision.burnCardId || botDecision.fluxActions.length > 0)
        ? this.botAI.evaluateHand(botState.cards, botState.guardHp, playerState.guardHp, 0, false)
        : botDecision;

      // Commit bot hand
      const botCommitOk = this.localEngine.commitHand(
        'bot',
        finalBotDecision.assaultCardIds,
        finalBotDecision.aegisCardIds,
        finalBotDecision.stance
      );
      if (!botCommitOk) {
        this.localEngine.autoLockUncommitted();
      }

      // 3. Resolve Clash!
      const outcome = this.localEngine.resolveClash();
      this.handleClashOutcome(outcome);
      this.updateSoloBoard();

      // Automatically advance to next exchange after 3.5s
      setTimeout(() => {
        if (this.localEngine && !this.localEngine.matchWinnerId) {
          this.localEngine.startExchange();
          this.updateSoloBoard();
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
