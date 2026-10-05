# CYBERANTE design-document QA and certification

Date: 2026-10-04. Scope: the complete
[master design](../cyberante_design_document.md), its ten implementation specs,
repository invariants and named submission artifacts.

## Verdict

**Software implementation QA passes; full design-document certification is
withheld.** The user explicitly chose to keep the detailed specs and reconcile
the master design to their refinements. The identified contract conflicts are
now reconciled in the blueprint. Physical integrated/mobile 60 FPS evidence and
a publicly deployed game URL are still missing. Neither passing tests nor
checked spec checklists establish those remaining claims.

This pass inspected the production sources and test coverage, measured the
required math coverage, fixed concrete presentation gaps, prepared the cover
and description, and reconciled the blueprint after the user's decision. It
does not certify contest scores, eligibility, browser universality or a
deployment that has not occurred.

The reviewed baseline is `f64b0b231669a53f0ef2c7a035a85fe728a629df` plus the QA
changes committed with this report. [Build fingerprints](evidence.json) identify
the tested production artifacts. The report is not a claim about later builds.

## Evidence and limits

| Verification | Current result | What it establishes |
| --- | --- | --- |
| `npm run build` | Pass; strict TypeScript, no build warnings | Shared → server → client compilation and production bundling |
| `npm test` | 358 pass: 230 server/shared, 128 client | The assertions in 21 unit/integration suites, including real local HTTP/WS and compiled-process tests |
| `npm run sim` | 300 seeded matches pass | Prescribed balance/pacing checks: mirror 46.5%/53.5%, 2.20 exchanges/round; Aggro/Wall 50%/50%, 2.14 exchanges/round |
| `npm run test:math:coverage` | 68 tests; both required files 100% statements, branches, functions and lines | Source-level evaluator/combat coverage, with positive-count and no-skipped checks |
| `npm run verify:build` | 151,849 gzip JS bytes; limit 250,000 | Every emitted JS chunk, production entry points and forbidden build artifacts |
| `PLAYWRIGHT_BROWSERS_PATH=/tmp/cyberante-browsers npx playwright test` | All 32 pass, 3.5 minutes | Native Chromium APIs with one SwiftShader worker; physical-device performance remains outside this evidence |
| `npm audit --omit=dev --json` | Zero reported advisories | Current production dependency advisory check; not a security certification |

Software browser coverage includes three offline bot profiles completing Bo3,
two-player online matches, rematches, private hand reveals, reconnect/reload/grace
expiry, rules and tutorial access, keyboard/touch controls, responsive layouts,
native audio/FFT, native WebGL shader compilation and context restoration.
Emulated mobile viewports establish layout/input behavior in Chromium; they do
not establish Safari compatibility, physical mobile thermals or sustained FPS.

The full dependency audit reports six development-toolchain advisories
(three moderate, one high, two critical), including Vite/esbuild development
servers and Vitest tooling. Production serves compiled assets through Node;
these QA commands use Vitest run mode. Development-toolchain hardening remains
separate outstanding work. No forced major-version upgrade was performed.

## Requirements matrix

**Pass** means the inspected implementation and corresponding executable
evidence satisfy that requirement in the stated scope. **Reconciled** records
the original conflicting wording and the detailed contract now adopted in the
master at the user's explicit request. **Unverified** means the necessary
evidence is absent. **Prepared** means the named local artifact exists; it does
not mean it has been published. Original wording is retained in reconciled rows
to make the changes reviewable; it is not the current implementation target.

### Sections 1–2: vision, gameplay and mathematics

