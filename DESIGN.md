# City Life — design (current spec)

> Single source of truth for the plan: what is built, what is next, decisions, numbers. Superseded text and build narratives are in `DESIGN-history.md` (the previous full DESIGN.md). If the two disagree, this file wins. Read this file only; open the history only for old detail on a specific topic.
> How to work, commands, environment gotchas and the file map are in `context.md` (not repeated here). Asset list and licences: `ASSETS.md`.
> Visual reference for logging: `docs/concept-logging.jpg` (log on the shoulder, sawmill with blade, plank stacks).
> Models: **Haiku 5.5** = tiny edits and number tuning; **Sonnet 5.5** = default building/refactoring against tests; **Opus 5.5** = architecture, economy, save format, multiplayer.
> All prices and rates marked *(placeholder)* are first guesses; tune later in a Haiku pass.

## 1. Game pitch
A low-poly, three.js life-and-work sim across six districts (Oak Street / Westside city, Alder Center, Cedar Heights, Eastbank Works, Willow Fields, Pine Ridge). The player meets needs (food, thirst, energy), earns money through gigs and trades (delivery, logging and milling, store jobs, farming), rents or buys a home, furnishes it, and climbs skill ladders toward owning a shop or running logistics. Offline play first; multiplayer is an opt-in relay.

## 2. Current build
- **Latest done: 0.32.0** (menu, dev mode, reset safety net, interior editor, ground layers, prop clearance).
- **Next: 0.33 Eastbank Works** from the Kenney Industrial kit (warehouse, workshop, supplier, gas station with canopy and pumps as props, truck yards, containers), and the **vehicle driving system** (kinematic arcade driving, enter/exit, collisions for the pickup and flatbed), plus the **`heightAt(x,z)` elevation prep** (section 3). Driving moved up so roads, bridges and collisions are tested before the heavy logging and carrying work. Opus 5.5 designs first; Sonnet 5.5 builds in steps (design pass, `heightAt`, Eastbank data, Eastbank assets, driving, tuning), stopping at passing tests after each.
- **After that: 0.34 The Logging Chain** (carry system, bucking with the Hand Saw, sawmill producing planks).
- **Out of scope for 0.33:** logging chain, carry system, bucking, tool wear, chainsaws, cargo loading, selling planks, fuel system, farming, furniture edit mode, cashier/POS, multiplayer authority, the in-world interior shell, actual elevation.
- **Version rule:** each build gets one number, used once, in the roadmap (section 6). Schema bumps are listed there too.

