# Vehicle damage (VD): design brief
DESIGN ONLY, nothing built, nothing decided by the user yet. Written 2026-11-14 by Opus 5.5 for map-master section 8 (the VD line
before 8.2). Built AFTER the world expansion (P1 to P5). (m) = read in code or notes, (e) = estimate.
Sources: dist/vehicle.js (classes, stepVehicle, poseFree, normalizeVehicles), driving.js (step, tilt, burn), paint-shader.js, paint.js,
smoke.js, audio.js engineVoice, fuel.js, orders.js, jobs.js normalizeProgress, multiplayer.js, server.js, life.js, DESIGN.md 3, 4.13 (line
270 "Damage system" note), 4.20 B, the multiplayer section (applyWorld, authority), crime-system-design.md, atv-handling-design.md,
water-design.md.

What exists today (m):
- `stepVehicle` returns `{state, hit}`; on a hit it slides (x only, then z only; keeps at least a fifth of the step, speed x (1 - 2.5 dt)),
  else stops dead (speed 0). `poseFree` checks `blocked()`, other vehicles (SAT) and pedestrians (circles) but does not say WHICH one.
- y follows the ground footing: there is no airborne state, so there are no falls today.
- Deep water and banks are blocked (`SURFACE_SPEED` 0); fords (0.3 m) come with W1/A1 and are drivable.
- Each vehicle's body material has its own uniforms but all share one shader program (`customProgramCacheKey 'vehicle-paint'`).
  The flatbed has its own paint material (`mesh.userData.paint`).
- Smoke: one `THREE.Points` pool of 90 (one draw call), one grey colour. Engine voice is pure (`engineVoice`), tier sets roughness.
- No player health: `life.js` has food, thirst, energy only. The crime design says "no damage system, no physics rams".
- DESIGN 4.13 already sketched it: a `cond` 0..1000 like tool wear, impacts above about 4 m/s lower it, repairs at the Eastbank workshop.
- Classes (m): shortbed = Kasumuchi S70, top 29 m/s (65 mph), accel 1.5, 5 mpg, $500 (`VEHICLE_PRICE.shortbed` 50000);
  worktruck $4,500; flatbed $8,000; offroad $11,000. Map plot I4 on Eastbank is "the vehicle workshop" (m, map-definition.js:146).

## 1. What damage is, what causes it
**Decision: one number per vehicle, `cond` 0..1000 (shown as 0 to 100 %), no zones.** Zones (engine, tyres, body, glass) mean four
numbers to save, sync, show and price, and four repair menus; the fun is "I crashed, it runs worse, I pay to fix it", which one number
gives. It matches tool `cond` (DESIGN 4.8, 0..1000), so the same words, HUD style and repair maths. Bands give the effects (section 2):

| Band | cond | Shown as |
|---|---|---|
| Fine | 700..1000 | nothing extra |
| Worn | 400..699 | "Worn" in the vehicle panel |
| Damaged | 150..399 | "Damaged", orange |
| Limping | 1..149 | "Limping", red |
| Wrecked | 0 | "Wrecked: call a tow" |

Causes:
1. **Collisions (the main one).** `stepVehicle` gains two return fields (additive, `hit` stays): `impact` (m/s into the obstacle) and
   `hitKind` (`'world' | 'vehicle' | 'person'`). Impact speed: intended step length L, actually moved k (0 when stopped dead):
   `impact = |v| x sqrt(1 - (k/L)^2)`. Head-on = full speed; a 45 deg glance = 0.71 v; a shallow scrape along a wall = almost 0.
   (Without this, a fast slide costs only 8 % of speed per slice and an oblique crash would be free.)
   Points: `min(600, round(tough x 1.2 x (impact^2 - 16)))` when impact > 4 m/s, else 0 (energy grows with the square).
   Kasumuchi (tough 1.0): 6 m/s (13 mph) 24; 10 m/s (22 mph) 101; 15 m/s (34 mph) 251; 20 m/s (45 mph) 461; 26 m/s+ caps at 600.
   `tough` per class (e): flatbed 0.6, worktruck 0.8, offroad 0.85, shortbed 1.0, ATV 1.3. Data on the class, tuned later.
   **One crash never wrecks a Fine vehicle (cap 600); two hard ones can.** Debounce: one event per vehicle per 0.5 s, the largest
   impact in that window (a stop can be split over two slices).
