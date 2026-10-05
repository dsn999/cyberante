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
| Integrated-GPU computer trace bundle | `INTEGRATED_GPU_TRACE_PENDING` |
| Physical phone/tablet trace bundle | `MOBILE_GPU_TRACE_PENDING` |
| Full master-design certification | Pending external acceptance evidence |

## Open gates

- [x] Public game URL supplied; user reports successful end-to-end play.
- [ ] Public HTTPS game URL identifies the deployed build and passes external
  two-player WebSocket/gameplay/recovery checks with a recorded checklist.
  The broad end-to-end confirmation does not itemize recovery behavior.
- [ ] Qualifying integrated-GPU computer recordings establish sustained 60 FPS
  during splash, complete match/clashes/victory and warm repeats.
- [ ] Qualifying physical phone/tablet recordings establish the same target.

The master §10.2 URL deliverable is now available on user-reported evidence.
Keep Spec-10B hardware items and the detailed release-evidence gate open.

Use the [deployment guide](../deployment.md) and
[physical capture protocol](../performance_acceptance.md) to replace them with
reviewable evidence. Device metadata and trace review belong in completed copies
of the [capture record](../performance_capture_record.md). No further native WSL
GPU experiment is part of this acceptance route.

The [Droplet setup guide](../holactie_deployment.md) and committed Compose/Caddy
configuration describe the deployment. The user performed the remote setup;
no agent-run remote installation or contest submission is claimed.
