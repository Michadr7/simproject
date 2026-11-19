michadr.

# rory-spots (Sonnet): real spots for Rory (N4)

## Files
- NEW dist/rory-spots.js (14 lines): RORY_SPOTS (6 real points), RORY_CAMP_ID, RORY_MAX_ROUTE_M (450), RORY_MAX_DETOUR (3.2). Pure data, no imports.
- CHANGED dist/visitors.js (120 lines now, was 125): the placeholder RORY_SPOTS block is replaced by `import {RORY_SPOTS} from './rory-spots.js'` and `export {RORY_SPOTS}`. ctx.spots / ctx.point / ctx.route / ctx.trip overrides still work.
- NEW tests/rory-routes.mjs (74 lines).
- tests/visitors.mjs: NOT changed (it imports RORY_SPOTS from visitors.js, which still exports it).
- No forbidden file edited. `npm run index` run: index 34596 of 37000 (brief 2834). tests/brief.mjs passes. New files appear in PROJECT-INDEX.md.

## The spots (all checked with the crowd's own blocker and cost)
| id | x, z | what |
|---|---|---|
| rory-camp | -98, 12 | grass 7 m south of the West Fork track (node westFork -100,5) |
| rory-bench | 9, 18.8 | real Oak Street south bench (walk-legs bench:oak-south-w) |
| rory-bench-square | 19.5, -116.5 | real Alder Square bench (walk-legs bench:alder-square) |
| rory-edge-south | -24, 62 | verge at the south end of Alder Avenue |
| rory-edge-county | -36, -100 | verge where County Road meets the Alder cross street (north-west edge) |
| rory-edge-east | 150, 75 | grass verge south of Freight South, Eastbank |
The test asserts the two bench points still equal walkPlacePoint() for their place ids.

## How routes were measured (same as N1 / game.js, nothing reinvented)
npc-walk.js findRoute (default 2 m cell, default MAX_NODES) with walk-legs.js townWalkBlocked and townWalkCost over game.js npcStaticBlocked's pieces (isWalkable, world.blockedStatic, building boxes minus shop doors), bounds MAP.playable. Same code as tests/npc-routes.mjs.

## Test output (real)
$ node tests/rory-routes.mjs
PASS rory-routes: 6 real spots, 30 routes none direct, longest 444 m (rory-bench > rory-edge-east, 106 game min at 2.1 m/s), worst detour 2.92x, 858 walk blocks over 180 days, latest home 22:49, worst hurry 1.00x, 15 days at camp, most pavement-rule clipping 0.75 m on one route
$ node tests/visitors.mjs
PASS visitors: Rory plans (60 days x 3 weathers), busyness, pose, Jenni Mon/Wed/Fri, Matt random passes, delivery data

## What rory-routes asserts
1. Spots: unique, one camp, a bench and at least 3 edge spots, 10 m inside MAP.playable, on the walk mask, no collider, not blocked for the crowd, not water/road.
2. All 30 ordered pairs (Rory also walks spot to spot, not only camp to spot): not direct (A* did not fall back to a straight line), length >= straight line, length <= 450 m, and <= 3.2 x max(straight, 100 m). Every 0.25 m along the route: inside the playable rectangle, isWalkable, no collider (all strict). The town pavement rule (townWalkBlocked) is allowed at most 3 m of clipping per route (see below). Out and back lengths agree within 10%.
3. Full day: 60 days x (no weather, clear, storm) with ctx.trip using the real lengths (walkLegMinutes): plan contiguous, starts and ends asleep at camp, every walk block is exactly walkLegMinutes(real length) (so not cut short at midnight), hurry <= HURRY_LIMIT (1.00), last walk is the way home and ends at least 60 min before midnight (latest in the data: 22:49), and the longest route started at the latest bedtime still ends before 24:00.
Bounds, why: 450 m is about 107 game minutes (a walk over two hours would leave no time to sit); 3.2 x is the worst real detour (2.92 x) plus margin, with short straight lines counted as 100 m because the south Oak Street pavement is closed off from the south (bench to Alder Avenue verge is 54 m straight but 267 m by the pavement graph).

## Findings you should know
- NO map data names a camp or edge spots (no homeless/camp/edge ids; MAP.playable is only the old 540 x 480 block). The camp and the three edge spots are chosen verge points beside real roads, not map-named places. The two benches are real. If you want named places, a map edit (map-definition.js: a places/spots list with ids and coordinates) would replace rory-spots.js; I did not make it.
- findRoute gives up (straight line, direct:true) when a route is longer than about 300 m in open country (MAX_NODES 15000). The far corners of the map (east end of Freight Out x 285, West Bank gate -246,-80 to the east, north end of County Road z -240) were tried and fail that way, so they were NOT used. A far-edge Rory would need findRoute's maxNodes raised in the crowd (npc-walk.js MAX_NODES or opts.maxNodes in npc-crowd.js, both forbidden to me).
- findRoute clips corners of forbidden cells by up to 0.75 m (it checks only cell centres, edge middles and quarter points per 2 m step). This is existing crowd behaviour; the test bounds it at 3 m per route and keeps the walk mask and colliders strict.
- Wiring (for a later stage, forbidden files): game.js must give visitorPose ctx.point (spot id -> {x,z}) and ctx.route (findRoute with npcWalkBlock/npcWalkCost) and ctx.trip (the route table's walkLegMinutes). Without ctx.trip the plan uses the straight-line estimate, which is shorter than the real routes (a real route can be 2.9x longer) and would put Rory at the camp late: pass the table.

## Not verified
- Not run in a browser; Rory is not drawn anywhere yet.
- No npm release, no full npm test (as instructed). Only node tests/rory-routes.mjs and node tests/visitors.mjs.
- Rory's spots are not registered as population place ids (placePoint does not know them); wiring must use ctx.point.

## Confidence
- Spots walkable and routable on the real map, and the full-day fit: high (test passes over 180 plan-days with real lengths).
- Spots being the best artistic choice (camp location, bench feel): low to medium; they are verge points, the owner should look at them in game.
- Routes with the default (non-table) estimate: not tested here.