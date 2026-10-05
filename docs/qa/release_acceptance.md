# Pending release acceptance

Updated: 2026-10-05. The user initially requested a placeholder and has now
created a DigitalOcean Droplet at `143.198.161.195` and confirmed the deployed
game works end to end. This is user-reported public acceptance, not a separate
agent-run production check. The earlier QA audit covers runtime `6e25db8` (Spec-07.1);
subsequent GitHub-link and deployment-path changes require their own release
evidence before certification.

| Field | Current value |
| --- | --- |
| Public production game URL | `https://holactie.com/cyberante/` — user confirmed working end to end |
| Hosting provider | DigitalOcean Droplet, `143.198.161.195` (user supplied) |
| Deployment configuration | Prepared in `bf484a6`; actual deployed revision not independently recorded |
| Desktop performance | User accepted Windows Chrome multiplayer play; GPU type and numeric FPS not recorded |
| Tablet performance | User accepted physical iPad Safari multiplayer play; numeric FPS not recorded |
| Full master-design certification | Pending external acceptance evidence |

## Open gates

- [x] Public game URL supplied; user reports successful end-to-end play.
- [ ] Public HTTPS game URL identifies the deployed build and passes external
  two-player WebSocket/gameplay/recovery checks with a recorded checklist.
  The broad end-to-end confirmation does not itemize recovery behavior.
- [x] Desktop observed performance accepted by the user in Windows Chrome.
- [x] Tablet observed performance accepted by the user on a physical iPad using Safari.
- [x] User explicitly replaced mandatory numeric FPS evidence with subjective
  acceptance of the real multiplayer session. 60 FPS remains an engineering
  target; no sustained numeric result or universal device compatibility is claimed.

The master §10.2 URL deliverable is now available on user-reported evidence.
Spec-10B performance items are closed under the user-approved revised contract.
The detailed release-evidence gate remains open.

Use the [deployment guide](../deployment.md) for release operation. The
[physical capture protocol](../performance_acceptance.md) and
[capture record](../performance_capture_record.md) remain available for optional
quantitative diagnostics. No further native WSL GPU experiment is part of this route.

The [Droplet setup guide](../holactie_deployment.md) and committed Compose/Caddy
configuration describe the deployment. The user performed the remote setup;
no agent-run remote installation or contest submission is claimed.

## Performance decision provenance

On 2026-10-05 the user reported playing in Chrome on Windows, with the other
multiplayer participant on an iPad using Safari, and explicitly accepted the
observed performance. This is the acceptance authority for the revised gate.
Device models, GPU identity, browser versions, numeric frame rates and warm-repeat
conditions were not supplied. The report supports these two browser/platform
combinations; compatibility with every modern device is not established.

The earlier certification reports and JSON records are historical. Their missing
FPS-evidence statements describe the contract before this decision; they are not
rewritten as measured passes.
