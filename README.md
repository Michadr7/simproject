# City Life — stage 1
Buildless Three.js browser game. Serve `dist/` with any static host, including Cloudflare Pages. Three.js is vendored locally (MIT).

Controls: WASD/arrows, Shift run, drag camera, wheel zoom, E interact, R reset, Esc pause.

Files: `game.js` contains world construction and movement; `style.css` contains HUD; `index.html` contains menus. Placeholder character and building construction functions are replaceable with GLB asset factories in a later stage. Current scope: movement and entrance discovery, no economy or character creator yet.

## 0.1.2 camera polish
Trees moved away from frontage centers, with smaller raised crowns. Tree materials fade independently when they obstruct the character. Camera clearance includes a padding radius at walls, immediate inward correction, and eased outward recovery. Camera behavior lives in `dist/camera.js`.

Validation: `node tests/camera.mjs` checks wall clearance, open camera distance, foreground foliage, unrelated trees and camera-inside-canopy detection. WebGL visual QA is unavailable in the agent browser; verify by orbiting beside trees and building corners in a hardware-accelerated browser.

## 0.2.0 character creation
Name, skin tone, five hairstyles, hair color, shirt and trouser colors, with a turnable live 3D preview. Continue from the welcome screen or edit through Controls. Versioned browser-local appearance saves validate values and tolerate blocked storage. Appearance is saved; world progress is not yet saved.

`dist/character.js` owns the replaceable procedural character factory used by both gameplay and preview. `dist/appearance.js` owns appearance choices and save validation. Run `node tests/character.mjs` for persistence and character isolation checks.

## 0.2.1 character and input polish
Rounded head, scalp-shaped hair, tapered arms/legs, shaped garment silhouette and oval shoes replace the box character. Existing appearance saves are retained. Desktop creator reserves a separate footer below the model viewport for name and rotation controls.

Movement input now has separate keyboard and touch sources. Key release is captured; blur, hidden tabs, focus changes, pointer cancellation/lost capture and menus clear movement. Repeat events cannot resurrect a key cleared by focus loss. Run `node tests/input.mjs` for regression checks. The reported continuous movement could not be reproduced visually because WebGL is unavailable in the agent browser; these changes address the stale-input paths and need user verification.

## 0.3.0 visual benchmark
Oak Street gains deterministic procedural brick/asphalt/paving textures, market glazing and awning, produce displays, planters and apartment balcony rails. Trees gain varied canopy outlines. Warm sunlight and filmic tone mapping establish the first visual direction. Character gains collar/waist/sole details and subtle torso counter-rotation. High/Low graphics choices adjust render scale and dynamic shadows. Textures are small generated surfaces; no external art dependencies.

Visual quality and hardware performance still need user review because the agent browser cannot initialize WebGL.

## 0.3.1 frontage and proportions
Apartment name moved to a narrow sign above the door canopy, with the address number above the door. Sign canvases match their world aspect ratio and fit text inside padding to prevent clipping. Character uses a continuous tapered sleeve profile instead of separate shoulder spheres, a softer torso slope, fuller forearms and a less bulbous hip silhouette. Existing movement and saved appearance behavior retained. Automated character, input and camera checks pass; visual review still requires user browser screenshots.

## 0.3.2 waist and market signage
Removed the overlapping belt and ellipsoid hip surfaces. Closed the shirt hem and replaced the trouser top with a narrower, closed profile under it. `node tests/waist.mjs` checks coverage and surface separation around the full waist through the torso animation range.
Market name now sits on a thin wall sign above the awning. Awning lowered to leave clear space, with produce lettering on its front valance. Automated checks pass; visual QA remains limited by agent WebGL availability.

## 0.4.0 first paycheck
First job loop: accept/collect a free market order, walk to the marked destination, confirm handover, receive wages. Three routes cycle between apartments, coffee shop and laundry ($12/$14/$18). Wallet, completed deliveries, target distance/direction, a small world marker and parcel make the state visible.

Rules are in `dist/jobs.js`. Wages use integer cents and are awarded only once per collected order. Pickup/delivery require proximity; interaction and transaction checks both enforce it. Versioned browser progress stores cash, count, carrying state and position after transitions, every four active seconds, and on pagehide/hidden tab. Invalid or inaccessible storage falls back safely, with a save-status message. Appearance remains a separate existing save. Collision-invalid restored positions fall back to spawn.

Run `node tests/jobs.mjs` plus the existing character/input/camera/waist checks. Browser visual/gameplay QA is still unverified due to unavailable WebGL in the agent browser. User route check: market pickup → marked door → handover → verify wages → reload and verify cash; reload during a delivery to verify resumption.

## 0.5.0 first home
Studio 2B at 18 Oak Street costs $30 deposit + $18 first-day rent ($48 total). Modest condition/basic insulation adds $3 utilities each later game day. Existing progress v1 migrates with no loss of earnings or delivery state.

Rental interaction opens a separate furnished studio scene with bed, kitchenette, table, window and shelf. E by the bed offers an explicit advance-day confirmation and adds a $21 bill; E by the door returns outside. Wallet Home & bills opens the rent/utility breakdown and manual payment. Insufficient cash does not create negative money. Bills do not run in real time or while offline. No eviction/refund mechanics yet.

`housing.js` contains housing rules; `apartment.js` owns the lightweight interior and collisions. Saves persist tenancy, day, separate rent/utility balances, and the exterior return position. Reload returns the player to the street with rental/progress retained. `node tests/housing.mjs` checks legacy save migration, affordability, duplicate move-in, billing/payment, delivery-state preservation, saves, and usable room entry/bed/exit positions. Other regression suites remain green. Visual WebGL QA still requires user browser testing.

