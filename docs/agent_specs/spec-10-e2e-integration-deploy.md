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
- [ ] End-to-end playable Solo Mode with local `MatchEngine` and `ClassicalBotAI`.
- [ ] End-to-end playable Multiplayer Mode with WebSockets and room codes.
- [ ] Seamless audio unlocking and phase-adaptive music/SFX coupling.
- [ ] Three.js reactive vector grid and particle explosions synchronized to combat events.
- [ ] Single-port production static client serving and WebSocket matchmaking.
- [ ] Full monorepo verification passing: `npm run build && npm test && npm run sim`.
