michadr.

# clear-way: stop offering fake "Clear the way" / "Mend it" jobs

## Verdict
No real obstacle or repair mechanic exists. I fixed the board so clear and repair needs never become gigs. Existing saves are handled. Only the targeted tests were run; the full `npm test` and `npm run release` were NOT run, as instructed.

## Evidence the mechanic is fake (read-only Grep)
- dist/game.js has no reference to need-clear, need-repair, a clear|repair need id, tree-down, road-blocked or broken-fence. Nothing in the world spawns an obstacle or a broken object. (Grep for `kind:'clear'|need-(clear|repair)` in game.js: no matches.)
- game.js:508 `worldDayPassed()` calls `runWorldDay(GameState.progress)` with NO ctx.events, so the event path (needs.js EVENT_KINDS tree-down/road-blocked/broken-fence) is never fed. The clear/repair needs came only from the NPC routine seeds: npc-life.js:195-196 picks a random kind from the roster list (npc-roster.js:46 and :71 list 'clear' with good 'road'; :31, :46, :56, :71, :76 list 'repair' with goods 'fence', 'saw', 'black-truck', 'truck'). The "good" is only flavour text.
- needs.js:36 TEMPLATES text is generic: "Something is blocking <place>. Clear it." / "Something at <place> is broken. Repair it."
- gigs.js:22-23 (need-clear, need-repair, handling HANDLING_C.walk, one stop). gigs.js:26 CHORE_KINDS skips the minimum-distance rule, so the gig is just "walk to the place's point".
- gigs.js completeNeed (about line 284-296) -> needs.js fill() line about 125-127: for any kind not restock/harvest/errand it runs `else units=ask`, i.e. the units are simply granted. So reaching the stop and pressing E at the marker pays out. The "Make the delivery" step label is generic (game.js:1471, any non-parcel single-stop job); it does not mean anything for a chore.

## What changed
- dist/needs.js (189 -> 196 lines): new `OFF_KINDS=['clear','repair']`, `isBoardable(kind)` and `retireOffKinds(needs,keepIds)` (own-line comment says why they are off and that stage P-F re-enables them by emptying the list). KINDS, TEMPLATES, EVENT_KINDS, DUE_DAYS stay (old saves, P-F). In `needsFrom`, when `ctx.boardOnly` (the world tick sets it): candidates of OFF_KINDS are skipped, and open OFF_KINDS needs in the incoming list are dropped via `retireOffKinds(ctx.needs, ctx.keepNeedIds)`. Without boardOnly the pure function is unchanged.
- dist/gigs.js (296 lines, same count): `needBoard` filters `isBoardable(n.kind)` (import added). This is what hides an old open clear/repair need from the board, phone and Noah's counter immediately on load (the daily tick may not run until the next day).
- dist/world-tick.js (94 -> 95 lines): `runWorldDay` first runs `retireOffKinds(P.needs, [active gig's needId])` BEFORE `expire()`, so an old clear/repair need goes quietly: no expiry, no keeper mood hit, no prosperity hit. Passes `keepNeedIds` to needsFrom. (This file was allowed "only if needed": it was, because expire() runs before needsFrom.)
- tests/clear-way.mjs (NEW, 65 lines): the pinning test (see below).
- tests/gigs-game.mjs (57 lines) and tests/startup.mjs (217 lines): UPDATED ON PURPOSE. They used a `clear` need at the market as the stand-in board need; that need is no longer offered. Both now use a `tend` need at the market (same chore behaviour, id 'tend|shop:market||N'); gigs-game's title assertion is now 'Tend the animals'. Note: tend is itself a fake-ish chore (see list below); it is only a test stand-in. startup.mjs runs the PACKAGED release, so it needs `npm run release -- --force` first, which I did NOT run: I could not verify startup.mjs.
- dist/gig-bridge.js: not needed, not touched.

## Old saves
- Open clear/repair need, no active gig on it: hidden at once (needBoard) and deleted at the next daily tick without penalty.
- Active clear/repair gig (including the card in the screenshot, all steps ticked): the need is kept as long as the active gig points at it. It loads, survives the daily tick, and `completeGig` pays out normally (tested: cash increases by `paid`, need becomes filled). Abandon works (no money, no rep change, claim released); the orphan need is retired at the next tick.
- Active gig whose need is already gone: `completeGig` pays 0 and clears it, `settleNeed` ends it ("taken care of without you"); no crash, nothing stuck, no money invented.
- Only NEW ones are stopped.

