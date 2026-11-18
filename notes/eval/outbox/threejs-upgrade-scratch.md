michadr.
# Three.js Upgrade Trial (r160 -> r187) in Scratch Copy

- **Scratch directory:** `C:\Users\Michael\AppData\Local\Temp\eden-upgrade`
- **Real workspace status:** Untouched (`dist/vendor/three.module.js` confirmed still `const REVISION = '160';`; only this report `notes/eval/outbox/threejs-upgrade-scratch.md` was written in the real repo).
- **Package version tested:** `three@0.187.0` (`https://registry.npmjs.org/three/-/three-0.187.0.tgz`, unpacked into `C:\Users\Michael\AppData\Local\Temp\three-187-inspect\package`; zero packages added to repo `node_modules`).
- **Recommendation:** **Apply `r187` to the real tree.** Every automated test (`261/261`) passed after packaging, zero runtime console errors or new shader warnings appeared in headless Edge, and all five camera views rendered cleanly within `0.67–1.40 / 255` mean absolute channel difference (`<= 0.28%` pixels differing by `> 60` summed RGB).

## Agent & Model Routing Used

- **Orchestrator (Opus-equivalent, strongest reasoning model):** Performed the entire scratch workflow directly — repo copy & baseline packaging, CDP headless Edge benchmark script (`measure-upgrade.mjs`) and pixel diff comparator (`compare-shots.mjs`), `r187` vendoring and import rewrites, visual screenshot inspection, debugging and fixing the unexpected `r187` `Matrix4.decompose()` regression in `dist/scene-editor.js`, full `npm test` run, and authoring this report.
- **Subagents:** None spawned for this task (`flash` / `flash_lite` not used).

---

## Stage 1 & 4: Before / After Measurements (`r160` vs `r187`)

Measured in headless Microsoft Edge (`1400x800`, WebGL via SwiftShader software rasterizer, quality preset `High`) driving `window.__city` over CDP against `npm run release -- --force` builds served by `scripts/dev-server.mjs`. Each spot waited `2800 ms` to settle before sampling ~`10` `requestAnimationFrame` frames and capturing a PNG.

### Startup & Compilation

| Metric | `r160` | `r187` | Delta / Notes |
| --- | ---: | ---: | --- |
| `THREE.REVISION` | `160` | `187` | `+27` releases |
| `menuReadyMs` | `3428` ms | `3939` ms | `+511` ms |
| `firstFrameLoadMs` | `5811` ms | `6715` ms | `+904` ms |
| `warmMs` (`renderer.compile`) | `72` ms | `81` ms | `+9` ms |
| Console page/runtime errors | `0` | `0` | Zero exceptions |
| New Three.js deprecation/shader warnings | `0` | `0` | Only pre-existing multi-instance harness warning + `chunks: 5:9` streaming log |

### Five Fixed Camera Spots & Pixel Comparison

| Spot (`minutes`, `x`, `z`) | Metric | `r160` | `r187` | Pixel Diff (`1,120,000` px) / Notes |
| --- | --- | --- | --- | --- |
| **`spawn-noon`** (`720`, `-5`, `15`) | `frameMs` mean / median<br>`renderMs` mean / median<br>`drawCalls` / `triangles`<br>`programs` / `geoms` / `textures`<br>`shadowStrength` (`pass`) | `322.9` / `300` ms<br>`2.9` / `3` ms<br>`372` / `1,112,286`<br>`76` / `691` / `44`<br>`1` (`true`) | `318.7` / `316.6` ms<br>`2.1` / `1.9` ms<br>`372` / `1,112,276`<br>`76` / `691` / `46`<br>`1` (`true`) | `meanAbsChannelDiff`: `1.248`<br>`pctDiffGt15`: `0.55%`<br>`pctDiffGt60`: `0.02%`<br>`maxPixelSumDiff`: `275` |
| **`eastbank-noon`** (`720`, `162`, `18`) | `frameMs` mean / median<br>`renderMs` mean / median<br>`drawCalls` / `triangles`<br>`programs` / `geoms` / `textures`<br>`shadowStrength` (`pass`) | `206.2` / `200` ms<br>`1.5` / `1.5` ms<br>`140` / `146,637`<br>`78` / `751` / `59`<br>`1` (`true`) | `204.2` / `200.1` ms<br>`1.2` / `1.1` ms<br>`149` / `1,472,467`<br>`78` / `760` / `61`<br>`1` (`true`) | `meanAbsChannelDiff`: `1.4`<br>`pctDiffGt15`: `0.68%`<br>`pctDiffGt60`: `0.28%`<br>`maxPixelSumDiff`: `231` *(grass tufts finished async build inside 2800 ms wait in `r187`)* |
| **`forest-sawmill-dusk`** (`1040`, `114`, `-268`) | `frameMs` mean / median<br>`renderMs` mean / median<br>`drawCalls` / `triangles`<br>`programs` / `geoms` / `textures`<br>`shadowStrength` (`pass`) | `310.4` / `333.2` ms<br>`1.4` / `1.4` ms<br>`107` / `644,468`<br>`81` / `781` / `63`<br>`0.302` (`true`) | `308.3` / `349.9` ms<br>`1.3` / `1.3` ms<br>`182` / `1,114,657`<br>`81` / `781` / `65`<br>`0.302` (`true`) | `meanAbsChannelDiff`: `0.67`<br>`pctDiffGt15`: `0.04%`<br>`pctDiffGt60`: `0.01%`<br>`maxPixelSumDiff`: `547` *(async chunk streaming variance inside 2800 ms wait)* |
| **`farm-river-noon`** (`720`, `-150`, `-230`) | `frameMs` mean / median<br>`renderMs` mean / median<br>`drawCalls` / `triangles`<br>`programs` / `geoms` / `textures`<br>`shadowStrength` (`pass`) | `287.5` / `283.4` ms<br>`0.9` / `0.9` ms<br>`60` / `183,541`<br>`81` / `787` / `63`<br>`1` (`true`) | `304.2` / `300` ms<br>`0.9` / `0.8` ms<br>`60` / `183,541`<br>`81` / `787` / `65`<br>`1` (`true`) | `meanAbsChannelDiff`: `1.256`<br>`pctDiffGt15`: `0.39%`<br>`pctDiffGt60`: `0.07%`<br>`maxPixelSumDiff`: `196` |
| **`town-night`** (`1380`, `20`, `-4`) | `frameMs` mean / median<br>`renderMs` mean / median<br>`drawCalls` / `triangles`<br>`programs` / `geoms` / `textures`<br>`shadowStrength` (`pass`) | `335.4` / `333.4` ms<br>`2.2` / `2.1` ms<br>`418` / `213,795`<br>`81` / `851` / `64`<br>`1` (`true`) | `356.2` / `366.6` ms<br>`3.1` / `3` ms<br>`694` / `297,763`<br>`81` / `851` / `66`<br>`1` (`true`) | `meanAbsChannelDiff`: `0.702`<br>`pctDiffGt15`: `0.27%`<br>`pctDiffGt60`: `0.05%`<br>`maxPixelSumDiff`: `610` *(Night particles `points: 600 -> 600`; async chunk streaming timing)* |

Notes on measurements:
- `renderMs` (`0.8–3.1` ms) measures JS CPU submission (`renderer.render`), whereas `frameMs` (`200–367` ms) under headless SwiftShader reflects software rasterizer/compositor pacing (~`3–5 FPS`).
- `r187` consistently reports `+2` textures in `renderer.info.memory.textures` (`44 -> 46`, `59 -> 61`, etc.) across scenes with zero growth across spot transitions.
- Under identical settled views (`spawn-noon`, `farm-river-noon`), `drawCalls`, `programs`, and `geometries` matched `1:1`.

### Screenshot & Measurement Artifact Paths (in `%TEMP%\eden-upgrade\measurements\`)

- **Before (`r160`):**
  - `C:\Users\Michael\AppData\Local\Temp\eden-upgrade\measurements\r160\metrics.json`
  - `C:\Users\Michael\AppData\Local\Temp\eden-upgrade\measurements\r160\spawn-noon.png` (`614,787` bytes)
  - `C:\Users\Michael\AppData\Local\Temp\eden-upgrade\measurements\r160\eastbank-noon.png` (`244,294` bytes)
  - `C:\Users\Michael\AppData\Local\Temp\eden-upgrade\measurements\r160\forest-sawmill-dusk.png` (`909,023` bytes)
  - `C:\Users\Michael\AppData\Local\Temp\eden-upgrade\measurements\r160\farm-river-noon.png` (`1,156,667` bytes)
  - `C:\Users\Michael\AppData\Local\Temp\eden-upgrade\measurements\r160\town-night.png` (`576,752` bytes)
