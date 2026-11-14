# Eden Ridge: master map reference

Design only, no code. Written 2026-11-13. Units: 1 unit = 1 m, north is -z, x grows east.
Every number is tagged (m) measured in the code or (e) estimated/proposed.

| # | Section | Status |
|---|---------|--------|
| 1 | Frame (grid, regions, terrain, water, budgets) | Done 2026-11-13, decisions below |
| 2 | Ironwood town (see notes/ironwood-city-design.md) | Not started here |
| 3 | Businesses | Draft 2026-11-14, 8 open questions (section 3 below) |
| 4 | Blackstone Pass and Lake | Draft 2026-11-13, 8 open questions (section 4 below) |
| 5 | Eden Industries | Draft 2026-11-13, 8 open questions (section 5 below) |
| 6 | Roads and connections | Draft 2026-11-14, 8 open questions (section 6 below) |
| 7 | Rules | Draft 2026-11-14, open questions collected in 7.9 |
| 8 | Build order | Drafted 2026-11-14 (at the end of this note) |

## 1. The frame

### 1.1 World rectangle and where the old block sits
- New world: x -450..1050, z -1200..600 = 1500 x 1800 (e, proposed).
- Old block offset: (0, 0). It keeps its coordinates: playable x -250..290, z -380..100 (m). It then sits
  200 m from the west edge, 500 m from the south edge, 820 m from the north edge, 760 m from the east edge:
  west/south-west as decided.
- Why offset 0: every pinned coordinate, every save position and all 5 test files that pin old places keep
  working. Any other offset shifts thousands of literals for no gain.
- Later growth north/east/west only moves the world edges; the sea closes the south for good.

### 1.2 Chunk grid
- Chunk 100 x 100 m (e): 15 x 18 = 270 chunks. Index i = floor((x+450)/100), j = floor((z+1200)/100).
- Load ring 5 x 5 around the player's chunk (e): nearest unloaded ground is 200 to 300 m away, fog ends
  about 155 m (m), so chunks appear and vanish inside the fog. A 3 x 3 ring (100 m) would pop in view.
- Keep ring 7 x 7 (e): a chunk unloads only when it leaves this, so walking a border does not thrash.
- Loaded ground 250,000 m2 (e) against today's whole ground 560 x 500 = 280,000 m2 (m): the loaded world
  stays the size of today's map, which is why today's budget can hold.
- Seamless rules (all e):
  - Build new chunks in time slices of about 2 ms per frame; a car at 30 m/s crosses a chunk in 3.3 s and
    needs one new row of 5 chunks in that time.
  - Culling: per-chunk bounding box plus the existing tree distance cull; far chunks are skipped whole.
  - Colliders: registered with the chunk, needed only in the inner 3 x 3. Anything moving outside it
    (NPC trucks) follows the road graph without collision.
  - Night lights: windows and lamps glow as emissive parts of the merged chunk mesh; real lights come
    from a small pool (about 8) given to the nearest lamps. Not verified how lights work today.
  - Multiplayer: each client streams around its own player. Shared state (plot ownership, vehicles,
    doors, cargo) is keyed by world position, never by "is the chunk loaded". Not verified against the
    current netcode.
  - Saves: world coordinates only, never chunk indexes. With offset 0 old saves stay valid.
  - Region data is split per chunk at build time; the map definition stays one readable source.

### 1.3 Region map (proposed bounds, all e unless marked)
| Region | x | z | Density | Hook (skills / reputation) |
|--------|---|---|---------|----------------------------|
| Old block (unchanged) | -250..290 (m) | -380..100 (m) | - | - |
| Ironwood town (was Alder Center) | -20..70 (m) | -142..-48 (m) | dense | town reputation gates the better town jobs |
| Westside / Cedar Heights / Eastbank Works | as today (m) | as today (m) | dense | unchanged |
| Husky Ranch (old Willow Fields -170..-35, -286..-178 (m)) | -330..-35 | -420..-178 | dense | farming and animal-care skill |
| Pine Ridge forest | -25..190 (m) | -316..-216 (m) | medium | forestry skill |
| Blackstone Pass | 350..1050 | -1200..-700 | medium | hunting, tracking, ATV skill |
| Blackstone Lake (basin) | 520..800 | -660..-440 | medium | fishing skill, fun only, no job yet |
| Eden Industries | 700..1000 | -360..-60 | dense | welding, laser, milling skill; reputation with Bruce Hughes |
| Harbor town (name open) | 160..520 | 250..440 | dense | dock, ferry, fish market, rentals; harbor reputation |
| Coast and sea | -450..1050 | shore about 440, sea to 600 | sparse | boating skill later |
| In between | rest | rest | sparse | ATV country |

The 5 existing small hills (m): west-hill (-192, 5, h 9), west-knoll (-160, 84, h 5), north-west-hill
(-212, -356, h 8), ridge-east-hill (264, -300, h 8), ridge-east-knoll (266, -356, h 6). Proposal: KEEP all
five where they are. They are inside the old block, pinned by the terrain test, and none is in Blackstone.
Only conflict: north-west-hill lies inside the proposed Husky Ranch growth: keep it as a pasture hill or
shrink the ranch (open question).

Buyable empty plots, about 40 x 40 m each (e), all outside every zone:
| # | Centre (x, z) | Reason |
|---|---------------|--------|
| P1 | 600, -690 | lake north shore: cabin, fishing spot |
| P2 | 900, -900 | pass overlook: hunting lodge, best view |
| P3 | -390, -100 | quiet west river bank, first in line for west growth |
| P4 | 480, 40 | halfway on the Ironwood to Eden road: diner or fuel, passing traffic |
| P5 | 700, 400 | coast bluff east of the harbor: beach house, tourism |
| P6 | 40, 400 | river mouth, west bank: home with boat access |
| P7 | -300, -330 | beside Husky Ranch: hobby farm |
| P8 | 100, -520 | north of Pine Ridge: secluded, ATV base |
| P9 | 640, -200 | outside the Eden Industries gate: supplier workshop |

Harbor town names (tree names, none used yet): Cypress Harbor, Juniper Bay, Tamarack Landing,
Sycamore Point, Hemlock Cove.

### 1.4 Terrain and water
How water is built now (m, from one Grep): one river 'north-river', width 12, bank 2.6, a point list
running west to east; valleyAt digs a channel 1.4 deep under ground 0; the water is one flat ribbon
mesh at RIVER_WATER_Y -0.95 with a plain transparent material (no flow); the valley fades out at
x -262..-252 and 292..302; two bridges are rectangles whose deck rises along z.

Dug-basin method (e): ground stays y 0. Each water body is a negative term added to the height
function, the same way valleyAt works: lake = polygon outline with a cosine shore slope down to the
bed; sea = everything south of the shoreline, sloping 0 to -2.6 over about 25 m of beach; river =
today's channel. Blackstone hills are positive relief like today's hills, only bigger.

Water levels, source to sea (e unless marked):
| Reach | Path | Width | Depth | Water y | Speed |
|-------|------|-------|-------|---------|-------|
| Blackstone stream | from a hill about (850, -1050) down to the lake at (700, -660) | 3 | 0.3 | hill height, cascades to -0.90 | 1.5 m/s |
| Blackstone Lake | basin 520..800, -660..-440 | - | 2.5 | -0.90 flat | still |
| Outflow | (540, -470) to (470, -380), (400, -260), joins the old end (318, -233) (m) | 12 | 0.45 | -0.90 to -0.95, one low weir | 0.6 m/s |
| Old reach, unchanged | (270, -225) west to (-270, -129) (m) | 12 (m) | 0.45 (m) | -0.95 (m) | 0.6 m/s |
| West bend | (-270, -129) to (-330, -90), then south | 14 | 0.5 | -0.95 | 0.6 m/s |
| South reach | x about -330, z -90..150, then south-east | 14 | 0.5 | -0.95 to -2.0 in 3 rapids of 0.35 | 0.8, rapids 2 m/s |
| Estuary | to the mouth about (120, 440) | 25 | 1.0 | -2.0 | 0.3 m/s |
| Sea | south of z 440 | - | to 2.6 | -2.0 | waves only |

Where the bend goes: OUTSIDE the old block, at x about -330. The west hill reaches x -244 (m) and
needs 25 m of open grass (m), so nothing can pass between Westside and the hill; the dirt track from
Oak Street's west end (-58.5, 5) (m) fills that meadow. West of x -270 there is no pinned thing. The
river then turns south-east below the old block (south of z 110) and meets the sea just west of the
harbor town, so the Ironwood to harbor road never has to cross it (alternative: straight south, mouth
at x -330, far from the harbor; open question).

Data each water body needs (for the later look pass, one draw call per body, no mirror): river
segment = points in flow order, width, depth, water y at start and end, speed; lake = outline, water y,
depth, shore width, inflow and outflow points; sea = shoreline, water y, beach width. Today's point
list runs against the new flow (west to east): reverse it or add a flow flag.

Could not verify: whether valleyAt copes with a sharp bend; riverZAt assumes "mostly west to east" (m)
and fails on a south reach; bridges rise along z only (m), so a bridge over a north-south reach needs
an axis; how a sloped water surface (rapids) would be drawn; where the ground mesh and the "dense
scenery that hides the end of the world" rectangles (map-definition.js line 453) (m) sit, they are now
in the middle of the map and must move to the new edges.

### 1.5 East exit
Today: Freight South ends at x 290, z 68 and the exit path starts at x 322 (m); the first point must
lie outside the playable rectangle (m). Proposal: Freight South carries on east as the road to Eden
Industries and the exit moves to the east edge, first point about (1082, 65) (e). Trucks then drive
790 m more per trip (e): they must run on the road graph outside the collider ring. The harbor adds a
second "exit" by sea (cargo ferry) later.

### 1.6 Budgets at this size
| Item | Today | Whole new map | With the 5 x 5 ring |
|------|-------|---------------|---------------------|
| Mask cells at 0.5 m (m) | 1120 x 1000 = 1.12 million (e, from the ground rect) | 3000 x 3600 = 10.8 million | 25 x 40,000 = 1.0 million |
| Mask memory, 3 byte arrays seen (m), sizes not confirmed | about 3.4 MB (e) | about 32 MB (e) | about 3 MB (e) |
| Draw calls, budget 300 (m) | whole map | far over | about 8 static per chunk x 25 = 200, plus 100 for people, cars, water, sky (e) |
| Chunk geometry | - | - | 0.5 to 2 MB each, 12 to 50 MB loaded (e) |

- FLAG: the whole-map mask (10.8 million cells) must not be built at load. Build it per chunk on demand;
  the whole-map reach check (every zone reachable from spawn) moves to the test run or a coarse 2 m grid.
