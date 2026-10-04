# SPEC-03: Deck Shuffling & Flux Transmutation Engine

## 1. Goal & Non-Goals
- **Goal:** Implement CSPRNG and deterministic seedable PRNG deck generation, Fisher-Yates shuffling, Pip Nudge rank wrapping, chromatic Suit Bleed, Burn-to-Cast replacements, and Flux accounting across `@cyberante/shared` and `@cyberante/server`.
- **Non-Goals:** Do not handle client DOM rendering, 3D WebGL scenes, audio synthesis, or WebSocket message transport.

## 2. Inputs, Target Files & Dependencies
- **Target Files:**
  - `packages/server/src/Deck.ts`
  - `packages/shared/src/fluxEngine.ts`
  - `packages/shared/src/MatchEngine.ts`
  - `packages/server/src/__tests__/deckFlux.test.ts`
  - `packages/server/src/__tests__/matchEngine.test.ts`
- **Dependencies:**
  - Node.js built-in `crypto` (`randomInt`) on server for CSPRNG shuffling.
  - `@cyberante/shared` data contracts (`Card`, `Suit`, `Rank`, `BurnType`, `GAME_CONSTANTS`, `SUIT_RING`).
  - Strictly compiles under TypeScript `NodeNext` ESM with mandatory `.js` relative imports.

## 3. Public API & Contract Signatures

### 3.1 PRNG Abstraction (`packages/shared/src/MatchEngine.ts`)
```typescript
export interface PRNG {
  random(): number;
  nextInt(min: number, max: number): number;
}

export class DefaultPRNG implements PRNG {
  public random(): number;
  public nextInt(min: number, max: number): number;
}

export class SeededPRNG implements PRNG {
  constructor(seed?: number);
  public random(): number;
  public nextInt(min: number, max: number): number;
}
```

`DefaultPRNG` is a deterministic seed-1337 fallback. Shared code must never call
unseeded `Math.random()`. Multiplayer injects the server's `CryptoPRNG` adapter
(`node:crypto.randomInt`); solo injects `SeededPRNG` initialized from browser
`crypto.getRandomValues`. Simulations and replays use explicit recorded seeds.
`nextInt` uses an inclusive minimum and exclusive maximum. Seeded inputs and
bounds must be safe integers with a nonempty range.

The server exports `CryptoPRNG implements PRNG` alongside `Deck`. Minimal caller
adaptations in Room, solo, and the simulator are part of this dispatch; complete
transport behavior and the timed solo scheduler remain Specs 04 and 10.

### 3.2 Server Deck Class (`packages/server/src/Deck.ts`)
```typescript
export class Deck {
  constructor();
  public reset(): void;
  public shuffle(): void;
  public deal(count: number): Card[];
  public drawOne(): Card;
  public get remainingCount(): number;
}
```

### 3.3 Flux Transmutation Functions (`packages/shared/src/fluxEngine.ts`)
```typescript
export interface FluxState {
  remainingFlux: number;
  hasBurnedThisRound: boolean;
}

export function canNudgeRank(state: FluxState): boolean;
export function canBleedSuit(state: FluxState): boolean;
export function canBurnCard(state: FluxState): boolean;

export function nudgeRank(card: Card, direction: 'UP' | 'DOWN'): Card;
export function bleedSuit(card: Card, targetSuit: Suit): Card;
export function evaluateBurn(card: Card): { burnType: BurnType; barrierAmount?: number };
```

## 4. Detailed Behavior & Algorithms

### 4.1 Deck Construction & Fisher-Yates Shuffling
1. **Deck Initialization:**
   - 52 standard cards: 4 suits (`SPADES`, `HEARTS`, `DIAMONDS`, `CLUBS`) $\times$ 13 ranks ($2 \dots 14$).
   - Card ID template: `card_${idCounter++}_${suit}_${rank}`.
2. **Fisher-Yates Shuffle:**
   - Traverses array backwards from $i = N - 1$ down to $1$.
   - Selects uniform integer index $j \in [0, i]$ via CSPRNG `randomInt(0, i + 1)` (or PRNG `nextInt(0, i + 1)`).
   - Swaps elements $cards[i]$ and $cards[j]$.
3. **Dealing & Drawing:**
   - `deal(count)`: Slices and removes the first `count` cards from the top. Throws without changing the deck if the count is negative, fractional, not a safe integer, or greater than `remainingCount`. Zero returns an empty array.
   - `drawOne()`: Shifts the top card off the deck. Throws if empty.

