# Current design certification audit — 2026-10-05

## Verdict

**Software QA passes for the Spec-07.1 release. Full master-design certification
remains withheld.** Qualifying physical performance recordings and a verified
public production game URL are missing.

Reviewed runtime: `6e25db8`. This audit adds documentation and refreshes the
submission cover; it changes no production source, package or build configuration.
The [master design](../cyberante_design_document.md), ten base specs and
[Spec-07.1](../agent_specs/spec-07.1-full-screen-arena-ui.md) retain their scope.
This report supplements the [earlier complete requirements matrix](design_certification.md),
rather than certifying only the visual redesign.

## Current-state evidence

| Requirement / gate | Evidence and result |
| --- | --- |
| Current production sources, contracts, previews and client output | All 35 fingerprints in `ui_redesign_evidence.json` matched before this documentation/artifact update |
| Previously reviewed engine, authority, AI, networking and audio requirements | 38 of the earlier report's 49 reviewed source/contract files still match their recorded hashes. The other eleven are the master/Specs 07–08/10 and seven client presentation/controller files covered by Spec-07.1; Spec-10's new audit note changes no runtime contract |
| Build, strict contracts and workspace boundaries | Verified release build exits 0; no production source/configuration changed during this addendum |
| Unit/integration and gameplay invariants | 358 release checks pass: 230 server/shared and 128 client; 300 complete seeded simulation matches pass |
| All emitted JavaScript and zero game media | Release bundle audit passes: 153,026 gzip JS bytes, below 250,000; production files retain their verified hashes |
| Production browser behavior | 31 release cases pass across three completed single-worker SwiftShader batches: 7 acceptance/audio/visual-state, 6 integration and 18 renderer/tutorial/UI |
| Exact evaluator/combat coverage requirement | Reran `npm run test:math:coverage`: 68 pass, both source files 100% statements, branches, functions and lines, with nonempty/no-skipped verification |
| Spec-07.1 full-screen arena, contextual controls and training | Revision checklist complete; verified renderer/UI tests and inspected desktop/portrait/short-landscape captures in `ui_redesign.md` |
| Required cover and description | New 1440×900 production clash capture generated and inspected; title/description still present and prepared locally |
| Stored contest rules reference | Repository PDF page 1 confirms four entry fields and an October 30, 2026, 11:59 PM Pacific deadline. Pages 2–3 give the four equally weighted judging criteria; no score or eligibility certification follows |
| Physical integrated/mobile 60 FPS target | **Missing evidence:** capture record remains a blank pending template; no qualifying recording bundle found |
| Public zero-install HTTPS/WebSocket game | **Missing evidence:** no public release URL or completed external-host acceptance record supplied |

The exact local commands and release fingerprints remain in
[`ui_redesign_evidence.json`](ui_redesign_evidence.json). The coverage rerun,
source-continuity comparison, PDF and refreshed-cover hashes are recorded in
[`design_certification_2026-10-05_evidence.json`](design_certification_2026-10-05_evidence.json).
Earlier reports retain their original release scope; newer documentation hashes
do not retroactively alter those historical records.

## Requirements matrix continuity

| Master section | Current assessment |
| --- | --- |
| 1 — Vision and contest alignment | Game modes and procedural architecture supported by current software evidence. Stored rubric reference confirmed; judging outcomes and entrant eligibility remain outside software QA |
| 2 — Gameplay and mathematics | Retained authoritative contracts and unchanged source hashes, passing engine/combat/Flux/deck checks, seeded simulations and fresh exact math coverage |
| 3 — Visual architecture | Spec-07.1 revision implemented and verified, including full-screen shader scaling and procedural effects; physical sustained FPS remains unverified |
| 4 — Procedural audio | Retained verified audio sources; native API/FFT/mute/cleanup browser checks pass using the revised Options disclosure |
| 5 — Modes, tutorial and rules | All three solo profiles, online flows and offline action-gated tutorial pass; guidance tracks regenerated card controls |
| 6 — Classical AI | Retained shared deterministic profiles/search and prescribed 300-match balance checks |
| 7 — Authority, privacy and recovery | Retained server/network sources and current unit/real-transport/browser evidence; both-seat privacy, reconnect, grace expiry, rematch and forfeit remain covered |
| 8 — Monorepo architecture | Named targets, zero shared runtime dependencies, package boundaries and strict ESM remain covered by the release build and unchanged manifests |
| 9 — Spec workflow | Base-spec implementation evidence retained; Spec-07.1 adds explicit layout/API/verification contracts. Spec-10B's physical checkboxes remain open |
| 10 — Risks and deliverables | Local title, updated actual WebGL cover and description prepared. Public URL/device acceptance are outstanding; no entry has been submitted by this workflow |

## Scope and limitations

This audit does not substitute software rendering, emulated mobile viewports or
an RTX measurement for the retained physical-device contract. No native WSL GPU
experiment was performed. The separate renderer timing diagnostic was excluded
from the visual acceptance runs and cannot close physical acceptance.

The [stored rules PDF](<../../[AI Skills Studio Challenge] Contest Official Rules.pdf>)
is evidence of what that supplied document says. Its text was decoded from
embedded PDF Unicode maps with no unmapped glyphs; seven pages were extracted.
This is not confirmation of later organizer changes, account status, legal
eligibility, contest scores or a submitted entry. Production dependency advisory
results in the earlier report remain historical; no fresh network advisory
audit is claimed here. Browser evidence is Chromium, not browser universality.

## Required closeout

The user requested placeholders because hosting has not been secured. The
[release acceptance record](release_acceptance.md) stores
`PUBLIC_GAME_URL_PENDING` and the pending provider/device-evidence fields.
These requirements remain open.

1. Supply both reviewed physical-device trace bundles using the unchanged
   [performance protocol](../performance_acceptance.md), identifying this build
   and actual hardware, including splash, match/clashes/victory and warm repeats.
2. Supply a public URL or a hosting provider/account for the verified Node
   release; verify HTTPS, same-host WebSockets, two-player gameplay and recovery
   through the deployed URL outside the local environment.
3. Record the deployed build and device results before closing the master URL
   item or Spec-10B hardware items. Confirm any submission/account requirements
   with the organizer before an actual contest entry.

These are evidence-dependent remaining requirements. Full certification is not
achieved by the passing local gates or the checked visual-revision checklist.
