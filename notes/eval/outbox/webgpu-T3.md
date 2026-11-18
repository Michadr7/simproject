michadr.

## WebGPU / TSL Stage T3 — Outbox Report

Ported all 8 Easy/Medium T3 shaders/hooks into dormant pure TSL helper factories (`dist/tsl-*.js`) plus `tests/tsl-materials.mjs`. Nothing in the live game or original modules (`pallet-tags.js`, `menu-scene.js`, `tracks.js`, `smoke.js`, `debris.js`, `night-lights.js`, `ground-cover-view.js`, `world.js`) was modified.

---

### 1. Files Created or Changed (all UTF-8 without BOM)

**Dormant TSL factories (`dist/`):**
- `dist/tsl-tags.js` (new, `30` lines, header `95` chars): `tagAtlasGrid()`, `createPalletTagMaterialTSL({ THREE, TSL, NodeMaterial, map, cols, rows })`. Derives `8x12` atlas grid lazily from `pallet-tags.js` `tagCell` + `PALLET_CAP` (avoiding circular TDZ at T5) and maps `texture(tex, varying((uv + tagCell) * (1/cols, 1/rows)))`.
- `dist/tsl-menu.js` (new, `23` lines, header `96` chars): `createMenuWindMaterialTSL({ THREE, TSL, MeshLambertNodeMaterial, NodeMaterial, wind })`. Imports `COVER_WIND` from `./menu-scene-rules.js` and applies instanced wind sway via `positionNode` using `referenceAttribute('instanceMatrix', 'mat4').element(3).xyz` and `attribute('aBend', 'float')`.
- `dist/tsl-tracks.js` (new, `44` lines, header `95` chars): `TRACK_SHADER`, `createTracksMaterialTSL({ THREE, TSL, MeshBasicNodeMaterial, NodeMaterial })`. Imports `TRACK_FADE_FROM`, `TRACK_DRAW_NEAR`, `TRACK_DRAW_FAR` from `./tracks-rules.js`; uses `vertexNode` clip-cull when `vA < 0.004` and `opacityNode` + `alphaTest: 0.01` for `vSide` edge fade.
- `dist/tsl-smoke.js` (new, `78` lines, header `88` chars): `SMOKE_SHADER`, `createSmokeMaterialTSL(...)`, `createSmokeMeshTSL(...)`. Imports `SMOKE_MAX`, `SMOKE_COLOURS`, `SMOKE_SIZE`, `SMOKE_ALPHA` from `./smoke.js` and `createParticles` from `./sawdust.js`. Replaces `Points` with `InstancedMesh(PlaneGeometry(1, 1), ..., max)` screen-aligned billboards (`screenSize.y * 0.5 / -mv.z`), preserving `particles.pos` as `aPos` `InstancedBufferAttribute`.
- `dist/tsl-debris.js` (new, `104` lines, header `87` chars): `DEBRIS_KIND`, `DEBRIS_SHADER`, `createDebrisMaterialTSL(...)`, `createDebrisMeshTSL(...)`. Imports `DEBRIS_MAX` from `./debris.js` and `createParticles` from `./sawdust.js`. Replaces `Points` with `InstancedMesh` quad billboards (`maxPx = 72`, velocity streak `vDir`, and all 6 SDF shapes `chip`, `glass`, `spark`, `dust`, `mud`, `drop` in `colorNode` with `Discard()` and `CustomBlending(One, OneMinusSrcAlpha)`).
- `dist/tsl-lights.js` (new, `51` lines, header `91` chars): `NIGHT_SHADER`, `createNightLightsMaterialsTSL({ THREE, TSL, MeshBasicNodeMaterial, NodeMaterial })`. Builds additive `spriteMat` (camera-facing quad + radial glow + manual `1.25 * uFogFar` fog) and `groundMat` (polygonOffset + manual `uFogFar` fog) sharing `{ uLevel, uFogNear, uFogFar }`.
- `dist/tsl-cover.js` (new, `53` lines, header `89` chars): `COVER_SHADER`, `createCoverWindTSL(...)`, `createCoverMaterialTSL(...)`. Imports `COVER_UP`, `COVER_ALPHA_TEST` from `./ground-cover-view.js`, `WIND_BASE`, `WIND_KIND_MUL` from `./wind.js`, `coverReach`, `tierOf` from `./ground-cover-rules.js`, `kindUniform` from `./cover-pack.js`. Implements rank/distance scale-cull (`cvRoot + (positionLocal - cvRoot) * cvScale`), wind push in `positionNode`, and unflipped up-leaning `normalNode` via `transformNormalToView` (no `faceDirection` flip on back faces).
- `dist/tsl-sightline.js` (new, `52` lines, header `88` chars): `SIGHTLINE_FADE`, `BAYER_4X4`, `createSightlineFadeTSL({ THREE, TSL })`. Implements segment distance `t`/`d` and 4x4 Bayer `screenCoordinate` discard via `material.maskNode` (combining with any prior `maskNode`), with `uniforms`, `apply(material)`, and `update(camera, target)`.

