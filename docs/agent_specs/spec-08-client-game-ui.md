# SPEC-08: Client Game UI & Tactical Overlay

**Layout revision:** [Spec-07.1](spec-07.1-full-screen-arena-ui.md) governs the
full-screen arena and contextual HUD composition reflected in Section 4.

## 1. Goal & Non-Goals
- **Goal:** Implement responsive, high-contrast, accessibility-aware DOM overlays for split-lane card slotting (3 Assault, 2 Aegis), Auto-Split helper, Flux transmutation actions (Nudge UP/DOWN, Bleed adjacent suit, Burn-to-Cast), Stance toggles (Brace, Overcharge, Parry), real-time countdown HUD, and match status banners.
- **Non-Goals:** Do not handle 3D vector canvas rendering (Spec 07) or Web Audio synthesis scheduling (Spec 06).

## 2. Inputs, Target Files & Dependencies
- **Target Files:**
  - `packages/client/src/ui/GameBoardOverlay.ts`
  - `packages/client/src/ui/MainMenuOverlay.ts`
  - `packages/client/src/ui/RulesModal.ts`
  - `packages/client/index.html` (DOM root container `#ui-overlay`)
- **Dependencies:**
  - Standard Browser DOM APIs (`document.createElement`, CSS Custom Properties).
  - `@cyberante/shared` contracts (`Card`, `Suit`, `Rank`, `Stance`, `GamePhase`, `SUIT_GLYPHS`, `SUIT_COLORS`, `GAME_CONSTANTS`, `evaluateAssaultHand`, `evaluateAegisHand`).
  - Audio SFX triggers (`SoundEffects`).
  - Zero heavy frontend frameworks (pure Vanilla TypeScript and CSS).

## 3. Public API & Contract Signatures

### 3.1 GameBoardCallbacks Interface
```typescript
import { Suit, Stance } from '@cyberante/shared';

export interface GameBoardCallbacks {
  onNudgeRank: (cardId: string, direction: 'UP' | 'DOWN') => void;
  onBleedSuit: (cardId: string, targetSuit: Suit) => void;
  onBurnCard: (cardId: string) => void;
  onCommitHand: (
    assaultIds: [string, string, string],
    aegisIds: [string, string],
    stance: Stance
  ) => void;
  onReady?: () => void;
  onToggleRules: () => void;
  onToggleCrt?: () => void;
  onToggleMute?: () => void;
}
```

### 3.2 GameBoardOverlay Class
```typescript
import { Card, GamePhase, Stance } from '@cyberante/shared';
import { GameBoardCallbacks } from './GameBoardOverlay.js';

export class GameBoardOverlay {
  constructor(parent: HTMLElement, callbacks: GameBoardCallbacks);

  public updateState(
    phase: GamePhase,
    timeRemainingMs: number,
    playerHp: number,
    playerFlux: number,
    opponentHp: number,
    cards: Card[],
    roundNumber?: number,
    exchangeNumber?: number,
    playerWins?: number,
    opponentWins?: number,
    activeBarrier?: number
  ): void;

  public showBanner(text: string, durationMs?: number): void;
  public show(): void;
  public hide(): void;
  public resetHandSelection(): void;
}
```

### 3.3 MainMenuOverlay Class
```typescript
import { BotPersonality } from '@cyberante/shared';

export interface MainMenuCallbacks {
  onStartSolo: (botProfile: BotPersonality) => void;
  onCreateMultiplayer: (playerName: string) => void;
  onJoinMultiplayer: (roomCode: string, playerName: string) => void;
  onStartTutorial: () => void;
  onToggleRules: () => void;
}

export class MainMenuOverlay {
  constructor(parent: HTMLElement, callbacks: MainMenuCallbacks);

  public show(): void;
  public hide(): void;
  public showError(msg: string): void;
}
```

## 4. Detailed Behavior & Tactical Overlay Layout

