# Ironwood: the downtown rebuild and the hotel start (design note)

Fable 5.2, 2026-11-13. Design only: nothing here is built and no code was changed. Game version read: 0.35.7.
Read with `DESIGN.md` 3 (budget), 4.1, 4.3, `notes/gigs-starter-design.md` (the starter story) and `notes/visual-overhaul-design.md` (the measured draw calls used below).
Coordinates: 1 unit = 1 m, north is -z, x grows east. Every position is a proposal: the build checks each one against the model footprints and the tests. Prices are placeholders for Haiku.

**In one paragraph.** Alder Center becomes **Ironwood**, the downtown of Eden Ridge and the place a new player starts. Display names change; internal ids (`alder`, `alder-*`) stay. The district grows from 78 x 77 m to 90 x 94 m (+41%) inside the existing map (the ground and the playable rectangle do not change), gets two new streets, a walkway, a second small plaza, nine more shopfronts and a hotel on the north side of the town square. A new player starts in the hotel lobby, checks in, steps out onto the square and walks to Noah: the starter story "A Hand for Hal" then runs as designed. Old saves are never moved. A second growth step (a West Quarter, total 2.2 times today's area) is sketched as an option.

---

## 0. Risks first

### 0.1 Frame rate (user GPU about 165 FPS; budget 300 draw calls, 15 skinned characters, 10 cars)
I cannot measure FPS (software WebGL). Draw calls and triangles are counted; the "today" row is the measured one from the visual overhaul audit (world scene only: the player, driven vehicles, other players and markers come on top). The other rows are estimates from the model data.

| Ironwood view | World draw calls | Shadow-pass draw calls | Triangles (main / shadow) |
|---|---|---|---|
| Today (measured) | 141 | 35 | 176,000 / 91,000 |
| New core built the naive way (one mesh per building, one canvas label per sign, a door and an awning mesh per shop, six more pavement slabs) | about 236 | about 48 to 64 | about 215,000 / 120,000 |
| New core built with the kit rules of 0.2 | about 139 | about 34 | about 206,000 / 115,000 |
| Core + West Quarter with the kit rules | about 145 | about 38 | about 235,000 / 135,000 |

- **The naive build is the risk, not the size.** 236 + about 55 shadow draws is at the 300 budget before a single walker exists. Session A2 will put up to 15 skinned characters downtown (each several meshes, each a shadow caster): that would go over. Expected effect on the user's GPU: 5 to 15 FPS lost once people walk (estimate).
- **Triangles are not the risk.** The forest view already draws 494,000 + 333,000 and the bridge 402,000 + 292,000. Ironwood stays under half of that. All nine Kenney shop models are 1,100 to 3,500 triangles.
- **Cheaper options, in order:** (a) build the core only, no West Quarter; (b) no awnings and signs beyond 60 m; (c) skip block merging (0.2 rule 2) as long as the measured world count stays under 150; (d) drop the hotel wings and use one tower model.
- **The lobby costs nothing outdoors.** It is a room far from the map, like the Ridgeline office: while you are inside, the town is not drawn. Lobby budget: at most 25 draw calls, 10,000 triangles (DESIGN 4.3), 2 skinned characters, emissive lights plus at most one point light.

### 0.2 The rules that keep a bigger city inside the budget
1. **Instance everything small from day one.** Doors, door frames, awnings, parasols: one `InstancedMesh` per model (`props.js createPropInstances` already does this), tinted per instance. All shop signs: **one** texture atlas (one 2048 x 1024 canvas, about 8 MB) on one merged mesh, not one `label()` canvas per sign. Cost: about 6 draw calls for the whole downtown however many shops there are. None of it casts a shadow.
2. **Merge the buildings by block.** Verified: all nine `shop-*` models share one identical 128 px palette texture, so they can share a material and be merged into one static mesh per block. The sightline fade works per pixel from world position, so a merged block still dissolves only where it hides the player. The catch is night windows: `night-lights.js` lights one building by its own material. Cheap answer with no new shader work: merge by **block and night kind** (`shop`, `office`, `always`), so each batch still switches as one. About 8 batches replace 21 building meshes in the core (the `store` model has its own texture and stays single).
3. **Cull by distance in chunks, like the Eastbank yards.** Each block's small things (doors, awnings, signs, furniture, parked cars) are one chunk drawn within 90 m. Building batches are hidden beyond 170 m (the fog ends at 155 m). three.js frustum culling drops the blocks behind the camera once each batch has its own bounding sphere.
4. **Caps as data, checked by a test** (like `YARD_CAPS`): at most 16 parked scenery cars in Ironwood, at most 60 buildings, world draw calls in three fixed Ironwood views at most 150, shadow casters within 92 m at most 45. New test `tests/city-budget.mjs` counts them in Node the way the visual audit did.
5. **One interior at a time** (DESIGN 4.3): a shop room is built when you reach its door and dropped when you leave. Making more shops enterable never adds to the street's cost.
6. **Acceptance on the real GPU after every visible stage:** the user reads the FPS at three spots (hotel door looking south, the Main Street and Ironwood Street junction looking west, Oak Street looking north). Stop and fix if under 150.

### 0.3 Other risks
- **Tests that boot a fresh game assume the street spawn** (`tests/startup.mjs`, `rescue.mjs`, about 25 `*-game.mjs` through `tests/support/boot-game.mjs`). Starting fresh saves in a lobby breaks them all at once unless the boot helper marks the arrival as done by default. Section 5.
- **Shared files.** `game.js`, `jobs.js`, `phone*.js` and the gigs files are being edited by others now; `night-lights.js` belongs to the visual overhaul. Stages that touch them are marked in section 7 and must be sequenced, not run in parallel.
- **Tokens.** `game.js` is 212 KB in 1,536 dense lines. Every stage here that touches it names single lines and adds one-line hooks only; rules live in new pure files.
- **Model variety.** Today there are 10 building models. Nineteen shops from 10 models repeats: the user's complaint. The fix needs the unused Kenney models (section 2.4), which are **not on this PC** (`assets-src/` holds only the industrial kit).

---

## 1. The layout

### 1.1 How much bigger, and how it joins
| | Today | Core (this design) | Core + West Quarter (option) |
|---|---|---|---|
| Zone `alder` | x -20..58, z -125..-48 | x -20..70, z -142..-48 | same, plus a new zone x -95..-35, z -130..-48 |
| Size | 78 x 77 m, 6,006 m2 | 90 x 94 m, 8,460 m2 (+41%) | 13,380 m2 (2.2 times) |
| Buildings | 10 | 19 shops and civic (10 today + 9 new) + the hotel | about 34 |
| Vehicle streets | 2 | 4 | 6 |

- **The map does not grow.** `MAP.ground`, `MAP.playable`, the exits and the river are untouched. Ironwood grows into two tree belts (north to the river, east to Cedar Heights). The belt trees inside the new zone disappear by themselves (`world.js claimed()` keeps scenery out of zones), which changes the pinned tree count and hash (section 5).
- **North edge z -142:** the river centre is about z -161.6 at x -20 and farther north as x grows. `tests/map.mjs` wants more than 16.6 m from the zone edge to the centreline; straight interpolation gives about 19.3 m. Unverified against the smoothed curve: if the test fails, use z -140.
- **East edge x 70** touches Cedar Heights' zone (x 70). Touching is allowed (`validateMap` uses a strict overlap).
- **Joins:** County Road and the County Bridge on the west (the way to the farm and Pine Ridge): River Street meets the County Road 8.5 m south of the bridge deck (deck ends z -146). Main Street runs on east to the Cedar Heights loop at x 84, unchanged. Ironwood Street runs south to Oak Street and Westside, unchanged. Nothing in Westside, Cedar Heights or Eastbank moves.

### 1.2 Diagram (north up, not to scale)
```
   x: -30   -20          -6.5    1     9 10                    37 38 43 45   55 57        69
       |     |             |     |     |  |                     |  |  |  |    |  |         |
z-142  +=====+===================== RIVER STREET (new, 9 m) ====================+    +
z-133  | C   | ......................... sidewalk .......................... |    |
z-131  | O   | [C18 Town Hall][C19   ][C20    ] [H1  THE IRONWOOD HOTEL    ]   | I  | [C17 Gazette  ]
       | U   | [            ][Clinic][Clothes] [ wing |  TOWER  | wing     ]   | R  |
z-122  | N   | ------ back court (paved) ------ +----- door (23.5,-120) ---+ t | O  | [C16 Furniture]
       | T   |                                  |                          | e | N  |
z-108  | Y   | [C8 Police   ][C9    ][C10    ]  |      TOWN SQUARE         | r | W  | [C15 Hardware ]
       |     | [            ][Books ][Cinema ]  |      (fountain)          | r | O  |
z -99  | R   | ========= sidewalk ============  |                          | a | O  | [C14 Post     ]
z -96  | O   |                                  +-------- bollards --------+ c | D  | [    Office   ]
z -90  | A ==+======= MAIN STREET (alder-cross, 12 m) ====[crossing x 25]======+ ST +=========> Cedar Heights
z -84  | D   | ========= sidewalk ===========================================  |    | == sidewalk ==
z -81  |     | [C1 Store ][C2    ][C3    ][C4    ]|walk|[C6      ][C7  ]       |    | [C11 Diner    ]
       |     | [         ][Office][Tower ][Bakery]|way |[Pharmacy][Bank]       |    | [ BUS PLAZA   ]
z -63  |     |  P P P P P P  car park (alder-lot, 20 bays; hotel guest bays) =>|    | [C12 Barber   ]
z -52  |     |                                                                 |    | [C13 Florist  ]
z -48  +-----+------------------------ Westside (Oak Street, the market) ------+----+
```

### 1.3 Streets and walkways
| Id | Shown as | From, to | Width | Status |
|---|---|---|---|---|
| `alder-cross` | Main Street | (-30, -90) to (84, -90) | 12 | unchanged |
| `alder-street` | Ironwood Street | (50, -3.5) to (50, -125) | 10 | unchanged |
| `ironwood-street-n` | Ironwood Street | (50, -125) to (50, -142) | 10 | **new edge** (the old one is not edited, so its pinned rectangle stays) |
| `river-street` | River Street | (-30, -137.5) to (50, -137.5) | 9 | **new** |
| (pavement) | Barber's Walk | x 21.5..28.5, z -80.7..-63 | 7 | **new**, on foot only: Main Street to the car park |
| `alder-lot` | Car park | x -14..45, z -63..-52 | | unchanged; two bays (x 21.6..27) kept empty where the walkway arrives; bays marked for hotel guests |

The four streets make one driving loop: County Road, River Street, Ironwood Street, Main Street. New crosswalks: (25, -90) across Main Street on the hotel's axis, and (50, -128) across Ironwood Street. The Main Street parking lanes are split around the new crosswalk (18 parallel bays become 16); the parked car at (26, -94.75) moves one bay east and `park-lot-5` moves to x 31.05.

### 1.4 Plots (rectangles on the half metre; the landmark centre comes from the model's footprint so the front sits on the sidewalk)
| Plot | Rectangle (x, z) | Faces | Building | Status |
|---|---|---|---|---|
| C1 | -20..-7, -81..-63.5 | north | Ironwood Store (`store`) | kept |
| C2 | -7..3, -81..-70 | north | Offices (`shop-i`) | kept |
| C3 | 3..14, -81..-69 | north | Ironwood Tower (`shop-l`) | kept (model swapped once new models exist, see 3.1) |
| C4 | 14..21.5, -81..-71.5 | north | Bakery (`shop-c`) | kept |
| C5 | 21.5..28.5, -81..-73 | | Barber's Walk | **plot retired**, barber moves to C12 |
| C6 | 28.5..36, -81..-72.5 | north | Pharmacy (`shop-a`) | kept |
| C7 | 36..43, -81..-72 | north | Bank (`shop-f`) | kept |
| C8 | -20..-6.5, -108..-99 | south | Police Station (`shop-e`) | kept |
| C9 | -6.5..1, -108..-99 | south | Books (`shop-h`) | kept |
| C10 | 1..9, -107..-99 | south | Cinema (`shop-g`) | kept |
| H1 | 10..37, -132..-120 | south, onto the square | **The Ironwood Hotel** | new |
| C11 | 57..69, -81..-73.5 | west (corner with Main Street) | Ironwood Diner | new |
| (plaza) | 57..69, -73.5..-66 | | Bus Plaza (the bus stop at (56.4, -72) stays) | new |
| C12 | 57..69, -66..-59 | west | Barber (`shop-d`, moved) | moved |
| C13 | 57..69, -59..-52 | west | Florist | new |
| C14 | 57..69, -109.5..-99 | west (corner with Main Street) | Post Office | new |
| C15 | 57..69, -117..-109.5 | west | Alder Hardware | new |
| C16 | 57..69, -124.5..-117 | west | Furniture showroom | new |
| C17 | 57..69, -133..-124.5 | west (corner with River Street) | Eden Ridge Gazette | new |
| C18 | -20..-6.5, -131..-122 | north | Town Hall | new |
| C19 | -6.5..1, -131..-122 | north | Ironwood Clinic | new |
| C20 | 1..9, -131..-122 | north | Clothes shop | new |

New drawn pavements: River Street's south sidewalk (x -20..45, z -133..-131); Ironwood Street's two sidewalks carried north (x 43..45 and 55..57, z -133..-122); Main Street's sidewalks east of Ironwood Street (x 55..70, z -84..-81 and z -99..-96); Barber's Walk; the square's east terrace (x 38..43, z -122..-99.3); the Bus Plaza; the back court (x -20..9, z -122..-108). The signpost `alder-sign` at (57, -56) stands inside C13 and moves to the pavement at about (56, -50).

### 1.5 What is removed (the user's request)
- **The street-tree rows:** the `tree` key on the frontages `cross-s`, `cross-n` and `st-e-s`. Data only.
- **The four planters** at the corners of the square.
- The three benches on the square's north edge move to either side of the hotel door.
- I could not see the screenshot. I have assumed "the row of planters" is the tree rows and the square's planters. The four trees inside the square stay unless the user says otherwise (open question 5).

### 1.6 The West Quarter (option, a later stage)
A second zone `ironwood-west`, x -95..-35, z -130..-48 (60 x 82 m), west of the County Road, which then runs through the middle of town: Main Street carried west to x -90, one north-south street at about x -62, a small park, about 14 buildings and a second apartment block (more residents for `population.js`). It needs its own short layout note. `tests/map.mjs` line 51 (commercial plots lie in `alder`) would accept both zones. Not part of the staged plan below except as its last step.

---

## 2. The building kit

### 2.1 Idea
A building is a **real model** (a landmark, as today) plus a **facade record** (new, pure data in `dist/downtown.js`, keyed by landmark id). The record names a type and its dressing; `dist/downtown-view.js` draws all dressing instanced. No generated boxes stand in for buildings.

```
{landmark:'alder-bakery', type:'shopfront', name:'Ironwood Bakery',
 sign:{text:'BAKERY', style:'board', fg:'#f4ead2', bg:'#7a3b2e'},
 awning:{model:'awning-wide', colour:'#b5452f'}, tint:'#f3eadc', door:'single', night:'shop'}
```

### 2.2 The five types
| Type | Models (today) | Height | Entrance | Awning | Sign | Used for |
|---|---|---|---|---|---|---|
| **Shopfront** (mid-row, 6.7 to 8 m wide) | `shop-a`, `shop-c`, `shop-d`, `shop-f`, `shop-g`, `shop-h` | 7 to 13.5 m | one door at the model's door anchor, a step, a door mat | one, tinted | board over the door, or a hanging sign at right angles to the street | bakery, barber, pharmacy, books, florist, clothes, hardware |
| **Corner shop** (two street faces) | `shop-e` (13 m wide), `shop-i` | 7 to 13.4 m | door on the main face; a second sign and awning on the side face | two | boards on both faces | diner, post office, gazette |
| **Tower** | `shop-l` (18.2 m), `shop-i`, the Kenney skyscrapers once imported | 13 to 40 m | double door under a flat canopy | canopy (overhang piece) | name board on the first-floor band; roof sign later | offices, the bank, the hotel's tower |
| **Hotel** | section 3.1 | 13.5 to 18 m | double glass door, wide canopy, two planters allowed here only | canopy | lit name board, vertical "HOTEL" blade sign | the Ironwood Hotel |
| **Civic** | `shop-e`, `shop-i`, later a modelled town hall | 7 to 13 m | steps, double door, no awning | none | stone-coloured plaque, a flag pole (missing model) | police, town hall, clinic, post office |
The big-box `store` model (Poly Pizza) stays what it is: the Ironwood Store and the dealership.

### 2.3 Variation without new models
- **Tint:** a per-building colour multiplied into the palette texture (baked into vertex colours when a block is merged; a material colour before that). Eight wall tints as data.
- **Awnings and canopies:** 8 colours, instanced with a per-instance colour.
- **Signs:** every shop has its own name, colours and one of three styles (board, hanging, lettering on the awning); all in the one atlas.
- **Placement rule (tested):** the same model never stands twice in one street face nor within 40 m of its twin; neighbours differ in height by at least 2 m where the models allow.
- **Windows:** the Kenney windows are painted in the texture; `night-lights.js` already lights them from a mask. No separate window geometry. Real see-through shop windows arrive only with a shop's interior (DESIGN 4.3).
- **Real entrances:** today the shop models have **no door anchor** (`propInfo('shop-a').door` is null; only houses have one). The converter must measure one per model (as it does for houses). A real door frame and leaf stands at each anchor: static and instanced along the street; the one you walk up to (within 12 m) is swapped for the animated door from `doors.js`. A shop that is not enterable yet still answers E with its name, hours and why (`properties.js doorState` already gives that text).

### 2.4 Assets: what exists, what is missing
| Need | Status |
|---|---|
| Nine Kenney commercial buildings and the Store | in the game (`props-assets.js`) |
| Five more Kenney commercial buildings and four skyscrapers (`ASSETS.md`: "18 buildings, 4 skyscrapers", CC0) | **not converted, and the kit is no longer under `assets-src/`**: the user downloads Kenney City Kit (Commercial) again. Sizes unverified |
| Awning, wide awning, overhang, parasol | I believe the same Kenney kit ships `detail-awning`, `detail-overhang`, `detail-parasol` pieces. **Unverified** until the kit is back on disk. If not: the user models two awnings (3 m and 5 m, about 60 triangles each) and one canopy |
| Door frame and leaf for shops | `doors.js` has sliding, double and hinged doors (generated geometry, already the game's doors). Reuse; no new asset |
| Lobby and hotel-room furniture | in the game: sofa, coffee table, rug, plant, lamp, side table, desk, desk chair, bookcase, table, chair, double bed, wardrobe, TV, bath pieces, the water cooler |
| **The hotel building** | **missing.** Interim from real kit models (3.1); the proper one is for the user to model |
| **Reception desk** | **missing.** The Kenney Furniture Kit (117 pieces, in `assets-src` earlier) may have a bar or corner desk: unverified. Interim: two `f-desk` side by side |
| Suitcase, luggage cart, desk bell, key rack, lift doors, revolving door, flag pole, bus shelter upgrade, newspaper box, hanging-sign bracket | **missing**; all small (under 300 triangles each). None blocks the first stages |
| A modelled town hall, a clock for the plaza | missing, optional |

**For the user to model (best value first):** (1) the hotel, spec in 3.1; (2) a reception counter, 2.6 m, at most 300 triangles; (3) two awnings and a canopy if the Kenney ones do not exist; (4) a suitcase. Everything else can come from CC0 kits; I have not verified any specific file.

---

## 3. The hotel

### 3.1 Exterior
- **Where:** plot H1, the north side of the town square, facing south. Door at about (23.5, -120) on the fountain's axis; you stand outside at (23.5, -118.6). Stepping out you see the fountain, the square, Main Street's shop row and the walkway to the car park: the focal point of the game.
- **Interim build from real models:** a second `shop-l` (the 18.2 m tower, 11.0 x 11.2 m) in the middle with `shop-g` (7.8 m wide) and `shop-f` (6.7 m wide), both 13.5 m tall, as wings: 25.5 m of frontage, fronts in one line. One wall tint for all three, a wide canopy, the name board and a blade sign make it read as one building. It stands 2 m onto the square's slab (allowed: plots may not overlap roads, fields, buildings or other plots; pavements are not in that list). The tower's back wall comes within about 0.2 m of River Street's sidewalk: the build sets the exact z from the footprint.
- **The proper model (user):** about 24 x 9.5 m, five floors (about 17 m), flat-shaded, the Kenney palette look, at most 6,000 triangles, colour-only materials, a real ground-floor opening 3 m wide for the door (so a lobby can sit behind real glass later), +Z forward, pivot at base centre. Anchors: door, canopy, name board, blade sign.
- Registry: `ironwood-hotel` (type `commercial`, access `public`), the two wings as `enterable:false` with the reason "Guest rooms: reached from the lobby."

### 3.2 The lobby
- **Recommendation: a room of its own, like the company office** (`office.js`, a room far from the map, drawn only while you are inside), entered by walking into the door with the normal fade. Not the in-world shell yet, because the interim hotel is an opaque model with painted windows, the DESIGN 4.3 shell build has not started, and this way the lobby costs nothing outdoors. **Upgrade path:** when the shell exists and the hotel model has a real opening, the lobby moves in-world by changing its `origin`; the layout data stays.
- **Data:** a new list `MAP.lobbies` (same shape as `MAP.offices` without an employer): `{id:'ironwood-hotel', kind:'hotel', building:'ironwood-hotel', door:{x:23.5,z:-118.6,...}, sign:{...}, interior:{origin:{x:420,y:.165,z:340}, ...}}`. `validateMap` gets one block with the office checks minus the employer (the existing office rule demands an employer, so the hotel cannot simply be an office).
- **Room** (16 x 12 m, the shop frame: door in the front wall, the camera looks in from there): reception desk at the back left with the receptionist behind it; a seating group on the right (two sofas, coffee table, rug, plants, lamp); lift doors on the left wall; the water cooler (free water: the first lesson about thirst); a wall board with a town map ("You are here: Ironwood"); a leaflet rack (work in town: Noah, Ridgeline). New file `dist/hotel-lobby.js`, returning the same `{scene, occluders, glass, clerk, exitDoor, blocked}` as `office.js` so `game.js` treats it like an office.
- **Staff:** one post, `{id:'hotel-desk', at:{property:'ironwood-hotel'}, role:'Receptionist', hours:[360,1380]}`. Outside those hours a key box on the desk does the same job, so the hotel always works.

### 3.3 The opening beat (about 1.5 to 2 real minutes)
1. **Fade in, in the lobby**, two steps inside the door, facing the desk. Location line: "THE IRONWOOD HOTEL · Ironwood". Objective card: "Check in. Speak to the receptionist." (teaches walking and E).
2. **Receptionist** (dialog, as Noah speaks today): "Welcome to Ironwood. First time in Eden Ridge? Tonight is paid for: room 204, the lift is on your left. After that it is $18 a night. If you need work, Noah at the Corner Market on Oak Street always wants a hand. I'll tell him you are coming."
3. **The phone shakes:** Noah's message. This is beat 1 of "A Hand for Hal", unchanged.
4. **Walk out** through the double door: fade to the square, facing south. The tracker arrow leads across the square, over the new crosswalk, down Barber's Walk, through the car park and down Ironwood Street to the market (about 130 m, half a minute).
Nothing is locked: a player who walks straight out still gets Noah's message after 60 seconds, and the check-in stays on the card until done.

### 3.4 How it fits the gigs starter story
`starter.js` exists already (beats 1 to 10, `step` 0..10). The hotel is added **in front of** it without renumbering:
- One new optional field, `progress.starter.arrived` (bool), and one new event, `checked-in`, which sets it and gives the first-night voucher. No `step` changes, so the existing beat tests stand.
- `starterObjective` returns the check-in card while `arrived` is false and `step` is 0.
- `PLACES.spawn` (-5, 15) is joined by `PLACES.hotel` (23.5, -118.6). Beat 1's text is unchanged.
- **Beat 4** (the walk to Hal's farm) now passes back through Ironwood and over the County Bridge: the player sees the town twice. Distance from the market is the same as designed.
- **Beat 9** ("Somewhere to park") accepts either home: Studio 2B ($90) or a paid hotel night ($18, guest parking). Hal's line names both. The `rented` event fires on either.
- **Beat 10** (sleep): the studio bed or the hotel bed.
- The first-night voucher is a bed only (no parking), so beat 9 still teaches paying for a home (open question 3).

### 3.5 Where a save starts
- **Old saves are never moved.** The rule in `game.js` (line 414) stays: a save with `progress.position` starts there.
- **A fresh save** (no position, `starter.arrived` false, story not done or skipped) starts in the lobby at the room's entry. `persist()` does not store a position while you are indoors, so quitting in the lobby starts you in the lobby again.
- **Normalising** (`starter.js normalizeStarter`): `arrived` is true when it was saved true, or `step > 0`, or the story is done, or the save has any progress (`hasProgress`), or a saved position exists. Only a save that has never played gets false.
- **`MAP.spawn` stays (-5, 15).** It is pinned by `tests/map.mjs` and `tests/town.mjs`, and it remains the Reset and rescue point. A new key `MAP.arrival = {lobby:'ironwood-hotel'}` names the start. Moving Reset to the hotel door is open question 7.
- No schema bump: one optional field, normalised.

### 3.6 Renting a room (a housing option)
| | Studio 2B (today) | Hotel room (new) |
|---|---|---|
| Price | $60 a week + utilities, $30 deposit | $18 a night, paid ahead at the desk (or the key box); no deposit, no utilities |
| A week costs | about $67 | $126 |
| Debt | bills can fall due | never: when the paid nights run out the key stops working |
| Vehicle | 1 | 1 (a guest bay in the car park), only while paid |
| Furniture, storage | yes (0.36) | no: the room is furnished and fixed |
| Sleep | yes | yes |
- The room: reached by the lift in the lobby (a fade, like "go upstairs"). Built like the studio room (`apartment.js`) from models already in the game: double bed, wardrobe, desk and chair, TV, a bath corner.
- Data: property `hotel-room` (type `apartment`, access `tenant`, landlord "The Ironwood Hotel"). Save: `progress.hotel = {paidUntilDay, voucherUsed}` (optional, normalised). New pure file `dist/hotel.js`: `HOTEL` (prices), `normalizeHotel`, `hotelTransaction(state, 'pay-nights'|'check-in'|'rest', context)`, `hotelRoomHeld(p)`. `orders.js homesHeld` counts the room while paid. A vehicle is never removed when the nights run out: it stays where it is parked and only buying another is blocked (unverified that `orders.js` already behaves this way for a lost home: check in the stage).
- Why both exist: the hotel is the flexible, dear choice for the first days; the studio is the cheap committed one; a Cedar Heights house is the goal.

---

## 4. Shops and entrances
Stage 1 makes **two** doors enterable (the hotel lobby and room). Every other building gets a real door, sign and awning now and its inside with the feature that needs it, one at a time.

| Building | Plot | Status | Ties to | Enterable |
|---|---|---|---|---|
| The Ironwood Hotel | H1 | new | the start, the starter story, housing | **yes, stage 1** |
| Ironwood Store (was Alder Store) | C1 | kept | cashier shifts (0.38) | with 0.38 |
| Offices | C2 | kept | rush envelope gigs | later |
| Ironwood Tower | C3 | kept | later employers | later |
| Bakery | C4 | kept | gig pick-ups (lunch run, D1) | later |
| Pharmacy | C6 | kept | gig D4 (pharmacy rush) | later |
| Bank | C7 | kept | mortgages (0.36) | with 0.36 |
| Police Station | C8 | kept | the incident log (session B) | later |
| Books, Cinema | C9, C10 | kept | parcels; evening life | later |
| Barber | C12 | **moved** from C5 | the character creator's hair | later |
| Ironwood Diner | C11 | new | gig D1 (lunch run) | later |
| Florist | C13 | new | gig D5 (flowers) | later |
| Post Office | C14 | new | parcel and round-of-three gigs; a real gig counter | later |
| Alder Hardware | C15 | new | the name is already a ticket customer (`tickets.js`); tools (0.37) | with 0.37 |
| Furniture showroom | C16 | new | the Furnish app (0.36) | with 0.36 |
| Eden Ridge Gazette | C17 | new | gig D3 (morning paper round) | later |
| Town Hall | C18 | new | property and plots later | later |
| Ironwood Clinic | C19 | new | passing out (4.18), the incident log | later |
| Clothes shop | C20 | new | the character creator's clothes | later |
| **Not in Ironwood, unchanged:** Corner Market (Noah), Alder Coffee (the cafe job), Oak Street Apartments and Studio 2B, the laundry (all Oak Street); Riden Deals, the gas station, the Ridgeline office and warehouse (Eastbank). |

Each new building gets a registry entry (`enterable:false` and a reason that names its feature) and a staffed post (shopkeeper hours as data), so the people of the town (4.20) work there when A2 draws them. Gig places (`gigs.js`) can then use real Ironwood doors.

---

## 5. Renaming, and the tests that pin things

### 5.1 The rename: display names only
**Decision: keep every internal id** (`alder` zone id, `alder-*` landmarks, properties, posts and roads, `alder-lot`, `alder-square`, the node names, the map id `oak-and-alder`).
- **Display changes** (all in `map-definition.js`): the zone's `name` "Ironwood", `label` "IRONWOOD", `subtitle` "Downtown"; the signpost text; the property names ("Ironwood Store", "Ironwood Bakery" and so on). **One pinned test line changes: `tests/map.mjs:22`** (the label).
- **Kept on purpose:** "Alder Coffee" (pinned in `map.mjs:54,56` and `startup.mjs:92`, used by `jobs.js`, `gigs.js`, `cafe-job.js`), "Alder Avenue" (a street in Westside), "Alder Hardware" (a ticket customer), Westside's subtitle "Oak & Alder". A town called Ironwood can have an Alder Avenue (open question 4).
- **What renaming the ids would touch (not recommended, no gameplay value):** about 43 places in 9 test files (`map.mjs` 19, 25, 51, 72; `terrain.mjs` 30, 39; `properties.mjs` 12, 13; `night-lights.mjs` 56; `town.mjs` 33; `roads.mjs` 27), `junctions.js TOWNS`, `game.js:1470` (dev teleports), and the post and property ids the population is built from. I found no save field keyed by these ids (unverified). The tree hash does not depend on ids.

### 5.2 Tests that pin today's Alder Center
| Test | What it pins | What must change |
|---|---|---|
| `map.mjs:19` | the zone rectangles | `alder` becomes x -20..70, z -142..-48 |
| `map.mjs:22` | the label "ALDER CENTER" | "IRONWOOD" |
| `map.mjs:25` | every asphalt road rectangle, in order | two rows appended (`ironwood-street-n`, `river-street`); existing rows unchanged |
| `map.mjs:31` | 395 cuttable, 530 scenery trees and their hash | scenery count and hash change (belt trees inside the new zone go); 395 stays. A deliberate update, with a note in the message as before |
| `map.mjs:44` | every town zone keeps 16.6 m from the river centre | must still hold at z -142 (see 1.1) |
| `map.mjs:51` | commercial plots lie in `alder` | holds (H1 and C11 to C20 are inside) |
| `map.mjs:55` | `MAP.spawn` and nine city buildings | **unchanged by design** |
| `town.mjs:15-22` | 7 shops south and 3 north of the cross street, rows from x -20 to 43 and to 9 with no gap, at least 9 different models, sidewalk in front | rewrite as rules per street face: fronts on the sidewalk, no gap over 0.5 m except a declared walkway, model variety; the helper must handle buildings facing east and west (use `town.js buildingRects`) |
| `town.mjs:23` | 8 drawn pavements | the new count (17), or a name check if the slabs are merged |
| `town.mjs:30,35,38` | 4 stop lines, 38 bays, 12 to 16 parked cars | bays become 36; the others hold |
| `town.mjs:49,58,60` | at least 10 trees and 4 planters; a `planter` mesh exists | trees at least 4 (the square's), planters removed from the lists |
| `town.mjs:47` | 3 m of clear ground around the spawn | unchanged |
| `town.mjs:64-71` | the square, the fountain, five walkable points | hold (the square's rectangle does not change; the point (23.5, -117.5) is in front of the hotel door and stays open) |
| `terrain.mjs:30` | Alder can be walked into from the east at (59, -110) | that point is now inside plot C15: use (71, -110) |
| `properties.mjs:12-13` | the exact ordered list of property ids | new ids added to the Alder group |
| `night-lights.mjs:58` | 23 buildings with windows | 23 + 12 (nine new shops, three hotel pieces); changes again if blocks are merged |
| `roads.mjs:27` | the dead ends, including `alder-street:to` | that end is now a junction |
| `street-trees.mjs`, `streetfurniture.mjs`, `real-models.mjs` | read `townSpots()` | fewer trees; unverified which counts they pin |
| `population.mjs`, `schedule.mjs` | the people built from posts and homes | more posts mean more commuters; unverified which totals are pinned |
| `junctions.mjs` | junction patches | the River Street and County Road junction lies outside the town zones, so a patch appears there; counts unverified |
| `starter.mjs` | the fresh starter object | gains `arrived` |
| `startup.mjs`, `rescue.mjs`, every `*-game.mjs` | a fresh game starts on Oak Street | **`tests/support/boot-game.mjs` sets `starter.arrived` true by default**; only the new hotel test starts in the lobby |
| `culling.mjs`, `eastbank.mjs`, `storefronts.mjs` | view distance, yards, shop glass | unchanged |

**New tests:** `downtown.mjs` (kit rules: every shop has a door anchor, a sign, a sidewalk in front and a door clear of furniture; model variety), `city-budget.mjs` (0.2 rule 4), `hotel.mjs` (pure: nights, voucher, capacity, normalising, old saves not moved), `hotel-game.mjs` (a fresh save starts in the lobby; check-in; stepping out lands on unblocked pavement at the hotel door).

---

## 6. The town files rule: exactly what changes
**`map-definition.js`** (additive except the three marked edits):
- Edit: the `alder` zone line (bounds, name, label, subtitle, minimap label). Edit: the frontages lose three `tree` keys; the square's `planters` becomes empty and three benches move. Edit: plot C5 is removed and the barber's landmark moves to C12 (its ids stay, so its property and post are untouched); two parked cars and the signpost move; the two parking lanes are split.
- Added: 3 road nodes and 2 edges; plots H1 and C11 to C20; 12 landmarks (nine shops, three hotel pieces); about 13 properties and 10 posts; 9 pavement rectangles; 2 crossings; frontage rows for the new sidewalks; the Bus Plaza; `lobbies`, `arrival`; one `validateMap` block for lobbies.
- Why: the map is data and this is the map changing. Facade dressing does **not** go in here (it goes in the new `downtown.js`), to keep this file from growing further.

**`town.js`** (two small additive edits, no rewrite):
- The plaza loop assumes every plaza has planters, trees, benches and bollards: one guard so the Bus Plaza may leave them out.
- The "not in front of a door" rule (line 48) assumes the door is at the building's middle on a north or south face: use the model's door anchor when it has one, else the old rule. Needed for the buildings that face west.
- Removing the tree rows needs **no** change here (a frontage without `tree` is skipped already).

**`world.js`** (two single-line edits; the file is CRLF, use single-line anchors):
- One line beside `createEastbank(...)` (line 439): `createDowntown({group, fade, colliders})` from the new `downtown-view.js`.
- In the batching stage only: one condition in the landmark loop (line 419) so a landmark that belongs to a block batch gets its colliders but no mesh of its own.
- Nothing else: the planter mesh is skipped by itself when the list is empty; new pavements, roads, crossings and lamps are drawn by the existing loops.

**New files, so the three stay small:** `downtown.js` (pure data and rules), `downtown-view.js` (three.js), `hotel.js` (pure), `hotel-lobby.js` (the room).

---

## 7. Staged build plan
Each stage is small, stops with `npm test` passing (after `npm run release -- --force`, or a version bump if deployed), and goes out as a hub plan. "game.js" marks the stages that touch the shared dense file.

| # | What | Model | Files | game.js |
|---|---|---|---|---|
| I0 | The user: answers section 8, downloads the Kenney City Kit (Commercial) again | user | `assets-src/` | no |
| I1 | Display rename: zone name, label, subtitle, signpost, property names | Haiku | `map-definition.js`, `map.mjs:22` | no |
| I2 | Remove the tree rows and the square's planters; move three benches | Sonnet | `map-definition.js`, `town.mjs`, tree tests | no |
| I3 | Grow the zone; River Street, Ironwood Street north, sidewalks, crossings, the walkway (barber moves to C12 as a plain landmark), the Bus Plaza. No new buildings yet | Sonnet | `map-definition.js`, `town.js` (plaza guard), `map.mjs`, `terrain.mjs`, `roads.mjs`, `town.mjs`, `junctions.mjs` | no |
| I4 | Converter: door anchors for the shop models; import the unused Kenney buildings and the awning, overhang and parasol pieces | Sonnet | `scripts/build-props.mjs`, `props-assets.js`, `ASSETS.md`, `assets-register.json`, `credits.js` | no |
| I5 | `downtown.js` (the kit as data and rules) and its test; place C11 to C20 with properties and posts | Sonnet | `downtown.js`, `map-definition.js`, `town.js` (door rule), `downtown.mjs`, `properties.mjs`, `night-lights.mjs`, `population.mjs` | no |
| I6 | `downtown-view.js`: instanced doors, awnings, the sign atlas, tints, per-block chunks culled at 90 m; the budget test. **The user checks the look and the FPS** | Sonnet (Fable if the user says so: this is the look pass) | `downtown-view.js`, `world.js` (one line), `city-budget.mjs` | no |
| I7 | The hotel outside: H1, the three pieces, canopy, name board; `MAP.lobbies` and its validation | Sonnet | `map-definition.js`, `downtown.js`, tests | no |
| I8 | `hotel.js` and the starter changes: `arrived`, `checked-in`, beats 9 and 10 accept the hotel, nights, voucher, capacity, old-save rule | **Opus** (save format, per the standing rule) | `hotel.js`, `starter.js`, `jobs.js` (normalise hook), `orders.js` (`homesHeld`), `hotel.mjs`, `starter.mjs` | no; **`jobs.js` and `starter.js` are being edited now: wait for the gigs work to land** |
| I9 | The lobby room and the start: the room, the receptionist, the dialog, fresh saves start inside, the boot helper default | Sonnet | `hotel-lobby.js`, `tests/support/boot-game.mjs`, `hotel-game.mjs` | **yes: about six single-line hooks** (office loader 160 and 165, start placement 414, objective text about 786 to 790, location line 788, dev teleports 1469) |
| I10 | The hotel room: lift fade, bed, guest bay, a card in the Homes app. Multiplayer room name `hotel` | Sonnet; Opus checks the relay change | `apartment.js` or a new room file, `phone*.js`, `relay-protocol.js`, `worker/` | **yes** (door and sleep hooks) |
| I11 | Block batching (0.2 rule 2), only if I6's measured count is over 150 or before A2 walkers and the West Quarter | Opus designs the night-window hand-over, Sonnet builds | `downtown-view.js`, `world.js` (one condition), `night-lights.js` (shared with the visual overhaul) | no |
| I12 | Prices, hours and texts after a play-test | Haiku | data only | no |
| I13 | Option: the West Quarter (its own short note first) | Opus note, Sonnet build | `map-definition.js`, tests | no |
| Later | Shop interiors, one per feature (0.36 bank and furniture, 0.37 hardware, 0.38 store) | as each feature | | yes, each |

Order notes: I1 to I3 change the town at once with no new assets and can ship alone. I4 waits for the user's download; I5 and I6 can start with the nine models already in the game and get more variety when I4 lands. I7 to I10 (the hotel) do not depend on I4 to I6 and can run first if the start matters more than the shopfronts; I8 must wait for the gigs agents.

---

## 8. Open questions for the user
1. **Size:** the core only (+41%, 19 shops and the hotel), or plan the West Quarter too (2.2 times today)?
2. **The hotel model:** will you model it (spec in 3.1), or ship the interim made of the Kenney tower and two wings first?
3. **First night free** (a bed only, no parking, so the story still teaches paying for a home), and $18 a night after: yes?
4. **Names:** "The Ironwood Hotel", Main Street, Ironwood Street, River Street; keep Alder Coffee, Alder Avenue and Alder Hardware? A name for the receptionist?
5. **What exactly to remove:** I assumed the tree rows on Main Street and Ironwood Street and the four planters on the square. Do the four trees inside the square stay?
6. **Barber's Walk:** is it fine to give up one shop slot on Main Street for a walkway to the car park?
7. **Reset and rescue point:** stays on Oak Street (-5, 15), or moves to the hotel door?
8. **The look pass (I6):** Fable or Sonnet?
9. **Multiplayer:** one shared lobby room where players see each other: fine?

## 9. Unverified (check in the stage that touches it)
- The river clearance at z -142 against the smoothed curve (computed from the straight control points).
- That the Kenney commercial kit has awning, overhang and parasol pieces, and the sizes of its unused buildings and skyscrapers (the kit is not on disk).
- The draw-call estimates in 0.1 (only the "today" row is measured); the per-piece breakdown of today's 141.
- What `street-trees.mjs`, `real-models.mjs`, `population.mjs`, `schedule.mjs`, `junctions.mjs` and `shadows.mjs` pin exactly (only their headers and matches were read).
- How `roads.mjs` decides a dead end, and whether new junction patches are generated at River Street.
- How offices report their multiplayer room today (`relay-protocol.js` allows `street`, `market`, `cafe`, `home`, `house:<id>` only).
- That `orders.js` keeps a vehicle when its home is lost; where the car park's guest bays should be.
- That the interim hotel pieces fit H1 with their fronts in one line (footprints: 11.0 x 11.2, 7.8 x 7.4, 6.7 x 8.2 m).
- The `game.js` line numbers (read on 2026-11-13 while other agents were editing it).