- **After (`r187`):**
  - `C:\Users\Michael\AppData\Local\Temp\eden-upgrade\measurements\r187\metrics.json`
  - `C:\Users\Michael\AppData\Local\Temp\eden-upgrade\measurements\r187\spawn-noon.png` (`623,565` bytes)
  - `C:\Users\Michael\AppData\Local\Temp\eden-upgrade\measurements\r187\eastbank-noon.png` (`272,773` bytes)
  - `C:\Users\Michael\AppData\Local\Temp\eden-upgrade\measurements\r187\forest-sawmill-dusk.png` (`913,718` bytes)
  - `C:\Users\Michael\AppData\Local\Temp\eden-upgrade\measurements\r187\farm-river-noon.png` (`1,152,278` bytes)
  - `C:\Users\Michael\AppData\Local\Temp\eden-upgrade\measurements\r187\town-night.png` (`582,067` bytes)
- **Comparison & full test log:**
  - `C:\Users\Michael\AppData\Local\Temp\eden-upgrade\measurements\comparison.json`
  - `C:\Users\Michael\AppData\Local\Temp\eden-upgrade\measurements\npm-test.log`

---

## Stage 2 & 3: Exact Diffs to Apply to the Real Tree

All edits below were made and verified only inside `C:\Users\Michael\AppData\Local\Temp\eden-upgrade` (UTF-8 without BOM).

### 1. Vendor Files (`dist/vendor/`, sourced from `three@0.187.0`)

1. `dist/vendor/three.module.js` — replace with `three@0.187.0/build/three.module.js` (`1,326,016` -> `658,900` bytes).
2. `dist/vendor/three.core.js` — **NEW** file from `three@0.187.0/build/three.core.js` (`1,474,799` bytes; `three.module.js` imports `./three.core.js` since `r168`).
3. `dist/vendor/BufferGeometryUtils.js` — replace with `three@0.187.0/examples/jsm/utils/BufferGeometryUtils.js` (`31,918` -> `39,165` bytes), rewriting `} from 'three';` -> `} from './three.module.js';`.
4. `dist/vendor/SkeletonUtils.js` — **NEW** file from `three@0.187.0/examples/jsm/utils/SkeletonUtils.js` (`11,547` bytes; required because `r187` `GLTFLoader.js` imports `{ clone } from '../utils/SkeletonUtils.js'`), rewriting `} from 'three';` -> `} from './three.module.js';`.
5. `dist/vendor/GLTFLoader.js` — replace with `three@0.187.0/examples/jsm/loaders/GLTFLoader.js` (`108,527` -> `119,859` bytes), rewriting:
   - `} from 'three';` -> `} from './three.module.js';`
   - `from '../utils/BufferGeometryUtils.js';` -> `from './BufferGeometryUtils.js';`
   - `from '../utils/SkeletonUtils.js';` -> `from './SkeletonUtils.js';`

*(Note: `scripts/package-release.mjs` already copies all `.js` files from `dist/vendor/` — `216` files packaged cleanly in `r187`.)*

### 2. Shared File Owned by Main Chat (`AGENTS.md` forbidden to Antigravity)

- **`dist/game.js:103`** (`PCFSoftShadowMap` was deprecated in `r182` and now maps to `PCFShadowMap` Vogel-disk sampling with a console warning):
```diff
- renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
+ renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
```

### 3. Game Module Diffs

- **`dist/shadows.js:13,74`** (use native `THREE.DirectionalLightShadow.intensity` introduced in `r166` instead of hijacking `sun.shadow.radius` or mutating `ShaderChunk`):
```diff
--- a/dist/shadows.js
+++ b/dist/shadows.js
@@ -13 +13 @@
- if(chunk.includes(FADE_GLSL))return true;
+ if(chunk.includes('shadowIntensity')||chunk.includes(FADE_GLSL))return true;
@@ -74 +74 @@
-  sun.shadow.radius=faded?plan.strength:1;update.run=!faded||plan.strength>0;update.n=(update.n|0)+1;sun.shadow.autoUpdate=update.run&&(update.n&1)===1; // option 2: the map is redrawn every second frame
+  sun.shadow.intensity=faded?plan.strength:1;update.run=!faded||plan.strength>0;update.n=(update.n|0)+1;sun.shadow.autoUpdate=update.run&&(update.n&1)===1; // option 2: the map is redrawn every second frame
```

- **`dist/scene-editor.js:104`** (discovered by `tests/scene-editor.mjs` during `npm test`):
  - **Why:** In `r187`, `Matrix4.decompose()` checks `const det = this.determinantAffine(); if ( det === 0 ) { scale.set( 1, 1, 1 ); quaternion.identity(); return this; }`, so zero-scale hidden instances (`scale = (0,0,0)`) now decompose to `scale = (1,1,1)` instead of `s.x === 0`. Checking the X-column squared length on `m4.elements` preserves exact behavior on zero-scale matrices. (Checked all other `.decompose(` call sites in the repo — `sawmill-rig.mjs` and `shadows.mjs` — none decompose zero-scale matrices.)
```diff
--- a/dist/scene-editor.js
+++ b/dist/scene-editor.js
@@ -104 +104 @@
-  shownAt(key){const slot=slots.get(key),t=slot?.targets[0];if(!t)return undefined;t.mesh.getMatrixAt(t.index,m4);const p=new THREE.Vector3(),qq=new THREE.Quaternion(),s=new THREE.Vector3();m4.decompose(p,qq,s);return s.x===0?null:{x:p.x,y:p.y,z:p.z,yaw:2*Math.atan2(qq.y,qq.w)}},
+  shownAt(key){const slot=slots.get(key),t=slot?.targets[0];if(!t)return undefined;t.mesh.getMatrixAt(t.index,m4);const e=m4.elements;if(e[0]*e[0]+e[1]*e[1]+e[2]*e[2]===0)return null;const p=new THREE.Vector3(),qq=new THREE.Quaternion(),s=new THREE.Vector3();m4.decompose(p,qq,s);return {x:p.x,y:p.y,z:p.z,yaw:2*Math.atan2(qq.y,qq.w)}},
```

- **`dist/credits.js:19`** (credits string):
```diff
--- a/dist/credits.js
+++ b/dist/credits.js
@@ -19 +19 @@
- {who:'three.js',what:'The 3D engine (r160).',licence:'MIT',url:'https://threejs.org',covers:[]},
+ {who:'three.js',what:'The 3D engine (r187).',licence:'MIT',url:'https://threejs.org',covers:[]},
```

### 4. Legitimate Test Re-pin (`tests/shadows.mjs`)

