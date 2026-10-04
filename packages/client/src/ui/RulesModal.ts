import { GAME_CONSTANTS } from '@cyberante/shared';

/** Native modal focus handling keeps the reference usable with keyboard and touch. */
export class RulesModal {
  private readonly container: HTMLDialogElement;
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
        <section><h3>3. Blind combat stances</h3><ul><li><strong>BRACE:</strong> 1× damage with full Aegis mitigation.</li><li><strong>OVERCHARGE:</strong> 2× damage and forfeits your Aegis mitigation.</li><li><strong>PARRY:</strong> ½× damage; reflects 50% of incoming raw damage against Overcharge or a Pair/High Card assault, unless suppressed by Spade Veil.</li></ul></section>
        <section><h3>4. Ready and commitment</h3><p>Ready advances early when both players finish shaping. Choose your split and stance, then Lock In during Commitment. Missing commitments are automatically assigned a valid split with Brace when time expires. Opponent cards and stance remain hidden until Clash Reveal.</p><p>Rules stay available during every phase. Opening this reference does not pause the match clock. Keyboard: Tab to navigate, Enter/Space to activate buttons, and Escape to close this dialog.</p></section>
      </div>`;
    parent.appendChild(this.container);
    this.container.querySelector('#close-rules-btn')!.addEventListener('click', () => this.hide());
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
  public show(): void { if (!this.container.open) this.container.showModal(); }
  public hide(): void { if (this.container.open) this.container.close(); }
  public toggle(): void { if (this.isVisible) this.hide(); else this.show(); }
}
