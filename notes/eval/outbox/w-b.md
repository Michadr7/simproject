michadr.

# W-B report: needs (dist/needs.js)

Files (new, no BOM): dist/needs.js 165 lines; tests/needs.mjs 101 lines. No existing file edited. Did not run release, index or npm test.

Test output (real):
PASS needs: one need opens, hysteresis, claims + lapse, pro-rata fills, conservation, over-fill pays nothing, expiry (late fill, mood, prosperity, price), cap, determinism, slot shape, pay, no clock/chance
PASS world-state: determinism, run-out + price cap, delivery, conservation, truck, catch-up 14, normalize, prosperity floor, price band, stockAt, no clock/chance

Exports: needsFrom, claim, fill, expire, needPay, needToSlot, needSlots, valueCents, urgencyPct, normalizeNeeds, openNeeds, remainingOf, keyOf, dayOf, constants (MAX_OPEN_NEEDS 6, CLAIM_LAPSE_MIN 60, LATE_FILL_PCT 40, MOOD_HIT -8, HYSTERESIS_DAYS 1, PLACE_POINTS, KEEPERS, TEMPLATES, TITLES).

Assumptions
- Egg unit: W-A GOODS.eggs.unit = 'dozen', so 1 unit = 1 dozen. The starter story loads "four egg crates" (starter.js beat 'crates', cargo.js crates), so I assume 1 crate = 1 unit = 1 dozen; a restock of 10 = 10 crates. Not verified against cargo.js capacity.
- The need list is NOT inside world-state's save (normalizeWorld drops unknown keys). game.js saves it as its own array (progress.needs) and passes it back as ctx.needs; closed needs stay 3 days as the hysteresis memory.
- `now` = game minutes (gigs.js gameMinutes), day = floor(now/1440). Must equal world.day numbering (W-D to confirm; gigs' own dayKey uses a 05:00 offset).
- Restock needs only open when a producer holds the good (gas has none: the weekly truck covers it). Harvest = a producer at >=90% of max; fill removes goods from the producer (they leave the map); closes at <=60%.
- Place points: market, cafe, farm, gas, warehouse are real (gigs.js / map-definition); bakery, sawmill, supplier, forest are PLACEHOLDERS (ctx.placePoint overrides). Keeper ids noah/sophie/hal/baker are UNVERIFIED.
- Walking par farm to market is about 300 m, right at MIN_PAR walk; mode is 'vehicle' at 12+ units (vehicle min par 500 would not fit that route, W-E should check).
- Partial expiry: if players filled part, mood hit is -4 not -8 (my choice). Late fill = min(remaining, max(1, floor(40% of qty))). Expiry costs the region prosperity -1 (floor 30).
- Pay: fill().cents is the RAW pro-rata value only (telescoping, parts sum exactly). The full gig pay is needPay(...).total = gig-pay floor + value x quality x fatigue (0 value if too fast) + tip. Pay once with needPay, never both.

Open questions: who is the errand client id for sick NPCs (npc-life input shape sickNpcs:[{id,home,good?,qty?,origin?}] is my guess); whether harvest goods should instead go to a shop; need qty cap numbers (RESTOCK_CAP 24); fatigue applies to the value part too (my choice).

What W-D (game.js) must call
1. Load: progress.needs = normalizeNeeds(saved). At each 05:00 tick (after worldTick/catchUp): progress.needs = needsFrom(world, day, {needs: progress.needs, sickNpcs, needSeeds, events, keeperOf, placePoint}); first call expire() for past-due ones: {needs, world, consequences} = expire(needs, world, day) then apply consequences.mood to NPC state (npc-life) and keep the returned world.
2. Board: needSlots(progress.needs, ctx) gives gigs-shaped slots; accept -> claim(needs, id, playerId, qty, now); drop at the destination -> fill(needs, world, id, playerId, units, now), then pay needPay(need, units, quality, mode, parM, {day, before: need.filled before the fill, doneToday, ...}).total.
3. Co-op: route claim/fill/expire through applyWorld (they are pure actions).
What W-E (gigs.js) must do: add need-restock/harvest/errand/clear/repair/tend/tow/serve to GIG_TYPES (handling fee, stops 1; acceptGig and normalizeActive look the type up, test asserts they are not there yet); have boardFor return needSlots instead of hashed types for non-starter play; carry needId on the active gig so completion calls fill. Starter gigs (grocery, parcel, beat 8) are untouched: needs never touch STARTER_TYPES or the starter flag (slot.starter is always false).
Integration points: progress.needs save; 05:00 tick; gig board; completeGig -> fill + needPay; market/Noah mood (consequences.mood); phone Town news (consequences, price list).

Confidence: pure logic, conservation, determinism, pro-rata, claims, expiry: high (tested, passed). Balance numbers, place points, keeper ids, egg unit: low/unverified. Fit with gigs.js wiring: shape checked by field list only.