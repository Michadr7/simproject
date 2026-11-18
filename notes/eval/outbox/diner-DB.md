michadr.

## Summary & Scope
Delivered stage **D-B** (models, sounds, `dist/diner-sounds.js`, `tests/diner-assets.mjs`, `ASSETS.md`, `assets-src/diner/`) without touching any shared runtime files (`game.js`, `audio.js`, `shops.js`, `map-definition.js`, `notes/handoff.md`, `scripts/build-index.mjs`).

## Files Created or Changed
- `assets-src/diner/build_diner_models.py` (954 lines): headless Blender 5.2 script generating `diner_atlas.png` (256x256 nearest-neighbour), `diner_models.blend`, all 9 GLBs, and 24 preview PNGs (`preview_*.png`).
- `assets-src/diner/README.md` (46 lines): model specs, rebuild command, and full CC0 sound table.
- `dist/assets/diner/*.glb` (9 GLBs): `espresso_machine.glb`, `coffee_grinder.glb`, `flat_grill.glb`, `pizza_oven.glb`, `prep_board.glb`, `cash_register.glb`, `menu_board.glb`, `tableware.glb`, `food_parts.glb`.
- `dist/assets/sounds/diner-*.ogg` (15 mono 22.05 kHz Ogg Vorbis files, 228,939 B / 223.6 KB total).
- `dist/diner-sounds.js` (41 lines): pure registry (`DINER_SHOTS`, `DINER_LOOPS`, `DINER_FILES`, `DINER_MAX_FILE_BYTES`, `DINER_MAX_TOTAL_BYTES`) and pure `pickShot(kind, random, last)` helper.
- `tests/diner-assets.mjs` (106 lines): binary GLB parser + asset budget/anchor/recipe-part/pivot test + binary Ogg Vorbis + `diner-sounds.js` purity test.
- `ASSETS.md` (621 lines, +41 lines appended): Diner D-B models and CC0 sound provenance table.
- `PROJECT-INDEX.md` / `PROJECT-BRIEF.md`: regenerated via `npm run index` (index 34,167 / 36,000 tokens).

## Models (Total: 2,464 triangles across all 9 GLBs; 11 room fixture meshes = +9 net draw calls over the 2 replaced counter boxes)

| GLB | Tris | Size W x H x D (m) | Meshes | Anchors |
|---|---|---|---|---|
| `espresso_machine.glb` | 258 | 0.640 x 0.469 x 0.491 | `Espresso_Body` (226), `Espresso_Lever` (32) | `anchor_cup_tray`, `anchor_portafilter`, `anchor_steam_puff`, `anchor_lever`, `anchor_button`, `anchor_sound` |
| `coffee_grinder.glb` | 144 | 0.200 x 0.444 x 0.245 | `Grinder_Body` (144) | `anchor_portafilter`, `anchor_button`, `anchor_sound` |
| `flat_grill.glb` | 176 | 0.780 x 0.210 x 0.532 | `Grill_Body` (140), `Grill_Spatula` (36) | `anchor_patty`, `anchor_egg`, `anchor_toast`, `anchor_spatula`, `anchor_sound` |
| `pizza_oven.glb` | 218 | 0.940 x 0.550 x 0.570 | `Oven_Body` (178), `Oven_Peel` (40) | `anchor_pizza`, `anchor_peel`, `anchor_timer`, `anchor_sound` |
| `prep_board.glb` | 48 | 0.500 x 0.041 x 0.340 | `Prep_Board` (48) | `anchor_plate`, `anchor_stack`, `anchor_knife` |
| `cash_register.glb` | 162 | 0.508 x 0.325 x 0.359 | `Register_Body` (86), `Service_Bell` (76) | `anchor_drawer`, `anchor_bell`, `anchor_sound` |
| `menu_board.glb` | 14 | 1.600 x 0.840 x 0.047 | `Menu_Board` (14) | `anchor_board` |
| `tableware.glb` | 336 | max 0.260 x 0.185 x 0.260 | `plate` (56), `cup_mug` (52), `cup_demitasse` (52), `glass` (20), `cup_iced` (52), `cup_takeaway` (60), `milk_pitcher` (44) | `anchor_top_<name>` on each |
| `food_parts.glb` | 1,108 | max 0.230 x 0.076 x 0.230 | 33 stackable parts (12–76 tris each, all < 150 tris, base pivot `y = 0`) | `anchor_top_<part>` on each |

Food parts in `food_parts.glb`: `bacon` (24), `basil` (24), `bread_bottom` (24), `bread_top` (24), `bun_bottom` (40), `bun_top` (76), `cheese` (12), `club_stack` (72), `cocoa` (20), `coffee_grounds` (20), `cold_milk` (20), `dough_base` (56), `espresso_shot` (40), `fried_egg` (36), `fries` (48), `grilled_cheese` (36), `ham` (24), `hot_water` (20), `ice` (36), `lettuce` (32), `milk_foam` (20), `mozzarella` (28), `mushroom` (36), `olives` (48), `onion` (36), `patty` (20), `pepper` (36), `pepperoni` (64), `sauce` (24), `steamed_milk` (20), `tea_bag` (24), `tomato` (40), `tomato_sauce` (28). Covers 100% of `dist/diner-recipes.js` parts.

## Sounds (All CC0 1.0, Mono 22.05 kHz Ogg Vorbis; Total: 228,939 B / 223.6 KB < 400 KB)