## 0.5.1 startup repair
User screenshot showed the prior-stage HTML with an inert startup screen. The page and game modules previously used different caching/version paths, allowing new scripts to reference controls absent from stale HTML. Release files now live together under `dist/releases/0.5.1/` (including all relative module dependencies), and the index loads that exact graph. `_headers` requests index revalidation and immutable release files. Startup/runtime errors appear in an on-page message instead of failing silently. No storage clearing or key changes.

`node scripts/package-release.mjs` packages this release; use a new version for subsequent edits rather than overwriting immutable released files. `node tests/startup.mjs` executes the actual packaged game with a synthetic DOM and a renderer stub: fresh save → character creator → world; legacy $70 save → continue → household bills dialog. This covers initialization/UI wiring but does not verify GPU rendering. All existing rule/geometry/input checks pass.

## 0.5.2 studio layout and camera
Expanded floor from 9×9 to 13×11 world units, with sleeping nook/low shelf, kitchenette and refrigerator, dining table, sofa/rug/low table and larger window. Central routes connect the front door, bed aisle and living space. Furniture remains lightweight procedural geometry.

New indoor camera holds a 4.5–7 unit orbit rather than moving against the character at walls. Walls, doors and furniture fade only in the camera-to-character sightline; walking collisions stay solid. Outdoor camera unchanged. Entrance and bed interaction coordinates updated with layout. Existing rental and bills remain intact.

`tests/interior.mjs` flood-fills floor routes and checks camera distance, wall+door fading and retained wall collisions. Packaged startup test now exercises real UI handlers with a stub GPU renderer: legacy $70 save → rent → enter → rest → pay → leave. Rules/input/geometry checks pass; rendered visual quality still requires user browser review. New release folder 0.5.2 preserves immutable 0.5.1 assets.

### 0.6.0 — Living neighborhood
- Smoothed mouse-wheel zoom with normalized wheel units; indoor cutaway now supports the full 3–12 unit zoom range.
- Six animated pavement pedestrians follow bounded routes, pause at endpoints, and yield near the player. No traffic or crowd simulation yet.
- Corner Market and Alder Coffee have distinct walkable interiors, cashier characters, counters, furniture collision and cutaway cameras. Exterior delivery dialogs retain delivery actions plus a separate shop entry choice.
- Market groceries cost $4 and go into a 20-pack bag. Home kitchen meals consume one pack and restore up to 65 food. Café lunch costs $6 and restores up to 45 food and 15 energy.
- Food and energy decline gently during active play; running uses more energy. Sleep restores energy and uses 12 food. Needs are informational this stage: no death, movement penalties or offline decay. Bills still advance only on explicit sleep.
- Three improved parked vehicles expose stable IDs, spawn data and interaction locations. Inspectable, with collision; ownership and driving are deferred.
- Existing save keys and money/job/housing progress are preserved, with validated defaults for new needs and inventory fields.
- Validation: rules, save migration, reachable shop interaction points, NPC movement bounds, vehicle metadata and renderer-stub integration covering deliveries, shopping, meals, home cooking and wheel zoom. Actual WebGL appearance/performance requires user playtesting because the available browser cannot initialize WebGL.

### 0.7.0 — Daily routine
- Saved 24-hour clock runs at 30 game minutes per real minute during active play. Pauses in menus, hidden tabs and while away. Outdoor light and sky follow time.
- Market hours 07:00–22:00; café 08:00–18:00. Exits remain usable after closing. Exterior deliveries remain available.
- Café casual shift: wipe table, restock cups, finish at counter. Each station advances 30 minutes; completion pays $24, once per game day. Work progress saves. Sleeping starts the next day at 08:00 and resets unfinished shift tasks.
- Midnight advances the day and adds the rented home's daily bills; explicit sleep advances one day using existing housing logic. Earnings today and available cash after bills are shown.
- Residents sidestep the player and offer short local conversations. Shop visits remain represented by route pauses; actual NPC interior travel is deferred.
- Distinct shop doors with posted hours; lamp posts fade near the camera sightline.
- Rule tests cover clock rollover, single daily bill accrual, hours, task proximity, wages and save migration. Existing renderer-stub gameplay checks pass. Actual WebGL visual/performance verification remains unavailable in this environment.

### 0.8.0 — Camera, café employment and glass storefronts
- Click the game once to capture desktop mouse look. No held mouse button required; Esc releases and pauses, menus release the cursor, Resume recaptures. Touch retains dragging; Controls has turn buttons if browser capture is denied.
- Café employment now starts with Elena at the counter. Hire → clock in (08:00–16:00) → two named customer orders → correct drink preparation → carrying/serving → cleanup after departure → manager clock-out. Wages remain $24 once per day and are paid only at clock-out. Existing wages, housing, deliveries and saves are retained; the old casual task progress is superseded by employment state.
- Customers walk to a seat and leave after service. Drink preparation, serving and wiping take short active-play timers with arm movement. Wrong drink choices do not advance the ticket. Shift state persists and an unfinished shift expires on a new game day.
- Both shop interiors are now positioned in the city itself. Actual transparent window meshes reveal furniture, clerks and café customers through openings in the building shell. Shop entry remains an E interaction; seamless door walking is not implemented. Interior cutaway cameras use world coordinates, with glass transparency preserved.
- Tested old-save gameplay, complete hire-to-wages UI flow, wrong drinks, duplicate payment protection, clock-in schedule, mouse capture/release/menu gating and touch cancellation. Ray tests verify no opaque front wall hides glass and interior work stations are reachable. Actual WebGL visual and native pointer-lock behavior require browser playtesting; this environment previously could not initialize WebGL.

