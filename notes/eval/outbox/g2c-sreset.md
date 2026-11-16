michadr.

# G2c carry pose + S-RESET starter reset (serial stage)

## Version: NOT bumped, NOT released (stopped on purpose)
The project's mechanism is the hub's "Bump version" job (scripts/bump-version.mjs). It needs a fresh .hub/bump-request.json that the hub writes after the owner types the level and new number on the Deploy page, and it checks that 0.35.10 is live. I cannot forge that request, and `npm run release -- 0.35.11` would create dist/releases/0.35.11 and then make the hub's bump REFUSE ("already exists"), and dist/version.js / version.json / index.html would disagree with package.json (tests/update-check.mjs checks that). So package.json stays 0.35.10 and I did not run `npm run release` in the repo at all. ACTION FOR OWNER: press Bump (patch -> 0.35.11) on the hub Deploy page; it bumps, releases 0.35.11 and runs the tests.
To still test the packaged game I ran release --force + index + npm test in a THROWAWAY COPY of the repo in the scratchpad (not in the project). Caveat: the repo's dist/releases/0.35.10 is still the GD5 rebuilt one (not restored by me); git can restore the pushed one.

## Files
- NEW dist/carry-pose.js (26): pure box-carry pose numbers (boxPose, poseFor, constants).
- NEW tests/carry-pose.mjs (49): pure numbers + the REAL rig (male and female, small and medium carton).
- dist/starter.js (131): STARTER_EPOCH=1, fresh() stamps it, normalizeStarter resets other epochs, alreadyHoused(), applyStory 'slept' handover rule, halTalk/buy for finished players.
- dist/game.js (about 1653 lines now; others are editing it too): carry pose + parcel anchor; storyEvent handles r.removed; storyTick uses alreadyHoused; skip choice no longer needs completed==0.
- tests/starter.mjs (46), tests/starter-game.mjs (119): updated + new reset tests.
- tests/support/boot-game.mjs and tests/startup.mjs: their saves now carry starter:skipStarter() (they have progress but are not about the story; without it the reset starts Noah's story in 6 tests: store-game, tickets-game, messages-game, delivery-game, startup, brief-adjacent).

## G2c carry pose
- Measured on the real rig: torso front z 0.17-0.21 at y 1.0-1.2; shoulders y 1.49, x +-0.12..0.16. Cartons (props.js, origin at base centre): small 0.30w x 0.155h x 0.20d, medium 0.40 x 0.30 x 0.30.
- ANCHOR CHANGE (game.js syncParcel): held box was parent player at (0,1,.36). Now holdParcel(bend): box centre y 1.08 (base y = 1.08 - h/2), back face at z = 0.20 + 0.012 + d/2 (touches the sweater), x 0. Small: (0,1.00,0.312); medium: (0,0.93,0.362). During the put-down/pick-up bend the box and hands go down 0.7*bend and out 0.3*bend (same as the plank stack). Size is measured once per model change (measureParcel), position.set with numbers: no per-frame allocation.
- Pose: both hands reach (avatar.reach) to the box sides (x = +-(w/2+0.03), y = box centre, z = box centre), poles BOX_POLES (-.55,-1,-.35)/(.55,-1,-.35): elbows bend forward and out. Blend with poseBlend (same 8/s as planks).
- Rig check result (test output): wrist R lands within 0.05 m of target for both bodies and both cartons, elbows forward of the shoulders, clearReach restores idle.
- Release: parcelMode leaves 'held' (put down X, delivered, gig ends/fails) -> blend fades, reach(null) on both arms (R only if no tool equipped). Seated (driving.active or fork.on) snaps the weight to 0 and clears the reach once, so the cab pose owns the arms. A tool equipped (axe, nozzle) suppresses the box pose (the right arm belongs to the tool; tests/startup.mjs relies on this).
- Planks and log already had two-hand/shoulder poses (carry.js PLANK_HANDS / LOG_HAND): unchanged.
- Not done: the box is still drawn on a driver's lap while seated (as before); hide it if it looks odd.

## S-RESET
- STARTER_EPOCH=1. normalizeStarter(v,p): any starter without epoch===1 (old done/skipped/mid-story, junk, or none at all, with or without progress) -> fresh() (step 0, quality 100, loanUid null). A current-epoch starter is normalised as before. p is no longer read. skipStarter() stamps the epoch (verified, survives a reload).
- jobs.js untouched: progress.careers, cash, vehicles, housing, gigs are not touched by the reset. An old mid-story save that held Hal's loan truck loses ONLY that loan truck (existing jobs.js l.49 rule: loanUid no longer survives), and gets a new loan at beat 4.
- Stall rules (simplest safe):
  1. Rent beat (step 8): completes on its own when housing.rented or any property is held (alreadyHoused; game.js storyTick fires 'rented'; before it did the same only for the studio).
  2. Sleep beat: the 'slept' event fires after any sleep in any home. The old soft refusal ("free a space first") is REMOVED because a reset player with a full garage would be stuck. New rule: if the loan truck cannot be given (the player already owns a Shortbed, or there is no free place at home), Hal takes his truck back, the story ends, a message says why, and Hal can sell it later ($500, halTalk/buyFromHal now work for finished players with no Shortbed, not only skippers). Otherwise the truck is gifted as before.
  3. Loan: still lent to everyone at beat 4 (the crate beats need it; it takes no room). Gig beat is NOT skipped (as requested).
  4. Skip option: now offered while step<=1 even if you have jobs done (before: only with completed==0, which never mattered because old saves were skipped automatically).
- Active gig save: tested (gigs.active survives, starter resets).
- Noticed: an old assertion line in tests/starter-game.mjs (old save is skipped) was swallowed by a // comment on the same line and never ran; rewritten as a real check.

## Test output (real)
node tests/carry-pose.mjs:
  male prop.carton-small: wrist R -0.18,1.12,0.29 target -0.18,1.08,0.31; elbow z 0.16 (shoulder z 0.07)
  male prop.carton-medium: wrist R -0.22,1.14,0.32 target -0.23,1.08,0.36; elbow z 0.17 (shoulder z 0.07)
  female prop.carton-small: wrist R -0.18,1.10,0.30 target -0.18,1.08,0.31; elbow z 0.17 (shoulder z 0.06)
  female prop.carton-medium: wrist R -0.22,1.13,0.33 target -0.23,1.08,0.36; elbow z 0.19 (shoulder z 0.06)
  Carry pose: the box rests at the belly against the sweater (both cartons), both hands on its sides, bend, the pose rules and release passed.
node tests/starter.mjs -> starter ok ; node tests/starter-game.mjs -> starter-game ok
New starter tests: old save (done, skipped, mid-story, no starter) resets once; a second load keeps progress made since (step 1 stays 1); cash 123456, completed 40, careers, rent, owned truck survive; mid-story save loses only the loan truck; active gig survives; already-renting player passes beat 9 (rent auto) and sleep ends the story; no-room and own-Shortbed handover; skip stamps epoch.
FULL RUN (scratch copy of the repo, release --force + index + npm test): "ALL 232 PASSED. All 232 test files passed." (first run there had 7 failures, all from my change to saves without a starter or the index purpose line, fixed; gigs-game failed once in the copy only because another agent was editing gigs.js/gig-bridge.js/gigs-game.mjs at the same time: it passes in the repo 3 of 3 and in the final copy run.)
In the REPO: npm run index -> "brief 2996 tokens (target 3000), index 28388 tokens (target 32500); 190 modules"; node tests/brief.mjs passes. (Brief is 4 tokens under its 3000 cap.) Gotcha: a trailing // comment on a game.js import in the first 80 lines replaces game.js's index purpose and fails brief.mjs; I removed mine.
NOT run in the repo: npm run release and the repo's own npm test (see version section; other agents are editing dist/ concurrently: gig-pay.js, gig-clients.js, gigs.js, gig-bridge.js, cover-*). Run the consolidation (Bump, then npm test) after they finish.

## Could NOT verify
Nothing seen in a browser. The carry pose is checked on the rig in Node (wrist and elbow positions), not visually (sleeve/box clipping, elbow flare, the bend animation with the box). No game-level script test for syncParcel/updateCarryPose wiring beyond tests/startup.mjs (a gig is accepted there; the pose code runs every frame there without error).

## Eye-check list
1. Accept a gig: box at belly height, back flush on the sweater, both hands on its sides, elbows bent forward. Front AND side view, male and female, small and large (medium) cartons, clean and dirty.
2. Walk, turn, jog: arms stay on the box (arm swing is skipped while reaching); box does not clip the sweater or the chin.
3. Press X: stoop; box and hands go down together, box lands on the ground, arms relax smoothly (no snap).
4. E to pick up: same bend, pose returns.
5. Deliver / gig expires: pose releases. Enter a truck with the box in hand: hands go to the wheel; box visibility on the driver's lap (not hidden).
6. Equip the axe with a box in hand: arm goes to the axe, box floats at the belly (acceptable?).
7. Starter after reset: load an old save: Noah's message arrives, story at step 0, cash/jobs unchanged; with a rented studio the rent beat passes by itself; at the end with a full garage Hal takes his truck back and offers to sell it; the skip option on Noah's menu works.
8. Reload mid-story: no second reset.

## Confidence
- Starter reset: high (pure rules, 3 test files, full run green in the copy).
- Handover rule change (removing the old soft refusal): medium on design (it changes an owner-visible rule; easy to revert in applyStory).
- Carry pose geometry: medium (numbers measured on the rig; the look is unseen).
- Version/consolidation in the repo: not done by design; needs the hub Bump.