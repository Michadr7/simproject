michadr.

# MM1: pure view math (notes/minimap-design.md sections 2-4, 8, 9)

Files (new only, no BOM, no game.js/minimap.js/phone/handoff edits, no git)
- dist/map-view.js (87 lines): constants and pure functions. makeView, worldToPx, pxToWorld, zoomAbout, panBy, pick, cropWindow, lookAheadStep, cropSource (source and destination rect for BASE or tile images, off-world part left uncovered), tilesFor (128 m grid, in-world only, nearest first), levelFor, zoomTarget, footTarget, freshZoom, smoothZoom, stepUserZoom, edgeIndicator, cull.
- tests/map-view.mjs (66 lines): 9 groups from the note's section 8.
- Conventions: north is -z and up the screen (matches minimap.js); a view is {cx,cz,mpp,w,h} in device pixels.

Top speed
- Real fastest class: shortbed (Kasumuchi S70) top 29 m/s (65 mph). Others: offroad 26.8, worktruck 17.9, flatbed 15.6, ATV 15.6, tractors 6.3 and 7.2. No 'high' tier exists yet. The note's rule said 28 becomes the top only if the fastest is lower. It is higher.
- Set ZOOM_V_HIGH = 29, so 400 m is reached at flat-out speed. The test asserts it equals the max CLASSES top, so it fails loudly if a faster class is added.
- Side effect: the 275 m midpoint moves from 17 to 17.5 m/s. At 17 m/s the target is 266.9 m. The test checks 17.5 -> 275.

Results
npm run index:
brief 2996 tokens (target 3000), index 26378 tokens (target 32500); 177 modules, 13 generated, 216 tests, 26 scripts; 14 modules without a header comment
(about 6,100 tokens of cap left; the cap is untouched)

node tests/map-view.mjs:
PASS map-view: view math, crop window, tiles, level, zoom curve (top 29 m/s), smoothing, pick, chevrons, cull

npm run release -- --force:
Packaged release 0.35.9: 178 files -> dist/releases/0.35.9
dist/index.html now loads releases/0.35.9/

npm test (last lines): PASS zones-ru1.mjs: PASS zones-ru1 (32 checks)
All 216 test files passed.
(The output shows 216 files, but npm run index ran before the release step. map-view.mjs was already in that count.)

Not verified
- Nothing seen in a browser. The tests cover math only: no blur, seams, tint or looks.
- WORLD_BOUNDS is the planned world (x -450..1050, z -1200..600), not today's 530 x 440 m view. MM2 must pass the real bounds. Every bounds-using function takes them as an argument.
- tests/map-bake.mjs belongs to MM2.

DECISIONS TO CONFIRM (defaults taken)
1. Top speed 29 m/s instead of 28 (see above).
2. Look-ahead fades in with speed (0 at 2 m/s, full 0.2 W at 10 m/s, smoothstep) and is 0 on foot. The note only said "up to 0.2 W, tau 1 s".
3. The zoom-in hold (1.5 s) resets whenever the target is at or above the current W.
4. Edge chevron inset is 8 px (parameter). It prints distance when the target is more than 1.5 W away.

Forbidden-file edits needed: none.
Confidence: high for the math (tested incl. 60 vs 165 fps agreement). Medium for the API fit with MM2/MM3, which are not written yet.