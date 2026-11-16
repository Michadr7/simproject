michadr.

# W-D1: world saves, daily tick, supply, pumps (wiring)

## Files (lines)
- dist/world-tick.js NEW (70): runWorldDay, worldDue, tickTargetDay, pumpGate, pumpSold.
- tests/world-tick.mjs NEW (98).
- dist/world-state.js (132): world.pump {gas,diesel} (mgal sold, not yet taken from the gallon stock), SUPPLY step in worldTick, pumpAvailMgal, pumpSell (uses buy()).
- dist/world-goods.js (61): SUPPLY, PALLET_LINK, CRATE_UNITS, PUMP_PLACE, SOLD_OUT_TEXT.
- dist/npc-roster.js (79): Oscar/Lincoln/Brentster now dwelling:oak-apartments flats 9/10/11 (personIds oak-apartments/9#1, /10#1, /11#1), assumed:false.
- dist/jobs.js (63): freshProgress + normalizeProgress carry world, needs, npcs, standing.
- dist/game.js: 1 import line, 1 frame line (the tick), fuelTick and canTick pump hooks (about 8 edited statements, no rewrite).
- tests/npc-life.mjs (roster home assertion), tests/save-file.mjs ("tight disk" 3000 -> 7000 bytes, because a normalised save is 1.9 KB bigger).
- DESIGN.md line 105 (4.6) rewritten: stock IS saved, runs down with demand, refilled by producers, players and the supply truck.

## Steps
1. Roster fixed. `node tests/npc-life.mjs` -> PASS npc-life ...; `node tests/population.mjs` -> population tests passed: 24 residents in 16 households, 4 commuters, 22 posts.
2. Save shape. Old saves load with fresh defaults (fresh world day = today's tick day, so no 14-day flood); garbage is safe; starter untouched (tested). Fresh save bytes (JSON of {version,progress}): before 1216, after 3113 (+1897). `node tests/jobs.mjs` passes.
3. Tick. runWorldDay: NPC moodTick per missed day (cap 14) -> world catchUp (demand = visitCounts of all 28 people via dayPlan, Hal sick = farm output x0.5) -> pallets mirrored in -> expire (keeper mood hit applied AFTER the moodTick, so the hit is visible instead of drifting away the same tick; small deviation from the listed order) -> needsFrom (sick NPCs become errand sickNpcs wanting bread from the market; other needsFor seeds only if the place has a map point and, for restock/harvest, the world holds that good).
   game.js: `if(worldDue(progress, !multiplayer.online||multiplayer.isHost)) progress=runWorldDay(progress)` right after sessionStep. Covers 05:00, load (first frame) and sleep/pass-out (next frame after the fade). Guard = world.day; once per day number; a co-op guest never ticks.
4. Supply: SUPPLY = bakery -> market bread 6/day, bakery -> cafe bread 3/day, sawmill planks -> Eastbank Building Supplier 6/day (market and cafe sell no planks, so I used the supplier shop; owner can change). Moved, never made, capped at the shop's target; stopped on blocking events. Planks link: PALLET_LINK constant; at each tick the world's office:ridgeline-warehouse planks := totalPlanks(progress.companies.ridgeline) when that company has pallets (pallets are the truth). LEFT: the world's daily 'use' at the warehouse is not taken out of pallets, and sawmill planks do not become pallets by themselves (the player hauls them); sawmill stock and pallets are two numbers. Eggs: GOODS.eggs.unit = dozen; CRATE_UNITS.eggs = 4 dozen per crate (PLACEHOLDER, my choice), so STORY_CRATES 4 = 16 dozen (whole), fits the market shelf (max 60) and shortbed/worktruck crate capacity (22/16), flatbed 0. Tested. starter.js not edited.
5. Fuel: pumpGate/pumpSold in game.js around sell() and fillCan(); stock 0 -> toast 'Sold out until the next delivery.' and the fill stops (also when the last gallon runs out mid-fill). fuel.js untouched; fuel test passes.
6. DESIGN.md done.

## Test output (real)
- node tests/world-tick.mjs:
  worldDue: 18 ns a call
  one-day tick 0.34 ms; 14-day catch-up  3.47 ms
  PASS world-tick: save shape, 05:00 boundary, once per day, catch-up 14, determinism, 7 days -> needs, supply conserved, pallet link, dozens, pump stock, no clock/chance
- world-state: PASS ...; needs: PASS ...; npc-life: PASS ...; starter ok; starter-game ok; jobs passed; fuel passed; gigs ok; gigs-game ok; population passed; schedule passed (28 people over 21 days); npc-walk PASS (28 people, 174 walking blocks). startup exits 0 (prints a harmless "Image is not defined" warning; it runs the OLD packaged release, so it does NOT exercise my game.js).
- node --check OK on game.js, jobs.js, world-tick.js, world-state.js, world-goods.js, npc-roster.js.
- Ran all 238 tests/*.mjs one by one (not npm test): 3 fail, none from logic I changed:
  * brief.mjs: "a dist module is missing from PROJECT-INDEX.md" -> needs `npm run index` (owner; new file world-tick.js, and the W-A..C modules are also missing from it).
  * pause-menu.mjs: runs the packaged release, "Image is not defined" in ground-cover-view (release not rebuilt; I did not run npm run release). Not caused by my edits, but I could not confirm it passes after a rebuild.
  * save-file.mjs: was failing because of the bigger save; fixed (tight disk 7000 bytes); now passes.

## Per-frame cost
Outside the tick: worldDue = 3 property reads + 1 compare, no allocation, measured 18 ns. Not literally 0. The tick itself runs once per day number: 0.34 ms one day, 3.5 ms for a 14-day catch-up (node). Pump hooks only run while filling.

## Could NOT verify
Nothing seen in a browser; game.js only syntax-checked (node --check), the import graph is checked through world-tick.js in node. Release not rebuilt, so startup/rescue/etc. do not cover the new game.js. Co-op host logic untested (uses multiplayer.isHost as in the clock code). Pump toast/chime in-game unseen.

## Eye-check list
1. New game, then sleep: nothing breaks, save works; sleeping through 05:00 ticks once (dev panel / save JSON: progress.world.day).
2. Load an old save: no flood of needs/toasts, world.day = today.
3. Gas station: fill a truck; at the pump, stock falls (progress.world.stock gas); fill the can too.
4. Force pump stock to 0 (edit save): toast 'Sold out until the next delivery.' and the fill stops; after the weekly truck (nextDay) gas returns.
5. Co-op: only the host's world.day advances; guest stays.
6. Frame rate unchanged at 165 FPS; one tiny hitch at 05:00 at most.

## Things I found (not edited)
- needs.js needsFrom throws on a restock/harvest need whose good is not in PLACES[place].goods (needs.js:81-82); I filter seeds in world-tick.js instead. Hardening it would be a one-liner (`?.`).
- normalizeWorld drops world.last (the tick report) on every load: fine, report only.
- Needs seeds for homes (dwelling:*) are skipped: no map point, so Oscar/Lincoln/Brentster routine needs never reach the board yet. Sick NPCs' errands still do (home place is a dwelling: check whether PLACE_POINTS lacks dwelling: if so a sick errand has no board slot until W-E gives it a point).
- NPC mood bookkeeping per tick uses MAP.seed 7301.

## W-D2 (egg haul slice) still needs
Crate pickup at the Willow Farm (farm-house stock -> crates on the truck via cargo addCrates, units = CRATE_UNITS), drop at the market (deliver to shop:market, remove crates), market UI (egg count + price from priceOf/stockAt), Noah's line (moodLine from progress.npcs), the need -> gig board (needToSlot, GIG_TYPES 'need-*', W-E), standing +3 on a fill (gainStanding), helped() mood on the keeper, starter beat 5 hooked to the same units (16 dozen), and the Ridgeline pallet write-back.

## Confidence
Pure logic (tick, saves, supply, pump math): high (tested, deterministic). game.js wiring: medium (3 small hooks, syntax-checked only). Pallet link: medium-low (one-way mirror). Crate = 4 dozen: a placeholder.