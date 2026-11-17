michadr.

# Stage P-C (pure side only): warehouse intake (`dist/warehouse-intake.js`)

## Files created (with line counts) and index update
- `dist/warehouse-intake.js` (123 lines, NEW, UTF-8 without BOM): pure warehouse intake rules (`normalizeCells`, `toCompany`, `cellPlanks`, `fullCellCount`, `mirrorPlankSum`, `intakePlan`, `payFor`, `intakeFromYard`, `summarize`) and frozen constants (`RACK_CELL_PAY`, `DELIVERED_PLANK_PAY`, `INTAKE_ORDER`, `HAND_RACK_IDS`, `TOTAL_RACK_CELLS`, `MAX_RACK_PLANKS`, `HAND_RACK_MAX_PLANKS`, `WAREHOUSE_WORLD_MAX`), importing constants from `dist/plank-economy.js`, `dist/sawmill-yard.js`, `dist/warehouse-layout.js`, `dist/pallets.js`, and `dist/world-goods.js`. Line 1 cites `notes/planks-economy-design.md stage P-C`.
- `tests/warehouse-intake.mjs` (126 lines, NEW, UTF-8 without BOM): Node `assert/strict` test suite covering constant cross-checks (`plank-economy.js`, `forest.js`, `pallets.js`), partial vs full cell pay once per cell (`500` c), conservation (`stored + left === offered`, cell sum delta `=== stored`, `intakeFromYard` conservation), full-rack and near-full overflow left with the player, stable `INTAKE_ORDER` spreading, `cellPlanks === pallets.totalPlanks`, `mirrorPlankSum === world-tick.js mirrorPallets`, `summarize`, garbage inputs, immutability, determinism, and source purity.
- `PROJECT-INDEX.md` and `PROJECT-BRIEF.md` regenerated via `npm run index` (`warehouse-intake.js` at line 191; `warehouse-intake` test at line 465).
- No existing `.js` or test files were modified.

## Real test and index output
```text
> node tests/warehouse-intake.mjs
PASS warehouse-intake: cell-fill pay 500 c once per 40-plank cell, strict conservation, full-rack overflow kept, stable INTAKE_ORDER, mirrorPlankSum === world-tick mirrorPallets, garbage/immutability/purity
exit=0

> npm run index
> city-life-local-multiplayer@0.35.17 index
> node scripts/build-index.mjs

brief 2834 tokens (target 3000), index 31471 tokens (target 32500); 211 modules, 14 generated, 254 tests, 28 scripts; 13 modules without a header comment
exit=0

> node tests/brief.mjs
brief tests passed: 211 modules listed, brief 2834 and index 31471 estimated tokens (budgets 3000 and 32500)
exit=0

> node tests/plank-economy.mjs
Plank economy: 1 log = 4 planks, trickle 6/day vs old 24, level 1 worktruck cycle 32 planks in 182.1 game min = $263.20 (8672 c/h) beats the best existing job ridgeline-fell (6934 c/h) by 25%, levels 1:+25% 3:+18% 5:+11% 7:+4% 10:-12%, Prices screen low/high/normal notes, garbage safe, frozen, pure
exit=0

> node tests/sawmill-yard.mjs
PASS sawmill-yard: 1 log = 4 planks, 30/60/144 Hz frame-rate independent sawing (4 game min/log), trickle 6/day idempotent, clamp 40 logs / 160 planks, takeStack max 4, normalizeYard/garbage safe, immutable, deterministic, pure
exit=0
```

## What could NOT be verified
- `npm run release -- --force` and full `npm test` were NOT run (per prompt rules while another agent may still be editing shared files).
- Live in-game warehouse rack stacking UI, `warehouse.js` 3D pallet mesh redraws after `intakePlan`/`addToRack`, and browser save round-trips were not verified.

## Exact edit list for the later wiring stage (NOT made here)
1. `dist/game.js` (`stackAtRack`, line 376, and warehouse candidates at lines 630–631):
   - Keep rack cell mutations grounded in `companies.ridgeline.pallets` (pallet truth). Either continue routing hand-stacking through `forest.js:stackPlanks(GameState.progress, slot)` after `forest.js` uses `PAY.rackCell` (or validate slot fill delta via `warehouse-intake.js:intakePlan(racksOf(pr), pr.carry.count, {handOnly:true, slot})` + `payFor` before calling `addToRack`), leaving any `left` planks in `p.carry` when the cell/warehouse cannot fit all 4 planks.
   - At `candidates()` line 631 (`if (pr.carry?.kind === 'planks')`), also allow stacking from yard-hauled planks off shift without losing conservation (note `forest.js:53` already allows off-shift `stackPlanks`, with pay gated by `onShift` in `filledPay`).
