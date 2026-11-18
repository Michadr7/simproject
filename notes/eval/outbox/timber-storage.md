michadr.

# Opus: timber storage fix + calm crew (2026-11-18)

Prompt: notes/eval/prompts/opus-timber-storage.md. Nothing was seen in a browser. No git was used.
Version: package.json stays at 0.35.22 (never deployed). As the main chat asked, I did not bump it; I rebuilt with `npm run release -- --force`.

## What changed (line counts are now)
| file | lines | change |
|---|---|---|
| dist/lumber-hut.js | 57, NEW | Pure module: board and slab slots on the hut's deck; the take, store and prompt boxes; `putDownRule` (store / refuse / ground); TIMBER_YARD |
| dist/game.js | 1936 (CRLF kept) | See "game.js" below |
| dist/sawmill-yard.js | 126 | NEW `storeInYard(state, n, 'planks' or 'slab')`: up to the caps, the rest stays in the hands |
| dist/sawmill-pile.js | 77 | `pileStacks` and `pilePlanks` take an optional slot function (the hut reuses the count mapping); the defaults are unchanged |
| dist/shift.js | 140 | NEW `unrecordPiece`: boards or slabs put back into the hut take back the Mill piece they paid (no take/store pay loop) |
| dist/marks.js | 40 | `createStockPiles` lost the `stock-logs` mesh; the lumberyard `stock-planks` mesh is kept |
| dist/map-definition.js | 1153 | Removed `yard-log-1..3`, the 3 dark pieces east of the hut in the screenshot (decor `log` props) |
| dist/workforce-pose.js | 306 | Calm crew (see part 4); the sawyer carries boards from the belt to the hut |
| dist/npc-crowd.js | 130 | The buck swing is timed in real seconds (`swingAt`), so long phases are not slow motion |
| dist/workforce-tick.js | 302 | Demand gate: `lumberDemand`, `crewShare`, `WORKFORCE_DAILY_DRAW`; new stats demand/crewShare/playerMade |
| dist/world-tick.js | 111 | Passes `playerMade` (logs the player sawed since `progress.crewMark`, x4) and writes the new `crewMark` |
| dist/jobs.js | 75 | Keeps the optional `crewMark` (absent on a fresh save). The save shape is otherwise unchanged; the stock stays in `sawmillYard.planks` / `.slabs`, so old saves load |
| tests/lumber-hut.mjs | 47, NEW | Fit, caps, top stack, store caps, X rule, unrecord |
| tests/workforce-tick.mjs | 216, extended | Section 7: the demand gate (see "Tests") |
| tests/crew-speed.mjs | 37, extended | The phase minimums in real seconds, measured from the poses, and one feller at a time |
| tests/workforce-pose.mjs | 185, re-pinned | See "Re-pins" |
| tests/planks-wiring.mjs | 69, re-pinned | See "Re-pins" |
| tests/timber-game.mjs | 69, re-pinned | See "Re-pins" |
| tests/forest-game.mjs | 42, re-pinned | See "Re-pins" |
| tests/dock-game.mjs | 33, re-pinned | See "Re-pins" |
| tests/crew-trunk.mjs | re-pinned | See "Re-pins" |
| tests/workforce-game.mjs | re-pinned | See "Re-pins" |

Also regenerated: PROJECT-INDEX.md and PROJECT-BRIEF.md (`npm run index`) and dist/releases/0.35.22.

Files I did not touch: the Hydrogen diner and TSL files, carry.js, forest.js, sawmill.js, props.

