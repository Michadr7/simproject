michadr.

## WebGPU T5: renderer switch behind ?webgpu=1 (Opus, game.js lane), report

Default is unchanged: testers stay on `WebGLRenderer`, and `three.webgpu.js` / `three.tsl.js` (2.3 MB) are never downloaded. `?webgpu=1` loads both with a dynamic import, creates `WebGPURenderer`, runs `await renderer.init()` before anything else, and switches every GLSL patch to its T2/T3/T4 TSL twin. The library falls back to WebGL2 by itself when there is no adapter, and `&webgl=1` forces that fallback. If the WebGPU path throws, it logs a warning and falls back to `WebGLRenderer`. The no-pause fix was NOT done (as asked). git was not run. package.json is still 0.35.22: it was never deployed, so I rebuilt it with `--force` and did not bump it.

### URLs testers use
- Live, once 0.35.22 is deployed: `https://simproject.ghostjumper007.workers.dev/?webgpu=1`
- Local (npm run dev): `http://localhost:8000/?webgpu=1`
- To force WebGPURenderer onto its WebGL2 backend (tests the fallback): `?webgpu=1&webgl=1`. Add `&debug` for `window.__city`.
- The HUD fps line shows which backend is running: `165 FPS | WebGPU` or `165 FPS | WebGL2 via WebGPU`. Plain WebGL keeps the old `165 FPS`.

### Files created or changed (line counts)
New:
- `dist/render-backend.js` (23): `backendFlag(search)`, `backendLabel(renderer, usedWebGPU)`, the one TSL kit `setTslKit` / `tslKit(user)` / `tslUses()` (counted for the test), and constants. The kit is module state by design, like dev-flag.js. Threading it through createWorld, driving.js and every call site would have touched the forbidden files.
- `tests/webgpu-flag.mjs` (73): pure checks, then four boot cases, each in its own process.

Changed (all small and additive; the GLSL path is byte-for-byte the old code when no kit is set):
- `dist/game.js` (1970, CRLF kept, no BOM):
  - Renderer creation (old line 102) now reads the flag, does the dynamic import, `new WGPU.WebGPURenderer({canvas, antialias, powerPreference, forceWebGL})`, top-level `await r.init()`, `setTslKit(...)`, the `renderBackend` string and a console.info line. It also calls `setGroundQuality` from the saved settings, because the TSL ground fixes its quality when it is built.
  - The fps HUD suffix.
  - Warm-up: `renderer.compile` when it exists, otherwise `compileAsync` (fire and forget).
  - drawCreator: viewport and scissor y are flipped for WebGPURenderer (it counts y from the top). Checked in Edge: the preview framing is identical.
  - Dev cost line reads `info.render.drawCalls` first.
  - One import line.