- Dense chunks (Ironwood) may spend up to 20 calls, sparse ones 3 (e). Props stay instanced per type
  for the whole ring, not per chunk. Characters 15, cars 10 stay as today (m).
- NPC routes across chunks need the road graph, not the cell mask.

### 1.7 Pinned tests that must change
- tests/height.mjs line 35 (m): valleyFade(-270) = 0 and valleyFade(310) = 0; the river now continues
  past both. RIVER_WATER_Y as one constant becomes per-reach.
- tests/terrain.mjs (m): lines 21..27 scan the whole playable area (10 times more cells; lake and sea
  must count as water); line 36 uses riverZAt by x; line 54 whole-map reach; line 70 nodes at x 290.
- tests/map.mjs (m): line 145 playable literal; exit-outside-playable rule; "river leaves the ground"
  rule; bridge rules.
- tests/roads.mjs (m): one paved network within 0.5 m; every new region road must join it.
- tests/town.mjs: not inspected; with offset 0 it should not change.

### 1.8 Risks
1. Streaming is a rebuild of how the world, mask and colliders are made, not an add-on: largest risk.
2. Hitches when chunks build; cure is time slicing and merged meshes.
3. Multiplayer: players far apart see different loaded sets; shared objects need an owner.
4. Sloped or stepped water and bridges over a north-south reach do not exist yet.
5. Tests run the packaged release and scan the whole map: test time grows about 10 times unless chunked.
6. 1500 x 1800 with only 9 dense spots can feel empty: ATVs and the plots carry the in-between.
7. Fog at 155 m hides the lake's far shore (280 m) and the sea horizon: the visual pass must decide.

## Decisions (user, 2026-11-13) - these settle the questions listed after them
- World x -450..1050, z -1200..600; old block at offset (0, 0). Accepted.
- Chunks 100 m, load ring 5 x 5. Accepted.
- River bend outside the old block at x about -330: accepted (user had no view; it keeps the pinned old map intact).
- River mouth: into the bay beside the harbor town (about x 120, z 440), with an estuary. The water is **Kaspian Bay**.
- Harbor TOWN name: **Kaspian Bay** (same name as the water; decided 2026-11-14). The five tree names in 1.3 are no longer needed.
- The five small hills: the design agent decides keep/move/remove.
- Husky Ranch grows west.
- Truck exit moves to the east edge, past Eden Industries.
- Water levels and rapids (lake -0.90, river -0.95, sea -2.0, 3 rapids): accepted.
- The nine plots P1 to P9: proposed to be kept as listed; user was asked "does that work" and has not objected (confirm when convenient).

## Decisions, section 4 (user, 2026-11-13)
- Eden Outdoors goes at the lake car park (a small counter in Ironwood may follow later).
- Hunting starts with a bow; a rifle comes later, one step at a time. The camera/photo activity is dropped for now.
- Meat and pelts can be sold; once a player owns a related business they can be processed first. Trophies come too. Bruce Hughes takes a cut.
- 12 rigid animals at once to start; test later whether more hold the frame rate.
- Peak heights accepted: about 100 m Blackstone Peak, 70 m West Crag, 40 m saddle; data, adjustable at build time (overrides the 60/45/28 m figures in section 4).
- Boat ramp: a placeholder now. Dangerous animals: wait until the damage system is designed.
- Hunting licence: YES. Bought at a counter (Eden Outdoors); hunting without one triggers the crime system (not built yet). Bruce Hughes dislikes illegal hunting. Reputation may gate it later.
- OPEN, goes to section 7 (Rules): where weapons may be used (hunting zones, town no-weapon zones, penalties).

## Open questions for the user (as asked; answers are in Decisions above)
1. World rectangle x -450..1050, z -1200..600 with the old block at offset (0, 0): accept?
2. Chunk 100 m with a 5 x 5 ring, or bigger chunks with more fog?
3. River bend outside the old block at x about -330: accept?
4. River mouth beside the harbor town (about x 120) or straight south at x -330?
5. Keep all 5 small hills in place, also the one inside the ranch growth?
6. Husky Ranch: grow west and north as proposed or stay in the old farm rectangle?
7. Truck exit on the east edge past Eden Industries, or somewhere else?
8. Harbor town name: which of the 5?
9. Which of the 9 plots stay (5 to 10 wanted)?
10. Lake at -0.90 and river at -0.95 with a low weir, sea at -2.0 with 3 rapids: accept?

## 4. Blackstone Pass and Blackstone Lake
Purpose: fun away from work (hunting, fishing, camping, ATV riding). Rectangles, stream, lake level, P1 and
P2 are as in 1.3 and 1.4. Ground stays y 0; hills are positive relief, the lake is dug in. All (e) unless (m).

### 4.1 Layout
Terrain zones (inside the pass x 350..1050, z -1200..-700):
| Zone | Where | Height | Ground and trees |
|------|-------|--------|------------------|
| Foothills | z -820..-700, whole width | 0..12 m, rolling | grass, clumps 1 tree / 400 m2 |
| Forest belt | z -1000..-820 | 12..30 m | pine, 1 tree / 150 m2 |
| High pass | saddle (700, -1060), 28 m high, between the two peaks | 28..40 m | rock, scrub, 1 tree / 1000 m2 |
| Blackstone Peak (summit) | (950, -1120), h 60, radius 250 | to 60 m | bare rock top, summit viewpoint |
| West Crag | (450, -1100), h 45, radius 200 | to 45 m | rock, cliff face on its south side |
| Overlook spur | P2 (900, -900), a shelf at 25 m | 25 m | open, lodge plot, best view of the lake |
- Hill shape: cosine bumps like today's hills; max slope = h x pi / (2 r): Peak 0.38 (21 deg), Crag 0.35 (19 deg).
  Both peaks are 5 to 7 times taller than the biggest old hill (9 (m)). Peak and Crag spill past the north
  edge z -1200: fine, the edge is a scenery wall.
- Slope rule: gravel road max 10 deg (pickup and worktruck); ATV trail max 25 deg; walking max 35 deg;
  steeper is cliff (not climbable, blocks like a wall). Road cut into the slope where it would be steeper.
- Tree rule: none within 6 m of a road or trail, 15 m of a camp or plot, 10 m of the shore; trees stay
  instanced per type for the whole ring (1.6), with the existing distance cull.
- Stream: source spring at (850, -1050) on the Peak flank at about 40 m, runs south-west in a dug gully
  1 to 2 m deep, crosses the forest, drops over the **Blackstone Falls** at the foothill edge (720, -770):
  a 6 m fall into a plunge pool 12 m wide, then 110 m of calm stream to the lake mouth (700, -660).
  Trail and road cross it on 2 fords (no bridge needed: depth 0.3).
Roads and trails (road geometry belongs to section 6; this is the request):
- Access road (gravel, 7 m): leaves the Ironwood to Eden road at about (600, 60), runs north along x 600
  west of Eden Industries to the lake car park (620, -420). No river crossing: the outflow starts at x 540.
- Lake road (gravel, 6 m): car park east along z -420 to (830, -420), north on the east shore to the
  trailhead (830, -720), then switchbacks to P2 (900, -900). This is the pickup limit.
- ATV loop, about 1.6 km, 2.5 m dirt: trailhead (830, -720), forest to the saddle (700, -1060), down the
  Crag side to (450, -850), back east through the foothills past P1 to the trailhead. Two spurs: summit
  (walk-only last 150 m) and Blackstone Falls.
- Lake shore path, about 900 m, walking and ATV at walking speed.
Sites: camps C1 (760, -790) by the plunge pool, C2 (480, -900) west forest, C3 (700, -1040) high camp at
the saddle; each 20 x 20 m, fire ring, 2 tent pads. Hunting stands H1..H4 along the forest belt edge.
Lake shore (basin 520..800, -660..-440): sand beach on the south shore x 590..690; dock 20 m into the water
at (650, -450); boat ramp (700, -445) as a placeholder for later boats; fishing spots: dock end, stream
mouth (700, -660), outflow weir (540, -470), rocky point east shore (790, -540), P1 shore (600, -680).
Photo and view spots: dock at sunset, Blackstone Falls, the saddle, Peak summit, P2 overlook.

### 4.2 Activities
| Activity | Content | Exists (m) | New small feature | New system |
|----------|---------|------------|-------------------|------------|
| Fishing (fun only) | lake: bass, perch; stream: trout; weir: catfish; dawn and dusk bite best; rod + bait (worms, lures) | inventory, progress.skills + addXp (only lumberjack yet) | rod, bait, fish items; cast, wait, reel timing bar; catch log | none if fish stay non-sellable |
| Hunting | foothills: rabbit, turkey; forest: deer; high pass: elk (rare); only inside the pass rectangle; no shots within 100 m of roads, camps, plots; daily bag limit | inventory, money | weapon item, licence item from Eden Outdoors, bag limit counter | wildlife (spawn, wander, flee, hit test) |
| Meat and pelts | sell to Eden Outdoors (Bruce pays low) or keep | money, inventory | buy-back list at the shop | none |
| Camping | tent pitch at C1..C3, campfire, sleep to skip night | life.js needs (m, file exists, not inspected) | tent and firewood items, "rest at camp" action | none |
| Recreation | ATV loop, trails, viewpoints, photo spots | vehicles: worktruck, flatbed (low), offroad pickup (mid, rough 0.35) (m); no ATV, no high tier (m) | viewpoint markers, phone photo with a "spots found" list | ATV class (after the Blender model) |
Hooks only (no design): skills fishing, hunting, tracking, ATV riding level via addXp; a hunting licence
gated by reputation with Bruce Hughes later; elk tags for high reputation; fish sellable later.
ATV needs from this terrain: climb 25 deg, near-zero rough penalty on dirt and grass, turn radius about 4 m
(pickup rMin 6.5 (m)), width under 1.3 m for 2.5 m trails, fording 0.3 m; handling itself is a later note.

### 4.3 Eden Outdoors (Bruce Hughes)
- Place: lot (680..730, -430..-390), front on the lake road beside the car park. Why: every trip to the
  lake or pass passes the door; 30 m north of the Eden Industries fence (z -360) so it reads as Bruce's
  brand; outside the basin and every zone.
- Building: one hall 30 x 20 m, 7 m high, log-and-steel look, porch; side yard 20 x 40 m with ATVs on
  display and a 60 m test track ring. About 4 draw calls when merged (e).
- Stock (placeholder prices): ATV 4,500; fishing rod 60; bait pack 5; lure set 25; hunting rifle 600 or
  bow 350 (Q2); ammo 20; hunting licence 150 per in-game week; tent 120; firewood bundle 8; camp stove 40;
  binoculars 80; trail map 10. Buys: pelts 15..60, meat 10..40 (Q3).
- Staff post: one counter NPC (a shop job slot for later); Bruce himself appears now and then (no new NPC).

