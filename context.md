# City Life: context for a new chat

Read this first (about 5 minutes). Then `README.md` (a section per version, newest last), `DESIGN.md` (the plan, which Claude model for which task) and `ASSETS.md` (every model and licence) when you need detail.

## What it is
A buildless Three.js browser city sim (no bundler: plain ES modules in `dist/`, Three.js vendored in `dist/vendor/`). Third-person walking, jobs, shops, renting and buying homes, a lumberjack skill, a 540 x 480 m map of six districts, local multiplayer positions. **Current version: 0.32.0** (not deployed). `package.json` says the same.
Windows 11, VS Code, PowerShell 5.1. The user plays on a real GPU (about 165 FPS) and sends screenshots; the agent's browser only has software WebGL (about 4 FPS).

## How the user wants you to work (standing)
- **Name the Claude model for each task** (Haiku 5.5 for tiny edits and number tweaks, Sonnet 5.5 to build and refactor against tests, Opus 5.5 for design, save formats and multiplayer). `DESIGN.md` has the convention.
- **Flag anything that could hurt frame rate before building it**, with a number and a cheaper alternative (budget at the end of this file).
- **Run `npm test` after each change** and report failures honestly. No claiming it works without checking; look at screenshots when something is visual.
- **Keep the 0.31 town files** (`town.js`, `world.js`, `map-definition.js`): change them only minimally and additively, and say so. (0.32.0 added one function and a ground-layer fix to `world.js` and changed tree data.)
- Real assets over fake ones (no cylinder-and-blob trees, no box cars). If a model is missing, say what is missing instead of faking it quietly.
- Say plainly when something could not be reproduced or verified.

