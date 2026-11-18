# WebGPU & TSL Feasibility Spike (`r187`, `0.35.20`)

**Recommendation: `GO` — phased behind TSL parity (`T1..T6`), not a single-shot flip.**
On hardware GPU (NVIDIA Lovelace via Edge CDP), `WebGPURenderer` boots in `41.1 ms`, falls back cleanly to `WebGLBackend` when WebGPU is absent (`13.2 ms`), matches GLSL look on sky (`meanAbsDiff <= 0.054`) and ground (`1.522`), keeps zero-extra-pass custom tone mapping (`gradeTSL`), and drops 100k animated grass CPU cost by ~30× (`0.32 ms` vs `9.66 ms`). Two `r187` blockers shaped the plan: (1) WebGPU only supports `1 px` `THREE.Points` and `TSL.pointUV` emits invalid WGSL (`gl_PointCoord`), so `sky-stars`, `debris.js`, and `smoke.js` need instanced billboard quads/`SpriteNodeMaterial`; (2) `IndirectStorageBufferAttribute` culling is WebGPU-only, so `WebGLBackend` compute runs 1:1 via Transform Feedback without skipping zero-scale instances.

**Scratch Harness:** All code/tests ran ONLY in `C:\Users\Michael\AppData\Local\Temp\eden-webgpu` (`dist/vendor/three.webgpu.js` `1,350,894 B`, `three.tsl.js` `1,065,544 B`, sharing `./three.core.js`; `sharedCoreIdentity: true`). Real repo untouched except this note and outbox report.

---

## 1. Boot & WebGL2 Fallback (`WebGPURenderer`)

Measured in headless Edge under both hardware GPU (`--enable-unsafe-webgpu`, NVIDIA Lovelace adapter present) and software GL (`--disable-gpu --use-angle=swiftshader`, `requestAdapter() === null`):

| Case | GPU mode (`backend` / `initMs`) | SwiftShader (`backend` / `initMs`) | Notes |
|---|---|---|---|
| `new WebGPURenderer().init()` | `WebGPUBackend` / `41.1 ms` | `WebGLBackend` / `9.4 ms` | Auto-fallback on null adapter |
| `forceWebGL: true` | `WebGLBackend` / `7.0 ms` | `WebGLBackend` / `4.5 ms` | Logs 1 fallback warning |
| `navigator.gpu = undefined` | `WebGLBackend` / `13.2 ms` | `WebGLBackend` / `4.2 ms` | Clean fallback, zero exceptions |

- **Canvas snapshot gotcha:** WebGPU swapchains and default WebGL2 contexts without `preserveDrawingBuffer` clear upon frame presentation (`await raf`). Screenshots or `toDataURL` captures must read the canvas in the same frame synchronously after `render()` (or use a `RenderTarget`). Normal gameplay loops are unaffected.

---

## 2. Sky Dome, Stars & Custom Tone Mapping (`sky.js`, `daynight.js`)

