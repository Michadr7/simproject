michadr.

# N2 pure side: route-sized blocks, busyness, stroll visits, crowdWarm

## Files (line counts)
New: dist/npc-routes.js (64), dist/busyness.js (32), dist/stroll-visits.js (20), tests/npc-routes.mjs (56), tests/npc-busyness.mjs (59).
Changed: dist/schedule.js (81; import + `outdoorOk` gate on strolls and sitOut, only active when ctx.weather is passed), dist/npc-crowd.js (86; `routeNow`, `warm`, `time.busy` pool cap).
No forbidden file touched. gigs/needs/cargo/carry/jobs untouched. No git.

## What each part does
1. Block sizing (npc-routes.js): `createRouteTable()` (get falls back to the reverse pair, lengths rounded to 0.1 m, `signature()` hash for co-op comparison), `tripWithTable(table,map)` = drop-in for dayPlan ctx.trip (walk minutes = ceil(length/WALK_SPEED x 0.5), never under 2; walk/drive decision stays the old estimate's; pair missing = old estimate), `walkPairsOf(people,days,planOf)`, `hurryOf`, `HURRY_LIMIT=1.15`.
   Real-map test: warming 45 pairs closes in 1 round (plans using the table ask for no new pairs). 404 walking blocks over 28 people x 7 days: worst hurry 1.00x (old estimate on the same routes: 1.35x).
2. busyness.js: `busyness({weather,minute,weekday})` = weather x time x weekday, clamped 0..1. Numbers: weather clear/sunny 1, partly .85, cloudy .8, overcast .7 (also unknown words), fog/wind .6, drizzle .45, rain/snow .3, storm .1 (numbers 0..2 as wind.js: 0 -> 1, 1 -> .3, 2 -> .1); time curve (minute,factor) 0:.05, 360:.1, 480:.7, 600:1, 1020:1, 1140:.6, 1260:.25, 1380:.1, 1440:.05, linear between; weekday Mon-Thu .9, Fri .95, Sat/Sun 1 (day number from 1 = Monday as housing.js, or a name). Scaling: `outdoorShare(b)=0.1+0.9b` (share of optional strolls/sit-outs taken, decided per person per block by a hash roll, so co-op safe); `crowdPool(b,pool)=max(3, round(pool x (0.4+0.6b)))`, never above pool. POOL (9) and DRAW_RADIUS (120) unchanged (test asserts POOL===9). Over the real week: old 218 outdoor blocks, fine weather 176, storm 43.
3. stroll-visits.js: `strollVisits(people,day,planOf,map)` -> {place: n}: one per 'outside' block at a 'shop:' place if the shop is open for any minute of the block; `addVisits`, `strollDemand(people,day,planOf,visitCounts,map)` = errand counts + stroll counts. Real week: 69 errand visits plus 39 stroll visits (about +57 percent demand on market and cafe; STROLL_BASKET=1 is the tuning knob).
4. crowdWarm(pairs,routeFn,{table,now,budgetMs,perStep}) -> job {table,total,remaining,done,missing,direct,step(),run()}. step() does at least one route, stops at perStep or budgetMs (injected `now`; a budget with no clock = 1 route per step). npc-crowd.js: `crowd.routeNow(from,to)` (search ignoring the 1/frame budget, shares the cache) and `crowd.warm(pairs,opts)`.

## Tests (real output)
```
node tests/npc-routes.mjs
table: 45 pairs (first round 45), closed after 1 rounds
PASS npc-routes: 404 walking blocks, worst hurry 1.00x (old estimate 1.35x), table 45 pairs
node tests/npc-busyness.mjs
outdoor blocks over 28 people x 7 days: old 218, clear 176, storm 43 (16149 / 12840 / 3299 min)
real week: 69 errand visits, 39 stroll visits to open shop fronts
PASS npc-busyness
```
`npm run release -- --force` OK (0.35.17, 209 files). `npm test` final lines:
```
ALL 248 PASSED
All 248 test files passed.
```
`npm run index`: brief 2834 tokens (target 3000), index 30872 tokens (target 32500); 248 tests. Cap untouched; new modules appear.

## EXACT edits for the main chat (nothing below is done)
A. game.js (where createSchedule / the crowd are built; the schedule must be built AFTER the table is complete, because a plan cache built from a half-filled table would change mid-day):
   1. Build the crowd first, then `const pairs=walkPairsOf(population.people,[1,2,3,4,5,6,7],(p,d)=>dayPlan(p,d))` (from npc-routes.js) and `const job=crowd.warm(pairs,{table}).run()` behind the loading screen (about 0.4 s; or `step()` per frame with `{now:()=>performance.now(),budgetMs:4}` while the loading screen shows, but create the schedule only when `job.done`). Then loop once: new pairs from `walkPairsOf(..., (p,d)=>dayPlan(p,d,{trip}))` not in the table get warmed too (the test shows 0 extra on this map).
   2. `createSchedule(population,{trip:tripWithTable(table,MAP),weather:day=><the word for that day>})` (the same ctx the npc-dialogue planner wraps; world.weather(day) is what namedPlan already uses). Without `weather` the optional blocks are all taken, as before.
   3. The crowd must be built with a `blocked` that uses STATIC obstacles only (terrain, world colliders, MAP buildings), or the table (and so block lengths) can differ between co-op machines; compare `table.signature()` if desired. Dynamic obstacles (vehicles, planks) stay only in pacing/separation.
   4. Each frame: `crowd.update(dt,player,{day,minute,busy:busyness({weather:weatherWord(day),minute,weekday:day})})` (busyness from busyness.js). `busy` omitted = whole pool as before.
B. world-tick.js `demandFor` (line 27): `const demandFor=day=>strollDemand(townPopulation().people,day,dayPlan,visitCounts,MAP)` with `import {strollDemand} from './stroll-visits.js'` (MAP is already imported). needs.js needs NO edit (it does not count visits; demand only enters through world-state.js catchUp's `ctx.demand`). After the edit rerun tests/world-state.mjs, world-tick.mjs and needs-loop (the shelves see about +57 percent demand on market/cafe; if too much, lower STROLL_BASKET in stroll-visits.js, or count only half).
C. The stroll people are still drawn OUTSIDE the shop front (act stays 'outside'); only the demand counts them. The owner's 'hidden inside for a while' is NOT built: that needs a plan change (a 'shop' block after the outside wait), which would change visitCounts and every schedule test; left for the main chat to decide.

## Could not verify
- Nothing run in a browser; the real game's `blocked`/`cost` include runtime obstacles the test does not (as in N1).
- The weather word vocabulary of the game's weather(day) was not found in dist (grep found only npc-life RAIN_WORDS rain/storm/snow): unknown words count as 'overcast' (.7).
- `world-tick` with strollDemand was not run (edit not made), so the balance effect on shelves is a calculation, not a test.
- tripWithTable changes plan timings for the real game only once game.js passes it; until then nothing in the game changes (busyness and strolls also inert).

## Confidence
Table sizing and closure on the real map: high. crowdWarm: high (tests with fake clock, equal to one-shot). busyness maths and schedule gating: high; the numbers are placeholders (medium for feel). stroll-visits helper: high as a function, medium on the economy effect until world tests run with it. Crowd cap: medium-high (fake characters, not drawn in a browser).
