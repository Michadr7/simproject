# Farm vehicles: design note (PROPOSAL, nothing built) - 2026-11-17, Opus

Scope: the two conformed tractors, the tank trailer, a combine and a grain cart (model slots), the hitch/tow mechanic, farm
implements and their effect on field cells, shop, controls, saves, quality and a staged build FV1..FV12.
Read for this note: dist/vehicle.js (CLASSES, makeClass, stepVehicle, normalizeVehicles), surface-table.js, driving.js
(build, add, step, layTracks, sprayWheels, seatedAt), cargo.js (BEDS), fuel.js, forklift.js (R/F keys), garage.js (towTo,
pullOut), phone-calls.js (CONTACTS), orders.js (VEHICLE_PRICE, soldOnLot, vehicleLock), tracks-rules.js (TRACK_WIDTH),
vehicle-sounds.js, game.js key handlers; notes farm-vehicle-contract, farm-vehicles-sourcing, atv-handling-design,
ground-detail-design 7 (GD10), map-master 3.1/3.4/7.2. Measured from the `*_lite.glb` files (they exist now) with a scratch
script: anchors and bounds below are real numbers, not estimates.
Stays kinematic arcade (DESIGN 4.13): no physics engine; every rule is pure and tested; the ATV pattern (A1..A8) is kept.

## 0. What the files give (lite versions, glTF axes, metres from the rear-axle origin)
| File | Tris | Meshes / mats | Length z | Width | Wheelbase | Rear r | hitch_rear (y, z) | seat (y, z) |
|---|---|---|---|---|---|---|---|---|
| tractor_juff_lowpoly_lite | 5,826 | 11 / 7 | -0.64..2.51 (3.15) | 1.86 | 2.116 | 0.644 | .576, -.524 | 1.076, .326 |
| tractor_kidbi_only_lite | 14,044 | 11 / 6 | -0.86..2.22 (3.08) | 1.98 | 1.816 | 0.611 | .262, -.838 | 1.378, -.247 |
| tow_kidbi_tank_lite | 6,124 | 7 / 4 | -1.42..2.36 (3.78) | 2.78 | tandem +-.449 | 0.411 | eye .353, +2.357 | - |
Flags: (a) the JUFF pin is 22 cm ABOVE the tank's eye (.576 vs .353); the KidBi pin is 9 cm below it. Rule: snap in x/z,
pitch the trailer about its axle to meet the pin (JUFF: atan(.223/2.357) = 5.4 deg nose up; KidBi -2.2 deg). Fine by eye;
if not, lower the JUFF bracket in Blender. (b) The KidBi-only root is named `Tractor_KidBi_Tank_Source` (contract says
`Tractor_KidBi_Source`): rename at import or in farm-conform.py. (c) The tank is wider (2.78 m) than either tractor.
(d) Game state is the HULL CENTRE (every class has symmetric hx/hz); the model origin is the rear axle. Each farm class
gets `axleZ` = rear axle z from the hull centre (JUFF -0.935, KidBi -0.68, tank axle centre -0.47) and the mesh is offset
by it at import. All anchors below are converted the same way.

## 1. Vehicle classes (data in vehicle.js CLASSES via makeClass; numbers are the recommended defaults)
| id | name | group | top m/s (mph) | rev | accel | brake | drag | rMin | aLat | mpg | tank gal | tough | hx / hz |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tractor_juff | JUFF Compact Tractor | tractor | 6.3 (14.1) | 3 | 1.8 | 6 | 1.4 | 4.2 | 6 | 6 | 12 | .35 | .93 / 1.575 |
| tractor_kidbi | KidBi Field Tractor | tractor | 7.2 (16.1) | 3 | 1.6 | 6 | 1.4 | 4.8 | 6 | 5 | 25 | .30 | .99 / 1.54 |
| combine | Combine (slot) | tractor | 8.0 (17.9) | 2.5 | 1.0 | 5 | 1.2 | 6.5 | 5 | 2.5 | 80 | .30 | from model (default 1.75 / 4.5) |
| tow_tank | Tank Trailer | tow | - | - | - | - | - | - | - | - | - | .40 | 1.40 / 1.89 |
| grain_cart | Grain Cart (slot) | tow | - | - | - | - | - | - | - | - | - | .40 | from model (default 1.3 / 2.5) |
- Feel: 0 to top JUFF 3.5 s, KidBi 4.5 s, combine 8 s; coasting stops fast (drag 1.4, a tractor has no roll). Turning at
  walking pace: JUFF R 4.2 m (crossover v = sqrt(4.2 x 6) = 5 m/s, so nearly the whole speed range turns at rMin).
