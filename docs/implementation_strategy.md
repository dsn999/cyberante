# CYBERANTE familiarization audit and implementation strategy

Audit date: 2026-10-03. Scope: the master design, all ten subsidiary specs,
workspace configuration, shared/server/client source, existing tests, and CI.
This is a build strategy; implementation dispatches remain outstanding.

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
- Vite reports 132.76 kB gzipped JavaScript, below Spec-10's 250 kB limit.
  It emits a warning for a 522.49 kB minified chunk, so the build does not yet
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
| 01 — Contracts | Card/player/evaluation/network types, constants, exports, package configuration largely match. | Align `BotDecision` with Spec-05 and migrate every consumer together; preserve explicit `.js` shared/server imports. |
| 02 — Evaluation/combat | All tiers, score formulas, Ace straights, burns, reflection, and knockout logic are implemented. | Settle Overcharge interpretation; add edge coverage for simultaneous lethal/ties, weak-hand Parry, Veil against reflection, Siphon cap/no resurrection, barriers, rounding, and input immutability. Wheel straight-flush description incorrectly says Ace-high. |
| 03 — Deck/Flux/engine | CSPRNG server `Deck`, seeded Mulberry32, immutable rank/suit changes, burn evaluation. | Multiplayer uses `MatchEngine`'s default `Math.random()` instead of `Deck` or an injected CSPRNG. Define deck reuse/depletion behavior, reject invalid deal counts, remove the fabricated fallback Ace, enforce phase/commit integrity, and implement the exchange safety limit. |
| 04 — Server/rooms | Room registry, timed phase loop, early ready/commit transitions, public-state masking, single-port serving. | Refactor Room/RoomManager APIs to exact targets; fixed player slots, one handshake, runtime message validation, disconnect grace/forfeit/recovery, public connected-state synchronization, destroy/cleanup, and substantial lifecycle tests. |
| 05 — AI/simulator | Three specified profiles, ten-partition search, seeded simulations. | Target decision API and `getProfile`, score tie term, nudge threshold, suit/HP/personality burn priorities, critical-defense rule, deterministic replay tests, and measured performance. Re-evaluate after replacement draws before commitment. |
| 06 — Audio | Shared context, oscillator/noise SFX, phase tempo changes, FFT output. | Exact APIs and constructors, master gain <= 0.3 (currently 0.7), FFT size 256 (currently 64), defined bucket averages, eight-step lookahead scheduling, missing SFX, safe unsupported-audio handling, node cleanup, remove `any`. |
| 07 — Renderer | Three.js scene, grid, additive particles, audio bass sampling, shader source files. | Grid subdivisions across line interiors, specified displacement, wired shader/compositor, complete vector rank/suit glyphs, renderer APIs, CRT/reduced motion, context recovery, resize/disposal, pooled particle state, elapsed-time physics. |
| 08 — UI | Split selection, ten-split helper, live badges, tactical controls, basic menu. | Required menu callbacks/profile/name inputs; actual countdown; phase/Flux/burn/commit disabled states; ready/rematch/exit controls; target reset API; both bleed neighbors; usable mobile layouts and >=44px controls. |
| 09 — Tutorial/rules | Four instructional pages and floating rules overlay. | Interactive lesson hands and action gates, controller routing, skip/Escape/back APIs, simulated clash, complete rules and `isVisible`. Current tutorial advances by NEXT without performing any game action. |
| 10 — Integration/deploy | Mode wiring, same-host production socket, local engine, static server, build/test CI. | Solo phase scheduler and bot delay, correct seat mapping, complete reveals/results/rematches, share links, connection recovery, mode cleanup, shutdown, sim CI step, and real end-to-end acceptance. |

## Highest-priority findings

1. **Solo burns can break resolution.** `main.ts` evaluates a bot decision,
   burns its selected card, and commits the original IDs. The replacement has
   a different ID, so commitment fails, its return value is ignored, and clash
   resolution proceeds without a valid bot partition. A seeded audit probe
   reproduced the rejected commitment at seed 7. The simulator already
   re-evaluates after burn/nudge, hiding this controller discrepancy.
2. **Runtime validation is insufficient.** `MatchEngine.commitHand` checks
   five unique owned IDs but does not enforce lane lengths or valid stance,
   accepts SHAPING commitments, and permits overwriting a commitment. A probe
   confirmed four Assault IDs plus one Aegis ID is accepted. The server casts
   JSON directly to `ClientMessage`; TypeScript cannot validate network data.
3. **Match lifecycle transitions happen too early.** `resolveClash` increments
   counters and resets HP immediately after a nonfinal round knockout. This
   makes clash/resolve state ticks show the next round's HP and numbering.
   It also permits repeated resolution; the UI does not disable lock-in.
   Enforce one resolution per exchange and delay next-round setup until the
   resolution display completes. `MAX_EXCHANGES_PER_ROUND` is unused.
