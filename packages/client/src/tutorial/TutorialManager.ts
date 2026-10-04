// ============================================================================
// CYBERANTE: Interactive 4-Step Tutorial Manager
// ============================================================================

export interface TutorialStep {
  title: string;
  instruction: string;
  hint: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'LESSON 1: THE SPLIT-LANE MATRIX',
    instruction: 'Welcome Operative. You are dealt 5 cards each round. You must partition them into 3 ASSAULT cards (offensive 3-card poker power) and 2 AEGIS cards (defensive damage absorption).',
    hint: '3-Card Poker ranking: Straight Flush > Three of a Kind > Straight > Flush > Pair > High Card.',
  },
  {
    title: 'LESSON 2: FLUX TRANSMUTATION',
    instruction: 'You have 3 FLUX points per round. Spend 1 Flux to NUDGE a card rank by ±1 (e.g. 6 to 7), or 2 Flux to BLEED a card into an adjacent suit on the chromatic ring.',
    hint: 'Ranks wrap around Ace: King + 1 = Ace, Ace + 1 = 2.',
  },
  {
    title: 'LESSON 3: BURN-TO-CAST SACRIFICES',
    instruction: 'Once per round, you may BURN (discard) a card to immediately trigger a tactical buff and draw a fresh replacement. Spades create a Static Veil, Diamonds grant a Barrier shield, Hearts siphon HP, and Clubs sunder enemy armor.',
    hint: 'Burning a Diamond adds the card pip value directly to your Aegis defense barrier.',
  },
  {
    title: 'LESSON 4: BLIND STANCE CLASHES',
    instruction: 'When committing your cards, choose a blind combat stance. OVERCHARGE doubles your attack but drops your Aegis to 0. PARRY reflects 50% damage if the opponent has a Pair or High Card. BRACE provides reliable 1.0x baseline power.',
    hint: 'Anticipate your opponent: If you predict an aggressive all-in, a Parry can turn their attack against them.',
  },
];

export class TutorialManager {
  private container: HTMLElement;
  private currentStepIdx: number = 0;
  private onCompleteCallback: () => void;

  constructor(parent: HTMLElement, onComplete: () => void) {
    this.onCompleteCallback = onComplete;
    this.container = document.createElement('div');
    this.container.id = 'tutorial-overlay';
    this.container.style.cssText = `
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(3, 7, 18, 0.88);
      display: none; align-items: center; justify-content: center;
      z-index: 50; pointer-events: auto;
    `;

    parent.appendChild(this.container);
  }

  public start(): void {
    this.currentStepIdx = 0;
    this.container.style.display = 'flex';
    this.renderCurrentStep();
  }

  private renderCurrentStep(): void {
    const step = TUTORIAL_STEPS[this.currentStepIdx];
    this.container.innerHTML = `
      <div style="
        background: #0b1329; border: 1px solid #ffb700;
        box-shadow: 0 0 30px rgba(255, 183, 0, 0.3);
        width: 90%; max-width: 580px; padding: 24px; border-radius: 8px;
        color: #e5e7eb; font-family: 'Rajdhani', sans-serif;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <span style="font-family: 'Share Tech Mono', monospace; font-size: 13px; color: #ffb700;">
            STEP ${this.currentStepIdx + 1} OF ${TUTORIAL_STEPS.length}
          </span>
          <button id="tut-skip-btn" style="
            background: transparent; border: none; color: #9ca3af;
            cursor: pointer; font-size: 12px;
          ">EXIT TUTORIAL</button>
        </div>

        <h2 style="font-family: 'Orbitron', sans-serif; font-size: 18px; color: #ffb700; margin-bottom: 12px; letter-spacing: 1px;">
          ${step.title}
        </h2>

        <p style="font-size: 16px; line-height: 1.5; margin-bottom: 16px;">
          ${step.instruction}
        </p>

        <div style="background: rgba(255, 183, 0, 0.1); border-left: 3px solid #ffb700; padding: 10px 14px; margin-bottom: 24px; font-size: 13px; color: #fef08a;">
          <strong>PRO TIP:</strong> ${step.hint}
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px;">
          <button id="tut-next-btn" style="
            background: #ffb700; color: #030712; font-family: 'Orbitron', sans-serif;
            font-weight: 700; font-size: 13px; letter-spacing: 1px;
            padding: 10px 22px; border: none; border-radius: 4px; cursor: pointer;
          ">
            ${this.currentStepIdx === TUTORIAL_STEPS.length - 1 ? 'COMPLETE & PLAY' : 'NEXT LESSON →'}
          </button>
        </div>
      </div>
    `;

    this.container.querySelector('#tut-skip-btn')?.addEventListener('click', () => {
      this.hide();
      this.onCompleteCallback();
    });

    this.container.querySelector('#tut-next-btn')?.addEventListener('click', () => {
      if (this.currentStepIdx < TUTORIAL_STEPS.length - 1) {
        this.currentStepIdx += 1;
        this.renderCurrentStep();
      } else {
        this.hide();
        this.onCompleteCallback();
      }
    });
  }

  public hide(): void {
    this.container.style.display = 'none';
  }
}
