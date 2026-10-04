# CYBERANTE: Procedural Vector Poker-Combat Matrix

[![Contest](https://img.shields.io/badge/Contest-Handshake%20x%20OpenAI-00f3ff.svg)](#)
[![Stack](https://img.shields.io/badge/Graphics-Three.js%20GLSL-ff0055.svg)](#)
[![Audio](https://img.shields.io/badge/Audio-Procedural%20WebAudio-ffb700.svg)](#)
[![AI](https://img.shields.io/badge/AI-Classical%20Deterministic%20Heuristic-00ff66.svg)](#)
[![Agentic](https://img.shields.io/badge/Methodology-OpenAI%20Codex%20Spec--Driven-10a37f.svg)](#)

> **Event Entry:** Handshake AI Skills Studio × OpenAI Multiplayer Game Challenge  
> **Platform:** Universal Web (Zero-Install Desktop / Mobile / Tablet)  
> **Architecture Blueprint:** See [`docs/cyberante_design_document.md`](./docs/cyberante_design_document.md)

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
│   └── agent_specs/                   # 10 Granular Specs for OpenAI Codex
├── packages/
│   ├── shared/                        # Zero-dependency TypeScript models & math
│   ├── server/                        # Authoritative Node/Bun WebSocket Server
│   └── client/                        # Vite + Three.js Procedural Vector Web App
└── package.json                       # Root workspaces configuration
```

---

## Quickstart

```bash
# Install dependencies
npm install

# Start local WebSocket server (port 8080)
npm run dev:server

# Start client development server (port 5173)
npm run dev:client

# Run headless unit & combat tests
npm test
```

---

## License

MIT © Blaze Giroux
