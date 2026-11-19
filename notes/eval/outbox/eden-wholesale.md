michadr.

# Eden Wholesale building (owner decision 2026-11-19)
Agent: Opus subagent. I created new files only. I did not touch game.js, world.js, map-definition.js, props-assets.js, needs.js, gigs.js, the goods GLBs or any other shared file. I ran no git, no release and no full `npm test`.

## Files
| File | Lines / size | What |
|---|---|---|
| scripts/build-eden-wholesale.mjs | 130 lines | Generator with no dependencies. It reads the anchors, sign, door and brand colours from dist/eden-wholesale.js, so there is one source of truth. Deterministic: two runs gave the same SHA-256 (245ADA20...3CD5). |
| dist/assets/buildings/eden-wholesale.glb | 126,256 B | New folder. Houses and shops today are embedded props in props-assets.js, so no building GLB folder existed before. |
| dist/eden-wholesale.js | 41 lines | Pure registry with a header on line 1. No DOM, no three.js, no globals. It imports GOOD_KEYS from bakery-goods.js. NOT WIRED. |
| tests/eden-wholesale.mjs | 50 lines | Node assert. Prints one PASS line. |
| notes/eval/outbox/eden-wholesale-preview.png | image | Two views from a scratch software rasteriser (scratch folder, not in the repo). |
| PROJECT-INDEX.md | regenerated | `npm run index` |

## The model
- **Size and shape.** The footprint is 12 x 9 m. The origin is the middle of the footprint at ground level, y is up, the front faces +z, and 1 unit = 1 m (the house/shop prop convention).
  - Hall: x -6..6, z -4.5..1.2, roof at 5.6 m. It has a 0.4 m parapet with a coping (top at 6.06), and the vents reach 6.31.
  - Shop front: x -6..1.4, z 1.2..3.8, 4.2 m high.
  - Dock: x 1.4..6, z 1.2..4.5.
  - Small trims stick out up to 0.12 m at the back and sides. Nothing sticks out past the front line z 4.5.
