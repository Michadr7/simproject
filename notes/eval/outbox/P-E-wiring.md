michadr.

# P-E Wiring Report: Town Plank Demand + WebGPU Ground Log Text

## Files created or changed (with line counts)
- `dist/game.js` (**1970 -> 1970 lines**, CRLF preserved, no BOM):
  - Line `103`: updated WebGPU startup `console.info` text from `"the ground keeps the quality it was built with until a reload"` to `"the ground rebuilds live when WebGPU is on"`.
  - Lines `632, 634, 635`: extended `syncNeedCargo()` with `needPlankId` so loaded plank restock gigs place tagged plank stacks (`addPlanks(..., h.needId)`) on the truck bed and remove them (`removeOrderPlanks`) when the gig finishes or is abandoned.
  - Line `636`: added `plankTruckNear(pt, r)` (owned non-loan vehicle with `hasBed(v.model)`).
  - Line `640`: extended `needCandidates()` with `E` prompts for plank restock gigs (`Load the planks onto the truck` at `a.origin` sawmill yard, `Unload the planks at <dest>` at `a.places[0]`).
  - Line `643`: extended `needLoad()` with a plank branch that measures bed capacity (`crateCapacity(t.model, 'planks')` / `addPlanks` check in multiples of 4), calls `pickNeedCrates` (`pickNeedHaul`), syncs `belt` and bed cargo, persists, and toasts.
  - Line `647`: extended `needDrop()` with a plank branch that checks truck proximity at `a.places[0]`, calls `deliverNeedCrates` (`deliverHaul`), syncs `belt` and bed cargo, persists, plays `coins-pay`, toasts, and sends a phone gig line.
- `dist/needs.js` (**196 -> 203 lines**, no BOM):
  - Imported `{plankNeedsFrom, plankPriceCents, DEMAND as PLANK_DEMAND, SUPPLIER as PLANK_SUPPLIER}` from `./plank-needs.js`.
  - Added `PLACE_POINTS` for `property:house-r1`..`property:house-r8` using real door coordinates from `placePoint(id, MAP)` and names `'1 Cedar Loop'`..`'8 Cedar Loop'`.
  - Updated `unitCentsFor()` to return `plankPriceCents(world)` for `good === 'planks'`.
  - Merged `plankNeedsFrom(world, day, {needs: list, stock: ctx.plankStock})` into `needsFrom()` after the `lowStock` loop (skipping `property:eastbank-supply` planks in `lowStock` so it gets whole-stack quantities from `plankNeedsFrom`; priority `0.35 + fill` so shop food restocks stay ahead in `needsFrom`/`newsFor`).
  - Exempted `c.good === 'planks'` from `MIN_PAR_M.walk` (300 m) in `boardOnly` because Ironwood Bakery (260 m par) and Cedar Loop houses (192–254 m par) are closer than 300 m to the sawmill.
  - Branched `fill()` for non-`PLACES` plank restocks (bakery and houses): player-carried deliveries (`opts.carried === true`) accept up to `ask` without altering `world.stock` save shape or breaking daily plank conservation.
- `dist/gigs.js` (**296 -> 312 lines**, no BOM):
  - Imported `PLANKS_PER_STACK` from `./plank-economy.js` and `normalizeYard` from `./sawmill-yard.js`.
  - Added `isHaulGood(g) = !!CRATE_UNITS[g] || g === 'planks'` and wired it into `needsPickup`, `needBoard` (board filter + `stacks` count + `hasBed` truck check + `s.good === 'planks'` par exemption), `slotOffer` (`stacks` label), `tickGig`, `giveBack`, and `completeNeed` (`carried: true`, leftover give-back to `property:sawmill` + `sawmillYard` sync).
  - Added the plank branch to `pickNeedHaul`: takes whole stacks of `PLANKS_PER_STACK` (4) from `sawmillYard` / `world.stock['property:sawmill'].planks`, claims the need, records `haul` and `truck`, and syncs `sawmillYard`.
- `dist/world-tick.js` (**111 -> 113 lines**, no BOM):
  - Built a deterministic daily `plankStock` baseline for bakery and houses (at most 1 baseline place low per day when `< 2` plank needs are open, using `hashOf(seed, place, dayNow, 'plank-need') % 8 === 0`, zero new save fields) and passed it to `needsFrom()`.
- `dist/world-goods.js` (**72 -> 72 lines**, unchanged):
  - Initially tested adding `planks` on `property:alder-bakery` and `property:house-r1..r8` to `PLACES`, which broke `tests/talk-memory.mjs` (0.35.18 old-save `world` equality), `tests/save-file.mjs` (full-disk backup budget), and `tests/workforce-tick.mjs` (14-day plank conservation). Reverted `dist/world-goods.js` and used the `needs.js` `fill()` branch instead so the save format is 100% untouched.