- `dist/world.js` (653): the sightline fade uses `createSightlineFadeTSL`. The ground goes through a `groundPatch` helper that calls `makeGroundMaterialTSL` (one shared `createGroundUniformsTSL`), and every caller uses the material it returns. That covers groundLayer, the pavement slab and the dirt-track/gravel ribbons; the ribbons are only marked and get patched in groundLayer, because a node material must not be cloned.
- `dist/sky.js` (93): `createSky` hands over to `createSkyTSL` when a kit is set. This covers the game sky and the menu sky.
- `dist/shadows.js` (88): the blob patches use `createBlobMeshTSL`, and `uOpacity` is held as one reference.
- `dist/pallet-tags.js` (59), `dist/menu-scene.js` (165), `dist/tracks.js` (41), `dist/smoke.js` (52), `dist/debris.js` (90), `dist/night-lights.js` (160), `dist/ground-cover-view.js` (84): each takes its T3 twin exactly as the T3 report lists. Where the GLSL path set `customProgramCacheKey` or `onBeforeCompile`, it now does so only when there is no kit.
- `dist/paint-shader.js` (86): on first use, `lookParts` swaps each paint and glass material once for its `tsl-paint.js` twin, on every mesh of the vehicle and on `userData.paint` for the S70/flatbed. The twin keeps `vertexColors`, `alphaTest` and the sightline `maskNode`. `applyPaint` and `applyLook` are unchanged. `load()` now also returns the blank texture when `document.createElementNS` is missing (only the fake test DOM).
- `dist/tsl-ground.js` (131), BUG FIX: the factory overrode `customProgramCacheKey` with `ground-<kind>`. WebGPURenderer keys its node-build cache on that string, so every grass plane would have drawn with the FIRST grass material's texture, tint and gravel flag. Hydrogen's single-material lab could not show this. The key now lives in `userData.groundProgramKey`. `tests/tsl-ground.mjs` (335) was changed to match: it now asserts that the override is absent.
- `dist/tsl-grade.js` (30): the second `addToneMapping` (the menu sky after the game sky) only logged "THREE.Redefinition of node 5", so it now reuses the installed grade. The warning is gone in Edge.
- `tests/support/mock-renderer.mjs` (85):
  - backend `'auto'` follows `navigator.gpu`.
  - `webgpuModule` re-exports the REAL three.webgpu.js (real NodeMaterials; only the renderer is a mock).
  - A load counter.
  - The mock WebGPURenderer has `compileAsync` and no `compile`, as in the real one.
  - Default behaviour is unchanged for the other boot tests.

### Tests (real output)
`node tests/webgpu-flag.mjs`:
```
off: WebGLRenderer, three.webgpu.js/three.tsl.js not loaded, 167 GLSL-patched materials as before, HUD "25 FPS"
on: WebGPURenderer (WebGPU), init awaited, 67 node materials, TSL twins {"sky":2,"world":1,"cover":1,"tags":1,"paint":9,"tracks":1,"smoke":1,"debris":1,"lights":1,"shadows":1,"menu":1}, points left at 1 px: (points), sawdust, HUD "25 FPS | WebGPU"
force: WebGPURenderer (WebGL2 via WebGPU), init awaited, 67 node materials, TSL twins {"sky":2,"world":1,"cover":1,"tags":1,"paint":9,"tracks":1,"smoke":1,"debris":1,"lights":1,"shadows":1,"menu":1}, points left at 1 px: (points), sawdust, HUD "25 FPS | WebGL2 via WebGPU"
nogpu: WebGPURenderer (WebGL2 via WebGPU), init awaited, 67 node materials, TSL twins {"sky":2,"world":1,"cover":1,"tags":1,"paint":9,"tracks":1,"smoke":1,"debris":1,"lights":1,"shadows":1,"menu":1}, points left at 1 px: (points), sawdust, HUD "25 FPS | WebGL2 via WebGPU"
PASS webgpu-flag: off = WebGLRenderer with no WebGPU/TSL download; ?webgpu=1 = WebGPURenderer, init awaited before the first render, 10 TSL twins built, no GLSL patch left; &webgl=1 and no navigator.gpu = WebGL2 via WebGPU.
```
The test also asserts:
- No ShaderMaterial or own `onBeforeCompile` is left in the world or menu scene under the flag.
- Every named twin is present in a scene.
- No node material carries its own `customProgramCacheKey`.

Related tests run individually after the edits all passed (tsl-ground, tsl-materials, tsl-paint, tsl-sky, tsl-shadows, smoke, tracks, night-lights, shadows, cover-view, menu-scene, paint, ground-shader):
```
PASS tsl-ground: all 11 ground kinds (140 cases) matched ground-shader.js (col=1.11e-16, nrm=7.38e-13, rgh=0.00e+0, emi=0.00e+0).
PASS tsl-materials: all 8 T3 NodeMaterial factories & CPU math parity checks matched GLSL sources.
PASS tsl-paint: 3528 paint cases & 81 glass cases matched paint-shader.js (paintDiff=0.00e+0, glassDiff=0.00e+0).
night lights tests passed
menu-scene ok
ground-shader: 58055 checks ok
```
`npm run release -- --force`: `Packaged release 0.35.22: 253 files -> dist/releases/0.35.22`.

