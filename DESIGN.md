# City Life — design plan

Living document. "Model" lines say which Claude model to use for each task: **Haiku 5.5** (tiny edits), **Sonnet 5.5**
(the default for building and refactoring against tests), **Opus 5.5** (design-heavy or save-format / multiplayer work).

## Principles
- **Flat world.** No elevation in version 1; ridges and the river are scenery and barriers. Characters, camera, plots and
  collisions all assume flat ground.
- **Data first.** The world lives in `dist/map-definition.js` (zones, road graph, fields, buildings, shops, reserved plots,
  scenery parameters) and is checked by `validateMap`. New districts are data plus scenery code that reads it.
- **Lightweight by design.** Instanced trees, load nearby detail only, limited interiors / NPCs / traffic, assets embedded.
- **Every enterable building has a real interior behind a door**, and buildings can have levels. Shop doors have no E;
  the studio keeps E.

## Foundation fixes before Alder Center (done)
A review of v0.19.3 raised six issues; five were real and one was partly fixed already. All are now fixed and tested:
| # | Issue | Fixed in | How |
|---|---|---|---|
| 5 | Obsolete `waist.mjs` | 0.19.6 | Overwritten with a real test of the skeletal waist |
| 3 | Controls menu unpaused a door fade | 0.19.6 | The fade and doors freeze while `modal`; only `pause()` owns `modal` |
| 1 | Eating and chopping overlapped | 0.19.6 | `actions.js`: every action blocks every other, both ways |
| 2 | Gig arrow overwritten by the beacon | 0.20.0 | `objective.js`: one resolver, one drawer |
| 4 | Two timesteps | 0.20.0 | `timestep.js`: real time cut into slices of at most 1/30 s |
| 6 | Hard-coded doorway and interior data | 0.20.0 | `doorway` and `interior` per shop (and the studio) in `map-definition.js`, validated |

Remaining literals worth moving later: the pavement and road height bands in the frame loop, and the interior room geometry. The minimap
strips and the `zoneAt(x)` fallback still assume zones laid out west to east.

