michadr.

# WebGPU drawIndexed "Value is infinite" on lowering quality, plus WebGPU hitches (read-only investigation, Opus)

No files edited except this report. No git, no release, no tests run.

Note on "live" code: `dist/releases/0.36.0/game.js:1179` already contains `if(tslKit())world.rebuildGroundTSL(high);`, and `dist/releases/0.36.0/world.js` has `rebuildGroundTSL` too. So the 0.36.0 folder has been rebuilt since deploy (a 0.36.1 folder exists as well). That does not affect the main finding below: the bug is in `shadows.js` / `tsl-shadows.js`, and it is the same in 0.35.22, 0.36.0, 0.36.1 and the current `dist/`.

## Problem 1: the crash. Ranked hypotheses

### H1 (very high confidence): blob shadows, an InstancedMesh built on an InstancedBufferGeometry whose `instanceCount` stays at its default of Infinity

Evidence:
- `dist/tsl-shadows.js:53`: `const geometry = new THREE.InstancedBufferGeometry();`. `instanceCount` is never set, so it keeps the three.js default of `Infinity` (`dist/vendor/three.core.js:49330`). Line 62 wraps it in `new THREE.InstancedMesh(geometry, material, capacity)`, and line 64 sets `blobs.count = 0`.
- The WebGL fallback is the same: `dist/shadows.js:42` (InstancedBufferGeometry) and `:47` (InstancedMesh). `writeBlobs` sets only `blobs.count = list.length` (`shadows.js:67`) and never touches `geometry.instanceCount`.
- In the r187 WebGPU path, `RenderObject.getDrawParameters` (`dist/vendor/three.webgpu.js:5871-5877`) checks `geometry.isInstancedBufferGeometry` **first** and takes `geometry.instanceCount` (Infinity). It ignores `object.count` and does not clamp. That value goes straight into `passEncoderGPU.drawIndexed(indexCount, instanceCount, ...)` (`three.webgpu.js:50784`). WebIDL rejects Infinity for `unsigned long`, which gives exactly the reported error.
- In the WebGL path, `three.module.js:17164-17166` checks `object.isInstancedMesh` **first** and uses `object.count`, so the same mesh works there. That is why `?webgpu=0` never crashes.
- The patches only draw at Low quality: `game.js:1865` calls `shadows.update({..., low: mainMenu.settings.quality!=='high', ...})`, and `shadow-rules.js:39` has `blobsShown = !!low && !!outdoors && opacity > BLOB.showFrom`. `shadows.js:83` then sets `blobs.visible = show && shown > 0`. On High the mesh is never visible, so it never draws. On the first outdoor frame after switching to Low it draws with instanceCount = Infinity and the frame throws.
- I found no other InstancedBufferGeometry in the live code that could do this. `night-lights.js:59/63/149` is the only other one: it is a plain `THREE.Mesh` whose `instanceCount` is always set to `lamps.length + vehicleSprites` (finite, and 0 makes three skip the draw).

Predictions you can check: it crashes only **outdoors** while the sky is bright enough (daytime, or moonlight above `BLOB.showFrom`). Lowering quality inside a shop or room should not crash until you walk outside. Starting the game with quality already set to Low on WebGPU should also crash on the first outdoor frame.

Fix (two small edits; neither file is on the forbidden list, so whichever lane owns them can apply it):
- `dist/tsl-shadows.js`, `createBlobMeshTSL`, line 53: change `new THREE.InstancedBufferGeometry()` to `new THREE.BufferGeometry()`. The per-instance `aBox` stays an `InstancedBufferAttribute`, which works on a plain BufferGeometry under an InstancedMesh; ground-cover-view.js:45-46 already does exactly this. WebGPU then uses `Math.max(0, object.count)`, the same as WebGL.
- `dist/shadows.js`, `createShadows`, line 42: make the same change (`new THREE.InstancedBufferGeometry()` to `new THREE.BufferGeometry()`) so both paths match.
- If you would rather keep InstancedBufferGeometry: in `shadows.js` `writeBlobs` (line 67) add `geometry.instanceCount=list.length;` next to `blobs.count=list.length;`, and in `tsl-shadows.js` after line 55 add `geometry.instanceCount = 0;`. Changing the class is the more robust fix because it leaves nothing to forget.
- Nothing in game.js needs to change for this.

### H2 (low, ruled out as the cause of this error): ground cover counts at the low tier
- `ground-cover-rules.js:8`: low = `{..., kinds:['grass'], chunkCap:1500}`. Medium and high have finite caps too (6250 and 15000). Line 65: `room=Math.min(T.chunkCap, ...Infinity)`, so it is finite because chunkCap is finite. `coverReach` (line 48) is clamped by `COVER_FOG_CAP`, so it is finite for every kind and tier, including kinds that are not in the low list.
- `ground-cover-view.js:45-46`: each run makes `new THREE.InstancedMesh(plainBufferGeometryClone, mat, n)` with `n = run.to - run.from` (finite). The geometry is **not** an InstancedBufferGeometry, so WebGPU uses `object.count = n`.
- `setTier` (line 57) disposes every chunk and updates uniforms (`applyTierUniforms` reads `uKind` from the TSL uniforms, which exist: `tsl-cover.js:25,51`). It cannot produce Infinity.

