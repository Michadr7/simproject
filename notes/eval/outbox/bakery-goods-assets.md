michadr.

# Bakery goods assets: flour and coffee beans (owner decision 2026-11-19)
Agent: Opus subagent. New files only. game.js, world.js, map-definition.js, world-goods.js, needs.js, gigs.js, plank-needs.js and every other shared file are untouched. No git, no full `npm test`.

## Files created
| File | Lines / size | What |
|---|---|---|
| scripts/build-bakery-goods.mjs | 147 lines | Generator. No dependencies. Deterministic: I ran it twice and got the same SHA-256 for all 6 files. |
| dist/bakery-goods.js | 30 lines | Pure registry. No DOM, no three.js, no globals. Named exports. NOT WIRED. |
| tests/bakery-goods.mjs | 37 lines | Node assert. Prints one PASS line. |
| dist/assets/goods/flour-sack.glb | 72,120 B | One sack standing up |
| dist/assets/goods/flour-sack-carry.glb | 72,132 B | One sack lying across the arms |
| dist/assets/goods/flour-pallet.glb | 212,524 B | Half pallet with 4 sacks |
| dist/assets/goods/coffee-beans-sack.glb | 73,188 B | One sack standing up |
| dist/assets/goods/coffee-beans-sack-carry.glb | 73,224 B | One sack lying across the arms |
| dist/assets/goods/coffee-beans-pallet.glb | 216,856 B | Half pallet with 4 sacks |
| notes/eval/outbox/bakery-goods-preview.png | image | Software-rendered preview of all 6 models |
| PROJECT-INDEX.md | regenerated | `npm run index` |

Total GLB size is about 720 KB. Everything sits in a new folder, dist/assets/goods. The game loads it the same way as dist/assets/timber (GLTFLoader with document.baseURI). The release script does not copy it, and it does not copy timber either.

## Format and style (matched to the existing assets)
- Built in code with vertex colours and no textures, the same idea as axe-assets and saw-assets. The files are GLBs like the timber models, because cargo loads its large pieces that way.
- Each file holds ONE mesh, ONE primitive and ONE material: white base colour multiplied by COLOR_0, roughness .95, metalness 0, double sided. The material JSON is the same in all 6 files, and the test checks this. So the wiring can make one shared `MeshStandardMaterial({vertexColors:true,roughness:.95,side:DoubleSide})` and add **one InstancedMesh per kind per bed**, the way cargo-view.js already handles crates and boxes (one draw call however many are loaded).
- COLOR_0 is linear, stored as normalised unsigned bytes in VEC4. POSITION and NORMAL are float. Indices are Uint16.
- Origin is the middle of the base, y is up, front is +z, 1 unit = 1 m. The carry model lies with its long side along x, so carry-pose.js `boxPose(size)` takes its size as it is. The registry stores that size as `carrySize`.
- Flour: cream cloth sack, a slight weave and tone noise, a gathered neck with a twine tie and two loose ends, a frayed tuft, and a printed white label patch (a red stamp block and two blue "text" lines).
- Coffee beans: darker jute, two green stripes, black stencil ink on the front.

## Triangle counts
| Model | Triangles | Size x / y / z (m) |
|---|---|---|
| flour-sack | 788 | 0.415 / 0.67 / 0.254 |
| flour-sack-carry | 788 | 0.67 / 0.204 / 0.449 |
| flour-pallet | 2,348 | 0.92 / 0.526 / 0.76 |
| coffee-beans-sack | 800 | 0.438 / 0.63 / 0.276 |
| coffee-beans-sack-carry | 800 | 0.63 / 0.221 / 0.472 |
| coffee-beans-pallet | 2,396 | 0.965 / 0.55 / 0.76 |

Flag: these are much heavier than prop.crate-bin (156 triangles). The triangle caps are soft. Draw calls stay at one per kind per bed when instanced, and material count is one shared material. To make them cheaper, lower `DETAIL` in the generator (`hi` U:16 V:12, `lo` U:12 V:8) and run it again. The test sets a ceiling of 1,000 triangles for a sack and 3,000 for a pallet. The coffee pallet hangs about 2 cm over each side of its 0.92 m pallet, which is deliberate: the sacks are wider than the pallet.

