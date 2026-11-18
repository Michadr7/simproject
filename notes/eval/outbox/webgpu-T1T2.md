michadr.

## WebGPU / TSL Stages T1 + T2 — Outbox Report

Delivered **T1** (r187 WebGPU + TSL vendoring, shared `mock-renderer.mjs`, `boot-game.mjs` + 5 boot test updates) and **T2** (dormant pure TSL helper factories `dist/tsl-grade.js`, `dist/tsl-sky.js`, `dist/tsl-shadows.js`, plus pure CPU/vendored-TSL parity tests). Nothing in the live game changed; `game.js`, `sky.js`, `daynight.js`, `shadows.js`, `ground-shader.js`, and `scripts/package-release.mjs` were not modified.

### 1. Files Created or Changed

**Vendored builds (`dist/vendor/`):**
- `dist/vendor/three.webgpu.js` (new, `1,350,894` bytes, `34,475` lines)
- `dist/vendor/three.tsl.js` (new, `1,065,544` bytes, `37,338` lines)
- **Provenance & core sharing:** Copied from the spike scratch folder `C:\Users\Michael\AppData\Local\Temp\eden-webgpu\dist\vendor\` (`three@0.187.0` builds). Verified `dist/vendor/three.core.js` (`1,474,799` bytes, `sha256=613e370f7663`, `REVISION = '187'`) is byte-for-byte identical to the scratch `three.core.js`; `three.tsl.js` imports `./three.core.js`, `three.webgpu.js` imports `./three.core.js` and `./three.tsl.js`, and `sharedCoreIdentity` is `true` (`THREE.Mesh === WGPU.Mesh && THREE.Scene === WGPU.Scene && THREE.Color === WGPU.Color && TSL.NodeMaterial === WGPU.NodeMaterial`).
- **Release packaging & size delta:** Checked `scripts/package-release.mjs` line 23 (`(await readdir('dist/vendor')).filter(f=>f.endsWith('.js'))`) — it already copies all `dist/vendor/*.js` files automatically, so no edit is needed. Packaged release size delta once `npm run release` runs: **`+2,416,438` bytes (`+2,359.8 KB` / `+2.30 MiB` uncompressed)**.

**Pure TSL helper modules (`dist/`, UTF-8 without BOM):**
- `dist/tsl-grade.js` (new, `28` lines, header `96` chars): `createGradeTSL({ TSL })` and `installGradeTSL({ THREE, TSL, renderer })`, importing `GRADE` from `./daynight.js` and registering via `renderer.library.addToneMapping(gradeTSL, THREE.CustomToneMapping)`.
- `dist/tsl-sky.js` (new, `121` lines, header `97` chars): `buildStarData`, `createSkyTSL({ THREE, TSL, NodeMaterial, scene, renderer, sun, hemi })`, importing constants from `./daynight.js` (`NIGHT_FLOOR`, `skyAt`, clamps) and `./sky.js` (`INDOOR_EXPOSURE`, `STAR_COUNT`, `SUN_DISTANCE`, `SKY_HORIZON`). Converts `sky-dome` to `NodeMaterial` and `sky-stars` from `Points` to a `600`-instance `InstancedMesh` billboard quad (`instancedArray` + `uv()`). Preserves `tune()`/`tuning()`/`state()` parity with `dist/sky.js`.
- `dist/tsl-shadows.js` (new, `71` lines, header `98` chars): `BLOB_SMOOTH`, `createBlobMaterialTSL({ THREE, TSL, NodeMaterial, fog })`, `createBlobMeshTSL({ THREE, TSL, NodeMaterial, fog, capacity })`, importing `BLOB` from `./shadow-rules.js`. Uses `positionGeometry.xz.mul(2.0)`, `attribute('aBox', 'float')`, `rangeFogFactor` (via `reference` on `scene.fog` or `uFogNear`/`uFogFar` uniforms) in `opacityNode` with `material.fog = false` so distant blobs fade to transparent rather than tinting to fog color.

**Test harness & tests (UTF-8 without BOM):**
- `tests/support/mock-renderer.mjs` (new, `76` lines): `writeMockRenderer(dir, vendorThreeURL, { backend = 'webgl' })` writing both `vendor/three.module.js` (`WebGLRenderer`) and `vendor/three.webgpu.js` (`WebGPURenderer` with async `init()`, `library.addToneMapping`, `backend` flags respecting `forceWebGL`, throwing on `render()`/`compute()`/`RenderPipeline.render()` before `init()`, plus `NodeMaterial` subclasses).
- `tests/support/boot-game.mjs` (edited, `40` lines): switched inline `WebGLRenderer` stub to `await writeMockRenderer(dir)`.
- `tests/startup.mjs` (edited, `217` lines), `tests/carry-game.mjs` (edited, `107` lines), `tests/carry-real.mjs` (edited, `82` lines), `tests/driving-game.mjs` (edited, `106` lines), `tests/fuel-game.mjs` (edited, `108` lines): switched inline `vendor/three.module.js` stubs to `await writeMockRenderer(dir)`.
- `tests/tsl-grade.mjs` (new, `163` lines)
- `tests/tsl-sky.mjs` (new, `234` lines)
- `tests/tsl-shadows.mjs` (new, `154` lines)

**Regenerated index (`npm run index`):**
- `PROJECT-BRIEF.md` and `PROJECT-INDEX.md` updated: `brief 2834 tokens (target 3000), index 34564 tokens (target 36000)`.

---

### 2. Tests Run and Real Output

All new parity tests, changed boot tests, `daynight.mjs`, `shadows.mjs`, and `brief.mjs` passed after the final edit:

```text
>>> tests/tsl-grade.mjs
PASS tsl-grade: 24 colour/exposure pairs matched gradeGLSL() & grade() (maxDiff=2.22e-16), StandardNodeLibrary + mock-renderer verified.
>>> tests/tsl-sky.mjs
PASS tsl-sky: 4 times of day x 7 dome dirs + 600 stars matched dist/sky.js (domeDiff=1.78e-15, starDiff=0.00e+0).
>>> tests/tsl-shadows.mjs
PASS tsl-shadows: 392 (vBox, uv, opacity, depth) samples matched shadows.js BLOB_FRAGMENT (maxDiff=0.00e+0).
>>> tests/brief.mjs
brief tests passed: 237 modules listed, brief 2834 and index 34564 estimated tokens (budgets 3000 and 36000)
>>> tests/daynight.mjs
daynight tests passed
>>> tests/shadows.mjs
Shadows: a 90 m box (4.4 cm a texel) that moves in whole texels; fade 0 under 6 degrees and 1 over 12, the pass skipped for 118 of 1,440 minutes; moon shadows on; Low: one mesh of at most 48 patches (96 triangles, 1 draw call), none on High, indoors or at the horizon.
>>> tests/startup.mjs
Fresh save: creator, phone apps/controls/gigs, and multiplayer frame checks passed.
Existing save: gameplay, phone apps/controls/gigs, and multiplayer frame checks passed.
>>> tests/carry-game.mjs
Carry in the game loop: planks are held crosswise at chest height with both hands under them (nothing through the boards), a log is held up from underneath by the right hand (nothing through the bark, hand well away from the head), a hand lets go when the carry changes; picking up and putting down both bend the spine about 50 degrees and drop the hips 0.22 m, change hands at the bottom and stand up again.
>>> tests/carry-real.mjs
Carry through the real interaction (E beside a log or a stack, a few steps, stop): the log rests on the shoulder below the chin with the near hand on it, nothing through the bark; the planks are crosswise at chest height with both hands under them, nothing through the boards; measured walking and standing.
>>> tests/driving-game.mjs
Driving (the packaged game): E at the driver door gets in (refused while carrying), W S A D and Space drive the pickup out of the depot and down Works Lane, a building stops it, E (below 1 m/s) gets out at the driver's door, a walker cannot walk through it, and the saved pose is read back from the storage.
>>> tests/fuel-game.mjs
Refuelling (the packaged game, imperial): a real H press takes the diesel nozzle at the pump, the tank cap glows and says what the truck takes, F held fills in whole steps at exactly $4.20 a gallon, E never fills, letting go stops it, the wrong fuel is refused without money, the arm holds the nozzle, E hangs it up, walking past 3.5 m puts it back, the tank is saved.
```

---

### 3. What Could Not Be Verified

- **Real-GPU / browser shader compilation & pixel output:** Node has no WebGPU/WebGL2 device, so WGSL/GLSL backend compilation by `WebGPURenderer`, `InstancedMesh` star billboard `screenSize` pixel alignment, `InstancedBufferAttribute` `aBox` per-instance step-rate, `rangeFogFactor` depth interaction with `scene.fog`, and `blob-shadows` `polygonOffset` depth sorting could not be rendered or pixel-diffed here. (`gradeTSL` and `createSkyTSL` visual pixel parity was previously verified in the spike harness; `blob-shadows` TSL has not yet been rendered on a real GPU.)
- **Full `npm test` / packaged release:** `npm run release -- --force` and the full 296-test suite were not run because `dist/game.js`, `dist/index.html`, and `dist/releases/` were left untouched per task rules.

---

### 4. Exact Wiring Edits Needed in Shared / Protected Files (for T5 / Main Chat)

1. **`dist/game.js`** (lines `88`, `96`, `102–105`, `452`):
   - Import `{ WebGPURenderer, NodeMaterial }` from `'./vendor/three.webgpu.js'` and `* as TSL` from `'./vendor/three.tsl.js'` when `?webgpu=1` is active (or dynamically/top-level behind the flag until T5 flips the default).
   - At line `102`: construct `new WebGPURenderer({ canvas: $('world'), antialias: true, powerPreference: ... })` (falling back to WebGL2 via WebGPURenderer's built-in `WebGLBackend` or `forceWebGL` if `?webgl=1`), then `await renderer.init();` immediately before line `103`.
   - At line `105`: call `createSkyTSL({ THREE, TSL, NodeMaterial, scene, renderer, sun, hemi })` when using `WebGPURenderer` (instead of `createSky(...)`).
   - At line `452`: pass `{ tsl: { TSL, NodeMaterial } }` (or construct `createShadowsTSL`) when using `WebGPURenderer`.
2. **`dist/sky.js`** (lines `14–19`, `43–44`):
   - Keep `installGrade()` / `createSky()` for the WebGLRenderer fallback path; when `renderer.library?.addToneMapping` is present (WebGPURenderer path), delegate to `createSkyTSL({ THREE, TSL, NodeMaterial, scene, renderer, sun, hemi })` (or have `game.js` select `createSkyTSL`).
3. **`dist/daynight.js`**:
   - No edits strictly required (`GRADE` is already exported and imported by `dist/tsl-grade.js`). Optionally add a test/note cross-check between `grade()`, `gradeGLSL()`, and `tsl-grade.js` if desired.
4. **`dist/shadows.js`** (lines `11–17`, `32–44`, `77`):
   - In `r187`, `installShadowFade()` (lines `11–17`) is a no-op because `ShaderChunk.shadowmap_pars_fragment` already includes `shadowIntensity`; it can be deleted when WebGL1/pre-r166 support is dropped.
   - For the `WebGPURenderer` path in `createShadows()`, replace lines `37–44` (`geometry`, `aBox`, `ShaderMaterial`, `blobs`) with `createBlobMeshTSL({ THREE, TSL, NodeMaterial, fog: scene.fog, capacity: BLOB.capacity })` and update `uniforms.uOpacity.value = opacity` at line `77` (instead of `material.uniforms.uOpacity.value = opacity`).

---

### 5. Honest Confidence per Part

- **T1 (`dist/vendor/three.{webgpu,tsl}.js`, `mock-renderer.mjs`, `boot-game.mjs` + 5 mock tests, index budget):** **High** — `sharedCoreIdentity: true`, `brief.mjs` passes (`34,564 / 36,000` tokens), and all 6 mock-based tests + `daynight.mjs` pass.
- **`dist/tsl-grade.js` & `tests/tsl-grade.mjs`:** **High** — matches `gradeGLSL()` and `grade()` to `2.22e-16` across 24 colour/exposure pairs, registers into real `WGPU.StandardNodeLibrary`, and matches the spike's GPU-verified `gradeTSL`.
- **`dist/tsl-sky.js` & `tests/tsl-sky.mjs`:** **High** — matches `dist/sky.js` uniforms, star seed buffers (`0.00e+0`), and dome RGB across 4 times of day × 7 directions (`1.78e-15`), matching the spike's GPU-verified `createSkyTSL`.
- **`dist/tsl-shadows.js` & `tests/tsl-shadows.mjs`:** **Medium-High** — CPU math matches `BLOB_FRAGMENT` bit-for-bit (`0.00e+0` across 392 samples) and node construction succeeds with real `three.tsl.js`/`three.webgpu.js`, but `blob-shadows` TSL has not yet been rendered on a real GPU to verify `attribute('aBox')` instanced step-rate and `rangeFogFactor` + `polygonOffset` visually.