- Diesel only, fuel spec on the MAP.vehicles slot as today: `fuel:{type:'diesel',tankMgal:12000,port:{...from model}}`.
  gallonsPerMile = 8/mpg: JUFF 1.33 (12 gal = 9 arcade miles, 14.5 km), KidBi 1.6 (25 gal = 25 km), combine 3.2 (40 km).
  Work burn: x(1 + WORK_BURN[implement]) while lowered: plow 1.0, cultivator .6, seeder .3, sprayer .2, header .8.
  Diesel is sold at Eastbank Fuel ($4.20) and the gas can; recommended extra: a diesel-only farm pump at Husky Ranch
  (one FUEL_STATIONS entry, same pump code) so field work does not need a 300 m trip.
- New class fields (all optional, defaults keep every old class unchanged): `kind` ('drive' default | 'tow'),
  `seats` (2 default; farm self-propelled 1), `axleZ`, `hitchRear {x,y,z}`, `hitchFront {x,y,z}` (tow units),
  `bogMul` (1), `workWidth`, `voice`. Tow classes have no engine, fuel, seat or camera: makeClass skips those for kind 'tow'.
- Surface group 'tractor' (surface-table.js: GROUPS gains 'tractor'; col() gains a 6th column). Recommended column:
  street/road/bridge/driveway 1, pavement .9, dirt 1, path 1, gravel 1, grass 1, green .95, wheat .9, plowed .85, mud .7,
  water/bank 0. GRIP_BONUS tractor .25 (lugs; ATV .2), ROLL_DRAG_GROUP .5, BOG_RESIST .12 (ATV .2, off-road .35), and
  bogRate for 'tractor' multiplies by (1 + .5 x load) like heavy does with (1 + load), times cls.bogMul.
  Time to Stuck flooring it in mud (BOG_RISE .25): JUFF empty 33 s, with a full tank 24 s; plowed 83 s; combine (bogMul
  1.5) 22 s. Wheels only spin under BOG_SPEED 2 m/s, so a tractor that keeps moving in a field never bogs: "rarely bogs,
  slow in soft ground" (mud top 4.4 m/s for the JUFF).

## 2. Hitch and tow (new pure file dist/hitch-rules.js + wiring in driving.js)
- Pairing: a 'drive' class with `hitchRear` and a 'tow' class with `hitchFront`. One trailer per tractor (no trains).
  Implements use the same pin (section 3), so "trailer" below means any towed unit.
- Attach (H, the existing secondary interact key, from the seat): tractor speed under .5 m/s, the tractor's pin within
  HITCH_REACH .6 m of the trailer's eye (ground distance), |yaw difference| under HITCH_YAW 45 deg. Prompt
  "H: Hitch the Tank Trailer". On hitch the eye snaps to the pin (trailer yaw recomputed from the axle, section 0a pitch),
  sound 'hitch-clunk'. While reversing toward a free trailer a ring marker shows on its eye (one small mesh, the
  fillerMarker style: grey, green when in reach). Detach: H, speed under .5, the trailer stays where it stands, pitch 0
  (drawbar on its jack). Detach is refused on water/bank and while the tank drains or the auger runs.
- Follow model (exact single-axle tractrix, no lag constant needed): H = pin in world after the tractor step; A = trailer
  axle point before; new trailer yaw yt = atan2(Hx - Ax, Hz - Az); new A = H - L (sin yt, cos yt), L = eye-to-axle
  distance (tank 2.357 m; the hull centre sits .47 m ahead of the axle, axleZ -.47). Tandem axles count as one virtual axle at their middle. Frame-rate
  independent because it is geometric (tested at 30/60/165 Hz: same path within 1 cm).
- Articulation phi = wrap(yt - yaw). JACKKNIFE_MAX 70 deg (checked so the two hulls never overlap at the limit: a test
  calls hullsOverlap at +-70 for every tractor/trailer pair). Forward over the limit: phi is clamped (the trailer is
  dragged round, tyres scrub: no event). Reverse at the limit: the tractor stops (speed 0, eased .2 s), event
  'jackknife', toast "Jackknifed: pull forward to straighten".
