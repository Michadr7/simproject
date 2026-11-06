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
