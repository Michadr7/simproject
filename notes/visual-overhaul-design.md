# Visual overhaul: audit and design note (Stage 1)

2026-11-13. Brief: `notes/visual-overhaul-brief.md`. No code was written for this note. Game version 0.35.4, three.js r160.
Every frame time below is an **estimate, not a measurement**: the agent's browser is software WebGL (about 4 FPS). Draw calls, triangles and light counts are measured from code (a read-only script that builds `createWorld` in Node and counts what a camera would draw). Numbers marked (tune) are first guesses.

## 1. Frame-rate risks first

Target: GTX 1060, 8 GB RAM, 1080p. Each risk has a cheaper option.

| # | Risk | Estimated cost | Cheaper option |
|---|---|---|---|
| 1 | **Player headlight as a real SpotLight (High).** To avoid a shader recompile when it switches on, the light must be in the scene from the start (intensity 0 by day), so every lit pixel pays for it all day. | 0.2 to 0.4 ms a frame on High, day and night | Low's ground decal for everyone (0 ms, +0 draw calls beyond the decal mesh). Or add the light only at night and accept one hitch (est. 0.3 to 1.5 s, once per session) |
| 2 | **Bloom (High, Stage 5).** `dist/vendor/` has no EffectComposer and the brief allows no new dependency, so post is hand-written: scene into a half-float target, 5 small passes, one full-screen composite. | 1.2 to 2.0 ms at 1080p; 3 to 5 ms if the pixel ratio stays at 1.6. GPU memory about 86 MB at 1080p with 4x MSAA, 220 MB at ratio 1.6 | Halo sprites on lamps (Stage 3 builds them anyway: 1 draw call, about 0 ms) and a CSS vignette. Stage 5 could then be dropped. Middle option: bloom at quarter size, no MSAA target, about 0.6 ms and 25 MB |
| 3 | **Shader recompiles.** three.js rebuilds every lit program when the number of lights, the shadow switch or the tone-mapping mode changes. The quality switch already does this today (`applyQuality` marks every material). | A hitch of 0.3 to 1.5 s each time | Rule for all stages: light count and tone-mapping mode are fixed after load. Sun and moon share ONE directional light. Nothing is added or removed at dusk; only numbers change |
| 4 | **The shadow pass is already the biggest cost on High** and is not new. Measured: 19 to 42 extra draw calls and 79,000 to 333,000 triangles redrawn every frame into a 2048 map (forest worst). A moving sun adds nothing to it. | Unchanged. Stage 4 should make it cheaper, not dearer | Tighten the shadow box from 130 m to 90 m (sharper and fewer casters); fade shadows out when the sun is under 12 degrees |
| 5 | **Draw calls at night.** +6 (or +7, see windows) on top of today's. By day +1 (the sky dome). | World alone is 48 to 141 in view (measured, section 2); the budget is 300 | Stars inside the dome shader (-1); skip lamp ground pools (-1) |
| 6 | **Window glow needs a mask texture per building texture.** | Up to 7 MB of GPU memory worst case (28 textures at 256 px); probably under 1 MB if the kit shares atlases (not checked) | Plan B: one instanced mesh of window panes (+1 draw call, about 900 triangles, no textures) |
| 7 | **Foliage wind (Stage 4)** runs in the vertex shader of up to 494,000 triangles (forest view). | Under 0.1 ms (a sine per vertex) | Wind on street trees only, or none |
| 8 | **Per-frame CPU.** The rig evaluates one pure function a frame (about 40 mixes). Windows change only when the clock crosses a 10-minute mark (every 20 real seconds, at most 56 writes). | Not measurable | None needed |

Not a new risk, but it matters for the target PC: the renderer asks for `powerPreference:'low-power'` (`game.js:95`). On a laptop with a 1060 and an Intel chip this can pick the Intel chip. See open question 6.

## 2. What exists now and what it costs

**Renderer** (`dist/game.js:94-97`, `830`): one `WebGLRenderer`, canvas antialias on, sRGB output, ACES filmic tone mapping at exposure 1.12, PCF soft shadows. Camera 52 degrees, far 700 m. One renderer draws the world, the interiors (their own scenes and lights), the character preview and the menu scene.

**Quality setting** (`applyQuality`, `game.js:830`; saved by `main-menu.js`, default `high`): High = pixel ratio up to 1.6 + shadows. Low = pixel ratio 1, no shadows. Nothing else differs. Switching marks every material for recompile. The menu also uses it (ground cover 40%, 15 FPS).

**Lights in the world scene: 2.** A hemisphere light (`#d8e8f0` over `#777655`, 1.7) with no variable kept, and one directional sun (`#ffe3b9`, 3.1). The sun follows the player at a fixed offset (-24, 30, 22) (`game.js:1093`): it never moves across the sky. No point or spot lights anywhere outdoors.

**Shadows (High only):** one 2048 map, a 130 x 130 m box around the player, bias -0.0005, redrawn every frame, not snapped to texels (edges can shimmer while walking; not verified by eye). 102 of 315 world meshes cast, 187 receive. Scenery trees do not cast; choppable trees and street trees do.

**Day and night today** (`game.js:1438`, every frame): `daylight = max(0.12, sin((minutes-360)/1440 x 2pi))`. Sunrise 06:00, peak 12:00, sunset 18:00. It changes the sun's strength (0.55 to 3.1) and the background and fog colour (night `rgb(0.16,0.20,0.27)`). **The hemisphere light never dims**, so night ground light is about 47% of day (about 71% as the eye sees it): the sky goes dark and the town does not. Nothing switches on at night.