| File | Kind | Measured Dur | Peak (dBFS) | RMS (dBFS) | Size | Source (CC0 1.0) |
|---|---|---|---|---|---|---|
| `diner-espresso-pump.ogg` | loop | 3.20 s | -6.3 | -19.9 | 23,652 B | Freesound 333948 (`Cafezz`) |
| `diner-espresso-steam.ogg` | loop | 3.20 s | -6.7 | -19.8 | 23,727 B | Freesound 671561 (`Lynnjamin`) |
| `diner-steam-shot.ogg` | shot | 0.86 s | -3.7 | -16.1 | 9,070 B | Freesound 538898 (`AGFX`) |
| `diner-grinder.ogg` | loop | 3.20 s | -4.4 | -19.8 | 23,906 B | Freesound 477981 (`organicmanpl`) |
| `diner-pour.ogg` | shot | 1.96 s | -4.0 | -28.6 | 21,668 B | Freesound 489741 (`ShadowSilhouette`) |
| `diner-grill-sizzle.ogg` | loop | 3.20 s | -2.0 | -19.6 | 24,495 B | Freesound 473720 (`Joao_Janz`) |
| `diner-grill-flip.ogg` | shot | 1.40 s | -2.3 | -16.6 | 12,541 B | Freesound 351406 (`newagesoup`) |
| `diner-plate-clink.ogg` | shot | 0.15 s | -4.1 | -24.3 | 4,361 B | Freesound 382643 (`bbrocer`) |
| `diner-cutlery.ogg` | shot | 0.91 s | -4.1 | -31.3 | 9,121 B | Freesound 813434 (`Luisa_Sanchez`) |
| `diner-till.ogg` | shot | 1.18 s | -3.8 | -25.8 | 12,302 B | Freesound 584168 (`clubmydia+`) |
| `diner-bell.ogg` | shot | 1.75 s | -4.2 | -23.1 | 11,282 B | Freesound 709925 (`Squidems`) |
| `diner-oven-ding.ogg` | shot | 1.09 s | -3.7 | -23.8 | 8,781 B | Freesound 265022 (`sethlind`) |
| `diner-door-bell.ogg` | shot | 0.70 s | -3.9 | -23.9 | 7,068 B | Freesound 494565 (`775noise`) |
| `diner-room-tone.ogg` | loop | 4.00 s | -6.4 | -20.0 | 27,412 B | Freesound 382314 (`samyi`) |
| `diner-order-chime.ogg` | shot | 0.99 s | -4.0 | -16.5 | 9,553 B | Freesound 583947 (`Fenodyrie`) |

## Tests Run & Real Output
Command: `npm run index; node tests/diner-assets.mjs; node tests/brief.mjs`
```
> city-life-local-multiplayer@0.35.22 index
> node scripts/build-index.mjs

brief 2834 tokens (target 3000), index 34167 tokens (target 36000); 234 modules, 14 generated, 292 tests, 30 scripts; 13 modules without a header comment
PASS diner-assets.mjs: 9 GLBs (2464 tris total, 11 room meshes, 33 food parts <150 tris, all 18 recipes covered), 15 CC0 Ogg clips (223.6 KB total).
brief tests passed: 234 modules listed, brief 2834 and index 34167 estimated tokens (budgets 3000 and 36000)
```

## Requested Edits for Shared Files (for D-C / D-D Wiring)
1. `dist/audio.js`:
   - Import `{DINER_SHOTS,DINER_LOOPS,DINER_FILES,pickShot}` from `'./diner-sounds.js'`.
   - Add `diner(kind, at, listener)` (using `pickShot(kind, random, last[slot])` + `want(DINER_FILES)` + `shot(...)`) and `dinerLoops({room, pump, steam, grinder, sizzle, listener, at})` (managing `loopOf(DINER_LOOPS[k].file)` with `DINER_LOOPS[k].level`).
2. `dist/vehicle-sounds.js`:
   - Optionally include `...DINER_FILES` in `ALL_FILES` if asset-completeness tests check `ALL_FILES` against `dist/assets/sounds/*.ogg`.
3. `dist/shops.js` (`createShop`, `cafe` branch):
   - Replace the placeholder register box (`box(.45,.35,.35,1.2,1.28,-3.5,...)`) and coffee machine box (`box(.9,.55,.55,-1,1.38,-3.5,...)`) with lazy-loaded GLBs from `./assets/diner/`: `espresso_machine.glb` at `(-1.05, 1.10, -3.5)`, `coffee_grinder.glb` at `(-0.48, 1.10, -3.5)`, `cash_register.glb` at `(1.20, 1.10, -3.5)`, `menu_board.glb` on the north wall at `(0, 1.95, -4.88)`, plus rear kitchen counter props (`flat_grill.glb`, `pizza_oven.glb`, `prep_board.glb`).

## What I Could Not Verify
- **Audio playback by ear:** Cannot listen to the 15 `.ogg` clips; cuts and loop windows were selected by RMS/onset/CV waveform analysis (`numpy`) only and need an owner ear-check.
- **In-game rendering & character scale:** Did not load the GLBs inside `shop:cafe` in a live Three.js browser session (`shops.js`/`game.js` untouched per D-B scope); visual checks are from headless Blender Workbench preview PNGs only.
- **Full `npm test` / `npm run release`:** Not run so we do not race with the concurrent `game.js` lane (`D-A2`); verified `tests/diner-assets.mjs`, `tests/brief.mjs`, and `npm run index`.

## Confidence
- **High:** GLB structure, no-Draco export, base pivots (`y = 0`), triangle budgets (`2,464` total, all food parts `12–76 < 150`), anchor presence, recipe-part completeness, Ogg Vorbis format/size limits, and `diner-sounds.js` purity (all directly asserted by `tests/diner-assets.mjs`).
- **Medium:** Subjective audio quality/timbre of the 15 Freesound cuts until ear-checked by the owner.