2. **Other vehicles.** `hitKind 'vehicle'`: the driver takes the points above. An owned parked vehicle you hit (single player) takes the
   same points. NPC traffic and police cars have no damage state (always pristine, no cost). Remote players' vehicles: never damaged
   by you (section 7).
3. **People.** `hitKind 'person'`: a fixed 20 points, not the formula (today a pedestrian circle stops the hull like a wall, so a 60 mph
   hit would otherwise read as a 600-point crash). Section 5.
4. **Falls: none.** No airborne state (m). The ATV design has roll-back, no tumble or flip (m): no damage. Revisit only if jumps arrive.
5. **Water.** Fords: no damage (fun, and the S70/worktruck cannot use them anyway: ATV and pickup only (m, ATV design)). Deep water
   stays a hard barrier (water design Q3) so drowning a vehicle cannot happen. Hook kept: if a rule change ever lets a vehicle stand
   in water deeper than 0.6 m (e), the engine dies (cond -150, stall) and it needs a tow.
6. **Off-road abuse: small, data only.** On grass, fields, mud: 2 points per km (e) for classes without `rough`; 0 for the offroad
   pickup and ATVs. That is about 1 % per 5 km: a reason to own the off-road pickup, never a punishment. Can be set to 0.
7. **Police chases.** No rams (crime design, kept). Boxing in happens under 1 m/s, below the 4 m/s threshold, so no damage. The
   player's own crashes during a chase cost normally: fleeing into a wall at 45 mph is 461 points; that is the consequence.

## 2. Effects (by band, applied like `withLoad`)
New pure `withDamage(cls, cond)` in damage.js, used next to `withLoad` in driving.js step (m: `withLoad(f.cls, load)` at driving.js:91).

| Band | top | accel | burn | engine voice | smoke | start |
|---|---|---|---|---|---|---|
| Fine | x1 | x1 | x1 | as today | as today | normal |
| Worn | x0.95 | x1 | x1.05 | rough +0.1 | grey x1.3 | normal |
| Damaged | x0.85 | x0.85 | x1.15 | rough +0.25, misfire dip every 1.7 s | dark tier, hood wisp | 2 extra cranks |
| Limping | x0.5 | x0.6 | x1.3 | rough +0.4, misfire every 0.8 s | black plume, hood smoke | 4 extra cranks |
| Wrecked | 0 | 0 | 0 | off | hood smoke 60 s after the crash, then none | crank, no catch |

- Kasumuchi Limping: 14.5 m/s (32 mph): it can still crawl to the shop. Steering pull: NO (annoying, not fun).
- Stall: a single event of 250 points or more stalls the engine (no random: MP and the "no Math.random in rules" rule (m, DESIGN)).
  The engine restarts on the next W after 1.0 s with the ignition crank (`audio.ignition`). Not saved.
- Burn multiplier goes into the existing `burnMgal(..., gallonsPerMile x (1 + .3 x load) x burnMul)` (m, driving.js:92).
- engineVoice gets `cond` (or `rough` and `misfire` from withDamage); misfire = a gain dip of 0.12 s on a fixed phase. Pure, testable.
- Cost: one multiply per slice, zero frame cost.

## 3. Visuals within budget
**Decision: shader wear on the existing material + smoke tiers + glass cracks. No new materials, no decal meshes, no new draw calls.**
- **Grime and scratches:** extend `patchPaint` (paint-shader.js) with one uniform `uWear` (vec2: x = mud from the ATV design Q7, which is
  "IN NOW" (m), y = damage 0..1 = 1 - cond/1000). Fragment: below Fine, desaturate and darken the paint by up to 25 %, add scratch
  streaks from a hash of the model-space position (thin bright lines on painted pixels only, the same `m` mask as the paint). Same
  `customProgramCacheKey`, so all vehicles keep ONE program. The flatbed's own paint material gets the same chunk.
  Cost (e): about 15 extra ALU ops per body fragment, about 0.02 ms for 4 vehicles on screen; 0 draw calls; 0 textures.
- **Dents (VD3b, optional):** a vertex chunk with 4 impact points `uDent[4]` (vec4: local x, y, z, depth up to 0.08 m), pushing
  vertices inward along the normal with a 0.5 m falloff. Impact points come from the hit side (local hull point nearest the obstacle),
  oldest replaced. Cost: 4 distance checks per vertex, negligible. **Risk:** low-poly panels deform as blobs; check the vertex density
  of each converted model first (unknown (m not read); e: 2k to 15k vertices). If it looks fake, drop dents (real over fake).
  Dents are saved? No: derived from cond only (a fixed per-model dent set scaled by damage) so they need no save field.
