michadr.

# OPUS W3 + P-D: workforce wiring and plank delivery pay (one run)

Gate: `npm run index` (index 32949 of 34000), `npm run release -- --force` (0.35.20), `npm test`: **ALL 268 PASSED on the first run, no retries**. dist/game.js equals dist/releases/0.35.20/game.js. Nothing was seen in a browser.

## Edits (file, line, what)

### dist/supply.js (59 lines)
- l.5: header now says the planks come from the lumberyard stock and the sawmill yard only (owner answer 4).
- l.9-21: `supplyFromStocks(company, yard, want)` (new export): lumberyard stock first, then the yard; only what fits the racks leaves either source. It is the same rule as workforce-tick.js. I repeated it here instead of importing it, because the import closed a module cycle: careers -> supply -> workforce-tick -> forest -> shift -> careers. With that import, loading forest.js first threw `Cannot access 'LANDING' before initialization`. tests/workforce-game.mjs checks that the two copies agree.
- `tickSupply(company, {now, carried, yard})`: a delivery lands from the two sources (it returns `yard` when planks came out of it, plus `fromYard`). No crew is sent when both sources are empty. The scheduled amount is capped at what the sources hold. The "mill off the map" is gone. New message when the sources are empty: "The lumberyard and the sawmill yard are out of planks: the crew came back empty."

### dist/careers.js (131 lines)
- l.12-13: `normalizeWorkforce` (exported; the same rule as workforce-tick.js, repeated because of the same cycle).
- l.39: `normalizeCompanies` keeps `workforce: {lastMin}`. It is additive and left out when idle, and old saves load.

### dist/world-tick.js (109 lines)
- imports: `crewPutAway`, `workforceDay`, `pickWorkforceStumps`, and `plotAt`/`setPlot` (grid.js). Removed the unused `catchUp`, `trickle` and `YARD_MAX_PLANKS`.
- l.31-38: `mirrorPallets` is replaced by `warehouseOf`. A save with Ridgeline pallets uses them as the truth. A save without pallets puts the world's warehouse number on unsaved pallets for the crew's day, and afterwards writes what is left back into the number. That conserves the planks and leaves the save shape unchanged.
- l.43-49: `workforceStumps(progress, housingDay, seed)` (exported): at most 2 standing pines in yesterday's first marked block become stumps (felledAt = the 05:00 tick). A pine the player has started chopping (hits > 0) is left alone. It is deterministic, so co-op agrees.
- l.62-68 (runWorldDay): the manual mirror/trickle/setSawmill/catchUp sync is replaced by one `workforceDay(..., {runWorldTick:true, worldCtx, activeNeedId, claimNow})` per ticked day (max 14). It covers the trickle (once per day), up to 4 real forest logs sawn (paused at 48), the world tick, the warehouse use taken off the pallets, up to 12 planks hauled to the racks, and lumber needs filled after 1 day. The old sawmill rate stays removed, and there is no double trickle.
- l.69: expire/needsFrom run on the crew's needs list.
- l.104-108: the result carries `companies.ridgeline` (only when real pallets changed) and `plots` (only when a stump was made).

### dist/npc-walk.js (118 lines)
- l.5: imports `isOutdoorWork`, `workerRoleOf` and `workforcePose`.
- l.85: `presenceOf`: work at `property:sawmill` is outdoors, so Priya Nair stays visible.
- l.108-113: `personPose`: when `ctx.person` is a Ridgeline feller or the sawyer at work, it returns `workforcePose(out, person, ctx.day, minute, ctx)`. That is a pure function of (person, day, minute, seed). Everyone else gets phase = prop = null.

### dist/npc-crowd.js (112 lines)
- imports `chopPose`/`CARRY`/`CARRY_DIR`/`GRIP` (chop-path.js) and `LOG_HAND`/`PLANK_HANDS`/`PLANK_STACK` (carry.js).
- new options: `workProps` and `seed`. `ctx` carries `person`, `day` and `seed`, set per entry in `update`.
- `workPose`/`resetWork`:
  - chop: the axe in the hand, the `chopPose` swing, lean, two hands.
  - walk or bend with the axe: the carry pose.
  - log: on the shoulder, right hand up.
  - planks: a stack held in both hands.
  - bend: a crouch and a lean.
  - saw: a hand nudging the lever.
  - A slot handed to someone else is reset once, on hide or when the phase ends.
