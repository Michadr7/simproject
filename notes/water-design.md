# Water design (look and flow) - proposal, 2026-11-14
DESIGN ONLY, nothing decided. Levels, paths and depths come from notes/map-master.md 1.4 and section 4 (Decisions:
lake -0.90, river -0.95, sea -2.0, 3 rapids, mouth into Kaspian Bay at about (120, 440)). (m) = measured by Grep, (e) = estimate.
Today (m): `world.js:278` one MeshStandardMaterial `#4a86a6`, opacity .94, DoubleSide, depthWrite false; `world.js:290` one
ribbon per river at `RIVER_WATER_Y` (-0.95, `height.js:10`); `riverZAt` (map-definition.js:483) assumes x increases along the river.

## 1. Data contract (MAP.water, read by height.js, the chunk builder, the shader and the minimap)
- `rivers[]`: `{id, points:[{x,z,w,depth,y,speed}], bank, shore}` in FLOW order. Per point: width w (m), bed depth below water,
  water y, speed (m/s). Direction = tangent to the next point (no separate field). A rapid = two points 2..4 m apart with y
  dropping 0.35 and speed up to about 1.2: the ribbon tilts there; `rapid:true` on the upper point turns on foam.
- `fords[]`: `{river, x, z, w, depth:0.3}` (bed raised to water y - 0.3 over w metres; drivable, walkable).
- `lakes[]`: `{id, outline:[[x,z]...], y:-0.90, depth:2.5, shore:6, inflow:[x,z], outflow:[x,z]}`.
- `sea`: `{shoreline:[[x,z]...] west to east, y:-2.0, beach:25, swell:{amp,len,dir}}`; south of the line is sea.
- `falls[]`: `{id, lip:{x,z,y}, drop:6, w:3, dir:[dx,dz], pool:{r:6}}` (Blackstone Falls at (720,-770)).
- Derived once at load (not stored): `waterAt(x,z) -> {y, depth, flow:[vx,vz], kind}` for gameplay (fords, fishing, splash)
  and `distanceAlong` per river point (the u coordinate). Bridges gain `axis:'x'|'z'` so north-south reaches can be crossed.

## 2. The look: one material for all water
- One `ShaderMaterial` with fog chunks (`fog:true`, `#include <fog_*>`), not onBeforeCompile on Standard: no lights loop,
  cheaper, and the sun and sky colours come in as uniforms from the visual-overhaul sky rig (`sky-rules.js`).
- Vertex attributes: `uv` (u = metres along the path, v = metres across, 0 at centre), `aFlow` (speed, 0 for lake and sea),
  `aDepth` (m), `aKind` (0 river, 1 lake, 2 sea, 3 fall). Uniforms (shared, one object): uTime, uSunDir, uSunColor, uSky,
  uHorizon, uNight (0..1), uQuality, plus the fade uniforms of createSightlineFade.
- Ripples: no texture files. Two layers of cheap value noise (or 3 summed sines per layer) give a normal; layer A scrolls along u
  at speed, layer B at 0.6 x speed and a slight angle, so a river visibly moves downstream; lake: slow wind drift only.
  Fallback if noise costs too much: one 256 px tiling normal map made on a canvas at start (still no file).
- Depth colour: mix shallow turquoise `#5fb8b0` to deep `#1f4f5a` by aDepth (0..2 m); alpha from 0.55 (shallow, bed shows)
  to 0.92 (deep). Values (tune).
- Fresnel: reflect colour = mix(uHorizon, uSky, normal.y); fresnel = 0.02 + 0.98 x (1 - dot(N,V))^5. No planar mirror.
- Shore foam: white where aDepth < 0.15 m, broken up by the ripple noise; rapids: foam band where `rapid` and speed > 0.9;
  falls plunge pool foam by distance to the pool centre.
- Waterfall: a vertical ribbon (3 m x 6 m, 8 x 12 segments, slight curve out from the lip), same material kind 3: streaks =
  noise stretched 1:20 scrolling down at about 6 m/s, white-blue, alpha 0.8. Mist: 12 soft sprites in the pool (one Points,
  canvas texture), rising and fading, only when within 60 m.
- Sea: vertex displacement, 3 sines (amp 0.12, 0.07, 0.04 m (tune)), amp x smoothstep(0, beach, distance from shore), so calm
  at the beach. Swash foam: a band at the shoreline whose offset follows sin(uTime x 0.4), a few metres up and down the sand.
- Sun glints: specular pow(dot(R, uSunDir), 200) x uSunColor x (1 - uNight); at night a dim moon glint (0.15) if the rig has a moon.
- Day and night: base colours multiply by the rig's light level; at night reflection = night horizon colour, foam greyer.
- Fog: standard linear fog applied last, so far water melts into the horizon exactly like the ground.

## 3. Interplay
- Sightline fade: water is under the player, not between camera and player; do NOT apply the fade (saves cost).
- Z-fighting: water sits 0.5..2 m above the dug bed, so no fight with the ground; shore edges cross the bank slope at a steep
  angle (safe). Ground layers (`world.js:208` groundLayer polygonOffset) stay as they are; water needs no offset.
- Sorting: water is transparent, depthWrite false, renderOrder 1 (after opaque ground and bridges, before people overlays at 2).
  Bridges are opaque so they always win. Two water bodies never overlap (river ends at the lake/sea edge, 1 m tuck under).
