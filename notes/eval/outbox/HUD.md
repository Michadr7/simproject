michadr.

## Reference inspection (`slop-newyork`)
Fetched `https://mrdoob.github.io/slop-newyork/` and its stylesheet (`css/style.css?v=20261022-repo-link`) directly:
- **Panel surface (`.panel`)**: `rgba(18, 19, 22, 0.62)`, `backdrop-filter: blur(22px) saturate(170%)`, `border: 1px solid rgba(255, 255, 255, 0.09)`, `border-radius: 16px`, `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 18px 40px -18px rgba(0,0,0,0.7)`.
- **Speedometer (`.cluster`)**: `272px` wide; `.gauge-label` `10.5px` uppercase `letter-spacing: 0.1em` `rgba(246, 245, 242, 0.44)`; `#hud-speed` `42px` `font-weight: 600` `line-height: 1` `letter-spacing: -0.035em` `tabular-nums`; `.gauge-unit` `12px` uppercase; `.gauge-meter` `4px` tall, `border-radius: 4px`, `rgba(255,255,255,0.1)` track.
- **GPS / Radar (`.radar`)**: `288px × 184px`, `border-radius: 18px`, `#0a1118` background; `.radar-north` `17px` circle top-center (`9px` bold `"N"`); `.radar-key` top-right badge (`#ffc21a` taxi yellow, `#17140a` ink).
- **Street-sign chips (`.street-sign`)**: `padding: 9px 13px 7px`, `15px` bold white, `#0b6a46` green with top highlight gradient, `border-radius: 6px`, `outline: 1.5px solid rgba(255,255,255,0.92)` (`outline-offset: -4px`).

## Part 1: What exists today
| Element / Data | File & Line | What it shows | How it updates |
|---|---|---|---|
| `#vehiclePanel`, `#vpName` | `dist/index.html:1`, `dist/vehicle-hud.js:48-53` | Vehicle name & state (`off`/`driving`/`riding`) | `game.js:1003` `updateWorldUI` → `createVehicleHud` (JSON-key dirty check) |
| `#vpSpeed` | `dist/index.html:1`, `dist/vehicle-hud.js:30,53` | Speed in `mph` (`mph(speed)` from `dist/fuel.js`) | Same `createVehicleHud` dirty-checked update |
| `#vpFuelLabel`, `#vpFuel` | `dist/index.html:1`, `dist/vehicle-hud.js:27,53` | Fuel type + `fuelText` (or Forklift height/load) | Same `createVehicleHud` dirty-checked update |
| `#vpDamage`, `#vpLamp`, `#vpDmgText` | `dist/index.html:1`, `dist/vehicle-hud.js:20,50` | SVG silhouette, engine lamp, condition band & `%` | Same `createVehicleHud` dirty-checked update |
| `#vpGps`, `#vpGpsArrow`, `#vpGpsText` | `dist/index.html:1`, `dist/vehicle-hud.js:51`, `dist/gps.js:76-83` | Next turn arrow + distance (`10 m` rounded) | Same `createVehicleHud` dirty-checked update |
| `#minimap` | `dist/index.html:58`, `dist/minimap.js:14-86`, `dist/map-view.js`, `dist/map-bake.js` | `200×200` north-up local window (`150..400 m`), `600×490` on `KeyM`; `#4aa8ff` route, `#fff6c8` arrow, `#ffffff22` cone | `game.js:1414` `minimap.update(dt, ...)` smooths every frame, redraws canvas at `12 fps` |
| `#gpsMap`, `#gpsStatus`, `#gpsAuto`, `#gpsClear` | `dist/index.html:50`, `dist/phone-gps.js:4-18` | Phone GPS screen (`startSize: 'large'`, tap-to-pin, auto-route toggle, clear) | `game.js:1415` `phone.gpsUpdate(...)` at `12 fps` while phone open |
| `MAP.roads.edges`, `MAP.zones`, `MAP.signs` | `dist/map-definition.js` | 29 road edges (7 with `.name`, 22 kebab-case `.id` e.g. `oak-street`, `alder-avenue`, `county-road`), 8 zones | Static map data; `gps.js` routes over `roadGraph(MAP)` |

