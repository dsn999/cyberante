# Prepared submission artifacts

- [Description](description.md): prepared project copy with OpenAI Codex
  attribution, tactical mechanics, procedural graphics/audio and game modes.
- [Cover](cover.png): 1440 × 900 PNG captured from the real production WebGL
  canvas during the tutorial's resolved Overcharge/Parry clash. It shows the
  revealed cards, reactive grid, chromatic effect and pooled particle bursts.

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

These files are prepared locally. No contest submission or public deployment
has been performed. A public game URL is still required.
