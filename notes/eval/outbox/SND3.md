michadr.

# SND3: Game-Wide Sound Sweep (Audit, Sourcing & Wiring Plan)

## Step 1: Audit Table (Read-Only)

Note: SND1 (vehicle engines, crank, stall, crashes, glass, scrapes, yells, tyres), PH1 (phone dial/pickup/ring/busy/hangup), and SND2 (`assets-src/sounds-timber/`: axe, tree fall/thud, log/plank drops, chainsaw, sawmill blade/conveyor) are excluded from the new sweep as already covered.

| Category | Game Event | Status | Location (`file:line`) |
|---|---|---|---|
| **Footsteps** | Walking/running on pavement/asphalt/bridge | Missing | `dist/game.js:1691` (`phase += step*speed*2.0`), `423` (`surfaceLive`), `1724` (`world.floorAt`) |
| **Footsteps** | Walking/running on grass/wheat/green | Missing | `dist/game.js:1691`, `dist/terrain.js:11` (`SURFACE.GRASS`, `GREEN`, `WHEAT`) |
| **Footsteps** | Walking/running on gravel/dirt/mud/plowed | Missing | `dist/game.js:1691`, `dist/terrain.js:11` (`SURFACE.DIRT`, `PATH`, `GRAVEL`, `MUD`, `PLOWED`) |
| **Footsteps** | Walking/running on wood deck or interior floor | Missing | `dist/game.js:1691,1724` (`inside \|\| shop \|\| world.floorAt(px,pz)`) |
| **Movement** | Jump / land | N/A (not in game) | `dist/game.js:1084` (`Space` is vehicle brake only) |
| **Doors & Gates** | Home / interior hinged door open & close | Missing | `dist/game.js:1427` (`home.room.frontDoor`), `dist/doors.js:37-64` |
| **Doors & Gates** | Shop door entry / exit bell chime | Missing | `dist/game.js:632,635,1433,1438,1444` (`enterShop` / `leaveShop`) |
| **Doors & Gates** | Yard / depot gate & dock door latch | Synthesized (`audio.click`) | `dist/game.js:208` (`toggleGate`), `344-346` (`dockDoor`) |
| **UI & Phone** | Button clicks (store, phone, inventory, menu, dialog) | Missing | `dist/store.js:23,37-39`, `dist/phone.js:41,59,143-145`, `dist/inventory-ui.js:20,35,44-46`, `dist/main-menu.js:72-88` |
| **UI & Phone** | Toast notification pop | Missing | `dist/game.js:490,598` (`toast`, `showToast`) |
| **UI & Phone** | Phone notification ping | Synthesized (`audio.ping`) | `dist/game.js:488` (`notifyPhone`), `dist/audio.js:181-187` |
| **UI & Phone** | Phone Call app (key, pickup, ring, busy, hangup) | Exists (recorded PH1) | `dist/audio.js:227-237`, `dist/phone-calls.js:4` |
| **Economy** | Buying at Corner Market / vehicles / cafe / bills | Missing | `dist/game.js:1389` (`onBuy`), `1186` (`buyAtLot`), `641` (`commitCafe`), `628` (`showBills`) |
| **Economy** | Receiving pay / gig payout / collecting owed | Missing | `dist/game.js:241,529,1697` (`collectAct`, `plankDeliveryPaid`, gig settle) |
| **Progression** | Skill level-up / career promotion fanfare | Missing | `dist/game.js:662-667` (`promoteAct`, `promotionTalk`), `dist/skills.js` |
| **Life & Needs** | Drinking from cooler / water | Exists (recorded + synth) | `dist/game.js:958` (`drinkCooler`), `dist/audio.js:38,189-198` (`water_drink.wav`) |
| **Life & Needs** | Eating food (inventory / diner / cooked meal) | Missing | `dist/game.js:636` (`lifeAct`), `1371-1376` (`updateConsumption`) |
| **Life & Needs** | Sleeping / waking up morning chime | Missing | `dist/game.js:1569-1583` (`startSleep`, `updateSleep`) |
| **Life & Needs** | Heavy breathing when exhausted / out of stamina | Missing | `dist/game.js:1683,1695`, `dist/life.js:8` (`needsEffects`) |
| **Fuel Pump** | Nozzle take / hang up | Synthesized (`audio.click`) | `dist/game.js:843,846` |
| **Fuel Pump** | Fuel flowing / pumping loop | Synthesized (`fuelRush`/`fuelHum`) | `dist/game.js:880,900,1734`, `dist/audio.js:55-56,135-139` |
| **Fuel Pump** | Tank full / error chime | Synthesized (`audio.chime`) | `dist/game.js:872,876,879,883,895-904`, `dist/audio.js:172-179` |
| **Vehicles** | Vehicle door open & close on enter/exit | Missing | `dist/game.js:919,961`, `dist/driving.js:121,161` (`doorThen`) |
| **Vehicles** | Car horn | Missing | Not yet bound (proposed `KeyH` while `driving.driving`) |
| **Vehicles** | Braking hard / brake squeal | Missing | `dist/game.js:1688` (`keys.has('Space')` / reverse brake) |
| **Vehicles** | ATV engine idle loop | Fallback (`eng-s70` pitched up) | `dist/vehicle-sounds.js:14` |
| **Vehicles** | Tractor engine idle loop (`tractor_juff`, `tractor_kidbi`) | Fallback (`eng-worktruck` slowed) | `dist/vehicle-sounds.js:12-13` |
| **Vehicles** | Turn indicator click / gear shift | Missing | Not yet implemented in `driving.js` |
| **Cargo & Warehouse** | Crate / parcel / box pick up & drop | Missing | `dist/game.js:803,810,1017-1021` |
| **Cargo & Warehouse** | Tailgate open/close | Synthesized (`audio.click`) | `dist/game.js:208,770` |
| **Cargo & Warehouse** | Forklift reverse beep | Missing | `dist/game.js:1687`, `dist/forklift.js:31-39` (`speed < -0.1`) |
| **Cargo & Warehouse** | Forklift hydraulic lift/lower | Missing | `dist/game.js:1687` (`KeyR` / `KeyF`), `dist/forklift.js:43` |
| **Farm** | Farm beds (water/fert/wheat) & animals | Missing / Partial | `dist/farm-beds.js:13-37` (no farm animals in `dist/` yet) |
| **Welding** | Welding arc / buzz (weld-lab) | Synthesized (`weldAudio`) | `dist/weld-game.js:131-145` |
| **Ambience** | Daytime birdsong outdoors | Missing | `dist/game.js:1730` (`sky.update` / `routine.minutes`) |
| **Ambience** | Nighttime crickets outdoors | Missing | `dist/game.js:1730` |
| **Ambience** | Outdoor wind loop (scaled by `windNow`) | Missing | `dist/game.js:1358` (`windSample(windClock.t, windNow, ...)`) |
| **Ambience** | River / lake / estuary water lap | Missing | `dist/terrain.js:11` (`SURFACE.WATER`), `dist/map-definition.js` (`water`) |