## Registry: dist/bakery-goods.js
- `BAKERY='property:alder-bakery'` and `GOOD_KEYS=['flour','coffee-beans']`.
- `GOODS[key]` holds: `{key, label ('Flour' / 'Coffee beans'), unit:'sack', unitPlural, plural, massKg (25 / 20), baseCents (1800 / 8000), group:'bakery', supplier:null, demand:{place,label,target,max}, models:{sack,carry,pallet}, carrySize}`.
- Demand: flour target 6, max 18; coffee beans target 4, max 12. `PLACEHOLDER=true`, and a comment in the file says that prices, masses and stock numbers are placeholders.
- Supplier: `SUPPLIER=null` and `SUPPLIER_LABEL='supplier: TBD'`. `SUPPLIER_NOTE` explains that the Eastbank Building Supplier is the wrong place (it sells planks) and that nobody sells these goods yet.
- `DEMAND` uses the plank-needs.js shape `{good:{[BAKERY]:{label,target,max}}}`, so a qtyFor-style rule can reuse it.
- Helpers: `isBakeryGood`, `goodOf`, `modelPath(key,variant)`, `priceOf(key,n)`, `palletsOf(n)`, `VARIANTS`, `SACKS_PER_PALLET=4`, `MODEL_DIR`.

## Tests (real output)
```
> node tests/bakery-goods.mjs
PASS bakery-goods: 2 goods, 6 models (flour-sack 788, flour-carry 788, flour-pallet 2348, coffee-beans-sack 800, coffee-beans-carry 800, coffee-beans-pallet 2396 triangles), supplier TBD
> node tests/assets.mjs   -> exit 0 (prints only its usual WARNING lines about assets-src originals)
> node tests/credits.mjs  -> exit 0
> npm run index
brief 2834 tokens (target 3000), index 35069 tokens (target 37000); 263 modules, 14 generated, 321 tests, 32 scripts; 13 modules without a header comment
> node tests/brief.mjs
brief tests passed: 263 modules listed, brief 2834 and index 35069 estimated tokens (budgets 3000 and 37000)
```
The test checks:
- Names and model paths are unique; prices and masses are positive whole numbers; target and max are the asked values.
- Each file exists and is valid: GLB header, BIN chunk, 4-byte aligned views, indices in range.
- One mesh, one primitive and one material per file, and the same material in every file; vertex colours; no textures.
- The base is at y 0 and the model is centred on x and z; sizes are in range; triangle counts are within budget.
- `carrySize` matches the carry model within 1 cm.

## What I could NOT verify
- **I have not seen the models in the game or in three.js.** The only check is `notes/eval/outbox/bakery-goods-preview.png`, from a small software rasteriser I wrote in my scratch folder (not in the repo): Lambert lighting with vertex colours, two views. It shows the sacks, ties, tufts, labels, stripes and pallet as intended, with no inside-out faces I could spot. GLTFLoader's handling of these files (vertexColors turned on by COLOR_0) comes from reading the loader code (GLTFLoader.js:3580/3639), not from running it.
- How the colours look under the game's lighting, tone mapping and bloom. The ink and the green may come out darker in game.
- The carry pose with a 0.45 m deep sack at the belly. boxPose accepts any size, but nobody has looked at the arms.
- I did not run `npm run release` or `npm test`, because another agent is editing game.js and the rules said not to. assets.mjs, credits.mjs and brief.mjs pass with the new files present.
- ASSETS.md and credits.js do not list these yet. They are the owner's own code-built work, so no credit is needed, but a hub register entry may be wanted. assets.mjs did not fail, because the hub derives assets from dist modules and not from dist/assets folders.

