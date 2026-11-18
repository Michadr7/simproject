michadr.

## Logging Tutorial Visual Pass 2 Report

### Files Created or Changed
- `dist/logging-tutorial.js` (236 lines, no BOM; within the 236-260 line budget):
  - Kept the exact exported API (`CARRY_RULES`, `CARRY_TEXT`, `STEPS`, `shouldShow`, `markSeen`, `buildOverlay`, `bindClose`) and constant-backed numbers from `dist/carry.js` (`HANDS_SPEED`, `PLANKS_PER_STACK`) and `dist/plank-economy.js` (`SAW_SECONDS_PER_LOG`, `SAW_SECONDS_PER_TRUNK`, `TRUNK_TO_LOGS`, `TRUNK_TO_SLABS`, `LOGS_TO_PLANKS`).
  - **Orientation & icon fixes**:
    - Added `axeGlyph(gx, gy, hx, hy, scale)` so both `Fell` and `Buck` axes have the head at the TOP of the handle with the curved amber-beveled blade edge facing left toward the pine/trunk.
    - Added `sawPath(cx, cy, r0, r1, n)` for directional saw teeth on both the `BADGE` ring (16 teeth) and the `Saw` blade (12 teeth + inner ring + central hub/arbor).
    - Added `logCyl(x, y, w, h, side, sw, rings)` so every horizontal trunk and stacked log in `Buck`, `Saw`, and the legend (`MINI.trunk`, `MINI.log`, `MINI.logs2`) shows a cylinder with an elliptical cut face and concentric growth rings + pith dot.
    - Verified `Haul` truck faces right (direction of travel toward the hut) with the cargo bed behind the cab, and the lumber hut has a pitched overhanging roof over its raised deck storing boards and slabs.
  - **Scene quality**: Upgraded all 4 scenes to `160x96` with consistent `2.5` primary strokes, rounded caps/joins, cohesive 4-colour palette (`coal`/`char`, `bone`, `amber`/`timber`, `moss`), ground lines (`M10 82 H150`), soft shadow ellipses (`SHD`), and clear single-glance actions (`Fell`: mid-swing axe, dashed motion arc, flying wood chip; `Buck`: trunk on ground + chainsaw + axe + 2 stacked logs; `Saw`: toothed blade + sparks + boards riding on conveyor belt + stacked boards/slab; `Haul`: arriving truck + lumber hut).
  - **Copy**: Updated `STEPS[3]` (`Haul & Sell`) to `'Carry boards and slabs into the lumber hut, then haul to the lumberyard and warehouse.'` and added `'Hut storage only'` fact chip alongside `'4 Boards / stack'`.
  - **No duplicate numbers**: Removed step numbers from `.lt-rail-dot` and `.lt-step-head`, keeping `.lt-step-num` (`1`..`4`) solely in the top-left corner of each `.lt-scene`.
- `dist/style.css` (521 lines total, no BOM; edited only the `/* T-C logging tutorial overlay */` block, lines 422-486):
  - Larger touch targets: `.lt-close` `min-height: 44px`, `min-width: 88px`, `padding: 11px 22px`; slightly larger `.lt-fact` (`min-height: 26px`), `.lt-stack-badge` (`min-height: 28px`), and `.lt-kbd` keycaps.
  - Higher WCAG AA+ contrast on chips and small labels: `.lt-fact` (`#ffe680` on `#151310`), `.lt-stack-badge` (`#f5f3e7` on `#151310`), brighter `.lt-rail-label` (`#e7e3d4`), `.lt-step-desc` (`#e4e0d4`), and `.lt-hint` (`#d6d1c2`).
  - Clearer step-to-step connectors: brighter `.lt-rail` track with `›` chevrons between stages, and `22x22` circular `→` connector badges between desktop step cards (`>= 861px`).
  - Updated `.lt-anim-axe` pivot (`transform-origin: 95% 95%`) to swing from the bottom-right grip, added `.lt-anim-chip`, and included `.lt-anim-chip` in `@media(prefers-reduced-motion:reduce)`.
- `tests/logging-tutorial.mjs` (182 lines, no BOM):
  - Kept all existing tests (1..10) intact and added test 11 checking Haul copy (`lumber hut`, `boards and slabs`, no `shed`), no duplicate step numbers (rail dots empty, 4 unique `.lt-step-num` in scene corners), shadow/ring `<ellipse>` presence in all 4 scenes, and Fell axe handle orientation (`hy < gy`).
