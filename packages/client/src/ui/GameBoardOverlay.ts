// ============================================================================
// CYBERANTE: In-Game HUD & Tactical Controls Overlay
// ============================================================================

import { Card, GamePhase, Stance, Suit } from '@cyberante/shared';
import { sfx } from '../audio/SoundEffects';

export interface GameBoardCallbacks {
  onNudgeRank: (cardId: string, direction: 'UP' | 'DOWN') => void;
  onBleedSuit: (cardId: string, targetSuit: Suit) => void;
  onBurnCard: (cardId: string) => void;
  onCommitHand: (assaultIds: [string, string, string], aegisIds: [string, string], stance: Stance) => void;
  onToggleRules: () => void;
}

export class GameBoardOverlay {
  private container: HTMLElement;
  private callbacks: GameBoardCallbacks;
  private selectedStance: Stance = 'BRACE';
  private assaultCardIds: string[] = [];
  private aegisCardIds: string[] = [];

  constructor(parent: HTMLElement, callbacks: GameBoardCallbacks) {
    this.callbacks = callbacks;
    this.container = document.createElement('div');
    this.container.id = 'game-board-overlay';
    this.container.style.cssText = `
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      display: none; flex-direction: column;
      justify-content: space-between;
      padding: 16px;
      pointer-events: none;
    `;

    this.container.innerHTML = `
      <!-- Top Status Bar -->
      <div class="interactive" style="
        display: flex; justify-content: space-between; align-items: center;
        background: rgba(11, 19, 41, 0.7); backdrop-filter: blur(6px);
        padding: 10px 20px; border: 1px solid #1f293d; border-radius: 6px;
      ">
        <div style="display: flex; gap: 16px; align-items: center;">
          <span id="player-name" style="color: #00f3ff; font-weight: bold; letter-spacing: 1px;">OPERATIVE (YOU)</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 12px; color: #9ca3af;">GUARD:</span>
            <span id="player-hp" style="font-family: 'Share Tech Mono', monospace; font-size: 18px; color: #00ff66;">20</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 12px; color: #9ca3af;">FLUX:</span>
            <span id="player-flux" style="font-family: 'Share Tech Mono', monospace; font-size: 18px; color: #ffb700;">3/3</span>
          </div>
        </div>

        <!-- Center Phase Timer -->
        <div style="text-align: center;">
          <div id="phase-label" style="font-family: 'Orbitron', sans-serif; font-size: 13px; color: #ff0055; letter-spacing: 2px;">SHAPING PHASE</div>
          <div id="timer-display" style="font-family: 'Share Tech Mono', monospace; font-size: 22px; font-weight: bold; color: #e5e7eb;">15.0s</div>
        </div>

        <div style="display: flex; gap: 16px; align-items: center;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 12px; color: #9ca3af;">OPPONENT GUARD:</span>
            <span id="opponent-hp" style="font-family: 'Share Tech Mono', monospace; font-size: 18px; color: #ff0055;">20</span>
          </div>
          <button id="btn-toggle-rules" style="
            background: rgba(0, 243, 255, 0.15); border: 1px solid #00f3ff; color: #00f3ff;
            padding: 4px 10px; cursor: pointer; border-radius: 4px; font-weight: bold; font-size: 12px;
          ">? RULES</button>
        </div>
      </div>

      <!-- Center Dynamic Banner -->
      <div id="center-banner" style="
        text-align: center; font-family: 'Orbitron', sans-serif;
        font-size: 24px; color: #00f3ff; text-shadow: 0 0 15px rgba(0,243,255,0.6);
        pointer-events: none;
      "></div>

      <!-- Bottom Tactical Board -->
      <div class="interactive" style="
        background: rgba(11, 19, 41, 0.85); backdrop-filter: blur(8px);
        border: 1px solid #1f293d; border-radius: 8px; padding: 14px;
        display: flex; flex-direction: column; gap: 12px;
      ">
        <!-- Split Slots and Stance Selector -->
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; gap: 16px;">
            <div>
              <span style="font-size: 11px; color: #ff0055; letter-spacing: 1px;">ASSAULT LINE (3 CARDS)</span>
              <div id="assault-slots" style="display: flex; gap: 6px; margin-top: 4px; min-height: 38px;"></div>
            </div>
            <div>
              <span style="font-size: 11px; color: #00f3ff; letter-spacing: 1px;">AEGIS LINE (2 CARDS)</span>
              <div id="aegis-slots" style="display: flex; gap: 6px; margin-top: 4px; min-height: 38px;"></div>
            </div>
          </div>

          <!-- Stance Selector -->
          <div style="display: flex; gap: 8px;">
            <button id="stance-brace" class="stance-btn active" style="
              background: rgba(0, 243, 255, 0.2); border: 1px solid #00f3ff; color: #00f3ff;
              padding: 8px 14px; border-radius: 4px; cursor: pointer; font-family: 'Orbitron', sans-serif; font-size: 11px;
            ">BRACE</button>
            <button id="stance-overcharge" class="stance-btn" style="
              background: rgba(255, 0, 85, 0.1); border: 1px solid #4b5563; color: #9ca3af;
              padding: 8px 14px; border-radius: 4px; cursor: pointer; font-family: 'Orbitron', sans-serif; font-size: 11px;
            ">OVERCHARGE</button>
            <button id="stance-parry" class="stance-btn" style="
              background: rgba(255, 183, 0, 0.1); border: 1px solid #4b5563; color: #9ca3af;
              padding: 8px 14px; border-radius: 4px; cursor: pointer; font-family: 'Orbitron', sans-serif; font-size: 11px;
            ">PARRY</button>
          </div>

          <button id="btn-lock-in" style="
            background: #00f3ff; color: #030712; font-family: 'Orbitron', sans-serif;
            font-weight: 900; font-size: 13px; letter-spacing: 2px;
            padding: 10px 24px; border: none; border-radius: 4px; cursor: pointer;
          ">LOCK IN</button>
        </div>

        <!-- Hand Cards Container -->
        <div id="hand-cards" style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;"></div>
      </div>
    `;

    parent.appendChild(this.container);
    this.bindEvents();
  }

