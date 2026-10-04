# CYBERANTE familiarization audit and implementation strategy

Audit date: 2026-10-03. Second review: committed baseline `fe9fc48`. Scope: the master design, all ten subsidiary specs,
workspace configuration, shared/server/client source, existing tests, and CI.
This strategy records audit findings and dispatch progress. Specs 01 and 02 are implemented and verified; later dispatches remain outstanding.

## Architectural authority

Use [the master design](cyberante_design_document.md) for the product architecture,
[the numbered specs](agent_specs/) for target APIs and detailed behavior, and
[AGENTS.md](../AGENTS.md) for the implementation workflow. The subsidiary specs
are in this repository's `docs/agent_specs/`, rather than a home-directory path.
The root `cyberante_design_document.md` and the copy under `docs/` are currently
byte-identical. Treat the `docs/` copy as canonical, as AGENTS.md directs.

The architecture is already appropriate: dependency-free shared game logic;
Node WebSocket authority and in-memory rooms; vanilla TypeScript browser UI;
procedural Three.js and Web Audio; local solo play using the same combat engine.
Refactor toward the contracts while retaining conforming code.

## Verified baseline

The starting Git worktree was clean. Dependencies and a package lock are present.
The audit ran `npm run build && npm test && npm run sim` successfully with
Node 24.21.0 and npm 11.19.0:

- All three workspaces compile. Shared and server use strict NodeNext ESM;
  the browser correctly uses Vite's bundler resolution.
- Five test files pass, with 27 tests total. `npm test` already includes the
  balance simulator; the separate sim command repeats its two tests.
- Simulation covers 200 Cipher mirror matches and 100 Aggro/Wall matches.
  Mirror results: 97/103 wins, 2.46 rounds/match, 1.68 exchanges/round.
  Aggro/Wall results: 69/31 wins, 2.24 exchanges/round.
- Vite reports 133.17 kB gzipped JavaScript, below Spec-10's 250 kB limit.
  It emits a warning for a 524.21 kB minified chunk, so the build does not yet
  meet the literal zero-diagnostics target. Investigate meaningful splitting
  after functionality is complete.
- Client output contains HTML, JavaScript, and a source map; no image, model,
  or audio assets are emitted. HTML does request Google Fonts, so a clean
  offline load still depends on system-font fallbacks for typography.

These results establish a useful baseline, but do not prove browser playability
or full spec compliance. No browser, mobile, GPU, or live WebSocket acceptance
session was performed during this audit.

## Spec coverage and gaps

| Spec | Reusable foundation | Work required |
| --- | --- | --- |
| 01 — Contracts | Card/player/evaluation/network types, constants, exports, package configuration largely match. | Require the Spec-05 card/stance fields in `BotDecision` (currently optional in code) and retain consistent ID/action extensions; preserve explicit `.js` shared/server imports. |
| 02 — Evaluation/combat | All tiers, score formulas, Ace straights, burns, reflection, and knockout logic are implemented. | Overcharge now consistently forfeits own Aegis; add edge coverage for simultaneous lethal/ties, weak-hand Parry, Veil against reflection, Siphon cap/no resurrection, barriers, rounding, and input immutability. Wheel straight-flush description incorrectly says Ace-high. |
| 03 — Deck/Flux/engine | CSPRNG server `Deck`, seeded Mulberry32, immutable rank/suit changes, burn evaluation. | Multiplayer uses `MatchEngine`'s default `Math.random()` instead of `Deck` or an injected CSPRNG. Define deck reuse/depletion behavior, reject invalid deal counts, remove the fabricated fallback Ace, enforce phase/commit integrity, and correct exchange-cap and sudden-death behavior against the clarified contract. |
| 04 — Server/rooms | Room registry, timed phase loop, early ready/commit transitions, public-state masking, single-port serving. | Refactor Room/RoomManager APIs to exact targets; fixed player slots, one handshake, runtime message validation, disconnect grace/forfeit/recovery, public connected-state synchronization, destroy/cleanup, and substantial lifecycle tests. |
| 05 — AI/simulator | Three specified profiles, ten-partition search, seeded simulations. | `getProfile` and card/stance aliases now exist; require their types, implement score tie term, nudge threshold, suit/HP/personality burn priorities, critical-defense rule, deterministic replay tests, and measured performance. Re-evaluate after replacement draws before commitment. |
| 06 — Audio | Shared context, oscillator/noise SFX, phase tempo changes, FFT output. | Exact APIs and constructors, master gain <= 0.3 (currently 0.7), FFT size 256 (currently 64), defined bucket averages, eight-step lookahead scheduling, missing SFX, safe unsupported-audio handling, node cleanup, remove `any`. |
| 07 — Renderer | Three.js scene, grid, additive particles, audio bass sampling, shader source files. | Grid subdivisions across line interiors, specified displacement, wired shader/compositor, complete vector rank/suit glyphs, renderer APIs, CRT/reduced motion, context recovery, resize/disposal, pooled particle state, elapsed-time physics. |
| 08 — UI | Split selection, ten-split helper, live badges, tactical controls, basic menu. | Required menu callbacks/profile/name inputs; actual countdown; phase/Flux/burn/commit disabled states; ready/rematch/exit controls; target reset API; both bleed neighbors; usable mobile layouts and >=44px controls. |
| 09 — Tutorial/rules | Four instructional pages and floating rules overlay. | Interactive lesson hands and action gates, controller routing, skip/Escape/back APIs, simulated clash, complete rules and `isVisible`. Current tutorial advances by NEXT without performing any game action. |
| 10 — Integration/deploy | Mode wiring, same-host production socket, local engine, static server, build/test CI. | Solo phase scheduler and bot delay, correct seat mapping, complete reveals/results/rematches, share links, connection recovery, mode cleanup, shutdown, sim CI step, and real end-to-end acceptance. |