- **Glass:** if the model has a separate glass material (to check per model in VD3), a crack pass: one shared 512 x 512 crack alpha
  texture (a real asset: drawn by the user or CC0, listed in ASSETS.md and credits.js), shown from Damaged down. One texture fetch on
  glass pixels. If a model's glass is baked into the body texture: no cracks for that model (say so, do not fake).
- **Smoke:** smoke.js gets a per-point colour attribute (`vertexColors`), same Points object, same draw call. Pool 90 -> 150 (e:
  60 more points, about 0.01 ms). Tiers: grey #9a9c9e (today), dark #5a5c5e, black #2a2a2a. A new class field `hood` (local point;
  default x 0, y 0.9, z hz - 0.6) for engine-bay smoke at Damaged and below. `exhaustRate` gets a multiplier from withDamage.
- **Shared and instanced meshes:** drivable vehicles are single meshes with their own material instance (m). Uniforms are set on
  change (load, damage event, repair), never per frame. Future instanced NPC traffic has no damage (no per-instance attribute needed).
  Display vehicles on the lot are always 1000.
- **Avoid (frame-rate traps):** a cloned material with a different program per damaged vehicle = a shader compile hitch of 50 to
  200 ms (e) the first time it is seen; per-vehicle canvas textures (2 to 4 MB each (e)); debris meshes (a draw call each).
  Warm the patched program at load with `renderer.compile` so the first crash never hitches.
- Camera: a 0.25 s shake on events of 150 points or more (amplitude 0.05 m (e)). Toast on the first event in a band: "Your Kasumuchi
  S70 is Damaged (34 %). It is slower and uses more gas."

## 4. Repair, towing, insurance, the auto shop
New pure module `garage.js` (rules take `p`, `uid`, `now`; return `{state, error?, message}`), money in integer cents.
- **Auto shop:** the Eastbank vehicle workshop (plot I4) first; later one per region (Blackstone, Kaspian Bay) when those stages exist.
  E at its bay with the vehicle parked inside a marked 6 x 4 m box (e). The same counter later sells the 0.40 tuning parts (DESIGN
  roadmap 0.40, m): VD4 builds the counter UI that 0.40 extends.