2. `dist/shift.js` (`PIECE_PAY`, line 25) and `dist/forest.js` (`filledPay`, lines 49–51, and `stackPlanks`, lines 52–62):
   - In `dist/shift.js:25`, import `PAY` from `./plank-economy.js` (pure) and set `racks: PAY.rackCell` (`PIECE_PAY.racks` currently hardcodes `500`, and `shift.js:73` pays `PIECE_PAY.racks * shift.pieces.racks`).
   - In `dist/forest.js:49–51`, import `RACK_CELL_PAY` from `./warehouse-intake.js` (or `PAY.rackCell` from `./plank-economy.js`) and format the full-cell message dynamically from `RACK_CELL_PAY` instead of hardcoded `$5.00.`. Keep `shift.stacked` duplicate-slot guard (`!moved.shift.stacked.includes(slot)`) so cells cannot be emptied and re-filled for repeat pay.
3. `dist/world-tick.js` (`mirrorPallets`, lines 31–36 and `runWorldDay`, lines 50–51):
   - **Keep:** `mirrorPallets` (`lines 31–36`) MUST keep summing `totalPlanks(company)` (so non-order pallets on racks, floor, and forks remain the single source of truth, `pallets.js:49`) and clamping to `PLACES[PALLET_LINK.place].goods[PALLET_LINK.good].max` (`200`), matching `warehouse-intake.js:mirrorPlankSum`.
   - **Order bug to keep/fix carefully:** At lines 50–51, `mirrorPallets(world, P)` runs *before* `catchUp` subtracts `daily: 10` (`world-state.js:61`), so `world.stock['office:ridgeline-warehouse'].planks` drops by `use` until next day's `mirrorPallets` resets it from untouched `company.pallets` (noted in `world-goods.js:61`). Do not write world `use` back to `company.pallets` without a deliberate sink rule.

## Double-counting flag: P-B (`sawmill-yard.js` trickle) vs `world-goods.js` / `world-state.js`
- **Risk:** `dist/sawmill-yard.js` adds `TRICKLE_PER_DAY` (`6/day`) to `progress.sawmillYard.planks`, while `dist/world-goods.js:38` still gives `'property:sawmill'` `rate: 24` planks/day in `world-state.js:62` (and `world-goods.js:58` `SUPPLY` moves `6/day` from `'property:sawmill'` to `'property:eastbank-supply'`).
- **Effect if wired as-is:** If P-B's `trickle(6)` runs alongside `world-goods.js` `rate: 24`, the world creates `24` free planks at `'property:sawmill'` AND `6` free planks in `progress.sawmillYard` (`30/day` total, `5x` the intended trickle), breaking plank conservation between the sawmill yard and the world simulation.
- **Fix when wiring P-B/P-C:** Change `PLACES['property:sawmill'].goods.planks.rate` in `dist/world-goods.js:38` from `24` to `0` (if `mirrorSawmillYard` copies `sawmillYard.planks` into `world.stock['property:sawmill'].planks` and `SUPPLY` deducts from `sawmillYard`, updating `tests/plank-economy.mjs:17`), **or** set `world-goods.js:38` `rate: 6` solely to feed `SUPPLY` (`6/day` sawmill -> `eastbank-supply`) if `sawmillYard` represents only the player's local yard stacks (`trickle = 6` capped separately) — choose ONE source so town supply and player yard never mint duplicate free planks.

## Honest confidence per part
- `dist/warehouse-intake.js` (`intakePlan`, `payFor`, conservation, overflow, garbage/immutability, `mirrorPlankSum`): **high (95%+)** — verified directly by `tests/warehouse-intake.mjs` and matched against `world-tick.js:runWorldDay`.
- Exact edit list & P-B/world-goods double-counting analysis: **high (90%)** — verified directly against `game.js`, `forest.js`, `shift.js`, `world-tick.js`, `world-goods.js`, and `pallets.js` line ranges; not yet tested inside full `npm test` or live browser wiring.
