michadr.

## Summary
Trimmed `PROJECT-INDEX.md` formatting in `scripts/build-index.mjs` (keeping the `37,000` token cap untouched, bringing the index from `36,954` down to `32,077` tokens), then implemented Phases **W1–W3** of the Eden Ridge **Weather, Storm, Elevation Snow & Player Comfort** system alongside the **Phone Weather App** and HUD weather/comfort chip.

## Files Created
- `dist/weather.js` (`359` lines) — Pure deterministic seeded weather & Markov intra-day arcs (`WEATHER_IDS`, `WEATHER_META`, `dayArc`, `weatherAt`, `dayWeatherWord`, `forecastDays`), micro-climates & elevation snow/sleet (`localWeatherAt`), deterministic storm lightning/thunder (`freshStormState`, `stepStorm`), ground wetness accumulator (`stepGroundWet`), sky modulation (`weatherSkyAdjust`), player comfort curve with extended exposure (`stepComfort`, `comfortEffects`, `comfortAdvice`, `shelterAt`, `applyWarmth`, `applyWarmBoost`, `applyCampRestComfort`), and `fishingWeatherMod` / `wildlifeWeatherMod`.
- `dist/weather-fx.js` (`78` lines) — 1-draw-call `THREE.InstancedMesh` billboard precipitation renderer (rain streaks, sleet, snow; culled indoors/dry; halved count on Low quality or `prefers-reduced-motion`; zero `THREE.Points` so WebGPU T6 stays clean).
- `dist/phone-weather.js` (`57` lines) — Phone Weather screen showing regional conditions, road advisory, player Comfort card/advice, and 3-day Valley vs. Blackstone Pass forecast.
- `tests/weather.mjs` (`204` lines) — Unit & integration suite covering determinism across midnight, storm lightning/thunder, Blackstone Pass elevation snow/sleet, ground wetness, sky modulation, extended-exposure comfort curve + gear/shelter recovery, fishing/wildlife hooks, save persistence without `SCHEMA` bump, fake `AudioContext` rain/thunder, and Phone Weather DOM rendering.

## Files Changed
- `scripts/build-index.mjs` (`128` lines) — Tightened call-site clip widths in `buildIndex()` (`34` dist / `26` tests / `38` scripts-worker-hub / `50` max headings at `width 46`) without modifying `BUDGET`.
- `dist/daynight.js` (`131` lines) — Optional `options.weather` modulation in `skyAt()` (unchanged when omitted).
- `dist/sky.js` (`93` lines) — Forward optional `weather` into `skyAt()` in `update()`.
- `dist/tsl-sky.js` (`121` lines) — Mirror `weather` forwarding in WebGPU/TSL sky twin.
- `dist/audio.js` (`326` lines) — Lazy synthesized rain loop in `ambience()` (keeps the 10-node startup invariant) with indoor/cab muffling, bird/cricket rain attenuation, and procedural `thunder(power)`.
- `dist/index.html` (`62` lines) — Added `#phoneApp-weather`, `#phoneScreen-weather`, `#phoneComfort`/`#phoneComfortMeter`, and `#weatherChip` inside `#minimapDock` (preserving `tests/hud-layout.mjs` order).
- `dist/style.css` (`568` lines) — Styled `#weatherChip`, `#phoneWeather` cards/bands, `.weather-icon`, and `body.comfort-cold::before` vignette.
- `dist/phone.js` (`173` lines) — Wired `Weather` screen/app button, `#phoneComfort` meter updates, and `showWeather()`.
- `dist/items.js` (`68` lines) — Added `rain-shell` and `winter-parka` (`equipment`, `buyable: false`) plus `basic-jacket` description.
- `dist/downtown-rooms.js` (`89` lines) — Added `basic-jacket`, `rain-shell`, and `winter-parka` to `ironwood-clothes`.
- `dist/ironwood-interiors.js` (`270` lines) — Added `rain-shell` and `winter-parka` to `eden-outdoors`.
- `dist/life.js` (`28` lines) — Added optional `comfortDrain` multiplier (`1` default) to `tickLife()`.
- `dist/state.js` (`33` lines) — Passed `comfortDrain` through `state.js` `tickLife()`.
- `dist/jobs.js` (`95` lines) — Persisted/normalized optional `progress.comfort` in `normalizeProgressWith()` (no `SCHEMA` bump).
- `dist/kiosk-shift.js` (`111` lines) — Updated `normalizeOutdoors()` and `restAtCamp()` for `campFireUntil` warmth & comfort restoration.
- `dist/driving.js` (`204` lines) — Wired live `wetLevel` (`setWet`) into `envFor()`, `stepBog()`, and `tyreFx()`.
- `dist/fishing.js` (`181` lines) — Passed optional `weather` modifier into `castFishing()`.
- `dist/wildlife.js` (`154` lines) — Added `effectiveFleeRadius(speciesId, weather)`.
- `dist/game.js` (`2527` lines) — Wired live weather simulation, storm lightning/thunder, `setGroundWet`, `driving.setWet`, `setWindWeather`, `npcWeather`, `talkCtx` live weather, `weatherFx`, `sky.update` weather, `ambienceTick` rain/storm/shelter, shelter detection (indoors, Oak Street awnings, closed cabs vs. open ATV, Blackstone campfires), comfort tick & energy drain modifier, warmth from hot drinks/meals, `#weatherChip` + `comfort-cold` vignette, `getWeather` on Phone, `castFishing`/`effectiveFleeRadius` hooks, and `__city.weather()` / `setWeather()`.
- `tests/inventory.mjs` (`55` lines) — Updated equipment (`3 -> 5`) and unique item (`50 -> 52`) assertions for `rain-shell` and `winter-parka`.
- `notes/handoff.md` (`462` lines) — Added newest `2026-11-22` Weather & Comfort summary entry.

