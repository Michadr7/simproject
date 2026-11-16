# Minimap and map revamp (design note, Opus 5.5, 2026-11-15)

Implements handoff entry MINIMAP (user answers 2026-11-15) and map-master 6.7 "Map screen" / stage R6. Builds on GP1 (route line, pin,
phone GPS app). Stages MM1..MM8 at the end are for Sonnet 5.5. Numbers marked (e) are estimates that MM2 must measure.

## 1. Decided (user) and what exists today
- Corner minimap: NORTH-UP, about 150 m across on foot, zooms out when driving fast, NO fog of war.
- Full map (M key and the phone) keeps showing the whole world.
- Today (dist/minimap.js, 96 lines): one canvas per map; `drawStatic()` paints the WHOLE `MAP.minimap.view` (now 530 x 440 m,
  x -200..330, z -330..110) pixel by pixel (terrain mask colour x relief shade), then water (`drawWaterLayer`), buildings, landmark
  footprints (axis-aligned boxes of rotated footprints), plot outlines, trees, zone names. `update()` at 12 fps blits that layer and
  draws route (GP1), pin (GP1), markers, camera wedge and arrow. M toggles the same canvas between 200 x 163 and 600 x 490 CSS px.
- `invalidate()` (tree felled, stump cleared, sapling, regrowth: game.js 1034, 1040, 1053, 1135) rebakes the WHOLE layer.
- phone-gps.js builds a SECOND createMinimap on #gpsMap (600 x 490, dpr 1) the first time it opens: its own full bake, which is the
  "first-open hitch up to 1 s" in the GP1 report. pick() maps a tap to world x,z for gps.setPin.
- Planned world (map-master 1.x): x -450..1050, z -1200..600 = 1500 x 1800 m. At 1 px = 2 m that is 750 x 900 px.

## 2. Cost: bake once, crop per frame (recommended)
Per-frame vector redraw (rejected): the 1500 m world has about 60 km of road edges, a few hundred building footprints, water polygons
and thousands of tree dots. Culled to a 150 m window that is still 300..1,500 path ops plus a per-pixel ground fill that cannot be done
as vectors at all (relief is per pixel). Estimate (e, vector redraw is not measurable in Node) 1.5..4 ms per redraw x 12 fps = 18..48 ms of main thread per second (e).
Crop (recommended): one `drawImage(source, sx, sy, sw, sh, 0, 0, w, h)` of a baked image into the corner canvas: about 0.05..0.15 ms
(GPU-backed 2D canvas), x 12 fps = under 2 ms per second. Overlays stay vectors (route, pin, icons, arrow, labels): about 0.2..0.4 ms.

### Resolution plan (two levels; the terrain mask itself is 0.5 m, so 0.5 m/px is the finest useful detail)
| Layer | m/px | Extent | Pixels | Memory (RGBA) | Bake, MEASURED in Node (MM2, ground pixels only) |
|---|---|---|---|---|---|
| BASE (whole world) | 2.0 | 1500 x 1800 m | 750 x 900 = 675k | 2.7 MB | 12 ms (whole 1500 x 1800 m world, mostly off the terrain mask) or 0.9 ms (today 530 x 440 m view); plus the shade grid 76 ms / 20 ms. At load, sliced |
| TILE L0 (on demand) | 0.5 | 128 x 128 m | 256 x 256 (+1 px gutter = 258) | 0.27 MB each | 1.1..3.2 ms first run, 1.3 ms warm (0.019 us/px) each, ground only; the vector layers are not measurable in Node |
| Tile cache (LRU) | | 24 tiles corner, 32 while the full map is open | | 6.4 / 8.5 MB | |
| Rejected: whole world at 1 m | 1.0 | | 2.7M | 10.8 MB | about 0.05 s (2.7M px x 0.017 us, extrapolated) |
| Rejected: whole world at 0.5 m | 0.5 | | 10.8M | 43 MB | about 0.2 s (10.8M px x 0.017 us, extrapolated) |
Today, for comparison: big layer 1200 x 980 at dpr 2 = 4.7 MB, plus the phone copy 600 x 490 = 1.2 MB, each baked separately.
- Why tiles: the corner map is 200 CSS px; 150 m across = 0.75 m per CSS px, 0.375 m per device px at dpr 2. BASE (2 m/px) would be
  upscaled 5.3x (blurry roads, no tree dots). L0 at 0.5 m is upscaled 1.33x at dpr 2 and slightly downscaled at dpr 1: sharp.
