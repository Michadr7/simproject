michadr.

Fixed the duplicate storefront doors on Alder Coffee & Diner (`cafe`) and Corner Market (`market`) so each building has one shared door visible from both street and interior, aligned storefront framing flush to the doorway jambs, and saved the later-pass Ironwood Arcade design & classic game shortlist.

## Files created or changed
- `dist/game.js` (`2632` lines):
  - Removed the unused `doors.js` import (`createSlidingDoor`, `createDoubleDoor`), removed `roomDoorShown` and its hide/show calls (`enterShop`, `enterDowntown`, `leaveShop`, and initial shop setup).
  - Updated `shopDoors` to reuse `shops[kind].exitDoor` directly instead of spawning a second exterior door group in `scene`.
  - Guarded the exterior `shopDoors` update loop in `updateDoors` with `if (shop !== front.kind)` so street approach logic never overrides `cafe`'s manual double doors while inside.
- `dist/shops.js` (`61` lines):
  - Aligned the storefront sills (`x` inner edge `±1.27`), lintel (`y = 2.88..3.40`), glass panes (`gw = 5.65` / `4.65`), and mullions (outer wall + pane center only, no double posts over door jambs) flush to the doorway frame.
  - Tagged `exitDoor.group.name = kind + '-exit-door'`.
- `tests/storefronts.mjs` (`27` lines): added assertions verifying `room.exitDoor.group.name === kind + '-exit-door'` and flush sill-to-jamb alignment (`|x| - width/2 === 1.27`).
- `tests/startup.mjs` (`248` lines): added checks on entering `cafe` (confirming `cafe-exit-door` and `market-exit-door` are visible and no duplicate unnamed door `Group` sits near `(36, -8.46)` or `(19, -8.46)`) and after leaving `cafe` (confirming `cafe-exit-door` remains visible).
- `notes/arcade-design.md` (`43` lines): saved the later-pass Ironwood Arcade overhaul & game shortlist (`AR-1`..`AR-4`: visual ceiling/neon/carpet + detailed CRT cabinets, angled pinball tables, ping-pong table, 8×8 checkers table, Solo/Co-Op Checkers & Ping-Pong, Ironwood Pinball, and 8 original classic tribute cabinets inspired by the 412-in-1 list).
- `notes/handoff.md` (`485` lines): logged single-door fix and queued `notes/arcade-design.md`.

## Tests & commands run (real outputs)
- Focused tests:
  - `node tests/doors.mjs` -> `Doors: sliding stays automatic; hinged and double doors are manual, swing into the room about their hinges, a pair mirrors, snap shuts without the swing, a handle-less leaf is one mesh; the market is sliding, the cafe and the office have double glass doors.`
  - `node tests/storefronts.mjs` -> `Glass sightlines reveal real interiors; no leftover doorBits; counter stays solid/opaque; setLight dims/restores; café work stations & kitchen/restroom reachable with zero grass inside footprint.`
  - `node tests/map.mjs` -> `Map data is valid and frozen; zones, roads, fields, trees, shops, hours, studio and spawn match the numbers they replaced; 77 broken maps are each caught; Ironwood, Cedar Heights, Eastbank Works, the second bridge and the plots are in place.`
  - `node tests/indoor-camera.mjs` -> `Indoor camera: the walls between the camera and you fade on the upper floor too, the far wall stays, bounded shop rooms clamp inside walls and ceiling, and sub-room zones enter back rooms.`
  - `node tests/diner-game.mjs` -> `PASS diner-game.mjs: hired at Elena on day 1 and clocked in through the talk; order taken, collected at the pass, served with a $0.50-$3.00 tip, table cleared; wage + pieces + tips + $10 x rank bonus paid at clock-out; a forgotten order costs -2 rep and the tip but never wages; promoted to Barista & Cook after 2 counted shifts; an old cafe-employed save loads as a Rank 1 diner employee.`
  - `node tests/talk-game.mjs` -> `PASS talk-game.mjs: Noah, Elena and Hal talk in the docked panel; time runs and walking is locked while talking; Esc says see you without pausing; acts run first and a failed act keeps the old replies; memory saved without derived beats; H7 read-message; recent cafe-shift; Hal hands over the truck at step 3.`
- Index & budget:
  - `npm.cmd run index` -> `brief 2840 tokens (target 3000), index 32298 tokens (target 37000); 295 modules, 15 generated, 353 tests, 34 scripts; 13 modules without a header comment`
  - `node tests/brief.mjs` -> `brief tests passed: 295 modules listed, brief 2840 and index 32298 estimated tokens (budgets 3000 and 37000)`
- Release rebuild & startup:
  - `npm.cmd run release -- --force` -> `Packaged release 0.36.4: 296 files -> dist/releases/0.36.4`
  - `node tests/startup.mjs` -> `Fresh save: creator, phone apps/controls/gigs, and multiplayer frame checks passed.` and `Existing save: gameplay, phone apps/controls/gigs, and multiplayer frame checks passed.`
- Full test suite:
  - `npm.cmd test` -> `352/353` passed; `tests/hub-runner.mjs` hit its pre-existing timing flake (`AssertionError [ERR_ASSERTION]: stopped near the 97 line: 800000` at `tests/hub-runner.mjs:125`).
  - Single retry `node tests/hub-runner.mjs` -> `hub-runner: ok` (**PASS**).

## What could NOT be verified
- Live GPU browser inspection of the single shared doorway seam from street and interior during daylight/night lighting and swinging double-door animation (no active Chrome remote debugging target here; needs owner browser check).

## Requested edits to forbidden files
- None.

## Confidence
- High on single-door scene ownership (`cafe-exit-door` / `market-exit-door`), flush storefront frame geometry math, `startup.mjs` + `storefronts.mjs` checks, and `352/353` + `hub-runner` retry pass; visual GPU check in live browser awaits owner verification.
