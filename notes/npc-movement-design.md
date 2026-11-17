# NPC movement: what exists and how to grow it (written 2026-11-17, design only, nothing built)

## 1. What we have (all built, tested in Node, only eyeballed in the browser by the owner)
| Layer | File | What it does | Limits |
|---|---|---|---|
| Who | population.js | 28 people, homes, posts, households, names (deterministic from MAP.seed) | no visitors, no cars owned by anyone but a flag `drives` |
| When/where | schedule.js | `dayPlan(person,day)` = blocks {from,to,act,place,origin,mode}; acts sleep/home/travel/work/shop/away/outside | one pattern per kind of person; no weather, no events; strolls only to shop fronts |
| Named overrides | npc-roster.js, npc-life.js (`namedPlan`) | 10 named people: sick, mood, rain, homebody (Oscar), visits | wraps the plan, never edits it |
| How (walking) | npc-walk.js | grid A* (2 m cells) between place points, route shortening, `personPose` = a PURE function of plan + minute (no ping-pong, same on every machine), `pace()` for people outside | A* only tested on synthetic walls; sidewalks are only a cost; no crosswalks; no dynamic obstacles |
| Drawing | npc-crowd.js | pool of 9 skinned characters + the 6 Oak Street pedestrians (15 max), draw radius 120 m, 1 route search per frame, 0.8 m separation, step-aside from the player | only drawn people are updated; pooled people cannot be hit by vehicles or talked to unless roster |
| World link | world-tick.js, needs.js | daily tick, visit counts from plans drive shop demand | strolls inside shops would raise demand |
| Driving | none | drive blocks draw NOTHING (hidden) | no NPC car system at all |
| Visitors | notes/world-system-design.md 'VISITORS...' | Matt Rossion (Pevrolet), Jenni Crain (work truck, Mon/Wed/Fri 08:00 W>E, 15:00 E>W), Rory Dobbinson (homeless loiterer) | design only |

Key strength to keep: position is a function of (plan, game minute), so co-op clients agree without sending positions, and a person who is not drawn costs one plan lookup.

## 2. Gaps (found by the owner or by us)
1. Crowd people mostly stand or vanish at doors: no 'going inside' animation, no visits, no loops. (pace() is a stopgap, x axis only, not checked against walls.)
2. No cars for NPCs, so no through traffic, no commuters driving, no Matt/Jenni.
3. Route quality unknown on the real map: A* never run against the real colliders in a test (a route that falls back to a straight line goes through walls).
4. No crossing rules, no stopping for the player or vehicles; pooled people can be driven through.
5. Everyone has a name but only roster people are talkable (NPC-NAMES).
6. Duplicates between fixed characters and the crowd (Noah at the counter; fixed clerks and the plan disagree about hours).
7. Flatmates get identical timings (fixed visually by 0.8 m separation, not in the plan).
8. Police/events/weather do not touch movement.

## 3. Proposed architecture (one idea: everything that moves is an ACTOR with a pure pose function)
- ACTOR kinds: `resident` (schedule.js), `named` (roster wrapper), `visitor` (visitors.js plan: through-driver, loiterer, delivery), `vehicle actor` (a driver plus a car on the road graph).
- ACTIVITY vocabulary used by plans (new, small): walk(route), stand, pace, sit (bench), enter(door) / exit(door) with a short fade or door animation, visit(door), loop(points), drive(roadRoute, speed, habits).
- PATH NET: a precomputed sidewalk/crossing graph built once from the map (roads table, pavement mask) replaces grid A* per trip; pedestrians follow edges, cross only at crossings; routes are cached by (from,to). A test walks EVERY place pair on the real map and fails if a route leaves the walkable mask or hits a collider.
- ROAD GRAPH for cars: from map-master 6.1 roads table (lanes, junctions, one-way entries at the map ends); vehicle actors advance by distance along a route (again a pure function of time), speed per actor, red-light/stop rules later, `habits` (speeding, red lights) stored as data for the police system.
- DRAW layer: pooled characters and pooled vehicle meshes (the existing vehicle models), draw radius and budgets in one place, the same separation/step-aside rules, vehicle actors push and can be hit.
- INTERACTION: every drawn person gets a name tag on look-at and a generic Talk (roster people keep their menus).
- LOD and cost budget in one table (max drawn people, max drawn cars, route searches per frame).

## 4. Stages for tomorrow (order, each small, each with a test; Sonnet builds, the owner picks the model)
- N1 MEASURE (read-only, cheap): script that routes every place pair on the real map with the real blocked/cost functions, reports straight-line fallbacks, route lengths and search times; also counts how many people are visible per hour. This tells us whether A* needs replacing.
- N2 ACTIVITIES: add enter/exit door, visit, loop to schedule.js/npc-walk.js; strolls that go inside a shop (decide shop-demand effect first); pace axis chosen from the street direction; tests.
- N3 NAMES: name tags and a generic Talk for every drawn person (NPC-NAMES).
- N4 VISITORS: visitors.js (pure plans) for Rory first (walker), then Matt and Jenni as data (no drawing yet).
- N5 ROAD GRAPH + VEHICLE ACTORS: pooled cars on the roads, through traffic in and out of the map ends, then Matt and Jenni; collisions with the player and vehicles; police flags as data.
- N6 PATH NET and crossings if N1 says A* is not good enough.
- N7 Co-op check: positions stay pure functions of time (host clock), so clients agree; test it.

## 5. Decisions needed from the owner
- Do strolls into shops count as shop visits (more demand, more life) or stay as outside waits?
- Should residents be hit-able by vehicles (damage, police) or only pushed?
- How busy should the town look (people visible per hour, cars per minute) on the target PC?
- Stage budget: N1 to N3 are small; N5 is the big one.

## 6. Owner decisions (2026-11-17)
1. Strolls into shops count as real shop visits (act 'shop', hidden inside for a while, only while the shop is open). Shop demand rises with them: the world-tick balance (visitCounts, prices, stock) must be re-checked after N2 with tests/world-state.mjs and needs-loop.
2. Crowd people ARE hit by vehicles, with injury/damage and POLICE consequences (needs: a hit test for every drawn person, not only the six pedestrians; an injury/downed state for the actor; a crime event the police system can read; witnesses; a fine or wanted state later). The hit must not change the schedule maths: a downed person is a visual/state override on top of the pure pose, with an ambulance/recovery rule later.
3. Busyness follows the weather and the time: it should look BUSY when it is nice out. Add a `busyness(weather, minute, dayOfWeek)` factor (0..1) that scales how many people take optional outdoor activities (strolls, sitting out, loops, visitors on foot) and how many drawn people the pool allows; rain, storm or night lowers it; weekends and fair weather raise it. Optional outdoor blocks must stay a pure function of (person, day, weather(day), minute) so co-op clients agree (weather per day from the host clock). Needs the weather source (weatherAt) to be checked: namedPlan already takes world.weather(day).
Consequences for the stages: N2 gains 'busyness' and 'go inside shops'; N5 (vehicle actors) gains hit/injury/police event; N3 names matter more once people can be hurt (the police report names them).