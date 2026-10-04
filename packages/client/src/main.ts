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
import { Card, GamePhase, Stance, Suit } from '@cyberante/shared';

class CyberanteGame {
  private scene: VectorScene;
  private mainMenu: MainMenuOverlay;
  private gameBoard: GameBoardOverlay;
  private rulesModal: RulesModal;
  private tutorial: TutorialManager;
  private botAI: ClassicalBotAI;
  private networkClient: NetworkClient;

  // Local game state for Solo Mode
  private isSoloMode: boolean = false;
  private localCards: Card[] = [];
  private localHp: number = 20;
  private localFlux: number = 3;
  private opponentHp: number = 20;

  constructor() {
    const uiRoot = document.getElementById('ui-root') || document.body;

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
    });

    // Initialize Main Menu
    this.mainMenu = new MainMenuOverlay(uiRoot, {
      onPlaySolo: () => this.startSoloMatch(),
      onPlayMultiplayer: (code) => this.startMultiplayerMatch(code),
      onStartTutorial: () => this.tutorial.start(),
    });
  }

  private startSoloMatch(): void {
    this.isSoloMode = true;
    this.localHp = 20;
    this.localFlux = 3;
    this.opponentHp = 20;

    // Sample initial 5-card hand for offline solo mode
    this.localCards = [
      { id: 'c1', suit: 'SPADES', rank: 14 },
      { id: 'c2', suit: 'SPADES', rank: 13 },
      { id: 'c3', suit: 'CLUBS', rank: 12 },
      { id: 'c4', suit: 'HEARTS', rank: 8 },
      { id: 'c5', suit: 'DIAMONDS', rank: 8 },
    ];

    this.gameBoard.show();
    musicPlayer.setPhase('SHAPING');
    this.gameBoard.updateState('SHAPING', 15000, this.localHp, this.localFlux, this.opponentHp, this.localCards);
  }

  private startMultiplayerMatch(roomCode: string): void {
    this.isSoloMode = false;
    this.gameBoard.show();
    this.networkClient.connect(roomCode, 'Operative').catch((err) => {
      alert(`Could not connect to multiplayer server: ${err.message}. Defaulting to Solo Mode.`);
      this.startSoloMatch();
    });
  }

  private setupNetworkHandlers(): void {
    this.networkClient.onMessage((msg) => {
      if (msg.type === 'STATE_TICK') {
        const myPublic = Object.values(msg.players)[0];
        const oppPublic = Object.values(msg.players)[1];

        this.gameBoard.updateState(
          msg.phase,
          msg.timeRemainingMs,
          myPublic ? myPublic.guardHp : 20,
          myPublic ? myPublic.fluxRemaining : 3,
          oppPublic ? oppPublic.guardHp : 20,
          msg.selfCards
        );
        musicPlayer.setPhase(msg.phase);
      } else if (msg.type === 'ROUND_OUTCOME') {
        this.scene.triggerShockwave(0, 0, 2.0);
        this.scene.triggerSparks(0, 0, 0xff0055);
      }
    });
  }

  private handleNudge(cardId: string, direction: 'UP' | 'DOWN'): void {
    if (this.isSoloMode) {
      if (this.localFlux < 1) return;
      const c = this.localCards.find(card => card.id === cardId);
      if (c) {
        c.rank = direction === 'UP' ? (c.rank === 14 ? 2 : ((c.rank + 1) as any)) : (c.rank === 2 ? 14 : ((c.rank - 1) as any));
        this.localFlux -= 1;
        this.gameBoard.updateState('SHAPING', 12000, this.localHp, this.localFlux, this.opponentHp, this.localCards);
      }
    } else {
      this.networkClient.send({ type: 'CMD_NUDGE_RANK', cardId, direction });
    }
  }

  private handleBleed(cardId: string, targetSuit: Suit): void {
    if (!this.isSoloMode) {
      this.networkClient.send({ type: 'CMD_BLEED_SUIT', cardId, targetSuit });
    }
  }

  private handleBurn(cardId: string): void {
    if (!this.isSoloMode) {
      this.networkClient.send({ type: 'CMD_BURN_CAST', cardId });
    }
  }

  private handleCommit(assault: [string, string, string], aegis: [string, string], stance: Stance): void {
    if (this.isSoloMode) {
      this.scene.triggerShockwave(0, 0, 1.5);
      this.scene.triggerSparks(0, 0, 0x00f3ff);
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
