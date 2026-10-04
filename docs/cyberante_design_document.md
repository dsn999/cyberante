# TECHNICAL DESIGN SPECIFICATION: CYBERANTE
**Project Codename:** CYBERANTE (Procedural Vector Poker-Combat Matrix)  
**Target Event:** Handshake AI Skills Studio × OpenAI Multiplayer Game Challenge  
**Platform Target:** Universal Web (Zero-Install Cross-Platform: Desktop / Mobile / Tablet)  
**Host & Dev Environment:** WSL2 Ubuntu (POSIX Native Toolchains, Node.js, WebSockets, TypeScript)  
**Development Methodology:** Spec-Driven Agentic Implementation (Typed Stubs + OpenAI Codex)  
**Document Role:** System Architecture Blueprint (Architect: AI / Project Manager: User)

---

## 1. Executive Summary & Contest Alignment

### 1.1 Core Vision
`CYBERANTE` is a high-speed, head-to-head tactical card-battler that fuses the combinatorial hand-building of five-card poker with the dynamic reads, stances, and counter-play of fighting games. Two players (or one player versus an offline classical game AI) engage in rapid, simultaneous rounds structured under a Best-of-3 (Bo3) match format. 

Built entirely with zero external media dependencies, `CYBERANTE` features code-driven neon vector graphics inspired by retro-arcade vector displays, dynamic warping gravity grids, particle explosions, and a real-time procedural Web Audio synthesizer.

### 1.2 Handshake × OpenAI Contest Rubric Alignment
The project is engineered specifically to capture the maximum score (5/5) across all four official evaluation criteria:

| Evaluation Criteria (Weight) | Contest 5/5 Standard | Architectural Implementation in CYBERANTE |
| :--- | :--- | :--- |
| **Execution (25%)** | *Exceeds project requirements; fully functional, stable, and demo-ready end-to-end.* | Authoritative TypeScript state machine over low-latency WebSockets. Strict input validation, zero client-side trust, deterministic CSPRNG card resolution, and automated end-to-end headless integration test suites. |
| **Creativity (25%)** | *Fresh concept, unexpected use case, or particularly clever implementation.* | Replaces passive turn-based card drawing with high-agency tactical mechanics: **Flux** pip transmutation, **Burn-to-Cast** tactical discards, **Split-Lane Commitment** (3-Card Assault vs. 2-Card Aegis), and blind simultaneous **Stance Clashes**. |
| **Usefulness / Value (25%)** | *Highly compelling — meaningfully serves its purpose or delights its intended audience.* | Zero-friction, URL-accessible instant play. Zero bundle bloat (no heavy PNGs, MP3s, or GLTFs). Solves the "empty lobby" contest judging hazard by offering both instantaneous multiplayer room matchmaking and an offline **Solo Mode vs. Classical AI**. |
| **Polish & Thoughtfulness (25%)** | *Feels intentional and 'real,' with thoughtful details, edge cases, and clear guidance.* | Reactive neon warp grid, audio-visual synergy (sound synthesis coupled to canvas distortion and bloom), an **Interactive Step-by-Step Tutorial**, and resilient disconnect/auto-resolve timeouts. |

---

## 2. Gameplay Mechanics & State System

### 2.1 Match Structure
*   **Match Format:** Best-of-3 (Bo3) Rounds. The first combatant to secure 2 Round Points wins the match.
*   **Round Guard:** Each player begins each round with $20 \text{ Guard HP}$. Guard resets between rounds.
*   **Round Pacing:** Discrete phases enforcing a strict $30\text{--}40\text{ second}$ pacing per round to maintain high adrenaline and decisive play.

### 2.2 Deck & Hand Architecture
*   **Card Pool:** Single standard 52-card deck, shuffled deterministically via server-side CSPRNG seeds (or client-side CSPRNG seed in local solo mode).
*   **Starting Hand:** Both players are dealt 5 private cards per round.
*   **Tactical Currency (Flux):** Both players receive $3 \text{ Flux}$ points per round to fuel card transmutations. Unspent Flux does not roll over.

