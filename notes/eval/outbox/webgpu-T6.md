michadr.

## WebGPU T6: night glow, fog order, small gaps, ?perf=1, 16-spot diff harness (Opus, game.js lane), report

Nothing was flipped: the default is still WebGLRenderer. git was not run, and the version was not bumped (package.json is still 0.35.22).

`npm run release -- --force` re-packaged 0.35.22 several times. That version has been live since 16:53, but T5 and Hydrogen had already overwritten the local `dist/releases/0.35.22` before this stage. The live copy is not affected, and the planned bump to 0.35.23 replaces it.

### The main finding: one fix covers gaps 1, 2, 3 and 5
I did not use per-material glow compensation. The root cause was where the grade runs:
- On the node path, WebGPURenderer draws into a linear HalfFloat buffer and runs the grade once, in an output pass at the end.
- WebGL grades and sRGB-encodes every fragment, blends in screen colours, and mixes fog after the encode.

three r187 has a hook for this: `renderer.contextNode` `getOutput`, the same one its `DirectRenderPipeline` uses. The new `dist/tsl-output.js` uses that hook so the node path works the way WebGL does:
- **Per material:** every material on the canvas ends with `renderOutput(grade, sRGB)`. `toneMapped:false` gets the sRGB encode only. Render targets (shadow maps, the map bake) stay linear.
- **No output pass:** three is told that the canvas needs no output step, so there is no framebuffer and no output pass. This is cheaper, and MSAA now also works on the WebGL2 backend.
- **Game settings kept:** `renderer.toneMapping` and `outputColorSpace` keep the game's own values. Each (tone mapping, colour space) pair gets its own context, so the map bake's save/restore cannot poison the shader cache. My first version broke this, and the harness caught it (vehicles and rocks came out dark).
- **Fog (gap 2):** one display-space fog node per scene. It mixes after the encode, using the sRGB fog colour, as WebGL's `fog_fragment` does.
- **Background (gap 3):** a solid `scene.background` is cleared already encoded and not graded, as on WebGL.
- **Glow and glass (gaps 1 and 5):** additive glow and see-through glass now blend in screen colours. This is exactly the WebGL formula, with no magic numbers.
- **Way back:** `&direct=0` keeps T5's single output pass. Use it for A/B checks or if something goes wrong.

The prompt suggested `dist/tsl-glow.js`. I named the module `dist/tsl-output.js` because it covers more than glow. Its test, `tests/tsl-output.mjs`, pins the CPU formulas against `daynight.grade` and the WebGL chunk order (tone mapping, then colour space, then fog).

### Files created or changed (line counts)
New:
- `dist/tsl-output.js` (123): the direct output, plus the CPU mirrors used by the test. Its `warmHidden()` (gap 9) and `last` draw-call snapshot (gap 8) are also here.
- `dist/perf-probe.js` (106): the ?perf=1 probe.
- `dist/tsl-points.js` (15): sized points as one instanced Sprite with `PointsNodeMaterial` (gap 6).
- `scripts/webgpu-diff.mjs` (92): the 16-spot harness.
- Tests:
  - `tests/tsl-output.mjs` (79)
  - `tests/perf-probe.mjs` (50)
  - `tests/tsl-points.mjs` (18)

Changed:
- `dist/game.js` (1970, CRLF and no BOM kept). Eight single-line swaps:
  - Imports.
  - ?perf flag and `trackTimestamp`.
  - `installDirectOutputTSL` before `r.init()`, unless `&direct=0`.
  - `PointsNodeMaterial` in the kit.
  - `perf.begin(active)` at the top of `frame()`.
  - Warm-up adds `warmHidden`.
  - The dev cost line reads the last render's draw calls.
  - The probe is created inside the existing `if(DEV_MODE)` block. `tests/dev.mjs` requires exactly two `DEV_MODE` mentions.
- `dist/render-backend.js` (25): adds `directOutputWanted()`.
- `dist/tsl-sightline.js` (51) and `dist/tsl-ground.js` (131): the 4x4 dither rows are flipped to `gl_FragCoord` order (gap 4, both dithers).
- `dist/sawdust.js` (39) and `dist/menu-scene.js` (165): the TSL path uses `tsl-points.js`. The WebGL path is unchanged.
- Tests updated:
  - `tests/webgpu-flag.mjs` (74): the points twin, direct output installed, no 1 px Points left.
  - `tests/tsl-materials.mjs` (491) and `tests/tsl-ground.mjs` (336): the dither y now counts from the top, as TSL does.

