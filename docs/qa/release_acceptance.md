# Pending release acceptance

Updated: 2026-10-05. The user requested a placeholder because hosting has not
been secured. Runtime source under review is `6e25db8` (Spec-07.1); subsequent
certification notes and the refreshed cover change documentation/artifacts only.

| Field | Current value |
| --- | --- |
| Public production game URL | `PUBLIC_GAME_URL_PENDING` |
| Hosting provider/account | `HOSTING_PROVIDER_PENDING` |
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