### 4.4 Cost and risk
- Draw calls per pass chunk: ground 1, water 1 (lake or stream), trail strip 1, rocks 1 = 4 (budget 8);
  trees, animals and camp props are instanced for the whole ring: + 4 animal species, + 1 waterfall
  (scrolling texture plus spray quad), + 3 Eden Outdoors in its chunk. Worst ring view: about 25 calls on
  top of 1.6.
- Wildlife: at most 12 animals alive (rabbit 4, turkey 3, deer 4, elk 1), only in the inner 3 x 3 chunks;
  each chunk rolls its animals when it enters the inner ring and drops them when it leaves; no save.
  Not skinned: rigid parts (body, head, 4 legs) swung by a few lines per frame, 1 instanced call per
  species. Skinned would add up to 12 to today's 15 (m) and break the budget: rejected.
- Fish are never in the world: the catch is shown in the UI only (0 calls).
- Assets the user must model (about 16): ATV (in progress), deer, elk, rabbit, turkey, 1 fish mesh
  tinted for 4 species, rod, rifle or bow, tent, campfire ring, dock, boat ramp, Eden Outdoors hall,
  hunting stand, waterfall rock lip, trail signs.
- Risks: fog 155 (m) hides the 60 m Peak from the lake (it shows only within about 150 m); hunting
  in multiplayer needs one owner per animal; the stream is sloped water (risk 4 in 1.8).

### 4.5 Open questions for the user
1. Eden Outdoors at the lake car park (680..730, -430..-390), or in Ironwood?
2. Hunting tool: rifle, bow, or camera-only "photo hunting"?
3. Meat and pelts: sellable to Eden Outdoors now, or keep-only like fish?
4. At most 12 animals at once, rigid (not skinned): ok?
5. Licence: bought with money now, reputation gate later: ok?
6. Peaks 60 m and 45 m: right size, or taller?
7. Boat ramp now as a placeholder, or wait for boats?
8. Any dangerous animals (bear, boar), or all of them flee?

### 4.6 Build outline (after section 8 step 1, streaming)
| Stage | Work | Model | Dense files |
|-------|------|-------|-------------|
| B1 | Hill relief, lake basin, stream gully, falls, map data | Fable | game.js (ground and water meshes) |
| B2 | Forest, rocks, trails, roads, camps, dock, viewpoints | Sonnet | game.js |
| B3 | Eden Outdoors hall, shop stock, new items | Sonnet | game.js, phone*.js if the shop is on the phone |
| B4 | Fishing: rod, cast and reel bar, catch log, fishing XP | Sonnet | game.js (hook only, logic in a new file) |
| B5 | Wildlife and hunting, licence, bag limit, buy-back | Fable | game.js |
| B6 | ATV class (needs the Blender model) | Sonnet | game.js hook only; vehicle.js |
| B7 | Camping: tent, campfire, rest at camp, photo spots | Haiku | game.js |

## 5. Eden Industries
Purpose: a second, separate job area: metal manufacturing, owned by Bruce Hughes. NOT Eastbank Works (warehouse,
truck yard, gas station stay in the old block (m)). Rectangle 700..1000 x -360..-60 = 300 x 300 m, P9, the east
exit and Eden Outdoors are as in 1.3, 1.5 and 4.3. All (e) unless (m).

### 5.1 Site layout (chunks i 11..14, j 8..11: 9 to 12 chunks, only 3 dense)
| Part | Where (x, z) | Size | Notes |
|------|--------------|------|-------|
| Main gate + guard hut | (700, -200), west fence | 12 m wide, barrier | faces P9 (640, -200) across a 6 m service road |
| Staff car park | 710..770, -260..-140 | 60 x 120 m, about 80 bays | 6 to 10 parked cars as one merged prop, not live cars |
| Office block + canteen | 780..830, -300..-260 | 50 x 40 m, 2 floors | canteen on the ground floor, Bruce's office on top |
| Hall A fabrication/welding | 800..880, -240..-190 | 80 x 50 m, 12 m high | welding bays, flash glow through the roll-up doors |
| Hall B laser and sheet metal | 800..880, -180..-140 | 80 x 40 m, 10 m | clean, glass strip, blue light |
| Hall C CNC milling | 890..960, -240..-190 | 70 x 50 m, 10 m | rows of machines, coolant tank outside |
| Hall D assembly + paint booth | 890..960, -180..-130 | 70 x 50 m, 12 m | paint-booth chimney |
| Warehouse + shipping dock | 840..960, -120..-80 | 120 x 40 m, 9 m | 6 truck dock doors on the south side |
| Steel stockyard (raw in) | 900..990, -340..-260 | 90 x 80 m | gantry crane, steel racks, coil stacks |
| Loading yard (out) | 820..990, -80..-62 | apron 18 m deep | trailers wait here, trucks turn |
- Inner ring road 8 m loops the halls; forklift lanes link stockyard -> A/B/C -> D -> warehouse (one-way flow).
- Roads (geometry is section 6): truck gate (960, -62) on the south fence; a 9 m haul road runs 127 m south to
  the Eden road (the Freight South continuation along z about 65, 1.5), which goes on east to the exit
  (1082, 65). Cars: a 6 m link from the main gate west past P9 to the x 600 access road (4.1).
- Rail spur: recommend NO for now (no train system, 1 to 2 calls and a long track for nothing); keep a 15 m strip
  free along the east fence x 985..1000 so a spur can come with a later train or harbor freight line.
- Look vs Eastbank: Eastbank is small, low, brick-and-roll-up Kenney pieces (m: industrial-q/s/t/p, 6.7..8.1 m high).
  Eden is big, tall (10..12 m), clean and corporate: dark blue-grey cladding, one green Eden stripe and logo,
  sawtooth roofs with skylights, a flagpole, tidy hedges. It must read as "the rich man's plant".

### 5.2 Jobs
Exists today (m): delivery ROUTES in jobs.js pay 1,200..1,800 (same units); skills.js has addXp and one skill,
lumberjack; Eastbank uses InstancedMesh + splitCanopy (eastbank.js). Pay bands below are placeholders.
| Job | Station | Moment to moment (mini-game) | Product | Pay band | Skill hook | Rep hook | Status |
|-----|---------|------------------------------|---------|----------|------------|----------|--------|
| Forklift / stockyard | stockyard, lanes | drive forklift, pick steel bundle, drop in a marked bay before a timer | moved stock | low | forklift | none, entry job | new small feature (forklift vehicle: glb in assets-src (m)) |
| Laser cutter operator | Hall B | load sheet, pick the nesting layout that wastes least (3 choices), press start, sort parts | flat parts | low-mid | machining | Eden rep 1 | new small feature |
| Welder | Hall A | hold a button and follow a seam line at steady speed; too fast = gaps, too slow = burn | welded frame | mid | welding | Eden rep 2 | new small feature |
| CNC machinist | Hall C | set the tool (pick right bit), zero the part (stop a slider on the mark), watch for a chatter alarm | machined part | mid | machining | Eden rep 2 | new small feature |
| Assembler / painter | Hall D | snap parts in order on a frame (sequence picker), then a spray coverage pass | finished product | mid | assembly | Eden rep 2 | new small feature |
| Shipping clerk / loader | warehouse dock | match order slips to crates, load the trailer, sign out the truck | loaded trailer | low-mid | none | Eden rep 1 | reuses cargo/delivery code (m), new UI |
| Truck driver (outbound) | loading yard | drive a loaded trailer to Eastbank, the harbor dock or the east exit | delivery | mid-high | driving | Eden rep 2 | extends today's trucking (m), longer routes new |
| Shift lead / QC | all halls | inspect 5 parts, flag the bad one; later run a crew of NPCs | quality score | high | any 2 at level 5 | Eden rep 3 | new system (later) |
Hooks only: welding, machining, assembly, forklift skills via addXp (as lumberjack); Eden reputation is the gate
per job (rep 1..3); both systems are designed elsewhere. Each mini-game: one shared "station" frame in a new file.

### 5.3 Product chain
raw steel (truck from the harbor docks) -> stockyard -> cut (Hall B) -> weld (Hall A) -> machine (Hall C) ->
assemble + paint (Hall D) -> warehouse -> ship (truck to Eastbank, Eden Outdoors, harbor, east exit).
| Product | Chain | Buyer |
|---------|-------|-------|
| ATV frames (and finished Eden ATVs) | cut, weld, paint, assemble | Eden Outdoors (4.3): the ATVs it sells are "made at Eden" |
| Utility trailers | cut, weld, assemble | Ridgeline/Eastbank, players (buyable later) |
| Truck bodies / flatbed beds | cut, weld, paint | Eastbank truck yard; export by the east exit |
| Hand tools and machined parts | cut, machine | harbor (export by ferry later), Ironwood shops |
Interplay: Eastbank trucks carry Eden goods west; the harbor docks bring steel in and take exports out; a
player-owned P9 workshop can buy offcuts and sell parts back (hook only).

