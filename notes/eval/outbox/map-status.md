michadr.

# Map-Build Status Audit (`notes/map-status.md`)

Read-only audit of all map-build phases P0..P8 from `notes/map-master.md` section 8 (including VD1..VD7 / VD3b and the Alder Avenue sidewalk gap). No code was edited, no git commands were run, no release/index/full-suite commands were run, and no browser was launched.

## Files Created
- `notes/map-status.md` (155 lines, UTF-8 without BOM): phase-by-phase status tables (P0..P8), eye-check list, critical path + next 5 stages with builder models, and dense-file conflict matrix.
- `notes/eval/outbox/map-status.md` (this report, UTF-8 without BOM).

## Forbidden Files
None edited and none requested (read-only audit).

## What Was Checked
- **Design specs**: `notes/map-master.md` (section 8 + build outlines 3.8, 4.6, 5.8, 6.10, 7.10 + decisions), stage tables in `notes/ironwood-city-design.md`, `notes/water-design.md`, `notes/atv-handling-design.md`, `notes/crime-system-design.md`, `notes/vehicle-damage-design.md`, `notes/streaming-brief.md`, `notes/dents-finding.md`.
- **Code & data**: `dist/map-definition.js` (zones, water, bridges, offices/interior origins, exits, pavements including the Alder Ave `z -60..-80.7` gap, landmarks C1..C10 & Eastbank I5, towns, weaponZones, fishing, rescuePoints, edgeBands, signs, FUEL_STATIONS, minimap view), `dist/carry.js`, `dist/water-chunks.js`, `dist/farm-beds.js`, `dist/map-view.js`, `dist/map-bake.js`, `dist/minimap.js`, `dist/damage.js`, `dist/garage.js`, `dist/ownership.js`, `dist/relay-protocol.js`, `dist/vehicle-sounds.js`, `dist/fuel.js`, `dist/weld-core.js`, `dist/weld-game.js`, and directory listings of `dist/*.js`, `tests/*.mjs`, `notes/eval/outbox/`.
- **Outbox reports & handoff**: `notes/handoff.md` (lines 1-16 + keyword grep for stage IDs), `notes/eval/outbox/map-track.md`, `r4.md`, `ru1.md`, `ru2.md`, `basin.md`, `a4.md`, `a5.md`, `gp1.md`, `hud-minimap.md`, `mm3.md`, `crowd-spike.md`, and confirmed `W1.md`/`W2.md`/`W4.md` are Workforce stages (not Water).

## Single-File Tests Run (Real Output)
24 representative Node unit tests were run directly (`node tests/<name>.mjs`); **24 passed, 0 failed** (none of these depend on the packaged release; `chunks.mjs`, `perf-gate.mjs`, and `road-r3b.mjs` log a non-fatal caught `ReferenceError: Image is not defined` from `world.js:579` in Node):
```text
OK   tests/carry.mjs :: Carry: a log on the shoulder (not the bag), planks in the hands, one thing at a time; the saw takes a log only while on and with room; four stacks fill the belt and one taken makes room; planks can be put down (8 stacks); the three fields save additively and old saves load.
OK   tests/map.mjs :: Map data is valid and frozen; zones, roads, fields, trees, shops, hours, studio and spawn match the numbers they replaced; 77 broken maps are each caught; Ironwood, Cedar Heights, Eastbank Works, the second bridge and the plots are in place.
OK   tests/chunks.mjs :: mask tiles: 42 tiles, 148133 cells compared, avg 1.78 ms, max 5.74 ms / world tiles: 270 tiles in 314 ms
OK   tests/perf-gate.mjs :: mask tile: 126 builds, avg 1.57 ms, median 0.94 / meshes: ring of 25 = 44 (limit 300) / whole chunk build: median 0.86 ms, max 18.84
OK   tests/water-contract.mjs :: water-contract ok
OK   tests/water-height.mjs :: water-height ok
OK   tests/water-chunks.mjs :: water-chunks: 53352 checks; 52 chunks with water; per chunk max 520 triangles and 333 vertices (1 draw call each); whole map 14355 triangles
OK   tests/road-graph.mjs :: road-graph ok
OK   tests/road-geometry.mjs :: road-geometry ok
OK   tests/road-r3a.mjs :: R3a ok: gravel roads drawn and painted, 3 street tags, 3 new wild roads, grades fine.
OK   tests/road-r3b.mjs :: R3b ok: 461 checks: river (33 points, 1.83 km, 3 rapids, ends in the sea), 4 bridges, sea, 11 roads, exit at x 1082, mask tiles, dug ground.
OK   tests/junctions-r4.mjs :: R4 junctions ok: 336 checks: 9 angled patches at 4 joins (28 patches in all), Kaspian Bay in TOWNS with 5 street names and 5 signs, West Bank Lane linked.
OK   tests/zones-ru1.mjs :: PASS zones-ru1 (32 checks)
OK   tests/rescue-ru2.mjs :: PASS rescue-ru2 (31 checks)
OK   tests/basin-walk.mjs :: PASS basin-walk: lake and fall pool masks (9341 lake samples all unwalkable)
OK   tests/surface-table.mjs :: surface-table: ok
OK   tests/slope-a2.mjs :: PASS slope-a2: grade, roll back, side slide and steer refusal for slope:true classes; others unchanged
OK   tests/atv-import.mjs :: ATV import: PASS (class numbers, 39,295-tri model with 4 wheels = 5 draw calls, hull 1.22 x 2.07, 17 anchors with the 3 moves, paint, price, slot, tracks, sound, lamps)
OK   tests/atv-rider.mjs :: ATV rider: PASS (seat anchor from anchor_driver_seat, no passenger seat, steer cap .52 rad, hands turn about the handlebar pivot and stay in reach, jiggle bounded)
OK   tests/damage.mjs :: PASS damage.mjs: ...
OK   tests/garage.mjs :: Garage: ...
OK   tests/minimap-local.mjs :: PASS minimap-local: 200x200 local window, 150 m on foot, speed zoom + look-ahead, no clamp at the world edge, dashed border, route culling, chevrons, invalidateAt
OK   tests/gps.mjs :: PASS gps.mjs: routes with left/right/arrive turns, direct fallback, pins, job auto-route and switch, reroute cooldown, arrival; Oak Street to the P3 lane is 497 m with 1 turn(s), built in 6.0 ms
OK   tests/weld-core.mjs :: Weld score, coverage, dwell, speed, drift, seeded shake, brace reach, lift and path tests passed.
SUMMARY: 24 passed, 0 failed (out of 24)
```