4. **Solo pacing is incomplete.** Solo begins in SHAPING, passes a fixed 15s
   display value, resolves when clicked, and starts a new exchange after 3.5s.
   There is no full Deal/Shaping/Commitment/Clash/Resolve schedule, timeout
   fallback, or bot thinking delay. Online ticks occur on actions/transitions;
   the HUD does not interpolate a running countdown.
5. **Online recovery and seat mapping are incomplete.** Disconnect marks only
   Room participants, leaves engine public `connected` unchanged, and has no
   grace-period forfeit or identity restoration. `NetworkClient` only logs
   closure. The client uses `resolution.p1HpRemaining !== undefined` to identify
   player 1, which is always true, so player 2 sees player 1's damage figures.
   Server entry also sends a second, generic join initialization after Room
   already sent the correct handshake.
6. **Green tests cover limited behavior.** Room's sole test checks two joins
   and third-player rejection, leaving its timer running. There are no engine
   lifecycle or actual transport tests. The simulator counts an unfinished
   watchdog match as a player 2 win; it must require an actual winner. Its
   deterministic replay requirement has no test. Shader and card files exist
   but are not connected to the rendering scene.

## Decisions to record before affected dispatches

Resolve contradictions explicitly; passing today's tests must not silently
choose the rules. Record the chosen text in the authoritative documents and
derive tests/UI/rules/tutorial wording from the same decision.

| Topic | Conflicting or incomplete contract | Recorded & Implemented Resolution |
| --- | --- | --- |
| Overcharge | Master stance table and code remove Overcharging player's own Aegis. Some specs had defender-piercing text. | **RESOLVED:** Overcharge deals $2.0\times$ burst damage, but combatant forfeits own Aegis mitigation ($0\text{ Block}$, zero defense). Codified across all specs, AGENTS.md, design doc, and combat engine. |
| Round/exchange vocabulary | Master describes hands/Flux per round; specs require multiple exchanges per round. | **RESOLVED:** Option A confirmed across all specs: 5 cards, 3 flux, 1 burn per exchange; HP persists until round knockout; Best-of-3 rounds (first to 2 round wins). |
| Disconnect window | Master diagram says 500ms; Spec-04 says 30s. | **RESOLVED:** Spec-04's 30s grace window adopted. `sessionToken` resume contract implemented in `types.ts`, `Room.ts`, and `CMD_RECONNECT`. |
| Timeout split | Master references highest High Card; Spec-04 requires optimal split with Brace. | **RESOLVED:** Spec-04 optimal ten-partition split with Brace; deterministic tiebreak (highest Assault score, then Aegis score, fallback to first) implemented in `autoLockPlayer`. |
| Exchange cap | Spec-01 sets cap of 10 before sudden death without full terminal rules. | **RESOLVED:** If Exchange 10 completes with both HP > 0, higher HP wins. If tied, Exchange 11 Sudden Death (1 HP each, higher net damage wins, tiebroken by assault score then aegis score). Implemented in `MatchEngine`. |
| AI API/search | Current ID/action decision differs from Spec-05's card/nudge decision. | **RESOLVED:** `BotDecision` unified to support both card IDs and card references. Bot re-evaluates partitions after burn draws with current 5 cards before committing in `main.ts`. |
| Audio timing | Master and Spec-06 give different BPM values and scales. | **RESOLVED:** Spec-06 explicit synthesis targets adopted (128 BPM, pentatonic minor). Web Audio runs on audio context clock, decoupled from game turn timers. |
| DOM root | Spec-08 names `#ui-overlay`; existing HTML/controller use `#ui-root`. | **RESOLVED:** Both `#ui-overlay` and `#ui-root` supported in `index.html` and `main.ts`. |

## Dispatch order and concrete acceptance criteria

Follow AGENTS.md's vertical-slice order, with a final integration pass after
polish. Each dispatch reads its full spec, compares signatures, adds meaningful
coverage, runs its specific verification and the repository gate, and audits
every definition-of-done item. Leave checkboxes unchecked until evidenced.

| Dispatch | Scope and dependency | Exit evidence |
| --- | --- | --- |
| Preparation | Record the combat, deck lifecycle, sudden-death, and resume-contract decisions; capture this baseline. | **COMPLETE:** Documented across all specs, AGENTS.md, design doc; baseline verified passing (build, test, sim). |
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

Start with the documented rule decisions and Spec-01 contract alignment, then
02/03. The first substantial runtime repair is MatchEngine lifecycle and input
integrity, followed by the bot shaping/commit flow. This makes subsequent room
and controller work depend on a trusted engine and preserves one ruleset across
solo, multiplayer, tutorial, and simulation.

Contest cover capture and submission copy follow the completed playable build.
The contest claims/deadline in the master document were read as project context,
not independently verified during this repository audit.
