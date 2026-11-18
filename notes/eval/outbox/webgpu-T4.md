michadr.

## WebGPU / TSL Stage T4 — Outbox Report

Ported the two hard material families (`dist/ground-shader.js` across all 11 ground kinds / all 8 `GD_DETAIL_KINDS`, and `dist/paint-shader.js` `vehicle-paint` + `vehicle-glass`) into dormant pure TSL factories (`dist/tsl-ground-kinds.js`, `dist/tsl-ground.js`, `dist/tsl-paint.js`) plus parity tests (`tests/tsl-ground.mjs`, `tests/tsl-paint.mjs`). Nothing in the live game or original files (`ground-shader.js`, `paint-shader.js`, `terrain.js`, `vehicle.js`, `world.js`, `game.js`) was modified.

---

### 1. Files Created or Changed (all UTF-8 without BOM)

**Dormant TSL factories (`dist/`):**
- `dist/tsl-ground-kinds.js` (new, `115` lines): `createGroundNoiseTSL(TSL)` (`gdHash`, `gdNoise`, `gdPebble`) and `buildGroundDetailTSL(kind, ...)` implementing all 8 `GD_DETAIL_KINDS` (`grass`, `farm`, `valley`, `forest`, `dirt` incl. `uGdGravel` + cracks, `plowed`, `paving`, `mud` incl. puddles + ridges/clods) plus no-op detail for `field`, `wheat`, `green`. Imports all constants from `./ground-rules.js`.
- `dist/tsl-ground.js` (new, `131` lines): `createGroundUniformsTSL({ TSL, wet, amount, skyHorizon })` and `makeGroundMaterialTSL(kind, { THREE, TSL, MeshStandardNodeMaterial, NodeMaterial, base, ... })` for all 11 `GROUND_KINDS`. Imports constants from `./ground-rules.js`, `GROUND_UNIFORMS`/`groundProgramKey`/`groundQualityHigh` from `./ground-shader.js`, and `SKY_HORIZON` from `./sky.js`. Includes rotated no-tile second sample, `DRY_KINDS` hue shift, 4×4 Bayer `screenCoordinate` discard inside `edgeBox`, `vertexColor()` inside `colorNode` before `gdTone`/`dryHue` for `valley`, Mikkelsen `dFdx(positionView)` height-bump `normalNode` (with `faceDirection` and degenerate-triangle guard), and `mud` `roughnessNode` + WGSL-safe Schlick Fresnel `emissiveNode` (shared `SKY_HORIZON`).
- `dist/tsl-paint.js` (new, `151` lines): `makePaintMaterialTSL`, `makeGlassMaterialTSL`, `setPaintUniformsTSL`, and `setLookUniformsTSL`. Imports `WEAR_TILE`, `CRACK_PLACE` from `./paint-shader.js`, `WEAR_PNG`, `CRACK_PNG` from `./damage-textures.js`, and `paintUniforms`, `colourOf`, `coloursOf` from `./paint.js`. Implements object-space triplanar `vPlane(positionLocal, varying(normalLocal))`, `pRgb2hsv`/`pHsv2rgb` hue-band recolour (`uPaint`, `uBand`, reactive `materialColor` for `flatbed`/`shortbed` swatch updates), multi-layer wear/hit damage (`uWear`, `uHit`, `uExt`, `uWearTex`), and front-facing windshield crack overlay (`uCrack`, `uCrackMap`, `uCrackTex`) with split `colorNode` + `opacityNode` so translucent `materialOpacity` is not multiplied over opaque crack lines. Note: `dist/paint-shader.js` itself has no bump/normal hook (`onBeforeCompile` only patches `#include <map_fragment>`), so `tsl-paint.js` matches it 1:1 with `colorNode` (+ `opacityNode` for glass).