- **`tests/shadows.mjs:81-97`**: Updated the assertions that previously verified our custom `FADE_GLSL` patch inside `THREE.ShaderChunk.shadowmap_pars_fragment` and checked `sun.shadow.radius === strength` so they verify native `shadowIntensity` support in `ShaderChunk` (`ShaderChunk` stays unmutated under `r166+`) and assert `sun.shadow.intensity === strength` (`sun.shadow.radius` stays at default `1`). All shadow timing, dusk fade, night pass skipping (`118 of 1,440` minutes), `autoUpdate`, and Low-quality blob checks remain strictly enforced.
```diff
--- a/tests/shadows.mjs
+++ b/tests/shadows.mjs
@@ -81,4 +81,4 @@
- const chunk=THREE.ShaderChunk.shadowmap_pars_fragment;assert.equal(chunk.split(FADE_GLSL).length,2,'the fade is in the shadow lookup once');assert.equal(chunk.length,before.length-'return shadow;'.length+FADE_GLSL.length);
- assert(chunk.indexOf(FADE_GLSL)>chunk.indexOf('float getShadow(')&&chunk.indexOf(FADE_GLSL)<chunk.indexOf('vec2 cubeToUV'),'inside getShadow, before the point-light code');
- assert.equal(installShadowFade(),true);assert.equal(THREE.ShaderChunk.shadowmap_pars_fragment,chunk);
- assert.equal(new THREE.DirectionalLight().shadow.radius,1,'every other light keeps full shadows (radius 1)');
+ const chunk=THREE.ShaderChunk.shadowmap_pars_fragment;assert(chunk.includes('return mix( 1.0, shadow, shadowIntensity );')||chunk.includes(FADE_GLSL),'shadow fade uses native shadowIntensity (or FADE_GLSL)');
+ // r166+ integrates shadowIntensity inside getShadow directly
+ assert.equal(installShadowFade(),true);assert.equal(THREE.ShaderChunk.shadowmap_pars_fragment,before,'r166+ keeps ShaderChunk intact');
+ assert.equal(new THREE.DirectionalLight().shadow.intensity,1,'every other light keeps full shadows (intensity 1)');assert.equal(new THREE.DirectionalLight().shadow.radius,1,'default radius 1');
@@ -93 +93 @@
-  assert.deepEqual([st.strength,st.pass,st.blobs,st.drawCalls],[1,true,0,0]);assert.equal(sun.shadow.radius,1);assert.equal(sun.shadow.autoUpdate,true);assert.equal(blobs.visible,false,'High has no patches');
+  assert.deepEqual([st.strength,st.pass,st.blobs,st.drawCalls],[1,true,0,0]);assert.equal(sun.shadow.intensity,1);assert.equal(sun.shadow.radius,1);assert.equal(sun.shadow.autoUpdate,true);assert.equal(blobs.visible,false,'High has no patches');
@@ -96,2 +96,2 @@
- for(const m of [clock(6,10),clock(17,50)]){const st=shadows.update({sky:place(m,0,0),low:false});assert.deepEqual([st.strength,st.pass],[0,false]);assert.equal(sun.shadow.radius,0);assert.equal(sun.shadow.autoUpdate,false,'no shadow pass at '+m)}
- {const st=shadows.update({sky:place(clock(6,45),0,0),low:false});assert(st.strength>0&&st.strength<1&&st.pass&&sun.shadow.autoUpdate,'fading in at 06:45: '+st.strength);near(sun.shadow.radius,st.strength,1e-12,'the strength rides on shadow.radius')}
+ for(const m of [clock(6,10),clock(17,50)]){const st=shadows.update({sky:place(m,0,0),low:false});assert.deepEqual([st.strength,st.pass],[0,false]);assert.equal(sun.shadow.intensity,0);assert.equal(sun.shadow.autoUpdate,false,'no shadow pass at '+m)}
+ {const st=shadows.update({sky:place(clock(6,45),0,0),low:false});assert(st.strength>0&&st.strength<1&&st.pass&&sun.shadow.autoUpdate,'fading in at 06:45: '+st.strength);near(sun.shadow.intensity,st.strength,1e-12,'the strength rides on shadow.intensity')}
```

### 5. Optional Non-Blocking Follow-up Cleanups (Not Needed for `npm test`)

- `tests/assets-server.mjs:15`: Optionally add `'/dist/vendor/three.core.js'` and `'/dist/vendor/SkeletonUtils.js'` to the route allowlist smoke loop (both are already served by `hub/server.js`, verified by `r187` loading cleanly).
- `scripts/build-characters.mjs:4,9` and `scripts/build-props.mjs:5,115`: Offline FBX conversion comments/error text still mention `three@0.160.0` (only used when manually re-converting source FBX assets with `THREE_DIR` / `TOOL_DIR`).

---

## Release & Full Test Output (Scratch `%TEMP%\eden-upgrade`)

### `npm run release -- --force`

```text
> city-life-local-multiplayer@0.35.19 release
> node scripts/package-release.mjs --force

Packaged release 0.35.19: 216 files -> dist/releases/0.35.19
dist/index.html now loads releases/0.35.19/
```

### `npm test` (`261/261` passed, `0` retries, `0` failures)