- **Repair price:** `repairCents = max(2500, ceil((1000 - cond) x VEHICLE_PRICE[model] x 0.4 / 1000))` when cond < 1000 (40 % of the
  price for a full rebuild, like the tool workshop's ~40 % (m, DESIGN 4.8)).
  | Model | price | per 1 % | Wrecked -> new |
  |---|---|---|---|
  | Kasumuchi S70 | $500 | $2.00 | $200 |
  | Worktruck | $4,500 | $18 | $1,800 |
  | Flatbed | $8,000 | $32 | $3,200 |
  | Offroad pickup | $11,000 | $44 | $4,400 |
  Example: S70 at 45 mph into a wall (461 points) = $92.20. Repair is instant (screen fades 1 s, clock +30 game min).
  Partial repair: "Fix to Worn line (70 %)" at the same rate, for players short of cash.
- **Repair kit (item):** `repair-kit`, $40 (4000), consumable, +150 cond but never above 400: enough to get a Limping or Wrecked vehicle
  to the shop. Use with F at the hood (same "hold F" pattern as the gas can (m)). 3 s.
- **Towing:** phone, Vehicles page: "Call a tow" for any owned vehicle not being driven. No tow truck drives in today (no model: we do
  not fake one); the vehicle is moved by the fade to the nearest auto shop bay (through `findSafePose`, m). Fee
  `min(25000, 7500 + 200 per 100 m straight-line)`: $75 to $250. Later, with a user tow-truck model, a real truck arrives (VD later).
- **Wrecked rules:** cond 0 never deletes a vehicle. **No vehicle is ever lost for good to damage**, which covers the first vehicle
  without a special case. Wrecked = will not start, can be towed, repaired, or (later) sold for scrap.
- **Hard-luck rule (the first vehicle):** if no owned vehicle can run (all Wrecked or Limping) and cash is below tow + repair of the
  cheapest one, the tow is free and that vehicle is repaired to 400 for free, once per 7 game days. Toast: "The shop fixed it for free
  this time. Next time it costs." Keeps a broke player able to work.
- **Insurance (VD5, optional, last):** per vehicle, a weekly premium of 1.5 % of the price (S70 $7.50, offroad $165 per game week),
  pays repairs above a $50 deductible and tows. Paid like rent (housing day, m). Recommend shipping VD1 to VD4 without it and adding it
  only if repair bills feel harsh in play.

## 5. People
- **Player and passenger: not hurt.** There is no health value (m) and adding one is a whole system (hospital, death rules). A crash of
  250+ points costs 5 energy (existing need, life.js) as the "ouch", plus the shake. Nothing else.
- **Pedestrians:** follow DESIGN 4.20 B (m): a hit knocks the person down about 3 s, they get up hurt (NPC health value, never death),
  "the vehicle takes a little damage" = the fixed 20 points here, witnesses within about 15 m log an incident. The knockdown,
  NPC health and incident log belong to 4.20 A2/B, not to VD; VD only supplies `hitKind 'person'` and the 20 points.
- **Crime link:** the crime design has no crimes against people "(no damage system)" (m). Once VD and 4.20 B exist, add one crime
  "Hit a pedestrian" (witnessed only) in the L1 table; fine and Standing are for the Opus fines pass (question 5).
- Animals (Husky Ranch, hunting): vehicles are blocked by them like people; same 20 points, no crime unless ranch animals (later).

## 6. Save format
- **New field `progress.vehicles[i].cond`**: integer 0..999. Missing = 1000 (a perfect vehicle), so old saves load with every vehicle
  Fine. Saved only when below 1000 (same "omit the default" habit as fuel). **No schema bump**: a new optional field on an existing
  entry (DESIGN 3 and 4.13 G say exactly this; 4.13 G even names "condition" (m)). Schema stays 2 (schema 3 is the 0.37 tool change).
- `normalizeVehicles` (vehicle.js:130): after fuel,
  `if(Number.isInteger(v.cond)&&v.cond>=0&&v.cond<1000)entry.cond=v.cond;` (anything else: dropped = 1000).
  `vehiclesToSave` (vehicle.js:147): the same line from `s.cond`. `buyVehicle` (orders.js:173): no change (new = 1000).
  driving.js keeps `f.cond` beside `f.fuelMgal` and hands it to vehiclesToSave.
- **New optional `progress.garage`**: `{hardLuckDay: int|null, insured: {uid: paidUntilDay}}` normalised in a new
  `normalizeGarage` (garage.js), called from normalizeProgress (jobs.js:42 area) like `normalizeOrders`. Unknown uids dropped.
  `insured` only exists once VD5 is built.
- Not saved: stall, smoke timers, dents (derived), the 0.5 s debounce.
- Fixture test: an old save with no `cond` loads Fine; a save with cond 1500, -3, 12.5, "x" loads 1000; 0 stays 0 (Wrecked survives).

## 7. Multiplayer
Today the relay carries positions only (m, multiplayer.js:75, server.js). The planned model (m, DESIGN multiplayer C to E): the driver
streams the pose, discrete changes go through `applyWorld(action)` to the authority, only the owner drives.
- **Who owns the truth:** the authority holds each vehicle's `cond`. The driver's client runs the step (it already computes hits) and
  sends `vehicleDamage {uid, points, kind}`, rate-limited to 2 a second, each clamped to 600 (made in this world) or trusted (bring your
  own). Repairs, kits, tows, hard-luck and insurance are applyWorld money actions (reach check 6 m for vehicles, m).
- **What others see:** the authority's result carries the new `cond`; every client sets that vehicle's `uWear.y`, smoke tier and voice.
  Nothing per frame: about 1 small message per crash. The pose stream gets nothing new.
- **No griefing:** you can never damage another player's vehicle (a hit between two players' vehicles damages each driver's own
  vehicle only, by their own impact). Parked vehicles of other players take nothing. Remote players do not collide with vehicles
  today (m); when they do, `hitKind 'person'` on a remote player costs the 20 points and nothing happens to them.
- Relay protocol: one action type in relay-protocol.js, part of M2..M5, so VD6 rides on that stage.

