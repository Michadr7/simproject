# Streaming brief (F0, 2026-11-14)
Design only. Frame: notes/map-master.md section 1 (100 m chunks, 15 x 18 = 270, load ring 5 x 5, keep ring 7 x 7).
(m) = read in the code or computed from code values; (e) = estimate. Read with Grep and ranges only, not run.

## 1. The world today
| Part | How it is built (m unless marked) | Culled per frame? | Global data it depends on |
|------|------------------------|-------------------|---------------------------|
| Zones, ground layers, river valley, hills | createWorld (world.js 196) builds all once into group 'world-zones'; ground layers = polygonOffset ranks (GROUND_LAYERS, 10 levels) | camera frustum only | MAP.zones, MAP.ground x -260..300, z -390..110 |
| Road marks, fences, paint, street furniture, lamps | one InstancedMesh per part for the whole map | no | MAP roads, fenceSegments() |
| Trees | worldLayout() (world.js 93); one InstancedMesh per model per material, 16 draw calls; rebuild() refills slots by distance (view 158 m, cone) | yes, distance + cone (cullStats, tests/culling.mjs) | layout.cuttable + layout.decor; tests/map.mjs line 30 hashes x,z of both lists IN ORDER |
| Eastbank Works | createEastbank (eastbank.js 37): merged paving + per-yard prop chunks | yes: eastbank.update(x,z) hides far yards | colliders.box |
| Colliders | createColliders (world.js 127): spatial hash, BUCKET 4 m, keys by world coords, circle/box, `active` flag, blocked(x,z) checks 3 x 3 buckets | n/a | 19 uses in world.js, 13 in game.js, plus apartment, interiors, parcels, props, rigged-props (m) |
| Walk mask | buildTerrain (terrain.js 34): 0.5 m cells, 3 Uint8Array (walk, surface, zone) of 1120 x 1000 = 1.12 M cells, 3.4 MB (m); built once (test asserts < 2000 ms and terrain() shared) | n/a | validateTerrain = reach() flood fill from spawn over the whole grid |
| Night lights | createNightLights({cityWindows, cityLampHeads}) (game.js 381): global lists handed over at start | not verified | cityWindows array |
| Minimap | createMinimap({cityRoads, buildings, trees}) (game.js 1093); drawStatic paints once, view x -200..330 | n/a | whole-map lists |
| Safe spot, teleport, saved position | findNearestClearSpot(blocked,...) (game.js 405, 414); save holds world x,z | n/a | colliders.blocked |
Not verified: multiplayer position code (no hit for a position send pattern), lamp light count, total draw calls today, test run times.

## 2. Design
### 2.1 dist/chunks.js (pure, no three.js, unit-testable)
- `CHUNK = 100`, `WORLD = {x0:-450, x1:1050, z0:-1200, z1:600}`; for F1 WORLD = today's ground grown to whole chunks.
- `chunkIndex(x,z) -> {i,j}` (i = floor((x+450)/100)); `chunkKey(i,j) -> 'i:j'`; `chunkBounds(i,j) -> {x0,z0,x1,z1}`.
- `chunksAround(x,z,ring) -> [{i,j,d}]` sorted by ring distance, then by dot with travel direction (arg `dir`).
- `splitByChunk(items, getXZ) -> Map<key, items[]>` keeps each item's GLOBAL index (`item.gi`) so order never changes.
- `chunkData(i,j)` = the slice of every map list (trees, props, landmarks, roads, lamps, windows, parked cars, signs) for that chunk; computed once from MAP at load (data is small; meshes are not).
- `maskTile(i,j) -> {walk,surface,zone}` 200 x 200 cells (40,000, 120 KB) (m arithmetic), painted by the same rect/paint code as buildTerrain, clipped to the chunk.
### 2.2 dist/chunks-view.js (three.js side)
- `createChunkView({scene, colliders, fade, nightLights})` returns `{update(x,z,dir,budgetMs), ensure(x,z) -> Promise, isReady(x,z), stats(), disposeAll()}`.
- `build(chunk)`: merged static mesh per material (ground tile, paving, road marks, fences), landmarks, collider registration, mask tile, window/lamp entries handed to night lights and fade.
- `dispose(chunk)`: geometry.dispose(), remove from scene, colliders set `active=false` and drop from buckets, remove from night lights/fade, free mask tile.
- Queue: `update` pops build steps until `budgetMs` (default 2) is spent; each chunk build is split into steps (data, mask tile, colliders, one mesh per step) so no single step is over about 1 ms (e).
### 2.3 What is per chunk / global
- Per chunk: ground tiles, paving and road marks, fences, landmarks and buildings, props, colliders, mask tiles, lamps and night-light windows, parked cars (drawn), signs, water segments of river/lake.
- Trees and street props stay ONE InstancedMesh per type for the whole ring (16 tree calls stay 16); chunks only add/remove instance entries.
- Global: sea plane, sky, fog, player, vehicles in use, interiors, road graph, MAP.zones list, minimap data (built from data, not meshes), chunkData for all 270.
### 2.4 Unloaded chunks
- Colliders and mask are needed only inside the inner 3 x 3 (e); since 5 x 5 loads first, the player never meets an unloaded chunk at walking or driving speed.
- Hard rule: `isWalkable`/`blocked` on an unloaded chunk return BLOCKED (wall at the ring edge), plus a console warning; never "free".
- Fallback for tests and server-side use: `terrain()` keeps a whole-map build ONLY in Node (tests); the browser uses tiles.
- Far NPC trucks follow the road graph with no collision (map-master 1.2).
### 2.5 Pre-load before use
- Spawn, load save, teleport, respawn, safe spot: `await view.ensure(x,z)` (builds the 3 x 3 synchronously behind the loading screen or a 1-frame fade), THEN findNearestClearSpot, THEN place. game.js hooks become one line each.
- Saves stay world coordinates (offset 0 keeps old saves valid).
### 2.6 Far things, lights, map
- Parked cars, cargo, plots: data keyed by world position; meshes only while the chunk is loaded; vehicle in use is global and pins its chunk ring.
- Night lights / sightline fade: each chunk registers its windows and lamps on build (`nightLights.add(chunkKey, list)`, `fade.add(...)`) and removes them on dispose; real light pool of about 8 nearest lamps (e).
- Minimap and a future map screen draw from chunkData and the road graph (no meshes); drawStatic repaints only when the view crosses a chunk.
### 2.7 Pinned tests stay green
- Tree hash: worldLayout() stays the single source and runs over the whole map once; chunks only bucket it (`gi` kept). Hash and counts unchanged by design. Add a test: union of all chunk slices == worldLayout() in order.
- terrain.mjs: the Node build stays whole-map; add a test that every maskTile equals the matching window of the whole mask (sample 1 in 7 cells for time).
- culling.mjs: cullStats keeps its shape; `allTriangles` counts loaded chunks only (state it in the test).