### 4.1 HUD Hierarchy & Screen Composition
The user-approved October 2026 redesign makes the procedural vector arena the primary visual surface. The canvas and reactive wireframe cover the viewport; the HUD floats at the edges without an opaque central board.

- **Top edge:** Round/exchange, names, Guard, Flux, wins, phase and countdown. A single **Options** disclosure contains Rules, CRT, motion, audio, exit and online sharing.
- **Bottom dock:** Five compact card selectors with explicit Assault/Aegis labels and live damage/block previews. **Adjust Split** exposes the lane slots and Auto Split helper.
- **Shaping:** Ready is the primary action. Selecting one card exposes its Nudge, adjacent Bleed, Burn and Swap Lanes controls. Flux costs and the selected card's burn effect are visible in this contextual tray.
- **Commitment:** Shaping controls disappear. Three stance choices, an explanation of the selected stance and Lock In are displayed.
- **Clash/resolve:** The tactical dock disappears so the vector effects dominate. Full combat text is available under Clash Details.
- **Short landscape screens:** The tactical dock moves to the right edge, leaving the left arena open.
- **Training:** The real controls remain available above/beside the instruction sheet; the Flux/Burn lessons show their required action in the selected card tray.

### 4.2 Split-Lane Slotting Mechanics
1. **Interactive Assignment:** Select a card to inspect it. Choose **Swap Lanes**, then select a card in the opposite lane. Clicking an unassigned card assigns it to an available slot. The **Adjust Split** disclosure exposes removable slot badges for:
   - **Assault Lane (Top 3 Slots):** Feeds into the 3-card poker evaluation for offensive damage.
   - **Aegis Lane (Bottom 2 Slots):** Feeds into the 2-card mitigation evaluation for defense.
2. **Auto-Split Helper:** Clicking `[ AUTO SPLIT ]` executes an instant local evaluation of all 10 possible combinations, placing cards into the highest utility partition.
3. **Live Hand Evaluation Badges:** Real-time client-side preview badges display predicted hand tiers (e.g. `PAIR • 5 DMG`, `FLUSH • 8 DMG`, `SUITED • 4 MIT`).

### 4.3 Card Transmutation Controls (Shaping Phase)
Only the selected card exposes the shaping controls:
- **`[ +1 ]` / `[ -1 ]` Pip Nudge:** Increments or decrements card rank with Ace wrapping ($14 \leftrightarrow 2$). Costs 1 Flux.
- **`[ BLEED ]` Chromatic Bleed:** Cycles card suit along the cyclic `SUIT_RING`. Costs 2 Flux.
- **`[ BURN ]` Burn-to-Cast:** Burns the card to trigger its suit passive power (Diamond Barrier, Spade Veil, Heart Siphon, Club Sunder), immediately replacing it from the deck. Disabled once per exchange.

### 4.4 Stance Selection & Commitment Lock-In
- **Stance Matrix Buttons:** Three mutually exclusive toggle buttons, visible during Commitment:
  - `BRACE (1.0x)`: Standard baseline stance. Reliable absorption.
  - `OVERCHARGE (2.0x)`: Double damage dealt, forfeits own Aegis mitigation (0 Block, zero defense).
  - `PARRY (0.5x REFLECT)`: Half damage dealt, reflects 50% incoming damage if opponent Overcharges or attacks with a weak hand (Pair or High Card).
- **Commit Button:** Becomes active only when exactly 3 Assault cards and 2 Aegis cards are assigned. Pulsates during the final 3 seconds of the `COMMITMENT` phase countdown.

### 4.5 Accessibility & High-Contrast Design
- **Suit Glyphs:** High-contrast Unicode symbols ($♠, ♥, ♦, ♣$) paired with distinct HSL neon colors to guarantee accessibility for colorblind users.
- **CRT / Clean Toggle:** `[ CRT ]` button toggles scanlines and bloom effects on or off for users who prefer flat vector lines.
- **Touch Friendly:** Minimum $44 \times 44\text{px}$ hit areas for all buttons, fully usable on mobile screens.

