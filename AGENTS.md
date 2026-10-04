# AGENTS.md: OpenAI Codex Workflow & Implementation Guide

Welcome, **OpenAI Codex**! This document serves as your operational blueprint, coding standard, and workflow guide for the **CYBERANTE** repository.

---

## 1. Role & Operating Philosophy

- **Your Role:** You are the **Implementation Specialist**. 
- **Architectural Ground Truth:** The architecture, mathematical models, and feature specifications have already been designed and verified in [`docs/cyberante_design_document.md`](docs/cyberante_design_document.md) and the 10 specifications in [`docs/agent_specs/`](docs/agent_specs/).
- **Specs are Targets:** The specs represent the authoritative contract layer. Existing code must be refactored to conform to the target signatures, behavior, and invariants defined in the specs.
- **Execution Principle:** You do not need to invent new architectures or deviate from the specs. Execute dispatches against individual specs, refactor/implement target files, write unit tests, and verify that the monorepo builds and tests pass cleanly with zero diagnostics.

---

## 2. Monorepo Architecture Overview

CYBERANTE is an NPM workspaces monorepo using TypeScript with strict NodeNext ESM:

```
cyberante/
├── docs/
│   ├── cyberante_design_document.md   # Architectural blueprint
│   └── agent_specs/                   # 10 Granular Agent Specs (Spec-01 to Spec-10)
├── packages/
│   ├── shared/                        # Zero-dependency TypeScript models & math
│   │   ├── src/
│   │   │   ├── types.ts               # Core interfaces, network messages, enums
│   │   │   ├── constants.ts           # Game constants, suit rings, timing
│   │   │   ├── pokerEvaluator.ts      # 3-card and 2-card poker evaluation
│   │   │   ├── combatCalculator.ts    # Stance multipliers, burns, combat resolution
│   │   │   ├── fluxEngine.ts          # Pip Nudge, Suit Bleed, Burn-to-Cast
│   │   │   ├── MatchEngine.ts         # Deterministic pure state machine & PRNG
│   │   │   └── ai/                    # ClassicalBotAI & BotProfiles
│   ├── server/                        # Authoritative Node.js WebSocket Server
│   │   ├── src/
│   │   │   ├── Deck.ts                # CSPRNG 52-card deck & Fisher-Yates shuffle
│   │   │   ├── Room.ts                # Room state machine & countdown timers
│   │   │   ├── RoomManager.ts         # Room lifecycle & code allocation
│   │   │   ├── index.ts               # HTTP static serving & WS connection handler
│   │   │   └── __tests__/             # Unit tests & headless balance simulator
│   └── client/                        # Vite + Three.js + Web Audio Web Application
│       ├── src/
│       │   ├── main.ts                # Game controller & mode router
│       │   ├── net/NetworkClient.ts   # WebSocket client wrapper
│       │   ├── ui/                    # Vanilla TS DOM overlays (HUD, Menu, Rules)
│       │   ├── render/                # Three.js vector scene, grid & particles
│       │   ├── audio/                 # Procedural Web Audio synthwave & SFX
│       │   └── tutorial/              # Interactive 4-lesson tutorial manager
└── package.json                       # Root workspaces configuration
```

---

## 3. The 5-Step Codex Dispatch Workflow

When assigned a task or spec, execute the following systematic procedure:

```
┌────────────────────────────────────────────────────────┐
│ 1. Read Target Spec in docs/agent_specs/spec-XX-*.md  │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 2. Check Core Invariants & Target Signatures           │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 3. Implement / Refactor Target Files & Unit Tests      │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 4. Run Spec Verification & Monorepo Test Gates         │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ 5. Audit & Check Off Definition of Done Checklist      │
└────────────────────────────────────────────────────────┘
```

### Step 1: Read the Target Spec
Before writing code, view the target spec in [`docs/agent_specs/`](docs/agent_specs/):
- **Section 2:** Target files and allowed dependencies.
- **Section 3:** Required public API signatures and data structures.
- **Section 4:** Detailed algorithms, formulas, and state transitions.
- **Section 5 & 6:** Invariants, edge cases, and forbidden boundaries.
- **Section 9:** The explicit Codex prompt for that spec.

### Step 2: Check Core Invariants
Verify that your planned implementation complies with the non-negotiable invariants:
1. **ESM Relative Imports (`.js` extension):**
   In `packages/shared` and `packages/server`, **EVERY** relative TypeScript import must include the explicit `.js` extension:
   ```typescript
   // CORRECT:
   import { Card, Suit } from './types.js';
   import { Deck } from './Deck.js';

   // FORBIDDEN (Breaks NodeNext ESM resolution):
   import { Card, Suit } from './types';
   ```
2. **Zero External Media Assets:**
   Never import raster image files (`.png`, `.jpg`, `.webp`), 3D models (`.gltf`, `.glb`), or audio files (`.mp3`, `.wav`, `.ogg`). The client is 100% procedural:
   - Graphics: Three.js vector lines, particle buffers, GLSL shaders.
   - Audio: Native Web Audio API oscillators, filters, noise nodes.
