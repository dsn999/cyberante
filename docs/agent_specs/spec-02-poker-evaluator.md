# SPEC-02: Deterministic Poker Evaluator & Combat Calculator

## 1. Goal & Non-Goals
- **Goal:** Implement the deterministic combinatorial evaluation of 3-card Assault hands, 2-card Aegis mitigation hands, and Option A multi-exchange combat damage resolution with stances and tactical burns.
- **Non-Goals:** Do not handle network sockets, real-time timers, or visual effects in this package.

## 2. Inputs & Dependencies
- **Target Files:**
  - `packages/shared/src/pokerEvaluator.ts`
  - `packages/shared/src/combatCalculator.ts`
  - `packages/server/src/__tests__/evaluator.test.ts`
  - `packages/server/src/__tests__/combat.test.ts`
- **Dependencies:** Imports types and constants from `@cyberante/shared`.

## 3. Public API & Contracts
```typescript
export function evaluateAssaultHand(cards: [Card, Card, Card]): HandEvaluation3;
export function evaluateAegisHand(cards: [Card, Card]): HandEvaluation2;

export interface CombatantInput {
  playerId: string;
  assaultCards: [Card, Card, Card];
  aegisCards: [Card, Card];
  stance: Stance;
  currentGuardHp: number;
  activeBarrier: number;
  burnType?: BurnType | null;
}

export function resolveCombatRound(
  c1: CombatantInput,
  c2: CombatantInput,
  exchangeNumber?: number,
  roundNumber?: number
): RoundResolution;
```

## 4. Behavior & Mathematical Formulas

### 4.1 3-Card Assault Evaluation
Evaluates 3 cards according to official 3-Card Poker ranking hierarchy:

| Tier | Condition | Base Damage | Score Formula (Tie-Breaker) |
|---|---|---|---|
| `STRAIGHT_FLUSH` | 3 cards sequential & same suit | `18` | `60000 + highRank` (Wheel A-2-3: highRank = 3) |
| `THREE_OF_A_KIND` | 3 cards matching rank | `14` | `50000 + rank` |
| `STRAIGHT` | 3 cards sequential | `10` | `40000 + highRank` (Wheel A-2-3: highRank = 3) |
| `FLUSH` | 3 cards same suit | `8` | `30000 + (r0 * 256) + (r1 * 16) + r2` |
| `PAIR` | 2 cards matching rank | `5` | `20000 + (pairRank * 16) + kickerRank` |
| `HIGH_CARD` | Default | `2` | `10000 + (r0 * 256) + (r1 * 16) + r2` |

**Ace Straight Rules:**
- Ace-high straight: `12-13-14` (Q-K-A), highRank = 14.
- Ace-low wheel straight: `14-3-2` (A-2-3), highRank = 3.

### 4.2 2-Card Aegis Mitigation
Evaluates 2 cards according to defensive mitigation rules:

| Tier | Condition | Mitigation Block | Score Formula |
|---|---|---|---|
| `PAIR` | 2 cards matching rank | `8` Block | `2000 + rank` |
| `SUITED` | 2 cards same suit | `4` Block | `1000 + (r0 * 16) + r1` |
| `HIGH_CARD` | Default | `2` Block | `(r0 * 16) + r1` |

### 4.3 Combat Resolution Mathematics (Option A)
Given attacker $A$ and defender $D$:

1. **Stance Multipliers:**
   - `BRACE`: $1.0\times$ damage dealt; normal Aegis mitigation.
   - `OVERCHARGE`: $2.0\times$ damage dealt; combatant forfeits own Aegis mitigation ($0\text{ Block}$, zero defense).
   - `PARRY`: $0.5\times$ damage dealt; reflects $50\%$ incoming raw damage if opponent Overcharges OR if opponent's assault tier is `PAIR` or `HIGH_CARD`.
   - *Static Veil Suppression:* If defender burned Spade (`SPADE_VEIL`), attacker's Overcharge multiplier is reduced to $1.0\times$ and attacker's Parry reflect is disabled.

