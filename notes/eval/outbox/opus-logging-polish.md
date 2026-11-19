michadr.

# Opus logging polish: heavier, chunkier, varied axe swings (2026-11-19)

dist/logging-sounds.js did not exist when I started, so nothing was wired for it. I added no sounds.

## What was built
- **The swing in phases** (dist/chop-path.js, still a pure function of progress 0..1). `CHOP_TIMING = {windUp .4, top .52, impact .62, stop .665, hold .72}`:
  - wind-up, slow (0 to .40)
  - a held beat at the top with a small last lift (to .52)
  - a fast committed strike (to .62). The blade hits at `CHOP_IMPACT = .62`.
  - a dead hit-stop (to .665): 4.3 frames at 60 Hz on the base axe, and at least 2.7 frames on the fastest level-20 swing
  - a small recoil up and back out of the cut (to .72)
  - a slow recovery to the trail carry (to 1)

  Torso lean (back, back further, then forward into the blow) and a crouch weight-drop (`out.crouch`, at most 0.17) follow the phases. At progress 0 and 1 the pose is exactly the carry, whatever the variant, so chained swings join without a snap.
- **Variety**: `chopVariant(index, seed)` is pure, with no Math.random. The seed is a number or a string. It returns:
  - `side`: alternates every swing, so the notch is cut from alternate sides (a slight diagonal from the right, then from the left)
  - `tilt`: 0.2..1 of 8 cm
  - `lift`: wind-up height, -3..+7 cm
  - `snap`: strike ease power, 1.6..2.3
  - `sag`: recovery dip, ±6 cm

  The player's seed is the tree's plot key (or `buck-<id>`). The index is the plot's saved hits / 2 (or the trunk's hits / 2), so co-op clients agree.
- **Timing (what I chose): tuning swings needed.** One heavy swing lands `HITS_PER_SWING = 2` of tools.js's hits, so a pine takes half the swings and each lasts about twice as long. `swingSeconds(base, need) = base*max(need,2)/ceil(need/2)`, where base is skills.js `swingTime`. This keeps the total time exactly the same for any job of 2 or more hits.
  - Starter axe, level 1: **swing 1.60 s** (was 0.80). A pine takes 4 hits = 2 swings = **3.2 s, the same as before**. Bucking takes 2 hits = 1 swing = 1.6 s (was 1.6).
  - Logging axe, level 5: 3 hits, so 2 swings of 1.02 s = 2.04 s (was 2.04).
  - Changed: a 1-hit job (steel-axe bucking at a high level) still gets one full heavy swing, for example 1.0 s instead of 0.5 s. Digging out a stump is one heavy swing: 1.6 s at level 1 (was 0.8).
  - XP per tree is unchanged (2 XP per hit, still 4 hits). Level-up messages are merged across the two hits of a swing.
- **game.js**:
  - startChop, startClear and startBuck use swingSeconds and keep a seeded `variant`.
  - updateChop passes the variant, sets `avatar.setCrouch` (and resets it at the end), and lands the hit at `CHOP_IMPACT*total`. That hit triggers the existing chips (`world.hitTree`), `audio.timber('chop')` and fall, and adds a small camera nudge through the **existing** crash-shake helper (`shake`/`applyShake`, amplitude 0.035 for 0.16 s, so about 1.4 cm at its start). The nudge is skipped under reduced motion (`calm()`).
  - strikeTree lands HITS_PER_SWING `chopTree` hits per swing and stops at the felling hit. strikeBuck counts +HITS_PER_SWING per swing.
  - The chainsaw code is untouched.
- **Crew** (npc-crowd.js): the workers use the same phases. Each swing gets a seeded variant, latched at its start from the clock and the worker's id (the same on every co-op client). Lean and crouch follow the pose.
- **Outside my file list: dist/workforce-pose.js**, one line: `SWING_SECONDS .74 -> 1.5`, `CHOP_BEAT_SECONDS 1.6 -> 2.4`. Without it the crew would play the new heavy swing squeezed into 0.74 s. The new beat divides both phases exactly (36 s chop = 15 swings, 19.2 s buck cut = 8), so no worker swing is ever cut short. The crew now makes fewer, heavier swings per phase; their timetable is unchanged. If you do not want this file touched, revert that one line.

## Files changed (line counts now)
- dist/chop-path.js (99): phases, CHOP_IMPACT, HITS_PER_SWING, swingSeconds, chopVariant, chopPose(progress, out, carry, variant) with `crouch`. CHOP_TIMING fields changed.
- dist/game.js (1970): import line 75, constants line 173, startChop, startClear, startBuck, updateChop, strikeTree, strikeBuck. It is CRLF with single-line anchors; each swap was checked to occur once.
- dist/npc-crowd.js (132): import, resetWork, the axe swing in workPose.
- dist/workforce-pose.js (306): the one constant line above.
- tests/chop-swing.mjs (51, NEW).
- tests/chop.mjs (77): re-pinned, see below.
- PROJECT-INDEX.md: regenerated.

