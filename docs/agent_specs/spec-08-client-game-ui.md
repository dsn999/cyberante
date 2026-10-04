# SPEC-08: Client Game UI & Tactical Overlay

## 1. Context & Objective
Implement responsive, high-contrast DOM overlays for card slotting (3 Assault, 2 Aegis), Flux transmutations, stance selections, and phase countdowns.

## 2. Target Files
- `packages/client/src/ui/GameBoardOverlay.ts`
- `packages/client/src/ui/MainMenuOverlay.ts`
- `packages/client/src/ui/ControlsOverlay.ts`

## 3. Invariants & Rules
1. **Controls:** Single-click or drag-to-slot card assignment into Assault (3 slots) and Aegis (2 slots).
2. **Action HUD:** One-click Pip Nudge ($\pm 1$), Suit Bleed, and Burn-to-Cast buttons with remaining Flux indicator.
3. **Stance Toggles:** Fast toggle between Brace, Overcharge, and Parry with risk/reward indicators.
4. **Mobile Responsiveness:** Full touch compatibility across iOS Safari, Android Chrome, and Desktop viewports.

## 4. Verification Command
DOM layout and responsive event listener verification.