---

## Step 2: Plan (Top 40 Clips)

Ranked by player exposure frequency:
1. **Footsteps (12 one-shots)**: 3 variants × 4 surface groups (`step-pave-1..3`, `step-grass-1..3`, `step-gravel-1..3`, `step-wood-1..3`) — heard continuously while walking.
2. **UI & Phone (3 one-shots)**: `ui-click`, `ui-toast`, `phone-ping`.
3. **Ambience Loops (4 loops)**: `amb-birds`, `amb-crickets`, `amb-wind`, `amb-water` — continuous world immersion.
4. **Doors & Gates (4 one-shots)**: `door-open`, `door-close`, `shop-bell`, `gate-latch`.
5. **Vehicles (6 clips: 4 one-shots, 2 loops)**: `car-door-open`, `car-door-close`, `car-horn`, `brake-squeal`, `eng-atv` (loop), `eng-tractor` (loop).
6. **Economy & Progression (3 one-shots)**: `cash-register`, `coins-pay`, `level-up`.
7. **Life & Needs (3 one-shots)**: `eat-bite`, `sleep-chime`, `breath-tired`.
8. **Cargo & Forklift (3 clips: 1 one-shot, 2 loops)**: `crate-drop`, `forklift-beep` (loop), `forklift-lift` (loop).
9. **Fuel Pump (2 clips: 1 one-shot, 1 loop)**: `fuel-nozzle`, `fuel-flow` (loop).

Total: **40 clips** (31 one-shots, 9 loops), **578.5 KB (0.56 MB)** total (cap: 3.0 MB), largest clip **40.4 KB** (cap: 120 KB).

---

## Step 3: What Was Sourced & Honest Quality Notes