### 2.3 Round Phase Progression

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DEAL PHASE (Server Authoritative / CSPRNG)               │
│    5 Cards dealt per player + 3 Flux allocated              │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 2. SHAPING PHASE (15s Countdown, Simultaneous)              │
│    • Flux Transmutation (Nudge Rank ±1 / Shift Suit)        │
│    • Burn-to-Cast Discard (Consume 1 card for tactical buff)│
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 3. COMMITMENT PHASE (10s Countdown, Blind Simultaneous)     │
│    • Split Hand: Assault Line (3 Cards) + Aegis Line (2 Cards)│
│    • Select Stance: Brace (Standard) / Overcharge / Parry   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 4. CLASH & RESOLUTION (Deterministic Engine)                │
│    • Simultaneous Hand & Stance Reveal                      │
│    • Reactive Neon Shockwave Grid Distortion & Particle FX  │
│    • Hand Scoring & Stance Matrix Calculation               │
│    • Damage Application, Guard Depletion, Round Point Check │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 Deep Agency Mechanics

#### A. Flux Transmutations
Players manipulate hand entropy by expending their 3 Flux points:
*   **Pip Nudge ($1 \text{ Flux}$):** Increment or decrement a card's rank by $1$ (e.g., $7 \rightarrow 8$ or $K \rightarrow Q$). Rank transitions wrap around Ace ($A \leftrightarrow 2$ and $K \leftrightarrow A$).
*   **Suit Bleed ($2 \text{ Flux}$):** Transmute a card's suit into an adjacent suit along the chromatic ring:
    $$\text{Spades} \longleftrightarrow \text{Clubs} \longleftrightarrow \text{Diamonds} \longleftrightarrow \text{Hearts}$$

#### B. Burn-to-Cast (Tactical Discard)
A player may discard a single card from their hand to activate an immediate tactical power, instantly drawing one replacement card from the deck (maximum 1 burn per round):
*   **Burn Spade:** *Static Veil* — Obfuscates 1 of your Assault cards during the clash and disables the opponent's active stance multiplier.
*   **Burn Diamond:** *Hard Barrier* — Adds a flat absorption barrier equal to the card's numerical pip value to the Aegis Line:
    $$\text{Barrier} = \text{Pip}(\text{Card}) \quad (\text{Face cards} = 10, \, A = 11)$$
*   **Burn Heart:** *Siphon Seed* — If your Assault hand successfully deals unmitigated damage, convert $50\%$ of damage dealt directly into Round Guard recovery.
*   **Burn Club:** *Sunder* — Instantly negates the opponent's active Aegis shield mitigation by $50\%$.

#### C. Split-Lane Commitment
Players partition their 5 cards into two operational lines:
*   **Assault Line (3 Cards):** Evaluated using 3-Card Poker ranking rules:
    $$\text{Straight Flush} > \text{Three of a Kind} > \text{Straight} > \text{Flush} > \text{Pair} > \text{High Card}$$
*   **Aegis Line (2 Cards):** Evaluated using 2-Card Mitigation rules:
    $$\text{Pair} > \text{Suited High Card} > \text{Offsuit High Card}$$

#### D. Tactical Stance Matrix
Players declare a blind combat stance alongside card placement:

| Stance | Offensive Multiplier | Defensive Vulnerability | Special Rule |
| :--- | :--- | :--- | :--- |
| **Brace** | $1.0\times$ | Standard Aegis Mitigation | Baseline stance. Reliable absorption. |
| **Overcharge** | $2.0\times$ | Aegis reduced to $0$ | All-in aggression. Extreme burst damage, zero defense. |
| **Parry** | $0.5\times$ | Normal Mitigation | If Opponent Assault $<$ Flush, reflect $50\%$ of raw incoming damage back to the attacker. |

### 2.5 Combat Resolution Mathematics

Let $\text{RankVal}(H_A)$ represent the base attack power derived from the Assault 3-card hand:
*   **Straight Flush:** $18 \text{ Base Damage}$
*   **Three of a Kind:** $14 \text{ Base Damage}$
*   **Straight:** $10 \text{ Base Damage}$
*   **Flush:** $8 \text{ Base Damage}$
*   **Pair:** $5 \text{ Base Damage}$
*   **High Card:** $2 \text{ Base Damage}$

Let $\text{Mitigation}(H_D)$ represent the damage absorbed by the Aegis 2-card hand:
*   **Pair:** $8 \text{ Damage Blocked}$
*   **Suited Cards:** $4 \text{ Damage Blocked}$
*   **Offsuit High Card:** $2 \text{ Damage Blocked}$

Net damage received by Player $B$ from Player $A$'s attack:
$$\text{Damage}_{B} = \max\Big(0, \big(\text{RankVal}(H_{A, \text{assault}}) \times M_{\text{stance}, A}\big) - \text{Mitigation}(H_{B, \text{aegis}}) - \text{Barrier}_B\Big)$$

*(Plus any reflected damage if Player $B$ successfully executed a Parry).*

---

## 3. Visual & Aesthetic Architecture: Reactive Neon Vector Engine