## What Could NOT Be Verified
- **Visual / in-browser state & real-GPU FPS**: no browser or dev server was run (all visual/feel items are listed in `notes/map-status.md` section 2).
- **Packaged-release tests** (`damage-game.mjs`, `garage-game.mjs`, `gps-game.mjs`, `startup.mjs`, etc.): skipped because `dist/releases/0.35.22` is live/being touched by parallel lanes (`npm run release` and `npm test` forbidden by prompt).
- **User-side assets outside `dist/`**: did not check whether the user has already downloaded Kenney City Kit (Commercial) (I0) or started Blender models for P3..P5 in `assets-src/`.

## Honest Confidence Per Phase
- **P0 (X0, I1, I2, BZ1)**: **High** — directly verified in `carry.js`, `map-definition.js`, and tests (caught that BZ1 moved interior origins to `z:1500` but did NOT move the Ridgeline office off Eastbank I5).
- **P1 (F0..F3, RU6)**: **High** — `streaming-brief.md`, `chunks.js`, `MAP.world`, `chunks.mjs`, and `perf-gate.mjs` all verified and passing.
- **P2 (W1..W3, R1..R4, RU1..RU2, A1..A2)**: **High** — all 11 stages verified against files, outbox reports, and live Node test runs (including exact partial gaps on RU2 edge trees, A1 SAND/FORD, and A2 part 2 drift/slip).
- **P3 (I3..I11)**: **High** — verified `alder` bounds, C1..C10 only, Alder Ave sidewalk gap `z -60..-80.7`, and absence of `downtown*`/`hotel*` modules and `hotel` room in `relay-protocol.js`.
- **P4 (B1..B3, B7, A3..A7, BZ6, BZ2, BZ3)**: **High** — verified A4/A5 done + passing, A6/A7 partial, and absence of Blackstone lake/falls/camps, Eden Outdoors, and Kaspian Bay buildings.
- **P5 (E-I1..E-I7, WJ, BZ4..BZ5, BZ7, R6, R7)**: **High** — verified `weld-core`/`weld-lab` standalone only, `farm` zone unexpanded, `R6` partial (local minimap + GPS done, full-world large map not done), and `FUEL_STATIONS` still single-station.
- **P6 (R5, RU5, B4..B5, VD1..VD5, L1..L6)**: **High** for pure modules/absence of `law.js`/fishing/hunting/insurance; **Medium-High** for VD2/VD3 runtime wiring (verified via `damage.js`/`paint-shader.js`/`handoff.md`, packaged `damage-game.mjs` not run).
- **P7 (RU3..RU4, M2..M5, VD6, L7)**: **High** — verified directly in `ownership.js` and `relay-protocol.js` (`PROTOCOL=1`, no plot/law/vehicleDamage/animal messages).
- **P8 (W4..W6, A8, I12..I13, VD3b, VD7)**: **High** — verified `water-chunks.js` plain material, `dents-finding.md` (VD3b dropped), and `damage.js` VD7a tuning block.
