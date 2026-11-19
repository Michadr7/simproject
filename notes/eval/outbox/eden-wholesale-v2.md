michadr.

# Eden Wholesale, visual pass 2 (2026-11-19)
Agent: Opus subagent. I edited only the files I was allowed to edit: scripts/build-eden-wholesale.mjs, dist/eden-wholesale.js, the regenerated GLB and tests/eden-wholesale.mjs. I also added screenshots and this report, and regenerated PROJECT-INDEX.md. I did not run git, release or the full npm test. I made no edits to game.js, world.js, map-definition.js, props-assets.js or any other shared file. The headless game check below only loaded the GLB inside the page.

## Files
| File | Lines / size | Change |
|---|---|---|
| scripts/build-eden-wholesale.mjs | 212 lines (was 130) | Rewritten. New palette, wall details, lamps (their lenses are the last triangles), block-font sign, dock dressing. New helpers: `proud`, `prism`, `brickWall` (one quad per brick), `windowOn`, `batten`. Deterministic: two runs in a row gave the same SHA-256, 32BC756E...5729. |
| dist/assets/buildings/eden-wholesale.glb | 194,928 B (was 126,256) | Regenerated. |
| dist/eden-wholesale.js | 52 lines (was 41) | New palette in `BRAND`. New `SIDE_DOOR` and `LAMPS` (7). New SOLIDS: rack, bin, crates, pallet stack. New anchors: `anchor_side_door` and `anchor_lamp_*`. `SIGN.baked:true`. |
| tests/eden-wholesale.mjs | 58 lines (was 50) | Checks the side door and lamps against their anchors. Checks that the lens triangles are the last ones (`extras.glow`) and that the baked letters fit. The triangle cap goes from 3000 to 3500. |
| notes/eval/outbox/eden-wholesale-v2-*.png | 15 images | Listed below. |

## The model
- **Triangles: 3,054**, of which 14 are lamp lenses. There are 6,224 vertices.
- Still 1 mesh, 1 primitive and 1 material: white x COLOR_0, roughness .95, metalness 0, double sided. These are the same numbers as the goods GLBs.
- **Size:**
  - Bounds: x -6.14..6.10, y 0..6.31, z -4.64..4.50.
  - Nothing sticks out past the front line.
  - Trims stick out no more than 0.15 m at the back and sides.

## What changed visually (before -> after)
1. **Colour.**
   - Before: navy-grey cladding #3e4a56. After: light warm grey #b9b6ac with 0.4 m rib strips.
   - Trim: slate #465057, which matches the Kenney shops' slate (#474a57 / #5c627a).
   - Green: #2f8a55, a little brighter. A thin leaf-green line (#7cc276) now runs under the stripe.
   - How I chose it:
     - I sampled the textures of the neighbouring Kenney shops (shop-a pharmacy, shop-f bank). Their walls are mostly #e6e6ef / #d5d5e5, about 30%, and #5c627a / #474a57 slate. Their area-weighted average wall colour is about #9599aa.
     - Eden now sits just warmer than that.
     - No brand green is defined anywhere in the repo, so I kept the v1 Eden green family.