All visuals are rendered purely in code via Three.js and custom GLSL vertex/fragment shaders. No external image textures, sprite sheets, or 3D models are loaded.

```
┌─────────────────────────────────────────────────────────────┐
│                    Three.js WebGL Engine                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
┌───────────────────────────────┐     ┌───────────────────────────────┐
│ Reactive Vector Grid          │     │ Vector Particle & FX Pipeline │
│ • 2D/3D Infinite Wireframe    │     │ • Geometric Sparks (Triangles)│
│ • Gravitational Point Warping │     │ • Additive Glow / Bloom Blends│
│ • Shockwave Impulse Ripple    │     │ • Dynamic Velocity & Decay    │
└──────────────┬────────────────┘     └───────────────┬───────────────┘
               │                                      │
               └───────────────────────┬──────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Screen-Space Post-Processing Compositor (GLSL)              │
│ • UnrealBloomPass (Vibrant Neon Glow & Edge Phosphor)       │
│ • Dynamic Chromatic Aberration (RGB Channel Split on Damage)│
│ • Procedural CRT Scanlines & Subtle Barrel Curvature        │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 The Reactive Neon Vector Grid
*   **Dynamic Wireframe Matrix:** The arena background consists of a high-density, mathematical grid rendered in intense neon cyan (`#00f3ff`) and deep blue (`#001a33`).
*   **Gravity Wells & Attractor Points:** Card hovering, Flux transmutation clicks, and stance selections act as local gravity nodes, pulling the grid vertices inward toward the point of interaction:
    $$\vec{D}_{\text{gravity}}(\vec{P}) = \frac{\vec{C}_{\text{node}} - \vec{P}}{\|\vec{C}_{\text{node}} - \vec{P}\|^2 + \epsilon} \cdot K_{\text{pull}}$$
*   **Clash Shockwave Warp:** During the Clash reveal, an exponential shockwave ripples across the grid from the center of the arena:
    $$Z(r, t) = A_{\max} \cdot e^{-\lambda t} \cdot \sin(k \cdot r - \omega t)$$

### 3.2 Procedural Vector Cards & Explosive Particles
*   **Procedural Vector Cards:** Cards are constructed using `LineSegmentsGeometry` and high-contrast glowing edges (cyan for player, hot magenta `#ff0055` for opponent/AI, bright amber `#ffb700` for Flux). Pip icons and rank glyphs are rendered via procedural mathematical vector paths.
*   **Vector Particle Bursts:** On card burn, damage impact, or round victory, a burst of 100–300 geometric vector particles (glowing lines, diamonds, and triangles) erupt outward with randomized velocities, decaying luminescence, and additive blending (`THREE.AdditiveBlending`).

### 3.3 Post-Processing & CRT Compositor
*   **Neon Bloom Pass:** High-luminance threshold bloom captures all vector line edges, creating an authentic 1980s vector arcade phosphor glow.
*   **Dynamic Chromatic Aberration:** Radial RGB channel separation intensifies proportionately with incoming damage:
    $$\Delta R = (u, v) + \vec{d} \cdot I_{\text{damage}}, \quad \Delta B = (u, v) - \vec{d} \cdot I_{\text{damage}}$$
*   **Scanline & Vignette Shaders:** Subtle sine-wave scanline raster lines and soft edge vignetting complete the arcade aesthetic without obscuring UI readability.

---

## 4. Procedural Audio Architecture (Web Audio API)

To satisfy the zero-install, zero-download constraint while creating an electrifying atmosphere, `CYBERANTE` features a fully procedural, code-driven Web Audio synthesis engine. No `.mp3`, `.ogg`, or `.wav` files are loaded.

```
┌─────────────────────────────────────────────────────────────┐
│                    WebAudio API Context                     │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
┌───────────────────────────────┐     ┌───────────────────────────────┐
│ Procedural Music Synthesizer  │     │ Procedural SFX Synthesizer    │
│ • Dual-Oscillator Bassline    │     │ • Flux Chime (Arpeggiated)   │
│ • Arpeggiated Cyber-Sequencer │     │ • Burn Burst (Filtered Noise) │
│ • Dynamic BPM (Pacing Shift)  │     │ • Sub-Bass Stance Impact      │
│ • Low-Pass Filter Modulation  │     │ • Laser Clash & Glitch Zap    │
└──────────────┬────────────────┘     └───────────────┬───────────────┘
               │                                      │
               └───────────────────────┬──────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Master Audio Bus -> Dynamics Compressor -> Stereo Audio Out │
│ • Real-time Audio Reactive FFT Data fed back to GLSL Shaders│
└─────────────────────────────────────────────────────────────┘
```