### 4.2 Pip Nudge (Cost: 1 Flux)
- Increments (`UP`) or decrements (`DOWN`) the card rank by 1.
- **Ace Wrapping Rules:**
  - $14 \text{ (Ace)} \xrightarrow{\text{UP}} 2$
  - $2 \xrightarrow{\text{DOWN}} 14 \text{ (Ace)}$
  - $13 \text{ (King)} \xrightarrow{\text{UP}} 14 \text{ (Ace)}$
  - $3 \xrightarrow{\text{DOWN}} 2$
- **Card ID:** Retains original ID or generates a consistent unique identifier. Returns an immutable new card object.
- **Flux Validation:** Requires $\text{remainingFlux} \ge 1$. Deducts 1 Flux on execution.

### 4.3 Chromatic Suit Bleed (Cost: 2 Flux)
- Transmutes card suit to an adjacent suit along the cyclic chromatic ring:
  ```
  SPADES  <--->  CLUBS  <--->  DIAMONDS  <--->  HEARTS  <--->  SPADES
  ```
- **Adjacency Table:**
  - `SPADES`: `['CLUBS', 'HEARTS']`
  - `CLUBS`: `['SPADES', 'DIAMONDS']`
  - `DIAMONDS`: `['CLUBS', 'HEARTS']`
  - `HEARTS`: `['DIAMONDS', 'SPADES']`
- **Rejection:** Attempting non-adjacent transmutations (e.g. `SPADES` to `DIAMONDS`) throws an error.
- **Flux Validation:** Requires $\text{remainingFlux} \ge 2$. Deducts 2 Flux on execution.

### 4.4 Burn-to-Cast Mechanics
1. **Usage Limit:** Maximum 1 Burn per exchange per player.
2. **Hand Replacement:**
   - The burned card is removed from the player's 5-card hand.
   - Exactly 1 replacement card is drawn from the deck and inserted into the hand, preserving a constant hand size of 5 cards.
3. **Suit Power Activation:**
   - `SPADES`: Activates `SPADE_VEIL`. Neutralizes opponent Overcharge multiplier ($2.0\times \to 1.0\times$) and disables opponent Parry reflection.
   - `DIAMONDS`: Activates `DIAMOND_BARRIER`. Adds temporary shield barrier equal to pip value:
     - Ace ($14$) $\to 11$ Barrier
     - Face Cards ($10, 11, 12, 13$) $\to 10$ Barrier
     - Numerical Cards ($2 \dots 9$) $\to \text{rank}$ Barrier
   - `HEARTS`: Activates `HEART_SIPHON`. If player deals net damage $> 0$, heals player by $\lfloor \text{NetDmg} \times 0.5 \rfloor$ Guard HP (capped at max 20 HP).
   - `CLUBS`: Activates `CLUB_SUNDER`. Shreds defender's effective Aegis mitigation and active barrier by 50% ($\lfloor \text{value} \times 0.5 \rfloor$).

### 4.5 Flux Currency Lifecycle
- Each exchange starts with exactly `STARTING_FLUX = 3`.
- Unspent Flux does **not** carry over across exchanges (prevents hoarding).
- Transmutations are permitted exclusively during the `SHAPING` phase.

## 5. Invariants & Edge Cases
1. **Deck Lifecycle/Depletion (user decision):** Retain the unused deck across exchanges and rounds. Before each ten-card deal, rebuild and reshuffle if fewer than **12** cards remain: ten for the hands plus two reserved burn replacements. Exactly 12 is sufficient. Retire old hands before the next deal; rebuilds issue fresh IDs. Starting a new match always rebuilds. Never rebuild mid-exchange or fabricate a replacement.
2. **Immutability:** `nudgeRank` and `bleedSuit` must never mutate the input card object in place.
3. **No Negative Balances:** Flux must never drop below 0 under any combination of commands.
4. **Idempotence & Validation:** Burn cannot be called if `hasBurnedThisRound` is already true.

### 5.1 MatchEngine lifecycle and integrity
- `startMatch()` resets HP to 20, wins/counters/burns/commitments, and enters `DEAL`.
- The caller owns clocks and sets `SHAPING` and then `COMMITMENT`; shared logic contains no timers, sockets, or platform crypto imports.
- Nudge, Bleed, and Burn require `SHAPING`, an owned current card, and an uncommitted player. Reject invalid actions without spending Flux or drawing cards.
- `commitHand` requires `COMMITMENT`, exactly 3 Assault plus 2 Aegis distinct current owned IDs, and a valid stance. Copy submitted arrays and reject overwrites.
- `autoLockUncommitted` requires `COMMITMENT` and selects the maximum Assault score, then Aegis score, with BRACE; preserve existing commitments.
- `resolveClash` requires both valid commitments and enters `CLASH_REVEAL`. Repeated calls return the same outcome without applying damage or points again.
- `startExchange` requires a resolved exchange in `ROUND_RESOLVE` and no match winner. Carry HP within a round; reset to 20 only when starting the next round. Reset Flux/burn/barrier/commit state every exchange and enter `DEAL`. Reject repeated starts.
- First to two round wins ends the match; preserve the final KO display until the caller enters `MATCH_OVER`. Exchange cap and repeated sudden death follow Spec-02.
- `remainingDeckCount` is a public getter for deterministic depletion verification.

