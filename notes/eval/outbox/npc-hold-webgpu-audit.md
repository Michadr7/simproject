michadr.

# Three.js NPC hold and WebGPU hitch audit

## NPC hold in packaged 0.36.3

I opened Robert’s street interaction with E in the packaged game under the Node browser stub. He moved 6.736 m in two simulated seconds, the player stayed still, and the clock advanced by one game minute. The legacy dialogue closed within nine seconds. The HUD test with stationary speakers still passes.

```text
NPC HOLD PROBE {"name":"Robert","panelKind":"legacy","minute":450,"npcMovedMetres":6.736,"playerMovedMetres":0,"clockAdvancedMinutes":1,"panelOpenAfterTwoSeconds":true,"panelOpenAfterNineSeconds":false,"actorGapAfterNineSeconds":47.767}
```

The actor and camera face each other at `dist/game.js:1865`. Before that, `stepWorld` still calls `npcCrowd.update` at line 1833. The crowd samples the schedule with the live clock, applies movement and separation, and advances work animation at `dist/npc-crowd.js:77–120`. Both dialogue paths use `talkGone` at `dist/game.js:621`. Its 3 m check measures player movement. A speaker can close the dialogue by disappearing, losing its pool slot, or moving beyond 12 m horizontally or 4 m vertically. I reproduced legacy street dialogue and confirmed the docked dialogue uses the same unguarded crowd update in source.

**Requested protected-file edit.** In `dist/game.js`, pass the current outdoor conversation actor from `talkNow.actor` or the visible legacy `worldPanel.actor` into `npcCrowd.update` in `stepWorld`. Use the active dialogue and slot identity to retain only the matching NPC. Let the hold end through the existing `talkClosed` and `clearWorldPanel` paths. In `dist/npc-crowd.js`, have `update` keep the matching visible avatar and slot at its displayed position, reserve that position in separation, and idle its locomotion and work animation. Record the held route or activity time and resume from it on release. Rejoin the live schedule at a normal transition so closing dialogue cannot snap the actor ahead. Keep the town clock and other actors running. The expected extra rendering cost is zero draw calls. Add a focused packaged regression for position, clock, auto-close, and route resumption when implementing the fix.

## WebGPU findings and proposed changes

1. **Startup warms the wrong lighting state and renders immediately.** In `dist/game.js:1841`, the first frame starts `compileAsync` and `warmHidden` without retaining completion. The menu branch at line 1847 lets that frame draw the world. The first `nightLights.update` at line 1868 installs the High-quality spotlight after warm-up was started. The vendored renderer projects the scene and collects lights when it starts compiling (`dist/vendor/three.webgpu.js:23251–23368`), and the light and shadow state enter the cache key (18360–18380). Render-path misses can use synchronous creation (47316–47347). The prior 0.36.2 profile measured 61–70 synchronous pipelines on the boot frame. In protected `game.js`, initialize the selected quality and its light rig before requesting world compile, keep the promise, and continue drawing the separate menu scene until preparation is ready. In `night-lights.js`, expose an explicit High/Low rig initialization or pass the startup quality to `createNightLights`. Make `tsl-output.js` return the hidden compile jobs and include them in that wait. Keep the existing High-only light semantics. The warm-up itself adds no steady-state draws.
2. **Headlights are already stable during High-quality play.** Packaged `night-lights.js:115–147` keeps the same light in the scene with intensity zero when off, including daytime. High/Low may still add or remove it. Compare first versus second vehicle entry and first versus second light toggle before attributing a High-mode hitch to the light count. First sight of a vehicle, streamed ground, and newly decoded materials are separate events.
3. **Quality switching stacks expensive changes.** `applyQuality` in protected `game.js:1180` rebuilds ground node materials, drops cover chunks, changes render size and shadows, and walks the scene to mark materials dirty. The mock test saw 54 distinct ground materials replaced. Shadow state already changes the WebGPU cache key. Add a guard for a repeated setting after initialization. Measure rebuild, resize, and next-frame pipeline compilation separately. On the WebGPU branch, stage target-tier preparation behind a short transition and verify parity before narrowing the broad invalidation. In protected `world.js:587`, keep the existing material swap and disposal behavior until profiling justifies changing ground tier generation.
4. **Cold streaming needs bounded preparation.** `ground-cover-view.js:31–46` creates materials on first use. Decoded window maps dirty materials in `night-lights.js:94` after initial warm-up. The earlier 0.36.2 capture reported 33–53 ms CPU on first cover sightings and 91–114 ms CPU on first depot exposure. Warm representative cover, ground, vehicle, and emissive variants in small batches after assets arrive, using the final lighting state. Avoid compiling an entire streamed district at once. This should add zero steady-state draws. Actual frame-time improvement needs GPU measurement.
5. **Route warm-up still has an independent CPU risk.** Packaged `game.js:1842` has removed the blocking `npcWarm.run()` on Play. `npc-routes.js:51–70` checks its 4 ms budget after each complete route search. A long search can consume a frame on either renderer. Time this section separately on early Play. Move or split the individual searches only if they still show up in traces.
6. **The A/B script needs an explicit baseline.** In `scripts/webgpu-diff.mjs:10`, set `ALL.webgl` from the empty string to `'webgpu=0'` and confirm the actual backend before comparing. The packaged default is WebGPU, so the empty query can compare WebGPU against itself.

## Verification

Tests added: zero. Targeted tests ran against the current source or packaged entry point as applicable. The Node renderer and DOM stubs cannot measure GPU hitches; the packaged Node runs also logged that `Image` is unavailable for cover atlas creation.

```text
PASS talk-game.mjs: Noah, Elena and Hal talk in the docked panel; time runs and walking is locked while talking; Esc says see you without pausing; acts run first and a failed act keeps the old replies; memory saved without derived beats; H7 read-message; recent cafe-shift; Hal hands over the truck at step 3.
PASS npc-crowd-separation walls: 4 people, none in the wall
PASS npc-crowd-separation: closest pair 0.80 m
night lights tests passed
PASS webgpu-ground-quality.mjs: live high->low->high rebuilt 54 TSL ground materials (54 meshes), disposed old materials, updated groundProgramKey, and preserved polygonOffset.
PASS webgpu-flag: ?webgpu=0 = WebGLRenderer with no WebGPU/TSL download; no flag and ?webgpu=1 = WebGPURenderer (the 0.36.0 default), init awaited before the first render, 11 TSL twins built, no GLSL patch left; &webgl=1 and no navigator.gpu = WebGL2 via WebGPU.
PASS perf-probe: Dev Mode + ?perf=1 only, fixed sample arrays, nearest-rank min/mean/p95/p99, CPU frame and interval from the frame loop, GPU from WebGL timer queries or WebGPU timestamps, printed once, click restarts.
PASS npc-routes: 412 walking blocks, worst hurry 1.00x (old estimate 1.10x), table 45 pairs
```

The headless browser probe yielded no timings. Edge did not expose the local DevTools endpoint, so I stopped the scratch probe. The older 0.36.2 measurements above are reference points. For a current capture, record per-event frame gaps, renderer time, node builds, and synchronous pipeline counts around startup, High/Low, first and repeat depot entry, and the headlight toggle. The existing 600-frame percentiles alone can miss a single hitch.

Confidence is high in the NPC reproduction, the startup and quality ordering, and the packaged light lifecycle. Confidence is moderate that correcting startup order will remove a material share of the current hitch. Current GPU timings and the size of each gain remain unverified.

Created `notes/eval/outbox/npc-hold-webgpu-audit.md` (45 lines). This audit changed zero runtime files.
