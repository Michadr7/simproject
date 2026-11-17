michadr.

# OPUS: parcel and cargo fixes from the Gemini audit (0.35.17)

Opus 5.5. game.js edited under the owner's one-time permission. No git, no commit. game.js is still CRLF (1765 LF, 1765 CRLF) with no BOM, and `node --check` passes on every touched file. I checked every line I touched for a mid-line `//` that would swallow code: none. My only new `//` comment in game.js is at the very end of line 947. The others are `/* */`.

## Files
| File | Lines now | What changed |
|---|---|---|
| dist/game.js | 1765 (+2) | lines 6, 54, 400, 406-407, 442, 512, 522, 657, 659, 660, 862, 891-892, 939, 945-947, 1326, 1626-1627 |
| dist/gig-parcel.js | 55 | new `parcelAway()`, `PARCEL_ON_BED`, `PARCEL_BED_REACH=12` (lines 25-33) |
| dist/gigs.js | 296 | import line 6; `tickGig` opt `parcelAway` (203, 206); `completeGig` refuses with `opts.parcelAway` (231) |
| dist/cargo-items.js | 186 | `purgeOrphanParcels` uses `parcelTaken` (175); new `needCratesFit`, `NEED_BED_BUSY` (183-185) |
| dist/cargo-view.js | 32 | only planks count as plank stacks; a box is drawn as `prop.carton-medium` (one InstancedMesh per vehicle, made on the first box) |
| dist/carry-pose.js | 28 | `poseFor`: crate or box -> 'box' (free arms, no tool); parcel piece -> 'box' when `parcelInHands` |
| tests/parcel-fixes.mjs | 50 (new) | the pure parts |
| tests/parcel-fixes-game.mjs | 50 (new) | the packaged game: tow, far bed, timeout, slot shift |
| PROJECT-INDEX.md | regenerated | `npm run index` |

## Per item

**#2 needLoad / story-load: true.** With `[crate, box]` or `[crate, parcel]` on the bed, `hasCrates` passes, `pickNeedCrates` takes the farm stock, and then `addCrates` returns CRATE_MIX. `syncNeedCargo` ignores that error. The test shows this on the real cargo.js.
- Fix: game.js 512 and 522 now refuse with `if(!needCratesFit(bed)){toast(NEED_BED_BUSY);return}` ('Clear the bed first.') before any stock is taken.
- As a second guard, game.js 513 now sizes the crate count against the real bed (`addNeedCrates(removeNeedCrates(bed).cargo,...)`, not `null`). An odd bed then gets `maxUnits 0`, and pickNeedCrates refuses without draining the stock.
- Test: tests/parcel-fixes.mjs (the pure rule only; no game-level test for the farm pile).

**#3 parcel on a far bed: true.** `tickGig` and `completeGig` never checked where the parcel piece was.
- New pure `parcelAway(p, fleet, position, driven)` in gig-parcel.js. It is true only when this gig's parcel is on a bed, not in your hands, not on the vehicle you sit in, and that vehicle is more than 12 m away.
- gigs.js: the `tickGig` opt `parcelAway` stops stops from ticking off, and `completeGig` `opts.parcelAway` returns 'Take the parcel off the truck first.'.
- game.js wiring: 1626 passes `position:null` to `tickContract` while the parcel is away. Knocks, metres and the hard time limit still run. Line 657 refuses the report-back with the toast.
- I did this in game.js because gig-bridge.js (which sits between game.js and gigs.js) is not on my list.
- Test: parcel-fixes.mjs (pure) and parcel-fixes-game.mjs (the door does not tick off with the parcel on a truck 33 m away; it does with the parcel in the hands).

**#4 tow and reset skip the unstow: true.**
- New `unstowParcel(f)` in game.js (947), taken out of `exitVehicle`. It returns true when the parcel was stowed on f.
- Called from `exitVehicle` (891-892, the old-flag toast branch kept as `if(!unst&&...)`), from `towCall` (862) and from `reset` (442).
- Test: parcel-fixes-game.mjs. Sit in a shortbed with the parcel (it is stowed), call a tow from the phone. You end up at the shop with the parcel in your hands, the toast 'You take the parcel back.' shows, and the towed truck's bed in the save has no parcel.
- `reset()` is only reachable from the dev panel's 'Back to spawn', so it has no test; it uses the same helper.

**#7 persist before reconcileParcel: partly true.** The audit's claim that the dead parcel is written to localStorage is false. `saveProfile` normalises the save, and `purgeOrphanParcels` drops the piece. I traced it: `persist` was called with the parcel in `driving.save()`, yet the stored save had none.
- What was true: `GameState.progress.vehicles` in memory kept the dead piece until the next save.
- Fix: new `settleParcel()` (game.js 946) runs `reconcileParcel` before `persist()` on gig complete (657 door dialog, 659 failed/closed, 660), give-up (1326) and timeout or stage change (1627).
- Test: parcel-fixes-game.mjs, a rush gig timing out with its parcel on a bed.

