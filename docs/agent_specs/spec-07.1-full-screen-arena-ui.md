# SPEC-07.1: Full-Screen Vector Arena & Contextual Game HUD

Revision date: 2026-10-05. Requested by the user during the game UI redesign.

## 1. Goal & Revision Authority

Make the procedural wireframe arena the principal visual hook throughout active
play. Reduce the number of simultaneous tactical controls by exposing actions
for the current phase and selected card.

This revision extends [Spec-07](spec-07-neon-vector-renderer.md) and supersedes
the panel composition and always-visible control layout in
[Spec-08 §4](spec-08-client-game-ui.md#4-detailed-behavior--tactical-overlay-layout).
It refines how [Spec-09](spec-09-interactive-tutorial.md) presents its existing
lessons. All combat, hand evaluation, Flux, authority, privacy and tutorial
completion contracts remain applicable.

## 2. Inputs, Target Files & Dependencies

- `packages/client/src/render/ReactiveGrid.ts`
- `packages/client/src/render/VectorScene.ts`
- `packages/client/src/render/shaders/gridDisplacement.glsl`
- `packages/client/src/ui/GameBoardOverlay.ts`
- `packages/client/src/ui/ui.css`
- `packages/client/src/tutorial/TutorialManager.ts`
- `packages/client/src/main.ts` — refresh tutorial guidance after card selection.
- Existing renderer unit checks and browser UI/tutorial/integration checks.

Dependencies remain Three.js, native DOM/CSS/Web Audio and `@cyberante/shared`.
No new runtime package, external media asset or game network message is needed.

## 3. Public API & Contract Signatures

Existing `VectorScene`, `GameBoardOverlay` and `GameBoardCallbacks` APIs remain
compatible. Add:

```typescript
// ReactiveGrid: positive, finite world-space dimensions supplied on resize.
public setViewportSpan(width: number, height: number): void;

// TutorialManager: restore the lesson's targets after DOM card replacement.
public refreshHighlights(): void;
```

`ReactiveGrid.uniforms.uGridScale.value` is a reusable `THREE.Vector2`.
`refreshHighlights()` removes previous highlights and queries the current
lesson's selector; completed/inactive lessons have no targets.

## 4. Detailed Behavior & Layout

### 4.1 Full-Screen Wireframe

The canvas covers the viewport. The grid must cover the camera frustum at the
grid plane, rather than being confined to a fixed central rectangle.

Keep the preallocated 40×25 subdivision grid with local XY dimensions 50×30.
For camera vertical FOV `f`, aspect ratio `a` and grid distance `d`:

```text
height = 2 × tan(f / 2) × d × 1.25
width  = height × a
uGridScale = (width / 50, height / 30)
```

With the current camera at Z=30 and grid at Z=−5, `d=35`. The 25% margin
accommodates displacement and the compositor. Resize changes the scale
uniform; the vertex shader scales XY before evaluating existing displacement.
CPU vertex buffers, materials and particle pool sizes remain fixed.

### 4.2 Arena and Floating HUD

The central area displays vector cards, particles and clash effects. Reserve
space for edge controls through `#arena-preview`, which supplies the renderer's
card layout bounds. This element does not clip the full-screen grid.

- Top edge: round/exchange, player names, Guard, Flux, wins, public opponent
  activity, phase and countdown. Long names may truncate visually.
- Bottom edge: a compact translucent dock with damage/block previews and five
  card selectors. Each selector retains rank, suit and an explicit lane label.
- Options: one disclosure for Rules, CRT, motion, audio, exit and online sharing.
- Adjust Split: a disclosure for removable 3-card Assault/2-card Aegis slot
  badges and Auto Split. Opening it closes the card-action tray; selecting a
  card closes the split editor in normal play.

### 4.3 Phase-Specific Controls

| Phase | Visible tactical controls by default |
| --- | --- |
| Deal / lobby | No tactical dock; Options and relevant waiting/room state |
| Shaping | Five card buttons and Ready: six buttons, plus Options/Adjust Split disclosure triggers |
| Commitment | Five card buttons, three stance buttons and Lock In; selected stance explanation |
| Committed | Disabled card selectors and Committed status; no shaping tray or stance choices |
| Clash / round resolve | Dock hidden; vector reveal/effects, banners and optional Clash Details |
| Match over | Dock hidden; match result, Rematch when available, Options and Clash Details |

Ready remains subject to the existing authoritative readiness state. Lock In
requires exactly three Assault and two Aegis cards. Rules do not pause time.

### 4.4 Contextual Card Actions

Selecting an assigned card opens only that card's action tray. Clicking it
again or Close dismisses the tray. Selecting an unassigned card fills an
available slot. Swapping assigned cards requires Swap Lanes, followed by a card
in the opposite lane; opening a tray alone must not change the split.

During Shaping the tray exposes ±1 Nudge, both valid adjacent Bleed suits, Burn
and Swap Lanes. Show Nudge's 1-Flux and Bleed's 2-Flux costs, and explain the
selected card's burn effect. Keep existing Flux and once-per-exchange checks.
During Commitment expose lane swapping without shaping actions.

Rank/suit updates preserve the selected card. A burned card transfers selection
to its replacement at the same hand index. Every new exchange clears selection.

### 4.5 Responsive Layout & Training

- Portrait: one five-card strip, compact upper HUD and bottom dock; no horizontal
  scroll. No permanently expanded per-card controls.
- Short landscape (width ≥600px, height ≤500px): move the normal tactical dock
  to a 310px right column and place vector cards in the remaining arena.
- Training: keep the instruction sheet and real controls separated. Short
  landscape uses controls on the left and instructions on the right.
- Lesson 1 shows card assignment and an inline Auto Split action, without a
  popover covering the card selectors.
- Lessons 2/3 initially select the required card and expose the required Nudge
  or Burn action. Hide the split disclosure during these focused lessons so its
  trigger cannot overlap the card labels. Wrong-card actions must still be
  rejected by TutorialSession.
- Refresh lesson highlights after replacing card controls. The required action
  must remain visible and tappable, including inside the short-screen dock.

## 5. Invariants & Edge Cases

1. All game visuals remain procedural; retain Spec-07 CRT, audio reactivity,
   context recovery, reduced motion and resource disposal behavior.
2. No CPU geometry rewrite or per-frame geometry/material allocation is added.
3. Opponent faces remain private until the authoritative reveal phase.
4. Existing HP carryover, Bo3 rounds, burn effects, Flux budgets, countdowns,
   automatic commitments and deterministic gameplay rules are preserved.
5. Hidden controls leave the normal focus order. Visible buttons are at least
   44×44px; card selectors retain accessible labels and focus after updates.
6. Escape closes Rules, then an open Options disclosure, before training exits.
7. Sharing, reconnect, rematch, exit and offline tutorial access remain usable.

## 6. Forbidden Boundaries

Do not change balance constants, server protocols or hidden-hand rules to simplify
the UI. Do not replace procedural geometry with imported media. Do not claim
physical-device FPS from software rendering or reopen the disruptive WSL native
GPU path. The 60 FPS engineering target remains in Spec-10B. Its 2026-10-05
user-approved revision accepts reported Windows Chrome/iPad Safari gameplay
performance in place of mandatory external frame traces.

## 7. Acceptance Checks

- Inspect desktop, portrait and short-landscape screenshots: wireframe reaches
  all screen edges; card art occupies the available arena; default controls are
  compact and required contextual actions are unobstructed.
- Existing grid tests verify shader scaling/displacement and unchanged CPU
  buffers after viewport scaling and animation.
- Existing UI cases verify six default Shaping buttons, one selected-card tray,
  keyboard swaps, partial partitions, Flux/Burn validation, focus, Options,
  stance/commitment behavior and touch targets at 320/390/767/1280px widths.
- Existing tutorial cases complete all four lessons offline and check controls
  beside/above instructions at 320×568 and 844×390.
- Existing integration/audio/renderer cases verify full matches, multiplayer,
  reconnects, settings and resource recovery through the revised disclosures.

Screenshots and emulated touch establish layout behavior, not human usability
study results, Safari compatibility or physical hardware performance.

## 8. Verification Commands

```bash
npm run build
npm test
npm run sim
npm run verify:build
PLAYWRIGHT_BROWSERS_PATH=/tmp/cyberante-browsers npx playwright test e2e/acceptance.spec.ts e2e/audio.spec.ts e2e/designQa.spec.ts
PLAYWRIGHT_BROWSERS_PATH=/tmp/cyberante-browsers npx playwright test e2e/integration.spec.ts
PLAYWRIGHT_BROWSERS_PATH=/tmp/cyberante-browsers npx playwright test e2e/tutorial.spec.ts e2e/ui.spec.ts e2e/renderer.spec.ts --grep-invert 'renderer frame timing'
```

Use the repository's headless SwiftShader configuration with one browser worker.
The excluded diagnostic timing case does not establish this visual revision's
acceptance; release performance acceptance follows the separate Spec-10B revision.

## 9. Codex Dispatch Prompt

Implement Spec-07.1's full-screen vector arena and contextual HUD. Preserve the
existing procedural rendering, gameplay contracts and accessible inputs. Use
phase-specific controls, a selected-card tray and secondary disclosures. Verify
portrait/short-landscape training and full match flows, reconcile linked specs
and record concrete evidence without physical performance claims.

## 10. Definition of Done

- [x] Viewport-scaled grid and central procedural arena.
- [x] Compact floating HUD and secondary Options/Adjust Split disclosures.
- [x] One selected-card tray with visible costs and burn information.
- [x] Phase-specific stances, selected-stance explanation and primary action.
- [x] Tutorial guidance follows rebuilt controls.
- [x] Desktop/portrait/landscape visual inspection on the final build.
- [x] Build, unit/integration, simulation, bundle and browser gates pass.
- [x] Verification evidence recorded in `docs/qa/ui_redesign.md`.

This revision's completion does not itself complete separate Spec-10B release
acceptance. The user subsequently accepted public Windows Chrome/iPad Safari
performance; see the current release acceptance record for remaining evidence.
