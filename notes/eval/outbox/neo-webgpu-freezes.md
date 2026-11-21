michadr.

# WebGPU freezes & start-up pause investigation (read-only, Neo)

No project files were edited except this report. No `git`, `npm test`, or `npm run release` was run.

---

## 1. What was measured and how

**Environment (real GPU WebGPU confirmed):**
- Browser: Headless Microsoft Edge `157.0.0.0` (`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`), flags `--headless=new --enable-unsafe-webgpu --ignore-gpu-blocklist --enable-features=Vulkan`, viewport `1280x720`, 165 Hz vsync (`6.06 ms` frame interval).
- Adapter: `WebGPUBackend` (`isWebGPURenderer: true`, `direct: true`), NVIDIA Lovelace (`adapterInfo: { vendor: "nvidia", arch: "lovelace" }`).
- Served target: live `dist/` (which loads `dist/releases/0.36.2/game.js`, WebGPU default; `?webgpu=0` for WebGL comparison) over a local Node `http.createServer` static server.

**Exact commands run (temporary scripts kept outside the repo in scratch):**
1. `node ".../scratch/measure-freezes.mjs"` — startup comparison (WebGPU vs WebGL), runtime suspect sweep, and `?perf=1` 600-frame steady-state probe at Oak Street night (`1320`).
2. `node ".../scratch/measure-deep.mjs"` — isolated startup breakdown (early Play click at 1.5 s vs late Play click at 9 s after `npcRoutesReady`), resource timings, and isolated dusk / vehicle / ground-cover biome runs.
3. `node ".../scratch/measure-spot.mjs"` — isolated nighttime headlight `SpotLight` add/remove (`ADD-1`, `REMOVE-1`, `ADD-2`, `REMOVE-2`) and fresh-spawn ground cover (`materials: 0 -> 9`) on both WebGPU and WebGL, with `renderer._nodes.getForRender` (> 4 ms) + `renderer._pipelines.getForRender` (> 4 ms) + `GPUDevice.prototype.createRenderPipeline` / `createShaderModule` instrumentation.

**Important measurement finding on the shader-build snippet (`webgpu-drawindexed.md:81`):**
- `renderer._pipelines.getForRender` was hooked cleanly (`pipeHooked: true`), and logged **only 1 event > 4 ms** (`water-3:14`, `5.0 ms` during `SPOT-ADD-1`). Why? On Chromium/Dawn, `GPUDevice.prototype.createRenderPipeline` returns in `0.0–0.1 ms` on the JS thread (it dispatches compilation over IPC to the GPU process).
- The real **CPU-thread** stall happens one layer earlier in **`renderer._nodes.getForRender`** (Three.js `NodeBuilder` generating WGSL), which logged **68 events > 4 ms** (`4.1–8.4 ms` each, summing to `179.9 ms` in a single frame on `SPOT-ADD-1`).
- The real **GPU-process** stall (Dawn compiling those synchronous pipelines to D3D12/Vulkan) shows up immediately afterwards as a multi-second **rAF gap** (`gap` = time between end of previous `rAF` and start of next `rAF`, up to **2,816–6,968 ms**).

**`?perf=1` steady-state baseline (Oak Street, night `22:00`, `1280x720`, 600 frames):**
- **WebGPU:** CPU frame `min 2.3 / mean 4.47 / p95 6.2 / p99 6.7 ms`; interval `mean 6.06 / p99 7.5 ms`; GPU (`timestamp-query`) `min 0.58 / mean 0.94 / p95 1.74 / p99 2.03 ms` (`n=374`).
- **WebGL (`?webgpu=0`):** CPU frame `min 2.2 / mean 3.84 / p95 5.1 / p99 6.0 ms`; interval `mean 6.06 / p99 7.2 ms`; GPU (`timer query`) `min 1.38 / mean 5.68 / p95 6.47 / p99 6.91 ms` (`n=600`).
- Steady-state WebGPU is smooth (~4.5 ms CPU, ~0.94 ms GPU). The owner's freezes are **entirely spike/compilation events**, not steady-state throughput.

