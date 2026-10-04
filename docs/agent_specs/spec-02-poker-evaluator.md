# SPEC-02: Deterministic Poker Evaluator & Combat Calculator

## 1. Context & Objective
Implement deterministic 3-card Assault evaluation, 2-card Aegis mitigation evaluation, and combat resolution formulas (damage, barrier, parry reflection).

## 2. Target Files
- `packages/shared/src/pokerEvaluator.ts`
- `packages/shared/src/combatCalculator.ts`
- `packages/server/src/__tests__/evaluator.test.ts`
- `packages/server/src/__tests__/combat.test.ts`

## 3. Invariants & Rules
1. **Assault Line (3 Cards):**
   - Straight Flush: 18 Base Dmg
   - Three of a Kind: 14 Base Dmg
   - Straight: 10 Base Dmg
   - Flush: 8 Base Dmg
   - Pair: 5 Base Dmg
   - High Card: 2 Base Dmg
   - Wraps: Ace counts high ($Q\text{-}K\text{-}A$) and low ($A\text{-}2\text{-}3$).
2. **Aegis Line (2 Cards):**
   - Pair: 8 Block
   - Suited: 4 Block
   - Offsuit High Card: 2 Block
3. **Stances:**
   - Brace: 1.0x offensive, standard mitigation.
   - Overcharge: 2.0x offensive, Aegis = 0.
   - Parry: 0.5x offensive, reflects 50% raw damage if Opponent Assault < Flush.

## 4. Verification Command
```bash
npm test -- evaluator.test.ts combat.test.ts
```
