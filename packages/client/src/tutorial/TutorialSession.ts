import {
  type Card, type Stance, type BurnType, type RoundResolution,
  GAME_CONSTANTS, nudgeRank, evaluateBurn, resolveCombatRound,
} from '@cyberante/shared';
import { HandSelection } from '../ui/HandSelection';

export interface TutorialStep {
  id: number;
  title: string;
  instruction: string;
  highlightSelector?: string;
  validateAction: (actionType: string, payload?: unknown) => boolean;
}
export interface TutorialState {
  stepIndex: number;
  cards: Card[];
  flux: number;
  barrier: number;
  burn: BurnType | null;
  stance: Stance;
  assaultIds: string[];
  aegisIds: string[];
  complete: boolean;
  resolution: RoundResolution | null;
}
const card = (id: string, rank: Card['rank'], suit: Card['suit']): Card => ({ id, rank, suit });
const HANDS: readonly (readonly Card[])[] = [
  [card('split-a', 14, 'SPADES'), card('split-k', 13, 'SPADES'), card('split-q', 12, 'SPADES'), card('split-10', 10, 'DIAMONDS'), card('split-4', 4, 'DIAMONDS')],
  [card('flux-a', 14, 'SPADES'), card('flux-2', 2, 'SPADES'), card('flux-4', 4, 'SPADES'), card('flux-c8', 8, 'CLUBS'), card('flux-d8', 8, 'DIAMONDS')],
  [card('burn-k', 13, 'DIAMONDS'), card('burn-7', 7, 'SPADES'), card('burn-8', 8, 'SPADES'), card('burn-9', 9, 'CLUBS'), card('burn-10', 10, 'HEARTS')],
];
function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}
function partition(value: unknown, cards: readonly Card[]): value is { assaultIds: string[]; aegisIds: string[]; stance?: Stance } {
  const input = record(value);
  if (!input || !Array.isArray(input.assaultIds) || !Array.isArray(input.aegisIds)) return false;
  const ids: unknown[] = [...input.assaultIds, ...input.aegisIds];
  return input.assaultIds.length === 3 && input.aegisIds.length === 2 && new Set(ids).size === 5
    && ids.every(id => typeof id === 'string' && cards.some(card => card.id === id));
}

