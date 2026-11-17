michadr.

# Hybrid Gemini Read-Only Code Audit (Working Copy 0.35.17)

Read-only audit covering **Lane 1** (in-flight handoff recovery & release parity by Orchestrator), **Lanes 2–3** (cross-module wiring, save normalisation, C-B cargo/hands/gigs & N2 NPC wiring by **Gemini Pro / Argon**), and **Stage P-A & Lanes 4–5** (`dist/plank-economy.js`, `needs.js`, `ground-cover-view.js`, `npc-crowd.js`, `npc-walk.js`, and `game.js` frame allocations/comment scan by **Gemini 3.8 Flash**), cross-checked against `dist/` and `dist/releases/0.35.17/`. No code or test files were modified.

---

## 1. Lane 1: In-Flight Handoff, Release Parity & Wiring Checklist

### 1.1 Verification Gate Results (Verified 2026-11-17)
- **Release Parity (`dist/*.js` vs `dist/releases/0.35.17/*.js`):** All **209** files in `dist/*.js` match `dist/releases/0.35.17/*.js` **byte-for-byte** (SHA-256 checked). Both the interrupted `OPUS-wiring` run (`game.js` at 11:34 AM) and `Sonnet P-A` (`plank-economy.js` at 11:27 AM) completed their code edits and `npm run release -- --force`, stopping only before filing their outbox reports.
- **Tests Executed (18 suites, all exit 0 / PASS):**
  - `brief.mjs` (`209 modules listed, brief 2834 and index 31073 estimated tokens (budgets 3000 and 32500)`)
  - `plank-economy.mjs`, `cargo-hands.mjs`, `cargo.mjs`, `cargo-items.mjs`, `carry.mjs`, `npc-routes.mjs`, `npc-busyness.mjs`, `gigs.mjs`, `needs.mjs`, `world-tick.mjs`
  - Packaged release game tests: `cargo-game.mjs`, `carry-game.mjs`, `gigs-game.mjs`, `starter-game.mjs`, `load-drag.mjs`, `delivery-game.mjs`, `startup.mjs`
  - Additional Lane 2–3 read-only checks: `world-state.mjs`, `needs-loop.mjs`, `gig-parcel.mjs`, `jobs.mjs` (all PASS).
- **`dist/game.js` Mid-line `//` Comment Scan:** **Clean** across all 1,763 lines (0 swallowed code statements).

### 1.2 C-B Wiring Checklist Status (`notes/eval/outbox/C-B-pure.md`)

| # | Item | Status | Exact Location(s) & Notes |
|---|---|---|---|
| 1 | Flip `PARCEL_PIECES_ENABLED` & `CRATES_BY_HAND` to `true` | **Done** | `dist/cargo-items.js:18`, `dist/cargo.js:38` (both `true`). |
| 2 | X put-down (`putDownCarried`) switches on `p.carry.kind` | **Done** | `dist/game.js:736-740` (`parcel`, `log`, `planks`, `crate`/`box`; indoors/shop toast on `:736`; `passOutMove` updated at `:1480`). |
| 3 | Ground crate (`crateDrops`) | **Partial** | `dist/carry.js:103-122`, `dist/jobs.js:44`, `dist/game.js:400-407,448,718,729`. Works for state/collisions, **but** `syncCrates` (`game.js:406`) renders dropped `box` items as `prop.crate-bin`. |
| 4 | Visual pose for `crate`/`box`/`parcel` in arms | **Partial** | `dist/game.js:400-404,753-754` works inline, **but** `dist/carry-pose.js:25` (`poseFor`) still gates `!p?.carry`. |
| 5 | Hands rule, vehicle stow/unstow, remove `STOW_MODELS`/`canStow`/`stowed`/`RACK_BUSY` | **Partial** | `enterVehicle` (`:843-848`) & `exitVehicle` (`:891`) wired, **but** legacy exports stay in `dist/gig-parcel.js:26-33` / `game.js:54,843,851,892,945`, and `reset()` (`:442`) / `towCall()` (`:862`) bypass unstow. |
| 6 | Cargo panel & bed prompts (`summarize`, `takeKind`, `loadCarry`) | **Done** | `dist/game.js:199-217,694-699`. |
| 7 | Gig end paths clear parcel pieces (incl. timeout) | **Partial** | `gigs.js` / `gig-bridge.js` clear saved data, **but** `game.js` (`completeContract` `:657-660`, `onGiveUp` `:1324`, expiry `:1624-1625`) calls `persist()` before `reconcileParcel` cleans live `driving` `f.cargo`. |
| 8 | `syncParcel` reads piece logic | **Partial** | `dist/game.js:940-945` (`parcelBedOf`, `reconcileParcel`, `syncParcel`) keeps `parcelHeld` fallback and misses bed slot shifts when a crate is added after a parcel (`:945`). |
| 9 | Remove "Crates stay on the bed" / `CRATE_STAYS` | **Done** | Unused in `dist/game.js`; crates unload freely. |
| 10 | `cargo-view.js` draws `parcel` & `box` on beds | **Missing** (Bug) | `dist/cargo-view.js:18-27` falls through into `planks` (`stacks++`) for `parcel`/`box` instead of ignoring or drawing them (Stage C-D). |