## 8. Tests (new: tests/damage.mjs, tests/garage.mjs, tests/damage-game.mjs; extended: vehicle.mjs, smoke.mjs, paint.mjs)
1. impact: head-on stop at 20 m/s = 20; slide along a wall at 10 deg about 1.7; free move = 0; `hitKind` world/vehicle/person.
2. points: 4 m/s = 0; 10 m/s = 101 (tough 1); 30 m/s = 600 (cap); tough 0.6 scales; integer result.
3. debounce: two slices of one crash count once; two crashes 0.6 s apart count twice.
4. bands at 0, 1, 149, 150, 399, 400, 699, 700, 1000; `withDamage` numbers per band; Wrecked top 0.
5. stall at 250+, no stall at 249; restart after 1 s; Wrecked never starts.
6. burn multiplier in driving step (drive 1 mile Damaged = 1.15 x the fuel).
7. engineVoice with cond: rough grows, misfire phase deterministic; exhaustRate multiplier; smoke colour per point; pool 150, one draw call.
8. paint: patched material keeps cache key 'vehicle-paint' for every vehicle and the flatbed; uWear set on change only.
9. repair price table above (cents exact), minimum $25, partial repair to 700, not enough cash refused, cond 1000 refused.
10. repair kit caps at 400, consumes one kit; tow fee min/max, vehicle ends at a free bay pose; driven vehicle cannot be towed.
11. hard-luck: only when nothing runs and cash short; once per 7 days; never twice.
12. save: normalizeVehicles keeps 0..999, drops bad values, omits 1000; round trip; old fixture loads Fine; garage normalise.
13. game (packaged): drive the S70 into a wall at full speed: cond 400, toast, smoke tier dark; tow to the shop; repair; cash correct.
14. purity: damage.js and garage.js import nothing from the DOM, no Date.now/Math.random (the MP rule test).

## 9. Stages (Sonnet builders, one per run; Opus only for the tuning pass)
| Stage | Work | Files | game.js? | Risk |
|---|---|---|---|---|
| VD1 | Pure rules: damage.js (impact points, debounce, bands, withDamage, stall), `impact` + `hitKind` from stepVehicle, `tough` and `hood` on classes, `cond` in normalizeVehicles/vehiclesToSave; tests 1-5, 12 | damage.js (new), vehicle.js, tests | no | low |
| VD2 | Wiring: driving.js keeps `f.cond`, applies withDamage next to withLoad, burn multiplier, stall/restart, vehicle panel row and band toasts, camera shake, energy -5 | driving.js, game.js (hook), index.html/style.css (panel row), tests 6, 13 part | yes, small | medium |
| VD3 | Look and sound: uWear in paint-shader (grime, scratches), smoke colours + hood smoke + pool 150, engineVoice misfire, glass cracks where a glass material exists (needs the crack texture), warm-up compile | paint-shader.js, smoke.js, audio.js, driving.js, credits.js | maybe (warm-up) | medium (look) |
| VD3b | Dents (optional, after a vertex-density check per model) | paint-shader.js | no | high (may look fake: drop it) |
| VD4 | garage.js (repair, partial, kit, tow, hard-luck, normalizeGarage), shop bay at Eastbank I4, repair-kit item, phone "Call a tow", tests 9-11 | garage.js (new), items.js, jobs.js (one line), phone*.js, game.js, map-definition.js (bay box) | yes | medium |
| VD5 | Insurance (optional, only if bills feel harsh) | garage.js, phone*.js | small | low |
| VD6 | MP: `vehicleDamage` action, cond in the authority's vehicle copy, broadcast | relay-protocol.js, multiplayer.js, server.js | yes | medium (inside M2..M5) |
| VD7 | Tuning pass in the packaged game: tough, cap, prices, band numbers (Opus numbers, Haiku edits) | data only | no | low |

**Placement in map-master section 8:** P6, after RU5 and before L2: `R5, RU5, VD1, VD2, VD3, VD4, B4, B5, L1, L2 ...`. VD5 at the end of
P6 if wanted. VD6 inside P7 with M2..M5. VD3b and VD7 in P8 (look and tuning on the final world).
Hard dependencies: VD1 needs A2 (both edit stepVehicle; A2 is in P2) and must land before L4 (police classes get `tough` too).
VD2 needs VD1. VD3 needs VD2 and the ATV mud layer if built (share `uWear`; whichever comes first adds the uniform). VD4 needs VD2,
I4 plot free at Eastbank; regional shops need B2/BZ6. VD6 needs VD1 and is part of M2..M5 (M needs the field to exist). 4.20 B
(pedestrian knockdown) and the L1 "hit a pedestrian" crime need VD1 for `hitKind`.
Conflict rows (8.3): vehicle.js with A1/A2/L4; game.js row (VD2, VD4); phone row (VD4, VD5); relay-protocol.js (VD6 with M2..M5).
Runs (e): 6 to 7 (VD1-VD4, VD6, VD7; +1 each for VD3b and VD5). Models: Sonnet builds; Opus for VD7 numbers; Fable only on a yes
for VD3 (candidate, it is a look stage).

