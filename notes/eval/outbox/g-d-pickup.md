michadr.

# G-D pickup step: report

Result: scratch copy, `npm run release -- --force`, `npm run index` (index 30084 tokens, under cap), then `npm test`: "ALL 242 PASSED". tests/gig-parcel.mjs and tests/gigs.mjs print `gig-parcel ok` and `gigs ok`. load-drag, cargo, cargo-game, gigs-game, gig-pay and gig-clients pass. Real repo release folder 0.35.11 untouched; no git run.

## Files changed (all edited with Edit; no new files)
- dist/gig-parcel.js (+PARCEL_PICKUP_FIRST, parcelPickedUp, parcelWaiting; parcelHeld now needs picked up; dropParcel refuses before pickup)
- dist/gigs.js (completeGig refuses an unpicked box for non-need gigs; tickGig requirePickup does not block need gigs)
- dist/gig-bridge.js (activeView: pickup/pickupName fields, marker location = origin until picked, description "Pick up the parcel at <place>. Then go to ..."; tickContract passes requirePickup:true; new gigPickupHere and pickUpGigBox)
- dist/game.js (imports; pickUpGigAtOrigin; world prompt 'gig-pickup' "Pick up the parcel" within 2 m of the origin; syncParcel shows the carton standing at the origin while waiting, in hands only after pickup, rack only after pickup; objective text)
- dist/phone.js (Active line says "Pick up the parcel at X." while waiting)
- tests/gig-parcel.mjs (new G-D block; `take` helper now accepts and picks up), tests/gigs.mjs (3 stale spots: accept-then-complete without pickup now picks up first; mkActive gets pickedAt; new requirePickup/completeGig asserts)

## Decisions
- Pickup point = existing gig.origin (grocery and parcel both use the board origins, default Corner Market x19 z-6.3, Willow Farmhouse, gas station). No new data.
- need gigs (needId, egg run) are unaffected: no pickup prompt, ticking not blocked.
- Beacon colour left as it was ('pickup' amber in travel, 'dropoff' in return stage); the marker now leads to the origin first. Stops are still amber until the final return, as before.
- Stale test expectations fixed (old behaviour was "complete without picking up"): gigs.mjs lines near 42, 86, 137.

## Not verified
Nothing seen in a browser. The new game.js lines (prompt, syncParcel, bend) are only syntax-loaded by the startup tests, not exercised.

## Eye-check points
1. Accept a parcel gig: no carton in hands, amber beacon at the pickup, carton standing at the pickup; E there shows "Pick up the parcel", bends, carton in hands, then equip/enter-car rules apply.
2. Before pickup you can get on a car/equip a tool; after pickup a car is refused and the ATV rack stows it.
3. Walking to a stop before pickup ticks nothing; phone Active line and the objective panel say "Pick up the parcel at ...".

## Confidence
Pure rules, bridge, tests: high. game.js wiring (prompt, carton at origin, syncParcel): medium (untested in browser; the carton at the origin may float or clip on slopes/props).