/** Local training state uses the same shaping and combat functions as real matches. */
export class TutorialSession {
  private state: TutorialState = this.lesson(0);
  private passed = false;
  public feedback = '';
  public readonly steps: readonly TutorialStep[] = [
    { id: 1, title: 'HAND PARTITIONING', instruction: 'Split your five cards into 3 Assault cards for damage and 2 Aegis cards for mitigation. Select each card, or press AUTO SPLIT.', highlightSelector: '#hand-cards .card-face, #btn-auto-split', validateAction: (type, value) => type === 'COMMIT_HAND' && partition(value ?? this.state, this.state.cards) },
    { id: 2, title: 'FLUX TRANSMUTATIONS', instruction: 'Each exchange gives you 3 Flux. A ±1 nudge costs 1 Flux; Ace wraps between 14 and 2. Press −1 on the 4 of Spades to complete an A–2–3 Straight Flush. Suit Bleed costs 2 Flux and moves to either neighboring suit.', highlightSelector: '[data-card-id="flux-4"] .nudge-down-btn', validateAction: (type, value) => type === 'NUDGE_RANK' && record(value)?.cardId === 'flux-4' && record(value)?.direction === 'DOWN' },
    { id: 3, title: 'BURN-TO-CAST', instruction: 'Once per exchange, BURN a card to cast its suit power and draw a replacement. Burn the King of Diamonds for a 10-point Barrier. Ace gives 11, faces give 10, and other ranks give their pip value.', highlightSelector: '[data-card-id="burn-k"] .burn-btn', validateAction: (type, value) => type === 'BURN_CARD' && record(value)?.cardId === 'burn-k' },
    { id: 4, title: 'STANCE CLASH & COUNTER-PLAY', instruction: 'BRACE deals 1× damage. OVERCHARGE deals 2× but forfeits your Aegis. PARRY deals ½× and reflects 50% of incoming raw damage against Overcharge or a weak hand. Select OVERCHARGE and LOCK IN against the training drone.', highlightSelector: '#stance-overcharge, #btn-lock-in', validateAction: (type, value) => type === 'COMMIT_HAND' && partition(value, this.state.cards) && value.stance === 'OVERCHARGE' && this.state.stance === 'OVERCHARGE' },
  ];
  public get snapshot(): TutorialState {
    return { ...this.state, cards: this.state.cards.map(card => ({ ...card })), assaultIds: [...this.state.assaultIds], aegisIds: [...this.state.aegisIds], resolution: this.state.resolution ? structuredClone(this.state.resolution) : null };
  }
  public get canAdvance(): boolean { return this.passed && !this.state.complete; }
  private lesson(index: number): TutorialState {
    const cards = HANDS[Math.min(index, 2)].map(card => ({ ...card }));
    const selection = new HandSelection();
    if (index !== 0) selection.setCards(cards);
    return { stepIndex: index, cards, flux: GAME_CONSTANTS.STARTING_FLUX, barrier: 0, burn: null, stance: 'BRACE', assaultIds: [...selection.assaultIds], aegisIds: [...selection.aegisIds], complete: false, resolution: null };
  }
  public start(): void { this.state = this.lesson(0); this.passed = false; this.feedback = ''; }
  public prev(): boolean {
    if (this.state.stepIndex === 0 || this.state.complete) return false;
    this.state = this.lesson(this.state.stepIndex - 1); this.passed = false; this.feedback = '';
    return true;
  }
  public next(): boolean {
    if (!this.passed || this.state.complete) return false;
    this.passed = false;
    if (this.state.stepIndex === 3) this.state.complete = true;
    else if (this.state.stepIndex === 2) this.state.stepIndex = 3; // Keep the shield and replacement for the clash.
    else this.state = this.lesson(this.state.stepIndex + 1);
    return true;
  }
  public act(type: string, payload?: unknown): boolean {
    if (this.state.complete || this.passed) return false;
    const step = this.steps[this.state.stepIndex];
    if (type === 'SELECT_STANCE' && this.state.stepIndex === 3) {
      const stance = record(payload)?.stance;
      if (stance === 'BRACE' || stance === 'OVERCHARGE' || stance === 'PARRY') this.state.stance = stance;
      this.feedback = stance === 'OVERCHARGE' ? 'Overcharge selected. Lock in your split to test the drone’s counter-play.' : 'For this lesson, select OVERCHARGE before locking in.';
      return false;
    }
    if (!step.validateAction(type, payload)) {
      this.feedback = ['Assign exactly 3 Assault and 2 Aegis cards to continue.', 'Nudge the 4 of Spades down to 3. Other shaping actions are reserved for real matches.', 'Burn the King of Diamonds to cast your Barrier.', 'Select OVERCHARGE, then lock in a valid 3/2 split.'][this.state.stepIndex];
      return false;
    }
    if (this.state.stepIndex === 0) {
      const split = (payload ?? this.state) as { assaultIds: string[]; aegisIds: string[] };
      this.state.assaultIds = [...split.assaultIds]; this.state.aegisIds = [...split.aegisIds];
      this.feedback = 'Split confirmed: three cards attack and two defend.';
    } else if (this.state.stepIndex === 1) {
      this.state.cards = this.state.cards.map(card => card.id === 'flux-4' ? nudgeRank(card, 'DOWN') : card);
      this.state.flux -= GAME_CONSTANTS.FLUX_COST_NUDGE;
      this.feedback = '4 → 3: A–2–3 is a Straight Flush worth 18 base damage. You spent 1 Flux.';
    } else if (this.state.stepIndex === 2) {
      const burned = this.state.cards.find(card => card.id === 'burn-k')!;
      const effect = evaluateBurn(burned);
      this.state.burn = effect.burnType; this.state.barrier = effect.barrierAmount ?? 0;
      this.state.cards = this.state.cards.map(card => card.id === burned.id ? { id: 'replacement-9', rank: 9, suit: 'SPADES' } : card);
      const selection = new HandSelection(); selection.setCards(this.state.cards);
      this.state.assaultIds = [...selection.assaultIds]; this.state.aegisIds = [...selection.aegisIds];
      this.feedback = 'Diamond burned: Barrier 10 active. You drew the 9 of Spades, completing a 7–8–9 Straight Flush.';
    } else {
      const split = payload as { assaultIds: string[]; aegisIds: string[] };
      this.state.assaultIds = [...split.assaultIds]; this.state.aegisIds = [...split.aegisIds];
      const lookup = (id: string): Card => this.state.cards.find(card => card.id === id)!;
      this.state.resolution = resolveCombatRound({
        playerId: 'training-player', assaultCards: split.assaultIds.map(lookup) as [Card, Card, Card], aegisCards: split.aegisIds.map(lookup) as [Card, Card],
        stance: this.state.stance, currentGuardHp: GAME_CONSTANTS.STARTING_GUARD_HP, activeBarrier: this.state.barrier, burnType: this.state.burn,
      }, {
        playerId: 'training-drone', assaultCards: [card('drone-5', 5, 'HEARTS'), card('drone-10', 10, 'HEARTS'), card('drone-k', 13, 'HEARTS')],
        aegisCards: [card('drone-2', 2, 'CLUBS'), card('drone-6', 6, 'DIAMONDS')], stance: 'PARRY', currentGuardHp: GAME_CONSTANTS.STARTING_GUARD_HP, activeBarrier: 0,
      });
      this.feedback = 'Clash resolved using real combat rules. Parry reflected half your raw damage; a Barrier does not absorb reflection.';
    }
    this.passed = true;
    return true;
  }
}
