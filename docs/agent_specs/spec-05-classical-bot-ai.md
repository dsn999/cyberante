# SPEC-05: Classical Game AI Engine (Solo Mode)

## 1. Goal & Non-Goals
- **Goal:** Implement a 100% local, deterministic classical heuristic game AI (strictly non-LLM) featuring three distinct personality archetypes (`CIPHER_ZERO`, `VEKTOR_AGGRO`, `AEGIS_WALL`), enabling hackathon judges and players to immediately experience complete matches offline without requiring a second human player.
- **Non-Goals:** Do not make remote LLM API calls, load neural network weights, or execute non-deterministic unseeded logic.

## 2. Inputs, Target Files & Dependencies
- **Target Files:**
  - `packages/shared/src/ai/ClassicalBotAI.ts`
  - `packages/shared/src/ai/BotProfiles.ts`
  - `packages/shared/src/index.ts`
  - `packages/client/src/ai/ClassicalBotAI.ts` (re-export)
  - `packages/client/src/ai/BotProfiles.ts` (re-export)
  - `packages/server/src/__tests__/balanceSimulator.test.ts`
- **Dependencies:**
  - `@cyberante/shared` contracts (`Card`, `Stance`, `BotDecision`, `BotPersonality`, `BotConfig`, `evaluateAssaultHand`, `evaluateAegisHand`, `PRNG`, `SeededPRNG`).
  - Zero external machine learning or runtime dependencies. NodeNext ESM compliant.

## 3. Public API & Contract Signatures

### 3.1 Bot Personality & Configuration Types
```typescript
export type BotPersonality = 'CIPHER_ZERO' | 'VEKTOR_AGGRO' | 'AEGIS_WALL';

export interface BotConfig {
  name: string;
  personality: BotPersonality;
  tagline: string;
  assaultBias: number;
  aegisBias: number;
  overchargeTendency: number;
  parryTendency: number;
  burnAggression: number;
}

export interface BotDecision {
  assaultCards: [Card, Card, Card];
  aegisCards: [Card, Card];
  chosenStance: Stance;
  cardToBurn?: Card | null;
  nudges?: Array<{ cardId: string; direction: 'UP' | 'DOWN' }>;
}
```

### 3.2 ClassicalBotAI Class
```typescript
export class ClassicalBotAI {
  constructor(profileName?: BotPersonality, prng?: PRNG);

  public setProfile(profileName: BotPersonality): void;
  public getProfile(): BotConfig;

  public evaluateHand(
    hand: Card[],
    ownGuardHp: number,
    opponentGuardHp: number,
    availableFlux?: number,
    canBurn?: boolean
  ): BotDecision;
}
```

## 4. Detailed Behavior & Decision Heuristics

### 4.1 Personality Archetypes
Three distinct playstyles are codified in `packages/shared/src/ai/BotProfiles.ts` (calibrated via the balance simulator):

| Archetype | Name | Assault Bias | Aegis Bias | Overcharge % | Parry % | Burn Aggression | Playstyle Description |
|---|---|---|---|---|---|---|---|
| `CIPHER_ZERO` | *CIPHER-0* | `0.60` | `0.50` | `0.25` | `0.35` | `0.40` | Balanced utilitarian; calculates optimal mathematical expectation based on remaining HP. |
| `VEKTOR_AGGRO` | *VEKTOR-AGGRO* | `0.85` | `0.25` | `0.60` | `0.15` | `0.70` | Hyper-offensive; prioritizes Trips/Straights and Overcharge finishers; burns Clubs for Sunder. |
| `AEGIS_WALL` | *AEGIS-WALL* | `0.50` | `0.75` | `0.10` | `0.55` | `0.50` | Counter-punching defensive tank; maximizes Pairs in Aegis and baiting Parry reflections; burns Diamonds for Barrier. |

### 4.2 Combinatorial Hand Partition Search
1. **Combinatorial Space:** For any dealt hand of 5 cards, there are exactly:
   $$\binom{5}{3} = \frac{5!}{3! \, 2!} = 10 \text{ unique partitions}$$
2. **Partition Evaluation:** For each candidate partition $k \in [0, 9]$:
   - Assault evaluation: $\text{eval3} = \text{evaluateAssaultHand}(cards[0], cards[1], cards[2])$
   - Aegis evaluation: $\text{eval2} = \text{evaluateAegisHand}(cards[3], cards[4])$
   - Utility scoring function:
     $$\text{Utility}(k) = (\text{eval3.baseDamage} \times \text{assaultBias}) + (\text{eval2.mitigation} \times \text{aegisBias}) + (\text{eval3.score} \times 0.0001)$$
3. The candidate partition yielding the maximum utility score is initially selected.

### 4.3 Flux Transmutation Search
1. If $\text{availableFlux} \ge 1$:
   - Simulates 1-step pip nudges (`UP` and `DOWN`) on each card in the selected partition.
   - If a nudge upgrades the Assault tier (e.g. completes a Straight or turns a Pair into Three of a Kind) and improves utility by $\ge 3.0$ points, the nudge is scheduled in `BotDecision.nudges`.

