michadr.

# TEST1: make the test suite trustworthy

## Diagnosis (numbers)
**tow-driven.mjs: a TIMING/test-isolation flake, NOT the RV1 shoreGuard.**
- Alone, 20 runs: 14 passed, 6 failed (about 30 percent, even with nothing else running). Every failure was the same assertion, section B2 (world edge): "at the world edge the toast says so (x 1037.5)". Section B (the three headings east from (280,40)) passed in all 20 runs, with identical numbers every time: heading 1.57 -> x 338.5, 1.22 -> x 334.9, 1.92 -> x 334.9. Physics is stepped with fake time (pump), so it is deterministic; shoreGuard and the bank slope are not involved (all three headings pass x 330 with 5 to 8 m to spare).
- Cause: the game's toast hide timer is a real 4.5 s setTimeout and the synthetic document is a global. A toast timer left by an EARLIER booted game (A1/A2/B) fires on the NEXT game's #jobToast and sets hidden=true, and the test read `hidden?'':text`. B2 failed when that stale hide landed inside its wait window. B2 alone passed 10/10.
- Fix (test only): the test records every text set on #jobToast (property spy) and asserts on that, not on `hidden`; B2 waits by polling (50 ms sleep + small pump) up to 15 s and leaves as soon as the edge note is seen. Everything it asserts is kept. After: 15 of 15 alone passed.

**hub-runs.mjs: 8 s waitFor and a REAL race in production code (hub/runs.js).**
- Alone 12/12 pass; under CPU load (8 busy PowerShell jobs) 3 failures in 25 runs. Failure text: `TypeError: Cannot read properties of null (reading 'handle') at Object.stop (hub/runs.js:177:83)` from tests/hub-runs.mjs:92 (`await runs.stop(idH)`).
- This is a genuine bug in hub/runs.js line 177, not a test timing issue: `if(active&&active.runId===id){await active.handle.stop('stopped');await active.handle.done;...}`. While `stop` is awaited, the run's exit handler can set `active=null`, so `active.handle.done` throws. Under load the exit lands in that gap. In the real hub it would make the Stop button return a 500 on a run that did stop.
- NOT fixed (rules: no hub production edits). REQUESTED EDIT, hub/runs.js line 177: capture the handle first, e.g. `if(active&&active.runId===id){const h=active.handle;await h.stop('stopped');await h.done;return {run:view(readRun(root,id))}}`. Until then hub-runs.mjs will stay an occasional flake (about 10 percent under heavy load, 0 percent alone), and the new runner will show it as "PASSED ON RETRY".
- Test hardening done: waitFor limit 8000 -> 30000 ms (early exit unchanged, error now names the waiting line); the reapOrphans part waits until both fake pids are alive. Server already uses port 0 and a unique mkdtemp dir, so no port or dir collisions exist.

## Files changed
- scripts/run-tests.mjs (rewritten, 23 lines): first failure prints the file name and the tail of its output (bake noise removed), the file is retried once, both results are printed; "PASSED ON RETRY: x.mjs (flaky)" is logged and listed at the end; "FAILED FILES: a.mjs, b.mjs" or "ALL n PASSED" at the end; exit 1 if any file fails twice. The old lines `All N test files passed.` / `X of N test files failed.` / `FAIL file` are kept exactly because hub/jobs.js summarise and the version bump parse them. Run time unchanged (about 207 s).
- tests/tow-driven.mjs (about 52 lines, boot wrapper with toast recorder, toastSaid helper, B2 polling wait).
- tests/hub-runs.mjs (258 lines, waitFor + one extra wait).
- No dist/ or hub/ edits. No git. No BOM. notes/handoff.md untouched. A temporary probe file tests/_probe_b2.mjs was created and deleted.

## Three full runs (npm run release -- --force first, then npm run index: index 26677 tokens, cap 32500 not touched; full outputs in the scratchpad full1.txt, full2.txt, full3.txt, grepped)
Run 1: `ALL 222 PASSED` / `All 222 test files passed.` (no FIRST RUN FAILED, no PASSED ON RETRY lines), exit 0, 207 s
Run 2: `ALL 222 PASSED` / `All 222 test files passed.` (none retried), exit 0
Run 3: `ALL 222 PASSED` / `All 222 test files passed.` (none retried), exit 0
Scratchpad: C:\Users\Michael\AppData\Local\Temp\claude\8fae7b33d78fadc6\d0b2dad1-787c-4692-8720-f914b98b50d6\scratchpad\full1.txt (and full2, full3)

## Still not deterministic
- hub-runs.mjs: the runs.js stop() race above (needs the one-line hub edit).
- The game's real timers (edge note 400 ms, toast hide 4.5 s) remain real time; the tests now tolerate them, but boot-game has no fake clock. Stale timers from an earlier booted game still fire on the next one's document (a cleaner fix would be in tests/support/boot-game.mjs: clear the previous game's timers or give each game its own document; not done, to keep the change small).
- Other tests with real sleeps were not audited; none failed in 3 full runs.

## Defaults chosen
waitFor 30 s; one retry per failed file (retry of a pass is never hidden); B2 wait up to 15 s.

## Confidence
tow-driven fix: high (0/15 after vs 6/20 before). Runner: high (3 clean runs, but the retry branch was not exercised in the full suite because nothing failed; it is syntax-checked and the output format was checked against hub/jobs.js regexes by reading, not by running). hub-runs: medium, blocked on the runs.js edit.