**Fog:** linear, 65 to 155 m, in the background colour. Scenery is culled at 158 m (`MAP.scenery.view.distance`; `tests/culling.mjs` pins 155 to 200), so fog far must stay at or under 155.

**Sky:** a flat `scene.background` colour. The distant hills (`world.js:481-486`) are one unlit mesh whose vertex colours are baked from the fog colour once, at build: they stay day-bright at night.

**Materials (world scene):** 266 in all: 190 `MeshStandardMaterial` (158 with roughness 0.85 or more, 3 with any metalness, 50 textured, 90 double-sided), 50 `MeshBasicMaterial` and 26 line materials (almost all the plot overlay, hidden by default). Shader patches already in use, all through `onBeforeCompile`: the sightline fade (`world.js:166`, on trees and props), vehicle paint (`paint-shader.js`, which replaces rather than chains the hook), the menu's wind. A third patch on the same materials must chain; see the grade below for how this plan avoids that.

**Things that glow today: 3 materials**, all constant day and night: street-lamp heads (emissive 0.55), the fuel canopy's roof and columns (emissive 2, through the prop `glow` group in `props.js:23,46`).

**Street lamps:** 34 (19 along roads from `streetfurniture.js`, 15 in town from `town.js`), 2 instanced meshes (poles, heads), 2 draw calls.

**Buildings:** 56 landmarks, each its own mesh and its own material (40 different props). Houses, shops and industrial units are textured (windows are painted in the texture, not separate triangles); farm buildings and cars are vertex-coloured. 19 parked cars are single meshes (1 draw call each, and each casts a shadow).

**Vehicles:** no lamp geometry is marked on any model; no headlights. Key `L` is free. The vehicle panel is `vehicle-hud.js` (pure model, tested).

**Clock:** `GameState.progress.routine.minutes` (0 to 1440), 30 game minutes per real minute: a day is 48 real minutes. Sleep jumps the clock to 06:00. Shop hours are data (market 07:00 to 22:00, cafe 08:00 to 18:00). `population.js` and `schedule.js` can say who is home when, but nothing draws them yet.

**Menu** (`menu-scene.js`, `menu-scene-rules.js`): its own scene, hemisphere + sun, no shadows, fog 14 to 46 m, about 16 draw calls. `lightAt(t)` is a 4-minute loop of real seconds (warmth, sun strength, sky colour, angle); it does not read the saved clock. `tests/menu-scene.mjs:27` pins its range.

**Measured, world scene only** (not counted: the player, driven vehicles, remote players, markers, lazy Eastbank yards; those are `game.js` and were not measured):

| View | Draw calls | Triangles | Shadow pass: calls / triangles |
|---|---|---|---|
| Spawn, looking north | 134 | 174,000 | 27 / 79,000 |
| Spawn, looking east | 68 | 90,000 | 27 / 79,000 |
| Alder Center | 141 | 176,000 | 35 / 91,000 |
| Bridge | 55 | 402,000 | 42 / 292,000 |
| Forest | 48 | 494,000 | 19 / 333,000 |
| Farm | 114 | 384,000 | 29 / 240,000 |

Whole scene: 315 drawable meshes, 82 instanced. Trees: 925, all 1.08 M triangles, 37 to 379 drawn. The shadow counts are an approximation (casters within 92 m).

## 3. The rig: one pure function of the clock

New pure module `dist/sky-rules.js` (no three.js, no DOM). `skyAt(minutes, {nightFloor})` returns everything the frame needs. `dist/sky.js` applies it to the scene. The old line `game.js:1438` is replaced by one call.

**Sun and moon.** `theta = (minutes - 360) / 1440 x 2pi`; sun height `h = sin(theta)` (the same curve as today, so sunrise stays 06:00 and sunset 18:00). The sun travels a circle tilted 35 degrees to the south: direction `(cos theta, sin theta x 0.82, sin theta x 0.57)`: rises in the east (+x), 55 degrees high at noon in the south, sets in the west. The moon is the opposite point of the sky, so it is up exactly while the sun is down.

**One directional light for both.** It takes the direction of whichever body is above the horizon; its strength passes through 0 at the horizon, so the swap is not seen. The direction used for shading never drops under 8 degrees (no endless shadows). The light count stays at 2 (risk 3).

**Mood weights** from `h`: `day = smoothstep(0.10, 0.45, h)`, `night = smoothstep(-0.05, -0.30, h)`, `twilight = 1 - day - night`, which is dawn before noon and dusk after. On the clock: night 19:10 to 04:50; dawn 04:50 to 07:47 (fullest 05:48 to 06:23); day 07:47 to 16:13; dusk 16:13 to 19:10 (fullest 17:37 to 18:12). In real time: day 17 min, each twilight 6 min, night 19 min. Colours are mixed in linear space.

**The four moods** (all tune; colours as sRGB hex):

| | Dawn | Day | Dusk | Night |
|---|---|---|---|---|
| Sky top | `#5b7fa8` | `#4f8fd0` | `#3d4f86` | `#070b1c` |
| Horizon = fog colour | `#f2b98f` | `#bcd6e2` | `#f08a4b` | `#18233f` |
| Sun or moon light colour | `#ffc48a` | `#fff1d6` | `#ff9a55` | `#9db8ff` |
| Directional strength | 1.6 | 3.1 | 1.8 | 3.1 x NIGHT_FLOOR (0.37) |
| Hemisphere sky colour | `#c9d3e6` | `#d8e8f0` | `#c7b6c9` | `#6f86c8` |
| Hemisphere ground colour | `#6b5f52` | `#777655` | `#5c4a45` | `#1c2436` |
| Hemisphere strength | 1.0 | 1.7 | 0.9 | 1.7 x NIGHT_FLOOR (0.20) |
| Fog near / far (m) | 40 / 130 | 65 / 155 | 45 / 135 | 30 / 120 |
| Exposure | 1.05 | 1.12 | 1.05 | 1.00 |
| Stars | 0.15 | 0 | 0.10 | 1 |
| Glow (lamps, windows) | 0.6 | 0 | 0.7 | 1 |