## 3. Architecture rules
- **Coordinates:** 1 unit = 1 m, +Y up, **north is −z**, player 1.95 m, spawn (−5, 15).
- **Flat world in v1, elevation later.** No elevation yet; ridges and river are scenery/barriers. To avoid a rewrite later: all ground height goes through one function `heightAt(x, z)` (returns 0 today) and the player, vehicles, trees, plots and props read it instead of assuming y = 0; a test fails if gameplay code hardcodes ground height; saves store x and z only and recompute y on load (interior floors keep their own heights); plots and building footprints carry a flat-pad flag in data so terrain can be carved around them later. Vehicles (kinematic) follow `heightAt` and tilt to the slope; walking and driving get a maximum slope when elevation arrives. `heightAt` and its test ship with 0.33.
- **Data first.** World lives in `dist/map-definition.js` (zones, road graph, fields, buildings, shops, plots, scenery params), checked by `validateMap`. New districts = data + scenery code that reads it.
- **Terrain mask** (`terrain.js`, 0.25.0): 0.5 m cells from zone shapes, road ribbons along centrelines and water; used for walking, footing, scenery exclusion, minimap. `validateTerrain` proves every district is reachable on foot from spawn.
- **Saves.** One plain object `citylife.progress.v1` (localStorage), rebuilt by `normalizeProgress` (jobs.js). `progress.schema` (missing = 1). Adding fields needs no bump; changing a field's meaning bumps the schema with one migration step (`if (schema < N)`), each with a fixture test (`tests/fixtures/save-schema-N.json`). Schema 2 (adds `properties`) is done; schema 3 (tree `hits` → `damage` = hits x 8; tools get a condition) ships with 0.37.
- **Changes** go through pure transaction functions (`transactJob`, `housingTransaction`, `lifeTransaction`): state + action in, new state or error out. Money is integer cents.
- **Every placement** goes through `placeSafely` (reset, teleport, unstick, load, stuck rescue). New flat ground meshes go through `groundLayer()` (`GROUND_LAYERS`). Generated trees stay 2.5 m off landmarks (`nearProp`).
- **Registry rule:** everything new is enterable unless `MAP.properties` says otherwise (a test, not a convention).
- **Dev mode** is one removable flag (`dev-flag.js`, `dev.js`); nothing of it in `index.html` or `style.css`.
- **Anti-exploit rule:** every job or gig gets its own anti-exploit tuning when built (daily cap, falling price, cooldown or similar). Not designed in advance.
- **Assets.** 1 unit = 1 m, character 1.95 m, +Z forward, Y up, pivot at base centre, flat-shaded look; `ASSETS.md` + manifest (maps reference ids like `vehicle.pickup`, not filenames). Scales: Kenney Furniture Kit 2 m/unit, Quaternius interior pack 0.5 m/unit, Kenney houses/commercial 8 m/unit. Check each pack's licence. Real assets over fake ones; say what is missing instead of faking it.
- **Physics:** no rigid-body engine. Vehicles are kinematic arcade (decided): acceleration and braking ramps, speed-based turning, visual body tilt, heavier loaded trucks; tested for collisions and road footing, not simulated suspension or skidding. Scripted animation only; if tumbling objects are ever wanted, cap ~20 active bodies near the player that freeze when still.
- **River crossings (decided):** the river is crossable only at bridges (County Bridge, the second bridge at x 190..200 on the Freight Road) for players, NPCs and vehicles.
- **Multiplayer today:** relay (`server.js`) forwarding positions and a `room` (`street`, `market`, `cafe`, `home`, plus `^house:[a-z0-9-]{1,40}$`). Nothing is server-authoritative; no new feature may assume shared persistent state until that changes.

### Performance budget (flag with a number and a cheaper alternative before building anything that would exceed)
- More than ~1,000 tree-sized instances (1,000 trees ≈ 1.2 M triangles; choppable ones cost double for shadows) or large grass/rock/flower scatter (a few thousand within 30 m, chunked).
- Crops one mesh per cell (use chunked low-poly instances, within 90 m, cap 150,000 crop triangles).
- More than ~15 skinned characters or ~10 cars on screen (vehicle design cap: 15 drawn).
- Bulk shadow casters, textures above 512 px per asset, more than ~300 draw calls.
- Measured: all trees 0.89 M triangles; culling draws 5-60% depending on where you stand; ~45-100 draw calls. Claude cannot measure real FPS (software renderer, ~4 FPS); use triangle/draw-call counts plus the user's reports (about 165 FPS on a real GPU; 105 at the bridge before culling).
- Levers in place: fog and cull distance, no-shadow scenery, instancing. Next: chunked far versions, lower-poly LODs.

## 4. Systems

### 4.1 World and map — Status: skeleton done, population ongoing
- Map 540 x 480 m. Ground to x 300; forest to x 190; river and north bank moved 70 m north (one shift constant); second bridge x 190..200; Freight Road (10 m corridor, Eastbank Works to Pine Ridge woods road); County Road keeps its bridge.
- Zones (north is −z): Westside city (x −61..58, z −48..48), Alder Center (x −20..58, z −125..−48), Cedar Heights (x 70..170, z −135..−40, curved closed loop), Eastbank Works (x 70..190, z −20..75), Willow Fields (x −170..−35, z −286..−178), Pine Ridge forest (x −25..190, z −316..−216); the river and two bridges lie between the city and the north.
- Roads designed for vehicles: lanes 3.5 m, shoulder 1 m (9 m road), curve radius ≥ 17 m, 12 m streets where trucks turn.
- Plots as data: C1-C2 commercial, R1-R3 residential (R4-R9 planned), I1-I2 industrial; minimap and ground overlay (O).
- Done: Kenney houses in Cedar Heights, Alder Center buildings, farm buildings, timber yard, parked vehicles, lamps, benches, hills, living town (street wall, sidewalks, square with fountain, parking lot, crosswalks, 15 parked cars, bus stop).
- Planned fill (data first, Sonnet 5.5): R4-R9 with driveways/paths/parking (registry entries locked); pavements, crossings, ~60 instanced lamps, bus shelters; Eastbank plots (warehouse, workshop, supplier, gas station: pumps, forecourt, 8 m truck yards, bays, plank dock) and Alder Center plots as data; Quaternius scenery (rocks, reeds, bushes, flowers, ferns; budget ≈ +150,000 triangles, check culling first); Pine Ridge timber yard as data.
- Known leftovers: pavement/road height bands in the frame loop and interior room geometry are literals; minimap strips and `zoneAt(x)` fallback still assume zones laid out west to east; the flatbed's wheels are generated cylinders (`vehicle-parts.js`) because the converted model has none and the original FBX is not in the repo.
- Travel targets: city to farm 45-60 s, city to sawmill ~90 s, corner to corner 2-3 min by early vehicles. **Do not enlarge the map for now**; wind long roads (+30-50%), use speeds, fuel and loading time instead. Eastbank to sawmill by the Freight Road is about 440 m.
- Checks: `validateMap`, `validateTerrain`, plots never on roads, trees never on roads or in river, bridge/road alignment test.

