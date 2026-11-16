michadr.

# MM2b: bake the whole world (1500 x 1800 m)

Files changed (lines): dist/map-bake.js 153 (was 128), dist/minimap.js 85 (one-word change: import TILE_CACHE_FULL, passes cap:32 to sharedBake), tests/map-bake.mjs 111 (groups 9 and 10 new, V = old view for the synthetic groups), tests/minimap-local.mjs 35 (fake bake now has world bounds, edge test at x -450, new wilds check). dist/game.js NOT edited (the bake is created inside minimap.js; bounds default to MAP.world). Nothing forbidden touched, no git, no BOM.

What changed
- BAKE_BOUNDS = MAP.world (x -450..1050, z -1200..600). BASE image 750 x 900 px.
- New makeWorldMask(map, base, maskFn, cap): inside MAP.ground the old whole-map mask (terrain()), outside it the chunk masks from chunks.js maskTile (the same masks the streaming world paints: wilds, roads, fields, sea, lakes, rivers), built on demand, LRU 32 (MASK_CACHE). world.js not edited; I cannot reach the world's already loaded tiles, so the bake builds its own copies of the masks.
- prepare(): the baker builds at most ONE missing chunk mask per work unit (one unit = 4096 px).
- Wilds colour: surface from the tile mask (water, roads, fields, mud, gravel, sea), zone colour on walkable zone cells, else meadow, times the relief shade (height/slope light, as before). NEW: bare-rock blend (ROCK_RGB 128,124,112) on open meadow where slope grad goes .15 to .4, from a rock grid built beside the shade grid. Only 5 hills exist today (max height 9 m, max slope .58), so rock shows only on those; the data has no other wilds info.
- Large mode (M key) and phone GPS map still show MAP.minimap.view (530 x 440), pick() unchanged: the full-world large map is MM6. The corner window now has the real world edge (dashed border at the world rectangle).

MEASURED in Node 24 (real clock, fake canvas: pixel work only; vector layers, drawImage, GPU upload NOT measurable)
- BASE whole world: 322-326 ms total work (cold and warm), NOT the 12 ms estimate. Split: about 200 ms is the 270 chunk-mask builds (0.7 ms average, 9 ms worst in the town chunks, measured on its own), 76 ms shade grid, 12 ms pixels (0.018 us/px x 675k), rest overhead. It is a one-time job sliced at 3 ms: 88 frames with work (about 0.7 s at 120 fps).
- FRAME-RATE FLAG: 16 of those 88 frames take over 4 ms, worst 8.7 ms (one work unit that builds a town chunk mask; slices cannot split a unit). One-time at load, while the map loads. Cheaper alternative needs world.js to share its loaded masks (forbidden file): world would hand its tile masks to the bake.
- Wilds 0.5 m tile: 3.5 ms average (includes its chunk masks), worst frame 3.5 ms while walking 150 m window across the wilds (36 tiles baked, 9 tiles needed per window worst case on the 128 m grid). Large view (530 x 440 at 0.5 m): 30 tiles on the world-aligned grid (was 20 on the old grid), worst frame 7.4 ms (town masks), 50 frames with work.
- Tile LRU: cache 24 would NOT hold the large view now (30 tiles), so the shared bake uses TILE_CACHE_FULL = 32 (test: the cache never passes 32, every tile of the window is ready). Mask LRU 32.
- Memory: BASE 2.70 MB (+2.70 MB while a rebake runs), tiles 32 x 0.27 = 8.5 MB, chunk masks 32 x 120 KB = 3.8 MB; about 15 MB total (was about 7 MB). Node heap after the whole run 25 MB.

Tests (real output)
node tests/map-bake.mjs: PASS map-bake: shade grid, ground colours, rotated footprints, sliced budget, BASE first, LRU, invalidateAt, real BASE, whole world (chunk masks, rock, cache 32)
node tests/minimap-local.mjs: PASS minimap-local: 200x200 local window, 150 m on foot, speed zoom + look-ahead, no clamp at the world edge, dashed border, route culling, chevrons, invalidateAt
node tests/map-view.mjs: PASS map-view: view math, crop window, tiles, level, zoom curve (top 29 m/s), smoothing, pick, chevrons, cull
node tests/gps-game.mjs: PASS gps-game.mjs: GPS app on the phone, tap drops one pin on a road (a tap off the map does nothing), job switch toggles, the vehicle panel shows "Turn right in 40 m · 160 m to go" and Clear removes it.
npm run release -- --force: Packaged release 0.35.9: 179 files -> dist/releases/0.35.9
npm test: All 220 test files passed. (first run, no failures, no flakes)
npm run index: brief 2996 tokens (target 3000), index 26623 tokens (target 32500); 178 modules, 13 generated, 220 tests, 26 scripts. Cap untouched, about 5,900 left.

Defaults chosen
- Bounds = MAP.world; cap 32 for the shared bake; mask LRU 32; rock threshold slope .15 to .4; large mode and pick stay on MAP.minimap.view until MM6.
- Test tools: tests use fake canvases and the real terrain/chunk masks.

NOT verified (eye-check on a GPU browser)
1. Corner map in the wilds (east of x 330, north of z -330): meadow, no black/blank, tiles sharpen when walking; dashed border at the world edge (x -450 / 1050, z -1200 / 600), outside it dark.
2. Seams between old-ground and wilds at the old rim (x -260..300, z -390..110): colour step or road discontinuity?
3. Sea (south, z over the shoreline) and lakes/rivers in the wilds look right (vector water layer on top of the mask).
4. Load hitch while the BASE bakes (up to 8.7 ms frames for under 1 s): the Dev console prints '[map-bake] base base N ms' only for single jobs over 25 ms (the BASE job total is about 330 ms, so it will print once). Please send that number.
5. Hills (5 only) show a grey rock tint on steep sides.
6. Trees/buildings in the wilds: the bake only draws what game.js passes in (trees() and buildings); wild-chunk trees and buildings are probably not in those lists, so the wilds look empty of dots. Not checked; if so, game.js needs to pass the chunk data (world.js owner).

Needed from forbidden files: nothing required. Optional (perf): world.js could expose its loaded chunk masks so the bake skips its own 270 builds (saves about 200 ms of load work and the 9 ms hitch).
Confidence: high for the bake logic and numbers; medium for the browser look.