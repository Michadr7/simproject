# Terrain and vehicles off road: design (TR1, 2026-11-14)

Design only. Nothing is built. Goal (user): terrain types and what happens when vehicles drive off road (mud, grass), how long tyre tracks stay, and all that.

## 0. What exists today (checked)
- `dist/terrain.js` SURFACE ids: GRASS 1, STREET 2, ROAD 3, DIRT 4, PAVEMENT 5, WATER 6, BANK 7, BRIDGE 8, WHEAT 9, PLOWED 10, GREEN 11, DRIVEWAY 12, PATH 13. There is **no mud and no sand** surface. BANK (the river's mud bank) is not walkable and `blocked()` refuses it for vehicles.
- `dist/vehicle.js`: `SURFACE_SPEED` scales top speed and accel (accel floor .35); `cls.rough` (.35, off-road pickup) lifts every 0 < m < 1 multiplier, capped at 1; `OFFROAD_DECEL` 6 m/s2 drags speed down to the surface top. No grip: surface does not change cornering or braking. Classes in `CLASSES`: worktruck, flatbed, shortbed (S70), offroad. The forklift has its own step (`forklift.js`, warehouse floor). ATV: no model, no class yet.
- `paint-shader.js`: `uWear.x` is already reserved for mud ("reserved for the ATV"); `uWear.y` is damage. One texture fetch, uniforms only.
- `debris.js`: one Points pool, 150, kinds chip/glass/spark. Smoke pool 150 in driving.js.
- No weather. Time: 12 game hours = 24 real minutes, so 1 real second = 30 game seconds, 1 game hour = 2 real minutes.

## 1. Surface table

### 1a. Class groups (new `GROUP` field on each class)
| group | classes | idea |
|---|---|---|
| road | shortbed (S70), worktruck | road tyres, the current base numbers |
| offroad | offroad pickup | the current `rough` .35 lift |
| heavy | flatbed | slow, sinks when loaded |
| atv | ATV (coming) | light, best off road, worst on comfort |
| fork | forklift | solid tyres; only if it ever leaves hard floor |

`rough` stays as a field for old code and tests; the group table replaces it inside `surfaceSpeed`, and the road and offroad columns below reproduce today's numbers exactly, so existing tests stay green.

### 1b. Top-speed multiplier `SURFACE_SPEED_BY_GROUP` (also scales accel, floor .35 kept)
| surface | road | offroad | heavy | atv | fork |
|---|---|---|---|---|---|
| street, road, bridge, driveway | 1 | 1 | 1 | 1 | 1 |
| pavement | .5 | .85 | .5 | .9 | .8 |
| dirt | .8 | 1 | .75 | 1 | .4 |
| path | .5 | .85 | .45 | 1 | .5 |
| grass | .5 | .85 | .45 | .95 | .3 |
| green (young crop) | .5 | .85 | .45 | .9 | .3 |
| wheat | .5 | .85 | .45 | .85 | .25 |
| plowed | .5 | .85 | .4 | .85 | .2 |
| MUD (new, id 14) | .3 | .6 | .25 | .7 | .15 |
| water, bank | 0 | 0 | 0 | 0 | 0 |

Recommended default: as above. Road/offroad unchanged (no retune of today's feel); heavy a little worse than road; ATV near full everywhere except crops and mud.

### 1c. Grip `GRIP` (new). Multiplies `aLat` (corner radius grows), `brake`, and accel
| surface | grip |
|---|---|
| road group of surfaces (street, road, bridge, driveway) | 1 |
| pavement | .95 |
| path | .8 |
| dirt | .75 |
| grass | .65 |
| green, wheat | .6 |
| plowed | .5 |
| mud | .35 |

Tyre bonus `GRIP_BONUS` by group: road 0, offroad +.15, atv +.2, heavy -.05, fork x.7 on anything under 1. Result clamped to `GRIP_MIN` .3 and 1. Effect: an S70 at 13 m/s on grass needs a 26 m circle instead of 19 m, and brakes in 1.5x the distance; no slide model, no spin-outs (arcade stays arcade, and push stays smooth).

### 1d. Rolling drag `ROLL_DRAG` (m/s2, added to `cls.drag` when coasting)
road 0, pavement .2, dirt .4, path .4, grass .8, green/wheat 1.0, plowed 1.4, mud 2.5. Same for every group, offroad and atv x.6. Makes fields feel heavy without touching top speed.

### 1e. Sink (bog) risk `SINK` 0..1 per surface, `BOG_RESIST` per group
SINK: mud 1, plowed .4, wheat .15, green .15, grass .05, every other surface 0.
BOG_RESIST (multiplier on the rise rate): road 1, heavy 1.3 (and x `1 + loadFraction` from cargo), offroad .35, atv .2, fork 1.5.
Wet ground: an `env.wet` 0..1 hook (default 0, no weather yet) multiplies SINK by `1 + 2*wet` and GRIP by `1 - .25*wet`. Wet grass needs no new surface id; it is grass with `wet` > 0.

### 1f. Where mud comes from
New `SURFACE.MUD = 14`, painted from new map data `map.mud: [{x0,x1,z0,z1}]` after fields (so a field gate can be muddy) and before the river ribbon (the bank stays blocked). Suggested first patches: 3 to 5 small ones, 6 to 14 m across: field gates on the farm, the low point of the forest dirt track, a puddle next to the Eastbank yard. Minimap colour `#5b4630`, vehicle panel label 'Mud'. Footing for walking: same as dirt.

## 2. Getting bogged

There is a bogged state, and it can never hard-lock the player.

**Meter.** Each driven vehicle keeps `bog` 0..1 (in driving.js state, not saved).
- Rises while: on a SINK surface, throttle held, and |speed| < `BOG_SPEED` 2 m/s (wheels spinning, not rolling). Rate = `BOG_RISE` .25/s x SINK x BOG_RESIST x (1 + 2*wet). Momentum is the counter: above 2 m/s you plough through and the meter does not rise. A road truck that stops in the middle of a mud patch and floors it bogs in about 4 s; the off-road pickup in about 11 s; the ATV in about 20 s.
- Falls: `BOG_FALL_FIRM` .5/s on a SINK-0 surface; `BOG_FALL_IDLE` .08/s on soft ground with throttle released (it "settles").
- At bog >= 1 the vehicle is **Stuck** (until bog < `UNSTICK_AT` .6).

**Stuck.** Top speed x `STUCK_TOP` .08 (S70: about 0.7 m/s in mud), brought down smoothly by OFFROAD_DECEL (no hard stop). Wheel-spin effects play (mud spray, revving sound). Vehicle panel line: "Stuck: rock it (W then S) or call a tow". One toast the first time ever.

**Ways out (all always available):**
1. Rock it: each throttle direction change within `ROCK_WINDOW` 1.2 s of the last one takes `ROCK_STEP` .15 off bog. About 3 to 4 rocks get you out.
2. Wait: release throttle; .08/s, so about 5 s to unstick.
3. Creep: even Stuck, the vehicle crawls at STUCK_TOP, and mud patches are 14 m at most, so it always reaches firm ground eventually (S70 about 20 s worst case).
4. Safety net: after `STUCK_MAX_S` 45 s continuously Stuck, bog drops to .6 by itself (never a soft lock even if the player only holds W).
5. Call a tow (phone Call app, owned by the phone work): when the vehicle is Stuck the Call app shows **"Pull me out"** as well as the normal tow. Pull-out: `BOG_PULL_CENTS` 4000 ($40), `BOG_PULL_HOURS` .5 game hour (1 real minute fade), puts the vehicle on the nearest firm free spot (safe-spot.js) facing away from the mud, bog 0. A normal tow to the garage keeps its VD4 price ($75 + $10 per 100 m, cap $250). Hard-luck free help (garage.js `hardLuck`) also covers a pull-out.
6. Winch: not in this plan (open question 4).

The vehicle stays free to exit and walk away at any time; leaving it Stuck is fine (it stays Stuck until pulled or driven out).

## 3. Tyre tracks

**Which surfaces keep tracks, lifetime (real seconds / game time), colour:**
| surface | `TRACK_LIFE_S` | game time | colour (multiplied onto ground) |
|---|---|---|---|
| mud | 600 | 5 h | `#3e2f22`, alpha .75 |
| plowed | 300 | 2.5 h | `#4a3a2a`, .6 |
| wheat, green | 240 | 2 h | `#5a6a30`, .5 (flattened crop) |
| dirt, path | 180 | 1.5 h | `#6b5638`, .45 |
| grass | 90 | 45 min | `#4b6233`, .35 |
| pavement, roads, bridge, driveway | none | | except carried mud below |

**Carried mud:** after leaving mud or plowed ground the tyres lay brown tracks on any surface for `TRACK_CARRY_M` 30 m, alpha fading from .5 to 0 along that distance, life 120 s.

**Fade:** full alpha for the first 70% of life, then linear to 0 (`TRACK_FADE_FROM` .7). A segment laid on top of an older one does not stack (alpha is max, not sum: the blend is normal alpha, segments short).

**Laying:** rear wheels only (2 strips; the flatbed's dual rears count as one wide strip). A new segment per wheel every `TRACK_STEP` .6 m travelled, only when |speed| > .3 m/s, segment length .65 m (slight overlap), placed at `heightAt + .02` with the yaw of the vehicle and the pitch from the height difference of its ends. While Stuck and spinning, one darker "dig" segment per wheel every .5 s in place (capped at 6 per wheel), so the hole is visible.

**Width (`TRACK_WIDTH`) and half gauge (`TRACK_HALF`) per class:**
| class | width m | half gauge m |
|---|---|---|
| shortbed S70 | .20 | .80 |
| worktruck | .24 | .82 |
| offroad | .30 | .92 |
| flatbed | .55 (dual) | 1.05 |
| ATV | .25 | .50 |
| forklift | none (indoors) | |

**Drawing:** one `InstancedMesh` of a 1 x 1 flat quad, `TRACK_MAX` 1024 instances, a ring buffer (the oldest is overwritten). Per-instance attributes: colour (vec3) and birth time + life (vec2); alpha is worked out in the vertex shader from one `uTime` uniform, so a frame costs nothing on the CPU except writing new segments (`instanceMatrix` updateRange only for the new slots). Material: MeshBasicMaterial with `onBeforeCompile`, transparent, depthWrite false, polygonOffset -1/-1, vertex colour only, **no texture** (optional later: one 32 x 8 tread alpha texture). Cost: 1 draw call, 1 program, 1024 matrices x 64 B = 64 KB plus 20 KB of colour/time attributes. `mesh.frustumCulled = false` with a manual check (one bounding sphere around all live segments) because instances spread.
**Distance culling:** do not lay segments when the vehicle is more than `TRACK_LAY_M` 120 m from the camera (only matters for remote players later); fade alpha to 0 between `TRACK_DRAW_M` 70 and 90 m from the camera in the vertex shader. Everything over the far value is discarded in the fragment shader.
**Budget fit:** draw calls are over 300 already; this adds exactly 1. Cheaper fallback if even that is too much: lay tracks only for mud and plowed (most of the visible value).
**Saving:** not saved. Reload starts clean (recommended: nothing in the save, no migration).
**Rain:** no weather exists. Hook only: with `env.wet` > 0 track alpha x (1 + .3 wet) and grass life x 1.5; a future rain shower could shorten dirt/path life x .5 (washed out).
**NPC vehicles:** do not lay tracks (they stay on roads anyway).

## 4. Feedback

**Particles: reuse the debris pool** (`debris.js`, one Points object, one patched program). Add kinds `dust` and `mud`; raise `DEBRIS_MAX` 150 to 220 (still one draw call; about 2.6 KB more).
- dust: on dirt, path, plowed, crops when speed > 4 m/s; `DUST_RATE` 14 per second at top speed, scaled by speed / top; colour `#b9a582` to `#d6c7a6`; grows 1x to 3x, lives 1.2 s, little gravity (-.5), high drag. Emitted behind each rear wheel.
- mud: on mud (and plowed when spinning) with wheelspin (throttle and speed < 3 m/s, or Stuck); `MUD_RATE` 20 per second; clods `#3e2f22`, thrown back and up 2 to 4 m/s, full gravity, bounce 0, live 1 s.
- grass: none (tracks only) to save the budget.
- Off when `prefers-reduced-motion` asks for less (half rate).

**Wheel sound per surface** (lazy loaded like SND1, one voice that crossfades in .3 s, gain and playbackRate by speed):
| loop | surfaces | source |
|---|---|---|
| tyres-asphalt | roads, bridge, driveway, pavement | CC0 (Freesound / OpenGameArt), mono Ogg, about 40 KB |
| tyres-gravel | dirt, path | CC0 crunch loop |
| tyres-grass | grass, crops, plowed | CC0 swish loop |
| tyres-mud | mud; plus a spin squelch when spinning or Stuck | CC0 squelch loop |
Each file recorded in ASSETS.md (author, URL, CC0) and the one SND1 summary line in credits.js. If a good CC0 file is not found, say so (do not fake it with noise); the generated sound stays the fallback. Engine note rises when Stuck and spinning (rpm up, speed none).

**Dirty vehicle (mud on the paint):** per vehicle `mud` 0..1, saved inside `cond` as optional `mud` (old saves: 0). Cheap and nice to keep across reload.
- Gain per metre driven: `MUD_GAIN` mud .012, plowed .004, wheat/green .002, dirt/path .0015, grass .0006; x 2 while spinning. A full mud patch crossing takes a clean S70 to about .15; Stuck and rocking quickly to .5.
- Slow natural loss: `MUD_DECAY` .05 per game day (dries and flakes).
- Shader: `uWear.x` = mud. Mask from the bottom up: full below the sills, fading to 0 at 40% of the body height plus wheel-arch splashes, broken up with the existing wear texture channel (no new fetch, no new program key). Colour `#5a4632` dry to `#3e2f22` fresh (fresh for 1 game hour).
- Washing: a **wash prompt at the gas station** (Eastbank pumps), `WASH_CENTS` 800 ($8), takes `WASH_S` 4 real seconds with a short fade, mud to 0. A repair at the garage also washes for free.

## 5. Damage, fuel, NPCs

**Fuel:** burn multiplier `FUEL_SURFACE`: roads 1, pavement 1.05, dirt/path 1.1, grass 1.25, crops 1.3, plowed 1.4, mud 1.8; spinning or Stuck burns as if at 40% of top speed. Offroad and ATV x .8 of the extra. Applied in driving.js where `burn` is called (fuel.js stays pure: a factor argument).

**Off-road wear (damage):** only the road and heavy groups. Driving faster than 70% of the surface's top on grass, crops, plowed or mud costs `OFFROAD_WEAR` .4 points per 10 m (dirt and path: 0). It can never take a vehicle below the Scuffed band floor (650): off-road driving alone never makes a vehicle Damaged, and never stalls it. Offroad and ATV: 0. Hitting a bog does not damage.

**NPC / AI vehicles:** the Oak Street cars and future traffic stay on roads; if pushed off by a collision they use the same `surfaceSpeed` table (road group) and steer back; they never bog (bog only for driven vehicles), lay no tracks, get no mud. Multiplayer later: remote vehicles lay tracks from their synced pose only when within TRACK_LAY_M.

**Performance summary:** +1 draw call (tracks), 0 new programs except the track material (1), particle pool +70 points, 4 Ogg loops about 160 KB lazy. All per-frame work is O(new segments).

## 6. Build plan (each stage Sonnet 5.5 sized, tests pass at the end of each; npm run release -- --force first as usual)

- **TR2 surface table + grip + roll drag.** New pure `dist/surface-table.js` (GROUP, SURFACE_SPEED_BY_GROUP, GRIP, GRIP_BONUS, ROLL_DRAG, SINK, BOG_RESIST, FUEL_SURFACE, TRACK_* tables). `vehicle.js`: `group` on each class, `surfaceSpeed` reads the table (same results for road/offroad), `stepVehicle` applies grip to aLat/brake/accel and roll drag when coasting. Tests: new `tests/surface-table.mjs` (old SURFACE_SPEED values reproduced for every class; grip radius and braking numbers); existing vehicle tests unchanged.
- **TR3 mud surface.** `terrain.js` SURFACE.MUD 14, FOOTING, MINIMAP_COLOUR; `map-definition.js` (additive `mud` list, 3 to 5 patches, validateMap: mud must not touch water, must be reachable); ground colour for mud in the ground layer (world.js, minimal and additive, say so); SURFACE_LABEL 'Mud'. Tests: `tests/terrain.mjs` additions (patches rasterise, bank still blocked).
- **TR4 bogging.** New pure `dist/bog.js` (stepBog(state, input, surface, cls, load, dt) with every constant above, rock detection, STUCK_MAX_S net). `driving.js` keeps bog, applies STUCK_TOP; `vehicle-hud.js` Stuck line; `garage.js` `pullOut()` quote and apply ($40, .5 h, safe-spot). Expose `pullOutAvailable(vehicle)` for the phone Call app (the phone agent wires the button; coordinate, do not edit phone.js while that work is open). Tests: `tests/bog.mjs` (bog times per class, rock out, wait out, 45 s net, never stuck forever with throttle held), `tests/bog-game.mjs` (drive into a patch, get Stuck, rock out; pull-out moves to firm ground and charges).
- **TR5 tyre tracks.** New `dist/tracks.js`: pure ring buffer + life/alpha math (testable) and `createTracks(parent)` view (one InstancedMesh, shader alpha by uTime and distance). game.js: one hook after the vehicle step. Tests: `tests/tracks.mjs` (spacing .6 m, per-surface life, fade, ring overwrite at 1024, carried mud 30 m, none on road); perf-gate stays green (draw calls +1 at most).
- **TR6 particles + wheel sounds.** `debris.js` kinds dust and mud, max 220; driving.js emits; `vehicle-sounds.js` surface to loop map; `audio.js` tyre voice with crossfade; 4 CC0 Ogg in dist/assets/sounds/, ASSETS.md rows. Tests: `tests/debris.mjs` additions (kinds, rates), `tests/vehicle-sounds.mjs` additions (surface to loop). Do not start while another agent edits audio.js.
- **TR7 dirty look + wash.** `damage.js` (mud in cond, normalize, lookOf adds mud), `paint-shader.js` uWear.x bottom-up mask, `fuel-station.js` wash prompt, `garage.js` repair washes. Tests: `tests/damage-look.mjs` (same 2 program keys with mud), new `tests/wash.mjs` (gain per metre, decay, $8 wash, old saves load mud 0).
- **TR8 fuel and off-road wear + tuning table.** driving.js burn factor, off-road wear with Scuffed floor; `tests/terrain-table.mjs` prints speed/grip/bog/fuel per class and surface (like damage-table) and pins the floor rule.
- **TR9 ATV rows** when the ATV class exists (group atv, track width .25, speed and price still open).

Order note: TR2 first (everything reads its table); TR3 before TR4; TR5 to TR8 in any order.

## 7. Open questions for the user (with recommendation)
1. **Mud:** add small new mud patches (field gates, forest track dip, yard puddle), or let off-road vehicles drive on the river bank? Recommend: new mud patches; the bank stays blocked (keeps vehicles out of the river).
2. **Who can bog:** everyone in deep mud, off-road pickup and ATV much more slowly (rates in 2), or off-road and ATV immune? Recommend: everyone can, off-road 3x and ATV 5x slower; it keeps mud meaningful for every vehicle.
3. **Pull-out price:** $40 and half a game hour on site (vs. the full $75+ tow to the garage)? Recommend: yes, $40, hard luck covers it.
4. **Winch:** a winch upgrade for the off-road pickup and ATV (self-recovery to a tree or post)? Recommend: later, not in TR2 to TR9; rocking and the pull-out cover it.
5. **Washing:** $8 wash at the gas station, plus free with a garage repair? Recommend: yes (and dirt stays across reload).
6. **Off-road wear:** road trucks lose a little condition on fast field driving, never below Scuffed? Recommend: yes, small; off-road pickup and ATV take none.

## Decisions (user, 2026-11-17)
1. Mud: new small patches; the river bank stays blocked for now.
2. Everyone can bog (off-road 3x and ATV 5x slower).
3. Pull-out: yes, $40 and half a game hour; the hard-luck help covers it.
4. Winch: later, not in TR2 to TR9.
5. Washing: $8 at the gas station and free with a garage repair; mud saved with the vehicle. PLUS: plan a CARWASH building/service later (own stage, not yet scheduled).
6. Off-road wear: yes, small, road trucks only, never below Scuffed; off-road pickup and ATV take none.
