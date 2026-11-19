michadr.

## Talk Panel Fit (No Scrolling) Report

### Files Created or Changed
- `dist/talk-fit.js` (68 lines, no BOM) — new pure module exporting `MAX_VISIBLE_LINES` (3), `CHARS_PER_LINE` (64), `SHRINK_CHARS` (180), `CLAMP_CHARS` (320), `FADE_MS` (200), `GRID_THRESHOLD` (4), `PAGE_SIZE` (7), `lineCost`, `visibleLines`, and `replyLayout`.
- `dist/talk-panel.js` (176 lines, no BOM) — wired `visibleLines` (fades older lines to opacity `0` over `200 ms` then removes them from the DOM, dims kept older lines, applies `shrink` and `clamp` + `'more'` expander button opening `.talk-sheet` as the only scroll fallback), and `replyLayout` (2-column grid when `> 4` options, `'More (N)'` paging when `> 7`, number keys `1-7` preserved).
- `dist/style.css` (548 lines total, no BOM; edited only the `/* C5 talk panel ... */` section, lines 406–437) — removed `overflow-y: auto` / scrollbars from `.talk-log` and `.talk-replies` (`overflow: hidden`), added `.talk-line.fading` / `.shrink` / `.clamp`, `.talk-more-btn`, `.talk-sheet` (the only scroll fallback), `.talk-replies.grid` (2-column layout), and `@media(max-height:760px)` 2-line clamp. Panel stays within `max-height: calc(30vh - 12px)` on desktop and `max-height: calc(45vh - 10px)` on phones (`<= 600px`).
- `dist/index.html` — unchanged (`<section id="talk" hidden></section>` remains at body level).
- `tests/talk-fit.mjs` (100 lines, no BOM) — new pure unit test for `dist/talk-fit.js`.
- `tests/talk-panel.mjs` (107 lines, no BOM) — kept all existing assertions intact and added assertions for 2-column grid, paging with `More`, `200 ms` fade/removal, and `shrink` + `clamp` + `'more'` sheet.
- `PROJECT-INDEX.md` and `PROJECT-BRIEF.md` — regenerated via `npm run index`.

### Test Output
```text
=== talk-fit ===
PASS talk-fit
=== talk-panel ===
PASS talk-panel
=== talk-stuck ===
PASS talk-stuck.mjs: the docked talk panel renders in the real index.html tree (no hidden ancestor such as #settings), sits at body level, and a panel already there is not moved.
=== talk-badge ===
PASS talk-badge.mjs: portrait initial/colour deterministic across 10 names (6 colours), friendly tier/mood chip mapping, and purity.
=== talk-engine ===
Talk engine: period picks and edges, the current time on every turn, specificity and w, one variant per turn (no glue), no repeats within last (8 variants x 25 talks), least-recent fallback, replay determinism, unknown go (strict throws, runtime hides), effects as data and same-talk beats, talkContext from progress, memory caps, all 20 conditions, garbage in, inputs frozen, no clock or chance.
=== talk-memory ===
PASS talk-memory: caps (6/32/16, 48 people), junk, frozen, helpers, old 0.35.18 save loads unchanged, migration beats, Elena met via the cafe, once only
=== talk-validate ===
Talk validator: good cast has zero problems; the bad cast fires all 11 rules (15 codes) exactly once with person, node, line, what and how; the 7 shape and voice extras once each; time words, glue, ids, slots, cross-cast repeats, the coverage sweep, garbage in, inputs untouched.
=== talk-cast ===
PASS talk-cast.mjs: 5 early casts validated (0 errors, 0 warnings), 762 sweep contexts (17180 terminal walks, 36847 bubbles, zero cycles/repeats/time-leaks), castOf + pinned phrases passed.
=== talk-cast-oak ===
PASS talk-cast-oak.mjs: 4 Oak/Cedar casts validated against 5 early casts (0 errors, 0 warnings), 376 sweep contexts (3670 terminal walks, 4628 bubbles), pinned checks passed.
=== talk-cast-crowd ===
PASS talk-cast-crowd.mjs: 19 crowd casts validated against 9 named casts (0 errors, 0 warnings), 1026 sweep contexts (4104 terminal walks, 3040 bubbles), place-aware npc-chat passed.
=== talk-game ===
PASS talk-game.mjs: Noah, Elena and Hal talk in the docked panel; time runs and walking is locked while talking; Esc says see you without pausing; acts run first and a failed act keeps the old replies; memory saved without derived beats; H7 read-message; recent cafe-shift; Hal hands over the truck at step 3.
=== hud-layout ===
PASS hud-layout.mjs: right-column DOM order, all required JS IDs, large-map centering, safe-area & reduced-motion rules, and zero box overlaps at 1920x1080, 1280x720, 1024x600, and 360x780.
```
`npm run index` + `node tests/brief.mjs`:
```text
brief 2834 tokens (target 3000), index 35521 tokens (target 37000); 266 modules, 14 generated, 324 tests, 33 scripts; 13 modules without a header comment
brief tests passed: 266 modules listed, brief 2834 and index 35521 estimated tokens (budgets 3000 and 37000)
```

