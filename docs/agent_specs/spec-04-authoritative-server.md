# SPEC-04: Authoritative WebSocket Server & Room Lifecycle

## 1. Goal & Non-Goals
- **Goal:** Implement the authoritative multiplayer WebSocket server, Room state machine, RoomManager, phase countdown timers, input validation, auto-lock fallback on timeout, and single-port static client serving for production deployments.
- **Non-Goals:** Do not execute client-side WebGL rendering, browser audio synthesis, or persistent SQL database storage (all rooms are managed in-memory).

## 2. Inputs, Target Files & Dependencies
- **Target Files:**
  - `packages/server/src/Room.ts`
  - `packages/server/src/RoomManager.ts`
  - `packages/server/src/index.ts`
  - `packages/server/src/__tests__/roomLifecycle.test.ts`
  - `packages/server/src/messageValidation.ts`
  - `packages/server/src/__tests__/messageValidation.test.ts`
  - `packages/server/src/__tests__/serverTransport.test.ts`
- **Dependencies:**
  - `ws` (^8.17.1) for WebSocket server management.
  - Node.js built-ins (`http`, `fs`, `path`, `url`).
  - `@cyberante/shared` contracts (`ClientMessage`, `ServerMessage`, `MatchEngine`, `GamePhase`, `Stance`, `Card`, `GAME_CONSTANTS`).
  - Strict TypeScript `NodeNext` ESM compliance with explicit `.js` import extensions.

## 3. Public API & Contract Signatures

### 3.1 Room Class (`packages/server/src/Room.ts`)
```typescript
import { WebSocket } from 'ws';
import { ClientMessage, ServerMessage, GamePhase } from '@cyberante/shared';

export class Room {
  public readonly roomCode: string;

  constructor(roomCode: string, onEmpty?: () => void);

  public addPlayer(ws: WebSocket, playerName: string): string | null;
  public removePlayer(playerId: string): void;
  public handleMessage(playerId: string, msg: ClientMessage): void;
  public broadcast(msg: ServerMessage): void;
  public sendTo(playerId: string, msg: ServerMessage): void;

  public get isFull(): boolean;
  public get isEmpty(): boolean;
  public destroy(): void;
}
```

`removePlayer` means deliberate departure. Unexpected transport closes use
`disconnectPlayer(playerId: string, ws: WebSocket): void`. Room additionally
exposes `reconnectPlayer(playerId: string, sessionToken: string, ws: WebSocket): boolean`
and `ownsSocket(playerId: string, ws: WebSocket): boolean` to enforce socket ownership.
`destroy` is idempotent, cancels all phase/grace handles and closes connected
room sockets with code 1001; it cannot close departed sockets reused elsewhere.
`isFull` counts reserved seats, including disconnected/departed seats in an
existing match; a third participant never replaces a match participant.

### 3.2 RoomManager Class (`packages/server/src/RoomManager.ts`)
```typescript
import { Room } from './Room.js';

export class RoomManager {
  public createRoom(): Room;
  public getRoom(roomCode: string): Room | null;
  public removeRoom(roomCode: string): void;
  public get activeRoomCount(): number;
  public generateUniqueRoomCode(): string;
}
```

RoomManager also exposes `destroy(): void` for server shutdown.

### 3.3 HTTP & WebSocket Server (`packages/server/src/index.ts`)
- Listens on `process.env.PORT || 8080`.
- Upgrades incoming HTTP requests to WebSocket connection on `/ws` or root.
- Handles HTTP GET requests to serve static files from `packages/client/dist/` (with correct MIME types: `text/html`, `application/javascript`, `text/css`, `image/svg+xml`, `image/x-icon`, `application/json`).
- Responds with `index.html` on root (`/`) and SPA fallback paths. Missing files with extensions return 404; invalid URL encodings return 400 and paths/symlinks escaping the client directory return 403.
- `createGameServer({ clientDist? })` constructs the real HTTP/WS server without listening, returning `server`, `wss`, `roomManager`, and idempotent async `close`. Running the entry point directly listens on the configured port; SIGINT/SIGTERM close sockets, rooms and timers.
- Shared protocol adds `CMD_LEAVE_ROOM` and `STATE_TICK.matchWinnerId: string | null` so deliberate exit and forfeit results are observable. The client transport sends leave before a deliberate close; automatic client recovery remains Spec-10 work.

