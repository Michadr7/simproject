michadr.

# NPC Walk Loops Diagnosis & Pure Fix (`notes/owner-feedback-2026-11-18.md` item 2)

## 1. Diagnosis (with exact numbers)

### Where Alex and Malik get their routes today
- **Legacy `dist/neighborhood.js` (NOT active in `game.js`'s frame loop):** `createPedestrians(scene)` creates the six named avatars (`Alex`, `Sophie`, `Robert`, `Julia`, `Carlos`, `Megan`) on hardcoded 2-point horizontal segments along Oak Street (`[-15, 7, -6.7]` = `22 m` for Alex, `12–15 m` for the others, pausing `1.5 + Math.abs(a % 3)` = `1.5–3.5 s` at each end). However, `game.js` never calls `pedestrians.update()`; `createNpcCrowd` (`dist/npc-crowd.js:72`) hides them and drives all 28 population NPCs (including Alex and Malik Petrov) from `schedule.js` `dayPlan` + `npc-walk.js` `personPose`.
- **Active runtime (`dist/schedule.js` + `dist/npc-walk.js` + `dist/npc-routes.js`):**
  - **Alex (`oak-apartments/1#1`, resident, `work: null`):** uses the idle-resident branch of `dayPlan` (`dist/schedule.js:56-63`). Over Days 1–7, his only walking routes are 2-point out-and-back strolls from `dwelling:oak-apartments` (`{x: 1, z: -6.3}`) to `shop:market` (**18.0 m**, 5 game min = 10 s) or `shop:cafe` (**35.0 m**, 9 game min = 18 s) and straight back.
  - **Malik Petrov (`oak-apartments/11#2`, resident, `work: 'property:alder-bakery'`, `hours: [330, 840]`):** walks `135.3 m` / `135.7 m` to/from work, then after returning home at ~14:25–14:40 takes the same short 2-point stroll (`18.0 m` to `shop:market` or `35.0 m` to `shop:cafe` and straight back).
  - **Why they pace back and forth in a few metres:** `schedule.js` fills `stroll()` (`10–49` game min = **20–98 s** real time at `shop:market`/`shop:cafe`) and `sitOut()` (`45–119` game min = **90–238 s** real time at `dwelling:oak-apartments`) with `act: 'outside'`. `npc-walk.js` `personPose()` (`line 114`) runs `pace()` (`lines 93-103`) for every `act: 'outside'` block:
    - Step amplitude: `PACE_STEP = 2.4 m` along X only (`reach` measured by `freeReach`, `2.40 m` at `oak-apartments`, `market`, and `cafe`).
    - Cycle length: `PACE_CYCLE = 14 s` (`leg = 2.4 / 2.1 = 1.143 s` each way).
    - Pause at each end: **4.0 s** at the far end (`s ∈ [5.143, 9.143]`), and **4.0 s** (`0..4`) + **3.714 s** (`10.286..14.0`) = **7.714 s** combined at the origin end.
    - Over Days 1–7: Alex spends **138–163 game min (276–326 real s)** per day in `act: 'outside'` pacing; Malik spends **26–161 game min (52–322 real s)** per day in `act: 'outside'` pacing.
- **Root cause:** **Schedule / lack of errand legs (plus the `pace()` stopgap)** — NOT `MAP` data and NOT the `findRoute` route builder (`findRoute` already produces clean obstacle-free paths with 0 straight-line fallbacks across the 45 existing pairs). `schedule.js` `stroll()` only considers `MAP.shops` (both `18–35 m` away from `oak-apartments`) and leaves long stationary `outside` blocks that `pace()` animates as a `2.4 m` oscillation.

### Before / After numbers (Days 1–7, `MAP.seed = 7301`)
| Person | Metric | Before (`dayPlan` + `pace`) | After (`applyWalkLegs` + `townWalkBlocked`) |
|---|---|---|---|
| **Alex** | Walk legs (7 days) | `24` legs, **18.0–35.0 m** (`772.0 m` total) | `67` legs (`42.1–206.8 m` for walk loops; 18/35 m only for direct `act:'shop'` visits), **`7140.8 m`** total |
| **Alex** | Stationary `outside` / `pace` | `14` blocks, **13–105 game min** (**26–210 s**) pacing `2.4 m` | **0** `outside` pacing blocks; `44` clean `pause` stops of **8–16 game min** (**16–32 s**) |
| **Malik Petrov** | Walk legs (7 days) | `30` legs (`18.0–135.7 m`, `2317.9 m` total; strolls `18–35 m`) | `49` legs, all **42.1–251.8 m**, **`7765.9 m`** total |
| **Malik Petrov** | Stationary `outside` / `pace` | `13` blocks, **12–119 game min** (**24–238 s**) pacing `2.4 m` | **0** `outside` pacing blocks; `28` clean `pause` stops of **8–14 game min** (**16–28 s**) |

---

## 2. Files Created or Changed (with line counts)

- **`dist/walk-legs.js`** (created, **300** lines): Pure module (no DOM, no `three.js`, no globals, no `Math.random`/`Date.now`).
  - Named exports: `MIN_LEG_METRES = 40`, `PAUSE_BY_KIND`, `PAUSE_VARIATION = 5`, `DEFAULT_MAX_LEGS = 5`, `MIN_WINDOW_MINUTES = 75`, `HOME_BUFFER_MINUTES = 20`, `DAY = 1440`, `PLACE_KINDS`, `TOWN_WALK_PLACES`.
  - Real places on the pavement graph: `home` (`person.home`), `work` (town workplaces), `market` (`shop:market`), `diner` (`shop:cafe`), `park` (`park:alder-square`), and 5 real town benches (`bench:oak-south-w`, `bench:oak-south-e`, `bench:alder-cross`, `bench:alder-square`, `bench:alder-square-w`) resolved via `walkPlacePoint()`.
  - `buildWalkLegs(person, day, ctx)`: deterministically picks connected legs from `(seed, person.id, day)`, reuses `npc-routes.js` `table.get(from, to)` (no second pathfinder), enforces `metres >= 40 m`, never repeats the same pair (or reverse pair) twice in a row, enforces `>= 3` legs for closed home loops, and pauses at each stop by `legPauseMinutes()` (`8–16` game min).
  - `townWalkBlocked()`, `townWalkCost()`, `isOnPavementGraph()`: keep town walkers off non-crosswalk roads/streets and off non-pavement grass in Westside/Ironwood without per-call allocation.
  - `applyWalkLegs()` & `createWalkSchedule()`: replaces short Oak St strolls and stationary `outside` pacing windows while keeping `sleep`, `work`, real `shop` visits, and `0..1440` continuity intact; `createWalkSchedule()` memoizes per `(id, day)` for zero per-frame allocation.
- **`dist/npc-walk.js`** (changed, **126** lines):
  - Added `'pause'` to `presenceOf()` (returns `'stand'` without running `pace()`).
  - Tightened `findRoute()` diagonal A* quarter-point checks (`dx && dz`) and `clear()` sampling step (`0.1 m`) so routes never clip small street-furniture/building margins.
  - Added pure zero-allocation `isCrossing(x, z, crossings, margin = 1)`.
- **`dist/npc-routes.js`** (changed, **73** lines):
  - Exported `walkLegMinutes(metres)` and updated `tripWithTable()` so non-`placePoint` places (e.g. `park:*`, `bench:*`) present in the warmed `RouteTable` are sized cleanly as `'walk'` unless `person.drives && metres > DRIVE_OVER`.
- **`dist/neighborhood.js`** (changed, **18** lines):
  - Lengthened fallback `createPedestrians()` spans from `12–22 m` to `57–65 m` along Oak Street North/South pavements (`pause` increased from `1.5–3.5 s` to `4–6 s`), keeping `p.a`/`p.b` contract intact.
- **`tests/walk-legs.mjs`** (created, **124** lines):
  - Purity scan, real-map `crowdWarm` (`216` town pairs, `0` direct, `0` missing), repeatability, `>= 40 m` leg lengths, no consecutive repeat pairs, connected legs/times, real place kinds (`home`, `market`, `diner`, `park`, `bench`, `work`), 24-hour `personPose` simulation across all 16 town walkers × 7 days (`38,408` poses, zero off-pavement, zero wall/road hits), frame-rate independence, and `createWalkSchedule` memoization.
- **`PROJECT-INDEX.md` / `PROJECT-BRIEF.md`**: regenerated with `npm run index` (`253` modules, `305` tests; brief `2834/3000`, index `35748/37000`).

---

## 3. Test Output (real pasted output)

```text
> node tests/walk-legs.mjs
PASS walk-legs: 16 town walkers, 70 Alex/Malik legs (min 42.1 m >= 40 m), 38408 24h poses all on pavement graph

> node tests/npc-walk.mjs
PASS npc-walk: 28 people, 218 walking blocks over 4 days, {"walk":579,"stand":2600,"hidden":19893} poses sampled

> node tests/npc-routes.mjs
table: 45 pairs (first round 45), closed after 1 rounds
PASS npc-routes: 404 walking blocks, worst hurry 1.00x (old estimate 1.35x), table 45 pairs

> node tests/neighborhood.mjs
Needs, purchases, cooking, save migration, shop paths, walking NPCs and vehicle preparation passed.

> node tests/npc-busyness.mjs
outdoor blocks over 28 people x 7 days: old 218, clear 176, storm 43 (16149 / 12840 / 3299 min)
real week: 69 errand visits, 39 stroll visits to open shop fronts
PASS npc-busyness

> node tests/npc-crowd-separation.mjs
PASS npc-crowd-separation walls: 4 people, none in the wall
PASS npc-crowd-separation: closest pair 0.80 m

> node tests/schedule.mjs
schedule tests passed: 28 people over 21 days, least sleep 439 minutes, 216 shop visits
outside: 6.7% of residents' day in 435 blocks

> node tests/npc-life.mjs
PASS npc-life: roster, tiers, +3/day standing cap, sickness band, Oscar/Lincoln/Brentster rules, canVisit, namedPlan, visits, needs, determinism

> node tests/npc-dialogue.mjs
PASS npc-dialogue: talk effects and caps, Oscar refusal, Lincoln pages and sulk, Brentster steers, met set and save round trip, People rows (unmet hidden), door-knock table, roster planner (sick stay home)

> npm run index; node tests/brief.mjs
brief 2834 tokens (target 3000), index 35748 tokens (target 37000); 253 modules, 14 generated, 305 tests, 30 scripts; 13 modules without a header comment
brief tests passed: 253 modules listed, brief 2834 and index 35748 estimated tokens (budgets 3000 and 37000)
```

*(Full `npm test` and `npm run release -- --force` were not run because the WebGPU T5 agent is concurrently editing `dist/game.js`.)*

---

## 4. What Could NOT Be Verified

- Nothing was run or seen in a live browser (WebGL/WebGPU visual check of Alex and Malik walking across crosswalks, Alder Square, and Oak Street benches).
- Live `game.js` + `npc-crowd.js` integration with `createWalkSchedule` and `townWalkBlocked` (cannot edit `game.js` / `npc-crowd.js` in this stage).
- Full `npm test` and `npm run release -- --force` (skipped while T5 edits `game.js`).

---

## 5. Exact Edit Requests (for the `game.js` lane, after T5 lands)

### A. `dist/npc-crowd.js`
1. **Line 7** (import `walkPlacePoint`):
   - Old:
     `import {WALK_SPEED,placePoint} from './population.js';`
   - New:
     `import {WALK_SPEED} from './population.js';import {walkPlacePoint} from './walk-legs.js';`
2. **Line 31** (resolve `park:*` and `bench:*` as well as standard places):
   - Old:
     ` const point=place=>{if(!points.has(place))points.set(place,placePoint(place,map));return points.get(place)};`
   - New:
     ` const point=place=>{if(!points.has(place))points.set(place,walkPlacePoint(place,map));return points.get(place)};`

### B. `dist/game.js`
1. **Line 76** (import `walk-legs.js` helpers):
   - Old:
     `import {createPedestrians,createVehicles} from './neighborhood.js';import {createNpcCrowd} from './npc-crowd.js';import {townPopulation} from './population.js';import {createSchedule,dayPlan} from './schedule.js';import {createRouteTable,tripWithTable,walkPairsOf} from './npc-routes.js';import {busyness} from './busyness.js';`
   - New:
     `import {createPedestrians,createVehicles} from './neighborhood.js';import {createNpcCrowd} from './npc-crowd.js';import {townPopulation} from './population.js';import {createSchedule,dayPlan} from './schedule.js';import {createRouteTable,tripWithTable,walkPairsOf} from './npc-routes.js';import {busyness} from './busyness.js';import {createWalkSchedule,walkLegCandidatePairs,townWalkBlocked,townWalkCost} from './walk-legs.js';`
2. **Line 138** (wrap `npcSchedBase.planOf` with `npcWalkSched`, falling back to `npcSchedBase` until routes are warmed):
   - Old:
     `const pedestrians=createPedestrians(scene);const npcWeather=day=>NPC_WEATHER_WORD,npcTown=townPopulation(),npcPlanCtx={weather:npcWeather};let npcSchedBase=createSchedule(npcTown,npcPlanCtx),npcStaticRoutes=true;const npcSchedule={planOf:(id,day)=>npcSchedBase.planOf(id,day),at:(id,day,minute)=>npcSchedBase.at(id,day,minute),present:(place,day,minute)=>npcSchedBase.present(place,day,minute),travelling:(day,minute)=>npcSchedBase.travelling(day,minute)},rosterPlanner=createRosterPlanner({schedule:npcSchedule,getNpcs:()=>GameState.progress.npcs,seed:MAP.seed});const rosterPersonIds=new Set(NPC_ROSTER.map(r=>r.personId)),pedRoster=new Map(pedestrians.people.map(p=>[p.name,npcTown.people.find(q=>q.name===p.name&&rosterPersonIds.has(q.id))?.id]).filter(e=>e[1]).map(e=>[e[0],rosterByPersonId(e[1]).id])); // W-D3: roster people the crowd draws can be talked to (pedRoster = the pedestrian avatars that are roster people)`
   - New:
     `const pedestrians=createPedestrians(scene);const npcWeather=day=>NPC_WEATHER_WORD,npcTown=townPopulation(),npcPlanCtx={weather:npcWeather};let npcSchedBase=createSchedule(npcTown,npcPlanCtx),npcWalkSched=npcSchedBase,npcStaticRoutes=true;const npcSchedule={planOf:(id,day)=>npcWalkSched.planOf(id,day),at:(id,day,minute)=>npcSchedBase.at(id,day,minute),present:(place,day,minute)=>npcSchedBase.present(place,day,minute),travelling:(day,minute)=>npcSchedBase.travelling(day,minute)},rosterPlanner=createRosterPlanner({schedule:npcSchedule,getNpcs:()=>GameState.progress.npcs,seed:MAP.seed});const rosterPersonIds=new Set(NPC_ROSTER.map(r=>r.personId)),pedRoster=new Map(pedestrians.people.map(p=>[p.name,npcTown.people.find(q=>q.name===p.name&&rosterPersonIds.has(q.id))?.id]).filter(e=>e[1]).map(e=>[e[0],rosterByPersonId(e[1]).id])); // W-D3: roster people the crowd draws can be talked to (pedRoster = the pedestrian avatars that are roster people)`
3. **Line 139** (route town walkers along pavements + crosswalks via `townWalkBlocked` and `townWalkCost`):
   - Old:
     `const npcCrowd=createNpcCrowd({scene,createCharacter,outfit:makeOutfit,population:npcTown,seed:MAP.seed,workProps:{axe:()=>createHeldItem(itemById('axe')),log:()=>{const g=new THREE.Group(),m=new THREE.Mesh(groundLogs.geometry,groundLogs.material);m.rotation.y=Math.PI/2;g.add(m);return g},planks:()=>{if(!sawmillCtl?.ready)return null;const m=new THREE.Mesh(sawmillCtl.plank.geometry,sawmillCtl.plank.material);m.scale.y=4;return m}},/* W3: one prop per worker role, shared geometry (the axe's, the ground logs', the sawmill plank's), made when first needed */schedule:npcSchedule,planOf:rosterPlanner.planOf,pedestrians:pedestrians.people,exclude:['Hal Brennan','Noah'],blocked:(x,z)=>npcStaticRoutes?npcStaticBlocked(x,z):worldBlocked(x,z),cost:(x,z)=>{const s=terrain().surfaceAt(x,z);return s===SURFACE.PAVEMENT||s===SURFACE.PATH||s===SURFACE.DRIVEWAY?1:s===SURFACE.ROAD||s===SURFACE.STREET?2.5:1.4},groundAt:standHeight}); // A2: the town's people follow their plans (npc-crowd.js); the six pedestrians are driven by it too, no more walking to and fro`
   - New:
     `const npcCrowdBlocked=(x,z)=>npcStaticRoutes?npcStaticBlocked(x,z):worldBlocked(x,z),npcWalkBlock=townWalkBlocked(npcCrowdBlocked,(x,z)=>terrain().surfaceAt(x,z),(x,z)=>terrain().zoneAt(x,z),SURFACE,MAP),npcWalkCostFn=townWalkCost((x,z)=>terrain().surfaceAt(x,z),SURFACE,MAP);const npcCrowd=createNpcCrowd({scene,createCharacter,outfit:makeOutfit,population:npcTown,seed:MAP.seed,workProps:{axe:()=>createHeldItem(itemById('axe')),log:()=>{const g=new THREE.Group(),m=new THREE.Mesh(groundLogs.geometry,groundLogs.material);m.rotation.y=Math.PI/2;g.add(m);return g},planks:()=>{if(!sawmillCtl?.ready)return null;const m=new THREE.Mesh(sawmillCtl.plank.geometry,sawmillCtl.plank.material);m.scale.y=4;return m}},/* W3: one prop per worker role, shared geometry (the axe's, the ground logs', the sawmill plank's), made when first needed */schedule:npcSchedule,planOf:rosterPlanner.planOf,pedestrians:pedestrians.people,exclude:['Hal Brennan','Noah'],blocked:npcWalkBlock,cost:npcWalkCostFn,groundAt:standHeight}); // A2: the town's people follow their plans (npc-crowd.js); the six pedestrians are driven by it too, no more walking to and fro`
4. **Line 145** (enable `createWalkSchedule` once the route table finishes warming, skipping homebodies like Oscar):
   - Old:
     `function npcRoutesReady(){const trip=tripWithTable(npcRouteTable,MAP);if(npcWarmRound++<1&&npcWarmStart(walkPairsOf(npcTown.people,NPC_WARM_DAYS,(p,d)=>dayPlan(p,d,{trip,weather:npcWeather}))))return;npcWarm=null;npcStaticRoutes=false;npcPlanCtx.trip=trip;npcSchedBase=createSchedule(npcTown,npcPlanCtx);rosterPlanner.clear();globalThis.__npcRoutes={pairs:npcRouteTable.size,signature:npcRouteTable.signature()}}`
   - New:
     `function npcRoutesReady(){const trip=tripWithTable(npcRouteTable,MAP);if(npcWarmRound++<1&&npcWarmStart(walkPairsOf(npcTown.people,NPC_WARM_DAYS,(p,d)=>dayPlan(p,d,{trip,weather:npcWeather}))))return;npcWarm=null;npcStaticRoutes=false;npcPlanCtx.trip=trip;npcSchedBase=createSchedule(npcTown,npcPlanCtx);npcWalkSched=createWalkSchedule(npcSchedBase,npcTown,{table:npcRouteTable,seed:MAP.seed,skip:p=>!!npcById(rosterByPersonId(p.id)?.id)?.homebody});rosterPlanner.clear();globalThis.__npcRoutes={pairs:npcRouteTable.size,signature:npcRouteTable.signature()}}`
5. **Line 146** (warm walk-leg candidate pairs behind the menu alongside base schedule pairs):
   - Old:
     `if(!npcWarmStart(walkPairsOf(npcTown.people,NPC_WARM_DAYS,(p,d)=>dayPlan(p,d))))npcRoutesReady();`
   - New:
     `if(!npcWarmStart([...walkPairsOf(npcTown.people,NPC_WARM_DAYS,(p,d)=>dayPlan(p,d)),...walkLegCandidatePairs(npcTown.people,MAP)]))npcRoutesReady();`

---

## 6. QUESTIONS FOR THE OWNER

1. **Map gap on Alder Avenue (`z = -60..-80.7`):** `MAP.pavements` ends at `z = -60` on the west side (`pavements[2]`) and resumes at `z = -80.7` (`pavements[4]`). Right now `townWalkBlocked` lets walkers use the `x = -25..-16` grass verge to walk between Oak Street and Ironwood/Alder Square. Should a future map pass extend a concrete sidewalk along that 20.7 m strip, or keep it as a grass verge?
2. **Pause duration & standing vs. sitting:** Walkers currently pause **8–16 game min** (**16–32 real s**) standing still (`act: 'pause'`) at benches, Alder Square, and shops before starting their next leg. Is 16–32 s the right dwell time, or would you prefer shorter stops (say 10–20 s) so more people are visibly walking at once?
3. **Shop demand effect (`strollVisits`):** Because `applyWalkLegs` turns Oak St `outside` strolls into `pause` stops across `park`, `bench`, `market`, and `diner`, should `strollVisits` (`stroll-visits.js`) later also count `'pause'` blocks at `shop:market` / `shop:cafe` toward shelf demand?

---

## 7. Confidence

- **Diagnosis & numbers:** High — directly measured from `buildPopulation()`, `dayPlan()`, `npc-walk.js`, `neighborhood.js`, and real `findRoute()` queries.
- **`dist/walk-legs.js`, `dist/npc-walk.js`, `dist/npc-routes.js`, `dist/neighborhood.js`:** High — deterministic, zero per-frame allocation, `tests/walk-legs.mjs` and all 8 existing NPC tests pass (`38,408` 24-hour poses, `0` wall/road violations, `0` direct fallbacks).
- **Exact `game.js` / `npc-crowd.js` edit requests:** Medium-High — verified against the current lines of both files; needs a live browser check once the `game.js` lane applies them after T5.
