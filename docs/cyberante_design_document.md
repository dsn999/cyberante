# TECHNICAL DESIGN SPECIFICATION: CYBERANTE
**Project Codename:** CYBERANTE (Procedural Vector Poker-Combat Matrix)  
**Target Event:** Handshake AI Skills Studio × OpenAI Multiplayer Game Challenge  
**Platform Target:** Universal Web (Zero-Install Cross-Platform: Desktop / Mobile / Tablet)  
**Host & Dev Environment:** WSL2 Ubuntu (POSIX Native Toolchains, Node.js, WebSockets, TypeScript)  
**Development Methodology:** Spec-Driven Agentic Implementation (Typed Stubs + OpenAI Codex)  
**Document Role:** System Architecture Blueprint (Architect: AI / Project Manager: User)

**QA status (2026-10-05):** Spec-07.1 software verification passes. The user
confirmed public multiplayer between Windows Chrome and iPad Safari and accepted
its performance under revised Spec-10B. Full certification still requires
current release/build and deployment/recovery evidence; numeric physical FPS
traces are no longer a release gate.
The user approved retaining the detailed implementation specs and reconciling
this blueprint to their refinements. See the [current certification audit](qa/design_certification_2026-10-05.md)
and the [earlier requirement-by-requirement matrix](qa/design_certification.md).

**Contract precedence:** The ten detailed specs define implementation behavior.
This blueprint summarizes their contracts. Contest scoring statements are
design intent; eligibility and official submission rules require separate
confirmation. No universal cold-load or tutorial-completion time is guaranteed.

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
*   **Exchange Pacing:** Each round contains sequential exchanges with Guard HP carried between them until a knockout or the Spec-02 exchange cap resolves the round. A full timed exchange lasts 34 seconds; mutual ready/commit may advance phases early.

### 2.2 Deck & Hand Architecture
*   **Card Pool:** Single standard 52-card deck, shuffled with server-side CSPRNG for multiplayer or a browser-CSPRNG-seeded deterministic PRNG for solo. Retain unused cards across exchanges and rounds; rebuild before a ten-card deal when fewer than 12 remain, reserving two burn replacements. A new match always rebuilds, with fresh card IDs.
*   **Starting Hand:** Both players are dealt 5 private cards per exchange.
*   **Tactical Currency (Flux):** Both players receive $3 \text{ Flux}$ points per exchange to fuel card transmutations. Unspent Flux does not roll over.

### 2.3 Exchange Phase Progression

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
A player may discard a single card from their hand to activate an immediate tactical power, instantly drawing one replacement card from the deck (maximum 1 burn per exchange):
*   **Burn Spade:** *Static Veil* — Suppresses the opponent's Overcharge damage bonus and Parry reflection. Overcharge still forfeits its user's Aegis; Parry retains its half-damage multiplier. Both hands are fully revealed during clash, as specified in Specs 02/03/09.
*   **Burn Diamond:** *Hard Barrier* — Adds a flat absorption barrier equal to the card's numerical pip value to the Aegis Line:
    $$\text{Barrier} = \text{Pip}(\text{Card}) \quad (\text{Face cards} = 10, \, A = 11)$$
*   **Burn Heart:** *Siphon Seed* — If your Assault hand successfully deals unmitigated damage, convert $50\%$ of damage dealt directly into Round Guard recovery.
*   **Burn Club:** *Sunder* — Shreds the opponent's effective Aegis mitigation and active Barrier by $50\%$, flooring each component separately, as specified in Spec-02.

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
| **Parry** | $0.5\times$ | Normal Mitigation | If Opponent Overcharges OR Opponent Assault $<$ Flush (Pair / High Card), reflect $50\%$ of raw incoming damage back to the attacker. |

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
│ • 2D/3D Infinite Wireframe    │     │ • Geometric Sparks (Diamonds) │
│ • Gravitational Point Warping │     │ • Additive Glow / Bloom Blends│
│ • Shockwave Impulse Ripple    │     │ • Dynamic Velocity & Decay    │
└──────────────┬────────────────┘     └───────────────┬───────────────┘
               │                                      │
               └───────────────────────┬──────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Screen-Space Post-Processing Compositor (GLSL)              │
