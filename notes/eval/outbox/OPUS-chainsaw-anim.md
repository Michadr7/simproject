michadr.

# OPUS chainsaw-anim: report (2026-11-18)

## What this run found and did
- An earlier run (about 02:40-02:50 today, before the rate-limit cut) had ALREADY built Tasks 1, 1b and 2. Your prompt said nothing was edited, but the files say otherwise: dist/chop-path.js (sawPose, sawStand, sawCutting, the trail carry CARRY/CARRY_DIR/carryGrip), dist/game.js (sawStep, sawEquipped, the sawdust chips, audio `cutting`, syncCrewTimber/crewVisit), dist/npc-crowd.js (forEachWork, the trail carry for the workers), plus tests/chainsaw-pose.mjs, tests/chainsaw-game.mjs and tests/crew-trunk.mjs. I checked them (ran the tests, read the wiring) and did not rebuild them.
- This run did Task 3 (the crew at super speed), plus the test re-pins it caused.

## Task 3: the cause and the fix
- Cause: dist/workforce-pose.js gave every walk and carry a FIXED number of game minutes (carry 2.2 min = 4.4 s real at GAME_MINUTES_PER_SECOND 0.5) on routes 25-163 m long (block A1's tree to the log deck is 145 m, plus up to 18 m inside the block). The sawyer's walks were also fixed (for example 21.8 m in 1.1 min).
- Measured before the fix (0.1 s real steps, 06:00-18:00): cutter/hauler up to 52.5 m/s (day 1) and 138.1 m/s (day 4, the midday block change); carries up to 37.7 m/s; sawyer 9.9 m/s; teleports at some phase changes.
- Fix (the timetable is now longer, as the prompt allowed; nothing teleports): only the station phases keep fixed minutes (FELLER_PHASE_MIN = {chop 2.4, buck 1.5, bend 0.4}). Every walk lasts route length / WALK_SPEED and every carry route length / HAUL_SPEED (minutesFor). A feller's slot (walk to a tree, chop, buck, two carries to the deck and back) is as long as its routes need: about 30 game min in the near blocks and up to about 200 in A1/A2. Slots run back to back from FELLER_CHAIN_START (cutter 06:00, hauler 05:30, so the two are out of step). The sawyer's loop is computed the same way: 15.4 game min (was 6).
- After: 2.1 m/s max for all three (WALK_SPEED, the pedestrians' pace; the player walks at 4.5). Note: population.js WALK_SPEED is 2.1, not the 1.4 your prompt mentioned. I kept it so the crew matches the pedestrians and the walk animation; lowering it is a one-line change if you want them slower.
- Side effect: the crew now visibly does fewer trunks per day (a few long slots instead of 48 x 15-min loops). That is closer to FELLER_TRUNKS_PER_DAY = 2 in the tick rules, which this change does not touch.
- npc-crowd.js: the second-log look-back used the old fixed minutes (F.carry1 and so on); it now asks workforce-pose.js fellerPickMinute (pure, no allocation).

## Files changed by THIS run (line counts now)
- dist/workforce-pose.js (276): timetable rebuilt as above. New exports: minutesFor, FELLER_CHAIN_START, fellerPickMinute, fellerSlot. SAWYER_CYCLE_MIN is now computed. FELLER_CYCLE_MIN is removed. FELLER_PHASE_MIN is now {chop,buck,bend}.
- dist/npc-crowd.js (128): the import, and the look-back in workSpot.
- tests/crew-speed.mjs (29, NEW): no worker ever goes over WALK_SPEED, checked over full working days at 60 Hz (days 1/4/7), 30 Hz and 144 Hz, and over ten days at a coarse 1 s step. Also checks that the pose's `speed` matches the distance actually walked (so the feet keep up) and that slot and loop lengths are sane.
- tests/workforce-pose.mjs (174), re-pinned: 4b no longer asserts phases summing to FELLER_CYCLE_MIN (gone). It finds the slot with fellerSlot and accepts the slot without a walk when the hash picks the same tree again.
- tests/crew-trunk.mjs (53), re-pinned: picks minutes where the hauler has nothing on the ground (the two fellers no longer sit exactly half a 15-min cycle apart, so the hauler's logs were being counted). mBuck and mCarry1 must be in the same cutter slot. mCarry2 is any later minute with the cutter's logs gone.
- tests/workforce-game.mjs (68), re-pinned: the clock goes to the first minute from 10:00 where the cutter chops (10:00 itself may now fall on a carry, with no axe in hand).
- tests/timber-game.mjs, re-pinned: before "Put the trunk on the bench", the clock steps to a minute when Priya (the sawyer) is at least 6 m from the feed end. Her new loop put her there at that minute, and E then offers "Talk to Priya Nair" first.
- Not touched by this run: dist/game.js, dist/chop-path.js (the earlier run's work), and none of the forbidden files.

## Draw calls (crew-trunk test proxy at the hub, day 4, crew working)
1227 before the trunk is down, 1228 while the crew trunk lies there (meshes 1863 -> 1863). The +1 is the existing ground-trunks InstancedMesh going from 0 to 1 instance. If the player already has a trunk down, the crew trunk costs 0. No new mesh or Points object.

## Tests (pasted output)
Gate: `npm run index` gave "brief 2834 tokens (target 3000), index 33559 tokens (target 34000)". `npm run release -- --force` gave "Packaged release 0.35.20: 232 files" (no version bump). Then `npm test`:
```
ALL 288 PASSED
All 288 test files passed.
```
The first full run had 1 failure, timber-game.mjs ("Talk to Priya Nair", which my sawyer timing caused). I re-pinned it as described above, then ran the whole gate again and got the result above. Lines from that run:
```
PASS crew-speed.mjs: the Ridgeline crew never moves faster than 2.1 m/s (pedestrian pace, under the player's 4.5 m/s walk) over full working days at 30/60/144 Hz and ten days coarse, no teleports at phase or block changes, and the pose's speed matches the distance walked (feller slot 30 game min, sawyer loop 15.4 game min).
PASS workforce-pose.mjs: cutter/hauler/sawyer deterministic across 30/60/144 Hz, co-op exact, 10 days x all waypoints walkable & unblocked, all 5 phases (chop/buck/carry/bend/walk/saw), zero allocations on sealed out, pure.
crew-trunk draw-call proxy at the hub (115, -285.5), day 4: 1227 before the trunk is down, 1228 while it lies there (meshes 1863 -> 1863)
PASS crew-trunk.mjs: day 4: while the cutter bucks, the crew trunk lies at the pose's trunkX/trunkZ (across the feller) in ground-trunks; ...
PASS workforce-game.mjs: day 4 at 10:00 the cutter holds the axe at a marked pine, ...
PASS chainsaw-pose.mjs / chainsaw-game.mjs / chop.mjs / tools.mjs / timber-game.mjs (all PASS in the same run)
```

## Owner eye-check list
1. Chainsaw bucking from the front and from the side: the step in beside the trunk's middle, the lean and crouch, the bar going down through the trunk (not through you), the small vibration.
2. Let go of E early: it should ease back to the carry with a small lift, with no snap.
3. Sawdust chips at the kerf while the bar is in the wood. They use the sawmill's one Points object. Please check they are visible in the FOREST, far from the sawmill.
4. The axe trail carry (one hand under the head, the edge down, the arm at the side) and how it blends into the swing and back. Also the workers' axe.
5. The crew trunk at 10:00 at the forest: a trunk appears where the feller bucks, then two logs, then one, then none.
6. The crew's pace: walking between the trees and the log deck, and the sawyer in the shed. They should walk, not slide, and never be faster than you walking.

## What I could not verify
- Nothing visual: there is no browser with a real GPU here. Chip visibility far from the sawmill (the Points object is the sawmill's; the code steps it when the sawmill is out of range, so it should draw), the look of the poses, and foot sync are unchecked.
- I did not re-design the earlier run's Task 1/1b/2 code; I only checked its tests and wiring.

## Confidence
- Task 3 (speed): high. Measured before and after, and covered by a new test plus the existing 10-day walkability sweep.
- Tasks 1, 1b, 2 (earlier run): medium-high on behaviour (tests pass); visual quality unverified.
