michadr.

## Summary
Restyled the GPS card and MPH speedometer toward the `slop-newyork` look using CSS, HUD markup, `dist/vehicle-hud.js`, and `dist/minimap.js` (no forbidden files edited; `dist/game.js` already passes `topSpeed: driving.active?.cls?.top || 29` into `vehicleHudModel` at line 1050 and `dist/hud-cards.js` already provides `speedCard`, so no extra `dist/hud-speed.js` or `game.js` edit was needed).

## Files Created or Changed
- `dist/index.html` (62 lines, modified, no BOM): updated `#vehiclePanel > .vp-stats` markup to add `.vp-speed-cell` with `.vp-speed-readout` (`<b id="vpSpeed">—</b><span class="vp-unit" id="vpSpeedUnit" hidden>MPH</span>`) above `#vpSpeedBar`, and `.vp-fuel-cell` with `.vp-fuel-row` above `#vpFuelBar`. Preserved every existing ID.
- `dist/style.css` (538 lines, modified, no BOM):
  - Speedometer card (`.vehicle-panel`): removed `--comb` honeycomb pattern (`background-image: none`), kept dark translucent glass (`rgba(18,19,22,.72)`, `backdrop-filter: blur(22px) saturate(170%)`), muted small-caps label (`#vpName`), single-column driving `.vp-stats` hero readout with big white tabular numeral (`#vpSpeed`, `38px` desktop / `32px` at `<=760px` / `26px` at `<=680px` & `<=600px`), small muted grey `MPH` unit (`#vpSpeedUnit`), `3px` rounded `#vpSpeedBar` & `.vp-mini-bar`, and single-line `.vp-fuel-row`.
  - GPS card (`.gps-card`, `.gps-north`, `.gps-key`): matched dark glass look (`rgba(14,17,22,.76)`, `backdrop-filter` scoped via `.gps-card:not(:has(#minimap.large))` so fixed `#minimap.large` centering is never trapped), moved `#minimapNorth` (`N`) to top right next to `#minimapKey` (`M`) (`top: 7px; right: 29px` and `top: 7px; right: 7px`), kept green `.street-sign` chips above the map.
  - Phone (`360x780`, `@media(max-width:600px)`): shrunk `--hud-col-w` to `156px`, `--hud-right` to `10px`, `--hud-map-size` to `132px`, added `min-width: 0` / `grid-template-columns: minmax(0,1fr)`, and narrowed `#objective` (`left: 10px; width: 164px; padding: 12px`) so left (`x=10..174`) and right (`x=194..350`) HUD columns stay 20 px apart and clear of the `x=180` road centre with zero horizontal overflow. Preserved `@media(prefers-reduced-motion:reduce)`.
- `dist/vehicle-hud.js` (71 lines, modified, no BOM): added `speedBar` to `forkliftHudModel` (`topSpeedMs: 5`) and updated `createVehicleHud` so when `#vpSpeedUnit` exists in the DOM it splits `'43 mph'` into `#vpSpeed = '43'` and `#vpSpeedUnit = 'MPH'` (hiding `#vpSpeedUnit` for `'—'`), while keeping `model.speed` and the fallback `#vpSpeed.textContent = model.speed` intact for existing unit tests.
- `dist/minimap.js` (96 lines, modified, no BOM): imported `viewConeAngle` from `dist/hud-cards.js`; darkened `EDGE` (`#0d1117`), large-map base (`#131920`), and added a subtle dark radar wash (`rgba(10,14,20,.22)`); rotated road labels along edge segments with dark halos and safe-margin / badge-corner clipping (plus zone-label margin clipping); refined yellow route casing (`rgba(18,14,4,.86)`); replaced the solid yellow wedge with a soft white radial-gradient view cone (`rgba(255,255,255,.38)` fading to `0`, with solid fallback for mock contexts) under the crisp white player arrow.
- `tests/hud-layout.mjs` (154 lines, modified, no BOM): added `'vpSpeedUnit'` to `REQUIRED_IDS`, checks for glass `.vehicle-panel` without honeycomb, `3px` `.vp-bar`, top-right `N`/`M` badges, `a.x0 > vp.w / 2` on `360x780`, and `#objective` clearing `#vitals` and road centre (`174 < 194`, `174 < 180`).
- `tests/vehicle-hud.mjs` (49 lines, modified, no BOM): added assertions for the split `#vpSpeed` + `#vpSpeedUnit` + `#vpSpeedBar` DOM update path.
- `PROJECT-INDEX.md` and `PROJECT-BRIEF.md` (regenerated via `npm run index`).
- Headless Edge visual previews:
  - `notes/eval/outbox/ui-gps-mph-1920x1080.png`
  - `notes/eval/outbox/ui-gps-mph-1280x720.png`
  - `notes/eval/outbox/ui-gps-mph-360x780.png`

