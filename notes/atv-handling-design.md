# ATV off-road handling: design note (PROPOSAL, nothing decided) - 2026-11-14
Sources read: dist/vehicle.js (classes, step, SURFACE_SPEED, rough), driving.js (tilt, exhaust), height.js, paint.js,
audio.js ENGINE_TIERS, orders.js VEHICLE_PRICE, smoke.js, scripts/build-props.mjs, map-master.md 4.1-4.3 + Decisions.
Stays kinematic arcade (DESIGN 4.13): no rigid bodies; everything below is a rule in the pure step or a visual.

## 1. Feel
Small, light and twitchy where the pickup is heavy and planted. Slower on asphalt than the pickup, but grass, dirt
and gravel barely slow it; it turns almost on the spot at walking speed, climbs what the pickup cannot (25 deg vs the
10 deg road), slows hard near that limit and rolls back past it. The body bobs and rolls over every bump, the rider
leans into turns, a hand-brake tap on dirt swings the tail out. Fords splash, dust trails behind on dry ground.

## 2. Offroad profile (data on the class: replaces `rough` for the ATV; pickup keeps rough .35 so tests hold)
`atv:makeClass({id:'atv',tier:'low',mpg:20,hx:.6,hz:1.0,top:15.6,reverse:4,accel:4,brake:9,drag:1.2,rMin:4,aLat:9, profile:{...}})`
- Top 15.6 m/s = 15.6 x 2.237 = 34.9 mph (pickup 26.8 = 60 mph, worktruck 17.9 = 40 mph). 0 to top: 15.6/4 = 3.9 s.
- Brake 9 m/s2 (Space x1.5 = 13.5): stops from top in 15.6/13.5 = 1.2 s.
- Turn (assumes today's step does R = max(rMin, v2/aLat); verify): crossover v = sqrt(4 x 9) = 6 m/s.
  At 3 m/s R 4 m, yaw 0.75 rad/s (43 deg/s); at 6 m/s R 4 m, 1.5 rad/s (86 deg/s); at 15.6 m/s R 27 m, 0.58 rad/s (33 deg/s).
- Surface factors `profile.surface` (top and accel multiplier; today grass .5, dirt .8, pickup grass .85):

| Surface | ATV | Top m/s (mph) | Note |
|---|---|---|---|
| asphalt / road | .90 | 14.0 (31) | knobby tyres |
| gravel (new SURFACE) | .95 | 14.8 (33) | access + lake roads |
| dirt | 1.00 | 15.6 (35) | ATV loop |
| grass, fields, path | .95 | 14.8 (33) | |
| sand (beach, new) | .75 | 11.7 (26) | |
| mud (new: banks, stream edge) | .70 | 10.9 (24) | today BANK = 0 (blocked) for all |
| shallow ford 0.3 m (new) | .45 | 7.0 (16) | ATV + pickup only; deep water stays 0 |

- Slope (grade g = ground pitch along heading, already computed by driving.js tilt(); the step gets it via env.grade):
  uphill top x (1 - 0.6 (g/25)^2): 10 deg .90 (14.1 m/s), 15 .78 (12.2), 20 .62 (9.6), 25 .40 (6.2 m/s, 14 mph);
  uphill accel - 9.81 sin(g) x 0.3: at 25 deg 4 - 1.24 = 2.76 m/s2. Downhill top x (1 + 0.25 g/25) (25 deg: 19.5 m/s),
  coasting gains 9.81 sin(g) x 0.3, brake x (1 - 0.3 g/25). Beyond 25 deg: throttle no longer holds, speed goes to
  -1.5 m/s at 2 m/s2 (roll back), engine note dips (stall cue), toast "Too steep"; no tumble, no flip. Cliffs (>35) block.
  Side slope (roll): over 18 deg the pose slides downhill 0.15 m/s per degree over 18 (cap 1.5 m/s) using the existing
  slide/poseFree path; over 25 deg steering toward uphill is refused. Pickup gets the same rule with limit 10/15.
- Bounce (visual only, driving.js): pitch/roll from the four hull points as today but faster smoothing (k = 1-exp(-12 dt)
  vs 8); squat clamp(-.02 accel, +-.06) and body roll .02 x lateral up to .08 rad (pickup .01/.04, .012/.05);
  jiggle y = 0.025 m x (v/top) x rough(surface) x sin(phase), phase += distance x 2.4 (no randomness, so MP poses agree):
  rough asphalt 0, gravel .5, grass .6, mud .8, dirt 1. Pitch jiggle +-0.6 deg in quadrature.
- Low-speed grip: under 3 m/s no slip, full rMin 4; reverse 4 m/s.
- Hand-brake drift (Space above 5 m/s on dirt/grass/gravel/mud/sand): aLat x .5, yaw rate x 1.4, a new state field
  `slip` (heading minus travel direction) grows to max 25 deg; travel direction eases to heading at 3 rad/s once Space
  is released; speed bleeds 3 m/s2 while drifting. On asphalt Space is a plain brake.
- Tier and fuel: 'low', mpg 20, gallonsPerMile = 8/20 = 0.40 (worktruck 1.00, flatbed 1.33, pickup 0.55). Tank 4 gal
  (tankMgal 4000; worktruck 21): 4/0.40 = 10 arcade miles = 16 km = 10 laps of the 1.6 km loop; town to trailhead about
  1.5 km by road, map diagonal 2.3 km: one tank does a return trip plus 8 laps. Keep ARCADE_MILE_SCALE 8.
- Price placeholder: master 4.3 says 4,500, which equals the worktruck (450000 in VEHICLE_PRICE, read as $4,500); propose
  380000 ($3,800), sold by Eden Outdoors only (soldOnLot there, not online), frames from Eden Industries later.

## 3. Rider (one person)
- No door: E within 1.5 m of the seat mounts; seat anchor from the model (`seat` node). Pose 'ride': seated, hands on the
  handlebar node, feet on pegs. Lean = clamp(-1.5 roll + .03 lateral, +-12 deg); torso +8 deg forward uphill, -5 downhill.
- The rider IS the player's skinned model: no extra skinned mesh. Remote players ride with their own avatars. Seat 2 later
  (`seat_2` node reserved now, unused).
- Camera (override makeClass's 3L/2 = 3.0 m back, 1.2 m up, too tight): back 4.2 m, up 1.9 m, look at seat +1.1 m and
  2 m ahead; on slopes up += 0.5 x back x sin(pitch) (rises on climbs to see over the crest), smoothing 1-exp(-5 dt).

## 4. Audio and effects
- Engine: today ENGINE_TIERS is keyed by tier (low base 22, rough .8, lowpass 240): add a `voice:'atv'` override on the
  class, base 30, gain .28, rough .9, lowpass 420 (buzzy single cylinder). Tyre/dirt noise: filtered noise, gain v/top x
  rough(surface). Ford: splash burst on entry, wet hiss loop while v > 1 m/s.
- Dust: reuse smoke.js (one THREE.Points pool, one draw call). Emit from the rear wheels at 0..12 puffs/s by v/top on
  dirt, gravel, sand; tan instead of grey needs a per-puff colour (check smoke.js; if absent, add a colour attribute,
  not a second pool). Mud: dark low puffs on mud; optional "dirty" paint val x .8 that a ford washes off.

## 5. Blender model contract (for the user)
- Units metres, transforms applied; target 2.0 m long, at most 1.2 m wide (trail 2.5 m), about 1.1 m tall.
- Pivot: world origin on the ground, centred between the four tyre contact points. Forward: game +z; with the glTF
  exporter (+Y up) the nose points to Blender -Y.
- Nodes (exact names): wheel_FL, wheel_FR, wheel_RL, wheel_RR (origin at hub, spin about local X); steer_FL, steer_FR
  (empties, parents of the front wheels, pivot at the kingpin, turn about Y); susp_FL..susp_RR (optional empties, wheel
  parents, move in Y for visual travel); handlebar (pivot on the column); exhaust, seat, seat_2 (empties).
- Triangle cap 3,000 total including wheels (cars 1,200, trucks 2,800-3,500).
- Paint: one material named `Paint` on the body plastics only (fenders, tank cover, seat cowl), set directly like the
  flatbed (PAINT.atv {direct:true}); racks, frame, tyres, seat, lights in other materials. 6 colours (Q5).
- Pipeline: file under the vehicles asset folder, an entry in scripts/build-props.mjs (longest 2.0, splitWheels, collide
  fit); check build-props keeps empties (today it splits wheels only). Credit line in credits.js: own work by the user.

## 6. Cost and risk
- Draw calls per ATV: body 1 + wheels 1-4 (split) + paint 0 = 2-5; the rider is the player (already drawn). Cars budget
  10: an ATV counts as one car. MP: sync pose only {x, z, yaw, speed, steer, slip}; pitch, roll, jiggle derived locally.
- Risks: slope rules change the pickup too (keep pickup on the old rule until tuned); FORD and MUD make some water and
  banks drivable, blocked() and the terrain check must agree; empties may be stripped by the converter.
- Tests to update (Grep): tests/vehicle.mjs 26 (low vs mid tier compare: ATV is low but faster accel than worktruck),
  134 (pickup grass .85 and dirt 1: keep `rough` for the pickup); tests/orders.mjs 56 (Object.keys(VEHICLE_PRICE)[0]:
  add atv LAST); tests/fuel.mjs 71 (both trucks burn); tests/paint.mjs (every model has colours); tests/vehicle-hud.mjs
  (SURFACE_LABEL: add Gravel, Sand, Mud, Ford); driving-game.mjs / fuel-game.mjs use the worktruck only (no change).

## 7. Open questions for the user
1. Top 35 mph on dirt, 31 on asphalt: right, or faster than the pickup off-road at, say, 40 mph?
2. Hand-brake drift on Space, or a separate key (Shift) so Space stays a plain brake?
3. Beyond 25 deg: roll back (proposed) or just stop dead?
4. Should the pickup also get the slope rule (10 deg road limit), or only the ATV?
5. Paint: which parts take colour, and which 6 colours?
6. Price $3,800 (below the worktruck) or the master's 4,500?
7. Mud and dirty paint now, or later?
8. Second seat: reserve the node now and build later (proposed)?

## 8. Staged build (one agent per stage)
| Stage | Work | Model | game.js? |
|---|---|---|---|
| A1 | profile data, new SURFACE ids (gravel, sand, mud, ford) in terrain.js, labels, tests | Sonnet | no |
| A2 | slope, side slide, roll back, drift, slip in the pure step; tests with synthetic grades | Sonnet | no |
| A3 | tuning review of A1-A2 numbers on the Blackstone loop data | Opus | no |
| A4 | model import: build-props entry, empties, credits, PAINT.atv (after the user's model) | Sonnet | no |
| A5 | driving.js: mount, rider pose, camera, wheel spin/steer, handlebar, jiggle | Sonnet | yes (camera, input) |
| A6 | audio voice, tyre noise, splash, dust colour in smoke.js | Sonnet | yes (wiring) |
| A7 | shop: VEHICLE_PRICE, Eden Outdoors slot, tank, MP pose fields | Sonnet | yes |
| A8 | feel pass in the packaged game, final numbers | Opus | no |


## Decisions (user, 2026-11-14)
- There will be several ATV models with different numbers: the profile is a default plus per-model overrides in data. The user will set speeds and the like when each ATV is added; keep the default numbers in this note as the starting point.
- Q7: mud and dirty paint are IN NOW (mud surface type and a dirt layer on the paint). Other questions: Claude's leanings stand.