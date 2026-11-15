michadr.

# Stage FV3: Hitch and Tow Pure Rules

Build of stage FV3 (pure rules only) per `notes/farm-vehicles-design.md` lines 53-102 and stage table line 202, following plan `notes/eval/fv3-plan.md`.

## Files Created / Changed
- `dist/hitch-rules.js` (270 lines) — NEW pure module (zero imports, no DOM/Three.js) implementing towing constants, hitch availability predicate, exact single-axle tractrix model with zero-displacement guard, articulation angle wrapping to $(-\pi, \pi]$, jackknife forward clamping without sign flip, reverse stop at limit with event `'jackknife'`, exponential reverse assist decay, tow load computation, pure derated top/accel multipliers for tractors, combination collision bisection over 7 halvings with injected `isBlocked` callback, and `simulateTowPath` simulation helper.
- `dist/farm-beds.js` (65 lines) — NEW pure module (zero imports) defining `FARM_BEDS` (`tow_tank` liquid bed with 1,000,000 mgal capacity at $y=1.82$, `grain_cart` bulk bed with 4,000 bu10 capacity, `combine` bulk bed with 1,500 bu10 capacity), `normalizeFarmCargo` validating `{k:'water'|'fert', mgal}` and `{k:'wheat', bu10}` while strictly refusing logs and planks, and `loadFraction` returning 0..1 fill share.
- `tests/hitch-rules.mjs` (280 lines) — NEW test suite covering all constants, `pinWorldPos` at various headings, `hitchAvailable` boundary conditions (speed, distance, yaw diff), single-step tractrix, real multi-frequency 50 m path simulation at 30, 60, and 165 Hz demonstrating trajectory invariance within 1 cm, jackknife forward clamp without sign flip, reverse jackknife halt and event, reverse assist exponential decay (~50% in 0.9 s) with off switch, load and derate figures (JUFF with full tank derates to 5.292 m/s top and 1.296 m/s² accel), collision bisection convergence within 5 mm, and full rectangular hull clearance at $\pm 70^\circ$ for `tractor_juff` and `tractor_kidbi` with `tow_tank`.
- `tests/farm-beds.mjs` (97 lines) — NEW test suite verifying bed specs, bed capacities, liquid/bulk cargo normalization, clamping, cross-contamination rejection, strict timber (log/plank) refusal, and fill fractions.
- `PROJECT-INDEX.md` — Regenerated via `npm run index` (30,197 tokens, well under the 31,500 token ceiling).
- Packaged release `dist/releases/0.35.9/` updated via `npm run release -- --force`.

## Test Results

### 1. `node tests/hitch-rules.mjs`
```
PASS hitch-rules.mjs: constants, pinWorldPos, hitchAvailable, tractrix 165Hz convergence, jackknife clamp/stop, reverse assist decay, derate numbers, collision bisection, and 70 deg hull clearance passed.
```

### 2. `node tests/farm-beds.mjs`
```
PASS farm-beds.mjs: BEDS entries (tow_tank, grain_cart, combine), liquid/bulk normalization, loadFraction, and timber rejection passed.
```

### 3. `npm run index`
```
brief 2996 tokens (target 3000), index 30197 tokens (target 31500); 173 modules, 13 generated, 205 tests, 26 scripts; 14 modules without a header comment
```

### 4. `npm test` (Full Suite: all 205 test files)
```
All 205 test files passed.
```

## What Could Not Be Verified
- In-game visual 3D rendering and player control of combinations (interaction keys, hitching prompts, camera pitch hook, particle spray, wheel tracks, and HUD displays) — by design, stage FV3 implements only pure mathematical and geometric rules; in-engine wiring belongs to stage FV4 (`driving.js` and `game.js`).
- Dynamic vehicle load application during live driving steps — tested as pure multipliers (`deratedTop`, `deratedAccel`) ready for callers in `driving.js` / `vehicle.js` once classes are added.

## Requests for Forbidden Files
- None. Stage FV3 was completed strictly as self-contained pure modules without modifying `dist/vehicle.js`, `dist/cargo.js`, `dist/game.js`, `dist/driving.js`, or any other shared files. (When FV4 builds, `dist/cargo.js` can import `FARM_BEDS` and `normalizeFarmCargo` from `dist/farm-beds.js`, and `dist/vehicle.js` will add the `tow_tank` class importing constants from `dist/hitch-rules.js`).

## Confidence Assessment
- `dist/hitch-rules.js`: 100% — Exact geometric formulas from `notes/farm-vehicles-design.md`, zero dependencies, clean guards against numerical singularities.
- `dist/farm-beds.js`: 100% — Follows exact `cargo.js` conventions, capacity units (mgal, bu10), and strict timber refusal.
- Test suites & convergence: 100% — Fully verified across Node and `npm test` (all 205 tests green).
