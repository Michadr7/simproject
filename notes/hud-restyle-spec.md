# HUD Restyle Wiring Spec (Speedometer Card + GPS Card)

Targets the `slop-newyork` style (`notes/ui-look-references.md`, mockups in `assets-src/hud-mock/`).

## 1. Markup & CSS Changes (Applied)
All existing `id` and `class` hooks remain intact so existing tests and `game.js` continue working unchanged until the JS hooks below are wired.

- **`dist/index.html` line 1 (`#vehiclePanel`)**: added `#vpSpeedBar > #vpSpeedFill`, `#vpFuelBar > #vpFuelFill`, and `#vpDmgBar > #vpDmgFill` (all `hidden` by default).
- **`dist/index.html` line 58 (`#minimap`)**: wrapped `<canvas id="minimap">` in `#minimapDock.gps-dock` with `#streetChips` (`#chipStreet`, `#chipCross`) above `#minimapCard.gps-card` (`#minimapNorth` `"N"`, `#minimapKey` `"M"`, `#minimapScale > #minimapScaleText`).
- **`dist/style.css` lines 453–478**: dark translucent rounded card (`.vehicle-panel` `border-radius: 16px`, `rgba(18,19,22,.72)`, `backdrop-filter: blur(22px) saturate(170%)`), 32 px tabular `#vpSpeed`, `.vp-bar` / `.vp-mini-bar` (`normal` / `amber` / `red` / `ok` bands), `.gps-dock`, `.street-sign` (`#0b6a46` with inset white outline), `.gps-card` (`border-radius: 18px`, `.walk` `50%` round mode), `.gps-north`, `.gps-key`, `.gps-scale`, and `@media(max-width:600px)` scaling.

## 2. Pure Module (`dist/hud-cards.js` + `tests/hud-cards.mjs`)
- `speedCard({ speedMs, topSpeedMs, engineMode, cond })` → `{ text, unit: 'MPH', fraction, band }` (`'normal' | 'amber' | 'red' | 'off'`).
- `fuelBar(fuel)` → `{ text, fraction, band }` (`'ok' | 'amber' | 'red' | 'off'`).
- `damageBar(cond)` → `{ text, fraction, band }` (`'ok' | 'amber' | 'red'`).
- `viewConeAngle(cameraYaw)` → canvas radians (`atan2(-cos(yaw), -sin(yaw))`).
- `roadDisplayName(edge)` → `edge.name` or title-cased `edge.id` (`'oak-street'` → `'Oak Street'`).
- `streetChips(x, z, edges, { maxDist: 45, crossDist: 55 })` → `{ street, cross }` from precomputed `roadGraph(MAP).edges`.

## 3. Exact JS Edit List (for main chat / Opus)

### A. `dist/vehicle-hud.js` (speed, fuel, and condition bars)
1. **Top (`lines 1-4`)**: `import {speedCard,fuelBar,damageBar} from './hud-cards.js';`
2. **`vehicleHudModel` (`lines 25-40`)**: accept `topSpeed = 29` and include `speedBar: speedCard({ speedMs: speed, topSpeedMs: topSpeed, engineMode: damage?.engine, cond: damage?.cond })`, `fuelBar: fuelBar(fuel)`, `dmgBar: damage ? damageBar(damage.cond) : null`.
3. **`createVehicleHud` (`lines 43-61`)**: cache `lastSpeedPct`, `lastSpeedBand`, `lastFuelPct`, `lastDmgPct` alongside `last` JSON key; update `#vpSpeedBar` (`hidden = model.state !== 'driving'`, `dataset.band`, `#vpSpeedFill.style.width`), `#vpFuelBar` (`hidden = !model.fuelBar || model.fuelBar.band === 'off'`), and `#vpDmgBar` (`hidden = !model.dmgBar`) **only** when their rounded integer percentage or band changes.

### B. `dist/game.js` (pass `topSpeed` + update street chips)
1. **Top (`~line 53`)**: `import {streetChips} from './hud-cards.js'; import {roadGraph} from './map-definition.js';`
2. **Setup (`~line 1403`, once at load)**: `const ROAD_EDGES = Object.values(roadGraph(MAP).edges); let lastStreet = '', lastCross = '', lastWalk = null;` (precompute once, zero per-frame array allocations).
3. **`updateWorldUI` (`line 1003`)**: pass `topSpeed: driving.active?.cls.top || 29` into `vehicleHudModel(...)`.
4. **`updateZones` (`lines 1414-1415`)**:
   - Toggle `#minimapCard.classList.toggle('walk', !driving.active)` only when `!!driving.active !== lastWalk`.
   - When `outdoors`, compute `const chips = streetChips(p.x, p.z, ROAD_EDGES);` (or throttle to the same 12 Hz tick / `Math.hypot` > 2 m moved) and touch `#streetChips`, `#chipStreet`, `#chipCross` **only** when `chips.street !== lastStreet || chips.cross !== lastCross`. Hide `#streetChips` when indoors.

### C. `dist/minimap.js` (yellow route + white arrow + street labels)
1. **Route colour (`line 44`)**: change `pass ? '#4aa8ff' : '#0b2a46'` to `pass ? '#ffc21a' : '#4a3700'` (thick yellow GPS route with dark casing).
2. **Player arrow (`line 74`)**: change `ctx.fillStyle = '#fff6c8'` to `'#ffffff'` and `ctx.strokeStyle = '#0a1118'`.
3. **Street labels (`line 40`)**: draw `roadDisplayName(edge)` along visible `MAP.roads.edges` midpoints in `#dce4ec8f` (`8px` bold Arial) inside `drawGround(ctx)` (already throttled to 12 fps).
4. **View cone (`lines 70-71`)**: keep `viewConeAngle(yaw)` (already `Math.atan2(-Math.cos(yaw), -Math.sin(yaw))` ± `0.5` rad, drawn at 12 fps).

## 4. Frame-Cost & Allocation Rules
- **Zero per-frame allocations**: `ROAD_EDGES` is built once at startup; `streetChips` scans `ROAD_EDGES` with scalar math (`distToPolySq`), returning `{ street, cross }` only on change (or gated behind 2 m movement / 12 Hz).
- **Dirty-checked DOM**: `createVehicleHud` and `updateZones` compare against cached primitives (`lastStreet`, `lastCross`, `lastSpeedPct`, `lastSpeedBand`) before writing `.textContent`, `.hidden`, `.dataset.band`, or `.style.width`.
- **Map redraw rate**: `minimap.js` keeps its existing `12 fps` (`1/12` s) canvas redraw cadence and `map-bake.js` 3 ms slice budget.
