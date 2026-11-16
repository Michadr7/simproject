michadr.

# MM3: corner minimap becomes the local window (notes/minimap-design.md sections 3, 4, 9)

Files
- dist/minimap.js (about 105 lines, was 71): small mode is now a local window; large mode (M key, phone GPS, pick for the phone) is unchanged (whole view) until MM6/MM7.
  - Canvas 200 x 200. Window = cropWindow centred on the player + look-ahead, W from smoothZoom (footTarget on foot, zoomTarget(speed) driving), look-ahead from lookAheadStep (velocity = heading x speed). Smoothing runs every frame, drawing stays at about 12 fps.
  - Never clamped at the world edge: fill #141c19, then BASE and tiles cropped via cropSource, then a dashed 1 px border around the mapped bounds.
  - Route culled per segment (bbox vs window + 20 m). Pin and gold job marker off the window get an edge chevron (edgeIndicator, 10 px inset) with "320 m" when over 1.5 W away.
  - update() takes new optional `speed` and `driving`; pick() in small mode uses the current window. NEW internal setWindow/chevron.
- dist/game.js (three spots, minimal): lines about 1034 (stump), 1040 (sapling) and 1053 (fell) now call minimap.invalidateAt(x,z) (c.tree.x/z; sapling and regrowth look the tree up with world.trees.get(key)); tickRegrowth (about 1135) loops grown.restored and calls invalidateAt per tree; the minimap.update call (about 1155) passes speed:driving.speed, driving:!!driving.active. 4 invalidate() spots switched.
- dist/style.css: #clockChip top 268 -> 305 (mobile 222 -> 246) because the map is 37 px taller (2 lines, in the "0.22.0" block).
- NEW tests/minimap-local.mjs (stub canvas + stub bake): 200x200, 150 m centred, no clamp at the edge, border drawn, speed zoom to about 400 m and look-ahead up to 0.2 W, no shrink while braking (hold), route culling, chevrons run, invalidateAt/invalidate delegation.
- Not touched: handoff.md, cap, phone*.js, git. CRLF kept in minimap.js, no BOM.

Real output
npm run index: brief 2996 tokens (target 3000), index 26551 tokens (target 32500); 178 modules, 13 generated, 218 tests, 26 scripts; 14 modules without a header comment
node tests/minimap-local.mjs: PASS minimap-local: 200x200 local window, 150 m on foot, speed zoom + look-ahead, no clamp at the world edge, dashed border, route culling, chevrons, invalidateAt
node tests/gps-game.mjs: PASS gps-game.mjs: GPS app on the phone, tap drops one pin on a road ... Clear removes it. (phone map uses large mode, unchanged)
npm run release -- --force: Packaged release 0.35.9: 179 files -> dist/releases/0.35.9 / dist/index.html now loads releases/0.35.9/
npm test (last line): All 218 test files passed.

Frame-rate cost (estimates, not measurable in Node)
- Per redraw (12 fps): fill + 1 BASE drawImage + up to 9 tile drawImages (150 m touches at most 4 x 128 m tiles on a 150 m window; 400 m on dpr 2 up to 16) + dashed rect + route stroke (now culled, fewer segments than before) + arrow. About 0.1-0.4 ms each, under 5 ms per second. Per frame (60 fps) extra: smoothZoom + lookAheadStep, a few multiplies, negligible.
- At dpr 1 with W over 200 m (driving fast) the BASE (2 m/px) is used, softer: by design.
- Tiles needed: the window moves, so tiles stream in nearest first; each tile about 1.3 ms ground pixels plus unmeasured vector layers, sliced at 3 ms per frame.

DECISIONS TO CONFIRM (defaults taken)
1. Edge of the world = the bake bounds (MAP.minimap.view, 530 x 440 m), not MAP.world, because nothing outside is mapped yet. Switch bounds with MM2's decision when the mask grows.
2. Speed zoom and look-ahead are in MM3 (the prompt asked), but '-' '=' user zoom keys, scale bar, vehicle silhouettes, icons are NOT done (MM4).
3. Look-ahead direction = vehicle heading x |speed| (driving.speed is absolute), so reversing looks ahead of the nose, not of the motion. Only the gold job marker (#f2ca79) gets a chevron; the pale target marker does not.
4. Zone name labels (8 px) still drawn live in small mode; only those in the window show.
5. Large mode keeps the old 600 x 490 whole-view look (M key and phone) and the old 1.6% bottom crop.

Eye-check list (nothing seen in a browser)
1. Crop: corner map is square 200 x 200, rounded, player arrow in the centre on foot, ground sharp (tiles arrive within a second after spawn; BASE shows meanwhile). No seams at 128 m tile borders.
2. Zoom pumping: drive up to speed (map eases out to about 400 m over about 2 s), brake at a junction (it must hold about 1.5 s then ease in over several seconds, no flutter).
3. World edge: walk or drive to the west/south edge: ground stops, dark fill beyond, dashed border, arrow stays centred.
4. Blur: dpr 1 and dpr 2 on foot (0.75 and 0.375 m per device px: tiles used) and at speed (BASE, visibly softer when W over 200 m at dpr 1).
5. Route line: blue line over dark casing follows roads, no gaps at the window edge, GP1 phone route still shown on the phone map.
6. Pin: on-window pin drops red marker; off-window pin shows a red chevron on the frame with distance when far; gold job chevron likewise.
7. Time chip is not overlapped by the taller map (desktop and phone width).
8. Fell a tree / clear stump / plant sapling: the dot changes locally with no hitch.

Left for later stages: MM4 (keys, scale bar, silhouettes, icons), MM5 (street names, night tint), MM6 (full map screen), MM7 (phone on shared bake), MM8.
Forbidden-file edits needed: none (game.js edits are as allowed in the prompt).
Confidence: high for the window math, culling and wiring (tested); medium for draw looks (chevron positions, border, tile crop rounding) which are unverified visually.