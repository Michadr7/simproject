michadr.

# N4 VISITORS (Sonnet)

## Files created
- dist/visitors.js (125 lines per the index): pure visitor plans. Header first line says it implements N4 of notes/npc-movement-design.md.
- tests/visitors.mjs (65 lines).
- No existing file was edited. `npm run index` ran and passed (index 36556 of 37000, brief 2834). visitors.js and its test appear in PROJECT-INDEX.md.

## Test output (real)
$ node tests/visitors.mjs
PASS visitors: Rory plans (60 days x 3 weathers), busyness, pose, Jenni Mon/Wed/Fri, Matt random passes, delivery data

(The first run failed: Rory could start a walk home that ran past midnight. I fixed it in loiterPlan by checking the round trip before leaving. The final run passes.) I ran only this test. No release and no full npm test, as instructed.

## What it does
- visitorPlan(visitor, day, ctx) returns blocks covering 0..1440. It is a pure function of (visitor, day, ctx.weather(day)), built only from hashOf, so co-op clients agree. There is no Date.now or Math.random.
- Rory (loiterer): sleeps rough at camp (hidden), wakes 06:30-08:00, then walks between bench and edge spots. He sits at benches, paces at edge spots, and is back at camp by about 21:00-22:00. Blocks use the schedule.js shape (act travel, outside, pause, sleep, origin, place), so npc-walk.js personPose draws him. visitorPose wraps personPose.
- The busyness.js busyness() and takesOutdoor() are reused. A roaming stop becomes "stay at camp" when the roll fails. In 60 days, fine weather gave more than 2.5 times the roaming minutes of a storm.
- Matt (through-driver): about 45% of days, 1-2 passes, any hour 06:00-22:00, any direction, 22-28 m/s. The Pevrolet. Habits are data (speeding, redLights, pulledOver 'often'). A rare stop is a data field.
- Jenni (through-driver): Mon/Wed/Fri, 08:00 west to east and 15:00 east to west (plus or minus 6 min jitter), work truck, 12-14 m/s.
- Delivery: the same data shape (days, arrive, entry, stops), producing a drive-in block, a visit block per door, then a drive-out block. It is tested with a made-up van. No real delivery exists.
- Drive blocks are act 'travel' with mode 'drive', so presenceOf treats them as hidden. driveProgress(out, plan, minute) gives the 0..1 position along a pass. Gaps are filled with 'away' blocks.
- Exports: the constants (ACTIVITIES, KINDS, RORY_SPOTS, RORY_WAKE, MAP_CROSSING_M, MATT, JENNI, VISITORS and others), visitorPlan, visitorBlockAt, visitorPose, driveProgress, crossingMinutes and weekdayOf. Weekdays are numbered 1=Monday, as in busyness.js.

## Could NOT verify, or missing
- Busyness exists (dist/busyness.js, used by schedule.js). Nothing was missing.
- RORY_SPOTS coordinates are PLACEHOLDERS (no edge points or Rory place ids exist in the map). The caller passes ctx.spots to replace them and ctx.point/ctx.route to the pose. Real spots need the map data, and they must be reachable (a route test like N1's).
- Map length defaults to 1500 m (map-master). The current 540 x 480 map is not used. Pass ctx.mapLength to change it.
- The 'loop' activity is in the vocabulary only. No plan uses it, because personPose has no loop pose. 'enter' and 'exit' are likewise vocabulary only. Rory has no doors.
- Not wired into anything: no drawing, no crowd, no game.js. Nothing was run in a browser. Whether the player can talk to Rory or give him food was not touched.
- Shop-demand and world-tick effects: visitors do not visit shops, so none.
- Not run: npm release, npm test.

## Requested edits to forbidden files (wiring, for a later stage; none needed for this stage)
- dist/npc-crowd.js: add visitors to the crowd (the pool draws plans from visitorPlan over RORY). Hydrogen or Opus game.js lane.
- dist/game.js: pass ctx.point/route (real Rory spots), ctx.weather(day) and the host-clock day into visitorPose. Register the Rory spot place ids in population/place data (place points). Exact lines to be found when wiring.
- N5 (cars) will read drive blocks via driveProgress.

## Confidence
- Rory plan contiguity, purity, busyness effect, pose: high (tested over 60 days x 3 weathers).
- Jenni schedule: high. Matt randomness and ranges: high for the tested ranges (300 days).
- Delivery shape: medium (one made-up case).
- Fit with the real map: low until the real Rory spots and routes exist.