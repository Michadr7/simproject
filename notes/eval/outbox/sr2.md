michadr.

# SR2: farm.house-brick and farm.house-red

## Result
Two new ids in the lazy module dist/props-assets-farm.js. Nothing is placed in the map. Nothing seen in a browser.

| id | source | size w x d x h | triangles | colours | wall boxes |
|---|---|---|---|---|---|
| farm.house-brick | Farm/sr90/house_brick.glb | 13.7 x 14.8 x 11.0 m | 7,990 | 17 | 28 |
| farm.house-red | Farm/sr90/house_red.glb | 16.0 x 10.6 x 8.2 m | 7,983 | 16 | 50 |

Heights are plausible: the brick house is a two-storey farmhouse with a steep roof and two chimneys (12.3 m before simplification, 11.0 m after: the simplifier clipped the chimney tops). The red house is 8.2 m (8.6 m before). Origin on the ground (y = 0) at the footprint centre, door side toward +z (porch roof 4.2 m high on the +z end of both; checked in the test). One mesh, one material, one draw call each.

## How
- scripts/farm-sr90-bake.py (now 112 lines): the existing bake, plus an export mode. With env SR90_EXPORT=assets-src/Farm/sr90 it writes house_brick.glb and house_red.glb (flat material per baked colour) instead of rendering. It cuts the model at z = 0 (House_Red is a hillside house: its stone base went 2.09 m below ground at the back, 6,000 buried faces removed), centres the footprint, keeps the door on Blender -Y (= +z in the game). Run: `$env:SR90_EXPORT='assets-src/Farm/sr90'; blender -b assets-src/Farm/list1_detailed_FARM.blend --python scripts/farm-sr90-bake.py -- <scratch dir> House_Brick House_Red` (Blender 5.2).
- scripts/build-props.mjs (+3 lines, 304 total): entries farm.house-brick / farm.house-red, triangles:8000, collide WALLS (same as farm.big-barn), no door record (farm buildings have none). Built with TOOL_DIR in the scratch folder (meshoptimizer, sharp, three installed there) and `node scripts/build-props.mjs assets-src farm.house-brick,farm.house-red`. The build script ran for real this time (the LZ1 edit to it now has a verified run: it kept all 63 old farm records byte-identical and left props-assets.js unchanged at 86 props).
- Tests: new tests/farm-houses.mjs (34 lines); tests/sr90-props.mjs (one clause allows the two house ids); tests/farm-lazy.mjs (message 63 -> 65 ids).
- ASSETS.md (new SR2 section at the end, same sr90 licence), assets-register.json (notes on shipped-sr90-farm; the textured-buildings entry now says the houses are imported), dist/credits.js (sr90 entry text names the houses; the covers prefix Farm/sr90/ already matched; the itch.io URL is still the placeholder, user must supply it).

## Size of dist/props-assets-farm.js
Before 8,405,172 bytes (8.02 MB, 63 props); after 9,088,729 bytes (8.67 MB, 65 props): +683,557 bytes (about 0.34 MB per house). props-assets.js unchanged at 4,890,864 bytes.

## Results (real)
- node tests/farm-houses.mjs: `Farm houses: PASS (2 ids, 15973 triangles, ~8,000 each, one mesh and one draw call each, real size, lazy module)`
- node tests/sr90-props.mjs: `sr90 farm pack: 52 ids (37 props, the water tower, 14 machines), 176023 triangles, ...` ; farm-lazy.mjs: `Lazy farm props: PASS (65 farm.* ids load on demand; nothing crashes before)`; farm-props.mjs and credits.mjs pass.
- npm run index: `brief 2996 tokens (target 3000), index 30376 tokens (target 31500); 174 modules, 13 generated, 207 tests, 26 scripts` (under the cap).
- npm run release -- --force: `Packaged release 0.35.9: 175 files -> dist/releases/0.35.9`.
- npm test: `All 207 test files passed.` (exit code 0)

## Could not verify
- Nothing was looked at in a browser or after simplification: the 8,000-triangle meshes were not rendered (only the 40k baked versions were previewed in Blender). Thin walls, window frames and chimneys may have lost detail or got holes; check by eye.
- Glass is opaque dark (no alpha in the props pipeline); plank, shingle and stone patterns are one flat colour each.
- House_Red's back (+Y in the pack) is a low stone terrace; on flat ground that side shows only a 0.5 to 0.75 m stone plinth, the walls start above it. The below-ground part of the hill base is cut away, so the bottom of the model is open (invisible when standing on the ground).
- No door record (farm buildings have none), so no entering; the door x position is not in the data.
- The index run happened before the final ASSETS.md colour-count fix (doc only).

## Needed from forbidden files
None. When the map places a house: `await ensureFarmProps()` first (LZ1).

## Confidence
High: data, tests, pipeline. Medium: how the simplified houses look. Files not edited: all forbidden shared files, notes/handoff.md.