- Level choice: mpdp = window metres / (canvas device px). Use L0 tiles when mpdp < 1.0, else BASE. dpr 2: tiles up to 400 m wide;
  dpr 1: tiles up to 200 m, BASE beyond (2x upscale at worst, only at speed).
- Tiles are 128 m on a fixed world grid (tile i = floor((x - x0) / 128)). A 150 m window touches at most 3 x 3 = 9 tiles; 400 m: 16.
- Seams: each tile is baked with a 1 px gutter (258 px) and drawn from its inner 256 px, so smoothing never shows a seam line.
- Missing tile: draw the BASE crop for that area first (never blank), the tile replaces it when ready (no fade needed at 12 fps).
- Bake slicing: one shared baker gets 3 ms of each frame (injected clock), rows of the job in hand. BASE first (during the loading
  screen if possible), then tiles nearest the player. Prefetch: every tile touching the window grown by max(64 m, speed x 3 s).
  At 28 m/s a new tile column every 4.6 s = about 1 tile/s needed; MEASURED ground cost 1.3 ms per tile (the old 65..200 ms estimate was 50..150x too high: the per-pixel cost is 0.019 us, not 1..3 us), so a tile's pixels fit in one 3 ms slice; the real per-tile cost in a browser is the vector layers (water, footprints, trees) and putImageData, which Node cannot measure (use the dev log '[map-bake]' lines, printed when a job takes 25 ms or more).
- Shade grid (relief, SHADE_STEP 4 m): 376 x 451 floats = 0.7 MB once, shared by BASE and tiles (today each map builds its own).
- Invalidation: `invalidateAt(x, z, r = 3)` rebakes the L0 tiles under the circle (usually 1) and repaints the few BASE pixels of the
  same box (a 4 x 4 px putImageData). The old `invalidate()` stays as "rebake everything" for safety but game.js switches to
  invalidateAt in the four tree spots (the tree key gives x, z).
- Bake also improves: landmark footprints filled as rotated polygons (today axis-aligned boxes; visible at 0.5 m/px).
- Labels and icons are NOT baked (they must keep a fixed screen size at every zoom and would split at tile edges).

## 3. Corner minimap look
- Window: centred on the player, north up, W metres wide (section 4). Canvas 200 x 200 CSS px (rounded square, see Q1), so 150 m both
  ways; today's 200 x 163 would show 150 x 122 m.
- Clip shape: rounded square, radius 10 px as now (shows 27% more ground than a round map of the same width; north-up needs no circle).
- Edge of the world: the window is NOT clamped; the player stays in the centre. Off-world pixels are #141c19 with a 1 px dashed world
  border line. (Clamping moves the arrow off centre, which reads badly on a 200 px map.)
- Look-ahead when driving: the centre shifts ahead along the velocity by up to 0.2 W (smoothed, tau 1 s) so more road ahead shows
  (Q4). On foot: no shift.