#### Elevation plan (later, its own build, Opus designs; all values placeholders)
- **Datum:** the town and every existing build stay at y = 0, so nothing moves. The river is carved below: water level −1.5 m, bed −3 m, banks sloping about 1:2 up to 0 with rock edges.
- **Slopes:** walking capped at about 30° (slower uphill); roads at most 8%; bridge decks level. Flat pads blend into the terrain over about 10 m.
- **Terrain mesh:** a 2-4 m grid (about 16,000-32,000 vertices) in 32 m chunks for culling; the 0.5 m terrain mask stays separate for walkability and slope. Relief described as data (e.g. `MAP.relief`: hills with centre, radius, height, falloff; valley along the river centreline; pads and road corridors that flatten) or a painted grayscale heightmap. Trees, crops, props, fences, lamps and parked vehicles place with `heightAt`.

| ID | Area | Bounds | Height | Notes |
|---|---|---|---|---|
| P1 | Alder Center | x −20..58, z −125..−48 | 0, flat | Square, parking, plots C1-C2 |
| P2 | Cedar Heights ring | x 70..170, z −135..−40 | 0, flat road and plots | Loop road and plots stay flat |
| H1 | Cedar knoll | centre about (120, −88), radius about 28 m | +5 m peak | Inside the loop, slopes about 10°, no plots |
| P3 | Eastbank Works | x 70..190, z −20..75 | 0, flat | Warehouse, workshop, supplier, gas station, truck yards, plank dock |
| P4 | Willow Fields and farmstead | x −170..−35, z −286..−178 | 0, flat | Fields flat, farmstead pad flat |
| V1 | River valley | along the river centreline (confirm from `map-definition.js`) | water −1.5, bed −3 | About 14 m wide at the water; bridges at deck level (about +0.3) |
| H2 | Pine Ridge rise | within x −25..190, z −316..−216; peak toward the north-east | +18 m peak | Slopes mostly 8-15°, forest walkable |
| P5 | Sawmill terrace | confirm from data | +6 to +8 m, flat | Flat pad with timber yard; truck bays on the woods road |
| R1 | Woods road and Freight Road | existing ribbons | rise 0 to about +7 | Grade at most 8% (about 440 m long) |
| E1 | Edge hills | beyond the fog | +25 to +40 m | Scenery only |

- **Gameplay effects:** carrying uphill is slower than on the flat, so carrying downhill from Pine Ridge to the sawmill terrace is the easy direction; loaded trucks slow slightly on grades; vehicles tilt to the slope.
- **Order:** river valley and bridges, then Pine Ridge and the sawmill terrace, then the Cedar knoll, then the edge hills. Frame-rate flag: test the forest on slopes before adding scatter.

### 4.2 Player needs and controls — Status: done (basic)
Food, thirst, energy (`life.js`) plus `groceries` for home cooking. Controls menu freezes doors/fades while `modal`; only `pause()` owns `modal`; `actions.js` makes every action block every other. `objective.js`: one resolver, one drawer. `timestep.js`: slices of ≤ 1/30 s; the game clock runs 30 game minutes per real minute. Run speed 8.2 m/s.

