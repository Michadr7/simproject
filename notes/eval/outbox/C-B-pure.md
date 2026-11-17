michadr.

# Stage C-B (pure side): crate/box/parcel in the hands, parcel and box bed pieces, migration behind a switch

## Files changed (lines now) and what changed
- dist/carry.js (96): HANDS_SPEED / HANDS_LOAD / CARRY_KINDS (the ONE hands table; carryEffects reads it, cargo-items.js handsRule reads it, no import cycle: cargo-items -> carry, never the reverse). normalizeCarry accepts crate, box, parcel {gig,model,large?} besides log/planks (garbage -> null, normalising twice is the same). Parcel now slows to .9 with no sprint, crate .6 no sprint (only visible once a parcel/crate is actually in the hands).
- dist/cargo.js (155): CRATE_HANDS removed (nothing else imported it; game.js does not). New CRATE_STAYS (same text), CRATES_BY_HAND=false, PIECE_KINDS, carryOfPiece, pieceOfCarry. loadCarry takes log/planks/crate/box/parcel (crate only on crate beds, never on timber, timber never on crates, BEDS space/maxPieces/height still rule). unloadOne/unloadKind put any piece into the hands: crate -> {kind:'crate'}, box, parcel; they take a last argument byHand (default CRATES_BY_HAND). normalizeCargo keeps {k:'parcel',g,m,l?} and {k:'box'} (crates + parcels may mix; timber still wins over crates). pieceSpace parcel 1 (large 2), box 1. slotPositions gives parcel/box their own kind and a low height (crate bed: they take a grid cell). cargoText counts them.
- dist/cargo-items.js (about 195): speedMul from HANDS_SPEED; box kg from load-drag BOX_KG; PARCEL_PIECES_ENABLED=false (exported constant); removeParcelPieces(progress,gigId?), purgeOrphanParcels(progress), parcelCarried(progress).
- dist/load-drag.js (14): cargoMassKg counts parcel (3 kg, large 6) and box (BOX_KG 5).
- dist/jobs.js (66): normalizeProgress = normalizeProgressWith(value,PARCEL_PIECES_ENABLED); only when true: after vehicles and gigs are normalised, purgeOrphanParcels then migrateParcel (once, twice-stable). Default false = no change at all.
- dist/gigs.js (295): endParcel(p,a,pieces); failGig(...,pieces), completeGig(opts.pieces) incl. the late-fail path, abandonGig(p,pieces) remove that gig's parcel piece from the hands and every vehicle's cargo; need gigs have no parcel and are skipped. All default to PARCEL_PIECES_ENABLED (false = untouched).
- dist/gig-bridge.js (77): abandonContract, dropGigParcel (X: the hands piece becomes the ground drop), pickGigParcel (E: the picked-up parcel is a hands piece), pickUpGigBox (pickup at the origin puts the piece in the hands), completeContract: all take a last `pieces` argument defaulting to the switch.
- dist/gig-parcel.js: NOT changed (cannot import cargo-items; nothing needed).
- tests/cargo-hands.mjs (112, NEW): 5 sections, tests both switch values (the switch is a constant, so every function takes an explicit override and `normalizeProgressWith(value,true)` is the "on" path).
- tests/cargo.mjs: ONE line changed. It pinned `unloadOne/unloadKind(...)).error === C.CRATE_HANDS` ("never carried by hand"). The redesign deliberately reverses that: it now pins CRATE_STAYS with the switch off, and that a crate comes off into {kind:'crate'} and goes back on with the switch on. No other existing test needed a change (carry.mjs, cargo-game.mjs, load-drag.mjs, delivery-game.mjs, gigs*.mjs, starter-game.mjs, carry-pose.mjs all unchanged and passing).

## One deliberate deviation (please read)
You asked to remove the crate refusals in unloadOne/unloadKind. I removed them, but gated the result behind `CRATES_BY_HAND=false` (cargo.js, default off) for crates and boxes. Reason: game.js's X handler (putDownCarried, ~l.717-721) sends every non-log carry to putDownPlanks, so a crate in the hands would answer "You are not carrying planks." for ever and the player would be stuck (the same trap as the planks bug). game.js takeOffBed (l.207) and takeKind (l.199) call unloadOne/unloadKind without a flag, so with the refusal gone and no gate the live game would strand people. With the switch on (tests do this) everything works as asked. Parcels need no switch (they only exist as pieces when PARCEL_PIECES_ENABLED is true). Flip CRATES_BY_HAND to true in the same edit that wires the X put-down.

## Test output (real)
```
> node tests/cargo-hands.mjs
PASS cargo-hands: crate/box/parcel carry normalised and slowed (one table), a crate off the bed into the hands and back (switch), parcel and box bed pieces, load drag counts them, the save migration behind PARCEL_PIECES_ENABLED (off changes nothing, on moves a held parcel once), gigs end their parcel piece
> node tests/cargo.mjs   (PASS, updated line)    > node tests/cargo-items.mjs (PASS)    > carry, load-drag, delivery-game, cargo-game, gigs, gigs-game, starter-game, carry-pose, jobs: PASS
> npm run release -- --force
Packaged release 0.35.17: 209 files -> dist/releases/0.35.17
> npm test   (run BEFORE I regenerated the index)
FAILED FILES: brief.mjs
1 of 249 test files failed.
> npm run index ; node tests/brief.mjs
brief 2834 tokens (target 3000), index 30919 tokens (target 32500); 208 modules, 14 generated, 249 tests, 28 scripts
brief tests passed: 208 modules listed, brief 2834 and index 30919 estimated tokens (budgets 3000 and 32500)
```
The one full-run failure was brief.mjs only: the new tests/cargo-hands.mjs was not in PROJECT-INDEX.md yet (I ran `npm run index` after the full run). After `npm run index` brief.mjs passes (output above). I did NOT re-run the whole `npm test` after that (248 of 249 passed in the full run; no dist file changed between). Cap not raised (30919 of 32500).

