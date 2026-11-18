michadr.

# Stage P-D (pure side only): plank delivery pay & run size (`dist/plank-delivery.js`)

## Files created (with line counts)
- `dist/plank-delivery.js` (`160` lines, NEW, UTF-8 without BOM): pure plank delivery planning, run-size calculation, plank-price-based payout, and bed refusal rules (`bedCapacity`, `remainingBedPlanks`, `plankPriceOf`, `runSize`, `deliveryPay`, `refusalReason`, `planDelivery`, plus frozen constants `BASE_PLANK_CENTS`, `DELIVERY_PAY_PER_PLANK`, `OLD_DELIVERY_PAY`, `DELIVERY_PRICE_RATIO`, `DOLLAR_CENTS`, `BED_RUN_PLANKS`, `BED_FIT_PLANKS`, `REFUSAL`). Builds on `dist/plank-economy.js`, `dist/warehouse-intake.js`, and `dist/cargo.js` (`BEDS`, `CARGO_KINDS`, `hasBed`, `spaceOf`, `capacity`, `usedSpace`, `hasCrates`, `CRATE_MIX`, `addPlanks`). Header length: `76` chars (`< 90`, cites `planks-economy-design P-D`).
- `tests/plank-delivery.mjs` (`130` lines, NEW, UTF-8 without BOM): Node `assert/strict` test suite covering every vehicle in `cargo.js` `BEDS` (`flatbed` 120, `shortbed` 44, `worktruck` 32, `offroad` 32, `atv` 4 via `maxPieces: 1`), `cargo.addPlanks` parity, existing bed cargo reduction, all refusal reasons (`NO_BED`, `CRATE_MIX`, `ZERO_ORDER`, `NO_STOCK`, `BED_FULL`, `OVERFULL`), zero / negative / overfull / partial loads, zero free planks (`availablePlanks`), `plank-economy.js` `priceTable` low/normal/high scaling, whole-dollar rounding (`payCents % 100 === 0`), determinism, frozen immutability, garbage inputs, and source purity.
- `PROJECT-INDEX.md` and `PROJECT-BRIEF.md` updated via `npm run index`. **Index budget exceeded by `103` tokens** (`32,603` vs `32,500` budget) after adding both W1 (`+123` tokens) and P-D (`+138` tokens) onto `32,342` (`158` tokens remaining initially). Per `AGENTS.md`, `scripts/build-index.mjs` was NOT edited.

## Test and index results (real output)
```text
> node tests/plank-delivery.mjs
PASS plank-delivery.mjs: all 5 BEDS verified (flatbed 120, shortbed 44, worktruck 32, offroad 32, atv 4), whole-dollar rounding & priceTable scaling, zero free planks, refusals, deterministic, pure.
exit=0

> npm run index
> city-life-local-multiplayer@0.35.20 index
> node scripts/build-index.mjs

brief 2834 tokens (target 3000), index 32603 tokens (target 32500); 219 modules, 14 generated, 264 tests, 29 scripts; 13 modules without a header comment
exit=1 (tests/brief.mjs)

> node tests/brief.mjs
AssertionError [ERR_ASSERTION]: the index is 32603 tokens (budget 32500)
    at file:///C:/Users/Michael/Documents/Projects/simproject/tests/brief.mjs:70:8
```

## What could NOT be verified
- `npm run release -- --force` and full `npm test` (skipped once `tests/brief.mjs` stopped on the `103`-token index overage, and because `game.js` / `shift.js` wiring is separate).
- Live in-game truck bed loading / delivery payout round-trip and phone Prices-screen interaction at Eastbank / Ridgeline house drops.

## Exact requested edits for forbidden/shared files (later wiring stage, NOT made here)
1. `dist/game.js` (`loadDelivery` at lines `370–371`, `deliverOrder` at lines `372–376`, `unloadAtDock` at line `380`, and phone Prices / world-state lookup):
   - In `loadDelivery(id)`: check `const reason = refusalReason(bed, k, bed.cargo); if (reason) { toast(reason); return }` before `applyCompany({type: 'load', ...})` so bedless vehicles, crate-mixed beds, and oversized orders fail with the canonical P-D message instead of silent mis-loads.
   - In `deliverOrder(id)` (line `376`): compute current plank price table `const pt = priceTable(GameState.progress.world, GameState.progress.housing.day, GameState.progress.routine.minutes); const reallyMoved = Math.min(k.planks, tagged.count || k.planks); const payout = deliveryPay(reallyMoved, pt, {placeKey: 'warehouse'});` and award `payout.payCents` (whole dollars) instead of the flat `PIECE_PAY.deliveries` (`2500` cents = `$25.00`) in `notifyPhone` / `shift` / cash credit, paying `$0` if `reallyMoved === 0`.
2. `dist/shift.js` (`PIECE_PAY` at line `26` and `deliveries` payout at lines `74–75`):
   - Replace static flat `deliveries: 2500` (`OLD_PAY.orderDelivery`) with plank-delivery piece pay or dynamic delivery bonus credit so clocked-in order deliveries are not stuck at `$25.00`.
3. `scripts/build-index.mjs` (`BUDGET.index` or header/format trim, owned by main chat):
   - Trim existing `PROJECT-INDEX.md` headers or raise `BUDGET.index` beyond `32,500` (currently over by `103` tokens at `32,603`).

## Honest confidence
- `dist/plank-delivery.js` (`BED_FIT_PLANKS`, `addPlanks` compatibility across all 5 `BEDS`, refusal rules, whole-dollar rounding, zero free planks, `priceTable` integration): **high (98%)** — verified directly by `tests/plank-delivery.mjs`.
- Requested wiring edits in `game.js` and `shift.js`: **high (90%)** — verified directly against `dist/game.js:365-380`, `dist/shift.js:25-76`, and `dist/tickets.js:124-130`; live gameplay integration untested.