### 4.3 Housing and interiors — Status: v1 done (separate scenes); in-world shell planned
- Done: `MAP.properties` registry (id, type, name, `access` public|tenant|owner, `owner` null|npc|city|landlord, or `enterable:false` with reason); `properties.js` doors and `doorState`; nine house rooms generated from each model's size and door (`houseLayout()`, `interior-layouts.js`, editor write-back via `scripts/dev-server.mjs`); plain wall boxes; stairs = "go upstairs" fade (`changeFloor`). Shops and studio keep their own systems (shops.js, apartment.js; shops already sit in the world behind real glass, `storefronts.mjs` proves sightlines). House interiors are still crude (flat window panes, thin bathroom boards, plain door slab).
- **Decision: in-world interiors with real glass** for every enterable building, so windows show the outside from inside and the inside from outside. The current separate-scene house rooms (`buildHouseRoom`) are replaced by the shell build. Saved layouts (`house-c` has one) apply to the generated shell and need revisiting when the shell changes.
- Rules: build one interior at a time, only for the building the player is at or inside, and drop it on leaving; see-in distance a few metres (windows ~1.2 x 1.5 m); 20-30 furniture models, ~10,000 triangles per interior; ≤ 80 furniture pieces in a home. Furniture save format unchanged. Pilot with one house before all nine.
- Glass: start with semi-transparent panes over the Kenney windows (their windows are opaque textures); cut real openings in Blender only if panes look wrong. Lights: emissive materials plus at most one point light per room; ceilings cast no shadows.
- Shell build order (Opus designs, Sonnet builds): shell + walkable stairs + an `entry` on every floor (checked by `layoutProblems`), then swinging door leaf (0.4-0.6 s, blocks doorway until open; `doors.js` has the sliding shop door), then fading ceiling slab per floor (and roof), then switchable lights (E on a switch or lamp; state saved per house, default by time of day), then one style pass for shell and furniture. Stairs use `floorAt`-style ramp footing with side collision and a landing.
- Frame-rate flags to raise before building: draw calls and shadows for one more room, glass transparency sorting/overdraw, more than one point light, ceiling shadows.
- Interior art: Kenney Furniture Kit is the base; Quaternius pieces sparingly (lamps, rugs, plants, couches) or a later "luxury" tier. Do not mix the flat Kenney look with smoother Quaternius pieces by accident. Some Blender work expected later (a house shell kit, one consistent look).

### 4.4 Ownership, rent, mortgages — Status: rent/buy done; mortgages planned (0.36)
- Homes app on phone (estate agent in Alder Center later). Multiple homes allowed; one is **home** (sleep/wake).
- Save: `progress.properties = {[id]: {tenure:'rent'|'own', since, nextBillDay, rentDue, home, furniture, storage, containers}}`. Studio stays in `housing` and counts via `ownedIds`; merge later.
- Rent reuses studio weekly billing (`advanceHousingDays`): one missed week = warning, two = door locked and furniture to storage (collect within 7 days).
- Numbers *(placeholder)*: studio $60/week; Cedar Heights house rent $180/week + $360 deposit; buy $14,000 or $2,800 down + $175/week for 64 weeks.
- New homes come furnished (bed, fridge, table, two chairs, couch, lamp). NPC homes and vacant ones stay locked (NPC burglary: probably never).

### 4.5 Furniture and storage — Status: planned (0.36; Sonnet builds, Opus for save/delivery rules)
- `furniture.js` catalogue: `{id, name, model, price, size:{w,d,h}, layer:'floor'|'surface'|'wall'|'rug'|'ceiling', surface?, uses, container?}`. Placed: `{uid, item, x, z, yaw (0-3), on?}`; saved per floor as `{id,x,z,yaw,y}` under `properties[id].furniture`. Fixtures (walls, doors, windows, stairs, kitchen run, bathroom) are not movable.
- Edit mode (B, inside owned/rented home): ghost snaps to 0.25 m grid, R rotates, green/red validity (inside room, no overlap, 1 m clearance at doors/stairs, surface items need a surface). Reuse `interior-edit.js` and `layoutProblems`.
- Buying (ContractVille-style flow): Furnish app first; delivered boxed to home storage; later order at the store, pick up a box labelled with the furniture's name, carry it home (uses the carry system), place the box to reveal the real prop. Sell back at 50%.
- Uses: bed (sleep), fridge (20-slot container), stove (1 grocery → meal), sink (+25 thirst), seats (energy ×1.5), computer, TV (time ×4), drawers/shelves (4-12 slots), closet (outfit), lamps (switch); washer/bath/toilet etc. are placeholders. Sink, fridge, sofa, TV uses and mortgages are in 0.36.