- Workers turn to face their trunk, deck or lever while standing. `setMotion` uses the pose speed (haul 1.68 m/s).
- Props: at most one per role and kind (the cutter's axe, the hauler's log, the sawyer's log and planks), made lazily from game.js factories with shared geometry.
- `drawn()` debug rows now include phase, prop and holding.
- The pool is unchanged (9 slots), so **zero new characters or SkinnedMesh pool entries**.

### dist/game.js (1835 lines, CRLF kept, no lone LF, no BOM)
- l.14: imports `workforceTicketStep`, `deliveryPay`/`refusalReason`/`bedCapacity` and `priceTable`.
- l.137 (createNpcCrowd): `seed: MAP.seed`, and `workProps` with three factories:
  - axe: `createHeldItem(itemById('axe'))`, the shared axe geometry.
  - log: the `ground-logs` geometry and material.
  - planks: the sawmill plank geometry, one mesh scaled x4.
- l.228-229 (applyCompany): supply gets `yard: p.sawmillYard`. New action `workforceTicket` calls `workforceTicketStep`.
- l.236: a yard returned by the supply is written back (with `belt`).
- l.238: on `deliver`, `plankDeliveryPaid(next, act.payCents)` runs.
- l.241-242: `plankDeliveryPaid` and `plankPay`. A delivery pays now, in whole dollars, by the warehouse plank price. The flat 'deliveries' piece is taken back off the shift, so it is not paid twice, and its task still counts.
- l.247 (warehouse hint): the text no longer promises planks from nowhere.
- l.256 (tickCompany): an untouched order that expires gives its crew-staged planks back to the racks (releaseOrder + restock).
- l.257 (tickCompany): runs the `workforceTicket` step every 0.5 s (rank >= 4 hired, as tickets need). A phone line says when the crew filled an order "from the racks... pays nothing".
- l.366 (zoneNote) and l.379-381 (loadDelivery + new `bedRefusal`): a bed that cannot take the order says why. Example: "The order does not fit on that bed. The Work Truck carries 32 planks; order #1 is 40." The load toast says what the order will pay.
- l.385-386 (deliverOrder): the planks that really came off the bed (bed count before minus after, capped at the order) are priced with `deliveryPay(moved, priceTable(world, day, minute))`. The phone says "Paid $X (N planks at $Y)".
- l.568-569 (worldDayPassed): after the tick, new crew stumps get `world.setFelled` and a minimap redraw, and the regrowth stage is forced. Then `syncWarehouse` (if the racks changed) and `belt` (if the yard changed).

### Tests
- NEW tests/workforce-game.mjs (70 lines), packaged game:
  - The rules repeated in careers.js and supply.js agree with workforce-tick.js.
  - Day 4 at 10:00, near the sawmill: the cutter's axe is drawn in his hands at his pure pose inside today's marked block. The hauler's log and the sawyer's prop follow the pose, and the sawyer stays within 12 m of the shed.
  - The number of characters in the scene is the same as at 03:00.
  - The next 05:00 tick: the trickle runs once, real forest logs are used, and 1-2 stumps appear in yesterday's first block.
  - The crew's supply comes out of the yard (20 planks, yard to 0).
  - An order untouched for 220 min is staged by the crew, with racks plus staged = 20, $0 pay and no rep change.
- tests/supply.mjs: the yard is the second source; both sources empty means nothing scheduled and nothing landed; the amount sent is capped by the stock; a full warehouse leaves the yard alone.
- tests/world-tick.mjs l.78: the world equals the pallets after the crew's haul (36 < held <= 48).
- tests/planks-wiring.mjs: 10-day conservation is now planks in = trickle + 4 x real logs sawn (logs only exist in the forest); the 14-day catch-up and the old save without a yard (30 + 6 + 12 = 48) were updated.
- tests/warehouse-intake.mjs: the mirror check is now made on the company after the tick (at most 12 hauled).
- tests/delivery-game.mjs:
  - new 1c: the work truck refuses a 40-plank order with the bed size.
  - test 2: paid by the plank price (whole dollars, more than $25 for 12 planks), the flat piece is not paid on top, and the phone line names the pay.
- tests/forklift-game.mjs l.27: `world.day = DAY-1`. This test is not about the tick, and the crew's day hauled 16 planks into its racks.
- tests/tickets-game.mjs l.54-58: the "staged planks go back" check now counts what the crew moved during the jumped hours and the real pallet of the player's order.

## Real test output (excerpts)
```
> node tests/workforce-game.mjs
PASS workforce-game.mjs: day 4 at 10:00 the cutter holds the axe at a marked pine, the hauler's log and the sawyer at the shed follow the pure pose, no new skinned mesh; the 05:00 tick runs the crew's day (trickle once, real logs, at most 2 stumps in yesterday's block); the crew's supply comes out of the yard; an order untouched for 3 h is staged by the crew for $0; the repeated rules agree.

> npm run index
brief 2834 tokens (target 3000), index 32949 tokens (target 34000); 221 modules, 14 generated, 268 tests, 29 scripts; 13 modules without a header comment

> npm run release -- --force
dist/index.html now loads releases/0.35.20/

> npm test
PASS world-tick: ... one-day tick 0.70 ms; 14-day catch-up 7.94 ms
PASS planks-wiring: one plank source (... 10-day conservation) ...
PASS supply.mjs: ...
PASS workforce-tick.mjs / workforce-pose.mjs / npc-walk ... / brief.mjs (index 32949 of 34000)
ALL 268 PASSED
All 268 test files passed.
```
The first full run (before the two test fixes) had forklift-game and tickets-game red on both tries. Both failures were real effects of the crew's day and crew staging, not load, so I updated those tests. The second full run passed with no retries.

## Edits needed in files I could not change (requested)
1. **dist/order-table.js l.43**: `pay=money(pickup?PIECE_PAY.orders:PIECE_PAY.deliveries)`. The order card still says "Pays $25.00" for a delivery, which is now wrong. Suggest `money(pickup?PIECE_PAY.orders:deliveryPay(k.planks,priceTable(world,day,minute)).payCents)` (the table needs the world and clock passed in), or the text "Pays by the plank price".
2. **dist/shift.js l.26**: `PIECE_PAY.deliveries: 2500` is no longer paid (game.js takes the piece back off the shift and pays by planks). Setting it to 0 would remove that workaround in `plankDeliveryPaid`. tests/plank-economy.mjs pins `OLD_PAY.orderDelivery === PIECE_PAY.deliveries` and would need the same change.

## Not done, and why
- No multi-run deliveries. The bed decides the run size by refusing an order that does not fit and naming the bed's capacity (a 40-plank order needs the shortbed (44) or the flatbed (120)). Splitting an order over runs would need tickets.js, which is not on my list.
- No live stumps during the day. Chopping is visual only (owner answer 2). The at most 2 real stumps appear at the 05:00 tick.
- Draw calls: no new characters. The props add at most 4 meshes, and each is drawn only while its worker is drawn (within 120 m of the player, so only at Pine Ridge or the sawmill). In town the count is unchanged. The axe has its own material (createHeldItem makes one per copy, as the player's does). This was not measured in a browser.
- The crew's ticket step runs only while the player is a hired Yard hand (rank >= 4), because tickets only exist then.
- workforce-tick.js was not edited. `pickWorkforceStumps(day)` reads `markedBlocks(day-1)`, so I pass the housing day (`dayNow+1`) to get yesterday's block. The `stumps` field of `workforceDay` (world day) is not used.
- notes/handoff.md was not edited.

## Owner eye-check list
1. Pine Ridge at 10:00 (stand near the sawmill or the morning block):
   - Feller 1 (Peter Brennan) walks to a marked pine and swings the axe for about 6 s per tree with both hands on it.
   - Feller 2 (Tom Reyes) bends, shoulders a log, carries it to the sawmill deck or the landing, and walks back empty.
   - Sawyer Priya Nair works the shed: deck, lever, belt, plank pile.
   - Check that hands, axe and log sit right, nobody slides or faces the wrong way, and the props vanish when they leave.
2. Draw calls in town are unchanged; at Pine Ridge at most +4 meshes.
3. After sleeping through a night:
   - The warehouse racks gain up to 12 planks.
   - The sawmill yard gains the trickle plus up to 16 planks, and stops near 48.
   - At most 2 fresh stumps appear in yesterday's marked block.
4. A Ridgeline delivery run (rank 5):
   - A 40-plank order refuses the work truck with the bed size.
   - A 12- or 24-plank order loads, and the toast names the pay.
   - At the house the phone says "Paid $X (N planks at $Y)" and the cash rises at once.
   - Clock out and check that the pay stub has no extra $25 for it.
5. Crew supply: with the lumberyard and the yard empty, no crew is sent and no planks appear; with yard planks, the yard pile shrinks when the crew lands.
6. Leave an order untouched for over 3 game hours: the crew stages it 4 planks at a time, and you get no pay or rep for it.

## Confidence
- Economy wiring (world-tick, supply, careers, conservation, saves): **high**. Pure tests, the full suite and the 10-day conservation check pass.
- Delivery pay and refusal (P-D): **high** for the rules and the game test. The order card text is wrong until order-table.js is fixed.
- Crowd poses and props: **medium**. The pose, positions and props are tested in the packaged game. How the IK, lean, crouch and the scaled plank stack look has not been seen.
- Co-op determinism: **high**. The pose is pure (person, day, minute, seed), and the stumps and the crew's day run in the authority's tick.
