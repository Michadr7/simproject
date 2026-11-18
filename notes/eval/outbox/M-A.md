michadr.

# M-A report: warehouse timber machine, pure rules

## Files
- dist/timber-machine.js: NEW, 108 lines. Header line 1 is 105 chars (the index shows it truncated; fine).
- tests/timber-machine.mjs: NEW, 80 lines.
- dist/world-goods.js: 4 goods added (posts 3000, beams 3800, dowels 700, chips 100 c; group 'lumber'; unit post/beam/dowel/chip), data only, no place stock. File is now 72 lines.
- PROJECT-INDEX.md regenerated (npm run index): brief 2834/3000, index 33032/34000. No game.js, shift.js, map-definition.js, grid.js, forest.js, tracker.js touched. No release, no npm test, no git.

## Test output (real)
node tests/timber-machine.mjs
PASS timber-machine.mjs: post/beam/dowel modes (1/1/6 per cut, 10/12/8 s), cut finishes first, mode lock and 1 s switch, caps (8 in, 40 out, 40 chips), chips +1 per cut, take, frame-rate independent, saves load, frozen, pure, prices.

world-state: PASS (determinism, run-out + price cap, ... no clock/chance)
world-tick: PASS (save shape, 05:00 boundary, ... no clock/chance)
Farm tractors: PASS (...)
node tests/brief.mjs: brief tests passed: 228 modules listed, brief 2834 and index 33032 estimated tokens (budgets 3000 and 34000)

## For the wiring stage M-C (Opus)
Save field: progress.timberMachine = the machine state object (JSON-safe, v:1). Load with normalizeMachine(saved) (junk, null and v-less are safe; fresh = freshMachine()).
State: {v,mode,logsIn,postsIn,cutMin,cutKind,on,posts,beams,dowels,chips,postsMade,beamsMade,dowelsMade,switchMin}. `on` is derived (able to cut), not stored truth.
Calls (all pure, return frozen values, never mutate):
- freshMachine() -> state
- normalizeMachine(raw) -> state
- setMode(state,'post'|'beam'|'dowel') -> {state,ok,reason}. ok:false (state unchanged) with a reason string if a cut is running, the selector is still moving (switch lock 0.5 game min = 1 real s), or the mode is unknown. Same mode -> ok:true, reason 'already in that mode', no lock.
- feed(state,'log'|'post',count) -> {state,accepted,refused} (tray cap 8 each)
- tick(state,dtGameMin) -> state. Call every frame with game minutes; handles the lock, finishes a started cut, consumes the input when a cut completes, adds output and 1 chip per cut. Stops when the tray is empty or the pallet cannot take the whole output (dowel needs room for 6).
- take(state,'post'|'beam'|'dowel',count) -> {state,taken}; takeChips(state,count=40) -> {state,taken}
- summarize(state) -> frozen UI snapshot (mode, input/output, cutting, cutProgress, switching, canChangeMode, inputMissing, palletFull, chipsFull, counts, space left).
- Exports: MODES, MODE_LIST, SWITCH_MIN, MAX_LOGS_IN, MAX_POSTS_IN, MAX_OUT (40), MAX_CHIPS (40), CHIPS_PER_CUT, PRODUCT_CENTS {post,beam,dowel,chip}.
- Wiring notes: a cut is "running" only when cutKind is non-null (tick has given it time); input is consumed at the end of the cut, not at the start (same as the sawmill). Goods ids are plural (posts, beams, dowels, chips), PRODUCT_CENTS keys are singular.

## Not verified / honest notes
- I did not run npm test or the release (told not to). Only the four named tests plus index and brief.
- normalizeMachine returns a new object each call, so identity (===) of states is not preserved; tests use deepEqual for "same state".
- A dowel cut is blocked at 35+ dowels on the pallet (needs room for 6), so the pallet can sit at 34 to 39 and still be "full" for dowels; chosen over losing output. Tell me if you prefer partial fill.
- Idle time with nothing to cut is dropped (no stored progress), matching the yard.
Confidence: high for the pure rules (tested at 30/60/144 Hz), high for the goods data, not exercised in the real game since no wiring exists.