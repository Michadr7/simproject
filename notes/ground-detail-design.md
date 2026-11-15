# Ground detail: design (GD, 2026-11-15, Opus)

Design only. Nothing is built. Goal (user): real-looking grass, mud and similar ground instead of flat textures. Style stays the game's: low-poly, flat colour, soft stylised light (Firewatch / Valheim feel), readable at 10 to 30 m, not photoreal. Draw calls are not the worry: heavy parts switch off on lower quality. Later addition (user): crops are farmed, so a combine header cutting a field must show (section 7).

## 0. What exists today (checked)
- **Ground meshes** (`dist/world.js` 215-268): two world planes (`ground-far` y -.09, `ground-base` y -.082, flat `#8a9a7c`, MeshStandardMaterial roughness .95), zone planes (farm, forest, y -.074), field planes (plowed, wheat, green, y -.069), mud planes (`mud-<id>`, y -.064, TR3), dirt ribbons, river valley (vertex colours), hills (2 m grids). Each plane is a hard rectangle with a 256 px canvas texture (`groundTexture(kind)`, specks and stripes) tiled every 4 to 7 m; `groundLayer()` gives each layer a polygon offset by rank. Roads, driveways and paths are merged per 100 m chunk (`groundChunk`).
- **Surface mask** (`dist/terrain.js`): 0.5 m cells, SURFACE ids 1..15 (GRASS 1 ... WHEAT 9, PLOWED 10, GREEN 11, MUD 14, GRAVEL 15). `chunks.js maskTile(i,j)` builds one chunk's 200 x 200 tile; `chunks-view.js` keeps it as `c.tile` while the chunk is loaded and fires `on('build'|'dispose')`. Ring 2 loaded, keep ring 3, one dispose per frame.
- **Light**: sky.js day/night rig drives the hemisphere and the one sun/moon light; fog 65 to 155 m; scenery culled at about 158 m. Rule from the visual overhaul: no light count or tone-mapping change after load (recompiles).
- **Quality** (`game.js:879 applyQuality`): High = pixel ratio 1.6 + shadows; Low = ratio 1, no shadows. No Medium.
- **Wind**: no tree wind in the game. The menu has ground cover (`menu-scene-rules.js`: `MENU_COVER` 1500 grass + 70 ferns, `coverShape`, `COVER_WIND`, `coverBend`; 2 draw calls, wind in the vertex shader, program key 'menu-cover'). Reuse it.
- **TR5 tracks** (`tracks.js`, `tracks-rules.js`, in progress): one pooled mesh of 1024 quads, aInfo (birth, life, alpha, side), `TRACK_STEP` .6 m, `stepWheel`, drawn to 70/90 m. GD reads it, never edits its rules.

## 1. Ground shader (no extra draw calls)
One new module `dist/ground-shader.js`: `patchGround(material, kind)` adds an `onBeforeCompile` to each existing ground material (world.js calls it where it builds them: one call per material, additive). Program keys: one per kind (`customProgramCacheKey` 'ground-'+kind), at most 10. Everything is a function of world x,z (a varying), so it is seamless across planes and chunks and needs no new texture fetch except where said.

**1a. Break-up and macro variation** (all kinds)
- Two octaves of value noise on world x,z: `GD_MACRO_SCALE` 1/38 m (large patches of lighter/darker, drier/greener), `GD_MESO_SCALE` 1/6 m (clumps). Colour = base x mix(`GD_DARK` .82, `GD_LIGHT` 1.12, macro) with a hue nudge toward `GD_DRY_TINT` `#a39a62` by `GD_DRY_AMOUNT` .25 x macro (grass and farm only). This is the "colour map / macro variation multiplied onto albedo" idea from Terrain3D.
- Kill tiling of the canvas textures with the two-sample offset trick (Quilez technique 3 as in the godotshaders `textureNoTile`): 2 fetches instead of 1, offset cells from the same macro noise. `GD_NOTILE` on/off per tier.
- Distance: detail contrast fades to the plain macro colour between `GD_DETAIL_NEAR` 25 m and `GD_DETAIL_FAR` 60 m (stops shimmer, and fog takes over at 65 m).