### H3 (low, ruled out): drawRange
- `setDrawRange` calls: `world.js:558 (0,k*2)`, `night-lights.js:75/149`, `weld-game.js`. `getDrawParameters` clamps `lastVertex` to the index/position count (`three.webgpu.js:5919`) and returns null when the count is Infinity (5923), so a drawRange can never reach `drawIndexed` as Infinity. A NaN drawRange would produce a NaN error, not "infinite".

### H4 (low): other InstancedMesh `.count` assignments
- cargo-view, forklift-view, marks, props, sawmill, eastbank, world.js:387/437/566/622, tsl-smoke, tsl-debris. All of them use plain geometry, with counts from list lengths or capacities, and none of them depend on quality. I did not trace every one of these to its source, but none changes when quality is lowered, so none fits the trigger.

### What lowering quality also does on WebGPU (it does not crash, but it is a big one-time stall)
`applyQuality` (`game.js:1179`) flips `renderer.shadowMap.enabled`, sets `needsUpdate` on **every** material (`scene.traverse`), changes the pixel ratio and calls `setSize`, rebuilds the TSL ground (`rebuildGroundTSL`), and drops all cover chunks. On WebGPU, `needsUpdate` plus the shadow-state change rebuild every node material's NodeBuilder and create new pipelines synchronously. That is a long freeze of a second or more, but not a crash.

## Most confident: H1
Every link in the chain is in the code: the default Infinity, the WebGPU-only branch order, the patches drawing only on Low, and the error text. It also explains why `?webgpu=0` is unaffected.

## 30-second check in the owner's browser
Open the game with `?debug` (needed for `window.__city`, `game.js:1872`), stand outdoors in daylight on High, and paste:

```js
(()=>{const bad=[];__city.scene.traverse(o=>{const g=o.geometry;if(!g||!(o.isMesh||o.isPoints||o.isLine||o.isSprite))return;const ic=g.isInstancedBufferGeometry?g.instanceCount:(o.count!==undefined?Math.max(0,o.count):1),dr=g.drawRange;if(!Number.isFinite(ic)||!Number.isFinite(dr.start)||Number.isNaN(dr.count))bad.push({name:o.name,type:o.type,geo:g.type,instanceCount:g.instanceCount,count:o.count,visible:o.visible,drawRange:dr.start+'+'+dr.count})});console.table(bad);return bad.length})()
```

Expected: one row, `blob-shadows`, `InstancedBufferGeometry`, `instanceCount: Infinity`, `visible: false`.

To prove it in place without a code change, paste this, then lower the quality. If the game keeps running with soft patches under people, H1 is confirmed:

```js
Object.defineProperty(__city.shadows.blobs.geometry,'instanceCount',{configurable:true,get(){return __city.shadows.blobs.count},set(){}})
```

## Proposed test (not written)
Extend `tests/tsl-shadows.mjs`. It already builds `createBlobMeshTSL` with the real `three.webgpu.js` at line 83. Add a copy of the WebGPU count rule:
`const ic = m => m.geometry.isInstancedBufferGeometry ? m.geometry.instanceCount : Math.max(0, m.count ?? 1);`
Then assert `Number.isFinite(ic(tslMesh.blobs))` both with `count = 0` and after `count = 5`, and assert that `ic(...)` equals `blobs.count`.

A broader version for `tests/webgpu-flag.mjs` / `webgpu-ground-quality.mjs`: after booting with the mock renderer, set quality to Low, run one frame outdoors with `shadows.update({low:true, ...})`, then traverse the scene with the same rule and fail on any visible drawable whose count is not finite. An even stronger option is to wrap the mock pass encoder's `drawIndexed`/`draw` so it throws when `!Number.isInteger(instanceCount)`.

## Problem 2: hitches on WebGPU only (ranked, lower confidence; none confirmed in a browser)

The root behaviour: on WebGPU, every **new** pipeline that is not prepared by `compileAsync` is built **synchronously** during `render()` (WGSL generation in JS, then createRenderPipeline; on Windows Dawn also compiles it to D3D12). The game warms up only once (`game.js:1840`: WebGPURenderer has no `compile`, so it runs `compileAsync(scene,camera)` plus `warmHidden`). `warmHidden` (`tsl-output.js:109-118`) only covers **hidden** meshes whose material name ends in `-tsl`. Anything that first appears, or first changes shader state, after that warm-up causes a stall.

