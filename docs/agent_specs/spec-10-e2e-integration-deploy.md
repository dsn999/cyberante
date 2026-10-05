# SPEC-10: End-to-End Integration, Pacing & Universal Deployment

## 1. Goal & Non-Goals
- **Goal:** Wire together offline Solo Mode (via `MatchEngine` and `ClassicalBotAI`), online multiplayer (WebSockets via `NetworkClient`), procedural Web Audio, and Three.js canvas into an end-to-end operational build deployable to any universal web host with a single command.
- **Non-Goals:** Do not introduce external database services (PostgreSQL/Redis) or heavy container orchestrators.

## 2. Inputs, Target Files & Dependencies
- **Target Files:**
  - `packages/client/src/main.ts`
  - `packages/client/src/net/NetworkClient.ts`
  - `packages/server/src/index.ts`
  - `package.json`
  - `.github/workflows/ci.yml`
- **Dependencies:**
  - Monorepo workspaces (`@cyberante/shared`, `@cyberante/server`, `@cyberante/client`).
  - Node.js $\ge 20.0.0$ runtime.

## 3. Public API & Architecture Routing

### 3.1 NetworkClient Class (`packages/client/src/net/NetworkClient.ts`)
```typescript
import { ClientMessage, ServerMessage, Suit, Stance } from '@cyberante/shared';

export class NetworkClient {
  public connect(url?: string): Promise<void>;
  public disconnect(): void;

  public createRoom(playerName: string): void;
  public joinRoom(roomCode: string, playerName: string): void;

  public nudgeRank(cardId: string, direction: 'UP' | 'DOWN'): void;
  public bleedSuit(cardId: string, targetSuit: Suit): void;
  public burnCard(cardId: string): void;
  public commitHand(
    assaultCardIds: [string, string, string],
    aegisCardIds: [string, string],
    stance: Stance
  ): void;
  public ready(): void;

  public on(event: string, callback: (...args: any[]) => void): void;
  public get isConnected(): boolean;
}
```

### 3.2 Main Controller & Game Mode Router (`packages/client/src/main.ts`)
```typescript
// Mode Dispatcher:
// 1. Solo Mode:
function startSoloMatch(profile: BotPersonality): void;

// 2. Multiplayer Host:
function createMultiplayerMatch(playerName: string): void;

// 3. Multiplayer Join:
function joinMultiplayerMatch(roomCode: string, playerName: string): void;

// 4. Interactive Tutorial:
function startTutorial(): void;
```

### 3.3 Production Single-Port Serving (`packages/server/src/index.ts`)
- Serves static compiled client files from `packages/client/dist` on HTTP GET.
- Upgrades WebSocket connections on the same HTTP server instance (`PORT` or 8080).
- Enables single-container or single-process deployment to Fly.io, Render, Railway, or VPS.

## 4. Detailed Behavior & End-to-End Pacing

### 4.1 Game Mode Lifecycles
1. **Solo Mode (Offline vs. Classical AI):**
   - Instantiates local `MatchEngine` with `ClassicalBotAI`.
   - Runs deterministic, zero-latency local state ticks.
   - Simulates realistic 1.0–1.5s thinking pause before bot commits hand.
   - 100% playable even if user loses internet connection.
2. **Multiplayer Mode (Authoritative Server):**
   - Connects to WebSocket server.
   - Perspective Mapping: Server designates `player_1` and `player_2`. The client maps the local user to the lower player dock and the remote opponent to the upper status bar.
   - Dynamic URL Sharing: Host can copy a 4-character room code or direct join link (`?room=ABCD`).
3. **Tutorial Mode:**
   - Hands off UI control to `TutorialManager` for the 4 interactive lessons.

### 4.2 Audio-Visual Integration Loop
1. **Gesture Audio Unlock:** First click on the Main Menu triggers `AudioEngine.init()` and `AudioEngine.resume()`.
2. **Dynamic Soundtrack Pacing:** Procedural music adapts BPM and low-pass filter cutoff according to current `GamePhase`.
3. **Reactive Grid Shockwaves:**
   - Card transmutations trigger localized spark bursts.
   - Clash reveal triggers high-intensity collision sparks and radial grid shockwave.
   - Web Audio FFT bass levels continuously pulse the wireframe grid amplitude.