## 4. Detailed Behavior & Room Lifecycle Flow

### 4.1 Room Creation & Player Handshake
1. **Room Code Generation:** 4-character uppercase alphanumeric code using unambiguous characters (e.g. `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, excluding `0`, `O`, `1`, `I`).
2. **Player 1 Joins:**
   - Server creates room via `roomManager.createRoom()`.
   - Player 1 socket connects and sends `{ type: 'CMD_CREATE_ROOM', playerName }`.
   - Player 1 is assigned `playerId: 'player_1'`.
   - Server responds with `{ type: 'STATE_INIT', playerId: 'player_1', matchId, roomCode, opponentName: 'Waiting...' }`.
   - Room phase is `LOBBY_WAIT`.
3. **Player 2 Joins:**
   - Player 2 socket connects and sends `{ type: 'CMD_JOIN_ROOM', roomCode, playerName }`.
   - Server validates room existence and capacity.
   - Player 2 is assigned `playerId: 'player_2'`.
   - Server responds with `{ type: 'STATE_INIT', playerId: 'player_2', matchId, roomCode, opponentName: p1.name }`.
   - Server sends one updated `STATE_INIT` to Player 1 with `opponentName: p2.name`. Player 2 receives exactly one init; match start does not repeat its handshake.
   - Room is now full (`isFull === true`). Match begins immediately!

### 4.2 Phase Loop & Countdown Timers (Option A)
The room coordinates the underlying `MatchEngine` through the 5 phases of an exchange:

| Phase | Duration | Server Actions & Message Broadcasts |
|---|---|---|
| `DEAL` | 2,000ms | MatchEngine deals 5 cards to each player. Server broadcasts `STATE_TICK`. Opponent cards remain masked. On timer expiry $\to$ advances to `SHAPING`. |
| `SHAPING` | 15,000ms | Server accepts `CMD_NUDGE_RANK`, `CMD_BLEED_SUIT`, `CMD_BURN_CAST`, and `CMD_READY`. If both players signal ready before timer expires $\to$ cancels timer and advances to `COMMITMENT` immediately. |
| `COMMITMENT` | 10,000ms | Server accepts `CMD_COMMIT_HAND`. If both players commit $\to$ cancels timer and advances to `CLASH_REVEAL` immediately. **Timeout Fallback:** If timer expires, server auto-commits optimal ten-partition split with `BRACE` (highest Assault score, breaking ties by Aegis score, fallback to first partition). |
| `CLASH_REVEAL` | 4,000ms | MatchEngine resolves combat damage, stances, reflections, and burns. Server broadcasts `ROUND_OUTCOME` with complete `RoundResolution` and full card reveals for both players. |
| `ROUND_RESOLVE` | 3,000ms | Damage is tallied. Checks `isRoundOver`: <br>• If round continues $\to$ advances to next exchange (`DEAL`) with carry-over HP. <br>• If round won $\to$ increments winner round points and checks if match won (`roundWins >= 2`). If match won $\to$ transitions to `MATCH_OVER`. Otherwise resets HP to 20 and starts next round (`DEAL`). <br>*Lifecycle Invariant:* Round number increment and Guard HP reset to 20 MUST occur at the start of the new round (in `startExchange`), preserving the 0 HP knockout state during `CLASH_REVEAL` and `ROUND_RESOLVE`. |

### 4.3 Anti-Cheat & Information Masking
- During `DEAL`, `SHAPING`, and `COMMITMENT`, `STATE_TICK` broadcasts strictly sanitize opponent data.
- The `selfCards` field in `STATE_TICK` contains the requesting player's actual hand.
- The opponent's `cards` array is never sent over the wire until `CLASH_REVEAL`, preventing client-side inspection cheats.

### 4.4 Disconnect & Resume Contract (30s Grace Period)
- **Session Token:** On initial connection (`CMD_CREATE_ROOM` or `CMD_JOIN_ROOM`), the server generates a cryptographically random `sessionToken` returned in `STATE_INIT`.
- **Disconnect:** When a client socket closes:
  - The participant's `connected` flag in `PlayerPublicState` is marked `false`.
  - A 30-second disconnect grace timer starts.
- **Reconnect:**
  - Client sends `{ type: 'CMD_RECONNECT', roomCode, playerId, sessionToken }`.
  - Server verifies matching `roomCode`, `playerId`, and `sessionToken`.
  - If valid and within 30s: the new socket replaces the dropped socket, `connected` is set to `true`, the grace timer is cancelled, and server immediately sends `STATE_INIT` + current `STATE_TICK`.
- **Forfeit:** If the 30s timer expires without reconnection, match forfeits to the remaining player (`matchWinnerId` set, `phase` set to `MATCH_OVER`).
- **Accepted boundary decision:** Unexpected connection loss retains both reserved seats through each participant's own 30s deadline, including a waiting host. Phase timers continue with timeout auto-lock; they do not pause or restart on reconnect.
- Reconnect requires a disconnected, non-departed seat before its deadline. Connected-seat takeover, wrong credentials, expired sessions and old socket close events cannot evict a live replacement. Resume sends the current countdown/private hand; if already in reveal/resolve or a completed combat match, also send the current exchange outcome. A forfeit does not replay an older exchange.
- On grace expiry, invalidate that seat and forfeit to the other reserved participant. Cancel phase timers so they cannot overwrite `MATCH_OVER`. If the other player is also disconnected but still within their deadline, retain their opportunity to resume and see the forfeit result. Delete the room once every participant has departed or exhausted grace.
- **Deliberate exit:** `CMD_LEAVE_ROOM` / `removePlayer` invalidates resume immediately and forfeits without waiting. When both deliberately leave, cancel all timers and invoke the registry cleanup callback exactly once.
- Rematch requires both connected participants to send `CMD_REMATCH` after `MATCH_OVER`; reset HP, scores and per-exchange state when both agree.

## 5. Invariants & Edge Cases
1. **Third-Player Rejection:** If a third client attempts to join a full room, server responds immediately with `{ type: 'ERROR_REJECTED', reason: 'Room is full' }` and closes connection.
2. **Non-Existent Room Code:** Joining an invalid code returns `{ type: 'ERROR_REJECTED', reason: 'Room not found' }`.
3. **Card Partition Validation:** `CMD_COMMIT_HAND` must validate that:
   - Exactly 3 Assault cards and 2 Aegis cards are provided.
   - All 5 card IDs are distinct.
   - All 5 card IDs currently reside in the player's 5-card hand.
   - Stance is one of `'BRACE' | 'OVERCHARGE' | 'PARRY'`.
   - Player has not already committed for this exchange (no overwriting).
   - Failure returns `ERROR_REJECTED: Invalid hand partition`.
4. **Out-of-Phase Action:** Submitting transmutations outside `SHAPING` phase returns `ERROR_REJECTED: Actions only permitted during SHAPING phase`.
5. **Input Validation & DoS Protection:**
   - Incoming WebSocket payloads must not exceed 4KB (4096 bytes).
   - Payloads must be valid JSON objects with a recognized `type` and valid command fields. Names are nonblank strings up to 32 characters; IDs up to 128; room codes normalize to the unambiguous four-character alphabet; resume tokens are 64 hex characters. Validate lane lengths/elements, directions, suits and stances before delegation.
   - A socket binds to one room/seat. Reject repeated create/join/reconnect commands while bound, and actions before joining. Only a deliberate leave releases the binding for another room.
   - Reject binary messages. Count UTF-8 bytes, rather than characters. A bounded 64KB receiver envelope permits `ERROR_REJECTED` for ordinary payloads over 4KB; frames exceeding the envelope are closed with transport code 1009. Compression is disabled.
   - Malformed or oversize payloads are rejected with `ERROR_REJECTED`.

## 6. Forbidden Boundaries & Anti-Patterns
- Never trust client-submitted damage or evaluation values; state is 100% server-authoritative.
- Never leak opponent card ranks or suits before `CLASH_REVEAL`.
- Never leave dangling timer handles (`setTimeout`, `setInterval`) running when a room is destroyed.
- Never require an external database or cache service (Redis/Postgres).

## 7. Test Specifications (`packages/server/src/__tests__/roomLifecycle.test.ts`)
- **Room Creation:** Create room, assert unique 4-character code, assert room is in `LOBBY_WAIT`.
- **Player Joining:**
  - Add Player 1 $\to$ assert returns `player_1`, player receives `STATE_INIT`.
  - Add Player 2 $\to$ assert returns `player_2`, room reports `isFull: true`.
  - Assert both players transition to `DEAL` phase.
- **Third Player Rejection:** Add Player 3 $\to$ assert returns `null` or error rejection message.
- **Input Validation:**
  - Submit invalid hand partition (e.g. 4 assault cards) $\to$ assert rejected.
  - Submit valid hand partition $\to$ assert committed flag is true.
- **Disconnect Cleanup:** Remove both players $\to$ assert room invokes `onEmpty` callback and removes from `RoomManager`.

Additional coverage includes all phase durations and early cancellation, optimal
fallback, one clash, HP carry/KO display/new-round reset/Bo3/rematch, private-state
masking, token/deadline/socket ownership, both-disconnected grace, lobby expiry,
forfeit cancellation and idempotent destruction. Real transport tests cover two
clients, malformed/binary/oversized commands, HTTP assets/SPA/MIME/traversal,
accepted upgrade routes, reconnect, deliberate exit and shutdown.

## 8. Exact Verification Command
```bash
npx vitest run packages/server/src/__tests__/roomLifecycle.test.ts
```

## 9. Codex Dispatch Prompt
```markdown
### Codex Task: Authoritative WebSocket Server & Room Lifecycle (Spec-04)
Implement/refactor the authoritative Room state machine and RoomManager according to `docs/agent_specs/spec-04-authoritative-server.md`.

Target files:
- `packages/server/src/Room.ts`
- `packages/server/src/RoomManager.ts`
- `packages/server/src/index.ts`
- `packages/server/src/__tests__/roomLifecycle.test.ts`

Requirements:
1. Refactor Room and RoomManager to conform to the target signatures in Section 3 of the spec.
2. Wire Room state machine to delegate to `MatchEngine`.
3. Implement phase timer transitions: DEAL (2s) -> SHAPING (15s) -> COMMITMENT (10s) -> CLASH_REVEAL (4s) -> ROUND_RESOLVE (3s).
4. Validate client input (hand partitioning, transmutations) and sanitize opponent cards until Clash.
5. Auto-lock optimal hand partition if player times out during Commitment.
6. Verify tests pass: `npx vitest run packages/server/src/__tests__/roomLifecycle.test.ts`.
```

## 10. Definition of Done Checklist
- [x] Room lifecycle state machine driving `MatchEngine`.
- [x] RoomManager creating and cleaning up 4-character room codes.
- [x] Phase timer transitions with early-advance on mutual ready/commit.
- [x] Auto-lock fallback on Commitment timeout.
- [x] Information masking preventing card leaks to opponents before Clash.
- [x] Single-port HTTP static serving of client bundle alongside WebSockets.
- [x] All room lifecycle unit tests passing under `vitest`.

### Dispatch evidence (2026-10-03)
- Exact Spec-04 command: 23 room lifecycle tests passed, with fake-clock phase,
  recovery and complete timer cleanup assertions.
- Additional suites: 11 runtime schema tests and 12 real transport/HTTP/process
  tests. The compiled entry point serves the built client on one ephemeral
  port and exits with code 0 on both SIGINT and SIGTERM with an active match.
- Full gate: `npm run build && npm test && npm run sim` exits 0 with 166 tests
  and 300 seeded simulated matches. Local network tests require port-listener
  permission in the Codex sandbox; they are not skipped.
- Three.js is now a separate 460.94 kB chunk, application code 64.74 kB; combined
  JS gzip size 133.77 kB. Build completes without the previous chunk warning.
- Browser auto-resume/UI handling remains Spec-10 acceptance work; server
  protocol and transport recovery are verified here. Mirror pacing remains
  1.72 exchanges/round, a documented Spec-05 balance follow-up.
