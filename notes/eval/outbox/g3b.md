michadr.

# G3b CRATES + CARDBOARD BOXES [DONE, uncommitted, nothing seen in a browser]

## What was built
1. **Import (scripts/build-props.mjs, real run, TOOL_DIR with meshoptimizer, sharp, three 0.160)**
   - 6 cartons from AssetsFactory FBX (the existing readFbx + `albedo` path, as for the fuel can; FBX loads in metres, scale 1): `prop.carton-small` (ShipSmall_clean, 768 tris, 0.30 x 0.20 x 0.15 m), `-small-dirty` (1,192), `-small-crushed` (2,674, 0.35 x 0.25 x 0.09), `prop.carton-medium` (1,356, 0.40 x 0.30 x 0.30), `-medium-dirty` (2,308), `prop.carton-cube` (1,232, 0.35 m). BaseColor jpg only, 256 px JPEG 85, ONE material, ONE mesh each. Sources copied to `assets-src/Boxes/fbx` + `textures` (+ LICENSE-AssetsFactory.txt).
   - 2 crates from Fab Cargo.glb: **Blender was not used and the 317 MB file was never loaded whole.** New `scripts/extract-cargo-crates.mjs` reads only the JSON header and the needed byte ranges, bakes the node scale into positions, resizes the one 2048 px texture to a 256 px JPEG and writes small GLBs to `assets-src/Boxes/cargo/`. `prop.crate-wood` = node "Crate v1": 0.757 x 0.745 x 0.492 m, 284 tris, 33 KB glb. `prop.crate-bin` = node "Crate 3.v1": 0.577 x 0.378 x 0.435 m, 156 tris, 25 KB glb. "Crate 2" (flat tray 0.85 x 0.83 x 0.22 m) measured, not imported; pallets not imported (prop.pallet is enough). Pivots: base centre on y 0 (verified by test).
   - **Size:** props-assets.js 6,974,968 -> 7,425,115 bytes = **+0.45 MB, startup module** (limit about 1.5 MB). Not lazy: cartons are for street gigs, all 8 are small. props-assets-farm.js untouched in content (65 farm props, tests pass).
   - Registers: ASSETS.md new section (licences summarised), assets-register.json 2 rows (AssetsFactory Asset License v2.0; Fab Standard License), credits.js 2 rows (credits.mjs requires a credit for every shipped source, so the project does this; optional for both licences, urls are https://www.fab.com).
2. **Gig parcel** (gig-parcel.js + game.js syncParcel): new pure `parcelModelId(active)`, `PARCEL_MODELS`, `PARCEL_DEFAULT`. Ordinary gig = carton-small, large gig = carton-medium; dirty variant by a fixed FNV hash of client + id (about 2 in 7, no random). ONE pooled mesh: it swaps geometry and material from lazily-made prototypes that are never added to the scene (old prop.box-small is no longer used by the parcel). Material count: still 1 mesh, 1 material in use at a time (the textured carton material replaces the vertex-colour box material, so no net +1 material vs G2b; at most 4 prototype materials exist unrendered). 1 shadow draw while visible.
3. **Cargo piece 'crate'** (cargo.js, cargo-view.js): `{k:'crate'}`, 2 space units, 0.58 x 0.38 x 0.44 m. Beds with `crates:true`: shortbed (22 crates of 44), worktruck (16), offroad (16); the timber flatbed refuses. Crate-only beds: no mixing with timber either way (CRATE_MIX), never carried by hand (CRATE_HANDS), normalizeCargo drops crates on a bed that refuses them and lets timber win in a bad save. Layout: 3 across the Shortbed deck, rows front to back, stacked max 2 high (all inside the deck rectangle, tested). New `addCrates`, `removeCrates`, `acceptsCrates`, `hasCrates`. View: crates are **ONE InstancedMesh per vehicle (one draw call however many, 22 = 1), made on the first crate, sharing one geometry and one material across vehicles, count 0 when empty**; flatbed never builds one.
4. **Hal's story** (starter.js + game.js): starter.js exports `STORY_CRATES = 4`, `storyPalletHidden(s)`, `storyDeck(s,cargo,model)` (pure; returns `{cargo}` when the deck must change, else null). game.js `syncStoryCargo(s)` runs from storyTick every frame (cheap): on `loaded` four crates go on the loan Shortbed deck via driving.setCargo; on `delivered-crates` they come off; the check is every frame so a driving.sync from the saved list cannot lose them. The pallet 'farm-egg-crates' is hidden by **scaling the landmark mesh to 0.001** (found once by scene.traverse by name and position at start and on each state change) and restored to 1 afterwards. Loading is refused with "Clear the timber off the deck first." if the loan truck's bed holds timber. The story flag logic is unchanged; G3 tests still pass.
5. **forest.js guards (G2b leftover)**: takeFromRack and takeLogFromPile refuse while the gig box is in hand (`PARCEL_HANDS`; "Your hands are full." first if a log or planks are in hand). In game.js the same guard added to getOnFork and to enterVehicle and takeNozzle (both had the identical one-line carry check).

## Files changed (line counts now)
dist/cargo.js 133, dist/cargo-view.js 28, dist/gig-parcel.js 28, dist/forest.js 116, dist/starter.js 129, dist/game.js 1625 (6 single-line anchors + one new function block, each checked, node --check ok), dist/credits.js 23, dist/props-assets.js (generated, 7.43 MB), scripts/build-props.mjs (+2 entries blocks, 8 + 2 prop records), scripts/extract-cargo-crates.mjs (new, 1 file), ASSETS.md, assets-register.json (57 rows), assets-src/Boxes/ (new: fbx 6, textures 6, cargo 2 glb, licence). Tests: tests/cartons.mjs NEW; edited cargo.mjs (+crate block), props.mjs (EXPECT +8 props), gig-parcel.mjs (+model block), starter-game.mjs (+storyDeck block), forest.mjs (+guard), warehouse.mjs (+guard), atv-import.mjs (size cap re-pinned 7.2 -> 7.7 MB). **map-definition.js not edited** (the pallet landmark is unchanged). **world.js not edited.**

## Real test output
- `npm run release -- --force`: `Packaged release 0.35.9: 183 files -> dist/releases/0.35.9`
- `npm run index`: `brief 2996 tokens (target 3000), index 27288 tokens (target 32500); 182 modules, 13 generated, 226 tests, 27 scripts; 14 modules without a header comment` (cap 32500 not raised; under it by 5,212)
- First `npm test` (before credits/atv re-pin): `FAILED FILES: atv-import.mjs, credits.mjs / 2 of 226 test files failed.` Both were my doing (props-assets size cap 7.2 MB in atv-import; credits.mjs needs a credit for every shipped source). Fixed (re-pin + 2 credits rows), re-ran each alone: `ATV import: PASS (...)` and `Credits: 18 entries cover all 163 shipped models (...)`.
- Second full run (release + index + npm test): `ALL 226 PASSED` / `All 226 test files passed.` No FAILED FILES, no PASSED ON RETRY lines.
- Single runs: `PASS cartons.mjs: 6 cartons and 2 crates at true size, one 256 px jpeg and one material each (one draw call), centred on the ground, startup module +0.45 MB, cargo.js crate = the model`; `PASS cargo.mjs ...`; `gig-parcel ok`; `starter-game ok`; `PASS forest.mjs ...`; warehouse.mjs passes.
- Parallel lane: pets/GD4 files were counted in the 226 and passed when run; I did not touch them.

## Draw calls / materials / shadows
Each carton: 1 mesh, 1 material, 1 draw + 1 shadow draw. Parcel: 1 mesh (swapped). Crates on a deck: 1 InstancedMesh, 1 material, 1 draw + 1 shadow draw regardless of count (cap 22); idle (count 0) costs nothing visible. Pallet hide: 0.

## Eye-check list for the GPU browser (nothing could be seen)
1. Carton look in arms: small clean/dirty at (0,1.0,0.36); is 0.30 x 0.20 x 0.15 m too small compared with the old 0.40 x 0.30 x 0.30 box? (large gigs get the medium one). Texture orientation (v flipped like the fuel can) and that the carton is not upside down or sideways in the arms.
2. Dirty vs clean appearance on different gigs; a dropped box on the ground (X) sits on the ground, not floating or sunk (pivot is the base centre).
3. Hal's crates: Shortbed deck shows four crates in the front row, three across, sitting on the deck (not sunk or floating; deck y 1.0), inside the side walls.
4. Texture of crate-bin on the deck (16 KB jpeg at 256 px: may look blurry or wrong colour).
5. Pallet at (-66,-235.4) vanishes when you press E to load and returns after delivery. Note the pallet's collider stays (invisible 1.2 x 0.94 m box).
6. Crates leave the deck at the market after "Hand the egg crates to Noah". Save and reload mid-beat: crates still on the deck and pallet still hidden.
7. Knocks still cost quality with crates on the deck.
8. Picking up a rack plank, a pile log, getting on the forklift, entering a vehicle or taking a nozzle with the box in hand each gives the "holding the parcel" message.

## Defaults chosen
2 crate models (wood 0.76 m and the bin 0.58 m), the bin is the deck crate; crate = 2 space units; crate-only beds; 3 across, max 2 high; dirty parcel 2 in 7; large gig = medium carton; 4 story crates; hide pallet by scaling, only while `loaded` (it comes back after delivery); no credit required but credits rows added because credits.mjs demands one per source.

## Leftovers / needs from forbidden files
- **world.js (optional)**: the pallet landmark's collider cannot be removed without it. Exact edit: export `landmarks` (or a `setLandmarkVisible(id,v)`) from the world object so game.js can toggle the id 'farm-egg-crates' and its collider; today only the mesh scale is changed.
- `prop.crate-wood`, `carton-small-crushed`, `carton-cube` are imported but unused so far (crate-wood is meant for crate gigs / D6); carton-small-crushed for a hard-drop look.
- Crates are not in the Cargo panel (no row; they cannot be taken off by hand) and not sellable; a farm crate gig would use addCrates/removeCrates.
- Blender 5.2 was not run (the node extractor was simpler and read only the needed bytes); store pictures not touched; game.js wiring has no automated script test (the pure pieces storyDeck/parcelModelId do).
- The Cargo pack's other nodes (boxes, pallets) remain unimported; the source file stays in `Assets Sim Project` only.

## Confidence
Import, sizes, cargo rules, view mesh counts, storyDeck and parcelModelId: high (tested). game.js wiring (traverse finds the pallet by name 'prop-prop.pallet-crate' and position; syncParcel swap; guards): medium, node --check only. Visual correctness: unverified.
