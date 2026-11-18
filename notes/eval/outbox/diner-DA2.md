michadr.

# diner D-A2: the diner is a real job (data wiring + the old cafe shift replaced)

Version bumped to 0.35.22 (package.json; 0.35.21 is live). `npm run release -- --force` was run for 0.35.22 (never deployed). No git run.

## Result
`npm test`: **ALL 291 PASSED / All 291 test files passed** (after `npm run release -- --force`). `npm run index`: brief 2834 tokens, index 33852 of 34000 (232 modules, 291 tests); `node tests/brief.mjs` passes.
`node tests/diner-game.mjs` output: `PASS diner-game.mjs: hired at Elena on day 1 and clocked in through the talk; order taken, collected at the pass, served with a $0.50-$3.00 tip, table cleared; wage + pieces + tips + $10 x rank bonus paid at clock-out; a forgotten order costs -2 rep and the tip but never wages; promoted to Barista & Cook after 2 counted shifts; an old cafe-employed save loads as a Rank 1 diner employee.`

## What was done
1. `dist/map-definition.js`: `MAP.employers` gets `diner` ('Alder Coffee & Diner', skill hospitality, office = the 'cafe' property, owner Elena, hours DINER_HOURS, sites `[{room:'cafe'}]`, ranks DINER_RANKS; imported from diner-job.js). Shop and property renamed "Alder Coffee & Diner". validateMap clean (tests/map.mjs passes).
2. `dist/needs.js`: `'serve'` added to OFF_KINDS ("Cover a shift" retired; active saves still payable).
3. `dist/jobs.js`: `migrateCafe` in normalizeProgress: cafe.employed -> careers.diner Rank 1 (rep START_REP, lastShiftDay = cafe.paidDay), a shift saved half done (stage not off, served 1-2) settled at the old $12 per customer, one phone note, and `progress.cafe` is no longer read or written (removed from freshProgress/normalizeProgress). Idempotent. No schema bump.
4. `dist/shift.js`: diner shift state lives in `progress.shift.diner` (freshDinerShift at clock-in; normalizeShift keeps it); `tickShift` steps the diner clock (diner-job `step`) only while on site and returns `events`; a customer who gives up counts as a `failedOrders` piece (-2 rep at clock-out, never wages). Task labels fixed (they had lost their numbers: "Take  order").
5. NEW `dist/diner-flow.js` (61 lines, pure): `dinerAct` (take / make / pickup / serve / bus on top of takeOrder, pickupOrder, serveOrder, busTable; records pieces and hospitality XP; placeholder auto-quality), `dinerSpots`, `dinerHint`, `dinerTarget`. Rank 2+ tickets are 'open': a placeholder "Make the ..." spot at the espresso end of the counter makes them (counts drinksBrewed / foodPrepped / pizzasBaked; at rank 3+ also `combos` as a placeholder) until the Station View (D-C).
6. `dist/game.js` (1931 lines): cafe-job.js import, `cafeAct/commitCafe/beginCafe/showCafe`, the old clerk/cafe-task prompt and cafe objective text are replaced. Elena's talk acts `cafe.hire / cafe.clockin / cafe.clockout` use hireAct + doClockIn/doClockOut (new act `cafe.promote` -> promoteAct); `managerMenu` (fallback when the cast does not open) offers apply / clock in / clock out / promotion / lunch; E prompts at the 4 tables and the pass come from `dinerSpots` (take order, pick up at the pass, serve, clear table with a 1.5 s ring); `tickShifts` shows event toasts (customer sat down, order ready, customer gave up); up to 4 seated customers walk in from the door to their table's chair and leave when the table goes dirty; the cafe objective card shows the next job and the table states; the tracker list and the Y key now work inside the cafe on a diner shift (arrow points at the table / pass via `dinerTarget`); `expireCafe` wrappers removed.
7. `dist/shops.js`: cafe room gets `customers` (4 pooled characters, one per table; the first is the old one) and `usedCups` (a used cup on each table). Hidden until the shift seats them.
8. `dist/tracker.js`: diner kinds point outdoors at the cafe door and inside at the table or pass (`room.diner`). `dist/phone-jobs.js`: the bonus text and shift hours read the employer (no more `employers[0]` hours).
9. `dist/talk-engine.js`: the `cafe` context ('none' / 'employed' / 'onShift') now comes from careers.diner and progress.shift. `dist/talk-memory.js`: Elena is met when hired as diner. `dist/talk-validate.js`: act `cafe.promote` allowed. `dist/cast-early.js`: Elena, Noah's rumour: $24 / two regulars / Maya and Theo text replaced by "eight dollars an hour plus tips", up to four tables, the pass; new reply "Am I due a promotion?" and "How does a shift work?".
10. Deleted `dist/cafe-job.js` and `tests/cafe-job.mjs` (the old flow it tested is gone; the new game test replaces it).

