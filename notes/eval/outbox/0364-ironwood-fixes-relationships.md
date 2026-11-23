michadr.

## Summary
Resolved all 8 reported Ironwood / NPC / UI bugs and feature requests in local `0.36.4`:
1. **Sam stuck in bakery table + 13 other stuck interior NPCs:** Audited all `25` rooms in `dist/ironwood-interiors.js` against `blocked(x, z)`, added an explicit `bakery` staff layout moving Sam to `(-2.0, 1.4)`, and repositioned every overlapping patron/staff NPC so `0/25` rooms have stuck NPCs.
2. **All NPCs on `#talk` UI:** Added `talkMenu(...)` in `dist/game.js` and migrated downtown clerks (`downtownCounter`, Kiosk POS, Freight Exchange, Harbor Gig, Hall A Welding), interior staff (`iw-npc-*`), Eden Wholesale (`Dana Sato`), Oak Street Lobby desk & resident chats, Ironwood Hotel desk (`Clara Reyes`), crowd NPCs, and street pedestrians/fallback menus into the docked `#talk` panel (leaving non-NPC station dialogs untouched so `tests/no-pause.mjs` stays green).
3. **Named Baker Gemma Atkins & Full Relationship Meter:** Designed and documented `notes/relationship-system-design.md`, built pure rule module `dist/relationships.js`, wired optional `progress.relationships` normalization into `dist/jobs.js` (no `SCHEMA` bump), installed **Gemma Atkins** (`gemma`) as Head Baker at `alder-bakery`, added male-player Romance/Dating/Partner progression & daily Partner bakery perks, and rendered visual Friendship/Romance progress bars in `#talk` (`dist/talk-panel.js`) and Phone **Contacts** (`dist/phone-people.js`).
4. **Bakery exterior front door:** Attached `attachBakeryStorefront(...)` (`bakery-storefront` with glazed double doors, brass pulls, stone step, and illuminated pastry windows) onto `alder-bakery`'s street-facing `+Z` facade in `dist/ridge-clothing-shell.js` + `dist/world.js`.
5. **Low overhangs slicing doors (`IRONWOOD TOWER`, `IRONWOOD OFFICES`, downtown):** Added per-instance `sx/sy/sz` scaling to `createPropInstances` in `dist/props.js`, scaled `overhang-wide` (`sy: 1.72` -> `2.58 m` underside clearance), `overhang` (`sy: 1.40` -> `2.52 m`), and `awning-wide` (`sy: 1.24` -> `2.52 m`) in `dist/downtown.js`, and raised `LEGACY_FRONTS` signs cleanly above canopies.
6. **Eden Ridge Store -> Ridge Clothing:** Renamed `alder-store` to **Ridge Clothing** across `dist/map-definition.js`, `dist/downtown.js`, `dist/npc-roster.js`, `dist/cast-oak.js`, `dist/ironwood-interiors.js`, and `tests/npc-dialogue.mjs`; built a matching see-through exterior showroom (`buildRidgeClothingExterior` in `dist/ridge-clothing-shell.js`) showing racks, mannequins, teal feature wall, and checkout counter through front glass, paired with a matching clothing/gear interior stocking Wardrobe + jackets + rain shells + winter parkas + backpacks.
7. **Floating buildings, slabs, planters & parked cars:** Added `surfaceBaseY(...)` in `dist/ridge-clothing-shell.js` / `dist/world.js` / `dist/neighborhood.js` so all parked vehicles sit flush on `-0.045`/`0.01` surfaces, plus one 1-draw-call `building-plinths` `InstancedMesh` anchoring every building overhanging grass/asphalt edges down to ground.

## Files Created or Changed (with line counts)
- Created:
  - `notes/relationship-system-design.md` (`31` lines)
  - `dist/relationships.js` (`320` lines)
  - `dist/ridge-clothing-shell.js` (`107` lines)
  - `tests/relationships.mjs` (`100` lines)
  - `tests/ironwood-fixes.mjs` (`80` lines)
