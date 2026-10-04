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

### 3.3 HTTP & WebSocket Server (`packages/server/src/index.ts`)
- Listens on `process.env.PORT || 8080`.
- Upgrades incoming HTTP requests to WebSocket connection on `/ws` or root.
- Handles HTTP GET requests to serve static files from `packages/client/dist/` (with correct MIME types: `text/html`, `application/javascript`, `text/css`, `image/svg+xml`, `image/x-icon`, `application/json`).
- Responds with `index.html` on root (`/`) and SPA fallback paths.

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
   - Server sends update to Player 1 updating `opponentName: p2.name`.
   - Room is now full (`isFull === true`). Match begins immediately!

### 4.2 Phase Loop & Countdown Timers (Option A)
The room coordinates the underlying `MatchEngine` through the 5 phases of an exchange:

| Phase | Duration | Server Actions & Message Broadcasts |
|---|---|---|
| `DEAL` | 2,000ms | MatchEngine deals 5 cards to each player. Server broadcasts `STATE_TICK`. Opponent cards remain masked. On timer expiry $\to$ advances to `SHAPING`. |
| `SHAPING` | 15,000ms | Server accepts `CMD_NUDGE_RANK`, `CMD_BLEED_SUIT`, `CMD_BURN_CAST`, and `CMD_READY`. If both players signal ready before timer expires $\to$ cancels timer and advances to `COMMITMENT` immediately. |
| `COMMITMENT` | 10,000ms | Server accepts `CMD_COMMIT_HAND`. If both players commit $\to$ cancels timer and advances to `CLASH_REVEAL` immediately. **Timeout Fallback:** If timer expires, server auto-commits optimal split with `BRACE`. |
| `CLASH_REVEAL` | 4,000ms | MatchEngine resolves combat damage, stances, reflections, and burns. Server broadcasts `ROUND_OUTCOME` with complete `RoundResolution` and full card reveals for both players. |
| `ROUND_RESOLVE` | 3,000ms | Damage is tallied. Checks `isRoundOver`: <br>• If round continues $\to$ advances to next exchange (`DEAL`) with carry-over HP. <br>• If round won $\to$ increments winner round points and checks if match won (`roundWins >= 2`). If match won $\to$ transitions to `MATCH_OVER`. Otherwise resets HP to 20 and starts next round (`DEAL`). |

### 4.3 Anti-Cheat & Information Masking
- During `DEAL`, `SHAPING`, and `COMMITMENT`, `STATE_TICK` broadcasts strictly sanitize opponent data.
- The `selfCards` field in `STATE_TICK` contains the requesting player's actual hand.
- The opponent's `cards` array is never sent over the wire until `CLASH_REVEAL`, preventing client-side inspection cheats.

### 4.4 Disconnect & Cleanup
- When a client socket closes:
  - If match is active, player's `connected` flag is set to `false`.
  - If disconnected player does not reconnect within 30 seconds, match forfeits to the remaining player.
  - When both players leave, room timers are cancelled and `roomManager.removeRoom(roomCode)` is invoked to prevent memory leaks.

## 5. Invariants & Edge Cases
1. **Third-Player Rejection:** If a third client attempts to join a full room, server responds immediately with `{ type: 'ERROR_REJECTED', reason: 'Room is full' }` and closes connection.
2. **Non-Existent Room Code:** Joining an invalid code returns `{ type: 'ERROR_REJECTED', reason: 'Room not found' }`.
3. **Card Partition Validation:** `CMD_COMMIT_HAND` must validate that:
   - Exactly 3 Assault cards and 2 Aegis cards are provided.
   - All 5 card IDs are distinct.
   - All 5 card IDs currently reside in the player's 5-card hand.
   - Failure returns `ERROR_REJECTED: Invalid hand partition`.
4. **Out-of-Phase Action:** Submitting transmutations outside `SHAPING` phase returns `ERROR_REJECTED: Actions only permitted during SHAPING phase`.

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
- [ ] Room lifecycle state machine driving `MatchEngine`.
- [ ] RoomManager creating and cleaning up 4-character room codes.
- [ ] Phase timer transitions with early-advance on mutual ready/commit.
- [ ] Auto-lock fallback on Commitment timeout.
- [ ] Information masking preventing card leaks to opponents before Clash.
- [ ] Single-port HTTP static serving of client bundle alongside WebSockets.
- [ ] All room lifecycle unit tests passing under `vitest`.
