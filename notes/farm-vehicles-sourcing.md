# Farm vehicles: chosen sources (user picks, 2026-11-17)

For Husky Ranch and the farming job (combine, tractors, grain cart). Nothing is downloaded or in the repo yet: Sketchfab downloads need the user's login, so the USER downloads each file and drops it in `assets-src\Vehicles\Farm\<short-name>\` (keep the original download there, never edit it). Then an agent runs `node scripts/glb-inspect.cjs` / `glb-tree.cjs` (convert FBX/OBJ to GLB first if needed with headless Blender 5.2) and a Sonnet conform job like the ATV one (see notes/atv-v5-conform-prompt.md for the pattern; farm contract to be written per vehicle: axes, wheels, anchors, `header` anchor on the combine, hitch point on tractor and trailers, bed entries in dist/cargo.js for every cargo vehicle).

| Pick | Source | Author | Licence on the page (as read 2026-11-17) | Triangles | Role |
|---|---|---|---|---|---|
| Low-poly tractor | https://sketchfab.com/3d-models/low-poly-tractor-d5e9b5a1bc1046ce821ac13c942c14c1 | JUFF (@Juff22) | CC Attribution 4.0 (credit needed) | 5.3k | the light starter tractor (cheapest to run: best first farm vehicle) |
| Tractor With Tank | https://sketchfab.com/3d-models/tractor-with-tank-low-poly-3d-model-23ceeff8f01a4370ab215b9d4725d454 | KidBi-Gaming | CC Attribution 4.0 (credit needed) | 30.6k | tractor plus tanker (water/fuel/liquid hauling) |
| Combine Harvesters | https://sketchfab.com/3d-models/combine-harvesters-d9d97f5c1a4e45238078bd90a786f649 | Sidra (@Sidramax) | NOT NAMED: the page only says "You can use these models in any game and project" | 19.7k | the combine (header anchor, 6 m swath: see notes/ground-detail-design.md GD10) |
| Tractor Model Low-Poly | https://sketchfab.com/3d-models/tractor-model-low-poly-079800c418cb4e16834e8be12dee3dc4 | Sidra (@Sidramax) | NOT NAMED (same sentence) | 23.5k | second, bigger tractor |
| Tractor Dump Trailers | https://sketchfab.com/3d-models/tractor-dump-trailers-c8bf5c6f274449ce9c5fc500109b5578 | Sidra (@Sidramax) | NOT NAMED (same sentence) | 38.1k | trailers: it has dump trailers, NOT a grain cart; the user wants a grain cart (use a trailer from this pack as the base, or build one in Blender) |

Notes
- Formats for the three Sidra models: FBX, OBJ, 3DMax (original files in the 'Additional file'); no glTF. JUFF and KidBi-Gaming: use the Sketchfab 'Download 3D Model' button (choose glTF/GLB).
- Credits: user said credit gaps can wait until the public release, but record each model in ASSETS.md at import time (title, author, URL, licence as read). The two CC BY models need a credit line before any public release. The three Sidra models have no formal licence: before a public release, ask the author for an explicit licence or replace them (flag in ASSETS.md as 'licence not named').
- Triangle caps are soft; flag draw calls and materials at import (Sidra models are 20 to 38k triangles: merge materials at conform).
- Grain cart: needed for the harvest loop (combine unloads into a cart, cart to a truck or silo). Decide later: adapt a Sidra dump trailer (add auger arm) or the user models one.
- Every new cargo vehicle needs a bed entry in dist/cargo.js (standing rule).

## Status update (user, 2026-11-17, later)
- IN THE REPO (assets-src\Farm): `low-poly_tractor_Blue` (JUFF, glTF+bin, license.txt CC-BY-4.0), `tractor_with_tank_low_poly_3d_model` (KidBi-Gaming, glTF+bin+textures, license.txt CC-BY-4.0), `Farm Buildings Bundle-glb` (Quaternius, CC0: Barn, Big Barn, Chicken Coop, Fence x2, Open Barn, Silo House, Silo, Small Barn, Tower Windmill = 10 files) and `Farm Animal Pack-glb` (Quaternius, CC0: Cow, Horse, Llama, Pig, Pug, Sheep, Zebra). The user plans to EVENTUALLY REPLACE the current farm models in the game with these.
- IN THE REPO (assets-src\Landscape): Quaternius Stylized Nature MegaKit [Standard] (FBX, FBX Unity, glTF 68 models + textures, OBJ): for GD4+ ground cover.
- The three Sidra models (combine, second tractor, dump trailers) are NOT free to download (they must be bought): the user will find other tractors/combine/grain cart. Treat them as DROPPED unless the user says otherwise.
- The two tractors' license.txt files give the exact credit lines to put in the public credits (CC BY needs credit before a public release; record in ASSETS.md at import time).