## 6. Forbidden Boundaries & Anti-Patterns
- Do NOT use unseeded `Math.random()` anywhere in shared gameplay; inject `SeededPRNG` or server CSPRNG.
- Do NOT allow cross-ring suit bleeds.
- Do NOT alter card hand size away from 5 cards during Shaping.
- Do NOT install external random number npm packages.

## 7. Test Specifications (`packages/server/src/__tests__/deckFlux.test.ts`)
- **Deck Distribution:** Initialize deck, assert length is 52, assert 13 of each suit, assert each rank appears 4 times.
- **Shuffle Uniqueness:** Shuffle deck and verify order differs from sorted array with high confidence.
- **Dealing Mechanics:** Deal 5 cards $\to$ deck has 47. Deal 5 more $\to$ deck has 42. Attempt to deal 50 $\to$ expect throw.
- **Pip Nudge Tests:**
  - Nudge Ace (14) UP $\to$ Rank 2.
  - Nudge 2 DOWN $\to$ Rank 14 (Ace).
  - Nudge 7 UP $\to$ Rank 8.
- **Suit Bleed Tests:**
  - Bleed Spades $\to$ Clubs: success.
  - Bleed Spades $\to$ Hearts: success.
  - Bleed Spades $\to$ Diamonds: throws `Error`.
- **Burn-to-Cast Tests:**
  - Burn Ace of Diamonds $\to$ Barrier 11.
  - Burn King of Diamonds $\to$ Barrier 10.
  - Burn 7 of Diamonds $\to$ Barrier 7.
  - Burn Spades, Hearts, Clubs $\to$ correct `BurnType` returned.
- **Flux Accounting:**
  - State with 3 Flux: `canNudgeRank` is true, `canBleedSuit` is true.
  - State with 1 Flux: `canNudgeRank` is true, `canBleedSuit` is false.
  - State with 0 Flux: `canNudgeRank` is false.
  - State with `hasBurnedThisRound: true`: `canBurnCard` is false.

Engine tests additionally cover deterministic multi-exchange replay, server CSPRNG
injection, the 12/11/10/0 deck boundaries, phase/input rejection, committed-hand
integrity, auto-lock, idempotent clash, HP carry/reset, two-win victory and rematch.

## 8. Exact Verification Command
```bash
npx vitest run packages/server/src/__tests__/deckFlux.test.ts
```

## 9. Codex Dispatch Prompt
```markdown
### Codex Task: Deck Shuffling & Flux Transmutation Engine (Spec-03)
Implement and verify the Deck generation, Fisher-Yates CSPRNG shuffle, and Flux Transmutation functions according to `docs/agent_specs/spec-03-deck-flux-engine.md`.

Target files:
- `packages/server/src/Deck.ts`
- `packages/shared/src/fluxEngine.ts`
- `packages/server/src/__tests__/deckFlux.test.ts`

Requirements:
1. Ensure Ace rank wrapping (14 UP -> 2, 2 DOWN -> 14).
2. Validate chromatic suit bleed against `SUIT_RING` in `packages/shared/src/constants.ts`.
3. Implement `evaluateBurn` returning correct powers and Diamond barrier values (Ace=11, Face=10, Pip=rank).
4. Verify all tests pass cleanly: `npx vitest run packages/server/src/__tests__/deckFlux.test.ts`.
```

## 10. Definition of Done Checklist
- [x] 52-card standard deck generation with CSPRNG Fisher-Yates shuffle.
- [x] Pip Nudge with Ace-wrap (14 UP -> 2, 2 DOWN -> 14).
- [x] Chromatic Suit Bleed adhering strictly to cyclic `SUIT_RING`.
- [x] Burn-to-Cast evaluation for all 4 suits with Diamond barrier scaling.
- [x] Flux validation functions (`canNudgeRank`, `canBleedSuit`, `canBurnCard`).
- [x] Complete unit test suite passing under `vitest`.

### Dispatch evidence (2026-10-03)
The exact deck/Flux command passed (25 tests); the engine suite passed (26 tests).
`npm run build && npm test && npm run sim` exited 0: 121 repository tests and
300 simulated matches. The existing Vite chunk-size warning remains. Mirror
pacing is 1.72 exchanges/round, below the stated 1.8 target; Spec-05 owns the AI
and pacing review. This dispatch preserves all combat constants and thresholds.