### 4.3 Option A Match Pacing & Resolution
- **Format:** Best-of-3 Rounds (`ROUNDS_TO_WIN: 2`).
- **Exchange Loop:** Sequential 30–40s exchanges continue until a player reaches 0 Guard HP.
- **HP Carry-Over:** Unmitigated damage reduces Guard HP, which persists across exchanges within the same round.
- **Round Reset:** When a player hits 0 HP, round winner gains 1 round point, and HP resets to 20 for the next round.
- **Match Victory:** First player to secure 2 round points triggers match victory fanfare, particle confetti, and Rematch button.

## 5. Invariants & Edge Cases
1. **Dynamic WebSocket URL:** Never hardcode `localhost:8080`. In production, client must detect protocol and host:
   ```typescript
   const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
   const wsUrl = `${protocol}//${window.location.host}/ws`;
   ```
2. **Zero External Media Footprint:** Bundle size remains extremely lean: gzipped client bundle $< 250\text{KB}$ with zero external image or audio files.
3. **Graceful Disconnects:** If WebSocket drops during multiplayer, UI displays reconnecting banner and attempts reconnection.
4. **Clean Process Exit:** Server gracefully cleans up open sockets and timers on `SIGTERM` or `SIGINT`.

## 6. Forbidden Boundaries & Anti-Patterns
- Do NOT require external databases (Postgres, MySQL, Redis, MongoDB).
- Do NOT leak opponent card data to client DOM before Clash Reveal.
- Do NOT use unbundled files or raw TypeScript in production builds.

## 7. Test Specifications & Verification Gates
The full integration pipeline verifies three levels of correctness:
1. **Compilation & Declarations:** `npm run build` runs `tsc` and `vite build` across all 3 packages with zero diagnostics.
2. **Unit & Integration Tests:** `npm test` runs all test suites (`evaluator.test.ts`, `combat.test.ts`, `deckFlux.test.ts`, `roomLifecycle.test.ts`).
3. **Headless Simulation:** `npm run sim` executes 300 complete matches headlessly under `balanceSimulator.test.ts`.

## 8. Exact Verification Command
```bash
npm run build && npm test && npm run sim
```

## 9. Codex Dispatch Prompt
```markdown
### Codex Task: End-to-End Integration, Pacing & Deployment (Spec-10)
Implement/refactor the complete client and server integration according to `docs/agent_specs/spec-10-e2e-integration-deploy.md`.

Target files:
- `packages/client/src/main.ts`
- `packages/client/src/net/NetworkClient.ts`
- `packages/server/src/index.ts`
- `package.json`
- `.github/workflows/ci.yml`