### 4.1 Generative Synthwave Music Engine
*   **Architecture:** Two polyphonic oscillator nodes (Sawtooth + Square) running through a 24dB resonant low-pass filter (`BiquadFilterNode`) and feedback delay.
*   **Adaptive Musical Phases:**
    *   *Waiting / Deal Phase:* Low-frequency ambient drone in D-minor ($75\text{ BPM}$) with a gentle filter sweep.
    *   *Shaping Phase:* An 8-step driving synthesizer arpeggio begins ($120\text{ BPM}$), building player focus.
    *   *Commitment Phase:* Filter opens wide, adding a pulsating syncopated sub-bass rhythm that accelerates in tempo during the final 3-second countdown.
    *   *Clash Phase:* Sudden musical drop followed by an explosive synth chord resolution.
*   **Audio-Visual Reactivity:** An `AnalyserNode` extracts real-time FFT frequency buckets (Bass, Mid, High), feeding them into the Three.js uniforms to drive the reactive vector grid warp and neon pulse in exact tempo with the music.

### 4.2 Interactive Sound Effects Palette
*   **UI Hover / Click:** Fast sine-wave chirp ($880\text{ Hz} \rightarrow 1760\text{ Hz}$ over $40\text{ ms}$).
*   **Flux Pip Nudge:** Dual square-wave blip with upward or downward pitch bend matching the rank increment/decrement.
*   **Suit Bleed:** Smooth resonant bandpass filter sweep across a rich triangle harmonic chord.
*   **Burn-to-Cast Discard:** White-noise buffer burst passed through a fast-decay low-pass filter, creating a tactile "cybernetic burn" pop.
*   **Stance Lock-in:** Deep sine sub-drop ($120\text{ Hz} \rightarrow 40\text{ Hz}$) with slight overdrive distortion.
*   **Clash Reveal & Laser Damage:** Frequency-modulated (FM) laser zap followed by an explosion burst whose duration and intensity scale directly with damage dealt.

---

## 5. Game Modes & Navigation Flow

The game is structured around three primary entry points accessible from a sleek, arcade-style Main Menu:

```
┌─────────────────────────────────────────────────────────────┐
│                    CYBERANTE MAIN MENU                      │
│                                                             │
│   [ 1. PLAY SOLO (VS LOCAL AI) ]   -> Instant Offline Match │
│   [ 2. ONLINE MULTIPLAYER ]        -> Room Code Matchmaking │
│   [ 3. INTERACTIVE TUTORIAL ]      -> Guided Rule Walkthrough│
│   [ 4. AUDIO / GRAPHICS TOGGLE ]   -> Performance Settings  │
└─────────────────────────────────────────────────────────────┘
```

### 5.1 Mode 1: Online Multiplayer (WebSockets)
*   **Matchmaking:** Players can create a private room (generating a 4-character room code) or join via a shareable direct URL (`?room=CYBR`).
*   **Authoritative Server Loop:** Full authoritative state machine running on Node.js/Bun, managing simultaneous lock-in countdowns and validating moves.

### 5.2 Mode 2: Solo Mode vs. Local Classical AI
*   **Purpose:** Critical contest safeguard! Allows judges to experience complete, high-stakes Best-of-3 gameplay instantly without requiring a second human player online.
*   **Zero Latency:** Executes locally in-browser using the deterministic evaluation engine.
*   **Realistic Cadence:** Classical AI simulates human shaping and commitment delays ($1\text{--}2\text{ seconds}$), displaying visual indicator tokens when it transmutes or locks in.

### 5.3 Mode 3: Interactive Step-by-Step Tutorial
*   **Interactive Guided Walkthrough:** Direct, hands-on tutorial selectable from the main screen that walks new players through core mechanics across 4 progressive steps:
    1.  *Lesson 1: The Hand & The Split* — Explains 3-Card Assault vs. 2-Card Aegis scoring.
    2.  *Lesson 2: Flux Transmutations* — Prompts player to spend 1 Flux to nudge a $6$ to a $7$, completing an open-ended Straight.
    3.  *Lesson 3: Burn-to-Cast* — Teaches burning a Diamond card for a defensive barrier before entering combat.
    4.  *Lesson 4: Stance Clash* — Explains Brace vs. Overcharge vs. Parry, followed by a simulated live clash against a passive training drone.
*   **In-Game Quick Reference Card:** A collapsible floating HUD button `[ ? RULES ]` allows players to inspect hand rankings, stance matchups, and burn abilities at any time during an active match.