### 5.4 Interiors (one at a time, per DESIGN)
Enterable: Hall A (welding bays), Hall C (CNC), office block (lobby, canteen, Bruce's office). Halls B and D and
the warehouse work from the door (station at the open roll-up door, no interior) to save cost. Bruce's office:
top floor, glass wall over the yard, a big desk, a safe; lore hook: the safe is never shown open. A second hook:
he pays on time but docks every scrap metal kilo.

### 5.5 Shifts and NPC workers
- Hours: day shift 06:00..14:00, late shift 14:00..22:00; no night shift (plant dark, guard only).
- Skinned NPCs at Eden at once: at most 6 of the 15 (m) budget: guard 1, 1 per enterable interior you are in
  (2 to 3 visible workers), canteen cook 1, forklift driver 1. Halls seen from outside: rigid silhouettes or
  none. Bruce appears now and then (counts as one of the 6). Others stay off when the player is elsewhere.

### 5.6 Cost and risk
- Draw calls in a dense Eden chunk: ground 1, roads 1, merged halls 2 (cladding + glass/emissive), fence 1,
  yard props instanced (racks, coils, containers, pallets) 2 = 7, budget 8 (1.6); the 3 dense chunks about 21.
  Effects: welding flash = 1 flickering emissive quad per open door + 1 pooled light (from the 8, 1.2); paint
  chimney smoke = 1 instanced particle call; the gantry crane 1. Interior on top: about 12 calls, the town hides.
- Noise: welding crackle, CNC whine, reverse beepers; 3 looping sounds by distance, no new audio system.
- Reuse (m, Kenney City Kit Industrial, ASSETS.md): industrial-q (warehouse 17 x 14 x 7) as the guard hut or
  small store, tank-small, the kit's chimneys (4), tanks (2), shipping containers (3), water tower; forklift
  glb (assets-src). Kenney buildings are too small and too "Eastbank" for the halls.
- User must model (about 12): 4 big hall shells (one modular kit: wall, sawtooth roof, roll-up door, dock
  door), office block, gantry crane, laser cutter, CNC machine, welding bay with screen, steel rack and coil,
  Eden sign/logo, trailer and truck body (product props).
- Risks: trucks drive about 790 m more per trip (1.5), must use the road graph; 300 x 300 m is big, so empty
  yard reads as dead: keep yards full of instanced stock; each mini-game is new UI work (5 to 6 of them).

### 5.7 Open questions for the user
1. Site layout as in 5.1 (halls in the middle, stockyard north-east, dock south), or another order?
2. Rail spur: none now with a strip kept free, or build one?
3. Which products: ATV frames, trailers, truck bodies, tools; drop or add any?
4. Does Eden really build the ATVs Eden Outdoors sells, or only the frames?
5. Enterable: Halls A and C and the office, or fewer/more?
6. Two shifts 06..22 and the plant dark at night: ok?
7. One mini-game per job (8), or start with 3 (forklift, welder, shipping) and add later?
8. Can a player own a share or rent a bay at Eden, or is it employer-only (P9 is the player's place)?

### 5.8 Build outline (after section 8 step 1, streaming)
| Stage | Work | Model | Dense files |
|-------|------|-------|-------------|
| E-I1 | Site data: rectangle, roads, gate, fence, car park, chunk props | Sonnet | game.js (map hook), map-definition.js |
| E-I2 | Hall kit and office as merged chunk meshes, yard props instanced (Eastbank method) | Sonnet | game.js |
| E-I3 | Station frame + forklift job + shipping clerk | Fable | game.js hook, jobs.js, phone*.js (job list) |
| E-I4 | Welder, laser, CNC, assembler mini-games, skill XP hooks | Sonnet | jobs.js, new file; game.js hook |
| E-I5 | Outbound trucking to Eastbank, harbor, east exit; product items | Sonnet | jobs.js, game.js |
| E-I6 | Interiors (Hall A, Hall C, office + Bruce's office), NPC shifts | Sonnet | game.js |
| E-I7 | Effects and sound (flash, smoke, loops) | Haiku | game.js |

## 3. Businesses
Design only. Places and rectangles are in 1.3, 4.3 and 5.1; crime and police rules are in the crime decisions. Pay and prices
are placeholders. Enterable means one interior at a time (DESIGN 4.3). Posts with skinned workers count against the 15 (m).

### 3.1 Master table (one row each; hours 24 h)
| Business | Region | Owner | Sells / does | Staff (posts, hours) | Enter | Status | Jobs / gigs | Skill / rep hook |
|----------|--------|-------|--------------|----------------------|-------|--------|-------------|------------------|
| Corner Market | Oak Street | town (m) | groceries, energy drink (life.js) | clerk Noah 07-14:30, clerk 14:30-22 (m) | yes (m) | exists | delivery gig, cashier (0.38) | none / town rep |
| Alder Coffee | Oak Street | town (m) | lunch meal (life.js) | manager Elena + barista 08-18 (m) | yes (m) | exists | cafe shift gig (m) | service / town rep |
| Ironwood Store, Offices, Tower, Bakery, Pharmacy, Bank, Books, Cinema, Barber, Diner, Florist, Post Office, Hardware, Furniture, Gazette, Town Hall, Clinic, Clothes, Hotel | Ironwood | town / NPC | as ironwood-city-design 4 | 8 posts exist (m), new ones per that note | one by one, per that note | 10 exist, 9 new + hotel | gigs D1..D5, cashier, envelopes | town rep gates better town jobs (1.3) |
| Police Station + jail | Ironwood | town | Ironwood PD base, holding cell, fines desk | 2 officers 07-19 (m); patrols count against 15 | yes (holding cell) | exists, jail new | Police job later (Standing gate) | none / Standing |
| Riden Deals | Eastbank | NPC | vehicles on the lot + phone Store (m) | salesperson 09-18 (m) | no (m) | exists | none | none |
| Eastbank Supply | Eastbank | NPC | trade counter (m) | counter clerk 07-17 (m) | not checked | exists | none yet | none |
| Eastbank Fuel (gas station) | Eastbank | NPC, player-ownable later | fuel (m) + snacks, see 3.3 | attendant 06-22 (m, post gas-kiosk) | kiosk yes (new) | exists, kiosk upgraded | kiosk shift gig | service / town rep |
| Ridgeline Timber Co. | Eastbank + Pine Ridge | Walt Hargrove (m) | logs, planks, timber contracts | owner, 2 fellers, sawyer, yard hand 06-18 (m) | office yes | moved, see 3.2 | logging career (m) | lumberjack (m) / Ridgeline rep (m) |
| Eastbank Freight Exchange (old office) | Eastbank I5 | NPC, player-ownable later | dispatch: haul contracts between all regions | dispatcher 06-20 | yes (copied interior) | new, see 3.2 | trucking contracts | driving / freight rep |
| Husky Ranch | Husky Ranch | Hal Brennan (m) | crops, eggs, milk, wool | farmer Hal 06:30-17:30 (m) + 1 hand | farmhouse later | grows west, see 3.4 | ranch hand jobs | farming, animal care / ranch rep |
| Eden Industries | Eden | Bruce Hughes | steel parts, frames (5.3) | as 5.5 | as 5 | new | 8 jobs (5.2) | as 5.2 / Eden rep |
| Eden Outdoors | Blackstone Lake | Bruce Hughes | ATVs, gear, licences; buys meat, pelts (4.3) | 1 counter NPC (4.3) | yes | new | counter job later | hunting / Eden rep (licence) |
| Rangers Station | Blackstone | town | Blackstone Rangers base, licence checks | 1 ranger patrol (counts) | no | new | ranger job later | tracking / Standing |
| Kaspian Bay (9 rows) | Kaspian Bay | see 3.5 | | | | new | | harbor rep |
| Plots P1..P9 | various | player-ownable later | P1 bait and boat hut, P2 hunting lodge / game processing, P3 riverside cafe, P4 diner + fuel, P5 B&B, P6 boat repair, P7 hobby farm / farm shop, P8 ATV repair and rental, P9 Eden supplier workshop | player hires NPCs later | per business | later | owner income | business skill later |

### 3.2 Ridgeline move and the old office
- Move: the Ridgeline office goes beside the Ridgeline Warehouse (door (166.9, 31.5) (m), plot I1 per tests/careers.mjs 119),
  front facing into the warehouse yard. The timber yard on I5 stays a Ridgeline site (careers.mjs 119 checks (85, 50) (m)).
- Today (m): office door (80.9, 58.3), sign (78.66, 53.5), interior origin (420, 0.165, 300); warehouse origin (440, 0.165, 300).
- FLAG (m+e): both interior origins sit inside the new Kaspian Bay rectangle (160..520, 250..440): every interior origin must
  move outside the new world before Kaspian Bay is built.
- Tests to watch (seen by Grep only): careers.mjs 119/121 (on-site points, room 'ridgeline-office'), eastbank.mjs 37 (each
  Eastbank building fits its plot), properties.mjs 12 (the EASTBANK id list). map.mjs line 50 matched but was not read.
- Old office becomes **Eastbank Freight Exchange**: the gap is that goods now move between 5 places (Eden, harbor, ranch,
  timber, Ironwood shops) and DESIGN 1 promises "running logistics", yet only Ridgeline and Eden hand out hauls. The Exchange
  posts paid hauls from every region (freight board on the phone), so a player can drive for anyone, then later own it and
  hire drivers. Bruce takes a fee on every Eden haul. (Alternative: a Ranch Co-op produce buyer: see Q2.)

### 3.3 Useful gas station (Eastbank Fuel)
- Exists (m): pump island, canopy, kiosk property eastbank-gas-kiosk, attendant post 06-22, fuel.js.
- Kiosk sells items already in items.js (m): water 100, granola bar 150, hotdog 350, sandwich 400 (cents), plus new: coffee to
  go (thirst +20, energy +15), jerky (food +20, keeps on camp trips), soda, fuel can (fills a vehicle away from the pump),
  motor oil and washer fluid (hooks for wear later), trail map (same as Eden Outdoors), ice bag (camping).
- Vitals (m): life.js tracks food, thirst, energy 0..100; thirst drains .028 and food .018 per second; at 10 or under thirst
  stops running and hunger drains energy 1.5x. items.js food and drink items carry foodRestore/thirstRestore/energyRestore.
  Snacks go into the inventory and are eaten later, so the kiosk is the "stock up before a long drive or the pass" stop; how
  an item is eaten from the inventory today was not verified.
- Staff: keep the one attendant post (m); a kiosk cashier gig reuses the 0.38 cashier POS.

### 3.4 Husky Ranch (old Willow Fields, grows west to -330)
- Exists (m): three fields (wheat, plowed, green surfaces), farmstead (barn, small barn, open barn, silo, coop, windmill,
  farmhouse), owner and farmer Hal Brennan. No plow tool or crop growth found in map-definition.js (only the 'plowed' surface).
- Animals (all rigid, instanced, wander in a pen, 1 call per species, no skinned): chickens 8, sheep 6, cows 4, goats 3, pigs 3,
  horses 2, and the ranch's huskies 3 (the name; a kennel by the farmhouse). About 7 calls in its chunk.
- Crops: wheat (exists as a surface), corn, potatoes, hay; growth as stages swapped on a field timer, no per-plant objects.
- Jobs, relaxed: collect eggs, feed and water animals, milk cows, shear sheep (seasonal), drive cows between pastures (on
  foot or ATV), plow and sow (tractor later), harvest, bale hay, mend fences, walk the huskies. No timers, no fail state,
  lower but steady pay, light energy drain, a porch rest between tasks.
- Hooks: farming and animal-care skill via addXp; ranch rep unlocks a key to the barn and later P7 seeds and animals.

### 3.5 Kaspian Bay (Kaspian Bay; town name open)
| Business | Owner | Does | Staff | Enter |
|----------|-------|------|-------|-------|
| Eden Cargo Terminal | Bruce Hughes | crane, containers: steel in, Eden goods out | crane operator, 1 guard | no |
| Harbor Master | town | berths, permits, boat licence | 1 clerk | yes |
| Kaspian Ferry terminal | NPC | passenger and car ferry (out of map at first) | ticket clerk | yes (hall) |
| Fish Market | NPC co-op | dawn auction; buys fish once sellable | 1 auctioneer, early hours 05-12 | yes |
| Bay Boat Rentals | NPC, player-ownable later | rowboats, small motorboats | 1 attendant | no (counter) |
| Harbor Chandlery | NPC | rope, bait, nets, marine fuel, life jackets | 1 clerk | yes |
| Seafood shack | NPC | food and drink (life.js meal) | 1 cook | yes |
| Bayview Inn | NPC | rooms for tourists, a player stay | 1 receptionist | lobby |
| Bay Tours | NPC | lighthouse and coast tours | guide (player gig) | no |
| Kaspian Bay Police | town | police post, holding to Ironwood jail | 1 officer (counts) | no |
Gigs, all different from Ironwood's on-foot deliveries: ferry deckhand (wave cars on in order before departure); fish market
porter at dawn (ice and move crates before the auction bell); boat rental recovery (tow drifting rentals back); tour guide
(lead a tourist group to 4 spots, answer one question each); container spotter (signal the crane to the right slot).
Hooks: boating and dock skill; harbor rep gates the crane and boat licence. Skinned staff here: 4 at once at most (e).

### 3.6 Economy loop
1. Steel comes in by sea at the Eden Cargo Terminal; trucks carry it to the Eden stockyard (Bruce paid on both ends).
2. Eden turns steel into parts, frames, trailers, truck bodies (5.3); frames feed Eden Outdoors ATVs.
3. Eden goods go out by truck to Eastbank, the east exit and the harbor for export; the Freight Exchange posts the hauls.
4. Ridgeline turns Pine Ridge logs into planks; planks go to Eastbank, Alder Hardware and players building on plots.
5. Husky Ranch grows crops and eggs, milk, wool; sold to Corner Market, the bakery, the diner, the seafood shack.
6. Hunters sell meat and pelts at Eden Outdoors (low price); a player-owned P2 lodge processes them first for more.
7. Fish stays fun-only; later the Fish Market buys it and the shack and diner sell it.
8. Fuel is sold at Eastbank Fuel (and a P4 station later). Bruce's cut: Eden wages paid back as Eden prices, the licence,
   the cargo terminal fee, a fee on Eden hauls and on meat and pelts.

### 3.7 Open questions for the user
1. Old Ridgeline office as the Eastbank Freight Exchange, or another business?
2. Or should a Ranch Co-op (produce buyer, seed and feed shop) take that building instead, with freight on the phone only?
3. Ridgeline's new office: a separate small building beside the warehouse, or a front room inside the warehouse?
4. Husky Ranch animals: the 7 species listed, fewer, or others (llamas, ducks)?
5. Does Hal Brennan stay the ranch owner, or does Husky Ranch get a new owner?
6. Kaspian Bay: does Bruce own the cargo terminal, or is it the town's with Bruce as main customer?
7. Kiosk extras (fuel can, motor oil): wanted now, or only snacks and drinks first?
8. Kaspian Bay name: one of the five candidates or a new one?

### 3.8 Build outline (this section only; after the regions exist)
| Stage | Work | Model | Dense files |
|-------|------|-------|-------------|
| BZ1 | Move every interior origin out of the new world; move the Ridgeline office; fix the 3 tests | Sonnet | map-definition.js, tests |
| BZ2 | Kiosk stock and kiosk shift gig (cashier POS reuse) | Haiku | game.js hook, items.js |
| BZ3 | Freight Exchange: copied office, freight board, haul contracts | Sonnet | game.js, jobs.js, phone*.js |
| BZ4 | Husky Ranch growth, pens, instanced animals, crop stages | Sonnet | game.js, map-definition.js |
| BZ5 | Ranch jobs (relaxed tasks, skills) | Sonnet | jobs.js, game.js hook, phone*.js (job list) |
| BZ6 | Kaspian Bay businesses and posts as data and buildings | Sonnet | game.js, map-definition.js |
| BZ7 | Harbor gigs (5) | Fable | jobs.js, game.js, phone*.js |

## 6. Roads and connections
Design only. Regions, plots, water and the exit are as in 1.3 to 1.5, 4.1 and 5.1; this section owns road geometry. All (e) unless (m).
Today (m): roads are axis-aligned rectangles from nodes (map-definition.js 31..63); Freight South runs x 72..199.5 at z 68,
freight-out carries it to outEast (290, 68); exit lanes in z 65, out z 71, first point (322, 65) (line 294).
Speed classes (e): street 13.4 m/s (30 mph), rural 22.4 (50 mph), gravel 13.4, dirt/track 8.9. Worktruck top 17.9 (m) is under rural.

### 6.1 Network
| Road | From -> to | Length | Width, surface | Class | Joins |
|------|-----------|--------|----------------|-------|-------|
| Eden Road (spine, part of it exists) | Freight South (72, 68) (m) -> east exit (1082, 68) | 1010 (218 m exist) | 12 asphalt (m) | rural | old block, P4, access road, coast link, Eden haul, exit |
| Eden haul road | (960, 68) -> truck gate (960, -62) | 130 | 9 asphalt | rural | spine, Eden loading yard (5.1) |
| Blackstone Access Road | spine (600, 68) -> lake car park (620, -420) | 490 | 7 gravel | gravel | spine, Eden car link, lake |
| Eden car link | access road (600, -200) -> main gate (700, -200) | 100 | 6 asphalt | street | P9, Eden gate |
| Lake Road + P1 spur | car park -> (830, -420) -> trailhead (830, -720) -> P2 (900, -900); spur trailhead -> P1 along z -700 | 760 + 230 | 6 gravel | gravel | lake, Eden Outdoors, pass, P1, P2 (pickup limit, 4.1) |
| Bay Road (Ironwood to Kaspian Bay) | freight-out (250, 68) -> (250, 380) | 310 | 10 asphalt | rural | old block, Kaspian Bay; stays east of the estuary, no crossing (1.4) |
| Kaspian Bay streets | harbor front along z about 400, x 160..520, plus 2 cross streets | 360 + 2 x 120 | 10..12 asphalt | street (town) | terminal, ferry, P5 spur |
| Coast Link (Eden to harbor) | Kaspian Bay east end (520, 330) -> spine (640, 68) | 290, diagonal | 9 asphalt | rural | harbor, spine; spur to P5 (700, 400), 190 m gravel |
| County Road (m) | alderNorth (-30, -60) -> countyEnd (-30, -246) | 186 (m) | 8 asphalt (m) | rural (m) | Ironwood, County Bridge, Pine Ridge |
| Farm road (m) + Ranch Lane | farmGate -> farmJoin (m); lane west to P7 (-300, -330) | lane 250 | 7 dirt (m); lane 6 gravel | dirt | Husky Ranch growth, P7 |
| West Bank Lane | Oak Street west track (-58.5, 5) (m) -> around west-hill -> West Bank Bridge -> P3 (-390, -100) | 410 | 6 gravel | gravel | Westside meadow, P3 (only road west of the river) |
| Pine track | Woods Road end -> P8 (100, -520) | 200 | 5 dirt | dirt | Pine Ridge, P8 |
Crossings: County Bridge x -35..-25 and Freight Bridge x 190..200 (m) stay. NEW West Bank Bridge over the south reach at about
(-330, 5): the reach runs north-south, so the deck runs along x, about 30 m (14 m water + 2 x 2.6 bank (m) + margin), rise 1.0 (m).
No road crosses the outflow (its points run (540, -470) to (318, -233), all north of the spine and west of x 600). Blackstone stream:
2 fords on trails only (4.1). P6 (40, 400) lies south-west of the estuary line (river z about 388 at x 40): needs an estuary bridge
(25 m water, about 40 m deck, diagonal) or a move to the east bank (Q3). Verified (m): riverZAt (line 483) walks the path by x and
fails on a north-south reach; deckAt/bridgeRise rise along z only ("bridges run north-south", height.js 26); the bridge rule
(map-definition.js 538) measures bank edges by x. All three need an axis (or a distance-along-path) before the west bridge.

### 6.2 Travel times (top speed only; add about 30 % for turns, junctions, acceleration (e))
| Trip | Distance | Worktruck 17.9 (m) | Pickup 26.8 (m) |
|------|----------|--------------------|-----------------|
| Ironwood (25, 6) -> east exit | 110 + 1010 = 1120 | 1120 / 17.9 = 63 s | 1120 / 26.8 = 42 s |
| Ironwood -> Eden truck gate | 110 + 888 + 130 = 1130 | 63 s | 42 s |
| Ironwood -> Kaspian Bay front | 110 + 178 + 332 = 620 | 35 s | 23 s |
| Ironwood -> lake car park | 110 + 528 + 490 = 1130 | 63 s (gravel limit 13.4: 72 s) | 42 s (limit: 56 s) |
| Lake car park -> P2 | 760 gravel | 42 s | 28 s (limit 13.4: 57 s both) |
| Eden gate -> Kaspian Bay (steel run) | 130 + 320 + 290 + 100 = 840 | 47 s | 31 s |
| Ironwood -> P3 | 60 + 410 = 470 | 26 s | 18 s |
Feel: every region is 0.5 to 1.5 min by car: compact, not too big for driving; on foot (1.4 m/s (e)) Kaspian Bay is 7 min and the
lake 13 min, so it is big for walking and vehicles and ATVs matter. Hauls stay short; pay should count distance (Freight Exchange).

### 6.3 Fuel
- Today (m): ARCADE_MILE_SCALE 8 (vehicle.js 23), gallonsPerMile = 8 / mpg: worktruck 8 mpg = 1.0, offroad 14.5 mpg = 0.5517, flatbed
  6 mpg = 1.333; tanks 21, 18, 30 gal (map-definition.js 276..279); 1 mile = 1609.344 m (fuel.js 12).
- Range of a full tank now: worktruck 21 / 1.0 = 21 mi = 33.8 km; pickup 18 / 0.5517 = 32.6 mi = 52.5 km; flatbed 30 / 1.333 = 22.5 mi
  = 36.2 km. The longest loop (Ironwood -> P2 -> Kaspian Bay -> Ironwood) is about 4 km = 2.5 gal in the worktruck: fuel barely
  matters even on the big map.
- Scale options (decide nothing): A keep 8 (range 34 km, about 8 long loops); B 24 (worktruck 3 gal/mi, 11.3 km); C 32 (4 gal/mi, worktruck
  8.4 km, pickup 13.1 km, flatbed 9.1 km: about 2 long loops, a stop every few hauls).
- Stations: Eastbank Fuel (exists (m)); P4 (480, 40) diner + fuel on the spine (3.1, halfway to Eden); Kaspian Bay chandlery pumps for
  cars and boats (3.5); a single pump at the lake car park as the "last fuel" before the pass. The gas can (m, fuel.js 42) covers P2 trips.

### 6.4 Roads on hills
- Rule (4.1): roads max 10 deg = grade 17.6 %; ATV trails 25 deg. Verified (m): heightAt = relief + valleyAt; bridges use deckAt
  above the ground (height.js 3, 30..33); roads and paving are still flat (per height.js, not converted).
- Convert: road strips subdivided every 2..4 m with y = heightAt at the centreline, flat across the width (no cross slope), the
  ground under the road and 2 m shoulders pulled to that y; junction patches and markings take the same y; the surface mask stays 2D.
- Where it matters: Lake Road north of z -700 (foothills 0..12 m) and the P2 climb: 25 m needs at least 25 / 0.176 = 142 m; the straight
  line trailhead -> P2 is 193 m (7.4 deg), so one or two hairpins only where the shelf edge steepens; hairpin inner radius 8 m (pickup
  rMin 6.5 (m)), pad about 16 m. The spine, access road and coast link run on ground 0 (in-between land): flat in practice.

### 6.5 Junctions, signs, crossings
- Verified (m): junctions.js makes fillets (FILLET_R 6) only where a vertical road meets a horizontal one, and none inside TOWNS =
  city, alder, cedar; tapers where widths change. Diagonal roads (Coast Link, hairpins, the estuary bridge) get no patch.
- Missing: angled T and Y patches (two road edges + an arc at any angle); Kaspian Bay added to TOWNS (it gets its own kerbs).
- New junctions: spine x access (600, 68), spine x haul (960, 68), spine x Bay Road (250, 68), spine x Coast Link (640, 68) (Y),
  access x Eden link (600, -200), Lake Road corners. Speed signs as props at each class change (no enforcement until section 7);
  a give-way line on every side road; a pedestrian crossing only inside towns.

### 6.6 NPC traffic and police
- Budget: 10 cars (1.6). Proposal: at most 3 moving NPC trucks + 2 police cars + 5 for player and parked live vehicles.
- Customer trucks enter at the east exit (moved to 1082, 65, 1.5). Routes on the graph: exit -> Eastbank yards; harbor terminal ->
  Coast Link -> haul road -> Eden stockyard (steel); Eden loading yard -> exit or -> Bay Road -> Eastbank; Freight Exchange hauls
  (ranch, timber, Ironwood shops). Outside the inner 3 x 3 a truck is a point on an edge (no collider), outside the 5 x 5 no mesh.
- Patrols (each officer is a skinned character of the 15): Ironwood PD loop Oak Street - Alder Avenue - Freight South - County Road;
  Blackstone Rangers access road - Lake Road - trailhead (offroad vehicle); Kaspian Bay police Bay Road - harbor front - Coast Link.
  Only the force whose region the player is in drives live; the others run as points on their loop.

### 6.7 Chunking and maps
- Roads are polylines cut at chunk borders at build time; each chunk merges its strips, patches and markings into 1 call per surface
  (asphalt, gravel/dirt): 1..2 calls, within the 8 per chunk (1.6). Ring 5 x 5: about 10 chunks touch roads, about 15 calls.
- The road graph (nodes, edges, class, length) is loaded whole (small) for routing, NPCs and maps, never per chunk.
- Map screen: one image baked from map data at load, 1 px = 2 m = 750 x 900 px (roads, water, regions, plots); the minimap crops it
  around the player. How today's minimap is drawn was not verified.

### 6.8 Risks and tests (only what was grepped)
- tests/roads.mjs 9, 27 (m): one paved network within 0.5 m; deadEnds list includes 'freight-out:to' (moves to the new exit).
- tests/junctions.mjs 9..19 (m): fillet radius 1.5..FILLET_R, every patch is road on the mask, none in a town: angled patches need new asserts.
- map-definition.js 535..541 (m, validateMap): bridge must reach both banks (by x), be exactly as wide as a zone, stay on the ground.
- terrain.mjs line 70 nodes at x 290, map.mjs exit rule: see 1.7. Risks: a north-south bridge is new code; road y on slopes is a
  rebuild of the strip mesh; NPCs off the collider ring can clip a player who stops on a road edge.

### 6.9 Open questions for the user
1. Fuel scale: keep 8, raise to 24, or 32?
2. Speed limits as signs only, or enforced later by police (section 7)?
3. P6: build an estuary bridge, or move P6 to the east bank of the mouth?
4. Coast Link Eden to harbor: wanted, or all harbor traffic via the Bay Road and the spine?
5. Fuel stations: P4 and the Kaspian Bay pumps enough, or also a lake car park pump?
6. NPC split 3 trucks + 2 police: right, or more trucks and fewer police?
7. Map screen on the phone, a key (M), or both?
8. West Bank Lane and its bridge now, or only when the west grows?

### 6.10 Build outline (this section only; after section 8 step 1)
| Stage | Work | Model | Dense files |
|-------|------|-------|-------------|
| R1 | Road data as polylines with class and chunk split; road graph; tests | Sonnet | map-definition.js, roads.js, tests |
| R2 | Roads follow heightAt; bridge axis; riverZAt by path distance | Fable | height.js, game.js |
| R3 | New roads and bridges (6.1), exit moved | Sonnet | map-definition.js, game.js |
| R4 | Angled T/Y patches, Kaspian Bay in TOWNS, signs | Sonnet | junctions.js, game.js |
| R5 | NPC trucks and police patrols on the graph | Fable | game.js, jobs.js |
| R6 | World map and minimap | Sonnet | game.js, phone*.js |
| R7 | Fuel scale and new stations | Haiku | vehicle.js, fuel.js, map-definition.js |

## 7. Rules
Design only. Crime numbers live in notes/crime-system-design.md, water in notes/water-design.md, ATV in notes/atv-handling-design.md:
pointed to, not repeated. All (e) unless (m).

### 7.1 Weapon and activity zones (data rectangles in MAP, checked by event, never per frame (crime note 3))
| Zone | Rectangle x / z | Rule | Player sees |
|------|-----------------|------|-------------|
| Hunting | Blackstone Pass 350..1050 / -1200..-700, minus 100 m around roads, camps C1..C3, P1, P2 (4.2) | bow (rifle later); licence needed | crosshair; "No licence" banner if none |
| No-weapon: towns | old block -250..290 / -380..100 (m) (Ironwood, Westside, Cedar, Eastbank, Husky Ranch yards inside it) | weapon auto put away | toast + 10 s, then crime "weapon out" (crime note 2) |
| No-weapon: Kaspian Bay | 160..520 / 250..440 | same | same |
| No-weapon: Eden | 700..1000 / -360..-60, plus Eden Outdoors lot | same; shop shows bows unloaded | same |
| No-weapon: ranch growth | -330..-35 / -420..-178 | same (animals in pens) | same |
| Fishing | lake basin 520..800 / -660..-440, stream, outflow, river, sea shore | rod only, no licence (fun only) | "Cast" prompt at the 5 spots (4.1) |
| Everything else | in-between land | weapon may be carried, not fired | "No hunting here" on draw; firing = out-of-zone crime |
- Licence: Eden Outdoors counter, 1 per in-game week (4.3); held in law.licence (crime note 1); Standing gate there.
- Owned plot: inside a hunting zone the owner may NOT open it to others; outside, a plot is always no-fire. Co-op guests follow the owner.

### 7.2 Land and plots P1..P9 (centres 1.3, 40 x 40 m)
- Price bands (placeholder): A remote P1, P2, P8 $20k..30k; B road P3, P6, P7 $30k..45k; C traffic P4, P5, P9 $45k..70k.
- Buy at the Town Hall (Ironwood) or on the phone Housing app; mortgage from the bank: 20 % down, weekly payment.
- Reuse ownership.js (m): tenure 'own' / 'rent', WEEK 7, GRACE 2; a mortgage is a third tenure 'loan' with the same bill loop.
  Unpaid: 2 missed weeks (GRACE (m)) = plot returns to the bank, buildings frozen, half the paid principal refunded.
- One plot per player at first (Q in 7.9); co-op pooling: the buyer owns it, friends can be added as builders (no shared title yet).
- Build rules: 1 main building (house or business) up to 20 x 20 m, 2 sheds up to 6 x 6 m; 5 m from the plot edge, 8 m from a road
  edge, 10 m from the shore line (water note waterAt), 6 m from a trail; max 12 draw calls per plot when merged; colliders join the chunk.
- Trespass: another player's plot is just private (no crime, no PvP); an NPC plot (ranch yards, Eden) is closed at night: crime
  note owns it if ever added.
- Save: progress.plots {id:{tenure, since, nextBillDay, due, missed, buildings:[{kind, x, z, yaw}]}}, optional, world coordinates;
  normalised like normalizeProperties (m): unknown id or bad entry dropped, numbers clamped. Map screen: owned plot filled in the
  player's colour, for-sale plots outlined with a price tag.

### 7.3 Spawn, reset and rescue
- New player: Ironwood hotel lobby (notes/ironwood-city-design.md); returning player: saved position.
- Reset (R) and stuck rescue: findNearestClearSpot (safe-spot.js (m): STEP 0.5, MAX_SEARCH 30, CLEAR_RADIUS 0.75, OPEN_AREA 300)
  around the nearest of one safe point per region: Ironwood hotel door, Kaspian Bay harbor front (340, 400), Eden main gate
  (690, -200), lake car park (620, -420), trailhead (830, -720), each camp C1..C3, Husky Ranch farmstead, each owned plot.
  Each point needs OPEN_AREA clear cells, checked by validateMap.
- Deep water: pushed back (water note Q3, swim later); sea beyond 25 m of beach the same. Slope over 35 deg: slide to the
  foot (4.1). Leaving the playable rectangle: soft wall + fade, then rescue point.
- Fast travel (open question): proposal NONE at first; later a bus between towns and the Kaspian Ferry; never the Freight Exchange.

### 7.4 World edges
- Playable after the growth: x -450..1050, z -1200..600 (1.1), sea south of z 440 is water, not land.
- Edge scenery rectangles (map-definition.js line 453 (m): [x0,x1,z0,z1,spacing,chance,salt], never on a road/river/building)
  move to a 30 m band inside each edge; north edge is the Peak and Crag spill (4.1).
- Exit: east, first point (1082, 65), must stay outside playable (validateMap 684..686 (m)); posts need an exit (line 724 (m)).
- validateMap today checks (m): roads touch a zone (592), bridges reach both banks (535..541), shop and studio interiors (624..632),
  exits outside playable, posts need an exit. New checks: every chunk index in range and each region inside playable; lakes and the
  sea do not overlap land zones, plots or each other; no road on water except bridges; plots inside playable, outside every zone and
  no-weapon rectangle, 100 m clear of hunting zones; weapon zones do not overlap each other; every rescue point clear; every
  interior origin outside the world (3.2 flag); exit first point outside the new rectangle.

### 7.5 Time, vitals, economy with distance
- Vitals (m, life.js): thirst -0.028/s, food -0.018/s; full to empty about 60 min thirst, 93 min food (e); longest drive about
  1.5 min (6.2): no trip needs a stop, the pass on foot (13 min) costs about 22 thirst. Stock-up stops: Eastbank kiosk (3.3),
  Eden Outdoors, lake car park.
- Rest points: home, Ironwood hotel, Bayview Inn, camps (tent). Multiplayer sleep: time skips only when every player in the lobby
  is resting; otherwise a lone sleeper restores energy at 3x without skipping time.
- Fuel: no change (decision 2026-11-14). Revisit trigger: a tester runs dry, or no player ever refuels in a full session.

### 7.6 Multiplayer
- Today (m): one lobby, MAX_PLAYERS 8, positions only (position / playerMoved / playerJoined / playerLeft), 25 msgs/s, 4096 bytes.
- Each client streams its own 5 x 5 ring; remote players outside it are a map marker only.
| Message | Carries | Needed by | Stage |
|---------|---------|-----------|-------|
| position (exists) | x, y, z, room | all | - |
| law | chase state, force (required, crime decisions) | crime L-stages | M2 |
| plot | id, owner, tenure, buildings | plots 7.2 | M3 |
| vehicle | id, pose, driver | shared vehicles | M4 |
| animal | id, owner client, pose, killed | hunting (one owner per animal) | M5 |
- Room names for new interiors: region-place, e.g. eden-hall-a, eden-office, eden-outdoors, kaspian-ferry, kaspian-inn, ironwood-hotel.

### 7.7 Crowds (target 16..20 vehicles and people near the player)
- Inner 3 x 3: skinned people up to 15 (m, today's budget); live cars up to 10 (m); 5 x 5 rim: rigid low-poly people (one instanced
  call, 6 bones baked into 2 poses) up to 10 (e), and cars as instanced shells on the road graph, no physics, up to 10 (e).
- Reuse: parked live vehicles count as cars; a car leaving the ring is recycled to the nearest spawn edge.
- Test on the user's GPU: spots Oak Street noon, Eden gate 07:00, Kaspian front at dusk; step 10/15/20 crowd at each, read FPS,
  draw calls, frame ms; keep the highest step with 60 FPS on High.

### 7.8 Performance gates (a test like city-budget.mjs; its location was not found by name under tests/)
- Draw calls in the worst ring view <= 300 (1.6); per chunk <= 8, dense <= 20.
- Chunk build slice <= 2 ms per frame; no frame over 33 ms while driving 30 m/s across 10 chunks.
- Loaded chunk geometry <= 50 MB; mask per chunk only, never 10.8 million cells at load.
- FPS read at 6 fixed spots (the 3 above plus lake dock, P2, Eden Hall A): >= 60 on High on the user's GPU.

### 7.9 Open questions still waiting for the user (all notes)
1. One plot per player at first, or several? 2. Plot price bands A/B/C and mortgage 20 % down: ok?
3. Fast travel: none first, then bus and ferry? 4. Lone sleeper in multiplayer: 3x energy, no time skip?
5. Eden products list (5.3) not yet confirmed. 6. Ridgeline's office as own building, Hal stays, Bruce owns the terminal: confirm.
7. Fines and Standing numbers (crime Q1, steeper by severity): exact values. 8. Chase end rules and police vehicle models.
9. ATV top speeds and price (atv Q1, Q6) per model. 10. Owned plot inside a hunting zone: no-fire for guests, ok?
11. Crowd split: skinned 15 + rigid 10 people, live 10 + shell 10 cars: ok to test? 12. Fuel scale confirmation (6.9 Q1 reading).

### 7.10 Build outline (this section only)
| Stage | Work | Model | Dense files |
|-------|------|-------|-------------|
| RU1 | Weapon and fishing zone data, validateMap zone checks, tests | Sonnet | map-definition.js |
| RU2 | Rescue points per region, edge scenery moved, new validateMap checks | Sonnet | map-definition.js, game.js |
| RU3 | Plot save format (progress.plots, loan tenure), normalise, Housing app | Opus | ownership.js, profile.js, jobs.js, phone*.js |
| RU4 | Plot building rules and placement | Sonnet | game.js |
| M2..M5 | Relay messages law, plot, vehicle, animal | Opus | relay-protocol.js, multiplayer.js, game.js |
| RU5 | Crowds: rigid rim people, shell cars, GPU test | Fable | game.js |
| RU6 | Performance gate tests | Sonnet | tests |

## Stubs for the other sections
### 3. Businesses
- Drafted: see "## 3. Businesses" above.

### 4. Blackstone Pass
- Drafted: see "## 4. Blackstone Pass and Blackstone Lake" above.

### 5. Eden Industries
- Drafted: see "## 5. Eden Industries" above.

### 6. Roads and connections
- Drafted: see "## 6. Roads and connections" above.

### 7. Rules
- Drafted: see "## 7. Rules" above.

### 8. Build order
- Drafted: see "## 8. Build order" at the very end of this note.


## Decisions: Eden Industries, section 5 (user, 2026-11-14)
- Layout order accepted. No rail spur for now (strip stays reserved). Players can enter as many Eden buildings as possible. Two shifts 06:00 to 22:00, plant dark at night: accepted.
- Eden builds parts (user already has welding parts modelled in Blender and is working on welding outside this chat); whole Eden ATVs are a yes, but later.
- Keep all 8 jobs, but each mini-game must be engaging and not repetitive. Start with forklift, welder, shipping (Claude's suggestion); the user will bring welding ideas.
- Players are employees only at Eden for now; renting a bay or owning a share is a later idea.
- Product list (utility trailers, truck bodies, tools and machined parts): not yet confirmed by the user.

## Decisions: crime and law, feeds section 7 (user, 2026-11-14)
- Hunting licence required; hunting without one is a crime. Weapons: allowed only in hunting zones; in no-weapon zones the weapon is put away automatically with a warning (a crime only if the player ignores it).
- Detection by witnesses: patrolling police, wardens or rangers (patrols wanted, otherwise nobody sees a crime). Patrols cost skinned characters from the budget of 15: count them.
- Arrest: the Police Station (Ironwood, next to the existing police car) has a jail/holding cell. Arrested = the screen goes dark, the player is moved to holding, then returns, with a toast like "You were arrested for <crime>. You were fined $<amount>."
- Unpaid fine becomes a debt to the Police, paid in weekly amounts; missing payments costs Standing.
- Standing (can go negative): bad standing blocks certain jobs (for example Police) and Eden jobs and the licence.
- Chase: GTA-like, with a search radius. Three police types with different feel:
  Ironwood Police = slower cars, city driving, bad off-road handling, normal radius;
  Blackstone Rangers = better off-road vehicles, bigger radius;
  Kaspian Bay Police = a mix of both.
- Not decided yet: chase end rules (how a player escapes, what happens when caught on the road), whether vehicles of the three forces need new models, Standing numbers, the exact list of crimes and fines.

## Decisions: businesses, section 3 (user, 2026-11-14)
- The old Ridgeline office becomes the Eastbank Freight Exchange (a board of paid hauls between all regions; player-ownable later).
- Husky Ranch has 6 to 10 animals (the proposed 7 types fit).
- Town name Kaspian Bay (see above). Other section 3 questions (Ridgeline's new office as own building, Hal Brennan stays, Bruce owns the cargo terminal, fuel can and oil later) stand as Claude's leanings, not yet confirmed.
- Code warning: the Ridgeline office and warehouse rooms sit at (420, 300) and (440, 300), inside the new Kaspian Bay area: move all room spots before the town is built. Tests to change when the office moves: careers.mjs 119/121, eastbank.mjs 37, properties.mjs 12.

## Decisions: roads, section 6 (user, 2026-11-14)
- Fuel: make fuel matter a bit more than today, "tune the tank a bit, 18-20 sounds good" (reading: trucks keep tanks of about 18 to 21 gal and the fuel scale rises from 8 to about 24; to be confirmed with the user).
- Speed limits: signs, enforced by patrols once the crime system exists (see crime-system-design.md).
- P6 on the far side of the estuary: build the bridge (another bridge is fine), P6 stays.
- NPC traffic: the user wants MORE than 3 NPC trucks plus 2 police cars; the 10-car budget is to be re-measured on the real GPU, with only cars inside the loaded chunks counting.
- Leanings stand for the rest (Coast Link yes if cheap, a pump at the lake car park, map screen on both phone and key, West Bank Lane and bridge later).

## Decisions: fuel and crowds (user, 2026-11-14, later)
- Fuel: NO change to tank sizes or the fuel scale for now; the player should not refill often. Revisit once the new map and roads exist and the problem shows.
- Crowds: target 16 to 20 NPC vehicles AND NPC people near the player (chunk-gated; far ones cost nothing), to be tested on the user's GPU. Conflict to resolve: the old budget is 15 skinned characters and 10 cars; people over 15 need a cheaper way (distant LOD, non-skinned or instanced crowd) or a re-measured budget.
- Crime complying (ticket-only: banner and 5 s countdown; put the weapon away or stop the vehicle; ticket, small Standing loss, no chase) accepted.

## Decisions: rules and plots, section 7 (user, 2026-11-14, later)
- Plots: one plot per player; it may scale with Reputation later; in co-op one player must not be able to buy all the plots.
- Fines and Standing numbers: Opus will propose them in a later pass. Chase end rules and police vehicles: a later pass. Owned plot inside a hunting zone: guests cannot fire (ok). Crowd split (15 skinned + 10 rigid people, 10 live + 10 instanced cars): yes, test it on the real GPU.
- Welding: the welding job waits until Eden Industries is built. Tier 5 (ATV frame, utility trailer, flatbed bed) is accepted: design plan in notes/welding-tier5-plan.md, the full job brief is in notes/welding-job-brief.md.
- Still unanswered (Claude's leanings only): plot price bands, fast travel, lone sleeper, Eden products list beyond Tier 5, section 3 confirmations (Ridgeline office, Hal, Bruce terminal), ATV speeds/price per model.

## 8. Build order (drafted 2026-11-14; design only)
Merges every stage table: section 4 (B), 5 (E-I), 3 (BZ), 6 (R), 7 (RU, M), ironwood-city-design.md (I), crime-system-design.md (L),
atv-handling-design.md (A), water-design.md (W). New ids here: X0 (planks bug), F0 to F3 (frame and streaming; section 1 had no table),
WJ (welding job, notes/welding-job-brief.md, Tier 5 in welding-tier5-plan.md). B6 is the same work as A4 to A7: build A4 to A7, drop B6.
The visual overhaul (sky, day/night, lights) is its own track; it shares night-lights.js with I11 only. (e) = estimate.

### 8.1 Phases
| Phase | Goal | Stages (in order) | Why this order | User check at the end | Runs (e) | Risk |
|---|---|---|---|---|---|---|
| P0 | Unblock testers, cheap held work | X0 (bump + publish), I1, I2, BZ1 | X0 blocks play; I1/I2 were held only for the map design; BZ1 moves rooms out of the new world before the frame grows | Drop planks over the limit; old stuck save loads; Ironwood name and the square without trees | 4 | low |
| P1 | Frame and streaming | F0 (Opus brief), F1 streaming on the old map, F2 world rectangle x -450..1050, z -1200..600, offset 0, bigger ground, F3 pinned tests (1.7) + RU6 gate | Everything else places things in chunks; old map first keeps tests green | Walk and drive the old loop: no hitches at chunk edges; FPS at Oak Street and the bridge stays near 165; draw calls under 300 | 6 | high |
| P2 | Water and road data | W1, W2, R1, R2, W3, R3, R4, RU1, RU2, A1, A2 | Water data before the south bridge (R3); road graph (R1) before Eden, Blackstone, trucks and patrols; zones (RU1) before weapons | New rivers, lake, sea, bridges, exit; drive every road; FPS at the lake shore and the estuary bridge | 9 | medium |
| P3 | Ironwood grows | I3, I4, I5, I6, I7, I8, I9, I10, (I11 if I6 counts over 150 calls) | Needs the frame and R4 junctions; the hotel start (I8 to I10) comes before new players meet the regions | Downtown look and FPS at Main/River Street noon and dusk (I6); fresh save starts in the lobby; hotel room | 9 | medium |
| P4 | Regions: Blackstone, Kaspian Bay | B1, B2, B3, B7, A3, A4, A5, A6, A7, BZ6, BZ2, BZ3 | Roads exist; ATVs need B3 (shop) and the user's model; Kaspian Bay needs BZ1 done | Blackstone loop by ATV, lake viewpoint FPS, Kaspian front at dusk, Freight board | 10 | medium |
| P5 | Eden Industries, ranch, harbor | E-I1, E-I2, E-I3, WJ, E-I4, E-I5, E-I6, E-I7, BZ4, BZ5, BZ7, R6, R7 | Eden needs roads and the east exit; WJ waits for E-I2 halls (user decision); jobs share jobs.js so they go one at a time | Eden gate 07:00 FPS; forklift, welder, shipping shift; map screen | 12 | medium |
| P6 | Life and law | R5, RU5, B4, B5, L1, L2, L3, L4, L5, L6 | Crime needs weapons (B5) and zones (RU1) and patrols (R5); crowds before L3 witnesses so the budget is known | Crowd steps 10/15/20 at the three spots (7.x); hunt, get caught, arrest toast, debt row | 11 | high |
| P7 | Plots and multiplayer | RU3, RU4, M2..M5, L7 | Save format and relay last, once all features they carry exist | Two clients: plot buy, law, vehicles, animals in sync | 6 | high |
| P8 | Look pass and tuning | W4, W5, W6, A8, I12, (I13 option), visual overhaul decision | Look decisions on the final world, real GPU | Full tour at noon, dusk, night; final FPS table | 6 | medium |

### 8.2 Hard dependencies (A needs B)
X0 needs nothing; publish needs X0 + bump. F1 needs F0. F2 needs F1, BZ1. F3 needs F2. Everything in P2 to P8 needs F3.
W2 needs W1. W3 needs W2. R2 needs R1, W2. R3 needs R2, W3 (south bridge). R4 needs R3. RU2 needs RU1. A2 needs A1.
I3 needs I2, R4. I5 needs I3, I4. I6 needs I5. I7 needs I5. I8 needs I7 and the gigs work landed in jobs.js. I9 needs I8. I10 needs I9. I11 needs I6 count.
B1 needs R3, W3. B2 needs B1. B3 needs B2. B7 needs B2. A3 needs A2, B1. A4 needs the ATV model. A5 needs A4. A6, A7 need A5, B3.
BZ6 needs BZ1, R3. BZ2 needs BZ6. BZ3 needs BZ1. E-I1 needs R3. E-I2 needs E-I1. E-I3 needs E-I2. WJ needs E-I2 (halls) and E-I3 (station frame).
E-I4 needs WJ (shares the mini-game frame). E-I5 needs E-I3, R3. BZ5 needs BZ4. BZ7 needs BZ6. R6 needs R3, BZ6, E-I1. R5 needs R1, R4.
RU5 needs R5. B5 needs B3, RU1. L1 none (pure) but runs after jobs.js stages of P5. L2 needs L1, RU1, B5. L3 needs L2, R5, RU5. L4 needs L3.
L5 needs L4. L6 needs L1. RU3 needs RU1 and P5 done. RU4 needs RU3. M2..M5 need L6, RU4, A7, B5. L7 needs M2. W4 needs W3. W6 needs W4. A8 needs A7.

Can run in parallel (different file sets):
- I4 (scripts/build-props.mjs, props-assets.js, ASSETS.md, credits.js) with any stage that is not another converter stage.
- A1 then A2 (terrain.js SURFACE ids, the vehicle pure step) with W1/W2 (map-definition.js, height.js) once F3 is done; not with R2 (height.js).
- RU6 (tests only) and I12 (data) with anything.
- WJ Blender parts (user side) with any agent stage.
- The visual overhaul track (sky rig, shaders) with any stage that does not touch night-lights.js or world.js.
Never in parallel: any two stages in the same row of 8.3.

### 8.3 Conflict map (dense files, in build order)
- game.js: X0 (hook only), F1, F2, R2, R3, R4, RU2, I9, I10, B1, B2, B3, B7, A5, A6, A7, BZ2, BZ3, BZ6, E-I1, E-I2, E-I3, WJ, E-I4, E-I5, E-I6, E-I7, BZ4, BZ5, BZ7, R6, R5, RU5, B4, B5, L2, L3, L4, L5, RU4, M2..M5, L7, W4, W5.
- jobs.js: I8, BZ3, E-I3, WJ, E-I4, E-I5, BZ5, BZ7, R5, L1, L6, RU3.
- phone*.js: I10, B3, BZ3, E-I3, BZ5, BZ7, R6, L5, RU3.
- map-definition.js: I1, I2, BZ1, F2, W1, R1, RU1, RU2, R3, I3, I5, I7, BZ6, BZ4, E-I1, R7, I13.
- world.js: F1, F2, I6 (one line), I11 (one condition).
- relay-protocol.js: I10 (room name `hotel`), M2..M5, L7.
- night-lights.js: I11, then the visual overhaul track (never both open at once).

### 8.4 User-side work (have it ready before the phase starts)
| Phase | Make or download | Needed by |
|---|---|---|
| P0 | nothing | - |
| P2 | Kenney City Kit (Commercial) download again (I0) | I4 in P3 |
| P3 | Hotel model (three pieces), reception counter, awnings (if not from Kenney) | I7, I9, I6 |
| P4 | Bow, rod, tent and campfire; ATV model(s) to the ATV contract (nose -Y) | B3/B7 stock, A4 |
| P5 | Eden sign (prompt given), hall kit, office, gantry crane, laser, CNC; welding parts Tier 1 to 4 done, Tier 5 ATV frame and trailer | E-I1, E-I2, WJ, E-I4 |
| P6 | Police vehicle recolours for three forces (Ironwood, Rangers, Kaspian) | L4 |
| P8 | Trailer and whole-ATV frames as products (later), flatbed when its model returns | Eden products, later tiers |
Rule: start the Blender item one phase early; an agent stage that needs a missing model is skipped, not stubbed.

### 8.5 Usage plan
- Normal week: 8 to 12 agent runs (e). P0 to P8 is about 70 runs (e): roughly 7 to 9 weeks.
- Models: Opus for F0, I8, RU3, L1, M2..M5, L7 and the P8 look decision; Sonnet builds against tests (most stages); Haiku for I1, I12, R7, B7, E-I7 and data tuning. Fable only after the user says yes, stage by stage (candidates: W4, W6, B1, B5, R2, R5, E-I3, BZ7, L4, RU5); without a yes these go to Sonnet with Opus review.
- Thin week (2 to 3 runs): X0 if not done, then the cheapest unblocking stage on the critical path (F0, F1, F2), then Haiku data stages. Skip look work.
- Rule: one stage per run; stop and report after each stage (what changed, tests, FPS spot to check); the user commits by hand before the next stage.
- Each report names the next stage and whether it needs a model or a user check.

### 8.6 First five stages
| # | Stage | Model | Brief | Files it may touch | Test |
|---|---|---|---|---|---|
| 1 | X0 | Sonnet | Planks over the hand limit can always be dropped (any amount or auto-place); rescue for stuck saves; regression test | the hands/planks module, one game.js hook, a new test | npm test; bump the version, then npm run release |
| 2 | I1 | Haiku | Display rename only: zone name, label, subtitle, signpost, property names (ironwood-city-design.md I1) | map-definition.js, tests/map.mjs line 22 | npm test |
| 3 | I2 | Sonnet | Remove the tree rows and square planters, move three benches | map-definition.js, tests/town.mjs, tree tests | npm test |
| 4 | BZ1 | Sonnet | Move every interior origin outside x -450..1050, z -1200..600; move the Ridgeline office; fix careers.mjs 119/121, eastbank.mjs 37, properties.mjs 12 | map-definition.js, those tests | npm test |
| 5 | F0 | Opus | Short streaming brief: chunk module API, 5 x 5 ring, 100 m chunks, time slicing, colliders, what F1 to F3 change; notes only | a new notes file | none |
For any stage that changes dist: npm run release -- --force only when that version is not yet deployed; a deployed version is never forced: bump it.

### 8.7 Top risks
1. Streaming (F1) is a rebuild of world, mask and colliders: the largest risk; old map first, gate tests in F3.
2. Chunk build hitches: time slicing and merged meshes; measured in P1 on the real GPU.
3. game.js is in about 45 stages: one at a time, small hooks, logic in new files.
4. Test time grows about 10 times with the whole-map scans unless the tests go per chunk (F3).
5. Crowds 16 to 20 vs the 15 skinned / 10 car budget: RU5 must prove the rigid/instanced split before L3.
6. jobs.js save normalise touched by I8, L1, RU3: Opus owns every save format change.
7. Multiplayer with different loaded sets per client: shared objects need an owner (P7).
8. User models late (ATV, hall kit, hotel): stages slip; start Blender one phase early.

### 8.8 Open questions for the user
1. Is this phase order right, and may I1, I2 run before streaming (they do not touch the frame)?
2. Fable yes or no for each candidate in 8.5?
3. Plot price bands.
4. Fast travel: yes or no.
5. Lone sleeper rule in co-op.
6. Eden products beyond Tier 5.
7. Section 3: Ridgeline new office, Hal Brennan stays, Bruce owns the terminal.
8. ATV speeds and price per model.
9. Chase end rules and whether the three forces need new vehicle models.
10. Fog distance vs the lake's far shore and sea horizon (decide in P1 or P8?).
11. Visual overhaul: before or after P3 (both touch night-lights.js through I11)?
12. Welding job brief WELDING_*.md files: add them to the repo before WJ?