| Master requirement | Status | Inspected implementation / evidence |
| --- | --- | --- |
| Head-to-head simultaneous poker combat; solo alternative | Pass | `main.ts`, `SoloMatchSession.ts`, `Room.ts`; production integration cases |
| Procedural visuals/audio; zero external game media | Pass | Render/audio sources; complete production bundle audit; browser media-request checks |
| Contest rubric weights, maximum score and official-rule claims | Unverified | Design intent; software QA does not prove judging outcomes or current external rules |
| First two round wins, Bo3 | Pass | `GAME_CONSTANTS`, `MatchEngine`; progression/combat and completed browser matches |
| 20 starting Guard; carry within round; reset only at new round | Pass | `MatchEngine.startExchange/resolveClash`; knockout display and round-transition assertions |
| 34-second exchange; early mutual ready/commit | Pass | 2/15/10/4/3-second constants and `Room`; fake-clock lifecycle and browser tests |
| Single 52-card deck; server CSPRNG / browser-CSPRNG-seeded solo | Pass | `Deck.ts` crypto Fisher–Yates; `CryptoPRNG`, seeded `MatchEngine`, `main.ts` seed; deck/replay tests |
| Retained deck; rebuild below 12; fresh IDs on new match | Pass | `MatchEngine`, `Deck`; retained-deck/two-burn/rebuild/identity tests |
| Five private cards; three Flux; no Flux carry | Pass | Engine per-exchange reset; private-state/Flux debit tests |
| Deal → shaping → blind commitment → reveal/resolve | Pass | `Room`, `SoloMatchSession`; exact phase and one-outcome assertions |
| Nudge ±1, one Flux, both Ace wraps | Pass | `fluxEngine`, all thirteen ranks both directions and rejection-without-debit tests |
| Adjacent cyclic Suit Bleed, two Flux | Pass | `SUIT_RING`, all neighbor/self/opposite transitions; UI both directions |
| One burn with immediate single replacement | Pass | Engine action guards and exact replacement/reset tests |
| Spade hides an Assault card and disables active stance multiplier | Reconciled | Master §2.4B vs Specs 02/03/09: implementation suppresses Overcharge and Parry reflection, retains Parry half damage and fully reveals cards at clash |
| Diamond pip barrier; Ace 11, faces 10 | Pass | Shared burn evaluator; every-rank tests and tutorial barrier |
| Heart converts 50% damage to Guard | Pass | Shared combat; floor/cap/no-resurrection tests implementing refined Spec-02 |
| Club removes 50% Aegis mitigation | Pass | Combat tests; canonical Spec-02 additionally shreds Barrier by 50% |
| Exact 3/2 partition and ranking hierarchies | Pass | Evaluators, engine partition validation, ten-partition helper and browser swaps |
| Brace / Overcharge / Parry multipliers and reflection triggers | Pass | Complete stance matrix and weak-hand/Overcharge/Veil boundary tests |
| Base damage 18/14/10/8/5/2; mitigation 8/4/2 | Pass | Locked constants and exact math assertions |
| Net damage, barriers, simultaneous reflection and healing | Pass | `combatCalculator.ts`; 39 combat tests and 100% measured coverage |
| Spec-02 exchange cap, HP/score tiebreaks, exact sudden-death repeats | Pass | Combat and engine fixtures; exact tie repeats at 1 HP with no awarded point |

### Section 3: rendering

| Master requirement | Status | Inspected implementation / evidence |
| --- | --- | --- |
| Three.js/GLSL; no textures, sprites or model downloads | Pass | All render sources and production-output audit |
| Wireframe matrix, neon colors, audio bass reactivity | Pass | `ReactiveGrid`, shader uniforms, renderer geometry/FFT tests and native shader/pixel cases |
| Inward XY inverse-square gravity at interaction points | Reconciled | Master §3.1 vs Spec-07 downward Z mouse well; current shader implements the detailed spec plus event-centered shockwaves |
| Exponentially damped radial clash shockwave | Pass | Grid displacement GLSL and pooled-wave timing tests; production clash capture |
| Cards specifically use `LineSegmentsGeometry`, local cyan | Reconciled | Current `BufferGeometry`/`LineSegments` and canonical suit colors; opponent faces are magenta, per Spec-07 |
| Mathematical rank and suit glyphs | Pass | `ProceduralCard`; every rank/suit, hidden face, geometry reuse tests |
| Burn, impact and round-victory particle bursts | Pass | 100 burn / 250 clash / 300 victory particles; round-win controller wiring added in this pass, deduplicated for either seat |
| Mixed glowing line/diamond/triangle particle geometry | Reconciled | Master §3.2 vs Spec-07 pooled `THREE.Points`/`PointsMaterial`; implementation draws diamond point sprites |
| Random velocities, decay, additive blending | Pass | Fixed particle pool; speed, acceleration, lifetime, elapsed-time equivalence and reduced-motion tests |
| Specifically `UnrealBloomPass` | Reconciled | Master pipeline vs detailed shader-pass allowance; current custom GLSL bright-neighbor bloom produces glow without that class |
| High-luminance bloom, scanlines, vignette, barrel curvature | Pass | `postCrtBloom.glsl`, render-target compositor tests and inspected canvas/screenshots |
| Chromatic aberration proportional to local incoming damage | Pass | Fourth optional clash argument and seat mapping added in this pass; zero/10/20/clamped damage and reduced-motion tests |
| Stable buffers, reduced motion, context loss recovery | Pass | Renderer unit tests and native Chromium API tests; no per-frame geometry allocation |
| Sustained 60 FPS on physical integrated/mobile GPUs | Unverified | Required Spec-10B recordings absent; [alternative protocol](../performance_acceptance.md) preserves the target |

