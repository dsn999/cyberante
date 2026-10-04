# SPEC-09: Interactive Step-by-Step Tutorial & Rules Reference

## 1. Goal & Non-Goals
- **Goal:** Implement an interactive 4-step guided tutorial introducing players to split-lane hand crafting, Flux transmutations, Burn-to-Cast discards, and stance mindgames, plus a comprehensive floating in-game rules modal accessible at all times.
- **Non-Goals:** Do not require server WebSockets or remote network connectivity (runs 100% offline locally in-browser).

## 2. Inputs, Target Files & Dependencies
- **Target Files:**
  - `packages/client/src/tutorial/TutorialManager.ts`
  - `packages/client/src/ui/RulesModal.ts`
  - `packages/client/src/main.ts`
- **Dependencies:**
  - Standard DOM APIs (`HTMLElement`, CSS classes).
  - `@cyberante/shared` contracts (`Card`, `Stance`, `Suit`, `Rank`, `BurnType`, `GAME_CONSTANTS`).
  - Audio SFX cues (`SoundEffects`).
  - Pure Vanilla TypeScript.

## 3. Public API & Contract Signatures

### 3.1 TutorialManager Class (`packages/client/src/tutorial/TutorialManager.ts`)
```typescript
export interface TutorialStep {
  id: number;
  title: string;
  instruction: string;
  highlightSelector?: string;
  validateAction: (actionType: string, payload?: any) => boolean;
}

export class TutorialManager {
  constructor(parent: HTMLElement, onComplete: () => void);

  public start(): void;
  public nextStep(): void;
  public prevStep(): void;
  public hide(): void;
  public onUserAction(actionType: string, payload?: any): void;

  public get currentStepIndex(): number;
  public get isRunning(): boolean;
}
```

### 3.2 RulesModal Class (`packages/client/src/ui/RulesModal.ts`)
```typescript
export class RulesModal {
  constructor(parent: HTMLElement);

  public show(): void;
  public hide(): void;
  public toggle(): void;
  public get isVisible(): boolean;
}
```

## 4. Detailed Behavior & Educational Curriculum

### 4.1 Four-Step Interactive Curriculum
The tutorial walks first-time players through the game's core concepts with a mock 5-card hand:

1. **Lesson 1: Hand Partitioning (3 Assault / 2 Aegis):**
   - **Hand Dealt:** `[♠A, ♠K, ♠Q, ♦10, ♦4]`.
   - **Instruction:** *"In CYBERANTE, you must split your 5 cards into a 3-Card Assault hand (offensive damage) and a 2-Card Aegis hand (defensive mitigation). Click cards or press [AUTO SPLIT] to assign them."*
   - **Action Gate:** User must assign exactly 3 cards to Assault and 2 cards to Aegis.
2. **Lesson 2: Flux Transmutations (Pip Nudge & Ace-Wrap):**
   - **Hand Dealt:** `[♠A, ♠2, ♠4, ♣8, ♦8]`.
   - **Instruction:** *"Spend 1 Flux to nudge a card's rank up or down. Ace wraps around ($14 \leftrightarrow 2$)! Click [-1] on the 4 to turn it into a 3, completing an Ace-low Straight Flush (A-2-3)!"*
   - **Action Gate:** User must click [-1] on the 4 of Spades to turn it into a 3.
3. **Lesson 3: Burn-to-Cast (Tactical Shielding):**
   - **Hand Dealt:** `[♦K, ♠7, ♠8, ♣9, ♥10]`.
   - **Instruction:** *"Once per exchange, you can BURN a card to activate its suit power. Burning a DIAMOND gives you a hard damage-absorbing Barrier! You immediately draw a replacement card from the deck."*
   - **Action Gate:** User must click `[ BURN ]` on the Diamond card.
4. **Lesson 4: Stance Clash & Counter-Play:**
   - **Instruction:** *"Choose your combat stance: BRACE ($1.0\times$ balanced), OVERCHARGE ($2.0\times$ double damage, but forfeits your own Aegis defense), or PARRY ($0.5\times$ damage, but reflects $50\%$ incoming damage if your opponent overcharges or attacks with a weak hand!). Select OVERCHARGE and lock in!"*
   - **Action Gate:** User selects stance, clicks `[ LOCK IN ]`, and watches a simulated clash against a training drone, triggering vector particle sparks and sound effects.

### 4.2 Tutorial Overlay UI Architecture
- **Step Card Component:** Fixed floating glassmorphic card pinned to center-bottom of screen with cybernetic border glow.
- **Paging Controls:** Shows `Step X of 4`, a `[ SKIP TRAINING ]` link to return to the Main Menu immediately, and a highlighted pulsing outline on target UI buttons.
- **Completion Banner:** On completing Step 4, displays a neon victory banner: *"TRAINING COMPLETE: OPERATIVE COMBAT READY"*, transitioning smoothly back to the Main Menu.

### 4.3 In-Game Floating Rules Modal (`RulesModal`)
Accessible anytime during lobby, shaping, or solo matches by clicking `[ ? RULES ]`:
- **Section 1: 3-Card Assault Hierarchy:**
  - Straight Flush ($18\text{ DMG}$), Three of a Kind ($14\text{ DMG}$), Straight ($10\text{ DMG}$), Flush ($8\text{ DMG}$), Pair ($5\text{ DMG}$), High Card ($2\text{ DMG}$).