## 3. Hitch budget (all e)
- Chunk work: 2 ms per frame (budget at 165 FPS is 6 ms); 4 ms while the player is still (loading screen: no cap).
- Priority: inner 3 x 3 first, then the 5 x 5 by distance, ties broken toward the direction of travel; cancel queued chunks that left the keep ring.
- Merged meshes: about 8 draw calls per chunk, 3 sparse, 20 dense; 25 chunks about 200 + 100 shared = under 300.
- Dispose: only when outside 7 x 7 AND 2 s later; at most 1 dispose per frame; reuse materials (never clone per chunk).
- Memory: 0.5 to 2 MB geometry per chunk, 49 kept at most = under 100 MB; mask tiles 49 x 120 KB = 6 MB.

## 4. Stage briefs (Sonnet)
Order of dense-file edits in every stage: 1) new file + its test, 2) world.js, 3) game.js one-line hooks LAST. Run `npm test` after each (tests run the packaged release: see memory notes).

**F1 Streaming on the old map.** Goal: chunk system live on today's map, no visible change. Files: NEW dist/chunks.js, dist/chunks-view.js, tests/chunks.mjs; world.js (move building into build steps, colliders get `remove`); terrain.js (maskTile); game.js hooks (update, ensure at spawn/load/teleport/safe spot). Checks: npm test all green incl. map.mjs hash unchanged; browser-lab: frame time p99 and max while driving the old loop, chunk build ms per frame (stats()); FPS on the user's GPU at Oak Street, the bridge, the Eastbank yard. Done: FPS near 165 at the three spots, no frame over 16 ms at chunk edges, draw calls under 300, teleport/load lands on solid ground.

**F2 World rectangle.** Goal: WORLD x -450..1050, z -1200..600, ground per chunk, empty chunks cheap (1 to 3 calls). Files: map-definition.js (ground, edge scenery rects of line about 453 move to new edges), chunks.js constants, world.js. Checks: npm test; whole-map mask NOT built in the browser (assert in stats); memory in browser-lab under the cap; same three FPS spots plus one empty chunk. Done: walk to every edge, no holes, load time not worse than today +10%.

**F3 Pinned tests.** Goal: map-master 1.7 list updated; whole-map scans go per chunk or sample. Files: tests/*.mjs only (height, terrain, map, roads, town). Checks: npm test time measured before and after; reach check on a 2 m coarse grid. Done: all green, test time at most 1.5 x today (today not measured: measure first).

**RU6 Performance gate.** Goal: tests that fail when streaming regresses. Files: tests only (tests/perf-gate.mjs). Checks: chunk build step max ms (Node, geometry only), draw call count per dense chunk at most 20, ring of 25 at most 300, maskTile build under 5 ms, chunksAround order. Done: in npm test, under 3 s.

## 5. Risks
1. world.js builds everything in one closure; splitting it into chunk steps is the biggest rewrite (high).
2. Colliders are pushed from 7+ files with no owner; a missed one stays forever or is lost on dispose.
3. Instanced trees/props across chunks: slot bookkeeping must survive felling, regrowth and saplings (culling.mjs pins this).
4. Test time grows about 10 x if Node keeps whole-map scans at the new size.
5. Night lights and minimap take global lists at start (game.js 381, 1093); they need add/remove APIs.
6. Multiplayer: remote players in unloaded chunks; position code not verified.

## 6. Open questions for the user
1. Is a short fade (under 0.5 s) OK on teleport and load while the 3 x 3 builds?
2. Wall at the ring edge if streaming lags (safe) or let the car drive on (risky)?
3. Should far trucks and NPCs freeze when no one is near, or keep running on the road graph?
4. Keep the whole-map mask in tests only, or also a coarse 2 m map in the browser for the map screen?
5. Is 165 FPS the target at all three spots, or is 144 acceptable in the Eastbank yard?