### 0.9.0 — World interactions
- Shop doors now enter immediately with a small prompt projected onto the doorway. Closed doors show hours. A rented home enters directly; unrented homes show a compact listing beside the entrance.
- Market clerk Noah handles groceries and delivery offers inside. The door no longer dispenses orders. Apartment/laundry deliveries use separate labeled collection boxes; café deliveries go to Elena. Existing carried orders still resolve through their saved route index.
- NPC conversations use compact, world-anchored bubbles with response choices and a short entrance animation; there is no world blur or full-screen conversation veil. Speakers face the player, and the camera gently frames the pair. Coffee-machine choices and kitchen/bed interactions use small object panels; timed work displays progress by the station.
- One nearest-target resolver drives both E actions and their visible prompts, including doors, people and work stations. Targets behind the camera do not draw prompts.
- Native pointer lock is requested only by a direct canvas click or explicit retry. Rejections expose the actual reason in the Controls mouse-status tooltip, activate free mouse-look, and stop automatic retries. Free look supports hover movement and continuous screen-edge turning. Menus release the cursor, focus loss pauses, and touch dragging remains supported.
- All rule/geometry checks pass, including rejected-capture fallback, edge turning, target selection, door-only entry, clerk pickup, purchases, rental/rest/bills and the complete café shift through the synthetic DOM integration test. Actual browser pointer-lock policy and WebGL visual presentation still require user playtesting.

### 0.10.0 — Camera stability, apartment polish and weekly bills
- Mouse motion resets on conversations, scene changes, menus and focus transitions. A new center-to-edge movement is required to arm free-look edge turning; returning with a stationary cursor at the edge cannot spin the camera. Stale capture deltas and late rejected requests are ignored. Closing conversation retains its camera heading instead of orbiting back to the old heading.
- Monday–Sunday calendar and week number accompany the time. Sleep and midnight use the same day/billing transition.
- Studio rent: $60 weekly. Utilities: $7 weekly baseline for the older studio plus $0.15 per successful home-cooked meal. Move-in: $30 deposit plus $60 first-week rent ($90 total). Wages and grocery prices stay unchanged. UI lists next due day, countdown, unpaid balance and estimated utilities.
- Legacy saves retain cash and all existing unpaid balances. Current renters receive a first weekly due date seven game days after migration; saves then preserve that exact billing anchor. No retroactive weekly fees or offline accrual. Multiple elapsed weeks and sleep across midnight cannot duplicate billing.
- Refrigerator fronts now align with the kitchen counter, without overlapping cabinetry. Added sink basin/rim/faucet and hob rings; dining chairs, dining table and coffee table use separate legs, and sofa cushions are distinct. Interior ambient light is softer. Furniture placement and household interaction expansion remain for the next stage.
- Validation: complete rule suite and synthetic DOM gameplay passed, including camera heading/stillness after conversation, stale edge input, late capture rejection, weekly boundaries and old-save migration. Geometry checks verify fridge alignment and walkable room paths. WebGL appearance and hardware mouse behavior still require user playtesting.

## 0.11.0 local multiplayer prototype

From this project folder, install Node.js dependencies and start the relay:

```sh
npm install
npm run server
```

In another terminal, serve the already-packaged game:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open http://localhost:8000 in two browser windows. Start/continue the game in both,
then move one player. The other window shows a blue capsule. Use a private window
for an independent browser-local profile. Ordinary tabs share localStorage, but
receive distinct server connection IDs. Start the relay before opening the game;
reload the game after restarting the relay (automatic reconnect is not implemented).

The server listens on loopback port 8080. This is a local test, not a deployed
multiplayer service: the hosted HTTPS game cannot use this as a public endpoint.
A deployed service needs a reachable wss:// endpoint and authentication. The relay
only synchronizes presence/position; jobs, clocks, NPCs, money and saves remain local.
Rooms are separate coordinate spaces; the home room is a shared test studio, not
per-profile housing instances. Profile IDs are browser-local identifiers, not login
credentials; connection IDs are server-generated and ephemeral.

`dist/state.js` owns simulation data. `dist/profile.js` migrates legacy progress
without deleting it and persists the new profile. `dist/multiplayer.js` handles
transport. `dist/remote-player.js` owns remote capsule rendering and interpolation.
`dist/game.js` registers callbacks, sends movement at most once per 50ms (including
final stopped positions and room changes), and copies simulation state to the
local mesh before rendering. Disconnected players are removed and resources freed.

Validation: run `node tests/multiplayer.mjs`, `node tests/profile.mjs`, and
`node tests/startup.mjs`. The latter uses a synthetic DOM/GPU renderer stub and
checks the existing game flow, state-driven movement, network throttle, stopped
positions and remote rendering events. Actual WebGL visual review remains manual.

## 0.12.0 smartphone foundation

Open/close the phone with **Tab** or **P**, or the HUD Phone button. **Escape**
also closes it. The cursor is released and local movement/input is cleared while
the phone is open. Click the world after closing to resume mouse look. The phone
cannot interrupt character creation, other dialogs, or a timed work action.

