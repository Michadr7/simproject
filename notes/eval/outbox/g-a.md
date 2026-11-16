michadr.

# G-A report: dist/gig-pay.js

Files (new only): dist/gig-pay.js (49 lines), tests/gig-pay.mjs (46 lines). Nothing else touched. Ran only `node tests/gig-pay.mjs`.

Real output:
PASS gig-pay: par, wage, fatigue, tip cap, too-fast, integer cents

(First run failed on a -0 from Math.ceil in parMetres; fixed, rerun passes.)

## Values found (the design could not verify these)
- Game clock: 0.5 game minutes per real second (dist/game.js:1445 `advanceTime(P,step*.5)`; also dist/menu-scene.js:14). 1 game minute = 2 real seconds; a game day = 48 real minutes.
- Walk speed 4.5 m/s, sprint 8.2 m/s (dist/game.js:1505; character.js WALK_SPEED 1.5 is animation only). Walk = 9 m per game minute, sprint = 16.4. Pinned in the test (WALK_M_PER_GAME_MIN = 9).
- Rent is weekly: ownership.js:31 "Rent is ... every 7 days"; housing.js:3 STUDIO rent 6000 (billed every 7 days, housing.js:12); house-signs.js "a week"; map-definition.js:277 rentCents 14000-19000 is per week.
- Vehicle speeds are ASSUMED (typical 12 m/s, fastest 40 m/s) in gig-pay.js; check against driving.js before G-B.

## Defaults as built
Walk 20 c/game min, vehicle 30; handling 150/400; min par 150/500 m; slack 1.2; fatigue doneToday 0-4 100%, 5-7 70%, 8-9 40%, 10+ 0 (hard stop, MAX_GIGS_PER_DAY 10); tip = generosity x 10% x band (full >=90, half >=70), cap 25%, on time only; too fast (elapsed < par / fastest pace) = handling fee x fatigue only, no tip. Walk rate 2.22 c/m. A 150 m par walking gig: base 483 c, minElapsed 9.1 game min.

## Design issues
1. Walking pace is 9 m per game minute, so a 150 m gig takes only about 17 game minutes (35 real seconds). At the minimum par the hourly rate is 483 c / 16.7 min = about 1740 c/h, because the 150 c handling fee dominates. That is just under the top of the 800-1800 range; with a max tip (603 c) it is about 2170 c/h, above it. The test asserts pay-only stays in 800-1800. If the owner wants less, raise MIN_PAR_M.walk (to about 300 m) or cut handling.
2. Whole-map walks are fast: a 1,500 m map crossing is only about 3 real minutes. The "1 hour of gigs" fair-wage check is about 3.6 gigs of real play.
3. The design's "11+ 0" tier is implemented as the 11th gig (doneToday 10) paying 0 and canTakeMore false, i.e. 10 gigs a day.
4. The pay time ignores walking to the pickup; par is pickup to drop only, so G-D should count the player's trip to the pickup as free time, or add it to par.

## G-B (gigs.js wiring) must change
- Replace REPEAT_PCT (gigs.js:50) and repeatsToday in the payFor call (gigs.js:135) by `doneToday` (gigs completed this game day, reset at 05:00 next day, stored in progress) and call gig-pay.payFor({mode,parM,quality,repMul,doneToday,generosity,onTime,elapsedMin}). Keep the old payFor(typeId,...) as a wrapper.
- repMul: gigs.js currently uses g.rep 0-100 inside payFor; map that to a multiplier (1 = none, large gig 1.4) before passing.
- Slots/actives need origin (pickup) and a points list so parMetres can be stored at accept time; board must drop offers with par < MIN_PAR_M[mode] (starter gigs exempt).
- Track accept time (game minutes) so elapsedMin can be computed at completion; late = elapsedMin > par time limit (G-B decides the limit).
- Board must stop offering and acceptGig must refuse when !canTakeMore(doneToday): show 'No more work today'.
- tests/gigs.mjs expectations change when REPEAT_PCT goes.

Confidence: pure module and its test, high (ran, passes). Vehicle speeds, tip formula per generosity (10% steps) and the exact too-fast threshold are my choices, flagged as tunables. Not verified: nothing run beyond this test.