All 40 clips were sourced from **CC0 1.0** Freesound recordings (verified `Creative Commons 0` on each page on 2026-11-18) and processed into `assets-src/sounds-sweep/` (plus `assets-src/sounds-sweep/README.md`) using Blender 5.2's `aud` module and `numpy` (mono, 22.05 kHz, Ogg Vorbis 56 kbps, DC removed, loops 0.30 s cross-faded to `-20.0 dBFS` rms, one-shots `-4.0 dBFS` peak).

- **Not listened to by ear**: All cut points and loop windows were selected by waveform/RMS/onset measurement (`numpy`), not human listening.
- **Strongest measurements**:
  - `eng-tractor.ogg` (Freesound 637884, `cv = 0.013`), `amb-crickets.ogg` (479041, `cv = 0.038`), `eng-atv.ogg` (379915, `cv = 0.052`), `fuel-flow.ogg` (236283, `cv = 0.072`), and `forklift-lift.ogg` (877385, `cv = 0.090`) have very steady RMS across their loop windows.
  - Footsteps (`465299`, `521587`, `521588`, `459970`) each come from a single coherent recording per surface so the 3 variants match in mic distance and timbre.
- **Weakest / caveats to ear-check**:
  - `fuel-flow.ogg` uses a pressurized hose water-flow recording (`236283`) boosted from `-43.9 dBFS` rms to `-20.0 dBFS` rms; ear-check for hiss/noise floor.
  - `amb-birds.ogg` (`624015`) was boosted from `-41.2 dBFS` rms to `-20.0 dBFS` rms; ear-check noise floor.
  - `eat-bite.ogg` (`774782`) has low RMS (`-35.6 dBFS`) relative to its crisp bite transient (`-4.0 dBFS` peak); may want a slightly higher playback level (`0.8`).
  - `forklift-beep.ogg` (`449081`) is a 2.00 s loop containing periodic beeps (`cv = 0.249` because of the gaps between beeps); ear-check that the loop seam falls cleanly in a silent gap.
  - `brake-squeal.ogg` (`784172`) is an interior car stop; ear-check whether it reads clearly as brake pads/squeal or needs swapping for `71741` (handbrake skid).
  - Freesound `-hq.mp3` previews were used instead of lossless originals (Freesound original downloads require login).
  - **Skipped / not in game**: Jump/land (no jump mechanic), turn indicators/gear shifts (not yet in `driving.js`), farm animals (no chickens/cows in `dist/` yet).

---

## Step 4: Exact Wiring Plan (No Shared `dist/` Files Edited Here)

1. **Copy assets**: Copy `assets-src/sounds-sweep/*.ogg` -> `dist/assets/sounds/`.
2. **`dist/vehicle-sounds.js` (or new `dist/sweep-sounds.js`)**:
   - Update `ENGINES.atv.file` (`vehicle-sounds.js:14`) from `'eng-s70'` to `'eng-atv'` with `rate: [0.85, 1.85]`.
   - Update `ENGINES.tractor_juff.file` and `ENGINES.tractor_kidbi.file` (`vehicle-sounds.js:12-13`) from `'eng-worktruck'` to `'eng-tractor'` with `rate: [0.8, 1.45]` / `[0.75, 1.35]`.
   - Export `SWEEP_CLIPS` and `STEP_CLIPS = { pave: ['step-pave-1','step-pave-2','step-pave-3'], grass: ['step-grass-1','step-grass-2','step-grass-3'], gravel: ['step-gravel-1','step-gravel-2','step-gravel-3'], wood: ['step-wood-1','step-wood-2','step-wood-3'] }`, and append all 40 names to `ALL_FILES`.