**Tests & index:**
- `tests/tsl-ground.mjs` (new, `334` lines): real `three.webgpu.js` + `three.tsl.js` material checks for all 11 kinds (`High`/`Low`, `edgeBox`, `gravel`, `valley` `vertexColors`, `customProgramCacheKey`, unknown kind throw) + CPU-evaluating TSL adapter parity across 140 cases (`colorNode`, finite-difference `normalNode`, `roughnessNode`, `emissiveNode`, Bayer `Discard`).
- `tests/tsl-paint.mjs` (new, `228` lines): real `three.webgpu.js` + `three.tsl.js` material checks + CPU-evaluating TSL adapter parity across 3,528 paint cases (all 7 `PAINT` models × all swatches × 6 triplanar + diagonal normals × `wear` levels) and 81 glass cases (`default`, `shortbed`, `flatbed`, front/side normals, in/out bounds).
- `PROJECT-BRIEF.md` and `PROJECT-INDEX.md` regenerated via `npm run index`: `brief 2834` (target `3000`), `index 35883` (target `36000`).

---

### 2. Tests Run and Real Output

**Node tests (run after final edit):**
```text
PASS tsl-grade: 24 colour/exposure pairs matched gradeGLSL() & grade() (maxDiff=2.22e-16), StandardNodeLibrary + mock-renderer verified.
PASS tsl-sky: 4 times of day x 7 dome dirs + 600 stars matched dist/sky.js (domeDiff=1.78e-15, starDiff=0.00e+0).
PASS tsl-shadows: 392 (vBox, uv, opacity, depth) samples matched shadows.js BLOB_FRAGMENT (maxDiff=0.00e+0).
PASS tsl-materials: all 8 T3 NodeMaterial factories & CPU math parity checks matched GLSL sources.
PASS tsl-ground: all 11 ground kinds (140 cases) matched ground-shader.js (col=1.11e-16, nrm=7.38e-13, rgh=0.00e+0, emi=0.00e+0).
PASS tsl-paint: 3528 paint cases & 81 glass cases matched paint-shader.js (paintDiff=0.00e+0, glassDiff=0.00e+0).
brief tests passed: 249 modules listed, brief 2834 and index 35883 estimated tokens (budgets 3000 and 36000)
```

Related existing tests (`ground-shader.mjs`, `paint.mjs`):
```text
ground programs: 10
ground-shader: 58055 checks ok
Paint: worktruck 6 colours, flatbed 6 colours, shortbed 6 colours, offroad 6 colours, tractor_juff 6 colours, atv 6 colours, tractor_kidbi 6 colours, unique ids, valid shader numbers, the first colour is the model's own, unknown colours fall back.
```

