# SPEC-03: Deck Shuffling & Flux Transmutation Engine

## 1. Context & Objective
Implement CSPRNG deck generation, Fisher-Yates shuffling, Pip Nudge ($\pm 1$), chromatic Suit Bleed, and Burn-to-Cast mechanics.

## 2. Target Files
- `packages/server/src/Deck.ts`
- `packages/shared/src/fluxEngine.ts`

## 3. Invariants & Rules
1. **Pip Nudge (1 Flux):** Increment or decrement rank by 1. Wraps $A \leftrightarrow 2$ and $K \leftrightarrow A$.
2. **Suit Bleed (2 Flux):** Adjacency transitions along ring: $\text{Spades} \leftrightarrow \text{Clubs} \leftrightarrow \text{Diamonds} \leftrightarrow \text{Hearts}$.
3. **Burn-to-Cast (Max 1 per round):** Discards 1 card, applies passive buff, immediately draws 1 replacement card.
4. **Flux Accounting:** Max 3 Flux per round; prevent negative Flux balance.

## 4. Verification Command
```bash
npm test -- deckFlux.test.ts
```