## Commands
| | |
|---|---|
| `npm test` | every `tests/*.mjs` in its own process (49 files). **Run `npm run release -- --force` first** if you changed anything in `dist/`: `startup`, `rescue`, `dev`, `real-models`, `house-signs`, `main-menu-return` run the *packaged release* that `dist/index.html` points at, not `dist/*.js` |
| `npm run release -- --force` | rebuilds `dist/releases/<package.json version>/` (copies every `dist/*.js`, `style.css`, `vendor/`) and points `index.html` at it. Released folders are immutable and cached, so `--force` only for a version never deployed; otherwise bump the version |
| `npm run dev` | **the dev server**: serves `dist/` at http://localhost:8000 and lets the dev panel's interior editor save into the code (see below). Use this, not `python -m http.server`, when editing interiors |
| `npm run server` / `server:lan` | the multiplayer relay (ws://localhost:8080); `:lan` opens it to the network (no login) |
| `node scripts/browser-lab.mjs <outDir> <scenario.json>` | headless Edge over DevTools: screenshots, A/B pixel checks, z-fighting `measure`. Header comment has the scenario format; sample in `scripts/browser-lab.sample.json`. Needs `npm run dev` running |

## Environment gotchas (these cost real time)
- **`git` is not on PATH** in the agent's shell: no commits or diffs; tell the user changes are uncommitted.
- **PowerShell 5.1 `Set-Content -Encoding utf8` writes a BOM**, which breaks `JSON.parse` (it killed `package.json` once). Write files with `[IO.File]::WriteAllText(path, text, (New-Object Text.UTF8Encoding $false))`.
- Multi-line `Edit` matches on `dist/world.js` and `dist/game.js` often fail (indentation); use single-line anchors with `.Replace()` in PowerShell, and check each swap landed. `game.js` is dense on purpose (one statement per line, long lines): match the style.
- PowerShell double-quoted strings eat backticks; use single-quoted here-strings for JS.
- The agent's scratch directory is outside the repo; do not leave temp files in the project.

## File map (`dist/`)
**Game loop and UI:** `game.js` (everything wired together; the frame loop `frame()`, `stepWorld()`, interactions, the dev block at the end), `index.html` (all HUD and menu markup; `#welcome` is the main menu), `style.css`, `main-menu.js` (menu, host/join address parsing, settings), `phone.js`, `inventory-ui.js`, `store.js`.
**World (data first):** `map-definition.js` (the whole map as data + `validateMap`), `world.js` (builds zones, ground, trees, props; layout of every generated tree), `terrain.js` (0.5 m walkability/surface mask), `town.js` (Alder Center's street furniture, markings), `props.js` + `props-assets.js` (converted models, 4 MB), `nature.js` + `nature-assets.js` (Quaternius trees), `vehicle-parts.js`, `house-signs.js`.
**People and rules (pure, tested):** `state.js`, `profile.js` (save: key `citylife.profile.v1`), `jobs.js` (`normalizeProgress`), `contracts.js`, `housing.js`, `ownership.js`, `life.js`, `routine.js` (clock, hours), `inventory.js`, `items.js`, `skills.js`, `grid.js` (plots, chopping, regrowth), `timestep.js`.
**Characters:** `character.js` + `character-male.js`/`character-female.js` (embedded glTF), `neighborhood.js` (pedestrians, the three Oak Street cars), `appearance.js`.
**Interiors:** `interiors.js` (house layout generator, saved-layout override, `layoutProblems`), `interior-layouts.js` (**saved layouts, written by the editor**), `interior-edit.js` (editing rules), `shops.js`, `apartment.js`, `indoor-camera.js`.
**Safety and dev:** `safe-spot.js` (nearest clear spot), `dev-flag.js` (the one switch) + `dev.js` (Dev Mode panel, removable).
**Elsewhere:** `server.js` (relay), `scripts/` (release, dev server, build converters, browser lab), `tests/` (+ `tests/support/boot-game.mjs`, which boots the packaged game in Node with a fake DOM and renderer).

## Ideas that hold the code together
- **Data first, pure transactions.** The map, interiors, items and rules are data; changes are pure functions (`state, action -> new state or error`) with tests. Money is **integer cents**. Saves are normalised on load (`normalizeProgress`), unknown fields dropped, schema number for real migrations (`progress.schema`, now 2).
- **One placement path.** Reset (R), teleport, unstick, loading a saved position and the stuck rescue all go through `placeSafely` -> `safe-spot.js` (nearest clear spot, 0.75 m of room, not a closed pocket under 300 m2). Event-driven, never per frame.
- **Coordinates:** 1 unit = 1 m, +Y up, north is -z, the player is 1.95 m. Spawn (-5, 15). Zones: Westside city (x -61..58, z -48..48), Alder Center (z -125..-48), Cedar Heights (x 70..170, z -135..-40), Eastbank Works (x 70..190, z -20..75), Willow Fields (farm, x -170..-35, z -286..-178), Pine Ridge (forest, x -25..190, z -316..-216); the river and two bridges between. Everything walkable except water; solid things have colliders.
- **Time:** real time is cut into slices of at most 1/30 s (`timestep.js`); the game clock runs 30 game minutes per real minute while playing.
- **Rendering:** ground is a stack of flat layers; each gets a **depth bias by its height** (`GROUND_LAYERS` in `world.js`), because layers millimetres apart z-fight at a distance (this was the "white flicker when looking down"). Trees between the camera and the player dissolve with a screen-space Bayer dither shader (`createSightlineFade`); every tree/prop material goes through `fade.apply`. Trees are instanced and culled by distance.
- **Interiors are separate scenes** built on first entry (houses: `buildHouseRoom`). The outdoor scene is not drawn while inside.

## Dev tools (all removable)
- **Dev Mode** (main menu button, then **F2**): teleport, time, money, spawn items, Rendering switches (shadows, tree dissolve), unstick, and the **Interior editor**. One flag: `DEV_MODE` in `dev-flag.js`; with it `false`, `dev.js` is never loaded. Deleting `dev-flag.js`, `dev.js`, `interior-edit.js` and the `DEV_MODE` import and block at the end of `game.js` removes it all. A test checks `index.html`/`style.css` hold nothing of it. Dev changes go to the normal save.
- **Interior editor** (left panel): go inside *any* house, pick a piece, move it by compass (N is the kitchen wall, S is the door; 25 cm or 5 cm steps), turn, copy, delete, add; a yellow box shows the piece; the layout's problems are listed live (blocked door, overlaps, nothing reachable); **Save to code** POSTs to `npm run dev`, which rewrites `dist/interior-layouts.js` and the same file in the current release (so a reload shows it); without the dev server it copies the JSON to the clipboard. Layouts are per house *model* (`house-a`...). Stairs and the bathroom walls always come from the generator. `Reset to generated` is live only until you save.
- `?debug` on the URL exposes `window.__city` (teleport, place, view, give, scene, camera...). The browser lab uses it.

## Where things are, by task
| To... | Look at |
|---|---|
| change the map, roads, plots, props, hours | `map-definition.js` (then `npm test`: `map.mjs` pins forest tree counts and a hash; update them deliberately) |
| add a model | `scripts/build-props.mjs` (needs the originals in `assets-src/`, which are **not in the repo**), `ASSETS.md`, `credits.js` (a test fails without a credit) |
| change a house's furniture | the Interior editor, or `interior-layouts.js` by hand, or the generator in `interiors.js` |
| change prices, wages, drain | `items.js`, `jobs.js`/`contracts.js`, `housing.js`, `life.js`; `MAP.properties[].listing` for house rent and price |
| change a menu or HUD | `index.html` + `style.css` + the handler in `game.js` |
| change multiplayer | `multiplayer.js` (client), `server.js` (relay: positions only), `main-menu.js` (host/join) |

## State of the build (0.32.0)
Done: main menu (Play offline, Multiplayer host/join, Settings, Credits, Dev Mode), main-menu button in Esc, nearest-clear-spot reset and stuck rescue, dev mode, real broadleaf street trees, real parked cars, flatbed tyres, ground z-fighting fix, no trees inside props, "for rent or sale" signs on listed houses, the interior editor and dev server.
Open or known:
- **House interiors are still crude** (generated boxes: flat window panes, thin bathroom boards, a plain door slab, furniture from a rule-based layout). The editor is the way to fix the furniture; the shell (walls, windows, door, ceiling, lighting) still needs real work.
- Roadmap (`DESIGN.md`): Eastbank Works buildings and the sawmill chain next, then furniture edit mode for players, tools and wear, store jobs, farming, vehicles. The 0.32 label was taken by this work, so Eastbank is "next".
- The flatbed's wheels are generated cylinders (`vehicle-parts.js`): the converted model has none and the original FBX is not in the repo.
- Not built: a hosted multiplayer relay with login (`server:lan` has none), separate dev saves, drivable vehicles.
- `assets-src/` (originals) is not in the repo; only the menu image lives there.
- The older dev tools in the phone's Settings (stat drain, add a test item) are not behind the dev flag.

## Decisions from the user (end of 0.32.0: these are answers, not open questions)
**House interiors (the next big job; Opus 5.5 to design, Sonnet 5.5 to build; see "Interior shell" in `DESIGN.md`):**
- **Windows show the outside, and the outside shows the inside.** Real glass both ways (as the shops already do), so you can see into a lit house from the street and out of it from inside. That means a house interior can no longer be a separate scene: build it in the world at the house (like the shop interiors), on demand, one at a time. Flag the frame cost before building.
- **Swinging doors** with open and close animations (the front door and, later, inner doors). `doors.js` has the sliding shop door to learn from.
- **Ceilings that fade.** The camera looks down from above and a ceiling hides the room, so ceilings (and the roof) fade out when the camera is above or inside, like the walls' cutaway fade.
- **Walkable stairs, and an entry on every floor.** Stairs you walk up (ramp footing), not a fade. Upper floors had **no entry spot** (nowhere defined to arrive); every floor needs one and the editor's checks should cover it.
- **Lights are switchable** (E on a switch or lamp, per room or per lamp; they follow the time of day by default). Later, not first.
- **Style:** undecided and to be looked at properly. Expect some Blender work down the road (a house shell kit, a consistent look). Do not mix the flat Kenney look with the smoother Quaternius pieces by accident (`DESIGN.md`, "Interior art direction").

**Furniture for players (later; Opus 5.5 for the save format):**
- Players buy furniture, **order it, and pick it up at the store**. The flow follows **ContractVille's** (the user's reference; ask them to describe it if the details matter): buy -> a **box labelled with the furniture's name** is delivered/picked up -> carry it home -> **placing the box shows the real prop**.
- **Make placing easy** when we get there (snap to a grid, a ghost that shows green/red, rotate with one key, pick up again). The dev editor's rules (`interior-edit.js`, `layoutProblems`) are the starting point.
- The editor's data shape (a list of `{id, x, z, yaw, y}` per floor) is meant to become `progress.properties[id].furniture`.

**Multiplayer:** eventually **hosted for real**, not only local (a deployed `wss://` relay with login and room codes; see `DESIGN.md`). A later step. Local `npm run server` stays for development.

**Dev tools:** the old ones in the phone's Settings app (stat drain multiplier, "add a test item") should **come out of the phone** and live **in settings** instead. The user's wording: "just be in settings; remove from phone". Default reading: move them into the dev panel's own section (behind the dev flag) and delete them from the phone. If the user meant the main menu's Settings screen instead, they can still say so.

**Git:** the user **commits by hand**. The agent cannot (no `git` on its PATH) and should not try; just say what changed.

**Smaller facts for the next session:**
- The interior editor *has* been used for real: `dist/interior-layouts.js` holds one saved layout, `house-c` (5 Cedar Loop), where only the lamp was moved (1.50, 1.65 -> 1.75, 1.90). It is valid (no layout problems). Saved layouts apply to the generated shell, so they will need revisiting when the shell changes.
- Signs only exist for the four houses with a `listing` (1, 3, 5, 7 Cedar Loop).

**Suggested order for the next chat:** (1) the house shell and stairs: design first (Opus 5.5: in-world interiors vs. cost, glass both ways, ceilings fading, walkable stairs, floor entries, door animation), then build; (2) move the old dev tools out of the phone (small, Sonnet 5.5 or Haiku 5.5); (3) switchable lights; (4) later: furniture ordering and placing, hosted multiplayer, style/Blender decisions.
## Performance budget (flag before building anything that breaks it)
All trees together 0.89 M triangles; culling draws 5-40% depending on where you stand. Props drawn from one spot up to about 82k triangles; street trees add about 29k (24 trees); about 45-100 draw calls. Flag: more than about 1,000 tree-sized instances (a tree is about 1,200 triangles; choppable ones cost double with shadows), bulk shadow casters, more than about 15 skinned characters or 10 cars on screen, textures over 512 px per asset, more than about 300 draw calls, crops one mesh per cell (use chunked instances). The main menu draws the world once and then stops until Play. The dev panel's readout updates 4 times a second and only while open.
