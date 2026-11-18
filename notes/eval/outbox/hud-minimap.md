michadr.

## Summary
Laid out the right-hand HUD as one unified fixed column (`#hudRight` / `.hud-right`) from top to bottom with fixed gaps and no overlaps at `1920x1080`, `1280x720`, `1024x600`, and `360x780`:
1. `#streetChips` (tucked above the map card's upper-right edge, smaller green street-sign pills)
2. `#minimapCard` (`border-radius: 16px`, dark translucent card, N/M/scale badges, `.gps-card.walk` also `16px` so badges and docked clock align cleanly)
3. `#clockChip` (docked directly under `#minimapCard`'s lower edge inside `#minimapDock`, right-aligned, `Wed · 12:45 PM` format preserved)
4. `#statusDock` → `#vehiclePanel` (vehicle card) → `#vitals` (needs bars)

Also fixed two real-browser layout bugs caught during headless Edge verification:
- Removed `backdrop-filter` / `overflow: hidden` from `.gps-card` so `#minimap.large` (`position: fixed; right: 50%; bottom: 50%; transform: translate(50%, 50%); z-index: 60`) still centres in the viewport instead of being trapped/clipped inside `#minimapCard`.
- Added `@media(max-height:760px)` and `@media(max-height:680px)` scaling (`--hud-map-size: 172px` and `126px`) and compact card padding so `#vitals` clears `footer` (`#fps`) even in full driving state at `1280x720` and `1024x600`.
- Added `env(safe-area-inset-*)` padding on `.hud-right`, `@media(prefers-reduced-motion:reduce)` transition resets, and `.gps-scale i { margin: 0 }` so the global `i { margin: 0 12px }` rule no longer pads the scale bar.

## Files Created or Changed
- `dist/index.html` (62 lines, modified): wrapped `#minimapDock` (`#streetChips`, `#minimapCard`, `#clockChip`) and `#statusDock` (`#vehiclePanel`, `#vitals`) inside `<div id="hudRight" class="hud-right">`, preserving every existing ID (`npm run release -- --force` also synced `dist/releases/0.35.22/`).
- `dist/style.css` (518 lines, modified): removed stale fixed `#clockChip` (`top: 200px` / `top: 305px` / `176px` / `246px`), `#statusDock` (`bottom: 52px`), and `#minimap` (`top: 96px` / `bottom: 52px`) overrides; added `.hud-right` column rules, responsive sizing (`max-height:760px`, `max-height:680px`, `max-width:600px`), safe-area insets, `.gps-card` 16 px radius without `backdrop-filter`, `.gps-card #minimap.large` centering, and `prefers-reduced-motion`.
- `tests/hud-layout.mjs` (144 lines, created): static layout test asserting all required JS IDs exist once, DOM order in `#hudRight`, intact `#minimap.large` centering, safe-area & reduced-motion rules, and zero CSS box overlaps at `1920x1080`, `1280x720`, `1024x600`, and `360x780`.
- `notes/eval/outbox/hud-minimap-preview.html` (206 lines, created): standalone mock using `dist/style.css` with driving/on-foot/large preview modes.
- Headless Edge renders saved under `notes/eval/outbox/`:
  - `notes/eval/outbox/hud-preview-1920x1080.png`
  - `notes/eval/outbox/hud-preview-1280x720.png`
  - `notes/eval/outbox/hud-preview-1024x600.png`
  - `notes/eval/outbox/hud-preview-360x780.png`
  - `notes/eval/outbox/hud-preview-large-1280x720.png`

## Headless Edge Render Verification (Real Bounding Boxes)
Measured via `getBoundingClientRect()` on `notes/eval/outbox/hud-minimap-preview.html` in headless Edge (`deviceScaleFactor: 1`):
- **`1920x1080`**: `#help` `y=28..68` → `#streetChips` `y=78..96` → `#minimapCard` `y=101..303` (`202x202`) → `#clockChip` `y=308..332` (`x1=1886`, aligned) → `#vehiclePanel` `y=340..586` → `#vitals` `y=594..674` → `footer` `y=1031..1054`. Zero overlap.
- **`1280x720`**: `#help` `y=28..68` → `#streetChips` `y=76..94` → `#minimapCard` `y=98..272` (`174x174`) → `#clockChip` `y=276..300` → `#vehiclePanel` `y=306..538` → `#vitals` `y=544..616` → `footer` `y=671..694` (`55 px` clear). Zero overlap.
- **`1024x600`**: `#help` `y=28..68` → `#streetChips` `y=72..90` → `#minimapCard` `y=94..222` (`128x128`) → `#clockChip` `y=226..250` → `#vehiclePanel` `y=255..458` → `#vitals` `y=463..529` → `footer` `y=551..574` (`22 px` clear). Zero overlap.
- **`360x780`**: `#help` `y=18..54` → `#streetChips` `y=64..80` → `#minimapCard` `y=84..250` (`166x166`) → `#clockChip` `y=254..279` → `#vehiclePanel` `y=285..517` (`25 mph` stays on 1 line) → `#vitals` `y=523..595` → `#touchE` `y=680..738` (`85 px` clear) → `footer` `y=756..768`. Zero overlap in the right column (note the unrelated left-side `#objective` card sits at bottom-left `width: 230px`).
- **`1280x720` (`?large=1`)**: `#minimap.large` renders centred at `x=340..940, y=115..605` (`600x490`) above all HUD panels (`z-index: 60`), while `.gps-north`/`.gps-key`/`.gps-scale` hide cleanly.

## Tests & Commands Run
```text
> node tests/hud-layout.mjs
PASS hud-layout.mjs: right-column DOM order, all required JS IDs, large-map centering, safe-area & reduced-motion rules, and zero box overlaps at 1920x1080, 1280x720, 1024x600, and 360x780.

> npm run release -- --force
Packaged release 0.35.22: 247 files -> dist/releases/0.35.22
dist/index.html now loads releases/0.35.22/

> npm run index
brief 2834 tokens (target 3000), index 35374 tokens (target 36000); 246 modules, 14 generated, 297 tests, 30 scripts; 13 modules without a header comment

> node tests/brief.mjs
brief tests passed: 246 modules listed, brief 2834 and index 35374 estimated tokens (budgets 3000 and 36000)

> node tests/hud-cards.mjs
PASS hud-cards.mjs: speed text/bar/bands, fuel/damage bars, view cone angle, street chips from MAP.roads, purity.

> node tests/vehicle-hud.mjs
Vehicle panel: greyed out on foot; driving shows the name, speed in mph, the fuel type and gallons, and Get out, or Stop to get out while moving (1 m/s); riding shows Get out; the DOM is written only when the model changes.

> node tests/minimap-local.mjs
PASS minimap-local: 200x200 local window, 150 m on foot, speed zoom + look-ahead, no clamp at the world edge, dashed border, route culling, chevrons, invalidateAt

> node tests/talk-stuck.mjs
PASS talk-stuck.mjs: the docked talk panel renders in the real index.html tree (no hidden ancestor such as #settings), sits at body level, and a panel already there is not moved.

> node tests/damage-feel.mjs
PASS damage-feel.mjs: ...

> node tests/damage-game.mjs
Damage wiring: ...

> node tests/dev.mjs
Dev mode: ...

> node tests/menu.mjs
Main menu: ...

> node tests/tractor-driver.mjs
Tractor driver: PASS ...

> node tests/startup.mjs
Fresh save: creator, phone apps/controls/gigs, and multiplayer frame checks passed.
Existing save: gameplay, phone apps/controls/gigs, and multiplayer frame checks passed.

> node tests/menu-scene.mjs
menu-scene ok
```

## Requested Edits to Forbidden Files
1. `dist/minimap.js` (lines 74–76, `update`):
   - **Current**: `ctx.fillStyle='#ffffff22';ctx.beginPath();ctx.moveTo(x,z);ctx.arc(x,z,u*4,Math.atan2(-Math.cos(yaw),-Math.sin(yaw))-.5,Math.atan2(-Math.cos(yaw),-Math.sin(yaw))+.5);ctx.closePath();ctx.fill();`
   - **Requested**: Change the camera view wedge from white `±0.5` rad (`#ffffff22`) to a thin amber heading cone (`rgba(250,205,56,.28)`, `±0.28` rad) so the live game canvas matches the design brief (`thin amber heading cone`) — CSS/HTML cannot restyle 2D canvas fill calls.
2. `dist/scene-editor.js` (line 109, optional cleanup):
   - Add `#hudRight,#minimapDock` to the `body.scene-editing :is(...)` list if desired (already covered in `dist/style.css` with `body.scene-editing #hudRight{display:none}`).

## What Could NOT Be Verified
- Live 3D game run in `npm run dev` with real `game.js` HUD data (`hudChips`, `vehicleHudModel`, `clockChip`, `M` key large-map toggle transitions) — verified against the standalone preview mock in headless Edge (`1920x1080`, `1280x720`, `1024x600`, `360x780`, `?large=1`) and Node DOM-stub tests (`startup.mjs`, `hud-layout.mjs`, `minimap-local.mjs`).
- Full `npm test` suite (all 297 files) was not run; targeted HUD, minimap, layout, menu, damage, talk, brief, and startup tests were run and passed.

## Confidence
- Right-hand column CSS & markup (`dist/index.html`, `dist/style.css`) and 4-viewport static/visual layout (`tests/hud-layout.mjs`, Edge screenshots): **High**.
- Live `game.js` / `minimap.js` runtime integration without JS edits: **High** (all JS-read IDs and `.large` / `.walk` class toggles preserved and verified in `startup.mjs` + `hud-layout.mjs`; live canvas amber cone awaits the 1-line `dist/minimap.js` edit above).
