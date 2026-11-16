michadr.

# GP1 GPS: report

State: done as a coherent stage. `npm run release -- --force` then `npm test`: **All 213 test files passed** (2 new: tests/gps.mjs, tests/gps-game.mjs). Index 30,728 of 31,500 tokens (brief 2,996). Nothing seen in a browser. No git. No BOM. notes/handoff.md not touched.

## Built
- **dist/gps.js (new, pure, ~125 lines)**: `buildRoute(from,to)` (snaps both ends to roads, tries the 4 end-node pairs of the two road legs and keeps the fastest, so a route starts and ends on the right piece of road instead of at a far node; returns polyline, cumulative metres, turns left/right/uturn/arrive read from the heading 18 m before and after each junction, `direct` straight-line fallback when no road joins), `routeProgress`, `hudRow`, `fmtDist`, `snapPin`, and `createGps()` state machine: one destination (a pin wins over the job), job auto-route with an on/off switch, Clear, arrival within 25 m, off-route above 40 m shows "Rerouting..." and rebuilds after a 4 s cooldown.
- **dist/minimap.js (edited, additive)**: options `startSize`, `fixedDpr`; `update` takes `route` and `pin` (blue line with dark casing from your place onward, red pin); new `pick(clientX,clientY)` returns a world point.
- **dist/phone-gps.js (new)** and **dist/phone.js (edited)**: a GPS app (icon button, screen with a second map, status line, "Job routes: on/off", "Clear route"). Tap the map = drop one pin, snapped to the nearest road (a refused tap says "No road near there.").
- **dist/index.html, dist/style.css (edited)**: GPS app button, `#phoneScreen-gps`, `#vpGps` row in the vehicle panel, small CSS appended.
- **dist/vehicle-hud.js (edited)**: optional `gps` row in `vehicleHudModel` (driving only) and the writer for `#vpGps`.
- **dist/game.js (edited, minimal, 5 spots)**: import; `const gps=createGps()` before `updateZones`; in `updateZones` one line feeds the job target (the gold gig marker position while a job is active) and your position, toast "You have arrived."; `route`/`pin` passed to `minimap.update`; `phone.gpsUpdate` while the phone is open; `gps:` row passed to `vehicleHudModel`; `gps:{...}` passed to `createPhone`.

## Tests
- tests/gps.mjs PASS: left/right turn directions on a synthetic crossroads, straight through, reverse direction, start joined to road, direct fallback, progress, HUD text, pins (snap, refuse), controller (pin over job, switch, Clear, arrival once, reroute cooldown), real map: Oak Street to the P3 lane node is 497 m with 1 turn, built in 4.5 ms; whole map east-west route over 1,300 m.
- tests/gps-game.mjs PASS in the packaged game: GPS app opens, tap drops a pin, second tap replaces it, off-map tap does nothing, job switch toggles, in the S70 the panel shows "Turn right in 40 m . 160 m to go", Clear removes the row.
- Pins moved: none. No existing test changed.

## Frame-rate numbers
- Route build: 4.5 ms (cold, real map) on a pin tap, job start, or a reroute (max once per 4 s while off route). Not per frame.
- Per frame: `routeProgress` is a windowed scan of a few hundred points, microseconds; `gps.hud` and `gps.ahead` allocate one tiny object each frame (the vehicle panel already stringifies its model each frame). Route stroke on the minimap at its existing 12 fps: about 2 strokes of a few hundred points.
- First open of the phone GPS screen builds a second map layer (600x490 at dpr 1, about 0.3 M pixels). It is the same drawing as the first press of M; I could not time it in a browser. Expect a one-off hitch of up to about a second. After that only the 12 fps redraw while the screen is open.

## DECISIONS TO CONFIRM
1. Pin by tapping the **phone GPS screen's map** (own map copy), not the corner map (the corner map ignores the mouse).
2. A "started job" = the active gig with a visible gold marker; deliveries and objective beacons (tree marks, etc.) do not auto-route.
3. Pin and job-route state is **not saved** (session only); the Auto switch resets to on at each load.
4. Arrival = 25 m straight line to the target. A target far from any road ends the drawn route with a straight link from the road; the arrival toast fires only when you are within 25 m.
5. `PIN_MAX_SNAP` 150 m. Every spot in the current map view is within 130 m of a road, so in practice a tap is never refused; the cap only matters if the map grows.
6. Routing treats every road as two-way, and the vehicle row appears for the driver only (not the passenger seat or forklift).

## Eye-check list
1. Phone: new GPS icon in the app grid (9 apps, hex style); opens a map, tap drops a red pin on a road, Clear and Job routes buttons fit the phone width; the map is not blurry or stretched (CSS forces width 100%).
2. First open: how long the GPS map takes to appear.
3. Blue route line on the corner map and the big map (M): visible over roads, shrinks behind you as you drive, ends at the pin; pin drawn at the right place.
4. Vehicle panel: new blue row "Turn left in 120 m . 480 m to go" with an arrow, updating while driving; "Rerouting..." when you leave the road for a while, and a new line after a few seconds; row disappears on Clear and on arrival.
5. Accept a phone gig: the route should appear by itself; turn Job routes off and it vanishes; abandon/finish the job and it clears.
6. Turn directions at real junctions (left/right not swapped), especially at oblique ones (Estuary Bridge, bay road).
7. "You have arrived." toast once near the pin.
8. Row layout in the dock with damage and Stuck rows both showing (vertical space).

## What I could not verify / left
- Job auto-route is covered by gps.mjs only (the game-level test does not start a gig). Not checked: the gigMarker target for gigs with multi-stage targets (pickup then return).
- No spoken prompts, no painted 3D road line (design says later). No map-look redesign. Rerouting uses straight-line distance to a road, not walking-path distance; routes ignore closed roads.
- Confidence: pure rules high (tested); game wiring medium-high (one packaged-game test, nothing seen); minimap drawing and CSS layout medium (not seen).

Files: dist/gps.js, dist/phone-gps.js, dist/minimap.js, dist/phone.js, dist/vehicle-hud.js, dist/game.js, dist/index.html, dist/style.css, tests/gps.mjs, tests/gps-game.mjs, PROJECT-INDEX.md (regenerated). dist/releases/0.35.9 rebuilt with --force.