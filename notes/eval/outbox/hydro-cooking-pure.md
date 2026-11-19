michadr.

## Summary
Built the pure L-PURE cooking modules and unit tests without touching `dist/items.js`, `dist/life.js`, `dist/jobs.js`, `dist/game.js`, or any other shared/forbidden file. Regenerated `PROJECT-INDEX.md` and verified the index budget.

## Files Created
- `dist/recipes.js` (69 lines) — 8-recipe table (`RECIPES`, `COOKING_INGREDIENTS`, `HOSPITALITY_BONUS_PER_2_LEVELS`, `HOSPITALITY_BONUS_CAP`), `recipeFor(id)`, `canCook(inventory, recipe)`, `consume(inventory, recipe)` (immutable, multi-stack safe), `hospitalityBonus(level)`, `scaledOutput(recipe, qualityMult, hospitalityLevel)`.
- `dist/cook-ring.js` (37 lines) — frame-rate-independent `ringProgress(elapsedSec, totalSec)`, `sweetSpot(hospitalityLevel)` (widens with level), `ringResult(progress, hospitalityLevel)` returning `{quality: 'burnt'|'ok'|'good'|'perfect', mult}` with `QUALITY_MULT`.
- `dist/warm-meal.js` (34 lines) — plain serialisable `{untilGameMin, drainMult}` buff state, `freshWarmMeal()`, `normalizeWarmMeal(value)`, `applyBuff(state, nowMin, quality)`, `drainFactor(state, nowMin)`.
- `dist/grocery-migrate.js` (104 lines) — idempotent `migrateGroceries(progress)` unpacking legacy `life.groceries` (`0..20`) into `housing.fridge` / `properties[id].fridge` (20-slot max) -> `inventory.slots` -> `$4.00` (`400 c`) cash refund, adding `cat-food` (`Math.ceil(packs / 3)`), clearing `life.groceries = 0`, and appending one `messages.js` notification (`app: 'player'`). Safe on `null`/`undefined`/missing fields.
- `tests/recipes.mjs` (75 lines)
- `tests/cook-ring.mjs` (45 lines)
- `tests/warm-meal.mjs` (50 lines)
- `tests/grocery-migrate.mjs` (88 lines)

## Files Regenerated
- `PROJECT-INDEX.md` (via `npm run index`)

## Test Results (Real Output)
```
> node tests/recipes.mjs; node tests/cook-ring.mjs; node tests/warm-meal.mjs; node tests/grocery-migrate.mjs
PASS Recipes: 8-recipe table, canCook/consume immutability & multi-stack deduction, hospitality + quality scaling, and purity.
PASS Cook-ring: frame-rate independent progress, hospitality-widened sweet spot, burnt/ok/good/perfect scoring, and purity.
PASS Warm-meal: plain serialisable state, applyBuff by quality without weakening active buffs, drainFactor expiry, and purity.
PASS Grocery-migrate: idempotent unpacking into studio/property fridge, inventory fallback, $4.00 refund on full bag, safe on missing fields, and purity.

> npm run index; node tests/brief.mjs
> city-life-local-multiplayer@0.36.2 index
> node scripts/build-index.mjs

brief 2834 tokens (target 3000), index 36077 tokens (target 37000); 271 modules, 14 generated, 328 tests, 33 scripts; 13 modules without a header comment
brief tests passed: 271 modules listed, brief 2834 and index 36077 estimated tokens (budgets 3000 and 37000)
```

## Exact Requested Hook Edits (Not Applied)
1. **`dist/jobs.js`** (`normalizeProgressWith`, around lines 1–63):
   - Import: `import {migrateGroceries} from './grocery-migrate.js';`
   - Import: `import {normalizeWarmMeal} from './warm-meal.js';`
   - In `normalizeProgressWith(value, pieces)` before `return s;` (line 63):
     - Add `s.warmMeal=normalizeWarmMeal(a.warmMeal);`
     - Call `return migrateGroceries(s);` (or `s=migrateGroceries(s);` before `if(pieces)...`).
   - Note: `dist/housing.js` (`normalizeHousing`, line 8) and `dist/ownership.js` (`normalizeProperties`, line 12) will also need to preserve optional `fridge` arrays (`[{id, quantity}]`, max 20 slots) once `items.js` defines the new ingredients, otherwise `normalizeHousing` / `normalizeProperties` will strip `fridge` on load.
2. **`dist/items.js`** (`ITEMS`, lines 9–36):
   - Add stackable ingredient definitions (`stackLimit: 10`) for `eggs`, `milk`, `produce`, `bread-loaf`, `flour-bag`, `ground-coffee`, `meat-pack`, and `cat-food` (so `inventory.js` `normalizeInventory` and `store.js` accept them).
3. **`dist/life.js`** (`tickLife`, lines 12–21):
   - Accept an optional `warmMealMult = 1` (or pass `drainFactor(progress.warmMeal, gameMinutes(progress))` into `drainMultiplier` / `loadMultiplier` from `game.js` / `state.js`) so `l.food` and `l.energy` drain slower while the warm-meal buff is active.
4. **`dist/game.js`** (cooking & drain wiring):
   - Line 409 (`studioHome.KITCHEN`): move `{x:3,z:-3.5}` to `{x:4.2,z:-3.85}` (and anchor prompt on stove `{x:4.2,y:1.15,z:-4.8}`).
   - Lines 698 (`lifeAct('cook')`) & 786 (`candidates` `'cook'`): replace `lifeTransaction(GameState.progress, 'cook', 'home')` with recipe selection, `canCook`/`consume`, timed `busy` ring driven by `ringProgress` + `ringResult(progress, hospitalityLevel)`, `scaledOutput`, `addXp(..., 'hospitality', out.xp)`, `applyBuff(warmMeal, nowMin, quality)` on Eat now (or `addItem` for `packItem` on Pack for later), `advanceTime`, `storyEvent('ate')`, `look.capture()`, and house `utilityUsage`.
   - Line 1830 (`tickLife` call): multiply drain by `drainFactor(GameState.progress.warmMeal, gameMinutes(GameState.progress))`.

## Could NOT Verify
- Did not run `npm run release -- --force` or full `npm test` (328 suites), only the 4 new test files and `tests/brief.mjs`.
- Did not boot the browser or test live stove/fridge/store integration (since `items.js`, `life.js`, `jobs.js`, and `game.js` were not edited).

## Confidence
- **High:** `dist/recipes.js`, `dist/cook-ring.js`, `dist/warm-meal.js`, `dist/grocery-migrate.js`, and their 4 unit test suites (all pure, deterministic, and verified with `node` + `tests/brief.mjs`).
- **Medium:** Exact `game.js` / `housing.js` / `ownership.js` integration details until `items.js` and the fridge container normalizers are wired in the next stage.