**1b. Soft borders instead of rectangles** (mud, fields, farm/forest zone grounds; roads keep crisp edges)
- Each overlay plane knows its own rectangle (uv 0..1 times its size), so distance to its edge in metres is free. Edge mask = smoothstep(0, `GD_EDGE_W`, edgeDist + noise(x,z) x `GD_EDGE_JITTER`). Below the mask the fragment is discarded with a 4x4 Bayer dither (the same `fadeBayer` already in world.js), so no transparency sorting and no new draw order. Defaults: mud `GD_EDGE_W` 1.6 m, jitter 1.2 m; fields .8 m / .5 m; zone grounds 4 m / 3 m. Mud also darkens a 1 m wet rim outside its core (`GD_MUD_RIM` 1.0).
- Height-blend look (the Mishkinis "advanced splatting" formula: weight = max(h_i - (max(h) - depth), 0), `GD_BLEND_DEPTH` .2): where a plane fades out, the detail height (pebble tops, clods) of the upper surface survives longest, so mud fades into grass as clods, not as a gradient.
- The surface mask (terrain.js) stays the gameplay truth with hard 0.5 m cells; only the look is softened. The soft band lies inside the mud rectangle (`GD_EDGE_INSIDE` true), so what you see as mud is always mud for the wheels.

**1c. Per-surface detail** (procedural cell noise, 0 to 1 extra fetch)
| kind | detail | numbers (defaults) |
|---|---|---|
| grass/farm | darker clumps + tiny light flecks | clump cell 0.7 m |
| forest | leaf litter: hashed 0.35 m cells, 3 colours (`#7b603c`, `#5d6a33`, `#8a5a2e`), 35% coverage; needle-brown under trees later | `GD_LITTER` .35 |
| dirt/path | small pebbles (Voronoi cells .18 m, 12% filled, lighter top, dark lower rim) + dry cracks on cell edges at 1.4 m, only away from wheels | `GD_PEBBLE` .12, `GD_CRACK` .5 |
| gravel (R3) | dense pebbles 60%, two greys and a brown | `GD_GRAVEL_FILL` .6 |
| plowed | furrow normal: a sine across the field rows (period 0.8 m, matching the canvas stripes), clods at crests | `GD_FURROW_AMP` .35 |
| mud | wet sheen + puddles (1d) + clods | see 1d |
| pavement | slab colour jitter per 2 m slab (hash), soft dirt at the edges | `GD_SLAB_JITTER` .06 |
Normals: perturbed in the shader from the noise gradient (cheap "normal-map-style" detail; no normal texture), strength `GD_NORMAL` .5, faded with distance like 1a. This is what makes the low sun and the hemisphere read relief.

**1d. Wet mud and puddles**
- Wet rule (fxguide's write-up of Lagarde's wet-surface work): wet porous ground is darker (albedo x `GD_WET_DARK` .62), smoother (roughness .95 to `GD_WET_ROUGH` .35) and water gathers in the low spots first.
- Mud: a low-frequency noise is the fake height; below `GD_PUDDLE_LEVEL` .32 it is a puddle: flat normal, roughness `GD_PUDDLE_ROUGH` .06, colour mixes toward the sky colour by a Schlick fresnel (F0 .02) using a shared uniform `uSkyHorizon` that sky.js already computes for fog. No env map, no reflection pass: it reads as sky at a low angle and as dark water from above. Sun highlight comes free from the low roughness. Puddles on Low: same rule, no fresnel term (just dark and glossy).
- `uWet` (0..1, the dormant `env.wet` hook from TR2) scales sheen and puddle level, so rain later costs nothing extra.

**1e. Day and night**: the shader only changes albedo, roughness and normal inside MeshStandardMaterial, so the sky rig's hemisphere, moon and lamps light it as before. The fresnel sky tint uses `uSkyHorizon`, which is dark at night, so puddles go dark blue with the sky. Nothing added after load.

