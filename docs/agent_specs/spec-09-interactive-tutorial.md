# SPEC-09: Interactive Step-by-Step Tutorial & Rules Reference

## 1. Context & Objective
Implement a guided 4-step interactive onboarding tutorial selectable from the main screen, plus a floating in-game cheat sheet modal.

## 2. Target Files
- `packages/client/src/tutorial/TutorialManager.ts`
- `packages/client/src/ui/RulesModal.ts`

## 3. Invariants & Rules
1. **Interactive Lessons:**
   - *Lesson 1:* Hand Splitting (3-Card Assault vs. 2-Card Aegis).
   - *Lesson 2:* Flux Transmutation (Nudge a pip to complete a Straight).
   - *Lesson 3:* Burn-to-Cast (Burn a Diamond for a barrier).
   - *Lesson 4:* Combat Stances & Clash (Simulate live clash against a passive drone).
2. **Step Progression:** Enforces player execution of the instructed action before advancing.
3. **In-Game Reference:** Accessible floating `[ ? RULES ]` HUD button opening hand ranking tables and stance matrix without freezing the match.

## 4. Verification Command
Tutorial progression state test verifying complete walkthrough from Lesson 1 to Lesson 4.