3. **Option A Multi-Exchange Bo3 Match Invariant:**
   - Match format: Best-of-3 Rounds (`ROUNDS_TO_WIN = 2`).
   - Starting Guard HP: 20 per round.
   - Rounds continue across sequential 30–40s exchanges until a player reaches 0 HP.
   - Guard HP carries over across exchanges within the same round; resets to 20 on a new round.
4. **Deterministic PRNG:**
   Inside `packages/shared` (AI, simulations, MatchEngine), never call unseeded `Math.random()`. Inject `PRNG` (use `SeededPRNG` for deterministic replays).
5. **No Trademarked Title:**
   Do NOT use the title "Geometry Wars" in comments, UI, or documentation. Refer to the aesthetic as "Reactive Neon Vector" or "retro-arcade vector display".

### Step 3: Implement / Refactor Code & Unit Tests
- Refactor target files to conform to the TypeScript signatures in Section 3 of the spec.
- Write unit tests under `packages/server/src/__tests__/` (or spec-specific test paths) covering standard execution, boundary values, and error states.

### Step 4: Run Verification Commands
Execute the spec verification command from Section 8 of the spec, followed by the repository-wide gate:
```bash
# 1. Spec-specific test:
npx vitest run packages/server/src/__tests__/<target_test>.test.ts

# 2. Monorepo-wide verification gate:
npm run build && npm test && npm run sim
```

### Step 5: Audit Definition of Done
Ensure every item in Section 10 ("Definition of Done Checklist") of the spec is fully satisfied and check them off.

---

## 4. Recommended Vertical-Slice Dispatch Sequence

To de-risk the project early and maintain a working vertical slice at all times, execute dispatches in this sequence:

```
┌────────────────────────────────────────────────────────┐
│ Phase 1: Core Engine & Math Foundation                 │
│   1. Spec-01: Shared Contracts & Interface Defs       │
│   2. Spec-02: Poker Evaluator & Combat Calculator      │
│   3. Spec-03: Deck Shuffling & Flux Transmutations     │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Phase 2: Authority & Pacing Engine                     │
│   4. Spec-04: Authoritative WebSocket Server & Rooms  │
│   5. Spec-05: Classical Bot AI & Balance Simulator    │
│   6. Spec-10: E2E Integration & Universal Deployment  │
│      (Playable Vertical Slice Available Here!)         │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│ Phase 3: Tactical Experience & Polish                  │
│   7. Spec-08: Client Tactical UI & Split-Lane HUD      │
│   8. Spec-06: Procedural Web Audio Engine              │
│   9. Spec-07: Reactive Neon Vector Renderer            │
│  10. Spec-09: Interactive Tutorial & Rules Modal       │
└────────────────────────────────────────────────────────┘
```

---

## 5. Spec Directory & Module Quick-Reference

| Spec | Target Files | Primary Focus | Verification Command |
|---|---|---|---|
| [`spec-01-shared-contracts.md`](docs/agent_specs/spec-01-shared-contracts.md) | `packages/shared/src/types.ts`, `constants.ts` | Ground-truth models, network messages, enums | `npm --workspace=packages/shared run build` |
| [`spec-02-poker-evaluator.md`](docs/agent_specs/spec-02-poker-evaluator.md) | `packages/shared/src/pokerEvaluator.ts`, `combatCalculator.ts` | 3-Card/2-Card evaluator & Option A combat math | `npx vitest run src/__tests__/evaluator.test.ts src/__tests__/combat.test.ts` |
| [`spec-03-deck-flux-engine.md`](docs/agent_specs/spec-03-deck-flux-engine.md) | `packages/server/src/Deck.ts`, `packages/shared/src/fluxEngine.ts` | CSPRNG Deck, Ace-wrap Nudge, Suit Bleed, Burns | `npx vitest run packages/server/src/__tests__/deckFlux.test.ts` |
| [`spec-04-authoritative-server.md`](docs/agent_specs/spec-04-authoritative-server.md) | `packages/server/src/Room.ts`, `RoomManager.ts`, `index.ts` | WebSocket state machine, timers, client serving | `npx vitest run packages/server/src/__tests__/roomLifecycle.test.ts` |
| [`spec-05-classical-bot-ai.md`](docs/agent_specs/spec-05-classical-bot-ai.md) | `packages/shared/src/ai/ClassicalBotAI.ts`, `BotProfiles.ts` | Deterministic 10-split AI (Cipher, Aggro, Wall) | `npm run sim` |
| [`spec-06-procedural-audio-engine.md`](docs/agent_specs/spec-06-procedural-audio-engine.md) | `packages/client/src/audio/AudioEngine.ts`, `ProceduralMusic.ts` | Web Audio synthwave arpeggiator & dynamic SFX | `npm --workspace=packages/client run build` |
| [`spec-07-neon-vector-renderer.md`](docs/agent_specs/spec-07-neon-vector-renderer.md) | `packages/client/src/render/VectorScene.ts`, `ReactiveGrid.ts` | Three.js reactive wireframe grid & particles | `npm --workspace=packages/client run build` |
| [`spec-08-client-game-ui.md`](docs/agent_specs/spec-08-client-game-ui.md) | `packages/client/src/ui/GameBoardOverlay.ts`, `MainMenuOverlay.ts` | Split-lane HUD, Auto-Split helper, Stances | `npm --workspace=packages/client run build` |
| [`spec-09-interactive-tutorial.md`](docs/agent_specs/spec-09-interactive-tutorial.md) | `packages/client/src/tutorial/TutorialManager.ts`, `RulesModal.ts` | 4-lesson interactive tutorial & floating rules | `npm --workspace=packages/client run build` |
| [`spec-10-e2e-integration-deploy.md`](docs/agent_specs/spec-10-e2e-integration-deploy.md) | `packages/client/src/main.ts`, `packages/client/src/net/NetworkClient.ts` | Monorepo wiring, universal single-port serving | `npm run build && npm test && npm run sim` |