Requirements:
1. Implement mode routing in `main.ts` for Solo Mode (local MatchEngine + ClassicalBotAI), Multiplayer (NetworkClient), and Tutorial.
2. Align perspective mapping so local player always displays in lower dock.
3. Configure `packages/server/src/index.ts` to serve both WebSockets and static client bundle on `process.env.PORT || 8080`.
4. Ensure zero-asset production build passes cleanly: `npm run build && npm test && npm run sim`.
```

## 10. Definition of Done Checklist
- [x] End-to-end playable Solo Mode with local `MatchEngine` and `ClassicalBotAI`.
- [x] End-to-end playable Multiplayer Mode with WebSockets and room codes.
- [x] Seamless audio unlocking and phase-adaptive music/SFX coupling.
- [x] Three.js reactive vector grid and particle explosions synchronized to combat events.
- [x] Single-port production static client serving and WebSocket matchmaking.
- [x] Full monorepo verification passing: `npm run build && npm test && npm run sim`.

### Spec-10A milestone evidence

- [x] Local DEAL → SHAPING → COMMITMENT → CLASH_REVEAL → ROUND_RESOLVE loop, 1–1.5-second bot commitment pause, idle auto-lock, HP carry/reset and complete Bo3.
- [x] Browser play against all three bot profiles while offline, solo rematch and exit, tutorial mode handoff, and one persistent canvas across mode switches.
- [x] Two independent browser sessions host/join through the production server with local lower-dock mapping, full clash reveals, Bo3 results, mutual rematch and deliberate-leave forfeit.
- [x] Clipboard copying of room codes and direct join links; join-link prefill.
- [x] Unexpected socket drop and page reload recover the original seat without joining again; recovery expiry clears credentials and the remaining player wins by forfeit.
- [x] Production-server commitment timeout auto-locks idle users and reveals their hands.

Executable evidence: `packages/client/src/__tests__/`, `e2e/integration.spec.ts`,
and the existing server transport/lifecycle suites. Run `npm run test:e2e` after
installing Chromium with `npx playwright install --with-deps chromium`.
Spec-10B finishes final integration and mobile/performance acceptance after
Specs 08, 06, 07 and 09. Its remaining acceptance items are recorded below.

### Spec-10B acceptance evidence (2026-10-04)

- [x] Audio gesture unlock, phase-adaptive music/FFT, stance/clash/impact cues,
  deduplicated match fanfare, mute and unsupported-audio behavior.
- [x] Reactive renderer, procedural victory confetti, independent CRT/motion
  settings, stable buffers and WebGL context-loss recovery.
- [x] Compiled server serves production assets and an active WebSocket room from
  outside the repository; both termination signals close unfinished HTTP
  requests, sockets and room timers with exit code 0.
- [x] Production entry points and all emitted chunks audited in CI: no media,
  raw TypeScript or source maps; 151,849 gzip JavaScript bytes, below 250,000.
- [x] Build, 358 unit/integration tests, and 300 seeded simulation matches pass.
- [x] All 32 production browser cases pass with one SwiftShader worker, including
  offline Bo3, online recovery/rematch, audio/renderer behavior, tutorial and
  keyboard/touch controls at emulated desktop/mobile sizes.
- [x] Master-design QA adds measured 100% evaluator/combat source coverage,
  public-state bot activity, local-seat clash effects and round-win confetti.
  The [full QA report](../qa/design_certification.md) records the user-approved
  master/spec reconciliation and the remaining physical FPS/public URL evidence.
- [x] Browser diagnostic page captures the real splash/arena/clash and exports
  device/settings/frame metadata, labels software rendering and cancels cleanly
  when hidden. CLI rejects native GPU-forcing options before browser launch.
- [x] Node build/start, PORT, health, HTTPS/WebSocket proxy and in-memory room
  operation documented in `docs/deployment.md`.
- [x] Desktop performance accepted by the user after public multiplayer play in Windows Chrome (2026-10-05 revised acceptance; GPU type and numeric FPS not measured).
- [x] Mobile performance accepted by the user after the other player used a physical iPad running Safari (2026-10-05 revised acceptance; numeric FPS not measured).

Physical performance acceptance was explicitly retained in Spec-10B by the user.
A forced native GPU experiment through WSL preceded a laptop freeze and hard
shutdown. That CLI path was removed; subsequent automated checks use SwiftShader
software rendering with one worker. Software FPS does not prove physical-device
acceptance. The original trace requirement is superseded by the user-approved
2026-10-05 revision below;
no further native GPU experiments through WSL are part of this workflow.

### Current release audit (2026-10-05)

The user-requested [Spec-07.1](spec-07.1-full-screen-arena-ui.md) revision is
implemented in `6e25db8`. Its build, 358 unit/integration checks, 300 matches,
153,026-byte gzip JS audit and 31 browser cases pass. Browser cases ran in three
completed single-worker SwiftShader batches; the separate timing diagnostic was
excluded. A fresh evaluator/combat coverage run measures all four metrics at 100%.

The [current full-design audit](../qa/design_certification_2026-10-05.md) preserves
the older requirements matrix and identifies release-specific evidence. Neither
physical hardware checkbox above can be closed yet, and master §10.2's public
game URL remains unverified. A new production-canvas cover is prepared locally;
no hosting or contest submission is implied by this audit.

The user requested `PUBLIC_GAME_URL_PENDING` while hosting is being secured.
[Release acceptance](../qa/release_acceptance.md) tracks this placeholder and the
missing device evidence. All corresponding acceptance items remain open.

### User-approved performance acceptance revision (2026-10-05)

The user reported successful public multiplayer between Windows Chrome and a
physical iPad running Safari and explicitly accepted observed performance. This
replaces the two mandatory quantitative physical FPS gates with user acceptance
of those desktop/tablet sessions. Integrated-GPU recordings, sustained 60 FPS
measurements and trace bundles are no longer required to close this release
performance gate. The 60 FPS engineering target remains; no numeric result is
inferred.

This does not establish compatibility with every modern device/browser or
unreported reconnect, thermal or warm-repeat results. Earlier dated audits
describe the evidence and contract then in force; the
[current acceptance record](../qa/release_acceptance.md) governs revised status.