### 4.6 Jobs, shops and POS — Status: gigs done; cashier planned (0.38)
- Ladder: cashier → stocker → shift lead/manager → owner (buy C1/C2 or rent Corner Market; stock from Eastbank supplier). Scale: ≤ 8 shelves, 1-2 registers, ~40 products, ≤ 6 customers, ~200 instanced products.
- Cashier shift: `progress.work.shift = {shop, role, startedAt, served, mistakes, tipsCents}`; customers enter, browse 2-3 shelves (1-6 products), queue, pay, leave, using the pedestrian walking code driven by a script. POS is a UI overlay (E at register): scan, total, card tap or cash change. Pay = base per customer + tips by speed/accuracy; mistakes cost tips, not wages.
- Data: `products {id,name,category,costCents,retailCents,size}`, `shelves`, `registers`; per player-owned shop save `{stock, prices, drawerCents, openHours}`. NPC-shop shelves refill daily and are not saved. Server-owned for multiplayer.
- Assets: J-Toastie POS (FBX→GLB), Kenney Furniture Kit shelves/counter/boxes, plain instanced products; Quaternius Ultimate Food Pack (CC0) optional.
- Models: Opus (economy, customer flow, transactions); Sonnet (interior, POS screen, NPC scripts); Haiku (prices, wages).

### 4.7 Carry system — Status: Planned (0.34)
- **Items:** a log is carried **one at a time on the shoulder**; planks are carried **3-4 at a time** the same way (reference image: `docs/concept-logging.jpg`). Carrying animations and rules ship in 0.34.
- **Movement:** slower walking while carrying, no sprint: about 70% of walk speed with a log, about 60% with planks *(placeholder)*.
- **Rules:** carrying blocks every other action (`actions.js`); doors prompt "put it down first"; a drop key puts the item on the ground as a world item so the player is never stuck.
- **Save:** `progress.carrying = {item, count}`, restored on load. Loose world items are saved as counts or positions per the existing plot pattern; never one record per plank in a pile.
- Also used later for furniture boxes and stock boxes.