### Screenshots & Headless Edge Measurements
Saved under `notes/eval/outbox/` and visually inspected:
- `notes/eval/outbox/talk-fit-short3-1920x1080.png`: panel height `219 px` (`21.2%` from bottom), `logOverflow: false`, `repOverflow: false`, `allBtnsInside: true`, 3 lines, 3 options.
- `notes/eval/outbox/talk-fit-long7-1920x1080.png`: panel height `198 px` (`19.3%` from bottom), `logOverflow: false`, `repOverflow: false`, `allBtnsInside: true`, 2-column grid (`295px 295px`), 7 options.
- `notes/eval/outbox/talk-fit-short3-1280x720.png`: panel height `204 px` (`29.7%` from bottom), `logOverflow: false`, `repOverflow: false`, `allBtnsInside: true`, 3 lines, 3 options.
- `notes/eval/outbox/talk-fit-long7-1280x720.png`: panel height `198 px` (`28.9%` from bottom), `logOverflow: false`, `repOverflow: false`, `allBtnsInside: true`, 2-column grid (`295px 295px`), 7 options.
- `notes/eval/outbox/talk-fit-short3-360x780.png`: panel height `219 px` (`29.1%` from bottom), `logOverflow: false`, `repOverflow: false`, `allBtnsInside: true`, 3 lines, 3 options.
- `notes/eval/outbox/talk-fit-long7-360x780.png`: panel height `245 px` (`32.4%` from bottom), `logOverflow: false`, `repOverflow: false`, `allBtnsInside: true`, 2-column grid (`155px 155px`), 7 options.

### What Could Not Be Verified
- Full `npm run release -- --force` + `npm test` (intentionally skipped while `game.js` work may be running).
- Live 3D in-game conversation over the WebGL scene (the panel was rendered in a standalone headless Edge page).

### Exact Edit Request for Forbidden Files (`dist/game.js`)
To keep the NPC's lower body above the docked bottom 30% panel during conversations, lower the talk camera target in `dist/game.js` line 1864 (currently `mid.y+=.25`, which puts `target.y` at `1.75 m` in `camera.js` and places the characters' feet around `81%` down the screen, behind `#talk`):
- File: `dist/game.js`, line 1864
- Old text:
  `mid=talkMid.copy(pa).add(pb).multiplyScalar(.5);mid.y+=.25;`
- New text:
  `mid=talkMid.copy(pa).add(pb).multiplyScalar(.5);mid.y-=.35;`

### Confidence
- Pure fit rules (`dist/talk-fit.js`), DOM behavior (`dist/talk-panel.js`), and talk/HUD tests: **High**.
- Layout sizing (<= 30% desktop, <= 45% phone, zero scrollbars, all 7 options visible): **High** (measured in headless Edge and inspected in the PNGs).
- Live 3D camera framing with the NPC: **Medium** (requires the requested `dist/game.js` line 1864 edit).