### 4.4 Tactical Burn Decision
1. If $\text{canBurn} = \text{true}$ and `prng.random() < burnAggression`:
   - **Diamond (Barrier):** If $\text{ownGuardHp} \le 10$ and hand contains a Diamond card $\to$ schedule burn for `DIAMOND_BARRIER`.
   - **Club (Sunder):** If personality is `VEKTOR_AGGRO` and hand contains a Club $\to$ schedule burn for `CLUB_SUNDER`.
   - **Heart (Siphon):** If $\text{ownGuardHp} \le 14$ and hand contains a Heart $\to$ schedule burn for `HEART_SIPHON`.
   - **Spade (Veil):** If $\text{opponentGuardHp} > \text{ownGuardHp}$ and hand contains a Spade $\to$ schedule burn for `SPADE_VEIL`.

### 4.5 Stance Selection Algorithm
1. **Lethal Finisher Check:** If $(\text{eval3.baseDamage} \times 2.0) \ge \text{opponentGuardHp}$ and $\text{ownGuardHp} > 6$:
   - Selects `OVERCHARGE` to attempt an immediate knockout.
2. **Critical Defense Check:** If $\text{ownGuardHp} \le 5$:
   - Checks `parryTendency`. If $r < \text{parryTendency} \times 1.2$, selects `PARRY`; otherwise `BRACE`.
3. **Tendency Roll:**
   - Sample uniform random $r \in [0, 1)$ from PRNG:
     - If $r < \text{overchargeTendency} \to$ `OVERCHARGE`.
     - Else if $r < (\text{overchargeTendency} + \text{parryTendency}) \to$ `PARRY`.
     - Otherwise $\to$ `BRACE`.

## 5. Invariants & Edge Cases
1. **Hand Size:** Hand must contain exactly 5 cards. If fewer or more are passed, throws an `Error`.
2. **Deterministic Reproducibility:** When initialized with `SeededPRNG(seed)`, all hand partitions and stance decisions must be 100% identical on repeated runs.
3. **Zero Network Calls:** Must execute completely synchronously in $< 1\text{ms}$ per evaluation.
4. **Card Object Integrity:** Input card arrays and card objects must never be mutated.

## 6. Forbidden Boundaries & Anti-Patterns
- Strictly FORBIDDEN from using external LLM APIs (OpenAI, Gemini, Anthropic) or loading offline ONNX/TensorFlow weights.
- Do NOT use unseeded `Math.random()` inside the AI class; strictly rely on the injected `PRNG`.
- Do NOT return invalid partitions (e.g. 2 Assault, 3 Aegis, or duplicate cards).

## 7. Test Specifications (`packages/server/src/__tests__/balanceSimulator.test.ts`)
- **Mirror Match Simulation:** Simulate 200 matches between identical archetypes (Cipher vs Cipher). Assert 0 runtime errors, average exchanges per round between 1.5 and 5.0, and average rounds per match $\ge 2.0$.
- **Asymmetric Match Simulation:** Simulate 100 matches of Aggro (`VEKTOR_AGGRO`) vs Wall (`AEGIS_WALL`). Assert that both archetypes win $\ge 20\%$ of matches, confirming viable competitive counter-play.
- **Deterministic Replay Test:** Initialize bot with fixed seed `42`, evaluate 10 fixed hands, verify the exact same output array across runs.

## 8. Exact Verification Command
```bash
npm run sim
```

## 9. Codex Dispatch Prompt
```markdown
### Codex Task: Classical Game AI Engine (Spec-05)
Implement/refactor the deterministic ClassicalBotAI and BotProfiles according to `docs/agent_specs/spec-05-classical-bot-ai.md`.

Target files:
- `packages/shared/src/ai/ClassicalBotAI.ts`
- `packages/shared/src/ai/BotProfiles.ts`
- `packages/shared/src/index.ts`
- `packages/server/src/__tests__/balanceSimulator.test.ts`

Requirements:
1. Implement the 10-partition combinatorial search over 5 cards into 3 Assault and 2 Aegis cards.
2. Wire scoring heuristics using `assaultBias` and `aegisBias` across the three profiles (CIPHER-0, VEKTOR-AGGRO, AEGIS-WALL).
3. Implement tactical Burn-to-Cast and Pip Nudge heuristics.
4. Verify tests and simulation pass cleanly: `npm run sim`.
```

## 10. Definition of Done Checklist
- [ ] Three personality archetypes (`CIPHER_ZERO`, `VEKTOR_AGGRO`, `AEGIS_WALL`) defined.
- [ ] Exact combinatorial 10-partition generator implemented.
- [ ] Stance selection matrix with lethal finisher and defense checks.
- [ ] Deterministic PRNG injection supporting seedable replays.
- [ ] Headless balance simulator running 300 matches under 1 second via `npm run sim`.
