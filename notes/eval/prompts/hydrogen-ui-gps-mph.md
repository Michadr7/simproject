# Hydro prompt: UI pass, GPS card + speedometer (CSS/markup/HUD files only; no game.js)

Read AGENTS.md rules first (context.md 1-45, notes/handoff.md 1-16; search PROJECT-INDEX.md, never read big files whole). You may NOT edit dist/game.js, world.js, map-definition.js, driving.js, vehicle.js, terrain.js, props-assets.js, audio.js, dist/phone*.js, scripts/build-index.mjs, notes/handoff.md. Never run git. Write files without a BOM. Another agent edits game.js: never run the full `npm test`; run only your own `node tests/<name>.mjs` plus the tests of the HUD files you touch.

Owner request (2026-11-19, see memory ui-look-references): the GPS and the MPH speedometer need another lift toward the slop-newyork look. Reference (owner screenshots, described): speedometer = dark glass card, small-caps label, big white number with a small grey unit, thin progress bar under it. GPS = dark map card with street labels, a yellow route line, a white arrow with a light view cone, a small N badge and an M badge top right, green street-name chips above it.

Do:
1. Find the current code with Grep/PROJECT-INDEX (speedometer, gps, minimap, hud-card, street chip; dist/minimap.js, dist/style.css, dist/index.html HUD section, any hud-*.js). Read only the relevant ranges.
2. Restyle the speedometer card: dark translucent glass (backdrop blur), small-caps label, large tabular-figure number, small grey unit, 3 px progress bar showing speed against the vehicle's top speed (drive the bar from an existing value; if the HUD only receives the speed number, add a pure helper dist/hud-speed.js + tests/hud-speed.mjs that maps speed to bar fraction and colours, and write the one-line game.js call as an exact edit request).
3. Restyle the GPS card: same glass language, route line yellow, arrow white with a soft view cone, N badge and M badge top right (M toggles nothing yet unless it already does; if so keep it), street chips green above the map. Keep the existing minimap data flow; only change drawing and CSS. If a canvas draw function changes, keep its tests green (tests/minimap*.mjs, find with Glob).
4. Respect `prefers-reduced-motion`, phone widths (360x780: cards shrink, never cover the road centre), and keep every existing HUD element reachable.
5. Check visually if you can (headless Edge CDP harness: notes in outbox/tutorial-polish2.md or C:\Users\Michael\AppData\Local\Temp\eden-webgpu if it exists). Screenshots at 1920x1080, 1280x720, 360x780 into notes/eval/outbox/ui-gps-mph-*.png. If you cannot render, say so; never claim it looks right unseen.

Not in scope: the talk panel clipping (separate: needs an owner answer), any rules, saves, multiplayer.

Report: notes/eval/outbox/ui-gps-mph.md, first line "michadr.". Files changed/created with line counts, real test output, what you could NOT verify, exact edit requests for forbidden files (file, line, old, new), questions for the owner, honest confidence.