## Second review: fixes and remaining work

The review re-ran `npm run build && npm test && npm run sim`: exit 0,
27 tests pass and the same 300 seeded simulation results hold. The chunk-size
warning remains. Tests still provide no browser/recovery/sudden-death coverage.

Focused probes against the freshly built shared package confirmed that 4/1
partitions and commitment overwrites are rejected, and the post-burn/nudge
re-evaluated bot partition commits successfully. They also confirmed that a
SHAPING commitment is accepted, its cards can still be nudged, and an exchange-11
tie with equal damage, Assault score, and Aegis score awards the round to player 2.
These probes do not replace permanent regression coverage in the dispatches.

| Original finding | Current evidence | Revised status |
| --- | --- | --- |
| Overcharge ambiguity | AGENTS.md and Specs 02/08/09 consistently say the attacker forfeits own Aegis; combat code agrees. | Rule resolved. Active Barrier remains effective; “zero defense” only describes Aegis. |
| Invalid lane lengths and overwritten commitments | `MatchEngine.commitHand` now validates 3/2 lengths, stance, unique owned IDs, and rejects overwrite. | These checks implemented. SHAPING commits remain allowed; committed hands can still be mutated during SHAPING. |
| Solo stale IDs after burn | `main.ts` now re-evaluates after shaping and falls back to auto-lock if bot commit fails. | Original stale-partition defect addressed in source. Player commit result is still ignored; full phase scheduler and regression coverage remain. |
| Early HP/round reset | `startExchange` now performs next-round reset; `resolveClash` retains KO HP and current round number. | Original display-state defect addressed in source. Repeated start calls can advance/reset again from the same last resolution; phase integrity still needs tests. |
| Duplicate clash resolution | `resolveClash` returns its last result in reveal/resolve/match-over phases. | Partial guard implemented. It still dereferences missing partitions if invoked before valid commitment; phase is public/mutable. |
| Wrong player-2 damage mapping | Resolution now carries `p1PlayerId`/`p2PlayerId`; main maps by ID. | Original perspective defect addressed in source; browser acceptance outstanding. |
| Duplicate join handshake | Server no longer sends a generic init after Room starts a full match. | Original duplicate join initialization removed. Target fixed slots and Room API remain outstanding. |
| Recovery absent | Types, server entry and Room now accept reconnect tokens, update public connected flags and start a forfeit timer. | Partial implementation. Client never stores/sends the token or retries. Server tokens use `Math.random`, and reconnect checks no deadline/disconnected state. Forfeit does not cancel phase timer, so later transitions can overwrite MATCH_OVER. |
| Exchange limit unused | MatchEngine now handles exchange 10 and later ties. | Partial implementation. Current code compares post-Siphon HP rather than explicitly comparing net damage in sudden death, skips cap tiebreaks when combat already declares a winner, and awards exact final ties to player 2 without a specified rule. |
| Bot contract divergence | Runtime returns both IDs/actions and Spec-05 card/stance aliases; `getProfile` exists. | Docs now use one Spec-01 definition with required card/stance fields. Code still declares them optional; fix in dispatch 01. Heuristic differences remain in dispatch 05. |
| DOM root mismatch | HTML mounts `#ui-overlay`; controller accepts that root and legacy `#ui-root`. | Resolved in source. |
| Audio targets | Spec-06 specifies 85/115/135/90/100 BPM; implementation uses timeout-driven 16 steps, gain 0.7, FFT size 64. | Documentation aligned to Spec-06. Earlier report's “128 BPM, implemented audio-clock scheduling” claim was incorrect. Implementation remains dispatch 06. |