## Completing the map before the assets (the six areas of concept 03A)
| Area | Status |
|---|---|
| 01 Oak Street | built (the city: Starter apartments, Corner Market, Alder Coffee, Laundry) |
| 02 Alder Center (town square, police station, plots C1-C2) | roads, a paved square and plots C1-C2; no buildings |
| 03 Cedar Heights (a loop road, plots R1-R3) | the curved loop road, its links and plots R1-R3; no houses |
| 04 Eastbank Works (warehouse, vehicle workshop, building supplier, plots I1-I2, Freight Road) | Oak Street East, the Freight Road and a second bridge, plots I1-I2; no buildings |
| 05 Willow Fields | land, three fields, fence and a placeholder farmstead |
| 06 Pine Ridge | forest, clearings and the sawmill |
Order (the user's plan, with one prerequisite):
1. **Walkable areas stop being rectangles: done in 0.25.0** (`terrain.js`, the terrain mask; see the README). Build a walkability and ground-type mask at load (about 1 m cells, 0.2 M cells, a few tens of ms) from zone shapes, road ribbons along
   centrelines (so roads can curve) and water. It replaces the rectangle tests for walking, footing height, scenery exclusion and the minimap, and reachability stays validated. Needed for Cedar Heights' loop and the winding timber road.
2. **Re-lay the world for six districts** (decisions below), then build Alder Center, Cedar Heights and Eastbank Works as **placeholder** boxes with the reserved plots as data, parking lots, a police station and a gas station (Sonnet 5.5).
3. Then replace placeholders with assets, district by district.
Decisions to confirm first: the river and the north bank move about 70 m north (so the south bank holds Alder Center, Cedar Heights and Eastbank Works) and the map grows east to x about 200; a second bridge for the
Freight Road at the east edge (the concept's cargo route crosses the river there); the County Road keeps its bridge.

## Next step: re-lay the world for six districts, in two builds (skeleton first)
Confirmed: the river and the north bank move north, the map widens east, the Freight Road gets a second bridge, and **no placeholder buildings**: finish the map as roads, ground, plots and signposts, then add real assets.
**Build 1, the skeleton (done in 0.26.0, nothing is populated):**
1. Everything on the north bank (river, County Bridge, farm, fields, farmstead, forest, clearings, sawmill, fork signpost) moves 70 m north by one shift constant, not retyped coordinates.
2. The map widens east (ground to x 300; the forest to x 190).
3. A second bridge at x 190..200 and the Freight Road: a rural road up a 10 m corridor from Eastbank Works to Pine Ridge's woods road.
4. Roads for the three districts as walkable ribbons: **Alder Center** (x -20..58, z -125..-48: a main street and a cross street, a paved square), **Cedar Heights** (x 70..170, z -135..-40: a closed, curved loop road with links to Alder Center and
   to Oak Street East), **Eastbank Works** (x 70..190, z -20..75: Oak Street East, the Freight Road along its south side). The backdrop buildings along z -61 go (Alder Center replaces them).
5. Reserved plots as data (C1-C2 commercial, R1-R3 residential, I1-I2 industrial), drawn on the minimap and as a ground overlay toggled with O.
6. A signpost for each district.
Checks: `validateMap` (zones, water, bridges, plots), `validateTerrain` (every district reachable on foot from the spawn, over the new bridges), plots never on a road, trees never on a road or in the river, and an alignment test
(each bridge's deck spans its river and meets its road; the roads meet their zones).
**Build 2 (next, once you have walked the skeleton and confirmed the alignment):** the real Kenney houses in Cedar Heights (house slots sized from their real footprints, scaled about x8), then Alder Center and Eastbank Works as their asset packs arrive.

## Open country and vehicles
- Walkable ground is "the playable rectangle minus water", not "the zones". Zones are names and rules (grid, labels); keep new districts as zones, never as fences. Solid things get colliders.
- Roads are designed for vehicles from the start: lanes 3.5 m, shoulder 1 m (a 9 m road), curve radius at least 17 m, 12 m streets where trucks turn. When vehicles arrive they follow road edges (`roadCenterline`) and the plots' `facing`.
- Tree regrowth exists (stump, a sapling after 3 game days, a full pine after 7; one game day is 48 real minutes of play). That is about 70 trees an hour across Pine Ridge's 395, far less than one player can fell (about 4 a minute),
  so the forest empties in a couple of hours; the lumberjack rebalance (shorter maturity of about 2 game days, replanting saplings with a tool, wood prices) belongs to the tool-tier work.

## The sawmill chain and physics (planned)
Loop: bring logs to the sawmill, they become planks over a few seconds, the blade spins with a sound, and planks pile up beside it (an instanced pile with a cap on how many are drawn; the count is saved, not each plank).
Needs: a spinning blade (the model is one fused mesh, so either split the blade out of it or lay a spinning disc over it), an audio system (none yet: synthesised with Web Audio or CC0 sound files), item and economy
rules. Sonnet 5.5 builds it; Opus 5.5 designs the plank item and the stack save format.
**Physics:** no general rigid-body engine. Scripted animation (logs slide along the rails, planks drop and settle into precomputed pile slots) costs almost nothing and behaves the same on every client. A real engine
(cannon-es, Rapier) costs CPU for every active body (dozens are fine on a desktop, hundreds are not), needs colliders for the terrain, buildings and trees, must save every body's position, and cannot be kept
identical between players in multiplayer. If loose objects that tumble are wanted later, cap them at about 20 active bodies near the player that freeze into static props when they stop (Opus 5.5 to design).

## Performance budget (the rule: say so before building anything that would hurt)
Measured on the current world: all trees together are 0.89 M triangles; with culling a view draws 8% (city) to about 60% (inside Pine Ridge) of them; the
world has about 45 draw calls. Claude cannot measure real frame rates (the test renderer is software-only), so estimates come from triangle and draw-call counts
plus your reports (165 FPS in the forest and 105 at the bridge before culling). Flag it, with a number and a cheaper alternative, when a request would:
- add more than about 1,000 tree-sized instances (1,000 trees is about 1.2 M triangles; choppable ones cost double because of shadows), or any large scatter of
  grass, rocks or flowers (alpha cards overdraw; keep within a few thousand within 30 m, chunked);
- plant crops one per cell (each of the three fields is thousands of cells): needs chunked, low-poly instances;
- put more than about 15 skinned characters on screen, or more than about 10 cars;
- add shadow-casting objects in bulk, textures above 512 px per asset, or more than about 300 draw calls;
- Cheaper levers already in place: fog and culling distance, scenery casting no shadows, instancing. Next: chunked far versions and lower-poly LODs.

## Map (concept 03A: Town & Outskirts), chunk by chunk
The world is being terraformed to the concept, flat (no elevation). The river curves; every zone is still an axis-aligned rectangle and the roads are straight.
**Before Cedar Heights, the Sawmill road and any curved street:** walkable areas need to stop being rectangles (a walkable polygon or ribbons along road centrelines), because the concept's loop road and winding timber road cannot be walked on a rectangle. Opus 5.5 to design, then Sonnet 5.5.
| Phase | Content | Status / model |
|---|---|---|
| 1 | The land, a curving river, the County Bridge and road, the zones (city, County Road, Willow Fields, Pine Ridge), a thinned forest with clearings, three open tractor-ready fields | **Done in 0.22.0 and 0.23.0** |
| 2 | Farmyard (barn, farmhouse, silos) in the farm's north-east strip and the Sawmill in Pine Ridge's clearing, both placed from the map; the fork signpost | **Done in 0.24.0**. Still to do: timber loading props, river-bank rocks and grass, farm animals and crops (Sonnet 5.5) |
| 3 | Alder Center in the city's northern half (town square, police station, plots C1-C2); parking lots | Sonnet 5.5 |
| 4 | Eastbank Works and its cargo route (the first gas station); Cedar Heights and plots R1-R3 | Sonnet 5.5 |
| 5 | Ambient traffic on the road graph, then drivable vehicles | Opus 5.5 for the vehicle architecture, Sonnet 5.5 to build |

Target: under 60-90 seconds on foot between main hubs (the city to Pine Ridge's first clearing is about 150 m, about 35 s walking).

## NPCs
- Homes and schedules: home → work / shop / park → home by time of day, walking the sidewalks, entering and leaving through
  the same doors as the player and hidden while inside. Needs the road graph and door data. **Model: Opus 5.5** for the
  design and first pass (schedules, pathing, saves), then Sonnet 5.5 to iterate.
- Far-away NPCs are data only (position along a schedule), not meshes.

## Lumberjack: tools and levels (planned)
**Today.** One axe ($20). A pine takes 3 hits (2 from level 6); 2 XP per swing, 12 per fall; 40 XP to level 2 and 20 more
for each level after that, capped at 20 (about 4,180 XP, roughly 260 pines). Perks: faster swings every level, a third log
at level 3, a fourth at level 8. Logs sell for $1.00.

**Proposed model: tools set power, levels refine.**
- Each tool has `power`; each tree species has `toughness` (pine 3, oak 6, giant 10). Hits = ceil(toughness / damage) with
  damage = power × (1 + 0.04 × (level − 1)). Levels then improve swing speed, log yield and XP, not hit count.
- Tool ladder (numbers to tune in play):

| Tool | Unlock | Price | Power | Notes |
|---|---|---|---|---|
| Hand axe (today's axe) | level 1 | $20 | 1.0 | |
| Forester's axe | level 5 | $85 | 1.6 | faster swing, better balanced carry |
| Felling axe | level 10 | $240 | 2.4 | two-handed swing, bigger bonus logs |
| Chainsaw | level 15 | $900 + fuel | 6.0 | hold to cut continuously, uses fuel, loud, ruins some log quality |
| Harvester (optional, late) | level 20 | job-site | — | industrial, tied to the sawmill |

- Tool durability and sharpening are optional extras; skip until the economy needs a money sink.
- Species: pine now; add oak and a giant tree in the deeper forest so tools matter. XP per fell scales with toughness, which
  also fixes the grind at high levels.
- Sell price rises with log grade (tool and level), and the sawmill and building supplier turn logs into planks and parts
  for building later.
- **Save impact:** `progress.equipped` already holds a tool id; plots store `hits` as whole numbers, so switch them to
  accumulated damage and migrate old saves. **Model: Opus 5.5** to design the migration and balance; **Sonnet 5.5** to build the items,
  chainsaw behaviour and UI; **Haiku 5.5** for price and number tweaks afterwards.
- Lumberjack as a job (contracts at the lumber yard: "deliver 10 logs") reuses the gig system. **Model: Sonnet 5.5.**

## Fuel, gas stations, farm, hired workers, vehicles (planned)
- **Fuel.** One fuel resource at first. Each tool or vehicle has a tank size and a burn rate (the chainsaw burns it per second of
  cutting). Low-fuel warning, a **jerry can** item, and a paid tow as a last resort so nobody is stranded. Two stations: one by
  the woods road for loggers, one on the freight road near Eastbank Works for trucks. A station is a small template interior plus
  outdoor pumps used with E. Model: **Sonnet 5.5** for the station and pumps; **Opus 5.5** to design fuel in the save format.
- **Farm slice.** Farmhouse (facade only at first), barn (storage and equipment, template interior), and the existing eight
  fields as plots. Loop: till, plant, grow over game days, harvest, sell; a Farming skill on the same skills table. The farmer sells
  seeds and rents you a field for a daily fee (a stepping stone to plot ownership). Fields are about 230 cells, so add area
  tools (a 3x3 hoe, later a tractor with fuel) and draw crops as instances. Model: **Sonnet 5.5**; **Opus 5.5** for rent and ownership.
- **Hired NPC workers (late game).** Treat each as a contract: a wage per day, an output per day, a site and a reliability, settled as
  game time passes, with a visible worker only when you are nearby. Wages become recurring bills. Needs NPC homes, plot ownership
  and storage first. Model: **Opus 5.5**.
- **Parking, driving, traffic, in this order.** (1) Parking lots as map data (spaces with position and heading) filled with parked
  cars: **Sonnet 5.5**, with Alder Center and Eastbank. (2) Driving: a new mode with its own controls, camera, entering and
  leaving, collisions, fuel and a saved position; recheck the 60-90 second travel targets. **Opus 5.5** for the architecture, Sonnet to
  build. (3) Traffic: ambient cars on the road graph, capped at about 10 visible, never running you over at first: **Sonnet 5.5**.

## First pack: Quaternius Stylized Nature MegaKit (done in 0.21.0)
Three pines for the woods, two broadleaf trees for the farm and the edges, converted and instanced (see `ASSETS.md` and the README). The Standard
version has no log or stump model. Follow-ups, in order of value:
1. **Performance check in the forest** on your machine (worst case 1.64 M triangles in view; instanced meshes are culled whole). If it is slow: split
   the instances into 32 m chunks so distant chunks are culled, or add a lower-poly far version. Sonnet 5.5.
2. **A log and stump model** from a fuller pack (or the Source version) to replace the textured cylinders. Sonnet 5.5.
3. **More of the pack:** bushes, ferns, flowers, grass, rocks and pebbles for the farm and the forest floor, the dead and twisted trees for variety. Sonnet 5.5.

## Asset foundation (Step 0, before adding more art)
- **Contract:** 1 unit = 1 m, the character is 1.95 m, +Z forward, Y up, pivot at the base centre, sizes snapping to the 1-unit grid,
  a polygon budget per category, one flat-shaded look.
- **Manifest:** `ASSETS.md` plus a data file of id, category, size, pivot, tags, source, licence. Maps and items reference ids
  (`vehicle.pickup`), never file names.
- **Converter and loader:** the character converter generalised to static models (weld, flat shading, byte-packed, embedded),
  instancing for repeated props, and a preview page that shows any asset beside the character for scale.
- **Storage:** release folders copy the 3 MB of character data every version; keep assets in a shared, unversioned location
  (test that file:// loading allows it first).
- Collect in this order: town buildings, street props and parked cars (Alder Center); warehouse, workshop, trucks, crates, fuel
  pumps (Eastbank); farmhouse, barn, silo, fences, crop stages, tractor (farm); axe tiers, chainsaw, jerry can, oak, giant tree,
  stump, sapling, logs (tools); sounds later. Check each pack's licence. Model: **Sonnet 5.5**.

## Other near-term items
| Item | Model |
|---|---|
| Logs as models (Quaternius nature kit; check the licence on the pack first), regrowth tuning | Sonnet 5.5 |
| Farming: tilling, planting, harvest on the plot grid; reuses skills and stats | Sonnet 5.5 |
| Base building: modular pieces snapping to the 1-unit grid, plot ownership | Opus 5.5 (design), Sonnet 5.5 (build) |
| Better axe grip / further animation polish | Sonnet 5.5 |
| Multiplayer beyond positions (appearance, shared plots, authority) | Opus 5.5 |
| Copy, constants, CSS, README | Haiku 5.5 or Sonnet 5.5 |

## Open questions
- Should the river be crossable only at bridges for NPCs and vehicles too (yes, planned)?
- Hunger, thirst and energy drain while chopping: none today.
- How fast should regrowth be once oaks and giants exist?