- Player on foot: today's cream arrow (heading) + the faint camera wedge, fixed 10 px size.
- Player in a vehicle: a top-down silhouette per class (car, pickup, truck, tractor, ATV) 14 px long, rotated by the vehicle yaw, cream
  fill, dark outline; no camera wedge. Own parked vehicles: the same silhouette 10 px in blue (#6fb7ff) instead of today's dots.
- Route (GP1): unchanged look (blue #4aa8ff over dark casing #0b2a46, fixed px width); segments whose bbox misses the window + 20 m
  are skipped. Pin (GP1): unchanged. Off-window pin or job marker: a 7 px chevron on the frame edge pointing at it, with the distance
  ("320 m") beside it when the target is over 1.5 W away.
- Icons (sprite atlas, one canvas, 16 icons x 20 px x dpr, drawn once): shop (bag), fuel (pump), job/gig (existing gold marker),
  owned home (filled house), plot for sale (outline house), rescue point (cross, full map only), garage. Culled to window + 10 m;
  at most 24 icons drawn, nearest first.
- Street names: the road the player is on plus the next turn's street from the GPS route, at most 4 labels, 10 px bold with a 3 px
  dark halo, rotated along the road and flipped to read left-to-right (Q6). Names come from the `name` field on streets (R4; 6 named
  today). Label sprites cached per name (measureText once).
- Day/night tint: after the crop, one fillRect with globalCompositeOperation 'multiply' from a daylight value 0..1 game.js passes:
  day = no tint, night = rgb(150, 160, 205) (about 65% brightness, blue). Icons, route, arrow drawn after it, untinted (Q8).
- Zoom indicator: a 40 px scale bar bottom-left ("50 m") that updates with W.

## 4. Zoom: speed curve and the player's control
- Speed curve (only while driving; on foot W = 150 even when sprinting): v = |vehicle speed| in m/s.
  `target(v) = 150 + 250 * smoothstep(6, 28, v)` -> 150 m up to 6 m/s (22 km/h), 275 m at 17 m/s (61 km/h), 400 m at 28 m/s
  (100 km/h) and above. If the fastest class tops out lower (MM4 greps vehicle.js), 28 becomes that top speed.
- Smoothing, frame-rate independent: `W += (T - W) * (1 - exp(-dt / tau))`, tau 0.8 s zooming out, 2.5 s zooming in, and zoom-in only
  starts after the target has been lower for 1.5 s (no pumping when braking at a junction).
- Player control (corner): keys '-' and '=' step a user factor 0.5 / 1 / 2 (75 / 150 / 300 m on foot), multiplied with the speed
  curve, clamped 60..800 m; saved in settings (not the profile). The corner map has pointer-events:none and the mouse is used by the
  camera, so no scroll wheel on it. MM4 must grep game.js keydown for '-' / '=' clashes first.
- Full map: wheel zooms about the cursor, drag pans, '-' / '=' step, Home or Space recentres on the player. Levels: Fit (whole world,
  about 2 m/px), 1 m/px, 0.5 m/px (continuous between, snapped by keys).

## 5. Full map screen (R6)
- M opens a full-screen overlay (new dist/map-screen.js), replacing today's "same canvas at 600 x 490". Esc or M closes. The game keeps
  running (multiplayer), player movement input is ignored while open (Q3).
- Canvas: viewport minus 32 px margins, dpr up to 2. Opens at Fit, centred on the world, player arrow visible.
- Raster: BASE crop at Fit and 1 m/px; L0 tiles at finer than 1 m/px (cache cap raised to 32 while open, back to 24 on close).
- Vector overlay redrawn only on pan, zoom, route change or every 250 ms for the arrow (not 12 fps): roads re-stroked as vectors at
  1 m/px and finer so they stay sharp over the 2x-upscaled BASE (one redraw = a few ms, only on input).
- Labels: region names (the 9 regions and zones, 16..22 px caps, letter-spaced, white 80%), town names (MAP.towns incl. Kaspian Bay,
  15 px italic), street names at 1 m/px and finer, plot ids with state (owned / for sale / reserved, colours as today:
  residential #2fbf9f, commercial #b0529b, industrial #e0a02e). Collision rule: a label is skipped if its box overlaps one drawn
  earlier (priority region > town > street > plot).
- Icons: as the corner map plus rescue points (MAP.rescuePoints, grouped by `region`), fuel stations, the GPS route and pin, own
  vehicles, gig marker.
- Layer toggles (buttons top-right, also in the legend): Weapon zones (hunting = orange hatch, noWeapon = grey hatch), Fishing zones
  (cyan hatch), Rescue points, Plots. Weapon/fishing default off (Q7). Drawn as vector rectangles from RU1 data on redraw (no extra bake).
- Legend: bottom-left panel, L toggles: surface colours (asphalt, gravel, dirt, water, field), icon list, scale bar, layer toggles.
- Pin: click (or tap) drops the GPS pin through gps.setPin, right-click clears (Q2). pick() uses the view math (section 7).

## 6. Phone GPS shares the bake
- One module-level bake (map-bake.js): BASE canvas, shade grid, tile cache, baker queue. Every map is a VIEW on it: corner minimap,
  full map screen, phone GPS. No second bake: the phone's first-open hitch goes away; memory saves the 1.2 MB copy.
- phone-gps.js uses the same view component as the full map screen (createMapView in map-screen.js) on #gpsMap: Fit, pinch/wheel zoom,
  tap = pin as now, route + pin overlay as now. Its 12 fps redraw becomes redraw-on-change (+ 4 fps arrow).
- Contract kept for GP1: `update(dt, {player, heading, yaw, markers, route, pin})`, `pick(clientX, clientY)`, `invalidate()`;
  new optional fields `speed`, `vehicle` ({cls, yaw} or null), `daylight`, `labels`.

## 7. Multiplayer later (MM8)
- Remote players: 6 px dots in their colour with a 1-letter initial; off-window ones get an edge chevron like the pin (corner map
  only; full map shows them all). Positions are already relayed (local multiplayer); no new network data. Max 8 drawn.

## 8. Test plan (Node, pure: dist/map-view.js has no DOM)
tests/map-view.mjs (one PASS line):
- worldToPx / pxToWorld round trip within 1e-9 for 3 zooms x dpr 1 and 2 x 4 points.
- cropWindow(center, W, aspect, bounds): centred on the player, never clamped at world edges, correct source rect for BASE and tile
  coordinates; look-ahead offset never exceeds 0.2 W.
- tilesFor(window, 128): 150 m window -> at most 9 tiles, 400 m -> at most 16; tiles off the world are dropped.
- levelFor(W, devicePx): 150 m on 400 px -> L0; 400 m on 200 px -> BASE; boundary at 1.0 m per device px.
- zoomTarget(v): 0 -> 150, 6 -> 150, 17 -> 275 +-1, 28 -> 400, 60 -> 400, monotonic over 0..60.
- smoothZoom frame-rate independence: 1 s at 60 steps vs 165 steps agree within 0.5 m; zoom-in hold of 1.5 s respected.
- pick(): the centre of the corner view returns the player; corners return window corners; outside the canvas -> null; full map pick
  at a zoom and pan round-trips with worldToPx.
- edgeIndicator(point, window): inside -> null; outside -> a point on the frame border and the angle toward the target.
- cull(items, window, margin, max): drops off-window items, keeps nearest first, respects max.
tests/map-bake.mjs (stub document with fake canvases and ImageData arrays): the sliced baker never exceeds its pixel budget per call
(injected clock), BASE before tiles, LRU evicts the farthest tile, invalidateAt dirties only the tiles under the circle.
Not testable in Node (no canvas): looks, blur, tint, seams. Browser check: scripts/browser-lab.mjs screenshots at spawn, in a vehicle at
speed, at the world edge, full map at Fit and 0.5 m/px; plus the user's eye check.

## 9. Stages (Sonnet 5.5, one per run, in order)
| Stage | What | Files | Conflicts / notes |
|---|---|---|---|
| MM1 | Pure view math: worldToPx, pxToWorld, cropWindow, tilesFor, levelFor, zoomTarget, smoothZoom, edgeIndicator, cull, pick | NEW dist/map-view.js, tests/map-view.mjs | none; can run beside anything |
| MM2 | Shared bake: BASE 2 m, shade grid once, L0 tiles + LRU, 3 ms sliced baker, invalidateAt, rotated footprints; minimap.js draws from it (still whole-world view, no look change); log bake ms in dev | NEW dist/map-bake.js, tests/map-bake.mjs, minimap.js | needs GP1 committed; MEASURE us/px and replace the (e) numbers here |
| MM3 | Corner map player-centred: north-up crop, 150 m, 200 x 200, world-edge fill + border, route culling, pin/job edge chevrons; game.js uses invalidateAt | minimap.js, game.js (4 invalidate spots, update args), style.css | after MM2; not beside any game.js stage |
| MM4 | Speed zoom + '-'/'=' user zoom + scale bar + vehicle silhouettes + icon atlas (shop, fuel, job, home, plot) | minimap.js, NEW dist/map-icons.js, game.js (keys, speed, vehicle) | after MM3; grep key clashes first |
| MM5 | Street-name labels (current road + next turn) and day/night tint | minimap.js, game.js (daylight, current street) | after MM4; daylight source may move in the visual overhaul: read it through one getter |
| MM6 | R6 full map screen: overlay, Fit/zoom/pan, labels with collision, legend, layer toggles (RU1 zones, rescue points, plots), click = pin; M opens it; minimap 'large' mode removed | NEW dist/map-screen.js, index.html, style.css, game.js (M key), minimap.js | after MM3; never beside MM4/MM5 (game.js, minimap.js) |
| MM7 | Phone GPS on the shared bake via createMapView; redraw on change | phone-gps.js, phone.js (if the screen size changes), index.html | after MM6; phone*.js only here |
| MM8 | Multiplayer dots + edge chevrons | minimap.js, map-screen.js, game.js | later, after the multiplayer stage that exposes remote positions |
Order: MM1 -> MM2 -> MM3 -> MM4 -> MM5 -> MM6 -> MM7 (MM6 may go right after MM3 if the user wants the full map sooner; then MM4/MM5
wait). game.js edits stay minimal and additive (context.md rule). After each: `npm run release -- --force`, `npm test`, `npm run index`
(index budget: GP1 left 772 tokens; the index trim must land before MM1 adds files).
FPS flag: per frame the new corner map costs about the same as today (one blit + overlays); the risks are bake slices (capped at 3 ms
per frame, only while tiles are missing) and 6..9 MB of canvases. Cheaper fallback if slices show as hitches: tiles at 1 m/px
(4x fewer pixels, slightly softer).

## 10. Open questions for the user (recommended answer first)
1. Corner map shape: (a) rounded square 200 x 200 px, 150 m both ways; (b) keep 200 x 163 (150 x 122 m); (c) round, 190 px.
2. GPS pin on the full map screen: (a) yes, click drops it, right-click clears (phone still works); (b) phone only, as GP1.
3. While the full map is open: (a) the game runs on, your character stands still; (b) pause in single player only; (c) you can still walk.
4. Look-ahead when driving: (a) yes, up to 20% of the window ahead of the car; (b) no, always exactly centred.
5. Corner zoom keys: (a) '-' and '=' with 3 steps (75/150/300 m), saved; (b) no manual zoom on the corner map, speed only.
6. Street names on the corner map: (a) only your road and the next turn (max 4); (b) every street in view; (c) none (full map only).
7. Weapon and fishing zones on the full map: (a) toggle buttons, off by default; (b) always shown; (c) not shown.
8. Night tint on the maps: (a) mild blue, about 65% brightness at night; (b) none, always day colours.


## 11. User answers (2026-11-15): all eight take the recommended option
1 rounded square 200x200, 150 m; 2 click drops pin / right-click clears on the full map; 3 game runs on, character stands still while the full map is open; 4 look-ahead up to 20%; 5 '-' and '=' three steps (75/150/300 m), saved; 6 street names: your road and the next turn, max 4; 7 weapon/fishing/rescue/plot layers as toggle buttons, off by default; 8 night tint mild blue, about 65% brightness.