### 1.3 N2 Wiring Checklist Status (`notes/eval/outbox/N2-pure.md`)

| # | Item | Status | Exact Location(s) & Notes |
|---|---|---|---|
| A1 | Build `npcCrowd`, warm `walkPairsOf` with static obstacles, rebuild schedule | **Partial (Buggy)** | `dist/game.js:135-143,1634` wired, **but** `npcStaticBlocked` (`:140`) uses streamed `isWalkableLive` (`:2`) and streamed `world.blocked` (`:150`). |
| A2 | Pass `tripWithTable` and `weather` to `createSchedule` | **Partial** | `dist/game.js:135,142` updates `npcPlanCtx.trip`, **but** `rosterPlanner` (`:135`) receives neither `trip` nor `weather`. |
| A3 | Static obstacles only for co-op determinism | **Broken** | `dist/game.js:140` depends on loaded chunk state and mutable door colliders (`updateDoors` `:1364`). |
| A4 | Pass `busy: busyness(...)` each frame | **Done** | `dist/game.js:1625` (uses local `GameState.progress` clock rather than `hudDay()`/`hudMinutes()` in co-op). |
| B | `world-tick.js` `demandFor` uses `strollDemand` | **Done** | `dist/world-tick.js:13,28` (uses `dayPlan` without `trip` or `weather:'clear'`). |
| C | Strolls stay outside (`act: 'outside'`) | **Done** | Left as outside strolls per N2 decision C. |

---

## 2. Stage P-A (`dist/plank-economy.js` & `tests/plank-economy.mjs`) Verification

- **Compliance:** `dist/plank-economy.js:1-157` satisfies all `AGENTS.md` pure-module rules (line-1 header comment citing `notes/planks-economy-design.md stage P-A`, no DOM/Three.js/clock/random, integer cents, all 16 exports frozen via `Object.freeze`, garbage inputs safe via `clampInt` and `Object.prototype.hasOwnProperty.call`, and `MEASURED` values verified against `world-goods.js`, `shift.js`, `cargo.js`, `carry.js`, `vehicle.js`, `forest.js`, `map-definition.js`, `cafe-job.js`, `gig-pay.js`).
- **Level-1 benchmark:** 32 planks on `worktruck` in `182.1` game min = `$263.20` (`8,672 c/h`), beating `ridgeline-fell` (`6,934 c/h`) by **+25%**.
- **2 Design Caveats & Minor Notes:**
  1. **Higher-level inversion (`dist/plank-economy.js:74, 81, 121-122`):** `WAGE_LEVELS_REQUIRED` is pinned at `[1]`. Margin drops to `+18%` / `+11%` / `+4%` at levels 3/5/7 and inverts to `-12%` at level 10 because `logsPerTree` doubles from 2 to 4 (halving `fellTree` $3 piece pay per plank) while `ridgeline-fell` scales swing speed and collects `1,600 c/h` shift wage. Both `cycleEarnings` (`:81`) and `existingJobs` (`:121`) hardcode tier-1 `'axe'`.
  2. **Mixed shift piece-pay model (`dist/plank-economy.js:90-96` vs `dist/forest.js:34-36, 49-51`):** `cycleEarnings` counts shift-only piece bonuses (`PAY.fellTree` 300 c, `PAY.rackCell` 500 c) without `wageAt(lv)`, and combines `rackCell` + `plankDelivered` in one trip without adding extra rack-stacking time.
  3. **Minor cleanups in `dist/plank-economy.js`:** `:13` `num` is dead code; `:109` Oak Street Laundry is `11.3` (`Math.hypot(-10.2,-5)=11.36`); `:114` `gigHourly` divides unrounded `minutes` (`~2 c/h` diff); `:150` `priceTable(world, day, null)` passes `null` to `clampInt` (`0` instead of `undefined`).

---

## 3. Ranked Bugs & Findings (Worst First)

