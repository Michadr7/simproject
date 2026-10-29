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

## Map (concept 03 — Town & Outskirts)
Build now vs reserve for later, as in the concept sheet. Staged geography (no elevation):

| Stage | Content | Model |
|---|---|---|
| 1 ✔ | Re-express the current world in `map-definition.js` (this release) | Sonnet 5.5 |
| 2 | Alder Center: town square, two commercial plots (C1–C2) reserved, walkable loop from Oak Street | Sonnet 5.5 |
| 3 | Eastbank Works: warehouse, vehicle workshop, building supplier, two industrial plots (I1–I2), cargo route as a delivery job | Sonnet 5.5 |
| 4 | Cedar Heights: residential loop, three plots (R1–R3) reserved | Sonnet 5.5 |
| 5 | Willow Fields / Pine Ridge: the farm and forest zones grow into the concept's farm and sawmill areas; river as a flat barrier crossed at one bridge; ridge as background props | Sonnet 5.5 |
| 6 | Ambient trucks on the cargo route, with hooks for player-driven vehicles later | Sonnet 5.5 (Opus 5.5 if vehicles become drivable) |

Target: under 60–90 seconds on foot between main hubs. Fast travel or vehicles later. Interiors tiers: full interiors for
the apartments, market and café; one reusable template interior (counter, shelves, a task) for the laundromat, warehouse,
workshop and supplier; façade-only houses until plot ownership exists.

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

## First pack: Quaternius Stylized Nature MegaKit (waiting for the upload)
Checked on the pack's page: CC0 (free for personal and commercial use), glTF / FBX / OBJ, textured, 116 models (40 trees, 35 plants and
flowers, 27 rocks), tree leaves can swap between 7 varieties. The page lists a free "Standard" version (60-70% of the pack) and paid
tiers, so which trees and logs exist depends on the version you downloaded; I will map from what the folder contains.
Wanted: **3 pine / spruce models for the Forest zone, 2 broadleaf models for the Farm and City zones, and a log model to replace the
cylinder logs.** Plan (Sonnet 5.5):
1. **Convert.** `scripts/build-assets.mjs` reads the glTF files, welds vertices, keeps the pack's flat shading, merges each model into one
   geometry per material (bark, leaves), packs the textures as data URLs and writes embedded modules, the same way the characters are.
2. **Manifest.** `assets.js` lists `tree.pine.1-3`, `tree.broadleaf.1-2`, `prop.log.1` with category, licence, source, target height range,
   trunk radius (for collisions), pivot at the base, and the variants the world places.
3. **Scale.** Each model is normalised to the manifest's heights (the game's own pines today, so the camera clearance, the dither fade
   and the chop target ring all keep working), with random per-tree scale and rotation within a range.
4. **Instancing.** One `InstancedMesh` per model per material (a bark and a leaf mesh each): about 6 for the pines, 4 for the broadleaf
   and 1-2 for logs, so roughly a dozen draw calls for the whole forest. Felling, stumps, saplings, regrowth and the falling animation
   keep working on instance matrices exactly as they do now.
5. **Logs** become instances of the pack's log model (ground logs, `progress.logs` unchanged).
6. **Tests:** the manifest validates (licence present, heights within range), instance counts equal the layout counts (333 cuttable
   trees, 1,087 decor), the draw-call budget, collisions and chopping unchanged, and a preview page shows each asset beside the 1.95 m
   character. Model: Sonnet 5.5.

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
