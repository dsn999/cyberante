# Spec-10B alternative performance acceptance

## Contract and status

Spec-07 requires sustained 60 FPS on standard modern integrated/mobile GPUs.
The user retained that acceptance in Spec-10B. The measurement tool is not
prescribed by either spec. Native browser performance recordings can therefore
provide the physical-device evidence without running the existing benchmark CLI.
This is a proposed capture protocol, not evidence of a pass. Both hardware
checklists remain open until recordings have been reviewed.

## Recommended route

Use a separate physical computer and phone, with an external tester if needed.
This route does not require the affected laptop to open the game, install GPU
libraries or run Playwright. Its RTX GPU would not establish the integrated-GPU
result even if a native Windows run succeeded.

Have a tester use the production game in a normal native Chrome browser on:

| Required evidence | Suitable device |
| --- | --- |
| Integrated GPU | A physical Intel integrated-GPU computer or Apple Silicon Mac using its integrated GPU |
| Mobile GPU | A physical Android phone/tablet, preferably a representative Snapdragon device |

A borrowed computer and phone or an external tester can supply both captures.
The affected laptop does not need to run the renderer. Capture and review can
take place on different computers; the exported traces are portable artifacts.
If using a testing service, verify that these are physical devices and that the
desktop browser actually uses an integrated GPU before accepting its results.

The production Node server can run in WSL or elsewhere: it serves HTTP/WebSocket
traffic and does not render the game. Use a URL reachable by both test devices.
Hosting or device procurement is a separate execution step; neither was
performed when this protocol was prepared.

For a tester with a repository checkout on a separate computer, the existing
production setup is sufficient:

```bash
npm ci
npm run build
npm run verify:build
npm start
```

Open `http://localhost:8080/` on that computer. The phone needs a reachable game
URL, supplied by that computer's networking setup or a deployed Node server;
`localhost` on the phone refers to the phone itself. There is no need to start
the native benchmark, install Playwright browsers or run concurrent renderers.
See [production operation](deployment.md) for server and deployment settings.

Use the normal game URL (`/`). The current `/benchmark.html` and CLI measurement
call `gl.finish()` per frame. This alternative does not use that measurement
path. `finish()` blocks until previous graphics commands complete; avoiding
that extra synchronization also measures the game's normal presentation path.
This does not establish the cause of the earlier laptop freeze.
[WebGL finish reference](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/finish)

## Capture procedure

1. Record the exact Git commit/build, device model, OS/browser versions, active
   GPU, screen refresh rate, viewport, canvas pixel dimensions and DPR. Verify
   hardware acceleration and the active GPU using the browser's graphics
   diagnostics. A dedicated-GPU or software-rendered run does not close the
   integrated-GPU requirement. An unidentified renderer remains inconclusive.
2. Keep production CRT and full motion enabled. Use the ordinary viewport and
   existing DPR cap; record their actual values. Use no CPU/network throttling,
   additional particles, altered shaders or reduced-quality acceptance settings.
3. Allow the page to finish loading and shaders to warm up. Record startup
   separately from sustained gameplay. Keep the game visible while measuring.
4. In Chrome DevTools, use **Rendering → Frame rendering stats** for an initial
   observation, then capture **Performance** recordings of normal game play.
   Chrome's frame tools distinguish successful, partially presented and dropped
   frames. Record the frame timeline rather than relying on one FPS screenshot.
   [Chrome frame rendering tools](https://developer.chrome.com/docs/devtools/rendering/performance)
5. Capture at least 60 seconds of the animated splash, then a complete solo match
   covering shaping, commitments, multiple clashes, round transitions and match
   victory/confetti. Repeat the captures once after several minutes of play to
   expose sustained-load behavior. These durations are the proposed evidence
   protocol; the contractual target remains 60 FPS.
6. For Android, inspect the phone's actual browser over USB using Chrome's remote
   debugging. The phone renders the game; the inspecting computer records its
   trace. Disable remote screencasting during measurement because it affects
   frame rates. Keep the phone awake and visible.
   [Chrome physical Android debugging](https://developer.chrome.com/docs/devtools/remote-debugging)
7. Save the Performance recordings and accompanying device/settings notes.
   Chrome supports exporting traces for later review.
   [Save performance traces](https://developer.chrome.com/docs/devtools/performance/save-trace)

## Review and closeout

Review both device classes against the unchanged sustained 60 FPS target and
the approximately 16.7 ms frame budget. Examine the frame timeline for sustained
or repeated misses, including clash effects and victory. Summarize frame cadence,
dropped/partially presented frames, scenario intervals and any context loss.
Account explicitly for measured display refresh timing; do not hide misses with
rounded FPS averages or invent a lower acceptance threshold.

If recording overhead appears material, compare a repeat run with the frame
stats overlay and document the difference. A trace containing unexplained drops
is not enough to certify the target. Fix any observed bottleneck and recapture
on the affected physical device.

Only close a hardware checkbox when its trace and metadata establish the target
on the qualifying device. Store the reviewed evidence and build identifier with
the acceptance record. This route preserves both physical-device obligations
and avoids further native rendering experiments through WSL.

## Evidence handoff

Give the tester this protocol and the exact build identifier. Ask for one bundle
per qualifying device, using the [capture record](performance_capture_record.md):

- Completed device, GPU and settings record.
- Exported frame traces for splash, match/clashes/victory and the warm repeat.
- Scenario timestamps so each effect can be located in the trace.
- Graphics diagnostics confirming the active hardware renderer.
- Notes about dropped frames, context loss or any interruption.

The tester collects evidence; review determines whether it satisfies the
contract. Keep the two Spec-10B hardware checkboxes open until both bundles pass
review. Missing devices or traces leave acceptance pending, rather than
substituting software timing, an RTX result or browser emulation.