│ • GLSL Threshold Bloom (Neon Glow & Edge Phosphor)         │
│ • Dynamic Chromatic Aberration (RGB Channel Split on Damage)│
│ • Procedural CRT Scanlines & Subtle Barrel Curvature        │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 The Reactive Neon Vector Grid
*   **Full-Screen Arena:** The reactive wireframe covers the viewport at every aspect ratio. Cards and clash effects occupy the central visual area; a compact floating edge HUD provides state and contextual actions, following [Spec-07.1: Full-Screen Vector Arena & Contextual Game HUD](agent_specs/spec-07.1-full-screen-arena-ui.md).
*   **Dynamic Wireframe Matrix:** The arena background consists of a high-density, mathematical grid rendered in intense neon cyan (`#00f3ff`) and deep blue (`#001a33`).
*   **Mouse Gravity Well:** Within an 8-unit radius of the cursor, grid vertices displace downwards along $Z$ with inverse-square falloff, as specified in Spec-07:
    $$\Delta Z_{\text{mouse}} = \frac{-G \cdot \text{strength}}{\|\vec{P}_{xy} - \vec{C}_{\text{mouse}}\|^2 + 1.0}$$
    Flux clicks and stance selections trigger particle/shockwave feedback at their interaction points. Bass energy modulates grid displacement.
*   **Clash Shockwave Warp:** During the Clash reveal, an exponential shockwave ripples across the grid from the center of the arena:
    $$Z(r, t) = A_{\max} \cdot e^{-\lambda t} \cdot \sin(k \cdot r - \omega t)$$

### 3.2 Procedural Vector Cards & Explosive Particles
*   **Procedural Vector Cards:** Cards use preallocated `BufferGeometry` with `THREE.LineSegments`. Local faces use canonical suit colors: Spades cyan, Clubs green, Diamonds amber and Hearts rose. Opponent/AI faces use hot magenta `#ff0055`. Pip icons and rank glyphs use mathematical vector paths.
*   **Vector Particle Bursts:** Spec-07 uses a 1,000-vertex pooled `THREE.Points` geometry with additive `PointsMaterial`, procedurally shaped into diamond sparks. Burns emit 100 particles, clashes 250 and local round/match victories 300 suit-colored confetti particles, with random velocities and decaying luminescence. Reduced motion reduces emissions by 75%.

### 3.3 Post-Processing & CRT Compositor
*   **Neon Bloom Pass:** A custom GLSL compositor samples high-luminance neighbors around vector edges to produce phosphor glow, following Spec-07's shader-pass contract.
*   **Dynamic Chromatic Aberration:** Radial RGB channel separation intensifies proportionately with incoming damage:
    $$\Delta R = (u, v) + \vec{d} \cdot I_{\text{damage}}, \quad \Delta B = (u, v) - \vec{d} \cdot I_{\text{damage}}$$
*   **Scanline & Vignette Shaders:** Subtle sine-wave scanline raster lines and soft edge vignetting complete the arcade aesthetic without obscuring UI readability.

---

## 4. Procedural Audio Architecture (Web Audio API)

To satisfy the zero-install, zero-external-media constraint while creating an electrifying atmosphere, `CYBERANTE` features a fully procedural, code-driven Web Audio synthesis engine. No `.mp3`, `.ogg`, or `.wav` files are loaded.

```
┌─────────────────────────────────────────────────────────────┐
│                    WebAudio API Context                     │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
┌───────────────────────────────┐     ┌───────────────────────────────┐
│ Procedural Music Synthesizer  │     │ Procedural SFX Synthesizer    │
│ • Phase-Specific Synth Voices │     │ • Directional Flux Chirps    │
│ • Arpeggiated Cyber-Sequencer │     │ • Burn Burst (Filtered Noise) │
│ • Dynamic BPM (Pacing Shift)  │     │ • Sub-Bass Stance Impact      │
│ • Low-Pass Filter Modulation  │     │ • Laser Clash & Glitch Zap    │
└──────────────┬────────────────┘     └───────────────┬───────────────┘
               │                                      │
               └───────────────────────┬──────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Master Gain -> AnalyserNode (FFT) -> Audio Destination      │
│ • Real-time Audio Reactive FFT Data fed back to GLSL Shaders│
└─────────────────────────────────────────────────────────────┘
```

