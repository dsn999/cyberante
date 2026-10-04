# SPEC-01: Shared Contracts & Interface Definitions

## 1. Context & Objective
This specification defines the ground-truth data models, enumerations, network message protocols, and constants for the entire `CYBERANTE` monorepo. It must have zero runtime dependencies and compile cleanly under TypeScript `strict` mode.

## 2. Target File
- `packages/shared/src/types.ts`
- `packages/shared/src/constants.ts`
- `packages/shared/src/index.ts`

## 3. Invariants & Requirements
1. **Suits & Ranks:** 
   - `Suit`: `'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS'`
   - `Rank`: `2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14` (11=J, 12=Q, 13=K, 14=A)
2. **Card Structure:** `{ id: string; suit: Suit; rank: Rank }`
3. **Stances:** `'BRACE' | 'OVERCHARGE' | 'PARRY'`
4. **Game Phases:** `'LOBBY_WAIT' | 'DEAL' | 'SHAPING' | 'COMMITMENT' | 'CLASH_REVEAL' | 'ROUND_RESOLVE' | 'MATCH_OVER'`
5. **Constants:**
   - `GUARD_HP_DEFAULT = 20`
   - `FLUX_DEFAULT = 3`
   - `SHAPING_TIME_MS = 15000`
   - `COMMITMENT_TIME_MS = 10000`
   - `BEST_OF_ROUNDS = 3` (First to 2 wins)

## 4. Verification Command
```bash
npm --workspace=packages/shared run build
```
