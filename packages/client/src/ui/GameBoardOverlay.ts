import {
  type Card, type GamePhase, type Stance, type Suit, type Rank, type RoundResolution, type PlayerPublicState,
  SUIT_GLYPHS, SUIT_COLORS, SUIT_RING, GAME_CONSTANTS, evaluateAssaultHand, evaluateAegisHand,
} from '@cyberante/shared';
import { masterAudio } from '../audio/AudioEngine';
import { HandSelection } from './HandSelection';

export interface GameBoardCallbacks {
  onNudgeRank: (cardId: string, direction: 'UP' | 'DOWN') => void;
  onBleedSuit: (cardId: string, targetSuit: Suit) => void;
  onBurnCard: (cardId: string) => void;
  onCommitHand: (assaultIds: [string, string, string], aegisIds: [string, string], stance: Stance) => void;
  onSelectionChange?: (assaultIds: string[], aegisIds: string[]) => void;
  onStanceSelect?: (stance: Stance) => void;
  onReady?: () => void;
  onToggleRules: () => void;
  onToggleCrt?: () => void;
  onToggleReducedMotion?: () => void;
  onToggleMute?: () => void;
  onRematch?: () => void;
  onExit?: () => void;
}

export class GameBoardOverlay {
  private readonly container: HTMLElement;
  private readonly selection = new HandSelection();
  private selectedStance: Stance = 'BRACE';
  private phase: GamePhase = 'LOBBY_WAIT';
  private committed = false;
  private burned = false;
  private connected = true;
  private flux = 0;
  private exchangeKey = '';
  private readySent = false;
  private rematchSent = false;
  private rematchAvailable = true;
  private bannerTimer: ReturnType<typeof setTimeout> | undefined;
  private viewGeneration = 0;
  private trainingLesson: number | null = null;

  constructor(parent: HTMLElement, private readonly callbacks: GameBoardCallbacks) {
    this.container = document.createElement('section');
    this.container.id = 'game-board-overlay';
    this.container.className = 'screen';
    this.container.hidden = true;
    this.container.setAttribute('aria-label', 'Tactical game board');
    this.container.innerHTML = `
      <nav class="game-toolbar" aria-label="Game settings">
        <span id="match-progress">ROUND 1/3 • EXCHANGE 1</span>
        <button id="btn-toggle-rules">RULES</button>
        <button id="btn-toggle-crt" aria-pressed="true">CRT: ON</button>
        <button id="btn-toggle-motion" aria-pressed="false">MOTION: FULL</button>
        <button id="btn-toggle-mute" aria-pressed="false">AUDIO: ON</button>
        <button id="btn-exit">MAIN MENU</button>
      </nav>
      <header class="scoreboard panel">
        <div class="player-stats">
          <span id="player-name" class="name">OPERATIVE</span>
          <progress id="player-hp-bar" value="20" max="20" aria-label="Your Guard HP"></progress>
          <div class="stats-values"><span>GUARD <strong id="player-hp">20</strong></span><span>FLUX <strong id="player-flux">3/3</strong></span><span>WINS <strong id="player-wins">0</strong></span></div>
          <span id="player-barrier-badge" hidden>BARRIER <strong id="player-barrier-val">0</strong></span>
        </div>
        <div class="phase-clock"><div id="phase-label">LOBBY WAIT</div><div id="timer-display" role="timer" aria-label="Phase time remaining">0.0s</div></div>
        <div class="player-stats opponent">
          <span id="opponent-name" class="name">Waiting for opponent</span>
          <progress id="opponent-hp-bar" value="20" max="20" aria-label="Opponent Guard HP"></progress>
          <div class="stats-values"><span>GUARD <strong id="opponent-hp">20</strong></span><span>WINS <strong id="opponent-wins">0</strong></span></div>
          <span id="opponent-activity" role="status" aria-live="polite" hidden></span>
        </div>
      </header>
      <div class="room-actions"><span id="room-code"></span><button id="btn-copy-code" hidden>COPY CODE</button><button id="btn-copy-link" hidden>COPY JOIN LINK</button><button id="btn-rematch" hidden>REMATCH</button></div>
      <div id="center-banner" class="display-glow" role="status" aria-live="polite"></div>
      <div id="arena-preview" aria-hidden="true"><span class="arena-label">THE BLIND CLASH</span></div>
      <div id="clash-reveal" class="panel" aria-label="Clash results"></div>
      <section class="tactical-board panel" aria-label="Your cards and combat stance">
        <h1 id="local-dock-name">YOUR HAND</h1>
        <div class="lanes">
          <section class="lane" aria-label="Assault lane"><h2>ASSAULT · 3 CARDS</h2><div id="assault-preview" class="lane-preview"></div><div id="assault-slots" class="lane-slots"></div></section>
          <section class="lane aegis" aria-label="Aegis lane"><h2>AEGIS · 2 CARDS</h2><div id="aegis-preview" class="lane-preview"></div><div id="aegis-slots" class="lane-slots"></div></section>
        </div>
        <p id="selection-hint" role="status" aria-live="polite">Select a card, then a card in the opposite lane to swap. Select a lane badge to unassign.</p>
        <div id="hand-cards" aria-label="Five-card hand"></div>
        <div class="stance-grid" role="group" aria-label="Combat stance">
          <button id="stance-brace" class="stance-btn" aria-pressed="true"><strong>BRACE · 1×</strong><small>Full Aegis mitigation.</small></button>
          <button id="stance-overcharge" class="stance-btn" aria-pressed="false"><strong>OVERCHARGE · 2×</strong><small>Forfeit your Aegis mitigation.</small></button>
          <button id="stance-parry" class="stance-btn" aria-pressed="false"><strong>PARRY · ½×</strong><small>Reflect 50% against Overcharge, Pair or High Card.</small></button>
        </div>
        <div class="commit-row"><button id="btn-auto-split">AUTO SPLIT</button><button id="btn-ready" hidden>READY FOR COMMITMENT</button><button id="btn-lock-in" class="primary" disabled>LOCK IN</button></div>
      </section>`;
    parent.appendChild(this.container);
    this.bindEvents();
    this.renderSelection();
    this.syncPreferences();
  }