### 4.8 Tools, logging, sawmill, fuel, repairs — Status: one axe today; bucking, carry and sawmill 0.34; fuel 0.35; tool ladder, wear, chainsaws and repairs 0.37
**The chain (logs and planks are not sold; the sawmill adds the value):**
fell tree (axe or chainsaw) → the **trunk** stays on the ground → **buck** it into logs (Hand Saw or chainsaw, one log per cut) → carry each log to the sawmill → sawmill turns 1 log into 4 planks *(placeholder)* over the blade's cut time → planks pile beside the sawmill (instanced, capped draw; count saved) → load a vehicle (0.35) → haul to Eastbank Works → sell planks (0.35). In 0.34 planks can be milled and piled but not sold; use a dev-mode grant or sale to test the economy.
- **Bucking (required).** Axes fell only; they cannot buck. A tree takes 3-4 cuts (logs: a third log at lumberjack L3, a fourth at L8, plus the Lumberjack Axe's occasional bonus log). **Hand Saw** (in 0.34): 4 s per cut (12-16 s a tree), $15, unlock level 1, sold at the hardware counter *(placeholder)*; it wears like other tools once wear ships in 0.37 (~$0.20 per tree, placeholder). **Chainsaw** (0.37): 1 s per cut, with a small fuel use per cut. An unbucked trunk disappears after about 1 game day *(placeholder)* and adds no regrowth block beyond the existing stump rule.
- **Tree plot save:** `{tree, damage, felledAt, plantedAt, trunkLogs}` where `trunkLogs` is the count of logs left to cut from the trunk. Logs on the ground are world items.
- **Plank price: $1.00 each** *(placeholder)*, so a tree of 12-16 planks is worth $12-16. Eastbank buys at this price; later players may work at or own Eastbank and set prices. The Reforestation premium (below) applies to the plank price.
- **Saw blades** (spin at the bench and wear; wear counts planks cut; spares sold at the Eastbank supplier) *(placeholders)*:

| Blade | Price | Lasts | Cost per plank | Cut time per log |
|---|---|---|---|---|
| Standard | $25 | 300 planks | ~$0.083 | 6 s |
| Upgraded | $40 | 600 planks | ~$0.067 | 4.5 s |
| High-End | $100 | 1,800 planks | ~$0.056 | 3 s |

- **Sawmill build needs (0.34):** a split blade mesh or overlay disc that spins, an audio system (none yet: Web Audio or CC0 files), the plank item and stack save format (Opus designs).
- **Tools model (0.37):** `tools.js` table `{id, model, damage, swingSeconds, durabilityHits, unlockLevel, price, fuel?:{tankMl,mlPerSecond}}`. Swing damage = tool damage × (1 + 0.04 × (level − 1)); hits = ceil(toughness / damage); pine toughness 24. `chopTree` reads only the equipped hotbar tool.
- **Ladder** (hits for a pine L1 / L20): Axe L1 $20 dmg 3 (8/5); Steel Axe L5 $120 dmg 4 (6/4); Lumberjack Axe L10 $350 dmg 6 (4/3, two-handed, bonus log). **Chainsaws (low and high):** low chainsaw $600, lumberjack L15, cheap, ~2× fuel, wears fast *(placeholder)*; high chainsaw (SKU0374) $1,500, lumberjack L20, ~1.8 s per pine, half the fuel, wears slowly *(placeholder)*. Hold E to cut.
- **Wear (decided: yes; 0.37).** Condition 0-1000 per tool instance (bag slot `{id, quantity:1, cond, fuel?}`); falls by 1000/durabilityHits per hit; dull tool damage × (0.6 + 0.4 × condition); at 0 it is broken, not destroyed. Repairs: whetstone (+25%, cheap) and workshop (100% for ~40% of price), sold at the Eastbank supplier. Per-tree wear: Axe $0.50, Steel $0.30, Lumberjack $0.25, low chainsaw ~$1.00 + $0.40 fuel, high ~$0.50 + $0.20 fuel.
- **Wear tax per tree** (tool wear + fuel + blade, against $12-16 of planks; targets 15-30% low end, 5-10% high end), before adding Hand Saw wear and chainsaw bucking fuel: Axe + Standard blade ~$1.50-1.85 (~11-13%); low chainsaw + Standard blade ~$2.40-2.75 (~17-20%); high chainsaw + High-End blade ~$1.40-1.60 (~9-11%). Retune once bucking costs are in.
- **Fuel (0.35):** priced at the gas station, **$2.00/L** *(placeholder)*; a 5 L Gas Can (stack item, `fuel` 0-5,000 ml) costs $10 full. Low chainsaw ~0.2 L/tree, high ~0.1 L/tree (felling; bucking extra). The fuel system (pump, tank, can) ships with 0.35 for vehicles; chainsaws reuse it in 0.37. In 0.33 the pumps are props only. Stations: one by the woods road, one on the Freight Road. Low-fuel warning, jerry can, paid tow as last resort. Later, an owned station may set its own price.
- **Power Drill:** Handyman skill tool (props first, then jobs).
- **Regrowth:** today stump → sapling after 3 game days → pine after 7 (1 game day = 48 real minutes); forest empties in ~90 min of nonstop chopping. Proposed: sapling 1 day, pine 2.5 days, stump blocks until cleared (3 swings) or 4 days; pine cones (~1 in 3) plant saplings (mature in 2 days) with a Reforestation plank-price premium while forest > 70%; target: replanters stay > 60%. Add oak and giant tree later. XP: 2 per swing, fall XP scales with toughness; retune so L15 ≈ 150 pines (~40 min). Today: XP 40 to L2, +20 per level, cap 20.
- **Lumberjack contracts** (lumber yard) reuse the gig system: deliver N planks.
- **Models:** Opus (carry rules, bucking and trunk save, plank item, stack save, numbers); Sonnet (`tools.js`, wear, fuel, HUD bar, sawmill, bucking, carry animation); Haiku (prices, durability).

### 4.9 Farming and animals — Status: designed (0.39)
- Allotments: Willow Fields split into 10 × 10 m, leased weekly; 1 m cells tilled, planted, watered, harvested. Save `progress.farm = {allotments:{[id]:{leasedUntil, cells:{"x,z":{crop, plantedAt, wateredAt}}}}}`; growth stage computed from time, faster if watered within a game day.
- Assets: Quaternius barn set (replaces placeholder farmstead; no farmhouse: use a Kenney house), 7 animated animals (~20 animated in view cap, far ones frozen), Ultimate Crops (102 FBX, 20 kinds, stages 1-4; needs FBX→GLB conversion). Missing: hoe/shovel, watering can, seed packets, chicken.
- Animals wander in pens (steering only). Opus checks numbers; Sonnet builds.

### 4.10 Vehicles — Status: Planned next (0.33); cargo and fuel 0.35; traffic later
- **0.33 scope: driving mechanics only.** Kinematic arcade driving `{x,z,yaw,speed,steer}` for the pickup and flatbed (acceleration and braking ramps, speed-based turning, visual body tilt, heavier loaded trucks), enter/exit, collisions with existing colliders, camera, parking spots as data, vehicle height from `heightAt`. No cargo, no selling, no fuel. Opus architecture pass first, then Sonnet.
- **0.33 acceptance checks:** drive across both bridges; drive the Cedar Heights loop, Oak Street East and the Freight Road; never enters water, buildings or trees; the river is crossed only at bridges; grass at half speed; travel times meet the doc targets (city to farm 45-60 s, city to sawmill ~90 s); collision and reset-safety (`placeSafely`) tests pass; the `heightAt` test passes.
- **0.35 adds cargo:** each vehicle model has `cargoSlots` in its data; instanced plank meshes fill the slots as the count rises (a full flatbed of 120 planks ≈ 1,440 triangles); the same system shows other loads later. Save only counts: `cargo: {planks: n}`. Loading: walk to the bed carrying planks and press E (animation, count goes up); unload at the Eastbank dock. Capacities *(placeholder)*: pickup 40, flatbed 120. Cap how many cargo pieces are drawn. Also 0.35: selling planks at Eastbank and the basic fuel system (vehicle tank, pumps).
- Driving rules: grass at half speed; never water/buildings/trees. Speeds (m/s): bike 6, van 10, loaded truck 8, everyday car 11 (14 would cross the map in ~39 s: too fast), premium 16.
- Save `progress.vehicles = [{uid, model, x, z, yaw, fuel?, cond?, cargo?, parkedAt?}]` (fuel, cond and cargo added from 0.35); y is never saved.
- Triangle budget (revised 0.30.1): cars 2,800-3,100, pickup 4,400 (cannot be simplified without losing wheels). Traffic needs a lighter car (few hundred triangles) or distance version.
- In hand: Cars Bundle (7), Jeep (CC-BY), Van, Pickup, Flatbed. Missing: Bus.
- Later: ambient traffic (≤ ~10 visible, never runs you over at first), premium cars.

### 4.11 NPCs and schedules — Status: planned (Opus first pass, Sonnet iterates)
Home → work/shop/park → home by time of day, on sidewalks, using the same doors as the player and hidden while inside; far NPCs are data only; they cross the river only at bridges. Needs road graph and door data. Hired workers (late game, Opus): contract with wage/day, output/day, site, reliability; needs NPC homes, plot ownership, storage first. Eastbank Works may later be staffed or owned by players.

### 4.12 Multiplayer — Status: relay only
Offline play; multiplayer chosen on the menu before the world starts (`createMainMenu`'s `start`). Later: hosted for real (deployed `wss://` relay with login and room codes; local `npm run server` stays for development); Opus designs authentication and server-authoritative state (`doorState`, transactions). Not before interiors and furniture.

## 5. Economy progression (existing numbers; placeholders marked)
| Stage | Player can do | Money in | Money out | Core loop |
|---|---|---|---|---|
| Start | Delivery gigs, buy food, rent studio | Gig pay | Studio $60/week, food | Earn → survive |
| Early | Buy Axe ($20) and Hand Saw ($15); fell, buck, carry logs, mill planks (0.34); haul and sell at Eastbank (0.35); cashier shifts (0.38) | Planks $1.00 each, wages + tips | Tool wear, blades ($25), fuel ($2/L), rent | Fell → buck → carry → mill → haul → sell |
| Mid | Rent Cedar Heights house, furnish, lease allotment, Steel/Lumberjack Axe ($120/$350), better blades ($40/$100) | Planks, crops, shift pay | House $180/week + $360 deposit, furniture, seeds, fuel, repairs | Home + routine |
| Late | Buy house ($14,000) or shop (C1/C2), chainsaws ($600/$1,500), more vehicles, hired workers, own Eastbank | Shop profit, contracts, plank premiums | Stock, wages, mortgage $175/week, fuel | Ownership and logistics |

Income check (rough estimate): logging at $1.00 per plank may pay about $400-600 per hour once carry, bucking and mill time are counted, against rent of $60-$180/week and a $14,000 house. Housing prices or plank price may need retuning; each job gets its own tuning (section 3).
Gaps: no wage figures for cashier or gigs; crop and shop prices undefined; no income-per-hour target across jobs; no income from logging until 0.35.

## 6. Roadmap (one number per build; never reuse)
| Version | Scope | Status | Model |
|---|---|---|---|
| ≤ 0.32.0 | Skeleton, houses, registry, assets, interiors v1 + ownership (schema 2), living town, menu/dev mode, interior editor | Done | Sonnet |
| 0.33 | Eastbank Works (Kenney Industrial) + Vehicle Driving (kinematic driving, enter/exit, collisions for pickup and flatbed) + `heightAt` prep | Next | Opus design, Sonnet build |
| 0.34 | Logging Chain: carry system and animations, bucking (Hand Saw, trunks), sawmill chain (planks pile) | Planned | Opus design, Sonnet build |
| 0.35 | Cargo loading, selling planks at Eastbank, basic fuel system (gas stations) | Planned | Opus architecture, Sonnet build |
| 0.36 | Furniture edit mode, storage, Furnish app, sink/fridge/sofa/TV uses, mortgages | Planned | Sonnet (Opus for save/delivery) |
| 0.37 | Tools: axe/chainsaw ladder, wear (incl. Hand Saw wear), chainsaw bucking fuel, repairs, blade tiers; schema 3 | Planned | Opus numbers, Sonnet build |
| 0.38 | Cashier shift and POS | Planned | Opus economy, Sonnet build |
| 0.39 | Farming and animals | Planned | Opus numbers, Sonnet build |
| Later | Elevation (own build, Pine Ridge and river banks first), ambient traffic, in-world interior shell (may be pulled ahead of 0.36 if windows are wanted sooner), NPC schedules, hired workers, hosted multiplayer | Deferred | Opus |
After each build: Haiku tunes prices, wages, durability, growth times. Every build keeps: data first, pure transactions with tests, `validateMap` for anything placed, performance budget checked before shipping.

## 7. Open questions
- **Engine:** stay on three.js/JavaScript, or move to a native engine such as Godot? A one-day spike (hilly terrain, a few houses, a river and bridge, a kinematic truck) after 0.33 would inform this. — decision needed (after 0.33)
- **Map size:** a much larger map (about 3× per side) is being explored; this doc says do not enlarge until a district needs it. — decision needed
- Multiplayer room names (`house:<id>`) once interiors are in-world. — decision needed (before the shell build)
- Retune wear tax per tree and income per hour with the bucking step added; plank price, blade, fuel, Hand Saw and chainsaw prices are placeholders. — needs playtesting
- Income per hour for logging vs housing prices and other jobs. — needs playtesting
- Carry speeds (70% / 60%), drop behaviour, trunk despawn time. — needs playtesting
- Hunger/thirst/energy drain while chopping, bucking and carrying. — needs playtesting
- Regrowth speed once oaks and giants exist. — needs playtesting
- Maximum walking and driving slope, and terrain chunk size, for the elevation build. — deferred
- Move the old dev tools (stat drain, add test item) from the phone's Settings into the dev panel behind the dev flag; fold in the `?debug` hook. — deferred
- Remaining literals (height bands, room geometry, west-to-east zone assumption). — deferred

## 8. Non-goals for v1
- Actual elevation or hills (prep only: `heightAt`); general rigid-body physics and simulated vehicle physics (suspension, skidding); drop-in/drop-out multiplayer and server authority.
- NPC burglary; a hygiene need (placeholders only); large-scale traffic in 0.33.
- Selling raw logs; enlarging the map before a district needs it; per-cell crop meshes; bulk shadow-casting scenery; all interiors built at once.