- Reverse: the raw tractrix is unstable backwards (true to life, hard on a keyboard). REVERSE_ASSIST 0.8 per second:
  in reverse, phi <- phi x exp(-0.8 dt) after the tractrix (the trailer tends to follow the tractor's line, about half the
  angle gone in 0.9 s). Setting "Trailer reverse assist" on (default) / off (0 = realistic). Reverse top with a trailer x.7.
- Load on the tractor: withLoad(cls, TOW_LOAD[unit] x (.2 + .8 x fill)): tank TOW_LOAD .8, grain cart .9, implements
  .3 raised / see WORK_DRAG lowered. JUFF with a full tank: top 5.3 m/s (12 mph), accel 1.3. Burn x(1 + .3 x load) as today.
- Collisions: the trailer hull (hx/hz of its class) is checked with poseFree against the world, other vehicles and
  people, never against its own tractor (the jackknife limit covers that); the tractor ignores its own trailer. If the
  trailer pose is blocked: bisect the tractor's move (reach(), 7 halvings: a few mm gap, no stick), tractor speed 0; no
  slide for a combination. impact = speed at contact; crash points go to the TRAILER (its own cond, tough .4); the tractor
  gets the hit-stop and shake only. Free-standing trailers and implements are fleet members: they block vehicles and
  walkers like a parked vehicle (others() and the walker check include them).
- Tank fill/drain (anchors tank_fill, anchor_drain): capacity TANK_GAL 1,000 (stored as mgal, 1,000,000, like fuel.js).
  Liquids: 'water' ($0.01/gal at a farm standpipe) and 'fert' (liquid fertilizer, $0.60/gal at the ranch). Fill: park so
  tank_fill is within FILL_REACH 4 m of a fill point (MAP.farm.fillPoints), E "Fill the tank with water", 25 gal/s
  (40 s full); a different liquid refuses until drained. Drain: E at anchor_drain, 40 gal/s; at a trough it counts for the
  "water the animals" ranch job, anywhere else it is just emptied (puddle decal: no, mud only on mud). Spraying uses the
  drain (section 3). Fill shows on the HUD row and a tank level is not drawn (no slosh).
- cargo.js: the standing rule is met with a liquid bed: `BEDS.tow_tank={liquid:true,capacityMgal:1000000,y:1.82}`
  (anchor_cargo); `BEDS.grain_cart={bulk:true,capacityBu10:4000}`, `BEDS.combine={bulk:true,capacityBu10:1500}`.
  Cargo value for these is `{k:'water'|'fert',mgal}` or `{k:'wheat',bu10}` (tenths of a bushel, integers); hasBed true,
  log/plank loading refused (capacity 0 for log and planks), loadOf = fill share. normalizeCargo validates by bed type.
- Damage: each unit has its own cond, hit mask and repair quote (damage.js unchanged; repairCents from VEHICLE_PRICE).
  A combination is repaired unit by unit at the Eastbank bay. Wrecked trailer: still towable, look only.
- Tracks (TR5): trailer and implement wheels lay tracks too (RL/RR only on a tandem). TRACK_WIDTH: tractor_juff .35,
  tractor_kidbi .37, tow_tank .36, combine .6, grain_cart .5; implements none (they mark the field instead). Mud carried:
  each unit keeps its own f.carry. Spray (TR6): only the driven unit's rear wheels (towed units none: keeps the pool).
- Bogging (TR4): only the tractor has a bog meter; the trailer adds load (bogRate above). Pull me out moves the
  combination: firm pose for the tractor, trailer placed straight behind; if that pose is not free, wider search (40 m);
  if still none, the trailer is detached where it stands and the toast says so. Fee unchanged ($40, free weekly rule).
- Tow service (garage.towTo): a hitched tractor is unhitched first; each unit is towed and billed on its own (trailer
  fee x .5). Tow units and implements can be towed to the ranch yard or the Eastbank bay.
- Sounds: hitch clunk, hydraulic whirr (R/F), PTO whine loop, fill gurgle, spray hiss, auger loop: CC0 clips in
  vehicle-sounds.js + ASSETS.md; generated noise as the fallback like SND1.