## Part 2 & 3: Files created or changed
- `assets-src/hud-mock/speedometer.html` (291 lines, created) + `assets-src/hud-mock/speedometer.png` (322,316 bytes): parked, 25 mph, near top speed (amber), top limit (red), engine off, with fuel & condition bars.
- `assets-src/hud-mock/gps.html` (322 lines, created) + `assets-src/hud-mock/gps.png` (215,714 bytes): 288×184 driving GPS card with green street-sign chips, yellow route, white arrow + view cone, N/M/scale badges, and 148×148 walking round variant.
- `assets-src/hud-mock/combined.html` (276 lines, created) + `assets-src/hud-mock/combined.png` (605,015 bytes): combined 1280×720 desktop & 390×720 narrow mobile preview.
- `dist/hud-cards.js` (61 lines, created): pure `speedCard`, `fuelBar`, `damageBar`, `viewConeAngle`, `roadDisplayName`, `streetChips`.
- `tests/hud-cards.mjs` (42 lines, created): unit + purity tests.
- `dist/index.html` (64 lines, modified): added `#vpSpeedBar`, `#vpFuelBar`, `#vpDmgBar`, and `#minimapDock` / `#streetChips` / `#minimapCard` / `#minimapNorth` / `#minimapKey` / `#minimapScale` while keeping all existing IDs intact.
- `dist/style.css` (478 lines, modified): added HUD restyle CSS at lines 453–478.
- `notes/hud-restyle-spec.md` (45 lines, created): full wiring spec & frame-cost rules.

## Test results
```text
> node tests/hud-cards.mjs
PASS hud-cards.mjs: speed text/bar/bands, fuel/damage bars, view cone angle, street chips from MAP.roads, purity.

> node tests/vehicle-hud.mjs
Vehicle panel: greyed out on foot; driving shows the name, speed in mph, the fuel type and gallons, and Get out, or Stop to get out while moving (1 m/s); riding shows Get out; the DOM is written only when the model changes.

> node tests/minimap-local.mjs
PASS minimap-local: 200x200 local window, 150 m on foot, speed zoom + look-ahead, no clamp at the world edge, dashed border, route culling, chevrons, invalidateAt

> node tests/startup.mjs
Fresh save: creator, phone apps/controls/gigs, and multiplayer frame checks passed.
Existing save: gameplay, phone apps/controls/gigs, and multiplayer frame checks passed.
```

Index budget (`npm run index` + `node tests/brief.mjs`):
```text
brief 2834 tokens (target 3000), index 34138 tokens (target 34000); 227 modules, 14 generated, 279 tests, 30 scripts; 13 modules without a header comment
AssertionError [ERR_ASSERTION]: the index is 34138 tokens (budget 34000)
```
`tests/brief.mjs` failed **only** because `PROJECT-INDEX.md` is **138 tokens over** the `34000` budget (no cap raised or edited).

## Exact forbidden-file / JS edit list (in `notes/hud-restyle-spec.md`)
1. `dist/vehicle-hud.js` (`lines 1-4, 25-61`): import `speedCard, fuelBar, damageBar` from `./hud-cards.js`; pass `topSpeed` into `vehicleHudModel`; dirty-check and update `#vpSpeedBar`, `#vpFuelBar`, `#vpDmgBar`.
2. `dist/game.js` (`~line 53, 1003, 1403, 1414-1415`): precompute `ROAD_EDGES = Object.values(roadGraph(MAP).edges)` once; pass `topSpeed: driving.active?.cls.top || 29` to `vehicleHudModel`; toggle `#minimapCard.walk` and dirty-checked `#streetChips` / `#chipStreet` / `#chipCross` in `updateZones`.
3. `dist/minimap.js` (`lines 40, 44, 74`): yellow route `#ffc21a` / `#4a3700`, white player arrow `#ffffff` / `#0a1118`, street labels in `drawGround` (12 fps).

## What could NOT be verified
- Full `npm test` (279 tests) was not run.
- Live in-game visual appearance of `index.html`/`style.css` changes in `npm run dev` (the JS wiring in `game.js`/`vehicle-hud.js`/`minimap.js` is deferred to the edit list above).

## Confidence
- Part 1 & `slop-newyork` reference measurements: High (directly inspected live CSS/HTML and local files).
- Part 2 mockups & PNG screenshots: High (rendered and captured via headless Edge).
- Part 3 `dist/hud-cards.js`, `dist/index.html`, `dist/style.css`, and `notes/hud-restyle-spec.md`: High (`hud-cards`, `vehicle-hud`, `minimap-local`, and `startup` all pass after `release -- --force`).
