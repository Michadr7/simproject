michadr.

## WebGPU & TSL Feasibility Spike (`r187`, `0.35.20`) — Outbox Report

**Recommendation:** **GO** (phased `T1..T6`, not a single-shot flip).

All coding, vendoring (`three@0.187.0` `three.webgpu.js` + `three.tsl.js`), Edge CDP runs, and mock tests ran strictly inside the scratch copy `C:\Users\Michael\AppData\Local\Temp\eden-webgpu`. Nothing in `c:\Users\Michael\Documents\Projects\simproject` was modified except the two report files below, and `npm test` / `npm run release` / `npm run index` / `git` were not run in the real repo per task rules.

### 1. Files Created (Real Repo vs Scratch Copy)
**Real repo (report deliverables only):**
- [notes/webgpu-spike.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/webgpu-spike.md) (written cleanly under the 250-line budget; UTF-8 without BOM)
- [notes/eval/outbox/webgpu-spike.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/eval/outbox/webgpu-spike.md) (this report; UTF-8 without BOM)

**Scratch copy (`C:\Users\Michael\AppData\Local\Temp\eden-webgpu`):**
- `dist/vendor/three.webgpu.js` (`1,350,894` bytes) & `dist/vendor/three.tsl.js` (`1,065,544` bytes)
- `dist/spike-tsl.js` (`413` lines: `gradeTSL` `14` lines, `createSkyTSL` `107` lines, ground TSL `189` lines, 100k compute grass `73` lines)
- `dist/spike-lab.html` (`448` lines), `run-spike.mjs` (`128` lines), `test-async-mocks.mjs` (`143` lines)
- `screenshots/spike-metrics.json` + 26 PNG screenshots (`{gpu,sw}-sky-{glsl,tsl}-{0615,1200,1745,0000}.png`, `{gpu,sw}-ground-{glsl,tsl}.png`, `{gpu,sw}-grass-{compute,compute-gl,cpu}.png`)

### 2. Real Test & Benchmark Outputs

**A. Edge CDP Spike Run (`node "C:\Users\Michael\AppData\Local\Temp\eden-webgpu\run-spike.mjs"`):**
Ran in both hardware GPU mode (`NVIDIA Lovelace` WebGPU adapter present) and forced software GL mode (`--disable-gpu --use-angle=swiftshader`, where `requestAdapter() === null`):
- **Exp 1 Boot & Fallback (`gpu` mode / `sw` mode):**
  - `auto`: `WebGPUBackend` in `41.1 ms` (gpu) / `WebGLBackend` in `9.4 ms` (sw)
  - `forceWebGL: true`: `WebGLBackend` in `7.0 ms` (gpu) / `4.5 ms` (sw)
  - `navigator.gpu = undefined`: `WebGLBackend` in `13.2 ms` (gpu) / `4.2 ms` (sw)
  - `sharedCoreIdentity`: `true` (`WGPU.Mesh === THREE.Mesh && WGPU.Scene === THREE.Scene`)
- **Exp 2 & 4 Sky & Colour Grade (`WebGPUBackend` / `WebGLBackend` sw):**
  - `06:15`: `meanAbsChannelDiff = 0.019` (`max = 1`) / `0.012` (`max = 1`)
  - `12:00`: `meanAbsChannelDiff = 0.054` (`max = 1`) / `0.006` (`max = 1`)
  - `17:45`: `meanAbsChannelDiff = 0.019` (`max = 2`) / `0.011` (`max = 2`)
  - `00:00`: `meanAbsChannelDiff = 0.031` (`max = 73`, `pctDiffGt15 = 0.163%`) / `0.031` (`max = 77`, `0.183%`)
  - `gradeTSL` cost (`gpu` mode): `addToneMapping` (`56` calls, `cpuSubmit mean 0.20 ms`, `frame mean 6.055 ms`) vs `RenderPipeline` post pass (`102` calls, `cpuSubmit mean 0.21 ms`, `frame mean 6.065 ms`, `postError: null`)
- **Exp 3 Ground Shader (`gpu` mode / `sw` mode):**
  - First-frame compile: GLSL `28.7 ms` vs TSL `47.6 ms` (gpu); GLSL `87.5 ms` vs TSL `171.3 ms` (sw)
  - `glCalls: 4`, `wgCalls: 4`
  - Visual diff (`640x400`): `meanAbsChannelDiff = 1.522`, `maxChannelDiff = 80`, `pctDiffGt15 = 9.292%` (`gpu`) / `0.993`, `65`, `5.452%` (`sw`)