### Tests (real output)
```
node tests/tsl-output.mjs
night halo pixel: WebGL 184,161,111 vs T5 linear pass 163,138,86; menu pine at 30 m: WebGL 91,114,108 vs T5 106,133,135
PASS tsl-output: real WebGPURenderer runs without framebuffer/output pass (MSAA kept), per-material grade + sRGB with toneMapped honoured, render targets linear, display fog (encoded colour, follows the scene), encoded clear colour, hidden-twin warm-up, last draw calls.
node tests/perf-probe.mjs
WebGL | CPU frame ms: min 5 mean 5 p95 5 p99 5 (n=10)
PASS perf-probe: Dev Mode + ?perf=1 only, fixed sample arrays, nearest-rank min/mean/p95/p99, CPU frame and interval from the frame loop, GPU from WebGL timer queries or WebGPU timestamps, printed once, click restarts.
PASS tsl-points: sawdust/menu dust become one instanced Sprite with PointsNodeMaterial (size 0.075 m, attenuated, same colour and opacity), never raycast.
node tests/webgpu-flag.mjs
off: WebGLRenderer, three.webgpu.js/three.tsl.js not loaded, 167 GLSL-patched materials as before, HUD "25 FPS"
on: WebGPURenderer (WebGPU), init awaited, 68 node materials, TSL twins {...,"points":2,"menu":1}, points left at 1 px: none, HUD "25 FPS | WebGPU"
force: ... (WebGL2 via WebGPU) ... points left at 1 px: none
nogpu: ... (WebGL2 via WebGPU) ... points left at 1 px: none
PASS webgpu-flag: off = WebGLRenderer with no WebGPU/TSL download; ?webgpu=1 = WebGPURenderer, ... 11 TSL twins built, no GLSL patch left; &webgl=1 and no navigator.gpu = WebGL2 via WebGPU.
PASS tsl-materials: all 8 T3 NodeMaterial factories & CPU math parity checks matched GLSL sources.
PASS tsl-ground: all 11 ground kinds (140 cases) matched ground-shader.js (...)
```

Index and brief:
```
npm run index / node tests/brief.mjs
brief 2834 tokens (target 3000), index 36410 tokens (target 37000); 258 modules, 14 generated, 310 tests, 31 scripts
brief tests passed: 258 modules listed, brief 2834 and index 36410 estimated tokens (budgets 3000 and 37000)
```

Full `npm test`, after `npm run release -- --force`:
```
FAILED FILES: game-name.mjs, startup.mjs, talk-game.mjs
3 of 310 test files failed.
```
None of the three is mine. Each one "failed twice" in the runner, and they also failed again when I ran them by hand.
- `game-name.mjs`: `dist/cast-crowd.js` (written at 17:37 by the agent doing talk content C8/C9) spells out "Eden Ridge" in lines 263, 365 and 366.
- `startup.mjs` and `talk-game.mjs`: they assert Noah's and Sophie's dialogue wording, and `npc-chat.js` was changed at 17:39 by the same content work.

My first full run also failed `dev.mjs`, and that one was mine: an extra `DEV_MODE` mention in game.js. It is fixed and now passes.

### Diff table: mean / max / % of pixels over 15, against the default WebGL run
Setup: real GPU, headless Edge, 1280x720, `node scripts/webgpu-diff.mjs <out> webgl,t5,webgpu,gl2`. Time is pinned with `__city.lookAt`. Shops are entered by walking through the door. People, smoke and the menu's wind move between runs, so part of every number is motion.

- **"T5 path"** is `?webgpu=1&direct=0`, the before state, re-measured in this harness.
- **"T5 report"** is the 6-spot table in webgpu-T5.md.

