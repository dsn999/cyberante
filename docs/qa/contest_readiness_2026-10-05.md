# Contest and public-repository readiness — 2026-10-05

## Verdict

The project's entry requirements in the supplied rules PDF are satisfied by
the prepared materials, public game and user-confirmed cross-device play.
The user confirmed entrant eligibility and mission participation. No project
entry violation was found. This is a readiness review, not an organizer eligibility
decision, a guaranteed judging score or a record of contest submission.

**Before submitting, deploy this hygiene release:** it adds complete runtime
license notices. The live notice URL returned 404 during this review, so the
previous public build has not yet received that change. Keep the game available
for judging. Publish the repository and submit the four fields yourself after
reviewing the mission's current submission terms.

## Rules and evidence

Authority: [supplied official rules PDF](<../../[AI Skills Studio Challenge] Contest Official Rules.pdf>),
seven pages, SHA-256
`a91fa6ad6aab3ebbae5dcb392aee9531acc6b1f3f40b1e0eded21539fbf314a2`.
Its extracted text was decoded from embedded Unicode maps with no unmapped
glyphs. The in-product mission brief is preserved in [projectbrief.txt](../../projectbrief.txt).

| Requirement | Evidence / assessment |
| --- | --- |
| Legal resident and present in an Appendix A country, age 18/local majority, active Handshake account with entry email, outside excluded groups | User explicitly confirmed eligibility on 2026-10-05; no personal documents or email collected |
| Project built with OpenAI through the specified Handshake multiplayer mission | User confirmation plus Codex attribution, specification workflow and implementation history |
| Two players can join from separate devices | User played Windows Chrome against an iPadOS Safari participant; public QA independently exercised two connections, same match, private hands and identical authoritative clash output |
| Rules a player can follow without the creator explaining them | Four interactive tutorial lessons, rules reference and contextual control guidance; browser checks cover complete offline training and rule availability during play |
| Reachable live game | HTTPS page and `/cyberante/health` respond; secure `/cyberante/ws` create/join, authenticated seat recovery and combat exchange pass |
| Project title | CYBERANTE: Procedural Vector Poker-Combat Matrix |
| Cover image | [Actual procedural game capture](../submission/cover.png), 1440×900 PNG, prepared outside the game bundle |
| Project description | [Submission copy](../submission/description.md), with mechanics, modes, procedural visuals/audio and OpenAI Codex attribution |
| Project URL | https://holactie.com/cyberante/ |
| Entry method and deadline | Submit in Handshake's Create a Multiplayer Game mission by **October 30, 2026, 11:59 PM Pacific**, per PDF page 1; preparing files or publishing GitHub does not submit an entry |
| Multiple entries / automated-entry prohibition | PDF allows multiple entries but prohibits mass/automated entry submission; this workflow has not submitted entries or automated the entry process |
| Code of Conduct, OpenAI service terms and submission permissions | These are entrant obligations accepted through submission; the PDF references a separate Challenge Code of Conduct without supplying its text. Review the current in-product terms before submitting; this audit cannot certify an unseen separate document |
| Submission publicity/promotional permissions | PDF pages 3–4 describe broad organizer/partner rights to use entry materials and identifying/publicity information. Review those terms before the final submission |
| Winner follow-up | Monitor the Handshake account email; PDF describes possible eligibility/acceptance paperwork, a 30-day notification window and winner tax responsibility |

The PDF does **not** require public source, a specific host, measured FPS,
zero media downloads or a particular technology stack. Those additional targets
came from the project's own specifications. Public source is the user's planned
release choice. `private: true` in package manifests prevents accidental npm
publication; it does not control GitHub visibility.

