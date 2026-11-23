michadr.

# Packaged 0.36.4 startup and browser verification

## Startup

`tests/startup.mjs` grew from **218 to 234 lines (+16)**. Its default invocation runs Fresh save and Existing save in sequential Node child processes and propagates failure status. Both children start from the release selected by `dist/index.html`, which pointed to `releases/0.36.4/game.js` in this run. The test retains its existing assertions and uses the lobby exit when going from Studio 2B to the diner. The cafe parent assertion now reports a short message even if the player is in the wrong scene.

The original file printed the Fresh save pass and then exited 1 with `RangeError: Array buffer allocation failed`. Child isolation alone exposed a second cause. The Existing save phase pressed E at the studio exit, which returns to the lobby, then attempted to enter the diner. The failing assertion compared a whole scene object against an absent cafe mesh and Node ran out of memory formatting it. I traced the Existing save phase through the failed transition and verified the corrected route on the same package.

`node tests/startup.mjs` output (Node v24.22.1, default memory)

```text
ground cover models not loaded ReferenceError: Image is not defined
    at makeAtlas (file:///C:/Users/Michael/AppData/Local/Temp/city-startup-kTXpZz/ground-cover-view.js:30:34)
    at Object.setAssets (file:///C:/Users/Michael/AppData/Local/Temp/city-startup-kTXpZz/ground-cover-view.js:55:31)
    at file:///C:/Users/Michael/AppData/Local/Temp/city-startup-kTXpZz/world.js:610:45
[map-bake] base base 85.1 ms
Fresh save: creator, phone apps/controls/gigs, and multiplayer frame checks passed.
ground cover models not loaded ReferenceError: Image is not defined
    at makeAtlas (file:///C:/Users/Michael/AppData/Local/Temp/city-startup-NvbH1m/ground-cover-view.js:30:34)
    at Object.setAssets (file:///C:/Users/Michael/AppData/Local/Temp/city-startup-NvbH1m/ground-cover-view.js:55:31)
    at file:///C:/Users/Michael/AppData/Local/Temp/city-startup-NvbH1m/world.js:610:45
[map-bake] base base 87.0 ms
Existing save: gameplay, phone apps/controls/gigs, and multiplayer frame checks passed.
Exit code: 0
```

The ground-cover message comes from the synthetic DOM, which has no browser `Image`. Confidence is high in the startup fix and in the studio-to-street test path.

## Package snapshots

The full gate and screenshots cover the isolated copy taken at the start of the task. Its packaged game SHA-256 is `6F34E2FC5590C2FB0230F4D26A5C192DAD0785B0DBC572627C3F056CA66CBEF8`. The shared checkout received another package under the same 0.36.4 label during verification. Its packaged game SHA-256 is `8DA7C665478AEA79C7FE26B1596DF8CEC36D0CA1FF5407A49ADA22A8A092F536`. I took a second isolated copy and ran the full startup test against it. Both boot phases passed. The full gate and browser are verified for the first snapshot. The later snapshot has the startup check below.

```text
ground cover models not loaded ReferenceError: Image is not defined
    at makeAtlas (file:///C:/Users/Michael/AppData/Local/Temp/city-startup-Zmd7V3/ground-cover-view.js:30:34)
    at Object.setAssets (file:///C:/Users/Michael/AppData/Local/Temp/city-startup-Zmd7V3/ground-cover-view.js:55:31)
    at file:///C:/Users/Michael/AppData/Local/Temp/city-startup-Zmd7V3/world.js:610:45
[map-bake] base base 85.9 ms
Fresh save: creator, phone apps/controls/gigs, and multiplayer frame checks passed.
ground cover models not loaded ReferenceError: Image is not defined
    at makeAtlas (file:///C:/Users/Michael/AppData/Local/Temp/city-startup-gZQqIA/ground-cover-view.js:30:34)
    at Object.setAssets (file:///C:/Users/Michael/AppData/Local/Temp/city-startup-gZQqIA/ground-cover-view.js:55:31)
    at file:///C:/Users/Michael/AppData/Local/Temp/city-startup-gZQqIA/world.js:610:45
[map-bake] base base 84.6 ms
Existing save: gameplay, phone apps/controls/gigs, and multiplayer frame checks passed.
Exit code: 0
```

## Three.js gate

The isolated copy used the repository runner with a filename filter for `hub-*`. Its 317 selected files include source-module tests and tests that boot the 0.36.4 package. The filter excluded 26 hub files. The copy omitted the original asset archive and local tooling state. The first gate attempt overlapped Edge and the faulty assertion's memory growth. The results below come from the later serial run.

The runner recorded **308 passes and 9 failures after retry**. The `pet-actor.mjs` failure was caused by the copy omitting `assets-src/cat/cat_v2.glb`. I copied that fixture into the isolated checkout and reran the test. Across the completed gate and that rerun, **309 passed and 8 failed**. The eight remaining files failed both attempts and do not exercise the edited startup test. There were zero passes on retry.

| Remaining failure | Reported assertion |
| --- | --- |
| `fork-guide.mjs` | The bouquet has no item picture. |
| `game-name.mjs` | The name is hard-coded in `downtown-rooms.js`. |
| `inventory.mjs` | 35 unique items, with 28 expected. |
| `neighborhood.mjs` | The shop boundary assertion at line 5 failed. |
| `night-lights.mjs` | 35 glass landmarks, with 32 expected. |
| `ownership.mjs` | The assertion at line 17 reported 0 with 2 expected. |
| `profile.mjs` | Legacy grocery count was 0 with 3 expected. |
| `store-categories.mjs` | Eggs had no store shelf category. |

Cat fixture rerun

```text
PASS pet-actor: GLB verified (630880B, 24 joints, 12 clips), stride/turn/crossfade/anchors, shared clone & zero-alloc update.
Exit code: 0
```

Confidence is high in the recorded counts. Optional checks that require the rest of the original asset archive were outside this packaged verification.

<details>
<summary>Complete Three.js runner output</summary>