  private element<T extends HTMLElement = HTMLElement>(id: string): T {
    return this.container.querySelector<T>(`#${id}`)!;
  }
  private text(id: string, value: string): void { this.element(id).textContent = value; }
  private canSelect(): boolean { return this.connected && !this.committed && (this.phase === 'SHAPING' || this.phase === 'COMMITMENT'); }
  private canShape(): boolean { return this.canSelect() && this.phase === 'SHAPING'; }

  private bindEvents(): void {
    this.element('btn-toggle-rules').addEventListener('click', () => { masterAudio.sfx.playClick(); this.callbacks.onToggleRules(); });
    this.element('btn-toggle-crt').addEventListener('click', () => {
      if (this.callbacks.onToggleCrt) this.callbacks.onToggleCrt();
      else document.body.classList.toggle('clean-display');
      this.syncPreferences();
    });
    this.element('btn-toggle-motion').addEventListener('click', () => {
      if (this.callbacks.onToggleReducedMotion) this.callbacks.onToggleReducedMotion();
      else document.body.classList.toggle('reduced-motion');
      this.syncPreferences();
    });
    document.addEventListener('visualsettingschange', () => this.syncPreferences());
    this.element('btn-toggle-mute').addEventListener('click', () => {
      if (this.callbacks.onToggleMute) this.callbacks.onToggleMute();
      else masterAudio.toggleMute();
      this.syncPreferences();
    });
    this.element('btn-exit').addEventListener('click', () => this.callbacks.onExit?.());
    this.element('btn-ready').addEventListener('click', () => {
      if (!this.canShape() || this.readySent) return;
      this.readySent = true;
      this.updateControls();
      this.callbacks.onReady?.();
    });
    this.element('btn-rematch').addEventListener('click', () => {
      if (!this.connected || this.phase !== 'MATCH_OVER' || this.rematchSent || !this.rematchAvailable) return;
      this.rematchSent = true;
      this.updateControls();
      this.callbacks.onRematch?.();
      if (this.phase === 'MATCH_OVER') this.showBanner('Rematch requested • waiting for opponent', 0);
    });
    this.element('btn-auto-split').addEventListener('click', () => {
      if (!this.canSelect()) return;
      this.selection.autoSplit();
      this.renderSelection();
      this.notifySelection();
    });
    for (const stance of ['BRACE', 'OVERCHARGE', 'PARRY'] as const) {
      this.element(`stance-${stance.toLowerCase()}`).addEventListener('click', () => {
        if (!this.canSelect()) return;
        this.selectedStance = stance;
        masterAudio.sfx.playStanceSelect(stance);
        this.updateControls();
        this.callbacks.onStanceSelect?.(stance);
      });
    }
    this.element('btn-lock-in').addEventListener('click', () => {
      if (!this.canSelect() || this.phase !== 'COMMITMENT' || !this.selection.valid) return;
      masterAudio.sfx.playClick();
      this.callbacks.onCommitHand([...this.selection.assaultIds] as [string, string, string], [...this.selection.aegisIds] as [string, string], this.selectedStance);
    });
    this.element('hand-cards').addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!button || button.disabled) return;
      const card = this.selection.cards.find(card => card.id === button.dataset.cardId);
      if (!card) return;
      if (button.dataset.action === 'slot') {
        if (!this.canSelect()) return;
        this.selection.toggle(card.id); masterAudio.sfx.playCardSelect(); this.renderSelection(); this.notifySelection();
      } else if (this.canShape()) {
        const action = button.dataset.action;
        if (action === 'up' && this.flux >= 1) { masterAudio.sfx.playPipNudge('UP'); this.callbacks.onNudgeRank(card.id, 'UP'); }
        if (action === 'down' && this.flux >= 1) { masterAudio.sfx.playPipNudge('DOWN'); this.callbacks.onNudgeRank(card.id, 'DOWN'); }
        if (action === 'bleed' && this.flux >= 2) {
          const suit = button.dataset.suit as Suit;
          if (SUIT_RING[card.suit].includes(suit)) { masterAudio.sfx.playSuitBleed(); this.callbacks.onBleedSuit(card.id, suit); }
        }
        if (action === 'burn' && !this.burned) { masterAudio.sfx.playBurn(); this.callbacks.onBurnCard(card.id); }
      }
    });
    for (const id of ['assault-slots', 'aegis-slots']) this.element(id).addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!this.canSelect() || !button?.dataset.cardId) return;
      this.selection.remove(button.dataset.cardId);
      this.renderSelection();
      this.notifySelection();
    });
  }

  public updateState(phase: GamePhase, timeRemainingMs: number, playerHp: number, playerFlux: number, opponentHp: number, cards: Card[], roundNumber = 1, exchangeNumber = 1, playerWins = 0, opponentWins = 0, activeBarrier = 0): void {
    const key = `${roundNumber}/${exchangeNumber}`;
    if (key !== this.exchangeKey || (phase === 'DEAL' && this.phase !== 'DEAL')) this.resetHandSelection();
    this.exchangeKey = key;
    if (phase !== this.phase) { this.readySent = false; if (phase !== 'MATCH_OVER') this.rematchSent = false; }
    this.phase = phase;
    this.flux = playerFlux;
    this.selection.setCards(cards);
    this.text('match-progress', this.trainingLesson === null ? `ROUND ${roundNumber}/3 • EXCHANGE ${exchangeNumber}` : `TRAINING • LESSON ${this.trainingLesson}/4`);
    this.text('phase-label', phase.replaceAll('_', ' '));
    this.text('player-hp', String(playerHp)); this.text('opponent-hp', String(opponentHp));
    this.element<HTMLProgressElement>('player-hp-bar').value = playerHp;
    this.element<HTMLProgressElement>('opponent-hp-bar').value = opponentHp;
    this.text('player-flux', `${playerFlux}/${GAME_CONSTANTS.STARTING_FLUX}`);
    this.text('player-wins', String(playerWins)); this.text('opponent-wins', String(opponentWins));
    this.element('player-barrier-badge').hidden = activeBarrier <= 0;
    this.text('player-barrier-val', String(activeBarrier));
    this.renderSelection();
    this.updateCountdown(timeRemainingMs);
  }

  public updateCountdown(timeRemainingMs: number): void {
    const time = Math.max(0, timeRemainingMs);
    this.text('timer-display', `${(time / 1000).toFixed(1)}s`);
    this.element('btn-lock-in').classList.toggle('urgent', this.phase === 'COMMITMENT' && time > 0 && time <= 3000);
  }
  public setControls(phase: GamePhase, committed: boolean, burned: boolean): void {
    this.phase = phase; this.committed = committed; this.burned = burned; this.updateControls();
  }
  public setConnected(connected: boolean): void { this.connected = connected; this.updateControls(); }
  public setRematchAvailable(available: boolean): void { this.rematchAvailable = available; this.updateControls(); }
  public clearPendingActions(): void { this.readySent = false; this.rematchSent = false; this.updateControls(); }

  private updateControls(): void {
    const disable = (selector: string, disabled: boolean) => this.container.querySelectorAll<HTMLButtonElement>(selector).forEach(button => button.disabled = disabled);
    disable('.card-face,.slot-card,.stance-btn,#btn-auto-split', !this.canSelect());
    disable('.nudge-up-btn,.nudge-down-btn', !this.canShape() || this.flux < 1);
    disable('.bleed-btn', !this.canShape() || this.flux < 2);
    disable('.burn-btn', !this.canShape() || this.burned);
    disable('#btn-lock-in', !this.canSelect() || this.phase !== 'COMMITMENT' || !this.selection.valid);
    disable('#btn-ready', !this.canShape() || this.readySent);
    disable('#btn-rematch', !this.connected || this.rematchSent || !this.rematchAvailable);
    this.element('btn-ready').hidden = this.trainingLesson !== null || this.phase !== 'SHAPING' || !this.callbacks.onReady;
    this.element('btn-rematch').hidden = this.phase !== 'MATCH_OVER' || !this.callbacks.onRematch;
    for (const stance of ['BRACE', 'OVERCHARGE', 'PARRY']) this.element(`stance-${stance.toLowerCase()}`).setAttribute('aria-pressed', String(this.selectedStance === stance));
    this.text('btn-ready', this.readySent ? 'READY • WAITING' : 'READY FOR COMMITMENT');
    this.text('btn-lock-in', this.committed ? 'COMMITTED' : 'LOCK IN');
  }

  private renderSelection(): void {
    const active = document.activeElement as HTMLElement | null;
    const focusKey = this.container.contains(active) ? active?.dataset.focusKey : undefined;
    const oldCardId = active?.dataset.cardId;
    const oldIndex = Array.from(this.element('hand-cards').querySelectorAll<HTMLElement>('.hand-card')).findIndex(card => card.dataset.cardId === oldCardId);
    const renderLane = (id: string, ids: string[], size: number) => {
      const lane = this.element(id); lane.replaceChildren();
      for (let index = 0; index < size; index++) {
        const card = this.selection.cards.find(card => card.id === ids[index]);
        if (!card) { const empty = document.createElement('span'); empty.className = 'slot-empty'; empty.textContent = '+'; lane.append(empty); continue; }
        const badge = document.createElement('button'); badge.className = 'slot-card';
        badge.dataset.cardId = card.id; badge.dataset.focusKey = `${card.id}:badge`;
        badge.textContent = `${this.formatRank(card.rank)}${SUIT_GLYPHS[card.suit]}`;
        badge.style.color = SUIT_COLORS[card.suit];
        badge.setAttribute('aria-label', `Unassign ${this.cardName(card)} from ${id.startsWith('assault') ? 'Assault' : 'Aegis'}`);
        lane.append(badge);
      }
    };
    renderLane('assault-slots', this.selection.assaultIds, 3); renderLane('aegis-slots', this.selection.aegisIds, 2);
    const assault = this.selection.assaultIds.map(id => this.selection.cards.find(card => card.id === id)!).filter(Boolean);
    const aegis = this.selection.aegisIds.map(id => this.selection.cards.find(card => card.id === id)!).filter(Boolean);
    this.text('assault-preview', assault.length === 3 ? `${evaluateAssaultHand(assault as [Card, Card, Card]).description} • ${evaluateAssaultHand(assault as [Card, Card, Card]).baseDamage} DMG` : `${assault.length}/3 selected`);
    this.text('aegis-preview', aegis.length === 2 ? `${evaluateAegisHand(aegis as [Card, Card]).description} • ${evaluateAegisHand(aegis as [Card, Card]).mitigation} BLOCK` : `${aegis.length}/2 selected`);
    this.text('selection-hint', this.selection.pendingSwap ? 'Select a card in the opposite lane to swap, or select this card again to cancel.' : 'Select opposite-lane cards to swap; select a lane badge to unassign. Nudge: 1 Flux. Bleed: 2 Flux.');
    const hand = this.element('hand-cards'); hand.replaceChildren();
    for (const card of this.selection.cards) {
      const lane = this.selection.assaultIds.includes(card.id) ? 'assault' : this.selection.aegisIds.includes(card.id) ? 'aegis' : 'unassigned';
      const node = document.createElement('article'); node.className = 'hand-card'; node.dataset.lane = lane; node.dataset.cardId = card.id;
      const face = this.cardButton(card, 'slot', '', `Select ${this.cardName(card)}, ${lane}`);
      face.className = 'card-face'; face.setAttribute('aria-pressed', String(this.selection.pendingSwap === card.id));
      for (const [className, text] of [['lane-label', lane.toUpperCase()], ['rank', this.formatRank(card.rank)], ['suit', SUIT_GLYPHS[card.suit]], ['suit-name', card.suit]]) {
        const label = document.createElement('span'); label.className = className; label.textContent = text;
        if (className === 'rank' || className === 'suit') label.style.color = SUIT_COLORS[card.suit]; face.append(label);
      }
      const actions = document.createElement('div'); actions.className = 'card-actions';
      const up = this.cardButton(card, 'up', '+1', `Increase ${this.cardName(card)} rank, 1 Flux`); up.className = 'nudge-up-btn';
      const down = this.cardButton(card, 'down', '−1', `Decrease ${this.cardName(card)} rank, 1 Flux`); down.className = 'nudge-down-btn';
      actions.append(up, down);
      for (const suit of SUIT_RING[card.suit]) {
        const bleed = this.cardButton(card, 'bleed', `BLEED ${SUIT_GLYPHS[suit]}`, `Bleed ${this.cardName(card)} to ${suit.toLowerCase()}, 2 Flux`, suit);
        bleed.className = 'bleed-btn'; actions.append(bleed);
      }
      const burn = this.cardButton(card, 'burn', 'BURN', `Burn ${this.cardName(card)}, once per exchange`); burn.className = 'burn-btn'; actions.append(burn);
      node.append(face, actions); hand.append(node);
    }
    this.updateControls();
    if (focusKey) {
      const buttons = Array.from(this.container.querySelectorAll<HTMLButtonElement>('button'));
      const same = buttons.find(button => button.dataset.focusKey === focusKey);
      const fallback = buttons.find(button => button.dataset.cardId === oldCardId && button.dataset.action === 'slot')
        ?? this.element('hand-cards').querySelectorAll<HTMLButtonElement>('.card-face')[Math.max(0, oldIndex)];
      const target = same && !same.disabled ? same : fallback;
      if (target && !target.disabled) target.focus({ preventScroll: true });
    }
  }
  private cardButton(card: Card, action: string, text: string, label: string, suit?: Suit): HTMLButtonElement {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
    button.dataset.cardId = card.id; button.dataset.action = action; button.dataset.focusKey = `${card.id}:${action}:${suit ?? ''}`;
    if (suit) button.dataset.suit = suit;
    button.setAttribute('aria-label', label); button.title = label;
    return button;
  }
  private formatRank(rank: Rank): string { return ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[rank] ?? String(rank); }
  private cardName(card: Card): string { return `${({ 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' } as Record<number, string>)[card.rank] ?? card.rank} of ${card.suit.toLowerCase()}`; }

  public resetHandSelection(): void {
    clearTimeout(this.bannerTimer); this.selection.reset(); this.selectedStance = 'BRACE'; this.committed = false; this.burned = false;
    this.readySent = false; this.rematchSent = false; this.text('center-banner', ''); this.text('clash-reveal', ''); this.renderSelection();
  }
  private notifySelection(): void { this.callbacks.onSelectionChange?.([...this.selection.assaultIds], [...this.selection.aegisIds]); }
  public clearHandSelection(): void { this.selection.assaultIds = []; this.selection.aegisIds = []; this.selection.pendingSwap = null; this.renderSelection(); }
  public get selectedHand(): { assaultIds: string[]; aegisIds: string[]; stance: Stance } {
    return { assaultIds: [...this.selection.assaultIds], aegisIds: [...this.selection.aegisIds], stance: this.selectedStance };
  }
  public setTrainingLesson(lesson: number | null): void { this.trainingLesson = lesson; this.updateControls(); }
  public resetView(): void {
    this.viewGeneration++; this.exchangeKey = ''; this.resetHandSelection(); this.updateState('LOBBY_WAIT', 0, 20, 3, 20, []);
    this.setControls('LOBBY_WAIT', false, false); this.setNames('Operative', 'Waiting for opponent', true); this.setRoom('');
    this.setOpponentActivity(null);
  }
  public setOpponentActivity(state: Pick<PlayerPublicState, 'fluxRemaining' | 'hasBurnedCard' | 'hasCommitted'> | null): void {
    const indicator = this.element('opponent-activity');
    indicator.hidden = !state;
    const value = state ? `FLUX ${state.fluxRemaining}/${GAME_CONSTANTS.STARTING_FLUX}${state.hasBurnedCard ? ' • BURN CAST' : ''}${state.hasCommitted ? ' • LOCKED IN' : ''}` : '';
    if (indicator.textContent !== value) indicator.textContent = value;
  }
  public setNames(self: string, opponent: string, connected: boolean): void {
    this.text('player-name', self); this.text('local-dock-name', `${self} • YOUR HAND`); this.text('opponent-name', `${opponent}${connected ? '' : ' • reconnecting'}`);
  }
  public setRoom(code: string): void {
    this.text('room-code', code ? `ROOM ${code}` : '');
    const link = new URL(window.location.pathname, window.location.origin); link.searchParams.set('room', code);
    for (const [id, value] of [['btn-copy-code', code], ['btn-copy-link', link.href]]) {
      const button = this.element<HTMLButtonElement>(id); button.hidden = !code;
      button.onclick = () => {
        const generation = this.viewGeneration;
        const show = (text: string) => { if (generation === this.viewGeneration) this.showBanner(text, 10000); };
        if (!navigator.clipboard) show(value);
        else void navigator.clipboard.writeText(value).then(() => show('Copied')).catch(() => show(value));
      };
    }
  }
  public showResolution(resolution: RoundResolution, selfPlayerId: string): void {
    const selfP1 = selfPlayerId === resolution.p1PlayerId;
    const format = (cards: Card[]) => cards.map(card => `${this.formatRank(card.rank)}${SUIT_GLYPHS[card.suit]}`).join(' ');
    const line = (p1: boolean, label: string) => `${label}: ASSAULT ${format(p1 ? resolution.p1Assault : resolution.p2Assault)} (${(p1 ? resolution.p1Eval3 : resolution.p2Eval3).description}) • AEGIS ${format(p1 ? resolution.p1Aegis : resolution.p2Aegis)} • ${p1 ? resolution.p1Stance : resolution.p2Stance} • ${(p1 ? resolution.p1Burn : resolution.p2Burn) ?? 'NO BURN'} • RECEIVED ${p1 ? resolution.p1NetDamageReceived : resolution.p2NetDamageReceived}`;
    this.text('clash-reveal', `${line(!selfP1, 'OPPONENT')}\n${line(selfP1, 'YOU')}`);
  }
  public showBanner(text: string, durationMs = 3000): void {
    clearTimeout(this.bannerTimer); this.text('center-banner', text);
    if (durationMs > 0) this.bannerTimer = setTimeout(() => this.text('center-banner', ''), durationMs);
  }
  private syncPreferences(): void {
    const reduced = document.body.classList.contains('reduced-motion');
    this.text('btn-toggle-motion', reduced ? 'MOTION: REDUCED' : 'MOTION: FULL');
    this.element('btn-toggle-motion').setAttribute('aria-pressed', String(reduced));
    const crt = !document.body.classList.contains('clean-display');
    this.text('btn-toggle-crt', crt ? 'CRT: ON' : 'CRT: OFF'); this.element('btn-toggle-crt').setAttribute('aria-pressed', String(crt));
    this.text('btn-toggle-mute', masterAudio.isMuted ? 'AUDIO: MUTED' : 'AUDIO: ON'); this.element('btn-toggle-mute').setAttribute('aria-pressed', String(masterAudio.isMuted));
  }
  public show(): void { this.container.hidden = false; this.syncPreferences(); }
  public hide(): void { this.container.hidden = true; clearTimeout(this.bannerTimer); }
}
