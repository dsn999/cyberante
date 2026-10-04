# Production operation

CYBERANTE requires Node.js 20 or newer. The compiled Node server serves the game,
the diagnostic page and WebSockets from one port. It needs no database.

## Build and start

From the repository root:

```bash
npm ci
npm run build
npm run verify:build
npm start
```

Open `http://localhost:8080`. Set `PORT` to use another port:

```bash
PORT=8081 npm start
```

For a host with separate build and start settings, use:

| Setting | Value |
| --- | --- |
| Working directory | Repository root |
| Build command | `npm ci && npm run build && npm run verify:build` |
| Start command | `npm start` |
| Health path | `/health` |
| Port | Host-provided `PORT`, or 8080 |

Keep `packages/shared/dist`, `packages/server/dist`, `packages/client/dist`,
the workspace manifests and installed runtime dependencies in the release.
Do not omit development dependencies before the build: TypeScript and Vite are
build dependencies. The runtime reads static files relative to the compiled
server entry point, so it does not depend on the process working directory.

## Proxy and lifecycle

Terminate HTTPS at the host or reverse proxy. Forward HTTP and the `/ws`
WebSocket upgrade to the same server process. The client selects `wss:` on HTTPS
and uses the current host; no client URL configuration is needed.

Use one server process per deployment. Rooms and reconnect credentials live in
memory; restarting the process ends those rooms. Multiple independent replicas
do not share matchmaking state. Deploy when active matches have finished.

`GET /health` returns HTTP 200 with `{"status":"ok","rooms":0}` when no rooms
are active. The room count changes during play. This endpoint establishes
process readiness, not browser rendering or audio support.

SIGTERM and SIGINT dispose rooms and timers and close HTTP and WebSocket
connections. Compiled-process tests exercise both signals with an active room
and a connection containing unfinished HTTP headers.

## Verification

```bash
npm run build && npm test && npm run sim
npm run verify:build
npx playwright install chromium
npx playwright test
```

The Playwright configuration uses one worker and SwiftShader software rendering.
The bundle audit counts every emitted JavaScript chunk, including diagnostics,
and enforces fewer than 250,000 gzip bytes. It rejects external media, source
maps, raw TypeScript and missing or unbundled production script entries.

## Performance evidence

Physical 60 FPS acceptance on an integrated GPU and a phone/tablet remains open.
Software-rendered browser results establish functional behavior, not that target.

The [alternative acceptance protocol](performance_acceptance.md) uses exported
native-browser frame traces from normal play on physical integrated/mobile
devices. An external tester can collect the evidence without using the affected
laptop or the synchronous benchmark measurement path.

`/benchmark.html` provides an optional browser diagnostic with device metadata,
splash/arena/clash frame measurements and a downloadable JSON report. It starts
only after a user presses its button. The CLI (`npm run benchmark`) always uses
software rendering. GPU-forcing CLI options are rejected. Do not force native
GPU rendering through WSL: the earlier experiment preceded a laptop freeze and
hard shutdown, and that path is no longer part of this workflow.