## 2. Instanced ground cover
**2a. Kinds** (each one geometry + one shared material; program keys 'cover-'+kind)
| kind | where (surface) | High density /m2 | shape |
|---|---|---|---|
| grass tuft | GRASS, farm zone, GREEN edges, field margins | 1.6 | 5 to 7 folded blades, about 12 tris (menu `coverShape('grass')`) |
| weeds/ferns | forest ground 0.25, GRASS 0.05, along fences and walls 0.4 | 0.25 | menu `coverShape('fern')` |
| wildflowers | GRASS in meadow patches (macro noise > .7) | 0.12 | 3 stems + coloured head cards (white, yellow, violet), 10 tris |
| reeds | within `COVER_REED_BAND` 0.5 to 4 m of water (W1 `waterAt`), BANK edge | 0.8 | tall 6-blade clump, 14 tris |
| crop | WHEAT standing stalks / stubble (section 7) | 3.0 | stalk clump with head, 8 tris |
None on STREET, ROAD, PAVEMENT, DRIVEWAY, PATH, BRIDGE, WATER, MUD (mud gets a sparse 0.05 dead-grass tuft at its rim only), building footprints and plots (the mask says so). Collision: none. Shadows: cover receives, never casts.

**2b. Placement and streaming**
- Pure `dist/ground-cover-rules.js`: `coverPoints(tile, bounds, kind, density, seed)` jittered grid per 0.5 m cell, reading `c.tile.surface`; seeded by chunk key, so the same chunk always grows the same grass (tests check this). Per instance: x, z, yaw, scale (.7 to 1.3), tint (r,g,b from the ground macro colour at that spot, so the grass base matches the ground under it, the "tint distant terrain to match the grass" idea from Cain Rademan's grass), phase.
- View `dist/ground-cover.js`: listens to `chunkView.on('build'|'dispose')`; builds the InstancedMeshes of a chunk only while the chunk's nearest point is within `COVER_FAR` + 15 m of the camera (checked twice a second, at most one chunk built per frame, `COVER_BUILD_MS` 2 ms). One draw call per kind per chunk. Instances are sorted by 12.5 m sub-cell then by distance to the cell centre (front-to-back helps overdraw, per the three.js 3M-grass thread).
- Distance: full size inside `COVER_NEAR`; from `COVER_NEAR` to `COVER_FAR` the instance shrinks into the ground and thins (an instance with hash > fade is dropped by a 4x4 dither in the fragment and collapsed to zero size in the vertex shader, so nothing pops). Beyond `COVER_FAR` vertices collapse (no fragment cost). Defaults High: NEAR 30 m, FAR 45 m. The macro ground colour (1a) under the fade looks like distant grass (hexaquo's impostor-ground idea, done with the ground shader we already have).
- Lighting: normals bent toward up (menu already does this) so tufts shade like the ground, plus a fake AO darkening at the blade root (`COVER_ROOT_AO` .55) and a lighter tip (`COVER_TIP` 1.15). Edge-on tufts are turned up to 25 degrees toward the camera in the vertex shader (Ghost of Tsushima trick, via the Stylized Station thread).
- Clumping: the same macro noise sets height (x .6 to 1.4) and a colour shift per clump so fields are not uniform (Ghost of Tsushima clumps, Cain Rademan's Voronoi clumps).

**2c. Wind**: new `dist/wind.js`, one shared uniform object `WIND` {uTime, uDir (vec2), uStrength, uGust} updated once a frame in game.js; the formula is the menu's `coverBend` (lean + sway + gust wave running downwind, bend squared so roots stay put), moved into wind.js and imported by menu-scene-rules (one source). Trees can read the same uniforms later (not part of GD). Defaults `COVER_WIND` as in the menu (lean .03, sway .02, gust .04, speed 1.7); reeds x1.8, crop x1.3.

**2d. Vehicles and the player bend and flatten it** (Kodeco's vector-field idea, done on the CPU)
- `dist/trample.js`: one R8G8 DataTexture `TRAMPLE_SIZE` 128 x 128 at `TRAMPLE_CELL` .5 m (64 m square) that follows the camera in 8 m steps. R = flatten 0..1, G = push direction. Written each frame from: the player's feet (radius .45 m, push away, recovers in `TRAMPLE_FOOT_S` 4 s), each wheel of a driven vehicle (TR5's `stepWheel` positions and widths `TRACK_WIDTH`, flatten 1), and the vehicle hull (push away, radius = half width). Decay per second `TRAMPLE_DECAY` 1/120 (a tyre strip stands back up over about 2 minutes); upload 32 KB only when dirty.
- The cover vertex shader reads it once per instance root: flattened grass lies down along the travel direction to 15% height and darkens 10%; pushed grass leans away. Older TR5 tracks beyond the texture are not re-read (they are out of the 32 m radius anyway; when you come back the grass is up, the TR5 tyre mark may still show: acceptable, said plainly).
- Low tier: no trample texture; grass under a TR5 track segment within 20 m simply hides (cheap distance test against the 1024-quad ring is too costly every frame, so Low gets nothing: flagged).

## 3. Mud and dirt up close
- **Relief**: 1c normals (clods, furrows, pebbles) plus a mud-only ridged noise (`GD_MUD_RIDGE` .45, 0.4 m cells) so wet mud looks pushed around.
- **Ruts that persist**: TR5 owns where and how long (mud 600 quads, 5 h). GD7 changes only the track material's look for mud and plowed: a darker wet centre, a lighter raised lip along each side using `vSide` (already in the TR5 shader) as a fake normal (lit side brighter by sun direction, `RUT_LIP` .25), and puddle sheen in the rut centre on mud (same fresnel as 1d, `RUT_WET` .7). Same 1 draw call, same program count.
- **Puddles that reflect the sky cheaply**: 1d. No reflection probe, no render target. Optional High-only extra (GD later, not planned): sample a 64 px cube of the sky dome once per game minute; flagged as the only real cost.

## 4. Quality tiers
| | Low | Medium (proposed) | High |
|---|---|---|---|
| ground break-up (1a), soft borders (1b) | yes (1 fetch, no notile) | yes, notile | yes, notile |
| per-surface detail + normals (1c) | colour only, no normals | yes, normals to 25 m | yes, normals to 40 m |
| mud wet + puddles (1d) | dark glossy, no fresnel | yes | yes |
| ground cover kinds | grass only | grass, ferns, crop | all 5 |
| `COVER_NEAR` / `COVER_FAR` | 12 / 20 m | 20 / 32 m | 30 / 45 m |
| density x | .4 | .65 | 1 |
| trample (2d) | no | player only | player + vehicles |
| rut look (3) | colour only | yes | yes |
| max cover instances drawn | 6k | 25k | 60k |
| cover triangles (est.) | 0.07 M | 0.3 M | 0.8 M |
| added draw calls (1 per kind per chunk, at most 4 chunks) | <= 4 | <= 12 | <= 20 |
| new programs | 10 ground (replacing 10 old) + 1 | + 3 | + 5 |
The ground shader adds no draw calls on any tier. Switching tier changes defines, so it recompiles (as applyQuality already does). Fallback: a `groundDetail` override 'off' in the settings object (also the safety switch if a GPU shows artefacts) returns the plain old materials.
Medium: pixel ratio 1.25, no shadows (between today's two). It touches main-menu.js and applyQuality; see question 1.

## 5. Assets
- **Procedural in code (recommended for all of GD)**: grass tufts and ferns (menu `coverShape` already), wildflowers, reeds, wheat stalks and stubble (blade strips with vertex colours, no textures, no alpha cut-outs so no overdraw from cards). All ground detail is shader noise. Nothing to credit.
- **User's own Blender models (optional, no credit, record in ASSETS.md as 'Own work')**: a hero fern, 2 bush shapes, a flower clump, a small rock/pebble cluster for dirt and gravel edges. Contract: under 60 triangles each for cover kinds, one material with vertex colours, origin at the root, y up, export via `build-props.mjs`.
- **CC0 source if wanted**: Quaternius Stylized Nature MegaKit (CC0, 35 plants and flowers, 27 rocks, grass) fits the low-poly look and Quaternius trees are already in nature.js; record each in ASSETS.md.

## 6. Build plan (each stage Sonnet 5.5 sized; `npm run release -- --force` before `npm test` as usual)
Software-browser tests check data, counts, program keys and shader source strings only (the test browser is about 4 FPS).
- **GD1 ground shader base** (1a, 1e). New `ground-shader.js`, `ground-rules.js` (constants, JS mirror of the hash/noise for tests). world.js: `patchGround(material,kind)` around each ground material (additive, one call per site, say so). Tests `tests/ground-shader.mjs`: one program key per kind, uniforms present, noise deterministic and in 0..1, draw calls unchanged in perf-gate. Eye-check: grass no longer one flat green; no visible 4 to 7 m tiling; same colours at night as before but patchy.
- **GD2 soft borders** (1b). ground-shader.js edge mask + dither; world.js passes each overlay plane's size. Tests: mask is 0 at the edge, 1 at `GD_EDGE_W` + jitter; mud cells in terrain.js unchanged (bog still where the mud is). Eye-check: mud patches and field edges ragged and soft; no flicker where planes overlap (polygon offsets kept).
- **GD3 surface detail + wet mud** (1c, 1d). ground-shader.js only, plus `uSkyHorizon` from sky.js (one exported uniform, coordinate with the visual overhaul track). Tests: program count still <= 10; Low define drops normals. Eye-check: pebbles on dirt, litter in the forest, furrows lit by low sun, puddles showing sky at a low angle and dark from above, all at 10 to 30 m.
- **GD4 wind + cover rules** (2a, 2b data, 2c). New `wind.js`, `ground-cover-rules.js`; menu-scene-rules imports the wind formula (tests/menu-scene.mjs must stay green). Tests `tests/ground-cover.mjs`: same seed same points; zero points on road/pavement/building/mud cells; density per surface within 10%; reeds only near water.
- **GD5 cover view + quality** (2b view, 4). New `ground-cover.js`; world.js hooks `chunkView.on`; game.js: `WIND` update and the quality hook (one line each, dense style). Tests: draw calls per tier <= the table; instances <= cap; chunk dispose frees geometry; perf-gate stays green (cover is off in the perf-gate scene or counted). Eye-check: grass around the player sways, fades smoothly at 30 to 45 m, none on roads; FPS on the real GPU High vs Low.
- **GD6 trample** (2d). New `trample.js`; game.js feeds player feet and the vehicle wheels (reads TR5 `stepWheel` output; needs TR5 done). Tests: decay rate, write radius, follow-step re-centre keeps data. Eye-check: walking parts grass; driving leaves a flattened strip that stands back up in about 2 minutes.
- **GD7 rut look** (3). tracks.js material only (after TR5 is finished and committed). Tests: TR5's own tests green, still 1 program 'tyre-tracks'. Eye-check: mud ruts look sunken with wet centres.
- **GD8 Medium tier** (4, if the user says yes): main-menu.js, game.js applyQuality, settings test. Eye-check: three distinct tiers.
- **GD9 menu reuse**: menu cover uses ground-cover-rules shapes and the GD1 ground shader on its ground. Eye-check: menu looks like the game.
- **GD10 harvest** (section 7, later, needs a combine vehicle and the farming design).
**Conflicts**: world.js is shared with R3 (gravel road meshes), the basin walkability stage and the visual overhaul materials pass: never run GD1 to GD3 or GD5 beside them. terrain.js: GD reads only. tracks.js/tracks-rules.js: TR5 owns; GD6/GD7 wait for TR5 done. debris.js (TR6) and audio.js (TR6, SND): GD10 waits. paint-shader.js (TR7): untouched by GD. game.js: one-line hooks only, never beside another game.js stage. sky.js: GD3 adds one exported uniform: coordinate with the visual overhaul. map-definition.js: untouched until GD10 (field crop data).

## 7. Farming: cutting crops with a combine (later stage GD10)
- **Cut state per field cell**: `dist/crop-rules.js` (pure): each field (`MAP.fields`, today wheat 75 x 38 m, plowed, green) gets a Uint8 grid at `CROP_CELL` 1 m (wheat field 2,850 bytes). Values: 0 bare/plowed, 1..3 growth stages (sprout, green, ripe), 4 cut stubble, 5 cut with swath (windrow) lying, 6 swath picked up. The ground-cover rules read it: standing crop instances (kind 'crop', height by growth) only on 1..3; stubble instances (short 0.15 m stalks, density 2/m2, Medium and High) on 4..6; nothing on 0. The field plane's ground shader gets the grid as a small R8 DataTexture per field (nearest filter) and switches look per cell: ripe gold rows, stubble = pale straw with short dark row lines across the cut direction, swath = a darker raised windrow strip 1.2 m wide, bare = plowed look.
- **Vehicle cut hook**: a combine class gets a `header` anchor (width `HEADER_W` 6 m default, from the model) and a lowered/raised switch. While lowered and moving faster than `CUT_MIN_SPEED` .5 m/s, the header edge is stepped like a TR5 wheel (`stepWheel`-style every `TRACK_STEP` .6 m) and every crop cell whose centre falls in the swept header rectangle goes 3 -> 5 (swath behind the machine, centred) or 3 -> 4. Cells not ripe (1..2) are cut to 4 with no yield (a later yield rule). Pure function `cutSwath(grid, field, a, b, width)`, returns cells cut (for yield, grain tank and sound load). The trample texture (2d) also flattens what the wheels roll over on stubble.
- **Chaff and dust**: reuse the TR6 pooled debris (one Points object): kinds 'chaff' (straw `#d9c27a`, light, drifts downwind with `WIND`, life 1.5 s) at the header at `CHAFF_RATE` 30/s while cutting, plus 'dust' (TR6's) behind the spreader at 15/s; raise `DEBRIS_MAX` only if TR6's 220 is not enough (still one draw call).
- **Sound hook**: `audio.harvest({on, load, speed})` via a 'combine-header' and 'combine-thresher' loop entry in vehicle-sounds.js (CC0 recordings, ASSETS.md); load = share of the header actually cutting (pitch and level).
- **Regrowth and saving (note only)**: growth advances per game day (`CROP_STAGE_DAYS` 2), stubble stays until plowed (a plow/cultivator stage later), swath until baled or picked up. Save per field as run-length bytes in `progress.fields` (its own later design: save format needs Opus). Until then a cut field resets on reload.
- Eye-check (GD10): a 6 m clean cut strip behind the header, standing wheat beside it swaying, chaff blowing downwind, the stubble rows visible from the cab at 10 to 30 m.

## 8. References (all opened on 2026-11-15)
1. Procedural Grass in 'Ghost of Tsushima' (GDC 2021, Eric Wohllaib): https://gdcvault.com/play/1027214/contactUs : blades generated on the GPU, procedural look per blade. Borrow: clump-driven variation (height, colour, lean) and camera-facing widening.
2. Stylized Station thread on Ghost of Tsushima grass: https://threadreaderapp.com/thread/1688939411575119872 : folded short blades (double density for free), turn edge-on blades toward camera, noise clumps for colour, Perlin + sine wind, 15/7 vertex LODs. Borrow: fold trick, camera turn, wind mix.
3. Blowing from the West: Simulating Wind in 'Ghost of Tsushima' (GDC 2021, Bill Rockenbeck): https://gdcvault.com/play/1027350/Blowing-from-the-West-Simulating : one wind feeding grass, cloth and particles, speed over accuracy. Borrow: one shared WIND uniform for cover, chaff, later trees.
4. Cain Rademan, Unity Grass: https://cainrademan.github.io/Unity-Grass/ : Voronoi clumps, Bezier blades, root AO, normals blend to terrain at distance, distant terrain tinted like grass tops. Borrow: root AO, tint from the ground, distance normal blend.
5. al-ro, Grass: https://al-ro.github.io/projects/grass : 100,000 instanced blades in WebGL, per-instance offset/facing/height attributes uploaded once, sine wind about the root. Borrow: the attribute layout for InstancedBufferGeometry.
6. three.js forum, Simple instanced grass example: https://discourse.threejs.org/t/simple-instanced-grass-example/26694 : short InstancedMesh + shader wind (jsFiddles linked there). Borrow: the minimal three.js wiring pattern.
7. three.js forum, Optimizing 3M instanced grass: https://discourse.threejs.org/t/performance-optimizing-3m-instanced-grass-in-three-js/81286/4 : about 3 M triangles is a safe total; clumps beat single blades; sort front to back for overdraw. Borrow: the triangle cap per tier and front-to-back order.
8. hexaquo, Grass rendering part 4: LOD tricks: https://hexaquo.at/pages/grass-rendering-series-part-4-level-of-detail-tricks-for-infinite-plains-of-grass-in-godot/ : impostor ground fades in 5 to 10, real grass fades out 10 to 20, ground reuses grass colours and noise. Borrow: cross-fade cover into the ground shader's macro colour.
9. Kodeco, Creating Interactive Grass in Unreal Engine 4: https://www.kodeco.com/6314-creating-interactive-grass-in-unreal-engine-4 : a direction field render target painted by the player, grass samples it once. Borrow: the trample texture (done on the CPU here).
10. Andrey Mishkinis, Advanced Terrain Texture Splatting: https://gamedeveloper.com/programming/advanced-terrain-texture-splatting : height blend with a depth window (.2). Borrow: the formula for soft borders that break up as clods/pebbles.
11. Terrain3D, Shader design: https://terrain3d.readthedocs.io/en/stable/docs/shader_design.html : control map of IDs + blend, height-weighted blending, macro variation multiplied on albedo, textureGrad for detiling. Borrow: macro multiply and height-weighted weights.
12. godotshaders, Texture no tile (hungryproton, Quilez technique 3): https://godotshaders.com/?p=12496 : two offset samples blended by a low-frequency noise, textureGrad for mips. Borrow: the no-tile sampling for our canvas textures.
13. fxguide, Game environments Part C: making wet environments (on Lagarde's work): https://www.fxguide.com/?p=43362 : wet = darker, smoother, porous only; water fills low spots first; flat normal in deep water. Borrow: wet mud and puddle rules.
14. Thumbsticks, GDC 2015: The Art of Firewatch: https://www.thumbsticks.com/gdc-2015-the-art-of-firewatch : bold colour layers, fog for depth, detail only where it matters. Borrow: keep ground detail soft and low-contrast with distance; colour first.
15. Quaternius, Stylized Nature MegaKit: https://quaternius.com/packs/stylizednaturemegakit.html : CC0, 116 models incl. 35 plants/flowers, 27 rocks, grass. Borrow: optional CC0 cover models.
Found but not opened (not used): Codrops "How to make the fluffiest grass with three.js" (403), Inigo Quilez "texture repetition" (404 at the tried address). No Valheim ground or grass technical write-up was found.

## 9. Open questions for the user (each with a recommendation)
1. Quality tiers: (a) add Medium to the menu: Low / Medium / High (recommended), (b) keep Low/High and add a separate "Ground detail" setting, (c) keep Low/High only.
2. Ground cover reach on High: (a) 30 m, (b) 45 m (recommended), (c) 60 m (more cost, mostly hidden by fog from 65 m).
3. Grass flattened by vehicles: (a) no flattening, (b) flattened strip that stands back up in about 2 minutes (recommended), (c) stays as long as the tyre track (up to 5 h on mud).
4. Wildflowers: (a) none, (b) a few meadow patches (recommended), (c) scattered in all grass.
5. Puddles: (a) only in mud patches and mud ruts (recommended), (b) also on dirt tracks when rain exists later, (c) none.
6. Cover models: (a) all made in code first, your Blender models later where they look better (recommended), (b) your Blender models from the start, (c) Quaternius CC0 MegaKit now.

## Decisions (user, 2026-11-17)
1. Tiers: add Medium (Low / Medium / High).
2. Ground cover reach on High: 60 m (user chose the longest; fog starts at 65 m, so tune the fade so cover does not pop against fog; Medium and Low keep the proposed shorter reaches, scale instances accordingly).
3. Vehicle flattening: a flattened strip that stands back up in about 2 minutes.
4. Wildflowers: a few meadow patches.
5. Puddles: only in mud patches and mud ruts.
6. Cover models: the Quaternius Stylized Nature MegaKit (CC0: plants, flowers, rocks, grass) NOW, through scripts/build-props.mjs (record in ASSETS.md; CC0 needs no credit but keep the record). Code-made cards/blades remain the fallback for kinds the kit lacks (reeds, crop). The user's own Blender models can replace any later.
7. Farming (GD10): later, needs a combine vehicle model. The user asked to look for a combine or farm models: CC0 combine not found; options listed in chat (own Blender model, CC BY Sketchfab, Quaternius CC0 farm buildings and animals for Husky Ranch).