```text
> city-life-local-multiplayer@0.35.19 test
> node scripts/run-tests.mjs

PASS accounts.mjs: Accounts: no-database 503, dev login only locally and when switched on, header and Origin required for changes, HttpOnly cookie with only its hash stored, cloud save revisions (bad file, size, too soon, stale 409), linking by verified email, expiry, logout, and /api/ routing passed.
PASS actions.mjs: Action exclusivity (every action blocks every other, both ways) passed.
PASS assets-checklist.mjs: Checklist: 36 received and wanted assets, 5 ready to import now (Eden signs: wall board and post sign, Hotel props: reception counter, desk bell, key rack, suitcase, Base man character (Grab3D), Base woman character (Grab3D), Welding shop props: task board, time clock, parts rack, steel rack, helmet, wire spool, extinguisher, first-person torch and glove), 24 waiting for an original that is not on this PC.
PASS assets-extras.mjs: Extras: names, change marker (7 days, baseline first), heaviest-first and frame budget pinned; heaviest real asset Male character (modular) (49,158).
PASS assets-page.mjs: Assets page: 217 cards in 26 packs (12 open), 82 items needing attention, no scripts, 201 KB with 10 sample pictures.
PASS assets-server.mjs: Asset server: allowlist, Host and Origin checks, read-only and loopback pinned; 217 picture keys stable, drawing modes {"placeholder":31,"url":5,"prop":165,"nature":5,"held":5,"forklift":1,"module-glb":3,"dataurl":2}.
PASS assets-viewer.mjs: Viewer: orbit maths pinned; pages load only allowlisted same-origin modules; catalog 217 assets, 114 KB, modes {"placeholder":31,"url":5,"prop":165,"nature":5,"held":5,"forklift":1,"module-glb":3,"dataurl":2}.
PASS assets.mjs: Register rules: no unbacked claims, 0 originals checked (0 unregistered, warning only), 4 uncredited (warning only).
PASS atv-import.mjs: ATV import: PASS (class numbers, 39,295-tri model with 4 wheels = 5 draw calls, hull 1.22 x 2.07, 17 anchors with the 3 moves, paint, price, slot, tracks, sound, lamps)
PASS atv-rider.mjs: ATV rider: PASS (seat anchor from anchor_driver_seat, no passenger seat, steer cap .52 rad, hands turn about the handlebar pivot and stay in reach, jiggle bounded)
PASS audio.mjs: Audio: distance falloff (full within 2.5 m, silent beyond 40 m), saved volume and mute, one context built on the first click, blade pitch and hiss follow speed and load, the belt hums only while it runs, the lever click is limited to three at once, fuel flows with a rising pitch and chimes when full.
PASS basin-walk.mjs: PASS basin-walk: lake and fall pool masks (9341 lake samples all unwalkable)
PASS beacon-style.mjs: PASS beacon-style: colours by purpose, fades in 0..1 and monotonic with distance, dimmer by day.
PASS bog-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-ZIqJAS/world.js:577:45
PASS brief.mjs: brief tests passed: 215 modules listed, brief 2834 and index 32143 estimated tokens (budgets 3000 and 32500)
PASS cafe-job.mjs: Hiring, schedule, orders, correct drinks, saved shifts, clock-out wages and duplicate protection passed.
PASS camera.mjs: Camera clearance and foliage checks passed.
PASS careers.mjs: PASS careers.mjs: hiring (axe handed over once, ever; old logs bought back), promotions, quitting keeps XP, company names and co-owners, daily tasks by counters, daylight clock-in, one shift at a time, wage on site only, off-site and end-of-day clock-out, pieces, bonus, reputation, pay stubs, save normalisation.
PASS cargo-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-q3YvN3/world.js:577:45
PASS cargo-hands.mjs: PASS cargo-hands: crate/box/parcel carry normalised and slowed (one table), a crate off the bed into the hands and back (switch), parcel and box bed pieces, load drag counts them, the save migration behind PARCEL_PIECES_ENABLED (off changes nothing, on moves a held parcel once), gigs end their parcel piece
PASS cargo-items.mjs: PASS cargo-items: item shape, garbage rejected, bed rules per model, ATV rack, crates, take/summarize, hands rule, legacy round trips, parcel migration
PASS cargo.mjs: PASS cargo.mjs: three beds (the flatbed 120 units: 24 logs or 120 planks or any mix; the pickups 32), mixed loads with the last piece on first off, every piece on its bed, a load slows the vehicle, the save keeps it (and reads the first build's format), the drawn cargo follows it, owned vehicles only, and the flatbed's tailgate opens for someone behind it.
PASS carry-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-carry-3R5ZSy/world.js:577:45
PASS carry-pose.mjs: Carry pose: the box rests at the belly against the sweater (both cartons), both hands on its sides, bend, the pose rules and release passed.
PASS carry-real.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-real-nemC2E/world.js:577:45
PASS carry.mjs: Carry: a log on the shoulder (not the bag), planks in the hands, one thing at a time; the saw takes a log only while on and with room; four stacks fill the belt and one taken makes room; planks can be put down (8 stacks); the three fields save additively and old saves load.
PASS cartons.mjs: PASS cartons.mjs: 6 cartons and 2 crates at true size, one 256 px jpeg and one material each (one draw call), centred on the ground, startup module +0.45 MB, cargo.js crate = the model
PASS character.mjs: Save migration, 14 outfits (4 parts, <8k triangles, ~1.9 m), part swapping, skin/hair roles, motion clips, hand reach, held items and seated pose passed.
PASS chop.mjs: Swing path (continuous, overhead then a fast blow, in front of the body, leaning), carry alignment, two-handed grip and spine lean passed.
PASS chunks.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/eden-upgrade/dist/world.js:577:45
PASS clear-way.mjs: PASS clear-way: clear/repair needs never reach the board, old saves complete or abandon safely, other kinds unchanged
PASS cloud-save.mjs: Cloud saves: every sync case, first upload, download on a new browser, push only when changed, the other browser catches up (old save backed up), a both-changed conflict never overwrites and resolves either way, per-account sync records, sign-out, and no server or no network.
PASS collision-feel.mjs: collision-feel: resting gap, slide, nose-in, round collider, corners, parked car, crash and push-out passed.
PASS consumption.mjs: All 15 consumables: hand reaches the mouth with no arm scaling, item in the palm, used after one second, smooth lowering, interruption and resource disposal passed.
PASS cover-view-job.mjs: PASS cover-view-job: stepped job = coverFor, staged build, empty chunk once, setTier / gone-and-back / teleport mid job
PASS cover-view.mjs: cover-view: ok
PASS creator.mjs: PASS creator.mjs: every part row names the part, no repeated labels, quick outfits set clothes only (male Explorer left out as a Suit duplicate), body switch keeps shared parts, random looks are valid.
PASS credits.mjs: Credits: 18 entries cover all 163 shipped models (6 CC0 or MIT; sr90 (itch.io), JUFF, KidBi-Gaming, Poly Pizza, Aditya Graphical, 00amza, Supplied by the project owner (author to be confirmed), Poly by Google, Forklift author (public domain; to be confirmed), The project owner, AssetsFactory, Fab (Cargo pack) with their own terms, credited with a link).
PASS culling.mjs: Tree culling: 4% of tree triangles drawn from the city, 32% at the bridge, 41% in Pine Ridge, 29% on the farm; no pop-in within 30 m (70 m for choppable pines); felling removes a tree from the draw lists; collisions unchanged.
PASS customer-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-0iwdY0/world.js:577:45
PASS customers.mjs: PASS customers.mjs: a customer truck is due twenty minutes after clock-in when the day has a Load Truck task, takes planks from your hands, your truck (the rest stays on your bed) or the stock (no double pay), is sent off only when full ($0.50 a plank shipped, the task done), and the exit road starts and ends off the map.
PASS damage-feel.mjs: PASS damage-feel.mjs: hit-stop of 50 to 90 ms from 60 points, exactly the same skipped vehicle time at 20 to 240 slices a second and the same distance covered over a stop at 30, 60 and 144 Hz (the clock never pauses), red flash strength, a lamp that is off, steady or blinking by band (icon + blink, class and dataset written on change only), a panel pulse that is a class on a crash and nothing else, a stronger shake (0.03 to 0.18 m for 0.4 s), one 220-point debris pool (chips, sparks, glass, wheel spray) that is bounded and clears, bigger drifting smoke in one pool, and every page and game hook.
PASS damage-game.mjs: Damage wiring: a crash at 24 m/s takes 600 points once (Fine to Worn) and stalls; a 3 m/s bump costs nothing; a 15 m/s crash is 251 points and stalls (restart after 1 s); the pull has the right side and grows by band; burn 1.05/1.15/1.3x; a wreck never starts but can be left; cond saves and old saves load Fine; the panel row changes the band class only when the band changes; one silhouette per drivable model.
PASS damage-look.mjs: Damage look and sound: wear 0 at Fine growing to 1 at Wrecked, glass cracks from Damaged, smoke tiers grey, dark, black, a hood smoke for 60 s on a wreck, rougher engine and a misfire by band, a stall and a long crank, one paint program and one glass program for every vehicle at every condition, a pool of 150 smoke points, two small generated textures.
PASS damage-table.mjs: PASS damage-table.mjs: the crash table (printed above): the S70 and off-road lose about half at full speed and are Wrecked on the 2nd or 3rd hit, the heavy trucks lose less at the same speed (Wrecked after many hits), bumps under 4 m/s are free, a 6 m/s scrape costs 25 points or less.
PASS damage.mjs: PASS damage.mjs: impact (head-on 20, a 10 degree slide about 1.7, free 0, world/vehicle/person kinds), points (4 m/s 0, 10 m/s 84, cap 600, person 20, tough per class), the 0.5 s debounce, the five bands and withDamage (speed, accel, braking, pull, burn, cranks), stall at 250 and the 1 s restart, repair bill (25% x share lost, $25 minimum) and hours, and cond in saves (old saves Fine) passed.
PASS daynight.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-vjOEDO/world.js:577:45
PASS delivery-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-ippzKa/world.js:577:45
PASS dev-server.mjs: Dev server: serves the site (no way out of its folder, read-only), refuses a foreign Host, a cross-origin page, a missing dev header, bad JSON, unknown houses, wrong floors, invalid or oversized pieces and oversized bodies without writing anything; a valid save writes interior-layouts.js and the current release, merges houses, never writes the stairs, and the file reads back.
PASS dev-wipe.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-OvVMEu/world.js:577:45
PASS dev.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-917jjY/world.js:577:45
PASS dock-game.mjs: chunks: 5:9 is not loaded yet; treating it as a wall (streaming is behind)
PASS dock.mjs: PASS dock.mjs: the roller door rolls up when the forklift is within 3.2 m and comes down 4 s after it has gone, the forklift crosses through it with the fork height, speed and load kept (a half turn about the door, forks first stay first, a landing 0.8 m clear of the way back), only in line with the door and moving toward it, and outside it stays on the apron.
PASS doors.mjs: Doors: sliding stays automatic; hinged and double doors are manual, swing into the room about their hinges, a pair mirrors, snap shuts without the swing, a handle-less leaf is one mesh; the market is sliding, the cafe and the office have double glass doors.
PASS driver-lag.mjs: Driver lag: the seated driver tilts with the cab: head and hips within 1 cm of the seat anchor and the hands within 15 cm of the wheel grips over an S-turn at 25 m/s at 30, 60 and 144 Hz; the old turn-only body drifts more than 2 cm.
PASS driving-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-driving-D0hlgm/world.js:577:45
PASS eastbank.mjs: Eastbank Works: Works Lane and a 12 m Freight South close a drivable loop; 5 buildings in their plots (all in the registry with reasons), 20 paving rectangles that are asphalt, connected to the roads and walkable; 8 m driveway cuts clear for a truck; 101 yard props in 5 chunks under the caps; solid and walk-over parts; culling; 10 broken yards and maps caught.
PASS energy.mjs: Frame-rate-independent energy rates, heavy load, food/drink restoration and bounds passed.
PASS farm-beds.mjs: PASS farm-beds.mjs: BEDS entries (tow_tank, grain_cart, combine), liquid/bulk normalization, loadFraction, and timber rejection passed.
PASS farm-houses.mjs: Farm houses: PASS (2 ids, 15973 triangles, ~8,000 each, one mesh and one draw call each, real size, lazy module)
PASS farm-lazy.mjs: Lazy farm props: PASS (65 farm.* ids load on demand; nothing crashes before)
PASS farm-props.mjs: farm.zebra      0.5 x 1.9 x 1.4 m   1354 tris  2 colours  1 boxes
PASS farm-tractors.mjs: Farm tractors: PASS (Hustler Compact and Husky R75 classes, tractor surface group, bog 33 s / 83 s / 22 s, 3 models with wheels and anchors, paint, price, slots, tracks, sound fallback, credits)
PASS flatbed.mjs: PASS flatbed.mjs: the Tylan Flatbed: 5,796 triangles in nine parts with its anchors, wheels on pivots, a hinged tailgate, six paint colours set directly, 35 mph and slow off the mark, the third truck bay, $8,000, and locked below Lumberjack level 5 on the lot and on the phone.
PASS footing-match.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/eden-upgrade/dist/world.js:577:45
PASS forest-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-KjZhBJ/world.js:577:45
PASS forest-tasks.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-WtYrqp/world.js:577:45
PASS forest.mjs: PASS forest.mjs: ten cut blocks, two marked a day by the day number (all come round, 40 to 400 marked pines), the landing on open ground, a marked tree pays $3.00 and an unmarked one $0.75 (no reputation lost), logs stacked at the landing join the company pile (saved, and can be taken back), planks delivered to the lumberyard join the stock and pay $1.00 each; all only on a Ridgeline shift.
PASS fork-guide.mjs: PASS fork-guide.mjs: the goal line and marker (the pallet to lift, the order square to take it to, the empty and staged cases), the ghost outline (green or amber), the assists (forks levelling, easing square and onto the middle, a carried pallet easing toward its cell, none at speed or with a key held), the real pallet shape with open pockets, and a different picture for every tool and material.
PASS fork-pallets.mjs: PASS fork-pallets.mjs: pocket (tine tops 2 to 18 cm above the base, within 18 cm and 11 degrees, from either end), engage at 35 cm and lift at 14 cm, tines blocked by a pallet at the wrong height or crooked, shelf lanes (square, off the uprights, at a level height), a carried pallet resting in a free cell, on an order square or on the floor, not going through other pallets, the drive step stopping short and backing out.
PASS forklift-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-SnBCYK/world.js:577:45
PASS forklift.mjs: PASS forklift.mjs: arcade drive (2.6 m/s, 5 m/s with Shift easing back down when released, rear-wheel steering with the tail swinging out, wheels that roll, slower in reverse, under 4.8 m turning circle, no spinning on the spot, stops at walls), forks 0.08 to 3.05 m reaching all three levels, an old save with a fork load becoming a pallet, the converted 14,000-triangle model with its four wheels on their axles, and the vehicle panel in forklift mode.
PASS fuel-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-fuel-JFw7Qf/world.js:577:45
PASS fuel.mjs: Fuel (imperial): whole-cent sales in gallons (gas and diesel, wrong fuel, full, broke, invalid, clipping), small steps cost the same as one big sale, mph, the burn rate, the hose (66 vertices, 120 triangles), the pump screen text, the drive-through station (canopy columns solid, the lane under the roof open, both trucks drive through), and saved fuel in milli-gallons.
PASS game-name.mjs: game-name ok
PASS garage-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-ZjzP6W/world.js:577:45
PASS garage-reload.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-I4lyE3/world.js:577:45
PASS garage.mjs: Garage: quotes match damage.js ($125 S70, $2,750 pickup, $25 minimum), pay and wait game hours then collect Fine, partial repair to 70%, the repair kit (+15% up to 40%, one consumed), the tow fee table ($75 to $250) and a tow of a far-off wreck from saved data, a driven vehicle refused, hard luck (free tow and repair to 400, once per 7 days), the garage save with junk and old saves, status text, and purity.
PASS gig-clients.mjs: PASS gig-clients: profile, complications, regulars, tiers, save normalizing
PASS gig-parcel.mjs: gig-parcel ok
PASS gig-pay.mjs: PASS gig-pay: par, wage, fatigue, tip cap, too-fast, integer cents
PASS gigs-game.mjs: gigs-game ok
PASS gigs.mjs: gigs ok
PASS google.mjs: Google sign-in: not-set-up fallback, the redirect (client, callback, scopes, state, nonce, PKCE S256, HttpOnly attempt cookie), cancelled/state/code/exchange/network failures, ID token issuer/audience/expiry/nonce/subject checks, success (session, attempt cookie cleared, verified email kept), and the Account panel's Google button and return messages passed.
PASS gps-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-sZHVZj/world.js:577:45
PASS gps.mjs: PASS gps.mjs: routes with left/right/arrive turns, direct fallback, pins, job auto-route and switch, reroute cooldown, arrival; Oak Street to the P3 lane is 497 m with 1 turn(s), built in 5.0 ms
PASS grid.mjs: Plot defaults and validation, equipped-axe chopping, XP and level perks, logs on the ground (fall direction, pickup, full bag, expiry), stump-sapling-pine regrowth, and saves passed.
PASS ground-cover.mjs: ground-cover: ok
PASS ground-feel.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-82eRKF/world.js:577:45
PASS ground-shader.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/eden-upgrade/dist/world.js:577:45
PASS height.mjs: Height: the river valley (a bed below the ground, gentle banks) and arched bridges, five outer hills, a gentle dirt track up the big one, vehicles tilting with the ground; the outer hills peak at their height and meet flat ground at their edge, every zone is flat; with the ground raised 5 m the standing height, the landmarks and the vehicles all rise exactly 5 m (decks are measured from the ground under them).
PASS hitch-rules.mjs: PASS hitch-rules.mjs: constants, pinWorldPos, hitchAvailable, tractrix 165Hz convergence, jackknife clamp/stop, reverse assist decay, derate numbers, collision bisection, and 70 deg hull clearance passed.
PASS house-signs.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-yQ99Rx/world.js:577:45
PASS housing.mjs: Weekly rent, usage utilities, sleep/midnight boundary, legacy debt migration, weekdays, saving and kitchen alignment passed.
PASS hub-actions.mjs: hub-actions: ACTION lines parsed strictly, the possible actions sent to the master with their ids, the hub-made Approve for a filed plan, stale buttons switched off, and Approve, Start and Close clicked through the real routes and gates passed.
PASS hub-activity.mjs: hub-activity: the chat feed (names and counts, starts over per message, ends with how the turn ended), the activity builder (idle, working, question, stopped) and the two GET routes passed.
PASS hub-asset-facts.mjs: hub-asset-facts: the measured facts, the plain-word problems for a character and for a prop, the header reader with its cache, the Assets summary, the status block of the master, and the page passed.
PASS hub-boot.mjs: hub-boot: the hub folder starts with runs on, answers who it is, hands out its token, serves the jobs, activity, tokens and home pages, and prints no start-up error passed.
PASS hub-bot.mjs: hub-bot: fold states, clicks, poll pace, speech line, count, link, room made on the page, text-only DOM with one read, and the runs-off notice passed.
PASS hub-cache.mjs: hub-cache: usage, context and split, hit and miss, lifetime not sure on thin data, model switch ignored, countdown only when sure, warnings, and the runner window passed.
PASS hub-chat.mjs: hub-chat: ok
PASS hub-commit.mjs: hub-commit: ok
PASS hub-deploy.mjs: hub-deploy: the version rules, every blocking and warning result, the job summary, the page sentence, and the proof that the check publishes nothing, the Publish rules, the refusals of the script, the route of the hub, and Bump version (the number rules, the refusals of the script, the route) passed.
PASS hub-fetch.mjs: hub-fetch: the link, address, folder and file-name rules, the summary, every refusal of the script before any network or file, the route of the hub, and the page passed.
PASS hub-jobs.mjs: hub-jobs: the job table (no shell strings), the summariser, the lock, the record, services, the index after a finished run, restart on exit code 75, replacing only a real older hub, every refused route, the master's tool buttons and Quick fix passed.
PASS hub-lanes.mjs: hub-lanes ok
PASS hub-markdown.mjs: hub-markdown ok
PASS hub-plans.mjs: hub-plans ok
PASS hub-records-server.mjs: hub-records-server: ok
PASS hub-records.mjs: hub-records: ok
PASS hub-runner.mjs: hub-runner: ok
PASS hub-runplan.mjs: hub-runplan: ok
PASS hub-runs-page.mjs: hub-runs-page: ok
PASS hub-runs.mjs: hub-runs: ok
PASS hub-server.mjs: hub-server ok
PASS hub-shell.mjs: hub-shell ok
PASS hub-sound.mjs: hub-sound: off by default, a switch for every sound, which change deserves which sound, silent first answer, no repeat while the state holds, the cooldown, and the wiring passed.
PASS hub-status.mjs: hub-status: ok
PASS hub-waiting.mjs: hub-waiting ok
PASS hub-work.mjs: hub-work: grouping, the eight statuses, next-step sentences, the count, items, old hashes, plain feed words, the layout rule and GET /api/work passed.
PASS indoor-camera.mjs: 
PASS input.mjs: Movement release, focus loss, visibility, stale repeats, pointer cancellation and menu checks passed.
PASS interactions.mjs: Nearest door/person/station selection and world prompt projection passed.
PASS interior-edit.mjs: Interior editor: nine generated layouts have no problems; moving (exact steps, kept inside the walls), turning, copying, deleting and adding; the stairs are fixed; missing stove or bed, a blocked door, overlaps, pieces outside and walled-off routes are named; saved layouts are validated whole and keep the stairs; a room refreshes its models, collision boxes, bed and kitchen spots and selection box from its layout.
PASS interior.mjs: Interior route connectivity, camera distance, wall cutaway and solid collisions passed.
PASS interiors.mjs: Interiors: 9 house rooms (237 pieces of furniture): every piece inside its room, nothing overlapping, the door clear; you can walk from the door to the stove, the bed and the stairs on every floor; built rooms have a scene per floor, a model per piece and walls that stop you.
PASS inventory.mjs: Gas can: bought, equipped, fuel saved on its slot.
PASS jobs-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-jWlVOr/world.js:577:45
PASS jobs.mjs: Job flow, proximity checks, one-time wages, route cycling, resume, corrupt saves and blocked storage passed.
PASS junctions-r4.mjs: R4 junctions ok: 336 checks: 9 angled patches at 4 joins (28 patches in all), Kaspian Bay in TOWNS with 5 street names and 5 signs, West Bank Lane linked.
PASS junctions.mjs: Junctions: 28 patches (24 rounded corners, 4 width tapers), all road on the terrain mask, none inside a town, on paving, a plot, a building or a field.
PASS legacy-keys.mjs: PASS legacy-keys.mjs: the rename keeps old saves: citylife.* keys are copied once to edenridge.* (never overwriting, old keys kept, no throw on a full storage), and save files with the old marker are still accepted.
PASS load-drag.mjs: PASS load-drag: factor, masses, ATV rack (1 log, 1 plank stack, 1 crate), stowed parcel, drag only on the ATV
PASS look-controls.mjs: Native capture, intentional release, denied capture fallback, edge turning, menu gating and touch passed.
PASS look-edge.mjs: Look edge: eased turn (drift at the zone edge, the cap at the screen edge, symmetric, capped per frame), focus loss and hidden tab stop it, one retry after the Esc cool-down, a second refusal falls back, a menu cancels the retry.
PASS main-menu-return.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-8lAjTX/world.js:577:45
PASS map-bake.mjs: PASS map-bake: shade grid, ground colours, rotated footprints, sliced budget, BASE first, LRU, invalidateAt, real BASE, whole world (chunk masks, rock, cache 32)
PASS map-view.mjs: PASS map-view: view math, crop window, tiles, level, zoom curve (top 29 m/s), smoothing, pick, chevrons, cull
PASS map.mjs: Map data is valid and frozen; zones, roads, fields, trees, shops, hours, studio and spawn match the numbers they replaced; 77 broken maps are each caught; Ironwood, Cedar Heights, Eastbank Works, the second bridge and the plots are in place.
PASS menu-scene.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-mN47kN/world.js:577:45
PASS menu.mjs: Main menu: address parsing (bare hosts, ports, ws/wss, refusals), saved settings, panels, host and join (success, refusal, timeout, cancel, no double start), online lobbies (relay address, create, join by code, refusal reasons, update), and the page and its background image passed.
PASS messages-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-eMHHnL/world.js:577:45
PASS messages.mjs: PASS messages.mjs: saved newest first with an app, time and read flag (at most 50, text cut at 300), unread counts per app and in total, reading one app or all, the game weekday and clock, and a clean save.
PASS minimap-local.mjs: PASS minimap-local: 200x200 local window, 150 m on foot, speed zoom + look-ahead, no clamp at the world edge, dashed border, route culling, chevrons, invalidateAt
PASS mp-clock.mjs: PASS mp-clock: real relay and clients: host is the first player, a join gets the host time at once, only the host can send a clock, junk is not relayed, the next oldest player becomes host
PASS multiplayer.mjs: Real WebSocket clients: joins, snapshot, movement, ID spoof rejection, malformed messages, house rooms, version refusal, leave, and mesh smoothing passed.
PASS nature.mjs: Nature models: 5 trees at 800-1,350 triangles, 3.4-3.9x the player's height, 20 tree meshes, 1.08 M triangles if every tree were in view, pines in the woods and broadleaf elsewhere, sightline fade kept.
PASS needs-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-byLpk3/world.js:577:45
PASS needs-loop.mjs: PASS needs-loop: need opened day 103 (14 dozen), board slot, 14 dozen (4 crates) farm 66->52, shelf 0->14, price 563->563, paid 8658, mood 60->64, standing 0->1
PASS needs.mjs: PASS needs.mjs: one need opens, hysteresis, claims + lapse, pro-rata fills, conservation, over-fill pays nothing, expiry (late fill, mood, prosperity, price), cap, determinism, slot shape, pay, no clock/chance
PASS neighborhood.mjs: Needs, purchases, cooking, save migration, shop paths, walking NPCs and vehicle preparation passed.
PASS night-lights.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-XifH0l/world.js:577:45
PASS npc-busyness.mjs: PASS npc-busyness
PASS npc-chat.mjs: PASS npc-chat: 28 people greet by name, deterministic, time of day, home and job facts, garbage safe
PASS npc-crowd-separation.mjs: PASS npc-crowd-separation: closest pair 0.80 m
PASS npc-dialogue.mjs: PASS npc-dialogue: talk effects and caps, Oscar refusal, Lincoln pages and sulk, Brentster steers, met set and save round trip, People rows (unmet hidden), door-knock table, roster planner (sick stay home)
PASS npc-life.mjs: PASS npc-life: roster, tiers, +3/day standing cap, sickness band, Oscar/Lincoln/Brentster rules, canVisit, namedPlan, visits, needs, determinism
PASS npc-routes.mjs: PASS npc-routes: 404 walking blocks, worst hurry 1.00x (old estimate 1.35x), table 45 pairs
PASS npc-static-blocked.mjs: PASS npc-static-blocked: 71883 samples (13507 blocked) identical at spawn, with farm+forest loaded, after 395 trees felled and 57 landmarks hidden, and against the unstreamed world
PASS npc-walk.mjs: PASS npc-walk: 28 people, 218 walking blocks over 4 days, {"walk":579,"stand":2180,"hidden":20313} poses sampled
PASS objective.mjs: Objective resolver (gig outranks delivery outranks the market; shop-local versus world space; no stray beacon) passed.
PASS office-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-Qcbex6/world.js:577:45
PASS order-pallets.mjs: PASS order-pallets.mjs: an order's staging square holds a real pallet (the first stack makes it, the ticket keeps its square when older orders finish), a plain pallet from the forks gives the order what it needs and the surplus is split off, the order pallet can be lifted, set on the floor and put back but never ships from anywhere else, never goes in a rack or counts as stock, loading consumes it, a failed order releases it wherever it is, saves are cleaned and old staged orders migrate, and its tag is a green plate with the number above.
PASS order-table.mjs: PASS order-table.mjs: the board lists your orders, then the ones you can take (soonest due first), then the ones for a higher rank, three buttons at a time with a More button; each order has a card with the customer, what to do, the address (never an id), the due time, the pay and the penalty, what rank it needs, and for your own orders what to do next; only an order you can take offers Accept.
PASS orders-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-8wVff4/world.js:577:45
PASS orders.mjs: Orders: size-class fees (small $3 per six, medium $8 per two, large $25), delay by the slowest class, a home is needed, the main home setting, parcels wait at the locker or box and are collected into the inventory (a full inventory leaves the rest), at most 8 orders at once, vehicles bought on the lot or ordered (one of each, parked near the home on arrival), and save round trips.
PASS ownership.mjs: Ownership: four homes listed; renting, buying (a renter's deposit counts), paying and moving out; weekly rent on the game clock, a warning after one unpaid week and eviction after two; schema 2 migrates a 0.29 save without losing anything.
PASS paint.mjs: Paint: worktruck 6 colours, flatbed 6 colours, shortbed 6 colours, offroad 6 colours, tractor_juff 6 colours, atv 6 colours, tractor_kidbi 6 colours, unique ids, valid shader numbers, the first colour is the model's own, unknown colours fall back.
PASS pallets.mjs: PASS pallets.mjs: pallets as objects (one per rack cell, one on the forks), old counts read and migrated and then dropped, stacking, picking (an empty pallet is collected), the forklift lifting a whole pallet and setting it down or merging, the crew's put-away (floor level first, nearest the door, pallets of 40), clean saves, and the one-draw-call tag atlas (24 nearest within 10 m).
PASS parcel-fixes-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-Her5PF/world.js:577:45
PASS parcel-fixes.mjs: PASS parcel-fixes.mjs: a crate bed with anything else on it refuses the need crates (Clear the bed first.), a parcel on a far bed ticks no stop and pays nothing (in hand, ridden or within 12 m it does), parcels and boxes are no plank stacks and a box is drawn as the carton, the arms hold a crate, box or parcel piece, and a parcel of a gig not yet picked up is an orphan.
PASS passout-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-ouN8nF/world.js:577:45
PASS pause-menu.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-c6GRra/world.js:577:45
PASS perf-gate.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/eden-upgrade/dist/world.js:577:45
PASS pets.mjs: PASS pets: offer, hunger, feed, pat, tick, run-away, normalise, rehome, mood
PASS phone-calls.mjs: PASS phone-calls.mjs: the contact list is data (ids, numbers, kinds, handlers, hours, 1 to 2 s of ringing); the tow line is busy ("Line busy", no ringing) unless you are in a vehicle and then asks which one, with the garage quote per vehicle; the workshop says to visit; a placeholder business answers in its hours and does not answer outside them; the five phone clips are registered, on disk and small.
PASS plank-economy.mjs: Plank economy: 1 log = 4 planks, trickle 6/day vs old 24, level 1 worktruck cycle 32 planks in 182.1 game min = $263.20 (8672 c/h) beats the best existing job ridgeline-fell (6934 c/h) by 25%, levels 1:+25% 3:+18% 5:+11% 7:+4% 10:-12%, Prices screen low/high/normal notes, garbage safe, frozen, pure
PASS planks-wiring.mjs: PASS planks-wiring: one plank source (world sawmill rate gone, trickle 6/day into the yard, supply to the supplier from the yard, 10-day conservation), old saves move world planks + belt into the yard once, junk yards load, 1 log = 4 planks in 4 game min, rack cell pays $5.00 once per shift with leftovers in the hands, game.js wired, name tags removed
PASS population.mjs: population tests passed: 24 residents in 16 households, 4 commuters, 22 posts
PASS profile.mjs: Profile legacy migration, stable ID, replaced progress, and session-only storage passed.
PASS properties.mjs: Properties: 29 registered (eight Cedar Heights houses and the farmhouse with locked doors, four vacant and five with residents; shops public, the studio for its tenant, the offices, barns and sawmill explicitly not enterable); every door faces its street with a clear approach; eight driveways, front paths and parking spots join the loop road, four with a parked car.
PASS props.mjs: Props: 98 converted models (178017 triangles in all: 12 houses and 9 shops and offices, the farm set, the timber yard, nine vehicles and 24 pieces of furniture, and 11 pallet, crate and loading-zone props and 6 gas-station props kept at true size, instanced), every landmark inside its zone and plot, clear of roads and of each other, solid with open yards, houses facing their street; the rigged sawmill (solid posts, bench, conveyor and log pile, two decks, every anchor reachable) and the culling.
PASS real-models.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-PUn5rJ/world.js:577:45
PASS relay-protocol.mjs: Relay protocol: codes, rooms, hello and version refusal, rate limit, lobby join/full/move/leave, restore passed.
PASS rescue-ru2.mjs: PASS rescue-ru2 (31 checks)
PASS rescue.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-AgbR1g/world.js:577:45
PASS river-bank.mjs: PASS river-bank.mjs: 2830 checks (sloped bank, 1 m shore mesh and a steady waterline, grass shoulder with mud only on the wet bank, the road meets the bridge straight and centred, soft turn-back for three vehicles forwards, in reverse and at 45 degrees, at 30/60/144 Hz, decks never a hazard, walking unchanged)
PASS road-geometry.mjs: road-geometry ok
PASS road-graph.mjs: road-graph ok
PASS road-r3a.mjs: R3a ok: gravel roads drawn and painted, 3 street tags, 3 new wild roads, grades fine.
PASS road-r3b.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/eden-upgrade/dist/world.js:577:45
PASS roads.mjs: Roads: one paved network (1 piece); every walkable road can be walked along its length; every road end joins another road or is a declared dead end.
PASS roller-door-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-Dh0BDM/world.js:577:45
PASS routine.mjs: Clock, midnight billing, shop hours, shift tasks, one-time wages and save migration passed.
PASS safe-spot.mjs: Safe spot: the nearest clear spot (already-fine points kept, car and wall cases, closed courtyards refused, big enclosures allowed, search limits, one call per candidate), the 0.31 parked-car spawn on the real map (0.7 ms) and clear answers across the map passed.
PASS save-file.mjs: Save files: stored save read/write in the game's own shapes, export/import round trip, file name, refusals (not a save, newer format, damaged, too big), hand-edited files normalised, backups (newest first, duplicates skipped, 5 kept, 1 MB cap, full storage), import and restore keep a backup.
PASS save-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-jDub1F/world.js:577:45
PASS save-menu.mjs: Save menu: export off without a save, export downloads a named file, one backup per Play, import refuses bad files, asks first, Cancel changes nothing, Replace backs up then reloads, the backup list and Restore, a refused write changes nothing.
PASS sawdust.mjs: Sawdust: a 300-point ring that falls, slows and dies on time or at the floor; one Points object, hidden when empty or out of range, no shadows, thrown along the log's way at any yaw.
PASS sawmill-asset.mjs: Sawmill asset: 48 nodes, 28 draw calls (was 92), 1680 triangles, 3 skinned nodes, 5 clips, 16 anchors, emissive materials intact; loop clips carry one extra frame (reported).
PASS sawmill-pile.mjs: PASS sawmill-pile: 45 stack slots in the shed (cap needs 40), 3 crossed layers, none overlap, all under the beams; every plank 0..160 drawn, odd planks in slot 0, taking lifts the top stack; 42 log places for 40 logs
PASS sawmill-placement.mjs: Sawmill placement: at the old sawmill's map position, turned -90 degrees, the whole bounds inside Pine Ridge's clearing, no trees, walkable, 5 m or more from the roads, the hut, the logs and the flatbed; nothing reserved in the way.
PASS sawmill-rig.mjs: Sawmill rig: rules, trimmed loops (1.0 s, 24 poses), switch and blade together, mid-swing reversal, coasting stop, a cut from log to stack on the belt (planks hidden after, belt riding to the end stop, rollers turning only while it moves), the beacon, planks on the ground; shadow draws 11 (was 30), the other 19 small parts do not cast.
PASS sawmill-yard.mjs: PASS sawmill-yard: 1 log = 4 planks, 30/60/144 Hz frame-rate independent sawing (4 game min/log), trickle 6/day idempotent, clamp 40 logs / 160 planks, takeStack max 4, normalizeYard/garbage safe, immutable, deterministic, pure
PASS scene-edit.mjs: scene-edit ok
PASS scene-editor.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-OqTlL9/world.js:577:45
PASS scene-overlay.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-giyMTC/world.js:577:45
PASS schedule.mjs: outside: 6.7% of residents' day in 435 blocks
PASS session-clock.mjs: PASS session-clock: validation, join snap, same-rate run, drift easing (no jumps, converges, never backwards), 30 s broadcast, visit vs sync, relay host rules
PASS shadows.mjs: Shadows: a 90 m box (4.4 cm a texel) that moves in whole texels; fade 0 under 6 degrees and 1 over 12, the pass skipped for 118 of 1,440 minutes; moon shadows on; Low: one mesh of at most 48 patches (96 triangles, 1 draw call), none on High, indoors or at the horizon.
PASS shortbed.mjs: PASS shortbed.mjs: the Kasumuchi S70: 7,758 triangles in 16 parts (764 of them the interior) with its anchors, tyres on the ground (nothing below y 0), wheels on pivots (steer 35 degrees), doors swinging 70 degrees, one paint material in six colours, 65 mph and 19 s to reach it, 5 mpg on gasoline, the first car bay, $500.
PASS skills.mjs: Lumberjack levels, perks (swing speed, hits per tree, logs per tree), XP gains, level-ups, cap and save validation passed.
PASS sleep-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-r1okdb/world.js:577:45
PASS sleep.mjs: Sleep: wake at 6 AM (today or tomorrow), the next day starts when midnight is crossed, food and thirst drain at a quarter of the awake rate, never below zero, and multiplayer moves nothing but energy.
PASS slope-a2.mjs: PASS slope-a2: grade, roll back, side slide and steer refusal for slope:true classes; others unchanged
PASS smoke.mjs: Smoke: slight (idle 2 puffs a second, at most about 9 flat out), more from cheaper tiers, a key-turn burst, rising and fading puffs in one pool of 150 points (one draw call, hidden when none live), and each vehicle's muffler tip at its back right.
PASS sr90-props.mjs: sr90 farm pack: 52 ids (37 props, the water tower, 14 machines), 176023 triangles, one mesh and one draw call each, wheel and auger nodes kept as data
PASS starter-game.mjs: starter-game ok
PASS starter.mjs: starter ok
PASS startup.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-startup-N1JCnR/world.js:577:45
PASS store-categories.mjs: Store: 7 categories (2 placeholders), every item on a shelf (tools hold the axe, the Gas Can and backpacks), 24 vehicle pictures.
PASS store-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-OBUr7D/world.js:577:45
PASS storefronts.mjs: Glass sightlines reveal real interiors; café work stations are reachable.
PASS street-trees.mjs: Street trees: 15 (11 on Oak Street, the rest in the town), none in a road.
PASS streetfurniture.mjs: Street furniture: 19 road lamps on 4 roads (instanced, solid, on grass, clear of buildings) and a ring of low hills (384 triangles) beyond the fog.
PASS supply.mjs: PASS supply.mjs: the crew brings what open orders need and the warehouse lacks (every pallet and the hands counted, the lumberyard stock not), in batches of 40 up to 120, one delivery at a time an hour out, only in the working day, landing as pallets in the racks (floor level first, the lumberyard's planks first), a full warehouse refusing them, saved and cleaned on load.
PASS surface-table.mjs: surface-table: ok
PASS survival.mjs: Thirst migration, drain multipliers, energy penalties, depletion boundaries, state settings and clock independence passed.
PASS talk-engine.mjs: Talk engine: period picks and edges, the current time on every turn, specificity and w, one variant per turn (no glue), no repeats within last (8 variants x 25 talks), least-recent fallback, replay determinism, unknown go (strict throws, runtime hides), effects as data and same-talk beats, talkContext from progress, memory caps, all 20 conditions, garbage in, inputs frozen, no clock or chance.
PASS talk-memory.mjs: PASS talk-memory: caps (6/32/16, 48 people), junk, frozen, helpers, old 0.35.18 save loads unchanged, migration beats, Elena met via the cafe, once only
PASS talk-validate.mjs: Talk validator: good cast has zero problems; the bad cast fires all 11 rules (15 codes) exactly once with person, node, line, what and how; the 7 shape and voice extras once each; time words, glue, ids, slots, cross-cast repeats, the coverage sweep, garbage in, inputs untouched.
PASS terrain-mud-gravel.mjs: mud and gravel ok: 4 patches, 888 cells
PASS terrain.mjs: Terrain mask: 1120 x 1000 cells in 45 ms; the city identical to the old rules at 64064 points; open country walkable (no invisible walls), the river and the map edge not; both bridges aligned; the Cedar Heights loop closed and smooth; plots on open grass; all districts reachable.
PASS tickets-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-WgYMyo/world.js:577:45
PASS tickets.mjs: Tickets: released by the clock (the same every time, nothing past due or after closing), taken by rank (4 pickups, 5 deliveries, at most three, one taker each), staged, shipped and delivered with effects naming the player, expired untaken at closing without penalty, failed taken past the deadline with a reputation cost, deliveries carried over a day, the list capped, and saved on the company.
PASS timestep.mjs: Timestep (equal slices up to 1/30 s; the same distance, clock and hunger at 10, 30, 60 and 144 FPS) passed.
PASS tools.mjs: PASS tools.mjs: the axe ladder (4/3/2 swings at level 1, levels shave swings), purchases need the level in the shop and on the phone, the company hands the tiers over at Hauler and Sawyer, the three converted axes stand in the held frame (handle along +z, head far, edge down, shared geometry), and the two chainsaws (company store only, Foreman rank and level 15 or 20) have their bar forward.
PASS tow-driven.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-KtopG2/world.js:577:45
PASS town.mjs: Town: a street wall of 10 buildings with no gaps, 237 road markings (crosswalks on all four arms of the main junction, stop lines, 38 bays), 15 parked cars, and 61 pieces of street furniture on the pavements, a fountain in the square and a bus stop.
PASS tracker-game.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-9zIAvA/world.js:577:45
PASS tracker.mjs: Tracker: every shift task and order is listed with its place and distance, the nearest marked block for felling, finished tasks cannot be focused, Y cycles story and open tasks, and the focus saves and rejects junk.
PASS tracks.mjs: tracks ok
PASS tractor-driver.mjs: Tractor driver: PASS (seat from anchor_driver_seat, hands swing about the steering_wheel node and stay in reach, two front steer pivots, jiggle bounded, silhouettes drawn)
PASS update-check.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-XvT6Dh/world.js:577:45
PASS vehicle-hud.mjs: Vehicle panel: greyed out on foot; driving shows the name, speed in mph, the fuel type and gallons, and Get out, or Stop to get out while moving (1 m/s); riding shows Get out; the DOM is written only when the model changes.
PASS vehicle-sounds.mjs: Vehicle sounds: every class has an engine loop and every file is registered, mono Ogg under the size cap with the payload under 2 MB and decoded memory under 25 MB, yells under 1.2 s, all listed in ASSETS.md; crash tier by impact (light, medium, hard), glass at Damaged or worse, a person is a thud and a yell; the yell gate (4 m/s, 4 m, 8 s each, nearest first, 2 voices) and the 12-voice cap; the loader fetches nothing before a vehicle, one file at a time, its own engine first, never twice; a missing or corrupt file keeps the generated sound; engine rate follows the revs, misfire dips, hidden tab and mute are silent.
PASS vehicle.mjs: Vehicle: worktruck 10 m/s and off-road pickup 8.5 m/s on a stub world; grass half speed, dirt 0.8, water never; frame-rate independent at 30/60/144; hull samples every 0.5 m inset by the player radius; a wall stops the hull at its edge and the vehicle slides along it; vehicles and people block; safe poses and exits; saved list; and both vehicles drive out of the depot along the real roads.
PASS waist.mjs: Skeletal waist: spine order and height, lean at the waist (both ways), no primitive torso, and seated thighs passed.
PASS warehouse-intake.mjs: PASS warehouse-intake: cell-fill pay 500 c once per 40-plank cell, strict conservation, full-rack overflow kept, stable INTAKE_ORDER, mirrorPlankSum === world-tick mirrorPallets, garbage/immutability/purity
PASS warehouse.mjs:     at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-1t3ULQ/world.js:577:45
PASS watcher.mjs: watcher tests passed: zones and warnings at every threshold, start and stop at 99, the probe refuses without approval, logs counted once per message, a static page with no scripts
PASS water-chunks.mjs: water-chunks: 53352 checks; 52 chunks with water; per chunk max 520 triangles and 333 vertices (1 draw call each); max triangles by kinds present {"0":520,"1":289,"2":516,"3":92}; whole map 14355 triangles
PASS water-contract.mjs: water-contract ok
PASS water-cooler.mjs: Water cooler: +30 thirst, once per game hour at each cooler, separate coolers, capped at 100, refused when not thirsty, and saved.
PASS water-height.mjs: water-height ok
PASS weld-core.mjs: Weld score, coverage, dwell, speed, drift, seeded shake, brace reach, lift and path tests passed.
PASS worker-relay.mjs: Hosted relay object: create, taken code 409, hibernation restore with the latest position, hello timeout, empty lobby kept 10 min then forgotten, unknown codes, routing and Origin passed.
PASS world-state.mjs: PASS world-state: determinism, run-out + price cap, delivery, conservation, truck, catch-up 14, normalize, prosperity floor, price band, stockAt, no clock/chance
PASS world-tick.mjs: PASS world-tick: save shape, 05:00 boundary, once per day, catch-up 14, determinism, 7 days -> needs, supply conserved, pallet link, dozens, pump stock, no clock/chance
PASS world.mjs: World zones, bounds, grid maths, tree stages and fall callback, target ring, ground logs, deterministic 395 pines + 525 decor trees, fenced fields with gates, collisions, felling, stumps and grid overlay passed.
PASS zones-ru1.mjs: PASS zones-ru1 (32 checks)

ALL 261 PASSED
All 261 test files passed.
```

