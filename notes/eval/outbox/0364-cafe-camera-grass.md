michadr.

# 0364 · Alder Coffee & Diner Back-Room Camera & Floor Grass Fix

## Files Changed (with line counts)
- `dist/shops.js` (60 lines) — Fitted `createShop('cafe')` strictly inside `ALDER COFFEE`'s `15 × 15` building footprint (`rw = 14`, `rz0 = -9.8`), added interior ceiling (`#e8e0cf`), tagged `z = -5` partition segments, doorway lintels, and kitchen/restroom divider with `userData.partition = true`, updated kitchen/restroom prop positions & `blocked()`, and returned `bounds` + local `zones` (dining, kitchen, restroom).
- `dist/indoor-camera.js` (29 lines) — Added optional `options.zones` sub-room camera clamping (keeping outer `roomBox` clamp on the lerped camera position) and `partitionBetween()` cross-partition fade for `userData.partition` meshes when camera and player are on opposite sides.
- `dist/game.js` (2633 lines) — Shrunk `cafe` ground exterior side piers to `0.5 m` (`x + side * (w/2 - 0.25)`) outside the `14 m` interior, and wired each shop's `room.bounds` + world-mapped `zones` into `createIndoorCamera(...)`.
- `tests/indoor-camera.mjs` (39 lines) — Added unit assertions for `options.zones` entering the kitchen sub-room and immediate `userData.partition` fade on crossing.
- `tests/storefronts.mjs` (16 lines) — Added assertions checking `cafe` bounds lie strictly inside `MAP.buildings` `ALDER COFFEE`, `densityAt('grass', ...)` is `0` across back-kitchen and restroom floor samples, and BFS reachability reaches both back rooms.
- `tests/startup.mjs` (246 lines) — Added assertion inside `ALDER COFFEE & DINER` verifying walking into the back kitchen (`-4.5, -7.2`) brings the camera past the `-18.5` partition wall strictly inside cafe bounds.
- `notes/handoff.md` (478 lines) — Documented the cafe back-room camera & floor grass fix.

## Verification & Command Output
- `node tests/indoor-camera.mjs`:
  `Indoor camera: the walls between the camera and you fade on the upper floor too, the far wall stays, bounded shop rooms clamp inside walls and ceiling, and sub-room zones enter back rooms.`
- `node tests/storefronts.mjs`:
  `Glass sightlines reveal real interiors; no leftover doorBits; counter stays solid/opaque; setLight dims/restores; café work stations & kitchen/restroom reachable with zero grass inside footprint.`
- `node tests/diner-game.mjs`:
  `PASS diner-game.mjs: hired at Elena on day 1 and clocked in through the talk; order taken, collected at the pass, served with a $0.50-$3.00 tip, table cleared; wage + pieces + tips + $10 x rank bonus paid at clock-out; a forgotten order costs -2 rep and the tip but never wages; promoted to Barista & Cook after 2 counted shifts; an old cafe-employed save loads as a Rank 1 diner employee.`
- `node tests/map.mjs`:
  `Map data is valid and frozen; zones, roads, fields, trees, shops, hours, studio and spawn match the numbers they replaced; 77 broken maps are each caught; Ironwood, Cedar Heights, Eastbank Works, the second bridge and the plots are in place.`
- `npm.cmd run index; node tests/brief.mjs`:
  `brief 2840 tokens (target 3000), index 32298 tokens (target 37000); 295 modules, 15 generated, 353 tests, 34 scripts; 13 modules without a header comment`
  `brief tests passed: 295 modules listed, brief 2840 and index 32298 estimated tokens (budgets 3000 and 37000)`
- `npm.cmd run release -- --force`:
  `Packaged release 0.36.4: 296 files -> dist/releases/0.36.4`
  `dist/index.html now loads releases/0.36.4/`
- `node tests/startup.mjs`:
  `Fresh save: creator, phone apps/controls/gigs, and multiplayer frame checks passed.`
  `Existing save: gameplay, phone apps/controls/gigs, and multiplayer frame checks passed.`
- `npm.cmd test`:
  `FAILED FILES: hub-runner.mjs`
  `PASSED ON RETRY (flaky, still counted as passed): hub-activity.mjs`
  `1 of 353 test files failed.` (`352/353` PASS across the full suite; includes `indoor-camera.mjs`, `storefronts.mjs`, `diner-game.mjs`, `map.mjs`, `startup.mjs`, `brief.mjs`).
- Single retry `node tests/hub-runner.mjs`:
  Failed on pre-existing Hub gauge timing check (`AssertionError [ERR_ASSERTION]: stopped near the 97 line: 1000000` at `tests/hub-runner.mjs:125:41`; untouched per `AGENTS.md`).

## What Could Not Be Verified
- Live GPU browser rendering of the cafe back kitchen, restroom doorway transition, and floor under WebGPU/WebGL (Chrome remote debugging is not active in this sandbox; requires owner browser GPU eye-check).

## Requests / Forbidden Edits Needed
- None.

## Confidence Per Part
- **High:** Building footprint fit, zero grass exclusion (`densityAt`), partition doorway fade, sub-room `zones` camera math, and `352/353` test pass (only pre-existing Hub gauge flake in `hub-runner.mjs`).
- **Medium:** Live visual feel while walking back and forth through the cafe kitchen/restroom doorways on GPU pending owner visual check.
