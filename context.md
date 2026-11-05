# City Life: context for a new chat

Read this first (about 5 minutes). Then `DESIGN.md` (the plan, decisions, roadmap, performance budget, which Claude model for which task) when you need detail, then `README.md` (a section per version, newest last) and `ASSETS.md` (every model and licence). `DESIGN-history.md` is an archive: open it only for old detail on a specific topic.

## What it is
A buildless Three.js browser city sim (no bundler: plain ES modules in `dist/`, Three.js vendored in `dist/vendor/`). Third-person walking, jobs, shops, renting and buying homes, a lumberjack skill, a 540 x 480 m map of six districts, local multiplayer positions. **Current version: 0.34.1** (live at https://simproject.ghostjumper007.workers.dev; deploy with `npx wrangler deploy`, see `DEPLOY.md`). `package.json` says the same. Never `--force` a version once it is deployed (0.34.0 is live): bump instead. **0.33 in progress (untested by the user in a browser):** Eastbank Works is built (Stage 2, `DESIGN.md` 4.13 C2); the two depot vehicles drive; the gas station and fuel system are built (see "0.33/0.35 work" below and `DESIGN.md` I2). Next: the user's feedback from playing, then Stage 4 (`heightAt`), which is on hold.
Windows 11, VS Code, PowerShell 5.1. The user plays on a real GPU (about 165 FPS) and sends screenshots; the agent's browser only has software WebGL (about 4 FPS).

## How the user wants you to work (standing)
- **Name the Claude model for each task** (Haiku 5.5 for tiny edits and number tweaks, Sonnet 5.5 to build and refactor against tests, Opus 5.5 for design, save formats and multiplayer). `DESIGN.md` has the convention.
- **Flag anything that could hurt frame rate before building it**, with a number and a cheaper alternative (budget at the end of this file).
- **Run `npm test` after each change** and report failures honestly. No claiming it works without checking; look at screenshots when something is visual.
- **Keep the 0.31 town files** (`town.js`, `world.js`, `map-definition.js`): change them only minimally and additively, and say so. (0.32.0 added one function and a ground-layer fix to `world.js` and changed tree data.)
- Real assets over fake ones (no cylinder-and-blob trees, no box cars). If a model is missing, say what is missing instead of faking it quietly.
- Say plainly when something could not be reproduced or verified.
- **The user commits by hand.** The agent cannot (no `git` on its PATH) and should not try; just say what changed.
- **Work in small steps** and stop after each one with tests passing, so the user can check and commit. Keep answers short; do not re-read files you do not need (token cost).

## Commands
| | |
|---|---|
| `npm test` | every `tests/*.mjs` in its own process (64 files). **Run `npm run release -- --force` first** if you changed anything in `dist/`: `startup`, `rescue`, `dev`, `real-models`, `house-signs`, `main-menu-return` run the *packaged release* that `dist/index.html` points at, not `dist/*.js` |
| `npm run release -- --force` | rebuilds `dist/releases/<package.json version>/` (copies every `dist/*.js`, `style.css`, `vendor/`) and points `index.html` at it. Released folders are immutable and cached, so `--force` only for a version never deployed; otherwise bump the version |
| `npm run dev` | **the dev server**: serves `dist/` at http://localhost:8000 and lets the dev panel's interior editor save into the code (see below). Use this, not `python -m http.server`, when editing interiors |
| `npm run server` / `server:lan` | the multiplayer relay (ws://localhost:8080); `:lan` opens it to the network (no login) |
| `node scripts/browser-lab.mjs <outDir> <scenario.json>` | headless Edge over DevTools: screenshots, A/B pixel checks, z-fighting `measure`. Header comment has the scenario format; sample in `scripts/browser-lab.sample.json`. Needs `npm run dev` running |

Deploying: `DEPLOY.md` (Cloudflare Pages from GitHub, output `dist/`, no build step; never `--force` a deployed version).

## Environment gotchas (these cost real time)
- **`git` is not on PATH**, but GitHub Desktop's copy works: `C:\Users\Michael\AppData\Local\GitHubDesktop\app-3.5.2\resources\app\git\cmd\git.exe` (the folder name changes when Desktop updates). Commit and push only when the user asks; never add `assets-src/` originals or `simproject.code-workspace`.
- **PowerShell 5.1 `Set-Content -Encoding utf8` writes a BOM**, which breaks `JSON.parse` (it killed `package.json` once). Write files with `[IO.File]::WriteAllText(path, text, (New-Object Text.UTF8Encoding $false))`.
- Multi-line `Edit` matches on `dist/world.js` and `dist/game.js` often fail (indentation); use single-line anchors with `.Replace()` in PowerShell, and check each swap landed. `game.js` is dense on purpose (one statement per line, long lines): match the style.
- PowerShell double-quoted strings eat backticks; use single-quoted here-strings for JS.
- The agent's scratch directory is outside the repo; do not leave temp files in the project.

## File map (`dist/`)
**Game loop and UI:** `game.js` (everything wired together; the frame loop `frame()`, `stepWorld()`, interactions, the dev block at the end), `index.html` (all HUD and menu markup; `#welcome` is the main menu), `style.css`, `main-menu.js` (menu, host/join address parsing, settings), `phone.js`, `inventory-ui.js`, `store.js`.
**World (data first):** `map-definition.js` (the whole map as data + `validateMap`), `world.js` (builds zones, ground, trees, props; layout of every generated tree), `terrain.js` (0.5 m walkability/surface mask), `town.js` (Alder Center's street furniture, markings), `props.js` + `props-assets.js` (converted models, 3.6 MB), `rigged-props.js` + `rigged-assets.js` (the rigged sawmill: nodes, skins, clips; loaded with GLTFLoader), `nature.js` + `nature-assets.js` (Quaternius trees), `vehicle-parts.js`, `house-signs.js`, `eastbank.js` (0.33: Eastbank's merged paving, painted bays and per-yard prop chunks, read from `MAP.paving`, `bayRows` and `yards`), `vehicle.js` (0.33, pure: drivable classes, the arcade step, hull and collisions, safe poses, the saved list) and `fuel.js` (0.35, pure: the sale in whole cents, burn, saved fuel), `fuel-station.js` (the Eastbank pumps: nozzles, hoses, the nozzle in hand), `driving.js` (the two drivable depot vehicles: meshes, enter/exit, camera numbers; `game.js` feeds the keys).
**People and rules (pure, tested):** `state.js`, `profile.js` (save: key `citylife.profile.v1`), `jobs.js` (`normalizeProgress`), `contracts.js`, `housing.js`, `ownership.js`, `life.js`, `routine.js` (clock, hours), `inventory.js`, `items.js`, `skills.js`, `grid.js` (plots, chopping, regrowth), `timestep.js`.
**Characters:** `character.js` + `character-male.js`/`character-female.js` (embedded glTF), `neighborhood.js` (pedestrians, the three Oak Street cars), `appearance.js`.
**Interiors:** `interiors.js` (house layout generator, saved-layout override, `layoutProblems`), `interior-layouts.js` (**saved layouts, written by the editor**), `interior-edit.js` (editing rules), `shops.js`, `apartment.js`, `indoor-camera.js`.
**Safety and dev:** `carry.js` (pure: a log on the shoulder or planks in the hands, the sawmill belt count, planks put down; saved as `carry`, `belt`, `plankDrops`), `sawmill.js` (switch rules + the controller that plays the model's clips), `sawdust.js` (the sawdust pool and its one Points object), `audio.js` (generated Web Audio: blade, belt, lever click; volume and mute saved under `citylife.audio.v1`), `safe-spot.js` (nearest clear spot), `dev-flag.js` (the one switch) + `dev.js` (Dev Mode panel, removable).
**Elsewhere:** `server.js` (relay), `scripts/` (release, dev server, build converters, browser lab), `tests/` (+ `tests/support/boot-game.mjs`, which boots the packaged game in Node with a fake DOM and renderer).

## Ideas that hold the code together
- **Data first, pure transactions.** The map, interiors, items and rules are data; changes are pure functions (`state, action -> new state or error`) with tests. Money is **integer cents**. Saves are normalised on load (`normalizeProgress`), unknown fields dropped, schema number for real migrations (`progress.schema`, now 2).
- **One placement path.** Reset (R), teleport, unstick, loading a saved position and the stuck rescue all go through `placeSafely` -> `safe-spot.js` (nearest clear spot, 0.75 m of room, not a closed pocket under 300 m2). Event-driven, never per frame.
- **Coordinates:** 1 unit = 1 m, +Y up, north is -z, the player is 1.95 m. Spawn (-5, 15). Zones: Westside city (x -61..58, z -48..48), Alder Center (z -125..-48), Cedar Heights (x 70..170, z -135..-40), Eastbank Works (x 70..190, z -20..75), Willow Fields (farm, x -170..-35, z -286..-178), Pine Ridge (forest, x -25..190, z -316..-216); the river and two bridges between. Everything walkable except water; solid things have colliders.
- **Time:** real time is cut into slices of at most 1/30 s (`timestep.js`); the game clock runs 30 game minutes per real minute while playing.
- **Rendering:** ground is a stack of flat layers; each gets a **depth bias by its height** (`GROUND_LAYERS` in `world.js`), because layers millimetres apart z-fight at a distance (this was the "white flicker when looking down"). Trees between the camera and the player dissolve with a screen-space Bayer dither shader (`createSightlineFade`); every tree/prop material goes through `fade.apply`. Trees are instanced and culled by distance.
- **Interiors are separate scenes today** built on first entry (houses: `buildHouseRoom`); the outdoor scene is not drawn while inside. In-world interiors with real glass are decided and planned (`DESIGN.md` 4.3).

## Dev tools (all removable)
- **Dev Mode** (hidden: press **D four times** on the main menu to show its button, remembered per browser in `citylife.devUnlocked`; then **F2**): teleport, time, money, spawn items, Rendering switches (shadows, tree dissolve), unstick, and the **Interior editor**. One flag: `DEV_MODE` in `dev-flag.js`; with it `false`, `dev.js` is never loaded. Deleting `dev-flag.js`, `dev.js`, `interior-edit.js` and the `DEV_MODE` import and block at the end of `game.js` removes it all. A test checks `index.html`/`style.css` hold nothing of it. Dev changes go to the normal save.
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

## 0.33/0.35 work since 0.32.0 (all uncommitted, `npm test` passed with 64 files, never played in a browser by the agent)
- **Driving:** `vehicle.js` (pure arcade step, hull, collisions) and `driving.js` (Worktruck and Off Road Pickup: meshes, enter/exit on E at the driver door, camera). Saved vehicle list.
- **Fuel (`fuel.js`, pure):** the sale in whole cents, burn, saved fuel. Gas, **gallons, $/gal, mph everywhere the player sees**. Gas $4.00/gal, diesel $4.20/gal. Tanks: Worktruck 21 gal (diesel), Off Road Pickup 18 gal. Burn 1.0 and 1.2 gal/mile (deliberately thirsty). Save field `fuelMgal`; old `fuelMl` is ignored (vehicles start full).
- **Station (`fuel-station.js`):** a drive-through on Eastbank: enter from the west road (`gas-in`), drive east along the **south lane** (driver's door toward the pumps), exit east. Canopy turned a quarter turn; a test drives both trucks through. Island and canopy do not dissolve. North faces have no nozzles.
- **Filling controls:** H at a pump takes the nozzle; **hold F at the tank cap** to fill; H at the pump hangs it back. E never fills. The driver-door prompt is hidden while holding a nozzle; holding a nozzle puts away any tool and blocks equipping one.
- **Feedback:** cap prompt ("F Â· Hold to fill Â· Worktruck Â· takes diesel Â· 5.0 of 21 gal", "Wrong fuel", "Tank full"); vehicle panel shows fuel type and gallons; every cap glows (disc, halo, ground ring; gas red, diesel yellow; bright if the nozzle matches); right arm holds the nozzle, hose follows the hand; pump screens show fuel and price, then gallons and dollars; generated audio (flow rush and hum with rising pitch, click on take/hang, two-note full chime, two low notes if you cannot pay).
- **Tiers (ehicle.js):** every class has 	ier (low/mid/high), 	op (m/s) and mpg; gallonsPerMile = 8 / mpg (ARCADE_MILE_SCALE, because the map is tiny). Worktruck: low, 8 mpg (1.0 gal/mi), 17.9 m/s (40 mph). Off Road Pickup (the green one): mid, 14.5 mpg (0.55 gal/mi), 26.8 m/s (60 mph). No high-tier vehicle yet. Auto-shop tuning parts are roadmap 0.40 (DESIGN.md).
- **Done from the first play-test:** the nozzle is now taken and hung with **H** (E stays for doors; `interact(key)` in `game.js` filters by each interaction's `key`; G is the plot grid); the forecourt roof is hidden while the player or vehicle is under it (`eastbank.js` `underCanopy`); the kiosk moved 3.5 m east (x 172, plot I2 now x 150..180) so it no longer crowds the canopy; the pump-island slab and bollards now match the island model. Also done: **footing** (	errain.js FOOTING) now equals the top of the mesh drawn there for rural asphalt (-0.045), dirt roads (-0.066) and fields (-0.069), which fixes the 3-5 cm sinking (grass stays at -0.095 because the city is pinned to it); **vehicle sounds** in udio.js: engineVoice (pure: four gears, revs drop at each shift, tier sets pitch and roughness), udio.engine() every frame for the vehicle you are in (stalls at an empty tank), udio.ignition() on getting in as a start-up crank, road noise by speed. **Smoke (`smoke.js`):** one pool of 90 soft grey puffs (one draw call) from each running vehicle's muffler (`exhaust` on the class in `vehicle.js`; `driving.exhaust()`), thin at idle, more on the throttle and from cheaper tiers, plus a burst when you turn the key. **Gas can:** the owner's FBX is converted to `prop.fuel-can` (`build-props.mjs` now reads an FBX's UVs and an `albedo` texture; needs `TOOL_DIR` with meshoptimizer, sharp and three@0.160); item `gas-can` ($15, tool, 5 gal, on the hotbar); its fuel is on its bag slot (`fuelMgal`, `fuelType`, `canOf`/`setCan` in `inventory.js`); `fillCan` and `pour` in `fuel.js`; with the can equipped, **hold F at a pump** fills it (paid, one fuel type at a time) and **hold F at a tank cap** pours it in (free). The credit for the can in `credits.js` is a guess ("own work, to be confirmed"). **Queue:** (6) cleanup pass (was step 7): update the Phone UI to the new changes (fuel, gallons, mph, vehicles, gas can) and remove or edit anything outdated, including the old $2/L figures in `DESIGN.md` 4.7; then the user's next play-test feedback.
- **Not built:** the gas can (waits on the user's model), fuel in the bag (a `fuel` field on bag slots), the north lane, a merged hose mesh, a low-fuel chime. The gas pumps, nozzles, pump island, canopy and the gas can are the user's own Blender models, converted and in the game (not placeholders). Verified only against a fake audio context and screenshots; nothing heard or played.
## State of the build (0.32.0)
Done: main menu (Play offline, Multiplayer host/join, Settings, Credits, Dev Mode), main-menu button in Esc, nearest-clear-spot reset and stuck rescue, dev mode, real broadleaf street trees, real parked cars, flatbed tyres, ground z-fighting fix, no trees inside props, "for rent or sale" signs on listed houses, the interior editor and dev server.
Known:
- **House interiors are still crude** (generated boxes: flat window panes, thin bathroom boards, a plain door slab, furniture from a rule-based layout). The shell (walls, windows, door, ceiling, lighting) needs real work; see `DESIGN.md` 4.3.
- The flatbed's wheels are generated cylinders (`vehicle-parts.js`): the converted model has none and the original FBX is not in the repo.
- Not built: a hosted multiplayer relay with login (`server:lan` has none), separate dev saves.
- `assets-src/` (originals) is not in the repo; only the menu image lives there.
- The older dev tools in the phone's Settings (stat drain, add a test item) are not behind the dev flag; the plan is to move them into the dev panel (`DESIGN.md` open questions).
- The interior editor has been used for real: `dist/interior-layouts.js` holds one saved layout, `house-c` (5 Cedar Loop), where only the lamp was moved (1.50, 1.65 -> 1.75, 1.90). It is valid. Saved layouts apply to the generated shell, so they will need revisiting when the shell changes.
- Signs only exist for the four houses with a `listing` (1, 3, 5, 7 Cedar Loop).
- The plan, roadmap, decisions and performance budget live in `DESIGN.md`, not here.

## Second play-test round (done)
- Canopy: roof and columns are separate meshes (eastbank.js splitCanopy); only the roof dissolves; each pair of columns merged onto the island centre line (CANOPY_COLUMN_X=0): one column at each island end, lanes open.
- Held gas can hangs level from the hand at the side (upright hold, no chest carry). Pose still unverified by the owner.
- Engine sound retried (audio.js): pulse-wave thump, lower and lopey, low-passed. Unheard by the agent; tune ENGINE_TIERS.
- Phone cleanup: Player screen has a Vehicles list (tier, mpg, top mph, tank, fuel) and the gas can; Bank shows fuel prices; DESIGN.md fuel/mph/mpg figures updated.
- 64 test files pass.


## Stage 4 (heightAt) done
- dist/height.js: heightAt (0 today), setHeightFunction (tests). world.standHeight(x,z,deck) = heightAt + (deck ?? footing). Converted: player feet, vehicles, fuel station, landmarks, Eastbank props, pines, stumps, broadleaf trees, ground logs, log/plank prompts and plank drops. Not converted (still flat): roads, paving, town furniture, fences, lamps, crops. tests/height.mjs raises the ground 5 m.
- Canopy roof now fades to a ghost (opacity .22) under it instead of vanishing.

## Terrain relief slice 1 (done)
- MAP.relief.hills (3 outer hills in open country, west and north-west); height.js reliefHeight/heightAt reads it; world.js builds one 3 m grid mesh per hill over the base ground; terrain.js validateTerrain checks hills sit on open grass with a 25 m margin. Roads/paving/buildings stay flat. Vehicles follow the ground height but do not pitch with slopes yet. Minimap shows no relief. Pickup engine sound lowered (diesel-ish).

## Terrain relief slice 2 (done)
- Vehicles tilt with the ground (driving.js tilt(): heightAt at the four hull points; rotation order YXZ). Five hills now: west-hill 9 m, west-knoll, north-west-hill, ridge-east-hill, ridge-east-knoll (east of the Freight Road; the area north of Pine Ridge is too narrow for a hill). MAP.relief.tracks: a dirt spiral track up west-hill (DIRT surface, ribbon mesh lifted by heightAt, climb under 8 percent). It is a declared trail, NOT joined to the paved network (the city's edge cells are pinned by tests/terrain.mjs); roads.mjs exempts it. Unverified in play: how a truck feels on the track, the tilt look.

## Road and map update (done)
- River valley: height.js valleyAt (bed 1.4 m below ground across the water, mud bank = the river's own bank width, 6 m walkable shoulder, cosine profiles, fades out at the map ends); water level RIVER_WATER_Y -0.95. world.js: groundSplit cuts the far/base/farm/forest ground planes along the valley lips; 'river-valley' mesh (vertex colours grass to mud). Old flat mud ribbon removed.
- Bridges arch (BRIDGE_RISE 1.0 m, cosine, flat at the road); deckAt/standHeight put people and vehicles on the arch; deck, parapets, caps, piers are extruded along the arch; roads are cut at bridges and ribbons follow heightAt.
- junctions.js: rounded inside corners (fillets, r 6) at crossings/T junctions and width tapers; painted ROAD in terrain.js, one 'road-joints' mesh. Skipped inside towns (city, alder, cedar), on paving/plots/buildings/fields: only 8 patches today. Not done: city streets and Eastbank paving corners, dirt roads, curved road ends. tests/junctions.mjs, tests/height.mjs. Unverified in play: driving over a bridge, thin seam lines at the valley lip and bridge ends.

## Round 3 fixes (done)
- Bridge: vehicle tilt now uses the deck (deckAt) on a bridge, not the valley under it (wheels were sinking). MAP.pavements: no pavement crosses a road (Oak Street, Alder Avenue mouth); street furniture on the removed slabs is gone (town.js places only on PAVEMENT). tests/terrain.mjs old-rule pin updated.
- Vehicle panel names the ground when it slows you: 'Off road · Grass · top speed 50%' (SURFACE_LABEL, ground param). Slowdown itself unchanged (grass .5, dirt .8; OFFROAD_DECEL 6; 9 broke tests/driving-game.mjs's timing-sensitive supplier-wall run).
- NOT done: rounding town junctions (the pavement slabs and kerbs sit on the corners; needs rounded slab geometry).

## Phone cleanup (done)
- Phone: apps are Gigs, Bank, Housing (was Homes), Player in a clean 2x2 grid. Settings app and Bag app removed. The stat drain multiplier moved to the dev panel (devDrain, dev.js; api.setStatDrain/statDrain in game.js); items are spawned from the dev panel. 'Bag' is 'inventory' in every player-facing text (the I key opens it). tests/startup.mjs, dev.mjs, house-signs.mjs updated.
- Decided for the Store pass (not built): size-class delivery fees (small $3, medium $8, large $25, vehicle $150), game-time delay by size (vehicles about 2 days, to the home's driveway/parking spot), parcel locker in the studio lobby, drop box at houses, a 'main home' setting, a home (rented or owned) is required.
- Still queued: round the town junctions (pavement slab corners), minimap relief, joining the hill track to the roads.
- Tooling note: in PowerShell scripts never name a helper R (alias for Invoke-History) and never pass a single replacement pair as @(@(a,b)) (it flattens and replaced every space in dev.js once; restored from the release copy).

## Town junctions rounded (done)
- MAP.roundedCorners (5 corners: Alder Avenue x Oak Street on all four sides, Alder Street's west corner on Oak Street), junctions.js cornerArc/cornerRegion/slabOutline/inPolygon; game.js draws the city pavements from MAP.pavements (non-draw entries) as extruded slabs with the corners cut, plus street-corner patches; terrain.js paints the corners STREET after the pavements; tests/terrain.mjs allows 0.6 m around the curved kerbs. Still square: Alder Street's east corner and the Oak Street to Oak East width step at x 55, Alder Center's corners.

## Minimap relief and track join (done)
- minimap.js relief(x,z): shading from heightAt (NW light, higher lighter, river valley darker), applied per pixel in drawStatic. The dirt track now starts at x -58.5 on Oak Street's west end (a 41 m straight along z=5, then the spiral), so it is part of the paved network again; scenery 547 -> 545 decor trees (tests/map.mjs, nature.mjs), tests/terrain.mjs ignores the track's first metres inside the city's west edge. Next in the queue: the Store pass.

## Store app and orders (done)
- orders.js (pure): size classes small/medium/large (fee $3 per 6, $8 per 2, $25 each; delay 3 h / 12 h / 24 h, the slowest class sets it), quote, placeOrder, deliverDue, takeDelivery, setMainHome, mainHome, homesHeld, dropSpot, overview, normalizeOrders. progress.orders {main,nextId,queue,drops} (optional field, jobs.js normalizes). Needs a rented studio or a rented/owned house. Vehicles: refused for now (VEHICLE_ORDER fee $150, 2 days decided; needs the dealership, a spawnable vehicle list and a parking spot).
- phone-store.js is the Store screen (items +/-, delivery home select, Make main home, cart totals, Orders list); phone.js wires it; game.js tickOrders (every 0.5 s: delivers due parcels, toast, updates parcels.js), collectOrder (E at the drop spot: 'Collect your order · N things').
- parcels.js: a steel parcel locker beside the studio door (lamp green while a parcel waits) and a cardboard box in front of each house door (visible only while waiting). Primitives, no models yet. The drop spot of a house is door + 2.4 m out + 1.8 m sideways: not yet checked on every house for clearance.
- tests: orders.mjs (rules), store-game.mjs (phone, delivery, locker, collect in the packaged game).
- Not built: NPC/player delivery jobs, vehicles, item sizes/weights data beyond sizeOf(), order cancellation, delivery to a home you just left.

## Dealership and vehicle ordering (done, 0.34)
- Ownership is `progress.orders.owned` (vehicle ids); `orders.parked` holds delivered vehicles waiting for a clear pose. Prices in orders.js `VEHICLE_PRICE` (worktruck $4,500, pickup $11,000); a phone order adds a $150 fee and a 2 game day delay (`VEHICLE_ORDER`).
- On the lot: E at an unowned vehicle's driver door buys it (`buyVehicle`). Unowned vehicles cannot be entered. Phone: the Store has a Vehicles section (`orderVehicle`); the Player screen lists only owned vehicles. `parkingAim(home)` is where a delivered vehicle is placed (`driving.place` finds the nearest free pose), done in `tickOrders`.
- Tests that drive a vehicle seed `orders:{owned:[...]}` in the saved progress; dev API `vehicles.own(id,owned)`.
- One of each vehicle exists (no copies yet). Unverified by eye: where a delivered vehicle ends up near each house.
- Order times show as the in-game weekday and clock (`arrivalText`). Sleep does not advance the clock (open question).
- Next: houses and interiors pass (bigger interior, camera view of walls).
### Vehicle space (step 2 of the 4.14 plan, done)
- `VEHICLE_SLOTS` and `vehicleCapacity`/`vehicleCount` in orders.js; `size` on each house in MAP.properties (validated). Buying on the lot and ordering are refused at the limit; the Store shows "No room"; the Player screen shows the space used. Delivered vehicles park on the house's `park` spot (studio: the fixed aim beside Oak Street).
- Deferred to step 3 with colours: the dynamic garage list (`progress.garage`, copies on demand). The fleet is still the two fixed `MAP.vehicles`.
### Colours, restock and copies on demand (step 3 of the 4.14 plan, done)
- Six colours per model (`paint.js`). The lot's two display vehicles show the first colour in stock; buying takes that colour out of stock for 3 to 6 game days and the display moves on to the next colour. The bought vehicle stands where the display one stood (the display hides while an owned vehicle is within 8 m of its slot).
- Owned vehicles are copies made on demand: `progress.vehicles` (uid v1, v2 ..., model, colour, pose, fuel); `driving.sync(list)` makes the meshes (the game calls it after a purchase or a delivery); `vehicles.own(model, colour)` in the dev API grants one.
- The Store's vehicle cards have colour swatches (sold-out ones greyed, with the days left); the Player screen lists the vehicles you own with their colour and fuel.
- Unverified by eye: the blue and red shades (tuned once after one render), the display colour change when you buy, driveway parking at each house, a vehicle appearing during a delivery while you watch.
- tests/driving-game.mjs: the supplier-wall run now steers to the wall with the same key controller instead of a hand-timed turn (the old turn depended on the exact path).
### Sleep skips to 6 AM (step 4 of the 4.14 plan, done)
- `dist/sleep.js` (pure, tests/sleep.mjs; in the game tests/sleep-game.mjs): sleeping in single player moves the clock to the next 6:00 AM (today's if it is before 6), runs rent, bills and order delivery through the day change, drains food and thirst at 25% of the awake rate, and fills energy. In multiplayer (`MultiplayerClient.online`) the clock never moves: energy only. The bed dialog and the wake toast say which ("Rested · 6:00 AM · 8 h slept").
- Open: an active gig or a timed task keeps running through the skip (not special-cased); the testing "stat drain" multiplier also scales the sleep drain.
### Honeycomb UI scheme (step 7 of the 4.14 plan, done; done before the Store rebuild so it is built once)
- The teal and green UI colours in `style.css` were remapped by script to black and honey yellow (dark backgrounds near black, pale lime accents honey `#f5c518`, pale greens warm white); an override block at the end of the file adds the tokens (`--honey`, `--ink`, `--comb`, `--hex`, `--chamfer`) and the hexagon motif: a faint honeycomb tile on the panels (HUD cards, dialogs, phone, inventory, shop), hexagonal phone app icons, chamfered buttons.
- Not touched: the minimap's map colours and the vitals bar colours (they carry meaning), the dev panel's own styles (dev.js), the 3D scene. A backup of the old stylesheet was kept outside the repo.
- Unverified by eye: the main menu, the character creator, the shop screen, the controls and credits veils, mobile layout.
- New UI should use the tokens, not new hex colours.
### Store categories, vehicle pictures, phone Back (step 5 of the 4.14 plan, done)
- `store-categories.js` (the dropdown's categories and which shelf an item is on: tools hold the Axe, the Gas Can and backpacks), `phone-store.js` rebuilt around the dropdown, the vehicle Info view and pictures; the phone's bottom bar has Back and Home (phone.js: Back closes the Info view first).
- Vehicle pictures: `npm run pictures` regenerates `dist/vehicle-pictures.js` (about 490 KB for 12 pictures, loaded by `import()` when the Store opens; not in the startup path). `tests/store-categories.mjs` fails if a model or colour has no picture. The paint shader moved to `paint-shader.js` so the studio page and the game share it; the hue variation of a paint pixel is now compressed (x0.4) so red stays red.
- All `select` elements use the honey style (global CSS at the end of style.css); the dev panel keeps its own.
- Later passes noted in DESIGN 4.14: the dealership building with a parking lot and a "Riden Deals" sign, and the gigs revamp.
- Item name changed: "Gas can" is "Gas Can" (the empty-can text in canText still says "gas can").
### Housing pass, first part (0.34, done)
- For Rent or Sale signs: two posts behind the board (nothing crosses the lettering), black and honey board, a solid that covers the board and both posts. tests/house-signs.mjs checks the posts.
- Interiors are 1.3 times bigger than the house's footprint minus its walls (`ROOM_GROWTH` in interiors.js; a 9.5 x 7.5 m room is now about 12.25 x 9.75). The saved layout for house-c is retired (its key is now "house-c@9.5x7.5" in interior-layouts.js) because it was made for the old size: furnish house-c again in the interior editor and save to use a hand-made layout.
- The indoor camera's fade boxes ignored where an upper floor really is, so the near wall of an upstairs room never faded (the screenshot with the brown slab line): fixed in `indoor-camera.js` (`updateWorldMatrix(true,false)`), tests/indoor-camera.mjs fails without it.
- Main menu: the tagline and the controls hint are gone; the version is beside "LIVING NEIGHBORHOOD" (the release script updates both places); the buttons are hexagonal with a honey Play button.
- Not done in this part: re-furnishing the generator's layouts for the bigger rooms by eye (they only scale with the room), windows and room partitions, the HUD bottom hint ("WASD Move ...") is still there.
### Housing pass, second part (0.34, done)
- Interiors are a cutaway by floor: only the floors up to the one you are on are drawn (`room.setFloor` in interiors.js), so the storey above no longer hides the rooms below from a high camera (this was the "wall and slab in the way" view in the play-test screenshot). tests/indoor-camera.mjs checks it.
- A street tree stood in the road at Oak Street and Alder Street (OAK_TREES in game.js listed [47,-4.5], now road after the junction work) and another at [-43,10] (road). Moved to [43,-6.5] and [-43,18]; tests/street-trees.mjs fails if any Oak Street tree or town tree stands in a road. If the junctions or pavements change again, that test finds the next one.
- Seen in screenshots after the change: 1, 3, 5 and 7 Cedar Loop (the four houses you can rent or buy; the other four have residents and stay locked). Upstairs rooms and the bed were not looked at.

## Next up (decided 2026-11-05)
1. Dealership (step 1 done): a copy of the Alder Store model (`riden-deals` landmark and property, 528 triangles) at (97, -28.5) facing south over the depot lot; Alder Center keeps its store. Eastbank's zone now reaches z -38 (9 scenery trees fewer: 545 -> 536, pins in `map.mjs` and `nature.mjs`). Lot x 80..114 with 10 bays (2 truck at x 82, 8 car from x 92; 2 spare). Sign `riden-deals-sign` at (78, -1.5): keep signs off the grass strip in front of the lot, because the trucks' three-point turn in `vehicle.mjs` swings over it. Bay paint was hidden under the depth-biased paving everywhere in Eastbank; it is now a ground layer (`eastbank.js`). Sign (`riden-deals-sign` at 78, -1.5; x 85 or 90 puts it in the pickup's reversing path and breaks `driving-game.mjs`) now has a picture board: `dist/sign-pictures.js` (two vehicle pictures, 85 KB, written by `npm run pictures`, imported by `world.js` only when the sign is built; boards take `pictures`, `h`, `bg`, `fg`). **`sale` field built:** each `MAP.vehicles` entry has `sale` ('dealership' | 'online' | 'both'; online needs no `home` and gets no display vehicle); `validateMap` fails without it and when display models exceed the lot's 10 depot bays; `orders.js` `soldOnLot`/`soldOnline` make the lot refuse online-only models and the phone refuse dealership-only ones. Both models are 'both'. Next: the launcher / update notice.
2. (done) Every vehicle model has a `sale` field; see `DESIGN.md` 4.14.
3. (done, 0.34.1) Update notice: `update-check.js`, banner in `index.html`/`style.css`, `version.js` + `version.json` written by `npm run release`. Next: the hosted relay with the protocol check and the "save, back to the menu, update" flow, then save backups and Export/Import, accounts, the launcher.
