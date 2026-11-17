michadr.

# ATV-STOW report (Sonnet 5.5)

Nothing was seen in a browser. All tests ran in a scratch copy; the real repo had no `npm run release` run (0.35.11 untouched). No git.

## Files (lines after the change)
- NEW dist/load-drag.js (13): DRAG_PER_KG .004 (4% per 10 kg), MIN_FACTOR .6, HEAVY_BELOW .85, MASS_KG {log 40, plank 6, crate 12, parcelSmall 3, parcelMedium 6}, loadFactor(kg), isHeavy, cargoMassKg(cargo), parcelMassKg(active).
- NEW tests/load-drag.mjs (60).
- dist/gig-parcel.js (36): STOW_MODELS ['atv'], canStow, stowed, mountError(p,model), STOW_TOAST, UNSTOW_TOAST.
- dist/cargo.js (136): BEDS.atv, bed option `across` (pieces lie crosswise, cells swapped) and `maxPieces`, `fits` honours maxPieces, capacity/normalizeCargo honour it, new takesCrateGigs().
- dist/gigs.js (292): hasCrateBed uses takesCrateGigs (the one-crate ATV rack must not count as a farm crate-run truck).
- dist/driving.js (199): enter(id,seat,stowKg), leave clears f.stowKg, massDrag() applied to top and accel (one reused object per vehicle, no per-frame allocation).
- dist/game.js (1720): enterVehicle uses mountError, passes stowKg, toasts (stowed and heavy, once per session); exitVehicle toast; syncParcel new 'stowed' mode (same pooled carton mesh, parented to the ATV mesh on the rack, back to the player on exit); putDownParcel refused while driving; crateTruckNear uses takesCrateGigs.
- tests/cargo.mjs (64): bed list now includes atv; the full-load loop uses [log],[4 planks] for atv; crate-bed list includes atv.
- PROJECT-INDEX.md regenerated in the scratch copy and copied back (adds load-drag.js and its test).

## Decisions
1. Stowed parcel = same saved state as a held one (gig active, drop null). Nothing new is saved, so save/load, death/respawn, and delivery cannot lose or duplicate it; on foot after load it is simply in the hands. Only the picture (rack) and the hands rule differ while seated. Delivery happens on foot after E gets you off, unchanged. Other vehicles still refuse a held parcel (PARCEL_HANDS).
2. ATV bed: x -.55..+.55, z -1..-.58, y .76 (anchor_cargo_rear y .76; taillights are at y .62 so below the deck; seat at z -.3), space 5, crates:true, maxPieces 1. One log OR one 4-plank stack OR one crate; second log, loose plank beside a stack, second crate all refused; crates never mix with timber (existing rule). Logs and planks lie across (yaw 90 degrees; log 1.15 m on a 1.1 m rack).
3. Mass drag combines with the existing vehicle.js withLoad (how full the bed is) by taking the STRONGER of the two (min of top, min of accel), so nothing slows twice. Side effect: a full flatbed (960 kg) is now at the 0.6 cap on top speed (was 0.8) and heavy pickups slow more than before. Closed vans not touched.
4. Heavy toast threshold .85: a log (40 kg, factor .84) triggers it; a plank stack (.904), crate (.952), parcels do not. Text 'Heavy load: the ATV is slower.' (shows only on mounting, since cargo cannot change while driving; appended to the Driving toast).
5. ATV does not count as a crate-gig truck (takesCrateGigs): farm runs need several crates.

## Tests (real output, scratch copy)
- node tests/load-drag.mjs: `PASS load-drag: factor, masses, ATV rack (1 log, 1 plank stack, 1 crate), stowed parcel`
- node tests/cargo.mjs: PASS (after the three expected updates above)
- node tests/gig-parcel.mjs: `gig-parcel ok`
- node tests/brief.mjs: `brief tests passed: 203 modules listed, brief 2985 and index 30084 estimated tokens (budgets 3000 and 32500)`
- npm test (after `npm run release -- --force` and `npm run index` in scratch): `ALL 242 PASSED` / `All 242 test files passed.`

## Could NOT verify
- Anything visual: parcel position/orientation on the rack, log/planks/crate seat on the rack, clipping with the seat box, fender, taillights. The rack coordinates come from the model's anchors in scripts/atv-finish.py (cargo_rear (0,.76,-.82)), not from a look at the mesh. The earlier "rack overlaps fender/rear lights" is a model/night-render note; I kept the bed behind the seat and above the taillights but did not change the GLB or its anchors.
- Driving feel of the slowdown; the toasts; boarding with a parcel at runtime (game.js has no unit test for enterVehicle).
- The parcel mesh being parented to the vehicle mesh and re-parented on exit (logic read-checked only).

## Eye-check points
1. Take a gig, walk to the ATV with the box in hands, press E: the toast says the parcel is stowed, the carton sits on the rear rack (not floating, not inside the seat), and it follows the ATV when driving and turning. Get off: carton in your arms again, toast 'You take the parcel back.'
2. Load a log onto the parked ATV (reach points are behind and beside the rack): it lies across the rack without poking far outside the wheels; a second log, a second crate and planks beside a plank stack are refused. Drive: noticeably slower ('Heavy load' toast once).
3. Drive the ATV to the gig destination, get off and deliver; also save/reload while stowed (you reload on foot holding the box) and die/respawn.

## Confidence
- load-drag.js, cargo bed rules, parcel state rules, tests: high.
- driving.js drag application: medium-high (one multiplication, covered only indirectly; ran in driving-game tests).
- game.js stowed rendering and toasts: medium (untested in a browser).
- Rack coordinates and the anchor/fender overlap: low until seen.