  private bindEvents(): void {
    const rulesBtn = this.container.querySelector('#btn-toggle-rules');
    rulesBtn?.addEventListener('click', () => {
      sfx.playClick();
      this.callbacks.onToggleRules();
    });

    const setStance = (stance: Stance) => {
      this.selectedStance = stance;
      sfx.playStanceSelect(stance);

      const buttons = this.container.querySelectorAll('.stance-btn');
      buttons.forEach(btn => {
        (btn as HTMLElement).style.borderColor = '#4b5563';
        (btn as HTMLElement).style.color = '#9ca3af';
      });

      const activeBtn = this.container.querySelector(`#stance-${stance.toLowerCase()}`) as HTMLElement;
      if (activeBtn) {
        activeBtn.style.borderColor = stance === 'OVERCHARGE' ? '#ff0055' : (stance === 'PARRY' ? '#ffb700' : '#00f3ff');
        activeBtn.style.color = stance === 'OVERCHARGE' ? '#ff0055' : (stance === 'PARRY' ? '#ffb700' : '#00f3ff');
      }
    };

    this.container.querySelector('#stance-brace')?.addEventListener('click', () => setStance('BRACE'));
    this.container.querySelector('#stance-overcharge')?.addEventListener('click', () => setStance('OVERCHARGE'));
    this.container.querySelector('#stance-parry')?.addEventListener('click', () => setStance('PARRY'));

    this.container.querySelector('#btn-lock-in')?.addEventListener('click', () => {
      if (this.assaultCardIds.length === 3 && this.aegisCardIds.length === 2) {
        sfx.playClick();
        this.callbacks.onCommitHand(
          [this.assaultCardIds[0], this.assaultCardIds[1], this.assaultCardIds[2]],
          [this.aegisCardIds[0], this.aegisCardIds[1]],
          this.selectedStance
        );
      }
    });
  }

  public updateState(
    phase: GamePhase,
    timeRemainingMs: number,
    playerHp: number,
    playerFlux: number,
    opponentHp: number,
    cards: Card[]
  ): void {
    const phaseLabel = this.container.querySelector('#phase-label');
    const timerDisplay = this.container.querySelector('#timer-display');
    const playerHpEl = this.container.querySelector('#player-hp');
    const playerFluxEl = this.container.querySelector('#player-flux');
    const opponentHpEl = this.container.querySelector('#opponent-hp');

    if (phaseLabel) phaseLabel.textContent = `${phase.replace('_', ' ')}`;
    if (timerDisplay) timerDisplay.textContent = `${(timeRemainingMs / 1000).toFixed(1)}s`;
    if (playerHpEl) playerHpEl.textContent = `${playerHp}`;
    if (playerFluxEl) playerFluxEl.textContent = `${playerFlux}/3`;
    if (opponentHpEl) opponentHpEl.textContent = `${opponentHp}`;

    // Render cards if count changed or initializing
    this.renderHand(cards);
  }

  private renderHand(cards: Card[]): void {
    const handContainer = this.container.querySelector('#hand-cards');
    if (!handContainer) return;
    handContainer.innerHTML = '';

    cards.forEach((card) => {
      const cardEl = document.createElement('div');
      cardEl.style.cssText = `
        background: #111e3b; border: 1px solid #00f3ff; border-radius: 4px;
        padding: 8px; width: 110px; display: flex; flex-direction: column;
        align-items: center; gap: 4px;
      `;

      cardEl.innerHTML = `
        <span style="font-family: 'Share Tech Mono', monospace; font-weight: bold; color: #00f3ff;">
          ${card.rank} of ${card.suit}
        </span>
        <div style="display: flex; gap: 4px; margin-top: 4px;">
          <button class="nudge-up-btn" style="background:#1f293d; border:1px solid #00f3ff; color:#00f3ff; padding:2px 6px; cursor:pointer;">+1</button>
          <button class="nudge-down-btn" style="background:#1f293d; border:1px solid #00f3ff; color:#00f3ff; padding:2px 6px; cursor:pointer;">-1</button>
          <button class="burn-btn" style="background:#ff0055; border:none; color:#fff; padding:2px 6px; cursor:pointer;">BURN</button>
        </div>
      `;

      cardEl.querySelector('.nudge-up-btn')?.addEventListener('click', () => {
        sfx.playPipNudge('UP');
        this.callbacks.onNudgeRank(card.id, 'UP');
      });
      cardEl.querySelector('.nudge-down-btn')?.addEventListener('click', () => {
        sfx.playPipNudge('DOWN');
        this.callbacks.onNudgeRank(card.id, 'DOWN');
      });
      cardEl.querySelector('.burn-btn')?.addEventListener('click', () => {
        sfx.playBurn();
        this.callbacks.onBurnCard(card.id);
      });

      handContainer.appendChild(cardEl);
    });
  }

  public show(): void {
    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }
}
