michadr.

# G2b report: real gig parcel box + X to drop, E to pick up

Files (line counts): dist/carry.js 88; dist/game.js 1620; dist/gig-parcel.js 21; dist/gigs.js 139; dist/gig-bridge.js 56; tests/gig-parcel.mjs 35. New: dist/gig-parcel.js (pure), tests/gig-parcel.mjs. game.js: 8 single-anchor .Replace edits, each checked to match exactly once, node --check clean, no BOM. Never ran git. handoff.md untouched.

## Behaviour
- The carried box is now createProp('prop.box-small') (0.40 x 0.30 x 0.30 m), one pooled mesh named gig-parcel (replaces the brown BoxGeometry and its shared material). Held: child of player at (0,1.0,.36), in front of the chest, base at y 0 of the model. The old one sat at z -.25 (behind). Dropped: re-parented to the scene at the saved spot on the ground height.
- Which box: box-small for every live gig type (grocery, parcel, round, rush); the same box for each stop of a round. box-medium NOT used (leftover: use it when active.large).
- X: putDownCarried now starts with: no p.carry and a gig box in hand then putDownParcel(). Same spot search as putDownCarried (in front 0.9 m, blocked then underfoot, then rings 1.1/1.8/2.6, else toast), same beginBend bend animation, same blocked rules: inside or shop gives the toast 'Put the parcel down outside.'. Logs/planks still use the old path first (p.carry set).
- E near the box (2.6 m, reach 1.8): prompt 'Pick up the parcel'. Hands full (p.carry) gives the toast from pickParcel.
- Delivery needs the box in hand: tickGig does not tick stops while active.drop is set; completeGig refuses with 'Pick up the parcel first.'; report-back prompt becomes 'Pick up the parcel first' (toast on E); objective text says 'Your parcel is on the ground: press E beside it to pick it up.'
- Save: gigs.active.drop {x,z} (finite numbers only, clamped +-2000, anything else becomes null; old save without it holds the box). Gig complete/fail/expire/abandon replaces active so the drop goes with it. No schema change.
- One thing in hands: carry.js takePlanks, shoulderLog, pickUpPlanks refuse while the box is in hand ('You are holding the parcel. Put it down first (X).'); the box cannot be picked up with p.carry.
- Frame cost: syncParcel runs once per frame in updateObjective: a few comparisons, sets position/parent only when mode or drop spot changes, no allocation. Draw calls: the same one box (it also casts a shadow now, castShadow comes from createProp: +1 shadow-pass draw while visible). New material: the prop's own vertex-colour MeshStandardMaterial replaces the shared brown one (net +1 material).

## Tests (real output)
node tests/gig-parcel.mjs -> gig-parcel ok
node tests/gigs.mjs -> gigs ok
node tests/gigs-game.mjs -> gigs-game ok
node tests/carry.mjs -> Carry: a log on the shoulder (not the bag), planks in the hands, one thing at a time; ... (passed)
gig-parcel.mjs covers: drop sets position and keeps the gig active, view says dropped, double drop and junk spot refused, stops tick nothing while dropped, completeGig refused (Pick up the parcel first), pickup clears, finish after pickup pays, dropped at return stage refused until picked up, save round trip, old save without drop, 7 junk drops become null, clamp, failGig clears, planks/log pickup refused with box in hand, hands free when box on ground, box pickup refused with planks in hands.
npm run release -- --force: Packaged release 0.35.9: 180 files.
npm test run 1 (before npm run index): FAILED FILES: brief.mjs / 1 of 223 test files failed (index stale: new file not listed). No 'PASSED ON RETRY' line.
npm run index: brief 2996 tokens (target 3000), index 26828 tokens (cap 32500, not raised); 179 modules.
npm test run 2: ALL 223 PASSED / All 223 test files passed. brief tests passed: 179 modules listed, brief 2996 and index 26828 estimated tokens (budgets 3000 and 32500). (No FAILED FILES, no PASSED ON RETRY lines.)

## NOT verified
Nothing seen in a browser. game.js code (syncParcel, putDownParcel, pickUpParcel, the prompts) has no script test; only the pure parts and the bridge are tested. Startup tests load the release fine.

## Eye-check list (GPU browser)
1. Accept a gig: the real cardboard box shows in front of the chest (0,1.0,.36); size right, not clipping the body or the planks pose; arms are NOT posed around it (no hand reach), so hands may not touch it.
2. X outdoors: bend animation, box appears on the ground in front at the bottom of the bend; spot not inside walls or fences; in a tight corner it should fall back underfoot or the ring.
3. Prompt 'Pick up the parcel' within about 2 m; E re-lifts; box returns to the arms.
4. Walk onto the delivery spot with the box on the ground: nothing ticks; objective says to pick it up; at the door, prompt reads 'Pick up the parcel first'.
5. Round of three: same box for all stops; drop and pick between stops.
6. Go into the cafe/market with the box held (still in hand) and X inside (toast); drop outside, enter a shop: ground box hidden.
7. Save and reload with the box on the ground: it is still there.
8. Logs/planks: with the box held, taking a belt stack or a log is refused with the toast.

## Defaults chosen
box-small for all gig types; held pose in front of chest; drop reach 0.9 m; pickup range 2.6 m; dropped box does not block walking (plankDrops do); box has no yaw on the ground; box keeps its place if the gig is abandoned until the gig ends (then it vanishes).

## Leftovers
- dist/forest.js l.65 (takeFromRack) and l.97 (takeLogFromPile) test 'if(progress.carry)' only: with the box in hand you can still take a rack pallet or a pile log (forest.js is not on my edit list). Exact edit: import parcelHeld,PARCEL_HANDS from './gig-parcel.js' and change both guards to 'if(progress.carry||parcelHeld(progress))return {error:progress.carry?"Your hands are full.":PARCEL_HANDS};'. Also getOnFork/enterVehicle guard on p.carry only.
- box-medium for active.large gigs; ground box could be a collider and have a yaw; no hand pose around the box.
- Parcel box also shows for the old Noah delivery (phase carrying), same mesh.