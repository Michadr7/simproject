michadr.

# Neo: bakery needs pure module (stage B-PURE)

New files only. No shared or forbidden files (`world-goods.js`, `plank-needs.js`, `needs.js`, `gigs.js`, `gig-bridge.js`, `world-tick.js`, `bakery-goods.js`, `game.js`, etc.) were edited. No git, no `npm test`.

## Files created / updated
| File | Lines | What |
|---|---:|---|
| [dist/bakery-needs.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/bakery-needs.js) | 145 | Pure module (no DOM, no three.js, no globals, no `Date.now`/`Math.random`). Exports `BAKERY_DEMAND` (referenced directly from `bakery-goods.js`, never copied), `SUPPLIER` (`'property:eden-wholesale'`), `SUPPLIER_LABEL` (`'Eden Wholesale'`), `CADENCE_MOD` (8), `MAX_OPEN_BAKERY_NEEDS` (2), `MAX_NEW_PER_DAY` (1), `CARRY_MODES`, `bakeryDayHash`, `isBakeryNeed`, `isOldBakeryPlankNeed`, `qtyFor`, `needsVehicle`, `needsForStock`, `fillNeed`, `expireOldPlankNeeds`, `pickupText`, `loadedText`, `trackerText`, `needTitle`, `needDescription`. |
| [tests/bakery-needs.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/bakery-needs.mjs) | 138 | Node `assert/strict` unit test: demand identity, thresholds, hash cadence (integer and `{seed, day}`), daily/open caps, hysteresis, partial/exact/over fill, idempotent old-save plank-need expiry, gig tracker text, garbage safety. |
| [PROJECT-INDEX.md](file:///c:/Users/Michael/Documents/Projects/simproject/PROJECT-INDEX.md) | regenerated | `npm run index` |

## Tests run (real output)
```text
> node tests/bakery-needs.mjs
PASS bakery-needs: demand, cadence, caps, fill, old-plank expiry, tracker text, garbage

> npm run index
brief 2834 tokens (target 3000), index 36195 tokens (target 37000); 272 modules, 14 generated, 329 tests, 33 scripts; 13 modules without a header comment

> node tests/brief.mjs
brief tests passed: 272 modules listed, brief 2834 and index 36195 estimated tokens (budgets 3000 and 37000)
```

## Exact wiring edits for the game.js lane (not applied here)

1. **`dist/plank-needs.js` (`DEMAND`, line 15):**
   - Remove `'property:alder-bakery':Object.freeze({label:'Ironwood Bakery',target:8,max:24}),` from `DEMAND` (houses `house-r1`..`r8` keep planks, target 4).

2. **`dist/bakery-goods.js` (`SUPPLIER`, line 5):**
   - Set `SUPPLIER='property:eden-wholesale'`, `SUPPLIER_LABEL='Eden Wholesale'` (and update `SUPPLIER_NOTE`) once Eden Wholesale is placed on the map.

3. **`dist/needs.js` (`PLACE_POINTS`, `TEMPLATES`, `unitCentsFor`, `needsFrom`, `fill`, `needToSlot`):**
   - Import `{BAKERY,SUPPLIER as BAKERY_SUPPLIER,isBakeryGood,priceOf as bakeryPriceOf,needsForStock,expireOldPlankNeeds,needTitle,needDescription}` from `./bakery-needs.js`.
   - `PLACE_POINTS` (~line 34): add `'property:eden-wholesale'` at Eden Wholesale's pickup world point (`worldPoint(PICKUP, pose)` -> `{id:'eden-wholesale', name:'Eden Wholesale', x:39.4, z:-64.1}` on site 1).
   - `unitCentsFor` (line 82): handle `isBakeryGood(good)` via `bakeryPriceOf(good, 1)`.
   - `needsFrom` (line 89): run `expireOldPlankNeeds(..., ctx.keepNeedIds)` alongside `retireOffKinds` so old open `'property:alder-bakery'` plank needs drop cleanly on load/tick.
   - `needsFrom` (~line 101, after the `plankNeedsFrom` merge): if `ctx.bakeryStock` is provided, call `needsForStock(ctx.bakeryStock, ctx.bakeryDayHash ?? {seed:world.seed, day}, list)` and push the returned candidate (if non-null) into `cands` with `origin: BAKERY_SUPPLIER`.
   - `needsFrom` (line 115, `boardOnly` par filter): keep `c.good!=='planks'` exempt from `MIN_PAR_M.walk`, and also exempt `isBakeryGood(c.good)` (Eden Wholesale behind C6/C7 is ~40 m from Ironwood Bakery).
   - `fill()` (line 138): in the `n.kind==='restock'` carried branch, add `|| (isBakeryGood(n.good) && n.place===BAKERY)` so carried sacks are accepted without `deliver()` touching `world.stock` (which has no flour/coffee-beans rows).
   - `needToSlot` / `TEMPLATES` (lines 40, 186): for `n.kind==='restock' && isBakeryGood(n.good)`, use `needTitle(n.good)` and `needDescription(n.good, remainingOf(n), fromName, toName)`.

4. **`dist/world-tick.js` (`runWorldDay`, lines 77, 86-87):**
   - Import `{BAKERY_DEMAND,expireOldPlankNeeds}` from `./bakery-needs.js`.
   - Line 77: pass `needs` through `expireOldPlankNeeds(retireOffKinds(crewNeeds, keepNeedIds), keepNeedIds)` before `expire()` so old open bakery plank needs drop without mood/prosperity penalties.
   - Line 86: build `bakeryStock` (e.g., `{flour: 0, 'coffee-beans': 0}` or from a side table) and pass `bakeryStock` into `needsFrom(world, dayNow, {..., plankStock, bakeryStock, ...})` (cadence `hash % 8`, max 1 new/day, `< 2` open are enforced inside `needsForStock`).

5. **`dist/gigs.js` (`isHaulGood`, `needBoard`, `giveBack`, `pickNeedHaul`, `completeNeed`):**
   - Import `{isBakeryGood,SUPPLIER as BAKERY_SUPPLIER,SUPPLIER_LABEL,GOODS as BAKERY_GOODS,needsVehicle}` from `./bakery-needs.js`.
   - `isHaulGood` (line 127): `const isHaulGood = g => !!CRATE_UNITS[g] || g === 'planks' || isBakeryGood(g);`
   - `needBoard` (line 133): exempt `isBakeryGood(s.good)` from `MIN_PAR_M.walk` alongside `s.good==='planks'`; set `mode: needsVehicle(s.remaining) ? 'vehicle' : 'walk'` (sacks hand-carriable, pallets vehicle-only) and block with `NEEDS_TRUCK` only when `needsVehicle(s.remaining) && !hasBed(p)` (or `!hasCrateBed(p)`).
   - `pickNeedHaul` (line 272): add an `if (isBakeryGood(a.needGood))` branch next to `planks` that claims `take = Math.min(a.needQty, remainingOf(need), room)` sacks from `BAKERY_SUPPLIER` without touching `world.stock`, returning `{state, units: take, sacks: take, crates: 0, left: 0, message: ...}`.
   - `giveBack` (line 257) and `completeNeed` (line 304): guard `deliver(world, n.origin, a.needGood, ...)` so it only runs when `WORLD_PLACES[n.origin]?.goods?.[a.needGood]` exists (skip for bakery goods since Eden Wholesale is not a `world-goods.js` stock place).

6. **`dist/gig-bridge.js` (`activeView`, line 18):**
   - Import `{trackerText as bakeryTrackerText}` from `./bakery-needs.js`.
   - In `activeView` description for `need`: check `const bt = bakeryTrackerText(a);` and when non-empty append `' ' + bt` (giving `'Load the flour sacks at Eden Wholesale (E), then deliver them.'` before loading and `'Flour sacks loaded: deliver them to Ironwood Bakery.'` after loading), falling back to the existing `planks` / `crates` wording otherwise.

7. **Cargo & visuals (`cargo-items.js`, `cargo.js`, `cargo-view.js`, `carry-pose.js`, `game.js`):**
   - Match items 5 and 6 of `notes/eval/outbox/bakery-goods-assets.md`: add `'sack'` kind (`hand:true`, `stackable:true`, slow crate carry speed, `unitKg` from `GOODS[key].massKg`, `{k:'sack', g:'flour'|'coffee-beans'}`), `boxPose(GOODS[key].carrySize)`, GLB loading of `flour`/`coffee-beans` `sack`/`carry`/`pallet` after `TIMBER`, instanced rendering per good, and pallet props at Eden Wholesale pickup / Ironwood Bakery drop-off while a need is open.

## What I could NOT verify
- Full `npm test` and `npm run release` were not run (explicitly skipped per user instruction and new-files-only scope).
- Integration with `needs.js`, `world-tick.js`, `gigs.js`, `gig-bridge.js`, and `game.js` (none of those files were edited; verified only `normalizeNeeds` round-trip compatibility against `dist/needs.js`).

## Confidence
- `dist/bakery-needs.js` pure rules, constants, cadence, caps, fill, old-plank expiry, and tracker text: **high** (tested with `node tests/bakery-needs.mjs`, all assertions pass).
- `PROJECT-INDEX.md` budget compliance: **high** (`npm run index` and `node tests/brief.mjs` pass at 36195/37000 tokens).
- Wiring list for the `game.js` lane: **high** for `plank-needs.js`, `needs.js`, `world-tick.js`, `gigs.js`, `gig-bridge.js` (line numbers verified against current files); **medium** for `game.js` cargo/visual hooks (carried forward from `bakery-goods-assets.md` without opening `game.js`).
