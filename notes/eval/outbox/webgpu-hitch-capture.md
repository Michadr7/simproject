michadr.

# Eden Ridge 0.36.3 hitch capture

Run from the Three.js workspace with Node and Chrome installed.

```powershell
node scripts/hitch-capture.mjs "$env:TEMP\eden-ridge-hitch" --headless
node scripts/hitch-capture.mjs "$env:TEMP\eden-ridge-hitch-reverse" --headless --reverse
```

The driver serves the existing packaged build over loopback and starts a fresh profile for each renderer. It checks the running backend for `?webgpu=0` and `?webgpu=1`. Each run starts on High at 1280 × 720 with the same saved character and an owned pickup in the Eastbank depot. It requests Play as soon as the button handler is available, moves to the driver door, presses E to enter, exits, and stages the same position and camera for re-entry. It sets the sky to 22:00, verifies the L-key light changes, then switches High → Low → High from the in-game Settings panel.

Each JSON has the browser and adapter identity, event marks, raw frame samples, and a summary. The summary records the preceding 750 ms's median interval, peaks from 1.5 seconds after each trigger, and the CPU time in the input handler. It includes the next callback when that callback closes a gap across the window boundary. The next quality change waits for new game frames after the settling delay.

Frame gaps are intervals between game animation callbacks. CPU render time covers the synchronous renderer call, including driver work it waits on. GPU execution time, display presentation and an interactive playthrough are outside this capture. The temporary fixture jumps from spawn to the depot using the existing debug hook.

## Hardware measurements

Chrome 157 reported the NVIDIA GeForce RTX 4070 Ti on both paths. WebGL used `WebGLRenderer` with ANGLE D3D11. WebGPU used `WebGPUBackend` with direct output and reported an NVIDIA Lovelace adapter with `isFallbackAdapter: false`. Idle frame gaps clustered around 6.1 ms.

The first two comparisons in opposite renderer orders gave these ranges. Cells show peak callback gap / peak CPU render in milliseconds, rounded to the nearest millisecond, except for Play latency. Each peak is measured independently.

| Trigger | WebGL | WebGPU |
| --- | ---: | ---: |
| Play request to first world render call | 519–527 | 4,398–4,426 |
| First world render window | 1,321–1,333 / 291–296 | 442–455 / 90–94 |
| Eastbank arrival | 115–182 / 68 | 333 / 126 |
| First driver entry | 103–115 / 39–47 | 73–85 / 24–25 |
| Repeat driver entry | 6 / 4 | 6–12 / 6 |
| Night headlight off/on cycles | ≤12 / ≤7 | ≤12 / ≤7 |

The first E handler itself took 38–43 ms on both backends. Re-entry took under 1 ms. Night setup preceded the headlight cycles, and WebGPU showed a 61–67 ms gap during that setup. The captures verify which action the spikes followed. Their causes remain open.

The final comparison tightened the recovery check before reversing the quality tier. It ran alongside the regression suite and reproduced the startup, entry and headlight patterns. Play to first world render was 572 ms on WebGL and 4,602 ms on WebGPU in this run.

| Quality trigger | WebGL gap / CPU render (ms) | WebGPU gap / CPU render (ms) |
| --- | ---: | ---: |
| High → Low | 1,975.8 / 1,967.7 | 2,181.7 / 274.2 |
| Low → High | 6.2 / 6.1 | 1,739.3 / 343.0 |

WebGL spent nearly the whole High → Low gap inside a render call. Each WebGPU switch had a 274–343 ms CPU render followed by a later, longer callback gap. Quality handlers returned within 5 ms on both paths.

Final raw files are in `%TEMP%\eden-ridge-hitch-0.36.3-final\webgl.json` and `%TEMP%\eden-ridge-hitch-0.36.3-final\webgpu.json`. The two earlier comparisons are under `%TEMP%\eden-ridge-hitch-0.36.3-verified`, with the second order in its `reverse` folder. Use the final pair for attributing the quality gaps.

Confidence is high in the verified backends, trigger order and captured measurements. Confidence is moderate that the exact latency will carry over to a headed playthrough. Timing inside shaders, GPU execution and the cause of the delayed WebGPU callbacks are unverified.

## Files

- Created `scripts/hitch-capture.mjs` (405 lines) and `tests/hitch-capture.mjs` (27 lines).
- Updated `notes/handoff.md` (409 lines), `PROJECT-BRIEF.md` (39 lines), and `PROJECT-INDEX.md` (836 lines). The generated index also picked up a pre-existing removal of the `godot-tests.mjs` entry.
- Created this outbox report (80 lines). The capture uses the local 0.36.3 package. The last recorded publish is 0.36.2.

Protected files required no edits.

## Verification

Added one test that checks event ownership for the first render and the callback that closes a long quality-switch gap. The capture validation checked the expected backends, event order and headlight states, post-switch recovery, and that every CPU render sample fit inside its frame.

```text
PASS hitch-capture: first render owns its CPU sample and a long quality-switch gap stays with its trigger
Verified WebGLRenderer 3772 frames, both quality changes, recovery, and headlight states.
Verified WebGPUBackend 3694 frames, both quality changes, recovery, and headlight states.
brief tests passed: 272 modules listed, brief 2834 and index 34961 estimated tokens (budgets 3000 and 37000)
```

The initial repository runner skipped `hub-commit.mjs` under the no-Git rule. `hub-boot.mjs` failed twice during temporary-directory cleanup, and `hub-jobs.mjs` stalled. I stopped the confirmed test process tree and resumed the Three.js files from the recorded passes. The Hub logs are in `%TEMP%\eden-ridge-hitch-0.36.3-tests.log`.

```text
FAIL hub-boot.mjs
failed twice. Second run:
Error: EPERM, Permission denied: 'C:\Users\Michael\AppData\Local\Temp\hub-boot-XYiMo4'
```

The Three.js log is in `%TEMP%\eden-ridge-hitch-0.36.3-game-tests.log`.

```text
Resuming Three.js suite with 112 completed and 194 remaining.
THREE.JS SUITE: 306 of 306 test files passed.
```