Full `npm test` (after the release):
```
FAILED FILES: brief.mjs
1 of 304 test files failed.
```
`brief.mjs` failed on the index budget. My first `npm run index` printed `index 36385 tokens (target 36000)`; my own entries are about 60 tokens of that, and the rest was already there before T5. I did not touch the cap. Re-run once, as the rules say: someone else had meanwhile raised the cap to 37000 and regenerated the index (the test count also went from 304 to 305, so another agent is writing at the same time). Now:
```
brief 2834 tokens (target 3000), index 35748 tokens (target 37000); 253 modules, 14 generated, 305 tests, 30 scripts; 13 modules without a header comment
brief tests passed: 253 modules listed, brief 2834 and index 35748 estimated tokens (budgets 3000 and 37000)
```
Every other file passed, webgpu-flag.mjs included. I did not re-run the whole suite after the cap change. The `ground cover models not loaded ReferenceError: Image is not defined` lines in the log were there before T5 (Node has no Image).

### Real game in headless Edge (scratch CDP harness, real GPU adapter, 1280x720)
Each run started a fresh save (starter skipped), pressed Play, pinned the picture to 12:00 (or 22:00 for the night spot) and then visited the 5 spots plus a night shot. The diffs are the mean absolute difference per channel (0..255) against the default WebGL run. Pedestrians, NPCs and smoke move between runs, so part of every diff is motion.

| Spot | WebGPUBackend mean / max / % > 15 | WebGL2 via WebGPU mean / max / % > 15 |
|---|---|---|
| sky (spawn, horizon) | 0.13 / 165 / 0.18% | 0.17 / 165 / 0.21% |
| ground (spawn, looking down) | 0.15 / 140 / 0.16% | 0.17 / 140 / 0.18% |
| vehicle (Eastbank depot, painted pickups) | 1.19 / 153 / 2.06% | 1.12 / 153 / 1.76% |
| shop (walked through the Corner Market door, `__city.shop === 'market'`) | 1.53 / 113 / 3.62% | 1.55 / 184 / 3.70% |
| sawmill | 3.20 / 232 / 4.16% | 3.00 / 232 / 3.64% |
| night 22:00 (Oak Street lamps) | **23.96** / 217 / 35.69% (means 136.1 vs 113.6) | 23.94 / 217 / 35.61% |
| main menu | 4.20 / 173 / 9.32% | 2.47 / 158 / 6.32% |

- Backend reported by the page:
  - default: `WebGLRenderer`, `165 FPS`.
  - `?webgpu=1`: `isWebGPURenderer: true`, `WebGPUBackend`, HUD `162 FPS | WebGPU`.
  - `&webgl=1`: `WebGLBackend`, HUD `160 FPS | WebGL2 via WebGPU`.
  - Files actually served: three.webgpu.js and three.tsl.js only in the two flag runs.
- Console: no errors or exceptions from the game in any of the three runs, apart from the `[renderer] ...` info line. The only exception was `e.target.matches is not a function`, caused by my harness dispatching a key on `window`. It happened in both modes and is a harness artifact. The `THREE.Redefinition of node 5` warning from the first lab run is fixed (tsl-grade.js).
- Frame time: headless Edge is vsync-capped. Every spot measured 6.06 ms mean / 6.1 median in ALL three modes, so this run cannot tell the backends apart. Real frame time needs the owner's GPU.
- I looked at the screenshots: the depot pickups (paint recolour, glass), the sawmill, cover tufts, the ground detail, the shop door and the character creator all match by eye.

