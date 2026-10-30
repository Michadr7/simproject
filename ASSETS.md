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
| `sawmill` | `sawmill.glb` (generated with Tripo AI, https://tripo3d.ai) | the Sawmill in Pine Ridge's north-east clearing | 12 x 11 m, 6.7 m tall | 4,333 | **To confirm**: depends on the Tripo plan it was generated on. Tripo's help page says free-plan outputs are Tripo's and commercial use needs a paid plan; other sources describe free outputs as CC BY 4.0. Fine for a personal project; confirm before any commercial release. |
| `farmyard` (not shipped) | `LowPOlyFarm_buildings.glb` (a farmyard diorama; exported with pygltflib) | was the farmstead; replaced by a placeholder because it looked too rough in the game | 40 x 44 m | 15,021 | **Unknown source and licence** |

Both models are one fused mesh with one colour texture, so their parts cannot be moved, opened or animated separately (the saw blade cannot spin). The converter cuts the
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
| Pickup (FBX) | CGTrader free model | 8,655 triangles, 2 materials | simplify to about 2,800 |
| Flatbed truck (FBX) | SpawnCamp Games, itch.io (credit them) | 13,024 triangles, 12 materials | simplify to about 3,500; the timber haul |
Still missing: the low-end green chainsaw (Sketchfab), the Bus, a farmhouse and a chicken.
