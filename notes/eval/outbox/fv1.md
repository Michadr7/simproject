michadr.

# FV1: tractor import (Hustler Compact, Husky R75 Tractor, Husky Trailer model)

## Result
Done and tests pass: `npm test` printed "All 214 test files passed." The new tests/farm-tractors.mjs prints "Farm tractors: PASS (...)". Nothing was seen in a browser.

## Size rule (startup module vs lazy)
The three lite models add about 0.88 MB to a startup module, under the 1.5 MB rule, so they stay in dist/props-assets.js (not lazy). The startup module is now 5.54 MiB, just over LZ1's 5.5 MB target. Sizes before and after for every dist asset file I changed:
- dist/props-assets.js: 4,890,864 bytes before, 5,810,790 after (+919,926; 86 props to 89).
- dist/props-assets-farm.js: 9,088,729 before and after (the build rewrote it with identical content).
- No other asset module changed.

## What was built
- scripts/build-props.mjs (309 lines): three entries (`tractor_juff`, `tractor_kidbi`, `tow_tank`, files `Farm/conformed/*_lite.glb`). It now reads glTF COLOR_0 (per-vertex colour multiplied into the material colour). Without this the tyres and rims came out white. This is a shared converter change; the other models have no COLOR_0, so they are unaffected.
- scripts/split-wheels.mjs (44 lines): new `splitWheelsByParts`. The geometric `splitWheels:true` failed on the R75 ("found 3" wheels), so wheels are taken from the file's named `wheel_FL/FR/RL/RR` nodes (`nodes:true` + `splitWheels:'nodes'`). The steering wheel stays in the body. The old function is unchanged.
- Records: model origin = hull centre (the footprint is centred, so axleZ = minus the file's centre z). Anchors and node pivots are kept as `record.anchors` / `record.nodes`.
  - Hustler: 5,826 tris, 1.87 x 3.15 x 2.39 m, 4 wheels (r 0.644 / 0.389).
  - R75: 14,797 tris (the prompt said 14,044; the file measures 14,797), 1.98 x 3.08 x 2.23 m, wheels r 0.614 / 0.406.
  - Trailer: 6,124 tris, 2.78 x 3.78 x 2.80 m, 4 wheels r 0.406.
- dist/props.js: `createProp` now exposes `mesh.userData.anchors` and `.nodes` (3 lines, only when the record has them).
- dist/vehicle.js: CLASSES `tractor_juff` / `tractor_kidbi` with the design numbers. Names are as the user set them. Hull hx/hz match the footprint. New optional fields: `seats:1`, `axleZ`, `hitchRear`, and a custom `seat` (makeClass now uses `c.seat` if given). The seat is on the centre line. Exhaust is a vertical stack from the model's anchor_exhaust. No `tow_tank` class (FV3/FV4).
- dist/surface-table.js: group 'tractor' (GROUPS, 6th `col` column with the design values, GRIP_BONUS .25, ROLL_DRAG_GROUP .5, BOG_RESIST .12). `bogRate` and `stepBog` take `bogMul`, and a tractor's load factor is (1 + .5 x load).
- dist/driving.js (2 one-line edits): passes `cls.bogMul` to `stepBog`; `doors()` lists no passenger door for a class with `seats===1`.
- dist/paint.js: PAINT for both (6 colours each; the first keeps the model's own colour. Hustler: hue 231, band 40. R75: hue 8, band 12, narrow so its brown frame and tan rims are not recoloured).
- dist/orders.js: VEHICLE_PRICE tractor_juff 520000 and tractor_kidbi 980000, added last (a `//` comment I first added cut off RESTOCK_DAYS; fixed and the full suite re-run).
- dist/map-definition.js: two MAP.vehicles slots (Riden Deals car bays 2 and 3, x 99.55 / 102.25, z -15.5, yaw PI, diesel, 12,000 / 25,000 milli-gal, sale 'both'), and the two models added to DRIVABLE_MODELS.
- dist/tracks-rules.js: TRACK_WIDTH .35 / .38.
- dist/vehicle-sounds.js: engines `tractor_juff` / `tractor_kidbi` use `eng-worktruck` at slowed rates. ALL_FILES is de-duplicated so the shared clip loads once.
- dist/night-lights-rules.js: lamp spots for both tractors.
- dist/credits.js: two CC-BY-4.0 entries (JUFF, KidBi-Gaming), "modified", with the license.txt links. ASSETS.md: new section. assets-register.json: two entries.
- Tests changed to move pins (each is a real consequence of two new vehicles): props, orders, tracks, map, vehicle, damage, damage-game, dev, smoke, night-lights, terrain-mud-gravel, store-categories.
  - props: the triangle budget and the "centred" check now exempt the tractors (footprint checked instead).
  - vehicle: hull sample points `>=16` instead of 20 (the small tractors have 17); doors 10.
  - damage-game: SILHOUETTES must equal CLASSES minus the tractors (generic drawing until FV2).
  - smoke: a tractor stack rule.
  - night-lights: tractor tail lamps may sit 0.45 m in.
  - store-categories: NO_PICTURE_YET exempts the tractors.
- New tests/farm-tractors.mjs (81 lines): class numbers, 0 to top time (3.5 s / 4.5 s), speeds in mph, the group column, grip, bog 33.3 s mud / 83.3 s plowed / 22.2 s with bogMul 1.5, no bog while moving, record wheels and anchors, axleZ against the hubs, pin heights (+22 cm / -9 cm), `createProp`, the startup size rule, paint, price order, slots, tracks, sound, credits.

## Results (real output)
```
npm run index:
brief 2996 tokens (target 3000), index 26167 tokens (target 32500); 176 modules, 13 generated, 214 tests, 26 scripts; 14 modules without a header comment

npm run release -- --force:
Packaged release 0.35.9: 177 files -> dist/releases/0.35.9
dist/index.html now loads releases/0.35.9/

node tests/farm-tractors.mjs:
Farm tractors: PASS (Hustler Compact and Husky R75 classes, tractor surface group, bog 33 s / 83 s / 22 s, 3 models with wheels and anchors, paint, price, slots, tracks, sound fallback, credits)

npm test (tail):
PASS zones-ru1.mjs: PASS zones-ru1 (32 checks)
All 214 test files passed.
```
A first full run had 7 failures. They were the pins listed above, fixed one by one. An earlier run with 33 failures came from my own comment bug in orders.js.

## DECISIONS TO CONFIRM
1. Store pictures: not rendered. The tractors have no phone Store picture (`pictureFor` returns '', no crash). Run `npm run dev` then `npm run pictures` (Edge). This re-renders all 36 pictures, so check the old ones still look right. The test exempts the tractors until then.
2. Fuel ports are estimates (the lite files have no fuel-port anchor): Hustler {x .5, y 1, z .9}, R75 {x .55, y 1.1, z .85}, on the hood's left side.
3. The slots are on the Riden Deals lot (as the prompt said), not Husky Ranch. The R75 has no farming-level gate (no farming skill yet).
4. The trailer ("Husky Trailer", $2,400 per design) has only a model record: no price, class or slot. Its `front` wheel flags are the front axle's; FV3 must stop them steering.
5. Lamp spots: the Hustler's headlight anchors are 0.15 m apart on the hood, so the lamps are set 0.3 m out (a guess). The R75's come from its lens parts.
6. Hull sample points `>=16`, the SILHOUETTES exemption and the triangle exemption (see above).
7. The root rename (`Tractor_KidBi_Tank_Source` to `Tractor_KidBi_Source`) was NOT done. The importer ignores root names (anything ending `_Source` is skipped), so it has no effect on the data. It would need a Blender or farm-conform.py change.
8. Draw calls: each tractor is 5 (body + 4 wheels). Two display tractors on the lot add 10 draw calls while the lot is in view, plus 2 more per owned tractor. Not measured.

## Not verified (no browser)
Real startup load time with the larger module; the vehicles actually drawn on the lot and their bay fit (car bays 2.7 m wide, the R75 is 1.98 m); paint colours in all six hues; wheel spin and steer; the 35 degree steer against the fenders; the mount side and the door point; the fuel cap marker; tyre tracks.

## Eye-check list
1. The lot: the two tractors in bays 2 and 3 (x 99.55 / 102.25), nose toward the wall like the S70. Size beside the worktruck and the S70. No clipping with the neighbours.
2. Colours: Hustler blue and R75 red by default; cycle the six colours in the Store (no picture yet, so by buying one). Check the R75's brown frame and tan rims stay put, and the Hustler's trim and glass stay put.
3. Wheels: tyres dark with light rims (not white); drive and watch them spin, the front pair steer, the front tyres against the fenders at full lock (half lock is 0.5 rad).
4. Entering: E at the left side (1.5 m out); no passenger door offered; seated at the centre line; camera distance (4.7 m back, 1.9 m up).
5. Top speed 14 and 16 mph; slow in mud (4.4 m/s); the bog time is 33 s in mud; track width on soft ground.
6. Exhaust stack smoke; headlamps at night (R75 lenses, Hustler guess); the cap marker on the hood's left.
7. Engine sound: the worktruck loop slowed.

## What is left
FV2 (seat pose, steering-wheel spin, camera numbers, silhouettes), FV3 (hitch, tank class), FV10 (Husky Ranch lot field), FV11 (tractor sounds), the store pictures, the root rename.

## Files touched
scripts/build-props.mjs, scripts/split-wheels.mjs; dist/props.js, vehicle.js, surface-table.js, driving.js, paint.js, orders.js, map-definition.js, tracks-rules.js, vehicle-sounds.js, night-lights-rules.js, credits.js, props-assets.js (generated); ASSETS.md, assets-register.json; tests: new farm-tractors.mjs, edited props, orders, tracks, map, vehicle, damage, damage-game, dev, smoke, night-lights, terrain-mud-gravel, store-categories. Not touched: notes/handoff.md, game.js, world.js, terrain.js, audio.js, phone*.js. No git.

Confidence: high for the data, classes, surface group, bog numbers and tests; medium for the lamp, fuel-port and bay-fit numbers (estimates); low on how it looks, because nothing was rendered.