## Tests
New tests/chop-swing.mjs covers:
- the phases are in order, the impact is inside the strike, and the blade arrives there
- the hit-stop is still, then the recoil follows
- continuity at every phase border, and the carry pose at both ends, for 241 variants
- smooth outside the strike, fastest inside it
- bounded hand, lean, crouch and grip, and junk input is clamped
- the same seed gives the same sequence, consecutive swings differ (the side alternates, more than 2 cm apart at the top), and different seeds differ
- frame-rate independence at 30/60/144 Hz (the same pose at the same time, and the hit within one frame of CHOP_IMPACT)
- base swing 1.3..1.8 s, and felling and bucking time kept within 20% for every axe and level (exact for need >= 2)
- the crew beat never cuts a swing short at a phase end

Re-pinned in tests/chop.mjs, deliberately:
- the step bound is now "under 1.5 cm outside the strike, under 9 cm inside it" (was 6 cm everywhere), because the strike is now meant to be short and fast
- the peak is at `CHOP_TIMING.top` (after the held beat), not at `windUp`
- the fastest point is in top..impact
- "holds at impact" now ends at `stop`, because stop..hold is the recoil
- the mid-swing body check uses the same point of the strike as the old `.55` (`MID = top + .72*(impact - top)`), because `.55` now falls early in the strike, where the body still leans back

Gate:
```
> node scripts/build-index.mjs
brief 2834 tokens (target 3000), index 34805 tokens (target 37000); 261 modules, 14 generated, 319 tests, 31 scripts; 13 modules without a header comment
> node scripts/package-release.mjs --force
Packaged release 0.36.1: 262 files -> dist/releases/0.36.1
dist/index.html now loads releases/0.36.1/
npm test:
PASS chop-swing.mjs: PASS chop-swing.mjs: five phases (wind-up 0.4, held beat to 0.52, strike to the impact at 0.62, hit-stop to 0.665, recoil to 0.72, recovery), continuous at every border and the same carry pose at both ends for 241 variants, bounded, consecutive swings differ (the notch side alternates), seeded and repeatable, frame-rate independent at 30/60/144 Hz, base swing 1.60 s with felling time kept, crew beat 1.5/2.4 s.
PASS chop.mjs: Swing path (continuous, overhead then a fast blow, ...) ... passed.
PASS chainsaw-pose.mjs / chainsaw-game.mjs / crew-trunk.mjs / crew-speed.mjs / workforce-pose.mjs / workforce-game.mjs / forest-game.mjs / timber-game.mjs / tracker-game.mjs / grid.mjs (all PASS in the same run)
ALL 319 PASSED
All 319 test files passed.
```
(Several game tests show a `world.js:579:45` stack line as their last stderr line in the summary. It comes from world.js, which I did not touch, and those tests pass.)

## Requested edits (files outside this task)
- dist/skills.js `perksText` (shown on the phone): it now says "Swing 0.80 s · 4 swings per tree". With heavy swings it should say `Swing ${swingSeconds(swingTime(level),hits).toFixed(2)} s · ${Math.ceil(hits/HITS_PER_SWING)} swings per tree` (import from chop-path.js). tests/skills.mjs line 11 is unaffected; check any test that pins the perks text.

## Owner eye-check list
1. Fell a pine with the starter axe:
   - two heavy swings, each with a slow wind-up and a beat at the top, a fast blow, a short freeze on contact, a little bounce out, then a slow return to the trail carry
   - the chips, the chop sound and a tiny camera nudge all land on contact, not at the start
   - the swings come alternately from the right and from the left, and never look identical twice in a row
2. Body: the lean back while loading, the drop of weight into the blow (a small knee bend), and no pop between chained swings.
3. Buck a trunk with the axe: one heavy swing finishes it at level 1 ("Cut" toasts only at higher needs). Also buck with the chainsaw and check it is unchanged.
4. Watch a crew feller at 10:00: slower, heavier swings with a breath between them, varied, the bucking ones crouched. Nothing should snap at the start or end of the chop or buck.
5. Dig out a stump: one heavy swing.
6. With reduced motion on, there should be no camera nudge.

## What I could not verify
- Nothing visual: there is no real GPU here. I could not judge the feel, the timing on screen, whether the 1.4 cm nudge is visible or too much, or whether the diagonal swings still clear the trunk visually.
- The axe swing has no cancel path in game.js (only the chainsaw can be let go), so "continuity on cancel" is covered only by the chainsaw tests and by the crew's never-cut-short beat.
- Co-op: the variants are seeded deterministically, but I did not run two clients.

## Confidence
- Phases, variety, timing balance and tests: high (pure, covered, full gate green).
- game.js wiring (hit at impact, 2 hits per swing, crouch, nudge): medium-high (the packaged game tests that fell and buck pass; the look is unseen).
- Crew tempo: medium (the maths is checked; the look is unseen; it relies on the one workforce-pose.js line outside the file list).