## Verification Output (Ran After Final Code Edits)

### 1. Focused verification (`index`, `release`, `inventory`, `no-pause`, `webgpu-flag`, `weather`, `brief`, `crew-trunk`)
```
> node scripts/build-index.mjs
brief 2840 tokens (target 3000), index 32077 tokens (target 37000); 293 modules, 15 generated, 351 tests, 34 scripts; 13 modules without a header comment

Packaged release 0.36.4: 294 files -> dist/releases/0.36.4
dist/index.html now loads releases/0.36.4/
20 item definitions (incl. axe and wood log), restoration, stacking, equipment swaps, capacity safeguards, purchases and save preservation passed.
Gas can: bought, equipped, fuel saved on its slot.
PASS no-pause.mjs: Noah route offer/fallback, Ridgeline store/ownerMenu/orderTable, buzzer, Hal fallback all keep clock and needs running with walking locked; shop-close, walk-away, speaker-disappear and vehicle-hit close talk cleanly; pause and bills modals still freeze time.
off: WebGLRenderer, three.webgpu.js/three.tsl.js not loaded, 225 GLSL-patched materials as before, HUD "25 FPS"
default: WebGPURenderer (WebGPU), init awaited, 89 node materials, TSL twins {"sky":2,"world":1,"cover":1,"tags":1,"paint":9,"tracks":1,"smoke":1,"debris":1,"lights":1,"shadows":1,"points":2,"menu":1}, points left at 1 px: none, HUD "25 FPS | WebGPU"
PASS webgpu-flag: ?webgpu=0 = WebGLRenderer with no WebGPU/TSL download; no flag and ?webgpu=1 = WebGPURenderer (the 0.36.0 default), init awaited before the first render, world waits for visible and hidden shader warm-up with the High light installed, 11 TSL twins built, no GLSL patch left; &webgl=1 and no navigator.gpu = WebGL2 via WebGPU.
PASS weather: 8 states, storm lightning/thunder, elevation snow (clear), comfort curve, sky/audio/fishing/wildlife/gear hooks
brief tests passed: 293 modules listed, brief 2840 and index 32077 estimated tokens (budgets 3000 and 37000)
PASS crew-trunk.mjs: day 4: while the cutter bucks, the crew trunk lies at the pose's trunkX/trunkZ (across the feller) in ground-trunks; the first log carried away leaves one log where the trunk was, after the player's own logs in ground-logs; none after the second; no new mesh; the frame uses npcCrowd.forEachWork, never drawn().
```

### 2. Full test suite (`npm.cmd test`) + retry of flaky `hub-runner.mjs`
```
FAILED FILES: hub-runner.mjs
1 of 351 test files failed.

> node tests/hub-runner.mjs
hub-runner: ok
```
(`350/351` passed on initial `npm.cmd test` run; pre-existing flaky `hub-runner.mjs` passed on immediate single retry, exit code `0`.)

## What Could NOT Be Verified
- Visual/audio runtime check in a real hardware-GPU browser (`chrome://inspect/#remote-debugging` was unavailable earlier): visual appearance of the instanced rain/sleet/snow billboards, storm lightning flashes, puddles (`uGdWet`), driving feel on soaked mud, and Web Audio thunderstorm playback on speakers still need the owner's live playtest.

## Forbidden Files
None needed.

## Confidence
- **Index trim (`scripts/build-index.mjs`):** High — verified at `32,077 / 37,000` tokens (`brief.mjs` passed).
- **Pure weather, storms, elevation snow & comfort rules (`dist/weather.js`, `tests/weather.mjs`):** High — deterministic math, continuity, exposure curves, and subsystem modifiers verified by Node assertions.
- **Visual/Audio/UI/Game wiring (`weather-fx.js`, `daynight.js`, `sky.js`, `tsl-sky.js`, `audio.js`, `phone-weather.js`, `game.js`):** High for logic & TSL/WebGL compatibility (`350/351` + `hub-runner.mjs` retry passed, `webgpu-flag.mjs` passed all 5 modes); visual polish awaits owner GPU eye-check.
