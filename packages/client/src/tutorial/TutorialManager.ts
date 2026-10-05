import { type RoundResolution, type Stance } from '@cyberante/shared';
import { masterAudio } from '../audio/AudioEngine';
import { TutorialSession, type TutorialState } from './TutorialSession';
export type { TutorialStep, TutorialState } from './TutorialSession';

/** Four action-gated lessons. The controller supplies the normal tactical board. */
export class TutorialManager {
  private readonly container: HTMLElement;
  private readonly session = new TutorialSession();
  private readonly sizeObserver: ResizeObserver;
  private highlighted: Element[] = [];
  private running = false;
  public onStateChange?: (state: TutorialState) => void;
  public onClash?: (resolution: RoundResolution) => void;
  public readSelection?: () => { assaultIds: string[]; aegisIds: string[]; stance: Stance };

  constructor(private readonly parent: HTMLElement, private readonly onComplete: () => void) {
    this.container = document.createElement('section');
    this.container.id = 'tutorial-overlay';
    this.container.hidden = true;
    this.container.setAttribute('aria-label', 'Guided training');
    this.container.innerHTML = `<div class="tutorial-card panel">
      <header class="tutorial-heading"><span id="tutorial-progress"></span><button id="tut-skip-btn">SKIP TRAINING</button></header>
      <h2 id="tutorial-title" tabindex="-1"></h2>
      <div class="tutorial-copy" tabindex="0" aria-label="Lesson instructions"><p id="tutorial-instruction"></p>
      <p id="tutorial-feedback" role="status" aria-live="polite"></p></div>
      <nav class="button-row" aria-label="Training lessons"><button id="tut-prev-btn">PREVIOUS LESSON</button><button id="tut-next-btn" class="primary" disabled>CONTINUE</button></nav>
    </div>`;
    parent.appendChild(this.container);
    this.element('tut-skip-btn').addEventListener('click', () => this.exit());
    this.element('tut-prev-btn').addEventListener('click', () => this.prevStep());
    this.element('tut-next-btn').addEventListener('click', () => {
      if (this.session.snapshot.complete) this.exit(); else this.nextStep();
    });
    this.sizeObserver = new ResizeObserver(() => this.measure());
  }
  private element<T extends HTMLElement = HTMLElement>(id: string): T { return this.container.querySelector<T>(`#${id}`)!; }
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    // Rules and Options consume Escape before it reaches training.
    if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]')) {
      event.preventDefault(); this.exit();
    }
  };
  public get currentStepIndex(): number { return this.session.snapshot.stepIndex; }
  public get isRunning(): boolean { return this.running; }
  public get state(): TutorialState { return this.session.snapshot; }
  public start(): void {
    this.hide(); this.session.start(); this.running = true;
    this.container.hidden = false; document.body.classList.add('training-active');
    document.addEventListener('keydown', this.onKeyDown);
    this.sizeObserver.observe(this.container);
    this.publish(); this.element('tutorial-title').focus({ preventScroll: true });
  }
  public nextStep(): void {
    if (!this.running || !this.session.next()) return;
    this.publish();
    const resolution = this.session.snapshot.resolution;
    if (resolution) { this.onClash?.(resolution); masterAudio.sfx.playVictory(); }
    this.element('tutorial-title').focus({ preventScroll: true });
  }
  public prevStep(): void {
    if (!this.running || !this.session.prev()) return;
    this.publish(); this.element('tutorial-title').focus({ preventScroll: true });
  }
  public onUserAction(actionType: string, payload?: unknown): void {
    if (!this.running) return;
    const actionPayload = payload === undefined && actionType === 'COMMIT_HAND' ? this.readSelection?.() : payload;
    const passed = this.session.act(actionType, actionPayload);
    if (passed && (this.currentStepIndex === 0 || this.currentStepIndex === 3)) this.nextStep();
    else if (passed) this.publish();
    else this.element('tutorial-feedback').textContent = this.session.feedback;
  }
  private publish(): void {
    const state = this.session.snapshot;
    this.onStateChange?.(state);
    const step = this.session.steps[state.stepIndex];
    this.refreshHighlights();
    this.container.dataset.step = String(state.stepIndex + 1);
    this.container.dataset.complete = String(state.complete);
    this.element('tutorial-progress').textContent = `STEP ${state.stepIndex + 1} OF 4`;
    this.element('tutorial-title').textContent = state.complete ? 'TRAINING COMPLETE: OPERATIVE COMBAT READY' : `LESSON ${step.id}: ${step.title}`;
    this.element('tutorial-instruction').textContent = state.complete ? 'You crafted a hand, spent Flux, cast a Barrier and faced a stance counter. The drone used Parry against your Overcharge. Review the clash above, then return to the Main Menu.' : step.instruction;
    this.element('tutorial-feedback').textContent = this.session.feedback;
    this.element<HTMLButtonElement>('tut-prev-btn').disabled = state.stepIndex === 0 || state.complete;
    const next = this.element<HTMLButtonElement>('tut-next-btn');
    next.disabled = !state.complete && !this.session.canAdvance;
    next.textContent = state.complete ? 'RETURN TO MAIN MENU' : this.session.canAdvance ? 'CONTINUE' : 'ACTION REQUIRED';
    this.measure();
    this.highlighted[0]?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }
  /** Reattach guidance after the tactical board replaces its card controls. */
  public refreshHighlights(): void {
    this.highlighted.forEach(element => element.classList.remove('tutorial-target'));
    const state = this.session.snapshot;
    const selector = this.session.steps[state.stepIndex].highlightSelector;
    this.highlighted = this.running && !state.complete && !this.session.canAdvance && selector ? Array.from(document.querySelectorAll(selector)) : [];
    this.highlighted.forEach(element => element.classList.add('tutorial-target'));
  }
  private measure(): void {
    if (this.running) this.parent.style.setProperty('--tutorial-height', `${this.container.getBoundingClientRect().height}px`);
  }
  private exit(): void {
    if (!this.running) return;
    this.hide(); this.onComplete();
  }
  public hide(): void {
    this.running = false; this.container.hidden = true;
    document.removeEventListener('keydown', this.onKeyDown);
    this.sizeObserver.disconnect();
    this.highlighted.forEach(element => element.classList.remove('tutorial-target')); this.highlighted = [];
    document.body.classList.remove('training-active'); this.parent.style.removeProperty('--tutorial-height');
  }
}
