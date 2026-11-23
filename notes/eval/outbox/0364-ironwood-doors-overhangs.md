michadr.

Fixed the missing Ironwood shop doors, oversized/misplaced awnings & overhangs, high rooftop signs, and the streetlamp blocking Ironwood Florist in `0.36.4`.

## Files created or changed
- `dist/ridge-clothing-shell.js` (`189` lines): added `SHOP_STOREFRONTS` and `attachShopStorefront(mesh, fade, id)` attaching glazed entry doors, threshold steps, metal pulls, and themed display windows to all 5 blank-wall Ironwood legacy shops (`alder-barber` with classic striped barber pole, `alder-pharmacy` with emerald cross plaque, `alder-bank` with tall stone-lintel windows, `alder-books` with warm book displays, and `alder-cinema` with poster lightboxes).
- `dist/world.js` (`728` lines): imported `SHOP_STOREFRONTS` + `attachShopStorefront` and wired them in `createWorld` landmark setup alongside `alder-bakery`.
- `dist/downtown.js` (`97` lines):
  - Updated `AWNINGS` and added `DOWNTOWN_OVERRIDES` so canopies and signs sit at ground-floor entrance height and align over real doors/storefronts (`ironwood-florist` `sy = 0.78` canopy top `2.505 m` + sign `y = 2.95 m` instead of 4th floor; `eden-ridge-gazette` switched to `awning` `sy = 0.85` at `z = -129.75` + sign `y = 3.25 m`; `ironwood-arcade` switched to `awning` `sy = 0.92` at `z = -78.85` over its forward wing + sign `y = 3.55 m`; `alder-hardware` aligned to door `z = -114.30` + sign `y = 3.55 m`; lowered `ironwood-post-office`, `ironwood-furniture`, `ironwood-town-hall`, `ironwood-clinic`, `ironwood-clothes` signs cleanly above their canopies).
  - Updated `LEGACY_FRONTS`: pulled `alder-barber` awning back flush to `shop-d`'s actual `x = 57.32` ground wall (`awningX = 57.28` -> `56.73` on sidewalk, `sy = 0.92`) with sign at `y = 3.60`, and matched `alder-bakery` (`sy = 0.92`, sign `y = 3.55`).
- `dist/town.js` (`70` lines): added `lampBlocked` and `freeSpot` frontage relocation so any streetlamp spawned directly in front of a doorway (`(55.5, -56.0)` at `ironwood-florist`) nudges cleanly along the sidewalk (`(55.5, -59.0)`) while preserving all `40` street lamps.
- `tests/ironwood-fixes.mjs` (`106` lines): added checks confirming all 5 newly dressed shops have `-storefront` & `-door-glass` meshes, every sign stays below its building roofline, `ironwood-florist` canopy `<= 2.60 m` & sign `<= 3.10 m`, and zero lamps stand within `1.8 m` of `ironwood-florist`'s doorway.
- `notes/handoff.md` (`486` lines): added summary under `0.36.4`.

## Tests & commands run (real outputs)
- Focused tests:
  - `node tests/town.mjs` -> `Town: a street wall of 10 buildings with no gaps, 256 road markings (crosswalks on all four arms of the main junction, stop lines, 31 bays), 15 parked cars, and 58 pieces of street furniture on the pavements, a fountain in the square and a bus stop.`
  - `node tests/ironwood-fixes.mjs` -> `PASS ironwood-fixes: 0 stuck interior staff, Gemma Atkins bakery, Ridge Clothing see-through shop/stock, cleared overhangs, grounded buildings/cars.`
  - `node tests/downtown.mjs` -> `PASS downtown: 9 unique facades, sidewalk doors, staff posts, 6 converted details, 18 awnings/parasols and 14 signs; 23322 placed triangles`
  - `node tests/dev.mjs` -> `Dev mode: Dev Mode menu entry, F2, teleport (named places, snapped to clear ground, never water or off-map), set time (time only), add money (whole cents, capped), spawn items (stacking, full bag), unstick and back to spawn; the flag off or the files deleted leaves no trace and the game starting normally.`
  - `node tests/night-lights.mjs` -> `night lights tests passed`
- Index & budget:
  - `npm.cmd run index` -> `brief 2840 tokens (target 3000), index 32297 tokens (target 37000); 295 modules, 15 generated, 353 tests, 34 scripts; 13 modules without a header comment`
  - `node tests/brief.mjs` -> `brief tests passed: 295 modules listed, brief 2840 and index 32297 estimated tokens (budgets 3000 and 37000)`
- Packaged release & startup:
  - `npm.cmd run release -- --force` -> `Packaged release 0.36.4: 296 files -> dist/releases/0.36.4`
  - `node tests/startup.mjs` -> `Fresh save: creator, phone apps/controls/gigs, and multiplayer frame checks passed.` and `Existing save: gameplay, phone apps/controls/gigs, and multiplayer frame checks passed.`
- Full test suite:
  - `npm.cmd test` -> **`ALL 353 PASSED` / `All 353 test files passed.`** (`0` failures across all `353` tests, including `hub-runner.mjs`, `dev.mjs`, `night-lights.mjs`).

## What could NOT be verified
- Live WebGL/WebGPU visual GPU eye-check along Ironwood streets (`alder-barber`, `ironwood-florist`, `ironwood-arcade`, `alder-hardware`, `eden-ridge-gazette`, `alder-pharmacy`, `alder-bank`, `alder-books`, `alder-cinema`), since Chrome remote debugging is not active in this sandbox; requires owner browser check.

## Requested edits to forbidden files
- None.

## Confidence
- High on storefront door geometry, canopy/sign alignment, lamp relocation (`40` lamps preserved), index budget (`32297 / 37000`), and full `ALL 353 PASSED` suite; visual appearance on GPU awaits owner eye-check.
