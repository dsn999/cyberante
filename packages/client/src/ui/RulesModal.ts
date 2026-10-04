// ============================================================================
// CYBERANTE: Rules Reference Modal & Cheat Sheet
// ============================================================================

export class RulesModal {
  private container: HTMLElement;
  private isOpen: boolean = false;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'rules-modal';
    this.container.style.display = 'none';
    this.container.innerHTML = `
      <div style="
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(3, 7, 18, 0.85);
        backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        z-index: 100;
        pointer-events: auto;
      ">
        <div style="
          background: #0b1329;
          border: 1px solid #00f3ff;
          box-shadow: 0 0 25px rgba(0, 243, 255, 0.35);
          width: 90%; max-width: 650px;
          padding: 24px; border-radius: 8px;
          color: #e5e7eb; font-family: 'Rajdhani', sans-serif;
          max-height: 85vh; overflow-y: auto;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f293d; padding-bottom: 12px; margin-bottom: 16px;">
            <h2 style="font-family: 'Orbitron', sans-serif; color: #00f3ff; font-size: 20px; letter-spacing: 2px;">TACTICAL OPERATIONS MANUAL</h2>
            <button id="close-rules-btn" style="
              background: transparent; border: 1px solid #ff0055; color: #ff0055;
              padding: 4px 10px; cursor: pointer; border-radius: 4px; font-weight: bold;
            ">✕ CLOSE</button>
          </div>

          <h3 style="color: #ffb700; margin-bottom: 6px; font-size: 16px;">1. SPLIT-LANE COMMITMENT</h3>
          <p style="font-size: 14px; margin-bottom: 12px; line-height: 1.4;">
            Split your 5 dealt cards into <strong>3 Assault Cards</strong> (3-card poker attack power) and <strong>2 Aegis Cards</strong> (defensive damage mitigation).
          </p>

          <table style="width: 100%; font-size: 13px; margin-bottom: 16px; border-collapse: collapse;">
            <thead>
              <tr style="background: #111e3b; text-align: left;">
                <th style="padding: 6px;">Line</th>
                <th style="padding: 6px;">Hand Tier</th>
                <th style="padding: 6px;">Base Value</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style="padding: 4px;">Assault</td><td>Straight Flush</td><td style="color:#00ff66;">18 DMG</td></tr>
              <tr><td style="padding: 4px;">Assault</td><td>Three of a Kind</td><td style="color:#00ff66;">14 DMG</td></tr>
              <tr><td style="padding: 4px;">Assault</td><td>Straight / Flush</td><td style="color:#00ff66;">10 / 8 DMG</td></tr>
              <tr><td style="padding: 4px;">Aegis</td><td>Pair</td><td style="color:#00f3ff;">8 Block</td></tr>
              <tr><td style="padding: 4px;">Aegis</td><td>Suited / High Card</td><td style="color:#00f3ff;">4 / 2 Block</td></tr>
            </tbody>
          </table>

          <h3 style="color: #ffb700; margin-bottom: 6px; font-size: 16px;">2. FLUX & BURN MECHANICS</h3>
          <ul style="font-size: 13px; margin-bottom: 16px; padding-left: 20px; line-height: 1.5;">
            <li><strong>Pip Nudge (1 Flux):</strong> Shift card rank $\\pm 1$. Wraps Ace ($A \\leftrightarrow 2$).</li>
            <li><strong>Suit Bleed (2 Flux):</strong> Shift suit along chromatic ring (Spades $\\leftrightarrow$ Clubs $\\leftrightarrow$ Diamonds $\\leftrightarrow$ Hearts).</li>
            <li><strong>Burn-to-Cast:</strong> Discard 1 card to trigger passive buff and draw a replacement (Spade: Veil, Diamond: Barrier, Heart: Siphon, Club: Sunder).</li>
          </ul>

          <h3 style="color: #ffb700; margin-bottom: 6px; font-size: 16px;">3. COMBAT STANCES</h3>
          <ul style="font-size: 13px; padding-left: 20px; line-height: 1.5;">
            <li><strong>BRACE:</strong> 1.0x attack, full Aegis mitigation.</li>
            <li><strong>OVERCHARGE:</strong> 2.0x attack, reduces Aegis mitigation to 0.</li>
            <li><strong>PARRY:</strong> 0.5x attack. Reflects 50% damage if opponent assault is below Flush.</li>
          </ul>
        </div>
      </div>
    `;

    parent.appendChild(this.container);

    const closeBtn = this.container.querySelector('#close-rules-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
  }

  public show(): void {
    this.isOpen = true;
    this.container.style.display = 'block';
  }

  public hide(): void {
    this.isOpen = false;
    this.container.style.display = 'none';
  }

  public toggle(): void {
    if (this.isOpen) this.hide();
    else this.show();
  }
}