| Spot | T5 report | T5 path (before) | WebGPU now | WebGL2 via WebGPU now | Target |
|---|---|---|---|---|---|
| day sky | 0.13 | 0.13 / 165 / 0.18% | **0.07** / 165 / 0.08% | 0.10 | < 3 |
| day ground | 0.15 | 0.16 / 199 / 0.17% | **0.10** / 199 / 0.16% | 0.11 | < 3 |
| day depot (painted pickups, glass) | 1.19 | 1.19 / 153 / 2.07% | **0.71** / 153 / 1.41% | 0.55 | < 3 |
| market (interior) | 1.53 | 1.51 / 185 / 3.51% | **0.16** / 185 / 0.31% | 0.09 | < 3 |
| diner (interior) | n/a | 2.04 / 204 / 2.97% | **0.11** / 206 / 0.19% | 0.08 | < 3 |
| sawmill | 3.20 | 2.42 / 213 / 2.66% | **2.23** / 213 / 2.38% | 1.92 | < 3 |
| gas station canopy | n/a | 1.41 / 184 / 2.68% | **0.83** / 184 / 2.01% | 0.69 | < 3 |
| lake/shore | n/a | 1.95 / 217 / 3.17% | **1.37** / 217 / 2.99% | 1.88 | < 3 |
| Alder street | n/a | 2.85 / 243 / 6.21% | **2.22** / 243 / 5.15% | 2.07 | < 3 |
| forest | n/a | 2.03 / 189 / 3.51% | **1.60** / 189 / 2.60% | 0.85 | < 3 |
| night Oak St lamps | 23.96 | 3.37 / 168 / 6.46% | **1.51** / 123 / 3.35% | 1.46 | < 8 |
| night gas canopy | n/a | 2.60 / 205 / 6.27% | **1.24** / 205 / 2.64% | 1.13 | < 8 |
| night Alder street | n/a | 4.08 / 243 / 8.94% | **1.91** / 243 / 3.84% | 1.48 | < 8 |
| night headlights (in the offroad) | n/a | 9.46 | **16.10** / 254 / 40% | 10.89 | < 8 (see below) |
| main menu | 4.20 | 4.44 / 184 / 9.89% | **2.82** / 176 / 5.00% | 0.05 | < 3 |
| character creator | n/a (visible) | 9.43 / 157 / 48.65% | **0.38** / 162 / 0.80% | 0.00 | < 3 |

- Every target is met except the headlights spot. Its number is framing, not the renderer: the drive camera settles at a different angle in each run.
  - Screenshots compared by eye: the beam on the ground, the halos and the tail lights match.
  - Notes for the next run: the harness shot was taken right after the player's SpotLight was added, and both renderers were recompiling at that moment (HUD 17 FPS on WebGL, 60 FPS on WebGPU). The spot needs a fixed camera before its number means anything.
- At night, the halos and the lamp pools on WebGPU now look like WebGL (checked side by side). In the T5 path they are visibly smaller. I could not reproduce T5's 23.96. With the time pinned at this spot, the T5 path measures 3.37; the halos are small on screen, so the mean stays low even when they are clearly wrong.
- Menu: almost all of the remaining 2.82 is the pines swaying in the wind (the WebGL2 backend measures 0.05).
- Screenshots and JSON are in my scratchpad (`diff3`). Re-run any time with the command above; add `--perf` for the probe.

### The small gaps 3 to 9
| Gap | Status |
|---|---|
| 3 background colour (creator) | **Fixed** (encoded clear colour): 9.43 to 0.38 |
| 4 mirrored dither | **Fixed** in both TSL dithers (sightline fade and ground edge); covered by the parity tests, not checked by eye |
| 5 vehicle glass | **Fixed** by the screen-colour blend (depot 1.19 to 0.71) |
| 6 1 px sawdust / menu dust | **Fixed**: one instanced Sprite with PointsNodeMaterial each, still one draw call; webgpu-flag asserts no 1 px Points remain |
| 7 ground quality until reload | **Not done**: needs world.js (forbidden), see the requested edit below |
| 8 dev cost line reads 0 | **Fixed**: reads the last render's counts. Note: WebGPU reported 425 and WebGL2-via-WebGPU 468 draw calls, against WebGL `info` 195 at the same final spot. I did not find out why; please check in the dev panel on your PC (it could be how three counts passes) |
| 9 shader warm-up hitch | **Partly fixed**: hidden TSL effects (night glow, smoke, debris, tracks) now compile during the menu. Still open: a new vehicle model and the player's SpotLight (a light-count change recompiles every material) can still hitch. The harness saw the frame rate drop when the SpotLight came on, on BOTH renderers |

### ?perf=1: steps for the owner (Dev Mode must be on; it is on in the current builds)
1. Run `npm run dev`, or use the deployed site once 0.35.23 or later is live.
2. Use the same window size for every run (full screen is easiest). Open each URL in turn:
   - `http://localhost:8000/?perf=1` (WebGL, the default)
   - `http://localhost:8000/?webgpu=1&perf=1` (WebGPU)
   - `http://localhost:8000/?webgpu=1&webgl=1&perf=1` (the WebGL2 fallback)