**Scratch Edge CDP GPU (`WebGPUBackend`) & WebGL2 (`WebGLBackend`) pixel diff check** (`C:\Users\Michael\AppData\Local\Temp\eden-webgpu\verify-t4.mjs`, zero console errors or warnings (`"logs": []`), `640x400`, PNGs saved only in scratch `C:\Users\Michael\AppData\Local\Temp\eden-webgpu\screenshots\t4\`):

| Material | `WebGPUBackend` meanAbsDiff / maxDiff / >15 | `WebGLBackend` meanAbsDiff / maxDiff / >15 | `meanA` vs `meanB` |
|---|---|---|---|
| `ground_grass` | `0.866` / `15` / `6.713%` | `0.866` / `15` / `6.713%` | `81.02` vs `81.01` |
| `ground_farm` | `1.09` / `20` / `7.741%` | `1.09` / `20` / `7.74%` | `82.89` vs `82.89` |
| `ground_forest` | `1.145` / `45` / `7.644%` | `1.075` / `46` / `7.557%` | `83.78` vs `83.78` |
| `ground_dirt` | `1.269` / `37` / `9.238%` | `0.868` / `16` / `6.806%` | `80.85` vs `80.84` |
| `ground_mud` | `0.731` / `59` / `4.552%` | `0.708` / `59` / `4.532%` | `73.34` vs `73.33` |
| `ground_field` | `0.852` / `16` / `6.666%` | `0.852` / `16` / `6.666%` | `81.30` vs `81.29` |
| `ground_plowed` | `0.873` / `22` / `6.502%` | `0.84` / `22` / `6.489%` | `80.77` vs `80.76` |
| `ground_wheat` | `0.852` / `16` / `6.666%` | `0.852` / `16` / `6.666%` | `81.30` vs `81.29` |
| `ground_green` | `0.852` / `16` / `6.666%` | `0.852` / `16` / `6.666%` | `81.30` vs `81.29` |
| `ground_paving` | `0.874` / `15` / `6.768%` | `0.874` / `15` / `6.769%` | `80.94` vs `80.93` |
| `ground_valley` | `0.463` / `3` / `0%` | `0.463` / `3` / `0%` | `104.81` vs `104.91` |
| `ground_dirt-gravel` | `1.916` / `31` / `12.386%` | `0.832` / `17` / `6.419%` | `79.00` vs `78.99` |
| `vehicle_paint` | `0.003` / `4` / `0%` | `0.001` / `1` / `0%` | `137.03` vs `137.03` |
| `vehicle_glass` | `2.157` / `22` / `14.608%` | `2.157` / `22` / `14.608%` | `144.64` vs `146.80` |

Note on `vehicle_glass` (`2.157` mean): `WebGPURenderer` blends transparent surfaces in its linear `HalfFloatType` buffer before sRGB conversion, whereas `WebGLRenderer` blends in the sRGB backbuffer (`meanA 144.64` vs `meanB 146.80`). Visually inspected `ground_mud`, `ground_dirt-gravel`, `vehicle_paint`, and `vehicle_glass` PNGs: Bayer edges, puddles, gravel pebbles, red paint recolour + wear scratches/primer/flakes, and windshield spider-web crack match GLSL.

---

### 3. What Could Not Be Verified

- **Full game-loop & `npm test`:** `npm run release -- --force` and the full test suite were not run because all live files remain untouched.
- **Real game models & streaming world:** Tested against synthetic planes/boxes in `t4-lab.html`, not yet against real glTF vehicle meshes (`worktruck`, `flatbed`, `shortbed`, `offroad`, `tractor_juff`, `atv`, `tractor_kidbi`, including `shortbed`/`flatbed` direct-paint `userData.paint` meshes and `vehicle-studio.html` if used) or full-world ground layer `polygonOffset` sorting + `gradeTSL` tone mapping together.
- **Low-quality ground mode in Edge CDP:** `isHigh: false` ground materials were verified in Node (`tests/tsl-ground.mjs`) and via `three.webgpu.js`/`three.tsl.js` node construction, not separately rendered in Edge CDP.

---

### 4. Exact T5 Wiring Edits Needed (per file & call site)

All T4 factories take `{ THREE, TSL, MeshStandardNodeMaterial, ... }`. Behind `?webgpu=1` (with `WebGL2` fallback via `WebGPURenderer`'s `WebGLBackend`), wire as follows:

1. **Ground shader (`dist/world.js`, `dist/game.js`, `dist/ground-shader.js`):**
   - `dist/world.js` lines `3`, `228`, `321`, `323` (and `createWorld(scene, options)`):
     - Import `{ createGroundUniformsTSL, makeGroundMaterialTSL } from './tsl-ground.js'`.
     - Pass `tsl` (`{ TSL, MeshStandardNodeMaterial }`) into `createWorld(scene, { ..., tsl = null } = {})`, and build one `const gdShared = tsl ? createGroundUniformsTSL({ TSL: tsl.TSL }) : null;` per world.
     - In `groundLayer(material, y)` (line `228`): when `tsl && m.userData.groundKind`, replace `patchGround(m, m.userData.groundKind)` with `makeGroundMaterialTSL(m.userData.groundKind, { THREE, TSL: tsl.TSL, MeshStandardNodeMaterial: tsl.MeshStandardNodeMaterial, base: m, shared: gdShared })` (preserving `polygonOffset`, `polygonOffsetFactor`, `polygonOffsetUnits`, `groundEdge`, `groundGravel`, `vertexColors`).
     - At lines `321` and `323` (`dirtTrack` and `gravel` ribbons): `groundLayer(material, y)` at line `318` runs on `m.userData.groundKind`, so either keep `m.userData.groundKind = 'dirt'` before `groundLayer` or have `patchGround(mat, kind, tslCtx)` delegate to `makeGroundMaterialTSL` when `tslCtx` is present.
   - `dist/game.js` lines `2`, `1177` (`applyQuality`):
     - `setGroundQuality(high)` already toggles `groundQualityHigh()`; for TSL materials in `applyQuality(value)`, rebuild or swap `Low`/`High` ground materials if quality changes at runtime (`groundLayer` / `tsl-ground` reads `isHigh` at graph build time, unlike `onBeforeCompile` recompile on `needsUpdate = true`), and expose `setGroundWet(v)` to also update `gdShared.uGdWet.value` when weather hooks land.

2. **Vehicle paint & glass (`dist/paint-shader.js`, `dist/driving.js`, `dist/customer-truck.js`, `dist/menu-scene.js`):**
   - Call sites of `applyPaint`/`applyLook`:
     - `dist/driving.js` lines `13`, `54`, `154`, `187`
     - `dist/customer-truck.js` lines `6`, `20`
     - `dist/menu-scene.js` lines `6`, `79`
   - Cleanest T5 switch in `dist/paint-shader.js` (lines `21–73`):
     - Keep `applyPaint(mesh, model, colourId, tsl = null)` and `applyLook(mesh, look, model, ext, tsl = null)` as the single entry points (or set a module/scene-level `tsl` context on boot when `WebGPURenderer` is active) so `driving.js`, `customer-truck.js`, and `menu-scene.js` only need to pass `{ tsl }` (or nothing if `paint-shader.js` reads an active TSL helper).
     - When `tsl` is active in `lookParts(mesh)` / `patchPaint(m)` / `patchGlass(m)`: replace each mesh's paint material with `makePaintMaterialTSL({ THREE, TSL: tsl.TSL, MeshStandardNodeMaterial: tsl.MeshStandardNodeMaterial, base: m }).material` (updating `mesh.material` or `mesh.userData.paint` on `shortbed`/`flatbed`) and each `/glass$/` child mesh's material with `makeGlassMaterialTSL({ THREE, TSL: tsl.TSL, MeshStandardNodeMaterial: tsl.MeshStandardNodeMaterial, base: m, model }).material`.
     - Because `makePaintMaterialTSL` and `makeGlassMaterialTSL` store the exact same uniform objects on `material.userData.paint` (`uPaint`, `uBand`, `uWear`, `uHit`, `uExt`) and `material.userData.crack` (`uCrack`, `uCrackMap`), `applyPaint` (lines `63–65`) and `applyLook` (lines `69–72`) work unchanged once the materials are swapped to `NodeMaterial`s (note `direct` models `flatbed`/`shortbed` call `mesh.userData.paint.color.set(c.swatch)`, which works reactively through `TSL.materialColor`).

---

### 5. Honest Confidence per Part

- **`dist/tsl-ground.js` & `dist/tsl-ground-kinds.js`:** **High** — all 11 ground kinds (all 8 detail kinds + `field`/`wheat`/`green`, `gravel`, `edgeBox`, `valley` `vertexColors`, Mikkelsen bump normal, mud roughness + sky Fresnel sheen) match GLSL to `<= 7.38e-13` in Node and `meanAbsDiff 0.463–1.916` (`< 3.0`) on both `WebGPUBackend` and `WebGLBackend` in Edge CDP with zero errors. (`isHigh: false` Low mode was verified in Node, not rendered separately in Edge CDP.)
- **`dist/tsl-paint.js` (`vehicle-paint` & `vehicle-glass`):** **High** — matches GLSL to `0.00e+0` across 3,528 paint cases and 81 glass cases in Node, and renders in Edge CDP at `meanAbsDiff 0.003` (`WebGPUBackend`) / `0.001` (`WebGLBackend`) for paint and `2.157` (`< 3.0`, linear vs sRGB alpha blend) for cracked glass; real glTF vehicle meshes await T5 wiring.