---

## 6. Classical Game AI Engine (Solo Mode)

The Solo Mode AI is a **classical, deterministic heuristic game AI** (strictly non-LLM, requiring zero API calls, zero cost, and zero external latency).

### 6.1 Heuristic Decision Architecture
The AI evaluates its 5-card hand across a weighted utility scoring matrix:

```
                        ┌───────────────────────────────┐
                        │   AI Hand Input (5 Cards)     │
                        └──────────────┬────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
┌───────────────────────────────┐             ┌───────────────────────────────┐
│ Combinatorial Hand Generator  │             │ Tactical Burn Evaluator       │
│ • Generates all 10 possible   │             │ • Evaluates value of burning  │
│   3-card/2-card split subsets │             │   low card for shield/sunder  │
└───────────────┬───────────────┘             └───────────────┬───────────────┘
                │                                             │
                └──────────────────────┬──────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Flux Optimizer (Rank Nudge / Suit Bleed Search)             │
│ • Simulates 1-step and 2-step Flux mutations                │
│ • Selects mutation that yields highest Δ (Assault + Aegis)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Stance Selector & Risk Heuristic                            │
│ • Evaluates own Guard HP vs. Player Guard HP                │
│ • Selects BRACE (balanced), OVERCHARGE (finisher), or PARRY │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Bot Personalities / Archetypes
Players can choose or randomly face three classical AI personalities:
1.  **Cipher-0 (Balanced / Tactical):** Calculates standard expected utility. Preserves Aegis defense if player has high Guard; saves Flux for completing Straights and Flushes.
2.  **Vektor-Aggro (Aggressive / Overcharge):** Heavily weights Assault line power over Aegis defense. Frequently executes Overcharge stances and burns Club cards (*Sunder*) to destroy player defenses.
3.  **Aegis-Wall (Defensive / Counter):** Maximizes Aegis mitigation (pairs and suited cards). Burns Diamond cards (*Barrier*) and frequently deploys *Parry* to punish aggressive human stances.

---

## 7. System Architecture & Network Protocols

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client Engine (Browser)                    │
│   • Local UI State Machine     • Three.js Vector Canvas         │
│   • Procedural WebAudio Synth  • Classical Offline Bot AI       │
│   • Interactive Tutorial Flow  • WebSocket Client Transport     │
└────────────────────────────────▲────────────────────────────────┘
                                 │
                                 │ JSON Packets over WSS
                                 │ (Only in Online Mode)
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│               Authoritative Game Server (Node/Bun)              │
│   • Room Lifecycle Manager     • Deterministic CSPRNG Deck      │
│   • 15s/10s Phase Timers       • Anti-Cheat Masking Engine      │
│   • 500ms Disconnect Grace     • Automated Headless Test Suites │
└─────────────────────────────────────────────────────────────────┘
```

### 7.1 Anti-Cheat & Authority Guarantees
*   **Card Masking:** Server holds all private card state. During Shaping and Commitment phases, clients receive full data for their own 5 cards, while opponent cards are sent as masked hashes (`{ id: "hidden", suit: "UNKNOWN", rank: 0 }`).
*   **Simultaneous Lock-In:** Clients submit their 3-card/2-card split and chosen stance blinds. If a client disconnects or times out before the 10-second Commitment window closes, the server deterministically auto-locks their highest possible High-Card hand and defaults to *Brace* stance.

### 7.2 Network Data Contracts