- **Look (Eden brand).** I took the colours from notes/map-master.md 5: "dark blue-grey cladding, one green Eden stripe".
  - The hall is ribbed blue-grey cladding (#3e4a56, strips 0.4 m wide) on a concrete plinth. One green stripe (#2f7d4f) runs round the hall at 4.78..4.98 m. The parapet has a light coping.
  - The shop front has a staggered brick base 0.95 m high with a stone course, cream render above it, a double glass door, two shop windows and a small awning with a green edge.
  - The sign board is navy (#1f2b38) with a green border. It has a small green square at its left end as a placeholder for the logo.
  - The roller shutter has slats, guides and a housing. The dock sits under a blue-grey canopy with a green fascia and two yellow and black posts. The dock apron is flush concrete, 0.15 m high, with a yellow and black edge.
  - The roof has 2 box vents, 1 round extractor and 1 AC unit. There are high window strips on both sides, a fire-exit door with a green exit sign on the back, and 2 downpipes.
  - Dressing on the dock: one pallet of 6 flour sacks and one of 6 coffee sacks (low poly, the same colours as dist/assets/goods), plus a stack of 3 empty pallets.
- **Format.** ONE mesh, ONE primitive, ONE material: white x COLOR_0, roughness .95, metalness 0, double sided. These are the same numbers as the goods GLBs; only the material name differs. No textures. COLOR_0 is linear unsigned bytes. Normals are flat per quad.
- **Triangles: 2,004** (4,018 vertices). That is under the soft cap of about 3,000, and it is 1 draw call.
- **Sign.** The words are NOT in the model. An empty node named **`sign_eden_wholesale`** sits on the board's face at (-2.3, 3.55, 3.935) local, facing +z. Its `extras` hold `{text:'EDEN WHOLESALE', width:6.8, height:0.98, normal:[0,0,1]}`. A later sign texture/atlas quad goes on that rectangle, about 1 cm in front of it.
- **Anchors.** The GLB has empty nodes named `anchor_*` with the registry numbers. build-props.mjs already reads `anchor_*` as `anchors` if the model is ever run through it.

## Registry: dist/eden-wholesale.js (local coordinates)
- `ID='eden-wholesale'`, `NAME='Eden Wholesale'`, `OWNER='Bruce Hughes'`, `COMPANY='Eden'`, `MODEL='assets/buildings/eden-wholesale.glb'`, `PLACEHOLDER=true`.
- `SIZE {w:12,d:9,h:6.3,wallH:5.6}`.
- `DOOR {x:-2.3,z:3.8,width:1.8,height:2.3,facing:'+z',yaw:0}`. This is the props-assets `door` shape plus a facing.
- `COUNTER {x:-2.3,z:4.9}`: the buy prompt outside the door. Shops are not enterable yet, so this is a placeholder.
- `DOCK {x:3.7,z:4.5,y:.15,width:4.6,depth:3.3}`: the middle of the dock's front edge, where the tailgate stops.
- `TRUCK_BAY {x:3.7,z:8.3,yaw:0}`: the truck's rear faces the dock and its nose points away from the building.
- `PICKUP {x:3.4,z:3.4,y:.15}`: the E prompt for the flour and coffee gigs, on the dock.
- `STOCK.flour {x:4.5,z:2.0}` and `STOCK['coffee-beans'] {x:5.5,z:2.0}` (y .15, yaw PI/2): where the game puts the live `assets/goods/<good>-pallet.glb`. The preview shows them there.
- `SIGN {node:'sign_eden_wholesale',text:'EDEN WHOLESALE',x:-2.3,y:3.55,z:3.935,width:6.8,height:.98}`.
- `SOLIDS`: hall, shop front and the 2 canopy posts as local boxes. The dock apron is walkable.
- `ANCHORS`: the same points as `[x,y,z]`.
- `GOODS_SOLD=['flour','coffee-beans']` (from bakery-goods.js GOOD_KEYS) and `sells(key)`.
- `HOURS=[420,1020]`, `HOURS_LABEL='07:00-17:00'` and `isOpen(minute)`. This is the map `hours:[open,close]` shape, a placeholder.
- `BRAND` colours, `worldPoint(p,pose)`, `footprintAt(pose)`, `SITE_CANDIDATES` (2, see below).

## Tests (real output)
```
> node tests/eden-wholesale.mjs
PASS eden-wholesale: 2004 triangles, 7 anchors + sign node, sells flour and coffee-beans, open 07:00-17:00, 2 candidate sites clear of C1..C20, H1 and the car park
> node tests/bakery-goods.mjs
PASS bakery-goods: 2 goods, 6 models (flour-sack 788, flour-carry 788, flour-pallet 2348, coffee-beans-sack 800, coffee-beans-carry 800, coffee-beans-pallet 2396 triangles), supplier TBD
> node tests/assets.mjs  -> exit 0 (only its usual WARNING about assets-src originals)
> npm run index
brief 2834 tokens (target 3000), index 35232 tokens (target 37000); 264 modules, 14 generated, 322 tests, 33 scripts; 13 modules without a header comment
> node tests/brief.mjs
brief tests passed: 264 modules listed, brief 2834 and index 35232 estimated tokens (budgets 3000 and 37000)
```
The test checks:
- Names, owner, goods (equal to bakery-goods GOOD_KEYS), hours and isOpen edges.
- Each anchor is in its right zone: the door on the front wall, the counter outside, the dock, pickup and stock on the dock, the truck clear of the front, and no anchor inside a solid.
- worldPoint with yaw 0 and PI.
- Both candidate sites are 12 x 9, inside the zone x -20..70 / z -142..-48, and overlap none of C1..C20, H1, the plaza, the car park, Main Street with its sidewalks, Ironwood Street, River Street or Barber's Walk.
- The GLB is well formed: header, BIN chunk, aligned views, indices in range. It has one mesh, primitive and material, vertex colours and no textures. Its base is at y 0, it stays in the footprint and its height is right. It has 500..3000 triangles.
- Every anchor and the sign node in the GLB match the registry, so it catches a GLB that was not rebuilt after an edit.

## What I could NOT verify
- **Not seen in the game or in three.js.** The only visual check is the scratch software render, which uses Lambert shading and vertex colours. It shows the shapes, colours, sign board, shutter, dock and pallets as intended, with no inside-out faces I could see. The dark cladding may look darker under the game's tone mapping.
- **Walking on the dock.** The 0.15 m apron assumes the player can step onto it. heightAt (Stage 4) is on hold, so the player may stand at y 0 and sink 15 cm into the slab. If that looks wrong, set `DY` to .02 in the generator and `y` to .02 in DOCK/PICKUP/STOCK.
- **Scale against the avatar.** The door is 2.3 m, a little taller than the Kenney shop doors (2.05). I did not check it in the game.
- **The candidate sites against the live map.** I3 is editing map-definition.js right now. I checked the sites against the design note's plot table (1.4) and today's lot data (`alder-lot` bays x -13.5.., 20 x 2.7 m). I did not check them against decor props or anything I3 adds.
- **Credits.** Not listed in ASSETS.md or credits. It is code-built own work, so no credit line is needed. A hub register entry may be wanted.
- I did not run `npm run release` or the full `npm test`.

## Wiring request for the map/game lane (none of this is done)
**Loading.** The model is a standalone GLB, not a props-assets prop. Pick one of these:
- **(a) Recommended for speed.** game.js loads `MODEL` with GLTFLoader (like the timber and goods GLBs, `new URL(MODEL, document.baseURI)`) and places it at the landmark pose. Collision comes from `SOLIDS`, run through `worldPoint` and `footprintAt`.
- **(b)** Add a spec in scripts/build-props.mjs pointing at `dist/assets/buildings/eden-wholesale.glb` with `keepOrigin:'xyz'`, `door:{x:-2.3,width:1.8,height:2.3}`, `collide:{fit:true}` or WALLS, and scale 1. It then gets `anchors` for free. This changes props-assets.js, which the main chat owns.

**map-definition.js** entries (the shapes copied from lines 188, 289, 394 and 490; site 1 shown):
```js
// plots
{id:'C21',name:'Commercial plot C21',kind:'commercial',facing:'south',x0:30,x1:42,z0:-72,z1:-63},
// properties
{id:'eden-wholesale',type:'shop',landmark:'eden-wholesale',plot:'C21',name:'Eden Wholesale',company:'Eden',owner:{type:'npc',name:'Bruce Hughes',body:'male'},enterable:false,reason:'A trade counter: flour and coffee beans for the bakery.'},
// staff (the line 394 shape)
{id:'eden-wholesale',at:{property:'eden-wholesale'},role:'Clerk',hours:[420,1020]},
// landmarks (prop key or model: whichever validateMap accepts; with option (a) validateMap may need to allow a `model` field instead of `prop`)
{id:'eden-wholesale',model:'assets/buildings/eden-wholesale.glb',plot:'C21',zone:'alder',x:36,z:-67.5,yaw:0},
// signs (if the map's boards system draws the text; the line 542 shape): put the text quad at the sign node
```
I am not sure validateMap accepts `company` or an `owner` on a shop property. Drop them if it does not.

**World points for site 1 (pose x 36, z -67.5, yaw 0).** These came from `worldPoint`.
| Point | World position |
|---|---|
| Shop door | (33.7, -63.7), facing south (+z) |
| Counter / buy prompt | (33.7, -62.6) |
| Dock edge | (39.7, -63.0) |
| Gig pickup (E) | (39.4, -64.1), y .15 |
| Truck bay centre | (39.7, -59.2), yaw 0 (nose south, rear to the dock) |
| Live flour pallet | (40.5, -65.5), yaw PI/2 |
| Live coffee pallet | (41.5, -65.5), yaw PI/2 |
| Sign centre | (33.7, 3.55, -63.565) |

**Car park change for site 1.** The front line z -63 is the back of the bay row: bays run z -63..-58, and bay k covers x -13.5+2.7(k-1).
- Bay 18 (x 32.4..35.1) sits in front of the shop door.
- Bays 19 and 20 (x 35.1..40.5) sit where the truck backs in.
- Proposal: set `alder-lot` `bays.count` from 20 to 17 and repaint that strip as a loading zone and footway. Move `park-lot-6` (x 36.45, bay 19) to a free bay.

**needs.js / gigs.js.** `SUPPLIER` in bakery-goods.js becomes `'property:eden-wholesale'`, a one-line change for the bakery wiring run. The pickup for the flour and coffee gigs is `ANCHORS.anchor_pickup` through `worldPoint`. The live pallets go at `STOCK[good]` while stock is waiting, and isOpen gates buying at the counter.

**Sign.** game.js or a sign module draws 'EDEN WHOLESALE' on a canvas or atlas quad of 6.8 x 0.98 m at the `sign_eden_wholesale` node, facing the landmark front. Suggested colours: white or cream text, plus the green Eden mark that is already on the board's left end.

## Two candidate plots in Ironwood
1. **`behind-c6-c7` (recommended).**
   - Footprint x 30..42, z -72..-63, yaw 0: the front, door and dock face south onto the car park.
   - It fits exactly in the 9 m strip between the backs of the Pharmacy (C6, to z -72.5) and the Bank (C7, to z -72) and the car park (z -63). Both edges only touch, which validateMap allows.
   - It is clear of Barber's Walk (x 21.5..28.5).
   - Delivery route: about 40 m on foot from the dock to the bakery door (C4), via Barber's Walk and Main Street.
   - Cost: 3 car-park bays.
2. **`back-court-west`.**
   - Footprint x -20..-11, z -121.5..-109.5, yaw -PI/2: the front faces west onto the County Road verge (x -26..-20).
   - It sits in the paved back court (x -20..9, z -122..-108), clear of C8 (z to -108) and C18 (z from -122).
   - The truck stands on the verge at (-23.8, -111.8). A 7 m truck would reach about 1 m onto the County Road, so it may need to park parallel. The counter point (-20.4, -117.8) is 0.4 m outside the zone, on the verge.
   - Delivery route: about 85 m by road to the bakery.
   - Use it only if site 1 is wanted for something else.

## Confidence
- Registry and test: high. I ran them and they pass.
- GLB validity, determinism and the triangle count: high. The test checks them, and I hashed two runs.
- Look: medium. I have only seen it in my own software render, never in three.js or in the game.
- Candidate sites: medium. They are checked against the design note's plots and the current lot data, not against I3's in-progress map edits or decor props.
- Wiring plan: medium. Loading option (a) versus (b), and whether validateMap accepts a `model` landmark, must be checked by the map/game lane.