Home offers Gigs, Bank and Player. Bank reads current cash; Player reads current
energy and food. Accept one gig at a time, spend its listed energy cost, then follow
the gold marker and press E at the location to complete it and receive payment.
These first gigs are simple location checks; richer task mechanics can replace them.
Existing market deliveries remain available, with their own marker. Active gigs
are stored in the existing browser-local profile and survive reloads and other jobs.
Old saves default to no active gig. Insufficient energy and duplicate acceptance
are blocked; completion checks proximity and cannot pay twice.

Modules: `dist/contracts.js` owns templates and gig transactions; `dist/phone.js`
owns app navigation and display. Phone markup is in `dist/index.html`, scoped
styles in `dist/style.css`, and game/cursor/marker integration in `dist/game.js`.
No multiplayer server changes are needed. Use the same local startup commands
above. The hosted Site has not been updated with these local multiplayer releases.

Validation: `node tests/contracts.mjs` covers transactions and save preservation.
`node tests/startup.mjs` also exercises the complete phone UI, keyboard toggle,
pointer release, movement lock, app values, acceptance and marker completion with
synthetic DOM/renderer objects. Actual WebGL visual verification remains manual.

## 0.13.0 action-based energy and multi-step gigs

Accepting gigs no longer consumes energy. Drain rates (points per real second)
are standing 0.002, walking 0.025, running 0.07. Carrying a heavy gig box doubles
movement drain. Action timers use elapsed time separately from the capped physics
step; long stalls are capped at 0.25 seconds. No offline simulation is added.
Café lunch restores 15 energy; home cooking restores 20; the market cashier sells
an immediately consumed $3 energy drink restoring 30. Values stay within 0–100.

Six phone gigs now use travel → task → return stages. Bench maintenance, notices,
and sidewalk survey require 8, 10, and 12 seconds of stationary work. Café shift
requires 30 uninterrupted seconds at the marked interior station. Moving or
leaving resets timed work. Heavy delivery has a pickup and drop-off with a carrying
energy modifier. Courier work requires 20 metres actually run after collection,
plus reaching the delivery point. Return to the final marker and press E to get
paid once. Stages/progress and cooldowns persist through saving and other jobs.

Each gig type has a 120-game-minute cooldown from acceptance, stored as an absolute
game-minute expiry in `progress.cooldowns`. The board shows up to three randomized
available jobs, preserves offers between phone opens, refreshes every 30 game
minutes, and replenishes when fewer than two eligible offers remain. If fewer jobs
are eligible, it shows those available. Old active gigs migrate to the travel step;
old saves without cooldowns receive an empty object. Jobs and money remain local.

The objective HUD has a chevron to collapse into a pill. Its checklist follows
arrival, task completion, and returning for payment; markers and directions follow
the current step, including entering the café. Heavy boxes use the existing parcel
placeholder mesh.

Bed interaction fades to black, holds for one second, then fades back out (1.5
seconds total). Energy becomes 100, with no clock/day advance, food penalty,
billing, or shift reset. Input and normal simulation ticks pause during this fade.

Run the existing local startup commands. Release assets are under 0.13.0; the
hosted site is unchanged. Automated checks cover all six gig flows, cooldowns across
midnight, board stability, energy rates at 5–120 FPS, food/drinks, sleep/time
invariants, collapse controls, saved/new game flows and multiplayer. WebGL visual
review still requires a browser with GPU support.

## 0.14.0 thirst, items, inventory and survival testing

Life now includes thirst (0–100). Old saves start with full thirst; existing food,
energy and grocery packs are preserved. At normal speed food drains 0.018 points
per second and thirst 0.028. Empty food or thirst adds 1 point/second of energy
loss per depleted stat; both empty adds 2. Restoration and drain stay within 0–100.
Depletion is highlighted in the HUD. Phone Player also shows thirst.

`dist/items.js` defines 10 foods, 5 drinks and 3 equipment items, with emoji icons,
food/thirst/energy restoration and prices. Every drink restores thirst. Coffee and
energy drinks also restore energy. Equipped jacket adds 2 inventory slots; a small
or large backpack adds 10 or 20. Only one jacket and one backpack can be equipped.
The base inventory has 8 slots; consumables stack to 10 per slot. Swaps and unequip
operations that would overflow capacity are rejected without losing items.

There was no existing grid or radial UI in the previous source, so this version
adds both. **I** or Your bag opens the grid; click to consume/equip and click equipped
gear to remove it. **Q** opens/closes the radial quick-use wheel; click an item or
press **1–6**. The wheel pages through all available consumable types, showing total
quantities across stacks. **Escape** closes either view. Both release the cursor
and clear/block movement while open. Inventory and equipment persist in profiles.

Buy items through the bag's Market supplies selector while at the open market
counter, or speak to Noah → groceries → browse supplies. Legacy grocery packs stay
separate for cooking and are shown in the bag summary. Existing lunch and energy
drink transactions now also restore thirst.

Phone **Settings** includes the persistent Stat Drain Multiplier: 1×, 5×, 10×, 50×.
This scales food, thirst, baseline energy drain and depletion penalties. It does
not change the clock, movement, cooldown durations or job task timers. Menus pause
simulation as before; close the phone to observe drain. Restore 1× after testing.
Settings also includes a clearly labeled development tool to add one selected item
for free (subject to capacity). This makes all 18 items available for testing.

`state.js` exposes the state-level tick and settings setter; `life.js` contains the
pure drain calculation. `inventory.js` owns item transactions; `inventory-ui.js`
owns the grid and wheel. Phone markup/styles live in index.html/style.css.