### 4.1 Generative Synthwave Music Engine
*   **Architecture:** Spec-06 defines phase-specific, bounded oscillator voices with gain envelopes and a shared resonant low-pass `BiquadFilterNode`. Shaping uses triangle arpeggios and sawtooth bass; Commitment uses square arpeggios and sawtooth bass; ambient/pad voices use triangles and Clash uses a sine bass drop. Music and SFX buses feed master gain (maximum 0.3), then FFT analyser and audio destination. No delay or compressor is required by this contract.
*   **Adaptive Musical Phases:**
    *   *Waiting / Deal Phase:* Low-frequency ambient drone in D-minor ($85\text{ BPM}$) with a gentle filter sweep.
    *   *Shaping Phase:* An 8-step driving synthesizer arpeggio begins ($115\text{ BPM}$), building player focus.
    *   *Commitment Phase:* Tense clockwork pulse at 135 BPM with filter cutoff opening to 1800 Hz, as specified in Spec-06.
    *   *Clash Phase:* Full filter sweep and bass drop at 90 BPM; Round Resolve uses a harmonic pad at 100 BPM, as specified in Spec-06.
*   **Audio-Visual Reactivity:** An `AnalyserNode` extracts real-time FFT frequency buckets (Bass, Mid, High), feeding them into the Three.js uniforms to drive the reactive vector grid warp and neon pulse in exact tempo with the music.

### 4.2 Interactive Sound Effects Palette
*   **UI Click:** Sine-wave chirp ($800\text{ Hz} \rightarrow 200\text{ Hz}$ over $40\text{ ms}$), as specified in Spec-06.
*   **Flux Pip Nudge:** Triangle chirp from 440 Hz to 660 Hz (up) or 330 Hz (down) over 80 ms.
*   **Suit Bleed:** Dual detuned triangle voices at 440/444 Hz through a resonant bandpass sweep over 150 ms.
*   **Burn-to-Cast Discard:** White-noise buffer burst passed through a fast-decay low-pass filter, creating a tactile "cybernetic burn" pop.
*   **Stance Selection:** Brace uses a low square-wave thud; Overcharge a rising 220→880 Hz sawtooth surge; Parry a 1400 Hz ring-modulated metallic chime.
*   **Clash Reveal & Laser Damage:** Dual-oscillator FM laser pitch drop followed by a distorted 65→30 Hz sub-bass impact. `playDamageImpact(isLethal)` selects a 0.3-second ordinary or 0.6-second lethal impact. Match victory/defeat use distinct ascending/descending fanfares.

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
*   **Authoritative Server Loop:** Full authoritative state machine running on Node.js 20 or newer, managing simultaneous lock-in countdowns and validating moves. Bun is not part of the verified runtime contract.

### 5.2 Mode 2: Solo Mode vs. Local Classical AI
*   **Purpose:** Critical contest safeguard! Allows judges to experience complete, high-stakes Best-of-3 gameplay instantly without requiring a second human player online.
*   **Zero Latency:** Executes locally in-browser using the deterministic evaluation engine.
*   **Realistic Cadence:** Classical AI simulates human shaping and commitment delays ($1\text{--}2\text{ seconds}$), displaying visual indicator tokens when it transmutes or locks in.

### 5.3 Mode 3: Interactive Step-by-Step Tutorial
*   **Interactive Guided Walkthrough:** Direct, hands-on tutorial selectable from the main screen that walks new players through core mechanics across 4 progressive steps:
    1.  *Lesson 1: The Hand & The Split* — Explains 3-Card Assault vs. 2-Card Aegis scoring.
    2.  *Lesson 2: Flux Transmutations* — Prompts player to spend 1 Flux to nudge a $4$ to a $3$, completing an A–2–3 Straight Flush, as specified in Spec-09.
    3.  *Lesson 3: Burn-to-Cast* — Teaches burning a Diamond card for a defensive barrier before entering combat.
    4.  *Lesson 4: Stance Clash* — Requires an Overcharge commitment against a Parry training drone and resolves the shared combat engine's real damage, barrier and reflection rules.