3. **`dist/audio.js` additions** (keeping existing synthesized sounds as fallback until decoded):
   - Add `ui(name, level = 0.45)` for non-spatial UI/player one-shots (`ui-click`, `ui-toast`, `cash-register`, `coins-pay`, `level-up`, `eat-bite`, `sleep-chime`, `breath-tired`).
   - Add `worldShot(poolOrName, at, listener, level = 0.6, rateJitter = 0.08)` using `const a = attenuate(distance(listener, at)); if (a < 0.02) return false;` for spatial one-shots:
     - `step(surface, at, listener, running)`: maps `SURFACE` (or `'wood'` when `inside || shop || deck`) to `STEP_CLIPS`, plays at `level = running ? 0.55 : 0.35`, `rateJitter = 0.10`.
     - `door-open` / `door-close` (`level = 0.55`), `shop-bell` (`level = 0.50`), `gate-latch` (`level = 0.55`, replaces `audio.click` on `toggleGate` and `toggleSawmill` can keep `audio.click` or use `gate-latch`).
     - `car-door-open` / `car-door-close` (`level = 0.65`), `car-horn` (`level = 0.75`), `brake-squeal` (`level = 0.45`), `crate-drop` (`level = 0.60`), `fuel-nozzle` (`level = 0.55`, replaces `audio.click` in `fuel.take` / `hangNozzle`).
   - Upgrade `audio.ping()` (`audio.js:181`): try `shot('phone-ping', 0.45)` first, fall back to `[1175, 1568]` sine oscillators.
   - Upgrade `audio.fuel()` (`audio.js:135`): when `'fuel-flow'` is decoded, mute `v.fuelRushGain`/`v.fuelHumGain` and drive a looping `BufferSource` at `gain = 0.45 * a`, `playbackRate = 0.85 + 0.45 * fullness`.
   - Add `audio.forklift({ on, speed, raise, at, listener })`: when `on` and `speed < -0.1`, loop `forklift-beep` at `gain = 0.45 * attenuate(...)`; when `on && raise !== 0`, loop `forklift-lift` at `gain = 0.50 * attenuate(...)`; fade to `0` and stop after `0.3 s` idle.
   - Add `audio.ambience({ outdoors, isNight, windSpeed, waterDist, dt })`: cross-fade 4 looping `BufferSource`s (`amb-birds` when `outdoors && !isNight`, `amb-crickets` when `outdoors && isNight`, `amb-wind` scaled by `Math.min(1, windSpeed / 12) * (outdoors ? 1 : 0.2)`, `amb-water` scaled by `attenuate(waterDist)`), max gain `0.18..0.25` so ambience sits gently under gameplay.
4. **`dist/game.js` call-site edits**:
   - **Footsteps (`stepWorld` / `frame`, `game.js:1691,1724`)**: track `lastStepPhase = Math.floor(phase / Math.PI)`; whenever `moving && !fork.on && !driving.active` and `Math.floor(phase / Math.PI) !== lastStepPhase`, call `audio.step(inside || shop || deck > 0 ? 'wood' : surfaceLive(px, pz), me.position, listenerAt(), running)`.
   - **Doors (`game.js:632,635,1427`)**: play `shop-bell` on `enterShop`/`leaveShop` (if not `officeByKey`), `door-open` when a hinged/home door starts opening, `door-close` when it closes.
   - **UI & Phone (`game.js:598`, `store.js`, `phone.js`, `inventory-ui.js`, `main-menu.js`)**: play `ui-toast` inside `showToast`; attach a delegated `click` listener on `#store`, `#phone`, `#inventory`, `#welcome` buttons for `ui-click`.
   - **Economy & Progression (`game.js:628,641,665,1186,1389`, `241,529`)**: play `cash-register` on successful purchase/bill pay; `coins-pay` on `collectAct` / gig payout / delivery pay; `level-up` on `promoteAct` and skill level-up.
   - **Life (`game.js:636,1372,1581,1695`)**: play `eat-bite` on food `useItem` / `lifeAct('meal')`; `sleep-chime` when `sleepElapsed >= 1.5` completes; `breath-tired` with an 8 s cooldown when `needsEffects(life).canRun === false` while holding Shift/moving.
   - **Fuel (`game.js:843,846`)**: replace `audio.click` with `audio.worldShot('fuel-nozzle', ...)`.
   - **Vehicles (`game.js:919,961,1084,1688`)**: play `car-door-open` when `doorThen` starts on enter, `car-door-close` once seated (or on exit); bind `KeyH` while `driving.driving` to `car-horn`; play `brake-squeal` (1.5 s cooldown) when `keys.has('Space')` and `Math.abs(driving.speed) > 6`.
   - **Cargo & Forklift (`game.js:803,814,1019-1021,1687`)**: play `crate-drop` on crate/parcel pick/drop; call `audio.forklift(...)` in `stepWorld` / `frame`.
   - **Ambience (`game.js:1734`)**: call `audio.ambience(...)` once per frame using `!inside && !shop`, `sky.state()`, `windNow`, and distance to nearest water cell/bridge.