### Section 4: audio

| Master requirement | Status | Inspected implementation / evidence |
| --- | --- | --- |
| All music/SFX synthesized in native Web Audio | Pass | `AudioEngine`, `ProceduralMusic`, `SoundEffects`, `VoicePool`; unit and native browser audio tests |
| Master bus through Dynamics Compressor to stereo output | Reconciled | Spec-06/current graph uses master gain → analyser → destination; no compressor node |
| Two voices specifically Sawtooth + Square throughout | Reconciled | Spec-06/current phase-specific voices also use triangle oscillators |
| 24dB low-pass and feedback delay | Reconciled | Current Spec-06 graph has one low-pass biquad; no feedback delay or 24dB cascade |
| Phase BPM 85/115/135/90/100 and adaptive cutoff | Pass | Phase scheduler tests and native controller/audio triggers |
| Bass/mid/high FFT coupled to visuals | Pass | FFT 256, canonical bin ranges and scene uniforms; browser observes nonzero energy |
| Click 880→1760 Hz/40ms | Reconciled | Spec-06/current click is 800→200 Hz/40ms |
| Pip nudge dual square with directional pitch bend | Reconciled | Spec-06/current directional triangle chirp |
| Suit Bleed resonant bandpass chord | Pass | Two detuned triangle voices through bandpass; audio node/pitch assertions |
| Burn white noise and decay filter | Pass | Procedural noise buffer/filter/envelope tests; no audio fetch |
| Stance lock specifically 120→40 Hz sub-drop | Reconciled | Spec-06/current three distinct stance cues use different synth schedules |
| FM clash laser and damage explosion | Pass | Real scheduled FM/noise voices; deduplicated controller/clash tests |
| Impact duration/intensity scales continuously with damage | Reconciled | Spec-06/current impact receives a lethal flag; schedules 0.3/0.6-second bursts |
| Gesture unlock, mute, unsupported audio and cleanup | Pass | Single context, transient node disposal, silent fallback and synchronized controls in browser tests |

### Sections 5–7: modes, AI and authority