Tests cover catalog counts and effects, clamps, drain multipliers, depletion
boundaries across FPS, unchanged game time, equipment capacity and swaps, purchases,
old-save migration, persistence, settings UI, inventory/wheel input and the existing
gameplay/multiplayer flows. Actual WebGL visual QA remains manual. Use the same local
startup commands; the hosted site remains unchanged.

## 0.15.0 store separation, storage layout and consumption animation

**J** expands/collapses the objective HUD (the chevron still works). Controls now
organize shortcuts under Movement, Actions and Menus. Esc closes store/inventory/
phone screens or toggles pause/resume for gameplay.

The bag only shows owned items, grocery packs and equipped gear. Its numbered
storage cells use a physical grid treatment, with labeled jacket/backpack slots
alongside the storage area (above it on narrow screens). There are no purchase
selectors or shop buttons in the bag or wheel.

At Noah's market counter, **E** opens the dedicated **Corner Market** screen.
Food, drinks and equipment show icons, effects, prices and Buy buttons; category
filters make the list easier to browse. Purchases revalidate counter proximity,
opening hours, cash and capacity, then deduct cash/add the item and save immediately.
Grocery packs and the existing delivery-work conversation remain available through
buttons in the store. Buying never consumes an item.

Selecting a consumable from the bag or wheel closes that overlay and starts a
one-second hand-to-mouth animation. `item-models.js` creates small low-poly food/
drink props; `consumption.js` attaches the prop to the arm's hand position, animates
the arm toward the mouth, and disposes its geometry/materials afterward. `game.js`
then consumes exactly one owned item and applies restoration against current state,
without overwriting intervening clock/survival/job updates. Full stats are checked
before starting; equipment still equips immediately. Movement and repeated use
are blocked during the animation. Pause/focus loss freezes it without granting
stats or removing the item; resume completes it. Reloading mid-use leaves the
unconsumed item in the saved inventory.

Automated checks cover all 15 consumable props, attachment/mouth reach, timing,
cleanup, delayed effects, blocked duplicate use/movement, pause/resume, J behavior,
direct counter-store entry, buying/saving, filters, owned-item bag contents and
existing gameplay/multiplayer flows. Visual WebGL review remains manual. Run the
same local commands; the hosted version is unchanged.

## 0.15.1 bug fixes: gig pause, elbow joint, release pipeline

Eating or drinking during a timed gig now pauses its timer instead of resetting it.
Only actually moving (or leaving the gig spot) resets timed work. `tickContract`
takes a new `paused` flag; `game.js` passes it while an item is being used.

Character arms are now two joints: `arms[i]` is the upper arm (shoulder pivot, still
used for the walking swing) and `forearms[i]` / `arms[i].userData.forearm` is the
forearm (elbow pivot), with a small elbow sphere to close the joint. The rest pose
looks the same as before. The use animation solves a two-bone reach to the mouth
over 0.8 s with no scaling, keeps the item upright (drinks tip toward the lips), uses
the item at 1.0 s, then lowers the empty hand over 0.45 s. Movement and other menus
unlock as soon as the item is used; the lowering finishes while you walk.

Releases: `npm run release` builds `dist/releases/<version>/` using `version` from
`package.json` and points `dist/index.html` at it. It refuses to overwrite an existing
release folder (they are cached as immutable); bump the version first, or run
`npm run release -- 0.15.2`. `npm test` runs every test file.

Validation: all 21 test files pass, including new checks for paused gig work, rigid
upper arm/forearm lengths, mouth reach for all 15 consumables, gradual lowering and
cleanup. Visual WebGL review of the new arm pose is still manual.

## 0.16.0 world zones, plot grid and lumberjacking

The world now has three zones. **Westside** (the city) keeps its exact original
footprint (x −61…58), so every existing coordinate, job and save still works.
**Oak Farms** lies west (x −168…−61) and **Alder Woods** east (x 58…168), both
z −56…56. Oak Street continues into each as a dirt road, plus a north–south lane.
Each zone has its own ground texture; the farm has 8 fenced fields with 3-cell gates
facing the road; signs mark both city exits. The HUD location shows the current zone.

`world.js` holds the pure layout (zones, walkable bounds, roads, fields, grid maths)
and `createWorld()`, which builds the zone scenery. Trees are generated from
`WORLD_SEED`, so every load makes the same forest: ~330 cuttable pines on grid-cell
centres (never touching) and ~1,090 broadleaf decor trees. All trees are instanced
(a handful of draw calls) and use a spatial hash for collisions. Trees between the
camera and the player dissolve with a dither pattern. The sun and its shadow area now
follow the player across the larger world.

**Grid/plots.** 1 world unit = 1 plot; cell `(ix,iz)` covers `[ix,ix+1)×[iz,iz+1)` and
is keyed `"ix,iz"`. Only whole cells in the farm or forest are plots.
`GameState.progress.plots` is sparse: a missing key is the generated default
(`{type:'farm',crop:null,tilled:false}` or `{type:'forest',tree:'pine'|null,hits:0}`),
so fresh saves stay small. `grid.js` has the rules (`defaultPlot`, `normalizePlots`,
`plotAt`, `setPlot`, `chopTree`); `state.js` adds `getPlot(key)` / `setPlot(key, plot)`.
In the farm and forest a faint grid fades in around the player, with a highlighted
target cell in front of them (`world.targetCell`) for future planting/building.