## Could NOT verify
- Nothing is wired into game.js, so no in-game behaviour or browser check. The packaged game loads (startup-style tests passed in the full run).
- Real old saves from a browser: only synthetic saves. No old save has a parcel carry or crate carry; with the switch off nothing reads or writes them.
- cargo-view.js (drawing, not mine to edit) draws an unknown piece kind as an empty stack: a parcel/box on a bed is invisible until stage C-D (no crash: checked by reading, not run in a browser).
- "Expiring" a gig: game.js l.920 sets `gigs.active:null` itself (a long line I did not edit); it must call failGig/abandonContract (or removeParcelPieces) so the piece goes too (see edit 7).

## EXACT game.js edits the main chat must make (nothing is flipped yet)
1. Switches: set `PARCEL_PIECES_ENABLED=true` (dist/cargo-items.js) and `CRATES_BY_HAND=true` (dist/cargo.js) in the same edit as items 2-6; before that, none of the new paths run.
2. X put-down (putDownCarried ~l.717-721): replace `planks=p.carry.kind==='planks'` / `r=...putDownPlanks` with a switch on p.carry.kind: log -> putDownLog, planks -> putDownPlanks, parcel -> `dropGigParcel(cur,{x,z})` (gig-bridge; it moves the hands piece to the ground drop), crate -> push a crate drop (new, see 3), box -> same as crate. The first line `if(!p.carry&&parcelHeld(p)){putDownParcel();return}` stays valid for the old flag; with pieces on the parcel is p.carry. The "inside/shop: Carry it outside" toast works unchanged.
3. Ground crate: a crate in the hands put down needs a ground object. Smallest option: a new `crateDrops:[{id,x,z}]` progress field (like plankDrops) with put/pick functions in carry.js (not written here; say so and I will add them, normalizeProgress would also need it), drawn from the carton/crate prop; or refuse X outdoors with "Put it back on a bed" until C-C. Without a ground drop, a crate in hands can only go back on a bed with the wheel/E.
4. Visual pose: carryLog/carryPlanks (l.396-399) key off carry.kind. Add the carton-in-both-hands pose for crate/box/parcel (reuse the parcel pose the carry-pose test covers, prop = carry.model for the parcel, the crate prop for a crate), and the pose blend (l.730) for kind in (crate,parcel,box).
5. Hands rule: speed/sprint/stamina already come from carryEffects(p.carry) wherever game.js calls it (crate .6, parcel .9, box .9, never sprint). Vehicle entry: mountError (gig-parcel.js l.29) refuses `p.carry` already; with the parcel as a piece, parcel carry is refused entry too, which is wrong for ATV stow: on mount, move a parcel carry onto the bed with `loadCarry(p.carry,bed,model)` (cargo.js; works for every model with space, ATV rack = one piece), on dismount `unloadKind(null,bed,model,'parcel')`. Then delete STOW_MODELS/canStow/stowed/RACK_BUSY use.
6. Cargo panel (~l.191-207) and the 'Take a log/planks off the <vehicle>' prompt (~l.675): build the rows from `summarize(fromLegacyCargo(cargo))` (cargo-items.js): kinds log, planks, crate, parcel, box; a crate row reads 'Take a crate' and calls `takeKind(id,'crate')` (works once CRATES_BY_HAND is true, result carry {kind:'crate'}); the existing takeKind/takeOffBed code already stores `carry:r.carry`. Parcel row 'Take the parcel' the same way. Load rows: `loadCarry(GameState.progress.carry,bed,model)` now accepts crate/box/parcel carries.
7. Gig end: the code that clears the active gig directly (game.js l.920, the expiry/timeout path) must call `removeParcelPieces(state,gigId)` (cargo-items.js) or go through failGig/abandonContract (already updated). Deliver/fail/abandon through gigs.js already clear the piece.
8. syncParcel: read the piece, not the flag: where syncParcel decides 'held / stowed / dropped', use `parcelLocation(progress)` (cargo-items.js): 'hands' -> carton in the arms, 'bed' -> bed (cargo-view draws it later, C-D), 'ground' -> on the ground at gigs.active.drop, 'waiting' -> at the pickup, 'held' -> old flag (treat as hands; the next load migrates it). `parcelCarried(p)` is true for hands/bed/held.
9. Prompts and text: remove the "Crates stay on the bed" prompts (story/need crate texts, starter egg run) and CRATE_STAYS use; crates are taken by hand now (slowly). The egg run's load/hand-over code (addNeedCrates/removeNeedCrates, hasCrates) is unchanged and still works.
10. Crate bed pictures for parcel/box on a bed come with C-D (cargo-view.js must draw kinds 'parcel' and 'box'; today they draw nothing).

## Honest confidence
- carry.js normalise/effects table, cargo.js load/unload/normalise/slots, load-drag: high (unit tests, old shapes untouched, old tests pass, hasOwnProperty guards).
- jobs.js migration behind the switch: high for off (identical to before) and for synthetic on-saves (twice-stable); medium on real saves (an old held parcel lands in the hands, never in a bed, because old saves do not record the ridden vehicle).
- gigs.js / gig-bridge.js piece removal: high for the covered paths (fail, late fail, abandon, complete, drop, pick up, pickup); not covered: game.js direct clears (edit 7).
- CRATES_BY_HAND gate: a deliberate safety choice, easy to flip; low risk.
- The wiring list: medium (written from reading game.js lines, not from editing it).