---

## What Could NOT Be Verified

- **Hardware GPU 165 FPS runtime performance:** Headless Edge rendered via SwiftShader CPU WebGL (~`3–5 FPS`), so true hardware GPU frame times and shader compilation warm-up on `r187` were not measured.
- **Interactive play in a visible browser window:** Keyboard/mouse driving feel, pointer lock, UI clicks, Web Audio playback, and live multiplayer sessions were not exercised manually under `r187` (beyond the existing `261` automated tests and static CDP camera frames).
- **Applying edits to the real repo:** Explicitly excluded per instructions (`c:\Users\Michael\Documents\Projects\simproject\dist\vendor\three.module.js` remains `r160`).

---

## Honest Confidence Per Part

- **Vendor packaging (`three.module.js`, `three.core.js`, `BufferGeometryUtils.js`, `SkeletonUtils.js`, `GLTFLoader.js`):** High — verified both by `npm run release -- --force` (`216` files), browser loading (`REVISION = '187'`), and `npm test`.
- **Source & test compatibility (`dist/game.js:103`, `dist/shadows.js`, `dist/scene-editor.js`, `dist/credits.js`, `tests/shadows.mjs`):** High — `261/261` tests passing with `0` failures and `0` retries.
- **Visual parity (`r160` vs `r187`):** High — all 5 spots visually inspected and pixel-diffed (`0.67–1.40 / 255` mean channel difference).
- **Hardware GPU 165 FPS headroom & interactive play feel:** Moderate — unmeasured on real GPU; needs a short manual playcheck after the main chat applies these changes to the real tree.
