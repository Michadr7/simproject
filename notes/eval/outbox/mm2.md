michadr.

# MM2: shared map bake (notes/minimap-design.md sections 2, 6, 8, 9)

Files
- NEW dist/map-bake.js (about 150 lines): createBake (BASE 2 m/px + 0.5 m tiles with 1 px gutter, sliced baker with injected clock, LRU/farthest eviction with canvas recycling, want(), invalidateAt(x,z,r), invalidateAll(), setCap, stats, onJob log), makeShadeGrid (built once, sliceable), makeGround, paintRows, landmarkPolys (footprints now rotated polygons), sharedBake(doc, opts) (one bake for every map). relief() moved here; minimap.js re-exports it.
- NEW tests/map-bake.mjs (about 85 lines, 8 groups, fake canvases + fake clock + real terrain colours).
- dist/minimap.js (now about 85 lines, was 96): drawStatic is gone; update() calls bake.step() each frame, draws BASE then ready tiles (tiles only when the view is finer than 1 m per device px) and then the same labels, GP1 route, pin, markers, camera wedge and arrow as before. Zone names and plot ids are drawn per redraw (not baked). Public API kept: update, invalidate (now = rebake all), pick (unchanged), toggle, large; NEW invalidateAt(x,z,r). Optional `bake` option for injection. game.js, phone*.js not touched (game.js still calls invalidate(); MM3 switches it to invalidateAt).
- notes/minimap-design.md: replaced only numbers marked (e): the resolution table bake column (BASE, tile, 1 m, 0.5 m rows), the tile-slicing sentence, and tagged the vector-redraw estimate as "(e, not measurable in Node)". Nothing else.
- Not edited: handoff.md, cap, game.js, phone*.js. No git.

MEASURED (Node 24, real terrain mask, real heightAt, scratchpad script; ground pixels only)
- Per pixel: 0.017..0.019 us/px warm (first cold run 0.118 us/px for the first BASE). The note's estimate was 1..3 us/px: 50..150x too high (the old code was slow because of heightAt per pixel, the shared 4 m shade grid removed that).
- Tile 258 x 258 (66,564 px): 1.1..3.2 ms first run, 1.3 ms warm (20 tiles of today's view). So a tile's pixels fit in one 3 ms slice.
- BASE: today's view 265 x 220: 0.8 ms; whole planned world 750 x 900 (675k px): 11.5..14.5 ms.
- Shade grid: today's view 134 x 111 pts: 20 ms (one time); whole world 376 x 451: 76 ms.
- Dev log in the stubbed game boot: BASE job about 13.7 ms total (incl. shade grid).
- NOT measurable in Node (no canvas): vector layers (water, footprints, plots, trees) per tile, putImageData and drawImage costs, GPU upload. These are the real browser cost now; the dev log prints "[map-bake] kind key ms" for any job over 25 ms so you can read them in the browser console (Dev Mode build).
Frame-rate cost: per frame while baking at most one 3 ms slice (overrun at most one unit of 4096 px = about 0.08 ms of pixel work); idle: zero bake cost. Corner map redraw: one BASE drawImage (plus up to 20 tile drawImages on the large map), same overlays as before. Memory: BASE 265 x 220 x 4 = 0.23 MB, tiles 258 x 258 x 4 = 0.27 MB each, up to 24 cached (6.4 MB) + one work canvas. The phone map no longer bakes a second layer (shares the bake; its first-open hitch goes). Compare today: layer 1200 x 980 at dpr 2 = 4.7 MB plus phone 1.2 MB. The corner small map at dpr 2 now uses the 2 m/px BASE (view 530 m on 400 device px = 1.3 m per px), which is softer than the old 0.44 m/px layer: expected, MM3 fixes it by zooming to 150 m.

Commands (real output)
npm run index: brief 2996 tokens (target 3000), index 26518 tokens (target 32500); 178 modules, 13 generated, 217 tests, 26 scripts; 14 modules without a header comment  (cap untouched; about 6,000 left)
node tests/map-bake.mjs: PASS map-bake: shade grid, ground colours, rotated footprints, sliced budget, BASE first, LRU, invalidateAt, shared bake
node tests/gps-game.mjs: PASS gps-game.mjs: GPS app on the phone, tap drops one pin on a road ... Clear removes it.
npm run release -- --force: Packaged release 0.35.9: 179 files -> dist/releases/0.35.9 / dist/index.html now loads releases/0.35.9/
npm test (last line): All 217 test files passed.

Decisions to confirm (defaults taken)
1. Bake bounds = MAP.minimap.view (x -200..330, z -330..110), NOT MAP.world (1500 x 1800 m): the terrain mask only covers MAP.ground (560 x 500 m), so the rest would be flat meadow. createBake takes `bounds`; switch to MAP.world when the mask grows (BASE cost then 12 ms + shade grid 76 ms, measured above). map-view functions already receive these bounds as an argument.
2. Tile cache cap 24 (TILE_CACHE_FULL = 32 exported, setCap() ready for MM6). Today's whole view on the large map needs 20 tiles.
3. Only one bake slice per frame even with two maps: a second step() within 1 ms of the previous one does nothing.
4. Plot outlines/trees are baked with a width in metres (0.6 m outline, 0.9 m tree dots, at least 1 px); plot ids and zone names are drawn live, not baked.

Known leftovers and notes
- game.js still calls minimap.invalidate() in 4 places (rebakes all dirty tiles + BASE, sliced, no hitch); MM3 should switch to invalidateAt(x,z) there. No edit needed in forbidden files for MM2.
- Pre-existing, left as is: the map canvas (200 x 163) is 1.6% shorter than the view's aspect, so drawing crops 3 px at the bottom while pick() spreads the full height. Same as before MM2.
- Landmark footprints are rotated polygons now, but every landmark today has a yaw of 0, 90 or 180 degrees, so the look is unchanged until a turned one is added.

Eye-check list (nothing seen in a browser)
1. Corner map after load: ground, river, roads, buildings, plot outlines, tree dots all present (BASE only, softer than before at dpr 2); no blank map on the first frames.
2. M (large map, 600 x 490): ground sharpens as tiles arrive (a second or less); no seam lines between 128 m tiles; compare against the old picture.
3. Fell a tree / clear a stump: dot disappears, no flicker to blank, no hitch.
4. Phone GPS app: first open has no 1 s hitch; route, pin, tap-to-pin positions as before.
5. Console (Dev Mode): "[map-bake]" lines only for slow jobs; send the ms numbers if any.

Confidence: high for the bake logic and numbers of the pixel work; medium for the browser draw (blit rects with rounding, seams, vector-layer cost), unverified visually.