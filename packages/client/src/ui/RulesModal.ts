import { GAME_CONSTANTS } from '@cyberante/shared';

/** Native modal focus handling keeps the reference usable with keyboard and touch. */
export class RulesModal {
  private readonly container: HTMLDialogElement;
  private returnFocus: HTMLElement | null = null;
  constructor(parent: HTMLElement) {
    this.container = document.createElement('dialog');
    this.container.id = 'rules-modal';
    this.container.setAttribute('aria-labelledby', 'rules-title');
    this.container.innerHTML = `<header class="rules-heading"><h2 id="rules-title">TACTICAL OPERATIONS MANUAL</h2><button id="close-rules-btn" autofocus aria-label="Close rules">CLOSE</button></header>
      <div class="rules-content">
        <section><h3>1. Match and split lanes</h3><p>Win ${GAME_CONSTANTS.ROUNDS_TO_WIN} rounds to win the match. Start each round with ${GAME_CONSTANTS.STARTING_GUARD_HP} Guard HP. Damage carries across exchanges until a player reaches 0 HP; a new round resets Guard HP.</p><p>Split five cards into three Assault cards and two Aegis cards. Select a hand card, then one in the opposite lane to swap them. Select a lane badge to unassign it. Auto Split chooses the highest local damage-and-block utility.</p></section>
        <table><caption>Assault damage and Aegis block</caption><thead><tr><th scope="col">Lane</th><th scope="col">Hand</th><th scope="col">Value</th></tr></thead><tbody>
          <tr><td>Assault</td><td>Straight Flush</td><td>${GAME_CONSTANTS.DAMAGE_STRAIGHT_FLUSH} damage</td></tr>
          <tr><td>Assault</td><td>Three of a Kind</td><td>${GAME_CONSTANTS.DAMAGE_THREE_OF_A_KIND} damage</td></tr>
          <tr><td>Assault</td><td>Straight</td><td>${GAME_CONSTANTS.DAMAGE_STRAIGHT} damage</td></tr>
          <tr><td>Assault</td><td>Flush</td><td>${GAME_CONSTANTS.DAMAGE_FLUSH} damage</td></tr>
          <tr><td>Assault</td><td>Pair</td><td>${GAME_CONSTANTS.DAMAGE_PAIR} damage</td></tr>
          <tr><td>Assault</td><td>High Card</td><td>${GAME_CONSTANTS.DAMAGE_HIGH_CARD} damage</td></tr>
          <tr><td>Aegis</td><td>Pair</td><td>${GAME_CONSTANTS.MITIGATION_PAIR} block</td></tr>
          <tr><td>Aegis</td><td>Suited</td><td>${GAME_CONSTANTS.MITIGATION_SUITED} block</td></tr>
          <tr><td>Aegis</td><td>High Card</td><td>${GAME_CONSTANTS.MITIGATION_HIGH_CARD} block</td></tr>
        </tbody></table>
        <section><h3>2. Shaping and Flux</h3><p>Receive ${GAME_CONSTANTS.STARTING_FLUX} Flux each exchange. During Shaping, +1/−1 costs one Flux, wrapping Ace ↔ 2. Bleed costs two Flux and allows either neighboring suit: Spades ↔ Clubs ↔ Diamonds ↔ Hearts ↔ Spades.</p><p>Burn once per exchange to draw a replacement and cast its suit power: Spades suppress Overcharge and reflection; Diamonds add a temporary barrier (Ace 11, faces 10, other ranks their pip value); Hearts heal half of net damage dealt, capped at 20 HP without resurrecting a defeated player; Clubs halve effective Aegis and barrier.</p></section>
        <section><h3>3. Combat stance matrix</h3>
          <table><caption>Stances and counter-play</caption><thead><tr><th scope="col">Stance</th><th scope="col">Damage</th><th scope="col">Defense / counter</th></tr></thead><tbody>
            <tr><th scope="row">BRACE</th><td>${GAME_CONSTANTS.STANCE_BRACE_MULTIPLIER}×</td><td>Full Aegis mitigation.</td></tr>
            <tr><th scope="row">OVERCHARGE</th><td>${GAME_CONSTANTS.STANCE_OVERCHARGE_MULTIPLIER}×</td><td>Forfeits your own Aegis, even under Veil. An active Barrier still applies.</td></tr>
            <tr><th scope="row">PARRY</th><td>${GAME_CONSTANTS.STANCE_PARRY_MULTIPLIER}×</td><td>Reflects ${GAME_CONSTANTS.STANCE_PARRY_REFLECT_RATIO * 100}% incoming raw damage against Overcharge or a Pair / High Card assault, unless suppressed by Spade Veil.</td></tr>
          </tbody></table><p>Damage and reflection round to the nearest integer. Reflection bypasses Aegis and Barrier.</p>
        </section>
        <section><h3>4. Burn-to-Cast suit powers</h3><table><caption>Tactical burns — once per exchange, no Flux cost</caption><thead><tr><th scope="col">Suit / power</th><th scope="col">Effect</th></tr></thead><tbody>
          <tr><th scope="row">♠ Spades · Veil</th><td>Suppresses the opponent’s Overcharge bonus and Parry reflection.</td></tr>
          <tr><th scope="row">♦ Diamonds · Barrier</th><td>Temporary shield of 2–11: Ace 11; 10 / J / Q / K give 10; 2–9 give their pip value.</td></tr>
          <tr><th scope="row">♥ Hearts · Siphon</th><td>Heals 50% of net assault damage dealt, rounded down, capped at ${GAME_CONSTANTS.STARTING_GUARD_HP} HP. Cannot resurrect a defeated player.</td></tr>
          <tr><th scope="row">♣ Clubs · Sunder</th><td>Halves the opponent’s effective Aegis and Barrier separately, rounded down.</td></tr>
        </tbody></table><p>Discard the chosen card and immediately draw its replacement. Burns last for this exchange only.</p></section>
        <section><h3>5. Ready and commitment</h3><p>Ready advances early when both players finish shaping. Choose your split and stance, then Lock In during Commitment. Missing commitments are automatically assigned a valid split with Brace when time expires. Opponent cards and stance remain hidden until Clash Reveal.</p><p>Ace can be high (Q–K–A) or low (A–2–3) in a straight; K–A–2 is not a straight. Suits do not break equal hand scores.</p><p>At the ${GAME_CONSTANTS.MAX_EXCHANGES_PER_ROUND}-exchange cap, higher remaining Guard wins. Equal Guard starts sudden death at 1 HP each: compare net assault damage dealt, then Assault score, then Aegis score. An exact tie repeats sudden death at 1 HP. Simultaneous knockouts before the cap compare Assault scores; equal scores continue at 1 HP.</p><p>Rules stay available during every phase. Opening this reference does not pause the match clock. Keyboard: Tab to navigate, Enter/Space to activate buttons, and Escape to close this dialog.</p></section>
      </div>`;
    parent.appendChild(this.container);
    this.container.querySelector('#close-rules-btn')!.addEventListener('click', () => this.hide());
    this.container.addEventListener('close', () => {
      if (this.returnFocus?.isConnected && !this.returnFocus.matches(':disabled')) this.returnFocus.focus({ preventScroll: true });
      this.returnFocus = null;
    });
    this.container.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(this.container.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')).filter(control => !control.hidden);
      const first = controls[0]; const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    this.container.addEventListener('click', event => {
      if (event.target !== this.container) return;
      const bounds = this.container.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.hide();
    });
  }
  public get isVisible(): boolean { return this.container.open; }
  public show(): void {
    if (this.container.open) return;
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.container.showModal();
  }
  public hide(): void { if (this.container.open) this.container.close(); }
  public toggle(): void { if (this.isVisible) this.hide(); else this.show(); }
}
