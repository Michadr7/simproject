michadr.

Cross-system diagnosis of the `C11`/`C14` downtown storefront geometry & glazing findings plus `I6` / `E-I2` draw-call and shader warm-up budget (with the smallest safe fixes applied in `0.36.4`).

### 1. Downtown `C11` / `C14` Doors (`3.075 m`) & Opaque Matte Panes

- **Door height root cause:**
  - All 9 `downtown-*` props in [dist/props-assets-downtown.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/props-assets-downtown.js) (`downtown-b` on `C11`, `downtown-j` on `C13`, `downtown-k` on `C14`, `downtown-n` on `C15`, `downtown-m` on `C16`, `downtown-gazette` on `C17`, `downtown-town-hall` on `C18`, `downtown-clinic` on `C19`, `downtown-clothes` on `C20`) export native `door.height: 2.05`.
  - [dist/world.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/world.js#L461) applied `if (l.prop?.startsWith('downtown-')) mesh.scale.set(1, 1.5, 1);`, inflating every `2.05 m` commercial door to `2.05 × 1.5 = 3.075 m` and shifting roofline windows upward while `DOWNTOWN_SIGNS` (`dist/downtown.js:77-78`) still read unscaled `PROPS[l.prop].height`.
  - **Fix applied (`dist/world.js`, `692` lines):** removed the `1.5` Y scale override on line `461` so all 9 `I4`/`I5` downtown facades render at their authored heights (`4.36–17.75 m`) and `2.05 m` door scale matching `DOWNTOWN_SIGNS`.
  - **Risk:** low; `tests/downtown.mjs` (`23322` placed triangles) and `tests/props.mjs` pass after removal (colliders use unscaled `info.colliders` already).
- **Matte blue window panes root cause:**
  - All `downtown-*` assets share 1 indexed PNG palette (`2068` bytes, `256` `PLTE` entries, `20` matching `isGlass` in `night-lights-rules.js:70`) on a single mesh (no separate reflective glazing submesh).
  - [dist/props.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/props.js#L64-L66) constructs one `MeshStandardMaterial({map, roughness: .9, side: THREE.DoubleSide})` per placed building.
  - [dist/night-lights.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/night-lights.js#L94-L103) set `emissiveMap` and `metalnessMap` with `metalness: .45` at load (`attach()`), leaving `roughness` uniformly `.9` across both brick walls and blue window texels, and [dist/game.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/game.js) does not attach a `PMREMGenerator` `scene.environment` IBL cubemap.
  - **Fix applied (`dist/night-lights.js`, `172` lines):** added cached `roughnessMaskTexture()` writing `38/255` (`roughness ≈ 0.15`, glossy specular sheen) on `isGlass` window texels and `230/255` (`roughness ≈ 0.90`, matte walls) elsewhere, binding `b.material.roughnessMap = roughTex` and `roughness: 1` (with `metalness: .35`) inside `attach()` (`0` extra draw calls, `0` geometry splits; tests with stubbed masks without `image.data` skip safely).
  - **Remaining optional improvement & risk:** without `scene.environment` IBL, specular sheen reflects directional sunlight/sky highlights rather than building silhouettes; adding a low-res procedural sky `PMREMGenerator` environment would deepen mirror reflections but increases WebGPU shader compile cost across all PBR materials.

### 2. Draw-Call, Chunk-Mesh & Index Budget Audit (`I6` + `E-I2`)

- **Measured streaming world baseline (`createWorld(..., {streaming:true})` after ensuring sample points):**
  - `Ironwood (30,-95)` chunk `4:11`: `2` `chunkMeshes`
  - `Blackstone-Lake (700,-550)` chunk `11:6`: `2` `chunkMeshes`
  - `Blackstone-Pass (760,-950)` chunk `12:2`: `0` `chunkMeshes`
  - `Kaspian-Bay (310,380)` chunk `7:15`: `2` `chunkMeshes`
  - `Eden-Gate (716,-214)` chunk `11:9`: `0` `chunkMeshes`
  - `Eden-Halls (860,-215)` chunk `13:9`: `0` `chunkMeshes`
  - Scene totals: `81` individual `prop-*` meshes, `84` `InstancedMesh`es, `48` loaded `chunkMeshes`.
- **Storefront details (`I6`):**
  - `DOWNTOWN_SIGNS` (`dist/downtown.js:76-81`, `15` signs) already batches into `1` canvas-atlas mesh in `dist/world.js:533-552`.
  - `DOWNTOWN_DETAILS` (`dist/downtown.js:57-62`, `4` parasols) batches per prop via `createPropInstances`; note the `AWNINGS` lookup (`downtown.js:44-48`) is defined but not yet appended to `DOWNTOWN_DETAILS` (only adds `+4` `InstancedMesh` draw calls when enabled).
- **Bottlenecks & `E-I2` recommendations:**
  1. Per-landmark `createProp()` clones a fresh `MeshStandardMaterial` in `dist/props.js:66`, and `50` `GLASS_PROPS` landmarks currently mutate material maps + `needsUpdate = true` async when textures decode (`dist/night-lights.js:85-103`), triggering WebGPU/WebGL shader compiles outside `warmWorld()`.
  2. For **`E-I2`**, batch repeated Eden halls (`eden-hall-a..d`) and yard clutter through `createPropInstances` (or merged chunk geometry) using **1 shared palette texture + 1 cached glass mask pair** rather than individual `createProp()` instances so `Eden-Halls` (`13:9`) stays `<= 4` draw calls/chunk.
  3. **Index budget:** `PROJECT-INDEX.md` is currently `36752 / 37000` tokens (`248` tokens headroom); future `E-I2`..`WJ` work should keep pure modules cohesive or trim header bloat rather than adding many tiny files.

### Confidence

- **High:** `world.js` `1.5` Y-scale root cause (`3.075 m` doors), `props.js` / `night-lights.js` single-mesh rough-mask behavior, and measured chunk/mesh counts.
- **Medium:** visual contrast of the `roughness ≈ 0.15` glass sheen on WebGPU/WebGL without `PMREMGenerator` IBL (checked in upcoming browser pass).
