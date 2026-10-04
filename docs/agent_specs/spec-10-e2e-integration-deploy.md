# SPEC-10: End-to-End Wire Integration & Zero-Install Deployment

## 1. Context & Objective
Integrate all packages into an end-to-end operational build. Connect client WebSocket networking, solo offline bot routing, audio, and Three.js canvas.

## 2. Target Files
- `packages/client/src/net/NetworkClient.ts`
- `packages/client/src/main.ts`
- `package.json`

## 3. Invariants & Rules
1. **Mode Routing:**
   - Play Solo $\rightarrow$ routes to local `ClassicalBotAI` state machine.
   - Online Multiplayer $\rightarrow$ routes to `NetworkClient` WebSocket connection.
   - Tutorial $\rightarrow$ routes to `TutorialManager`.
2. **Bundle Optimization:** Zero external media assets; bundle size under 500KB gzipped.
3. **Continuous Integration:** Headless test suite passes cleanly on Linux/WSL2 and GitHub Actions.

## 4. Verification Command
```bash
npm run build && npm test
```
