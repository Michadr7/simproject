# Assets

## Contract (every model that enters the game)
- 1 unit = 1 metre; the player character is 1.95 m. +Y up, +Z forward, pivot at the base centre (the ground is y = 0).
- Static models are converted by a script into an embedded module (no server, no extra files). Textures are shrunk (256 px) and embedded.
- Repeated props are instanced: one `InstancedMesh` per model per material. Keep a model to roughly 600-1,500 triangles.
- Anything that sits between the camera and the player uses the sightline fade (`fade.apply(material)` in `world.js`).
- Record every model here with its source and licence.

## Quaternius Stylized Nature MegaKit (CC0)
Source: https://quaternius.com/packs/stylizednaturemegakit.html (the free "Standard" version). Licence: CC0 (public domain dedication); credit is
appreciated, not required.

| Game id | Source model | Used for | Height | Triangles | Trunk radius |
|---|---|---|---|---|---|
| `pine.1` | Pine_1 | Alder Woods: cuttable pines and decor | 7.0 m | 1,353 | 0.22 m |
| `pine.2` | Pine_3 | same | 7.6 m | 800 | 0.25 m |
| `pine.3` | Pine_5 | same | 6.6 m | 1,300 | 0.31 m |
| `broadleaf.1` | CommonTree_1 | Oak Farms and the city's edges: decor | 6.4 m | 1,216 | 0.44 m |
| `broadleaf.2` | CommonTree_3 | same | 7.4 m | 1,189 | 0.47 m |

Not in the Standard pack: logs, stumps. Ground logs and stumps are the game's own cylinders, textured with the pack's bark.
Also in the pack and not used yet: 5 more pines are not there (Pine_2 and Pine_4 exist), CommonTree_2/4/5, DeadTree_1-5, TwistedTree_1-5, bushes,
ferns, flowers, grass, mushrooms, pebbles, rocks, path rocks.

### Rebuilding
`TOOL_DIR=<folder with node_modules containing meshoptimizer and sharp> node scripts/build-assets.mjs "<folder with the pack's .gltf, .bin and .png files>"`
rewrites `dist/nature-assets.js`. The script keeps a share of the leaf cards and enlarges the rest (so the canopy keeps its volume), simplifies the
bark to what is left of the triangle budget, rescales each finished tree to its exact height and measures the trunk radius for collisions. The
pack itself is not stored in the repository.

## Single-mesh props (converted by `scripts/build-props.mjs` into `dist/props-assets.js`)
| Game id | Source file | Used for | Size | Triangles | Licence |
|---|---|---|---|---|---|
| `farmyard` (not shipped) | `LowPOlyFarm_buildings.glb` (a farmyard diorama; exported with pygltflib) | was the farmstead; replaced by a placeholder because it looked too rough in the game | 40 x 44 m | 15,021 | **Unknown source and licence** |

The Tripo sawmill (`sawmill.glb`, 4,333 triangles) was **removed in 0.33** and replaced by the rigged model below; its credit went with it. The farmyard is one fused mesh with one colour texture, so their parts cannot be moved, opened or animated separately (the saw blade cannot spin). The converter cuts the
farmyard's ground and base plate away, centres each prop with the ground at y = 0, scales it to a width, simplifies it, shrinks the colour texture to 1024 px and derives
collision boxes from the walls (cells at least 2 m high for the farmyard, 1.5 m for the sawmill). The originals are not stored in the repository: rebuild with
`TOOL_DIR=<folder with meshoptimizer and sharp> node scripts/build-props.mjs "<folder holding the two .glb files>"`.

