# CYBERANTE: Procedural Vector Poker-Combat Matrix

[![Contest](https://img.shields.io/badge/Contest-Handshake%20x%20OpenAI-00f3ff.svg)](#)
[![Stack](https://img.shields.io/badge/Graphics-Three.js%20GLSL-ff0055.svg)](#)
[![Audio](https://img.shields.io/badge/Audio-Procedural%20WebAudio-ffb700.svg)](#)
[![AI](https://img.shields.io/badge/AI-Classical%20Deterministic%20Heuristic-00ff66.svg)](#)
[![Agentic](https://img.shields.io/badge/Methodology-OpenAI%20Codex%20Spec--Driven-10a37f.svg)](#)

> **Event Entry:** Handshake AI Skills Studio × OpenAI Multiplayer Game Challenge  
> **Platform:** Universal Web (Zero-Install Desktop / Mobile / Tablet)  
> **Architecture Blueprint:** See [`docs/cyberante_design_document.md`](./docs/cyberante_design_document.md)

## Play

**[Play CYBERANTE](https://holactie.com/cyberante/)** — solo, multiplayer and tutorial.
For multiplayer, choose **Host Room** and share the invitation link with a friend.
The user verified a real match between Windows Chrome and iPadOS Safari.
Other browser/device combinations have not all been tested.

---

## Overview

`CYBERANTE` is a high-speed, head-to-head tactical card-battler that fuses the combinatorial hand-building of five-card poker with the dynamic reads, stances, and counter-play of fighting games. Two players (or one player versus an offline classical game AI) engage in rapid, simultaneous rounds structured under a Best-of-3 (Bo3) match format.

### Key Highlights
- **Reactive Neon Vector Aesthetic:** Pure procedural neon vector rendering via Three.js with dynamic warping wireframe grid, glowing geometric particle explosions, CRT scanlines, and damage-responsive chromatic aberration.
- **Procedural Web Audio Synthesizer:** Zero external audio assets (`.mp3` or `.wav`). Generative polyphonic synthwave arpeggiators and reactive SFX synthesized entirely on-the-fly in code.
- **Solo Mode vs. Classical AI:** Deterministic heuristic utility-based bot running locally in-browser with 3 distinct personalities (*Cipher-0*, *Vektor-Aggro*, *Aegis-Wall*).
- **Interactive Tutorial:** 4-lesson interactive onboarding walkthrough accessible right from the main menu.
- **Spec-Driven Agentic Engineering:** Built with **OpenAI Codex** as the agentic coder implementation expert following modular, strict specification contracts.

---

## Monorepo Structure

```
cyberante/
├── docs/
│   ├── cyberante_design_document.md   # Master Architectural Blueprint
│   └── agent_specs/                   # 10 base specs + Spec-07.1 visual revision
├── packages/
│   ├── shared/                        # Zero-dependency TypeScript models & math
│   ├── server/                        # Authoritative Node.js WebSocket Server
│   └── client/                        # Vite + Three.js Procedural Vector Web App
└── package.json                       # Root workspaces configuration
```

---

## Quickstart

```bash
# Use Node 24 (also recorded in .nvmrc), then install dependencies
npm ci

# Start local WebSocket server (port 8080)
npm run dev:server

# Start client development server (port 5173)
npm run dev:client

# Run headless unit & combat tests
npm test
```

Production and browser verification:

```bash
npm run build && npm test && npm run sim
npm start

# One-time browser setup; system dependencies may require sudo.
npx playwright install --with-deps chromium
npm run test:e2e
```

The production server serves the client and `/ws` on `PORT` (default 8080).
Vite proxies `/ws` to the development server. Share rooms with `?room=ABCD`;
each browser tab retains its seat token for automatic recovery within 30 seconds.

See [production operation](docs/deployment.md) for build/start settings, HTTPS
proxy requirements, health checks, shutdown behavior and verification commands.
Browser tests use software rendering. The user accepted observed performance
in Windows Chrome and iPadOS Safari; 60 FPS remains an engineering target,
not a measured claim. See [release acceptance](docs/qa/release_acceptance.md).

Prepared entry materials are in [docs/submission](docs/submission/README.md).
The [final readiness review](docs/qa/contest_readiness_2026-10-05.md) records
contest requirements, verification and the remaining deployment/submission steps.

---

## License

MIT © Blaze Giroux

Runtime dependency licenses are preserved in
[THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) and the production build.
The supplied organizer rules PDF is a separate document and is not covered by
the project's MIT license.