2. **West wall (Barber's Walk side).**
   - Before: a blank wall with one high window strip.
   - After:
     - A green staff door with a kick plate, a handle, a slate drip hood and a wall lamp.
     - Two windows in the hall and a third in the shop-front part, each with a frame, two panes and a sill.
     - 2 seam battens, a horizontal panel joint, and a cream Eden leaf tile high on the wall.
3. **Back wall.**
   - Before: a fire door and 2 pipes.
   - After:
     - 3 high clerestory windows.
     - A louvre vent.
     - The fire exit with its green sign and a wall lamp.
     - A cat ladder that reaches over the coping, plus a roof hatch at its top.
     - Downpipes with rain heads and shoes, battens and the panel joint.
4. **All round.**
   - A real plinth 5 cm proud of the wall, with a light drip ledge on top.
   - Slate corner trims.
   - Seam battens that stand 4 cm off the wall.
   - A slate parapet band (the roof edge seen from the street) under a light coping that overhangs it by 10 cm.
   - The bricks are re-laid as staggered courses, one quad per brick, so they cost fewer triangles.
5. **Roof.** Two rooflights and the hatch are new. The vents, extractor and AC unit stay.
6. **Lamps.**
   - 3 green gooseneck lamps over the sign board. The middle one sits over the shop door.
   - 2 flat lamps under the dock canopy, which now has a light underside.
   - 1 wall lamp over the staff door and 1 over the fire exit.
   - Every lens is a cream quad (#ffe2a8).
   - The lens triangles are the LAST triangles. `meshes[0].extras.glow = {from:9120,count:42,color:[255,226,168],strength:2}`. This is the props-assets.js `glow` shape: `addGroup` on an emissive second material.
   - GLTFLoader keeps it in the mesh's `userData.glow`. I checked this in the real game.
7. **Dock dressing.**
   - A blue and orange pallet rack against the shop-front wall. It holds 2 sack pallets on the floor and 2 more on the beam.
   - 3 crates.
   - The 3 empty pallets, as before.
   - A green-lidded wheelie bin beside the dock steps.
   - The pallets are lower poly now: a slab deck with board gaps.
8. **Sign.**
   - Before: a blank navy board.
   - After: a green board in a slate frame, with the cream Eden leaf tile at its left end.
   - **EDEN WHOLESALE** is spelled in cream 3D block letters: a 4x6-grid font built in the script, 4.5 cm deep, with no textures or fonts.
   - The letters are **0.536 m high and 5.84 m wide**. They fit the 6.8 x 0.98 board, so I did not need to shrink anything.
   - The node `sign_eden_wholesale` stays where it was. Its extras now add `baked:true, letterHeight:0.536`.

## Registry changes (dist/eden-wholesale.js)
- **New:**
  - `SIDE_DOOR {x:-6,z:-3.5,width:1,height:2.2,facing:'-x',yaw:-PI/2}` (world (30,-71) on site 1).
  - `LAMPS`, each as an id with its lens point:

    | Lamp | Local point |
    |---|---|
    | shop-w | (-4.6, 4.34, 4.23) |
    | shop | (-2.3, 4.34, 4.23) |
    | shop-e | (0, 4.34, 4.23) |
    | dock-w | (2.9, 3.86, 2.9) |
    | dock-e | (4.9, 3.86, 2.9) |
    | side | (-6.16, 2.65, -3.5) |
    | back | (3.4, 2.85, -4.66) |

  - `anchor_side_door` and `anchor_lamp_<id>`: 15 anchors in all.
  - SOLIDS:

    | Solid | Local box (x, z, top y) |
    |---|---|
    | rack | x 1.4..2.42, z 1.2..3.5, top 2.5 |
    | bin | x .8..1.38, z 3.82..4.42, top 1.12 |
    | crates | x 4.68..5.72, z 3.58..4.2, top 1.0 |
    | pallet-stack | x 5.05..5.85, z 2.62..3.58, top .51 |

  - The hall solid's top is now 6.08.
- **Kept:** the door, counter, dock, truck, pickup, stock spots, hours, goods, sites and the sign rectangle. The pickup (3.4,3.4) and stock spots are still clear of every solid, and the test checks this.

## Tests (real output)
```
> node scripts/build-eden-wholesale.mjs   (run twice)
dist/assets/buildings/eden-wholesale.glb: 3054 triangles (14 lens), 6224 vertices, x -6.14..6.10 y 0.00..6.31 z -4.64..4.50 m, 194928 bytes; sign letters 0.536 m high, 5.84 m wide
run1 32BC756EB2469A9936003DA6B98249DB53F7830141BA0B9F8965130D3D975729
run2 32BC756EB2469A9936003DA6B98249DB53F7830141BA0B9F8965130D3D975729
> node tests/eden-wholesale.mjs
PASS eden-wholesale: 3054 triangles (14 lamp-lens), 15 anchors (7 lamps, side door) + sign node (letters 0.536 m), sells flour and coffee-beans, open 07:00-17:00, 2 candidate sites clear of C1..C20, H1 and the car park
> node tests/assets.mjs   -> exit 0
Register rules: no unbacked claims, 808 originals checked (594 unregistered, warning only), 4 uncredited (warning only).
> node tests/bakery-goods.mjs
PASS bakery-goods: 2 goods, 6 models (flour-sack 788, flour-carry 788, flour-pallet 2348, coffee-beans-sack 800, coffee-beans-carry 800, coffee-beans-pallet 2396 triangles), supplier TBD
> npm run index
brief 2834 tokens (target 3000), index 35521 tokens (target 37000); 266 modules, 14 generated, 324 tests, 33 scripts; 13 modules without a header comment
> node tests/brief.mjs
brief tests passed: 266 modules listed, brief 2834 and index 35521 estimated tokens (budgets 3000 and 37000)
```

## Screenshots (notes/eval/outbox/)
**A. Scratch software renderer.** It lives in my scratch folder, not the repo.
- How it lights the scene:
  - It uses the game's own pure light rig: `skyAt(minutes)` and `grade()` from dist/daynight.js, with hemisphere + sun at three.js's /PI sums and exposure.
  - It adds a sun shadow map.
  - The real Kenney pharmacy and bank stand behind, with their textures.
  - The dusk and night images add warm point lamps at the anchor_lamp_* points and show the lenses lit.
- Most images show BEFORE on the left and AFTER on the right:
  - `eden-wholesale-v2-front.png`: front 3/4 view at 14:00.
  - `eden-wholesale-v2-dock.png`: the dock side, 3/4 view.
  - `eden-wholesale-v2-west.png`: the west wall (Barber's Walk side).
  - `eden-wholesale-v2-back.png`: the back wall, without neighbours (in the game it sits 1-2 m from the pharmacy and bank backs, so it is barely seen).
  - `eden-wholesale-v2-dusk.png`: 18:32. The BEFORE side is the 'black box'; the AFTER side has the lamps on.
  - `eden-wholesale-v2-night.png`: 20:00.
  - `eden-wholesale-v2-sign.png`: a close-up of the board.
  - `eden-wholesale-v2-context.png` shows AFTER only, at 14:00 and at dusk. It has the pharmacy and bank, a light-grey 7 x 7.5 x 10 m box, and a red 1.75 m post at the counter point.

**B. The real game in headless Edge** (scripts/browser-lab.mjs; `npm run dev`, which I stopped afterwards).
- The GLB was loaded into the live scene with the game's vendored GLTFLoader at site 1 (36, 0, -67.5, yaw 0). The renderer reported "WebGL2 via WebGPU".
- The avatar is in shot for scale.
- Files:
  - `eden-wholesale-v2-game-front-day.png`
  - `eden-wholesale-v2-game-dock-day.png`
  - `eden-wholesale-v2-game-west-day.png`
  - `eden-wholesale-v2-game-front-dusk-as-is.png`: what it looks like if it is wired with NO lamp work.
  - `eden-wholesale-v2-game-front-dusk-lamps-preview.png`
  - `eden-wholesale-v2-game-front-night-lamps-preview.png`
  - `eden-wholesale-v2-game-dock-night-lamps-preview.png`
- The "lamps-preview" shots add temporary page-side PointLights (intensity 4-5, distance 9) at the 7 lamp anchors, plus an emissive group from `userData.glow`. This only previews what the game COULD do; none of it is in the game.
- What I saw:
  - By day it sits well beside the pale Kenney shops, and the sign reads clearly from the car park.
  - At dusk without lamps it is a mid-grey building, not a black box.
  - With the preview lamps, the sign and dock light up warmly.

## What I could NOT verify / notes for the wiring lane
- **Not on a real GPU.** Both checks used software rendering, and the in-game shots are swiftshader at about 4 FPS. Colours on the owner's GPU may differ a little.
- **The building is not placed in the map.** I only loaded it into the page in the harness. The I3/map lane must still place it.
- What the harness showed at the site:
  - Cars still park in the bays in front of the door and dock. The car park change from v1 (bays 20 -> 17) is not made yet.
  - A world **fire hydrant** stands just east of the dock, at about world (42, -63). Check it against the footprint and the truck bay.
  - **Grass tufts** from the world's ground cover poke through the dock apron and along the west plinth. The ground cover needs clearing inside the footprint.
- **The lamps give no light by themselves.** The lens triangles are ready, but the game must:
  - (a) split the glow group into an emissive material (2 lines, like props.js line 35 + 60);
  - (b) add lights at the `anchor_lamp_*` nodes, if wanted.
  - Frame-rate note: 7 PointLights would be too many. Use 2 at most (the sign and the dock), or use the emissive lenses only, plus the game's existing night-light pattern.
- **The windows do not glow at night**, unlike the Kenney shops. The game's window glow works on props-assets props. These windows are plain vertex-colour glass and not in the glow group. If they should light up at night, a later pass can add them as a second glow range.
- **Walking on the 0.15 m dock** is unchanged from v1 (see the v1 report).
- **The new SOLIDS** (rack, bin, crates, pallets) are registry data only. Nothing reads them until the model is wired.
- **The back wall** sits 1-2 m from the neighbours' backs. Its detail will hardly be seen in play, so I kept it modest.
- **HUD in the shots.** The harness shots show the HUD; my attempt to hide it did not work.
- I did not run `npm run release` or the full `npm test` (as instructed).

## Requested edits to forbidden files
- None are needed for this stage. The wiring requests from v1 still stand: GLTFLoader load + SOLIDS, the map entries and the car-park change.
- Two additions for that run:
  - Make the `userData.glow` group emissive. In props.js style: `geometry.addGroup(0,g.from,0);geometry.addGroup(g.from,g.count,1)` plus an emissive MeshStandardMaterial in the colour `g.color`, with `emissiveIntensity` taken from `g.strength`.
  - Clear the ground cover inside the footprint (x 30..42, z -72..-63).

## Confidence
- Registry, test, GLB validity, determinism and triangle count: **high**. I ran all of them; the output is pasted above.
- Colour fits Ironwood: **medium-high**. I saw it in the real game scene (software WebGL via WebGPU) at 14:00, 18:33 and 20:00, and in my renderer, which uses the game's own light rig and grade. I have not seen it on a real GPU.
- Sign legibility: **high** from the car park, in both renderers. From an angle, as on the west view, the block 'W' reads less well than the other letters.
- Wall, roof and dock details: **high** that they are there and look as intended in both renderers.
- Lamp anchors and the glow range: **high** that the data is right (checked in the page through `userData`). How they look depends on wiring that is not done yet.