*   **In-Game Quick Reference Card:** The **Options → Rules** control allows players to inspect hand rankings, stance matchups, and burn abilities at any time during an active match.

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
│   3-card/2-card split subsets │             │   suit/HP burn priorities     │
└───────────────┬───────────────┘             └───────────────┬───────────────┘
                │                                             │
                └──────────────────────┬──────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Flux Optimizer (Selected-Partition Pip Nudge Search)        │
│ • Simulates one-step nudges; requires Assault tier upgrade  │
│ • Requires utility gain >= 3; schedules at most one nudge   │
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
1.  **Cipher-0 (Balanced / Tactical):** Uses Spec-05's balanced utility weights. Searches the initially selected Assault partition for at most one rank nudge that upgrades the tier and improves utility by at least 3. Uses prioritized burns and HP-dependent stance selection; it does not schedule Suit Bleed.
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
│                 Authoritative Game Server (Node.js)              │
│   • Room Lifecycle Manager     • Deterministic CSPRNG Deck      │
│   • 15s/10s Phase Timers       • Anti-Cheat Masking Engine      │
│   • 30s Disconnect Grace       • Automated Headless Test Suites │
└─────────────────────────────────────────────────────────────────┘
```

### 7.1 Anti-Cheat & Authority Guarantees
*   **Card Privacy:** Server holds all private card state. During Deal, Shaping and Commitment, `STATE_TICK.selfCards` contains only the receiving player's hand. Opponent cards, selected lanes and stance are omitted entirely until `CLASH_REVEAL`, when `ROUND_OUTCOME` reveals both hands, as specified in Specs 01/04.
*   **Simultaneous Lock-In:** Clients submit their 3-card/2-card split and chosen stance blinds. If a client disconnects or times out before the 10-second Commitment window closes, the server deterministically auto-locks the optimal ten-partition split (highest Assault score, then Aegis score, then first partition) and defaults to *Brace* stance.
*   **Disconnect Lifecycle:** Unexpected socket loss reserves the seat through its own 30-second grace deadline, even if both players disconnect; normal phase timers continue. Resume requires a crypto token, a disconnected seat and an unexpired deadline. Deliberate `CMD_LEAVE_ROOM` forfeits immediately. Grace expiry cancels phase timers and reports the winner in `STATE_TICK`; delete the room once every participant has departed or exhausted grace.

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
  activeBurn: BurnType | null;
  connected: boolean;
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

// Network contracts. RoundResolution is the complete shared combat result.
export type ClientMessage =
  | { type: 'CMD_CREATE_ROOM'; playerName: string }
  | { type: 'CMD_JOIN_ROOM'; roomCode: string; playerName: string }
  | { type: 'CMD_RECONNECT'; roomCode: string; playerId: string; sessionToken: string }
  | { type: 'CMD_NUDGE_RANK'; cardId: string; direction: 'UP' | 'DOWN' }
  | { type: 'CMD_BLEED_SUIT'; cardId: string; targetSuit: Suit }
  | { type: 'CMD_BURN_CAST'; cardId: string }
  | { type: 'CMD_READY' }
  | { type: 'CMD_LEAVE_ROOM' }
  | {
      type: 'CMD_COMMIT_HAND';
      assaultCardIds: [string, string, string];
      aegisCardIds: [string, string];
      stance: Stance;
    }
  | { type: 'CMD_REMATCH' };

// ----------------------------------------------------------------------------
// Server-to-Client Messages
// ----------------------------------------------------------------------------
export type ServerMessage =
  | { type: 'STATE_INIT'; playerId: string; matchId: string; roomCode: string; opponentName: string; sessionToken?: string }
  | {
      type: 'STATE_TICK';
      phase: GamePhase;
      timeRemainingMs: number;
      matchWinnerId: string | null;
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

---

## 8. Repository Skeleton & Directory Layout

The codebase is organized as a clean, modular TypeScript monorepo with explicit stubs prepared for OpenAI Codex:

```
cyberante/
├── .github/
│   └── workflows/
│       └── ci.yml                     # Strict builds, tests, coverage & bundle audits
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
│   ├── server/                        # Authoritative Node.js WebSocket Server
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
    *   *Invariants:* Strictly non-LLM; deterministic ten-partition utility calculation, one-step Pip Nudge and prioritized tactical burns. Spec-10 owns the 1–2s human thinking pauses in the solo controller.