---

## 6. Development & Verification CLI Commands

All development commands are executed from the repository root:

```bash
# Install dependencies (Node >= 20.0.0 required)
npm install

# Build all packages in dependency order (shared -> server -> client)
npm run build

# Run unit and integration tests across the monorepo
npm test

# Run the 300-match headless balance simulator
npm run sim

# Start development servers concurrently
npm run dev:server    # Server watch mode on port 8080
npm run dev:client    # Vite dev server with hot reload

# Run production server
npm run start
```

---

## 7. Coding Standards & Conventions

### 7.1 TypeScript & Module Discipline
- Strict type checking enabled (`"strict": true` in `tsconfig.json`).
- Avoid `any`. Use strict union types, branded types, or type assertions with checks.
- Zero cyclic dependencies between packages:
  - `packages/shared` has zero internal or external workspace dependencies.
  - `packages/server` imports `@cyberante/shared`.
  - `packages/client` imports `@cyberante/shared`.

### 7.2 Combat Math & Option A Rules Reference
- **Hand Tiers & Damage (3-Card Assault):**
  - `STRAIGHT_FLUSH`: 18 Base Damage
  - `THREE_OF_A_KIND`: 14 Base Damage
  - `STRAIGHT`: 10 Base Damage
  - `FLUSH`: 8 Base Damage
  - `PAIR`: 5 Base Damage
  - `HIGH_CARD`: 2 Base Damage
- **Mitigation (2-Card Aegis):**
  - `PAIR`: 8 Block
  - `SUITED`: 4 Block
  - `HIGH_CARD`: 2 Block
- **Stance Multipliers:**
  - `BRACE`: $1.0\times$ damage.
  - `OVERCHARGE`: $2.0\times$ damage (defender Aegis mitigation reduced to 0).
  - `PARRY`: $0.5\times$ damage; reflects $50\%$ incoming raw damage if opponent Overcharges OR if opponent's assault hand is weak (`PAIR` or `HIGH_CARD`). *(Refined via automated playtesting).*
- **Tactical Burns:**
  - `SPADE_VEIL`: Suppresses opponent Overcharge and Parry reflect.
  - `DIAMOND_BARRIER`: Adds temporary damage shield ($11$ for Ace, $10$ for Face, pip value for $2 \dots 9$).
  - `HEART_SIPHON`: Heals $50\%$ net damage dealt (capped at 20 HP). Does not resurrect a combatant reduced to 0 HP by incoming damage. *(Refined via automated playtesting).*
  - `CLUB_SUNDER`: Shreds defender effective Aegis and Barrier by $50\%$.

### 7.3 Security & Anti-Cheat Invariants
- State calculations and combat resolution are **strictly authoritative** on the server.
- The server never transmits the opponent's card ranks or suits in `STATE_TICK` messages during the `DEAL`, `SHAPING`, or `COMMITMENT` phases. Opponent cards are revealed only during `CLASH_REVEAL`.

---

## 8. Common Pitfalls & How to Avoid Them

| Pitfall | Consequence | Correct Action |
|---|---|---|
| Omitting `.js` on relative imports | Runtime crash under NodeNext ESM (`ERR_MODULE_NOT_FOUND`) | Always write `import ... from './file.js';` |
| Calling unseeded `Math.random()` in AI | Non-deterministic test runs and flaky simulations | Pass `prng: PRNG` (use `SeededPRNG`) |
| Importing external media files | Bundle bloat & violates zero-asset contest criteria | Generate all graphics via Three.js and audio via Web Audio |
| Hardcoding `localhost:8080` in client | Breaks production deployments behind proxies/domains | Use dynamic `window.location.host` and `ws:`/`wss:` |
| Modifying hand damage/mitigation values | Breaks game balance and fails simulation thresholds | Keep constants locked to `GAME_CONSTANTS` in `constants.ts` |
| Mentioning "Geometry Wars" | Violates naming guideline | Use "Reactive Neon Vector" or "retro-arcade vector display" |

---

## 9. Definition of Done for Any Codex Task

A task or dispatch is complete **only** when:
1. Target files conform to the TypeScript signatures in the corresponding spec.
2. Relevant unit tests pass under `vitest`.
3. The full monorepo verification command exits with code 0:
   ```bash
   npm run build && npm test && npm run sim
   ```
4. Git working directory remains clean without stray temporary files.