- Changed:
  - `dist/jobs.js` (`96` lines)
  - `dist/props.js` (`78` lines)
  - `dist/downtown.js` (`82` lines)
  - `dist/map-definition.js` (`1225` lines)
  - `dist/npc-roster.js` (`126` lines)
  - `dist/cast-oak.js` (`373` lines)
  - `dist/neighborhood.js` (`22` lines)
  - `dist/world.js` (`705` lines)
  - `dist/ironwood-interiors.js` (`292` lines)
  - `dist/talk-panel.js` (`192` lines)
  - `dist/phone.js` (`172` lines)
  - `dist/phone-people.js` (`70` lines)
  - `dist/style.css` (`536` lines)
  - `dist/game.js` (`2580` lines)
  - `tests/npc-dialogue.mjs` (`147` lines)
  - `tests/npc-talk-hold.mjs` (`38` lines)
  - `tests/startup.mjs` (`232` lines)
  - `notes/handoff.md` (updated top dated `0.36.4` section)

## Verification Results (real outputs)
- `node tests/relationships.mjs`:
  `PASS relationships: tiers, Gemma Atkins male romance gating/milestones/perks, daily caps, meter spec, and save round-trip.`
- `node tests/ironwood-fixes.mjs`:
  `PASS ironwood-fixes: 0 stuck interior staff, Gemma Atkins bakery, Ridge Clothing see-through shop/stock, cleared overhangs, grounded buildings/cars.`
- `node tests/npc-talk-hold.mjs`:
  `PASS npc-talk-hold: Robert stays in place through street dialogue, town time advances, and he resumes the route without jumping.`
- `node tests/startup.mjs`:
  `Fresh save: creator, phone apps/controls/gigs, and multiplayer frame checks passed.`
  `Existing save: gameplay, phone apps/controls/gigs, and multiplayer frame checks passed.`
- `npm.cmd run index` & `node tests/brief.mjs`:
  `brief 2840 tokens (target 3000), index 32295 tokens (target 37000); 295 modules, 15 generated, 353 tests, 34 scripts; 13 modules without a header comment`
  `brief tests passed: 295 modules listed, brief 2840 and index 32295 estimated tokens (budgets 3000 and 37000)`
- `npm.cmd run release -- --force`:
  `Packaged release 0.36.4: 296 files -> dist/releases/0.36.4`
- `npm.cmd test`:
  `352` of `353` test files passed (`FAILED FILES: hub-runner.mjs`).
  Single retry `node tests/hub-runner.mjs`:
  `AssertionError [ERR_ASSERTION]: stopped near the 97 line: 800000 at tests/hub-runner.mjs:125:41`
  (Pre-existing Hub gauge polling timing check unrelated to the Three.js game; per `AGENTS.md`, left untouched and reported.)

## What Could NOT Be Verified
- Live Chrome / WebGL / WebGPU visual rendering and pointer-lock screenshot eye-check on owner GPU (Chrome DevTools remote debugging `DevToolsActivePort` not active in this sandbox; all geometry/grounding/UI assertions were verified via Three.js `Box3`/scene graph/boot-game headless harnesses).

## Forbidden Files
- None needed.

## Confidence
- Pure relationship rules & save compatibility (`dist/relationships.js`, `dist/jobs.js`): **High**
- Interior NPC separation (`0/25` stuck), Gemma Atkins service, & `#talk` routing (`dist/ironwood-interiors.js`, `dist/talk-panel.js`, `dist/phone-people.js`, `dist/game.js`): **High**
- Grounding plinths, parked cars, bakery door, overhang scale, & Ridge Clothing see-through visual look (`dist/world.js`, `dist/ridge-clothing-shell.js`, `dist/downtown.js`): **Medium-High** (mathematically verified in Three.js scene/Box3 tests; awaits owner's GPU eye-check for storefront aesthetics).