| Master requirement | Status | Inspected implementation / evidence |
| --- | --- | --- |
| Menu routes solo / online / tutorial; audio/graphics controls | Pass | `MainMenuOverlay`, `main.ts`; mode transition and settings cases |
| Four-character private room code and direct join URL | Pass | `RoomManager`, client room sanitization/clipboard/link prefill; real room and sharing cases |
| Authoritative Node.js/Bun loop | Reconciled | Current blueprint adopts the detailed specs' Node.js runtime. Compiled Node v24.21.0 process verified; Bun removed from the target |
| Complete local solo, no AI API/network requirement | Pass | Shared classical AI and local session; browser goes offline after loading and completes/rematches |
| Bot shaping and commitment 1–2-second thinking pauses | Pass | Session fake-clock tests; production shaping/lock-in timings |
| Visual bot transmutation/lock tokens | Pass | Public Flux/burn/commit indicator added this pass; browser verifies transition/reset without private reveals |
| Four interactive action-gated lessons | Pass | `TutorialSession`, `TutorialManager`; actual controls, back/replay/skip/completion and native training clash |
| Lesson 1 teaches 3/2 split | Pass | Blank selection, manual/auto split gates and evaluation previews |
| Lesson 2 specifically nudges 6→7 to Straight | Reconciled | Spec-09/current fixture nudges 4→3 to an A–2–3 Straight Flush |
| Lesson 3 Diamond barrier and replacement | Pass | Real shared burn effect, fixed replacement and carried barrier |
| Lesson 4 specifically passive training drone | Reconciled | Spec-09/current drone Parries Overcharge and resolves real reflected damage |
| Rules available during active phases | Pass | Complete ranking/stance/burn tables; dialog focus/Escape and continuing timers tested |
| Classical ten-partition heuristic; own-hand utility | Pass | Shared AI; exact profile weights, score term, deterministic tie order and immutability tests |
| One-step nudge upgrade / tactical burn / stance decisions | Pass | Exact utility gain and probability/HP boundaries; shaping actions revalidated after replacement |
| Cipher, Aggro and Wall archetypes | Pass | Three configured profiles and priorities; all solo profiles complete Bo3; 300-match simulator |
| Cipher specifically saves Flux to complete Flushes | Reconciled | Canonical Spec-05 one-step rank-nudge search cannot change suits to create a Flush; bot Suit Bleed is not scheduled |
| Server retains private cards and validates submitted actions | Pass | Engine guards, schema validation, binding/ownership and oversized-message tests |
| Opponent receives `{id:hidden,suit:UNKNOWN,rank:0}` hashes | Reconciled | Master §7.1 contradicts its own §7.2 and Specs 01/04; actual protocol omits opponent cards before reveal |
| Blind lock-in and optimal timeout split / Brace | Pass | Every partition validated; highest Assault then Aegis then first fallback; no overwritten commits |
| Independent 30-second seat grace, automatic resume | Pass | Tokens, deadlines, old-socket identity, both-disconnected/lobby grace and browser reload tests |
| Deliberate leave / expiry forfeits and cleanup | Pass | No resumed departed seat; final winner tick, phase cancellation and complete timer disposal |
| Master §7.2 shared interfaces and message contracts | Pass | Inspected `types.ts`, runtime validator, strict package builds and transport payload assertions |

### Sections 8–10: repository, workflow and deliverables

| Master requirement | Status | Inspected implementation / evidence |
| --- | --- | --- |
| Named monorepo files, shaders, tests, ten specs and CI | Pass | Repository inventory; all named modules exist; client AI paths reexport the shared implementation |
| Strict NodeNext shared/server; explicit `.js` imports | Pass | Inspected imports/manifests/tsconfig; compilation and emitted Node process executed |
| Shared zero runtime dependencies; no package cycles | Pass | Shared manifest/source imports; server/client depend on shared only |
| Deterministic shared PRNG, no shared `Math.random` | Pass | Inspected shared engine/AI/Flux/evaluator sources; seeded replay tests. Cosmetic particle/audio noise randomness stays client-side |
| CI testing and specifically linting | Reconciled | CI builds/tests/audits/coverage/sim/browser flows; no dedicated lint command or linter exists |
| Specs 01–10 target modules and workflow verification | Pass with limits | See dispatch matrix below; hardware and public deployment remain unverified |
| Evaluator and combat 100% unit coverage | Pass | New source alias, per-file thresholds and nonempty coverage verifier prevent vacuous empty-report success |
| Empty-lobby mitigation / immediate solo entry | Pass | No human partner needed; real offline complete matches |
| Tutorial introduces every mechanic in 60 seconds | Reconciled | Current blueprint adopts Spec-09's four user-paced, gated lessons plus complete rules reference. The unsupported universal teaching-time claim was removed under the user's detailed-spec decision |
| Procedural page loads in <300ms | Reconciled | Current blueprint adopts Spec-10's <250,000 gzip-byte JS gate and zero media. No load-time guarantee is inferred; the unmeasured 300ms claim was removed under the user's detailed-spec decision |
| Network drops cannot hang commitment | Pass | Continuing authoritative timers, fallback and forfeit/recovery behavior |
| OpenAI Codex implementation attribution | Pass | Specs/workflow/git history and prepared project description |
| Exact project title | Prepared | Existing title and submission description |
| WebGL-generated project cover | Prepared | [1440×900 actual clash capture](../submission/cover.png), visually inspected; outside game bundle |
| Concise project description | Prepared | [Submission description](../submission/description.md) includes all named themes |
| Public zero-install project URL | Unverified | Production server/build/health/proxy guide verified locally; no public deployment evidence |
| Official October 30, 2026 submission deadline/eligibility | Unverified | External contest claim, outside repository implementation evidence |

