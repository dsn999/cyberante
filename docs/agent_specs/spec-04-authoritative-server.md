# SPEC-04: Authoritative WebSocket Server & Room Lifecycle

## 1. Context & Objective
Implement the authoritative multiplayer WebSocket room state machine managing client handshakes, phase clocks, input validation, and auto-lock fallbacks.

## 2. Target Files
- `packages/server/src/Room.ts`
- `packages/server/src/RoomManager.ts`
- `packages/server/src/index.ts`
- `packages/server/src/__tests__/roomLifecycle.test.ts`

## 3. Invariants & Rules
1. **Clock Timers:** Shaping Phase (15s) $\rightarrow$ Commitment Phase (10s) $\rightarrow$ Clash $\rightarrow$ Round Resolve.
2. **Anti-Cheat:** Opponent cards masked until Clash phase.
3. **Auto-Lock Grace:** Unsubmitted moves at countdown expiration auto-lock highest High Card hand + Brace stance.
4. **Room Registry:** 4-character room codes; supports private link joins (`?room=XXXX`).

## 4. Verification Command
```bash
npm test -- roomLifecycle.test.ts
```
