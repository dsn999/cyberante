# Spec-07.1 UI redesign verification

Date: 2026-10-05. Baseline: `3016b2d`, plus the redesign committed with this note.
Authority: the user's full-screen wireframe/contextual-control request and
[Spec-07.1](../agent_specs/spec-07.1-full-screen-arena-ui.md).

## Implemented changes

- The reactive grid scales in its vertex shader to cover the viewport at its
  actual camera depth. Existing subdivision buffers and particle pools persist.
- The arena occupies the central screen with compact floating state and controls.
- Default Shaping has five card buttons and Ready, plus two disclosure triggers
  (Options and Adjust Split). One selected-card tray exposes tuning/burn/swap.
- Shaping costs and burn effects are visible. Commitment exposes three stances,
  the selected stance's consequence and Lock In. Reveal/resolve hides the dock.
- Secondary rules/preferences/sharing/exit are grouped under Options; detailed
  combat text is available under Clash Details.
- Portrait uses a bottom dock; short landscape places normal play controls on
  the right. Training uses its existing instruction sheet with unobstructed
  required actions and refreshed highlights after card-control replacement.

## Verification

| Gate | Result |
| --- | --- |
| `npm run build` | Pass; strict TypeScript and all three production packages |
| `npm test` | 358 pass: 230 server/shared and 128 client |
| `npm run sim` | 300 complete seeded matches; prescribed balance/pacing checks pass |
| `npm run verify:build` | Pass; 153,026 gzip JS bytes against the 250,000-byte limit; no forbidden production media |
| UI/tutorial browser checks | 16 pass, including keyboard swaps, partial partitions, Flux/Burn validation, offline lesson completion, modal focus, settings, touch targets and short landscape |
| Broader browser regression pass | 31 pass across three completed batches: 7 acceptance/audio/visual-state, 6 integration and 18 renderer/tutorial/UI; each exits 0 |
| Final desktop/portrait/landscape screenshot inspection | Pass: 1440×900, 390×844, 320×568 and 844×390 |

Representative captures: [desktop Shaping](ui-redesign-desktop.png) and
[portrait Commitment](ui-redesign-mobile.png). Training action trays at 320×568
and 844×390 were also inspected after the spacing fixes.

Browser configuration is Chromium headless, SwiftShader and one worker. The
browser cases run in three shorter batches:

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/cyberante-browsers npx playwright test e2e/acceptance.spec.ts e2e/audio.spec.ts e2e/designQa.spec.ts
PLAYWRIGHT_BROWSERS_PATH=/tmp/cyberante-browsers npx playwright test e2e/integration.spec.ts
PLAYWRIGHT_BROWSERS_PATH=/tmp/cyberante-browsers npx playwright test e2e/tutorial.spec.ts e2e/ui.spec.ts e2e/renderer.spec.ts --grep-invert 'renderer frame timing'
```

The existing UI and renderer assertions were adapted to the new visible
disclosures, explicit lane swap and shader scale. Tutorial negative-action
checks still require wrong-card actions to preserve the fixture and resources.
All authoritative damage, privacy, phase, reconnect and lifecycle assertions
remain in place.

## Scope and remaining acceptance

This records implementation/layout regression evidence. Emulated touch screens
are not physical devices, and fewer controls alone do not establish a measured
improvement in human usability. The software timing diagnostic is excluded from
this visual acceptance pass. No native WSL GPU experiment was performed.

Spec-10B's physical integrated/mobile 60 FPS evidence and public deployed URL
remain outstanding. The earlier [design certification report](design_certification.md)
and `evidence.json` remain bound to their historical release; they do not certify
this redesigned build. Current redesign fingerprints are recorded separately in
[`ui_redesign_evidence.json`](ui_redesign_evidence.json).