Under `WebGPURenderer`, `THREE.ShaderChunk.tonemapping_pars_fragment` never runs (`installGrade()` has no effect). `gradeTSL` (`14` lines vs `13` in `gradeGLSL` at [dist/daynight.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/daynight.js#L89-L101)) runs via two working TSL paths:
- **Path A (recommended for `T1..T5`):** `renderer.library.addToneMapping(gradeTSL, THREE.CustomToneMapping)` — in-pass, zero extra render targets (`56` draw calls over test run, `0.20 ms` CPU submit, `6.055 ms` frame GPU / `16.655 ms` SwiftShader).
- **Path B (`T6+` outlines/post):** `RenderPipeline` + `pass(scene, camera)` + `renderOutput(gradeTSL(col, toneMappingExposure), NoToneMapping, SRGBColorSpace)` (`102` calls, `0.21 ms` CPU, `6.065 ms` GPU / `16.655 ms` SwiftShader, `postError: null`).

`createSkyTSL` (`107` lines vs `91` in [dist/sky.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/sky.js)) converted `sky-dome` (`NodeMaterial`, `depthTest/Write: false`) and converted `sky-stars` from `THREE.Points` to a `600`-instance billboard quad `InstancedMesh` + `instancedArray` + `uv()`, because `PointsNodeMaterial` + `TSL.pointUV` failed WGSL validation (`unresolved value 'gl_PointCoord'`; [three.webgpu.js](file:///C:/Users/Michael/AppData/Local/Temp/eden-webgpu/dist/vendor/three.webgpu.js#L4453) notes `Points` on WebGPU are `1 px` only).

| Time | Sky Diff `WebGPUBackend` (mean / max / >15) | Sky Diff `WebGLBackend` sw (mean / max / >15) |
|---|---|---|
| `06:15` (`375`) | `0.019` / `1` / `0.00%` | `0.012` / `1` / `0.00%` |
| `12:00` (`720`) | `0.054` / `1` / `0.00%` | `0.006` / `1` / `0.00%` |
| `17:45` (`1065`) | `0.019` / `2` / `0.00%` | `0.011` / `2` / `0.00%` |
| `00:00` (`0`, stars + moon) | `0.031` / `73` / `0.163%` | `0.031` / `77` / `0.183%` |

---

## 3. Ground Shader Port (`dist/ground-shader.js`)

Ported GD1–GD3 (`grass`, `farm`, `valley`, `dirt`, `mud`, soft Bayer dither edges, Mikkelsen height bump normal, puddle roughness + sky Fresnel sheen) into `makeGroundMaterialTSL` (`MeshStandardNodeMaterial`): **`189` lines** for 4 kinds vs **`152` lines** for all 8 kinds in [dist/ground-shader.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/ground-shader.js) (~`220` lines estimated for all 8 kinds, ~1.45×).

| Metric | GPU mode (`WebGL` vs `WebGPU TSL`) | SwiftShader (`WebGL` vs `WebGLBackend TSL`) |
|---|---|---|
| First-frame compile | `28.7 ms` vs `47.6 ms` | `87.5 ms` vs `171.3 ms` |
| Draw calls (dome + 3 planes) | `4` vs `4` | `4` vs `4` |
| Visual diff (`640×400`) | `1.522` mean / `80` max / `9.29%` >15 | `0.993` mean / `65` max / `5.45%` >15 |

**What was hard (4 TSL gotchas caught during the spike):**
1. **`colorNode` bypasses `map * color`:** Reading `diffuseColor` inside `colorNode` lost the repeated texture; TSL must explicitly sample `texture(map, uv().mul(repeat).add(offset)).mul(TSL.color(color))` for both base and rotated no-tile samples.
2. **`positionView` sign flip:** Three.js GLSL `vViewPosition` is `-mvPosition.xyz`, whereas TSL `positionView` is `+mvPosition.xyz`. Both `dFdx/dFdy` Mikkelsen bump (`dFdx(positionView)`) and `mud` Fresnel (`normalize(positionView.negate())`) required opposite signs vs GLSL.
3. **`cameraViewMatrix` rename:** GLSL `viewMatrix` is `TSL.cameraViewMatrix` (using `viewMatrix` threw `undefined.mul`).
4. **No shared GLSL fragment locals across hooks:** Splitting `colorNode`, `normalNode`, `roughnessNode`, `emissiveNode` re-evaluates `mudPud`/`gdH` unless factored into shared `Fn` blocks carefully scoped to the stage.

---

## 4. 100k Compute Grass Benchmark (`100,000` instances, `300,001` tris)

`createComputeGrassDemo` (`73` lines in scratch `spike-tsl.js`) allocates `instancedArray` (`rootBuf`, `stateBuf`), computes per-blade distance density cull + wind wave + radial trample bend, and draws 1 `InstancedMesh`:

| Path | 1st Frame | CPU Submit (mean / p95) | Frame Time (mean / p95) | Notes |
|---|---|---|---|---|
| GPU Compute (`WebGPUBackend`) | `11.6 ms` | `0.32 ms` / `0.4 ms` | `6.06 ms` / `6.1 ms` | Native WGSL compute |
| GPU TF Fallback (`WebGLBackend`) | `30.9 ms` | `0.225 ms` / `0.3 ms` | `6.06 ms` / `6.1 ms` | WebGL2 Transform Feedback |
| SW TF Fallback (`WebGLBackend`, sw) | `27.6 ms` | `0.31 ms` / `0.4 ms` | `16.63 ms` / `17.8 ms` | Works without WebGPU |
| Dynamic CPU Loop (`WebGLRenderer`, gpu) | `30.0 ms` | `9.655 ms` / `13.1 ms` | `9.95 ms` / `15.8 ms` | ~30× slower CPU per frame |
| Existing static `coverFor` (1 chunk) | — | — | — | `8.0 ms` once / `5,361` static insts |

- **Caveat:** Existing `ground-cover-view.js` pays `0 ms` CPU *per frame* after static CPU chunking (`~8 ms/chunk` once), putting wind/cull in vertex shader. GPU compute (`0.32 ms`) enables **live 100k+ dynamic interaction** (trampling, mower/tire trails, crowds) without rebuilding buffers on CPU. On WebGL2 fallback, compute runs 1:1 (Transform Feedback) without `IndirectStorageBufferAttribute`, so true GPU indirect culling stays WebGPU-only while WebGL2 falls back to either 1:1 TF or existing chunked vegetation.

---

## 5. Shader & Hook Porting Matrix (All 17 Custom Shaders/Hooks)

| Item & File | Current API | Tier | Est. TSL Lines | Runs | Key Risk / Note |
|---|---|---|---|---|---|
| `shadows.js:11-17` shadow fade | `ShaderChunk` | **Easy** (delete) | `0` | `1` (w/ `T2`) | Obsolete in `r187`: use `sun.shadow.intensity` |
| `sky.js:11-19` `gradeGLSL` | `ShaderChunk` | **Easy** | `~18` | `1` (`T2`) | `library.addToneMapping(gradeTSL, CustomToneMapping)` |
| `sky.js:21-48` `sky-dome` | `ShaderMaterial` | **Easy** | `~55` | `1` (`T2`) | Proven pixel-exact (`NodeMaterial`) |
| `sky.js:35-56` `sky-stars` | `ShaderMaterial` | **Medium** | `~45` | w/ `sky-dome` | Must convert `Points` -> `InstancedMesh` quad |
| `shadows.js:19-41` `blob-shadows` | `ShaderMaterial` | **Easy** | `~35` | `1` (`T2`) | Super-ellipse SD + `uv()` + `rangeFogFactor` |
| `pallet-tags.js:40` atlas UV | `onBeforeCompile` | **Easy** | `~20` | `1` (`T3`) | `uvNode = uv().add(attribute('tagCell')).mul(...)` |
| `menu-scene.js:52` `windMaterial` | `onBeforeCompile` | **Easy** | `~25` | `1` (`T3`) | `positionNode` instanced wind offset (`worldPos`) |
| `tracks.js:14` `tyre-tracks` | `onBeforeCompile` | **Easy** | `~35` | `1` (`T3`) | Vertex fade/discard via `opacityNode` + `alphaTest` |
| `world.js:188` `sightline-fade` | `onBeforeCompile` | **Easy–Med** | `~40` | `1` (`T3`) | Segment dist + Bayer `Discard()` in `colorNode` |
| `smoke.js:39` `exhaust-smoke` | `onBeforeCompile` | **Medium** | `~45` | `1` (`T3`) | `Points` -> instanced billboard/Sprite (`gl_PointSize`) |
| `debris.js:47` `crash-debris` | `onBeforeCompile` | **Medium–Hard** | `~85` | `1` (`T3`) | `Points` + 6 `gl_PointCoord` SDFs -> quad `InstancedMesh` |
| `night-lights.js:18-75` sprites/ground | `2× ShaderMaterial` | **Medium** | `~70` | `1` (`T3`) | Manual `mix(..., fogColor, factor)` for `Additive` |
| `ground-cover-view.js:35` cover | `onBeforeCompile` + chunk | **Medium** | `~65` | `1` (`T3`) | Wind `positionNode`, rank fade, `faceDirection` normal |
| `paint-shader.js:46` `vehicle-glass` | `onBeforeCompile` | **Medium** | `~40` | `1` (`T4`) | Crack texture UV (`uWearTex`/`uCrackTex`) |
| `paint-shader.js:24` `vehicle-paint` | `onBeforeCompile` | **Hard** | `~85` | `1` (`T4`) | Object triplanar `vPlane`, HSV, wear bump normal |
| `ground-shader.js:139` `patchGround` | `onBeforeCompile` | **Hard** | `~220` | `1–2` (`T4`) | All 8 kinds, no-tile, Bayer, Mikkelsen normal, puddles |

---

## 6. Test Harness Mock Plan (6 Node Boot Tests)

All 5 named tests (`tests/startup.mjs`, `carry-game.mjs`, `carry-real.mjs`, `driving-game.mjs`, `fuel-game.mjs`) plus shared helper [tests/support/boot-game.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/support/boot-game.mjs) stub only `vendor/three.module.js` with synchronous `class WebGLRenderer` and do not stub `vendor/three.webgpu.js` or enforce `await renderer.init()`.
- **Shared helper design (`tests/support/mock-renderer.mjs` -> `writeMockRenderer(dir, threeURL)`):** Writes both `vendor/three.module.js` (`WebGLRenderer`) and `vendor/three.webgpu.js` (`WebGPURenderer` + `NodeMaterial` classes + `RenderPipeline`) where `init()` is `async` (`await Promise.resolve(); this.initialized = true`), `library = { addToneMapping() {} }`, `backend = { isWebGLBackend: true }`, and **`render()`/`compute()` throw if `!this.initialized`**.
- **Verified in scratch:** [test-async-mocks.mjs](file:///C:/Users/Michael/AppData/Local/Temp/eden-webgpu/test-async-mocks.mjs) copied `0.35.20`, proved uninitialized `render()` throws, and booted `game.js` patched with top-level `await renderer.init()` cleanly (`renders=1`) because all 6 tests already `await import('.../game.js')` (ES modules wait for top-level `await` before `nextFrame()` runs).

---

## 7. Staged Porting Plan (`T1..T6`)

| Stage | Scope & Files | Builder Model | Verification |
|---|---|---|---|
| `T1` | Add `tests/support/mock-renderer.mjs`; update `boot-game.mjs` + 5 mock tests; vendor `three.webgpu.js` + `three.tsl.js` (`PROJECT-INDEX` cap check!) | **Sonnet** (helper/5 tests) + **Opus** (`boot-game` / index cap) | `npm run index`, `npm test` |
| `T2` | `daynight.js` (`gradeTSL`), `sky.js` (`createSkyTSL` + billboard `sky-stars`), remove `shadows.js:11-17` hack + port `blob-shadows` (behind dual-path or GL fallback helper) | **Sonnet** (pure TSL helpers) + **Opus** (`shadows`/`sky` wiring) | Unit + Edge CDP sky diff `<= 1` mean |
| `T3` | Port Easy/Medium materials: `pallet-tags`, `menu-cover`, `tracks`, `city-sightline-fade`, `smoke` + `debris` quads, `night-lights`, `ground-cover-view` | **Sonnet** (2 batches of 4 files) | Node + Edge visual check per effect |
| `T4` | Port Hard materials: `ground-shader.js` (8 kinds) + `paint-shader.js` (`vehicle-paint` + `vehicle-glass`) | **Sonnet** (`paint`) + **Opus** (`ground-shader` full diff) | Edge CDP pixel diff `< 3.0` mean |
| `T5` | Switch `game.js:102` (`new WebGPURenderer` + top-level `await renderer.init()`); flip materials to TSL; verify `weld-lab.js`; test WebGPU & `?webgl=1` / missing `navigator.gpu` | **Opus** (owns `game.js` + release) | `npm run release -- --force && npm test` + 5-spot CDP screenshots |
| `T6` | First compute-only visual upgrade: 100k+ TSL compute meadow grass (`indirect` on WebGPU, chunked/TF fallback on WebGL2) & optional `RenderPipeline` outline pass | **Opus** (`game.js`/pipeline) + **Sonnet** (compute kernel) | Frame-time bench on GPU + SwiftShader |

## Scratch Artifacts & Screenshots
- Harness & JSON metrics: [spike-tsl.js](file:///C:/Users/Michael/AppData/Local/Temp/eden-webgpu/dist/spike-tsl.js), [spike-lab.html](file:///C:/Users/Michael/AppData/Local/Temp/eden-webgpu/dist/spike-lab.html), [run-spike.mjs](file:///C:/Users/Michael/AppData/Local/Temp/eden-webgpu/run-spike.mjs), [test-async-mocks.mjs](file:///C:/Users/Michael/AppData/Local/Temp/eden-webgpu/test-async-mocks.mjs), [spike-metrics.json](file:///C:/Users/Michael/AppData/Local/Temp/eden-webgpu/screenshots/spike-metrics.json)
- Screenshots (`gpu-*` = Lovelace WebGPU vs WebGL; `sw-*` = SwiftShader WebGL2): `C:\Users\Michael\AppData\Local\Temp\eden-webgpu\screenshots\{gpu,sw}-sky-{glsl,tsl}-{0615,1200,1745,0000}.png`, `{gpu,sw}-ground-{glsl,tsl}.png`, `{gpu,sw}-grass-{compute,compute-gl,cpu}.png`