## Test output (real, pasted)
```
> node tests/clear-way.mjs
PASS clear-way: clear/repair needs never reach the board, old saves complete or abandon safely, other kinds unchanged
> node tests/gigs-game.mjs
gigs-game ok
> node tests/needs.mjs
PASS needs: one need opens, hysteresis, claims + lapse, pro-rata fills, conservation, over-fill pays nothing, expiry (late fill, mood, prosperity, price), cap, determinism, slot shape, pay, no clock/chance
> node tests/needs-loop.mjs
PASS needs-loop: need opened day 103 (14 dozen), board slot, 14 dozen (4 crates) farm 66->52, shelf 0->14, price 563->563, paid 8658, mood 60->64, standing 0->1
> node tests/world-tick.mjs
PASS world-tick: save shape, 05:00 boundary, once per day, catch-up 14, determinism, 7 days -> needs, supply conserved, pallet link, dozens, pump stock, no clock/chance
> node tests/gigs.mjs
gigs ok
> node tests/parcel-fixes.mjs  -> PASS parcel-fixes.mjs: ...
> node tests/world-state.mjs, gig-pay.mjs, gig-parcel.mjs, gig-clients.mjs, phone-calls.mjs -> all PASS
> npm run index -> brief 2834 tokens (target 3000), index 32029 tokens (target 32500); 214 modules, 260 tests
> node tests/brief.mjs -> brief tests passed: 214 modules listed, brief 2834 and index 32029 estimated tokens (budgets 3000 and 32500)
```
tests/clear-way.mjs covers: a world with clear/repair events and seeds (boardOnly) opens no such need while a tend need and the egg restock still open; the pure function without boardOnly is unchanged; boardFor/availableContracts/acceptContract/acceptGig give nothing for clear/repair and still offer a tend need; the daily tick retires an old past-due clear need with no mood or prosperity difference; an old active clear gig round-trips save/load, survives the tick, pays out, or abandons cleanly; an orphan gig closes with 0 pay.

## Could NOT verify
- `npm run release -- --force` and the full `npm test` (not allowed). tests/startup.mjs (packaged release) is unverified after my one-line change; run the release first.
- Not seen in a real browser: the phone/board UI with an old save. The existing task card text for an old active clear gig is unchanged and still says "Make the delivery" (game.js label).
- Concurrent edits by the other agent in game.js were not checked against my change (I did not edit game.js).

## Other need or gig kinds whose steps do not match a real action (reported only, nothing changed)
All of these share the same fake completion: walk to the place's map point, press E, `fill()` grants the units (needs.js ~125-127 `else units=ask`; gigs.js:22-24 types; gigs.js:26 CHORE_KINDS).
1. tend ("Tend the animals"): seeded by npc-life.js:192 (cat hungry, good cat-food) and roster routine lists (npc-roster.js:31). No animal-care action exists in game.js. It stays on the board when its place has a map point (PLACE_POINTS, needs.js:25-30).
2. tow ("Tow job"): npc-life.js:193 (recluse, 'black-truck') and roster :56, :76. gigs.js:24 makes it a vehicle-handling gig but nothing in game.js tows a vehicle for it.
3. serve ("Cover a shift"): in KINDS and TEMPLATES (needs.js:37), no seed source found in npc-life.js or the roster lists; could only arrive from needSeeds/old saves. Not offered today, but fake if it were.
4. The generic "Make the delivery" / "Gig location" / "Return for payment" labels (game.js:1471, :1475) are used for every single-stop need gig including chores; wording is wrong for tend/tow/serve. Needs a game.js edit by the main chat (owner of game.js).
5. Real and fine: restock, harvest, errand. needBoard (gigs.js:132, NEEDS_PICKUP_KINDS gigs.js:27) only lets crate goods (eggs, milk, produce: world-goods.js:64) onto the board, and those have a real pickup + hand-over (pickNeedHaul, deliverHaul). Non-crate restocks/errands/harvests never reach the board.
Suggested follow-up (not done, as the task limited me to clear/repair): add 'tend','tow','serve' to OFF_KINDS, which is a one-word change per kind in needs.js plus swapping the tend stand-in in tests/gigs-game.mjs and tests/startup.mjs to a real kind.

## Confidence
- clear/repair never being offered, and old-save handling: high (tested through the pure paths and the real daily tick).
- Test stand-in change (tend) in startup.mjs: medium, because I could not run it.
- Index/brief within budget: high (ran both).