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

## Received but not imported yet
- **Kenney City Kit (Suburban)**, CC0 1.0 (https://kenney.nl/assets/city-kit-suburban): 21 houses (770-2,060 triangles each, 27,500 for one of each), 9 fence pieces, a planter, two tiny
  trees, driveway and path tiles, all sharing one colour palette texture. Intended for Cedar Heights (Phase 4). Houses are about 1-1.8 units wide as shipped (scale about x8).
