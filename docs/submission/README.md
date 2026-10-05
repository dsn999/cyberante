# Prepared submission artifacts

- **Title:** CYBERANTE: Procedural Vector Poker-Combat Matrix
- [Description](description.md): prepared project copy with OpenAI Codex
  attribution, tactical mechanics, procedural graphics/audio and game modes.
- [Cover](cover.png): 1440 × 900 PNG captured from the real production WebGL
  canvas during the tutorial's resolved Overcharge/Parry clash. It shows the
  revealed cards, reactive grid, chromatic effect and pooled particle bursts.
- **Project URL:** https://holactie.com/cyberante/

Submit these four fields through Handshake's **Create a Multiplayer Game**
mission. The supplied rules PDF gives **October 30, 2026, 11:59 PM Pacific** as
the deadline. A public GitHub repository is useful supporting material; the PDF
does not list repository publication as an entry requirement.

The cover was generated with Chromium using the repository's single-worker
SwiftShader configuration. The capture test temporarily hides the DOM overlay
and expands the card viewport to frame the canvas. It uses the actual game
geometry, shaders and combat effects; it does not establish hardware FPS.
The file is a submission artifact outside the client source and build. It is
not imported or downloaded by the game.

Regenerate the capture with:

```bash
npm run build
PLAYWRIGHT_BROWSERS_PATH=/tmp/cyberante-browsers npx playwright test e2e/designQa.spec.ts
```

The capture is attached to the test and saved as `cover.png` in that case's
`test-results` directory. Inspect it before copying it here. Tests do not
overwrite the committed submission artifact.

These files are prepared locally; no contest submission has been performed.
The user confirmed end-to-end operation of the public deployment at
[holactie.com/cyberante/](https://holactie.com/cyberante/) on 2026-10-05.
See [release acceptance](../qa/release_acceptance.md) for outstanding evidence.

The [final contest/readiness review](../qa/contest_readiness_2026-10-05.md)
covers the supplied PDF and public-repository hygiene. Deploy the final license
notices before submitting; the previously live build did not yet serve them.

## Current cover provenance

The cover was refreshed on 2026-10-05 from production sources at `6e25db8`,
including Spec-07.1's viewport-scaled grid. The existing cover-capture browser
case passed, and the resulting 1440×900 image was visually inspected before
replacement. Current fingerprints are recorded in
[`design_certification_2026-10-05_evidence.json`](../qa/design_certification_2026-10-05_evidence.json).