## Dispatch-level audit

| Spec | Required targets and public contracts | Strongest current evidence / limitation |
| --- | --- | --- |
| 01 | Shared types/constants/index and ESM exports | Strict shared build, source/API review, zero runtime dependencies |
| 02 | Evaluator/combat and exact scores/formulas | 29 evaluator + 39 combat tests, nonempty 100% per-file coverage |
| 03 | Deck/Flux and deterministic engine | 25 deck/Flux + 26 engine tests, CSPRNG adapter and seeded replays |
| 04 | Room/manager/HTTP/WS validation and lifecycle | 23 lifecycle + 11 schema + 12 real transport/process cases |
| 05 | Shared classical bots/profiles and balance simulator | 44 bot cases; all three warmed evaluation maxima below 1ms this run; 300 matches |
| 06 | Audio context/music/SFX/FFT | 33 audio cases plus native audio/controller browser observations |
| 07 | Vector scene/grid/card/pool/two GLSL shaders | 29 renderer/scene cases plus native shader/pixel/context/buffer cases; physical 60 FPS pending |
| 08 | Board/menu/rules/main HTML | Seven selection cases plus responsive, touch, keyboard and online browser flows |
| 09 | Four-step tutorial and rules | 23 session + eight manager cases; production training/rules cases |
| 10 | Main/router/network/build/single-port integration | Nine network + six solo + six controller cases; full production browser flows; public URL and physical acceptance pending |

CI configuration now includes the math coverage gate. A local passing run does
not prove that GitHub Actions has run for the resulting commit; the remote CI
status has not been observed or certified by this pass.

## Changes made during QA

1. Measured source coverage instead of assuming it from passing tests. The first
   complete measurement found 95.83% evaluator branches. Added the Jack pair
   case and removed an unreachable pair/kicker fallback; both required sources
   now measure 100%, with no scoring or balance constant changes.
2. Added a public-state opponent Flux/burn/lock-in indicator, with browser
   privacy/reset verification.
3. Added round-win confetti, kept match fanfare deduplication, and corrected
   stance colors/effect intensity to the local seat and its incoming damage.
4. Captured an actual procedural clash cover and prepared submission copy.
5. Prepared physical-device capture instructions and a review record that keep
   the affected laptop out of native rendering tests.
6. At the user's explicit direction, retained the detailed specs and reconciled
   the master wording for Veil/privacy, gravity, geometry/bloom, audio, bots,
   tutorial, Node runtime and CI. Replaced unmeasured universal loading/teaching
   times with the detailed specs' actual bundle and tutorial contracts. The
   physical 60 FPS target remains unchanged.

## What must happen before full certification

1. Collect and review both qualifying physical-device recordings at the
   unchanged 60 FPS target using the [capture protocol](../performance_acceptance.md).
2. Deploy the verified Node release to a chosen host, then verify its public
   HTTP/HTTPS/WebSocket URL from outside the local environment. The
   [deployment guide](../deployment.md) is preparation, not deployment evidence.
3. Confirm any required browser/device coverage and external submission rules.
   Submit the prepared artifacts only after the public link is available.

The old cold-load and teaching-time claims are no longer implementation
requirements after reconciliation to the detailed specs. Contest-rule
confirmation and development-toolchain advisory remediation are recorded
separately from the two unresolved implementation acceptance categories.

Until those items are resolved, the accurate conclusion is **software QA
passed; the master design is not fully certifiable**.