*   **`spec-06-procedural-audio-engine.md` (Web Audio API Synthesizer):**
    *   *Scope:* Implement `packages/client/src/audio/AudioEngine.ts`, `ProceduralMusic.ts`, and `SoundEffects.ts`.
    *   *Invariants:* Zero audio file downloads; procedural phase-specific synthwave arpeggiator; responsive SFX triggers; dynamic audio-reactive FFT node, following Spec-06.
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
4. **Verification Command:** The exact test command (e.g., `npx vitest run packages/server/src/__tests__/evaluator.test.ts`) that must pass with zero errors.
```

---

## 10. Contest Reconciliation & Gap Analysis

A rigorous cross-examination of the Handshake AI Skills Studio × OpenAI Multiplayer Game Challenge Official Rules against our architecture reveals key strategic alignments and safeguards:

### 10.1 Key Weaknesses Identified & Architectural Mitigations

| Identified Risk / Weakness | Impact on Contest Judging | Architectural Mitigation in CYBERANTE |
| :--- | :--- | :--- |
| **"The Empty Lobby Problem"** | Contest judges often test entries alone without an active multiplayer partner. If matchmaking requires two humans, the judge gets stuck on a loading screen and fails the entry. | **Solo Mode vs. Local Classical AI**: A judge can immediately click "Play Solo" from the main screen to experience full, responsive Best-of-3 gameplay against a tailored bot. |
| **Steep Learning Curve for Poker-Combat** | Unfamiliarity with split-lane commitment or Flux transmutations could cause judges to score low on "Polish & Thoughtfulness" (1/5: *Rough, confusing, limited usability*). | **Interactive Main Menu Tutorial & Rules Overlay**: Four user-paced, action-gated lessons teach split lanes, a Pip Nudge, a Diamond burn and a stance clash. The rules overlay covers the remaining mechanics. Completion time depends on the player, as permitted by Spec-09. |
| **External Asset Latency / 404 Failures** | Slow Wi-Fi or hosted server latency during asset loading creates jank or failed demo presentations. | **100% Procedural Generation**: Zero audio files and zero image textures. All graphics and audio are generated in code. Spec-10 enforces less than 250,000 gzip bytes across all emitted JavaScript; cold-load timing depends on network/device conditions and is not inferred from bundle size. |
| **Flaky Network / Disconnect Timeouts** | Latency spikes or browser tab switching during live multiplayer matches could freeze the game room. | **Authoritative Auto-Lock Timeouts**: If a player's connection drops during the 10-second commitment window, the server automatically computes the optimal ten-partition split (highest Assault score, then Aegis score, then first partition) and defaults to *Brace*, ensuring matches never hang. |
| **OpenAI Attribution Clarity** | The contest explicitly mandates: *"built with OpenAI: Create a Multiplayer Game mission in Handshake."* Earlier draft referenced non-OpenAI tooling. | **OpenAI Codex Spec-Driven Pipeline**: All references updated to OpenAI Codex. Implementation artifacts, prompt specifications, and git history explicitly document OpenAI Codex's role as the agentic coder implementation expert. |

### 10.2 Official Submission Deliverables Checklist
Page 1 of the [repository's contest-rules PDF](<../[AI Skills Studio Challenge] Contest Official Rules.pdf>) lists four entry components and an October 30, 2026, 11:59 PM Pacific deadline. This verifies the stored-document reference; current organizer rules and entrant eligibility require separate confirmation:

*   [x] **a. Project Title:** `CYBERANTE: Procedural Vector Poker-Combat Matrix`
*   [x] **b. Project Cover Image:** [Prepared WebGL clash capture](submission/cover.png) showcasing the neon vector grid, revealed cards and particle shockwave. Local artifact; not yet submitted.
*   [x] **c. Project Description:** [Prepared description](submission/description.md) highlighting poker strategy, fighting-game stances, procedural WebGL/WebAudio, Solo/Multiplayer and OpenAI Codex. Local artifact; not yet submitted.
*   [x] **d. Project Link/URL:** [Public game](https://holactie.com/cyberante/) on the user's DigitalOcean Droplet. The user confirmed successful end-to-end operation on 2026-10-05. This supplies the URL deliverable; performance is user accepted, while detailed deployment/recovery evidence remains open in [release acceptance](qa/release_acceptance.md). No contest submission is implied.