## 10. Risks
1. `stepVehicle` is shared by every class and the tests that drive trucks through the gas station (m): `impact` and `hitKind` must be
   additive; existing return fields unchanged. Low if VD1 only adds fields.
2. The hull stops dead at pedestrians today, so a fast hit on a person looks like a wall crash: `hitKind` must be right or players
   pay 600 points for brushing an NPC.
3. Shader program split: any per-vehicle `onBeforeCompile` difference forks the program and hitches 50 to 200 ms (e). Keep one key.
4. Dents on low-poly bodies look fake (VD3b optional for this reason).
5. Economy unknown: repair bills vs wages are untested; a $1,800 worktruck rebuild could hurt a new player (hard-luck rule and
   partial repair soften it; VD7 tunes it).
6. Chases plus damage plus no rams: if escaping means crashing a lot, players may find chases punishing; watch in L4 play.
7. MP trust: in "bring your own" a client can send 0 damage; acceptable (that lobby is labelled trusted (m)).
8. A vehicle wrecked in an unloaded chunk (streaming) must still be towable: tow works on saved data, not on a loaded mesh.

## 11. Questions for the user
1. Severity: can one crash total a vehicle, or keep the cap (one crash at most 60 %, two hard crashes can wreck)?
2. Prices: repair at 40 % of the vehicle price for a full rebuild (S70 $200, worktruck $1,800, offroad $4,400), tow $75 to $250,
   repair kit $40: right, cheaper, or dearer?
3. Realism vs fun: should a Damaged vehicle also pull to one side or brake worse, or keep it to speed, fuel, smoke and sound only?
4. Repair time: instant at the counter (proposed), or the vehicle stays in the shop a few game hours?
5. Hitting a pedestrian: a crime with a fine once the crime system exists (fine set in the Opus fines pass), or only the vehicle cost?
6. Insurance: build it (VD5), or leave it out unless bills feel harsh?
7. Dents: try real dents in the shader (may look blobby on low-poly bodies), or grime, scratches, smoke and cracks only?
8. Glass cracks need one crack texture: will you draw it in Blender/GIMP, or should a builder look for a CC0 one?
9. Off-road wear for road vehicles (about 1 % per 5 km): keep, or none at all?
10. A tow truck model later, so a real truck arrives instead of the fade?


## 12. User decisions (2026-11-14, answers to section 11)
1. Keep the 600 point cap per crash (one crash never totals a vehicle in Fine condition).
2. The user thinks 40% of the price for a full repair is steep. APPROVED by the user 2026-11-14: repair cost = 25% of the price x the share of condition lost (a wreck costs 25%, a scratch costs a few dollars), minimum $25. S70 full repair $125, pickup $2,750.
3. Pull to one side and weaker braking: yes, scaled by damage band (Fine none, Wrecked strong).
4. Repairs take game time (hours, scaled by damage). A later job where the player repairs vehicles is wanted: keep the repair rules pure and shared so a job can call them (jobs.js).
5. Hitting a pedestrian is a crime with a fine. This changes notes/crime-system-design.md ("no crimes against people"): it needs a decision in the L stages (fine size, witnesses, the hit rule of DESIGN 4.20). Not built yet.
6. No insurance. Drop VD5.
7. Damage should look as real as we can: real dents become a real stage (VD3b moves from optional to wanted), checked against the vertex and draw call budget, plus grime, scratches, cracks, smoke.
8. The crack texture (and any damage textures) is made here with headless Blender (Blender 5.2 is installed).
9. Off-road wear depends on the kind of off-road the vehicle is doing (surface, speed, vehicle class): a table per surface, not one number.
10. A tow-truck model: yes, later.
11. New (from the user): the vehicle panel (bottom right, where the vehicle info is) shows a drawn silhouette of the vehicle next to the damage percentage; the silhouette changes colour with the damage band (Fine to Wrecked). Part of VD2. Cheap: one inline SVG per model, recoloured by a CSS class only when the band changes (the panel already writes the DOM only on change, tests/vehicle-hud.mjs).