## Files with line counts
dist/diner-flow.js 61 (new), tests/diner-game.mjs 83 (new), dist/game.js 1931, dist/shift.js 133, dist/jobs.js 75, dist/shops.js 32, dist/tracker.js 86, dist/phone-jobs.js 105, dist/talk-engine.js 270, dist/cast-early.js 615, dist/map-definition.js 1153, dist/needs.js 196, plus talk-memory.js, talk-validate.js, package.json (0.35.22), PROJECT-INDEX.md and PROJECT-BRIEF.md (regenerated).

## Re-pinned tests and why
- tests/clear-way.mjs: OFF_KINDS is now `['clear','repair','serve']` (the serve gig is retired on purpose).
- tests/talk-cast.mjs: Elena's text no longer says $24 (now "Eight dollars an hour plus tips"); added a check for the new `cafe.promote` act.
- tests/talk-engine.mjs: the `cafe` state is read from careers.diner and progress.shift (it was progress.cafe); added "the old progress.cafe is ignored".
- tests/talk-memory.mjs: the old 0.35.18 save has cafe employed, so after load the cafe field is gone, careers.diner is added and one phone note is on top; the "old field kept" loop skips cafe, careers and messages and checks the old careers and messages are kept.
- tests/map.mjs, tests/npc-dialogue.mjs: the shop is named "Alder Coffee & Diner".
- tests/talk-game.mjs: location name; Elena's clock-out is now a diner shift paid by the hour (hired, clock in, 120 paid minutes, clock out, cash = stub total) instead of flat $24.
- tests/startup.mjs: location name; the Maya/Theo latte/espresso loop and the flat $36 are replaced by hire, clock in, clock out and "cash grew by the pay stub total" (the full shift is in diner-game.mjs).
- tests/plank-economy.mjs: no longer reads cafe-job.js (file is gone); the CAFE measurement stays as a recorded history ($24, 90 min).
- tests/storefronts.mjs: reachability of the cafe spots now uses the diner spots (aisle by table 1, make spot, counter, the pass, the aisle by table 4) instead of cafe-job.js constants.

## What I could NOT verify
- No real browser: all game checks run in the Node fake DOM (bootGame). Not seen: customers walking in and sitting (route and seat height copied from the old customer code), the used cups, the floor marker at the aisle spots, the tracker arrow inside the cafe, the table prompt placement and feel of the 1.8 m table range, the 1.5 s bus ring, toasts and sounds (shop-bell, ui-toast, cash-register).
- Co-op: the diner shift and customers are local to each player (nothing new is sent to the relay).
- Rank 3 and 4 tasks (`combo_order`, `bake_pizza`, `rush_hour`) are only placeholder-counted; no test plays Rank 2+ cooking. Rush-hour counting (11:30-14:00) is untested.
- A 4-hour-plus sleep skip during a diner shift was not run (tickShift catches up through `step`, which is event-driven and capped at 512 events).

## Notes for the main chat
- The first reply of a talk node is computed before the act runs: after "Clock me in" the "Clock me out" reply only appears when you reopen the talk (same as the old flow).
- Flagged cost: +3 pooled characters (hidden unless seated) and +3 tiny used-cup boxes in the cafe room, loaded at start; no new draw calls outdoors; per-frame work only inside the cafe (dinerSpots + dinerHint, a few small arrays).
- Frame stepping: the diner clock runs on the existing 0.5 s shift tick, not every frame.
- Only the main-chat-owned Hydrogen files were not touched (sweep-sounds.js, pet-actor.js, assets/sounds, assets/pets).

## Confidence
- Pure rules (diner-job, diner-flow, shift stepping, migration): high (tested, 291/291).
- Talk wiring, clock in/out, promotion, pay: high (played through in diner-game.mjs, startup, talk-game).
- Visuals (customers, cups, marker, tracker arrow): medium-low: only seen as state in the fake DOM, never rendered.
- Feel and balance (tip sizes, arrival rate, XP per action: take 3, serve 6, bus 3, make 5, promotion pace): medium; a full Rank 1 shift in the test took about 150-250 game minutes.
