michadr.

## Diner D-A Report (Pure Rule Modules + Tests)

### Files Created / Updated
- [dist/diner-recipes.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/diner-recipes.js) (80 lines): 18 diner recipes (`{id, name, category, station, cookSec, burnSec, parts:[{id, slot, required, heat?}], priceCents}`), Rank 2 tight starter menu (10 items: `espresso`, `americano`, `latte`, `iced_latte`, `classic_burger`, `cheeseburger`, `grilled_cheese`, `egg_melt`, `margherita`, `pepperoni`) and Rank 3 unlocks (8 items: `cappuccino`, `hot_chocolate`, `tea`, `iced_tea`, `bacon_burger`, `blt`, `club`, `veggie`), `RANK_UNLOCKS`, `recipesForRank`, `menuForRank`, `isUnlocked`, `tipFor`, and `scoreOrder`. Tips are `50..300` cents (`$0.50–$3.00`) from quality and speed; ruined orders (`burnt`, `quality < 0.5`, raw, or too many missing parts) return `{ok: false, tipCents: 0}`.
- [dist/diner-job.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/diner-job.js) (257 lines): Pure shift state (`TABLES` with 4 tables matching `dist/shops.js:22`, `DINER_RANKS`, `DINER_HOURS`, `DINER_PIECE_PAY`, `DINER_BONUS_PER_RANK = 1000`, `DINER_FAIL_REP = -2`), seeded customer arrivals by `(day, slot)` via `hashOf` and `arrivalFor(day, slot, {seed, rank, names})`, event-driven frame-rate-independent `step(state, dtGameMin)` (advances to exact event boundaries for arrivals, NPC prep, patience expiry, and eating completion), `takeOrder`, `pickupOrder`, `serveOrder`, `failOrder`, `busTable`, `shiftBonus` (`1000 * rank` cents), `shiftSummary`, `freshDinerShift`, and `normalizeDinerShift`. Failed orders never dock wages (`wageDelta: 0`, tip lost, `repDelta -2`, remake allowed on bad serve).
- [tests/diner-recipes.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/diner-recipes.mjs) (80 lines): Tests schema, Rank 2/3 unlock split, missing/optional/extra/order/burn/raw scoring, tip bounds (`50..300`, `0` on ruined), garbage inputs, purity, and no BOM.
- [tests/diner-job.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/diner-job.mjs) (132 lines): Tests 4 table positions, deterministic `(day, slot, seed)` arrivals, frame-rate independence (`dt = 105` vs `0.5`, `0.1`, `1/60`, and `dt = 10` vs `600 * (10/600)`), full Waiter/Cook loop, fail/ruined/expired orders never reducing wages, `$10 × rank` shift bonus, JSON round-trip + garbage normalization, purity, and no BOM.
- Regenerated [PROJECT-INDEX.md](file:///c:/Users/Michael/Documents/Projects/simproject/PROJECT-INDEX.md) and [PROJECT-BRIEF.md](file:///c:/Users/Michael/Documents/Projects/simproject/PROJECT-BRIEF.md) via `npm run index`.

### Tests Run & Pasted Output
`node tests/diner-recipes.mjs; node tests/diner-job.mjs`:
```text
diner-recipes: PASS (18 recipes, Rank 2/3 unlocks, quality/burn scoring, $0.50-$3.00 tips, purity)
diner-job: PASS (4 tables, seeded arrivals, frame-rate independence, fail never docks wages, $10*rank bonus, JSON/garbage norm, purity)
```

`npm run index; node tests/brief.mjs`:
```text
> city-life-local-multiplayer@0.35.20 index
> node scripts/build-index.mjs

brief 2834 tokens (target 3000), index 33525 tokens (target 34000); 231 modules, 14 generated, 287 tests, 30 scripts; 13 modules without a header comment
brief tests passed: 231 modules listed, brief 2834 and index 33525 estimated tokens (budgets 3000 and 34000)
```

### Requested Edits to Shared / Forbidden Files (Not Touched)
1. [dist/map-definition.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/map-definition.js)
   - `shops.cafe` (line 178) & `properties` `id: 'cafe'` (line 274): update `name` from `'Alder Coffee'` to `'Alder Coffee & Diner'` if desired.
   - `employers` (lines 405–417): add the `diner` employer entry (using `DINER_ID`, `DINER_HOURS`, `DINER_RANKS` from `dist/diner-job.js` or inline data):
     `{id:'diner',name:'Alder Coffee & Diner',skill:'hospitality',office:'cafe',owner:{kind:'npc',id:'elena',name:'Elena',title:'Manager'},hours:{from:480,to:1080,lastIn:1020},sites:[{room:'cafe'}],ranks:DINER_RANKS}` (`office: 'cafe'` already matches `properties` id `'cafe'` at line 274, so `validateMap` line 1091 passes).
2. [dist/skills.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/skills.js)
   - `freshSkills` (line 11): return `{lumberjack:{xp:0},hospitality:{xp:0}}`.
   - `normalizeSkills` (lines 12–15): normalize `value?.hospitality?.xp` identically to `lumberjack.xp` (`Number.isSafeInteger(xp)&&xp>=0&&xp<=1e7?xp:0`).
   - `addXp` (lines 16–20): fall back to `progress.skills[skill]?.xp||0` so calling `addXp(p,'hospitality',n)` is safe even on un-normalized saves.
3. [dist/shift.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/shift.js)
   - Imports: import `DINER_ID, DINER_BONUS_PER_RANK, DINER_PIECE_PAY, normalizeDinerShift` from `./diner-job.js`.
   - `TASKS` (lines 12–27): add the diner task kinds referenced by `DINER_RANKS` (`take_order`, `serve_plate`, `bus_table`, `brew_drink`, `prep_food`, `combo_order`, `bake_pizza`, `rush_hour`) so `tests/careers.mjs:14` (`TASKS[k]` check) passes.
   - `PIECE_PAY` (line 31): merge `...DINER_PIECE_PAY` (`ordersTaken:50, platesServed:100, tablesBused:50, drinksBrewed:120, foodPrepped:160`).
   - `normalizeShift` (lines 51–58): preserve optional `diner: normalizeDinerShift(v.diner)` when `e.id === DINER_ID`.
   - `canClockIn` (line 68): format `e.hours.from`, `e.hours.to`, `e.hours.lastIn` instead of the hardcoded `'Shifts run from 6:00 AM to 6:00 PM; the last clock-in is 5:30 PM.'` message.
   - `shiftPay` (lines 79–84) & `clockOut` (lines 86–97): for `e.id === DINER_ID`, use `DINER_BONUS_PER_RANK * rank` (`1000 * rank`) instead of `BONUS_PER_RANK * rank`, include `tipsCents` from `shift.diner` in `total` and the pay stub, and apply `shift.diner.repDelta` in `changeRep` without ever docking `wage`, `piecePay`, `bonus`, or `tipsCents`.
4. [dist/needs.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/needs.js)
   - `OFF_KINDS` (line 25): add `'serve'` -> `export const OFF_KINDS=Object.freeze(['clear','repair','serve']);` so `retireOffKinds` retires `"Cover a shift"` gigs while keeping active saves payable.
5. [dist/jobs.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/jobs.js)
   - `normalizeProgressWith` (line 49): after `s.careers=normalizeCareers(a.careers)`, migrate legacy `a.cafe?.employed` into `s.careers.diner` (Rank 1, `START_REP = 10`, `lastShiftDay: a.cafe.paidDay || 0`, settle any mid-shift `a.cafe.served > 0` at `1200` cents/order into `s.cash` and reset `s.cafe`, keeping `SCHEMA = 2`).
6. [dist/careers.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/careers.js)
   - No structural change required (`hire`, `promote`, `nextRank`, `changeRep` are already employer-agnostic); once `diner` is added to `MAP.employers`, verify `hire(p, 'diner')` in `tests/careers.mjs`.

### What I Could Not Verify
- Did not run `npm run release -- --force` or the full `npm test` suite (all 287 tests), because shared wiring in `map-definition.js`, `skills.js`, `shift.js`, `needs.js`, and `jobs.js` is outside D-A's allowed file list.
- Browser/3D/Station View (`D-B`..`D-D`) is not wired yet.

### Confidence
- `dist/diner-recipes.js` & `tests/diner-recipes.mjs`: **High** — all 18 recipes, Rank 2/3 unlock splits, scoring, tip bounds (`50..300`), and purity checks ran and passed.
- `dist/diner-job.js` & `tests/diner-job.mjs`: **High** — seeded arrivals, exact event-boundary frame-rate independence, Waiter/Cook loops, no-wage-dock fail rules, `$10 × rank` bonus, JSON/garbage normalization, and index budget (`33,525 / 34,000`) ran and passed.
- Requested edits for shared files: **High** — verified against exact current line numbers of `map-definition.js`, `skills.js`, `shift.js`, `needs.js`, `jobs.js`, and `careers.js`, though untested in execution because those files were not modified.
