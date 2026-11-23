michadr.

# NPC hold and WebGPU startup fixes

The fixes are in the local 0.36.3 package. I applied the shared-file ownership change from this request. The last publish receipt in this workspace is for 0.36.2, which matched the handoff. The live version endpoint was unreachable from this session, so I used those local records to verify which package to rebuild. This work did not publish a release.

## Changes

- `AGENTS.md` (40 lines) allows the lead Codex agent to edit shared Three.js files and keeps one writer per shared file.
- `dist/game.js` (2,002 lines) passes the active outdoor dialogue actor and pool slot ID to the crowd update. For WebGPU and its WebGL2 fallback, it warms from the initial camera angle and keeps the menu visible until the visible world and hidden shader jobs settle. An early Play request shows “Preparing world…” on the Play button. Selecting the current quality tier reuses its materials.
- `dist/npc-crowd.js` (142 lines) holds the speaker's displayed position, reserves it for separation, and idles the speaker’s locomotion and work animation. The local actor resumes at the same route time after dialogue and rejoins the live schedule when hidden or out of range. The hold state lives in the crowd view. The town clock keeps advancing.
- `dist/night-lights.js` (163 lines) installs the High-quality spotlight before the first compile and updates its presence during a real tier change.
- `dist/tsl-output.js` (123 lines) makes the hidden shader pass await all the warm-up attempts. The startup changes add zero steady-state draw calls.
- `scripts/webgpu-diff.mjs` (105 lines) selects `?webgpu=0` for the WebGL baseline, checks which backend actually started, and waits for Play to enter the world before taking a gameplay capture.
- Added `tests/npc-talk-hold.mjs` (38 lines). Extended `tests/webgpu-flag.mjs` (94), `tests/webgpu-ground-quality.mjs` (85), `tests/tsl-output.mjs` (79), and `tests/support/mock-renderer.mjs` (88) for startup order and quality coverage. Updated the source-shape check in `tests/shadows.mjs` (131) and covered actual shadow state at both quality tiers in the packaged test.
- Rebuilt the 0.36.3 package and regenerated `PROJECT-BRIEF.md` (39 lines) and `PROJECT-INDEX.md` (835 lines). All four modified runtime modules matched the packaged copies by hash.

## Verification

The packaged regression opens Robert's street dialogue through E, advances the town clock through nine seconds of simulation, then checks his position and route resumption after Esc. The renderer test independently controls visible and hidden compilation completion. It checks that the High spotlight is present when both compile paths start and that the menu stays visible until both finish. The quality test checks that reselecting the active tier keeps material objects and that actual tier switches retain their prior behavior.

```text
Packaged release 0.36.3: 273 files -> dist/releases/0.36.3
dist/index.html now loads releases/0.36.3/
PASS npc-talk-hold: Robert stays in place through street dialogue, town time advances, and he resumes the route without jumping.
PASS webgpu-flag: ?webgpu=0 = WebGLRenderer with no WebGPU/TSL download; no flag and ?webgpu=1 = WebGPURenderer (the 0.36.0 default), init awaited before the first render, world waits for visible and hidden shader warm-up with the High light installed, 11 TSL twins built, no GLSL patch left; &webgl=1 and no navigator.gpu = WebGL2 via WebGPU.
PASS webgpu-ground-quality.mjs: live high->low->high rebuilt 54 TSL ground materials (54 meshes), disposed old materials, updated groundProgramKey, preserved polygonOffset, and reused the materials when reselecting the current tier.
PASS tsl-output: real WebGPURenderer runs without framebuffer/output pass (MSAA kept), per-material grade + sRGB with toneMapped honoured, render targets linear, display fog (encoded colour, follows the scene), encoded clear colour, hidden-twin warm-up, last draw calls.
```

The wider run used the repository's test runner with its file selection filtered to omit the 26 Hub tests. It passed 304 of 305 files. The failing shadow assertion expected the previous single-line quality function. I updated the assertion for the new layout and checked actual shadow state in the packaged quality test. Both shadow and quality reruns exited 0. Runtime files stayed identical between the broader run and the targeted reruns.

```text
FAILED FILES: shadows.mjs
1 of 305 test files failed.
Shadows: a 90 m box (4.4 cm a texel) that moves in whole texels; fade 0 under 6 degrees and 1 over 12, the pass skipped for 118 of 1,440 minutes; moon shadows on; Low: one mesh of at most 48 patches (96 triangles, 1 draw call), none on High, indoors or at the horizon.
brief tests passed: 272 modules listed, brief 2834 and index 34926 estimated tokens (budgets 3000 and 37000)
```

## Remaining verification

Headless Edge reported `GPU process isn't usable. Goodbye.` and Chrome did not expose a DevTools target. This prevented a real frame-time comparison and visual confidence is limited to the tested state transitions. Shader work for streamed materials and actual High/Low changes can still land on a gameplay frame. An early Play request can spend time waiting for warm-up. Confidence is high in the reproduced NPC fix, rendering order, and package contents. The amount of hitch reduction is unverified.

Created `notes/eval/outbox/npc-hold-webgpu-fixes.md` (44 lines).