```typescript
// --- Shared Types & Contracts: packages/shared/src/types.ts ---

export type Suit = 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11=J, 14=A
export type Stance = 'BRACE' | 'OVERCHARGE' | 'PARRY';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

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

export interface PlayerPublicState {
  playerId: string;
  name: string;
  guardHp: number;
  fluxRemaining: number;
  roundWins: number;
  hasBurnedCard: boolean;
  hasCommitted: boolean;
  activeBarrier: number;
}

export type GamePhase = 
  | 'LOBBY_WAIT'
  | 'DEAL'
  | 'SHAPING'
  | 'COMMITMENT'
  | 'CLASH_REVEAL'
  | 'ROUND_RESOLVE'
  | 'MATCH_OVER';

// Client-to-Server Messages
export type ClientMessage =
  | { type: 'CMD_JOIN_ROOM'; roomCode: string; playerName: string }
  | { type: 'CMD_NUDGE_RANK'; cardId: string; direction: 'UP' | 'DOWN' }
  | { type: 'CMD_BLEED_SUIT'; cardId: string; targetSuit: Suit }
  | { type: 'CMD_BURN_CAST'; cardId: string }
  | { 
      type: 'CMD_COMMIT_HAND'; 
      assaultCardIds: [string, string, string]; 
      aegisCardIds: [string, string]; 
      stance: Stance 
    };

// Server-to-Client Messages
export type ServerMessage =
  | { type: 'STATE_INIT'; playerId: string; matchId: string; opponentName: string }
  | { 
      type: 'STATE_TICK'; 
      phase: GamePhase; 
      timeRemainingMs: number; 
      players: Record<string, PlayerPublicState>;
      selfCards: Card[];
    }
  | { 
      type: 'ROUND_OUTCOME';
      p1Assault: Card[];
      p1Aegis: Card[];
      p1Stance: Stance;
      p2Assault: Card[];
      p2Aegis: Card[];
      p2Stance: Stance;
      p1DamageDealt: number;
      p2DamageDealt: number;
      p1ReflectedDamage: number;
      p2ReflectedDamage: number;
      p1NetGuardHp: number;
      p2NetGuardHp: number;
      roundWinnerId: string | null;
      matchWinnerId: string | null;
    }
  | { type: 'ERROR_REJECTED'; reason: string };
```

---

## 8. Repository Skeleton & Directory Layout

The codebase is organized as a clean, modular TypeScript monorepo with explicit stubs prepared for OpenAI Codex:

```
cyberante/
├── .github/
│   └── workflows/
│       └── ci.yml                     # Headless automated testing & linting
├── docs/
│   ├── cyberante_design_document.md   # Master Architectural Blueprint
│   └── agent_specs/                   # Numbered Implementation Specs for OpenAI Codex
│       ├── spec-01-shared-contracts.md
│       ├── spec-02-poker-evaluator.md
│       ├── spec-03-deck-flux-engine.md
│       ├── spec-04-authoritative-server.md
│       ├── spec-05-classical-bot-ai.md
│       ├── spec-06-procedural-audio-engine.md
│       ├── spec-07-neon-vector-renderer.md
│       ├── spec-08-client-game-ui.md
│       ├── spec-09-interactive-tutorial.md
│       └── spec-10-e2e-integration-deploy.md
├── packages/
│   ├── shared/                        # Zero-dependency TypeScript models & math
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── types.ts               # Core contracts, enums, network payloads
│   │       ├── pokerEvaluator.ts      # 3-card and 2-card poker hand tier evaluation
│   │       ├── combatCalculator.ts    # Stance, mitigation, barrier, and parry formulas
│   │       └── constants.ts           # Timers, base damage formulas, costs
│   │
│   ├── server/                        # Authoritative Node/Bun WebSocket Server
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts               # WebSocket initialization and HTTP room endpoints
│   │       ├── Room.ts                # Authoritative state machine & phase loop
│   │       ├── Deck.ts                # CSPRNG deck mechanics & shuffling
│   │       ├── RoomManager.ts         # Matchmaking and room registry
│   │       └── __tests__/
│   │           ├── evaluator.test.ts  # Hand tier math validation
│   │           ├── combat.test.ts     # Stance matrix and damage resolution
│   │           └── roomLifecycle.test.ts # Simulated WebSocket round progression
│   │
│   └── client/                        # Vite + Three.js Procedural Vector App
│       ├── index.html
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
│           ├── main.ts                # App entry and mode routing
│           ├── ai/
│           │   ├── ClassicalBotAI.ts  # Offline heuristic decision bot
│           │   └── BotProfiles.ts     # Cipher-0, Vektor-Aggro, Aegis-Wall
│           ├── audio/
│           │   ├── AudioEngine.ts     # Web Audio API Context & Master Bus
│           │   ├── ProceduralMusic.ts # Generative synthwave sequencer
│           │   └── SoundEffects.ts    # Code-driven synthesized SFX
│           ├── net/
│           │   └── NetworkClient.ts   # WebSocket wrapper with auto-reconnect
│           ├── render/
│           │   ├── VectorScene.ts     # Three.js canvas setup & render loop
│           │   ├── ReactiveGrid.ts    # Dynamic reactive warping vector grid
│           │   ├── ProceduralCard.ts  # LineSegments vector card geometry
│           │   ├── ParticleSystem.ts  # Glowing vector sparks & shockwaves
│           │   └── shaders/
│           │       ├── gridDisplacement.glsl
│           │       └── postCrtBloom.glsl
│           ├── tutorial/
│           │   └── TutorialManager.ts # Interactive 4-step onboarding logic
│           └── ui/
│               ├── MainMenuOverlay.ts # Mode selection screen
│               ├── GameBoardOverlay.ts# Split-lane slots, Flux buttons, timer HUD
│               └── RulesModal.ts      # Collapsible in-game cheat sheet
└── package.json                       # Monorepo workspaces configuration
```

