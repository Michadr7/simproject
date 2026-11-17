# Fable review 1 (game.js first-frame, gig pickup, ATV stow, beacon). Filed 2026-11-16
Status: FIXED by FIX-R1 (notes/eval/outbox/fix-r1.md), except the leftovers below.

Findings (reviewer's order) and FIX-R1 result:
1. Gig deadline ran from accept (gigs.js:196). FIXED: pickUpGig re-bases dueAt; tickGig fails on time only after pickup.
2. Load drag hit every vehicle (driving.js:58). FIXED: usesLoadDrag(model), ATV only.
3. Heavy-load toast said "the ATV" on any vehicle. FIXED (gated).
4. Completion flash guessed from marker hiding within 8 m. FIXED: explicit flashBeacon at the payouts; guess deleted.
5. Gig marker never pulsed during a gig. FIXED: one beaconTime clock.
6. Stowed parcel overlaps rack cargo. FIXED by refusing the mount (RACK_BUSY). NOT covered: loading cargo on the rack while holding a parcel from the ground.
7. Pickup with an axe equipped. FIXED: stowTool() first.
Minor: indoor markers dimmed (FIXED); small per-frame allocations (NOT done); toast wording (FIXED); stowed-parcel drag stays until you get off (NOT done).
Contacts: code path correct; cause was an older packaged release (shared index.html, versioned JS). Re-check on 0.35.12 with a hard refresh. Test added in messages-game.mjs.
Could not check: farm/gas pickup reachable (now tested in safe-spot.mjs); old save with origin and no pickup time (now tested in gigs.mjs); anything visual.