```text
PASS accounts.mjs: Accounts: no-database 503, dev login only locally and when switched on, header and Origin required for changes, HttpOnly cookie with only its hash stored, cloud save revisions (bad file, size, too soon, stale 409), linking by verified email, expiry, logout, and /api/ routing passed.
PASS actions.mjs: Action exclusivity (every action blocks every other, both ways) passed.
PASS apartment-lobby.mjs: PASS apartment-lobby: lobby geometry, desk, elevator floor/unit picker (Studio 2B, NPCs, co-op players)
PASS apartment-visits.mjs: PASS apartment-visits: 6 Oak Street NPC units, schedule status, standing gate, and co-op units verified
PASS assets-checklist.mjs: Checklist: 36 received and wanted assets, 5 ready to import now (Eden signs: wall board and post sign, Hotel props: reception counter, desk bell, key rack, suitcase, Base man character (Grab3D), Base woman character (Grab3D), Welding shop props: task board, time clock, parts rack, steel rack, helmet, wire spool, extinguisher, first-person torch and glove), 24 waiting for an original that is not on this PC.
PASS assets-extras.mjs: Extras: names, change marker (7 days, baseline first), heaviest-first and frame budget pinned; heaviest real asset Atv (39,295).
PASS assets-page.mjs: Assets page: 217 cards in 26 packs (12 open), 82 items needing attention, no scripts, 201 KB with 10 sample pictures.
PASS assets-server.mjs: Asset server: allowlist, Host and Origin checks, read-only and loopback pinned; 217 picture keys stable, drawing modes {"placeholder":31,"url":5,"prop":165,"nature":5,"held":5,"forklift":1,"module-glb":3,"dataurl":2}.
PASS assets-viewer.mjs: Viewer: orbit maths pinned; pages load only allowlisted same-origin modules; catalog 217 assets, 114 KB, modes {"placeholder":31,"url":5,"prop":165,"nature":5,"held":5,"forklift":1,"module-glb":3,"dataurl":2}.
PASS assets.mjs: Register rules: no unbacked claims, 0 originals checked (0 unregistered, warning only), 4 uncredited (warning only).
PASS atv-import.mjs: ATV import: PASS (class numbers, 39,295-tri model with 4 wheels = 5 draw calls, hull 1.22 x 2.07, 17 anchors with the 3 moves, paint, price, slot, tracks, sound, lamps)
PASS atv-rider.mjs: ATV rider: PASS (seat anchor from anchor_driver_seat, no passenger seat, steer cap .52 rad, hands turn about the handlebar pivot and stay in reach, jiggle bounded)
PASS audio.mjs: Audio: distance falloff (full within 2.5 m, silent beyond 40 m), saved volume and mute, one context built on the first click, blade pitch and hiss follow speed and load, the belt hums only while it runs, the lever click is limited to three at once, fuel flows with a rising pitch and chimes when full.
PASS bakery-coop-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-qMCheb/world.js:610:45
PASS bakery-coop.mjs: PASS bakery-coop: host-only board, competing claims, cancel, pickup, host exit, single payout, replay rejection and rejoin
PASS bakery-goods.mjs: PASS bakery-goods: 2 goods, 6 models (flour-sack 788, flour-carry 788, flour-pallet 2348, coffee-beans-sack 800, coffee-beans-carry 800, coffee-beans-pallet 2396 triangles), supplier property:eden-wholesale
PASS bakery-needs.mjs: PASS bakery-needs: demand, cadence, caps, fill, old-plank expiry, tracker text, garbage
PASS bakery-session.mjs: PASS bakery-session: competing claims, cancellation, loading, payout once, and stale claim cleanup
PASS basin-walk.mjs: PASS basin-walk: lake and fall pool masks (9341 lake samples all unwalkable)
PASS beacon-style.mjs: PASS beacon-style: colours by purpose, fades in 0..1 and monotonic with distance, dimmer by day.
PASS bog-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-6wWBtn/world.js:610:45
PASS brief.mjs: brief tests passed: 285 modules listed, brief 2840 and index 36380 estimated tokens (budgets 3000 and 37000)
PASS camera-orbit.mjs: PASS camera-orbit.mjs: the camera follows yaw and pitch exactly while the player walks (no lag), snaps on the first frame, and a wall pulls it in at once.
PASS camera.mjs: Camera clearance and foliage checks passed.
PASS careers.mjs: PASS careers.mjs: hiring (axe handed over once, ever; old logs bought back), promotions, quitting keeps XP, company names and co-owners, daily tasks by counters, daylight clock-in, one shift at a time, wage on site only, off-site and end-of-day clock-out, pieces, bonus, reputation, pay stubs, save normalisation.
PASS cargo-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-fI6gzM/world.js:610:45
PASS cargo-hands.mjs: PASS cargo-hands: crate/box/parcel carry normalised and slowed (one table), a crate off the bed into the hands and back (switch), parcel and box bed pieces, load drag counts them, the save migration behind PARCEL_PIECES_ENABLED (off changes nothing, on moves a held parcel once), gigs end their parcel piece
PASS cargo-items.mjs: PASS cargo-items: item shape, garbage rejected, bed rules per model, ATV rack, crates, take/summarize, hands rule, legacy round trips, parcel migration
PASS cargo.mjs: PASS cargo.mjs: three beds (the flatbed 120 units: 24 logs or 120 planks or any mix; the pickups 32), mixed loads with the last piece on first off, every piece on its bed, a load slows the vehicle, the save keeps it (and reads the first build's format), the drawn cargo follows it, owned vehicles only, and the flatbed's tailgate opens for someone behind it.
PASS carry-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-carry-TuW8AN/world.js:610:45
PASS carry-pose.mjs: Carry pose: the box rests at the belly against the sweater (both cartons), both hands on its sides, bend, the pose rules and release passed.
PASS carry-real.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-real-KwoR2N/world.js:610:45
PASS carry.mjs: Carry: a log on the shoulder (not the bag), planks in the hands, one thing at a time; the saw takes a log only while on and with room; four stacks fill the belt and one taken makes room; planks can be put down (8 stacks); the three fields save additively and old saves load.
PASS cartons.mjs: PASS cartons.mjs: 6 cartons and 2 crates at true size, one 256 px jpeg and one material each (one draw call), centred on the ground, startup module +0.45 MB, cargo.js crate = the model
PASS chainsaw-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-O2UjpD/world.js:610:45
PASS chainsaw-pose.mjs: PASS chainsaw-pose.mjs: the chainsaw bucking pose (both saws) starts and ends at the two-handed carry, is the same at 30/60/144 Hz and for the same time, has no jump at the start, the end or a cancel, cuts only after the approach, keeps the bar point on the trunk's cut line from its top down through it, recoils with a lift, vibrates a few mm at 47/53 Hz, stays bounded; the stand spot faces across the trunk on your side; the real rig reaches it with the bar within 3 cm of the line.
PASS character.mjs: Save migration, 14 outfits (4 parts, <8k triangles, ~1.9 m), part swapping, skin/hair roles, motion clips, hand reach, held items and seated pose passed.
PASS chop-swing.mjs: PASS chop-swing.mjs: five phases (wind-up 0.4, held beat to 0.52, strike to the impact at 0.62, hit-stop to 0.665, recoil to 0.72, recovery), continuous at every border and the same carry pose at both ends for 241 variants, bounded, consecutive swings differ (the notch side alternates), seeded and repeatable, frame-rate independent at 30/60/144 Hz, base swing 1.60 s with felling time kept, crew beat 1.5/2.4 s.
PASS chop.mjs: Swing path (continuous, overhead then a fast blow, in front of the body, leaning; the left hand joins and the grip slides down during the wind-up and back in the recovery), the one-handed trail carry (choked up under the head, edge down, arm at the side, left hand free), two-handed grip mid-swing and spine lean passed.
PASS chunks.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/dist/world.js:610:45
PASS clear-way.mjs: PASS clear-way: clear/repair needs never reach the board, old saves complete or abandon safely, other kinds unchanged
PASS cloud-save.mjs: Cloud saves: every sync case, first upload, download on a new browser, push only when changed, the other browser catches up (old save backed up), a both-changed conflict never overwrites and resolves either way, per-account sync records, sign-out, and no server or no network.
PASS collision-feel.mjs: collision-feel: resting gap, slide, nose-in, round collider, corners, parked car, crash and push-out passed.
PASS consumption.mjs: All 15 consumables: hand reaches the mouth with no arm scaling, item in the palm, used after one second, smooth lowering, interruption and resource disposal passed.
PASS cook-ring.mjs: PASS Cook-ring: frame-rate independent progress, hospitality-widened sweet spot, burnt/ok/good/perfect scoring, and purity.
PASS cover-view-job.mjs: PASS cover-view-job: stepped job = coverFor, staged build, empty chunk once, setTier / gone-and-back / teleport mid job
PASS cover-view.mjs: cover-view: ok
PASS creator.mjs: PASS creator.mjs: every part row names the part, no repeated labels, quick outfits set clothes only (male Explorer left out as a Suit duplicate), body switch keeps shared parts, random looks are valid.
PASS credits.mjs: Credits: 18 entries cover all 183 shipped models (6 CC0 or MIT; sr90 (itch.io), JUFF, KidBi-Gaming, Poly Pizza, Aditya Graphical, 00amza, Supplied by the project owner (author to be confirmed), Poly by Google, Forklift author (public domain; to be confirmed), The project owner, AssetsFactory, Fab (Cargo pack) with their own terms, credited with a link).
PASS crew-speed.mjs: PASS crew-speed.mjs: the Ridgeline crew never moves faster than 2.1 m/s (pedestrian pace, under the player's 4.5 m/s walk) over full working days at 30/60/144 Hz and ten days coarse, no teleports at phase or block changes, and the pose's speed matches the distance walked (feller slot 61 game min, sawyer loop 37.1 game min); calm crew: a visible tree takes >= 60 real s (8 trees on day 1), one feller at a time.
PASS crew-trunk.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-NrX3fJ/world.js:610:45
PASS culling.mjs: Tree culling: 3% of tree triangles drawn from the city, 32% at the bridge, 40% in Pine Ridge, 29% on the farm; no pop-in within 30 m (70 m for choppable pines); felling removes a tree from the draw lists; collisions unchanged.
PASS customer-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-o99kHy/world.js:610:45
PASS customers.mjs: PASS customers.mjs: a customer truck is due twenty minutes after clock-in when the day has a Load Truck task, takes planks from your hands, your truck (the rest stays on your bed) or the stock (no double pay), is sent off only when full ($0.50 a plank shipped, the task done), and the exit road starts and ends off the map.
PASS damage-feel.mjs: PASS damage-feel.mjs: hit-stop of 50 to 90 ms from 60 points, exactly the same skipped vehicle time at 20 to 240 slices a second and the same distance covered over a stop at 30, 60 and 144 Hz (the clock never pauses), red flash strength, a lamp that is off, steady or blinking by band (icon + blink, class and dataset written on change only), a panel pulse that is a class on a crash and nothing else, a stronger shake (0.03 to 0.18 m for 0.4 s), one 220-point debris pool (chips, sparks, glass, wheel spray) that is bounded and clears, bigger drifting smoke in one pool, and every page and game hook.
PASS damage-game.mjs: Damage wiring: a crash at 24 m/s takes 600 points once (Fine to Worn) and stalls; a 3 m/s bump costs nothing; a 15 m/s crash is 251 points and stalls (restart after 1 s); the pull has the right side and grows by band; burn 1.05/1.15/1.3x; a wreck never starts but can be left; cond saves and old saves load Fine; the panel row changes the band class only when the band changes; one silhouette per drivable model.
PASS damage-look.mjs: Damage look and sound: wear 0 at Fine growing to 1 at Wrecked, glass cracks from Damaged, smoke tiers grey, dark, black, a hood smoke for 60 s on a wreck, rougher engine and a misfire by band, a stall and a long crank, one paint program and one glass program for every vehicle at every condition, a pool of 150 smoke points, two small generated textures.
PASS damage-table.mjs: PASS damage-table.mjs: the crash table (printed above): the S70 and off-road lose about half at full speed and are Wrecked on the 2nd or 3rd hit, the heavy trucks lose less at the same speed (Wrecked after many hits), bumps under 4 m/s are free, a 6 m/s scrape costs 25 points or less.
PASS damage.mjs: PASS damage.mjs: impact (head-on 20, a 10 degree slide about 1.7, free 0, world/vehicle/person kinds), points (4 m/s 0, 10 m/s 84, cap 600, person 20, tough per class), the 0.5 s debounce, the five bands and withDamage (speed, accel, braking, pull, burn, cranks), stall at 250 and the 1 s restart, repair bill (25% x share lost, $25 minimum) and hours, and cond in saves (old saves Fine) passed.
PASS daynight.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-Tw5F4p/world.js:610:45
PASS delivery-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-0Y8jnO/world.js:610:45
PASS dev-server.mjs: Dev server: serves the site (no way out of its folder, read-only), refuses a foreign Host, a cross-origin page, a missing dev header, bad JSON, unknown houses, wrong floors, invalid or oversized pieces and oversized bodies without writing anything; a valid save writes interior-layouts.js and the current release, merges houses, never writes the stairs, and the file reads back.
PASS dev-wipe.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-mSq06L/world.js:610:45
PASS dev.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-inXgia/world.js:610:45
PASS diner-assets.mjs: PASS diner-assets.mjs: 9 GLBs (2464 tris total, 11 room meshes, 33 food parts <150 tris, all 18 recipes covered), 15 CC0 Ogg clips (223.6 KB total).
PASS diner-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-OHavt0/world.js:610:45
PASS diner-job.mjs: diner-job: PASS (4 tables, seeded arrivals, frame-rate independence, fail never docks wages, $10*rank bonus, JSON/garbage norm, purity)
PASS diner-recipes.mjs: diner-recipes: PASS (18 recipes, Rank 2/3 unlocks, quality/burn scoring, $0.50-$3.00 tips, purity)
PASS diner-station.mjs: PASS diner-station: scoring, burn, remake, key paths (1-9/Space/Enter/Esc), and dinerAct wiring
PASS diner-wiring.mjs: PASS diner-wiring: hospitality skill, diner tasks and pieces, hours message from the employer, $10 x rank bonus, tips in cents, failed order = -2 rep and no wage dock
PASS dock-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-ZcYQAE/world.js:610:45
PASS dock.mjs: PASS dock.mjs: the roller door rolls up when the forklift is within 3.2 m and comes down 4 s after it has gone, the forklift crosses through it with the fork height, speed and load kept (a half turn about the door, forks first stay first, a landing 0.8 m clear of the way back), only in line with the door and moving toward it, and outside it stays on the apron.
PASS doors.mjs: Doors: sliding stays automatic; hinged and double doors are manual, swing into the room about their hinges, a pair mirrors, snap shuts without the swing, a handle-less leaf is one mesh; the market is sliding, the cafe and the office have double glass doors.
PASS downtown-rooms.mjs: PASS downtown-rooms: all 9 Ironwood buildings are public, enterable, and have valid services/hours
PASS downtown.mjs: PASS downtown: 9 unique facades, sidewalk doors, staff posts, 6 converted details, 18 awnings/parasols and 14 signs; 23322 placed triangles
PASS driver-lag.mjs: Driver lag: the seated driver tilts with the cab: head and hips within 1 cm of the seat anchor and the hands within 15 cm of the wheel grips over an S-turn at 25 m/s at 30, 60 and 144 Hz; the old turn-only body drifts more than 2 cm.
PASS driving-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-driving-jCHPJr/world.js:610:45
PASS eastbank.mjs: Eastbank Works: Works Lane and a 12 m Freight South close a drivable loop; 5 buildings in their plots (all in the registry with reasons), 20 paving rectangles that are asphalt, connected to the roads and walkable; 8 m driveway cuts clear for a truck; 101 yard props in 5 chunks under the caps; solid and walk-over parts; culling; 10 broken yards and maps caught.
PASS eden-wholesale-place.mjs: PASS eden-wholesale-place: C21 with 3 m rear alley, 8 SOLIDS colliders, public retail door, clear dock approach, ingredients and opening hours, 2928/112/14 body/window/lens triangles, windows lit 06:00-19:30 in the dark, supplier property:eden-wholesale
PASS eden-wholesale.mjs: PASS eden-wholesale: 3054 triangles (14 lamp-lens), 15 anchors (7 lamps, side door) + sign node (letters 0.536 m), sells flour and coffee-beans, open 07:00-17:00, 2 candidate sites clear of C1..C20, H1 and the car park
PASS energy.mjs: Frame-rate-independent energy rates, heavy load, food/drink restoration and bounds passed.
PASS farm-beds.mjs: PASS farm-beds.mjs: BEDS entries (tow_tank, grain_cart, combine), liquid/bulk normalization, loadFraction, and timber rejection passed.
PASS farm-houses.mjs: Farm houses: PASS (2 ids, 15973 triangles, ~8,000 each, one mesh and one draw call each, real size, lazy module)
PASS farm-lazy.mjs: Lazy farm props: PASS (65 farm.* ids load on demand; nothing crashes before)
PASS farm-props.mjs: farm.zebra      0.5 x 1.9 x 1.4 m   1354 tris  2 colours  1 boxes
PASS farm-tractors.mjs: Farm tractors: PASS (Hustler Compact and Husky R75 classes, tractor surface group, bog 33 s / 83 s / 22 s, 3 models with wheels and anchors, paint, price, slots, tracks, sound fallback, credits)
PASS flatbed.mjs: PASS flatbed.mjs: the Tylan Flatbed: 5,796 triangles in nine parts with its anchors, wheels on pivots, a hinged tailgate, six paint colours set directly, 35 mph and slow off the mark, the third truck bay, $8,000, and locked below Lumberjack level 5 on the lot and on the phone.
PASS footing-match.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/dist/world.js:610:45
PASS forest-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-WvUg37/world.js:610:45
PASS forest-tasks.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-wrG80y/world.js:610:45
PASS forest.mjs: PASS forest.mjs: ten cut blocks, two marked a day by the day number (all come round, 40 to 400 marked pines), the landing on open ground, a marked tree pays $3.00 and an unmarked one $0.75 (no reputation lost), logs stacked at the landing join the company pile (saved, and can be taken back), planks delivered to the lumberyard join the stock and pay $7.30 each; all only on a Ridgeline shift.
FIRST RUN FAILED fork-guide.mjs (93 ms), retrying once:
AssertionError [ERR_ASSERTION]: bouquet has a picture
    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/fork-guide.mjs:66:74
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: '==',
  diff: 'simple'
}

Node.js v24.22.1
FAIL fork-guide.mjs
failed twice. Second run:
AssertionError [ERR_ASSERTION]: bouquet has a picture
    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/fork-guide.mjs:66:74
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: '==',
  diff: 'simple'
}

Node.js v24.22.1
PASS fork-pallets.mjs: PASS fork-pallets.mjs: pocket (tine tops 2 to 18 cm above the base, within 18 cm and 11 degrees, from either end), engage at 35 cm and lift at 14 cm, tines blocked by a pallet at the wrong height or crooked, shelf lanes (square, off the uprights, at a level height), a carried pallet resting in a free cell, on an order square or on the floor, not going through other pallets, the drive step stopping short and backing out.
PASS forklift-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-wo4NPQ/world.js:610:45
PASS forklift.mjs: PASS forklift.mjs: arcade drive (2.6 m/s, 5 m/s with Shift easing back down when released, rear-wheel steering with the tail swinging out, wheels that roll, slower in reverse, under 4.8 m turning circle, no spinning on the spot, stops at walls), forks 0.08 to 3.05 m reaching all three levels, an old save with a fork load becoming a pallet, the converted 14,000-triangle model with its four wheels on their axles, and the vehicle panel in forklift mode.
PASS fuel-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-fuel-vRQnPq/world.js:610:45
PASS fuel.mjs: Fuel (imperial): whole-cent sales in gallons (gas and diesel, wrong fuel, full, broke, invalid, clipping), small steps cost the same as one big sale, mph, the burn rate, the hose (66 vertices, 120 triangles), the pump screen text, the drive-through station (canopy columns solid, the lane under the roof open, both trucks drive through), and saved fuel in milli-gallons.
FIRST RUN FAILED game-name.mjs (411 ms), retrying once:
+   'downtown-rooms.js'
+ ]
- []

    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/game-name.mjs:28:8 {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: [ 'downtown-rooms.js' ],
  expected: [],
  operator: 'deepStrictEqual',
  diff: 'simple'
}

Node.js v24.22.1
FAIL game-name.mjs
failed twice. Second run:
+   'downtown-rooms.js'
+ ]
- []

    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/game-name.mjs:28:8 {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: [ 'downtown-rooms.js' ],
  expected: [],
  operator: 'deepStrictEqual',
  diff: 'simple'
}

Node.js v24.22.1
PASS garage-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-ss0FZy/world.js:610:45
PASS garage-reload.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-LcfkdQ/world.js:610:45
PASS garage.mjs: Garage: quotes match damage.js ($125 S70, $2,750 pickup, $25 minimum), pay and wait game hours then collect Fine, partial repair to 70%, the repair kit (+15% up to 40%, one consumed), the tow fee table ($75 to $250) and a tow of a far-off wreck from saved data, a driven vehicle refused, hard luck (free tow and repair to 400, once per 7 days), the garage save with junk and old saves, status text, and purity.
PASS gig-clients.mjs: PASS gig-clients: profile, complications, regulars, tiers, save normalizing
PASS gig-parcel.mjs: gig-parcel ok
PASS gig-pay.mjs: PASS gig-pay: par, wage, fatigue, tip cap, too-fast, integer cents
PASS gig-tracker-text.mjs: PASS gig-tracker-text.mjs: plank gigs read "Load the planks at the sawmill (E)"; crate gigs keep "Load the crates at the pile (E)".
PASS gigs-game.mjs: gigs-game ok
PASS gigs.mjs: gigs ok
PASS google.mjs: Google sign-in: not-set-up fallback, the redirect (client, callback, scopes, state, nonce, PKCE S256, HttpOnly attempt cookie), cancelled/state/code/exchange/network failures, ID token issuer/audience/expiry/nonce/subject checks, success (session, attempt cookie cleared, verified email kept), and the Account panel's Google button and return messages passed.
PASS gps-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-iA1uzG/world.js:610:45
PASS gps.mjs: PASS gps.mjs: routes with left/right/arrive turns, direct fallback, pins, job auto-route and switch, reroute cooldown, arrival; Oak Street to the P3 lane is 497 m with 1 turn(s), built in 4.7 ms
PASS grid.mjs: Plot defaults and validation, equipped-axe chopping, XP and level perks, logs on the ground (fall direction, pickup, full bag, expiry), stump-sapling-pine regrowth, and saves passed.
PASS grocery-migrate.mjs: PASS Grocery-migrate: idempotent unpacking into studio/property fridge, inventory fallback, $4.00 refund on full bag, safe on missing fields, and purity.
PASS ground-cover.mjs: ground-cover: ok
PASS ground-feel.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-yNdstd/world.js:610:45
PASS ground-shader.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/dist/world.js:610:45
PASS height.mjs: Height: the river valley (a bed below the ground, gentle banks) and arched bridges, five outer hills, a gentle dirt track up the big one, vehicles tilting with the ground; the outer hills peak at their height and meet flat ground at their edge, every zone is flat; with the ground raised 5 m the standing height, the landmarks and the vehicles all rise exactly 5 m (decks are measured from the ground under them).
PASS hitch-capture.mjs: PASS hitch-capture: first render owns its CPU sample and a long quality-switch gap stays with its trigger
PASS hitch-rules.mjs: PASS hitch-rules.mjs: constants, pinWorldPos, hitchAvailable, tractrix 165Hz convergence, jackknife clamp/stop, reverse assist decay, derate numbers, collision bisection, and 70 deg hull clearance passed.
PASS hotel-lobby.mjs: PASS hotel-lobby: lobby & suite geometry, reception desk, archway, bed sleep range, walls
PASS house-signs.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-f12uk2/world.js:610:45
PASS housing.mjs: Weekly rent, usage utilities, sleep/midnight boundary, legacy debt migration, weekdays, saving and kitchen alignment passed.
PASS hud-cards.mjs: PASS hud-cards.mjs: speed text/bar/bands, fuel/damage bars, view cone angle, street chips from MAP.roads, purity.
PASS hud-layout.mjs: PASS hud-layout.mjs: right-column DOM order, all required JS IDs, large-map centering, safe-area & reduced-motion rules, and zero box overlaps at 1920x1080, 1280x720, 1024x600, and 360x780.
PASS indoor-camera.mjs: Indoor camera: the walls between the camera and you fade on the upper floor too, the far wall stays, and bounded shop rooms clamp inside walls and ceiling.
PASS input.mjs: Movement release, focus loss, visibility, stale repeats, pointer cancellation and menu checks passed.
PASS interactions.mjs: Nearest door/person/station selection and world prompt projection passed.
PASS interior-edit.mjs: Interior editor: nine generated layouts have no problems; moving (exact steps, kept inside the walls), turning, copying, deleting and adding; the stairs are fixed; missing stove or bed, a blocked door, overlaps, pieces outside and walled-off routes are named; saved layouts are validated whole and keep the stairs; a room refreshes its models, collision boxes, bed and kitchen spots and selection box from its layout.
PASS interior.mjs: Interior route connectivity, camera distance, wall cutaway and solid collisions passed.
PASS interiors.mjs: Interiors: 9 house rooms (237 pieces of furniture): every piece inside its room, nothing overlapping, the door clear; you can walk from the door to the stove, the bed and the stairs on every floor; built rooms have a scene per floor, a model per piece and walls that stop you.
FIRST RUN FAILED inventory.mjs (222 ms), retrying once:

    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/inventory.mjs:7:8
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: 35,
  expected: 28,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v24.22.1
FAIL inventory.mjs
failed twice. Second run:

    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/inventory.mjs:7:8
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: 35,
  expected: 28,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v24.22.1
PASS jobs-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-Q5h9eX/world.js:610:45
PASS jobs.mjs: Job flow, proximity checks, one-time wages, route cycling, resume, corrupt saves and blocked storage passed.
PASS junctions-r4.mjs: R4 junctions ok: 346 checks: 9 angled patches at 4 joins (29 patches in all), Kaspian Bay in TOWNS with 5 street names and 5 signs, West Bank Lane linked.
PASS junctions.mjs: Junctions: 29 patches (25 rounded corners, 4 width tapers), all road on the terrain mask, none inside a town, on paving, a plot, a building or a field.
PASS kitchen-ui.mjs: PASS kitchen-ui: all 8 recipes rendered, split bag+fridge cooking, 20-slot fridge & bag transfers
PASS legacy-keys.mjs: PASS legacy-keys.mjs: the rename keeps old saves: citylife.* keys are copied once to edenridge.* (never overwriting, old keys kept, no throw on a full storage), and save files with the old marker are still accepted.
PASS load-drag.mjs: PASS load-drag: factor, masses, ATV rack (1 log, 1 plank stack, 1 crate), stowed parcel, drag only on the ATV
PASS logging-sounds-game.mjs: PASS logging-sounds-game.mjs: audio.logging non-repeating over 30 hits, 49 clips requested, forest loop gain bounded/ducked/silent indoors, seeded creak gate (10 creaks in 300 s), game.js hooks present.
PASS logging-sounds.mjs: PASS logging-sounds.mjs: 50 logging/ambience clips (1464.2 KB logging, 3.84 MB total payload), chopLayers + fellSequence + 200-pick no-repeat verified.
PASS logging-tutorial.mjs: PASS logging-tutorial
PASS look-controls.mjs: Native capture, intentional release, denied capture fallback, edge turning, menu gating and touch passed.
PASS look-edge.mjs: Look edge: eased turn (drift at the zone edge, the cap at the screen edge, symmetric, capped per frame), focus loss and hidden tab stop it, one retry after the Esc cool-down, a second refusal falls back, a menu cancels the retry.
PASS lumber-hut.mjs: PASS lumber-hut.mjs: 40 board stacks (160 boards) and 80 slabs fit the hut's deck in their own halves, under the eaves, none overlapping; taking lifts the top stack; storing stops at the caps (the rest stays in the hands); X stores at the hut, refuses elsewhere in the timber yard, is unchanged outside; a board put back takes back its Mill piece.
PASS main-menu-return.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-6N6BqN/world.js:610:45
PASS map-bake.mjs: PASS map-bake: shade grid, ground colours, rotated footprints, sliced budget, BASE first, LRU, invalidateAt, real BASE, whole world (chunk masks, rock, cache 32)
PASS map-view.mjs: PASS map-view: view math, crop window, tiles, level, zoom curve (top 29 m/s), smoothing, pick, chevrons, cull
PASS map.mjs: Map data is valid and frozen; zones, roads, fields, trees, shops, hours, studio and spawn match the numbers they replaced; 77 broken maps are each caught; Ironwood, Cedar Heights, Eastbank Works, the second bridge and the plots are in place.
PASS menu-scene.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-Fv8ll4/world.js:610:45
PASS menu.mjs: Main menu: address parsing (bare hosts, ports, ws/wss, refusals), saved settings, panels, host and join (success, refusal, timeout, cancel, no double start), online lobbies (relay address, create, join by code, refusal reasons, update), and the page and its background image passed.
PASS messages-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-Hkm6N8/world.js:610:45
PASS messages.mjs: PASS messages.mjs: saved newest first with an app, time and read flag (at most 50, text cut at 300), unread counts per app and in total, reading one app or all, the game weekday and clock, and a clean save.
PASS minimap-local.mjs: PASS minimap-local: 200x200 local window, 150 m on foot, speed zoom + look-ahead, no clamp at the world edge, dashed border, route culling, chevrons, invalidateAt
PASS mp-clock.mjs: PASS mp-clock: real relay and clients: host is the first player, a join gets the host time at once, only the host can send a clock, junk is not relayed, the next oldest player becomes host
PASS multiplayer.mjs: Real WebSocket clients: joins, snapshot, movement, ID spoof rejection, malformed messages, house rooms, version refusal, leave, and mesh smoothing passed.
PASS nature.mjs: Nature models: 5 trees at 800-1,350 triangles, 3.4-3.9x the player's height, 20 tree meshes, 1.06 M triangles if every tree were in view, pines in the woods and broadleaf elsewhere, sightline fade kept.
PASS needs-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-W86nRn/world.js:610:45
PASS needs-loop.mjs: PASS needs-loop: need opened day 103 (14 dozen), board slot, 14 dozen (4 crates) farm 66->52, shelf 0->14, price 563->563, paid 8658, mood 60->64, standing 0->1
PASS needs.mjs: PASS needs: one need opens, hysteresis, claims + lapse, pro-rata fills, conservation, over-fill pays nothing, expiry (late fill, mood, prosperity, price), cap, determinism, slot shape, pay, no clock/chance
FIRST RUN FAILED neighborhood.mjs (254 ms), retrying once:

    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/neighborhood.mjs:5:469
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: '==',
  diff: 'simple'
}

Node.js v24.22.1
FAIL neighborhood.mjs
failed twice. Second run:

    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/neighborhood.mjs:5:469
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: false,
  expected: true,
  operator: '==',
  diff: 'simple'
}

Node.js v24.22.1
FIRST RUN FAILED night-lights.mjs (509 ms), retrying once:

    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/night-lights.mjs:58:66
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: 35,
  expected: 32,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v24.22.1
FAIL night-lights.mjs
failed twice. Second run:

    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/night-lights.mjs:58:66
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: 35,
  expected: 32,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v24.22.1
PASS no-pause.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-jvayDt/world.js:610:45
PASS npc-busyness.mjs: PASS npc-busyness
PASS npc-chat.mjs: PASS npc-chat: 39 people greet by name, deterministic, time of day, home, job, and live town rumors
PASS npc-crowd-separation.mjs: PASS npc-crowd-separation: closest pair 0.80 m
PASS npc-dialogue.mjs: PASS npc-dialogue: talk effects and caps, Oscar refusal, Lincoln pages and sulk, Brentster steers, met set and save round trip, People rows (unmet hidden), door-knock table, roster planner (sick stay home)
PASS npc-life.mjs: PASS npc-life: roster, tiers, +3/day standing cap, sickness band, Oscar/Lincoln/Brentster rules, canVisit, namedPlan, visits, needs, determinism
PASS npc-relations.mjs: PASS npc-relations: unified standing, discounts, gifting, personal favors, and venuePatrons verified
PASS npc-routes.mjs: PASS npc-routes: 412 walking blocks, worst hurry 1.00x (old estimate 1.10x), table 45 pairs
PASS npc-static-blocked.mjs: PASS npc-static-blocked: 82740 samples (16033 blocked) identical at spawn, with farm+forest loaded, after 395 trees felled and 67 landmarks hidden, and against the unstreamed world
PASS npc-talk-hold.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-JP9pjw/world.js:610:45
PASS npc-walk.mjs: PASS npc-walk: 39 people, 218 walking blocks over 4 days, {"walk":579,"stand":2599,"hidden":28958} poses sampled
PASS objective.mjs: Objective resolver (gig outranks delivery outranks the market; shop-local versus world space; no stray beacon) passed.
PASS office-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-AWxnfr/world.js:610:45
PASS order-pallets.mjs: PASS order-pallets.mjs: an order's staging square holds a real pallet (the first stack makes it, the ticket keeps its square when older orders finish), a plain pallet from the forks gives the order what it needs and the surplus is split off, the order pallet can be lifted, set on the floor and put back but never ships from anywhere else, never goes in a rack or counts as stock, loading consumes it, a failed order releases it wherever it is, saves are cleaned and old staged orders migrate, and its tag is a green plate with the number above.
PASS order-table.mjs: PASS order-table.mjs: the board lists your orders, then the ones you can take (soonest due first), then the ones for a higher rank, three buttons at a time with a More button; each order has a card with the customer, what to do, the address (never an id), the due time, the pay and the penalty, what rank it needs, and for your own orders what to do next; only an order you can take offers Accept.
PASS orders-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-3W56dJ/world.js:610:45
PASS orders.mjs: Orders: size-class fees (small $3 per six, medium $8 per two, large $25), delay by the slowest class, a home is needed, the main home setting, parcels wait at the locker or box and are collected into the inventory (a full inventory leaves the rest), at most 8 orders at once, vehicles bought on the lot or ordered (one of each, parked near the home on arrival), and save round trips.
PASS outline-rules.mjs: PASS outline-rules.mjs: 0 on Low/disabled, 28..45 m fade, clamped widths, driven + 2 nearby vehicles within 35 m, purity.
FIRST RUN FAILED ownership.mjs (214 ms), retrying once:

    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/ownership.mjs:17:131
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: 0,
  expected: 2,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v24.22.1
FAIL ownership.mjs
failed twice. Second run:

    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/ownership.mjs:17:131
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: 0,
  expected: 2,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v24.22.1
PASS paint.mjs: Paint: worktruck 6 colours, flatbed 6 colours, shortbed 6 colours, offroad 6 colours, tractor_juff 6 colours, atv 6 colours, tractor_kidbi 6 colours, unique ids, valid shader numbers, the first colour is the model's own, unknown colours fall back.
PASS pallets.mjs: PASS pallets.mjs: pallets as objects (one per rack cell, one on the forks), old counts read and migrated and then dropped, stacking, picking (an empty pallet is collected), the forklift lifting a whole pallet and setting it down or merging, the crew's put-away (floor level first, nearest the door, pallets of 40), clean saves, and the one-draw-call tag atlas (24 nearest within 10 m).
PASS parcel-fixes-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-aghYWW/world.js:610:45
PASS parcel-fixes.mjs: PASS parcel-fixes.mjs: a crate bed with anything else on it refuses the need crates (Clear the bed first.), a parcel on a far bed ticks no stop and pays nothing (in hand, ridden or within 12 m it does), parcels and boxes are no plank stacks and a box is drawn as the carton, the arms hold a crate, box or parcel piece, and a parcel of a gig not yet picked up is an orphan.
PASS passout-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-SHePsE/world.js:610:45
PASS pause-menu.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-o2tJro/world.js:610:45
PASS perf-gate.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/dist/world.js:610:45
PASS perf-probe.mjs: PASS perf-probe: Dev Mode + ?perf=1 only, fixed sample arrays, nearest-rank min/mean/p95/p99, CPU frame and interval from the frame loop, GPU from WebGL timer queries or WebGPU timestamps, printed once, click restarts.
FIRST RUN FAILED pet-actor.mjs (75 ms), retrying once:
Error: ENOENT: no such file or directory, open 'C:\Users\Michael\AppData\Local\Temp\eden-0364-sol-1695ac3b\assets-src\cat\cat_v2.glb'
    at Object.openSync (node:fs:621:18)
    at Object.readFileSync (node:fs:487:35)
    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/pet-actor.mjs:17:18
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  errno: -4058,
  code: 'ENOENT',
  syscall: 'open',
  path: 'C:\\Users\\Michael\\AppData\\Local\\Temp\\eden-0364-sol-1695ac3b\\assets-src\\cat\\cat_v2.glb'
}

Node.js v24.22.1
FAIL pet-actor.mjs
failed twice. Second run:
Error: ENOENT: no such file or directory, open 'C:\Users\Michael\AppData\Local\Temp\eden-0364-sol-1695ac3b\assets-src\cat\cat_v2.glb'
    at Object.openSync (node:fs:621:18)
    at Object.readFileSync (node:fs:487:35)
    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/pet-actor.mjs:17:18
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  errno: -4058,
  code: 'ENOENT',
  syscall: 'open',
  path: 'C:\\Users\\Michael\\AppData\\Local\\Temp\\eden-0364-sol-1695ac3b\\assets-src\\cat\\cat_v2.glb'
}

Node.js v24.22.1
PASS pet-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-f57Kd8/world.js:610:45
PASS pet-view.mjs: PASS pet-view: clipFor variety/sleep/hunger, nextWaypoint bounds/furniture, blendTime, petSnapshot validation, interiorSpawn, purity.
PASS pets.mjs: PASS pets: offer, hunger, feed, pat, tick, run-away, normalise, rehome, mood
PASS phone-calls.mjs: PASS phone-calls.mjs: the contact list is data (ids, numbers, kinds, handlers, hours, 1 to 2 s of ringing); the tow line is busy ("Line busy", no ringing) unless you are in a vehicle and then asks which one, with the garage quote per vehicle; the workshop says to visit; a placeholder business answers in its hours and does not answer outside them; the five phone clips are registered, on disk and small.
PASS plank-delivery.mjs: PASS plank-delivery.mjs: all 5 BEDS verified (flatbed 120, shortbed 44, worktruck 32, offroad 32, atv 4), whole-dollar rounding & priceTable scaling, zero free planks, refusals, deterministic, pure.
PASS plank-economy.mjs: Plank economy: 1 log = 4 planks, trickle 6/day vs old 24, level 1 worktruck cycle 32 planks in 177.7 game min = $263.20 (8887 c/h) beats the best existing job ridgeline-fell (6934 c/h) by 28%, levels 1:+28% 3:+21% 5:+14% 7:+7% 10:-10%, Prices screen low/high/normal notes, garbage safe, frozen, pure
PASS plank-gig.mjs: PASS plank-gig.mjs: supplier and house board slots, whole-stack pickup, full/partial delivery with give-back, cancel give-back, and old-save load passed.
PASS plank-needs.mjs: PASS plank-needs: threshold, stacks, price, ids, pallet guard, garbage, determinism
PASS planks-wiring.mjs: PASS planks-wiring: one plank source (world sawmill rate gone, trickle 6/day into the yard, supply to the supplier from the yard, 10-day conservation), old saves move world planks + belt into the yard once, junk yards load, 1 log = 4 planks in 4 game min, rack cell pays $5.00 once per shift with leftovers in the hands, game.js wired, name tags removed
PASS population.mjs: population tests passed: 24 residents in 16 households, 15 commuters, 33 posts
FIRST RUN FAILED profile.mjs (268 ms), retrying once:

    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/profile.mjs:6:102
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: 0,
  expected: 3,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v24.22.1
FAIL profile.mjs
failed twice. Second run:

    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/profile.mjs:6:102
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: 0,
  expected: 3,
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v24.22.1
PASS properties.mjs: Properties: 29 registered (eight Cedar Heights houses and the farmhouse with locked doors, four vacant and five with residents; shops public, the studio for its tenant, the offices, barns and sawmill explicitly not enterable); every door faces its street with a clear approach; eight driveways, front paths and parking spots join the loop road, four with a parked car.
PASS props.mjs: Props: 98 converted models (178017 triangles in all: 12 houses and 9 shops and offices, the farm set, the timber yard, nine vehicles and 24 pieces of furniture, and 11 pallet, crate and loading-zone props and 6 gas-station props kept at true size, instanced), every landmark inside its zone and plot, clear of roads and of each other, solid with open yards, houses facing their street; the rigged sawmill (solid posts, bench, conveyor and log pile, two decks, every anchor reachable) and the culling.
PASS quest-chain.mjs: PASS quest-chain.mjs: landing retired (kept hidden for old shifts), gather counts trunks once, buck pays 100 c only on shift and only for marked pines (flag saved, old trunks count as marked), feeding pays 120/150, boards 25 and slabs 40 count for Mill, haul pays 730 per board and 1400 per slab, no cash sale, old saves and shifts load.
PASS real-models.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-fHxMJY/world.js:610:45
PASS recipes.mjs: PASS Recipes: 8-recipe table, canCook/consume immutability & multi-stack deduction, hospitality + quality scaling, and purity.
PASS relay-protocol.mjs: Relay protocol: codes, rooms, hello and version refusal, rate limit, lobby join/full/move/leave, restore passed.
PASS rescue-ru2.mjs: PASS rescue-ru2 (31 checks)
PASS rescue.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-Nd9SZw/world.js:610:45
PASS river-bank.mjs: PASS river-bank.mjs: 2830 checks (sloped bank, 1 m shore mesh and a steady waterline, grass shoulder with mud only on the wet bank, the road meets the bridge straight and centred, soft turn-back for three vehicles forwards, in reverse and at 45 degrees, at 30/60/144 Hz, decks never a hazard, walking unchanged)
PASS road-geometry.mjs: road-geometry ok
PASS road-graph.mjs: road-graph ok
PASS road-r3a.mjs: R3a ok: gravel roads drawn and painted, 3 street tags, 3 new wild roads, grades fine.
PASS road-r3b.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/dist/world.js:610:45
PASS roads.mjs: Roads: one paved network (1 piece); every walkable road can be walked along its length; every road end joins another road or is a declared dead end.
PASS roller-door-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-v9bFmn/world.js:610:45
PASS rory-routes.mjs: PASS rory-routes: 6 real spots, 30 routes none direct, longest 448 m (rory-bench > rory-edge-east, 107 game min at 2.1 m/s), worst detour 2.95x, 858 walk blocks over 180 days, latest home 22:49, worst hurry 1.00x, 15 days at camp, most pavement-rule clipping 0.5 m on one route
PASS routine.mjs: Clock, midnight billing, shop hours, shift tasks, one-time wages and save migration passed.
PASS safe-spot.mjs: Safe spot: the nearest clear spot (already-fine points kept, car and wall cases, closed courtyards refused, big enclosures allowed, search limits, one call per candidate), the 0.31 parked-car spawn on the real map (0.7 ms) and clear answers across the map passed.
PASS save-file.mjs: Save files: stored save read/write in the game's own shapes, export/import round trip, file name, refusals (not a save, newer format, damaged, too big), hand-edited files normalised, backups (newest first, duplicates skipped, 5 kept, 1 MB cap, full storage), import and restore keep a backup.
PASS save-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-mWmbRM/world.js:610:45
PASS save-menu.mjs: Save menu: export off without a save, export downloads a named file, one backup per Play, import refuses bad files, asks first, Cancel changes nothing, Replace backs up then reloads, the backup list and Restore, a refused write changes nothing.
PASS sawdust.mjs: Sawdust: a 300-point ring that falls, slows and dies on time or at the floor; one Points object, hidden when empty or out of range, no shadows, thrown along the log's way at any yaw.
PASS sawmill-asset.mjs: Sawmill asset: 48 nodes, 28 draw calls (was 92), 1680 triangles, 3 skinned nodes, 5 clips, 16 anchors, emissive materials intact; loop clips carry one extra frame (reported).
PASS sawmill-pile-timber.mjs: PASS sawmill-pile-timber.mjs: 20 trunk slots and 84 slab slots at the feed end, no overlap with the log deck, each other or the switch, deterministic, frozen.
PASS sawmill-pile.mjs: PASS sawmill-pile: 45 stack slots in the shed (cap needs 40), 3 crossed layers, none overlap, all under the beams; every plank 0..160 drawn, odd planks in slot 0, taking lifts the top stack; 42 log places for 40 logs
PASS sawmill-placement.mjs: Sawmill placement: at the old sawmill's map position, turned -90 degrees, the whole bounds inside Pine Ridge's clearing, no trees, walkable, 5 m or more from the roads, the hut, the logs and the flatbed; nothing reserved in the way.
PASS sawmill-rig.mjs: Sawmill rig: rules, trimmed loops (1.0 s, 24 poses), switch and blade together, mid-swing reversal, coasting stop, a cut from log to stack on the belt (planks hidden after, belt riding to the end stop, rollers turning only while it moves), the beacon, planks on the ground; shadow draws 11 (was 30), the other 19 small parts do not cast.
PASS sawmill-yard-trunks.mjs: PASS sawmill-yard-trunks.mjs: trunks sawn whole into 2 slabs in 12 s, logs before trunks, a cut finishes first, caps (20 trunks, 80 slabs), takeSlab, v1 saves load, frame-rate independent.
PASS sawmill-yard.mjs: PASS sawmill-yard: 1 log = 4 planks, 30/60/144 Hz frame-rate independent sawing (4 game min/log), trickle 6/day idempotent, clamp 40 logs / 160 planks, takeStack max 4, normalizeYard/garbage safe, immutable, deterministic, pure
PASS scene-edit.mjs: scene-edit ok
PASS scene-editor.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-ViqzKX/world.js:610:45
PASS scene-overlay.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-JhamlF/world.js:610:45
PASS schedule.mjs: outside: 6.7% of residents' day in 435 blocks
PASS session-clock.mjs: PASS session-clock: validation, join snap, same-rate run, drift easing (no jumps, converges, never backwards), 30 s broadcast, visit vs sync, relay host rules
PASS shadows.mjs: Shadows: a 90 m box (4.4 cm a texel) that moves in whole texels; fade 0 under 6 degrees and 1 over 12, the pass skipped for 118 of 1,440 minutes; moon shadows on; Low: one mesh of at most 48 patches (96 triangles, 1 draw call), none on High, indoors or at the horizon.
PASS shop-closed-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-oBMpVL/world.js:610:45
PASS shop-presence.mjs: Shop presence: market 07:00-22:00 and cafe 08:00-18:00 hide clerk/customers/cups when closed, ramp lightScale smoothly, stepLightScale is frame-rate independent, and module is pure.
PASS shortbed.mjs: PASS shortbed.mjs: the Kasumuchi S70: 7,758 triangles in 16 parts (764 of them the interior) with its anchors, tyres on the ground (nothing below y 0), wheels on pivots (steer 35 degrees), doors swinging 70 degrees, one paint material in six colours, 65 mph and 19 s to reach it, 5 mpg on gasoline, the first car bay, $500.
PASS skills.mjs: Lumberjack levels, perks (swing speed, hits per tree, logs per tree), XP gains, level-ups, cap and save validation passed.
PASS sleep-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-dkVGIB/world.js:610:45
PASS sleep.mjs: Sleep: wake at 6 AM (today or tomorrow), the next day starts when midnight is crossed, food and thirst drain at a quarter of the awake rate, never below zero, and multiplayer moves nothing but energy.
PASS slope-a2.mjs: PASS slope-a2: grade, roll back, side slide and steer refusal for slope:true classes; others unchanged
PASS smoke.mjs: Smoke: slight (idle 2 puffs a second, at most about 9 flat out), more from cheaper tiers, a key-turn burst, rising and fading puffs in one pool of 150 points (one draw call, hidden when none live), and each vehicle's muffler tip at its back right.
PASS sr90-props.mjs: sr90 farm pack: 52 ids (37 props, the water tower, 14 machines), 176023 triangles, one mesh and one draw call each, wheel and auger nodes kept as data
PASS starter-game.mjs: starter-game ok
PASS starter.mjs: starter ok
PASS startup.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-startup-3LKnlU/world.js:610:45
FIRST RUN FAILED store-categories.mjs (48 ms), retrying once:
AssertionError [ERR_ASSERTION]: eggs is on a real shelf
    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/store-categories.mjs:12:69
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: null,
  expected: true,
  operator: '==',
  diff: 'simple'
}

Node.js v24.22.1
FAIL store-categories.mjs
failed twice. Second run:
AssertionError [ERR_ASSERTION]: eggs is on a real shelf
    at file:///C:/Users/Michael/AppData/Local/Temp/eden-0364-sol-1695ac3b/tests/store-categories.mjs:12:69
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: null,
  expected: true,
  operator: '==',
  diff: 'simple'
}

Node.js v24.22.1
PASS store-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-sXUXt9/world.js:610:45
PASS storefronts.mjs: Glass sightlines reveal real interiors; no leftover doorBits; counter stays solid/opaque; setLight dims/restores; café work stations are reachable.
PASS street-trees.mjs: Street trees: 15 (11 on Oak Street, the rest in the town), none in a road.
PASS streetfurniture.mjs: Street furniture: 19 road lamps on 4 roads (instanced, solid, on grass, clear of buildings) and a ring of low hills (384 triangles) beyond the fog.
PASS supply.mjs: PASS supply.mjs: the crew brings what open orders need and the warehouse lacks (every pallet and the hands counted, the lumberyard stock not), in batches of 40 up to 120, one delivery at a time an hour out, only in the working day, landing as pallets in the racks (floor level first, the lumberyard's planks first), a full warehouse refusing them, saved and cleaned on load.
PASS surface-table.mjs: surface-table: ok
PASS survival.mjs: Thirst migration, drain multipliers, energy penalties, depletion boundaries, state settings and clock independence passed.
PASS sweep-sounds.mjs: PASS sweep-sounds.mjs: 114 sweep clips (386.8 KB new step audio), all 15 SURFACE ids + indoor tile/carpet/wood, nextStepClip deterministic L/R + run + cloth, 20 lumber clips, audio.js safe without a sound card.
PASS talk-badge.mjs: PASS talk-badge.mjs: portrait initial/colour deterministic across 10 names (6 colours), friendly tier/mood chip mapping, and purity.
PASS talk-cast-crowd.mjs: PASS talk-cast-crowd.mjs: 30 crowd casts validated against 9 named casts (0 errors, 0 warnings), 1620 sweep contexts (6480 terminal walks, 4800 bubbles), place-aware npc-chat passed.
PASS talk-cast-oak.mjs: PASS talk-cast-oak.mjs: 4 Oak/Cedar casts validated against 5 early casts (0 errors, 0 warnings), 376 sweep contexts (3670 terminal walks, 4628 bubbles), pinned checks passed.
PASS talk-cast.mjs: PASS talk-cast.mjs: 5 early casts validated (0 errors, 0 warnings), 762 sweep contexts (17180 terminal walks, 36847 bubbles, zero cycles/repeats/time-leaks), castOf + pinned phrases passed.
PASS talk-engine.mjs: Talk engine: period picks and edges, the current time on every turn, specificity and w, one variant per turn (no glue), no repeats within last (8 variants x 25 talks), least-recent fallback, replay determinism, unknown go (strict throws, runtime hides), effects as data and same-talk beats, talkContext from progress, memory caps, all 20 conditions, garbage in, inputs frozen, no clock or chance.
PASS talk-fit.mjs: PASS talk-fit
PASS talk-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-qXd39Q/world.js:610:45
PASS talk-memory.mjs: PASS talk-memory: caps (6/32/16, 48 people), junk, frozen, helpers, old 0.35.18 save loads unchanged, migration beats, Elena met via the cafe, once only
PASS talk-panel.mjs: PASS talk-panel
PASS talk-stuck.mjs: PASS talk-stuck.mjs: the docked talk panel renders in the real index.html tree (no hidden ancestor such as #settings), sits at body level, and a panel already there is not moved.
PASS talk-validate.mjs: Talk validator: good cast has zero problems; the bad cast fires all 11 rules (15 codes) exactly once with person, node, line, what and how; the 7 shape and voice extras once each; time words, glue, ids, slots, cross-cast repeats, the coverage sweep, garbage in, inputs untouched.
PASS terrain-mud-gravel.mjs: mud and gravel ok: 4 patches, 888 cells
PASS terrain.mjs: Terrain mask: 1120 x 1000 cells in 47 ms; the city identical to the old rules at 64064 points; open country walkable (no invisible walls), the river and the map edge not; both bridges aligned; the Cedar Heights loop closed and smooth; plots on open grass; all districts reachable.
PASS tickets-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-kmCnpF/world.js:610:45
PASS tickets.mjs: Tickets: released by the clock (the same every time, nothing past due or after closing), taken by rank (4 pickups, 5 deliveries, at most three, one taker each), staged, shipped and delivered with effects naming the player, expired untaken at closing without penalty, failed taken past the deadline with a reputation cost, deliveries carried over a day, the list capped, and saved on the company.
PASS timber-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-VyLOCH/world.js:610:45
PASS timber-machine.mjs: PASS timber-machine.mjs: post/beam/dowel modes (1/1/6 per cut, 10/12/8 s), cut finishes first, mode lock and 1 s switch, caps (8 in, 40 out, 40 chips), chips +1 per cut, take, frame-rate independent, saves load, frozen, pure, prices.
PASS timber-rules.mjs: PASS timber-rules.mjs: trunk and slab bed capacities (the ATV refuses a trunk), save normalising, masses, carry speeds (log 95%, two logs 90%, trunk 60%, slab 80%, no sprint), bucking (bonus log at levels 3 and 8, axe swings, chainsaw seconds), saw times (log 8 s, trunk 12 s), prices.
PASS timber-wiring.mjs: PASS timber-wiring.mjs: trunks and slabs lie lengthwise on the flatbed and shortbed (two cells, never across), logs/planks keep their old bed places, two logs load as two, the ATV refuses a trunk, two logs/trunk/slab put down and picked up, the lumberyard has no cash sale of trunks or slabs, the chainsaw at Rank 3 level 5 $350, old saves load unchanged.
PASS timestep.mjs: Timestep (equal slices up to 1/30 s; the same distance, clock and hunger at 10, 30, 60 and 144 FPS) passed.
PASS tools.mjs: PASS tools.mjs: the axe ladder (4/3/2 swings at level 1, levels shave swings), purchases need the level in the shop and on the phone, the company hands the tiers over at Hauler and Sawyer, the three converted axes stand in the held frame (handle along +z, head far, edge down, shared geometry), and the two chainsaws (company store only: the basic one at Hauler and level 5 for $350, the logging one at Foreman and level 20) have their bar forward.
PASS toon-rules.mjs: PASS toon-rules.mjs: 3-band monotonic ramp, matte ground exemption (roughness >= 0.94), sunlit rim <= 0.14, strength toggle, GLSL constant match, purity.
PASS tow-driven.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-ekz5Rg/world.js:610:45
PASS town.mjs: Town: a street wall of 10 buildings with no gaps, 256 road markings (crosswalks on all four arms of the main junction, stop lines, 31 bays), 15 parked cars, and 58 pieces of street furniture on the pavements, a fountain in the square and a bus stop.
PASS tracker-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-9QNyJC/world.js:610:45
PASS tracker.mjs: Tracker: every shift task and order is listed with its place and distance, the nearest marked block for felling, finished tasks cannot be focused, Y cycles story and open tasks, and the focus saves and rejects junk.
PASS tracks.mjs: tracks ok
PASS tractor-driver.mjs: Tractor driver: PASS (seat from anchor_driver_seat, hands swing about the steering_wheel node and stay in reach, two front steer pivots, jiggle bounded, silhouettes drawn)
PASS tsl-grade.mjs: PASS tsl-grade: 24 colour/exposure pairs matched gradeGLSL() & grade() (maxDiff=2.22e-16), StandardNodeLibrary + mock-renderer verified.
PASS tsl-ground.mjs: PASS tsl-ground: all 11 ground kinds (140 cases) matched ground-shader.js (col=1.11e-16, nrm=7.38e-13, rgh=0.00e+0, emi=0.00e+0).
PASS tsl-materials.mjs: PASS tsl-materials: all 8 T3 NodeMaterial factories & CPU math parity checks matched GLSL sources.
PASS tsl-output.mjs: PASS tsl-output: real WebGPURenderer runs without framebuffer/output pass (MSAA kept), per-material grade + sRGB with toneMapped honoured, render targets linear, display fog (encoded colour, follows the scene), encoded clear colour, hidden-twin warm-up, last draw calls.
PASS tsl-paint.mjs: PASS tsl-paint: 3528 paint cases & 81 glass cases matched paint-shader.js (paintDiff=0.00e+0, glassDiff=0.00e+0).
PASS tsl-points.mjs: PASS tsl-points: sawdust/menu dust become one instanced Sprite with PointsNodeMaterial (size 0.075 m, attenuated, same colour and opacity), never raycast.
PASS tsl-shadows.mjs: PASS tsl-shadows: 392 (vBox, uv, opacity, depth) samples matched shadows.js BLOB_FRAGMENT (maxDiff=0.00e+0).
PASS tsl-sky.mjs: PASS tsl-sky: 4 times of day x 7 dome dirs + 600 stars matched dist/sky.js (domeDiff=1.78e-15, starDiff=0.00e+0).
PASS update-check.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-1tVtdR/world.js:610:45
PASS vehicle-hud.mjs: Vehicle panel: greyed out on foot; driving shows the name, speed in mph, the fuel type and gallons, and Get out, or Stop to get out while moving (1 m/s); riding shows Get out; the DOM is written only when the model changes.
PASS vehicle-sounds.mjs: Vehicle sounds: every class has an engine loop and every file is registered, mono Ogg under the size cap with the payload under 10 MB and decoded memory under 50 MB, yells under 1.2 s, all listed in ASSETS.md; crash tier by impact (light, medium, hard), glass at Damaged or worse, a person is a thud and a yell; the yell gate (4 m/s, 4 m, 8 s each, nearest first, 2 voices) and the 12-voice cap; the loader fetches nothing before a vehicle, one file at a time, its own engine first, never twice; a missing or corrupt file keeps the generated sound; engine rate follows the revs, misfire dips, hidden tab and mute are silent.
PASS vehicle.mjs: Vehicle: worktruck 10 m/s and off-road pickup 8.5 m/s on a stub world; grass half speed, dirt 0.8, water never; frame-rate independent at 30/60/144; hull samples every 0.5 m inset by the player radius; a wall stops the hull at its edge and the vehicle slides along it; vehicles and people block; safe poses and exits; saved list; and both vehicles drive out of the depot along the real roads.
PASS visitors.mjs: PASS visitors: Rory plans (60 days x 3 weathers), busyness, pose, Jenni Mon/Wed/Fri, Matt random passes, delivery data
PASS waist.mjs: Skeletal waist: spine order and height, lean at the waist (both ways), no primitive torso, and seated thighs passed.
PASS walk-legs.mjs: PASS walk-legs: 16 town walkers, 70 Alex/Malik legs (min 42.1 m >= 40 m), 36282 24h poses all on pavement graph
PASS warehouse-intake.mjs: PASS warehouse-intake: cell-fill pay 500 c once per 40-plank cell, strict conservation, full-rack overflow kept, stable INTAKE_ORDER, mirrorPlankSum === world-tick mirrorPallets, garbage/immutability/purity
PASS warehouse.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-x5LXqb/world.js:610:45
PASS warm-meal.mjs: PASS Warm-meal: plain serialisable state, applyBuff by quality without weakening active buffs, drainFactor expiry, and purity.
PASS watcher.mjs: watcher tests passed: zones and warnings at every threshold, start and stop at 99, the probe refuses without approval, logs counted once per message, a static page with no scripts
PASS water-chunks.mjs: water-chunks: 53352 checks; 52 chunks with water; per chunk max 520 triangles and 333 vertices (1 draw call each); max triangles by kinds present {"0":520,"1":289,"2":516,"3":92}; whole map 14355 triangles
PASS water-contract.mjs: water-contract ok
PASS water-cooler.mjs: Water cooler: +30 thirst, once per game hour at each cooler, separate coolers, capped at 100, refused when not thirsty, and saved.
PASS water-height.mjs: water-height ok
PASS webgpu-flag.mjs: PASS webgpu-flag: ?webgpu=0 = WebGLRenderer with no WebGPU/TSL download; no flag and ?webgpu=1 = WebGPURenderer (the 0.36.0 default), init awaited before the first render, world waits for visible and hidden shader warm-up with the High light installed, 11 TSL twins built, no GLSL patch left; &webgl=1 and no navigator.gpu = WebGL2 via WebGPU.
PASS webgpu-ground-quality.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-D8ANn0/world.js:610:45
PASS weld-core.mjs: Weld score, coverage, dwell, speed, drift, seeded shake, brace reach, lift and path tests passed.
PASS worker-relay.mjs: Hosted relay object: create, taken code 409, hibernation restore with position and bakery claims, host departure on wake, hello timeout, empty lobby kept 10 min then forgotten, unknown codes, routing and Origin passed.
PASS workforce-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-sEnt2k/world.js:610:45
PASS workforce-pose.mjs: PASS workforce-pose.mjs: cutter/hauler/sawyer deterministic across 30/60/144 Hz, co-op exact, 10 days x all waypoints walkable & unblocked, all 5 phases (chop/buck/carry/bend/walk/saw), zero allocations on sealed out, pure.
PASS workforce-tick.mjs: PASS workforce-tick.mjs: 14-day log/plank conservation (0 free planks beyond trickle), >=6x player speed (8.1x), $0/0-rep crew fills, grace windows, player claims block, empty stock=0, 1/5/30-min frame invariance, pure; demand gate: an idle player -> the crew meets demand, a player who covers it -> the crew saws nothing, crewMark saved.
PASS world-state.mjs: PASS world-state: determinism, run-out + price cap, delivery, conservation, truck, catch-up 14, normalize, prosperity floor, price band, stockAt, no clock/chance
PASS world-tick.mjs: PASS world-tick: save shape, 05:00 boundary, once per day, catch-up 14, determinism, 7 days -> needs, supply conserved, pallet link, dozens, pump stock, no clock/chance
PASS world.mjs: World zones, bounds, grid maths, tree stages and fall callback, target ring, ground logs, deterministic 395 pines + 512 decor trees, fenced fields with gates, collisions, felling, stumps and grid overlay passed.
PASS zones-ru1.mjs: PASS zones-ru1 (32 checks)

FAILED FILES: fork-guide.mjs, game-name.mjs, inventory.mjs, neighborhood.mjs, night-lights.mjs, ownership.mjs, pet-actor.mjs, profile.mjs, store-categories.mjs
9 of 317 test files failed.
Exit code: 1
```

