# Pending release acceptance

Updated: 2026-10-05. The user initially requested a placeholder and has now
created a DigitalOcean Droplet at `143.198.161.195`. Deployment and DNS acceptance
remain unverified. The earlier QA audit covers runtime `6e25db8` (Spec-07.1);
subsequent GitHub-link and deployment-path changes require their own release
evidence before certification.

| Field | Current value |
| --- | --- |
| Public production game URL | `PUBLIC_GAME_URL_PENDING` |
| Hosting provider | DigitalOcean Droplet, `143.198.161.195` (user supplied) |
| Planned public address | `https://holactie.com/cyberante/` (not yet verified) |
| Integrated-GPU computer trace bundle | `INTEGRATED_GPU_TRACE_PENDING` |
| Physical phone/tablet trace bundle | `MOBILE_GPU_TRACE_PENDING` |
| Full master-design certification | Pending external acceptance evidence |

## Open gates

- [ ] Public HTTPS game URL identifies the deployed build and passes external
  two-player WebSocket/gameplay/recovery checks.
- [ ] Qualifying integrated-GPU computer recordings establish sustained 60 FPS
  during splash, complete match/clashes/victory and warm repeats.
- [ ] Qualifying physical phone/tablet recordings establish the same target.

Keep the master §10.2 URL item and Spec-10B hardware items open while these
fields are pending. The user-approved placeholders record the missing inputs.

Use the [deployment guide](../deployment.md) and
[physical capture protocol](../performance_acceptance.md) to replace them with
reviewable evidence. Device metadata and trace review belong in completed copies
of the [capture record](../performance_capture_record.md). No further native WSL
GPU experiment is part of this acceptance route.

The [Droplet setup guide](../holactie_deployment.md) and committed Compose/Caddy
configuration prepare this target. No remote installation or public acceptance
is claimed by preparing these files.