## Headless Edge Render Measurements (Standalone Preview Harness)
Rendered a standalone preview loading `dist/style.css`, `dist/vehicle-hud.js`, and `dist/minimap.js` (with synthetic `MAP.roads.rects` / `MAP.buildings` base canvas) in headless Edge (`deviceScaleFactor: 1`):
- `1920x1080`: `docScrollW: 1920`, `#streetChips` `y=78..96`, `#minimapCard` `y=101..303` (`202x202`), `#clockChip` `y=308..332`, `#vehiclePanel` `x=1654..1886, y=340..609` (`vpSpeed` `38px` + `vpSpeedUnit` `11px` inline, `vpSpeedBar` `3px`), `#vitals` `y=617..697` (clears `footer` at `1031`).
- `1280x720`: `docScrollW: 1280`, `#streetChips` `y=76..94`, `#minimapCard` `y=98..272` (`174x174`), `#clockChip` `y=276..300`, `#vehiclePanel` `x=1014..1246, y=306..555` (`vpSpeed` `32px` + `vpSpeedUnit` `11px` inline, `vpSpeedBar` `3px`), `#vitals` `y=561..633` (clears `footer` at `671`).
- `360x780`: `docScrollW: 360`, `#streetChips` `x=219..350, y=62..78`, `#minimapCard` `x=216..350, y=82..216` (`134x134`), `#clockChip` `x=241..350, y=220..244`, `#vehiclePanel` `x=194..350, y=249..466` (`156px` wide, `vpSpeedBar` `204..340` `3px` inside panel), `#vitals` `x=194..350, y=471..539`, `#objective` `x=10..174, y=538..718` (`164px` wide). Left and right HUD columns stay 20 px apart and strictly clear of `x=180` (road centre).

## Tests & Commands Run
```text
> npm run index
brief 2834 tokens (target 3000), index 35069 tokens (target 37000); 263 modules, 14 generated, 321 tests, 32 scripts; 13 modules without a header comment

> node tests/brief.mjs
brief tests passed: 263 modules listed, brief 2834 and index 35069 estimated tokens (budgets 3000 and 37000)

> node tests/hud-cards.mjs
PASS hud-cards.mjs: speed text/bar/bands, fuel/damage bars, view cone angle, street chips from MAP.roads, purity.

> node tests/hud-layout.mjs
PASS hud-layout.mjs: right-column DOM order, all required JS IDs, large-map centering, safe-area & reduced-motion rules, and zero box overlaps at 1920x1080, 1280x720, 1024x600, and 360x780.

> node tests/vehicle-hud.mjs
Vehicle panel: greyed out on foot; driving shows the name, speed in mph, the fuel type and gallons, and Get out, or Stop to get out while moving (1 m/s); riding shows Get out; the DOM is written only when the model changes.

> node tests/minimap-local.mjs
PASS minimap-local: 200x200 local window, 150 m on foot, speed zoom + look-ahead, no clamp at the world edge, dashed border, route culling, chevrons, invalidateAt

> node tests/forklift.mjs
PASS forklift.mjs: arcade drive (2.6 m/s, 5 m/s with Shift easing back down when released, rear-wheel steering with the tail swinging out, wheels that roll, slower in reverse, under 4.8 m turning circle, no spinning on the spot, stops at walls), forks 0.08 to 3.05 m reaching all three levels, an old save with a fork load becoming a pallet, the converted 14,000-triangle model with its four wheels on their axles, and the vehicle panel in forklift mode.

> node tests/damage-feel.mjs
PASS damage-feel.mjs: hit-stop of 50 to 90 ms from 60 points, exactly the same skipped vehicle time at 20 to 240 slices a second and the same distance covered over a stop at 30, 60 and 144 Hz (the clock never pauses), red flash strength, a lamp that is off, steady or blinking by band (icon + blink, class and dataset written on change only), a panel pulse that is a class on a crash and nothing else, a stronger shake (0.03 to 0.18 m for 0.4 s), one 220-point debris pool (chips, sparks, glass, wheel spray) that is bounded and clears, bigger drifting smoke in one pool, and every page and game hook.

> node tests/damage-game.mjs
Damage wiring: a crash at 24 m/s takes 600 points once (Fine to Worn) and stalls; a 3 m/s bump costs nothing; a 15 m/s crash is 251 points and stalls (restart after 1 s); the pull has the right side and grows by band; burn 1.05/1.15/1.3x; a wreck never starts but can be left; cond saves and old saves load Fine; the panel row changes the band class only when the band changes; one silhouette per drivable model.

> node tests/gps.mjs
PASS gps.mjs: routes with left/right/arrive turns, direct fallback, pins, job auto-route and switch, reroute cooldown, arrival; Oak Street to the P3 lane is 497 m with 1 turn(s), built in 4.3 ms

> node tests/night-lights.mjs
night lights tests passed
```

## Exact Edit Requests for Forbidden Files
None. (`dist/game.js` line 1050 already passes `topSpeed: driving.active?.cls?.top || 29` to `vehicleHudModel`, and line 1480 already updates `#streetChips`, `#chipStreet`, and `#chipCross`.)

## What Could Not Be Verified
- `npm run release -- --force` and the full `npm test` suite (including packaged-release tests such as `tests/startup.mjs`) were not run because another agent is active on `dist/game.js`.
- Live 3D in-game rendering over the WebGPU scene (`npm run dev`), live `M` large-map toggle transitions in-browser, and interactive `prefers-reduced-motion` toggle in a user session were not run (only the standalone Edge HUD preview and Node unit/layout tests).

## Questions for the Owner
- None (owner answered: `#objective` narrowed to `164px` at `left: 10px` on `<=600px`, and `#minimapKey` `M` kept taxi yellow `#ffc21a` beside the dark glass `N` badge).

## Confidence
- Speedometer & GPS CSS/markup (`dist/index.html`, `dist/style.css`) and `360x780`–`1920x1080` non-overflowing right column: **High** (verified by `tests/hud-layout.mjs`, Edge bounding-box metrics, and visual inspection of all 3 PNGs).
- `dist/vehicle-hud.js` split readout and `dist/minimap.js` canvas drawing (rotated haloed labels, yellow route, soft white radial view cone, white arrow): **High** (verified by `tests/vehicle-hud.mjs`, `tests/minimap-local.mjs`, and the Edge canvas renders).
- Packaged release & live in-game WebGPU integration: **Medium** (deferred `npm run release -- --force` and full `npm test` until `game.js` work finishes).