### #1. [Breaks Play] `npcStaticBlocked` uses streamed `isWalkableLive` and streamed `world.blocked`, breaking farm/forest routing and co-op schedule determinism
- **Where:** `dist/game.js:2`, `dist/game.js:140-143`, `dist/game.js:150`, `dist/world.js:36-37,143-151,574,578`, `dist/chunks-view.js:57-61`.
- **Failing Scenario:**
  - `dist/game.js:2` imports `isWalkableLive as isWalkable`, and `:150` initializes `createWorld(scene, {label, streaming: true})`, which loads only the 5×5 chunks around `MAP.spawn`.
  - When `npcWarm` runs at boot (`dist/game.js:140`), `property:farm-house` (`-62, -236`, chunk `3:9`) and `zone:forest` (`82.5, -266`, chunk `5:9`) are outside the loaded 5×5 ring.
  - `chunks-view.js:57-61` treats unloaded chunks as walls (`"chunks: 3:9 is not loaded yet; treating it as a wall"`), so A* fails for `property:farm-house>zone:forest` and its reverse, permanently caching `{direct: true, length: 147.6}` (`npcRouteTable.signature() === 473189506` instead of `1073230318`; true lengths are `150.1` and `149.4`). When the player later walks to the farm/forest, NPCs clip straight through obstacles along the direct line. Also, in co-op, saving near the farm warms different chunks and yields a different schedule signature.
- **Smallest Safe Fix:** Import the whole-map `isWalkable as isWalkableMask` from `./world.js` in `dist/game.js:2` and expose a non-streamed static collider check on `createWorld` (ignoring `c.off`) for `npcStaticBlocked`.

### #2. [Breaks Play] Need-restock egg loading fails silently (`CRATE_MIX`) when a `parcel` or `box` is on the truck bed alongside a `crate`, draining farm stock with no crates loaded
- **Where:** `dist/game.js:501-503`, `dist/game.js:511-514`, `dist/cargo.js:133`.
- **Failing Scenario:**
  - With C-B active, an owned `shortbed` can hold `[{k:'crate'}, {k:'parcel', g: 12, ...}]`.
  - At the farm pile, `needLoad()` (`dist/game.js:512`) checks `if (bed?.length && !hasCrates(bed))` — `hasCrates(bed)` is `true`, so it passes.
  - `pickNeedCrates` (`:514`) decrements farm egg stock and claims the need (`a.haul > 0`).
  - `syncNeedCargo()` (`:502`) runs `addNeedCrates(removeNeedCrates(bed).cargo, f.spec.model, want)`. Because `removeNeedCrates` leaves the `parcel`/`box`, `addCrates` (`dist/cargo.js:133`: `p.k !== 'crate'`) returns `{error: CRATE_MIX}`, and `syncNeedCargo` ignores `r.error`. Farm eggs are lost and no delivery crates appear on the truck.
- **Smallest Safe Fix:** In `needLoad` (`dist/game.js:512`) and `story-load` (`:522`), replace `if(bed?.length&&!hasCrates(bed))` with `if((bed||[]).some(p=>p.k!=='crate'))` and toast `'Clear the bed first.'`.

### #3. [Wrong Behaviour] Parcel gigs tick off stops and pay out at the door while the parcel remains parked on a vehicle bed elsewhere on the map
- **Where:** `dist/gigs.js:206`, `dist/gigs.js:231`, `dist/game.js:656-661`.
- **Failing Scenario:**
  - Player picks up a parcel at origin (`p.carry = {kind:'parcel', ...}`), loads it onto an owned truck via `E` (`loadOntoBed`), leaves that truck behind, and walks/drives another vehicle to the delivery stop.
  - `tickGig` (`:206`) and `completeGig` (`:231`) only check `if (a.drop)`, never checking whether `parcelLocation(p) === 'bed'`. The gig pays out while `endParcel` silently strips the parcel from the faraway truck.
- **Smallest Safe Fix:** When `pieces` is enabled and `parcelLocation(p) === 'bed'`, require taking the parcel in hand (`p.carry?.kind === 'parcel'`) or having the carrying vehicle within reach, prompting `'Take the parcel off the truck first.'`.

