# SPEC-01: Shared Contracts & Interface Definitions

## 1. Goal & Non-Goals
- **Goal:** Define the single ground-truth contract layer for the CYBERANTE monorepo, covering data models, enumerations, game constants, network protocol messages, and combat resolution interfaces.
- **Non-Goals:** Do not implement network sockets, DOM UI rendering, or Web Audio synthesis in this package.

## 2. Inputs & Dependencies
- **Target Files:**
  - `packages/shared/src/types.ts`
  - `packages/shared/src/constants.ts`
  - `packages/shared/src/index.ts`
- **Dependencies:** Zero external runtime dependencies. Compiles strictly under TypeScript `NodeNext` ESM mode.

## 3. Public API & Contracts

### 3.1 Card Primitives & Enums
```typescript
export type Suit = 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS';

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; 
// 11 = Jack, 12 = Queen, 13 = King, 14 = Ace

export interface Card {
  id: string;   // Unique card identifier, e.g. "c_12_S14"
  suit: Suit;
  rank: Rank;
}

export type Stance = 'BRACE' | 'OVERCHARGE' | 'PARRY';

export type HandTier3 =
  | 'STRAIGHT_FLUSH'
  | 'THREE_OF_A_KIND'
  | 'STRAIGHT'
  | 'FLUSH'
  | 'PAIR'
  | 'HIGH_CARD';

export type HandTier2 =
  | 'PAIR'
  | 'SUITED'
  | 'HIGH_CARD';

export type BurnType = 'SPADE_VEIL' | 'DIAMOND_BARRIER' | 'HEART_SIPHON' | 'CLUB_SUNDER';

export interface BurnResult {
  burnType: BurnType;
  cardBurned: Card;
  replacementCard: Card;
  barrierAdded?: number;
}

export interface PlayerPublicState {
  playerId: string;
  name: string;
  guardHp: number;
  fluxRemaining: number;
  roundWins: number;
  hasBurnedCard: boolean;
  activeBurn: BurnType | null;
  hasCommitted: boolean;
  activeBarrier: number;
  connected: boolean;
}

export interface PlayerPrivateState extends PlayerPublicState {
  cards: Card[];
  assaultCardIds: [string, string, string] | null;
  aegisCardIds: [string, string] | null;
  chosenStance: Stance | null;
}

export type GamePhase =
  | 'LOBBY_WAIT'
  | 'DEAL'
  | 'SHAPING'
  | 'COMMITMENT'
  | 'CLASH_REVEAL'
  | 'ROUND_RESOLVE'
  | 'MATCH_OVER';
```

### 3.2 Evaluation & Resolution Types
```typescript
export interface HandEvaluation3 {
  tier: HandTier3;
  baseDamage: number;
  score: number; // Lexicographical tie-breaker value
  description: string;
  cards: [Card, Card, Card];
}

export interface HandEvaluation2 {
  tier: HandTier2;
  mitigation: number;
  score: number; // Lexicographical tie-breaker value
  description: string;
  cards: [Card, Card];
}

export interface RoundResolution {
  exchangeNumber: number;
  roundNumber: number;
  isRoundOver: boolean;

  p1PlayerId: string;
  p2PlayerId: string;

  p1Assault: [Card, Card, Card];
  p1Aegis: [Card, Card];
  p1Stance: Stance;
  p1Eval3: HandEvaluation3;
  p1Eval2: HandEvaluation2;
  p1Burn: BurnType | null;

  p2Assault: [Card, Card, Card];
  p2Aegis: [Card, Card];
  p2Stance: Stance;
  p2Eval3: HandEvaluation3;
  p2Eval2: HandEvaluation2;
  p2Burn: BurnType | null;

  p1RawDamage: number;
  p2RawDamage: number;
  p1NetDamageReceived: number;
  p2NetDamageReceived: number;
  p1ReflectedDamage: number;
  p2ReflectedDamage: number;
  p1SiphonHeal: number;
  p2SiphonHeal: number;
  p1HpRemaining: number;
  p2HpRemaining: number;

  roundWinnerId: string | null;
  matchWinnerId: string | null;
}
```

### 3.3 Network Protocol Messages
```typescript
export type ClientMessage =
  | { type: 'CMD_CREATE_ROOM'; playerName: string }
  | { type: 'CMD_JOIN_ROOM'; roomCode: string; playerName: string }
  | { type: 'CMD_RECONNECT'; roomCode: string; playerId: string; sessionToken: string }
  | { type: 'CMD_NUDGE_RANK'; cardId: string; direction: 'UP' | 'DOWN' }
  | { type: 'CMD_BLEED_SUIT'; cardId: string; targetSuit: Suit }
  | { type: 'CMD_BURN_CAST'; cardId: string }
  | { type: 'CMD_READY' }
  | {
      type: 'CMD_COMMIT_HAND';
      assaultCardIds: [string, string, string];
      aegisCardIds: [string, string];
      stance: Stance;
    }
  | { type: 'CMD_REMATCH' };

export type ServerMessage =
  | { type: 'STATE_INIT'; playerId: string; matchId: string; roomCode: string; opponentName: string; sessionToken?: string }
  | {
      type: 'STATE_TICK';
      phase: GamePhase;
      timeRemainingMs: number;
      roundNumber: number;
      exchangeNumber: number;
      players: Record<string, PlayerPublicState>;
      selfCards: Card[];
    }
  | {
      type: 'ROUND_OUTCOME';
      resolution: RoundResolution;
    }
  | { type: 'ERROR_REJECTED'; reason: string };
```