- `PROJECT-INDEX.md` and `PROJECT-BRIEF.md` (regenerated via `npm run index`).
- Preview PNGs saved under `notes/eval/outbox/`:
  - `notes/eval/outbox/tutorial-polish2-1920x1080.png`
  - `notes/eval/outbox/tutorial-polish2-1280x720.png`
  - `notes/eval/outbox/tutorial-polish2-360x780.png`

### Headless Edge Render & Measurements
Rendered the standalone HTML snapshot (`C:\Users\Michael\.gemini\antigravity\brain\dfd9074c-cc67-4ecf-83d2-f377af1b9b09\scratch\tutorial-polish2-preview.html`) in headless Microsoft Edge and inspected the PNGs:
- `1920x1080`: `docScrollW: 1920` (no horizontal overflow), `cardW: 940`, `cardH: 611`, `cardScrollW === cardClientW (938)`, `cardScrollH === cardClientH (609)`, `closeW: 88`, `closeH: 44`, `closeVisible: true`, `.lt-fact` contrast `14.91:1`, `.lt-stack-badge` contrast `16.65:1`.
- `1280x720`: `docScrollW: 1280` (no horizontal overflow), `cardW: 940`, `cardH: 611`, `cardScrollW === cardClientW (938)`, `cardScrollH === cardClientH (609)`, `closeW: 88`, `closeH: 44`, `closeVisible: true`, `.lt-fact` contrast `14.91:1`, `.lt-stack-badge` contrast `16.65:1`.
- `360x780`: `docScrollW: 360` (no horizontal overflow), `cardW: 340`, `cardH: 760`, `cardScrollW === cardClientW (338)`, `cardScrollH: 1444`, `cardClientH: 758` (vertical scroll inside card), `closeW: 88`, `closeH: 44`, `closeVisible: true`, `.lt-fact` contrast `14.91:1`, `.lt-stack-badge` contrast `16.65:1`.
- Visual check of the PNGs confirmed:
  - In `Fell`, the axe head is at the top of the handle with the curved blade facing left toward the notched pine tree, clear of the pine canopy, with a dashed swing arc and flying chip.
  - In `Buck`, the felled trunk lies on the ground with concentric end rings on its left cut end, both a chainsaw and an upright-head axe are visible above the trunk, and two stacked logs on the right show concentric end rings.
  - In `Saw`, the circular saw blade shows 12 angled teeth and a central hub, boards ride on the conveyor belt, and stacked boards + a bark-topped slab sit on the right.
  - In `Haul & Sell`, the truck faces right (cab in front, loaded bed behind) toward the roofed lumber hut containing stored boards and slabs.
  - Note: static PNGs cannot verify live animation smoothness, `prefers-reduced-motion` media toggle in a user session, or subjective taste over the live 3D game scene.

### Tests & Commands Run
1. `npm run index`:
```text
> city-life-local-multiplayer@0.35.22 index
> node scripts/build-index.mjs

brief 2834 tokens (target 3000), index 35535 tokens (target 36000); 246 modules, 14 generated, 299 tests, 30 scripts; 13 modules without a header comment
```
2. `node tests/logging-tutorial.mjs`:
```text
PASS logging-tutorial
```
3. `node tests/brief.mjs`:
```text
brief tests passed: 246 modules listed, brief 2834 and index 35535 estimated tokens (budgets 3000 and 36000)
```

### What Could Not Be Verified
- Full `npm test` / `npm run release -- --force` and live in-game overlay opening (`openLoggingTutorial` in `dist/game.js`) over the 3D scene.
- Live animation cadence of `.lt-anim-axe`, `.lt-anim-chip`, `.lt-anim-saw`, `.lt-anim-cut`, `.lt-anim-sparks`, and `.lt-anim-truck` and interactive `prefers-reduced-motion` toggle.

### Forbidden Files Needed
- None. Only `dist/logging-tutorial.js`, the `#logging-tutorial` CSS block in `dist/style.css`, and `tests/logging-tutorial.mjs` were modified.

### Confidence
- Orientation fixes, copy accuracy, constant-backed values, line count (`236 <= 260`), no-BOM encoding, and unit assertions: **High** (verified by `node tests/logging-tutorial.mjs` and `node tests/brief.mjs`).
- Layout metrics, zero horizontal overflow (`360px`–`1920px`), touch-target size (`88x44` Close button), and WCAG AA+ chip contrast (`14.91:1` / `16.65:1`): **High** (measured in headless Edge and inspected in the 3 PNGs).
- Live 3D in-game overlay behavior and CSS motion feel: **Medium** (not launched inside the live game build).
