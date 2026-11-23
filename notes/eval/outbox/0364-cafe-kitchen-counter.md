michadr.

Alder Coffee & Diner back-kitchen long counter, appliance relocation, prop facing fix, and diner station camera alignment completed in `0.36.4`.

## Files created or changed
- `dist/shops.js` (`61` lines):
  - Tagged `putProp` meshes with `m.name = id` so kitchen/restroom props can be inspected cleanly.
  - Cleared cooking/drink appliances off the front customer service counter (`z = -3.5`), leaving only `cash_register` (and `regBox` fallback) on the front counter + `menu_board` on the wall.
  - Replaced scattered backward `f-stove`, `f-sink`, `f-cabinet`, and twin `f-fridge` props in the back kitchen with one continuous `7.42 m` long north-wall prep counter (`kitchen-counter` at `x ∈ [-6.90, +0.52]`, top `y = 0.84` + cream worktop & `0.90` backsplash lip matching Kenney counters), leaving generous open prep space between stations.
  - Placed `espresso_machine` (`-6.25`), `coffee_grinder` (`-5.55`), `prep_board` (`-4.05`), `flat_grill` (`-2.35`), and `pizza_oven` (`-0.80`) along the back kitchen counter (`y = 0.84, z = -9.18/-9.15`), and moved `machBox` fallback to `(-6.25, 1.115, -9.18)`.
  - Rotated `f-sink` (`0.96, -9.24`), `f-fridge` (`1.96, -9.28`), and restroom `f-bath-sink` (`3.5, -9.38`) to `yaw = Math.PI` (south `+z` into the rooms instead of facing north into the wall) and shifted kitchen `f-table` to `(0.5, -5.65)` so the entire back-counter aisle stays unobstructed.
- `dist/diner-flow.js` (`65` lines): moved `MAKE` to `{x: -3.1, z: -8.0}` in front of the long back kitchen counter (`range: 2.2`, `dinerTarget` place `'Kitchen counter'`), keeping `PASS` at `{x: 1, z: -2.2}` out front.
- `dist/diner-station.js` (`139` lines): updated `STATION_CAM` (`espresso`, `grill`, `prep`, `oven`) and default `sync` position to frame the moved appliances at the back kitchen counter (`y = 0.84, z = -9.18/-9.15`).
- `tests/storefronts.mjs` (`23` lines): added assertions for `kitchen-counter` placement/opacity/non-occluder status, south-facing (`Math.PI`) `f-sink`/`f-fridge`/`f-bath-sink`, back-kitchen `MAKE` and cooking appliance `z` coordinates, and BFS reachability to `MAKE` and all back-room points.
- `notes/handoff.md` (`480` lines): added summary entry under `0.36.4`.

## Tests & commands run (real outputs)
- Focused cafe & diner tests (after final edits):
  - `node tests/storefronts.mjs` -> `Glass sightlines reveal real interiors; no leftover doorBits; counter stays solid/opaque; setLight dims/restores; café work stations & kitchen/restroom reachable with zero grass inside footprint.`
  - `node tests/diner-station.mjs` -> `PASS diner-station: scoring, burn, remake, key paths (1-9/Space/Enter/Esc), and dinerAct wiring`
  - `node tests/diner-wiring.mjs` -> `PASS diner-wiring: hospitality skill, diner tasks and pieces, hours message from the employer, $10 x rank bonus, tips in cents, failed order = -2 rep and no wage dock`
  - `node tests/diner-assets.mjs` -> `PASS diner-assets.mjs: 9 GLBs (2464 tris total, 11 room meshes, 33 food parts <150 tris, all 18 recipes covered), 15 CC0 Ogg clips (223.6 KB total).`
  - `node tests/indoor-camera.mjs` -> `Indoor camera: the walls between the camera and you fade on the upper floor too, the far wall stays, bounded shop rooms clamp inside walls and ceiling, and sub-room zones enter back rooms.`
  - `node tests/diner-game.mjs` -> `PASS diner-game.mjs: hired at Elena on day 1 and clocked in through the talk; order taken, collected at the pass, served with a $0.50-$3.00 tip, table cleared; wage + pieces + tips + $10 x rank bonus paid at clock-out; a forgotten order costs -2 rep and the tip but never wages; promoted to Barista & Cook after 2 counted shifts; an old cafe-employed save loads as a Rank 1 diner employee.`
- Index & token budget:
  - `npm.cmd run index` -> `brief 2840 tokens (target 3000), index 32298 tokens (target 37000); 295 modules, 15 generated, 353 tests, 34 scripts; 13 modules without a header comment`
  - `node tests/brief.mjs` -> `brief tests passed: 295 modules listed, brief 2840 and index 32298 estimated tokens (budgets 3000 and 37000)`
- Packaged release rebuild & startup check:
  - `npm.cmd run release -- --force` -> `Packaged release 0.36.4: 296 files -> dist/releases/0.36.4`
  - `node tests/startup.mjs` -> `Fresh save: creator, phone apps/controls/gigs, and multiplayer frame checks passed.` / `Existing save: gameplay, phone apps/controls/gigs, and multiplayer frame checks passed.`
- Full suite (`npm.cmd test`):
  - `352/353` test files passed (`FAILED FILES: hub-runner.mjs`, pre-existing `AssertionError [ERR_ASSERTION]: stopped near the 97 line: 1000000` at `tests/hub-runner.mjs:125`).
  - Single retry (`node tests/hub-runner.mjs`) failed with the same pre-existing Hub gauge timing flake (`stopped near the 97 line: 900000` at `tests/hub-runner.mjs:125`).

## What could NOT be verified
- Live WebGL/WebGPU rendered visual appearance of the back kitchen counter, appliance alignment on desktop/mobile GPU, Station View camera framing during an active Rank 2+ barista/cook shift, and restroom sink orientation in a real GPU browser session (no active Chrome DevTools debugging target in this environment; needs owner browser check).

## Requested edits to forbidden files
- None.

## Confidence
- High on layout math, Kenney prop south-facing (`Math.PI`) orientation, collision/BFS reachability, diner logic (`diner-flow.js` / `diner-station.js`), and Node test coverage (`352/353` pass + focused tests pass).
- Medium-high on live visual framing during Station View (math verified; desktop GPU visual check awaits owner eye-check).