---

## 2. Suspects table (measured ms & verdict)

| # | Suspect | Measured WebGPU | Measured WebGL (`?webgpu=0`) | Verdict |
|---|---|---|---|---|
| **1** | **Headlight `SpotLight` add/remove** (`dist/night-lights.js:116-118`) | **1st add (`SPOT-ADD-1`):** `231.3 ms` CPU (`179.9 ms` in 49 `NodeBuilder` builds, `37` sync pipelines, `59` shaders) + `103.2 ms` next frame (`7` sync pipelines) + **`2,815.9 ms` GPU stall**. In a wider view (`results.json` `spot-setup`): **`499.6 ms` CPU** (`71` sync pipelines, `98` shaders) + **`6,968.2 ms` GPU stall**.<br>**Subsequent camera/chunk reveals while SpotLight is in scene:** 5 recurring hitches of **`36.9–53.0 ms` CPU + `350–758 ms` GPU stalls** (`2–6` sync pipelines each). | **1st add (`SPOT-ADD-1`):** `2,221.5 ms` CPU + `692.4 ms` next frame + 4× `138–192 ms` follow-ups. | **#1 RUNTIME FREEZE (CRITICAL).** Confirmed worst gameplay hitch by an order of magnitude. Adding the `SpotLight` changes the lighting cache key of every lit material in the world, triggering a massive synchronous rebuild immediately and recurring 350–760 ms freezes whenever unseen materials enter view. |
| **2** | **Start-up / Play click pause** (`dist/game.js:140-146, 1841-1847, 1871`) | **Click Play early (1.5 s on menu):** **`3,748.1 ms` freeze** (`3,634.7 ms` non-render = `npcWarm.run()`, `113.4 ms` render, `13` sync pipelines).<br>**Click Play after `npcWarm` finishes (~6 s on menu):** **`144.1 ms` CPU** (`renderMs 151.4 ms`, `13` sync pipelines) + **`595.5 ms` GPU stall** (`~740 ms` total; `115.6 ms` + `485 ms` in repeat run).<br>**Boot frame 1 (menu):** **`677.6–788.0 ms` CPU** (`61–70` sync pipelines). | **Click Play early (1.5 s on menu):** **`3,074.0 ms` freeze** (`2,800.9 ms` non-render = `npcWarm.run()`, `273.1 ms` render).<br>**Boot frame 1:** `852.8–984.4 ms` CPU (`__warmMs: 158–180 ms`). | **CRITICAL (TWO CAUSES).** (1) **~2.8–3.6 s** of the 1–4 s Play pause is **`npcWarm.run()`** (`game.js:1842`), affecting *both* WebGL and WebGPU whenever Play is clicked within ~6 s of load. (2) **~600–740 ms** on Play + **~680–790 ms** on boot frame 1 is WebGPU synchronous pipeline compilation because frame 1 calls `renderer.render()` before `compileAsync` finishes, and 13 more pipelines compile on Play. |
| **3** | **First sight of unseen district/vehicles & entering a vehicle (daytime, no headlights)** | **Teleport to Eastbank Depot (`veh-setup-day` / `depot-night-settle`):** **`90.7–114.4 ms` CPU** (`13–14` sync pipelines: `vehicle-paint-tsl` 4.8–8.4 ms, `vehicle-glass-tsl` 4.4 ms, `ground-tsl-valley` 5.3–5.8 ms) + **`395.7–507.4 ms` GPU stall**.<br>**Enter `eastbank-offroad` (day):** `50.5 ms` CPU (`6` sync pipelines across 4 frames, `49.3 ms` gap).<br>**Enter `eastbank-atv` (day):** **`0` spikes > 30 ms, `0` sync pipelines**. | Teleport to depot: `73.4–78.1 ms` CPU. | **CONFIRMED (HIGH FOR FIRST SIGHT OF NEW CHUNKS/VEHICLES, MODERATE FOR VEHICLE ENTRY).** Streamed chunks (`ground-tsl-valley`) and out-of-frustum vehicles (`vehicle-paint-tsl`, `vehicle-glass-tsl`) are missed by boot `compileAsync`. Entering a second vehicle whose materials are already compiled costs `0 ms`. |
| **4** | **Late ground-cover materials** (`dist/ground-cover-view.js:31-32, 45`) | **First spawn chunks (`materials: 0 -> 9`):** **`49.9–52.7 ms` CPU** (`33.3 ms` across 9 `NodeBuilder` builds, e.g. `cover-tsl-tallgrass` 4.9 ms, `1` sync pipeline) + **`70.7–111.3 ms` GPU stall**.<br>**New biomes (`forest`, `lake`, `cedar`, `alder`; `materials: 9 -> 11`):** **`33.5–42.9 ms` CPU** (`1` sync pipeline per new kind/chunk) + up to **`87.1 ms` GPU stall**. (`coverStats().maxPlaceMs` was only `2.7–3.2 ms`.) | First spawn chunks: `72.3 ms` CPU (`renderMs 66.6 ms`). | **CONFIRMED (MEDIUM).** Causes repeatable **33–53 ms CPU + 71–111 ms GPU** hitches when walking into new biomes or when the first cover chunks appear. |
| **5** | **Dusk window materials** (`dist/night-lights.js:94-97`) | **Building glass masks (`attach`, line 94):** all `23/23` buildings already `ready` *before* Play was clicked (masks decode during menu, *after* boot frame 1's `compileAsync`, invalidating those 23 materials with `needsUpdate = true` and contributing to the first-Play-frame `13` sync pipelines).<br>**First dusk (`1110` / 18:30, `cityLit` swap + `night-sprites`/`night-ground`):** **`20.2 ms` CPU** (`3` sync pipelines, `6` shaders) + **`70.4 ms` GPU stall**.<br>**Later dusk (`1320` / 22:00):** `8.9 ms` CPU (`1` sync pipeline), no GPU stall > 60 ms. | Not isolated separately; minor. | **MINOR AT DUSK (ONE-TIME ~20 ms CPU + 70 ms GPU), INDIRECT CONTRIBUTOR AT STARTUP.** Not a major runtime freeze on its own, though `cityLit` is uncompiled until first dusk and `attach()`'s `needsUpdate` dirties 23 buildings after initial warm-up. |

---

## 3. Start-up timeline (page load -> menu -> Play -> first active game frame)

Measured on localhost (`dist/releases/0.36.2/`, NVIDIA Lovelace, headless Edge). Every `await` and blocking step in `dist/game.js` up to the first active rendered frame:

| Step | Code location | Measured time (WebGPU, localhost) | Blocks first frame? | Notes |
|---|---|---|---|---|
| 1. Static ES module graph fetch & parse | `index.html` -> `game.js` static imports (`three.module.js` 659 KB, `three.core.js` 1.48 MB, `props-assets.js` 7.43 MB, `nature-assets.js` 458 KB, `rigged-assets.js` 192 KB, etc.) | **`~180 ms`** (`+0 -> +180 ms` from `game.js` start; `props-assets.js` alone is `77–83 ms` on localhost, much longer on cold network) | **Yes** | All static imports resolve before line 99 executes. |
| 2. `await loadCharacterAssets()` | `dist/game.js:99` -> `dist/character.js:50-62` | **`~200 ms`** (`character-male.js` 1.86 MB + `atob` + `GLTFLoader.parseAsync`: `~120 ms`; then `character-female.js` 1.49 MB: `~81 ms`) | **Yes** | Runs **sequentially** (`for (const kind of ['male','female'])`) and blocks before `three.webgpu.js` even starts downloading. |
| 3. `await import('./perf-probe.js')` | `dist/game.js:102` | `0 ms` (only when `?perf` is in URL) | Only with `?perf` | Skipped in normal play. |
| 4. `await Promise.all([import('three.webgpu.js'), import('three.tsl.js'), import('tsl-output.js')])` | `dist/game.js:103` | **`~25 ms`** localhost (`1.35 MB + 1.07 MB` parse) | **Yes** (WebGPU only) | Waits behind `loadCharacterAssets()` instead of running in parallel. |
| 5. `await r.init()` (`requestAdapter` + `requestDevice`) | `dist/game.js:103` | **`103–319 ms`** (`requestAdapter`: `54.2–277.0 ms`; `requestDevice`: `41.5–48.8 ms`) | **Yes** (WebGPU only) | Hardware WebGPU adapter/device creation. |
| 6. Synchronous scene/world/map/NPC/vehicle build | `dist/game.js:105-1871` (`createWorld`, `createDriving`, `createNightLights`, `createShadows`, `createNpcCrowd`, `npcWarmStart`, etc.) | **`~445 ms`** (from `r.init()` done to first `rAF`) | **Yes** | Pure synchronous JS on main thread. |
| 7. Boot `frame()` #1: `warmed` + fall-through `renderer.render(scene, camera)` | `dist/game.js:1841, 1847, 1871` | **`677.6–788.0 ms` CPU** (`__warmMs: 10 ms`, **`61–70` sync `createRenderPipeline` calls**), plus **`111.7–115.5 ms`** on `frame` #2 (`9` sync pipelines for `menuLive`) | **Yes** (blocks menu appearance) | **Bug:** `compileAsync` is fire-and-forget on line 1841, then line 1847 (`if(!active){if(menuDrawn)...}`) falls straight through to `renderer.render(scene, camera)` on line 1871 on frame 1, forcing synchronous compilation of 61–70 pipelines! |
| 8. Background loads during menu | `world.js:579` (`cover-assets.js` 293 KB), `night-lights.js:91` (3 glass mask images -> `attach` on 23 buildings), `game.js:1885-1886` (`dev.js`, `interiors.js`, `interior-edit.js` when `DEV_MODE` is on), `audio.js` sounds | Non-blocking downloads (`cover-assets.js` ~2.5 ms localhost); **glass mask `attach()` dirties 23 building materials after boot warm-up** | Indirectly (triggers recompiles on Play) | `game.js:1885-1886` top-level `await`s run *after* `requestAnimationFrame(frame)` on line 1871, so they do not block `rAF` #1. |
| 9. Menu idle: `npcWarm.step()` | `dist/game.js:140-146, 1842` -> `dist/npc-routes.js:51-70` | **`~5,960 ms` total wall time** on menu (`npcRoutesAt: 11,611 ms` vs `firstRafAt: 5,648 ms`), with individual menu frames stalling **`32–425 ms`** despite `NPC_WARM_MS = 4` | **Blocks Play click if user clicks before ~6 s!** | Each single A* route query can take up to 425 ms before `budgetMs` is checked. |
| 10. **Clicking Play (`#start`) -> first active game frame** | `dist/game.js:505, 1842, 1871` | **Early click (1.5 s on menu):** **`3,748.1 ms` CPU** (`3,634.7 ms` `npcWarm.run()` + `113.4 ms` `render`, `13` sync pipelines).<br>**Late click (after `npcWarm` finishes):** **`115.6–144.1 ms` CPU** (`13` sync pipelines) + **`485–595.5 ms` GPU stall** = **`~600–740 ms`**. | **Yes — this is the owner's 1–4 s start pause.** | On WebGL, early click also froze for `3,074.0 ms` (`2,800.9 ms` `npcWarm.run()`). |

### Can the start pause be removed, or does it need a loading screen?
**Both — the bulk of the pause (80–90%) should be removed, and a lightweight "Starting..." state should cover the edge case where a player clicks Play immediately:**
1. **The 2.8–3.6 s `npcWarm.run()` pause can be removed completely** by not running the entire route table synchronously on click-Play (keep slicing `npcWarm.step()` in play with a cap of 1 short pair per frame, or compute routes lazily / in a Web Worker / pre-bake the static route table since `npcStaticRoutes` only uses static map geometry!).
2. **The ~680–790 ms boot frame 1 freeze + ~600–740 ms WebGPU Play-click freeze can be largely removed** by:
   - Not calling synchronous `renderer.render(scene, camera)` on boot frame 1 while `!active` (let `compileAsync` + `warmHidden` actually run asynchronously in the background while the menu is up!).
   - Re-running `compileAsync` after building glass masks (`attach`) and `cover-assets.js` finish loading during the menu, so those 13+ pipelines are already compiled before the player clicks Play.
3. **Where a short loading/preparing indicator still helps:** if the player clicks Play within the first ~1–2 seconds before `compileAsync` finishes, awaiting the in-flight `warmPromise` behind a brief `"Preparing world..."` state on the Play button (or veil) avoids a frozen frame and guarantees the first rendered frame is smooth.

---

## 4. Ranked fix list (exact file, function, and change)

### Rank 1 (CRITICAL — removes 231–500 ms CPU + 2.8–7.0 s GPU freeze + recurring 350–760 ms night hitches): Keep the headlight `SpotLight` permanently in the scene on High quality
- **File:** `dist/night-lights.js` (non-forbidden; pure wiring)
- **Function:** `createNightLights` (lines 100, 115–122) and `dist/night-lights-rules.js` `spotlightPlan` (lines 117–120)
- **Exact change:**
  1. In `dist/night-lights.js`, accept `high = true` (or `webgpu = false`) in `createNightLights({scene, footing, cityWindows, cityLampHeads, high = true, makeMask})`.
  2. During `createNightLights` setup (right after `scene.add(ground, sprites)` at line 79, **before** `game.js:1841` runs `compileAsync`), if `high` is true, create `spot = new THREE.SpotLight(SPOT.colour, 0, SPOT.distance, SPOT.angle, SPOT.penumbra, SPOT.decay); spot.name = 'player-headlight'; spot.castShadow = false;` and call `scene.add(spot, spot.target); spotIn = true;` once at startup with `intensity = 0`.
  3. In `setSpot(plan, source)` (lines 115–122): **remove** the runtime `scene.add(spot, spot.target)` / `scene.remove(spot, spot.target)` toggling when `high` has not changed. Simply keep `spot` in the scene when `high` is true and set `spot.intensity = (plan.present && source) ? plan.intensity * scale : 0`. Only add/remove `spot` if quality explicitly switches between Low and High.
  4. *(Optional companion in `dist/game.js:457`, main chat):* pass `high: startSettings.quality === 'high'` into `createNightLights(...)`.
- **Expected impact:** Eliminates the 49–71 material `NodeBuilder` rebuilds and 2.8–7.0 s GPU stall when turning on headlights, plus all recurring 350–760 ms night hitches. Toggling headlights becomes a `0 ms` uniform update.

### Rank 2 (CRITICAL — removes the 2.8–3.6 s freeze when clicking Play within 6 s of load): Stop running `npcWarm.run()` synchronously on Play click
- **File:** `dist/game.js` (**forbidden — for main chat**)
- **Function:** `frame()` (line 1842)
- **Exact change:**
  - Replace:
    ```js
    if(npcWarm){if(active)npcWarm.run();else npcWarm.step();if(npcWarm.done){npcRoutesReady();if(active&&npcWarm){npcWarm.run();npcRoutesReady()}}}
    ```
    with continuing sliced warming even after `active` becomes true (e.g., `if(npcWarm){npcWarm.step();if(npcWarm.done)npcRoutesReady()}`), and allow `npcCrowd` to use the fallback trip estimate until `npcRoutesReady()` swaps in `npcWalkSched` (as `game.js:140` already notes it does).
  - *(Longer-term best fix in `npc-routes.js` / build step):* because `npcStaticRoutes` only depends on static `MAP` geometry, pre-compute the static route table at build time (or in a Web Worker) so `npcWarm` costs `0 ms` on the main thread during both menu and play (eliminating the 32–425 ms menu spikes too).
- **Expected impact:** Cuts early Play-click freeze from **3,748 ms -> ~144 ms** immediately (and eliminates the 32–425 ms menu stutter if moved to a worker or pre-baked).

### Rank 3 (HIGH — removes 678–788 ms boot frame 1 freeze + ~600–740 ms Play-click GPU stall): Don't defeat `compileAsync` with a synchronous `renderer.render()` on boot frame 1, and warm async-loaded materials during the menu
- **File:** `dist/game.js` (**forbidden — for main chat**)
- **Function:** `frame()` (lines 1841, 1847) and `startGame()` (line 505)
- **Exact change:**
  1. At `dist/game.js:1841`, store the promise:
     ```js
     if(!warmed){warmed=true;const w0=performance.now();try{if(renderer.compile)renderer.compile(scene,camera);else{warmPromise=Promise.all([renderer.compileAsync?.(scene,camera),renderer.__directOutput?.warmHidden(scene,camera)]).catch(()=>{})}}catch{}globalThis.__warmMs=Math.round(performance.now()-w0)}
     ```
     *(And update `warmHidden` in `dist/tsl-output.js:109-119` to return `Promise.all(promises)` instead of just `n`.)*
  2. At `dist/game.js:1847`: when `!active` AND `renderer.isWebGPURenderer` is true, **do not fall through to `renderer.render(scene, camera)` on frame 1** (`if(!active){menuLive.tick(now);return}`). Let `compileAsync` + `warmHidden` finish asynchronously on the menu! (Keep the `menuDrawn` fall-through only for classic `WebGLRenderer`.)
  3. *(Optional polish in `startGame()`, line 505):* if `warmPromise` is still pending when the user clicks Play, show `"Preparing..."` on `#start` and enter the game as soon as `warmPromise` resolves.
- **Expected impact:** Eliminates the `678–788 ms` synchronous boot frame 1 freeze on WebGPU and lets Dawn compile pipelines asynchronously while the user is on the menu.

### Rank 4 (MEDIUM-HIGH — removes 33–53 ms CPU + 71–111 ms GPU ground-cover hitches): Pre-create & async-warm all cover materials and share base geometry attributes
- **File:** `dist/ground-cover-view.js` (non-forbidden)
- **Functions:** `setAssets` (line 55) and `meshRun` (line 45)
- **Exact change:**
  1. In `setAssets(a)` (line 55): after populating `models`, loop over `cur.kinds` (or `models.keys()`) and eagerly call `materialFor(kind)` for each kind. Add a `warm(renderer, camera, scene)` method on `view` (called once `cover-assets.js` resolves in `world.js:579`, or from `game.js`) that builds one temporary 1-instance `InstancedMesh` per cover material and calls `renderer.compileAsync(dummyGroup, camera, scene)`.
  2. In `meshRun` (line 45): replace `const g = geoFor(kind).clone();` with:
     ```js
     const base = geoFor(kind), g = new THREE.BufferGeometry();
     for (const k in base.attributes) g.setAttribute(k, base.attributes[k]);
     if (base.index) g.setIndex(base.index);
     g.setAttribute('aInst', new THREE.InstancedBufferAttribute(I, 2));
     ```
     *(And in `disposeGroup` line 40, ensure only the per-run `g` / `aInst` is disposed, not the shared base attributes—note `BufferGeometry.dispose()` only frees its own VAO/wrapper if attributes are shared, or keep `geoFor` attributes alive.)*
- **Expected impact:** Eliminates the `33–53 ms` CPU + `71–111 ms` GPU stalls on first cover chunk and biome transitions, and stops duplicating vertex/index GPU buffers per chunk.

### Rank 5 (MEDIUM — removes 91–114 ms CPU + 396–507 ms GPU first-sight district/vehicle hitches & dusk `cityLit` 70 ms stall): Warm `cityLit`, post-`attach` building materials, and vehicle/streamed-ground prototypes
- **Files:** `dist/night-lights.js` (lines 94–97) and `dist/tsl-output.js` (`warmHidden`, lines 109–119) / `dist/game.js` (**forbidden — for main chat**)
- **Exact changes:**
  1. `dist/night-lights.js:96-97` (`createNightLights`): attach `cityLit` to a 1-triangle hidden dummy mesh added to `scene` (or pass it to `warmHidden`) so `cityLit` compiles during the menu instead of at dusk (`1110`).
  2. `dist/night-lights.js:91-94` (`attach`): accept an optional `onAttach(mesh)` callback; when `game.js` passes `onAttach: m => renderer.compileAsync?.(m, camera, scene)?.catch?.(()=>{})`, the 23 Kenney buildings recompile asynchronously during the menu right after their glass masks arrive, instead of stalling the first Play frame.
  3. `dist/tsl-output.js:113` (`warmHidden`): also include hidden non-`-tsl` meshes (or expose a `warmObject(obj, camera, scene)` helper called when `driving` vehicles and `world` streamed ground/valley materials are created) so `vehicle-paint-tsl`, `vehicle-glass-tsl`, and `ground-tsl-valley` compile asynchronously before the player walks into Eastbank Depot.

### Rank 6 (LOW-MEDIUM — shaves ~100–200 ms off cold startup before menu): Parallelize `loadCharacterAssets()` and `three.webgpu.js` import
- **Files:** `dist/character.js:54-58` (`loadCharacterAssets`) and `dist/game.js:99-103` (**forbidden — for main chat**)
- **Exact changes:**
  1. `dist/character.js:54-58`: replace the sequential `for (const kind of ['male','female'])` loop with `await Promise.all(['male','female'].map(async kind => ...))`.
  2. `dist/game.js:99-103`: start `const charP = loadCharacterAssets();` *before* `if (backendWanted.webgpu) { ... }` and `await charP` right after `r.init()` finishes, overlapping the ~200 ms character glTF decode with the ~128–344 ms `three.webgpu.js` download + `r.init()`.

---

## 5. What I could NOT verify & confidence per finding

**Could NOT verify:**
- Cold-network download latency for `props-assets.js` (7.4 MB) and `three.webgpu.js` + `three.tsl.js` (2.4 MB) — all tests ran against a local static server on `127.0.0.1`.
- Exact shader-cache behavior across browser reloads (each headless Edge run used a fresh `--user-data-dir` profile, i.e., cold Dawn shader cache — matching a player's first visit or post-update visit; warm browser disk cache may reduce the GPU-process Dawn stall on repeat visits).
- Entering indoor shops/interiors or switching quality Low <-> High at runtime (not part of the requested scenarios).
- Actual post-fix numbers (read-only investigation; no source files were modified).

**Confidence per finding:**
- **Suspect 1 (Headlight `SpotLight` add/remove = #1 runtime freeze, 231–500 ms CPU + 2.8–7.0 s GPU):** **Very high.** Directly reproduced and measured twice on real NVIDIA WebGPU, with `NodeBuilder` naming the exact rebuilt materials (`ground-tsl-grass`, `vehicle-paint-tsl`, `cover-tsl-*`, etc.).
- **Start pause (`npcWarm.run()` = 2.8–3.6 s on early Play click; boot frame 1 + Play-click WebGPU sync pipelines = ~680–790 ms + ~600–740 ms):** **Very high.** Directly proved by A/B testing early Play click (1.5 s -> `3,748 ms` WebGPU / `3,074 ms` WebGL) vs late Play click after `npcRoutesReady` (9 s -> `144 ms` CPU + `596 ms` GPU).
- **Suspect 2 (Ground cover lazy materials = 33–53 ms CPU + 71–111 ms GPU):** **High.** Directly measured on fresh spawn (`materials: 0 -> 9`) and across 5 biome teleports (`9 -> 11`), with `cover-tsl-tallgrass` logged at `4.9 ms` in `_nodes.getForRender`.
- **Suspect 4 (First sight of depot/vehicles = 91–114 ms CPU + 396–507 ms GPU; daytime vehicle enter = 50.5 ms CPU first time, 0 ms second time):** **High.** Directly measured with exact material names from `_nodes.getForRender`.
- **Suspect 3 (Dusk windows = 20.2 ms CPU + 70.4 ms GPU once at dusk; 23 building masks already attached before Play):** **High.** Directly measured across `1110 -> 1320` with `nightLights.state()` confirming `ready: 23` before Play and `windowsLit: 0 -> 114`.
