michadr.

# Stage W-PLACE: Eden Wholesale placed in the map (2026-11-19)
Agent: Opus subagent. I did not run git or commit anything. I was the only agent editing game.js and map-definition.js during this stage.

## Result
- Eden Wholesale now stands on the owner's site behind the Pharmacy and Bank:
  - Plot C21: footprint x 30..42, z -72..-63, yaw 0.
  - The door is at (33.7, -63.7) and faces south.
  - The dock is at (39.7, -63.0), the pickup at (39.4, -64.1) and the truck bay at (39.7, -59.2).
- The building is a real GLB:
  - game.js loads it with GLTFLoader.
  - Collision is the registry's SOLIDS.
  - It is an ordinary landmark, so collision, ground cover, street furniture, the maps and the door prompt all treat it like the other buildings.
- **Gate results:**
  - `npm run release -- --force`, then `npm test`: **ALL 330 PASSED**.
  - Index: 36251 of 37000.
  - Real output is pasted below.

## How the load works (option A, plus one hook)
A landmark with only a `model` field would crash world.js, town.js, map-bake.js and other places that call `propInfo(l.prop)`. Those files belong to other lanes, and world.js must not be edited. So I did this instead:
- **The landmark** is `{id:'eden-wholesale', prop:'eden-wholesale', model:'assets/buildings/eden-wholesale.glb', plot:'C21', zone:'alder', x:36, z:-67.5, yaw:0}`.
- **validateMap** now accepts a `model` field. The model must be a `.glb` path under `assets/` with no `..`, and the landmark must also have a `prop`. tests/map.mjs has 2 new broken-map cases for this.
- **The `eden-wholesale` prop** is a placeholder entry in **dist/placeholders.js**. That file was not on my list (see "Files outside my list"). It works like this:
  - Its data comes from the new pure module dist/eden-wholesale-place.js: footprint 12 x 9, the 8 SOLIDS as colliders, and the shop door.
  - `build(fade)` returns an empty group named `prop-eden-wholesale`, carrying `userData.model` and `userData.fade`.
- **game.js, new line 426:**
  - Finds that group and loads the GLB into it.
  - Splits the single primitive into 3 material groups with `splitTriangles`:
    - body: 2928 triangles, with the sightline fade;
    - window glass: 112 triangles;
    - lamp lenses: 14 triangles (emissive).
  - If the file is missing, it warns in the console. The building then stays invisible but is still solid.
- **game.js, new line 1869 (right after nightLights.update):** sets the glow from `glowAt(sky.minutes, sky)`. It uses the picture's time, as night-lights.js does. It only changes a uniform, and only when the state changes.