---

## 9. Spec-Driven Implementation Roadmap (OpenAI Codex)

To ensure rapid, defect-free execution without hallucination or architectural drift, all engineering is decomposed into **10 granular, self-contained specification files** for OpenAI Codex to follow sequentially:

```
┌────────────────────────────────────────────────────────┐
│ 1. PREPARED REPO STUB & CONTRACT                       │
│    Architect builds typed skeletons + test fixtures    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 2. TARGETED OPENAI CODEX PROMPT                        │
│    Supply single spec file; demand exact implementation│
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 3. HEADLESS VERIFICATION HARNESS                       │
│    Run 'npm test' in WSL2; verify invariants           │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 4. ARCHITECT CODE REVIEW & PASS                        │
│    Validate code against spec, commit, advance to next │
└────────────────────────────────────────────────────────┘
```

### 9.1 Mapping of Implementation Specs (For OpenAI Codex)

*   **`spec-01-shared-contracts.md` (Shared Schema & Interfaces):**
    *   *Scope:* Implement `packages/shared/src/types.ts` and `constants.ts`.
    *   *Invariants:* Strict TypeScript typing; zero runtime dependencies; complete coverage of all network messages, phases, suits, ranks, and stances.
*   **`spec-02-poker-evaluator.md` (Combinatorial Evaluator & Combat Math):**
    *   *Scope:* Implement `pokerEvaluator.ts` (3-card assault ranking, 2-card aegis ranking) and `combatCalculator.ts` (damage, barrier, parry reflection).
    *   *Invariants:* Fully deterministic; handles all Ace-wraps and edge ties; 100% unit test coverage in `evaluator.test.ts` and `combat.test.ts`.
*   **`spec-03-deck-flux-engine.md` (Deck Shuffling & Flux Transmutations):**
    *   *Scope:* Implement `packages/server/src/Deck.ts` and shared Flux transmutation logic (Pip Nudge, Suit Bleed, Burn-to-Cast replacements).
    *   *Invariants:* CSPRNG Fisher-Yates shuffle; strict Flux cost debiting; prevent negative Flux balances.
*   **`spec-04-authoritative-server.md` (WebSocket State Machine & Room Lifecycle):**
    *   *Scope:* Implement `packages/server/src/Room.ts` and `RoomManager.ts`.
    *   *Invariants:* Authoritative phase timer transitions (Deal $\rightarrow$ Shaping 15s $\rightarrow$ Commitment 10s $\rightarrow$ Clash $\rightarrow$ Resolve); auto-lock fallback on timeout; anti-cheat card hiding.
*   **`spec-05-classical-bot-ai.md` (Solo Mode Offline Classical Game AI):**
    *   *Scope:* Implement `packages/client/src/ai/ClassicalBotAI.ts` and `BotProfiles.ts`.
    *   *Invariants:* Strictly non-LLM; deterministic utility calculation; evaluates split partitions and Flux permutations; simulates 1–2s human thinking pauses.
*   **`spec-06-procedural-audio-engine.md` (Web Audio API Synthesizer):**
    *   *Scope:* Implement `packages/client/src/audio/AudioEngine.ts`, `ProceduralMusic.ts`, and `SoundEffects.ts`.
    *   *Invariants:* Zero audio file downloads; procedural dual-oscillator synthwave arpeggiator; responsive SFX triggers; dynamic audio-reactive FFT node.
*   **`spec-07-neon-vector-renderer.md` (Three.js Reactive Neon Vector Engine):**
    *   *Scope:* Implement `VectorScene.ts`, `ReactiveGrid.ts`, `ProceduralCard.ts`, `ParticleSystem.ts`, and GLSL shaders.
    *   *Invariants:* Zero image texture imports; dynamic wireframe grid distortion under gravity points; neon bloom post-processing; additive vector particle sparks.
*   **`spec-08-client-game-ui.md` (Interactive Tactical Overlay & HUD):**
    *   *Scope:* Implement `GameBoardOverlay.ts` and `MainMenuOverlay.ts`.
    *   *Invariants:* Drag-and-drop / click-to-slot card assignment (3 Assault, 2 Aegis); one-click Stance toggles; reactive timer countdown and Guard HP bars; fully responsive.