Day keeps today's values, so noon looks as it does now apart from the sky gradient and the grade. Haze is strongest at dawn and dusk (Firewatch) and closest at night, where it hides the far town and makes headlights matter. Fog far never exceeds 155.

**Sky dome.** One sphere (768 triangles, 1 draw call, no depth write, follows the camera) with a small shader: top-to-horizon gradient `pow(1 - max(dir.y, 0), 3)`, optionally cut into 5 flat bands (the Firewatch look; tune, off is one number), a sun disc with a warm lobe along the horizon near it, a moon disc. It runs through the same tone mapping as the world, so the horizon and the fog match exactly. `scene.background` stays as the horizon colour: if the dome shader fails on some driver, the sky is flat as today.
**Stars:** 500 points, 1 draw call, hidden by day. **Distant hills:** the rig tints their material by (horizon now / horizon at day), found by name; no `world.js` change.
**Clouds and rain:** not in the brief's stages; left out (open question 7).

## 4. NIGHT_FLOOR

`NIGHT_FLOOR = 0.12` (tune): at full night the hemisphere and the moon are each the day value times this number, in the night colours. One number scales the whole unlit night; lamps, windows and headlights are not scaled by it.

How dark it reads (light is not linear to the eye; about `x^(1/2.2)`):

| NIGHT_FLOOR | Seen brightness of unlit ground against day | Feels like |
|---|---|---|
| 0.05 | 26% | near Valheim: shapes only |
| 0.08 | 32% | dark, kerbs still readable |
| **0.12** | **38%** | first guess: moonlit, street and ground readable |
| 0.20 | 48% | close to Firewatch's night |
| today's game | 71% | hardly night |

- Limits 0.04 to 0.30. **Dev slider** in the dev panel (`dev.js`), with two more: "time of day" (overrides the clock for the picture only; does not touch the save) and "exposure". The slider value is kept in `localStorage` under a dev key; the shipped number is the constant.
- Tests: night strengths equal day x NIGHT_FLOOR at every slider value; the ground colour `#8a9a7c` under midnight light, after exposure and grade, stays above a readable minimum (2% linear, about 15% on screen) at 0.04 and above; the night tint is bluer than it is red.

## 5. Colour grade

**Where:** inside three.js's tone-mapping step, not a post pass. r160 has an empty `CustomToneMapping(vec3)` in the shader chunk `tonemapping_pars_fragment` (`three.module.js:14032`). `sky.js` replaces that one function once at start-up and sets `renderer.toneMapping = CustomToneMapping`. Every built-in material gets the grade, instanced or not, with **no extra draw call, no extra pass, no per-material patch and no `world.js` change**. It replaces ACES (about the same work per pixel), so Low's frame time should not change (estimate).

**Curve** (in order, on linear colour after exposure; `l` = luminance):
1. Split tone: shadows towards blue (`x (0.86, 0.96, 1.12)`, fading out by `l = 0.35`), highlights towards warm (`x (1.06, 1.00, 0.92)`, from `l = 0.4`).
2. Saturation: 0.75 in deep shadow rising to 1.12 by `l = 0.25`. Dark things lose colour and lean blue, as eyes do at night; this gives the night look without knowing the time.
3. Shoulder: `c x (1 + c/16) / (1 + c)` per channel (white at 4). Softer than ACES and it keeps flat colours their hue; ACES pushes bright warm colours towards yellow-white.

The only value that changes over time is the exposure (already a renderer uniform). The mood comes from the light, fog and sky colours in the table; the grade is a fixed curve. The constants live once in `sky-rules.js` (`GRADE`), which also exports `grade(rgb, exposure)` in JavaScript for tests and builds the GLSL text from the same numbers.

Side effects to accept or fix in Stage 2: interiors, the character preview and the menu share the renderer, so they get the same curve (their exposure is set back to 1.12 while they draw). When Stage 5 renders into a target, three.js skips tone mapping there; the same function then runs in the composite pass instead.

## 6. Night lights

All glow, no real lights, except the one spotlight. `glow` (0 to 1) comes from the moods table; lamps count as on when `glow > 0.05`.