## Wiring request for the game.js lane (ONE Opus run; none of this was done)
1. **Remove the bakery from plank demand.** In dist/plank-needs.js:15, delete `'property:alder-bakery':Object.freeze({label:'Ironwood Bakery',target:8,max:24}),` from `DEMAND`. world-tick.js:86 loops over `PLANK_DEMAND`, so the bakery drops out of `plankStock` by itself. needs.js:138 only accepts carried planks when `n.place in PLANK_DEMAND`. **Old saves:** an open bakery plank need would then fail that check and go to `deliver()`, which would put planks into a place that has no planks good. Either expire open `restock|property:alder-bakery|planks` needs in needs.js load/normalise, or keep the place in a `LEGACY_PLANK_PLACES` set for the carried branch. Old-save tests are needed either way (Neo hit this before: outbox/P-E-wiring.md).
2. **Bakery stock.** world-goods.js PLACES['property:alder-bakery'].goods currently has only `bread`. Two options:
   - (a) Add `flour:g(6,18,6,{daily:2})` and `'coffee-beans':g(4,12,4,{daily:1})` (daily use = PLACEHOLDER) plus the two GOODS rows (`group:'bakery'`, `unit:'sack'`, baseCents from bakery-goods.js). This changes the world.stock save shape. Check tests needs-loop, needs, world-* and the normalise step for missing goods.
   - (b) Keep world-goods.js as it is and copy the P-E pattern: a pure `bakery-needs.js` (the plankNeedsFrom shape, reading `DEMAND` from bakery-goods.js and a `ctx.bakeryStock`), merged in needs.js after the plank merge (needs.js ~98-101), with world-tick.js picking a low stock the way it does at line 86.

   I recommend (b) for the first run, because it does not touch the save shape. Which one is the owner's call (see the questions below).
3. **needs.js:138** `fill()`: add `|| (isBakeryGood(n.good) && n.place===BAKERY)` to the carried branch, so carried sacks are accepted without `deliver()`.
4. **gigs.js:127** `isHaulGood`: add `isBakeryGood(g)`.
   - gigs.js:272 `pickNeedHaul`: add a bakery-goods branch next to the planks branch. The source is the supplier, and **this cannot be built until a supplier is named.** As a stopgap it could load from any place, or the gig could be "buy at <supplier> and carry", priced with `priceOf`.
   - gigs.js:257 / :304 give-back: only when the origin is a world place.
5. **Cargo.** cargo-items.js `ITEM_KINDS` needs a `sack` kind (hand:true, stackable:true, speedMul like the crate, unitKg from `GOODS[key].massKg`, and a `good` field). cargo.js CARGO_KINDS needs a size of about 0.45 x 0.22 x 0.67 lying, and the saved piece is `{k:'sack',g:'flour'}`. cargo-view.js: one InstancedMesh per good, made on the first sack, from the GLB loaded like TIMBER in game.js:425: `['flour','coffee-beans'].map(k=>loadAsync(new URL(modelPath(k,'carry'),document.baseURI)))`. carry-pose.js `poseFor`: treat `kind==='sack'` like crate or box (`'box'` pose) and pass `GOODS[key].carrySize` to `boxPose`.
6. **game.js.** Load the 3 GLBs per good after the timber load (game.js:425). Show the carry model in the hands. Put a pallet model at the supplier pickup and at the bakery drop-off while a need is open. The drop-off at `NEED_POINTS['property:alder-bakery']` (needs.js:34) is the same place the plank drop uses.
7. **Text.** gig-bridge.js tracker: 'Load the sacks of flour at <supplier> (E)', using `GOODS[key].plural`.

## Questions for the owner
1. Who sells flour and coffee beans? It could be the Corner Market (shop:market), a new mill or roaster off the map (an import like the gas TRUCK), or Willow Farm for the flour. Right now it is 'supplier: TBD'.
2. For the bakery stock, do you want (a) the real world-goods.js stock (changes the save shape) or (b) the P-E style side table (no save change)? I recommend (b) first.
3. Are the placeholders right?
   - Flour: $18 for a 25 kg sack. Coffee beans: $80 for a 20 kg sack.
   - Daily use: the targets 6 and 4 are yours; the daily use is not set yet.
   - Does the bakery actually use up flour and coffee, so that bread output depends on flour?
4. Should one sack be carried in the hands slowly, like a crate, or is a pallet a forklift or flatbed-only piece?
5. Are 800 triangles per sack and 2,400 per pallet acceptable, or should I halve them? It is one generator setting.

## Confidence
- Registry and test: high. Ran it; it passes.
- GLB validity and determinism: high. Checked by the test and by hashing two runs.
- Look: medium. Checked only in my own software render, never in three.js or in the game.
- Size and scale feel: medium. 25 kg sack proportions, not checked against the character in the game.
- Wiring plan: medium. Line numbers are from today's files, and the game.js lane must re-check them because another agent is editing game.js now.