- `tests/plank-gig.mjs` (created, **116 lines**, no BOM):
  - Covers supplier/bakery/house board slots, whole-stack pickup from sawmill yard, full delivery, partial delivery give-back to sawmill + `sawmillYard`, cancel/abandon give-back, and old-save normalization.
- `dist/releases/0.36.1/`, `dist/index.html`, `PROJECT-BRIEF.md`, `PROJECT-INDEX.md`: updated by `npm run release -- --force` and `npm run index` (version kept at `0.36.1`, not bumped).

## Real house place id format (verified read-only)
- Verified in `dist/map-definition.js` (lines 277–284, 498–500) and `dist/population.js` (lines 31, 94):
  - Format matches the guess **`property:house-r1`** through **`property:house-r8`** (`'1 Cedar Loop'` .. `'8 Cedar Loop'`).
  - Door coordinates from `placePoint(id, MAP)`:
    - `property:house-r1`: `(100, -63.5)`
    - `property:house-r2`: `(120, -61)`
    - `property:house-r3`: `(140, -65.5)`
    - `property:house-r4`: `(98, -112)`
    - `property:house-r5`: `(120, -116)`
    - `property:house-r6`: `(145.1, -110)`
    - `property:house-r7`: `(92, -61.5)`
    - `property:house-r8`: `(144.8, -64)`

## Command and test outputs

### `npm run release -- --force`
```text
> city-life-local-multiplayer@0.36.1 release
> node scripts/package-release.mjs --force

Packaged release 0.36.1: 262 files -> dist/releases/0.36.1
dist/index.html now loads releases/0.36.1/
```

### `npm run index` and `node tests/brief.mjs`
```text
> city-life-local-multiplayer@0.36.1 index
> node scripts/build-index.mjs

brief 2834 tokens (target 3000), index 34734 tokens (target 37000); 261 modules, 14 generated, 317 tests, 31 scripts; 13 modules without a header comment
brief tests passed: 261 modules listed, brief 2834 and index 34734 estimated tokens (budgets 3000 and 37000)
```

### New test (`node tests/plank-gig.mjs`)
```text
PASS plank-gig.mjs: supplier/bakery/house board slots, whole-stack pickup, full/partial delivery with give-back, cancel give-back, and old-save load passed.
```

### Full `npm test` summary
```text
ALL 317 PASSED
All 317 test files passed.
```

## Optional requested edit to a file not in this run's allowlist
- `dist/gig-bridge.js` line `18` (`activeView`): for `need` gigs with `needsPickup(a)` / `a.haul > 0`, the appended hint text still says `' Load the crates at the pile (E), then bring them to the market door.'` / `' Crates loaded: take them to the market door.'`. When `a.needGood === 'planks'`, changing that hint to reference the sawmill yard and destination name would match the new plank prompts cleanly.

## What could NOT be verified
- Nothing was seen or played in a live browser (all tests ran in Node).
- In-game feel of parking beside the sawmill yard (`(104, -274.5)`, reach 9 m) to load planks, seeing the tagged plank stacks appear on the truck bed, and unloading at Eastbank Building Supplier, Ironwood Bakery, and Cedar Loop houses (`house-r1..r8`) needs eyes in a browser.

## Confidence
- Pure rules (`needs.js`, `gigs.js`, `world-tick.js`, `plank-gig.mjs`): **High** (all 317 tests pass including `plank-gig`, `plank-needs`, `needs`, `needs-loop`, `planks-wiring`, `workforce-tick`, `save-file`, `talk-memory`).
- `dist/game.js` E handlers and `syncNeedCargo`: **Medium-High** (exact mirror of crate handlers and warehouse ticket `addPlanks`/`removeOrderPlanks`, verified by full `npm test` including `tickets-game` and `cargo-game`, not yet exercised interactively in a browser).

## QUESTIONS FOR THE OWNER
1. Cedar Loop houses (192–254 m par) and Ironwood Bakery (260 m par) are closer than `MIN_PAR_M.walk` (300 m) to the sawmill, so plank restocks are exempted from the 300 m board filter. Should that exemption stay, or should only Eastbank Building Supplier (379 m par) appear on the board?
2. Should `dist/gig-bridge.js` line 18 be updated in a small follow-up so the active-job tracker description says `"Load the planks at the sawmill (E)"` instead of `"Load the crates at the pile (E)"` for plank restock gigs?
3. Are the placeholder daily frequency (`hash % 8 === 0`, capped at 1 new bakery/house baseline per day and `< 2` open plank needs) and targets (bakery 8, houses 4) about the cadence you want for town plank demand?