## 5. Invariants & Edge Cases
1. **Button Disabled States:**
   - Nudge buttons disabled when `playerFlux < 1`.
   - Bleed buttons disabled when `playerFlux < 2`.
   - Burn button disabled when `hasBurnedCard === true`.
   - Lock In button disabled unless hand partition is exactly $(3, 2)$.
2. **Responsive Screen Scaling:** CSS grid and flexbox layout dynamically collapses on viewports narrower than $768\text{px}$ without horizontal scrolling.
3. **Player Name Sanitization:** Main menu restricts player name input to $1 \dots 16$ characters, trimming leading/trailing whitespace.
4. **Room Code Sanitization:** Room code input forces uppercase and trims invalid characters.

## 6. Forbidden Boundaries & Anti-Patterns
- Strictly FORBIDDEN from adding React, Vue, Svelte, or Tailwind dependencies.
- Do NOT perform authoritative round resolutions in the client UI; all final outcomes must come from the server / MatchEngine.
- Do NOT block the user from reading the rules modal during any game phase.

## 7. Test Specifications
- Confirm client TypeScript bundle compiles cleanly under `vite build` without errors.
- Verify UI overlay mounts into DOM and updates state without uncaught null reference exceptions.

## 8. Exact Verification Command
```bash
npm --workspace=packages/client run build
```

## 9. Codex Dispatch Prompt
```markdown
### Codex Task: Client Game UI & Tactical Overlay (Spec-08)
Implement/refactor the GameBoardOverlay, MainMenuOverlay, and RulesModal according to `docs/agent_specs/spec-08-client-game-ui.md`.

Target files:
- `packages/client/src/ui/GameBoardOverlay.ts`
- `packages/client/src/ui/MainMenuOverlay.ts`
- `packages/client/src/ui/RulesModal.ts`
- `packages/client/index.html`

Requirements:
1. Implement split-lane card slotting (3 Assault, 2 Aegis) with live evaluation preview badges and Auto-Split helper.
2. Implement Transmutation action buttons (Pip Nudge, Suit Bleed, Burn) with strict Flux cost checks.
3. Implement Stance selector (Brace, Overcharge, Parry) and Commit button validation.
4. Implement MainMenu overlay supporting Solo Mode bot selection, Room Create, and Room Join.
5. Provide accessibility toggles for CRT scanlines and audio mute.
6. Verify client build passes cleanly: `npm --workspace=packages/client run build`.
```

## 10. Definition of Done Checklist
- [x] Responsive GameBoardOverlay with Guard HP, Flux currency, and phase timers.
- [x] Split-lane slotting (3 Assault, 2 Aegis) with Auto-Split helper.
- [x] Transmutation buttons for Nudge, Bleed, and Burn with Flux validation.
- [x] Stance matrix selector with clear risk/reward indicators.
- [x] MainMenuOverlay with Solo bot archetype selection and multiplayer matchmaking.
- [x] Accessibility features: high-contrast suit glyphs, CRT toggle, mobile responsiveness.
- [x] Clean compilation under `npm --workspace=packages/client run build`.

### Verification evidence

`handSelection.test.ts` covers all ten partitions, valid lane swaps, cancellation,
incomplete manual selections, immutable rank updates, burn replacements and fresh
exchanges. `e2e/ui.spec.ts` follows the visible card/Options disclosures and checks
keyboard/touch input, authoritative disabled states, Bleed neighbors, countdown
urgency, focus preservation, rules, preferences and menu validation. Its responsive
checks enforce six visible shaping buttons (five cards and Ready), one contextual
card-action tray, no horizontal overflow and 44×44px minimum button targets.

The 2026-10-05 redesign verification and its scope are recorded in
[`docs/qa/ui_redesign.md`](../qa/ui_redesign.md). Tutorial guidance is refreshed
when card controls are replaced; portrait and short landscape instruction sheets
leave their required controls unobstructed.