The public [Handshake overview](https://joinhandshake.com/blog/students/ai-skills-studio/)
confirms the mission program and project-sharing purpose. It does not replace
the supplied contest rules or prove account eligibility. No later official rules
amendment was established by this review.

## Judging alignment

The PDF assigns 25% each to execution, creativity, usefulness/value, and
polish/thoughtfulness. The simultaneous poker/combat concept, procedural vector
arena/audio, solo fallback, live multiplayer, tutorial, recovery and responsive
controls provide evidence relevant to those categories. Scores remain the
judges' decision; the repo makes no certified 5/5 claim.

## Hygiene changes

- Replaced the stale root design-document duplicate with a pointer to the
  maintained blueprint; updated public README with the playable URL, actual
  tested platforms, current performance acceptance and Node.js support.
- Patched Vite to 7.3.6 and Vitest/coverage to 4.1.11, updated the lockfile and
  aligned CI with Node 24. Full and production-only npm advisory audits now
  report zero vulnerabilities. Advisory results describe the scan date and
  registry database, not a proof of perfect security.
- Migrated constructor mock typing and coverage configuration. Server tests
  explicitly select source tests, avoiding compiled `dist` duplicates. Bot
  timing warms the complete path before the unchanged 1000 measured samples;
  mean/p95/max thresholds remain below 1 ms. Added mirrored assertions to the
  existing strong-hand Parry case; combat implementation and balance are unchanged.
- Declared root test/coverage tools directly so root scripts work after a fresh
  install, rather than depending on incidental workspace hoisting.
- Added full Three.js/ws MIT notices to the repository, client build and Docker
  runtime. The organizer PDF is explicitly outside the project's MIT grant.
- Expanded ignore rules for local environment variants, private-key formats and
  deployment archives. No dependency/build/coverage/test-result files or secret
  paths were tracked at the reviewed baseline.
- Checked all locally reachable Git blobs for recognizable private keys,
  service tokens, credential URLs and quoted credential assignments: **345
  blobs / 593 objects, zero findings**. Pattern scanning has limits; remote-only
  or dangling objects were not examined. Git history was not rewritten.
- Local Markdown links resolve. Historical QA reports retain their dated scope;
  the current acceptance record governs the user's revised performance decision.

Author names/email in Git metadata, the project's MIT attribution and the public
deployment IP are public-facing repository information, not credentials. No
account passwords, SSH private keys or eligibility documents were collected.

## Verification scope

| Final gate | Result |
| --- | --- |
| Clean `npm ci` and strict workspace build | Pass |
| Unit/integration checks | 358 pass (230 server/shared, 128 client) |
| Seeded balance simulation | 300 matches pass |
| Evaluator/combat coverage | 68 checks; both sources 100% statements, branches, functions and lines |
| Production browser checks | 32 pass across four completed serial, single-worker SwiftShader batches |
| Root/subpath bundle audit | 152,156 / 152,157 gzip JS bytes; no game media or source maps |
| Full / production npm advisory audit | Zero / zero reported vulnerabilities |
| Public transport | HTTPS, two-client join/combat and authenticated reconnect pass; QA room cleaned up |

The machine-readable [evidence record](contest_readiness_2026-10-05_evidence.json)
contains final command results, source fingerprints and the public transport
record. Automated browser checks use one headless SwiftShader worker; no native
WSL GPU experiment was run. The user's Windows/iPad performance acceptance is
subjective and establishes no numeric 60 FPS or universal-device guarantee.

The current public build's asset paths are recorded separately from the new
local release. The server's exact deployed Git revision is not exposed by its
health endpoint. Docker is unavailable in this workspace, so a fresh container
build must be completed on the Droplet. No GitHub visibility change, push,
deployment or contest entry was performed by this hygiene review.

## Final actions

1. Deploy the committed hygiene release using the [deployment guide](../holactie_deployment.md).
   Confirm `/cyberante/THIRD_PARTY_NOTICES.txt` responds, then check a normal
   multiplayer session. Schedule replacement between matches.
2. Push the clean `main` branch and make the GitHub repository public. GitHub
   CLI is not authenticated here, so remote visibility was not certified.
3. Submit the title, cover, description and public game URL through the mission
   before the PDF deadline. Review the live entry terms and save the submission
   confirmation. A game bot is gameplay logic, not an automated contest-entry tool.