### game.js (single-line anchors, applied by one node script; `node --check` passes)
- **Line 84, imports:** lumber-hut.js; `storeInYard` and `YARD_MAX_SLABS`; `unrecordPiece`.
- **Line 430, slabs:** the `yard-slabs` slabs are drawn in the hut's west half, along its length. The slab pile no longer blocks at the feed end (timberBoxes holds trunks only).
- **Line 439:** `slabTakeAt` now points at the hut.
- **Line 460, boards:** `syncYardPile` draws the boards on the hut's east half. The `yard-pile` mesh is now in the scene, in world space. The deck pile's collision box is gone.
- **Line 460:** `yardTakeAt` now points at the hut.
- **Lines 791-792, take prompts:** `hut-slabs` ("Take a slab from the lumber hut · n in the hut") and `hut-boards` ("Take 4 boards from the lumber hut · n in the hut") replace `sawmill-slabs` and `sawmill-pile`. They show only with empty hands. Reach is 2.2 m from the hut's deck edge.
- **Line 795, store prompt (NEW):** `hut-store` shows when you carry boards or a slab. It reads "Put the 4 boards in the lumber hut · n / 160", or "The lumber hut is full · ...". It is not tied to a shift, the same as X.
- **Line 836, `storeInHut()` (NEW):** puts what you carry into the yard stock, up to the cap. What does not fit stays in your hands. A full hut gives a toast and nothing goes on the ground. It takes back the Mill piece (`unrecordPiece`).
- **Line 855, X (`putDownCarried`):** at the hut it stores. Elsewhere in the timber yard it refuses ("Boards are kept in the lumber hut: carry them there and press E."). Outside the yard it works as before.
- **Line 1646, passing out in the timber yard:** boards and slabs go into the hut while it has room. Only what does not fit goes down. Passing out is an emergency, not a task.
- **Line 216, `syncMarks`:** only `piles.setPlanks` is left. The landing ring is never shown.
- **Line 812:** the `landing-stack` prompt is removed. `landing-take` is now labelled "Take a log from the company stock" and only shows while an old save still has stocked logs.
- **Toasts:** the toasts for an empty or full hut now say "lumber hut" (the saw stopping, the switch, taking).

## Part 1: boards and slabs live in the lumber hut
- **The hut prop, measured from its mesh:**
  - a 0.6 m deck over x -2.37..2.37, z -3.48..3.46
  - rails at |x| 2.08..2.31
  - corner posts at |z| 3.10..3.41
  - eaves from y 1.96
  - its colliders close it, so you work it from outside, over the rail, like the old sawmill pile
- **Boards (east half):** 4 columns × 5 rows of stacks along z, 2 layers = 40 stacks = YARD_MAX_PLANKS (160). The top sits at y 1.56.
- **Slabs (west half):** 4 × 2 a layer, 10 layers = YARD_MAX_SLABS (80). The top sits at y 1.30.
- **Count mapping:** sawmill-pile.js `pileStacks`. The odd boards sit in slot 0, so taking always lifts the top stack.
- **Reach:** the boards are reached from the east side or either end, the slabs from the west side or either end.
- **The sawmill deck:** it is no store now. A freshly cut stack rides the belt to its end stop and is lifted off there, as before. It already counts in the yard (hut) number. The waiting logs (the real pile) and the trunk deck stay at the feed end.
- **Decision for you:** I did NOT add a "belt output waiting to be carried" buffer. That would be a new saved field in the yard and a new economy step. Cut boards appear in the hut at once, carried by the visible sawyer's loop. Say if you want the real buffer. It is a save change, so the Opus/owner rule applies.

## Part 2: audit (where boards, slabs and logs go now)
| task / action | before | now |
|---|---|---|
| saw cut (yard tick, Cut clip) | boards on the deck pile; slabs on a ground pile at the feed end | into the yard stock, drawn in the hut; the belt stack is lifted off at the end stop |
| E take boards / slab | deck pile / slab pile at the saw | `hut-boards` / `hut-slabs` at the hut (Mill pay as before) |
| E put boards / slab (NEW `hut-store`) | none | into the hut up to the caps; full: toast, kept in the hands |
| X with boards / slab (carry.js putDownPlanks / putDownSlab) | on the ground anywhere | at the hut: stored; elsewhere in the timber yard (x 92..136, z -292..-264): refused with a toast; outside the yard: ground as before |
| passing out with boards / slab | ground | in the yard: into the hut while there is room |
| landing (retired task; E "Stack the log at the landing") | logs stacked beside the hut (the decor pile) | prompt removed; an old save's stocked logs can still be taken |
| fell / buck / gather | trunk and logs at the stump in the forest | unchanged (not by the hut) |
| feed_saw | logs and trunks onto the saw's feed end (the real waiting pile) | unchanged |
| mill | boards and slabs off the deck and slab pile | taken from the hut; putting them back takes the piece back |
| haul / deliver (lumberyard by hand or bed) | consumed at the Eastbank lumberyard | unchanged |
| load (customer truck) | from the hands or the company stock | unchanged |
| stack / pick (warehouse) | racks and order pallets inside | unchanged |
| deliver (orders) | at the customer's drop spot | unchanged |
| visible sawyer | boards to a "pile" station on the deck | belt -> lumber hut south end (124, -275.2) |
| visible fellers | logs to the log deck at the feed end | unchanged (that is the real waiting pile) |
| off-screen crew (workforce-tick) | yard stock, haul to the racks | unchanged (yard = hut), now demand-gated |
| yard-log-1..3 (3 dark pieces east of the hut) | decor props | removed |