## Kenney City Kit (Suburban): three houses in Cedar Heights (0.27.0)
CC0 1.0 (https://kenney.nl/assets/city-kit-suburban). Converted by `scripts/build-props.mjs` at **8 metres per model unit** (`SCALE_HOUSE`): a front door comes out about 2 m high, checked against the avatar in the game. The converter keeps every triangle and
shrinks the shared palette texture to a 128 px nearest-neighbour PNG (about 3 KB). Used: `building-type-a` (1,174 triangles, 10.4 x 8.2 m, one storey) on R1, `building-type-e` (1,731 triangles, 10.4 x 8.2 m, two storeys, 9.1 m) on R2, `building-type-h` (770 triangles, 10.4 x 7.3 m) on R3;
about 3,700 triangles in all. Rebuild: `TOOL_DIR=<tools> node scripts/build-props.mjs "<folder with sawmill.glb>" "<Kenney GLB format folder>"`.

## Received but not imported yet
- **Kenney City Kit (Suburban)**, the rest: 18 more houses (800-2,060 triangles each), 9 fence pieces, a planter, two tiny trees, driveway and path tiles, all on the same palette texture. Candidates for more houses (building types b, c, d, f, j, n, o and others), driveways and fences once Cedar Heights grows.

## Received since 0.28.1, not imported yet (all from Poly Pizza, Kenney and Quaternius; the project is personal and not for sale)
Licence notes: Kenney and Quaternius packs are CC0. The user states everything below is free to use. The two **CC-BY 3.0** pieces need credit in the game's Credits screen (to be built with the import pass). The real-brand cars are kept for a late-game premium tier and flagged so they can be swapped out if the project's plans ever change.

| Asset | Source and licence | Size | Notes |
|---|---|---|---|
| Kenney Furniture Kit (117 GLB) | Kenney, CC0 | 41,000 triangles in all, 352 on average | 2 m per unit; stairs, kitchen set, walls with doorways and windows, beds, sofas, desk, TV, computer, shower, washer, shelves, boxes |
| Ultimate House Interior Pack (82 GLB, about 40 unique) | Quaternius, CC0 | 90-1,700 triangles | 0.5 m per unit; smoother style, see the art direction in DESIGN.md |
| Kenney City Kit (Commercial) | Kenney, CC0 | 18 buildings of 1,100-5,200 triangles, 4 skyscrapers | 8 m per unit like the houses; for Alder Center |
| Cars Bundle (7 GLB: Car, Car-unqq, SUV, Taxi, Police Car, two Sports Cars) | Quaternius, public domain | 2,950-3,300 triangles each | heavier than expected: simplify to about 1,200 each (meshopt, like the sawmill) before they appear in numbers; four are also in the City Pack |
| City Pack (36 GLB) | Poly Pizza, various authors | cars 1,700-14,800; Town House 41,780; Hospital 12,576 | real-brand cars (Nissan GTR, Dodge Challenger, 180MX, L200, a supercar) are late-game premium; simplify before use; skyscraper is the Empire State Building; characters have their own rigs |
| Hut | Quaternius, CC0 | 632 triangles | open timber shelter; sawmill shed, bus shelter, market stall |
| Store | Poly Pizza | 528 triangles | small shop front for C1 or C2 |
| Wood Log; Log & Axe | Poly Pizza | 202; 1,096 triangles | world log; timber-yard decor |
| Desk (Kenney); Closet (Quaternius) | Poly Pizza | 352; 2,988 triangles | the closet opens the character creator later; simplify |
| Kitchen (Poly by Google) | Poly Pizza, **CC-BY 3.0** | 1,012 triangles | an L-shaped counter unit; units are huge, scale needed |
| Flat Screen TV (Alex Safayan) | Poly Pizza, **CC-BY 3.0** | 224 triangles | panel without a stand |
| POS Machine (J-Toastie) | Poly Pizza | FBX, 32 KB | needs one-time conversion to GLB; the register for store jobs (DESIGN.md) |
| sawmill.glb | Tripo v1, edited in Blender by the user | 4,333 triangles (in the game) | personal project |

## Received after the Furniture Kit upload (not imported yet; the user states all are free to use)
| Asset | Source | Size | Notes |
|---|---|---|---|
| Farm Buildings Bundle (10 GLB) | Quaternius via Poly Pizza | 188-7,827 triangles | barns, silos, coop, windmill, fences; no farmhouse |
| Farm Animal Pack (7 GLB) | Quaternius via Poly Pizza | 562-1,354 triangles | skinned, 2-6 animation clips, centimetre units |
| Ultimate Crops (102 FBX) | Quaternius | 61,600 triangles in all | FBX: one-time conversion to GLB; stages 1-4, Crop, Harvested |
| Ultimate Food Pack (50 GLB) | Quaternius via Poly Pizza | 23,600 triangles in all | store products, fridge contents, produce |
| Axe (Quaternius); Axe (CreativeTrio) | Poly Pizza | 236; 256 triangles | the Steel Axe and the first Axe |
| Hand Saw (CreativeTrio, two copies) | Poly Pizza | 616 triangles | bucking logs |
| Saw Blade (Quaternius) | Poly Pizza | 1,240 triangles | the sawmill's spinning blade |
| Power Drill (J-Toastie) | Poly Pizza | 1,253 triangles | the Handyman skill's tool |
| Chainsaw01 (SKU0374, "Petrol Chainsaw Free") | free model, nested archive (glTF + TGA textures) | 2,647 triangles | the **high-end** chainsaw; textures are TGA, to be converted |
| Gas Can (Quaternius) | Poly Pizza | FBX, 788 triangles | fuel item |
| Shopping cart (Poly by Google) | Poly Pizza, presumed **CC-BY 3.0** | 2,868 triangles | store; credit needed; at most 6 on screen |
| Van | free model, glTF + one JPEG texture | 952 triangles | delivery and restock job |
| Jeep (Alex Safayan) | Poly Pizza, presumed **CC-BY 3.0** | 8,022 triangles | simplify to about 2,500; credit needed |
| High-end axe (AXE.fbx, a RAR archive) | free model | 128 triangles, normal, specular and displacement maps | the Lumberjack Axe; unpacked with a JavaScript unrar |
| Flatbed truck (FBX) | SpawnCamp Games, itch.io (credit them) | 13,024 triangles, 12 materials | simplify to about 3,500; the timber haul |
Still missing: the low-end green chainsaw (Sketchfab), the Bus, a farmhouse and a chicken.

## Shipped in 0.29.0 (converted into props-assets.js from `assets-src/`; every one has a credit in credits.js)
Kenney City Kit (Suburban) houses a, c, e, h, j, l, o, r, t; Kenney City Kit (Commercial) buildings e, i, l; Store (Poly Pizza); Quaternius farm buildings Barn, Small Barn, Open Barn, Silo House, ChickenCoop, Tower Windmill; Hut (Quaternius); Wood Log (Poly Pizza);
Quaternius cars Car, SUV, Sports Car, Police Car (about 2,800-3,100 triangles each, wheels kept: the first conversion simplified them to 1,200 and lost the tyres); Pickup (FBX, 8,655 to 4,442 triangles, painted farm red by the converter because the file has no colours); Flatbed truck (SpawnCamp Games, FBX, 13,024 to 3,024 triangles); the Tripo sawmill. Everything else received is still only in `assets-src/` (the unused Kenney
houses and commercial buildings, the Furniture Kit, the interior pack, crops, animals, food, tools, chainsaws, the remaining vehicles, the City Pack) waiting for its feature.
## assets-src/
The originals the game is built from, kept outside the repo's `dist/`: download the archive that comes with each release, unpack it into the project as `assets-src/`, and run `scripts/build-props.mjs` to rebuild `dist/props-assets.js`. The big Quaternius nature and character packs are not in it
(they are converted by `scripts/build-assets.mjs` and `scripts/build-characters.mjs`; download them again from quaternius.com if you need to rebuild those).

## Added in 0.30.0
The Kenney Furniture Kit (CC0) pieces now shipped as interior furniture: Bed Double, Bed Single, Lounge Sofa, Table Coffee, Table, Chair, Television, Cabinet Television, Bookcase Open, Bookcase Closed Doors (the wardrobe), Desk, Chair Desk, Kitchen Cabinet, Kitchen Sink, Kitchen Stove, Kitchen Fridge Large, Toilet, Bathtub,
Bathroom Sink, Lamp Round Floor, Rug Rectangle, Potted Plant, Stairs, Side Table (24 pieces, 41,000 triangles in the whole kit, about 9,500 in these), at 2 m per model unit, plain colours baked to vertex colours. They face -z (a piece with yaw 0 looks north). The rest of the kit and the Quaternius interior pack are for 0.31.

## Added in 0.31.0
Shipped: six more Kenney commercial buildings (a, c, d, f, g, h), the Store recoloured (slate, teal and warmer greys), and three more Quaternius cars (Taxi, Car-unqq, a second Sports Car). Received and kept in `assets-src/kenney_city-kit-industrial_2.0/` (trimmed to `Models/GLB format/` with its `Textures/colormap.png`, the colour-variant textures and License.txt; the FBX and OBJ copies and previews were deleted), not yet used (for Eastbank Works, 0.33): Kenney City Kit (Industrial), CC0 (its License.txt is in the folder): 20 buildings
(700-2,400 triangles, 7-20 m wide at 8 m per model unit), 4 chimneys, 2 tanks, 3 shipping containers, 5 solar panels, a water tower and 2 windmills.

## Added in 0.32.0
`dist/assets/menu-background.jpg` (1672 x 941, 153 KB, JPEG quality 82) is the main menu's background: a low-poly lumberjack carrying a log along a dirt road to a sawmill, supplied by the user. The original PNG (1.6 MB) is `assets-src/menu/menu-background.png`. **Source and licence: not stated**; the user supplied it for this project. Confirm before any public release. It is a plain CSS background on `#welcome` (an inline style in `index.html`, so the path does not depend on the release folder); it is not a model, so `credits.js` has no entry for it.
## Changed after 0.32.0's first playtest
- **Street trees** now use the Stylized Nature MegaKit broadleaf models (`broadleaf.1`, `broadleaf.2`, CC0, already credited), at 0.85 scale: the town's 13 and Oak Street's 11.
- **Parked cars on Oak Street** are the converted `taxi`, `sports-car-2` and `suv` models (Quaternius cars, public domain, already credited).
- **Flatbed truck wheels** are plain generated cylinders (`vehicle-parts.js`), not from any asset: the converted truck has none. Nothing to credit; replace them if the truck is converted again with its wheels.

## Rigged models (0.33, in progress): `dist/rigged-assets.js`
Converted by `scripts/build-props.mjs` (the `RIGGED` table) through `scripts/rigged-glb.mjs`; no `TOOL_DIR` needed. Rebuild: `node scripts/build-props.mjs assets-src sawmill-v4`. The module holds each model as a base64 GLB (loaded with the vendored `GLTFLoader`, like the characters) plus anchors, per-node bounds and clip lengths.

| Game id | Source file | Used for | Draw calls | Triangles | Licence |
|---|---|---|---|---|---|
| `sawmill-v4` | `assets/Sawmillv4.glb` (Blender 5.2 export), spec in `assets-src/assets/sawmill_spec.md` | the Sawmill in Pine Ridge (landmark `sawmill`, placed at the old sawmill's position, yaw -90 degrees) | 92 -> 28 | 1,680 | **Own work** of the project owner; credited in `credits.js` as "The project owner" |

What the converter keeps: every node that is animated, a bone, skinned or an anchor (names, hierarchy and transforms exactly as exported), both skins, all 5 animations sample for sample, all 14 materials with their emissive colours and `KHR_materials_emissive_strength`. What it changes: the 65 static meshes (posts, beams, roof, bench, pile logs, beacon housing and lenses...) are baked into root space and merged into one mesh per material (`Static_<Material>`), so their node names are gone; their bounds are kept in `bounds` for colliders and floors. What it drops: nothing that is drawn (triangle count is unchanged); it refuses (throws) on texture coordinates, vertex colours, tangents, morph targets and sparse accessors, none of which the file has.
Facts found in the file that differ from `sawmill_spec.md`: `BladeSpin` and `BeltRun` have 25 keys that start at t = 1/24 (not 0) and end at 25/24, the last key repeating the first pose, so the true loop is 1.0 s (24 keys); the blade and the log are two-material meshes, so they load as groups (`Blade_Mesh` holds `Blade_1` and `Blade_2`, both skinned: three skinned nodes, four skinned draws); the whole prop spans x -7.74..8.29 and z -3.72..3.72 (the log pile and the roof overhangs), not -4.6..8.2 by +-3.3. Everything else in the spec's tables (anchors, deck and bench heights, clip lengths, rest state) matches.
Placement (0.33): the landmark keeps the old sawmill's map position (104, -278); the model's root (the main deck's centre) is that point. The footprint used for tree clearing, the minimap and overlap checks is the full bounds (x -7.74..8.29, z -3.72..3.72 in model coordinates). Colliders come from the converter's bounds table (`dist/rigged-props.js`): ten posts, the bench (one block; the blade slot is 8 cm), the conveyor (one solid block, frame and rollers, 0.8 m high) and the log pile. Floors: the main deck (0.30 m) and the shed deck (0.20 m); `floorAt` now accepts a list of floors per landmark. Yaw -90 degrees: the model's front (+z: switch, player, log feed side) faces west to the woods lane, the belt-clearing end (local -z) faces east to the yard, the log pile and the bench's feed end are on the open north side, slot 0 (where planks land) is the west end of the belt.
`anchor_plank_pile` and `anchor_plank_out` are leftovers in the model and are ignored (the belt replaces the pile; clearing the belt moves planks into the inventory). No pile is built. If one is wanted later, derive it from `anchor_belt_clear`. (`anchor_plank_pile` lies under the conveyor in the file.)
Switch and blade (0.33): `dist/sawmill.js` (pure switch rules plus a thin AnimationMixer controller). The loop clips `BladeSpin` and `BeltRun` are trimmed **on load** (`trimLoop` in `rigged-props.js`), not in the file: every key is shifted so the first is at t = 0, giving exactly 1.0 s, 24 distinct poses and the closing key (the pose the loop wraps to). The closing key is kept on purpose: dropping it would hold the 24th pose for 1/24 s before wrapping. The one-shot clips (`SwitchOn`, `SwitchOff`, `Cut`) are as exported (first key at 1/24 s). Only the large parts cast shadows (`SHADOW_CASTERS`): 11 shadow draws instead of 28.
Cutting and the belt (0.33): a picked-up log goes on the shoulder (`carry`), not into the bag; E at the bench with the saw on plays `Cut` (the log lifts onto the bench, goes through the blade at about 2 s, four planks slide over the belt and land at 4.17 s), and the stack counts at once (`belt`, 0 to 4). The stack then rides the belt to the end stop at 0.47 m/s (the roller surface speed, so the planks travel with the rollers); `BeltRun` plays only while something moves. A full belt (4 stacks) switches the saw off, refuses logs and lights `Beacon_Red` (`Beacon_Green` goes to emissive 0; the lens materials are separate, so one can go dark alone). E at `anchor_belt_clear` takes the oldest stack (4 planks) into the hands; X puts a carried log or planks down (at most 8 plank stacks on the ground). Planks are drawn from the model's own plank mesh (belt and ground as instances, 1 draw each; carried at 0.55 size). The felled-log node `FeedLog` is hidden between cuts (the file shows it at rest; here it appears when a log is put in).
Sound and sawdust (0.33): no sound files; every sound is generated with Web Audio in `dist/audio.js` (a sawtooth whine and filtered hiss for the blade, a low rumble and hum for the belt, a short click for the lever), so there is nothing to credit. The context starts on the first click or key press, sounds fall off to silence at 40 m, and volume and mute are set in the main menu's Settings (saved separately from the graphics setting). Sawdust (`dist/sawdust.js`): a 300-point pool at `anchor_sawdust`, emitted while the log is in the blade (frames 14 to 47 of `Cut`), one Points object, no shadows, drawn only while a particle is alive.

## Pallets, crates and loading-zone props (0.33, Stage 0): `prop.*` in `dist/props-assets.js`
Eleven models of the project owner's own, from `assets-src/assets/*.glb`; **own work**, credited in `credits.js` under "The project owner". Converted by `scripts/build-props.mjs` (no simplifying, no texture): `scale: 1` (the files are already 1 unit = 1 m with the origin on the ground at the base centre, so **nothing is rescaled and the 1-unit rule needs no exception**), plain material colours baked to vertex colours, one mesh and one draw call each. Rebuild just these: `TOOL_DIR=<tools> node scripts/build-props.mjs assets-src prop.pallet,prop.box-small,...` (other props are kept from the existing file). Not placed in the world yet (Stage 2).

| Game id | Source file | Size W x D x H (m) | Triangles | Collider |
|---|---|---|---|---|
| `prop.pallet` | `pallet.glb` | 1.20 x 0.80 x 0.144 | 204 | one box |
| `prop.box-small` | `box-small.glb` | 0.40 x 0.30 x 0.30 | 36 | one box |
| `prop.box-medium` | `box-medium.glb` | 0.60 x 0.40 x 0.40 | 36 | one box |
| `prop.crate-large` | `crate-large.glb` | 1.03 x 0.83 x 0.80 (frame included) | 264 | one box |
| `prop.pallet-small-boxes` | `pallet-small-boxes.glb` | 1.20 x 0.80 x 0.743 | 636 | one box |
| `prop.pallet-medium-boxes` | `pallet-medium-boxes.glb` | 1.20 x 0.80 x 0.943 | 492 | one box |
| `prop.pallet-crate` | `pallet-crate.glb` | 1.20 x 0.83 x 0.944 | 468 | one box |
| `prop.zone-bollard` | `zone-bollard.glb` | 0.30 x 0.30 x 0.865 | 236 | one box |
| `prop.zone-sign-unload` | `zone-sign-unload.glb` | 0.92 x 0.30 x 2.30 | 108 | the post only (0.08 x 0.08) |
| `prop.zone-sign-pickup` | `zone-sign-pickup.glb` | 0.92 x 0.30 x 2.30 | 108 | the post only |
| `prop.dock-plate` | `dock-plate.glb` | 2.00 x 1.38 x 0.062 | 212 | none (walk-over plate) |

All eleven together: 2,800 triangles, 11 draw calls at most (one per model). Facts worth knowing: the crate (1.03 x 0.83) and the pallet-crate (0.83 deep) are 3 cm larger than the nominal 1.0 x 0.8 because of the crate frame; the dock plate keeps the file's origin (converter flag `keepOrigin`, used for it alone): its footprint is z -0.60..+0.78. Its geometry (read from the vertices, 0.33 Stage 2): a steel lip at local z -0.60 (0.05 m high), a flat top 0.062 m high, and a bevel down to the ground at the +z end with a yellow hazard stripe, so the **lip goes against the dock wall and the ramp end faces the truck**; the origin itself (z 0) is 0.6 m out from the lip. Every other prop is centred on its footprint. (An earlier note here called the origin the hinge edge: wrong.) New converter option `collide.fit`: one exact box around what stands in the height band (the grid cells overshoot a small prop by up to a cell). Repeated props: `createPropInstances(id, spots, fade)` in `props.js` returns one `InstancedMesh` per model however many spots (500 pallets = 1 draw call, 102,000 triangles); instances are not frustum-culled (they are scattered) and do not cast shadows unless asked, so a yard should be built in chunks that are shown or hidden by distance.
## Gas-station props (0.33): `prop.fuel-pump`, `-diesel`, `prop.fuel-nozzle`, `-diesel`, `prop.pump-island`, `prop.forecourt-canopy`
Six more models of the project owner's own (own work, credited under "The project owner"), converted like the pallets (scale 1, vertex colours, no simplifying) but with **the file origin kept** (`keepOrigin`; the nozzles use `'xyz'`, which keeps y too: their origin is the grip centre). Not placed in the world. Static, 1 unit = 1 m, one draw call each (the canopy two, see below).

| Game id | Source | Size W x D x H (m) | Triangles | Collider | Anchors |
|---|---|---|---|---|---|
| `prop.fuel-pump` (petrol, red) | `fuel-pump.glb` | 0.64 x 0.46 x 1.73 | 252 | one exact box (0.64 x 0.46) | 6 |
| `prop.fuel-pump-diesel` (yellow) | `fuel-pump-diesel.glb` | 0.64 x 0.46 x 1.73 | 252 | one exact box | 6 |
| `prop.fuel-nozzle` (green band) | `fuel-nozzle.glb` | 0.05 x 0.53, y -0.135..0.032 | 84 | none (held) | 0 |
| `prop.fuel-nozzle-diesel` (yellow band) | `fuel-nozzle-diesel.glb` | same | 84 | none | 0 |
| `prop.pump-island` | `pump-island.glb` | 3.40 x 1.20 x 1.91 | 672 | one exact box (the whole island) | 12 |
| `prop.forecourt-canopy` | `forecourt-canopy.glb` | 12.08 x 9.14 x 5.59 | 456 | none (see below) | 0 |

Anchors: the converter reads every node named `anchor_*` (its world position in the file, converted like the mesh: scale, origin kept) into `propInfo(id).anchors = {name: [x, y, z]}`. **Blender's duplicate suffix is dropped**: the island's petrol-pump anchors were exported as `anchor_use_py_0.002` etc. (the model's names should be `_0`; they are now). Axes: Blender +Y is game **-z**, Blender -Y is +z, so `py` anchors (the "+Y face") are at z < 0 and `ny` at z > 0, the nozzle spout (Blender -Y) points to +z. Single pump: holsters at (+0.14, 0.95, -+0.235), hose outlets at (+0.24, 0.30, -+0.22), use spots at (0, 0, -+1.3). Island: the same, petrol pump 0 at x = -0.8, diesel pump 1 at x = +0.8, 0.18 m higher (the kerb: holsters 1.13, hose outlets 0.48), use spots at (-+0.8, 0, -+1.3).
Emissive: the canopy's `Canopy_Light` (six panels, 72 triangles, emissive colour (1, 0.93, 0.72), strength 2.0 from `KHR_materials_emissive_strength`) survives as `record.glow = {from, count, color, strength}`: the lit triangles are sorted last and `propGeometry` adds two material groups, so `createProp` / `createPropInstances` give a material array [flat-colour body, emissive light]. The light always glows (it is not tied to the day/night cycle yet).
Canopy collision: no automatic box; the map must add four 0.8 x 0.8 m boxes at (+-5.0, +-3.2) from the canopy origin, up to 4.75 m (the four steel columns stand on footings of that size: read from the vertices). Differences from the supplied facts: the pump is 0.46 m deep (not 0.44); the canopy is 12.08 x 9.14 with its trim (roof 12.0 x 9.0 nominal); the file's y of the nozzle runs -0.135 to 0.032 (grip centre at 0). Everything else (triangle counts, heights, anchor counts, anchor positions, emissive strength) is as stated.
Rebuild just these: `TOOL_DIR=<tools> node scripts/build-props.mjs assets-src prop.fuel-pump,prop.fuel-pump-diesel,prop.fuel-nozzle,prop.fuel-nozzle-diesel,prop.pump-island,prop.forecourt-canopy`.

## Kenney City Kit (Industrial) pieces in the game (0.33, Stage 2)
CC0 (the kit's License.txt is in `assets-src/kenney_city-kit-industrial_2.0/`), credited in `credits.js` under Kenney. Converted by `scripts/build-props.mjs` at **8 m per model unit**, the kit's one palette texture shrunk to a 128 px PNG (the Suburban and Commercial kits' route), every triangle kept, solid blocks (`walls: false`). None has an interior, so all four buildings are `enterable: false` in the registry with a reason. **Each building has its big doors on the model's -z side; the converter turns the four buildings 180 degrees (`turn: 180`) so they face +z like every other building**, and a plot's yaw then puts the doors on the yard.

| Game id | Source | Used for | Size W x D x H (m) | Triangles | Doors (seen from the front) |
|---|---|---|---|---|---|
| `industrial-q` | `building-q.glb` | the warehouse (plot I1) | 17.1 x 14.2 x 7.0 | 2,062 | a ground-level garage opening 3.7 x 2.15 m, 1.2 m right of the centre (recorded as the prop's `door`); a covered man-door 6.8 m left of the centre |
| `industrial-t` | `building-t.glb` | the vehicle workshop (I4) | 13.8 x 11.1 x 8.1 | 1,586 | a glass double entrance with planters; a window |
| `industrial-s` | `building-s.glb` | the building supplier (I3) | 17.0 x 7.3 x 6.7 | 876 | four orange roll-up doors and a man-door |
| `industrial-p` | `building-p.glb` | the gas kiosk (I2) | 13.5 x 7.9 x 5.7 | 1,162 | a man-door and two roll-up doors, planters |
| `container-a`, `-b`, `-c` | `shipping-container-a/b/c.glb` | the freight yard (instanced) | 3.0 x 6.6 x 2.8 | 402 each | orange, blue and green |
| `tank-small` | `detail-tank.glb` | decor behind the workshop | 6.8 x 4.1 x 3.3 | 310 | |

Not used (kept in `assets-src`): the other 16 buildings, the large tank, chimneys, solar panels, the water tower, windmills. The raw bounds in the GLB accessors are wrong for the containers and the tank (node transforms): the converted sizes above are the true ones. Rebuild just these: `TOOL_DIR=<tools> node scripts/build-props.mjs assets-src industrial-q,industrial-t,industrial-s,industrial-p,container-a,container-b,container-c,tank-small`. (The fuel pumps and the forecourt canopy are the user's own models: see the gas-station section above.)
## Worktruck (0.33): `worktruck` in `dist/props-assets.js`, drivable
Sketchfab "Pickup Truck" by 00amza, **CC-BY-4.0** (author must be credited: `credits.js`), from `assets-src/Veichles/green_pickup/` (glTF + a 12 MB PNG texture, shrunk to 512 px JPEG). 5,047 triangles, 2.17 x 6.0 x 2.6 m, +z front, four separate wheel meshes (converter option `splitWheels`; `record.wheels = [{at, radius, width, front, ...}]`). The Spawn Camp flatbed (`vehicles/Flatbed.fbx`) and its generated wheels were removed in 0.33.

## Pevrolet Off Road Pickup (0.33): `offroad`, drivable
Sketchfab "Low poly Pickup truck v3" by Aditya Graphical, **CC-BY-4.0** (credited in `credits.js`), from `assets-src/Veichles/low_poly_pickup_truck_v3/`. Body texture 512 px JPEG with the lights' texture painted as a patch (`patchPlain`), four split wheels, `turn: 180`. The old red pickup's wheels were split in place with `scripts/split-wheels.mjs` (the FBX is gone from the repo).

The red CGTrader pickup (ehicles/Pickup.fbx) was removed in 0.33; its credit and converter entry went with it.

## Gas can (0.35): `prop.fuel-can`
The project owner's FBX (`assets-src/fuel_can/fuel_can.fbx`, centimetres, upright 0.50 m, 1,162 triangles) with its Albedo texture only (256 px JPEG, the AO, metallic, normal and roughness maps are not used). Authorship and licence still to be confirmed (credited as own work for now). No collider (a held and bagged item). Rebuild: `TOOL_DIR=<tools> node scripts/build-props.mjs assets-src prop.fuel-can`.

## Axes (0.35, user-supplied, in assets-src/Tools/)
| Model | Author | Triangles | Use |
|---|---|---|---|
| Simple_axe by Poly by Google.glb | Poly by Google via Poly Pizza (licence presumed CC-BY 3.0, to confirm) | 600 | the starter Axe (replaces the primitive) |
| Logging_Axe by CreativeTrio.glb | CreativeTrio via Poly Pizza (presumed CC0, to confirm) | 256, one texture sampled into vertex colours | the Logging Axe (tier 2) |
| Steel_Axe by Quaternius.glb | Quaternius via Poly Pizza (CC0) | 236 | the Steel Axe (tier 3) |
Converted by 
ode scripts/build-axes.mjs into dist/axe-assets.js (about 87 KB): handle along +z, head at the far end, edge down, no textures at run time.

## Chainsaws (0.35, user-supplied, in assets-src/Tools/)
| Model | Author | Triangles | Use |
|---|---|---|---|
| Chainsaw/Animated Chainsaw  Low-Poly Version_2.8x.glb | not recorded (to confirm) | 13,230 (the chain mesh, 8,362, is not used) | the Chainsaw (tier 1) |
| Logging_Chainsaw.gltf (Chainsaw01, SKU0374 Petrol Chainsaw Free) | not recorded (to confirm) | 2,647 (the alpha plane is not used) | the Logging Chainsaw (tier 2) |
Converted by 
ode scripts/build-saws.mjs into dist/saw-assets.js: bar forward along +z, up +y, rear grip near the origin, no textures at run time.

## Tylan Flatbed (0.35, the project owner's own model)
assets-src/Veichles/Logging Truck/flatbed.glb (FLATBED_SPEC_UPDATE_2.md): 5,796 triangles, 13 colour-only materials, separate wheels, steering pivots and a hinged tailgate, 19 anchors. Converted by `node scripts/build-flatbed.mjs` into `dist/flatbed-assets.js` (about 430 KB; nine parts with vertex colours) and built by `dist/flatbed.js` (9 draw calls per flatbed). The detail meshes are not hidden by distance yet.

- **Forklift (0.35 step 5):** "48-forklift" (assets-src/Veichles/Forklifts/48-forklift/Forklift.obj, public domain, author and source page to be confirmed) converted by scripts/build-forklift.mjs into dist/forklift-assets.js (about 14,000 triangles, 550 KB, three parts: body, mast, carriage; colours chosen in the script because the OBJ has none). Loaded only when the warehouse is first entered. Not used: the CC-BY Forklift Truck (Kray Ewan) and the Industrial Forklift GLB (one lump, forks not separate).

## Kasumuchi S70 shortbed truck (0.35.8, the project owner's own model)
assets-src/Vehicles/Kasumuchi S70/Kasumuchi S70 - V7 Game.glb (spec: Kasumuchi S70 - V6 Spec Sheet.md, changes in Kasumuchi S70 - V7 Spec Notes.md; V7 is V6 with the cab raised 0.21 m, made by kasumuchi_s70_v7_raise_cab.py in the same folder in headless Blender 5.2; the V6 files are kept untouched): 6,994 triangles (7,758 with the interior), 11 colour-only materials, 51 nodes, 18 anchors, six door and gate clips (not used at run time: the doors are driven by code). **Licence: own work, no credit line** (credits.js lists it under the project owner). Converted by `node scripts/build-shortbed.mjs` into `dist/shortbed-assets.js` (16 parts with vertex colours) and built by `dist/shortbed.js` (16 draw calls per truck: the door windows are their own glass parts sharing the body glass material, plus one interior part; 11 source materials become 5 in game). **Interior (added 0.35.8):** assets-src/Vehicles/Kasumuchi S70/Kasumuchi S70 - V7 Interior.glb (V6 Interior.glb with every vertex held inside the cab shell), built in headless Blender 5.2 for this project (dashboard, instrument binnacle, centre console and gear lever, two seats with headrests, pedals; 764 triangles, flat Truck_* palette colours, no textures), merged into the one `interior` part. **Licence: own work, no credit line.** The "KASUMUCHI" lettering in the game GLB faces backwards (the glb is double-sided; the game is not), so the converter turns those 39 triangles round. The tailgate is part of the static body (it stays closed). The glb's raw bounding box shows y -0.577 only because the door meshes are stored in their door pivot's frame (pivot at y 1.35); the truck's real extent is y 0.005 to 2.41 (V7; V6 was 2.2). **V7 (0.35.8):** the roof, pillars, windscreen, door windows and door tops are 0.21 m higher so the 1.95 m player sits under the roof with about 0.13 m to spare (the mirrors, floor, wheels, chassis, bed and every pivot, anchor and clip are unchanged); the interior no longer pokes through the door skins and the rounded front corners; the left half of the headlight, taillight and indicator lenses was inside out (not drawn by the game) and is fixed.

## Water cooler (0.35)
The project owner's own Blender model (ssets-src/assets/city_life_watercooler/water-cooler.glb, 3,886 triangles, flat colours, a see-through bottle with water). Embedded as base64 by 
ode scripts/build-water-cooler.mjs into dist/water-cooler-asset.js (255 KB) and loaded with GLTFLoader by dist/water-cooler-view.js; one in the Ridgeline office, one in the warehouse. Static: the spec's water-motion module and the anchors are not used yet.

## Vehicle damage textures (VD3, 0.35.10, generated here)
Two small textures made with headless Blender 5.2 by `scripts/make-damage-textures.py` (run by `node scripts/build-damage-textures.mjs`, seeded: the same files every run) and embedded as PNG data URIs in `dist/damage-textures.js` (about 44 KB of text): `wear` (128 px, tileable, 20 KB PNG: R scratches, G grime, B paint chips) shown on the paint of every drivable vehicle by the `uWear` uniform, and `crack` (256 px grey, 13 KB PNG: one spider-web impact) shown on the glass of the S70 and the flatbed by `uCrack` (the worktruck and the off-road pickup have their glass baked into the body texture: no crack). Licence: **Own work** (generated by the project, no credit line, no outside source). GPU memory about 87 KB with mipmaps (128 x 128 x 4 x 1.33 plus 256 x 256 x 4 x 1.33).

## Vehicle, crash and yell sounds (SND1, recorded, all CC0)
Found 2026-11-14 for the user's request for real vehicle sounds, damage sounds and NPC yells. Every file below is **CC0 1.0 (public domain dedication)**: no credit is required, but the author and page are recorded so it can be given. Licence checked on each page on 2026-11-14 (Freesound shows 'Creative Commons 0'; OpenGameArt shows 'License(s): CC0'; the Kenney pack and the scrapes pack carry their own CC0 text). Sources rejected on purpose: anything CC-BY, OGA-BY, non-commercial or no-derivatives (for example the OpenGameArt 'male grunt/yelling' pack is OGA-BY, and the 'racing car engine sound loops' are only 0.6 s long with audible seams).
Freesound downloads need a login, so the **high-quality Ogg preview** of each Freesound sound (cdn.freesound.org/previews/..-hq.ogg, a lossy copy of the same CC0 sound) was used. All downloads were treated as data (never run), trimmed and converted with Blender 5.2's ud module and numpy (no ffmpeg on this machine): mono Ogg Vorbis about 48 kbps, 22.05 kHz for engines and thuds and 32 kHz for the rest, DC removed, cross-faded where it loops, then normalised. Loops are seamless by cross-fade; they were checked by numbers only (nobody has listened yet). dist/vehicle-sounds.js is the registry and rules; dist/audio.js plays them and keeps the generated sounds as the fallback if a file is missing. Files are in dist/assets/sounds/ (served next to the game, not inside the release folder, like water_drink.wav).

| File | Source | Author | Edit |
|---|---|---|---|
| `eng-s70.ogg` | Freesound 369053 "car_idle_loop.wav" (Honda CRV idle, interior) | AndrewAlexander (https://freesound.org/people/AndrewAlexander/sounds/369053/) | 2.0 to 8.4 s, mono, 22.05 kHz, 0.4 s cross-fade loop, normalised to -20 dBFS rms |
| `eng-worktruck.ogg` | Freesound 186935 "engine_idle_loop.wav" (truck/diesel idle loop; made from Freesound 57939 by joanfelipsound, also CC0) | ReadeOnly (https://freesound.org/people/ReadeOnly/sounds/186935/) | 0.2 to 5.7 s, mono, 22.05 kHz, 0.35 s cross-fade, -20 dBFS rms |
| `eng-offroad.ogg` | Freesound 610773 "F150-Startup-idle.m4a" (Ford F150 4.6 V8 idle) | Therancher01 (https://freesound.org/people/Therancher01/sounds/610773/) | 8.0 to 14.4 s of the idle, mono, 22.05 kHz, 0.4 s cross-fade, -20 dBFS rms |
| `eng-flatbed.ogg` | Freesound 435656 "FORD LTL 9000_engine start and idle.wav" (1980s diesel semi tractor) | YellowJacketStudios (https://freesound.org/people/YellowJacketStudios/sounds/435656/) | 30.0 to 36.4 s of the idle (after the door slam), mono, 22.05 kHz, 0.4 s cross-fade, -20 dBFS rms |
| `start-crank.ogg` | Freesound 687447 "cranks-but-not-start.mp3" | drdeath666 (https://freesound.org/people/drdeath666/sounds/687447/) | 4.3 to 6.1 s (one steady cranking burst), 0.15 s cross-fade loop, peak -6 dBFS; looped for as long as the starter turns |
| `stall.ogg` | Freesound 451666 "school bus truck ext idle engine close shut off.flac" | kyles (https://freesound.org/people/kyles/sounds/451666/) | 12.2 to 13.9 s (the engine cutting out), 0.2 s fade, peak -6 dBFS |
| `crash-hard-1.ogg` | Freesound 237375 "Car Crash" | squareal (https://freesound.org/people/squareal/sounds/237375/) | 0.30 to 2.0 s, peak -2 dBFS |
| `crash-hard-2.ogg` | Freesound 420356 "Crash.wav" | CogFireStudios (https://freesound.org/people/CogFireStudios/sounds/420356/) | 0 to 1.7 s, peak -2 dBFS |
| `crash-hard-3.ogg` | Freesound 592388 "Car Crash (with Glass)" | magnuswaker (https://freesound.org/people/magnuswaker/sounds/592388/) | 0.15 to 1.9 s, peak -2 dBFS (it has glass in it) |
| `crash-hard-4.ogg` | Freesound 726486 "Impact on metal" | JoMungus (https://freesound.org/people/JoMungus/sounds/726486/) | 0 to 1.6 s, peak -2 dBFS (a low, heavy metal hit) |
| `crash-medium-1.ogg` | Freesound 807438 "car crash short 1" | Logicogonist (https://freesound.org/people/Logicogonist/sounds/807438/) | 0 to 0.6 s, peak -4 dBFS |
| `crash-medium-2.ogg` | Freesound 545692 "crash" | Feed_ (https://freesound.org/people/Feed_/sounds/545692/) | 0 to 0.58 s, peak -4 dBFS |
| `crash-medium-3.ogg` | Freesound 151624 "Clank Car Crash Collision" | qubodup (https://freesound.org/people/qubodup/sounds/151624/) | 0 to 0.54 s, peak -4 dBFS |
| `crash-medium-4.ogg` | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx (rubberduck) file bfh1_metal_hit_02 | rubberduck | 0 to 0.55 s, peak -4 dBFS |
| `crash-light-1.ogg` | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx (rubberduck) file bfh1_metal_hit_05 | rubberduck | 0 to 0.33 s, peak -6 dBFS |
| `crash-light-2.ogg` | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx (rubberduck) file bfh1_hit_06 | rubberduck | 0 to 0.6 s, peak -6 dBFS |
| `crash-light-3.ogg` | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx (rubberduck) file bfh1_hit_08 | rubberduck | 0 to 0.39 s, peak -6 dBFS |
| `crash-light-4.ogg` | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx (rubberduck) file bfh1_metal_hit_04 | rubberduck | 0 to 0.41 s, peak -6 dBFS |
| `thud-person-1.ogg` | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx (rubberduck) file bfh1_hit_02 | rubberduck | 0 to 0.8 s, low-passed at 420 Hz (muffled), peak -4 dBFS |
| `thud-person-2.ogg` | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx (rubberduck) file bfh1_hit_07 | rubberduck | 0 to 0.46 s, low-passed at 500 Hz (muffled), peak -4 dBFS |
| `glass-1.ogg` | Freesound 758207 "Glass panel shattering" | LukaCafuka (https://freesound.org/people/LukaCafuka/sounds/758207/) | 0 to 1.5 s, 0.3 s fade, peak -4 dBFS |
| `glass-2.ogg` | Freesound 221528 "Glass Break" | unfa (https://freesound.org/people/unfa/sounds/221528/) | 0.1 to 1.7 s, 0.3 s fade, peak -4 dBFS |
| `glass-3.ogg` | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx (rubberduck) file bfh1_glass_breaking_06 | rubberduck | 0 to 0.92 s, peak -4 dBFS |
| `glass-4.ogg` | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx (rubberduck) file bfh1_glass_breaking_01 | rubberduck | 0 to 0.76 s, peak -4 dBFS |
| `scrape-1.ogg` | https://opengameart.org/content/scrapes file scrape-4.ogg (an object dragged across a cinder block) | AntumDeluge | 0.1 to 1.4 s, 0.2 s cross-fade loop, -18 dBFS rms (peak limited to -1.5) |
| `scrape-2.ogg` | https://opengameart.org/content/scrapes file scrape-1.ogg | AntumDeluge | 0.05 to 1.1 s, 0.18 s cross-fade loop, -18 dBFS rms |
| `scrape-3.ogg` | https://opengameart.org/content/scrapes file scrape-8.ogg | AntumDeluge | 0.1 to 1.45 s, 0.2 s cross-fade loop, -18 dBFS rms (peak limited to -1.5) |
| `yell-m1.ogg` | https://opengameart.org/content/15-vocal-male-strainhurtpainjump-sounds file slightscream-03.flac (CC0 from 2024-08-30 per the page) | qubodup (Iwan Gabovitch) | 0 to 0.56 s, peak -4 dBFS |
| `yell-m2.ogg` | same pack, file slightscream-06.flac | qubodup (Iwan Gabovitch) | 0 to 0.52 s, peak -4 dBFS |
| `yell-m3.ogg` | https://opengameart.org/content/voiceover-pack-40-lines file Male/war_look_out.ogg ("Look out!") | Kenney (https://kenney.nl); male voice Jeffrey M. Smith | 0 to 0.61 s, peak -4 dBFS |
| `yell-m4.ogg` | same pack, file Male/war_get_down.ogg ("Get down!") | Kenney; male voice Jeffrey M. Smith | 0 to 0.85 s, peak -4 dBFS |
| `yell-f1.ogg` | same pack, file Female/war_look_out.ogg ("Look out!") | Kenney; female voice Giselle | 0 to 0.65 s, peak -4 dBFS |
| `yell-f2.ogg` | same pack, file Female/war_get_down.ogg ("Get down!") | Kenney; female voice Giselle | 0 to 0.62 s, peak -4 dBFS |
| `yell-f3.ogg` | https://opengameart.org/content/female-rpg-voice-starter-pack file Type 1/damaged1.wav (an "ah!") | cicifyre | 0 to 0.29 s, normalised from peak -9 to -4 dBFS |
| `yell-f4.ogg` | Freesound 740310 "Female Gasp" | kanyonwyvern (https://freesound.org/people/kanyonwyvern/sounds/740310/) | 0.7 to 1.7 s, peak -4 dBFS |

Not found as real recordings: a separate high-rpm engine loop per class (only steady idles were free, so the loop is pitched up with the revs), and a 'person hit' thud made for a body (the thuds are generic CC0 impacts, low-passed). The generated engine, crank and stall still run until a class's loop is decoded.

## Phone call sounds (PH1, recorded, all CC0)
Found 2026-11-17 for the phone's Call app. Every file is **CC0 1.0** (Freesound page shows 'Creative Commons 0', checked on 2026-11-17; rejected on purpose: a pick-up click by joedeshon, which is CC-BY). As with SND1, Freesound needs a login, so the high-quality Ogg preview of each sound was used, trimmed and converted with Blender 5.2's aud module and numpy: mono Ogg Vorbis about 48 kbps, 32 kHz, DC removed, short fades, normalised. Loaded lazily by `audio.phone()` (dist/audio.js) the first time the Call app dials; generated tones play until they are decoded or if they fail. Registered in dist/phone-calls.js (PHONE_CLIPS) and vehicle-sounds.js ALL_FILES.

| File | Source | Author | Edit |
|---|---|---|---|
| `phone-key.ogg` | Freesound 178817 "DTMF_dial.mp3" | Felfa (https://freesound.org/people/Felfa/sounds/178817/) | 0.58 to 0.93 s (one key tone), peak -12 dBFS |
| `phone-pickup.ogg` | Freesound 218083 "Phone pick up / hang up" | deraj (https://freesound.org/people/deraj/sounds/218083/) | 0.95 to 1.7 s (the handset lifted), peak -6 dBFS |
| `phone-hangup.ogg` | Freesound 218083 "Phone pick up / hang up" | deraj (https://freesound.org/people/deraj/sounds/218083/) | 3.2 to 4.3 s (the handset put down), peak -6 dBFS |
| `phone-ring.ogg` | Freesound 337655 "Current US/Can. Ringback tone" | tt_runscript (https://freesound.org/people/tt_runscript/sounds/337655/) | 0 to 2.0 s (one ring burst), peak -14 dBFS |
| `phone-busy.ogg` | Freesound 158428 "Busy Signal" | ramicio (https://freesound.org/people/ramicio/sounds/158428/) | 0 to 2.0 s (two beeps and two gaps, loops), peak -14 dBFS |

## Tyre sounds (TR6, recorded, all CC0)
Found 2026-11-17 for the wheel sounds per ground (mono Ogg Vorbis about 48 kbps, 32 kHz, 5.75 s loops, -18 dBFS rms, DC removed, 0.25 s tail-to-head cross-fade so the loop is seamless, band-limited as listed). Every source page shows 'Creative Commons 0' (checked 2026-11-17; rejected: a puddle pass by tim.kahn, CC-BY-NC). Freesound needs a login, so the public high-quality MP3 preview of each sound was used, trimmed and filtered with Blender 5.2's aud module and numpy (windows picked by measurement: steadiest 6 s stretch, not by ear; nobody has listened yet). Loaded lazily by `audio.drive()` (dist/audio.js) the first time that ground is driven on. NOTE: no CC0 recording of a vehicle on grass or in mud was found, so grass and mud are different stretches of the one dirt-road drive (grass: a quiet, soft stretch; mud: the lowest-pitched steady stretch, filtered down to 3 kHz). Replace them when a better CC0 recording turns up.

| File | Source | Author | Edit |
|---|---|---|---|
| `tyres-asphalt.ogg` | Freesound 397115 "Car Driving Interior Perspective" | Kinoton (https://freesound.org/people/Kinoton/sounds/397115/) | 224 to 230 s of the steady 40 to 60 km/h cruise, band 200 Hz to 5 kHz |
| `tyres-gravel.ogg` | Freesound 685230 "Car driving on gravel dirt road, close recording from outside" | felix.blume (https://freesound.org/people/felix.blume/sounds/685230/) | 150 to 156 s, band 300 Hz to 9 kHz (engine rumble cut) |
| `tyres-grass.ogg` | Freesound 668552 "Car driving in exterior, Toyota Landcruiser 4x4, motor, dirt road, gravel, puddle mud" | felix.blume (https://freesound.org/people/felix.blume/sounds/668552/) | 198 to 204 s (the quietest steady stretch), band 150 Hz to 4.5 kHz |
| `tyres-mud.ogg` | Freesound 668552 (same recording) | felix.blume (https://freesound.org/people/felix.blume/sounds/668552/) | 108 to 114 s (lowest-pitched steady stretch), band 120 Hz to 3 kHz |

## Quaternius Farm Buildings Bundle and Farm Animal Pack (farm stage F-import, 2026-11-17, all CC0 1.0)
Sources: https://poly.pizza/bundle/Farm-Buildings-Bundle-ppbnhEfNEt and https://poly.pizza/bundle/Farm-Animal-Pack-1kUvRTPLzT (Quaternius, CC0). Originals in `assets-src/Farm/Farm Buildings Bundle-glb/` and `assets-src/Farm/Farm Animal Pack-glb/` (not committed). Converted by `scripts/build-props.mjs` into `dist/props-assets-farm.js` (the farm.* ids are a lazy module, see `ensureFarmProps()` in props.js): `TOOL_DIR=<tools> node scripts/build-props.mjs assets-src farm.big-barn,farm.silo,...` (a list of ids rebuilds just those). Every model is ONE mesh with flat material colours baked to vertex colours: one material, one draw call each; origin on the ground at the footprint centre, facing +z. NOTHING is placed in the map yet: the game's current farm zone still uses the old six barn ids; replacing them is a later stage. `tests/farm-props.mjs` checks size, ground, footprint, boxes, colours and draw calls for all 17.
| Prop id | Source file | Size w x d x h (m) | Triangles | Colours | Collision |
|---|---|---|---|---|---|
| `barn` (0.29) | Barn.glb | 12.0 x 12.7 x 9.3 (1.55 x) | 2,910 | 4 | 8 wall boxes |
| `small-barn` (0.29) | Small Barn.glb | 9.4 x 9.7 x 7.7 (1.55 x) | 2,176 | 4 | 9 |
| `open-barn` (0.29) | Open Barn.glb | 8.9 x 9.6 x 7.3 (1.55 x) | 1,612 | 5 | 5 |
| `silo-house` (0.29) | Silo House.glb | 8.3 x 5.4 x 14.1 (1.55 x) | 2,880 | 7 | 14 |
| `coop` (0.29) | ChickenCoop.glb | 3.6 x 3.2 x 2.8 (1.5 x) | 948 | 5 | 7 |
| `windmill` (0.29) | Tower Windmill.glb | 9.9 x 6.2 x 14.3 (1.25 x, simplified from 7,827; blades are fixed) | 4,070 | 3 after simplifying | 8 |
| `farm.big-barn` | Big Barn.glb | 12.0 x 12.7 x 12.2 (1.55 x) | 4,220 | 4 | 9 wall boxes |
| `farm.silo` | Silo.glb | 5.7 x 5.4 x 14.1 (1.55 x) | 1,592 | 5 | 4 solid boxes |
| `farm.fence-a` | Fence-e02PFKKhbr.glb | 5.9 x 0.2 x 1.1 (1 x) | 188 | 1 | 1 exact box |
| `farm.fence-b` | Fence.glb | 5.9 x 0.2 x 1.2 (1 x) | 324 | 1 | 1 exact box |
| `farm.cow` | Cow.glb | 0.6 x 2.5 x 1.4 | 796 | 3 | 1 footprint box |
| `farm.horse` | Horse.glb | 0.6 x 2.3 x 1.7 | 690 | 2 | 1 |
| `farm.llama` | Llama.glb | 0.5 x 1.4 x 1.7 | 661 | 3 | 1 |
| `farm.pig` | Pig.glb | 0.6 x 1.8 x 0.85 | 562 | 2 | 1 |
| `farm.pug` | Pug.glb | 0.2 x 0.5 x 0.35 | 644 | 2 | 1 |
| `farm.sheep` | Sheep.glb | 0.5 x 1.2 x 0.9 | 610 | 2 | 1 |
| `farm.zebra` | Zebra.glb | 0.5 x 1.9 x 1.45 | 1,354 | 2 | 1 |
The animals are skinned in the file (28 bones, FBX2glTF, units 100 times too big): they are imported in the bind (rest) pose as static props, sized by `height`, with the clip names and lengths kept as `record.clips` (Cow, Horse, Zebra: Death, Idle, Jump, Run, Walk, WalkSlow; Llama, Pig, Pug, Sheep: Idle, Jump; Idle 6.25 s). The skin, weights and keyframes are NOT kept: playing them needs the RIGGED pipeline (`scripts/rigged-glb.mjs`, whole GLB embedded, about 1.6 MB for the seven). The two fence files are named a and b by file; the bundle does not say which is which (`fence-a` is the plainer 188-triangle one).

## sr90 Low Poly Farming Pack (SR90-IMPORT, 2026-11-17; no licence required, free to use)
Source: the pack `Low Poly Farming Pack` by sr90 on itch.io (the page link is not recorded; the licence is "no licence required, free to use", confirmed by the project owner). The pack is one Blender file, `assets-src/Farm/list1_detailed_FARM.blend`; every object uses ONE colour palette atlas (a grid of flat colour cells), so the conversion to flat colours is lossless: `scripts/farm-sr90.py` samples the atlas at each face's UV and writes flat-material GLBs into `assets-src/Farm/sr90/` (originals not committed; CATALOGUE.md there lists all 400+ objects). Flat-colour conversion by us. Imported into `dist/props-assets-farm.js` (lazy-loaded, `ensureFarmProps()`) by `scripts/build-props.mjs` (vertex colours, one mesh and one draw call each, origin on the ground, footprint and collision boxes in the data, nothing placed in the world): `TOOL_DIR=<tools> node scripts/build-props.mjs assets-src farm.seeder,...`. Bales are rescaled to real size in Blender (round about 1.5 m across x 1.25 m wide, square about 0.9 m long); the silage blocks and the wrapped bale are judged by eye (about 1.2 m). The combine's unloading auger is its own node (`unload_auger`, pivot at the base of the tube, with `unload_auger_tip` riding on it). Vehicles, implements and trailers keep the file origin (the contract in notes/farm-vehicle-contract.md), their anchors (`anchor_*`) and, new in the props data: `record.parts` (triangle runs, in index units, for the body and each `wheel_*` and `unload_auger`) and `record.nodes` (pivots of the wheels, auger, seat, tank_fill), so a later stage can split the wheels into spinning meshes without the RIGGED pipeline. Glass is drawn opaque dark (the props pipeline has no alpha). `farm.spreader` is the pack's Trailer_Grain, which is a fertiliser spreader, not a grain cart. `farm.trailer-tank-sr90` is named so it does not clash with the KidBi tank. Not imported: the textured barns, houses, shed and trees (notes/sr90-textured-assets.md).

| Prop id | Source file | Size w x d x h (m) | Triangles | Boxes | Moving parts (nodes) |
|---|---|---|---|---|---|
| `farm.bale-round-hay` | bale_round_hay.glb | 1.3 x 1.4 x 1.5 | 1,622 | 1 |  |
| `farm.bale-round-strapped` | bale_round_strapped.glb | 1.3 x 1.5 x 1.5 | 1,782 | 1 |  |
| `farm.bale-square-large` | bale_square_large.glb | 0.9 x 0.5 x 0.4 | 1,484 | 1 |  |
| `farm.bale-square-small` | bale_square_small.glb | 0.9 x 0.6 x 0.4 | 786 | 1 |  |
| `farm.bale-square-green-a` | bale_square_green_a.glb | 1.2 x 1.2 x 1.1 | 3,355 | 1 |  |
| `farm.bale-square-straw` | bale_square_straw.glb | 1.2 x 1.2 x 0.9 | 3,302 | 1 |  |
| `farm.bale-square-green-b` | bale_square_green_b.glb | 1.2 x 1.1 x 0.8 | 2,041 | 1 |  |
| `farm.bale-square-flat-green` | bale_square_flat_green.glb | 0.9 x 0.8 x 0.4 | 1,183 | 1 |  |
| `farm.bale-large-green` | bale_large_green.glb | 1.5 x 1.7 x 1.4 | 1,646 | 1 |  |
| `farm.crate-plastic-tall` | crate_plastic_tall.glb | 0.6 x 0.4 x 0.3 | 3,112 | 1 |  |
| `farm.crate-plastic-mid` | crate_plastic_mid.glb | 0.6 x 0.4 x 0.3 | 2,720 | 1 |  |
| `farm.crate-plastic-low` | crate_plastic_low.glb | 0.6 x 0.4 x 0.2 | 2,224 | 1 |  |
| `farm.crate-wood-large-bin` | crate_wood_large_bin.glb | 1.1 x 1.1 x 0.8 | 543 | 1 |  |
| `farm.crate-wood` | crate_wood.glb | 0.6 x 0.4 x 0.2 | 419 | 1 |  |
| `farm.box-wood-small` | box_wood_small.glb | 0.3 x 0.2 x 0.1 | 317 | 1 |  |
| `farm.pallet-wood` | pallet_wood.glb | 1.2 x 0.8 x 0.2 | 640 | 1 |  |
| `farm.barrel-drum-lid` | barrel_drum_lid.glb | 0.6 x 0.6 x 1.0 | 558 | 1 |  |
| `farm.barrel-drum-open` | barrel_drum_open.glb | 0.6 x 0.6 x 0.9 | 734 | 1 |  |
| `farm.barrel-wood-cradle` | barrel_wood_cradle.glb | 0.9 x 1.3 x 1.0 | 1,366 | 1 |  |
| `farm.barrel-wood-closed` | barrel_wood_closed.glb | 0.9 x 0.9 x 1.2 | 1,164 | 1 |  |
| `farm.barrel-wood-open` | barrel_wood_open.glb | 0.9 x 0.9 x 1.2 | 1,456 | 1 |  |
| `farm.trough-metal` | trough_metal.glb | 2.0 x 0.5 x 0.3 | 282 | 1 |  |
| `farm.trough-metal-hay` | trough_metal_hay.glb | 2.0 x 0.5 x 0.4 | 1,033 | 1 |  |
| `farm.manger-wood` | manger_wood.glb | 1.3 x 0.7 x 0.3 | 142 | 1 |  |
| `farm.manger-wood-hay` | manger_wood_hay.glb | 1.3 x 0.7 x 0.4 | 527 | 1 |  |
| `farm.trough-wood` | trough_wood.glb | 2.0 x 0.5 x 0.4 | 232 | 1 |  |
| `farm.trough-wood-hay` | trough_wood_hay.glb | 2.0 x 0.5 x 0.4 | 1,010 | 1 |  |
| `farm.rack-v-unclear` | rack_v_unclear.glb | 0.9 x 0.6 x 2.2 | 88 | 1 |  |
| `farm.bag-feed-green` | bag_feed_green.glb | 0.6 x 0.4 x 0.9 | 360 | 1 |  |
| `farm.bag-feed-open` | bag_feed_open.glb | 0.6 x 0.5 x 0.7 | 583 | 1 |  |
| `farm.sack-closed` | sack_closed.glb | 0.6 x 0.4 x 0.9 | 192 | 1 |  |
| `farm.sack-open-large` | sack_open_large.glb | 0.6 x 0.5 x 0.6 | 284 | 1 |  |
| `farm.sack-tied` | sack_tied.glb | 0.6 x 0.4 x 0.8 | 428 | 1 |  |
| `farm.bucket-metal` | bucket_metal.glb | 0.4 x 0.3 x 0.3 | 786 | 1 |  |
| `farm.bucket-wood` | bucket_wood.glb | 0.3 x 0.3 x 0.3 | 646 | 1 |  |
| `farm.milk-can` | milk_can.glb | 0.4 x 0.4 x 0.8 | 490 | 1 |  |
| `farm.wheelbarrow` | wheelbarrow.glb | 0.7 x 1.4 x 0.7 | 1,254 | 1 |  |
| `farm.water-tower` | water_tower.glb | 4.8 x 6.3 x 12.3 | 3,450 | 7 |  |
| `farm.seeder` | seeder.glb | 3.7 x 1.6 x 1.4 | 13,716 | 2 |  |
| `farm.cultivator` | cultivator.glb | 2.8 x 0.6 x 1.2 | 2,190 | 2 |  |
| `farm.harrow` | harrow.glb | 1.8 x 3.3 x 1.9 | 3,715 | 1 |  |
| `farm.baler-round` | baler_round.glb | 2.7 x 4.0 x 2.8 | 7,098 | 4 | wheel_fl, wheel_fr, wheel_rl, wheel_rr |
| `farm.mower-bar` | mower_bar.glb | 9.9 x 1.8 x 1.7 | 7,995 | 1 |  |
| `farm.mower-yellow` | mower_yellow.glb | 4.0 x 1.5 x 1.2 | 2,407 | 1 |  |
| `farm.rake-tedder` | rake_tedder.glb | 9.3 x 6.8 x 1.8 | 14,336 | 5 | wheel_01, wheel_02, wheel_03, wheel_04, wheel_05, wheel_06, wheel_07, wheel_08 |
| `farm.sprayer` | sprayer.glb | 22.2 x 6.2 x 3.0 | 18,553 | 5 | wheel_l, wheel_r |
| `farm.spreader` | trailer_grain.glb | 2.6 x 5.1 x 2.9 | 6,161 | 3 | wheel_l, wheel_r |
| `farm.trailer-red` | trailer_red.glb | 2.5 x 6.9 x 2.9 | 14,320 | 2 | wheel_fl, wheel_fr, wheel_rl, wheel_rr |
| `farm.trailer-tank-sr90` | trailer_tank.glb | 2.2 x 7.9 x 3.1 | 12,473 | 3 | wheel_fl, wheel_fr, wheel_ml, wheel_mr, wheel_rl, wheel_rr |
| `farm.cart-small` | cart_small.glb | 1.6 x 3.4 x 1.3 | 5,133 | 2 | wheel_l, wheel_r |
| `farm.combine-harvester` | combine_harvester.glb | 4.4 x 11.1 x 4.5 | 16,578 | 8 | unload_auger, wheel_fl, wheel_fr, wheel_rl, wheel_rr |
| `farm.combine-header` | combine_header.glb | 13.8 x 3.1 x 2.1 | 7,107 | 1 |  |

52 ids, 176,023 triangles in all; props-assets.js 5.47 MB to 13.30 MB (static startup import, flagged to the project owner).

### SR90 farmhouses (SR2, 2026-11-15)
Same source and licence as above (sr90, Low Poly Farming Pack, no licence required, free to use; conversion by us). House_Brick and House_Red are textured in the pack (a palette atlas plus tiled wall, stone and shingle textures): scripts/farm-sr90-bake.py with the environment variable SR90_EXPORT=assets-src/Farm/sr90 bakes every face to its colour (palette faces: the colour under the UV centroid; tiled textures: their mean colour), cuts everything below the ground (z = 0), puts the footprint centre on the origin with the door side toward +z, and writes house_brick.glb and house_red.glb (flat materials). scripts/build-props.mjs simplifies each to about 8,000 triangles and bakes vertex colours. Glass is opaque dark (no alpha in the props pipeline); the fine plank and shingle patterns are gone (one flat colour per surface). Both live in the lazy dist/props-assets-farm.js, one mesh and one draw call each, wall boxes in the data; nothing is placed in the map.

| id | file | m (w x d x h) | triangles | colours |
|---|---|---|---|---|
| `farm.house-brick` | house_brick.glb | 13.7 x 14.8 x 11.0 | 7,990 | 17 |
| `farm.house-red` | house_red.glb | 16.0 x 10.6 x 8.2 | 7,983 | 16 |

## Farm tractors and the tank trailer (FV1, 2026-11-15): `tractor_juff`, `tractor_kidbi`, `tow_tank` in `dist/props-assets.js`
Sources (both **CC-BY-4.0**, author credited in `credits.js`, both modified by us; the exact credit lines are in each model's `license.txt`):
- Hustler Compact (`tractor_juff`): "Low-poly tractor" by JUFF, https://sketchfab.com/3d-models/low-poly-tractor-d5e9b5a1bc1046ce821ac13c942c14c1 (https://sketchfab.com/Juff22). We added a seat, a hitch bracket, a power-take-off stub and a steering wheel.
- Husky R75 Tractor (`tractor_kidbi`) and Husky Trailer (`tow_tank`): "Tractor With Tank - Low Poly 3D Model" by KidBi-Gaming, https://sketchfab.com/3d-models/tractor-with-tank-low-poly-3d-model-23ceeff8f01a4370ab215b9d4725d454 (https://sketchfab.com/KidBi-Gaming). We split it into a tractor and a tow unit, added light lenses and turned its texture into flat colours.
Conform: `scripts/farm-conform.py` (notes/farm-vehicle-contract.md) into `assets-src/Farm/conformed/*_lite.glb` (tyre and rim in one material with vertex colours, decimated exhaust and lugs). Import: `scripts/build-props.mjs` (ids above; `nodes` + `splitWheels:'nodes'` in `scripts/split-wheels.mjs`: the four `wheel_FL/FR/RL/RR` nodes become wheel meshes centred on their hubs, the steering wheel stays in the body; COLOR_0 is multiplied into the material colour). The model origin is the HULL CENTRE (the footprint is centred on x and z, ground at y 0), so `axleZ` (rear axle from the centre) is minus the file's centre z: Hustler -0.935, R75 -0.68, trailer -0.47. `record.anchors` (anchor_* points) and `record.nodes` (hubs, steer pivots, steering wheel, seat, tank_fill) are kept and shown as `mesh.userData.anchors` / `.nodes` by `createProp`.
| id | name | triangles | size (w x l x h) | wheels (radius) | draw calls |
|---|---|---|---|---|---|
| `tractor_juff` | Hustler Compact | 5,826 | 1.87 x 3.15 x 2.39 | rear 0.644, front 0.389 | 5 (body + 4 wheels) |
| `tractor_kidbi` | Husky R75 Tractor | 14,797 | 1.98 x 3.08 x 2.23 | rear 0.614, front 0.406 | 5 |
| `tow_tank` | Husky Trailer | 6,124 | 2.78 x 3.78 x 2.80 | 0.406 (tandem, none steer: FV3) | 5 |
Size on disk: `dist/props-assets.js` grew by about 0.88 MB (4,890,864 to 5,810,790 bytes) for the three, so they stay in the startup module (under the 1.5 MB rule).

## The ATV (A4, 2026-11-15): tv in dist/props-assets.js
The project owner's own Blender model, `ATV Utility - V8 Game.glb` (`assets-src/Vehicles/ATV/`; finished with `scripts/atv-finish.py`). Licence: **Own work**, no credit line (owner decision). 39,295 triangles (soft cap accepted), 8 flat materials in the file (21 draw calls). Import: `scripts/build-props.mjs` entry `atv` (`nodes` + `splitWheels:'nodes'`, `keepOrigin` so the origin stays between the four tyre contacts): the 8 materials become vertex colours, so the game draws 5 meshes (body + 4 wheels, each wheel = tyre + rim + hub stub). Hull 1.22 x 2.07 x 1.08 m, wheels r 0.30, width 0.292. `moveAnchors` (data, the .glb is untouched): `anchor_taillight_L/R` to y 0.648; `anchor_exhaust` and the `exhaust` empty to (-0.28, 0.49, -1.035). Size on disk: `dist/props-assets.js` 5,810,790 to 6,974,968 bytes (+1,164,178), under the 1.5 MB rule, so it stays in the startup module.

## Shipping cartons and two crates (G3b, 2026-11-16): `prop.carton-*`, `prop.crate-wood`, `prop.crate-bin` in `dist/props-assets.js` (startup module, +0.45 MB)
**Cartons:** AssetsFactory "Free Realistic Cardboard Boxes" v1.1 (AssetsFactory Asset License v2.0: free for commercial and non-commercial games, do not sell or share the files, ship them only in a form end users cannot easily extract, credit appreciated and not required; the meshes and textures were script-generated with AI coding help, no image or 3D generator). FBX in metres, base centred (`assets-src/Boxes/fbx`, `textures`, licence text beside them). Only the BaseColor jpg is used (256 px, JPEG 85, one material, one draw call each). Rebuild: `TOOL_DIR=<tools> node scripts/build-props.mjs assets-src prop.carton-small,...`.
| id | source file | m (w x d x h) | triangles |
|---|---|---|---|
| `prop.carton-small` | ShipSmall_clean | 0.30 x 0.20 x 0.15 | 768 |
| `prop.carton-small-dirty` | ShipSmall_dirty | 0.30 x 0.20 x 0.15 | 1,192 |
| `prop.carton-small-crushed` | ShipSmall_crushed | 0.35 x 0.25 x 0.09 | 2,674 |
| `prop.carton-medium` | ShipMedium_clean | 0.40 x 0.30 x 0.30 | 1,356 |
| `prop.carton-medium-dirty` | ShipMedium_dirty | 0.40 x 0.30 x 0.31 | 2,308 |
| `prop.carton-cube` | ShipCube_clean | 0.35 x 0.35 x 0.35 | 1,232 |
Not imported: FlatMedium_clean, OpenMedium_clean, FlatBundle_dirty, ShipMedium_crushed, ShipCube_dirty/crushed (same folder, ready when a feature needs them). The gig parcel uses small for ordinary gigs and medium for large ones, dirty about 2 in 7 by a fixed hash (`gig-parcel.js parcelModelId`). `prop.carton-small-crushed` and `prop.carton-cube` are imported but not used yet.
**Crates:** Fab "Cargo.glb" (Fab Standard License; 317 MB because of 316 MB of PNG, only 12,510 triangles). Never copied or opened whole: `scripts/extract-cargo-crates.mjs` reads the needed nodes' byte ranges and writes small GLBs into `assets-src/Boxes/cargo/` (scale baked in, one 256 px jpeg). `prop.crate-wood` = node "Crate v1" (0.76 x 0.75 x 0.49 m, 284 triangles, 33 KB glb), `prop.crate-bin` = node "Crate 3.v1" (0.58 x 0.38 x 0.44 m, 156 triangles, 25 KB glb; the one cargo.js draws on a deck). Measured and left: "Crate 2" (a flat 0.85 x 0.83 x 0.22 m tray) and all pallets (the owner's `prop.pallet` is enough). No credit line (Fab Standard License needs none).

## Ground cover (GD5, Quaternius Stylized Nature MegaKit [Standard], CC0 1.0, already credited)
Nine models, one per cover kind (variants = 1), baked by scripts/build-cover-assets.mjs into dist/cover-assets.js (about 0.29 MB, loaded lazily): Grass_Common_Short, Grass_Common_Tall, Clover_1, Fern_1, Flower_3_Group, Bush_Common (texture hue-shifted red to green), Pebble_Round_1, Rock_Medium_1, Mushroom_Common. Scaled once to real sizes, textures cropped into one 512 x 384 atlas. Reeds and wheat are code-made (dist/cover-pack.js).


## Timber models (T-D, 2026-11-18): 	runk, logs2, slab, oards4 in dist/assets/timber/*.glb`n
Four models of the project owner's own, built in Blender by Hydrogen from the T-D prompt; **own work**, no credit line. Source: ssets-src/timber/timber_models.blend; one 256 px atlas (the CC0 Stylized Nature MegaKit bark, procedural end grain and sawn pine), one material each, 48 to 140 triangles, 70 KB each. Sizes: trunk 2.30 x 0.35 x 0.36 m, logs2 1.15 x 0.24 x 0.47 m, slab 2.30 x 0.06 x 0.36 m, boards4 1.20 x 0.45 x 0.465 m (matches carry.js PLANK_LENGTH and sawmill-pile.js). NOT wired into the game yet: they are loaded with GLTFLoader in stage T-B/T-E (not through props-assets.js).


## Timber, chainsaw and sawmill sounds (SND2, 2026-11-18, recorded, all CC0) in `dist/assets/sounds/`

Found and processed 2026-11-18 for stage SND2 (`notes/eval/prompts/gemini-lumber-sounds.md`). Every file below is **CC0 1.0 (public domain dedication)**, verified on its Freesound page on 2026-11-18 (`Creative Commons 0`). Because Freesound original downloads require a login, the public high-quality MP3 preview (`cdn.freesound.org/previews/...-hq.mp3`) of each CC0 sound was downloaded as data and processed with Blender 5.2's `aud` module and `numpy` (no `ffmpeg` on this machine): mono, 22.05 kHz, Ogg Vorbis (`56 kbps`, `-q:a 3` equivalent), DC offset removed.

- **Loops** (`chainsaw-idle`, `chainsaw-cut`, `sawmill-blade-idle`, `sawmill-blade-cut`, `conveyor-belt`): 0.30 s equal-power tail-to-head cross-fade for seamless looping, normalised to `-20.0 dBFS` rms (soft-limited at `-1.5 dBFS` peak if needed).
- **One-shots** (all other clips): 10 ms fade-in, 30 ms fade-out, normalised to `-4.0 dBFS` peak.
- **Note**: Cut points and loop windows were chosen by waveform/RMS/spectral-centroid measurement (`numpy`); nobody has listened to them yet.

| File | Source title + id | Author + URL | Cut used | Loudness |
|---|---|---|---|---|
| `axe-chop-1.ogg` | Freesound 706978 "Chopping a tree trunk with an Axe. OWI.wav" | JesterWhoo (https://freesound.org/people/JesterWhoo/sounds/706978/) | 0.85 to 1.25 s (0.40 s, chop 1) | peak -4.0 dBFS, rms -29.1 dBFS |
| `axe-chop-2.ogg` | Freesound 706978 "Chopping a tree trunk with an Axe. OWI.wav" | JesterWhoo (https://freesound.org/people/JesterWhoo/sounds/706978/) | 4.42 to 4.82 s (0.40 s, chop 2) | peak -4.0 dBFS, rms -30.1 dBFS |
| `axe-chop-3.ogg` | Freesound 706978 "Chopping a tree trunk with an Axe. OWI.wav" | JesterWhoo (https://freesound.org/people/JesterWhoo/sounds/706978/) | 6.59 to 7.02 s (0.43 s, chop 3) | peak -4.0 dBFS, rms -27.2 dBFS |
| `axe-chop-4.ogg` | Freesound 706978 "Chopping a tree trunk with an Axe. OWI.wav" | JesterWhoo (https://freesound.org/people/JesterWhoo/sounds/706978/) | 9.15 to 9.55 s (0.40 s, chop 4) | peak -4.0 dBFS, rms -28.4 dBFS |
| `tree-fall.ogg` | Freesound 670300 "tree cut down.wav" | bruno.auzet (https://freesound.org/people/bruno.auzet/sounds/670300/) | 2.30 to 6.80 s (4.50 s, creaking/snapping into crash) | peak -4.0 dBFS, rms -25.7 dBFS |
| `tree-thud.ogg` | Freesound 515313 "timber tree falling 1" | matt_beer (https://freesound.org/people/matt_beer/sounds/515313/) | 3.05 to 3.95 s (0.90 s, heavy trunk landing) | peak -4.0 dBFS, rms -25.6 dBFS |
| `log-drop-1.ogg` | Freesound 681416 "wooden log drop" | ventousawins (https://freesound.org/people/ventousawins/sounds/681416/) | 6.48 to 7.08 s (0.60 s, heavy log drop) | peak -4.0 dBFS, rms -25.2 dBFS |
| `log-drop-2.ogg` | Freesound 659430 "Wood log impact reverbed pack.wav" | Sadiquecat (https://freesound.org/people/Sadiquecat/sounds/659430/) | 8.22 to 8.77 s (0.55 s, take 1) | peak -4.0 dBFS, rms -25.0 dBFS |
| `log-drop-3.ogg` | Freesound 659430 "Wood log impact reverbed pack.wav" | Sadiquecat (https://freesound.org/people/Sadiquecat/sounds/659430/) | 13.98 to 14.58 s (0.60 s, take 2) | peak -4.0 dBFS, rms -20.1 dBFS |
| `chainsaw-start.ogg` | Freesound 637359 "chainsaw start, saw something quick, shut off1.flac" | kyles (https://freesound.org/people/kyles/sounds/637359/) | 0.05 to 2.55 s (2.50 s, pull-cord + catch) | peak -4.0 dBFS, rms -24.8 dBFS |
| `chainsaw-idle.ogg` | Freesound 431741 "Chainsaw - Start Cut and Idle.wav" | Stefan021 (https://freesound.org/people/Stefan021/sounds/431741/) | 29.00 to 33.40 s (4.10 s loop after 0.30 s cross-fade) | rms -20.0 dBFS, peak -4.3 dBFS |
| `chainsaw-cut.ogg` | Freesound 431741 "Chainsaw - Start Cut and Idle.wav" | Stefan021 (https://freesound.org/people/Stefan021/sounds/431741/) | 20.00 to 24.80 s (4.50 s loop after 0.30 s cross-fade) | rms -20.0 dBFS, peak -7.2 dBFS |
| `chainsaw-stop.ogg` | Freesound 637359 "chainsaw start, saw something quick, shut off1.flac" | kyles (https://freesound.org/people/kyles/sounds/637359/) | 15.50 to 17.20 s (1.70 s, spin-down shut off) | peak -4.0 dBFS, rms -22.8 dBFS |
| `sawmill-blade-idle.ogg` | Freesound 528163 "Vertical panel saw - Sawmill atmosphere - Industry saw" | Breviceps (https://freesound.org/people/Breviceps/sounds/528163/) | 13.00 to 18.00 s (4.70 s loop after 0.30 s cross-fade) | rms -20.0 dBFS, peak -5.8 dBFS |
| `sawmill-blade-cut.ogg` | Freesound 501169 "Circular Saw Sawing 2x6.wav" | shelbyshark (https://freesound.org/people/shelbyshark/sounds/501169/) | 9.50 to 14.50 s (4.70 s loop after 0.30 s cross-fade) | rms -20.0 dBFS, peak -8.4 dBFS |
| `sawmill-blade-stop.ogg` | Freesound 449118 "Elite 80 Table Saw 2.wav" | SampleDiaries (https://freesound.org/people/SampleDiaries/sounds/449118/) | 23.50 to 26.50 s (3.00 s, blade spin-down) | peak -4.0 dBFS, rms -26.3 dBFS |
| `plank-drop-1.ogg` | Freesound 537755 "Wooden Planks 01.wav" | Tim_Verberne (https://freesound.org/people/Tim_Verberne/sounds/537755/) | 2.23 to 2.63 s (0.40 s, drop 1) | peak -4.0 dBFS, rms -31.7 dBFS |
| `plank-drop-2.ogg` | Freesound 537755 "Wooden Planks 01.wav" | Tim_Verberne (https://freesound.org/people/Tim_Verberne/sounds/537755/) | 5.15 to 5.65 s (0.50 s, drop 2) | peak -4.0 dBFS, rms -28.1 dBFS |
| `plank-drop-3.ogg` | Freesound 537755 "Wooden Planks 01.wav" | Tim_Verberne (https://freesound.org/people/Tim_Verberne/sounds/537755/) | 6.33 to 6.83 s (0.50 s, drop 3) | peak -4.0 dBFS, rms -27.0 dBFS |
| `plank-stack.ogg` | Freesound 478238 "Planks Clattering" | Fission9 (https://freesound.org/people/Fission9/sounds/478238/) | 6.70 to 8.65 s (1.95 s, multiple boards laid down) | peak -4.0 dBFS, rms -23.3 dBFS |
| `conveyor-belt.ogg` | Freesound 478247 "Conveyor belt" | TiesWijnen (https://freesound.org/people/TiesWijnen/sounds/478247/) | 1.00 to 6.00 s (4.70 s loop after 0.30 s cross-fade) | rms -20.0 dBFS, peak -7.1 dBFS |


## Game-wide sound sweep (SND3, 2026-11-18, recorded, all CC0) in `dist/assets/sounds/`

Found and processed 2026-11-18 for stage SND3 (`notes/eval/prompts/hydrogen-sound-sweep.md`). Every file below is **CC0 1.0 (public domain dedication)**, verified on its Freesound page on 2026-11-18 (`Creative Commons 0`). Because Freesound original downloads require a login, the public high-quality MP3 preview (`cdn.freesound.org/previews/...-hq.mp3`) of each CC0 sound was downloaded as data and processed with Blender 5.2's `aud` module and `numpy` (no `ffmpeg` on this machine): mono, 22.05 kHz, Ogg Vorbis (`56 kbps`), DC offset removed.

- **Loops** (`fuel-flow`, `eng-atv`, `eng-tractor`, `forklift-beep`, `forklift-lift`, `amb-birds`, `amb-crickets`, `amb-wind`, `amb-water`): 0.30 s equal-power tail-to-head cross-fade for seamless looping, normalised to `-20.0 dBFS` rms (soft-limited at `-1.5 dBFS` peak if needed).
- **One-shots** (all other 31 clips): 10 ms fade-in, 30 ms fade-out, normalised to `-4.0 dBFS` peak.
- **Note**: Cut points and loop windows were chosen by waveform/RMS/onset measurement (`numpy`); nobody has listened to them yet.

| File | Source title + id | Author + URL | Cut used | Loudness |
|---|---|---|---|---|
| `step-pave-1.ogg` | Freesound 465299 "Concrete Footsteps" | SoftDistortionFX (https://freesound.org/people/SoftDistortionFX/sounds/465299/) | 1.60 to 1.98 s (0.38 s, step 1) | peak -4.0 dBFS, rms -26.0 dBFS |
| `step-pave-2.ogg` | Freesound 465299 "Concrete Footsteps" | SoftDistortionFX (https://freesound.org/people/SoftDistortionFX/sounds/465299/) | 2.02 to 2.40 s (0.38 s, step 2) | peak -4.0 dBFS, rms -24.5 dBFS |
| `step-pave-3.ogg` | Freesound 465299 "Concrete Footsteps" | SoftDistortionFX (https://freesound.org/people/SoftDistortionFX/sounds/465299/) | 2.45 to 2.83 s (0.38 s, step 3) | peak -4.0 dBFS, rms -27.0 dBFS |
| `step-grass-1.ogg` | Freesound 521587 "Hiking Boot Footsteps on Grass" | Fission9 (https://freesound.org/people/Fission9/sounds/521587/) | 0.05 to 0.55 s (0.50 s, step 1) | peak -4.0 dBFS, rms -24.6 dBFS |
| `step-grass-2.ogg` | Freesound 521587 "Hiking Boot Footsteps on Grass" | Fission9 (https://freesound.org/people/Fission9/sounds/521587/) | 0.74 to 1.24 s (0.50 s, step 2) | peak -4.0 dBFS, rms -25.0 dBFS |
| `step-grass-3.ogg` | Freesound 521587 "Hiking Boot Footsteps on Grass" | Fission9 (https://freesound.org/people/Fission9/sounds/521587/) | 2.98 to 3.48 s (0.50 s, step 3) | peak -4.0 dBFS, rms -24.7 dBFS |
| `step-gravel-1.ogg` | Freesound 521588 "Hiking Boot Footsteps on Gravel" | Fission9 (https://freesound.org/people/Fission9/sounds/521588/) | 0.05 to 0.55 s (0.50 s, step 1) | peak -4.0 dBFS, rms -25.3 dBFS |
| `step-gravel-2.ogg` | Freesound 521588 "Hiking Boot Footsteps on Gravel" | Fission9 (https://freesound.org/people/Fission9/sounds/521588/) | 0.80 to 1.30 s (0.50 s, step 2) | peak -4.0 dBFS, rms -29.1 dBFS |
| `step-gravel-3.ogg` | Freesound 521588 "Hiking Boot Footsteps on Gravel" | Fission9 (https://freesound.org/people/Fission9/sounds/521588/) | 1.50 to 2.00 s (0.50 s, step 3) | peak -4.0 dBFS, rms -25.5 dBFS |
| `step-wood-1.ogg` | Freesound 459970 "Footsteps on hollow wood" | florianreichelt (https://freesound.org/people/florianreichelt/sounds/459970/) | 0.02 to 0.42 s (0.40 s, step 1) | peak -4.0 dBFS, rms -22.8 dBFS |
| `step-wood-2.ogg` | Freesound 459970 "Footsteps on hollow wood" | florianreichelt (https://freesound.org/people/florianreichelt/sounds/459970/) | 0.90 to 1.30 s (0.40 s, step 2) | peak -4.0 dBFS, rms -21.2 dBFS |
| `step-wood-3.ogg` | Freesound 459970 "Footsteps on hollow wood" | florianreichelt (https://freesound.org/people/florianreichelt/sounds/459970/) | 5.90 to 6.30 s (0.40 s, step 3) | peak -4.0 dBFS, rms -26.1 dBFS |
| `door-open.ogg` | Freesound 125958 "Wooden door open-close" | Ryding (https://freesound.org/people/Ryding/sounds/125958/) | 0.30 to 1.20 s (0.90 s, opening) | peak -4.0 dBFS, rms -28.9 dBFS |
| `door-close.ogg` | Freesound 125958 "Wooden door open-close" | Ryding (https://freesound.org/people/Ryding/sounds/125958/) | 1.85 to 2.65 s (0.80 s, closing) | peak -4.0 dBFS, rms -23.5 dBFS |
| `shop-bell.ogg` | Freesound 879804 "Shop Door Chime" | Qvantor (https://freesound.org/people/Qvantor/sounds/879804/) | 0.00 to 1.50 s (1.50 s) | peak -4.0 dBFS, rms -16.8 dBFS |
| `gate-latch.ogg` | Freesound 710871 "Metal Gate Latch 02" | NapierFreesound (https://freesound.org/people/NapierFreesound/sounds/710871/) | 0.60 to 1.15 s (0.55 s) | peak -4.0 dBFS, rms -29.0 dBFS |
| `ui-click.ogg` | Freesound 677861 "UI Button Click" | el_boss (https://freesound.org/people/el_boss/sounds/677861/) | 0.00 to 0.05 s (0.05 s) | peak -4.0 dBFS, rms -24.4 dBFS |
| `ui-toast.ogg` | Freesound 879790 "Message Pop" | Qvantor (https://freesound.org/people/Qvantor/sounds/879790/) | 0.00 to 0.40 s (0.40 s) | peak -4.0 dBFS, rms -18.2 dBFS |
| `phone-ping.ogg` | Freesound 879808 "Service Bell Ding" | Qvantor (https://freesound.org/people/Qvantor/sounds/879808/) | 0.00 to 1.20 s (1.20 s) | peak -4.0 dBFS, rms -20.8 dBFS |
| `cash-register.ogg` | Freesound 351304 "Cha Ching.wav" | deleted_user_96253 (https://freesound.org/people/deleted_user_96253/sounds/351304/) | 0.05 to 1.55 s (1.50 s) | peak -4.0 dBFS, rms -21.8 dBFS |
| `coins-pay.ogg` | Freesound 776101 "Coins Jingle" | yuliana_yurukova (https://freesound.org/people/yuliana_yurukova/sounds/776101/) | 0.04 to 1.20 s (1.16 s) | peak -4.0 dBFS, rms -29.2 dBFS |
| `level-up.ogg` | Freesound 528958 "Level Up / Mission Complete" | Beetlemuse (https://freesound.org/people/Beetlemuse/sounds/528958/) | 0.00 to 1.90 s (1.90 s) | peak -4.0 dBFS, rms -18.9 dBFS |
| `eat-bite.ogg` | Freesound 774782 "apple bite" | yuliana_yurukova (https://freesound.org/people/yuliana_yurukova/sounds/774782/) | 0.70 to 1.40 s (0.70 s) | peak -4.0 dBFS, rms -35.6 dBFS |
| `sleep-chime.ogg` | Freesound 399538 "Windchime soft" | Vendarro (https://freesound.org/people/Vendarro/sounds/399538/) | 2.65 to 5.20 s (2.55 s) | peak -4.0 dBFS, rms -18.7 dBFS |
| `breath-tired.ogg` | Freesound 682882 "Panting.wav" | drewsimko (https://freesound.org/people/drewsimko/sounds/682882/) | 1.15 to 2.65 s (1.50 s) | peak -4.0 dBFS, rms -23.4 dBFS |
| `fuel-nozzle.ogg` | Freesound 750486 "Fuel pump" | Nomracer (https://freesound.org/people/Nomracer/sounds/750486/) | 4.35 to 4.95 s (0.60 s, nozzle click) | peak -4.0 dBFS, rms -28.1 dBFS |
| `fuel-flow.ogg` | Freesound 236283 "Pressurized Hose Water Float.wav" | mffm (https://freesound.org/people/mffm/sounds/236283/) | 5.75 to 10.75 s (4.70 s loop after 0.30 s cross-fade) | rms -20.0 dBFS, peak -8.9 dBFS |
| `car-door-open.ogg` | Freesound 556691 "Car Door open and close 2.wav" | NachtmahrTV (https://freesound.org/people/NachtmahrTV/sounds/556691/) | 0.45 to 1.20 s (0.75 s, open) | peak -4.0 dBFS, rms -21.0 dBFS |
| `car-door-close.ogg` | Freesound 556691 "Car Door open and close 2.wav" | NachtmahrTV (https://freesound.org/people/NachtmahrTV/sounds/556691/) | 3.80 to 4.55 s (0.75 s, slam) | peak -4.0 dBFS, rms -16.9 dBFS |
| `car-horn.ogg` | Freesound 349922 "Car Horn Honk.wav" | DeVern (https://freesound.org/people/DeVern/sounds/349922/) | 0.00 to 0.70 s (0.70 s) | peak -4.0 dBFS, rms -19.3 dBFS |
| `brake-squeal.ogg` | Freesound 784172 "Honda CRV 2014 Interior Car stop" | loganzsound (https://freesound.org/people/loganzsound/sounds/784172/) | 2.80 to 4.10 s (1.30 s) | peak -4.0 dBFS, rms -29.7 dBFS |
| `eng-atv.ogg` | Freesound 379915 "Quad Bike_ATV Engine.wav" | Alex_hears_things (https://freesound.org/people/Alex_hears_things/sounds/379915/) | 3.25 to 8.25 s (4.70 s loop after 0.30 s cross-fade) | rms -20.0 dBFS, peak -8.5 dBFS |
| `eng-tractor.ogg` | Freesound 637884 "tractor idle engine motor close2.flac" | kyles (https://freesound.org/people/kyles/sounds/637884/) | 25.75 to 30.75 s (4.70 s loop after 0.30 s cross-fade) | rms -20.0 dBFS, peak -5.9 dBFS |
| `crate-drop.ogg` | Freesound 465451 "foley_Cardboard Box Drop.wav" | ittou (https://freesound.org/people/ittou/sounds/465451/) | 3.50 to 4.20 s (0.70 s) | peak -4.0 dBFS, rms -31.7 dBFS |
| `forklift-beep.ogg` | Freesound 449081 "Back Up BEEP Only" | Bon_Vivant_Pictures (https://freesound.org/people/Bon_Vivant_Pictures/sounds/449081/) | 0.00 to 2.30 s (2.00 s loop after 0.30 s cross-fade) | rms -20.0 dBFS, peak -6.0 dBFS |
| `forklift-lift.ogg` | Freesound 877385 "Machine_Electric_Stacker_Forks_Raising_Sequence" | Nox_Sound (https://freesound.org/people/Nox_Sound/sounds/877385/) | 17.50 to 21.50 s (3.70 s loop after 0.30 s cross-fade) | rms -20.4 dBFS, peak -2.5 dBFS |
| `amb-birds.ogg` | Freesound 624015 "Birds chirping.aif" | exvls (https://freesound.org/people/exvls/sounds/624015/) | 5.00 to 10.00 s (4.70 s loop after 0.30 s cross-fade) | rms -20.0 dBFS, peak -2.5 dBFS |
| `amb-crickets.ogg` | Freesound 479041 "Crickets during the night" | felix.blume (https://freesound.org/people/felix.blume/sounds/479041/) | 251.25 to 256.25 s (4.70 s loop after 0.30 s cross-fade) | rms -20.0 dBFS, peak -5.9 dBFS |
| `amb-wind.ogg` | Freesound 531016 "Wind Through Trees ambience.wav" | Noted451 (https://freesound.org/people/Noted451/sounds/531016/) | 31.00 to 36.00 s (4.70 s loop after 0.30 s cross-fade) | rms -20.0 dBFS, peak -5.2 dBFS |
| `amb-water.ogg` | Freesound 318064 "Water_Lapping_River.wav" | ceich93 (https://freesound.org/people/ceich93/sounds/318064/) | 17.25 to 22.25 s (4.70 s loop after 0.30 s cross-fade) | rms -20.3 dBFS, peak -3.3 dBFS |