3. Press Play and stand still at the place you want to measure (for example Oak Street at night: Dev panel, set the time to 22:00).
4. After about 5 seconds (120 warm-up frames, then 600 measured frames), the box at the bottom left shows:
   - CPU frame ms, frame interval ms and GPU ms, each as min/mean/p95/p99.
   - The same table appears in the console (F12) as `console.table`.
5. Click the box to measure again, for example after walking somewhere else.
6. Paste the three boxes into the chat.

How to read the numbers:
- The frame interval cannot go below your monitor's refresh time (6.06 ms at 165 Hz). Compare **CPU frame** and **GPU ms** instead.
- GPU time comes from different sources: on WebGPU from timestamp queries (render passes only), on WebGL from `EXT_disjoint_timer_query_webgl2` (all GPU work between two frames). The two GPU columns are not strictly comparable. CPU frame is comparable.

Headless results (only show that the tool works; vsync-capped):

| Backend | CPU mean | CPU p99 | GPU mean | GPU source |
|---|---|---|---|---|
| WebGL | 3.06 | 4.8 | 5.70 | timer query |
| WebGPU | 4.26 | 6.8 | 1.40 | timestamp |
| WebGL2 via WebGPU | 4.58 | 7.1 | 5.08 | timer query |

### What I could NOT verify
- **Real-GPU frame time on your PC.** Headless is vsync-capped, so the numbers above only prove the tool works. Headless did show a higher mean CPU frame on WebGPU (4.26 vs 3.06 ms).
- A machine with no WebGPU adapter: only `&webgl=1` and the Node mock.
- Long play, a quality switch at runtime, multiplayer, and the scene editor (not opened).
- Transmission materials: direct output cannot sample the framebuffer. I found none in the game's own code, but did not inspect every GLB.
- Warehouse pallet tags, crash debris and wheel spray were not on screen in Edge.

### Requested edits to forbidden files
- **dist/world.js (gap 7), for the main chat:**
  - In `groundPatch`, keep each TSL ground mesh with the options it was built with.
  - Export `world.rebuildGroundTSL(high)`. It should call `setGroundQuality(high)`, rebuild each one with `makeGroundMaterialTSL(sameOptions)`, swap `mesh.material` and dispose the old one.
  - In game.js `applyQuality`, call it when `tslKit()` is set (I can add that one game.js line in a later stage).
- **notes/handoff.md:** record:
  - T6 done.
  - `&direct=0` as the way back.
  - The new harness `scripts/webgpu-diff.mjs` and `?perf=1`.
  - The 3 talk-content test failures, which are not caused by T6.

### Go / no-go for flipping the default in 0.36.0
**Conditional GO.** The look side is done: all 13 comparable spots are under target, and the 14th (headlights) matches by eye; only its camera angle differs between runs. Interiors and the creator are now nearly identical.

The flip still waits on:
- (a) Your `?perf=1` numbers on the real PC for WebGL and WebGPU. Flip only if WebGPU's CPU frame and p99 are not worse.
- (b) Ten minutes of play at night on `?webgpu=1`.
- (c) Accepting that a ground quality change on WebGPU needs a reload until the world.js edit lands.

The flip itself is one line in `backendFlag`.

### QUESTIONS FOR THE OWNER
1. After you paste the `?perf=1` numbers: flip the default to WebGPU in 0.36.0 if WebGPU is not slower? (Recommended: yes.)
2. Without WebGPU, should the game fall back to the classic WebGLRenderer (exact old look, no 2.3 MB download; recommended) or to WebGPURenderer's WebGL2 backend (now also very close)?
3. Ground quality on WebGPU: show "applies after reload" for now, or schedule the world.js rebuild edit?
4. Keep the `&direct=0` way back until after 0.36.0? (Recommended: yes, then remove it.)

### Confidence
- Direct output (glow, fog, background, glass): **high**. It follows three's own DirectRenderPipeline hook, is checked on a real WebGPURenderer in Node, and is checked on screen at 16 spots on both backends.
- Sized points: **high** in Node, **medium** on screen (sawdust was never on camera).
- Dither flip: **medium**: tested by formula, not seen.
- ?perf=1: **high** that it measures and prints; **medium** on the meaning of the GPU column across backends.
- Warm-up: **medium**.
