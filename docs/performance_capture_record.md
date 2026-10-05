# Spec-10B physical-device capture record

Copy this record for each device. Unfilled fields and unchecked items mean
evidence is pending; this template does not certify performance.

## Build and device

| Field | Recorded value |
| --- | --- |
| Git commit and any local changes | |
| Production game URL | |
| Capture date/time | |
| Device class: integrated-GPU computer or physical phone/tablet | |
| Device model | |
| OS and version | |
| Chrome version | |
| Active GPU / browser renderer | |
| Graphics diagnostics artifact | |
| Display refresh rate | |
| Viewport width × height in CSS pixels | |
| Canvas backing width × height in pixels | |
| Device pixel ratio | |
| CRT setting | |
| Reduced-motion setting | |
| Power mode / battery saver | |
| Other workload or thermal observations | |

## Capture conditions

- [ ] Normal production game `/`, without benchmark instrumentation.
- [ ] Verified physical hardware rendering in the required device class.
- [ ] CRT enabled and reduced motion disabled.
- [ ] No DevTools CPU/network throttling or altered quality settings.
- [ ] Page visible throughout each recorded interval.
- [ ] Android remote screencasting disabled, if applicable.

## Recordings

Use timestamps relative to each exported trace. Identify shaping, commitment,
clashes, round transitions and victory in the match trace. Split long recordings
if necessary, preserving coverage and labeling each interval.

| Scenario | Trace filename(s) | Relevant time intervals | Observations |
| --- | --- | --- | --- |
| Warmed splash, at least 60 seconds | | | |
| Complete solo best-of-three match | | | |
| Splash repeat after several minutes | | | |
| Match repeat after several minutes | | | |

## Reviewer decision

Record observed cadence, frame budget misses, dropped/partially presented
frames and context loss for each scenario. Account for display refresh timing
and recording overhead. An average FPS screenshot alone is insufficient.

| Field | Review result |
| --- | --- |
| Reviewer and review date | |
| Required device class confirmed | |
| Sustained 60 FPS / approximately 16.7 ms frame budget assessment | |
| Clash and victory assessment | |
| Warm repeat assessment | |
| Evidence limitations or repeat needed | |
| Decision: pending / pass / fail | pending |

Only a reviewed pass can close the corresponding Spec-10B hardware checkbox.
See the [acceptance protocol](performance_acceptance.md) for the full procedure.