</details>

## Browser Lab

I served the isolated copy with `npm.cmd run dev` on port 18464 and exercised the 0.36.4 page through `scripts/browser-lab.mjs` in headless Edge. The scenario used the page's debug position and camera hooks for setup and framing. Entry, rental and elevator selection went through the game’s input and UI handlers. CDP collected browser console warnings, uncaught exceptions and request failures.

| Check | Observed | Screenshots |
| --- | --- | --- |
| 18 Oak Street | The entrance had two leaves and two transparent panes. The frame measured 2.64 m wide by 2.75 m high. E loaded the lobby. Renting for $90 reduced the fixture’s cash from $112 to $22. The elevator showed Floor 2 · Studio 2B and selecting it loaded the studio. **The native lobby view was blank.** The camera was near `(0, 3.07, 9.11)` while the lobby origin was `(420, 0.165, 1200)`. With a diagnostic camera position the room rendered in silhouette. A temporary hemispheric light in the lab made the geometry visible in the linked lobby and elevator diagnostics. The packaged lobby render root has no room lights of its own. Confidence is high in the route and the rendering finding. | [Entrance](sol-0364-oak-door.png), [native lobby](sol-0364-oak-lobby-native.png), [diagnostic lobby](sol-0364-oak-lobby.png), [elevator](sol-0364-oak-elevator.png), [studio](sol-0364-oak-studio.png) |
| C11 Ironwood Arcade and C14 Post Office | Both entrance prompts appeared. Door metadata is 1.4 m wide and 2.05 m high for each. The placed meshes scale Y by 1.5, giving a 3.075 m door height from those dimensions. Each façade showed blue pane detail and used one opaque material with roughness 0.90, metalness 0.45, and no environment map. I found no separate reflective glazing in either façade. Confidence is high in the measured scale and material inspection. | [Arcade](sol-0364-ironwood-arcade.png), [Post Office](sol-0364-post-office.png) |
| Alder Coffee & Diner | Crossing the opening threshold entered the diner. The floor measured 18 × 16 m and the counter base 7 × 1 × 1 m. The two 1.5 m openings led to the back kitchen and restroom. The kitchen contained a stove, sink, cabinets, and refrigerators. The restroom contained a sink and toilet. Grass tufts were visible behind the back-kitchen fixtures. Confidence is high in the geometry, fixtures, and entry. | [Counter](sol-0364-diner-counter.png), [Back Kitchen](sol-0364-diner-back-kitchen.png), [Restroom](sol-0364-diner-restroom.png) |