- **Section 2: 2-Card Aegis Mitigation:**
  - Pair ($8\text{ Mitigation}$), Suited ($4\text{ Mitigation}$), High Card ($2\text{ Mitigation}$).
- **Section 3: Combat Stance Matrix:**
  - *Brace:* Standard $1.0\times$.
  - *Overcharge:* $2.0\times$ damage; combatant forfeits own Aegis mitigation ($0\text{ Block}$, zero defense).
  - *Parry:* $0.5\times$ damage; reflects $50\%$ incoming damage if opponent overcharges or holds a weak hand (Pair / High Card). *(Refined via automated playtesting).*
- **Section 4: Burn-to-Cast Suit Powers:**
  - *Spades (Veil):* Neutralizes opponent Overcharge and Parry reflect.
  - *Diamonds (Barrier):* Adds $2 \dots 11$ damage-absorbing shield.
  - *Hearts (Siphon):* Heals $50\%$ net damage dealt (capped at 20 HP; does not resurrect a defeated player). *(Refined via automated playtesting).*
  - *Clubs (Sunder):* Halves defender effective Aegis and Barrier.

## 5. Invariants & Edge Cases
1. **Zero Network Traffic:** The tutorial runs strictly in local browser memory without WebSocket connections.
2. **Instant Exit:** The user can press `[ SKIP TRAINING ]` or the `Escape` key at any point to dismiss the tutorial immediately.
3. **Modal Isolation:** Opening the Rules Modal does not steal game focus or cancel pending card commitments.

## 6. Forbidden Boundaries & Anti-Patterns
- Strictly FORBIDDEN from requiring external video player embeds or GIF assets (zero media downloads).
- Do NOT advance tutorial steps automatically without player interaction.
- Do NOT modify the core rules or card math between the tutorial and real matches.

## 7. Test Specifications
- Confirm client build compiles without TypeScript errors.
- Verify that calling `tutorial.onUserAction('COMMIT_HAND')` in Step 1 correctly validates the split and calls `nextStep()`.

## 8. Exact Verification Command
```bash
npm --workspace=packages/client run build
```

## 9. Codex Dispatch Prompt
```markdown
### Codex Task: Interactive Step-by-Step Tutorial & Rules Modal (Spec-09)
Implement/refactor the TutorialManager and RulesModal according to `docs/agent_specs/spec-09-interactive-tutorial.md`.

Target files:
- `packages/client/src/tutorial/TutorialManager.ts`
- `packages/client/src/ui/RulesModal.ts`
- `packages/client/src/main.ts`

Requirements:
1. Implement 4 progressive interactive tutorial lessons (Hand Splitting, Flux Transmutations with A-2-3 straight completion, Burn-to-Cast, Stance Clash).
2. Enforce action validation gates before advancing to the next lesson.
3. Allow skipping tutorial at any time.
4. Implement floating rules modal displaying 3-card poker rankings, 2-card mitigation, stances, and burns.
5. Verify client build passes cleanly: `npm --workspace=packages/client run build`.
```

## 10. Definition of Done Checklist
- [x] 4 interactive tutorial steps with clear cybernetic instructions.
- [x] Action validation gates requiring player participation.
- [x] Skip button allowing immediate exit to main menu.
- [x] Floating in-game rules modal with complete reference tables.
- [x] Clean compilation under `npm --workspace=packages/client run build`.


### Implementation evidence (2026-10-04)

- The specified three fixture hands run through the normal tactical board, with
  exact partition validation, the targeted shared-math A–2–3 nudge and a Diamond
  K burn granting Barrier 10 plus an immediate replacement. Results remain visible
  until the player selects Continue. Invalid actions cannot bypass the gates.
- The final lesson requires explicitly selecting Overcharge and locking in a
  valid split. Shared combat resolution against a Parry drone drives vector
  sparks and procedural audio; the completion banner remains until the player
  returns to the Main Menu. No lesson advances on a timer.
- Start/next/previous/hide/action APIs and running/index getters are implemented.
  `TutorialStep` includes id, instructions, highlight selector and validator;
  action payloads use `unknown` with runtime checks. The payload-free
  `onUserAction('COMMIT_HAND')` reads the board's current selection and calls
  `nextStep()` only for a valid partition, as directly covered by a unit test.
- Skip and Escape cleanly return to the menu from every lesson; replay/restart
  reset training state. Rules preserve selected cards, stance, commitments and
  room membership while clocks keep running. Native modal focus returns to the
  invoker; Escape closes rules before exiting training.
- The reference contains all Assault/Aegis values, a stance matrix, all four
  burn powers, per-exchange resources, Ace wrap and sudden-death rules. Shared
  constants supply numeric damage, mitigation and stance values.
- Verification: exact client build, 31 focused unit tests, full build/test/sim
  (321 tests / 300 seeded matches), and all 28 Chromium cases pass. Nine new
  browser cases include completed desktop/mobile training with networking
  disabled and zero WebSockets/API requests, manual assignment, replay, exits,
  lobby/solo reference isolation, 320px and landscape instruction/navigation
  visibility, 44px controls and reduced-motion keyboard operation. Screenshots
  were inspected. Production output adds no external media assets.