### #4. [Wrong Behaviour] Calling a tow (`towCall`) or resetting (`R` / `reset()`) while driving with a stowed parcel bypasses `exitVehicle`, trapping the parcel in the repair shop
- **Where:** `dist/game.js:442` (`reset`), `dist/game.js:861-865` (`towCall`), `dist/game.js:891` (`exitVehicle`).
- **Failing Scenario:**
  - While holding a parcel, entering a truck/ATV moves `{k:'parcel'}` onto `f.cargo` and sets `parcelStowedOn = id` (`:843-845`).
  - `towCall` (`:862`) and `reset` (`:442`) call `driving.leave(() => false)` without running `exitVehicle`'s unstow logic (`:891`).
  - On a `hardLuck` auto-repair tow (or shop drop-off), `f.present = false` hides the vehicle while the parcel remains in `f.cargo`; `reconcileParcel` (`:943`) sees `here = true`, stranding the parcel in the garage until repairs finish.
- **Smallest Safe Fix:** Extract `exitVehicle`'s `parcelStowedOn` unstow logic into `unstowParcel(f)` and call it in `exitVehicle`, `towCall`, and `reset`.

### #5. [Wrong Behaviour] Unboardable needs (`eastbank-supply|planks` and Hal's sick `bread` errand) are still created by `needsFrom`, clogging `MAX_OPEN_NEEDS` and triggering undeserved expiry penalties
- **Where:** `dist/needs.js:80-88, 92-93, 101`, `dist/world-tick.js:58`, `dist/gigs.js:27, 132`.
- **Failing Scenario:**
  - `property:eastbank-supply` (`planks`, daily 6) drops below 30% while `property:sawmill` has stock (`parM ≈ 379 >= 300`). `needsFrom` only skips `office:ridgeline-warehouse`, so `restock|property:eastbank-supply|planks` opens.
  - Sick `hal` in `world-tick.js:58` pushes `errand|property:farm-house|bread` (`parM ≈ 301 >= 300`).
  - `gigs.js:132` filters `restock`/`errand`/`harvest` by `!!CRATE_UNITS[s.good]` (`eggs`, `milk`, `produce`), so neither need ever reaches the board, yet both occupy slots in `MAX_OPEN_NEEDS` (6) for 2 days and expire with mood/prosperity penalties (`needs.js:136-152`). Also, `needs.js:80` never prunes already-open unboardable needs.
- **Smallest Safe Fix:** In `dist/needs.js:80-83, 101`, enforce `CRATE_UNITS` eligibility (when `ctx.boardOnly` is set) and prune open never-boardable needs; in `dist/world-tick.js:58` change Hal's sick errand good to a crate-supported good (or wire `bread` pickup in `gigs.js`).

### #6. [Wrong Behaviour] Roster `needSeeds` omit `origin` and `ROSTER` uses `'haul'` (not in `KINDS`), leaving non-chore seed paths dead
- **Where:** `dist/world-tick.js:57-60`, `dist/npc-life.js:187-196`, `dist/npc-roster.js:8, 30, 35, 45, 60, 70, 75`, `dist/needs.js:9, 94-95, 101, 167`.
- **Failing Scenario:**
  - `needsFor()` and `world-tick.js:60` omit `origin` on `needSeeds`, so any `'errand'` or `'restock'` seed returns `null` from `pointOf('', ctx)` at `needs.js:167` and is dropped.
  - Six NPCs in `ROSTER` define `'haul'`, which is absent from `needs.js:9` `KINDS` (`['restock','harvest','chore','errand']`) and silently dropped at `needs.js:94`.
- **Smallest Safe Fix:** Supply a default `origin: 'shop:market'` on `'errand'`/`'restock'` `needSeeds` in `world-tick.js:60`, and map/replace `'haul'` in `ROSTER` with `'restock'`/`'harvest'`.

### #7. [Wrong Behaviour] `onGiveUp`, `completeContract`, and gig timeout call `persist()` before `reconcileParcel`, writing dead bed parcels back to `localStorage`
- **Where:** `dist/game.js:462-463`, `dist/game.js:657-660`, `dist/game.js:1324`, `dist/game.js:1624-1625`.
- **Failing Scenario:**
  - When a gig is abandoned (`:1324`), completed (`:657,660`), or times out (`:1624-1625`) while `{k:'parcel'}` sits in `driving`'s `f.cargo`, `gigs.js` clears `GameState.progress.vehicles`, but `persist()` (`:463`) immediately runs `GameState.progress.vehicles = driving.save()` **before** `reconcileParcel` strips `f.cargo` on the next frame (`:943`), persisting the dead parcel to `localStorage` until the next save.
- **Smallest Safe Fix:** Call `reconcileParcel(GameState.progress.gigs?.active?.needId ? null : GameState.progress.gigs?.active)` before `persist()` in all three paths.