| What | How | Draw calls | When updated |
|---|---|---|---|
| Lamp heads (34) | the existing heads material: emissive 0.15 by day to 2.5 at night | 0 new | each frame, one number |
| Lamp halos | 34 points, soft round texture drawn on a 64 px canvas, additive, fogged | +1 at night | hidden by day |
| Lamp pools on the ground | 34 instanced discs, 7 m radius, bright centre to nothing, additive, 3 cm above the ground at `heightAt` | +1 at night (544 triangles) | hidden by day |
| House and shop windows | plan A: each building's own material gets an emissive mask made from its texture; lit = one number per building. Plan B if the textures do not separate cleanly: one instanced mesh of panes with a colour per pane | A: 0. B: +1 | when the clock crosses a 10-minute mark |
| Shop signs, fuel canopy | their existing materials: emissive follows `glow` (signs use their own picture as the glow map) | 0 new | each frame, one number |
| Vehicle lamps | one instanced mesh of small quads, white in front and red behind, capacity 64 | +1 | each frame for vehicles in use |
| Headlight beams (Low, and every vehicle but the player's on High) | one instanced ground decal: a fan 14 m long and 6 m wide from 1.5 m ahead of the bumper, bright to nothing, additive | +1 | each frame for vehicles in use |
| The player's own headlights (High) | ONE `SpotLight`: `#fff2d0`, reach 45 m, half-angle 24 degrees, soft edge 0.6, no shadow; a child of the vehicle | 0 | intensity only |
| Stars, sky dome | section 3 | +1 at night, +1 always | |

Night total: **+6 draw calls with windows plan A, +7 with plan B; +1 by day.** None of these meshes casts or receives shadows.

**Limits of glow, said plainly:** a ground pool brightens the ground only. A person or a wall standing in a lamp's pool is not lit by it. On High the player's spotlight does light what it hits. This is the price of "no real lights".

**Houses: the occupied-hours rule.** Pure, in `night-lights-rules.js`: `windowsLit(id, minutes)` with `r = hashOf(id)`:
- dark outside (`glow > 0.05`) AND
- evening: on from dusk (up to 40 minutes late, by `r`) until bedtime (21:30 to 23:45, by `r`); or morning: 05:30 to 07:00 for 4 houses in 10;
- 1 house in 8 is dark all night (away).
- Shops: lit while open and dark; the sign stays lit until closing. Industrial units: one in two keeps a light on all night.
Later, A2 can swap the hash for `schedule.js` (someone is home and awake) without changing the drawing.

**Vehicles.** New data in `vehicle-lights.js`: lamp positions per model, defaulting from the model's size (front: 0.33 x width either side, 0.38 x height, at the nose; rear mirrored) with overrides per model after a look. Pure rule: `headlightsOn({inUse, dark, override})`: on when in use and dark (driver in, or an NPC car moving); the player's key **L** cycles auto, on, off for the vehicle they are in, and the vehicle panel shows it ("L · Lights: auto (on)"). The choice lasts until you get out; it is **not saved** (no save-format change). Parked cars are dark. Remote players' vehicles follow the auto rule (no protocol change). NPC cars do not exist yet (A2): the interface takes any vehicle pose, so A2 only has to call it.

## 7. Quality tiers (GTX 1060, 8 GB)

| | Low (must keep today's frame rate) | High |
|---|---|---|
| Pixel ratio | 1 (as now) | up to 1.6 (as now); 1.25 while bloom is on (tune after measuring) |
| Sky dome, stars, moods, fog, grade | yes (+1 or +2 draw calls, grade replaces ACES) | yes |
| Night glow meshes | yes (+4 or +5 draw calls at night) | yes |
| Own headlights | ground decal | one SpotLight (risk 1) + the decal for the wide spill |
| Shadows | none; from Stage 4 soft blob discs under people and vehicles (1 instanced mesh, +1 draw call) | the existing sun shadow, tightened to 90 m, snapped to texels, faded at low sun; moon shadows on (same pass, no new cost) |
| Rim light, foliage wind, water | yes if under 0.1 ms measured, else High only | yes |
| Bloom | none (halo sprites do the job) | Stage 5, measured before it stays |
| Vignette | CSS gradient over the canvas (no GPU shader) | same |

Low's added cost is 2 to 7 draw calls of tiny meshes and no new per-pixel work beyond the dome. The claim "Low keeps today's frame rate" is still unverified until the user runs it.

**How costs get measured (built in Stage 2):** a line in the dev panel with `renderer.info` draw calls, triangles and program count, frame time (median and 95th percentile over 5 s) and GPU time from `EXT_disjoint_timer_query_webgl2` where the browser has it. The user reads the numbers on the real GPU at four fixed spots (spawn, Alder Center, bridge, forest) at noon and midnight, before and after each stage.

## 8. Stages 2 to 6: files and tests

Each stage: `npm run release -- --force`, then `npm test`; report files, real test results, measured counts and what is unverified. `town.js` and `map-definition.js` are not touched in any stage. `world.js`: one additive line in Stage 3 at most (see there).

**Stage 2: sky and day/night rig**
- New: `dist/sky-rules.js` (pure: `skyAt`, `sunDirection`, mood weights, `MOODS`, `NIGHT_FLOOR`, `GRADE`, `grade`, GLSL text), `dist/sky.js` (dome, stars, applies `skyAt`, installs the grade, tints the hills), `tests/sky.mjs`.
- Changed: `dist/game.js` (keep the hemisphere light in a variable; replace line 1438 with `sky.update(minutes)`; move the sun offset in line 1093 to the rig's direction; set exposure back for interiors and the preview), `dist/dev.js` (three sliders, the cost line).
- Tests: every output finite and in range for all 1,440 minutes; continuous (no step above a small bound between minutes, and none across midnight); sunrise 06:00 and sunset 18:00; sun in the south at noon, moon opposite; light direction never under 8 degrees; weights sum to 1; noon equals the day column and midnight the night column; NIGHT_FLOOR tests (section 4); fog far at most 155; `grade` rises with input, stays in 0 to 1, keeps grey nearly grey in the mids and turns darks blue; the GLSL text contains the same constants. Packaged game (`boot-game`): the scene has the dome and one directional light, and the light count is the same at 12:00 and 00:00.
- Existing tests at risk: `startup.mjs`, `culling.mjs` (fog far), anything that reads `scene.background`.

**Stage 3: night lights**
- New: `dist/night-lights-rules.js` (pure: `windowsLit`, `headlightsOn`, lamp glow, pool and beam shapes), `dist/night-lights.js` (halos, pools, windows, signs), `dist/vehicle-lights.js` (lamp data, the two instanced meshes, the spotlight), `tests/night-lights.mjs`.
- Changed: `dist/game.js` (create and update; key L; pass poses of vehicles in use), `dist/vehicle-hud.js` (the lights line), `dist/index.html` and `dist/style.css` only if the panel needs a new row, `dist/driving.js` (expose "in use" and the pose if not already there). `world.js`: nothing if the lamp heads, signs and canopy can be found by name (the heads are `street-lamp-heads`); otherwise one line that returns the lamp spots.
- First job in the stage: look at the building textures to choose windows plan A or B, and report which.
- Tests: `windowsLit` (never lit at noon; most houses lit at 20:00; every house dark from 00:00 to 05:30; morning share; the away share; the same answer for the same house and minute; shops follow their hours); `headlightsOn` truth table; the key cycles auto, on, off and the panel model shows it; lamp positions for every drivable model lie inside its footprint; pools sit at `heightAt`; night adds at most 7 draw calls (counted from the scene); in the packaged game no light is added or removed between noon and midnight; Low has no SpotLight.

**Stage 4: shadows (High) and the materials pass**
- New: `dist/shadow-rules.js` (pure: texel snapping, box size, fade by sun height), `dist/blob-shadows.js` (Low), `tests/shadows.mjs`.
- Changed: `dist/game.js` (shadow box 90 m, snap, fade), `dist/sky.js` (rim light as one more global chunk edit: no per-material patch), `dist/nature.js` (wind on the two leaf materials; must chain with the sightline fade's hook and set a program cache key), a small patch on the river material applied from `sky.js` or a new `dist/water.js` (found by name `river`).
- Tests: snapping moves the box in whole texels; fade is 0 under 6 degrees and 1 over 12; blob count stays within capacity; wind offset bounded (at most 5 cm at a tip) and zero at the trunk; the tree hash and counts in `map.mjs` unchanged; `nature.mjs` draw-call limit unchanged.
- Known limit: tree shadows will not sway (the depth pass has no wind); at 5 cm it should not show.

**Stage 5: post (High only)**
- New: `dist/post.js` (targets, bright pass, blur chain, composite with the grade), `dist/post-rules.js` (pure: sizes, thresholds, when post runs), `tests/post.mjs`.
- Changed: `dist/game.js` (render through post on High outdoors only; resize; quality switch frees the targets), `dist/style.css` (CSS vignette, both tiers).
- Tests: post is off on Low, indoors and in the menu; target sizes for a given canvas and ratio; targets freed on switch to Low; the packaged game still draws with the renderer stub (the stub needs `setRenderTarget`: `tests/support/boot-game.mjs` and `startup.mjs` change).
- Go or no-go: the user measures bloom on and off. If it costs over 1.5 ms at 1080p, ship the quarter-size version or none.

**Stage 6: menu**
- Changed: `dist/menu-scene-rules.js` (remove `lightAt`; add `menuMood(minutes)`: the saved time snapped to the nearest of the four moods, blended over the mood edges so 17:00 is part day, part dusk), `dist/menu-scene.js` (use `skyAt` and a small dome; fog distances stay the menu's own 14 to 46 m; at night the vehicle's lamps glow), `dist/game.js` (pass `GameState.progress.routine.minutes`), `tests/menu-scene.mjs` (drop the `lightAt` checks, add the mood checks), `notes/menu-scene-design.md`.
- Tests: 12:00 gives day, 00:00 night, 06:00 dawn, 18:00 dusk; a new profile (no saved time) gives day; the mood does not change while the menu is open (the clock is stopped there); menu draw calls stay at or under 20.

## 9. Decisions taken in this note (say no to any of them)

1. Sun and moon share one directional light; the light count never changes.
2. The grade lives in the tone-mapping function, not in a post pass, so Low gets it for free.
3. Sunrise 06:00 and sunset 18:00 stay; night is 19:10 to 04:50.
4. Day values stay as today; the visible change at noon is the sky gradient, the haze colour and the grade.
5. Fog far never exceeds 155 m, so culling is untouched.
6. Headlight choice is not saved and not sent to other players.
7. Windows follow a hash rule now; `schedule.js` can replace it in A2.
8. No clouds, rain, flashlight or interior changes in these stages.
9. The vignette is CSS on both tiers.

## 10. Open questions for the user

1. **Spotlight (risk 1):** always in the scene on High (est. 0.2 to 0.4 ms all day, no hitch), or added at night (one hitch), or decal only?
2. **Bloom (risk 2):** build Stage 5 at all, or stop at halo sprites and the CSS vignette and decide after seeing Stage 3?
3. **NIGHT_FLOOR 0.12** as the starting point, and should the slider reach players later (a "night brightness" setting) or stay dev-only?
4. **Banded sky** (5 flat bands, more Firewatch) or a smooth gradient as the default?
5. **Headlight key L** and the three states auto, on, off: fine? Should the choice be saved per vehicle later (a save-format change)?
6. **`powerPreference`:** change `'low-power'` to `'high-performance'` on High? It affects which GPU a laptop uses, and battery life.
7. **Clouds** (a second dome layer, +1 draw call): add to Stage 2, or later?
8. **Night length:** 19 real minutes of a 48-minute day is dark. Shorter nights are one number (the tilt of the `h` thresholds); wanted?
9. **Interiors at night:** they keep their own fixed lights for now, so a house is day-bright inside at midnight. Leave for the interior plan (DESIGN 4.x, switchable lights)?

## 11. Unverified

- Every frame time and every "should not change" claim. Nothing was run on a real GPU.
- The look of every colour in the moods table and of the grade curve: numbers only, never seen.
- Draw-call and shadow figures cover `world.js` only and come from a script's own frustum test, not from `renderer.info`. The shadow figures are approximate.
- Whether building textures let windows be masked (plan A); whether atlases are shared (the memory figure).
- That replacing the `CustomToneMapping` chunk compiles on the user's driver (the function exists in r160 at `three.module.js:14032`; the edit itself is untested).
- That lamp heads, signs and the canopy can all be reached by name without a `world.js` line.
- The 0.3 to 1.5 s recompile hitch and the bloom memory sizes are reasoned from how three.js r160 works, not timed.
- `game.js` was read at the lines named here, not whole.

## 12. The user's answers to section 10 (2026-11-13)

1. Spotlight: on High it is **added at night only**, not always in the scene (one hitch accepted). Stage 3.
2. **No bloom.** Halo sprites and a CSS vignette instead. **Stage 5 bloom is dropped**; the vignette moves to Stage 3 (not built yet).
3. NIGHT_FLOOR 0.12 is the start. The slider is **dev-only**.
4. **Smooth** sky gradient with a warm Firewatch horizon. No bands.
5. Key L with three states (auto, on, off); not saved per vehicle. Stage 3.
6. `powerPreference` is `'high-performance'` on High.
7. Clouds later.
8. **Shorter night:** all night from about 19:40 to 04:20. Sunrise 06:00 and sunset 18:00 stay.
9. Interiors stay day-bright for now.

## 13. Stage 2 as built (2026-11-13)

Where this differs from sections 3 to 8, this section is the truth.

**Files.** New: `dist/daynight.js` (pure; the name replaces `sky-rules.js`), `dist/sky.js`, `tests/daynight.mjs`. Changed: `dist/game.js`, `dist/dev.js`, `tests/dev.mjs`. Not touched: `world.js`, `town.js`, `map-definition.js` (the hills are found by their name, `distant-hills`).

**Night length.** `night = smoothstep(-0.08, -0.4226, h)` (was -0.05 to -0.30): all night 19:40 to 04:20, about 17 real minutes of 48 (it was 19). Day is unchanged (all day 07:47 to 16:13). Dusk therefore runs from 16:13 to 19:40 and dawn from 04:20 to 07:47.

**Moods table changes** against section 3: dawn and dusk hemisphere strength 1.4 and 1.3 (were 1.0 and 0.9), because the directional light is 0 at the horizon and the hemisphere has to carry sunrise and sunset; dawn and dusk hemisphere sky colours `#d6cfe0` and `#d9b9c2`; night light `#b4c8ff`, night hemisphere `#8fa3dc` over `#2a3450` (lighter, so NIGHT_FLOOR means what it says); stars 0 at dawn and dusk (they showed against the orange sky in the screenshots), so stars follow the night share only.

**The one light.** Above the horizon it is the sun: twilight and day colours mixed by the day share, strength x `smoothstep(0, 0.10, h)`. Below it is the moon: the night colour, `3.1 x NIGHT_FLOOR x smoothstep(0, 0.25, -h)`. Both are 0 at 06:00 and 18:00, so the swap is not seen. The moon is the opposite point of the sky, so the midnight moon stands exactly where the noon sun stood. The light sits 60 m from the player along that direction (it was a fixed offset of 44 m).

**Rooms in the world scene** (shops, the office, the warehouse; `shop` is set in `game.js`): the two lights keep their noon values and the exposure is 1.12 while you are inside; the sky and fog outside still follow the clock. Houses and the apartment are their own scenes with their own lights: only the exposure is set back to 1.12. The same for the character preview and the menu.

**Grade.** As section 5, with two additions: a gain of 1.6 before the curve (so mid grey lands where ACES at 1.12 put it; without it day was clearly darker) and white at 3, not 4. It applies to everything the renderer draws, the menu and interiors included. `GRADE` in `daynight.js` holds every number; `grade()` is the JavaScript twin.

**Readability numbers** (unlit ground `#8a9a7c`, after exposure and grade, from the pure functions): noon 0.41 linear (67% on screen); midnight at floor 0.04: 0.012 (11%); 0.08: 0.024 (17%); **0.12: 0.036 (21%)**; 0.20: 0.058 (27%); 0.30: 0.085 (32%). The 2% linear minimum of section 4 holds from about 0.07 up, not at 0.04; the test pins 0.8% at 0.04 and 2% at 0.12. Section 4's "seen brightness" column was too optimistic: 0.12 is about 31% of day on screen, not 38%.

**Sky.** One dome (720 triangles, 1 draw call, always) and one Points object of 600 stars (1 draw call, hidden when the night share is under 2%). Both ignore the camera's position in their vertex shader, so they need no per-frame move and work for the scene editor's camera too. The stars are deliberately not `transparent`, so they stay in the opaque list and are drawn right after the dome, never over the world. **Draw calls: +1 by day, +2 at night** (by construction; not read from `renderer.info`). No light, no texture, no render target added.

**powerPreference.** Read from the saved quality setting when the page loads (`loadSettings`): High asks for `'high-performance'`, Low keeps `'low-power'`. A WebGL context cannot change this later, so switching quality in the menu takes effect on the next page load.

**Dev panel** (Dev Mode, F2), section "Sky and light": "Look at" (a time of day for the picture only; the clock and the save are not touched; "Follow clock" drops it, and so does setting the real clock), "Night floor" (0.04 to 0.30), "Exposure" (x 0.5 to x 2), "Reset look", and the cost line (draw calls, triangles and shader count from `renderer.info`, frame time median and 95th percentile over the last 5 s; on High the draw calls include the shadow pass). Night floor and exposure are kept in `localStorage` under `citylife.dev.sky.v1`, never in the save. GPU timer queries were not built.

**Seen in screenshots** (software WebGL, High, spawn and Alder Center): noon, 06:07, 07:02, 17:52, 17:58, 18:50, 19:59 and 00:02. The gradient, the warm horizon and fog at dawn and dusk, the tinted hills, long low-sun shadows, the dark blue readable night and the stars all draw; no shader error. **Not seen:** the sun disc and the moon disc themselves (never in frame), any frame time, any real GPU.

**Still open for later stages:** the menu still runs its own `lightAt` (Stage 6) but already gets the new grade; shadows are not yet faded at low sun or tightened (Stage 4); nothing glows more at night yet (Stage 3).

## 14. Stage 3 as built (2026-11-13)

Where this differs from sections 6 to 8, this section is the truth. Stage 2's look (the moods, the floor, the grade, the sky) was not changed.

**Files.** New: `dist/night-lights-rules.js` (pure: every rule and number), `dist/night-lights.js` (three.js: draws them; it also holds the vehicle lamps and the spotlight, so there is no separate `vehicle-lights.js`), `tests/night-lights.mjs`. Changed: `dist/game.js` (9 single-line hooks: two imports, two lists `cityWindows` and `cityLampHeads` filled where the old city's window boxes and six Oak Street lamp heads are built, create, key L, the panel row, one update call a frame, the dev and `?debug` hooks), `dist/vehicle-hud.js` (the `lights` row), `dist/dev.js` (a "Lights" slider and a lights line), `dist/index.html` (one row on the Controls screen: L), `tests/dev.mjs`. **Not touched:** `world.js`, `town.js`, `map-definition.js`, `driving.js`, `props.js`, `style.css`, the menu files. The lamp heads are found by name (`street-lamp-heads`) and their spots read back from the instanced mesh; the buildings are found by their mesh name (`prop-<model>`) at the landmark's spot.

**When it is dark.** Two numbers from the rig (`sky.state()`, so the dev panel's "Look at" moves the lights too):
- the **switch** follows the sun's height (`smoothstep(0.12, -0.05, h)`): lamps start to come on at 17:32, are fully switched at 18:11, and the mirror image at sunrise (05:49 to 06:28). "Dark" (windows may be lit, headlights on auto) is the middle of it: **17:52 to 06:08**;
- the **strength** is the switch x (0.45 + 0.55 x the night share of `daynight.js`): 45% at sunset, 100% in full night (19:40 to 04:20). So lamps are lit through dusk, as street lamps are, and reach full strength with the night share.

**Draw calls: +2 while it is dark, 0 by day** (by construction and counted by the tests from what is visible; not read from `renderer.info` on a real GPU). Section 6 planned +4 or +5.
- `night-sprites`: ONE instanced mesh of camera-facing soft discs, additive: a halo at each of the 40 lamp heads (34 street lamps + the 6 old Oak Street lamps) and four per lit vehicle (two white in front, two red behind; room for 8 vehicles).
- `night-ground`: ONE mesh of additive ground patches: a round pool of 7 m under every lamp (built once on the ground's height) and one beam fan per lit vehicle (15 m long, 2.2 m to 7 m wide, rewritten each frame from the ground height: 18 height lookups per lit vehicle).
- Triangles: 2,400 for the pools, 80 for the halos, 28 per lit vehicle: **at most 2,704**. No texture, no render target. Both meshes fade into the fog by hand (additive light must fade to nothing, not to the fog colour), cast and receive no shadow, and are hidden by day.
- Switching headlights on by day with L shows both meshes for the vehicle alone (+2 by day in that case only).
- The patches float 0.2 m above the ground height. At 0.04 m a pool that spans a kerb or a raised yard cut under the higher side (seen in a screenshot at Eastbank); 0.2 m is more than the tallest kerb (0.185 m). Price: the patch also tints the lowest 20 cm of a car or a foot standing in it.

**Lamp heads.** The existing heads material: emissive 0.55 by day (unchanged) to 2.6 at full strength; one number a frame, 0 draw calls. The six hand-built Oak Street lamp heads (`game.js`) now share one emissive material (0 by day, so they look as before by day).

**Windows: plan A, with no extra draw call.** Checked first, as section 8 asked: the Kenney houses, shops and industrial units all use small palette textures (128 x 128; three distinct textures for 23 buildings), and every window is mapped to one light-blue gradient strip of that palette (`#cbe4fe` to `#6c98db`), which nothing else on the models uses (measured per model: 3 to 31 m2 of glass each; all triangles that touch the strip lie wholly in it). So `night-lights.js` decodes each distinct texture once in the browser, makes a mask (white where the texel is glass: `isGlass` in the rules) and sets it as the building material's `emissiveMap`. Each building already had its own material, so **one number lights one building**. Memory: 3 masks x 64 kB = 192 kB. One shader recompile per building material when the mask arrives, at load.
- The old city (Oak Street, built from boxes in `game.js`): its 171 window boxes swap between two shared materials, dark (as built) and lit. Every window is a flat of its own. 0 draw calls added (those 171 boxes were already 171 draw calls of their own; that is old cost, not changed here, and worth merging one day).
- **Not lit:** the Store model (`alder-store`, `riden-deals`: its own texture, its glass was not checked), the farm barns, the hut and the sawmill (vertex colours, no window swatch), parked cars.

**The occupied-hours rule** (`windowsLit(id, minutes, {kind, dark})`, a hash of the id; the same id and minute always give the same answer; worked out again only when the clock crosses a 10-minute mark, or dark flips, or the player's homes change):
- `home` (a house someone lives in, each city flat): on from dusk, up to 40 minutes late (17:52 to 18:32), until bedtime (21:30 to 23:45); 4 in 10 are up early (from 05:30 to 06:00 until it is light); 1 in 8 is away all night. Every home is dark from 23:45 to 05:30.
- `vacant`: the four houses for rent or sale (R1, R3, R5, R7) stay dark **until the player rents or buys one**; then it follows the `home` rule (the player's own presence is not checked: A2 can swap the hash for `schedule.js`).
- `shop` (Alder's shops): while dark and before 21:00. `office` (offices, tower, bank, cinema): until 19:30, and one in two leaves a light on all night. `always`: the police station and the gas kiosk. `works` (industrial units): one in two keeps a light on all night.
- Seen at 20:30 in the running game: 157 of 194 windows-or-buildings lit; at 00:00: 5.

**Vehicles.** `headlightsOn({inUse, dark, mode})`: on when in use and (the switch says on, or it says auto and it is dark). A vehicle nobody uses is dark whatever the switch says.
- In use: the vehicle the player drives (driver's seat; a passenger has no switch and nobody is driving), and the customer truck and the dock truck while they drive in or out (dark once parked). Parked cars, the lot's display vehicles and your own parked vehicles are dark.
- **Key L** (it was free) cycles auto, on, off for the vehicle you drive. The vehicle panel shows a row "L · Lights: auto (on)"; the Controls screen lists it. The switch goes back to auto when you get out; it is not saved and not sent to other players.
- Lamp spots per model are data (`VEHICLE_LAMPS`: Worktruck, Off Road Pickup, Flatbed), first guesses from the models' shapes; a model without an entry gets them from its size (ready for A2's cars).
- **Low:** sprites and the beam on the ground. **High:** the same plus ONE `SpotLight` for the player's own vehicle (`#fff2d0`, 420 cd, reach 48 m, half-angle 24 degrees, no shadow), and the ground beam drops to 45% so the two do not add up. Per the user's answer 12.1 it is **night-only**: put in the scene the first time it is needed in the dark, taken out when day comes or the quality drops to Low. Each of those two moments recompiles every lit shader (the accepted hitch). While it is dark and the lamps are merely switched off, or you get out, it stays in at strength 0 (no hitch for a key press; its per-pixel cost, est. 0.2 to 0.4 ms on High, runs until morning).
- Remote players' vehicles: not done. The multiplayer code was not read for how a remote player in a vehicle is drawn; nothing lights them yet.

**Dev panel** (F2, "Sky and light"): a new "Lights" slider (x 0.25 to x 3: every glow and the spotlight; kept in this browser with the other two) and a line: lamp level, windows lit, vehicles lit, whether the spotlight is in the scene, draw calls added. "Look at" moves the lights with the picture.

**Tests** (`tests/night-lights.mjs`): the switch and level over all 1,440 minutes (bounded, continuous, off 06:30 to 17:30, full 19:45 to 04:15, dark 17:52 to 06:08); the window rule (never when not dark, most homes at 20:00, none 23:46 to 05:30, the morning and away shares, deterministic, shops and offices by their hours); every landmark's kind from the map; the glass swatch; the headlight truth table, the key cycle and the panel row; lamp spots inside every drivable model's hull; the beam and pool shapes; the spotlight plan; then on three.js without a renderer (two objects added, no light added, pools on the ground, 0 draw calls by day and 2 at night whatever is lit, capacity never overflows, at most 2,704 triangles); then the packaged game (40 halos and pools, nothing added or removed between noon and night, getting in at night turns the lamps on, L cycles, High adds exactly one SpotLight and Low none, day removes it, a parked vehicle is dark, the switch is not saved).

**Seen in screenshots** (software WebGL, about 4 FPS; High unless said): Oak Street, Alder Center, Cedar Heights and Eastbank at 20:30 (halos, pools, lit Kenney windows, lit city flats, the vacant house dark); Alder at 18:20 (windows on at dusk); the Worktruck and the Off Road Pickup at midnight (white lamps, red tail lamps, beam, the SpotLight lighting the ground and a wall); the Off Road Pickup and the Flatbed on Low (beam and lamps, no spotlight). No shader error.

**Unverified, said plainly.**
- Every frame time. Nothing ran on a real GPU: that Low keeps its frame rate, the spotlight's cost, the length of the recompile hitch.
- Draw calls on a real GPU (`renderer.info`): the +2 is by construction and from the scene, not measured. The dev panel's cost line shows the real number.
- The strengths, by eye, on a real screen: halo size and strength, pool strength (0.13), window glow (1.25), beam (0.2), spotlight (420). All are single numbers in `night-lights-rules.js`; the "Lights" slider scales them together.
- Lamp spots: the Flatbed's headlamps were not seen from the front; the Worktruck's and the pickup's were seen only at an angle.
- The customer and dock trucks with their lamps on (not seen); the beam on slopes, bridges and across kerbs while driving (not seen moving); whether the floating patches show an edge against walls or flicker.
- Lamp light does not light what stands in it: a person or a wall in a pool stays dark (only the High spotlight lights what it hits). Whether that reads as wrong at night is for the user's eye.
- The beam does not stop at walls: on Low it can show on the ground on the far side of a thin wall.

**Not built in this stage:** shop signs and the fuel canopy following the night (the canopy keeps its constant glow of 2; the sign boards are unlit `MeshBasicMaterial`, so they are drawn at full brightness day and night and already read as lit signs), the Store model's windows, remote players' vehicle lamps, the CSS vignette that answer 12.2 moved here (`style.css` was being changed by another task), interiors at night (answer 12.9).