Other original gaps remain: default shared randomness is unseeded, server does
not inject CSPRNG into MatchEngine, deck rebuilds every exchange, fallback draw
fabricates an Ace, Room APIs differ from targets, full command-schema validation
is absent, and the UI/audio/render/tutorial/integration acceptance work remains.
Room tests still only cover capacity and leave the phase timer running. The
simulator still counts watchdog exhaustion as a player-2 win and lacks the
specified deterministic replay test.

## Document reconciliation performed in this review

- Updated both identical master-design copies to per-exchange hands/Flux/burns,
  34s timed exchanges with early advance, 30s disconnect grace, optimal
  Assault-score/Aegis-score timeout split, and Spec-06 phase tempos.
- Aligned Specs 01 and 05 on a single BotDecision contract: required card/stance
  fields plus existing ID/action fields, with consistency between representations.
- Added the post-shaping re-evaluation and commit-result requirement to Spec-05.
- Removed unsupported “implemented/resolved” and “preparation complete” claims
  from this report. Documentation alignment is distinct from runtime acceptance.

## Specs 01–02 dispatch completion (2026-10-03)

- Spec-01: required BotDecision card/stance fields now match the contract; all
  existing producers and consumers compile. Constants, exports, dependency-free
  package configuration, ESM imports, and emitted declarations/maps were audited.
- Spec-02: all evaluator formulas and wheel descriptions verified; added exact
  score/permutation/immutability tests. Combat covers all nine stance matchups,
  all burns, rounding, barriers, Siphon limits/no resurrection, lethal ties,
  cap ordering and repeated sudden death. No damage/block constants changed.
- The combat calculator now owns cap/sudden-death winner rules; removed the
  duplicate engine implementation that awarded an exact final tie to player 2.
- User chose repeated sudden death on an exact tie. Specs 01/02 document no
  point awarded and 1 HP for both players; an engine regression test proves it.
- Verification: shared build, exact Spec-02 test command (67 tests), full build,
  76 repository tests and 300 seeded simulated matches passed. Balance results
  remain 97/103 for Cipher mirror and 69/31 for Aggro/Wall. Client JS is 133.15 kB
  gzipped; the pre-existing Vite chunk warning remains.
- Implementation checklists in Specs 01/02 are checked against this evidence.
  Intended edits remain uncommitted alongside the preceding documentation work;
  no temporary files were added.

The second-review tables above describe the baseline before these dispatches;
this section supersedes their remaining Spec-01/02 contract/cap findings.

## Dispatch readiness

**Specs 01 and 02 are complete. Specs 03/04 still need two boundary decisions.** Known implementation gaps are dispatch work, rather than
reasons to postpone starting. The following contract decisions remain before
signing off the affected dispatches:

1. **Deck lifecycle/depletion (03):** Spec-03 specifies rebuilding below 10
   before a deal but does not say whether to rebuild every exchange or preserve
   the remaining deck. With retention, exactly 10 or 11 remaining cards allow
   the deal but cannot supply both burns. Specify reserve/rebuild behavior
   without duplicating live cards or fabricating replacements.
2. **Both players disconnected (04/10):** Spec-04 promises 30s resume but also
   says delete the room when both leave. Specify whether simultaneous connection
   loss retains the room through grace or ends it immediately. Also distinguish
   unexpected disconnect from deliberate exit. These imply different resume
   and cleanup acceptance cases.

Before those decisions, dispatch 03 can implement input/phase and randomness
invariants, and dispatch 04 can implement exact APIs, schema validation and
single-player disconnect behavior. Do not mark either spec fully complete while
its decision-dependent behavior remains unresolved.

Implementation dispatches must explicitly cover strict COMMITMENT-only lock-in,
full payload validation, cryptographic token generation, disconnected-seat-only
resume within deadline, cancellation of phase timers on forfeit, and protection
against an old socket's close event disconnecting its replacement.

## Dispatch order and concrete acceptance criteria

Follow AGENTS.md's vertical-slice order, with a final integration pass after
polish. Each dispatch reads its full spec, compares signatures, adds meaningful
coverage, runs its specific verification and the repository gate, and audits
every definition-of-done item. Leave checkboxes unchecked until evidenced.

