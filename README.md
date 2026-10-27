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