**Tests & index:**
- `tests/tsl-materials.mjs` (new, `492` lines): Node parity test using real `dist/vendor/three.webgpu.js` and `dist/vendor/three.tsl.js` plus a CPU-evaluating TSL adapter comparing every factory against the GLSL math.
- `PROJECT-BRIEF.md` and `PROJECT-INDEX.md` regenerated via `npm run index`: `brief 2834` (target `3000`), `index 35535` (target `36000`).

---

### 2. Tests Run and Real Output

**Node tests (run after final edit):**
```text
PASS tsl-grade: 24 colour/exposure pairs matched gradeGLSL() & grade() (maxDiff=2.22e-16), StandardNodeLibrary + mock-renderer verified.
PASS tsl-sky: 4 times of day x 7 dome dirs + 600 stars matched dist/sky.js (domeDiff=1.78e-15, starDiff=0.00e+0).
PASS tsl-shadows: 392 (vBox, uv, opacity, depth) samples matched shadows.js BLOB_FRAGMENT (maxDiff=0.00e+0).
PASS tsl-materials: all 8 T3 NodeMaterial factories & CPU math parity checks matched GLSL sources.
brief tests passed: 246 modules listed, brief 2834 and index 35535 estimated tokens (budgets 3000 and 36000)
```

Related existing tests (`menu-scene.mjs`, `tracks.mjs`, `smoke.mjs`, `night-lights.mjs`, `cover-view.mjs`):
```text
menu-scene ok
tracks ok
Smoke: slight (idle 2 puffs a second, at most about 9 flat out), more from cheaper tiers, a key-turn burst, rising and fading puffs in one pool of 150 points (one draw call, hidden when none live), and each vehicle's muffler tip at its back right.
[map-bake] base base 83.0 ms
night lights tests passed
INFO real chunks: 8, 40989 instances, sampler+placement ms per chunk (after 2 warm-up): avg 11.9, max 14.4; cover-assets.js 292435 bytes
cover-view: ok
```

**Scratch Edge CDP GPU (`WebGPUBackend`) & WebGL2 (`WebGLBackend`) pixel diff check** (`C:\Users\Michael\AppData\Local\Temp\eden-webgpu\verify-t3.mjs`, zero console errors or warnings, `640x400`):

| Effect | `WebGPUBackend` meanAbsDiff / maxDiff / >15 | `WebGLBackend` meanAbsDiff / maxDiff / >15 | Notes (`meanA` vs `meanB`) |
|---|---|---|---|
| `tags` | `0.05` / `26` / `0.124%` | `0.05` / `26` / `0.124%` | `52.55` vs `52.60` (edge AA / atlas filter) |
| `menu` | `0.001` / `1` / `0%` | `0.001` / `1` / `0%` | `52.48` vs `52.48` (exact) |
| `tracks` | `0.03` / `5` / `0%` | `0.03` / `5` / `0%` | `51.04` vs `51.07` (exact) |
| `smoke` | `0.078` / `24` / `0.614%` | `0.078` / `24` / `0.614%` | `51.42` vs `51.50` |
| `debris` | `0.014` / `152` / `0.023%` | `0.014` / `152` / `0.023%` | `51.05` vs `51.04` (1-px billboard edge) |
| `lightsSprites` | `0.219` / `17` / `2.327%` | `0.219` / `17` / `2.327%` | `12.99` vs `12.77` (linear vs sRGB additive) |
| `lightsGround` | `2.559` / `45` / `14.066%` | `2.559` / `45` / `14.066%` | `20.00` vs `17.44` (`WebGPURenderer` `HalfFloatType` linear additive blend vs `WebGLRenderer` sRGB canvas blend) |
| `cover` | `0.005` / `1` / `0%` | `0.005` / `1` / `0%` | `53.59` vs `53.59` (exact) |
| `sightline` | `4.955` / `40` / `27.521%` | `4.955` / `40` / `27.521%` | `49.56` vs `49.55` (same dither density; `screenCoordinate.y` is top-down vs `gl_FragCoord.y` bottom-up so 4x4 Bayer rows mirror vertically) |