- **Exp 5 100k Compute Grass (`100,000` blades, `300,001` tris):**
  - `computeAuto` (`WebGPUBackend`, gpu): `initBufMs: 7.2`, `firstFrameMs: 11.6`, `cpuSubmit mean: 0.32 ms (p95: 0.4)`, `frame mean: 6.06 ms`
  - `computeWebGL` (`WebGLBackend` TF, gpu): `initBufMs: 7.7`, `firstFrameMs: 30.9`, `cpuSubmit mean: 0.225 ms (p95: 0.3)`, `frame mean: 6.06 ms`
  - `computeAuto` (`WebGLBackend` TF, sw): `initBufMs: 7.2`, `firstFrameMs: 27.6`, `cpuSubmit mean: 0.31 ms`, `frame mean: 16.63 ms`
  - `cpuDynamic100k` (`WebGLRenderer`, gpu): `firstFrameMs: 30.0`, `calls: 1`, `cpuSubmit mean: 9.655 ms (p95: 13.1)`, `frame mean: 9.95 ms (p95: 15.8)`
  - `existingCpuChunkPlace` (`coverFor` 1 chunk): `5,361` instances, `buildMs: 8.0 ms` (gpu) / `9.4 ms` (sw)
  - `logs`: zero console errors in both `gpu` and `sw` runs (only expected fallback warnings).

**B. Async Mock Test (`node "C:\Users\Michael\AppData\Local\Temp\eden-webgpu\test-async-mocks.mjs"`):**
```
ground cover models not loaded ReferenceError: Image is not defined
    at makeAtlas (file:///C:/Users/Michael/AppData/Local/Temp/eden-wgpu-mock-YKCMiV/ground-cover-view.js:30:34)
    at Object.setAssets (file:///C:/Users/Michael/AppData/Local/Temp/eden-wgpu-mock-YKCMiV/ground-cover-view.js:54:31)
    at file:///C:/Users/Michael/AppData/Local/Temp/eden-wgpu-mock-YKCMiV/world.js:577:45
PASS async-mocks: uninitialized throws; async-game booted with top-level await renderer.init() (renders=1)
```

### 3. Critical Blockers / Surprises Discovered
1. **Points limit on WebGPU:** `THREE.Points` only supports `1 px` points in WebGPU and `TSL.pointUV` fails WGSL validation (`unresolved value 'gl_PointCoord'`). `sky-stars`, `smoke.js`, and `debris.js` must move to instanced billboard quads (`InstancedMesh` / `SpriteNodeMaterial`).
2. **WebGL2 compute limits:** 1:1 storage-buffer compute works cleanly on `WebGLBackend` via Transform Feedback (`0.225–0.31 ms`), **except** `IndirectStorageBufferAttribute` (`drawIndirect`) is WebGPU-only — fallback still submits all `count` vertices unless CPU chunk culling is retained on fallback.
3. **Ground TSL sign & map traps:** Setting `colorNode` bypasses `MeshStandardNodeMaterial`'s implicit `map * color`, `positionView` is `+mvPosition.xyz` (opposite sign of GLSL `vViewPosition`), and GLSL `viewMatrix` is `TSL.cameraViewMatrix`.

### 4. What Could Not Be Verified
- Running the full 1500×1800 m Eden Ridge world or all 17 custom shaders live under `WebGPURenderer` (remaining 14 hooks/materials beyond sky, stars, grade, ground, and compute grass are assessed from source inspection + WebGPU/TSL constraints rather than ported code).
- Running `npm test`, `npm run release`, or `npm run index` in the real repo (prohibited by task rules).
- Checking `PROJECT-INDEX.md` exact token impact after adding `three.webgpu.js` + `three.tsl.js` (`vendor/` files are normally excluded/small entries in index, but `tests/brief.mjs` must verify this in `T1`).

### 5. Confidence per Part & Attribution
- Done by: main Gemini reasoning session (no subagents or Flash calls spawned).
- **Boot & WebGL2 fallback:** High (tested with NVIDIA Lovelace GPU, `forceWebGL`, `navigator.gpu = undefined`, and SwiftShader software GL).
- **Sky, stars & `gradeTSL` (`addToneMapping` + `RenderPipeline`):** High (visually inspected & pixel-diffed across 4 times of day).
- **Ground shader TSL:** High for tested kinds (`grass`, `dirt`, `mud`, soft edges, bumps, wetness/sheen, pixel diff `1.52`); Medium-High for remaining 3 procedural kinds (`forest`, `plowed`, `paving`) extrapolated from the same primitives.
- **100k Compute Grass vs CPU:** High (benchmarked GPU WebGPU, GPU WebGL2 TF, SwiftShader TF, dynamic CPU loop, and `coverFor()`).
- **Difficulty matrix & `T1..T6` plan:** Medium-High (`paint-shader` and `debris` assessed by code inspection rather than live port).
- **Async test harness helper:** High (`test-async-mocks.mjs` passed against copied `0.35.20/game.js`).

### 6. Files to Share with Your Other Agent
- [notes/webgpu-spike.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/webgpu-spike.md)
- [notes/eval/outbox/webgpu-spike.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/eval/outbox/webgpu-spike.md)
- Scratch metrics: [spike-metrics.json](file:///C:/Users/Michael/AppData/Local/Temp/eden-webgpu/screenshots/spike-metrics.json)
- Scratch TSL code: [spike-tsl.js](file:///C:/Users/Michael/AppData/Local/Temp/eden-webgpu/dist/spike-tsl.js)
- Scratch async mock helper test: [test-async-mocks.mjs](file:///C:/Users/Michael/AppData/Local/Temp/eden-webgpu/test-async-mocks.mjs)