### Known visual gaps, by material
1. **Night glows (`night-sprites`, `night-ground`: lamp halos, lamp pools, headlight beams).** On WebGPU they are much weaker: the halos are smaller and the ground pools are almost gone (night spot mean 23.96). WebGPURenderer blends additive glow in its linear HalfFloat buffer and tone-maps once at the end; WebGL tone-maps each glow fragment and blends in the sRGB canvas. This is the biggest gap. It needs a compensation in the look layer (TSL), for example a brighter or gamma-shaped tint for the glow materials on the node path only.
2. **Fog (every lit material).** It reads hazier with short fog, most visibly in the main menu (fog 14-46 m: the pines look washed out) and on the far lake. WebGPU mixes fog in linear light before the grade; WebGL's `fog_fragment` mixes after tone mapping and sRGB. Daytime world spots are barely affected (0.13-3.2).
3. **`scene.background` colour** (the creator preview, and behind the dome if it fails): it goes through the grade on WebGPU, so it is slightly lighter.
4. **Sightline dither (trees between the camera and the player):** the 4x4 Bayer rows are mirrored vertically (T3). Cosmetic.
5. **Vehicle glass:** about 2 mean levels different, from blending translucent glass in linear light (T4).
6. **`PointsMaterial` (sawdust, menu dust):** drawn as 1 px points on WebGPU (point size is not supported). The weld lab is its own page with its own WebGLRenderer and is not affected by the flag.
7. **Ground quality at runtime:** the TSL ground keeps the quality it was built with. Switching High/Low in Settings changes shadows, cover and pixel ratio at once, but the ground only after a reload.
8. **Dev panel cost line:** under WebGPU, `drawCalls` reads 0 between frames (the renderer's own loop resets `info`), and `programs` does not exist.
9. **Shader warm-up:** WebGPURenderer has no synchronous `compile`. The warm-up is a fire-and-forget `compileAsync`, so the first crash or the first new vehicle could still hitch on WebGPU.

### What I could NOT verify
- Frame time and GPU cost on a real playing setup: the headless runs are vsync-capped. The owner's 165 Hz machine is needed.
- In Node no node material is ever compiled (the renderer there is a mock). The Edge runs compiled them all without console errors on both backends, but only at the 6 spots above: the warehouse pallet tags, the crash debris and the wheel spray, the smoke and the tyre tracks were never on screen in Edge. Their factories were built in Node and covered by T3's isolated Edge checks.
- A true no-adapter machine: `nogpu` is the mock case, and `&webgl=1` was the real Edge check of the WebGL2 backend.
- Long play, a quality switch at runtime, multiplayer, and the scene editor (game.js renders the scene directly there; this should work, but it was not opened).

### Go / no-go for flipping the default
**NO-GO for now.** The port works: every material has a TSL twin, both backends start without errors, and the daytime world matches within 0.13-3.2 mean levels. Night is clearly worse, though (gap 1), and the menu fog differs (gap 2). Testers would see a dimmer night on WebGPU. Before the flip:
- (a) A small look-layer stage that compensates the additive glow and the fog order on the node path.
- (b) The owner plays `?webgpu=1` on the real GPU and compares FPS and look at night.
- (c) Then flip by changing the default in `backendFlag` (one line; `?webgl` could then mean "old renderer").

### Requested edits to forbidden files
None: game.js, world.js and the call sites were in this lane per the prompt. notes/handoff.md was not touched: the main chat should record T5 done, the URL `?webgpu=1`, the NO-GO and the two follow-ups (night glow and fog on the node path).

### Confidence
- Flag, renderer switch, no download on the default path, init before the first render, WebGL2 fallback: **high** (Node test plus Edge on both backends).
- Material wiring (sky, ground, paint, shadows, tracks, smoke, debris, lights, cover, tags, menu, sightline): **high** for "built and drawn without errors". **Medium** for exact parity at night and in fog (see the gaps).
- The tsl-ground cache-key fix: **high** (it follows from the three.js cache code I read: `getMaterialCacheKey` uses `customProgramCacheKey`, and the node builder is cached by it).