CDP recorded zero uncaught page exceptions and zero scenario evaluation errors in the completed walkthrough. The dev server returned HTTP 404 for `/favicon.ico` and `/api/me`. Browser warnings covered WebGPU adapter availability, the WebGL2 fallback, screenshot readback stalls, and audio blocked until a trusted user gesture.

<details>
<summary>Browser Lab measurement output</summary>

```text
log {"version":"0.36.4","loc":"WESTSIDE","webgl":"ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)"}
log {"location":"OAK STREET LOBBY","elevator":"Oak Street Elevator","choice":"Floor 2 · Studio 2B (Your Apartment)"}
log {"location":"STUDIO 2B","pos":{"x":0,"z":3.3,"ry":0},"prompt":"EGo outside"}
log {"arcade":{"plot":"C11","x":57.12,"z":-76.2,"width":1.4,"height":2.05,"modelDoor":{"x":1.05,"z":3.39,"width":1.4,"height":2.05},"modelHeight":9.33,"meshScaleY":1.5,"renderedDoorHeight":3.075,"glow":null,"environment":false,"materials":[{"type":"MeshStandardMaterial","roughness":0.9,"metalness":0.45,"envMap":false,"transparent":false,"emissive":"ffc978"}]},"player":{"location":"IRONWOOD","pos":{"x":55.15,"z":-76.2,"ry":-1.57},"room":"","prompt":"EEnter Ironwood Arcade"}}
log {"postOffice":{"plot":"C14","x":57.12,"z":-104.25,"width":1.4,"height":2.05,"modelDoor":{"x":0,"z":2.17,"width":1.4,"height":2.05},"modelHeight":6.77,"meshScaleY":1.5,"renderedDoorHeight":3.075,"glow":null,"environment":false,"materials":[{"type":"MeshStandardMaterial","roughness":0.9,"metalness":0.45,"envMap":false,"transparent":false,"emissive":"ffc978"}]},"player":{"location":"IRONWOOD","pos":{"x":55.12,"z":-104.25,"ry":-1.57},"room":"","prompt":"EEnter Ironwood Post Office"}}
log {"location":"ALDER COFFEE & DINER","floor":[18,0.2,16],"counter":[7,1,1],"doorways":[{"x":-4.5,"width":1.5},{"x":5.75,"width":1.5}],"fixtures":[{"name":"prop-f-stove","x":-7.2,"z":-9.8},{"name":"prop-f-sink","x":-5,"z":-9.8},{"name":"prop-f-cabinet","x":-2.8,"z":-9.8},{"name":"prop-f-cabinet","x":-0.8,"z":-9.8},{"name":"prop-f-fridge","x":1.6,"z":-9.8},{"name":"prop-f-fridge","x":2.5,"z":-9.8},{"name":"prop-f-toilet","x":7.8,"z":-9.6},{"name":"prop-f-bath-sink","x":4.2,"z":-9.8}]}
log {"cameraMetres":[4.356529818239328e-12,3.067091711543252,9.105304970026882],"lobbyOrigin":[420,0.165,1200],"state":{"location":"OAK STREET LOBBY","pos":{"x":0,"z":4.5,"ry":0},"room":"oak-lobby","prompt":null}}
```

</details>

## Owner checks

Frame times on the owner’s GPU remain unverified. Capture frame times at both Ironwood shopfronts while walking and turning, through the Oak Street entry and elevator transitions, and at the diner counter and rear rooms. Edge used the SwiftShader WebGL2 backend.

The lobby camera and lighting are release findings outside this test edit. The path to correct the camera is in `dist/game.js` in `frame()`. Pass `worldPlayer` after setting `getMeWorldPosition(worldPlayer.position)` to the indoor camera for translated rooms. Give the lobby render root its own room lights in `createApartmentLobby()` in `dist/apartment-lobby.js` and verify both changes together.

## Files delivered

- `tests/startup.mjs` changed from 218 to 234 lines. The existing regression test gained process isolation and explicit room-transition checks.
- `notes/eval/outbox/sol-0364-verify-startup.md` created (713 lines).
- Ten 1120 × 640 PNG screenshots in `notes/eval/outbox/`, linked in the table.
