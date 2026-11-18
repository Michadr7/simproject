# Eden Ridge Visual Identity Design: GLSL Look Pipeline & Compute Horizon

Implements the owner's visual-identity plan on **Three.js `r187` (`WebGLRenderer`, 0.35.20)**: build Eden Ridge's signature look inside the existing 17-hook GLSL pipeline (**colour grade, toon ramps, outlines, sky**), and isolate the effects that genuinely require GPU compute before considering any future `three/tsl` (`WebGPURenderer` / `WebGL2`) rewrite.

---

## 1. Look Statement & Testable Visual Properties

**Look Statement:** Eden Ridge is a **warm, illustrated Pacific Northwest timber-and-farming town** (**Firewatch** atmospheric depth meets crisp stylized low-poly forms) that reads at a glance at `165 FPS` on a desktop GPU and keeps Low-tier parity on a `GTX 1060` (`notes/visual-overhaul-brief.md:9-15`). Sunlit surfaces lean golden-warm (`#fff1d6`), shadow faces step cleanly into cool slate-blue (`#8fa3dc` / `shadowTint [0.86, 0.96, 1.12]`) through a soft 3-band toon ramp rather than muddy linear Lambert falloff, interactive silhouettes (people and active vehicles) stand off the background with a thin distance-faded ink hull, and the sky dome ties land to horizon through matching fog and a warm twilight lobe.

### Testable Properties (Pinned by Unit & Scene Tests)
1. **Monotonic luminance & split-tone invariant (`dist/daynight.js:76-85`, `tests/daynight.mjs:91-97`):** For any grey input `v` in `[0, 8]`, `grade([v,v,v], exposure)` is strictly monotonic non-decreasing in `[0, 1]`; deep shadows (`l = 0.01`) satisfy `B > 1.15 * R`, mid-greys (`l = 0.25`) stay neutral (`max - min < 0.03`), and highlights (`l = 2.0`) satisfy `R > B`.
2. **Night readability floor (`dist/daynight.js:9,102`, `tests/daynight.mjs:82-86`):** Unlit ground (`#8a9a7c`) at midnight (`minutes = 0`, `NIGHT_FLOOR = 0.12`) after `litGround` + `grade` has linear luminance `>= 0.02` (`~21%` sRGB, `notes/visual-overhaul-design.md:269`) and `B > R`.
3. **3-band toon irradiance quantization (`dist/toon-rules.js`, planned):** Direct `dotNL` in `[0, 1]` maps monotonically to 3 smoothstepped bands (shadow `0.0`, midtone `0.52`, lit `1.0` with feather `0.06..0.12`), plus a sunlit grazing rim (`<= 0.14`, active only when `dotNL > 0.15`).
4. **Horizon-fog lock (`dist/sky.js:69-73`, `tests/daynight.mjs:116`, `tests/ground-shader.mjs:128-130`):** At every minute `0..1440`, `scene.fog.color`, `sky.dome.material.uniforms.uHorizon.value`, and `SKY_HORIZON.value` match `skyAt(m).horizon` within `1e-6`, and `scene.fog.far <= 155` (`FOG_FAR_MAX`, inside `tests/culling.mjs:10` `155..200 m`).
5. **Draw-call & program budget (`notes/visual-overhaul-brief.md:15`):** World draw calls stay `<= 300`; light count never flips between noon and midnight (`2` lights on Low, `2` by day / `+1` `SpotLight` at night on High, `tests/daynight.mjs:111,119`); vehicle materials stay at `2` programs (`'vehicle-paint'`, `'vehicle-glass'`, `tests/damage-look.mjs:40`) and ground materials at `<= 11` (`tests/ground-shader.mjs:88`).

---

## 2. The Four Pillars in the Existing GLSL Pipeline (`r187`)

