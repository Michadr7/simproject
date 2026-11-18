michadr.

Implemented the pure look-layer rules for stages **V-A**, **V-B**, and **V-C** (`notes/visual-identity-design.md`), with unit tests and no WebGL/WebGPU or DOM dependencies.

## Files created or changed
- `dist/toon-rules.js` (49 lines, created): `TOON` constants, `TOON_STRENGTH_DEFAULT/MIN/MAX`, `clampToonStrength`, `toonRamp` (3 smoothstepped bands: `0.0 -> 0.52 -> 1.0`), `toonWeight` (matte ground exempt via `roughness >= 0.94`), `toonRim` (sunlit grazing Fresnel `<= 0.14` when `dotNL > 0.15`), `toonIrradianceFactor`, and `toonGLSL()` for `RE_Direct_Physical`.
- `tests/toon-rules.mjs` (58 lines, created): monotonicity, 3-band plateaus, ground roughness exemption, rim bounds, `toonIrradianceFactor`, `toonGLSL()` constant/identifier match, and purity.
- `dist/daynight.js` (108 lines, modified): added `SKY_BANDS` (`horizonPow: 3`, `cloudMinY: 0.08`, `cloudFullY: 0.24`, `cloudScale: 2.2`, `cloudSpeed: 0.015`), `horizonMix`, `cloudFade`, and `clouds` / `cloudCover` to `MOODS`, `COLOUR_KEYS`, `NUMBER_KEYS`, and `skyAt()`.
- `tests/daynight.mjs` (149 lines, modified): added checks for `MOODS.*.clouds` and `cloudCover`, `SKY_BANDS`, `cloudFade(0.08) === 0` (preserving `uHorizon === fog`), `horizonMix`, and 1,440-minute continuity of `clouds` and `cloudCover`.
- `dist/outline-rules.js` (40 lines, created): `OUTLINE` constants (`widthChar: 0.0022`, `widthVehicle: 0.006`, `fadeStart: 28`, `fadeEnd: 45`, `vehicleMaxNearby: 2`, `vehicleMaxDist: 35`), `clampOutlineWidth`, `outlineFade`, `outlineWidthAt` (`0` on Low or disabled), and `selectOutlinedVehicles`.
- `tests/outline-rules.mjs` (55 lines, created): width clamping, `28..45 m` fade, `0` on Low/disabled, driven + 2 nearest vehicles within `35 m`, and purity.

## Tests added and results
Commands run after final edits (`npm run release -- --force` rebuilt `dist/releases/0.35.20`):

```text
> node tests/toon-rules.mjs
PASS toon-rules.mjs: 3-band monotonic ramp, matte ground exemption (roughness >= 0.94), sunlit rim <= 0.14, strength toggle, GLSL constant match, purity.

> node tests/outline-rules.mjs
PASS outline-rules.mjs: 0 on Low/disabled, 28..45 m fade, clamped widths, driven + 2 nearby vehicles within 35 m, purity.

> node tests/daynight.mjs
ground cover models not loaded ReferenceError: Image is not defined
    at makeAtlas (file:///C:/Users/Michael/AppData/Local/Temp/city-boot-XtPAwV/ground-cover-view.js:30:34)
    at Object.setAssets (file:///C:/Users/Michael/AppData/Local/Temp/city-boot-XtPAwV/ground-cover-view.js:54:31)
    at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-XtPAwV/world.js:577:45
daynight tests passed
```

Index budget check (`npm run index` + `node tests/brief.mjs`):
```text
brief 2834 tokens (target 3000), index 34069 tokens (target 34000); 226 modules, 14 generated, 280 tests, 30 scripts; 13 modules without a header comment
AssertionError [ERR_ASSERTION]: the index is 34069 tokens (budget 34000)
```
`tests/brief.mjs` failed **only** because `PROJECT-INDEX.md` is **69 tokens over** the `34000` budget (no index cap was raised or edited).

## What could NOT be verified
- Full `npm test` suite (all 280 tests) was not run.
- Visual / GPU appearance of the toon ramp, sky cloud wisps, and outlines in WebGL/TSL (stages `V-D` and `V-E` are not wired yet).

## Requested edits to shared/forbidden files
None needed for `V-A..V-C` (wiring happens in `V-D` / `V-E` or TSL after `T2`).

## Confidence
- `V-A` (`dist/toon-rules.js`, `tests/toon-rules.mjs`): High — pure math verified against `r187` `ShaderChunk.lights_physical_pars_fragment` (`RE_Direct_Physical`).
- `V-B` (`dist/daynight.js`, `tests/daynight.mjs`): High — all existing and new 1,440-minute continuity and `bootGame()` checks pass.
- `V-C` (`dist/outline-rules.js`, `tests/outline-rules.mjs`): High — pure math and vehicle selection verified by unit tests.