1. **The player headlight SpotLight is added and removed at runtime** (`night-lights.js:116-118`). A change in light count changes the lights cache key of every lit material. On WebGPU that means a NodeBuilder rebuild and a new pipeline for every lit material, all synchronously. The code comment calls it "the hitch the user accepted", but that was measured on WebGL; on WebGPU it is much worse. It happens when the own vehicle's lights go on or off at dusk, at dawn, or when quality drops. Fix: create the SpotLight once at startup on High, keep it in the scene, and set `intensity=0` instead of `scene.remove`. Or on WebGPU skip the SpotLight entirely and rely on the beam decal. (File: night-lights.js `setSpot`.) Confidence: medium-high that this is a large hitch whenever it fires.
2. **Ground cover materials are created lazily, one per kind, after warm-up** (`ground-cover-view.js:31-32` `materialFor`, called from `meshRun`). The first chunk that contains a new kind (up to 11 kinds on High) builds a new node material and pipeline in that frame. Each chunk run also clones the geometry (`geoFor(kind).clone()`, line 45), so the full vertex and index data is uploaded again per chunk instead of shared. Fix: create all `materialFor(kind)` for the tier's kinds in `setAssets` and warm them with `renderer.compileAsync` on a dummy InstancedMesh. Share the base attributes instead of cloning them: build a new BufferGeometry and `setAttribute` the same BufferAttributes and index, adding only `aInst` per run. Confidence: medium.
3. **The lit window material and building emissive maps appear after warm-up.** `night-lights.js:96-97`: `cityLit` is a clone that no mesh uses until the first window lights at dusk, so it hits a first-sight pipeline build. `attach` (line 94) sets `needsUpdate` on each building material when its async mask texture arrives (adding an emissiveMap changes the shader). On WebGPU each of those means a node rebuild plus probably one new pipeline. Fix: give one hidden mesh `cityLit` at startup so the warm-up compiles it, and run `renderer.compileAsync` on the affected buildings after the masks arrive. Confidence: medium-low.
4. **Effects that are hidden but are not `-tsl` NodeMaterials** are skipped by `warmHidden`: any WebGL-style material (MeshStandardMaterial and similar) on a hidden or not-yet-added object, such as interiors, cargo and vehicles that are added later, NPCs or remote players spawned later (`character.js` clones materials, line 25), and the item models in the hand. On WebGPU, three converts each new material instance to a node material on first sight. Pipelines are shared when the cache key matches, but the first instance of each look still stalls. Fix: after a new model type is added, call `renderer.compileAsync(obj, camera, scene)` before it is first visible, for example from a small `warmObject` helper in render-backend.js. Confidence: medium-low (generic).
5. **Quality or shadow toggles** (`game.js:1179`, `:1893` dev `setShadows`): `needsUpdate` on every material plus a shadowMap flip triggers a full rebuild. This happens only when the user does it. Fix (game.js lane): drop the blanket `scene.traverse(...needsUpdate)` on the WebGPU path, since node materials pick up the shadow state through the render-object cache key without it, or follow it with `renderer.compileAsync(scene,camera)` behind a short "applying" overlay. Confidence: high that it stalls, but it is not the "normal gameplay" hitch.
6. **Minor per-frame allocations, the same on both backends**: `shadows.js:56-59` builds new arrays and objects every frame (only at Low), and `character.js:73-93` clones a Vector3/Quaternion per bone per call. These put pressure on the garbage collector and can cause small periodic GC pauses, but they are not WebGPU-specific.

I found no per-frame `material.needsUpdate` and no GPU readbacks (`readRenderTargetPixels`, `getImageData` on the frame path) in the release files I searched. I did not audit `npc-crowd.js` (currently being edited by Neo).

The quickest way to confirm the hitch cause in the browser: with `?debug`, run `const r=__city.renderer,o=r._pipelines?.getForRender; let n=0; r._pipelines.getForRender=function(...a){const t=performance.now(),x=o.apply(this,a),d=performance.now()-t; if(d>4)console.log('pipeline',(a[0].material?.name||a[0].material?.type),a[0].object?.name,d.toFixed(1)+'ms',++n); return x}`, then play until a hitch happens. The log names the material or object that was compiled. This relies on the private `renderer._pipelines` of r187, so it may need adjusting.

## What I could NOT verify
- No real WebGPU browser here. The H1 chain was confirmed by reading code, not by running it.
- I did not boot the mock-renderer tests or run any test.
- The hitch ranking is reasoning only. I did not measure any pipeline build times, and the snippet above relies on a private three.js field.
- The `dist/releases/0.36.0` folder seems to have been rebuilt after deploy (it contains `rebuildGroundTSL`), so it may not match the deployed bytes exactly. The blob-shadow code is identical in 0.35.22, 0.36.0, 0.36.1 and the current `dist/`.