Old saves: plank or slab drops already lying in the yard stay where they are (they can still be picked up). Nothing new is put down in the yard.

## Part 3: decor removed and kept
- **Removed:**
  - `stock-logs` (up to 21 logs at the landing ring) and its refill in game.js `syncMarks`
  - the landing ring
  - the landing stack prompt
  - the three `yard-log` props
- **Kept:** `stock-planks` on the Eastbank lumberyard pallets. It shows the company stock that the haul delivery adds to and that the load task ("Load planks from the stock" onto the customer's truck) takes from.

## Part 4: calm crew and the economy
- **Clock:** population.js GAME_MINUTES_PER_SECOND is 0.5, so one game minute is 2 real seconds. routine.js has no rate of its own.
- **Fellers:**
  - FELLER_PHASE_MIN = {chop 18, buck 12, bend 1.5}. A tree's chop and buck is 30 game minutes = 60 real seconds (measured from the poses: >= 60 s). Each bend is 3 s.
  - The swings have a breath between them (CHOP_BEAT_SECONDS 1.6: a 0.74 s swing, then a pause), also while bucking.
- **One feller at a time (FELLER_CHAIN):**
  - The cutter works 06:00-12:00 and the hauler 12:00-18:00. Only slots that end inside a feller's turn are started.
  - Outside its turn a feller stands at rest (phase null, tag 'rest') where its last slot ended, or where its first will start. Nothing teleports (crew-speed passes).
  - Result: 8 visible trees on day 1 for both fellers together.
- **Sawyer:** SAWYER_PHASE_MIN = {pick 1.5, feed 2, saw 12, belt 1.5, hut 1.5}. The loop is 37.1 game minutes, about 74 real seconds a log.
- **Walking pace:** I left WALK_SPEED at 2.1 m/s (the pedestrians' pace). Lowering it is a one-line change in population.js, but it changes every pedestrian.
- **The visible crew makes no stock** (the poses are cosmetic). The stock comes only from workforce-tick.js.
- **Demand gate:**
  - demand = the warehouse's standing 60 + one day's draw (10 warehouse use + 6 town supply = 16) + open orders still to stage + open plank needs.
  - stock = the yard (hut) + the warehouse racks.
  - The crew saws ceil(crewShare / 4) logs. crewShare = max(0, gap - the player's planks sawed since the last tick). It is capped by WORKFORCE_LOGS_PER_DAY (4), the forest's logs and the 48-plank yard pause.
  - When the player covers the gap, the crew saws nothing. With no player sawing, the crew fills the gap.
- **Note on "crew fills >= 6x player speed":** in the code, paceComparison says the PLAYER is >= 6x the crew (8.1x). I kept the crew at 4 logs a day; it covers the daily draw of 16. A 10-day run with an idle player now keeps the warehouse at 57-59 (before the draw term it sagged to 42).

## Tests (real output)
`npm run index`:
```
brief 2834 tokens (target 3000), index 34462 tokens (target 36000); 237 modules, 14 generated, 293 tests, 30 scripts; 13 modules without a header comment
```
`npm run release -- --force`:
```
Packaged release 0.35.22: 238 files -> dist/releases/0.35.22
```
`npm test` (second full run):
```
FAILED FILES: vehicle-sounds.mjs
1 of 293 test files failed.
```
- **vehicle-sounds.mjs is NOT mine.** "AssertionError: diner-bell.ogg is registered". dist/assets/sounds/diner-bell.ogg was added at 10:46 by the parallel Hydrogen diner-sounds work and is not registered yet (dist/diner-sounds.js is theirs). The runner retried it once and it failed twice. I did not touch it.
- **The first full run** had 3 failures: vehicle-sounds (the same), plus crew-trunk and workforce-game (mine, re-pinned below). warehouse.mjs passed on retry (flaky, not mine).

Single runs:
```
PASS lumber-hut.mjs: 40 board stacks (160 boards) and 80 slabs fit the hut's deck in their own halves, under the eaves, none overlapping; taking lifts the top stack; storing stops at the caps (the rest stays in the hands); X stores at the hut, refuses elsewhere in the timber yard, is unchanged outside; a board put back takes back its Mill piece.
PASS workforce-tick.mjs: ... 1/5/30-min frame invariance, pure; demand gate: an idle player -> the crew meets demand, a player who covers it -> the crew saws nothing, crewMark saved.
PASS crew-speed.mjs: ... (feller slot 61 game min, sawyer loop 37.1 game min); calm crew: a visible tree takes >= 60 real s (8 trees on day 1), one feller at a time.
PASS workforce-pose.mjs, planks-wiring, timber-game.mjs, forest-game.mjs, dock-game.mjs, crew-trunk.mjs, workforce-game.mjs, sawmill-pile, sawmill-pile-timber, timber-wiring, carry, forest (all PASS in the second full run)
```

### What the new tests check
- **workforce-tick section 7:**
  1. A full day where the player saws nothing: the crew saws and yard + racks reach the demand.
  2. A player who sawed 16 planks: the crew saws 0.
  3. A player who sawed 8: the crew saws 2 logs.
  4. Stock over the demand: the crew saws 0.
  5. In world-tick: logsSawn past crewMark counts for the player (crew 0), no player sawing means the crew saws, the mark moves, and jobs.js keeps it.
- **crew-speed:** the minimums in real seconds (chop + buck >= 60, bend >= 3, sawyer pick >= 3, feed >= 4, saw >= 20, belt >= 3, hut >= 3), the quickest visible tree measured at 60 Hz, and at most one feller working at any minute.
- **timber-game, in the packaged game:**
  - take a slab at the hut
  - X at the saw is refused (nothing on the ground, the toast names the hut)
  - X at the hut stores it
  - a full hut: E and X both keep the slab in the hands
  - take 4 boards at the hut: `yard-pile` shows 6
  - E puts them back and the Mill piece is taken back

### Re-pins and why
| test | change | reason |
|---|---|---|
| workforce-pose | a phase may be null with tag 'rest'; new "one feller at a time" check; the hauler's slot is checked at 800 | the hauler works afternoons |
| planks-wiring | the no-yard case expects 36, not 48 | 36 in the yard + 65 in the warehouse cover the demand of 76, so the crew rests |
| timber-game | the slab and board steps now happen at the hut | storage moved to the hut |
| forest-game | ring hidden on shift; no stacking at the landing | owner decision 3 |
| dock-game | the landing pile part replaced (no stock-logs mesh, nothing stacked; an old save's stocked log can still be taken) | owner decision 3 |
| crew-trunk | the mesh count leaves out the crew's hand props (`worker-*`, `axe-*`) | they appear lazily with what each worker holds; the new timing changed who holds what at the test minutes. Draw-call proxy now 1210 -> 1212, meshes 1888 -> 1888 |
| workforce-game | the cutter's chop minute is searched 10:00-11:55, then 06:20-10:00 | the cutter's turn ends by noon, so it may rest late morning |

## What I could NOT verify (owner eye-check)
1. **The hut stacks:**
   - boards along the hut on the east half, two layers
   - slabs flat on the west half
   - nothing pokes through the rails, posts or roof, by day and by night (the boards keep the 0.14 glow)
   - the slab model's quarter turn should lay it along the hut
2. **Reaching the prompts:** boards from the east side or the ends, slabs from the west side or the ends. Is 2.2 m from the deck edge comfortable? Check that the hut colliders really leave room to stand there.
3. **The sawyer's new walk** from the belt end to the hut's south end and back: no clipping through the sawmill or hut posts. The route is checked walkable and unblocked by the 10-day sweep, but not seen.
4. **The calm crew feel:**
   - 36 s of chopping with a breath between swings
   - 24 s of bucking
   - the hauler standing still at its block's entry tree all morning (and the cutter after its last morning tree)
   - Is a standing feller fine, or should resting crew go to the hut?
5. **The sawmill deck is empty apart from the belt.** The fresh stack is still lifted off at the end stop with no one carrying it there (the visible sawyer's loop is cosmetic and not synced to the belt).
6. **Draw calls:** unchanged in count (`yard-pile` moved from the sawmill group to the scene). `stock-logs` is gone: -1 draw call and -1 shadow-pass draw while logs were stocked.

## Requests for forbidden files
None needed. The edits to game.js, map-definition.js and the other shared files were in this Opus lane's prompt. Notes/handoff.md is not edited (the main chat owns it).

## Confidence
- Pure rules (hut layout and caps, store and unrecord, X rule, demand gate, crew timing): high. Tested, and walkability checked over 10 days.
- game.js wiring (prompts, store, X refuse and full, drawing counts): high for behaviour (timber-game drives it in the packaged game). Medium for looks and reach feel (never seen).
- Calm crew look: medium. The timing is measured; the look of long phases and resting fellers is not seen.
- Economy feel over many days: medium. Two 10-day probes and the tests look right; the balance (4 logs a day, a draw of 16) is still a placeholder.
