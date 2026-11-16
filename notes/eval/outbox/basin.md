michadr.

# Basin walkability (basin)

Result: the lake and fall walkability masks are built and tested. The lake itself is NOT built, because no lake data exists in MAP.

## Changed
- dist/terrain.js (about +7 lines, a minimal edit; world.js was NOT touched, because it needs no change). New step 5c in buildTerrain, just before the bridge decks:
  - Every cell inside a lake outline (MAP.water.lakes) becomes SURFACE.WATER and unwalkable. This is the same rule as the sea.
  - A fall's plunge pool (a disc of pool.r around fallPoolCentre) and its curtain (a ribbon w wide from the lip to the pool) become WATER and unwalkable.
  - Water paints over roads. Bridge decks still win.
  - Import: fallPoolCentre added.
- tests/basin-walk.mjs (new, about 40 lines). It uses a synthetic map with one lake and one fall.
- `npm run index` regenerated: 30449 of 31500 tokens.

## Tests
- `node tests/basin-walk.mjs`: "PASS basin-walk: lake and fall pool masks (9341 lake samples all unwalkable)".
- After `npm run release -- --force`, `npm test` ended with "All 211 test files passed."
- terrain.mjs, terrain-mud-gravel.mjs and road-r3b.mjs also pass. No pins moved, because the shipped map has no lake or fall yet.

## Why there is no lake
- There is a prose design only: map-master.md sections 1.4 and 4 give a basin rectangle 520..800 by -660..-440, y -0.90, depth 2.5, a south beach at x 590..690, and the outflow at (540,-470).
- MAP.water has no `lakes` or `falls` keys, and there is no outline. The lake belongs to stage B1 (Fable, game.js ground and water meshes).
- Everything downstream is already data-driven: height.js (dig), dug-ground.js, water-chunks.js (mesh), the minimap drawWaterLayer, waterAt and validateMap. Adding `lakes:[...]` to map-definition.js should make them all work, and the new mask now follows.

## What the lake data needs
1. An outline polygon, with no self-crossing, inside the world, clear of zones, roads and the Lake Road corridor (keep 20 m south and 30 m east of it).
2. y -0.9, depth 2.5 and a shore (the cosine slope length, about 25 m).
3. `outflow:[540,-470]`, which must be within 15 m of the outline. The river source point (540,-470) has to sit on the outline, so the outline's west tip should reach it.
4. The 6 m fall at the Blackstone stream: lip, drop 6, w, dir, pool {r 6}. The pool is 12 m wide, so r is 6. The stream feeds the lake mouth at (700,-660).
5. Optional: a dock and a beach prop at the south shore.

## DECISIONS TO CONFIRM
- The shore band outside the outline stays walkable GRASS. The dug bank (LAKE_BANK 6 m) is walkable, like the sea beach. I added NO new SURFACE id such as SHORE, because six or more vehicle tables (SURFACE_SPEED, GRIP, ROLL_DRAG, tyre sounds, spray, tracks) would need rows. A sand shore surface and minimap colour would be a small follow-up stage if wanted.
- The whole lake interior is unwalkable, even the shallow rim where depth is under 0.35 m. There is no wading. A walk-in rim (for example depth under 0.3 m) would be a one-line change.
- The fall pool has no mud-bank ring. It is walkable grass right up to the water.

## Not verified
- Nothing was seen in a browser.
- No frame-rate cost: the lake paint runs once per chunk tile build, over the lake bounding box only (about 250k cells for a lake the size of the design basin, with a point-in-polygon test each, tens of ms at most). It does not run for chunks away from the lake.
- Eye-check once lake data exists: the shore line against the water mesh, and the cell-edge sliver at the outline (the test ignores cells within 1 m of the edge).
- Confidence: high for the mask logic (tested against waterAt). The synthetic map is not the shipped one, so real-lake fit is untested.