*   **`spec-09-interactive-tutorial.md` (Guided Onboarding Experience):**
    *   *Scope:* Implement `packages/client/src/tutorial/TutorialManager.ts` and `RulesModal.ts`.
    *   *Invariants:* Interactive 4-lesson walkthrough; step-by-step interactive validation (e.g., verifying user successfully nudged a pip); quick-reference popup HUD.
*   **`spec-10-e2e-integration-deploy.md` (Wire Integration, Solo/Multiplayer Routing & Build):**
    *   *Scope:* Implement `NetworkClient.ts`, `main.ts`, Vite production bundling, and zero-install deployment config.
    *   *Invariants:* End-to-end playability in browser; seamless switching between Solo Mode (local) and Multiplayer (WebSocket); pass full CI verification.

### 9.2 OpenAI Codex Agentic Execution Pattern
When dispatching tasks to OpenAI Codex, prompts must follow the strict four-part contract pattern:
```markdown
### OpenAI Codex Task Directive
1. **Target Files:** Specify the exact file path(s) to create or edit.
2. **Contract Invariants:** Reference `packages/shared/src/types.ts` as immutable ground truth.
3. **Behavioral Bounds:** Do not add external raster/audio dependencies; follow strict error handling.
4. **Verification Command:** The exact test command (e.g., `npm test -- evaluator.test.ts`) that must pass with zero errors.
```

---

## 10. Contest Reconciliation & Gap Analysis

A rigorous cross-examination of the Handshake AI Skills Studio × OpenAI Multiplayer Game Challenge Official Rules against our architecture reveals key strategic alignments and safeguards:

### 10.1 Key Weaknesses Identified & Architectural Mitigations

| Identified Risk / Weakness | Impact on Contest Judging | Architectural Mitigation in CYBERANTE |
| :--- | :--- | :--- |
| **"The Empty Lobby Problem"** | Contest judges often test entries alone without an active multiplayer partner. If matchmaking requires two humans, the judge gets stuck on a loading screen and fails the entry. | **Solo Mode vs. Local Classical AI**: A judge can immediately click "Play Solo" from the main screen to experience full, responsive Best-of-3 gameplay against a tailored bot. |
| **Steep Learning Curve for Poker-Combat** | Unfamiliarity with split-lane commitment or Flux transmutations could cause judges to score low on "Polish & Thoughtfulness" (1/5: *Rough, confusing, limited usability*). | **Interactive Main Menu Tutorial & Rules Overlay**: A guided 4-step interactive tutorial introduces every mechanic in 60 seconds, plus an in-game HUD cheat sheet. |
| **External Asset Latency / 404 Failures** | Slow Wi-Fi or hosted server latency during asset loading creates jank or failed demo presentations. | **100% Procedural Generation**: Zero audio files and zero image textures. All graphics (Three.js vectors) and audio (Web Audio API) are synthesized on-the-fly in code, loading instantly ($< 300\text{ ms}$). |
| **Flaky Network / Disconnect Timeouts** | Latency spikes or browser tab switching during live multiplayer matches could freeze the game room. | **Authoritative Auto-Lock Timeouts**: If a player's connection drops during the 10-second commitment window, the server automatically computes their optimal High-Card hand and defaults to *Brace*, ensuring matches never hang. |
| **OpenAI Attribution Clarity** | The contest explicitly mandates: *"built with OpenAI: Create a Multiplayer Game mission in Handshake."* Earlier draft referenced non-OpenAI tooling. | **OpenAI Codex Spec-Driven Pipeline**: All references updated to OpenAI Codex. Implementation artifacts, prompt specifications, and git history explicitly document OpenAI Codex's role as the agentic coder implementation expert. |

### 10.2 Official Submission Deliverables Checklist
As specified in Page 1 of the Contest Official Rules, entries must provide four specific components prior to the October 30, 2026 deadline:

*   [x] **a. Project Title:** `CYBERANTE: Procedural Vector Poker-Combat Matrix`
*   [ ] **b. Project Cover Image:** High-impact vector screenshot showcasing the glowing neon vector grid, blooming cards, and particle explosion shockwave (generated via WebGL canvas capture).
*   [ ] **c. Project Description:** Concise, compelling summary highlighting the fusion of poker strategy, fighting-game stances, zero-asset WebGL/WebAudio procedural generation, and full Solo/Multiplayer capabilities built with OpenAI Codex.
*   [ ] **d. Project Link/URL:** Publicly accessible, zero-install web deployment URL (e.g., hosted on Fly.io / Cloudflare Pages) playable immediately on any modern browser.