| Dispatch | Scope and dependency | Exit evidence |
| --- | --- | --- |
| Preparation | Record the combat, deck lifecycle, sudden-death, and resume-contract decisions; capture this baseline. | Baseline reverified and core rules aligned; the two decisions above remain for affected dispatches. |
| 01 | Shared contracts/constants/exports; establish Spec-05 bot types for later consumers. | Shared build and coordinated consumer compilation; no runtime dependencies. |
| 02 | Evaluator/combat alignment and mathematical edge tests. Depends on rule decision and 01. | Exact tier/score/multiplier/burn/KO fixtures and unchanged damage/block constants. |
| 03 | Deck/Flux plus MatchEngine lifecycle. Inject server CSPRNG and explicitly seeded solo/replay randomness; keep clocks/sockets outside shared logic. | Deterministic replay, valid immutable shaping, exact partitions, one clash per exchange, HP carry/reset/Bo3, cap/depletion boundaries. |
| 04 | Exact Room/RoomManager APIs; transport validation, phase timers, masking, recovery and cleanup. Depends on 03 and documented resume contract. | Fake-clock lifecycle tests plus real two-client handshake/action/reveal checks; malformed/foreign/duplicate input rejection; full disconnect/cleanup coverage. |
| 05 | AI API/heuristic alignment; shared shaping then final-decision flow in simulator and solo. Depends on 02/03. | Seed-42 replay across ten hands; valid partitions after burn; 200 mirror + 100 asymmetric completed matches meeting pacing/win thresholds; measured evaluation and simulation time. |
| 10A | First complete playable slice using current UI/render/audio foundation. Depends on 04/05. | Solo full phase loop and complete Bo3; two-browser host/join with correct local perspective, reveal, timeout, rematch, return-to-menu, sharing and recovery; production build/start on one port. |
| 08 | Exact menu/HUD contracts, authoritative control states, countdown, rules access, responsive input. Depends on 10A. | Bot/profile and named host/join flows; lock-in gated to commitment; shaping costs/burn limits displayed accurately; desktop/touch/keyboard acceptance. |
| 06 | Audio contract, scheduling, FFT, palette, cleanup and integration. Depends on stable phase/action events. | Gesture unlock, mute before/after init, unsupported-audio behavior, phase music, SFX and normalized FFT; no node growth in repeated play. |
| 07 | Subdivided grid, vector cards/glyphs, shader/compositor, particle pools, accessibility and resource lifecycle. Depends on 06 FFT and 08 interactions. | All visual events wired, independent CRT and reduced-motion toggles, context recovery/disposal, measured 60 FPS on representative devices; no external media. |
| 09 | Real tutorial curriculum and complete rules. Depends on finalized 08 controls and shared math. | All four specified lesson hands/actions gate progress; invalid actions do not advance; final training clash; skip/Escape; no WebSocket activity. |
| 10B | Final integration, CI, build footprint, production operation and acceptance. Depends on all preceding dispatches. | Full repository gate, actual solo/online/tutorial acceptance, disconnect and shutdown checks, mobile/accessibility/performance evidence, emitted-asset and gzip audits. |

10A is an integration milestone, not a claim that every Spec-10 checklist item
is complete. Finish its audio/visual and final acceptance obligations in 10B.

## Verification strategy

Keep the existing evaluator, combat, deck/Flux, room, and simulation suites.
Extend their assertions to the specs instead of replacing green checks with
weaker ones. Add engine lifecycle and transport coverage because neither is
proved by current tests. In particular:

- Engine: replay, phase boundaries, rejection without mutation, exact 3/2 split,
  commit immutability, one outcome, HP persistence, round reset timing, two-win
  match victory, simultaneous lethal, exchange cap, deck exhaustion and rematch.
- Rooms/transport: every timed phase, ready/commit early advance, fallback,
  seat/handshake consistency, private-card and stance masking before reveal,
  invalid payloads, nonexistent/full rooms, disconnect/reconnect/forfeit and
  cancellation of every timer when destroyed.
- Simulation: assert every match terminates and every action/commit succeeds;
  exercise the same post-shaping decision flow as solo; preserve Spec-05's
  >=20% asymmetric win floors and mirror/pacing bounds. Measure performance
  separately from correctness rather than claiming the timing target from
  one favorable run.
- Browser: complete matches against all three bot profiles, two online seats,
  all four tutorial actions, rematch/exit/mode switches, real countdown, rule
  access, mute/CRT/reduced motion, narrow viewports, touch and keyboard, failed
  connections, and resource cleanup. Bundle compilation cannot prove these.
- Production: build then `npm run start`; inspect root/assets/SPA fallback and
  `/ws` on one configured port; exercise SIGINT/SIGTERM cleanup. Add the explicit
  sim step to CI and inspect actual diagnostics and gzipped output.

Use each spec's Section 8 command; the repository gate is always
`npm run build && npm test && npm run sim`. The root-level direct Vitest commands
should be checked against workspace resolution; `npm --workspace=packages/server
exec -- vitest run src/__tests__/<suite>.test.ts` supplies an explicit server
working directory if the documented invocation needs correction.

## Recommended next dispatch

Proceed to Spec-03 deck/Flux/engine work. Resolve the remaining deck and
disconnect boundary decisions before completing Specs 03/04. The first substantial runtime repair is MatchEngine lifecycle and input
integrity, followed by the bot shaping/commit flow. This makes subsequent room
and controller work depend on a trusted engine and preserves one ruleset across
solo, multiplayer, tutorial, and simulation.

Contest cover capture and submission copy follow the completed playable build.
The contest claims/deadline in the master document were read as project context,
not independently verified during this repository audit.