## 3. Implements and field cells (pure: dist/crop-rules.js, the GD10 file; one grid per field, CROP_CELL 1 m, Uint8)
- Cell codes (GD10's 0..6 kept, new codes added above them; bit 0x80 = fertilized):
  0 BARE (unworked), 1 SPROUT, 2 GREEN, 3 RIPE, 4 STUBBLE, 5 SWATH, 6 PICKED, 7 PLOWED, 8 CULTIVATED, 9 SEEDED.
- Work rules (a pure `workSwath(grid, field, a, b, width, rule)` generalises GD10's cutSwath; a and b are the implement's
  working-edge centre before/after, stepped every TRACK_STEP .6 m; returns cells changed):
| Implement | Width | Work top m/s | Lowered drag | Rule (old -> new) | Uses |
|---|---|---|---|---|---|
| plow (slot) | 2.4 | 2.7 | top x.7, accel x.6 | 0,1..6,8,9 -> 7 (crops ploughed under, no yield) | diesel |
| cultivator (slot) | 3.0 | 3.6 | top x.85 | 4,5,6,7 -> 8 | diesel |
| seeder (slot) | 3.0 | 3.1 | top x.9 | 7,8 -> 9 | seed $0.10/m2 from the seeder's hopper (500 m2 a fill) |
| sprayer (tank) | 6.0 | 4.5 | none | 9,1,2 -> same code + 0x80 | fert .1 gal/m2 (1,000 gal = 10,000 m2) |
| header (combine) | 6.0 | 2.7 | none | 3 -> 5 (+grain); 1,2 -> 4 (no yield) | grain tank |
  Over the work top speed nothing changes and the HUD says "Too fast to plow (max 6 mph)". Cells already in the target
  state are skipped (no double charge).
- Growth: 9 -> 1 -> 2 -> 3 every CROP_STAGE_DAYS 2 game days (seed to ripe 6 days, GD10's number). Ripe stays ripe
  (relaxed jobs: no rot). Wheels on growing crop: GD trample look only, no yield loss.
- Yield: ripe cell cut = .1 bu (fertilized .125). Today's wheat field 75 x 38 = 2,850 cells = 285 bu (356 fertilized).
  Wheat sells for $6.00/bu at the Husky Ranch silo (placeholder): about $1,700 a field before seed $285, fert $140, diesel.
- Field times (straight passes + 30% turns): plow 2.4 m x 2.7 m/s = 6.5 m2/s, 9.5 min; cultivator 5.7 min; seeder 6.6 min;
  spray 1.4 min; harvest 3.7 min. Stubble to seed without the plow (cultivate, seed) is about 12 min a field.
- Header tied to GD10: combine anchor_header (centre of the cutter bar), HEADER_W 6 from the model, CUT_MIN_SPEED .5.
  Grain tank 150 bu: full = cutting stops (cells untouched), HUD "Grain tank full: unload (N) into a grain cart".
- Unload: N swings the auger (node `auger` if present) and runs it while a grain cart's anchor_cargo is within
  UNLOAD_REACH 2.5 m of the spout point (anchor_unload projected to the ground), 4 bu/s (full combine in 38 s); works
  while both move. The cart unloads at the silo fill point (MAP.farm.grainPoints) at 6 bu/s, paid on delivery.
- Mounted vs trailed: plow, cultivator and seeder are MOUNTED on the pin (rigid, yaw = tractor yaw, no articulation,
  hull added to the tractor's for collisions as a second box) and raised/lowered by R/F (0.8 s, sound). The tank and the
  grain cart are trailed (section 2). Implement slot contract = the tow contract plus `anchor_work_L/R` (outer ends of
  the working edge at ground level) and an optional `lift` node (raise pivot, rotate about local X).
- Effects (pooled TR6 debris, one Points object): plow/cultivator dust and clods at the working edge (High; Low a
  quarter), spray mist fan 6 m from anchor_drain (High 40/s, Low 10/s), chaff from the header (GD10 CHAFF_RATE 30/s).
- Fields today: field-wheat, field-plowed, field-green (map-definition.js). New saved state per field: progress.fields
  (run-length bytes, GD10 note: its own save design, Opus). Until that design: grids reset on reload.

## 4. Shop, prices, renting
- Where: Husky Ranch equipment yard (Hal Brennan, open barn as the lot; map-master 3.1/3.4, ranch hours 06:30-17:30).
  The ATV goes to Eden Outdoors (A7); both need the same new optional slot field `lot` on MAP.vehicles ('riden' default,
  'eden-outdoors', 'husky-ranch') read by soldOnLot and the display slots. Tractors and tow units also sell online via
  the phone Store (delivered to the ranch yard, the existing order fee); the combine at the yard only.
- Prices (VEHICLE_PRICE in cents; add the new keys LAST, tests/orders.mjs reads the first key). Economy: worktruck 4,500,
  ATV 3,800, flatbed 8,000, pickup 11,000.
| Unit | Buy | Rent per game day | Gate |
|---|---|---|---|
| JUFF tractor | $5,200 | $60 | none |
| KidBi tractor | $9,800 | $110 | farming level 3 (when the skill exists) |
| Combine | $28,000 | $350 | farming level 5 |
| Tank trailer | $2,400 | $25 | none |
| Grain cart | $3,200 | $35 | none |
| Plow / cultivator / seeder | $900 / $1,100 / $1,800 | $15 / $15 / $25 | none |
- Ownership tiers: (1) JOB EQUIPMENT: the ranch's own JUFF + tank, free while a ranch job is active (like the forklift
  at the warehouse), parked back at the yard by the job's end; (2) RENT: a fleet entry with `rent {from, cents}`, charged
  per started game day when returned at the yard (or on the phone: "Return where it stands", $40 pickup); repairs billed
  on return; cash below the bill = repossessed at the next charge, damage billed as debt to the ranch rep (hook only);
  (3) BUY: as today. Financing: later.
- MAX_OWNED 12 today: recommended 16 with tow units and implements counted (a farm set is 4 to 6 units).

## 5. Driver, camera, controls, HUD, phone
- Mount: no doors. E within 1.5 m of the mount point (left side, x = hx + .6 at the seat's z) gets you on; `seats` 1, so
  no passenger door (same no-door path as the ATV's A5: whichever is built first, the other reuses it). Exit on the left,
  else the existing exitPoint order. Pose: seated on `seat` (hips), hands on anchor_hands_L/R (on the steering_wheel rim),
  feet on anchor_foot_L/R; the body tilts with the cab (DR1 seatPose). steering_wheel turns about local Y: steer x 1.5 rad.
- Camera: makeClass gives back 3L/2 (JUFF 4.7 m), up 1.2L/2 (1.9 m). Hitched: back + .5 x trailer length (+1.9 m with the
  tank), up + .3. Combine: back 9 m, up 4.5 m (sees over the header). Smoothing as the other classes.
- Keys (driving only; none clash: B, N, V are unused, L is lights, R/F already mean raise/lower on the forklift):
  H hitch/unhitch (existing interact('H')), R raise / F lower implement or header, B work on/off (PTO for implements and
  sprayer, thresher for the combine; lowering alone does nothing until B), N auger out/run (combine) or cart tip at the
  silo, E fill/drain at a point. Each shows in the prompt line when it applies.
- HUD rows (vehicle panel, vehicle-hud.js): "Towing: Tank Trailer, water 640 of 1,000 gal"; "Implement: Plow lowered,
  working 2.4 m" or "Too fast to plow (max 6 mph)"; "Grain tank: 120 of 150 bu"; "Field: Wheat field 42% cut".
  Silhouettes: farm models use the generic one until drawn (SILHOUETTES list).
- Phone Call app: one new contact 'Husky Ranch' (Hal Brennan, 555-0131, hours [390,1050], handler 'farm'): rent a
  machine delivered to the yard, return a rented machine where it stands ($40), ask for field work today (offers a ranch
  job). Tow service handles combinations as in section 2. Pull me out unchanged.

## 6. Multiplayer (note only) and save
- MP pose per driven unit as today {x, z, yaw, speed, steer} plus `phi` (articulation; the trailer pose is derived on
  each client from the tractor pose, phi and L), `imp` bits (lowered, working, auger), `fill` (0..255 coarse, for others'
  visuals). Field cells: host-owned; edits sent as {field, run start, length, code} batches at most 4 Hz.
- Save (progress.vehicles entries, all optional so old saves load): tractor `hitch` (uid of the towed or mounted unit);
  tow units their own pose, cond, hit, `cargo` ({k, mgal} or {k, bu10}); `rent {from, cents}`; implements load raised
  and off. normalizeVehicles: a `hitch` pointing at a missing or non-tow uid is dropped; on load the trailer is placed by
  the tractrix from its saved yaw (no snap jump). progress.fields: separate Opus save design (GD10).

## 7. Performance and quality
- Draw calls (soft caps; user not worried): JUFF lite 11 meshes about 15 calls, KidBi lite 11 about 16, tank 7 about 8,
  combine and cart unknown (merge to 8 materials at conform). A full combination about 25 calls. Shadows: tractors cast;
  tow units and implements cast on High only.
- Field grid look: one R8 DataTexture per field (GD10), re-uploaded at most 4 Hz and only when cells changed (wheat field
  2,850 bytes). Cost is near zero.
- High: implement dust and clods, spray mist full rate, chaff, drawbar pitch, stubble instances (GD10), trailer shadows.
  Low: dust off, mist and chaff a quarter, no trailer shadows; the field texture still updates (it is gameplay truth).
- Triangles: lite totals 5.8k / 14k / 6.1k: fine (soft caps).

## 8. Staged build (one Sonnet run each unless marked; tests run headless; release only for an undeployed version)
| Stage | Work | Files | Tests | Conflicts | User eye-check |
|---|---|---|---|---|---|
| FV1 | Tractor import: build-props entries for both lite files (splitWheels, anchors kept as userData, axleZ offset, root rename), PAINT entries, CLASSES tractor_juff/tractor_kidbi, group 'tractor' column in surface-table, MAP.vehicles slots (Riden lot for now), VEHICLE_PRICE (last), fuel specs, TRACK_WIDTH, sound fallback (worktruck clip), ASSETS.md + credits.js CC BY lines from license.txt | scripts/build-props.mjs, props-assets.js, vehicle.js, surface-table.js, paint.js, map-definition.js, orders.js, tracks-rules.js, vehicle-sounds.js, ASSETS.md, credits.js | new tests/farm-tractors.mjs (numbers, bog times 33 s/83 s, group column); paint.mjs, orders.mjs, surface-table.mjs, assets.mjs, credits.mjs re-run | props-assets.js and map-definition.js: never beside another assets or map stage | size beside the worktruck, colours, wheel spin and 35 deg steer vs fenders, tracks width |
| FV2 | Seating and camera: seats 1, no-door mount, seat pose, hands on rim, steering wheel spin, camera numbers, HUD silhouette fallback | driving.js, game.js (syncPlayerMesh/updateCabPose hooks), vehicle.js | driver-lag.mjs style seat test for both tractors; driving-game.mjs | shares the ATV A5 code path: not beside A5 | sitting height, hands, getting on/off |
| FV3 | Hitch rules (pure): tractrix follow, jackknife, reverse assist, hitch reach, combination bisect, TOW_LOAD; tank class (kind 'tow'); cargo.js liquid and bulk beds | new dist/hitch-rules.js, vehicle.js, cargo.js | new tests/hitch-rules.mjs (30/60/165 Hz path, no overlap at 70 deg, reverse assist halves phi in .9 s); cargo.mjs | cargo.js: not beside a cargo/warehouse stage | none (pure) |
| FV4 | Hitch wiring: tank import, combination step, H prompt and ring marker, trailer collisions and damage, trailer tracks, camera, bog load, pull-out and tow rules, save `hitch` | driving.js, game.js, garage.js, props-assets.js, map-definition.js, vehicle.js (save) | new tests/hitch-game.mjs (hitch, 50 m loop, reverse 10 m, jackknife stop, detach, reload); bog-game.mjs, garage tests | game.js and driving.js: not beside any vehicle stage | snap look (5.4 deg pitch), trailer swing in turns, reversing feel |
| FV5 | Tank fill/drain: fill points and diesel farm pump at Husky Ranch (data), E prompts, liquids, HUD row, sounds | map-definition.js, driving.js, game.js, vehicle-hud.js, fuel-station data | tank-game test (fill 40 s, drain, wrong liquid refused) | map-definition.js | standpipe place, flow speed |
| FV6 | Crop rules (pure) with GD10: codes, workSwath, growth, yield, fertilizer bit | dist/crop-rules.js | tests/crop-rules.mjs (every transition, speeds, widths) | none (new file) | none |
| FV7 | Sprayer work: B on the tank, mist fan, field texture update, HUD field row; field look per code (GD10 shader part) | driving.js, game.js, ground-shader.js, world.js, debris.js | farm-work-game test (spray a strip, cells change, fert used) | world.js and debris.js: not beside GD/visual stages | sprayed strip readable, mist |
| FV8 | Implement slots: contract text, mounted unit rules, R/F lift, plow/cultivator/seeder classes and prices; wired as soon as a model exists (one Sonnet import run per model) | notes/farm-vehicle-contract.md, vehicle.js, driving.js | per-model import test | as FV4 | plowed strip, lift animation |
| FV9 | Combine + grain cart slots: classes, header (GD10 cut), grain tank, auger unload, cart tip at the silo, two-box hull for the header | vehicle.js (hull parts), driving.js, crop-rules.js, cargo.js | combine-game test (cut 6 m, tank fills, unload) | waits for the models and GD10 | 6 m strip, chaff, auger reach |
| FV10 | Shop and rent: `lot` field, Husky Ranch yard slots, rent rules, job equipment, phone contact 'Husky Ranch', MAX_OWNED 16 | orders.js, map-definition.js, phone-calls.js, phone-call.js, garage.js | orders.mjs, phone-calls.mjs, new rent test | coordinate `lot` with ATV A7 | yard layout, prices on signs |
| FV11 | Sounds: CC0 tractor and combine engines, hitch, PTO, hydraulics, auger, spray | vehicle-sounds.js, audio.js, assets/sounds | vehicle-sounds.mjs | audio.js: only when nobody edits it | listen list |
| FV12 | Feel pass (Opus): numbers in the packaged game, MP and save review (progress.fields design) | this note, constants | timing tests | - | full farm loop |
Order: FV1, FV2, FV3, FV4 first (tractors drivable, then towing); FV5 and FV6 can run side by side (different files);
FV7 after FV6 and GD10's shader part; FV8/FV9 when models exist; FV10 any time after FV4 (or before FV2 if the user
wants to buy tractors early); FV11 when audio.js is free.

## 9. Open questions for the user (each with the recommendation)
1. Where are farm machines sold? A Husky Ranch yard (Hal) [recommended], B Riden Deals lot, C a P7 farm shop later.
2. Reversing with a trailer: A assist on by default with a settings switch [recommended], B always assisted, C realistic only.
3. Plow, cultivator, seeder models: A you find or buy them, they go in as slots [recommended], B you model them in
   Blender, C skip plow and seeder for now (tank sprayer and cultivator only).
4. Prices: A as proposed (JUFF $5,200, KidBi $9,800, combine $28,000) [recommended], B half that, C dearer.
5. Renting: A rent per game day plus free job equipment on ranch jobs [recommended], B buy only, C rent only the combine.
6. The 6 m combine header on roads: A always 6 m wide, drive carefully [recommended for the first build], B it narrows to
   about 3.5 m when raised, C the header is a separate trailer unit.
7. Crop growth: A 2 game days per stage, 6 days seed to ripe [recommended], B 1 day per stage, C seasons.
8. Owned limit: A tow units and implements count inside 12, B raise to 16 with them counted [recommended], C a separate
   limit of 8 for tow units.

## User decisions (answered in the dialog, new chat)
1. Shop: Husky Ranch yard (Hal). 2. Reversing assist: on by default, settings switch. 3. Plow/cultivator/seeder models: the user finds or buys them; they go in as slots. 4. Prices ($5,200 / $9,800 / $28,000) OK for now, BUT THE VEHICLE NAMES MUST CHANGE (user wants different names: ask what names, or propose neutral ones, before FV1). 5. Rent per game day plus free job equipment on ranch jobs. 6. Combine header always 6 m, drive carefully. 7. Crop growth 2 game days per stage, 6 days seed to ripe. 8. Owned limit raised to 16, tow units and implements counted.
## Vehicle names (user, 2026-11-17; replaces the working names)
Small tractor (JUFF model, $5,200): Hustler Compact. Big tractor (KidBi model, $9,800): Husky R75 Tractor (user typed "Husy"; read as Husky, confirm if it should stay "Husy"). Tank trailer (KidBi tank): Husky Trailer. Combine ($28,000): Ridgeline Reaper 6000. Use these in CLASSES, orders.js, the shop, phone and ASSETS.md at FV1.