- Ford ripples: one instanced mesh of 16 rings (pool), spawned at feet or wheels when `waterAt` says depth > 0, expand 0.4 to 2 m
  in 1.2 s; 1 draw call. Wheel spray: 8 sprites per vehicle in the same pool (later).
- Audio (`audio.js` is all synthesized from a noise buffer, no files except water_drink.wav (m)). New: `splash(strength)`
  (band-passed noise burst, 800 Hz, 0.25 s) on entering water and each step in a ford; `waterAmbience(nearest)` a looping
  low-passed noise: river burble by distance and speed, falls roar within 80 m, sea surf with the swash cycle.

## 4. Chunking
- Per 100 m chunk: one mesh per water body touching it (river, lake, sea, falls); all share the one material, so cost = draw calls.
- River ribbon: 2 m along x 4 across (centre deeper for colour), cut at chunk edges at the exact same u and positions so vertices
  match bit for bit; seams are invisible because the shader is world/u based, not per mesh. Lake and sea: a 4 m grid clipped to
  the outline (sea grid only within 60 m of shore at 4 m, beyond that 16 m cells, flat).
- Vertex budget per chunk (e): river 600, lake 800, sea 1,500, falls 120; ripples and mist pooled globally.
- LOD: beyond 120 m the chunk uses a flat ribbon (no displacement, layer A only) via a uniform distance fade in the shader,
  not a second mesh (no pop).

## 5. Performance
- Worst view (lake + river + sea, e): about 9 chunks with water in view x 1.5 bodies = 14 draw calls + ripples 1 + mist 1 + falls 1
  = about 17 (budget 300; world is 48..141 today (m), visual pass adds up to 7). Triangles about 25,000.
- Shader: about 30 noise/sine ops per pixel, no texture reads; water can cover half the screen at the lake. Est. under 0.3 ms on
  the user's GPU (about 165 FPS); must be measured with the Stage 2 dev-panel line.
- Weak GPU setting "Water: Simple": flat colour by depth plus a moving tint stripe along u, no displacement, no glints.
- Agent's software WebGL (about 4 FPS): CAN verify screenshots (colour, foam, shore, seams, night), draw calls and triangles via
  renderer.info, flow direction from 2 screenshots apart in uTime. CANNOT verify frame time, smoothness or shimmer.

## 6. Code that must change (m, by Grep)
- `height.js:10` RIVER_WATER_Y, RIVER_FADE_X, RIVER_DEPTH: become per point; `valleyAt` must use distance to a polyline in any
  direction (bends, south flow) plus lake and sea basin terms; `distanceToRiver`, `valleyFade` follow.
- `map-definition.js:71-72` rivers/bridges; `:483` riverZAt (by x) and `:523-541` bridge validation (assumes a z-axis crossing).
- `height.js:26-30` bridgeRise/deckAt: "bridges run north-south" -> add axis.
- `world.js:278,290` water material and ribbon; `world.js:202` ground notes. `minimap.js` draws rivers via riverPath: add
  lakes, sea, falls colour. `game.js:1471` bridge names (two hard-coded ids).
- Tests: `tests/height.mjs:29-38` (valleyFade ends, RIVER_WATER_Y range, bridges), `tests/terrain.mjs:21-27,36,54,70`,
  `tests/map.mjs` river rules, `tests/dev.mjs:40-42` (riverZAt for teleport).

## 7. Open questions for the user
1. Water style: realistic (Firewatch-like soft) or slightly stylised with bold foam lines?
2. Should the bed (rocks, sand) show through shallow water, or is colour by depth enough?
3. Can the player swim, or does deep water push you back (today rivers are hard barriers)?
4. Fog ends at 155 m: should the lake and sea get a longer view (a later fog decision) or stay hidden?
5. Waterfall mist and roar: always, or only High quality?
6. Night: moon glint on water, or just dark?
7. Do boats come later (the P6 home "with boat access")? It changes whether the sea grid needs to reach further.
8. "Water: Simple" setting in the menu, or picked automatically from the quality preset?

## 8. Staged build (one agent per stage)
| Stage | Work | Model | game.js? |
|---|---|---|---|
| W1 | Data contract in map-definition.js + waterAt + validation; update tests | Sonnet | no |
| W2 | height.js: polyline valleyAt, basins, sea slope, fords, axis bridges; tests | Sonnet | no |
| W3 | Chunked water meshes (ribbons, lake, sea, falls) with attributes, plain material; minimap | Sonnet | no |
| W4 | Water shader (all of section 2) + uniforms wired to the sky rig and uTime; Simple setting | Fable | yes (uniform update, setting) |
| W5 | Ford ripples pool, splash and ambience audio, mist | Sonnet | yes (feet/wheels hook) |
| W6 | Look pass on the real GPU with the user (colours, speeds, foam), measured costs | Fable | maybe |


## Decisions (user, 2026-11-14)
- Q2: yes, the bed shows through shallow water. Q3: swimming later (deep water still pushes back). Q1, 4 to 8: Claude's leanings accepted (slightly stylised; lake and sea longer view later; mist and roar always on; moon glints; boats later so the sea grid reaches far; Water: Simple chosen from the quality preset with a manual override).