### #8. [Wrong Behaviour] `cargo-view.js` counts `{k:'parcel'}` and `{k:'box'}` as plank stacks (`count('planks')`), and `syncParcel` misses slot shifts when crates are added
- **Where:** `dist/cargo-view.js:18-27`, `dist/game.js:939, 945`.
- **Failing Scenario:**
  1. Verified in Node: `cargo-view.js` returns `count('planks') === 2, boards() === 0` for `[{k:'parcel',...}, {k:'box'}]` because non-crate, non-log slots fall through into `stacks++` (lines `23-26`).
  2. If a parcel is at slot `0` of a `shortbed` (timber grid: `x = -0.78, z = -0.725`) and the player adds a `crate`, `slotPositions` switches to the crate grid (`x = -0.59, z = -0.3`), but `slot` remains `0 === parcelRackSlot`, so `syncParcel` (`:945`) does not reposition the parcel mesh.
- **Smallest Safe Fix:** Guard `dist/cargo-view.js:23` with `if(sp.kind!=='planks')return;` (and render `'box'`/`'parcel'` in Stage C-D); track `parcelCargoRef` (`rack.cargo`) in `syncParcel` dirty detection.

### #9. [Frame-Rate / Resource Leak] `ground-cover-view.js` `disposeAll()` is never called and leaks `atlas`/`materials`/`geos`; `makeCoverSampler` runs 50k lookups in 1 frame
- **Where:** `dist/ground-cover-view.js:30, 34, 37, 69, 74, 76-78`, `dist/cover-sampler.js:27-43`, `dist/cover-pack.js:29-34`, `dist/world.js:570-580`.
- **Failing Scenario:**
  - `disposeAll()` (`ground-cover-view.js:78`) is never called by `world.js` or `game.js` on teardown, and even when called it omits `atlas?.dispose()`, `materials` (`Map`), and `geos` (`Map`).
  - `_step()` (`:74`) runs `makeCoverSampler` synchronously in one frame (50,176 `surfaceAt` lookups + chamfer passes + 2,809 `heightAt` lookups), and `buildNear` (`:76-77`) forgets to add empty chunks (`r.draws === 0`) to `built`.
- **Smallest Safe Fix:** Dispose and clear `materials`, `geos`, and `atlas` inside `disposeAll()`, expose `world.dispose()`, record empty chunks in `built` inside `buildNear`, and time-slice `makeCoverSampler` inside `work`.

### #10. [Frame-Rate & Minor Polish Items]
- **Per-frame allocations in `frame()` / `stepWorld()`:** `dist/game.js:620-715, 896-900` (`candidates()` array/closures + `new THREE.Vector3` anchors), `:1279-1285` (`updateZones` objects/arrays), `:1375-1396` (`updateTracker`), `:1409, 1421` (`updateRing`/`updateObjective`), `:1604-1641` (`moveFx()` called 5–6x/frame), `:1652` (`nightLights.update` vehicles array), `:950` (`updateCafeVisuals` `Vector3`s).
- **`npc-crowd.js` wall separation & `freeReach` guards:** `dist/npc-crowd.js:49` zeroes `(wx, wz)` when pushing diagonally into a wall instead of axis-sliding `(wx,0)` / `(0,wz)` and step-sampling `< 1.9 m` fences; `dist/npc-walk.js:104` (`freeReach`) lacks `!(max > 0) || !(step > 0)` guards.
- **Minor C-B / N2 edge cases:**
  - `purgeOrphanParcels` (`dist/cargo-items.js:175`) checks `!a.needId && !a.drop` instead of `parcelTaken(progress)` (`pickedAt != null`).
  - `createRosterPlanner` (`dist/game.js:135`) is not passed `weather` or `trip` minutes (`npc-life.js:155` calls `Math.round(trip(...))`), and `world-tick.js:28` runs `dayPlan` without `trip` / `weather:'clear'` (`66/42` vs in-game `64/45` market/cafe visits over 7 days).
  - `dist/game.js:1625` passes local `housing.day`/`routine.minutes` to `npcCrowd.update`/`busyness` instead of `hudDay()`/`hudMinutes()` in co-op.
  - `dist/game.js:406` renders dropped `{k:'box'}` items in `crateDrops` using `prop.crate-bin`; `game.js:843` still uses `RACK_BUSY` phrasing on full non-rack beds; `carry-pose.js:25` still returns `null` for `!p?.carry`.
  - Unmigrated old save with both `carry` (`log`) and `parcelHeld === true` renders `carryLog` + `parcel` simultaneously (`dist/game.js:942-945`) until the log is put down.
