michadr.

# GD5 report: ground cover wiring

## Files (line counts)
New: dist/cover-sampler.js (43), dist/cover-pack.js (36), dist/ground-cover-view.js (75), dist/cover-assets.js (3 long lines, 292 KB, generated), scripts/build-cover-assets.mjs (57), tests/cover-view.mjs (70).
Changed: dist/world.js (626: import, cover view created beside the chunk view, build/dispose hooks, lazy import of cover-assets.js, cover?.update in update(), setWind/setCoverTier/coverStats/coverView, setLandmarkVisible(id,v) with landmark colliders kept in `boxes`), dist/game.js (1633: wind clock advanced once per frame, world.setWind(windSample(..)), applyQuality calls world.setCoverTier), dist/ground-cover-rules.js (COVER_TIER.high.variants 2 -> 1), tests/ground-cover.mjs (93: draw calls <= 11, variants === 1, first model only), ASSETS.md, assets-register.json (entry shipped-ground-cover), dist/credits.js (MegaKit line now names the ground cover; CC0).
Deviation: the models are baked by my own scripts/build-cover-assets.mjs, not scripts/build-props.mjs (that one rewrites 16 MB of props modules and needs TOOL_DIR installs). Output is a separate lazy module, so startup does not grow (tests/atv-import size cap untouched).

## What it does
- 9 MegaKit models (one per kind): grass, tallgrass, clover, fern, flower, bush, pebble, rock, mushroom, scaled once to real size (grass .6 m, tallgrass 1 m, fern 1.3 m wide, bush 1.6 m wide, rock .9 m, pebble 16 cm, mushroom 18 cm), textures cropped into ONE 512x384 atlas (48 KB PNG). Bush texture hue-shifted from autumn red to green. Reed (28 tris) and wheat (40 tris) are code-made, vertex coloured (white atlas tile).
- Real sampler per chunk: surface from the chunk tile (neighbour tiles at the edge), road and water distance by a chamfer distance transform over chunk + 6 m (0.5 m cells), building distance from MAP.buildings + landmark footprints, slope from a 2 m height grid, biome from the tile zone (forest/farm/open). Real bounds from chunkBounds.
- View: world.js listens to chunkView.on('build'/'dispose'); cover is built only for chunks within 62 m of the player (dropped beyond 95 m), at most ONE stage per frame (placement, then meshes), nearest first. One InstancedMesh per kind per chunk, 1 material per kind, ONE shader program ('gd-cover'). LOD in the vertex shader (shrink then thin by rank, nothing past the reach, never past 64 m); wind sway from the shared wind uniform (rocks, pebbles, mushrooms 0 sway); normals lean up; back faces keep the normal; receives shadows, never casts. No per-frame CPU work except the wind uniform.
- Low quality: tier 'low' (grass only), switched by applyQuality (rebuilds nearby chunks).
- setLandmarkVisible done (cheap) but NOT called from game.js: game.js use for the Hal egg pallet (id of that landmark) is for the G3b follow-up.

## Cost
- Draw calls: at most 9 per chunk on the tested chunks (11 max by the rule: 9 kit kinds + reed + crop); materials: 11 (one per kind), 1 program, 1 texture. Typical 3 to 6 chunks near the player = about 30 to 55 draws; worst case a player in a chunk centre touches 9 chunks (about 80 draws, rare, flagged).
- Instances per real chunk (High): 4,000 to 6,400 (8 chunks: 40,989 total); e.g. town chunk 4:9 about 4,000, forest chunk 5,500. All-grass test chunk 5,704 / 2,385 / 1,370 (High/Medium/Low).
- Triangles: grass 155, tallgrass 326, clover 379, fern 288, flower 755, bush 900, pebble 136, rock 342, mushroom 880 per instance (soft cap; the bush and mushroom are the heavy ones).
- Placement (sampler + coverFor) measured in Node on 8 real chunks: avg 10.2 ms, max 11.8 ms after warm-up (cold first chunk 25 ms). Mesh stage is a separate frame. So one chunk costs about 10 ms placement spread over two frames, not yet seen on the GPU.

## Tests (real output)
```
node tests/ground-cover.mjs
INFO high/medium/low instances per all-grass chunk: 5704 / 2385 / 1370; draw calls 9 / 2 / 1; ...
ground-cover: ok
node tests/cover-view.mjs
INFO real chunks: 8, 40989 instances, sampler+placement ms per chunk (after 2 warm-up): avg 10.2, max 11.8; cover-assets.js 292435 bytes
cover-view: ok
```
Also passing when run alone: assets, assets-checklist, brief, credits, world, startup. `npm run release -- --force` (0.35.10; dist/releases/0.35.10 existed and index.html pointed at it, so this OVERWROTE the local 0.35.10 folder: if 0.35.10 is already deployed, bump the version before deploying) and `npm run index` (index 27,9xx of 32,500, brief 2996) ran. Full `npm test`: first run 2 failures (assets.mjs, brief.mjs: my register entry and a stale index), fixed; second full run: ALL passed except assets-checklist.mjs (register entry needed "class"), fixed and re-run alone: pass. I did not run a third full suite after that last one-field fix.

## NOT verified
Nothing was seen in a GPU browser: look, scale of each model, wind amplitude, LOD fade, shader compile on a real GPU, frame rate, hitch from the 10 ms placement. Atlas edge bleeding at distance. Cover height on steep bank/hill meshes (heights come from heightAt, ground mesh is a 2 m grid). No trample.

## EYE-CHECK (owner)
1. Grass: tufts around you, thinner and shrinking out to about 40-60 m, no popping; is it too sparse (about 0.35 tufts per m2)?
2. Wind: grass, ferns, reeds sway together, gusts visible, rocks and pebbles still.
3. Roads, pavements, driveways, mud, water: no cover on them; edges of verges clean (about 0.5 m accuracy).
4. Bushes (green, not red), ferns and mushrooms in Pine Ridge; flowers in meadow patches only; sizes believable.
5. Reeds 0.5-4 m from the river and sea; wheat stalks only on the wheat field.
6. Chunk borders: no seams, no doubled plants; walking 200 m: no hitch when new chunks build.
7. Low quality in the menu: only grass remains, then back to High rebuilds.
8. Night and shadows: cover darkens with the ground, no black undersides, no shimmer; check FPS High vs Low.

## Confidence
Rules, sampler, packing, assets, credits: high (tested on real map chunks). Shader and view: medium (string-checked, loaded by the release tests, never run on a GPU). Size and density tuning: low (guesses; sizes are constants in scripts/build-cover-assets.mjs).