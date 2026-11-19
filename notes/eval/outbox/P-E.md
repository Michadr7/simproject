michadr.

# P-E town plank demand (pure part only)

## Files created
- dist/plank-needs.js (49 lines): plankNeedsFrom(world,day,opts), qtyFor, plankPriceCents, payOf, isLinked, DEMAND, constants. Imports only world-goods, world-state, needs (constants and hashOf/keyOf/dayOf), plank-economy. First line names P-E.
- tests/plank-needs.mjs (32 lines).
No existing file was edited.

## Behaviour
- Demand table: Eastbank Building Supplier (target 30, max 100, read live from world-goods), Ironwood Bakery (placeholder target 8, max 24), houses property:house-r1..r8 (placeholder target 4, max 12). Bakery and house stock does not exist in world-goods, so the caller passes it in opts.stock {place:planks}; an unknown stock opens nothing.
- Low = under LOW_FRAC (0.3) of target; asks for REFILL_FRAC (0.7) in whole stacks of 4 (rounded up), capped by RESTOCK_CAP 24, room, and the sawmill yard planks (floored to stacks; under one stack means no need).
- Pay: unitCents = priceOf(world, supplier, planks) (the existing band, not re-implemented); falls back to base 900 on a broken world. All town places pay the supplier's world price. payOf(need)=qty*unitCents.
- Ids stable: restock|place|planks|day (same format as needs.js). opts.needs (current list) blocks a second need while one is open or within HYSTERESIS_DAYS of closing. Max 3 new per call. Due = day+2+hash%2 (same as needs.js). origin = property:sawmill, so fill() takes from the yard stock.
- Returns only the NEW needs (needs.js shape, status open); needs.js does the merge. The pallet-link place (office:ridgeline-warehouse planks) is skipped always.

## Real test output
node tests/plank-needs.mjs
PASS plank-needs: threshold, stacks, price, ids, pallet guard, garbage, determinism
Sanity (read-only):
PASS needs: one need opens, hysteresis, claims + lapse, pro-rata fills, conservation, over-fill pays nothing, expiry (late fill, mood, prosperity, price), cap, determinism, slot shape, pay, no clock/chance
PASS needs-loop: need opened day 103 (14 dozen), board slot, 14 dozen (4 crates) farm 66->52, shelf 0->14, price 563->563, paid 8658, mood 60->64, standing 0->1
Plank economy: 1 log = 4 planks, trickle 6/day vs old 24, level 1 worktruck cycle 32 planks ... pure
npm run index then node tests/brief.mjs: brief 2834 tokens, index 34706 tokens (cap 37000, 2294 free). brief tests passed.
Not run: npm run release, full npm test (as instructed).

## Could NOT verify
- Nothing in game: no wiring, so no real board slot or pickup was seen.
- Bakery and house targets/max are placeholders; the owner has not set them.
- House place id format property:house-r<n> is my guess from map-definition ids house-r1..r8; check against population.js 'kind:id' ids.

## Wiring stage: exact edits needed (forbidden files, not made)
1. dist/needs.js needsFrom(): after the lowStock loop (line ~94) add cands from plankNeedsFrom(world,day,{needs:list,stock:ctx.plankStock}) as mk(pri,'restock',place,'planks',qty,{origin:SAWMILL}) so the six-slot cap, boardOnly slot check and hysteresis stay in one place (or push the returned needs directly after the cap check). Note unitCentsFor() uses priceOf for the place and would return null for bakery/houses (PLACES has no planks there): either use the need's unitCents from plank-needs or add a branch for good planks using plankPriceCents(world).
2. dist/needs.js: add PLACE_POINTS for property:house-r1..r8 (x,z from map-definition house doors); bakery and sawmill and supplier points already exist. Without a point, needToSlot returns null and boardOnly drops the need.
3. needs.js fill() and expire(): restock calls deliver(world,place,'planks',...) which returns moved 0 for the bakery and houses (not in PLACES goods). Either add planks to PLACES (world-goods.js, e.g. bakery and houses with target/max/start 0 and no rate) or branch fill/expire for these places. The supplier works as is.
4. The audit-A-F4 plank filter is NOT in needs.js: it is in dist/gigs.js line 27 (NEEDS_PICKUP_KINDS) and line 132 (board filter requires CRATE_UNITS[s.good]). Planks do NOT yet have a pickup on the gig side: pickNeedHaul (gigs.js 266) only loads crate goods (line 268 a.needGood must be in CRATE_UNITS). The pieces exist (sawmill-yard takeStack, cargo.js addPlanks with orderId, plank-delivery.js) but nothing connects a restock gig to them. So do NOT remove the filter yet; first add a plank branch to pickNeedHaul (take whole stacks from the yard via takeStack, put them on the bed with addPlanks) and a drop-off in game.js, then allow s.good==='planks' at line 132.
5. Save fields: none required if the bakery and house stock is derived (for example a fixed daily baseline from opts.stock built in world-tick). If real house stock is wanted, add progress.world stock entries, which needs normalizeWorld/PLACES changes (item 3).
6. world-tick.js: pass the sawmill yard planks into world.stock before needsFrom (already done by P-B wiring per world-goods comment).
7. Add plank-needs.js to the release copy (npm run release does it) before npm test.

## Confidence
- Pure module and tests: high (all pass, deterministic, no input mutation).
- Fit with needs.js merge: medium (items 1 to 3 are design choices the wiring stage must settle; the place-id guess for houses is the weakest).
- Removing the F4 filter: low until a plank pickup exists (see 4).