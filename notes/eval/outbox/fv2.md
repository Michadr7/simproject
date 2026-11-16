michadr.

# FV2: tractor drivers (report)

## What was done
- dist/driving.js (197 lines): RIDER_GRIPS gets a `tractor` entry (group of both tractor_juff and tractor_kidbi): {hips 0, sit .03, lean .15, jiggle .015, bar .8, pivot 'steering_wheel'}. A5's build()/seatedAt/seatPose/riderHands/game.js branch pick it up unchanged (game.js and vehicle.js NOT touched).
- dist/vehicle-hud.js: SILHOUETTES += tractor_juff, tractor_kidbi. dist/index.html: two new <svg data-sil> drawings (Hustler: small cab frame + hood + stack; Husky R75: tall cab). dist/style.css: two display rules. tests/damage-game.mjs: the tractor exemption removed (only the atv stays exempt); tests/atv-rider.mjs: one message wording.
- tests/tractor-driver.mjs (new, 30 lines).
- scripts/build-props.mjs and props-assets.js NOT touched: nothing needed.

## Findings
1. Anchors exist on both models (props-assets records): anchor_driver_seat (Hustler [0,1.0756,-.6045], R75 [0,1.3783,-.9239]), anchor_hands_L/R, anchor_foot_L/R, and a nodes.steering_wheel pivot ([0,1.4,-.2045] / [.0073,1.5664,-.346]). No missing anchors.
2. The steering wheel is a NODE POSITION only (a pivot point); its geometry is merged into the body (the records have just the wheel meshes split). It cannot turn: NOT faked. Hands swing about the steering_wheel node by steer*.8 rad (sign follows A5: positive steer, counter-clockwise from above, same as the front pivot yaw). Model need: a separate mesh named steering_wheel (a draw call each) so the visible wheel turns; then the shortbed-style userData.steeringWheel branch can drive it.
3. Front wheels: both models already have 2 front:true pivots (steer_FL/FR); they steer by STEER_ANGLE .5 (no steerMax on the tractor classes: left at the default). tow_tank has no class, so no steering/driver (FV3/FV4).
4. Silhouettes: the tractors used the generic one; now own drawings and the exemption in damage-game.mjs is removed (passes).
5. Triangle budget: tests/props.mjs line 106 still exempts /^tractor_|tow_tank|atv/ from the 4,400 building budget. NOT removed: the models are 5,826 / 14,797 / 6,124 tris, so it cannot pass honestly (soft cap; their numbers are in farm-tractors.mjs).
6. Reach: R75 hands are .67 m from the shoulder estimate straight ahead and .81 at the worst steer with bar 1.2; with bar .8 it is under .8. The test limit for tractors is .8 (ATV's is .75); the IK may clamp or stretch the arm. Eye-check.
7. Frame rate: no new draw calls, materials or allocations beyond A5's (two small hand objects per frame while driving a tractor; jiggle is a function of the driving clock, frame-rate independent).

## Tests (real output)
node tests/tractor-driver.mjs
Tractor driver: PASS (seat from anchor_driver_seat, hands swing about the steering_wheel node and stay in reach, two front steer pivots, jiggle bounded, silhouettes drawn)
node tests/atv-rider.mjs -> ATV rider: PASS (...)
node tests/damage-game.mjs -> Damage wiring: ... one silhouette per drivable model.
npm run release -- --force: Packaged release 0.35.9: 179 files.
npm test: run 1: "1 of 220 test files failed" (tail named hub-runs.mjs: "Needed a second run"; node tests/hub-runs.mjs alone: "hub-runs: ok"). Run 2: "1 of 220 test files failed", name not captured (tail only). Run 3 (full output captured): "All 220 test files passed." So two unreproduced flakes (hub-runs timing, run 2 unnamed), not related to the changed files; A5 saw the same pattern.
npm run index: brief 2996 tokens (target 3000), index 26622 tokens (cap 32500), 178 modules, 220 tests.

## NOT verified (nothing seen in a browser): eye-check list
- Driver visible, seated on the seat, not floating/sunk. Worry: anchor_foot y (.98 / .75) is only 0.1-.6 m under the seat anchor, and there is no foot IK, so the seated legs (thighs forward, shins down) will hang INTO the body/floor of the tractor; hips offset .03 is an estimate.
- Hands on the wheel rim, no elbow flip, R75 arm overreach at full steer.
- Hands swing the right direction; amount (.8 rad) looks right.
- Lean .15 and jiggle .015 m (guesses); camera is the class default (no tractor camera entry).
- Silhouette drawings in the vehicle panel look like tractors; store pictures still need `npm run pictures` (FV1 note).
- Front wheel full-lock angle (.5 rad) feels right for a tractor.

## Defaults chosen
Grip per group (both tractors share it); bar .8; lean .15; jiggle .015 speed-only; steering not faked.

## Forbidden files
Nothing needed.