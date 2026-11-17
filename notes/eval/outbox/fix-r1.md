michadr.

# FIX-R1 report

All edits made with the Edit tool in the real repo; `npm run release` was NOT run there. Tests ran in a scratch copy (robocopy, node_modules and old releases excluded).

## Files changed (edits only, no new files, line counts unchanged except where noted)
- dist/gigs.js: pickUpGig re-bases dueAt from the pickup (same allowance); tickGig only fails a hard gig on time after pickup (line 198, 211).
- dist/cargo.js: new `usesLoadDrag(model)` (true only for beds with maxPieces = the ATV), +1 line.
- dist/driving.js: massDrag returns early unless usesLoadDrag; import added.
- dist/gig-parcel.js: `RACK_BUSY` + `mountError(p,model,cargo)` refuses mounting the ATV with the parcel held and cargo on the rack ('Unload the rack first: the parcel needs the space.'), +1 line.
- dist/game.js: import usesLoadDrag; heavy toast gated; mountError gets the cargo; `watchBeacon`/`beaconWatch` deleted, `flashBeacon(kind,position)` + `flashDone()` added and called only after the two gig-complete payouts, the market delivery (finishJob deliver) and the egg-crate delivery; one `beaconTime` clock inside updateBeacons (both beacons pulse); daylightNow returns 0 indoors (full brightness); pickUpGigAtOrigin and pickUpParcel call stowTool() first; both 'Gig accepted' toasts say 'Go and pick up the parcel first' when activeJob.pickup; objective kicker 'GETTING STARTED' during a starter step.
- dist/starter.js: 'food' beat text rewritten: "Noah needs a delivery taken to Hal Brennan, and it is a long walk. Buy a food and a water at the Corner Market, and eat one before you set off." (title unchanged).
- tests: gigs.mjs (rush test now picks up first; new deadline-from-pickup test; old save without pickedAt), load-drag.mjs, beacon-style.mjs, messages-game.mjs (phone icons + Contacts), safe-spot.mjs (gig origins reachable), all appended to existing files (no index growth).

## Test results (scratch copy)
- `npm run index`: brief 2985 (budget 3000), index 30086 (budget 32500). tests/brief.mjs passes.
- Targeted, real output: `gigs ok`; `PASS load-drag: ... drag only on the ATV`; `PASS beacon-style ...`; safe-spot passed; messages-game `PASS ...`; gig-parcel ok; gigs-game ok; starter ok; starter-game ok.
- Full `npm test`: **2 of 242 test files failed: mp-clock.mjs, multiplayer.mjs**. Cause is the scratch copy only: `ERR_MODULE_NOT_FOUND: Cannot find package 'ws'` because I excluded node_modules in the copy. Not related to these changes; every other file prints PASS (240).

## Findings per item
1. Done. Hard/rush gig cannot fail before pickup; after pickup the allowance restarts. Needs gigs (dueAt 0) unaffected. completeGig already requires pickup, so no change there. Only game consumer of dueAt is gig-bridge.js:19 (passes it through; nothing displays a countdown).
2+3. Done. ATV with one log 0.84; flatbed with 3 logs 0.975 of top (old withLoad only); full flatbed 0.8. Test also source-checks the gates in driving.js and game.js (massDrag lives in a closure and cannot be imported).
4. Done (see above). Failed or abandoned gigs, shop doors, tracker focus no longer flash.
5. Done: shared beaconTime advanced once per updateBeacons call.
6. Done by refusing (toast RACK_BUSY). Parcel stays in the hands. Not covered: loading cargo on the rack while holding the parcel from the ground (only the mount path was in scope).
7. Done: stowTool() before pickup (only when actually at the pickup point), and for picking a dropped parcel when hands are empty.
8. Done: indoors daylight 0 (night = undimmed). Toast reworded in both places (takeGig and the phone onAccept).
9. Wording fixed. Kicker now 'GETTING STARTED' while a starter step is active. I did NOT hide the market 'Orders' row: 'Order #2 . Cedar Heights Ho...' is a real tracker order from saved state (tracker.js), not a starter item, and hiding it is not a small change. Report only. Open question for the owner: should orders be hidden until the starter beats are done.
10. Phone: all 10 `phoneApp-*` ids in index.html have an onclick, and clicking `phoneApp-people` unhides `phoneScreen-people` with title 'Contacts' (added to messages-game.mjs, uses the boot stub). Gig origins: MARKET, FARM, GAS each have a clear walkable standing spot within 2 m (test passes in safe-spot.mjs). Old save: an active gig with an origin and no pickedAt normalizes as not picked up ('waiting for pickup'), does not throw, and tickGig with requirePickup keeps it active (asserted in gigs.mjs).

## Could NOT verify
Nothing was seen in a browser: flash timing, pulse, indoor brightness, toasts, kicker text, stowTool animation and the rack refusal are code-traced and unit-tested only. mp-clock and multiplayer not run (ws missing in scratch).

## 3 eye-check points
1. Finish a gig and a market delivery: the beacon flash fires once; abandon a gig or walk into a shop door near a marker: no flash. Gig marker pulses.
2. Hold the parcel with a log on the ATV rack, press E on the ATV: toast 'Unload the rack first...', still holding the parcel. Drive a flatbed with logs: no 'Heavy load: the ATV' toast, normal speed.
3. Start the game: objective card reads GETTING STARTED / Eat something first with the new text. Accept a gig that has a pickup and equip the axe, then press E at the pickup: axe goes away, no axe+box pose.

## Confidence
1 high; 2+3 high (rule), medium (toast gate untested live); 4 medium-high; 5 high; 6 medium-high; 7 medium (stowTool animation unseen); 8 high; 9 wording high, panel structure left; 10 high.
