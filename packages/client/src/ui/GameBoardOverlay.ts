// ============================================================================
// CYBERANTE: In-Game HUD & Tactical Controls Overlay (Option A Multi-Exchange)
// ============================================================================

import {
  Card,
  GamePhase,
  Stance,
  Suit,
  Rank,
  SUIT_GLYPHS,
  SUIT_COLORS,
  SUIT_RING,
  GAME_CONSTANTS,
  evaluateAssaultHand,
  evaluateAegisHand,
} from '@cyberante/shared';
import { sfx } from '../audio/SoundEffects';

export interface GameBoardCallbacks {
  onNudgeRank: (cardId: string, direction: 'UP' | 'DOWN') => void;
  onBleedSuit: (cardId: string, targetSuit: Suit) => void;
  onBurnCard: (cardId: string) => void;
  onCommitHand: (assaultIds: [string, string, string], aegisIds: [string, string], stance: Stance) => void;
  onToggleRules: () => void;
  onToggleCrt?: () => void;
  onReady?: () => void;
}

export class GameBoardOverlay {
  private container: HTMLElement;
  private callbacks: GameBoardCallbacks;
  private selectedStance: Stance = 'BRACE';
  private assaultCardIds: string[] = [];
  private aegisCardIds: string[] = [];
  private currentCards: Card[] = [];
  private isCrtClean: boolean = false;

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
        background: rgba(11, 19, 41, 0.85); backdrop-filter: blur(8px);
        padding: 10px 18px; border: 1px solid #1f293d; border-radius: 6px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      ">
        <div style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap;">
          <span id="player-name" style="color: #00f3ff; font-weight: bold; font-family: var(--font-display); letter-spacing: 1px; font-size: 13px;">OPERATIVE</span>
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="font-size: 11px; color: #9ca3af;">GUARD:</span>
            <span id="player-hp" style="font-family: var(--font-mono); font-size: 18px; font-weight: bold; color: #00ff66;">20</span>
          </div>
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="font-size: 11px; color: #9ca3af;">FLUX:</span>
            <span id="player-flux" style="font-family: var(--font-mono); font-size: 18px; font-weight: bold; color: #ffb700;">3/3</span>
          </div>
          <div id="player-barrier-badge" style="display: none; background: rgba(255, 183, 0, 0.2); border: 1px solid #ffb700; color: #ffb700; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-family: var(--font-mono);">
            BARRIER: <span id="player-barrier-val">0</span>
          </div>
          <div style="font-size: 11px; color: #60a5fa; font-family: var(--font-mono);">
            WINS: <span id="player-wins">0</span>
          </div>
        </div>

        <!-- Center Phase & Exchange Timer -->
        <div style="text-align: center;">
          <div id="match-progress" style="font-family: var(--font-mono); font-size: 11px; color: #60a5fa; letter-spacing: 1px;">ROUND 1 • EXCHANGE 1</div>
          <div id="phase-label" style="font-family: var(--font-display); font-size: 13px; color: #ff0055; letter-spacing: 2px;">SHAPING PHASE</div>
          <div id="timer-display" style="font-family: var(--font-mono); font-size: 22px; font-weight: bold; color: #e5e7eb;">15.0s</div>
        </div>

        <div style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap;">
          <div style="font-size: 11px; color: #f87171; font-family: var(--font-mono);">
            WINS: <span id="opponent-wins">0</span>
          </div>
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="font-size: 11px; color: #9ca3af;">OPPONENT GUARD:</span>
            <span id="opponent-hp" style="font-family: var(--font-mono); font-size: 18px; font-weight: bold; color: #ff0055;">20</span>
          </div>
          <button id="btn-toggle-crt" style="
            background: rgba(255,255,255,0.06); border: 1px solid #4b5563; color: #9ca3af;
            padding: 4px 8px; cursor: pointer; border-radius: 4px; font-family: var(--font-mono); font-size: 11px;
          ">CRT: ON</button>
          <button id="btn-toggle-rules" style="
            background: rgba(0, 243, 255, 0.15); border: 1px solid #00f3ff; color: #00f3ff;
            padding: 4px 10px; cursor: pointer; border-radius: 4px; font-weight: bold; font-size: 11px; font-family: var(--font-display);
          ">? RULES</button>
        </div>
      </div>