2. **Mitigation & Sunder:**
   $$\text{Mitigation}_{\text{eff}, P} = \begin{cases} 0 & \text{if } P\text{'s Stance is OVERCHARGE} \\ \lfloor \text{Mitigation}_P \times 0.5 \rfloor & \text{if Opponent burned Club (Sunder)} \\ \text{Mitigation}_P & \text{otherwise} \end{cases}$$
   $$\text{Barrier}_{\text{eff}, P} = \begin{cases} \lfloor \text{Barrier}_P \times 0.5 \rfloor & \text{if Opponent burned Club (Sunder)} \\ \text{Barrier}_P & \text{otherwise} \end{cases}$$

3. **Net Damage to Defender:**
   $$\text{NetDmg}_{D} = \max\Big(0, \, \text{Round}(\text{RankVal}(H_A) \times M_{\text{stance}, A}) - \text{Mitigation}_{\text{eff}, D} - \text{Barrier}_{\text{eff}, D}\Big)$$

4. **Parry Reflection:**
   If defender $D$ selected `PARRY` and attacker did not deploy `SPADE_VEIL`:
   - If attacker selected `OVERCHARGE` OR attacker assault tier is `PAIR` or `HIGH_CARD`:
     $$\text{ReflectedDmg}_{A} = \text{Round}(\text{RawDmg}_{A} \times 0.5)$$

5. **Damage Application & Siphon Recovery:**
   $$\text{TotalDmg}_{D} = \text{NetDmg}_{D} + \text{ReflectedDmg}_{D}$$
   $$\text{GuardHP}_{D, \text{new}} = \max\Big(0, \, \text{GuardHP}_{D} - \text{TotalDmg}_{D}\Big)$$
   - *Heart Siphon Seed:* If attacker burned Heart, $\text{NetDmg}_{D} > 0$, and attacker survived incoming damage ($\text{GuardHP}_{A} > 0$), attacker recovers $\lfloor \text{NetDmg}_{D} \times 0.5 \rfloor$ Guard HP (capped at starting 20 HP). Siphon does not resurrect a combatant reduced to 0 HP by incoming damage. *(Refined via automated playtesting).*

6. **Option A Round Knockout & Exchange Cap Rules:**
   - If $\text{HP}_1 = 0$ and $\text{HP}_2 > 0$: Player 2 wins the round (`isRoundOver: true`).
   - If $\text{HP}_2 = 0$ and $\text{HP}_1 > 0$: Player 1 wins the round (`isRoundOver: true`).
   - If $\text{HP}_1 = 0$ and $\text{HP}_2 = 0$ (simultaneous lethal):
     - Highest assault hand `score` wins the round.
     - If scores are identical, sudden death triggers ($\text{HP}_1 = 1, \text{HP}_2 = 1, \text{isRoundOver: false}$).
   - **Exchange Cap (Safety Limit):**
     - A round allows up to 10 normal exchanges (`MAX_EXCHANGES_PER_ROUND = 10`), followed by sudden-death exchanges if necessary.
     - If Exchange 10 completes without a knockout ($\text{HP}_1 > 0$ and $\text{HP}_2 > 0$):
       - If $\text{HP}_1 \ne \text{HP}_2$, the player with higher remaining Guard HP wins the round (`isRoundOver: true`).
       - If $\text{HP}_1 = \text{HP}_2$, Sudden Death begins on Exchange 11: both combatants' Guard HP is set to $1$. On Exchange 11 and later, compare outgoing net Assault damage (`NetDmg`, excluding reflected damage and before Siphon recovery), then 3-card Assault `score`, then 2-card Aegis `score`. This ordering takes precedence over normal knockout handling. An exact tie awards no point: both players remain at 1 HP and play another sudden-death exchange (user decision, 2026-10-03).
   - The pure `resolveCombatRound` calculator owns these winner rules; `MatchEngine` applies the result, updates round wins, and starts the next exchange. Tied Exchange 10 HP remains visible through reveal/resolve; `MatchEngine.startExchange` sets both players to 1 HP when starting Exchange 11.
   - If both players remain $> 0$ HP and exchange $< 10$: Round continues (`isRoundOver: false`, `roundWinnerId: null`). Guard HP carries over into the next exchange!

## 5. Invariants & Edge Cases
1. Ranks must be numerically typed (avoid literal inference from `as const`).
2. Siphon heal cannot raise Guard HP above 20 and cannot resurrect a combatant reduced to 0 HP.
3. Overcharge sets the combatant's own Aegis mitigation to 0 (zero defense), but their active barrier still absorbs damage unless shredded by Sunder.

## 6. Forbidden Changes
- Do NOT modify the hand tier damage numbers (18, 14, 10, 8, 5, 2) or mitigation values (8, 4, 2).

## 7. Test Specifications
- `evaluator.test.ts`:
  - Validates all 6 assault hand tiers.
  - Tests Ace-low wheel straight (`A-2-3`) and Ace-high straight (`Q-K-A`).
  - Tests all 3 aegis tiers (Pair, Suited, High Card).
  - Tests lexicographical tie-breakers for equal tiers.
- `combat.test.ts`:
  - Tests standard Brace vs Brace non-lethal exchange.
  - Tests Overcharge lethal knockout.
  - Tests Parry reflection against Overcharge read.
  - Tests Club Sunder 50% defense shred.
  - Tests Spade Veil suppression of Overcharge.
  - Tests Heart Siphon Guard HP recovery.

## 8. Exact Verification Command
```bash
npx vitest run packages/server/src/__tests__/evaluator.test.ts packages/server/src/__tests__/combat.test.ts
```

## 9. Codex Dispatch Prompt
```markdown
### Codex Task: Poker Evaluator & Combat Calculator (Spec-02)
Implement/refactor `packages/shared/src/pokerEvaluator.ts` and `combatCalculator.ts` to match the target contracts and formulas in `docs/agent_specs/spec-02-poker-evaluator.md`.

Target files:
- `packages/shared/src/pokerEvaluator.ts`
- `packages/shared/src/combatCalculator.ts`
- `packages/server/src/__tests__/evaluator.test.ts`
- `packages/server/src/__tests__/combat.test.ts`

Requirements:
1. Combinatorial evaluation of 3-card Assault hands and 2-card Aegis mitigation hands.
2. Calculate Option A combat math: Stance multipliers, Parry reflection (against Overcharge or weak hands), and all 4 tactical burns.
3. Run verification: `npx vitest run packages/server/src/__tests__/evaluator.test.ts packages/server/src/__tests__/combat.test.ts`.
```

## 10. Definition of Done Checklist
- [x] Deterministic 3-card and 2-card poker evaluator implemented.
- [x] Ace-low wheel straight (A-2-3) and Ace-high straight (Q-K-A) handled.
- [x] Stance matrix (Brace, Overcharge, Parry) fully operational.
- [x] Tactical burns (Veil, Barrier, Siphon, Sunder) fully operational.
- [x] All evaluator and combat unit tests pass with code 0.

### Dispatch verification (2026-10-03)
- Shared NodeNext build and declaration/map output verified; public contracts,
  constants, package exports, and explicit `.js` imports audited.
- Spec-02 command: 67 tests passed (28 evaluator, 39 combat), covering exact scores,
  input immutability, stance/burn interactions, knockouts, cap and sudden death.
- Repository gate: `npm run build && npm test && npm run sim` passed;
  76 tests total and 300 seeded matches. Existing Vite chunk-size warning remains.