**#8 cargo-view and syncParcel: both true.**
- cargo-view.js: parcel and box fell into `stacks++`. Now only planks count. A box is drawn as the medium carton (the model already used in the hands), and the parcel stays game.js's own mesh.
- syncParcel: a crate added after the parcel switches the bed to the crate grid, but the slot index stays 0, so the mesh never moved. game.js 939 and 945 now also track `rack.cargo` (`parcelRackCargo`). `setCargo` always makes a new array.
- Tests: parcel-fixes.mjs (count('planks') 0 for parcel and box, the box mesh) and parcel-fixes-game.mjs (load a crate behind the parcel with E; the drawn parcel follows its new cell).

**Minor items, all done.**
- `purgeOrphanParcels` uses `parcelTaken`: a piece belonging to a gig not yet picked up is now an orphan.
- `poseFor` gate for crate, box and parcel. game.js 753 still has its inline OR; it is correct, and I left it alone.
- `syncCrates`: a dropped box is now drawn with `prop.carton-medium` in its own InstancedMesh `box-drops` (game.js 400, 406-407). Each mesh is hidden while it has no instances. This adds at most one draw call, and only while a box lies on the ground.
- Tests: parcel-fixes.mjs (pose, orphan). The box-drops mesh has no test.

**Proof the game tests catch the bugs:** I ran a scratch copy of parcel-fixes-game.mjs that patches each fix out of the packaged game.js (`editRelease`). Each of tow, far bed, timeout and slot shift then fails with its own assertion. With the fixes in, it passes.

## Test output (pasted)
```
PASS parcel-fixes.mjs: a crate bed with anything else on it refuses the need crates (Clear the bed first.), a parcel on a far bed ticks no stop and pays nothing (in hand, ridden or within 12 m it does), parcels and boxes are no plank stacks and a box is drawn as the carton, the arms hold a crate, box or parcel piece, and a parcel of a gig not yet picked up is an orphan.
PASS parcel-fixes-game.mjs: tow, far bed, timeout, slot shift: a tow from the seat hands the stowed parcel back, a parcel on a far truck ticks no stop (in the hands it does), a timed-out gig leaves no dead parcel on the bed in the game state or the save, the drawn parcel follows its cell when a crate goes on after it.
```
Related tests also re-run and passed (exit 0 each): cargo, cargo-items, cargo-hands, gigs, gig-parcel, carry-pose, load-drag, needs-loop, gigs-game, cargo-game, carry-game, tow-driven, garage-game.

`npm run index`: `brief 2834 tokens (target 3000), index 31301 tokens (target 32500); 210 modules, 14 generated, 253 tests`.

Then `npm run release -- --force` and `npm test`, which ended:
```
ALL 253 PASSED
All 253 test files passed.
```

## Not verified
- Nothing was looked at in a browser:
  - the box carton on beds and on the ground (size, how it sits)
  - the parcel moving to its crate-grid cell
  - the toasts
- No game-level test for the egg-run bed refusal (#2), only the pure rule plus a one-line wiring change.
- `reset()` (#4) has no test.
- The 12 m reach for the parcel's truck (`PARCEL_BED_REACH`) is my choice. If the player ticks off a door with the truck within 12 m and then walks further before reporting back, completion is refused until they come back to it.
- A vehicle towed while NOT driven keeps a parcel left on its bed. The parcel then sits in the shop until the vehicle is collected, and #3 blocks delivery meanwhile. I left this alone: it is a design question.
- `syncNeedCargo` still ignores `addCrates` errors for beds changed by hand during a run (taking a crate off by hand and putting a box on). That path is now rare and was not touched.

## Edits wanted in a forbidden or unlisted file
- dist/gig-bridge.js (not on my list), optional and cleaner:
  - `tickContract(p,{...,parcelAway=false})` should pass `parcelAway` to `tickGig`.
  - `completeContract(p,position,room,tip,pieces,parcelAway=false)` should pass `{tip,par,pieces,parcelAway}` to `completeGig`.
  - game.js would then pass `parcelAwayNow()` instead of using `position:null` and checking before the call. Behaviour would be the same.
- No change needed in world.js, driving.js or any other owned file.

## Confidence
- #2 high
- #3 high for the rule, medium on the 12 m number
- #4 high for the tow and E, medium-high for reset (same helper, no test)
- #7 high (and its real effect was smaller than the audit said)
- #8 high for the logic, medium for how the box looks (not seen)
- minor items high
