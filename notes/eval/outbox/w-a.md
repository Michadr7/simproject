michadr.

# W-A report: world goods + world state

## Files (all new, no BOM)
- dist/world-goods.js: 51 lines (data only)
- dist/world-state.js: 128 lines (pure)
- tests/world-state.mjs: 102 lines
No existing file edited. Did not run release, index or npm test. Run: `node tests/world-state.mjs`.

## Test output (real)
```
people 28; day-plan scan 0.23 ms/day; whole tick incl. scan 0.25 ms; pure worldTick 0.014 ms
PASS world-state: determinism, run-out + price cap, delivery, conservation, truck, catch-up 14, normalize, prosperity floor, price band, stockAt, no clock/chance
```
(First run failed once: a bare shelf priced 559 instead of 563 because the prosperity factor pulled it under the cap. Fixed: scarcity at the cap pins the price to +25%. Second run passed.)

## Tick cost
28 people (townPopulation()). Counting errand visits from dayPlan for all 28 = 0.23 ms per day; whole tick including that scan = 0.25 ms; the pure worldTick alone = 0.014 ms (1000-tick average). A 14-day catch-up is about 4 ms.

## Found (verified) vs assumed
Verified:
- population.js: 28 people (buildPopulation), hashOf at population.js:27 (copied, same function); place strings 'shop:market', 'property:farm-house', etc.
- Errands only visit map.shops = market and cafe (map-definition.js:177-178; schedule.js:28-32). Real counts on day 5: market 6, cafe 3 visits. Hours: market 420-1320, cafe 480-1080.
- Other places by id: property:alder-bakery (:289, hours 330-840), property:farm-house (:297, Hal Brennan, hours 390-1050), property:sawmill (:304), property:eastbank-supply (:308), property:eastbank-gas-kiosk (:309; FUEL_STATIONS :323), office:ridgeline-warehouse (:359), zone:forest, property:alder-store (:286, not used).
- Fuel prices fuel.js:5: gas 400, diesel 420 cents/gal. fuel.js counts milli-gallons (1 unit here = 1 gal = 1000 mgal).
- items.js has NO eggs, milk, produce, bread, planks or logs items (food items: apple, banana, sandwich... items.js:10-24). Planks exist only as pallet product (pallets.js:16, PALLET_CAP 40) and carry.js/supply.js (SUPPLY batch 40).
Assumed (all placeholders, flagged in the file):
- Every base price except gas/diesel (eggs 450 per dozen, milk 400, produce 500, bread 350, planks 900, logs 1500). No plank price exists anywhere in dist/.
- All stocks, targets, caps, producer rates (farm 8 eggs, 6 milk, 10 produce a day; bakery 14 bread; sawmill 24 planks; forest 16 logs), baskets (1 per good per errand visit), fuel daily use (45 gas, 30 diesel), truck (weekly, 420 gas + 280 diesel).
- No egg/cow/chicken producer exists in the game yet (coop and barn are not enterable: map-definition.js:298-302), so farm output is pure data until the farming update.
- Decay (decayDays) is data only; nothing spoils in W-A (keeps conservation simple).

## Design choices worth knowing
- Save shape: {v,seed,day,stock,use,town,truck:{nextDay},last}. I added `seed`, `use` and `last` to your shape. `use` = the day's planned consumption, saved so stockAt can run the shelf down by the clock without ctx (you asked for stockAt derived; it is derived from stock + use).
- worldTick(world,day,ctx) order: settle yesterday's use, produce (rate x health x 90-110% by hash, capped), weekly truck (blocked by ctx.events kinds 'storm' or 'road-blocked'), prosperity, plan today's use. world.last = {day,consumed,produced,imported,trucked,blocked,fills}.
- ctx: {demand(place,day)->visits, farmHealth(day)->0..1, health(place,day)->0..1, events(day)->[{kind}]}. All optional. No demand = no errand consumption (only daily baselines).
- Prosperity per region (town, eastbank, farm): moves at most 2/day, floor 30, max 100; 3-day average fill >= 75% = +1, < 50% = -1, < 30% = -2, a blocking event -1. Falls by itself when shelves stay low.
- Price = base x clamp(target/stock) x prosperity factor (poor town pays up to +4%, rich town down to -10%), always within +-25%; a bare shelf is exactly +25%.
- catchUp returns {world, ticks} (not a bare world), runs the newest 14 days of the gap and sets world.day to toDay.
- deliver and buy return {world, moved} / {world, sold, cents}. deliver without a source = the player brings goods (capped by destination max); with a source it conserves.
- normalizeWorld(raw, seed, day=0): third arg is where a fresh world starts, so the first load does not catch up 14 days.

## What W-B (needs.js) needs from these exports
lowStock(world, frac) -> [{place,good,stock,target}] (shops/depots below 30% of target), priceOf, stockAt, PLACES (kind, region, hours, goods max/target/rate), GOODS, deliver/buy for filling a need, world.last for "what changed", world.town[region].prosperity and history for consequences, visitCounts for demand.

## What W-D (game.js wiring) needs
1. progress.world = normalizeWorld(saved, MAP.seed, currentDay) on load; save it back (small JSON).
2. At 05:00 (TICK_MINUTE=300) and on load/sleep: catchUp(world, world.day, currentDay, ctx). ctx.demand built once per tick: `const v=visitCounts(townPopulation().people, day, dayPlan); demand: p=>v[p]||0` (0.25 ms). Wrapper: ctx.demand is called per place per tick, so build `v` once outside.
3. ctx.farmHealth(day) from Hal's state when it exists (default 1). ctx.events(day) when a weather/event source exists.
4. Market UI: stockAt(world, 'shop:market', 'eggs', minuteOfDay) and priceOf(..., minute); selling a shelf item = buy(). Crate drop at the market = deliver(world, 'shop:market', 'eggs', n, 'property:farm-house').
5. Co-op: only the authority calls worldTick; deliver/buy are the actions to route through applyWorld.
6. DESIGN.md 4.6 line 105 ('shelves refill daily and are not saved') must be updated (owner answer 5).

## Open questions
- Is a 'unit' of eggs a dozen (crate of 12?) or a single egg? The farm crate (starter.js PLACES.crates) count should match; adjust GOODS.eggs.unit and rates.
- Should the bakery supply the market automatically (now it only produces bread into its own stock; a person must deliver, like eggs)? Same for the sawmill/forest -> warehouse (lumber is not linked to the real plank pallets or Ridgeline stock yet).
- Real fuel pump sales (fuel.js) do not yet reduce the world's gas stock; W-D must call buy() or a gallons-removal on each sale if wanted.
- Should prices apply to the player's sales as well as purchases?
- Region list (town, eastbank, farm) is my split; the owner said "town + Willow Farm" only.

## Honest confidence
- Pure module logic, conservation, determinism, catch-up cap, normalize, price band, prosperity floor: high (tested, passing; ran once after one fix).
- Balance numbers (rates, stocks, baskets, prices): low, all placeholders.
- Fit with game.js wiring and the real farm/lumber data: not verified (nothing read from game.js; the other agent is editing it).
