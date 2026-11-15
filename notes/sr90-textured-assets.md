# sr90 pack: the textured assets (not imported; written 2026-11-17, SR90-IMPORT)

Question: can the props pipeline (scripts/build-props.mjs: one mesh, vertex colours or ONE colour texture) carry the pack's barns, houses, shed and trees, or can their surface colours be baked to flat colours?

## Answer in one line
Yes: baking each face's colour into vertex colours works and looks right (preview below). No texture path is needed. The cost is triangles (30,000 to 40,000 per building, because the pack models stones, planks and shingles as geometry), so run them through the simplifier (build-props `triangles`) when importing.

## What "textured" means here
Nearly every face of these models already uses the pack's palette atlas (`texture_0`, 4096 x 4096, flat colour cells): it converts losslessly (scripts/farm-sr90.py does this for the exported props). Only a few percent of the faces use a tiled surface texture (2048 x 2048 wall planks, stone, shingles, aluminium; 1024 x 1024 foliage with alpha). `scripts/farm-sr90-bake.py` bakes both kinds into a per-face vertex colour: palette faces take the colour under their UV centroid, surface-textured faces take that texture's mean colour (alpha-weighted for leaves), a material with no image takes its base colour. Run: `blender -b assets-src/Farm/list1_detailed_FARM.blend --python scripts/farm-sr90-bake.py -- <out dir>`.

| asset | tris | materials | images (palette + surface) | distinct baked colours | looks right after the bake? |
|---|---|---|---|---|---|
| Barn_Big | 29,739 | 6 | 1 x 4096 + 4 x 2048 | 25 | yes; red walls, white trim, dark roof, stone base; the stray loose pieces under the ramp must be dropped; footprint 17 x 38 m includes the ramp |
| Barn_Stone | 36,574 | 6 | 1 x 4096 + 5 x 2048 | 16 | yes; stone grey (the stones are real geometry, shading carries them), brown doors |
| House_Brick | 40,189 | 8 | 1 x 4096 + 6 x 2048 (one material has no image) | 29 | yes; the best looking, brick and stone corners come through; glass becomes opaque dark |
| House_Red | 31,021 | 7 | 1 x 4096 + 5 x 2048 | 27 | yes |
| Shed_Open | 30,468 | 4 | 1 x 4096 + 3 x 2048 | 13 | yes, but the model is odd: an open-front red shed sitting on a tall stone pedestal (14.9 m tall in all); check it before using it as a "machine shed" |
| Tree_001 / 002 | 2,231 / 1,655 | 2 | 1 x 4096 + 1 x 1024 (foliage A) | 3 / 4 | yes; one olive green for all leaves (the leaf texture's mean) |
| Tree_003 / 004 | 6,261 / 4,467 | 2 | same | 8 / 12 | yes; red apples are palette faces and keep their colour |
| Tree_005 / 006 | 2,429 / 6,746 | 2 | 1 x 4096 + 1 x 1024 (foliage B) | 2 / 12 | yes |

Preview renders (Workbench, vertex colours, front 3/4, back 3/4 and side) were looked at for all eleven; they are in the agent scratch folder only (not kept in the repo). What the bake loses: the fine surface pattern (plank lines, shingle edges) is gone because each such material becomes one flat colour; the large shapes, windows, doors, trim and roofs are real geometry and stay. Foliage: the leaf cards lose their texture cut-outs, so a tree is solid dark-green leaf shapes with flat shading (the same look as the Quaternius trees already in the game).

## Cost, per asset
Measured on this import: props-assets.js grows about 44 bytes per triangle (base64 of positions, normals, colours and indices). So untouched: Barn_Big about 1.3 MB, Barn_Stone 1.6 MB, House_Brick 1.8 MB, House_Red 1.4 MB, Shed_Open 1.35 MB (about 7.5 MB for the five) plus the six trees about 0.9 MB. props-assets.js is already 13.3 MB after the SR90 farm import (it was 5.5 MB), and it is a static startup import. Recommendation: simplify each building to 6,000 to 9,000 triangles at import (`triangles: 8000` in build-props; vertex colours and normals are weighted in the simplifier), about 0.35 MB each, and import only the ones that will actually be placed. One draw call each.

## Recommendation
1. Import with the bake (vertex colours); no textured-prop path.
2. First pick: House_Brick and House_Red (the game has no farmhouse: ASSETS.md says "Farmhouse still missing"), then Barn_Big if the Quaternius barns are not enough. Skip Barn_Stone and Shed_Open unless the farm layout asks for them (Shed_Open's pedestal is odd).
3. Trees: the Quaternius trees in the game (nature.js: pine.1-3, broadleaf.1-2, about 1,350 triangles each) are enough; the sr90 trees add an apple tree (Tree_003/004) and a rounder look; low priority.
4. Do the import in its own run (a bake step in build-props or an exporter in farm-sr90.py that writes the baked colours as flat materials, like the other sr90 files).

## Not textured at all (palette only): can be imported with the exporter that already exists
Windmill_Dutch (9,214 tris), Windmill_Wooden (8,002), WindPump (1,777), Silo_Tall (3,760), Silo_Tall_Rusty (4,384), GrainBin (1,050), GrainBin_Rusty (1,669), FeedBin (1,290), Greenhouse (992), Fence_001-010 (36 to 394 tris each), RanchGate_A/B (2,222 / 1,738), Sign_Farm_A/B (1,232 / 442). They need only an export (`PROPS`/`SPECS` entry in farm-sr90.py) and a build-props entry. The windmill and silo sails or lids are fixed (no animation in the pack).

## Which Quaternius props already in the game each would duplicate
| sr90 asset | already in the game | note |
|---|---|---|
| Barn_Big (29.7k) | `farm.big-barn` (4,220), `barn` (2,910) | same job, the sr90 one is a red barn with ramp and side shed, much heavier |
| Barn_Stone (36.6k) | `barn`, `small-barn` (2,176) | stone barn; nothing like it in the game |
| Shed_Open (30.5k) | `open-barn` (1,612) | the same idea (open front) |
| House_Brick, House_Red | Kenney `house-*` (770 to 2,062), no farmhouse | the farmhouse gap (ASSETS.md) |
| Silo_Tall, Silo_Tall_Rusty, GrainBin, FeedBin | `farm.silo` (1,592), `silo-house` (2,880) | the sr90 silos are taller (18.6 m) and there are grain bins that the game lacks |
| Windmill_Dutch, Windmill_Wooden, WindPump | `windmill` (4,070) | three different windmills against one |
| Fence_001-010 | `farm.fence-a` (188), `farm.fence-b` (324) | sr90 has 10 variants, from 2 m to 3.2 m, plus gates |
| RanchGate_A/B, Sign_Farm_A/B | none | new |
| Tree_001-006 | `nature.js` pine.1-3, broadleaf.1-2 | apple trees are new |
| Greenhouse | none | new |