**Lumberjacking.** The Corner Market sells an Axe ($20, new Tools filter). Press E near
a pine: one swing per press, three hits fell it. The tree tips away from you, leaves a
stump, stops blocking, the plot is saved, and a Wood log (stacks to 10, not sold in
shops) goes in your bag. Without an axe the prompt says so; with a full bag the final
hit is refused so no log is lost. Tools and materials are not consumable and stay off
the quick wheel. Felled trees do not regrow yet; chopping costs no energy yet.

**Map.** A new zone-coloured world map sits bottom right (grey city, yellow-brown farm,
green forest, with roads, buildings, fields, pines, player arrow, view direction and job
markers). Press **M** to enlarge it.

Development: open the game with `?debug` to get `window.__city` (teleport, give items,
camera view) in the browser console.

Validation: all test files pass, including new `world.mjs` and `grid.mjs`. The game
was also run in headless Chrome (software WebGL) to check the zones, grid, dither fade,
chopping, felling and map visually.

## 0.17.0 skeletal characters and a new creator

The hand-built character is replaced by skeletal characters from Quaternius's
[Ultimate Modular Men and Women](https://quaternius.com/packs/ultimatemodularcharacters.html)
packs (CC0, no attribution required; credited here anyway). The player, pedestrians, the market
clerk, the café manager and the café customer all use them.

**Creator.** Pick a body (male or female), a whole outfit in one click, then mix the head, top,
legs and shoes individually, plus skin tone and hair colour. Male outfits: Hoodie, Casual, Suit,
Worker, Farmer, Beach, Punk, Explorer. Female: Casual, Formal, Suit, Worker, Punk, Explorer. Skin
and hair colours only change the pack's skin and natural-hair materials, so a punk mohawk or a
hard hat keeps its own colours. Clothes cannot be recoloured. Version 1 saves (the old character)
still load and keep their name, skin and hair, with the default look.

**Models are embedded.** `dist/character-male.js` and `dist/character-female.js` hold one compact
glTF each as base64, decoded once at startup with the vendored `GLTFLoader` (r160). No file server
is needed. Each is a single shared skeleton plus every outfit part (about 5–6.5k triangles per
character, about 1.95 m tall). To rebuild them from the original FBX packs:
`npm install --no-save three@0.160.0`, then
`node scripts/build-characters.mjs <male folder> <female folder>` (the unzipped
"Separate Skeletal Meshes and Animations" folders). The converter keeps each mesh's own transform,
corrects the pack's colours (they come out far too dark otherwise), welds vertices, skins the
shoes to the lower legs (the pack's foot control bones pull them off the shins), and keeps only
the Idle, Idle_Neutral, Walk, Run, Interact and Wave clips.

**Animation.** The pack has no eat, drink, chop or sit clips, so those are done in code on top of
the idle clip: `character.reach('R'|'L', point, weight)` is a two-bone arm solver that moves a hand
to a point in the character's own space (the mouth is `character.mouth`); `setSeated(true)` bends
the thighs forward; `hold(object, {upright, axis})` puts an item in the hand (upright items stay
level, tools run along the forearm). `setMotion(speed)` picks Idle, Walk or Run and scales its
speed. The mixer skips bones whose animated value has not changed, so the character restores its
animated pose before each frame's solver pass. Eating and chopping are rewritten on this
(`consumption.js`, `updateChop` in `game.js`).

**Known limits.** Other multiplayer players are still blue capsules. Shoes are rigid (no ankle
flex). Walking and running speeds are tuned by eye (`WALK_SPEED`, `RUN_SPEED` in `character.js`).
`?debug` now also exposes `scene`, `camera`, `avatar` and `pedestrians` on `window.__city`.

Release: `package-release.mjs` now copies every `dist/vendor/*.js`. `waist.mjs` is removed (it
tested the old body); `character.mjs` and `consumption.mjs` are rewritten for the new rig.

## 0.18.0 hotbar, hold-to-chop, logs, regrowth and the lumberjack skill

**Hotbar.** A bar at the bottom of the screen lists every tool and consumable you own (one slot per
item, in bag order, up to six). Press its number or click it: food and drink are used, a tool is
equipped (the axe appears in your hand and is carried at the ready; press the number again to put it
away). Clicking a tool in the bag equips it too. The Q quick wheel still works for food and drink.
The slot order follows the bag; manual arranging is not built yet.

**Chopping.** The axe must be owned *and equipped* (`progress.equipped`). Press E near a pine to swing;
**hold E to keep chopping**: after each swing you turn to the nearest tree in reach, and after a tree
falls you can walk to the next one with E still held. The tree you are about to chop gets a ring on the
ground (replacing the grid cursor). The plot grid is now hidden by default: **G** toggles it in the
farm and woods.

**Logs.** A felled pine falls away from you and leaves logs on the ground (`progress.logs`, up to 80).
Press E beside one to pick it up; they appear once the trunk has landed and rot away after two game
days. Logs sell at the Corner Market counter for $1.00 each (new button in the store).

**Regrowth.** A felled pine leaves a stump (`felledAt` on its plot, in game minutes), becomes a small
sapling after 3 game days and a choppable pine again after 7 (about 5.6 hours of play at the current
clock speed; `SAPLING_AFTER` and `MATURE_AFTER` in `grid.js`). A tree will not regrow while you stand
within 1.4 units of it. Trees felled in 0.16 and 0.17 saves start their clock when 0.18 first loads.

**Lumberjack skill.** `progress.skills.lumberjack.xp` (see `skills.js`): 2 XP per swing, 12 per fall,
40 XP to level 2 and 20 more for each level after that (cap 20). Perks: faster swings every level
(0.8 s down to 0.5 s), one more log per tree at levels 3 and 8, and trees fall in two hits from level 6.
The HUD shows the level once you have XP. The skills table is general, so farming and building can add
their own.

Not yet: real log or tree models (the Quaternius nature kit), a lumber-yard job with contracts, axe
tiers, manual hotbar ordering, and the grid appearing automatically while a build or farm tool is held.

Tests: new `skills.mjs`; `grid.mjs`, `world.mjs` and `inventory.mjs` extended; `startup.mjs` runs against
the packaged release, so run `npm run release` before `npm test`.

## 0.18.1 playtest fixes

- **Legs.** The pack's Run clip throws a thigh out sideways for part of every stride (it shows in the raw FBX too);
  its legs are meant to be driven by IK from two foot control bones. The converter now keeps the foot bones'
  position tracks and `character.js` solves each leg to its foot bone (`solveLeg`) while walking or running, knees
  forward. The shoes stay skinned to the shins. Rebuilt `character-male.js` and `character-female.js`.
- **Pace.** Pedestrians walk at about 1.4 units per second (was 0.9) with a matching walk cycle, so they no longer
  look like slow motion.
- **Names.** Pedestrians are now Alex, Sophie, Robert, Julia, Carlos and Megan to match their bodies.
- **Noah.** E at the market counter opens a short menu: *View items for sale* or *View jobs*. The store's service bar
  (groceries, sell logs, ask about work) is pinned to the bottom of the store window instead of below the items.
- **Doors.** Walking into the doorway of an open shop (or your own studio) now enters it; E still works. A closed
  shop shows its hours. There is a short cooldown after leaving so you are not pulled straight back in.
- **Task panel.** **T** (or J) shows or hides it; the panel shows a T key badge.
- **Axe.** Carried hanging at your side. The swing now starts and ends at that pose and goes up past the shoulder to
  overhead (it used to cut through the torso and throw the arm straight behind you), then down through the trunk.
- **Bag.** An equipped tool is labelled *Equipped*; the hint no longer says to press E with the axe in the bag.
- Option buttons in the creator and the hotbar can no longer be text-selected.

Stack limits (per bag slot): food, drink and wood logs 10; tools and equipment 1. The bag starts with 8 slots; a
jacket adds 2 and backpacks 10 or 20.

`?debug` also exposes `pos`, `shop`, `inside`, `place(x, z)` and `doorCooldown`.

## 0.18.2 quick wins

- **Radial progress.** Timed gigs and café steps show a ring that fills around the spot (seconds left in the middle,
  the task name below) instead of a percentage pill. One ring at a time; `updateRing()` in `game.js`.
- **Left click.** Once the mouse is captured, left click does what E does and holding it keeps chopping. The click that
  captures the mouse only captures (guarded by `look.locked()`). Right click is not used yet.
- **Task panel.** The leftover round chevron is gone: the **T** badge is the button (T and J still work).
- **Skills in the phone.** The Player app has a Skills section: Lumberjack level, XP meter, current perks, the next
  level's perk, and lifetime counters (trees felled, logs collected, deliveries). Counters are `progress.stats`
  (`skills.js` has `freshStats` / `normalizeStats`; `grid.js` increments them).
- Tests: left click (captured and uncaptured), stats, perk text.

Design rule noted for later: every building you can enter from the street has an interior behind a real door, and
buildings can have levels. Shops will get doors that open as you approach (no E), the studio keeps E.

## 0.19.0 doors and the NPC walk pass

- **Shop doors, no E.** `doors.js` has a reusable sliding glass door (`createSlidingDoor`). The Corner Market and
  Alder Coffee fronts get one each: it slides open as you walk up (only while the shop is open), and walking through
  enters. An OPEN / CLOSED sign beside the door follows the shop hours; a closed shop keeps its door shut and tells you
  its hours when you walk into it. Inside, a matching door slides open as you reach the front and walking out leaves.
  E prompts for shop doors and shop exits are gone. Your studio keeps E (`add('home', ...)` and its exit).
  `updateDoors` in `game.js` holds the rules; a 1–3 second cooldown after using a door stops loops.
- **Pedestrians.** They walk at about 2.1–2.3 units/s (was 1.4). The Walk clip's native ground speed measures 1.47 units/s,
  so at that pace the cycle plays about 1.5x and the feet do not skate. Characters with `swingArms` set (pedestrians) swing
  hanging arms opposite the forward foot (`applyArmSwing` in `character.js`) instead of the clip's bent hands.
- Tests: walking through shop doors, a closed shop, left click at Noah's counter, and the arm swing.

Next planned step: a data-driven `map-definition.js` (zones, roads, reserved plots) with the current world re-expressed in
it before any new district is added.

## 0.19.1 doorway, 12-hour clock, axe carry and swing

- **Doorway.** The bar you saw was a 30 cm sill in the shop interiors' front wall that ran across the doorway; it now stops
  either side of it. The building's collision box also covered the doorway, so the game had to teleport you in. Each shop
  now has a 2.6 m doorway of open ground, a blocker that shuts it while the door is closed (never trapping you if you are
  standing in it), and a short back wall so you can step up to the threshold but not walk on into the building. Reaching the
  threshold with the door open fades to the other side (0.16 s out, 0.22 s in) and you arrive on the interior floor by the
  door; walking out the interior door fades back to the street just outside it. Door entry no longer depends on the cooldown.
- **12-hour clock.** `formatClock` in `routine.js` gives "9:00 AM", used by the HUD and the phone. Shop hours, the door signs,
  Elena's and Noah's lines and the toasts are written as "7 AM–10 PM" and "8 AM–6 PM".
- **Axe carry.** `character.alignHeld(direction)` points a held tool along a direction in the character's space instead of the
  forearm. The carried axe now rides head-up beside the right shoulder (`CARRY_DIR` in `chop-path.js`) and follows the forearm
  again while swinging.
- **Swing.** `chop-path.js` is the swing as a pure function of progress: a smooth path from the carry pose up past the shoulder
  (in front of the body, never behind it) to overhead, an accelerating blow with a short hold at impact, and a recovery.
  The left hand grips the handle (`setTwoHanded`) and the spine leans back to wind up and forward into the blow (`setLean`).
  Swing speed still comes from the lumberjack level.
- Tests: `chop.mjs` (path continuity, speed, carry alignment, grip, lean), 12-hour clock, closed shop, doorway.
- `?debug` also exposes `doors()`.

## 0.19.2 polish: beacon, shoulder carry, hands

- **Objective beacon.** The ring and diamond are now managed in one place (`updateBeacon` in `game.js`): on the street they mark
  the market's doorway (the delivery drop-off while you carry an order), inside the market they mark Noah's counter, and they
  disappear when you are already there (2.4 m from the door, 1.8 m from the counter). The old "E · Market · work & shop" and
  "Enter <shop>" prompts, left over from the E doors, are gone; E near the drop-off now only appears while you carry an order.
- **Axe over the shoulder.** `CARRY`, `CARRY_DIR` and `GRIP` in `chop-path.js`: the hand sits by the shoulder holding the handle
  12 cm from its butt, and the head rides up and behind the shoulder. `hold(object, {grip})` places the palm that far along the
  tool. The swing starts and ends at this pose.
- **Hands.** The converter now gives Walk and Run the idle finger pose (open, relaxed hands) and adds a **Sprint** clip, the
  pack's own run with fists and pumping arms. Walking and jogging (up to 6.2 units/s) use the relaxed clips with the swinging
  hanging arms; Shift-running (faster than that) uses Sprint unchanged. `swingArms` is on by default for every character.
- Tests: hand pose by speed, Sprint, the carry direction. `?debug` also exposes `beacon`.

## 0.19.3 the map as data, and the shoulder carry

- **`map-definition.js`.** The world is now data: zones (walkable bounds, plot grid on or off, minimap colours), a road graph
  (named nodes and axis-aligned edges with a width and a surface, from which the road rectangles are derived), fenced
  fields, every building footprint (including the backdrop row), the shops (door position, door size, sign text, opening
  hours), the studio entrance, the spawn point, minimap view, reserved plots (none yet) and the procedural scenery
  parameters (tree belts, forest clearing, farm shade trees). `validateMap(map)` returns a list of problems: overlapping zones,
  roads that are not axis-aligned or touch no zone, fields off the plot grid or on a road, overlapping buildings, shop doors
  off the building's front wall, bad hours, and reserved plots that are not whole cells or sit on roads, fields or buildings.
  `world.js`, `shops.js`, `routine.js` (hours), `housing.js`, `jobs.js`, `minimap.js` and `game.js` read it; nothing else
  hard-codes those numbers.
- **Nothing visible changed.** `tests/map.mjs` checks the data against the numbers it replaced (zone bounds, roads, fields,
  fence sections, all 333 pines and 1,087 decor trees by position hash, shops, hours, spawn) and that the validator catches
  29 kinds of broken map.
- **Limits.** The minimap strips and `zoneAt(x)` fallback assume zones laid out west to east; a 2D district layout will
  need those generalised first. `server.js` still has its own spawn point.
- **Axe carry.** The grip is 18 cm along the handle, with the hand bent at the chest and the shaft crossing the shoulder.
- **`DESIGN.md`** holds the staged map plan, the tools and lumberjack progression plan, and which Claude model to use for each task.

## 0.19.4 arm and wrist fixes

Reported: the wrist spun super fast with the axe and while walking, and walking arms looked robotic, swinging straight ahead and back.
Measured first (angular speed of the forearm and wrist in a headless run), then fixed three causes:
- **The arm solver started from the animation's pose.** When that pose was nearly opposite the target, the rotation had no steady
  axis and the forearm flipped about 180 degrees per frame (191 rad/s). Every arm override now starts from the relaxed idle pose
  (`idleLocal`), the forearm turns about the elbow's own hinge (`hingeRotation`, defined even when the arm is folded or fully
  straight), and big upper-arm rotations are routed via "forward" (`bridgedRotation`).
- **The elbow flipped between two solutions** when the carried hand sat along the default elbow direction. `reach(side, target,
  weight, pole)` now takes an optional elbow direction; the axe uses `CARRY_POLE` (forward and slightly down).
- **The walking swing saturated.** It was scaled for a 0.35 m stride while the feet travel about +-0.9 m, so it flattened into
  straight-ahead-and-back. It now follows the real stride, drifts across the body as it comes forward, lags at the forearm and bends
  more on the forward swing, and the shoulders counter-twist against the hips (`applyTwist`).
- Results (rad/s): jog with the axe 191 -> 12, walk with the axe 36 -> 7, jog arms 20 -> 9. The strike is slightly longer and softer
  (`CHOP_TIMING`, an ease exponent of 1.7). Tests check stride correlation, steadiness and the carried axe; `tests/chop.mjs` is
  updated for the elbow direction.
- `DESIGN.md` now also covers fuel and gas stations, the farm slice, hired workers, parking / driving / traffic, and the asset foundation.