      <!-- Center Dynamic Banner -->
      <div id="center-banner" style="
        text-align: center; font-family: var(--font-display);
        font-size: 24px; color: #00f3ff; text-shadow: 0 0 15px rgba(0,243,255,0.6);
        pointer-events: none; min-height: 40px; display: flex; align-items: center; justify-content: center;
      "></div>

      <!-- Bottom Tactical Board -->
      <div class="interactive" style="
        background: rgba(11, 19, 41, 0.9); backdrop-filter: blur(10px);
        border: 1px solid #1f293d; border-radius: 8px; padding: 14px;
        display: flex; flex-direction: column; gap: 12px;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.5);
      ">
        <!-- Split Slots and Stance Selector -->
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; gap: 18px; align-items: center; flex-wrap: wrap;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 11px; color: #ff0055; font-family: var(--font-display); letter-spacing: 1px;">ASSAULT (3 CARDS)</span>
                <span id="assault-preview" style="font-size: 10px; color: #9ca3af; font-family: var(--font-mono); margin-left: 8px;"></span>
              </div>
              <div id="assault-slots" style="display: flex; gap: 6px; min-height: 38px;"></div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 11px; color: #00f3ff; font-family: var(--font-display); letter-spacing: 1px;">AEGIS (2 CARDS)</span>
                <span id="aegis-preview" style="font-size: 10px; color: #9ca3af; font-family: var(--font-mono); margin-left: 8px;"></span>
              </div>
              <div id="aegis-slots" style="display: flex; gap: 6px; min-height: 38px;"></div>
            </div>
            <button id="btn-auto-split" style="
              background: rgba(255, 255, 255, 0.08); border: 1px solid #6b7280; color: #e5e7eb;
              padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; font-family: var(--font-display);
            ">AUTO SPLIT</button>
          </div>

          <!-- Stance Selector -->
          <div style="display: flex; gap: 8px; align-items: center;">
            <button id="stance-brace" class="stance-btn active" style="
              background: rgba(0, 243, 255, 0.2); border: 1px solid #00f3ff; color: #00f3ff;
              padding: 8px 12px; border-radius: 4px; cursor: pointer; font-family: var(--font-display); font-size: 11px;
            ">BRACE (1x)</button>
            <button id="stance-overcharge" class="stance-btn" style="
              background: rgba(255, 0, 85, 0.1); border: 1px solid #4b5563; color: #9ca3af;
              padding: 8px 12px; border-radius: 4px; cursor: pointer; font-family: var(--font-display); font-size: 11px;
            ">OVERCHARGE (2x)</button>
            <button id="stance-parry" class="stance-btn" style="
              background: rgba(255, 183, 0, 0.1); border: 1px solid #4b5563; color: #9ca3af;
              padding: 8px 12px; border-radius: 4px; cursor: pointer; font-family: var(--font-display); font-size: 11px;
            ">PARRY (REFLECT)</button>

            <button id="btn-lock-in" style="
              background: #00f3ff; color: #030712; font-family: var(--font-display);
              font-weight: 900; font-size: 13px; letter-spacing: 2px;
              padding: 10px 22px; border: none; border-radius: 4px; cursor: pointer;
            ">LOCK IN</button>
          </div>
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

    const crtBtn = this.container.querySelector('#btn-toggle-crt');
    crtBtn?.addEventListener('click', () => {
      this.isCrtClean = !this.isCrtClean;
      document.body.classList.toggle('reduced-motion', this.isCrtClean);
      if (crtBtn) crtBtn.textContent = this.isCrtClean ? 'CRT: OFF' : 'CRT: ON';
      if (this.callbacks.onToggleCrt) this.callbacks.onToggleCrt();
    });

    const autoSplitBtn = this.container.querySelector('#btn-auto-split');
    autoSplitBtn?.addEventListener('click', () => {
      this.autoAssignSplit();
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
      } else {
        this.autoAssignSplit();
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
    cards: Card[],
    roundNumber: number = 1,
    exchangeNumber: number = 1,
    playerWins: number = 0,
    opponentWins: number = 0,
    activeBarrier: number = 0
  ): void {
    this.currentCards = cards;

    const phaseLabel = this.container.querySelector('#phase-label');
    const timerDisplay = this.container.querySelector('#timer-display');
    const playerHpEl = this.container.querySelector('#player-hp');
    const playerFluxEl = this.container.querySelector('#player-flux');
    const opponentHpEl = this.container.querySelector('#opponent-hp');
    const matchProgress = this.container.querySelector('#match-progress');
    const pWinsEl = this.container.querySelector('#player-wins');
    const oWinsEl = this.container.querySelector('#opponent-wins');
    const barrierBadge = this.container.querySelector('#player-barrier-badge') as HTMLElement;
    const barrierVal = this.container.querySelector('#player-barrier-val');

    if (matchProgress) matchProgress.textContent = `ROUND ${roundNumber}/3 • EXCHANGE ${exchangeNumber}`;
    if (phaseLabel) phaseLabel.textContent = `${phase.replace('_', ' ')}`;
    if (timerDisplay) timerDisplay.textContent = `${(timeRemainingMs / 1000).toFixed(1)}s`;
    if (playerHpEl) playerHpEl.textContent = `${playerHp}`;
    if (playerFluxEl) playerFluxEl.textContent = `${playerFlux}/3`;
    if (opponentHpEl) opponentHpEl.textContent = `${opponentHp}`;
    if (pWinsEl) pWinsEl.textContent = `${playerWins}`;
    if (oWinsEl) oWinsEl.textContent = `${opponentWins}`;

    if (barrierBadge && barrierVal) {
      if (activeBarrier > 0) {
        barrierBadge.style.display = 'inline-block';
        barrierVal.textContent = `${activeBarrier}`;
      } else {
        barrierBadge.style.display = 'none';
      }
    }

    // If new cards arrived and slots are empty or out of sync, auto-assign
    const validIds = new Set(cards.map(c => c.id));
    const isOutOfSync = !this.assaultCardIds.every(id => validIds.has(id)) || !this.aegisCardIds.every(id => validIds.has(id));
    if (this.assaultCardIds.length !== 3 || this.aegisCardIds.length !== 2 || isOutOfSync) {
      this.autoAssignSplit();
    }

    this.renderSlots();
    this.renderHand(cards, playerFlux);
  }

  public showBanner(text: string, durationMs: number = 3000): void {
    const banner = this.container.querySelector('#center-banner') as HTMLElement;
    if (banner) {
      banner.textContent = text;
      setTimeout(() => {
        if (banner.textContent === text) banner.textContent = '';
      }, durationMs);
    }
  }

  private autoAssignSplit(): void {
    if (this.currentCards.length !== 5) return;

    let bestScore = -Infinity;
    let bestAssault: string[] = [];
    let bestAegis: string[] = [];

    const cards = this.currentCards;
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        for (let k = j + 1; k < 5; k++) {
          const assaultCards: [Card, Card, Card] = [cards[i], cards[j], cards[k]];
          const aegisCards = cards.filter((_, idx) => idx !== i && idx !== j && idx !== k) as [Card, Card];

          const aEval = evaluateAssaultHand(assaultCards);
          const dEval = evaluateAegisHand(aegisCards);
          const score = aEval.baseDamage * 1.5 + dEval.mitigation;

          if (score > bestScore) {
            bestScore = score;
            bestAssault = [cards[i].id, cards[j].id, cards[k].id];
            bestAegis = [aegisCards[0].id, aegisCards[1].id];
          }
        }
      }
    }

    this.assaultCardIds = bestAssault;
    this.aegisCardIds = bestAegis;
    this.renderSlots();
    this.renderHand(this.currentCards, 3);
  }

  private toggleCardSlot(cardId: string): void {
    if (this.assaultCardIds.includes(cardId)) {
      this.assaultCardIds = this.assaultCardIds.filter(id => id !== cardId);
      if (this.aegisCardIds.length < 2) {
        this.aegisCardIds.push(cardId);
      }
    } else if (this.aegisCardIds.includes(cardId)) {
      this.aegisCardIds = this.aegisCardIds.filter(id => id !== cardId);
      if (this.assaultCardIds.length < 3) {
        this.assaultCardIds.push(cardId);
      }
    } else {
      if (this.assaultCardIds.length < 3) {
        this.assaultCardIds.push(cardId);
      } else if (this.aegisCardIds.length < 2) {
        this.aegisCardIds.push(cardId);
      }
    }

    this.renderSlots();
    this.renderHand(this.currentCards, 3);
  }

  private renderSlots(): void {
    const assaultContainer = this.container.querySelector('#assault-slots');
    const aegisContainer = this.container.querySelector('#aegis-slots');
    const assaultPreview = this.container.querySelector('#assault-preview');
    const aegisPreview = this.container.querySelector('#aegis-preview');

    if (assaultContainer) {
      assaultContainer.innerHTML = '';
      this.assaultCardIds.forEach(id => {
        const card = this.currentCards.find(c => c.id === id);
        if (card) assaultContainer.appendChild(this.createMiniCardBadge(card, '#ff0055'));
      });
    }

    if (aegisContainer) {
      aegisContainer.innerHTML = '';
      this.aegisCardIds.forEach(id => {
        const card = this.currentCards.find(c => c.id === id);
        if (card) aegisContainer.appendChild(this.createMiniCardBadge(card, '#00f3ff'));
      });
    }

    // Evaluation preview
    if (this.assaultCardIds.length === 3 && assaultPreview) {
      const cards = this.assaultCardIds.map(id => this.currentCards.find(c => c.id === id)!) as [Card, Card, Card];
      const ev = evaluateAssaultHand(cards);
      assaultPreview.textContent = `${ev.description} (${ev.baseDamage} Dmg)`;
    } else if (assaultPreview) {
      assaultPreview.textContent = `${this.assaultCardIds.length}/3`;
    }

    if (this.aegisCardIds.length === 2 && aegisPreview) {
      const cards = this.aegisCardIds.map(id => this.currentCards.find(c => c.id === id)!) as [Card, Card];
      const ev = evaluateAegisHand(cards);
      aegisPreview.textContent = `${ev.description} (${ev.mitigation} Block)`;
    } else if (aegisPreview) {
      aegisPreview.textContent = `${this.aegisCardIds.length}/2`;
    }
  }

  private createMiniCardBadge(card: Card, borderColor: string): HTMLElement {
    const el = document.createElement('div');
    const glyph = SUIT_GLYPHS[card.suit];
    const color = SUIT_COLORS[card.suit];
    const rName = this.formatRank(card.rank);

    el.style.cssText = `
      background: rgba(17, 30, 59, 0.9); border: 1px solid ${borderColor};
      border-radius: 3px; padding: 4px 8px; font-family: var(--font-mono);
      font-size: 11px; color: ${color}; font-weight: bold; cursor: pointer;
    `;
    el.textContent = `${rName}${glyph}`;
    el.title = 'Click to unassign';
    el.addEventListener('click', () => this.toggleCardSlot(card.id));
    return el;
  }

  private renderHand(cards: Card[], flux: number): void {
    const handContainer = this.container.querySelector('#hand-cards');
    if (!handContainer) return;
    handContainer.innerHTML = '';

    cards.forEach((card) => {
      const isAssault = this.assaultCardIds.includes(card.id);
      const isAegis = this.aegisCardIds.includes(card.id);
      const glyph = SUIT_GLYPHS[card.suit];
      const color = SUIT_COLORS[card.suit];
      const rName = this.formatRank(card.rank);

      const cardEl = document.createElement('div');
      const borderColor = isAssault ? '#ff0055' : (isAegis ? '#00f3ff' : '#374151');
      const shadowColor = isAssault ? 'rgba(255,0,85,0.4)' : (isAegis ? 'rgba(0,243,255,0.4)' : 'transparent');

      cardEl.style.cssText = `
        background: #0b1329; border: 2px solid ${borderColor}; border-radius: 6px;
        padding: 8px; width: 125px; display: flex; flex-direction: column;
        align-items: center; gap: 6px; box-shadow: 0 0 10px ${shadowColor};
        transition: transform 0.15s ease;
      `;

      const slotTag = isAssault ? 'ASSAULT' : (isAegis ? 'AEGIS' : 'UNASSIGNED');
      const slotColor = isAssault ? '#ff0055' : (isAegis ? '#00f3ff' : '#6b7280');

      cardEl.innerHTML = `
        <div style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 10px; color: ${slotColor}; font-family: var(--font-display); font-weight: bold;">${slotTag}</span>
          <span style="font-size: 9px; color: #6b7280; font-family: var(--font-mono);">CLICK TO SLOT</span>
        </div>

        <div class="card-face" style="cursor: pointer; display: flex; flex-direction: column; align-items: center; width: 100%; padding: 4px 0;">
          <span style="font-family: var(--font-mono); font-size: 26px; font-weight: bold; color: ${color}; line-height: 1;">
            ${rName}
          </span>
          <span style="font-size: 20px; color: ${color}; line-height: 1;">${glyph}</span>
          <span style="font-size: 10px; color: #9ca3af; font-family: var(--font-mono);">${card.suit}</span>
        </div>

        <div style="display: flex; gap: 4px; width: 100%; justify-content: center;">
          <button class="nudge-up-btn" title="Nudge Rank +1 (1 Flux)" style="
            background: #1f293d; border: 1px solid #00f3ff; color: #00f3ff;
            padding: 2px 6px; cursor: pointer; border-radius: 3px; font-size: 10px; font-family: var(--font-mono);
          ">+1</button>
          <button class="nudge-down-btn" title="Nudge Rank -1 (1 Flux)" style="
            background: #1f293d; border: 1px solid #00f3ff; color: #00f3ff;
            padding: 2px 6px; cursor: pointer; border-radius: 3px; font-size: 10px; font-family: var(--font-mono);
          ">-1</button>
          <button class="bleed-btn" title="Bleed Suit (2 Flux)" style="
            background: #1f293d; border: 1px solid #ffb700; color: #ffb700;
            padding: 2px 6px; cursor: pointer; border-radius: 3px; font-size: 10px; font-family: var(--font-mono);
          ">BLEED</button>
          <button class="burn-btn" title="Burn Card for Tactical Power" style="
            background: rgba(255,0,85,0.2); border: 1px solid #ff0055; color: #ff0055;
            padding: 2px 6px; cursor: pointer; border-radius: 3px; font-size: 10px; font-family: var(--font-display);
          ">BURN</button>
        </div>
      `;

      // Card face click toggles slot assignment
      cardEl.querySelector('.card-face')?.addEventListener('click', () => {
        sfx.playClick();
        this.toggleCardSlot(card.id);
      });

      cardEl.querySelector('.nudge-up-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        sfx.playPipNudge('UP');
        this.callbacks.onNudgeRank(card.id, 'UP');
      });

      cardEl.querySelector('.nudge-down-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        sfx.playPipNudge('DOWN');
        this.callbacks.onNudgeRank(card.id, 'DOWN');
      });

      cardEl.querySelector('.bleed-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const adjacent = SUIT_RING[card.suit];
        // Bleed to first adjacent suit
        const nextSuit = adjacent[0];
        sfx.playSuitBleed();
        this.callbacks.onBleedSuit(card.id, nextSuit);
      });

      cardEl.querySelector('.burn-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        sfx.playBurn();
        this.callbacks.onBurnCard(card.id);
      });

      handContainer.appendChild(cardEl);
    });
  }

  private formatRank(rank: Rank): string {
    switch (rank) {
      case 14: return 'A';
      case 13: return 'K';
      case 12: return 'Q';
      case 11: return 'J';
      default: return rank.toString();
    }
  }

  public show(): void {
    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }
}