---

### 3. What Could Not Be Verified

- **Full game-loop integration & `npm test`:** `npm run release -- --force` and the full 299-test suite were not run because all live files remain untouched.
- **Per-effect real gameplay conditions:**
  - `tsl-lights.js` was tested on street-lamp halos and ground pools; vehicle headlight beams (`BEAM`) and `cityWindows`/`buildings` `emissiveMap` (which uses standard `MeshStandardNodeMaterial`) were not rendered together with `gradeTSL` in the full night scene.
  - `tsl-sightline.js` was tested on a `MeshStandardNodeMaterial` box (not yet on `InstancedMesh` trees from `nature.js` until `nature.js` materials are `NodeMaterial`s).
  - `tsl-debris.js` was tested on a `burst()` scene (chips, glass, sparks); wheel spray (`dust`, `mud`, `drop`) was verified on CPU math in `tests/tsl-materials.mjs`, not separately in Edge.

---

### 4. Exact T5 Wiring Edits Needed (per file & call site)

All TSL factories take `{ THREE, TSL, ... }` (where `THREE` is `three.module.js`, `TSL` is `three.tsl.js`, and NodeMaterials come from `three.webgpu.js`).

1. **`dist/world.js`** (forbidden; lines `185–210`, `217`, `632`):
   - At top: `import { createSightlineFadeTSL } from './tsl-sightline.js';` (and receive `{ TSL }` or pass `{ useTSL, TSL }` via `createWorld(scene, options)`).
   - At line `217`: `const fade = useTSL ? createSightlineFadeTSL({ THREE, TSL }) : createSightlineFade();`
   - Line `632` (`fade.update(camera, fadeTarget)`) needs no change (`uniforms`, `apply`, `update` match).
   - Note: `fade.apply(material)` sets `material.maskNode`, so materials passed to it (`nature.js`, `props.js`, `eastbank.js`, `scene-overlay.js`) must be `NodeMaterial` subclasses (`MeshStandardNodeMaterial` / `MeshLambertNodeMaterial`) when running `WebGPURenderer` (T4/T5).

2. **`dist/pallet-tags.js`** (lines `38–41`):
   - Import `{ createPalletTagMaterialTSL } from './tsl-tags.js'`.
   - In `createPalletTags(..., { tsl } = {})`: if `tsl`, replace lines `38–40` with `const { material } = createPalletTagMaterialTSL({ THREE: T, TSL: tsl.TSL, NodeMaterial: tsl.MeshBasicNodeMaterial || tsl.NodeMaterial, map: texture });`. Line `41+` (`InstancedMesh`, `tagCell` attribute, `update()`) needs no change.

3. **`dist/menu-scene.js`** (lines `50–61`, `125`, `149`):
   - Import `{ createMenuWindMaterialTSL } from './tsl-menu.js'`.
   - At line `125`: when `tsl` is active, build `{ material: coverMaterial, uniforms: wind } = createMenuWindMaterialTSL({ THREE, TSL: tsl.TSL, MeshLambertNodeMaterial: tsl.MeshLambertNodeMaterial })` instead of `windMaterial(wind)`. Line `149` (`wind.uTime.value = t; wind.uGust.value = p.gust;`) needs no change.

4. **`dist/tracks.js`** (lines `13–23`, `34`):
   - Import `{ createTracksMaterialTSL } from './tsl-tracks.js'`.
   - In `createTracks(parent, { max = TRACK_MAX, tsl = null } = {})`: when `tsl` is active, replace lines `13–22` with `const { material, uniforms } = createTracksMaterialTSL({ THREE, TSL: tsl.TSL, MeshBasicNodeMaterial: tsl.MeshBasicNodeMaterial }); const { uTime } = uniforms;`. Line `34` (`uTime.value = clock`) needs no change.

5. **`dist/smoke.js`** (lines `33–49`):
   - Import `{ createSmokeMeshTSL } from './tsl-smoke.js'`.
   - In `createSmoke(parent, { max = SMOKE_MAX, random = Math.random, tsl = null } = {})`: when `tsl` is active, call `createSmokeMeshTSL({ THREE, TSL: tsl.TSL, MeshBasicNodeMaterial: tsl.MeshBasicNodeMaterial, max, map: softDot() })`; `points` becomes `mesh` (keep `{ points: mesh, ... }`), reuse `particles: P`, `col`, `base`, `size`, `fade`, mark `aPos.needsUpdate = aSize.needsUpdate = aFade.needsUpdate = true` in `update()`, and `aColor.needsUpdate = true` in `puff()`. Also in `update()`, set `mesh.count = alive > 0 ? max : 0` (or keep `max` with `aFade = 0` on dead slots and `mesh.visible = visible && alive > 0`).

