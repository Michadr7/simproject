michadr.
# NPC walking fix (stage npc-walk)

## What caused the ping-pong
dist/neighborhood.js line 6, createPedestrians().update(): six fixed routes [a,b,z] (Alex, Sophie, Robert, Julia, Carlos, Megan). Each frame the person moves `direction*dt*2.1` along x, and when x passes a or b they flip `direction*=-1` and wait 1.5 s. Called from dist/game.js stepWorld (old line ~1516, `pedestrians.update(step,me.position)`). Nothing else on screen used population.js or schedule.js (they were built in 0.35.4 with "A2 not built", DESIGN 4.20). The other 22 population people were never drawn. Names already exist in population.js (map data names plus FIRST/LAST generator), so no npc-names.js was needed.

## What changed
- NEW dist/npc-walk.js (93 lines, pure): findRoute (grid A* 2 m cells, injected blocked/cost, shortened, never throws, straight line if no way), walkDistance, routePoint (no allocation), presenceOf, blockIndex, personPose.
- NEW dist/npc-crowd.js (63 lines, three.js characters injected): draws population people per stateAt; pool of 9 characters plus the 6 pedestrian avatars (15 max); radius 120 m (+10 hysteresis); hideAll() when indoors.
- NEW tests/npc-walk.mjs (82 lines).
- EDITED dist/game.js (single-line edits, no BOM): imports; npcCrowd created after `const pedestrians=...`; stepWorld calls npcCrowd.update(step,me.position,{day,minute}) instead of pedestrians.update, else npcCrowd.hideAll() when inside/shop; nearestPerson, the Talk-to candidate loop and the driving pedestrian-collision list now skip pedestrians whose group is not visible.
- neighborhood.js untouched (its update is simply no longer called by game.js; tests/neighborhood.mjs still passes). Dialogue untouched. Hal Brennan is excluded from the crowd (hal.js draws him).

## How it behaves
- Position is a pure function of (plan, game minute): walk blocks go from placePoint(origin) to placePoint(place) along the A* route at WALK_SPEED, faster only if the route is longer than the schedule's estimate; they arrive and stop (walk anim only while moving, idle otherwise); heading eases to path direction (8/s).
- Indoor acts (sleep, home, away, work/shop at shop/office/property/dwelling) hidden: they vanish at the door and reappear at the door. Work at zone/plot is shown standing. Drive blocks: hidden (no NPC car system exists; none invented).
- Far NPCs: only a plan lookup and pose maths per person (28), no meshes; consistent on return because the position is a function of time.
- Player steps: a drawn NPC steps aside (visual offset only) within 1.1 m.

## Test output (real)
node tests/npc-walk.mjs
PASS npc-walk: 28 people, 139 walking blocks over 4 days, {"walk":395,"stand":837,"hidden":21840} poses sampled
node tests/schedule.mjs -> schedule tests passed: 28 people over 21 days, least sleep 480 minutes, 201 shop visits
node tests/population.mjs -> population tests passed: 20 residents in 14 households, 8 commuters, 22 posts
node tests/neighborhood.mjs -> Needs, purchases, cooking, save migration, shop paths, walking NPCs and vehicle preparation passed.
node --check passed on game.js, npc-crowd.js, npc-walk.js. A node smoke run of the crowd with fake characters over a full day (2880 updates) took 41 ms, 23 routes, at most 4 drawn near the spawn. Not run: npm run release, npm run index, npm test (as instructed). New files are not in PROJECT-INDEX.md yet (needs npm run index) and the release must be rebuilt before npm test.

## Cost
Draw calls/materials: 9 extra skinned characters (same rig and per-part cloned materials as the existing pedestrians), so roughly 9 x (about 5-8 draw calls plus shadow pass) while all are visible; usually fewer (typical drawn 0-5). Per frame: 28 pose computations (arithmetic only, no allocation), at most one A* search per frame (a one-off few ms, cached per origin>destination for the session). Slot reassignment calls avatar.apply (allocates, only when a slot changes person).

## Could NOT verify (nothing seen in a browser)
- A* against the real collider/terrain set (tests use synthetic walls and the smoke run used almost no obstacles): route quality, any hitch on the first search, jam at doors snapped to a free cell.
- Cost function prefers pavement/path/driveway (1), grass (1.4), road/street (2.5): crosswalks are not specially used; people may cross roads anywhere cheap.
- Rain: nothing changes (no weather handling added). Sitting, shopping poses: they are hidden indoors or stand idle.
- Pooled crowd people cannot be talked to and are not hit by vehicles (only the six pedestrians keep both). Door points are placePoint estimates (street end of the path, 8 m in front of a model), not exact doors.
- Drivers show nothing; the Walt/commuter arrivals are invisible.

## Eye-check list
1. Alex/Sophie etc. leave the Oak Apartments door in the morning, walk along the pavement to work or a shop, and no longer pace back and forth.
2. They vanish at the door of a shop/office/home and reappear at that door on leaving.
3. At 3 AM nobody is walking; people at home are not drawn.
4. Wait near a shop at opening time: arrivals cluster at the door and stop (idle, not walking in place).
5. Walk away more than about 130 m and come back at a later time: people are where the clock says, not where you left them.
6. No pop-in at the draw edge noticeable within 120 m (slot full at 9: someone may be missing in a crowd).
7. NPCs go round buildings/fences, not through; check doors that snapped to a free cell.
8. Talk prompt still works on the six pedestrians while they are drawn and disappears while they are indoors.
9. Check frame rate with several people in view on the real GPU.

## Confidence
Pure maths and plan-following: high (tested). Crowd/game wiring: medium (syntax checked and smoke run with fakes, never run in the real game). Route realism near buildings: low-medium until seen.