### 3.4 Classical Bot & Solo Mode Types
```typescript
export type BotPersonality = 'CIPHER_ZERO' | 'VEKTOR_AGGRO' | 'AEGIS_WALL';

export interface BotNudgeAction {
  cardId: string;
  direction: 'UP' | 'DOWN';
}

export interface BotDecision {
  fluxActions: Array<{
    type: 'NUDGE' | 'BLEED';
    cardId: string;
    direction?: 'UP' | 'DOWN';
    targetSuit?: Suit;
  }>;
  burnCardId?: string;
  assaultCardIds: [string, string, string];
  aegisCardIds: [string, string];
  stance: Stance;

  // Required Spec-05 card/stance fields plus optional shaping decisions
  nudges?: BotNudgeAction[];
  cardToBurn?: Card | null;
  assaultCards: [Card, Card, Card];
  aegisCards: [Card, Card];
  chosenStance: Stance;
}
```

## 4. Game Constants Specification
In `packages/shared/src/constants.ts`:
| Constant | Value | Purpose |
|---|---|---|
| `STARTING_GUARD_HP` | `20` | Guard HP pool allocated at the start of each round |
| `STARTING_FLUX` | `3` | Flux currency per exchange for transmutations |
| `BEST_OF_ROUNDS` | `3` | Match format (Bo3) |
| `ROUNDS_TO_WIN` | `2` | Round wins required to secure match victory |
| `MAX_EXCHANGES_PER_ROUND` | `10` | Safety limit before sudden-death resolution: If Exchange 10 completes with both HP > 0, higher HP wins. If tied, Exchange 11 Sudden Death (1 HP each, higher net damage wins, tiebroken by assault score then aegis score; exact ties repeat sudden death at 1 HP with no point awarded). |
| `DEAL_TIME_MS` | `2000` | Dealing animation phase duration |
| `SHAPING_TIME_MS` | `15000` | Tactical card transmutation phase |
| `COMMITMENT_TIME_MS` | `10000` | Blind hand splitting and stance lock-in phase |
| `CLASH_REVEAL_TIME_MS` | `4000` | Reveal, shockwave, and particle animation phase |
| `ROUND_RESOLVE_TIME_MS` | `3000` | Damage tally and round/match win determination |
| `FLUX_COST_NUDGE` | `1` | Flux required to increment or decrement card rank |
| `FLUX_COST_BLEED` | `2` | Flux required to transmute card suit |

### Suit Ring Adjacencies & UI Constants
- `SUIT_RING`: Cyclic ring mapping each suit to its two immediate neighbors:
  - `SPADES`: `['CLUBS', 'HEARTS']`
  - `CLUBS`: `['SPADES', 'DIAMONDS']`
  - `DIAMONDS`: `['CLUBS', 'HEARTS']`
  - `HEARTS`: `['DIAMONDS', 'SPADES']`
- `SUIT_GLYPHS`: `{ SPADES: '♠', HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣' }`
- `SUIT_COLORS`: `{ SPADES: '#00f3ff', CLUBS: '#00ff88', DIAMONDS: '#ffb700', HEARTS: '#ff0055' }`

## 5. Invariants & Edge Cases
1. **Module System Compliance:** Every relative import/export statement in `packages/shared/src/` must specify the explicit `.js` file extension (e.g. `import { Suit } from './types.js';`).
2. **Package Configuration:** `packages/shared/package.json` must specify `"type": "module"` and provide an `"exports"` block mapping `"."` to `./dist/index.js` and `./dist/index.d.ts`.
3. **Immutability:** Types in this package serve as the frozen ground-truth contract for server, client, and test suites.

## 6. Forbidden Changes
- Do NOT install external runtime dependencies in `packages/shared`.
- Do NOT import from `packages/server` or `packages/client`.

## 7. Test Specifications
- Verify that `tsc` compiles `packages/shared` with zero diagnostics, emitting clean `.d.ts` declaration maps and `.js` ESM modules into `dist/`.

## 8. Exact Verification Command
```bash
npm --workspace=packages/shared run build
```

## 9. Codex Dispatch Prompt
```markdown
### Codex Task: Shared Contracts (Spec-01)
Implement/refactor `packages/shared/src/types.ts` and `constants.ts` to strictly match the target contracts and enums in `docs/agent_specs/spec-01-shared-contracts.md`.

Target files:
- `packages/shared/src/types.ts`
- `packages/shared/src/constants.ts`
- `packages/shared/src/index.ts`

Requirements:
1. Define all card primitives, hand evaluation interfaces, network protocol messages, and Option A constants.
2. Ensure all relative imports use explicit `.js` extensions for NodeNext ESM compatibility.
3. Run verification: `npm --workspace=packages/shared run build`.
```

## 10. Definition of Done Checklist
- [x] All card, hand, stance, and phase types defined.
- [x] All client and server network messages defined.
- [x] Game constants, suit ring adjacencies, glyphs, and colors defined.
- [x] Compiles with zero errors under `npm --workspace=packages/shared run build`.

### Dispatch verification (2026-10-03)
- Shared NodeNext build and declaration/map output verified; public contracts,
  constants, package exports, and explicit `.js` imports audited.
- Spec-02 command: 67 tests passed (28 evaluator, 39 combat), covering exact scores,
  input immutability, stance/burn interactions, knockouts, cap and sudden death.
- Repository gate: `npm run build && npm test && npm run sim` passed;
  76 tests total and 300 seeded matches. Existing Vite chunk-size warning remains.
