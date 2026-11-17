michadr.

# OPUS wiring: STEP 1 (C-B hands) and STEP 2 (N2 wiring)

## STEP 1 (done by a previous run, checked here, not redone)
- Crates, boxes and parcels are carried in the hands; X puts a crate or box down on the ground (carry.js putDownCrate); put-down crates are saved as `crateDrops` and drawn as one InstancedMesh (game.js crateMesh/crateBoxes, which also block walking like plank stacks).
- Flags: `PARCEL_PIECES_ENABLED=true` (dist/cargo-items.js line 18), `CRATES_BY_HAND=true` (dist/cargo.js line 38). Checked by grep this run.
- Its tests pass in the full run below (250 of 250). Not touched in STEP 2.

## STEP 2 (this run): N2 wiring
### Files changed (line counts)
- dist/game.js: 1755 -> 1763 lines (7 new lines after the crowd is built, 1 new line in frame(); 4 single-line swaps). CRLF kept, no BOM, every anchor count-checked (exactly 1) before the swap, `node --check` OK.
- dist/world-tick.js: 83 -> 84 lines (1 import, demandFor swapped).
- No other file changed. No forbidden file touched. No git.

### What was wired
1. Route table warmed at load, without a hitch: game.js builds `npcRouteTable` (npc-routes.js createRouteTable) and starts `npcCrowd.warm(pairs,{table,now:()=>performance.now(),budgetMs:4})` with the walking pairs of days 1-7 (`walkPairsOf(npcTown.people,[1..7],dayPlan)`). frame() steps it once per frame while the main menu shows (one route, about 9 ms at worst, per frame; it never blocks the first paint). If Play is pressed before it is done, the first play frame finishes it with `run()` (before stepWorld, so nobody is drawn with an old plan). When done, one closure round warms any new pairs the table-sized plans ask for (the game shows 0 extra, as the pure test), then `npcRoutesReady()` sets the trip, rebuilds the schedule and clears the roster planner cache. `globalThis.__npcRoutes={pairs,signature}` is set for debugging and co-op comparison.
2. Schedule sized from the real table: `npcPlanCtx={weather:npcWeather}` is the schedule ctx; on ready it gets `trip=tripWithTable(npcRouteTable,MAP)` and `npcSchedBase=createSchedule(npcTown,npcPlanCtx)` is rebuilt. `npcSchedule` is now a thin wrapper object (planOf/at/present/travelling forward to npcSchedBase), so the crowd and the roster planner, which hold `npcSchedule`, see the rebuilt schedule with no other change.
3. Static obstacles for the table: the crowd's `blocked` is `npcStaticRoutes?npcStaticBlocked(x,z):worldBlocked(x,z)`. While warming, `npcStaticBlocked` = whole-map walk mask (world.js `isWalkable`, imported as `isWalkableMap`, NOT the streamed one) + world.blocked + game colliders; never plank stacks or crates. After the warm, pacing, pushes and late routes use worldBlocked as before.
4. Busyness per frame: `npcCrowd.update(step,me.position,{day,minute,busy:busyness({weather:npcWeather(day),minute,weekday:day})})`. There is NO weather system in the game yet (only the wind number; windClock.weather is 1 by default, which busyness.js reads as rain, so it is not used): `NPC_WEATHER_WORD='clear'`, one constant in game.js, read through `npcWeather(day)` by both the schedule (optional strolls and sit-outs) and the crowd cap. A future weather source plugs into npcWeather only.
5. strollDemand in world-tick.js: `const demandFor=day=>strollDemand(townPopulation().people,day,dayPlan,visitCounts,MAP)` (import from stroll-visits.js). Strolls that end at an open shop front now count as shop visits in the daily tick (about +57 percent on market and cafe demand, per N2-pure). Determinism, save shape, conservation and no clock/chance tests still pass (below).

### Tests (real output)
Single tests after the edits:
```
PASS world-state: determinism, run-out + price cap, delivery, conservation, truck, catch-up 14, normalize, prosperity floor, price band, stockAt, no clock/chance
one-day tick 0.56 ms; 14-day catch-up  6.77 ms
PASS world-tick: save shape, 05:00 boundary, once per day, catch-up 14, determinism, 7 days -> needs, supply conserved, pallet link, dozens, pump stock, no clock/chance
PASS needs-loop: need opened day 103 (14 dozen), board slot, 14 dozen (4 crates) farm 66->52, shelf 0->14, price 563->563, paid 8658, mood 60->64, standing 0->1
PASS npc-routes: 404 walking blocks, worst hurry 1.00x (old estimate 1.35x), table 45 pairs
PASS npc-busyness
```
In-game probe (a scratch copy of tests/carry-game.mjs that runs the real game.js in the fake DOM and prints globalThis.__npcRoutes after the frames; scratch file, not in the repo):
```
NPC_ROUTES {"pairs":45,"signature":550110725}
```
(the same 45 pairs as the pure test, so the warm completes and the schedule is rebuilt in the real game loop).

`npm run index`, `npm run release -- --force`, `npm test`:
```
brief 2834 tokens (target 3000), index 31073 tokens (target 32500); 209 modules, 14 generated, 250 tests, 28 scripts; 13 modules without a header comment
Packaged release 0.35.17: 210 files -> dist/releases/0.35.17
dist/index.html now loads releases/0.35.17/

ALL 250 PASSED
All 250 test files passed.
```

### What I could NOT verify
- Nothing seen in a browser: how the town looks with the busyness cap, whether people visibly change at the moment of the rebuild (they should not: the rebuild happens before play, or in the first play frame before anyone is drawn).
- The menu-time cost on a real machine (budget 4 ms, but one route can take about 9-21 ms, so a menu frame can take that long once per route for about 45 frames; the menu is a static scene, so it should not be noticed).
- Co-op: the table signature was not compared across two machines (see the requested edit below for the remaining risk).
- The shelf balance with stroll demand is only what the existing world tests check (they pass); the feel of +57 percent demand on market/cafe in play is untested.
- world-tick's demand uses plain dayPlan (every stroll taken, old estimate trip), not the weather-gated, table-sized plans the crowd draws: the shelves count all 39 weekly stroll visits whatever the weather. This matches N2-pure's edit list; making them match needs a weather source the tick can read (runWorldDay ctx.weather exists but is unused).

### Edit wanted in a forbidden file (not made)
- dist/world.js, createColliders(): add a `blockedAll(x,z)` that is `blocked(x,z)` without the `c.off` skip (streaming), and expose it on the world as `world.blockedStatic`. game.js `npcStaticBlocked` would then use `world.blockedStatic(x,z)` instead of `world.blocked(x,z)`, so the route table never depends on which chunks are loaded at the menu. The probe gave the same 45 pairs and the same signature (550110725) with the streamed walk mask and with the whole-map mask, so this is a co-op safety margin, not a bug seen. (Felled trees also leave world.blocked; a felled tree near a path could change a length between two saves. Low risk.)

### Confidence
- Table warm on the menu, finish on Play, rebuild of schedule and roster cache: high (runs in the real game loop in the fake DOM; all tests pass).
- Blocks sized from the table: high (same table and code path as the pure test, 45 pairs).
- Busyness per frame: high for the wiring, medium for feel (constant 'clear' weather; the numbers are N2-pure's placeholders).
- strollDemand in the tick: high for correctness (tests pass), medium for economy balance in play.
- Co-op determinism of the table: medium-high (static mask now; world.blocked still follows streaming, see the requested edit).