## Site problems from the brief
| Problem | What I did |
|---|---|
| Parked cars at the door | Lot bays 20 -> 17 (bays 18-20, x 32.4..40.5, are gone). park-lot-6 moved from bay 19 to bay 2 (x -9.45). park-lot-5 moved from bay 17 (x 31.05, right beside the door) to bay 11 (x 14.85). No car is left anywhere in x 29.7..45. |
| Hydrant at (42, -63) | No hydrant is there. The only hydrant near the site is (44.5, -71) on the Ironwood Street west sidewalk (frontage st-w-s). I checked this in the map data and in the live scene. It is 2.5 m east of the east wall and 8 m behind the front, clear of the footprint, the dock and the truck bay. In the screenshots it is the red post you see beside the dock. I left it where it is. |
| Ground cover inside x 30..42, z -72..-63 | Cleared. world.js builds the ground cover from the landmark footprints, and the test checks that this rectangle is one of them. The 1.5 m grass strip between Barber's Walk and the west wall had tufts poking up, so I paved it (see "Footway"). |
| No window glow | The window glass glows in the night-lights window colour (#ffc978, strength 1.25). It follows the night-lights shop rule with staff hours 06:00-19:30. I used staff hours because trading hours (07:00-17:00) fall wholly in daylight, so the windows would never light. Seen lit at 18:46 and dark at 21:31. |
| Lamp lenses need emissive | Done. They glow at 2 in the dark and 0.15 by day. No PointLights were added (frame rate). |

## Other map changes
- **Footway (2 new drawn pavements):**
  - x 26.5..37.5, z -63..-61.5. It runs from the foot of Barber's Walk along the shop front to the dock's west edge.
  - x 28.5..30, z -72.5..-63. This is the strip along the west wall to the staff door at (30, -71).
- **Why the footway was needed:** the lot is ROAD. Town walkers may not walk on it, and the property's walk point (36, -62) lies there. In the first test run this made walk-legs fail: Carlos walked over grass at (29.3, -68.7). The dock and truck bay (x 37.5..42) stay flat asphalt, so trucks do not hit a kerb.
- **Property:** `{id:'eden-wholesale', type:'shop', plot:'C21', name:'Eden Wholesale', company:'Eden', enterable:false, reason:...}`.
  - I dropped the `owner` field on purpose. population.js turns an NPC owner of a property into a resident living in it, which added "Bruce Hughes" as a new town walker with no talk cast. Bruce Hughes is still `OWNER` in dist/eden-wholesale.js.
- **Staff:** `{id:'eden-wholesale', at:{property:'eden-wholesale'}, role:'Clerk', hours:[420,1020]}`.
  - I put it LAST in `posts`. When it sat beside the Bank, the resident Carlos moved from the police to Eden, and a new police commuter appeared.
  - At the end of the list, the post is filled by a new commuter, `commuter:eden-wholesale`, "Dana Sato".
- **bakery-goods.js:** `SUPPLIER = 'property:eden-wholesale'` and `SUPPLIER_LABEL = 'Eden Wholesale'`. The note text is updated, and its test now checks this.
- **Not done, on purpose:**
  - No sidewalk lamps; the lamp tests stay at 40.
  - The Alder Ave store plot was not touched.
  - No version bump.

## Files outside my list (please check)
- **dist/placeholders.js** (39 lines, +4): one import plus the `'eden-wholesale'` entry. This was the smallest hook that let the GLB be a normal landmark without editing world.js.
- **dist/cast-crowd.js** (557 lines, +24): one PLACEHOLDER crowd cast entry for Dana Sato, the Eden clerk.
  - Without it, tests/talk-cast-crowd.mjs fails: every town person needs a cast.
  - The lines are plain and marked PLACEHOLDER in a comment, so the content writer (Neo/Gemini) can replace them.
  - The validator passes: 0 errors and 0 warnings.

## Files changed (line counts after; all without a BOM; CRLF kept in map-definition.js and game.js, with 0 lone LF)
| File | Lines | Change |
|---|---|---|
| dist/eden-wholesale-place.js | 32 | NEW, pure: `PROP_INFO`, `POSE`, `splitTriangles`, `isGlassSrgb` and `isGlassLinear`, `glowAt`, `WINDOW_HOURS`, `LAMP_GLOW`. |
| dist/map-definition.js | 1173 | Plot C21, property, post, landmark (with `model`), lot 17, 2 cars moved, 2 pavements, `validateMap` model rule. |
| dist/game.js | 1972 | +2 lines (426 and 1869). |
| dist/bakery-goods.js | 30 | `SUPPLIER`. |
| dist/placeholders.js | 39 | See "Files outside my list". |
| dist/cast-crowd.js | 557 | See "Files outside my list". |
| tests/eden-wholesale-place.mjs | 75 | NEW. |
| tests/map.mjs | 180 | C21 in the plot list; 2 broken-map cases. |
| tests/town.mjs | 75 | Street-wall rows leave out C21; 20 drawn pavements; 33 bays. |
| tests/properties.mjs | 64 | `eden-wholesale` in the list. |
| tests/bakery-goods.mjs | 40 | Supplier asserts. |
| PROJECT-INDEX.md | | Regenerated. |
| notes/eval/outbox/eden-wholesale-place-*.png | 6 images | Screenshots, listed below. |

## Tests (real output)
```
> node tests/eden-wholesale-place.mjs
PASS eden-wholesale-place: C21 x 30..42 z -72..-63 (yaw 0), 8 SOLIDS colliders, door (33.7, -63.7), 17 lot bays and no car at its front, footway to the counter, 2928/112/14 body/window/lens triangles, windows lit 06:00-19:30 in the dark, supplier property:eden-wholesale
> node tests/bakery-goods.mjs
PASS bakery-goods: 2 goods, 6 models (flour-sack 788, flour-carry 788, flour-pallet 2348, coffee-beans-sack 800, coffee-beans-carry 800, coffee-beans-pallet 2396 triangles), supplier property:eden-wholesale
> node tests/talk-cast-crowd.mjs
PASS talk-cast-crowd.mjs: 20 crowd casts validated against 9 named casts (0 errors, 0 warnings), 1080 sweep contexts (4320 terminal walks, 3200 bubbles), place-aware npc-chat passed.
> node tests/walk-legs.mjs
PASS walk-legs: 16 town walkers, 70 Alex/Malik legs (min 42.1 m >= 40 m), 36282 24h poses all on pavement graph
> npm run release -- --force
Packaged release 0.36.2: 273 files -> dist/releases/0.36.2
dist/index.html now loads releases/0.36.2/
> npm test
ALL 330 PASSED
All 330 test files passed.
> npm run index ; node tests/brief.mjs
brief 2834 tokens (target 3000), index 36251 tokens (target 37000); 272 modules, 14 generated, 330 tests, 33 scripts; 13 modules without a header comment
brief tests passed: 272 modules listed, brief 2834 and index 36251 estimated tokens (budgets 3000 and 37000)
```
- **The first full run** (before my fixes) failed 2 files: needs-loop and talk-cast-crowd.
  - Both came from the staff post: Carlos changed jobs, and the new people had no cast.
  - Moving the post last, dropping `owner` and adding the cast entry fixed both.
- **The final full run:** 330 of 330 passed.

## Screenshots (headless Edge, scripts/browser-lab.mjs, software WebGL "WebGL2 via WebGPU", about 4 FPS)
All are in notes/eval/outbox/:
- `eden-wholesale-place-front-day.png`
- `eden-wholesale-place-dock-day.png`
- `eden-wholesale-place-west-day.png`
- `eden-wholesale-place-carpark-top.png`
- `eden-wholesale-place-front-dusk-1845.png`: the windows lit.
- `eden-wholesale-place-front-night-2130.png`: the windows dark, the lenses on.

Checks run in the page:
- The group holds `eden-wholesale-model`, with groups of 8784/336/42 indices.
- `blockedAt(36, -69)` is true and the counter (33.7, -62.6) is open.
- The emissive values were [1, 1.25, 2] at 18:45 and [1, 0, 2] at 21:30.

I looked at all 6 images:
- The building sits flush between the Pharmacy/Bank backs and the car park.
- No car stands at its front, and the footway joins Barber's Walk.
- No grass shows inside the footprint or along the west wall.
- The sign reads clearly.

## What I could NOT verify
- **Nothing was checked on a real GPU** or at real frame rates. Colours and glow strength may look different there; the windows read as flat cream, like the Kenney windows next to them.
- **The lamp lenses** are tiny in the shots, so their glow is hard to judge.
- **Not checked in play:** walking onto the dock, a truck backing into the bay, or the door prompt ("Eden Wholesale · not open").
- **The dock apron is 0.15 m high**, but the prop has `floor: null`. Feet will sink 15 cm on it, as the v1 report already noted. A follow-up could add `floor:{x0:1.4,x1:6,z0:1.2,z1:4.5,y:.15}` to `PROP_INFO`. I did not add it, because vehicles may also read floors.
- **Draw calls:** the building costs 3 draw calls (3 material groups) plus its shadow pass, where a one-material prop costs 1. Triangles: 3054.

## Not done / requests for other lanes
- **The sign text quad was NOT added.** The v2 model has the words baked in as 3D letters (`SIGN.baked: true`), so a quad would print them twice. The node `sign_eden_wholesale` is still there if a glow or a swap is wanted later.
- **Pocket retail items (flour bag, ground coffee) are NOT wired.** That needs items.js plus the counter interaction in game.js, which belong to the bakery wiring or game.js lane. The exact request:
  - (a) Add 2 items to dist/items.js: `flour-bag` ('Bag of flour', small, pocket) and `ground-coffee` ('Ground coffee', small, pocket).
  - (b) Add a counter prompt at `worldPoint(COUNTER, POSE)` = (33.7, -62.6), gated by `isOpen(minutes)` (07:00-17:00). It sells those 2 items to the inventory.
  - (c) Add the bakery cargo gigs (pickup at (39.4, -64.1), stock pallets at the `STOCK` points). `SUPPLIER` is already set.
- **The "loading zone" paint** on the old bays 18-20 is not drawn. That would need town.js markings.
- **Dana Sato's talk lines** are placeholders; the content writer should rewrite them.

## Confidence
- **Map data, collision, cover, furniture, car park, footway and supplier: high.** The tests and the in-page checks pass, and the screenshots match.
- **GLB load and the 3-group split: high.** I saw it in the live page, and the window classification is checked against the real file.
- **Night glow: medium-high.** The values were measured in the page and the shots look right, but nothing was seen on a real GPU.
- **The two files outside my list: high** that they work and pass the tests. **Medium** that the owner wants them done this way; the alternatives were editing world.js (forbidden) or dropping the Clerk post.