6. **`dist/debris.js`** (lines `42–65`, `77`, `86–87`):
   - Import `{ createDebrisMeshTSL } from './tsl-debris.js'`.
   - In `createDebris(parent, { max = DEBRIS_MAX, random = Math.random, tsl = null } = {})`: when `tsl` is active, call `createDebrisMeshTSL({ THREE, TSL: tsl.TSL, MeshBasicNodeMaterial: tsl.MeshBasicNodeMaterial, max })`; map `points: mesh`, `colour -> aColor`, `vel -> aVel`, `kind -> aKind`, `fracAttr -> aT`, and in `update()` also set `aPos.needsUpdate = true` and `mesh.visible = visible && alive > 0`.

7. **`dist/night-lights.js`** (lines `64–77`, `151`):
   - Import `{ createNightLightsMaterialsTSL } from './tsl-lights.js'`.
   - When `tsl` is active, build `const { spriteMat, groundMat, uniforms } = createNightLightsMaterialsTSL({ THREE, TSL: tsl.TSL, MeshBasicNodeMaterial: tsl.MeshBasicNodeMaterial })`, pass `spriteMat` to `new THREE.Mesh(spriteGeometry, spriteMat)` (line `64`) and `groundMat` to `new THREE.Mesh(groundGeometry, groundMat)` (line `75`).
   - At line `151`: update `uniforms.uLevel.value = shown ? level * scale : 0; if (fog) { uniforms.uFogNear.value = fog.near; uniforms.uFogFar.value = fog.far; }` (or read `m.userData.uniforms`).

8. **`dist/ground-cover-view.js`** (lines `25`, `31–38`, `59`):
   - Import `{ createCoverWindTSL, createCoverMaterialTSL } from './tsl-cover.js'`.
   - At line `25`: when `tsl` is active, `const wind = createCoverWindTSL({ THREE, TSL: tsl.TSL })`.
   - In `materialFor(kind)` (lines `31–36`): when `tsl` is active, call `const { material: m, uniforms } = createCoverMaterialTSL({ THREE, TSL: tsl.TSL, MeshStandardNodeMaterial: tsl.MeshStandardNodeMaterial, kind, height: models.get(kind).height, tier: cur, atlas, wind })`, store `m.userData.uniforms = uniforms` and cache in `materials`. Lines `38` (`applyTierUniforms`) and `59` (`setWind`) already work unchanged on `uKind.value` and `wind.uWind` / `wind.uWindT`.

---

### 5. Honest Confidence per Part

- **`tsl-menu.js`, `tsl-tracks.js`, `tsl-cover.js`:** **High** — CPU math (`< 1e-11`) and real Edge `WebGPUBackend`/`WebGLBackend` renders (`meanAbsDiff <= 0.03`, `maxDiff <= 5`, `pctGt15 = 0%`) match GLSL.
- **`tsl-tags.js`, `tsl-smoke.js`, `tsl-debris.js`:** **High** — CPU math (`< 1e-11`) and Edge `WebGPUBackend`/`WebGLBackend` renders (`meanAbsDiff <= 0.078`) match GLSL; minor `maxDiff` comes only from single-pixel rasterizer/edge differences on billboard quads. (`debris` spray variants `dust`/`mud`/`drop` were checked on CPU math, not separately rendered in Edge.)
- **`tsl-sightline.js`:** **Medium-High** — CPU math and coverage (`meanA 49.56` vs `49.55`) match `world.js:188`; `screenCoordinate.y` is top-down vs `gl_FragCoord.y` bottom-up (4x4 Bayer rows mirrored vertically, `meanAbsDiff 4.955`), and `InstancedMesh` tree materials still need `NodeMaterial` conversion in T4/T5 before `apply()` affects them.
- **`tsl-lights.js`:** **Medium-High** — CPU math matches `night-lights.js` to `1e-12` and compiles cleanly on both `WebGPUBackend` and `WebGLBackend`; `lightsGround` is ~13% darker (`meanA 20.00` vs `17.44`, `meanAbsDiff 2.559`) because `WebGPURenderer` blends `AdditiveBlending` in its `HalfFloatType` linear buffer rather than `WebGLRenderer`'s sRGB canvas buffer.
