# Animated main menu: design note

First build, 2026-11-13. Plan: `plans/2026-11-13-animated-main-menu-a-live-scene-with-the-character.json`.
Visuals are NOT verified by eye yet: the agent's browser is software WebGL. Every number below marked (tune) is a first guess.

## Files
- `dist/menu-scene-rules.js`: pure. The animation rules, the vehicle swap point, when to draw, the controller (`createMenuLive`). No three.js, no DOM.
- `dist/menu-scene.js`: builds the three.js scene from the rules (`createMenuScene`).
- `dist/game.js`: 4 small additive edits (import, `menuLive`, one line in `frame`, one call in the creator's submit).
- `dist/style.css`: `.main-menu.live` (drops the picture, keeps the dark gradient behind the buttons).
- `tests/menu-scene.mjs`; `tests/startup.mjs` (its renderer stub now counts world draws only).
- `town.js`, `world.js`, `map-definition.js`, `index.html`, `main-menu.js`: not touched.

## Scene
A forest clearing, separate from the game world (its own `THREE.Scene`, so the town is not drawn behind the menu).
- Ground: a green plane and a 7.5 m dirt circle.
- Vehicle: the `offroad` prop at the origin (stand-in, see the swap point).
- Character: `createCharacter(currentAppearance)` (the game's own loader, passed in). Back to the hull: `setLean(-0.13)`. Both hands hold the plans: `reach('R'|'L')` to chest height, `setHandCurl(0.6)`. The plans are a 46 x 32 cm sheet with a blue panel, a child of the character.
- Trees: 16 pines in a ring behind and beside the clearing (3 models, instanced). Logs: 4 `log` props, three stacked.
- Dust: 36 points drifting downwind in an 8 x 2.4 x 8 m box. Haze: linear fog 14 to 46 m in the sky colour.
- Light: hemisphere + one sun, no shadows. A late afternoon that warms and cools over 4 minutes.

Motion (all in `menu-scene-rules.js`, pure functions of seconds):
| Rule | What | Period |
|---|---|---|
| `breath` | hands and plans rise 12 mm | 4.2 s |
| `weightShift` | lean and a small roll of the body | 11 s and 17.3 s mixed |
| `headTurn` | plans (pitch 0.34) to horizon (yaw 0.6) and back | 16 s, about 4 s looking up |
| `planRustle` | tilt and roll of the sheet, swelling with gusts | fast |
| `windSway` | each tree, own phase, at most 2 degrees | about 5 s, gusts 7.5 s |
| `cameraDrift` | ellipse 0.45 x 0.12 x 0.3 m around home | 38 s |
| `lightAt` | sun colour, strength, angle, sky colour | 240 s |
| `hazeAt` | each dust mote | drift |

Not in the first build, added since (see "Built after the first build"): grass and ferns moving in the wind, the drawing on the plans.

## Camera
Perspective, 36 degrees. Home 4.6 m to the side and 4.4 m in front of the character at 1.55 m, looking at chest height (tune).
On screens wider than 700 px a view offset moves the picture 17% to the right, so the character stands clear of the menu column on the left. The drift never changes the look-at point.

## Swap point for the ATV
`MENU_VEHICLE` in `dist/menu-scene-rules.js`:
```
export const MENU_VEHICLE={prop:'offroad',yaw:0,lean:{side:1,along:.7,gap:.24,angle:.13}};
```
To drop in the side by side: set `prop` to its prop id (any id `createProp` knows) and adjust `lean` (which side, how far along the hull, the gap, how far the spine tips). `leanSpot(vehicle,width)` works out where the character stands from the prop's own width. `menu-scene.js` never names a vehicle (a test checks that). A lower vehicle may need a seated or forearm pose: that is a follow-up, not a data change.

## Performance budget
The user's GPU does about 165 FPS in the game; the menu must cost far less than the game.
- Frame cap: 24 FPS (15 on low quality), `frameDue`. On a 165 Hz screen about 1 frame in 7 is drawn.
- Paused: menu hidden (credits, creator), tab in the background. Nothing is drawn or stepped.
- Built lazily on the first menu frame after the world's one warm-up draw; character assets must be ready.
- Disposed when the game starts (materials, textures, instanced meshes it made; shared cached geometry is left for the game). Going back to the menu reloads the page.
- Draw calls: about 14 (ground, dirt, vehicle + wheels on one material, logs, 6 tree meshes, character parts, plans, dust). 1 skinned character. No shadow pass.
- Per frame on the CPU: 16 tree matrices, 36 dust points, one mixer update.
- Extra load time: none (no new assets). Extra memory while the menu is up: one more copy of the vehicle and nature textures (the scene makes its own materials), freed on Play.

Risk, said first: the world is still built before the menu shows (as before), so first-load time is unchanged, not better.

## Fallback
The old picture (`assets/menu-background.jpg`) stays as `#welcome`'s inline background. The canvas only shows when `#welcome` has the class `live`, which is set after the first frame has drawn. The picture stays when: character assets are not loaded, the build or a frame throws (not retried), or `prefers-reduced-motion: reduce`. No WebGL at all: the game already stops with its own message before the menu.

## Appearance
`menuLive.setAppearance(draft)` is called where the creator saves, and calls the character's own `apply`. Edit character on the main menu now returns to the menu after saving (see "Built after the first build"), so the change is seen in the scene.

## Decisions taken without asking (simplest option each time)
1. A separate small scene, not a corner of the real map: no change to `world.js` or `map-definition.js`, and the town is not drawn.
2. Reduced motion shows the picture, not a frozen 3D frame.
3. The plans are a child of the character between the hands, not an item in `hold()`: `hold()` is one-handed and aligns to the forearm. Lean, reach and hand curl are the character's own.
4. `tests/startup.mjs` had "nothing is rendered while the menu is open"; it now means "the world is not redrawn".

## Built after the first build (2026-11-13): follow-ups 5, 3 and 4
Visuals still NOT verified by eye, and the wind shader has never been compiled by a real GPU (the tests use a renderer stub). Check these first in step 1.

**5. Edit character returns to the menu.** `creatorReturn({active,fromMenu})` in `menu-scene-rules.js`. `game.js`: Edit character on the main menu (`#customizeSaved`) sets `creatorFromMenu`; saving then shows `#welcome` again instead of starting the game, and the scene's character already has the new look (`menuLive.setAppearance`). Unchanged: Play with no character still starts the game on save; Edit character inside the game stays in the game; Back returns to the menu.

**3. Plans texture.** `MENU_PLANS` (data, millimetres on the 460 x 320 sheet) and `plansOps()` (a flat list of fill / line / circle / text steps) in `menu-scene-rules.js`; `menu-scene.js` `plansTexture()` only replays the steps on a 920 x 640 canvas. Drawn: forest ground, a creek, the haul road from the south edge to the landing (grey, with a log deck), skid tracks to four cut blocks (A1 felled with stumps, A2 today's in red, B1 and B2 planned and dashed), labels, title, north arrow, scale bar. Colours are `terrain.js` `MINIMAP_COLOUR` values (a test keeps them equal). The texture is turned 180 degrees so it reads the right way up for the character (tune: flip `texture.rotation` if it should face the camera). No canvas: the old blue panel stays.

**4. Ground cover.** `MENU_COVER` = 1,500 grass tufts + 70 ferns (low quality: 40%), placed by `groundCover()` in a ring 6.3 to 24 m from the vehicle, thickest near the clearing, none within 2.5 m of the camera's home. Shapes from `coverShape()`: a tuft is 7 blades (21 triangles), a fern 7 fronds (35 triangles); every triangle is drawn with both windings and an up normal, so about 68,000 triangles in all. Wind: `coverBend(t,x,z,bend)` = bend squared x (a lean downwind + a wave that runs downwind, both swelling with `gust`), at most 9 cm at a tip; `menu-scene.js` `windMaterial()` writes the same formula into a Lambert material's vertex shader (`onBeforeCompile`, numbers from `COVER_WIND`).
- Cost: +2 draw calls (about 16 in all), 1 shared material and program, 2 uniforms a frame, no per-frame CPU work on instances. No new assets. No real fern or grass model yet: these are plain coloured cards (a real model through `build-props.mjs` is still open).
- Cheaper option if the frame time shows it: lower `MENU_COVER.grass` (one number) or pass a smaller `cover` to `createMenuScene`.
- Risk: if the injected shader fails to compile on some driver, three.js logs an error and the cover does not draw; the rest of the scene is not affected.

Tests: `tests/menu-scene.mjs` (plans data and steps, placement, shapes, wind bounds, `creatorReturn`, and in the packaged game: Edit character comes back to the menu, the cover meshes and the plans texture are in the scene).

## Follow-up steps
Done: 3, 4 (cards, not a real model), 5.

| # | Step | Model | Size |
|---|---|---|---|
| 1 | Look at it on the real GPU: tune camera, lean gap, hand and plan positions, head turn axes and signs, light. Screenshots with `browser-lab`. | Sonnet | S |
| 2 | Swap in the ATV (side by side) at `MENU_VEHICLE` once its prop exists; add a pose for a low hull if needed. | Sonnet | S |
| 3 | Plans texture: a small canvas drawing of cut blocks and a landing, in the style of the game's map. | Haiku | S |
| 4 | Ground cover: grass tufts and ferns that move in the wind (needs a real model through `build-props.mjs`, or an instanced card with the wind in the vertex shader). | Sonnet | M |
| 5 | Edit character returns to the menu instead of starting the game, so the change is seen in the scene. | Sonnet | S |
| 6 | Soft shadows in the menu scene on high quality only, with a frame-time check. | Sonnet | S |
| 7 | Build the menu scene before the world and show it while the world loads (faster first picture). Touches the start-up order. | Opus | M |
| 8 | Sound: quiet wind and birds on the menu after the first click (`audio.js`). | Sonnet | S |
| 9 | Replace `menu-background.jpg` with a render of the new scene so the fallback matches. | Haiku | S |

## Fixes on 2026-11-13 (second review, NOT verified by eye)
- Time of day: the menu no longer uses the fixed 4-minute late afternoon (`lightAt`, now unused by the scene). `createMenuScene({minutes,renderer})` builds its own `createSky` (sky.js, the game's day and night rig) and calls `sky.update(saved minutes + t * 0.5)`, so dome, stars, sun or moon, hemisphere, fog colour and exposure follow the saved in-game time and keep running at game speed. game.js passes `GameState.progress.routine.minutes` and the renderer, and draws with `s.exposure()` instead of INDOOR_EXPOSURE. The menu keeps its own short fog distance (14 to 46 m). Night is dark, as in the game.
- Hands: HAND is now x .27 y 1.3 z .25 (wrist 4 cm outside the sheet's 23 cm edge), so the fists close around the sheet's side edges instead of through its face.
- Pines (pine.3 only): leaf cards get softened normals (`softLeaves`, a copy, pointing mostly away from the trunk) so the crown shades as one mass and not as torn planes; the leaf material uses alphaToCoverage with alphaTest .4 (smooth cut-out edges with MSAA); each tree gets a small non-uniform scale (width and height vary a few percent) so the one model does not repeat exactly. A real fix (cleaning pine.1 or a second model in `build-props.mjs`) is still open.

## Fixes on 2026-11-13 (menu review)
- First paint: `#welcome` no longer carries the old picture inline; the page starts on the dark `.main-menu` backdrop. The picture (`MENU_STILL` in `menu-scene-rules.js`) is put on by the controller's `setStill` only when the scene cannot run (build failed, reduced motion, assets still missing after 6 s).
- Frame cap: 60 (30 on low quality), was 24 (15). Idle loop seam closed in `character.js` `closeLoop` (shared with the creator). Plans sheet now faces the character (rotation Y = pi, lean 0.8 rad, plain paper back as a second mesh; the texture is no longer turned). Stray fourth log removed. `pine.1` is not used in the menu (bark stubs up to 1.8 m out of the trunk, seen as a hook). Game name: `dist/game-name.js`.