### 2.1 Colour Grade
- **Where it plugs in:** Global chunk edit in `THREE.ShaderChunk.tonemapping_pars_fragment` (`dist/vendor/three.module.js:497`) installed once by `installGrade()` in `dist/sky.js:14-19` via `gradeGLSL()` (`dist/daynight.js:87-99`), with `renderer.toneMapping = THREE.CustomToneMapping` (`dist/sky.js:44`).
- **Exact approach:** Keep the single-pass `CustomToneMapping` architecture (runs inside every material's `#include <tonemapping_fragment>` with no post render target). Tune `GRADE` (`dist/daynight.js:76`) with a subtle low-mid saturation lift and mild split-tone warmth via the same `gradeGLSL()` template so both High and Low tiers receive identical colour grading.
- **Cost:** **0** extra draw calls, **0** extra programs, **0** textures, **0%** extra fill rate (replaces ACES filmic math in-place).
- **What could break:**
  - `tests/daynight.mjs:99-105` asserts `gradeGLSL()` matches `/^vec3 CustomToneMapping\( vec3 color \) \{/`, references `toneMappingExposure`, and embeds every numeric constant of `GRADE`. Any tuned parameter must live in `GRADE` and mirror in both `grade()` and `gradeGLSL()`.
  - `tests/daynight.mjs:93` pins mid-grey neutrality (`max - min < 0.03` at `[0.25, 0.25, 0.25]`, `exposure = 1.12`).

### 2.2 Toon Ramps & Stylized Rim Light
- **Where it plugs in:** Global chunk edit in `THREE.ShaderChunk.lights_physical_pars_fragment` (`dist/vendor/three.module.js:399`, inside `RE_Direct_Physical`), installed once by `installToonRamp()` alongside `installGrade()` in `dist/sky.js` using pure math from `dist/toon-rules.js`.
- **Exact approach:**
  - In `dist/vendor/three.module.js:399`, `RE_Direct_Physical` starts with:
    `float dotNL = saturate( dot( geometryNormal, directLight.direction ) );`
    `vec3 irradiance = dotNL * directLight.color;`
  - Replace those lines once in `ShaderChunk.lights_physical_pars_fragment` with a 3-band `smoothstep` ramp + sunlit rim:
    - Smoothstep bands (e.g. `[0.08, 0.18] -> 0.52` and `[0.48, 0.62] -> 1.0`).
    - Attenuate quantization on non-puddle matte ground (`roughness: 0.95..1.0` in `dist/world.js:241,244,249,256` and `dist/ground-cover-view.js:34`, while props use `0.85..0.90` in `dist/props.js:61-65`): `float toonW = smoothstep(0.94, 0.90, material.roughness);`, keeping `ground-shader.js` Mikkelsen bump relief (`dFdx`/`dFdy` at `dist/ground-shader.js:128`) smooth while stylizing characters, vehicles, buildings, and trees. *(Note: mud puddles set `roughnessFactor` lower in `<roughnessmap_fragment>` at `ground-shader.js:57,129`; `mud` planes still carry glossy sky sheen at `L130`.)*
    - Add sunlit Fresnel rim (`pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 4.0) * smoothstep(0.15, 0.35, dotNL) * 0.14`) into `irradiance`.
  - **Why global chunk vs `onBeforeCompile`:** World materials already occupy `onBeforeCompile` (`dist/world.js:188`, `dist/paint-shader.js:24,46`, `dist/ground-shader.js:139`, `dist/ground-cover-view.js:35`). Patching `lights_physical_pars_fragment` applies uniformly across all `MeshStandardMaterial`s without chaining conflicts or custom program cache key proliferation.
- **Cost:** **0** draw calls, **0** new programs, **0** textures (analytic `smoothstep` avoids a 1D LUT texture unit), **< 0.05 ms** estimated ALU per frame *(unverified on GPU)*.
- **What could break:**
  - `tests/ground-shader.mjs:88,120` and `tests/damage-look.mjs:40-41` pin `customProgramCacheKey()` counts and compare `onBeforeCompile` output strings; because `lights_physical_pars_fragment` expands after `onBeforeCompile`, those string checks stay intact. Verify `RE_Direct_Physical` substring match in tests against real `r187` `THREE.ShaderChunk`.

### 2.3 Selective Outlines (Characters & Active Vehicles)
- **Where it plugs in:** New `dist/outline.js` + pure `dist/outline-rules.js`, wired into `dist/character.js:168-184` (`applyParts`) and `dist/driving.js` / `dist/game.js` (`applyQuality` toggle).
- **Exact approach (Selective Inverted-Hull vs Screen-Space Pass):**
  - *Rejected option — Full-screen post pass:* A depth + normal Sobel post pass needs `HalfFloatType` targets (`86–220 MB` VRAM at `1.6x` DPR, `notes/visual-overhaul-design.md:13`), breaks hardware MSAA, outlines dense grass tufts (`ground-cover-view.js`), and requires mock target updates across `tests/startup.mjs` and `tests/carry-game.mjs`.
  - *Chosen option — Selective Inverted-Hull (`THREE.BackSide`) on High:*
    1. **Characters (`dist/character.js:180`, max `15` pooled avatars via `dist/npc-crowd.js:14`):** Share one `ShaderMaterial` (`name: 'toon-outline'`, `side: THREE.BackSide`, `depthWrite: true`, `#include <skinning_vertex>`). Extrude vertices along `objectNormal * uOutlineWidth` (`2.2 mm` scaled by `1.0 - smoothstep(28.0, 45.0, -mvPosition.z)`) so distant walkers shrink to `0` width.
    2. **Active / nearby vehicles (`dist/driving.js`):** Attach optional hulls on the driven vehicle + nearest 2 within `35 m` (`castShadow = false`, `receiveShadow = false`).
    3. **Low tier:** `outline.visible = false` (`0` draws, `0` cost on Low).
- **Cost (High, within `45 m`):** **+1** shared `ShaderMaterial` program (`'toon-outline'`), **0** textures, **0** render targets, **+4 to +24** cheap back-face draw calls (`< 25k` triangles, `0` shadow-pass triangles), **< 1.5%** fill rate *(estimate, unverified on GPU)*.
- **What could break:**
  - `tests/character.mjs:34-36,43-45` inspects `c.meshes` and asserts exact part names `['Body','Feet','Head','Legs']` and `triangles < 8000`. **Guard:** store outline meshes in `c.outlines`, never inside `c.meshes`.
  - `tests/sawmill-asset.mjs:58-60` pins `sawmill-v4` `drawCalls <= 30` and exact `trianglesBefore`; keep outlines off `sawmill-v4` and static props.

### 2.4 Sky Dome (Horizon Band, Mie Halo & Procedural Cloud Wisps)
- **Where it plugs in:** `dist/daynight.js:18-71` (`MOODS`, `skyAt`) and `dist/sky.js:21-34,46-80` (`DOME_FRAGMENT`, `createSky`).
- **Exact approach:**
  - Keep `sky-dome` (`SphereGeometry(1, 24, 16)`, `renderOrder = -3`, `depthTest = false`, `depthWrite = false`, `dist/sky.js:46-48`) and `sky-stars` (`STAR_COUNT = 600`, `renderOrder = -2`, `dist/sky.js:54-55`).
  - Refine `DOME_FRAGMENT` (`dist/sky.js:23-34`) with a tighter horizon glow curve and a single 2-octave procedural cloud-wisp layer above `d.y > 0.08`, scrolled by `wind.js` `WIND_BASE` and tinted from `skyAt(minutes).clouds` (`0` near horizon `d.y <= 0.08` so `uHorizon` stays `100%` equal to `scene.fog.color`).
- **Cost:** **0** extra draw calls (reuses `sky-dome`), **0** new programs, **0** textures (procedural math in `DOME_FRAGMENT`), **0** extra fill rate.
- **What could break:**
  - `tests/daynight.mjs:109,116,120` asserts `scene.children.length === before + 2`, `scene.fog.color` equals `skyAt(720).horizon`, and `uTop.value.b < 0.02` at midnight. Keep `uTop`, `uHorizon`, and `sky-dome` / `sky-stars` object count unchanged.

---

## 3. Staged Plan (`V-A .. V-E`)

| Stage | Builder | Files Touched | Test & Eye-Check | Independence |
| :--- | :--- | :--- | :--- | :--- |
| **`V-A` Pure Toon Rules** | **Sonnet 5.5 high** | `dist/toon-rules.js` (new), `tests/toon-rules.mjs` (new) | **Test:** `node tests/toon-rules.mjs` (monotonicity, 3 bands, rim bounds, GLSL constant match). Pure math. | **Independent** |
| **`V-B` Pure Sky Clouds/Bands** | **Sonnet 5.5 high** | `dist/daynight.js`, `tests/daynight.mjs` | **Test:** `node tests/daynight.mjs` (1,440-min continuity, horizon===fog invariant, existing `GRADE` checks). Pure math. | **Independent** |
| **`V-C` Pure Outline Rules** | **Sonnet 5.5 high** | `dist/outline-rules.js` (new), `tests/outline-rules.mjs` (new) | **Test:** `node tests/outline-rules.mjs` (`0` on Low, fade-out by `45 m`, clamped widths). Pure math. | **Independent** |
| **`V-D` GLSL Sky & Toon Wiring** | **Opus 5.5** | `dist/sky.js`, `tests/daynight.mjs`, `tests/ground-shader.mjs` | **Test:** `npm run release -- --force && npm test`. **Eye-check:** Spawn & Pine Ridge at `06:15`, `12:00`, `17:45`, `00:00` for 3-band shading, smooth ground relief, and horizon lock. | Needs `V-A`, `V-B` |
| **`V-E` Selective Outlines** | **Opus 5.5** | `dist/outline.js` (new), `dist/character.js`, `dist/game.js`, `tests/character.mjs`, `tests/outline-game.mjs` | **Test:** `npm run release -- --force && npm test` (`c.meshes` unchanged, `drawCalls` on Low/High). **Eye-check:** Alder Center at noon & dusk: crisp silhouettes `<= 30 m`, invisible `>= 45 m`, `0` on Low. | Needs `V-C`; independent of `V-D` |

---

## 4. Compute-Only Effects & TSL / WebGPU Trigger

| Effect | Why GLSL Cannot Do It Acceptably | Rough Budget | Trigger to Consider TSL / WebGPU |
| :--- | :--- | :--- | :--- |
| **1. Dense Interactive Meadow Grass (`100k–300k` blades)** | `dist/ground-cover-view.js:16-17,72` builds chunk `InstancedMesh`es on CPU (`coverJob`) and only applies a global wind sine. Per-blade Hi-Z/frustum culling, LOD compaction, and multi-vehicle persistent flattening require compute `drawIndirect`; CPU uploads in WebGL 2 stall above ~`25k` dynamic blades. | `<= 0.5 ms` compute cull/bend + `1` `drawIndirect` call (`~150k` blades). | Owner wants dense vehicle-flattened meadows across Willow Farm beyond `ground-cover-view.js` capacity. |
| **2. Large Crowds (`200–500` animated people)** | `dist/npc-crowd.js:14` caps pooled `SkinnedMesh` avatars at `POOL = 9` (`15` total) because CPU `AnimationMixer` + leg/arm IK (`dist/character.js:141,234-265`) and per-avatar draw calls don't scale. `200+` people need GPU compute skinning + crowd avoidance into a single indirect buffer. | `<= 0.4 ms` compute skin + `2` indirect calls (`250` agents). | Future festival/town-square feature requiring `> 40` simultaneous visible animated pedestrians. |
| **3. Persistent GPU Weather & Foam (`50k+` particles)** | `dist/sawdust.js`, `dist/smoke.js`, and `dist/debris.js` simulate particles on CPU and re-upload `DynamicDrawUsage` attributes each frame (`tests/damage-look.mjs:47`). `50k+` height-colliding rain splashes or river foam exceed WebGL 2 CPU/PCIe upload budgets. | `<= 0.3 ms` compute step + `1` draw call (`65k` particles, `0` CPU upload). | Full rain/snow accumulation or river whitewater when CPU pools (`<= 1k` points) read too thin. |

> **TSL Rule (`notes/eval/reviews/threejs-upgrade-audit.md:266-273`):** `WebGPURenderer` bypasses all **10 `onBeforeCompile` hooks**, **2 `ShaderChunk` edits**, and **5 `ShaderMaterial`s** at once. Stay on `WebGLRenderer` GLSL until a compute trigger above is explicitly greenlit.

---

## 5. Open Questions for the Owner (Recommended Answer First)

1. **Toon ramp on ground vs objects:** **(Recommended)** Apply full 3-band toon ramp to characters, vehicles, buildings, and trees (`roughness <= 0.90`) while fading out on ground planes (`roughness >= 0.94`, `world.js`) to keep Mikkelsen pebble/mud bump normals smooth. *Alternative:* Uniform 3-band posterization across ground too.
2. **Outline scope on High:** **(Recommended)** Outline pooled characters (`character.js`, within `45 m`) and active/nearby vehicles (`driving.js`), leaving trees and buildings un-outlined. *Alternative:* Characters only (zero vehicle hull draw calls).
3. **Sky dome clouds:** **(Recommended)** Add one lightweight procedural cloud-wisp layer in `DOME_FRAGMENT` (`0` draw calls, `0` textures, faded to `0` near horizon). *Alternative:* Keep gradient + sun/moon discs only.
4. **Rim light directionality:** **(Recommended)** Gate the grazing rim by sunlit faces (`dotNL > 0.15`) so shadowed/backlit sides stay calm dark blue. *Alternative:* Full wrap-around rim regardless of sun angle.
5. **Dev look toggles (`dist/dev.js`):** **(Recommended)** Add dev sliders/toggles for toon strength (`0..1`) and outlines on/off in `citylife.dev.sky.v1` for live tuning at `165 FPS`. *Alternative:* Lock constants in code with no dev toggles.
