michadr.

# Three.js Upgrade Audit (`r160` → `r187`)

- **Date:** 2026-11-17
- **Scope:** Read-only audit of `dist/*.js`, `dist/*.html`, `dist/vendor/*.js`, `hub/*`, `scripts/*.mjs`, and `tests/*.mjs` to prepare an upgrade from vendored Three.js **`r160`** (`0.160.0`) to the newest stable release (**`r187`** / `0.187.0`).
- **Agent / Model Routing Used:**
  - **Orchestrator (Argon / Opus-equivalent reasoning model):** Performed 100% of the work directly in the main workspace — official Three.js Migration Guide and release notes research (`r161`–`r187`), full codebase and shader-chunk inventory across `dist/`, `hub/`, `scripts/`, and `tests/`, compatibility matrix, visual-parity plan, test-pinning audit, and 5-stage upgrade & WebGPU evaluation.
  - **Subagents / Flash:** None used (per owner instruction to use the strongest reasoning model, not Flash).

---

## 1. Newest Stable Three.js Release & Migration Guide (`r161` → `r187`)

- **Newest stable release found:** **`r187`** (npm package `three@0.187.0`).
- **Sources consulted:** Official Three.js GitHub Releases (`github.com/mrdoob/three.js/releases`, tags `r161` through `r187`), the official Three.js Wiki Migration Guide (`github.com/mrdoob/three.js/wiki/Migration-Guide`), and the `three` npm registry history.

### Release-by-Release Summary (`r161` → `r187`)

| Release | Key Changes in Official Migration Guide & Release Notes |
| :--- | :--- |
| **`r161`** | `WebGLRenderer`: internal uniform caching and `ShaderChunk` cleanups; `BatchedMesh` improvements. |
| **`r162`** | `WebGLMultipleRenderTargets` removed (use `WebGLRenderTarget` with `count` option); `DepthTexture` default `.type` changed from `UnsignedShortType` to `UnsignedIntType`. |
| **`r163`** | **`WebGL1Renderer` removed**; WebGL 1 fallback support completely removed from `WebGLRenderer` (WebGL 2 is now mandatory). |
| **`r164`** | Shader chunk `lightmap_fragment` removed; `AdaptiveToneMappingPass` removed (use `OutputPass`); `EffectComposer` default render target type changed to `HalfFloatType`; `USDZLoader.parse()` made synchronous (`parseAsync()` added); `LWOLoader` coordinate conversion changed; `ColladaExporter`, `PRWMLoader`, `LightningStrike`, `LightningStorm` removed. |
| **`r165`** | Internal WebGPU / TSL groundwork and `BatchedMesh` / `InstancedMesh` bounding-volume fixes; no breaking WebGL syntax changes. |
| **`r166`** | **Per-light `light.shadow.intensity` added (PR #28588):** `DirectionalLightShadow` / `SpotLightShadow` / `PointLightShadow` uniforms now carry `shadowIntensity`, and `getShadow()` in `ShaderChunk.shadowmap_pars_fragment` applies `shadowIntensity` to the shadow attenuation factor rather than ending with a plain `return shadow;`. `BatchedMesh` requires explicit `.addInstance()` after `.addGeometry()`. `HDRJPGLoader` removed in favor of `UltraHDRLoader`. |
| **`r167`** | Major refactor of `WebGPURenderer` and TSL import paths (PR #28650). `utils/packLDrawModel.js` renamed to `.mjs`. |
| **`r168`** | **`build/three.core.js` split:** `build/three.module.js` is no longer a self-contained single file; it re-exports from `./three.core.js`, which must sit beside `three.module.js`. `DragControls` and `PointerLockControls` deprecated getter methods removed; `LogLuvLoader` removed. |
| **`r169`** | `PackedPhongMaterial` and `GPUStatsPanel` removed; `TransformControls` now derives from `Controls` instead of `Object3D` (`controls.getHelper()` added). |
| **`r170`** | **`Material.type` is now a static getter** and cannot be mutated at runtime. **Mipmap generation:** mipmaps are now always generated when `Texture.generateMipmaps = true`, regardless of `minFilter`. `GLTFExporter` defaults non-PBR `metallicFactor` to `0` and `roughnessFactor` to `1`. |
| **`r171`** | `WebGPURenderer` and `NodeMaterial` classes moved to `three/webgpu` (`build/three.webgpu.js`); TSL moved to `three/tsl` (`build/three.tsl.js`). |
| **`r172`** | `WebGLRenderer.copyTextureToTexture3D()` deprecated in favor of unified `copyTextureToTexture()`. |
| **`r173`** | Minor TSL and `WebGPURenderer` node updates; no WebGL breaking changes affecting standard materials. |
| **`r174`** | `Timer` no longer auto-connects to the Page Visibility API (`connect(document)` required if used); `RenderTarget.clone()` now deep-clones its `textures` array instead of sharing references. |
| **`r175`** | `AnimationClip.parseAnimation()` deprecated; `ParametricGeometries` renamed to `ParametricFunctions`. |
| **`r176`** | **`CapsuleGeometry` parameter rename:** constructor/metadata parameter `length` renamed to `height` (positional arguments `(radius, height, capSegments, radialSegments)` still take the cylinder-section height in slot 2, but `.parameters.length` is now `.parameters.height`). `GLTFLoader` removed internal WebP/AVIF feature-detection branches. `LottieLoader` deprecated. |
| **`r177`** | `ColorManagement.fromWorkingColorSpace()` and `toWorkingColorSpace()` renamed to `workingToColorSpace()` and `colorSpaceToWorking()`. Scene JSON format bumped from `4.6` to `4.7`. `PeppersGhostEffect` removed. |
| **`r178`** | `MultiplyBlending` and `SubtractiveBlending` now require `Material.premultipliedAlpha = true`. |
| **`r179`** | `Timer` moved from addons into core (`THREE.Timer`). `WebGLRenderer` parameter `reverseDepthBuffer` renamed to `reversedDepthBuffer`. `USDZLoader` deprecated in favor of `USDLoader`. |
| **`r180`** | `WebGLRenderer` shader defines `USE_REVERSEDEPTHBUF` and `USE_LOGDEPTHBUF` renamed to `USE_REVERSED_DEPTH_BUFFER` and `USE_LOGARITHMIC_DEPTH_BUFFER`. `RGBELoader` renamed to `HDRLoader`; `RGBMLoader` removed. |
| **`r181`** | `WebGPURenderer` async methods (`renderAsync()`, `computeAsync()`, `clearAsync()`) deprecated in favor of `await renderer.init()` + synchronous `render()`. |
| **`r182`** | **`PCFSoftShadowMap` deprecated in `WebGLRenderer`:** use `PCFShadowMap` instead, which is now soft by default and honors `light.shadow.radius`. |
| **`r183`** | **`Clock` deprecated in favor of `Timer`** (not used by Eden Ridge). `PostProcessing` renamed to `RenderPipeline`; `MeshPostProcessingMaterial` removed. |
| **`r184`** | Internal ES module cleanups, TSL node additions, and animation interpolant refinements. |
| **`r185`** | `WebGPURenderer` premultiplied alpha behavior updated. |
| **`r186`** | **`Object3D.dispose()` added to core:** custom subclasses of `Object3D` that define `.dispose()` should call `super.dispose()`. `PCFSoftShadowMap` removed in `WebGPURenderer`. `Source` renamed to `TextureSource`. `SimplifyModifier.modify()` is now `async` and meshoptimizer-based. `MeshPhysicalMaterial.iridescenceThicknessRange` split into `.iridescenceThicknessMinimum` / `.iridescenceThicknessMaximum`. |
| **`r187`** | **PMREM / IBL:** PMREMs now use cube render targets (`CubeUVReflectionMapping` removed; slight IBL appearance shift for envMaps). TSL math implicit type coercion, mipmap, and `GLTFExporter` cleanups; MMD modules deprecated. |

---

## 2. Inventory of How Eden Ridge Uses Three.js

### 2.1 Vendored Files (`dist/vendor/`)
- [dist/vendor/three.module.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/vendor/three.module.js#L6) (`1,326,016` bytes, `const REVISION = '160'`).
- [dist/vendor/GLTFLoader.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/vendor/GLTFLoader.js#L1-L69) (`108,527` bytes) — imports from `'./three.module.js'` (line 67) and `'./BufferGeometryUtils.js'` (line 68, `toTrianglesDrawMode`).
- [dist/vendor/BufferGeometryUtils.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/vendor/BufferGeometryUtils.js#L1-L12) (`31,918` bytes) — imports from `'./three.module.js'` (line 12). Only imported in runtime code by `dist/vendor/GLTFLoader.js:68`.

### 2.2 Every Import of Three.js Across `dist/`, `hub/`, and `scripts/`

| File & Line | Import / Injection Form | Three.js Symbols Used |
| :--- | :--- | :--- |
| [dist/apartment.js:2](file:///c:/Users/Michael/Documents/Projects/simproject/dist/apartment.js#L2) | `import * as T from './vendor/three.module.js'` | `BoxGeometry`, `Color`, `DirectionalLight`, `HemisphereLight`, `Mesh`, `MeshStandardMaterial`, `Scene`, `TorusGeometry` |
| [dist/camera.js:1](file:///c:/Users/Michael/Documents/Projects/simproject/dist/camera.js#L1) | `import * as THREE from './vendor/three.module.js'` | `Box3`, `Line3`, `MathUtils`, `Ray`, `Sphere`, `Vector3` |
| [dist/cargo-view.js:3](file:///c:/Users/Michael/Documents/Projects/simproject/dist/cargo-view.js#L3) | `import * as THREE from './vendor/three.module.js'` | `BoxGeometry`, `Color`, `CylinderGeometry`, `Group`, `InstancedMesh`, `Matrix4`, `MeshStandardMaterial`, `Quaternion`, `Vector3` |
| [dist/character.js:1-2](file:///c:/Users/Michael/Documents/Projects/simproject/dist/character.js#L1-L2) | `three.module.js` (`T`), `GLTFLoader.js` | `AnimationMixer`, `CapsuleGeometry`, `Group`, `MathUtils`, `Matrix4`, `Mesh`, `MeshStandardMaterial`, `Quaternion`, `Skeleton`, `SkinnedMesh`, `SphereGeometry`, `Vector3`, `GLTFLoader` |
| [dist/chop-path.js:1](file:///c:/Users/Michael/Documents/Projects/simproject/dist/chop-path.js#L1) | `import * as T from './vendor/three.module.js'` | `Vector3` |
| [dist/customer-truck.js:4](file:///c:/Users/Michael/Documents/Projects/simproject/dist/customer-truck.js#L4) | `import * as THREE from './vendor/three.module.js'` | *(Unused import; uses `createProp` and `createCargoView`)* |
| [dist/debris.js:5](file:///c:/Users/Michael/Documents/Projects/simproject/dist/debris.js#L5) | `import * as THREE from './vendor/three.module.js'` | `AddEquation`, `BufferAttribute`, `BufferGeometry`, `Color`, `CustomBlending`, `DynamicDrawUsage`, `OneFactor`, `OneMinusSrcAlphaFactor`, `Points`, `PointsMaterial` |
| [dist/doors.js:1](file:///c:/Users/Michael/Documents/Projects/simproject/dist/doors.js#L1) | `import * as T from './vendor/three.module.js'` | `BoxGeometry`, `Group`, `Mesh`, `MeshStandardMaterial` |
| [dist/driving.js:7](file:///c:/Users/Michael/Documents/Projects/simproject/dist/driving.js#L7) | `import * as THREE from './vendor/three.module.js'` | `CircleGeometry`, `DoubleSide`, `Group`, `MathUtils`, `Mesh`, `MeshBasicMaterial`, `RingGeometry`, `Vector3` |
| [dist/eastbank.js:6](file:///c:/Users/Michael/Documents/Projects/simproject/dist/eastbank.js#L6) | `import * as THREE from './vendor/three.module.js'` | `BoxGeometry`, `BufferGeometry`, `Float32BufferAttribute`, `Group`, `InstancedMesh`, `Matrix4`, `Mesh`, `MeshStandardMaterial`, `Quaternion`, `Vector3` |
| [dist/flatbed.js:5](file:///c:/Users/Michael/Documents/Projects/simproject/dist/flatbed.js#L5) | `import * as THREE from './vendor/three.module.js'` | `BufferAttribute`, `BufferGeometry`, `Group`, `Mesh`, `MeshBasicMaterial`, `MeshStandardMaterial` |
| [dist/fork-guide-view.js:3](file:///c:/Users/Michael/Documents/Projects/simproject/dist/fork-guide-view.js#L3) | `import * as THREE from './vendor/three.module.js'` | `BoxGeometry`, `Color`, `CylinderGeometry`, `DoubleSide`, `EdgesGeometry`, `Group`, `LineBasicMaterial`, `LineSegments`, `Mesh`, `MeshBasicMaterial`, `OctahedronGeometry`, `RingGeometry` |
| [dist/forklift-view.js:3](file:///c:/Users/Michael/Documents/Projects/simproject/dist/forklift-view.js#L3) | `import * as THREE from './vendor/three.module.js'` | `BoxGeometry`, `BufferAttribute`, `BufferGeometry`, `Group`, `InstancedMesh`, `Matrix4`, `Mesh`, `MeshStandardMaterial`, `Quaternion`, `Vector3` |
| [dist/fuel-station.js:3](file:///c:/Users/Michael/Documents/Projects/simproject/dist/fuel-station.js#L3) | `import * as THREE from './vendor/three.module.js'` | `BufferAttribute`, `BufferGeometry`, `CanvasTexture`, `DoubleSide`, `DynamicDrawUsage`, `Group`, `Mesh`, `MeshBasicMaterial`, `MeshStandardMaterial`, `PlaneGeometry`, `SRGBColorSpace`, `Vector3` |
| [dist/game.js:88](file:///c:/Users/Michael/Documents/Projects/simproject/dist/game.js#L88) | `import * as THREE from './vendor/three.module.js'` | `ACESFilmicToneMapping`, `AdditiveBlending`, `Box3`, `BoxGeometry`, `CanvasTexture`, `Color`, `CylinderGeometry`, `DirectionalLight`, `DoubleSide`, `ExtrudeGeometry`, `Fog`, `Group`, `HemisphereLight`, `InstancedMesh`, `MathUtils`, `Matrix4`, `Mesh`, `MeshBasicMaterial`, `MeshStandardMaterial`, `OctahedronGeometry`, `PCFSoftShadowMap`, `PerspectiveCamera`, `PlaneGeometry`, `Quaternion`, `RingGeometry`, `Scene`, `Shape`, `SRGBColorSpace`, `Vector2`, `Vector3`, `WebGLRenderer` |
| [dist/ground-cover-view.js:24](file:///c:/Users/Michael/Documents/Projects/simproject/dist/ground-cover-view.js#L24) | Injected `{THREE}` from `world.js` | `BufferAttribute`, `BufferGeometry`, `ClampToEdgeWrapping`, `DoubleSide`, `Group`, `InstancedBufferAttribute`, `InstancedMesh`, `LinearFilter`, `LinearMipmapLinearFilter`, `MeshStandardMaterial`, `ShaderChunk`, `Sphere`, `SRGBColorSpace`, `Texture`, `Vector3`, `Vector4` |
| [dist/house-signs.js:3](file:///c:/Users/Michael/Documents/Projects/simproject/dist/house-signs.js#L3) | `import * as THREE from './vendor/three.module.js'` | `BoxGeometry`, `CanvasTexture`, `Group`, `Mesh`, `MeshStandardMaterial`, `SRGBColorSpace` |
| [dist/indoor-camera.js:1](file:///c:/Users/Michael/Documents/Projects/simproject/dist/indoor-camera.js#L1) | `import * as T from './vendor/three.module.js'` | `Box3`, `MathUtils`, `Ray`, `Vector3` |
| [dist/interiors.js:4](file:///c:/Users/Michael/Documents/Projects/simproject/dist/interiors.js#L4) | `import * as THREE from './vendor/three.module.js'` | `Box3`, `Box3Helper`, `BoxGeometry`, `Color`, `DirectionalLight`, `Group`, `HemisphereLight`, `Mesh`, `MeshStandardMaterial`, `Scene` |
| [dist/item-models.js:1](file:///c:/Users/Michael/Documents/Projects/simproject/dist/item-models.js#L1) | `import * as THREE from './vendor/three.module.js'` | `BoxGeometry`, `BufferAttribute`, `BufferGeometry`, `CylinderGeometry`, `Group`, `IcosahedronGeometry`, `Mesh`, `MeshStandardMaterial` |
| [dist/marks.js:3](file:///c:/Users/Michael/Documents/Projects/simproject/dist/marks.js#L3) | `import * as THREE from './vendor/three.module.js'` | `BoxGeometry`, `CylinderGeometry`, `DoubleSide`, `InstancedMesh`, `Matrix4`, `Mesh`, `MeshBasicMaterial`, `MeshStandardMaterial`, `Quaternion`, `RingGeometry`, `Vector3` |
| [dist/menu-scene.js:5](file:///c:/Users/Michael/Documents/Projects/simproject/dist/menu-scene.js#L5) | `import * as THREE from './vendor/three.module.js'` | `AdditiveBlending`, `BackSide`, `BufferAttribute`, `BufferGeometry`, `CanvasTexture`, `CircleGeometry`, `Color`, `DataTexture`, `DirectionalLight`, `DoubleSide`, `Euler`, `Float32BufferAttribute`, `Fog`, `FrontSide`, `Group`, `HemisphereLight`, `InstancedMesh`, `LinearFilter`, `Matrix4`, `Mesh`, `MeshBasicMaterial`, `MeshLambertMaterial`, `MeshStandardMaterial`, `PerspectiveCamera`, `PlaneGeometry`, `Points`, `PointsMaterial`, `Quaternion`, `Scene`, `SpotLight`, `Sprite`, `SpriteMaterial`, `SRGBColorSpace`, `Vector3` |
| [dist/nature.js:4](file:///c:/Users/Michael/Documents/Projects/simproject/dist/nature.js#L4) | `import * as THREE from './vendor/three.module.js'` | `BufferAttribute`, `BufferGeometry`, `DoubleSide`, `MeshStandardMaterial`, `RepeatWrapping`, `SRGBColorSpace`, `Texture` |
| [dist/neighborhood.js:1](file:///c:/Users/Michael/Documents/Projects/simproject/dist/neighborhood.js#L1) | `import * as T from './vendor/three.module.js'` | `MathUtils` |
| [dist/night-lights.js:9](file:///c:/Users/Michael/Documents/Projects/simproject/dist/night-lights.js#L9) | `import * as THREE from './vendor/three.module.js'` | `AdditiveBlending`, `BufferAttribute`, `BufferGeometry`, `Color`, `DataTexture`, `DynamicDrawUsage`, `InstancedBufferAttribute`, `InstancedBufferGeometry`, `Matrix4`, `Mesh`, `NearestFilter`, `RGBAFormat`, `ShaderMaterial`, `SpotLight`, `Vector3` |
| [dist/office.js:5](file:///c:/Users/Michael/Documents/Projects/simproject/dist/office.js#L5) | `import * as T from './vendor/three.module.js'` | `BoxGeometry`, `CanvasTexture`, `Color`, `Group`, `Mesh`, `MeshBasicMaterial`, `MeshStandardMaterial`, `PlaneGeometry`, `SRGBColorSpace` |
| [dist/paint-shader.js:4](file:///c:/Users/Michael/Documents/Projects/simproject/dist/paint-shader.js#L4) | `import * as THREE from './vendor/three.module.js'` | `ClampToEdgeWrapping`, `DataTexture`, `NoColorSpace`, `RepeatWrapping`, `TextureLoader`, `Vector2`, `Vector3`, `Vector4` |
| [dist/pallet-geometry.js:4](file:///c:/Users/Michael/Documents/Projects/simproject/dist/pallet-geometry.js#L4) | `import * as THREE from './vendor/three.module.js'` | `BoxGeometry`, `BufferAttribute`, `BufferGeometry`, `Color` |
| [dist/pallet-tags.js:4](file:///c:/Users/Michael/Documents/Projects/simproject/dist/pallet-tags.js#L4) | `import * as T from './vendor/three.module.js'` | `CanvasTexture`, `InstancedBufferAttribute`, `InstancedMesh`, `LinearFilter`, `Matrix4`, `MeshBasicMaterial`, `PlaneGeometry`, `SRGBColorSpace`, `Vector3` |
| [dist/parcels.js:3](file:///c:/Users/Michael/Documents/Projects/simproject/dist/parcels.js#L3) | `import * as THREE from './vendor/three.module.js'` | `BoxGeometry`, `Group`, `Mesh`, `MeshStandardMaterial` |
| [dist/placeholders.js:3](file:///c:/Users/Michael/Documents/Projects/simproject/dist/placeholders.js#L3) | `import * as THREE from './vendor/three.module.js'` | `BoxGeometry`, `ConeGeometry`, `CylinderGeometry`, `ExtrudeGeometry`, `Group`, `Mesh`, `MeshStandardMaterial`, `Shape` |
| [dist/props.js:3](file:///c:/Users/Michael/Documents/Projects/simproject/dist/props.js#L3) | `import * as THREE from './vendor/three.module.js'` | `BufferAttribute`, `BufferGeometry`, `Color`, `DoubleSide`, `Group`, `InstancedMesh`, `Matrix4`, `Mesh`, `MeshBasicMaterial`, `MeshStandardMaterial`, `Quaternion`, `SRGBColorSpace`, `Texture`, `Vector3` |
| [dist/remote-player.js:1](file:///c:/Users/Michael/Documents/Projects/simproject/dist/remote-player.js#L1) | `import * as THREE from './vendor/three.module.js'` | `CapsuleGeometry`, `Mesh`, `MeshStandardMaterial` |
| [dist/rigged-props.js:5-6](file:///c:/Users/Michael/Documents/Projects/simproject/dist/rigged-props.js#L5-L6) | `three.module.js`, `GLTFLoader.js` | `Group`, `GLTFLoader` |
| [dist/sawdust.js:3](file:///c:/Users/Michael/Documents/Projects/simproject/dist/sawdust.js#L3) | `import * as THREE from './vendor/three.module.js'` | `BufferAttribute`, `BufferGeometry`, `DynamicDrawUsage`, `Points`, `PointsMaterial` |
| [dist/sawmill.js:4](file:///c:/Users/Michael/Documents/Projects/simproject/dist/sawmill.js#L4) | `import * as THREE from './vendor/three.module.js'` | `AnimationMixer`, `Color`, `InstancedMesh`, `LoopOnce`, `Matrix4`, `Quaternion`, `Vector3` |
| [dist/scene-editor.js:7](file:///c:/Users/Michael/Documents/Projects/simproject/dist/scene-editor.js#L7) | `import * as THREE from './vendor/three.module.js'` | `BoxGeometry`, `EdgesGeometry`, `GridHelper`, `Group`, `LineBasicMaterial`, `LineSegments`, `Matrix4`, `Quaternion`, `Vector3` |
| [dist/scene-overlay.js:3](file:///c:/Users/Michael/Documents/Projects/simproject/dist/scene-overlay.js#L3) | `import * as THREE from './vendor/three.module.js'` | `Group` |
| [dist/shadows.js:5](file:///c:/Users/Michael/Documents/Projects/simproject/dist/shadows.js#L5) | `import * as THREE from './vendor/three.module.js'` | `BufferAttribute`, `DynamicDrawUsage`, `InstancedBufferAttribute`, `InstancedBufferGeometry`, `InstancedMesh`, `Matrix4`, `Quaternion`, `ShaderChunk`, `ShaderMaterial`, `UniformsLib`, `UniformsUtils`, `Vector3` |
| [dist/shops.js:1](file:///c:/Users/Michael/Documents/Projects/simproject/dist/shops.js#L1) | `import * as T from './vendor/three.module.js'` | `BoxGeometry`, `Group`, `Mesh`, `MeshStandardMaterial` |
| [dist/shortbed.js:6](file:///c:/Users/Michael/Documents/Projects/simproject/dist/shortbed.js#L6) | `import * as THREE from './vendor/three.module.js'` | `BackSide`, `BufferAttribute`, `BufferGeometry`, `DoubleSide`, `Group`, `Mesh`, `MeshBasicMaterial`, `MeshStandardMaterial` |
| [dist/sky.js:5](file:///c:/Users/Michael/Documents/Projects/simproject/dist/sky.js#L5) | `import * as THREE from './vendor/three.module.js'` | `AdditiveBlending`, `BackSide`, `BufferAttribute`, `BufferGeometry`, `Color`, `CustomToneMapping`, `Mesh`, `Points`, `ShaderChunk`, `ShaderMaterial`, `SphereGeometry`, `Vector3` |
| [dist/smoke.js:4](file:///c:/Users/Michael/Documents/Projects/simproject/dist/smoke.js#L4) | `import * as THREE from './vendor/three.module.js'` | `BufferAttribute`, `BufferGeometry`, `CanvasTexture`, `Color`, `DynamicDrawUsage`, `Points`, `PointsMaterial`, `SRGBColorSpace` |
| [dist/tracks.js:4](file:///c:/Users/Michael/Documents/Projects/simproject/dist/tracks.js#L4) | `import * as THREE from './vendor/three.module.js'` | `BufferAttribute`, `BufferGeometry`, `Color`, `DynamicDrawUsage`, `Mesh`, `MeshBasicMaterial` |
| [dist/visuals.js:1](file:///c:/Users/Michael/Documents/Projects/simproject/dist/visuals.js#L1) | `import * as T from './vendor/three.module.js'` | `CanvasTexture`, `IcosahedronGeometry`, `Mesh`, `MeshStandardMaterial`, `RepeatWrapping`, `SphereGeometry`, `SRGBColorSpace` |
| [dist/warehouse.js:6](file:///c:/Users/Michael/Documents/Projects/simproject/dist/warehouse.js#L6) | `import * as T from './vendor/three.module.js'` | `Box3`, `BoxGeometry`, `Color`, `Group`, `InstancedMesh`, `Matrix4`, `Mesh`, `MeshStandardMaterial`, `Quaternion`, `Vector3` |
| [dist/water-chunks.js:91](file:///c:/Users/Michael/Documents/Projects/simproject/dist/water-chunks.js#L91) | Injected `THREE` from `world.js` | `BufferAttribute`, `BufferGeometry`, `Mesh` |
| [dist/water-cooler-view.js:3-4](file:///c:/Users/Michael/Documents/Projects/simproject/dist/water-cooler-view.js#L3-L4) | `three.module.js` (`T`), `GLTFLoader.js` | `DoubleSide`, `Group`, `GLTFLoader` |
| [dist/weld-game.js:1](file:///c:/Users/Michael/Documents/Projects/simproject/dist/weld-game.js#L1) | `import * as THREE from 'three'` (via importmap in [dist/weld-lab.html:19](file:///c:/Users/Michael/Documents/Projects/simproject/dist/weld-lab.html#L19)) | `AdditiveBlending`, `BufferAttribute`, `BufferGeometry`, `Color`, `DoubleSide`, `DynamicDrawUsage`, `LineBasicMaterial`, `LineSegments`, `Mesh`, `MeshBasicMaterial`, `Points`, `PointsMaterial`, `SphereGeometry` |
| [dist/weld-lab.js:1-2](file:///c:/Users/Michael/Documents/Projects/simproject/dist/weld-lab.js#L1-L2) | `import * as THREE from 'three'`, `GLTFLoader.js` | `ACESFilmicToneMapping`, `BoxGeometry`, `Color`, `DirectionalLight`, `DynamicDrawUsage`, `ExtrudeGeometry`, `Group`, `HemisphereLight`, `Mesh`, `MeshStandardMaterial`, `PerspectiveCamera`, `Plane`, `Raycaster`, `Scene`, `Shape`, `Vector2`, `Vector3`, `WebGLRenderer`, `GLTFLoader` |
| [dist/world.js:1](file:///c:/Users/Michael/Documents/Projects/simproject/dist/world.js#L1) | `import * as THREE from './vendor/three.module.js'` | `BoxGeometry`, `BufferAttribute`, `BufferGeometry`, `CanvasTexture`, `CircleGeometry`, `Color`, `ConeGeometry`, `CylinderGeometry`, `DoubleSide`, `DynamicDrawUsage`, `Float32BufferAttribute`, `Group`, `IcosahedronGeometry`, `InstancedBufferAttribute`, `InstancedMesh`, `LineBasicMaterial`, `LineLoop`, `LineSegments`, `Matrix4`, `Mesh`, `MeshBasicMaterial`, `MeshStandardMaterial`, `PlaneGeometry`, `Quaternion`, `RepeatWrapping`, `RingGeometry`, `SRGBColorSpace`, `Vector3` |
| [dist/item-studio.html:8](file:///c:/Users/Michael/Documents/Projects/simproject/dist/item-studio.html#L8), [dist/vehicle-studio.html:8](file:///c:/Users/Michael/Documents/Projects/simproject/dist/vehicle-studio.html#L8) | `import * as THREE from './vendor/three.module.js'` | `Box3`, `DirectionalLight`, `Group`, `HemisphereLight`, `MathUtils`, `PerspectiveCamera`, `Scene`, `Vector3`, `WebGLRenderer` |
| [hub/builders.js:5-6](file:///c:/Users/Michael/Documents/Projects/simproject/hub/builders.js#L5-L6), [hub/studio.html:8](file:///c:/Users/Michael/Documents/Projects/simproject/hub/studio.html#L8), [hub/viewer.html:40](file:///c:/Users/Michael/Documents/Projects/simproject/hub/viewer.html#L40) | `import * as THREE from '/dist/vendor/three.module.js'`, `GLTFLoader.js` | `Box3`, `BoxGeometry`, `DirectionalLight`, `GridHelper`, `Group`, `HemisphereLight`, `MathUtils`, `Mesh`, `MeshStandardMaterial`, `PerspectiveCamera`, `Scene`, `SphereGeometry`, `Vector3`, `WebGLRenderer`, `GLTFLoader` |

### 2.3 Custom Shaders, `ShaderChunk` Mutations & `onBeforeCompile` Hooks
1. **Global `ShaderChunk` Mutations (2):**
   - [dist/sky.js:11-19](file:///c:/Users/Michael/Documents/Projects/simproject/dist/sky.js#L11-L19): `installGrade()` replaces `/vec3 CustomToneMapping\( vec3 color \) \{[^}]*\}/` inside `THREE.ShaderChunk.tonemapping_pars_fragment` with `gradeGLSL()` from [dist/daynight.js:87-99](file:///c:/Users/Michael/Documents/Projects/simproject/dist/daynight.js#L87-L99).
   - [dist/shadows.js:11-17](file:///c:/Users/Michael/Documents/Projects/simproject/dist/shadows.js#L11-L17): `installShadowFade()` searches `THREE.ShaderChunk.shadowmap_pars_fragment` for `'float getShadow('` and replaces `'return shadow;'` with `FADE_GLSL` (`'return mix( 1.0, shadow, clamp( shadowRadius, 0.0, 1.0 ) );'` from [dist/shadow-rules.js:51](file:///c:/Users/Michael/Documents/Projects/simproject/dist/shadow-rules.js#L51)).
2. **`ShaderMaterial` Instances (5):**
   - [dist/sky.js:21-48](file:///c:/Users/Michael/Documents/Projects/simproject/dist/sky.js#L21-L48): `'sky-dome'` (`#include <tonemapping_fragment>`, `#include <colorspace_fragment>`).
   - [dist/sky.js:35-56](file:///c:/Users/Michael/Documents/Projects/simproject/dist/sky.js#L35-L56): `'sky-stars'` (`toneMapped: false`, `#include <colorspace_fragment>`).
   - [dist/shadows.js:19-41](file:///c:/Users/Michael/Documents/Projects/simproject/dist/shadows.js#L19-L41): `'blob-shadows'` (`fog: true`, `toneMapped: false`, `THREE.UniformsUtils.clone(THREE.UniformsLib.fog)`).
   - [dist/night-lights.js:18-32,64,75](file:///c:/Users/Michael/Documents/Projects/simproject/dist/night-lights.js#L18-L32): `'night-sprites'` and `'night-ground'` (`AdditiveBlending`, `#include <tonemapping_fragment>`, `#include <colorspace_fragment>`).
   - *(No `RawShaderMaterial` is used anywhere in the repo.)*
3. **`material.onBeforeCompile` Hooks (10):**
   - [dist/ground-shader.js:99-151](file:///c:/Users/Michael/Documents/Projects/simproject/dist/ground-shader.js#L99-L151): `patchGround()` on `MeshStandardMaterial` — replaces `#include <common>`, `#include <project_vertex>`, `#include <map_fragment>`, `#include <normal_fragment_maps>`, `#include <roughnessmap_fragment>`, `#include <emissivemap_fragment>`; sets `customProgramCacheKey = () => groundProgramKey(kind, high, !!box())`.
   - [dist/ground-cover-view.js:13-36](file:///c:/Users/Michael/Documents/Projects/simproject/dist/ground-cover-view.js#L13-L36): `patchCoverShader()` on `MeshStandardMaterial` — replaces `#include <common>`, `#include <beginnormal_vertex>`, `#include <begin_vertex>`, `#include <project_vertex>`, and replaces `'gl_FrontFacing ? 1.0 : - 1.0'` with `'1.0'` in `THREE.ShaderChunk.normal_fragment_begin`; sets `customProgramCacheKey = () => 'gd-cover'`.
   - [dist/paint-shader.js:17-52](file:///c:/Users/Michael/Documents/Projects/simproject/dist/paint-shader.js#L17-L52): `patchPaint()` (`customProgramCacheKey = () => 'vehicle-paint'`) and `patchGlass()` (`customProgramCacheKey = () => 'vehicle-glass'`) on `MeshStandardMaterial` — replaces `#include <common>`, `#include <begin_vertex>`, `#include <map_fragment>`.
   - [dist/world.js:185-208](file:///c:/Users/Michael/Documents/Projects/simproject/dist/world.js#L185-L208): `createSightlineFade()` on `MeshStandardMaterial` — replaces `#include <project_vertex>` (checks `#ifdef USE_INSTANCING`) and `#include <clipping_planes_fragment>`; sets `customProgramCacheKey = () => 'city-sightline-fade'`.
   - [dist/debris.js:47-61](file:///c:/Users/Michael/Documents/Projects/simproject/dist/debris.js#L47-L61): on `PointsMaterial` — replaces `#include <common>`, `#include <fog_vertex>`, `#include <opaque_fragment>`; sets `customProgramCacheKey = () => 'crash-debris'`.
   - [dist/tracks.js:14-22](file:///c:/Users/Michael/Documents/Projects/simproject/dist/tracks.js#L14-L22): on `MeshBasicMaterial` — replaces `#include <common>`, `#include <fog_vertex>`, `#include <opaque_fragment>`; sets `customProgramCacheKey = () => 'tyre-tracks'`.
   - [dist/smoke.js:39](file:///c:/Users/Michael/Documents/Projects/simproject/dist/smoke.js#L39): on `PointsMaterial` — replaces `#include <common>`, `'gl_PointSize = size;'`, and `#include <alphatest_fragment>`.
   - [dist/pallet-tags.js:40](file:///c:/Users/Michael/Documents/Projects/simproject/dist/pallet-tags.js#L40): on `MeshBasicMaterial` — replaces `#include <common>` and `#include <uv_vertex>` (writes `vMapUv` under `#ifdef USE_MAP`).
   - [dist/menu-scene.js:50-61](file:///c:/Users/Michael/Documents/Projects/simproject/dist/menu-scene.js#L50-L61): `windMaterial()` on `MeshLambertMaterial` — replaces `#include <begin_vertex>` (uses `#ifdef USE_INSTANCING`); sets `customProgramCacheKey = () => 'menu-cover'`.

### 2.4 Lights & Intensities
- **World scene ([dist/game.js:104](file:///c:/Users/Michael/Documents/Projects/simproject/dist/game.js#L104), driven by [dist/sky.js:63-80](file:///c:/Users/Michael/Documents/Projects/simproject/dist/sky.js#L63-L80) & [dist/daynight.js:18-62](file:///c:/Users/Michael/Documents/Projects/simproject/dist/daynight.js#L18-L62)):**
  - `HemisphereLight('#d8e8f0', '#777655', 1.7)` (animated down to `1.7 * NIGHT_FLOOR` = `0.204` at night, `1.7` at noon).
  - `DirectionalLight('#ffe3b9', 3.1)` (sun/moon; animated to `3.1 * NIGHT_FLOOR` = `0.372` at night, `3.1` at noon; `castShadow = true`, `shadow.mapSize = 2048×2048` in `game.js:104` and set to `SHADOW_MAP = 2048` / `SHADOW_BOX = 90` / `SHADOW_FAR = 130` in [dist/shadows.js:34](file:///c:/Users/Michael/Documents/Projects/simproject/dist/shadows.js#L34), `shadow.bias = -0.0005`).
- **Player Headlight ([dist/night-lights.js:115-120](file:///c:/Users/Michael/Documents/Projects/simproject/dist/night-lights.js#L115-L120), rules in [dist/night-lights-rules.js:116-120](file:///c:/Users/Michael/Documents/Projects/simproject/dist/night-lights-rules.js#L116-L120)):**
  - `SpotLight('#fff2d0', intensity=0..260, distance=48, angle=0.36, penumbra=0.9, decay=2)`, `castShadow = false` (High quality, night only).
- **Character Preview ([dist/game.js:1033](file:///c:/Users/Michael/Documents/Projects/simproject/dist/game.js#L1033)):** `HemisphereLight('#edf5e9', '#334f40', 2.7)`, `DirectionalLight('#fff0d6', 3)`.
- **Apartment ([dist/apartment.js:6](file:///c:/Users/Michael/Documents/Projects/simproject/dist/apartment.js#L6)):** `HemisphereLight('#fff1da', '#898878', 1.9)`, `DirectionalLight('#fff2da', 2)`.
- **House Interiors ([dist/interiors.js:132](file:///c:/Users/Michael/Documents/Projects/simproject/dist/interiors.js#L132)):** `HemisphereLight('#fff1da', '#898878', 1.9)`, `DirectionalLight('#fff2da', 1.8)`.
- **Menu Scene ([dist/menu-scene.js:13,70-71,137,143-144](file:///c:/Users/Michael/Documents/Projects/simproject/dist/menu-scene.js#L70-L71)):** `HemisphereLight('#eaf3f5', '#44553a', 1.5)` (plus `0.95` night fill), `DirectionalLight('#ffe2b8', 2.4)`, moon `DirectionalLight('#8fb0ff', 0..1.5)`, plus 2 headlamp `SpotLight('#ffe2a8', 0..55, distance=16, angle=0.62, penumbra=0.7, decay=1.4)`.
- **Weld Lab & Studios:** [dist/weld-lab.js:22-24](file:///c:/Users/Michael/Documents/Projects/simproject/dist/weld-lab.js#L22-L24) (`HemisphereLight` `1.9`, two `DirectionalLight`s `2.2` and `0.8`); [dist/item-studio.html:15](file:///c:/Users/Michael/Documents/Projects/simproject/dist/item-studio.html#L15) (`2.4`, `2.6`); [dist/vehicle-studio.html:15](file:///c:/Users/Michael/Documents/Projects/simproject/dist/vehicle-studio.html#L15) (`1.5`, `2.4`); [hub/studio.html:13](file:///c:/Users/Michael/Documents/Projects/simproject/hub/studio.html#L13) (`1.5`, `2.4`); [hub/viewer.html:51](file:///c:/Users/Michael/Documents/Projects/simproject/hub/viewer.html#L51) (`1.6`, `2.4`).

### 2.5 Color Space, Tone Mapping, Renderer, Textures, Fog & `renderer.info`
- **Renderer Settings ([dist/game.js:102-103](file:///c:/Users/Michael/Documents/Projects/simproject/dist/game.js#L102-L103), [1027](file:///c:/Users/Michael/Documents/Projects/simproject/dist/game.js#L1027), [1098-1100](file:///c:/Users/Michael/Documents/Projects/simproject/dist/game.js#L1098-L1100)):**
  - `new THREE.WebGLRenderer({canvas: $('world'), antialias: true, powerPreference: 'high-performance' | 'low-power'})`
  - `setPixelRatio(Math.min(devicePixelRatio, 1.6))` (High) or `1` (Low); `shadowMap.enabled = true` (High) / `false` (Low); `shadowMap.type = THREE.PCFSoftShadowMap`; `outputColorSpace = THREE.SRGBColorSpace`.
  - `toneMapping = THREE.ACESFilmicToneMapping` at [dist/game.js:103](file:///c:/Users/Michael/Documents/Projects/simproject/dist/game.js#L103), replaced by `THREE.CustomToneMapping` in `createSky()` ([dist/sky.js:44](file:///c:/Users/Michael/Documents/Projects/simproject/dist/sky.js#L44)), with `toneMappingExposure = 1.12` (`INDOOR_EXPOSURE = 1.12`, outdoors `1.0..1.12` before slider).
  - `setScissorTest`, `setScissor`, `setViewport`, `clearDepth` used for the character preview inset ([dist/game.js:1098-1101](file:///c:/Users/Michael/Documents/Projects/simproject/dist/game.js#L1098-L1101)).
  - No `logarithmicDepthBuffer` or post-processing (`EffectComposer`) used.
- **Textures:**
  - `SRGBColorSpace` used on all albedo `CanvasTexture`, `DataTexture`, and `Texture` objects (`fuel-station.js:72`, `game.js:114`, `ground-cover-view.js:30`, `house-signs.js:16`, `menu-scene.js:31,131`, `nature.js:25`, `office.js:16`, `pallet-tags.js:36`, `props.js:63`, `smoke.js:30`, `visuals.js:7`, `world.js:179`).
  - `NoColorSpace` used on non-color data/wear/crack textures in [dist/paint-shader.js:11](file:///c:/Users/Michael/Documents/Projects/simproject/dist/paint-shader.js#L11) and default on mask `DataTexture` in [dist/night-lights.js:43](file:///c:/Users/Michael/Documents/Projects/simproject/dist/night-lights.js#L43).
  - **Two unmarked `CanvasTexture`s:** [dist/world.js:532](file:///c:/Users/Michael/Documents/Projects/simproject/dist/world.js#L532) (`plotOverlay` white plot-ID label) and [dist/game.js:920](file:///c:/Users/Michael/Documents/Projects/simproject/dist/game.js#L920) (`beaconTexture` white gradient) leave default `NoColorSpace` (harmless because both are pure white + alpha on `MeshBasicMaterial`).
  - **Mipmaps / Filters:** [dist/ground-cover-view.js:30](file:///c:/Users/Michael/Documents/Projects/simproject/dist/ground-cover-view.js#L30) (`generateMipmaps=true`, `LinearMipmapLinearFilter`); `menu-scene.js:131`, `night-lights.js:43`, and `pallet-tags.js:36` explicitly set `generateMipmaps=false` with `LinearFilter` / `NearestFilter`.
- **Instancing & Meshes:**
  - Extensive `THREE.InstancedMesh` (`cargo-view.js`, `eastbank.js`, `forklift-view.js`, `game.js`, `ground-cover-view.js`, `marks.js`, `menu-scene.js`, `pallet-tags.js`, `props.js`, `sawmill.js:55,67`, `shadows.js:42`, `warehouse.js`, `world.js`) and `THREE.InstancedBufferGeometry` (`night-lights.js:59`, `shadows.js:37`).
  - `THREE.SkinnedMesh`, `THREE.Skeleton`, `THREE.AnimationMixer` (`character.js:37,141,180`, `sawmill.js:42`).
  - No `BatchedMesh` used.
- **Fog & `renderer.info`:**
  - `new THREE.Fog('#b9cbd0', 65, 155)` ([dist/game.js:101](file:///c:/Users/Michael/Documents/Projects/simproject/dist/game.js#L101)) and `new THREE.Fog('#a9c4cf', 14, 46)` ([dist/menu-scene.js:69](file:///c:/Users/Michael/Documents/Projects/simproject/dist/menu-scene.js#L69)).
  - `renderer.info` read at [dist/game.js:1693](file:///c:/Users/Michael/Documents/Projects/simproject/dist/game.js#L1693) (`renderer.info?.render.calls`, `renderer.info?.render.triangles`, `renderer.info?.programs?.length`) and [dist/weld-lab.js:264,304](file:///c:/Users/Michael/Documents/Projects/simproject/dist/weld-lab.js#L264).

---

## 3. Compatibility Matrix & Visual Parity Plan (`r160` → `r187`)

| API / Setting / Hook | Used At (`file:line`) | Status (`r160` → `r187`) | Changed In | Required Action / Fix |
| :--- | :--- | :--- | :--- | :--- |
| **`build/three.module.js` layout** | `dist/vendor/three.module.js` (imported by 47 `dist/*.js` files, 2 HTML studios, `hub/builders.js`, 49 tests) | **BEHAVIOUR CHANGED** | **`r168`** | `build/three.module.js` now re-exports `./three.core.js`. Copy **both** `build/three.module.js` and `build/three.core.js` into `dist/vendor/`. |
| **`ShaderChunk.shadowmap_pars_fragment` (`getShadow`)** | `dist/shadows.js:11-17,74`, `dist/shadow-rules.js:49-51`, `tests/shadows.mjs:70-83` | **BEHAVIOUR CHANGED (BREAKS TEST)** | **`r166`** | In `r166` (PR #28588), `getShadow()` integrates `shadowIntensity` and no longer ends with plain `return shadow;`, so `installShadowFade()` returns `false` and `tests/shadows.mjs` fails. **Fix:** either (a) use native `sun.shadow.intensity = plan.strength` (available since `r166`) and keep `sun.shadow.radius = 1`, or (b) match the updated `return` statement in `getShadow()`. Option (a) is cleaner and avoids `r182` radius blur side-effects. |
| **`THREE.PCFSoftShadowMap`** | `dist/game.js:103` | **DEPRECATED / BEHAVIOUR CHANGED** | **`r182`** | Deprecated in `r182` (`PCFShadowMap` is now soft by default and honors `shadow.radius`). Replace `THREE.PCFSoftShadowMap` with `THREE.PCFShadowMap` (and stop overloading `sun.shadow.radius` for fade strength). |
| **`ShaderChunk.tonemapping_pars_fragment` (`CustomToneMapping`)** | `dist/sky.js:11-19`, `dist/daynight.js:87-99`, `tests/daynight.mjs:104-110` | **UNCHANGED** | — | `vec3 CustomToneMapping( vec3 color ) { return color; }` remains in `tonemapping_pars_fragment`. Verify regex match during Stage 2 scratch test. |
| **`ShaderChunk.normal_fragment_begin` (`gl_FrontFacing`)** | `dist/ground-cover-view.js:22,35` | **UNCHANGED** | — | `gl_FrontFacing ? 1.0 : - 1.0` replacement still guards cleanly (`if (frontFacingChunk && frontFacingChunk.includes(...))`). |
| **All 10 `onBeforeCompile` chunk anchors** (`#include <common>`, `<begin_vertex>`, `<project_vertex>`, `<map_fragment>`, `<opaque_fragment>`, `<fog_vertex>`, `<alphatest_fragment>`, `<clipping_planes_fragment>`, `gl_PointSize = size;`, `<uv_vertex>`) | `ground-shader.js`, `ground-cover-view.js`, `paint-shader.js`, `world.js`, `debris.js`, `tracks.js`, `smoke.js`, `pallet-tags.js`, `menu-scene.js` | **UNCHANGED** | — | None of the game's materials mutate `material.type` (`r170`). Verify `tests/ground-shader.mjs` and shader compilation in Stage 2. |
| **`CapsuleGeometry(radius, length, capSegments, radialSegments)`** | `dist/character.js:109`, `dist/remote-player.js:5` | **BEHAVIOUR CHANGED (minor)** | **`r176`** | Positional args `(radius, height, capSegments, radialSegments)` work identically; only `.parameters.length` was renamed to `.parameters.height` (not read by the game). |
| **`GLTFLoader` + `BufferGeometryUtils`** | `dist/vendor/GLTFLoader.js`, `dist/vendor/BufferGeometryUtils.js` | **BEHAVIOUR CHANGED** | **`r176`** | Re-copy both from `three@0.187.0/examples/jsm/...` and apply the same two import-path rewrites (`'three'` → `'./three.module.js'`, `'../utils/BufferGeometryUtils.js'` → `'./BufferGeometryUtils.js'`). |
| **Texture mipmap generation (`generateMipmaps`)** | `ground-cover-view.js:30`, `pallet-tags.js:36`, `menu-scene.js:131`, `night-lights.js:43` | **BEHAVIOUR CHANGED** | **`r170`** | In `r170+`, mipmaps are always generated when `generateMipmaps = true` regardless of `minFilter`. `pallet-tags.js`, `menu-scene.js`, and `night-lights.js` already set `generateMipmaps = false`; other `CanvasTexture`s use default trilinear `minFilter` where mipmaps were already generated. |
| **Light intensities & ColorManagement** | `game.js`, `sky.js`, `night-lights.js`, `interiors.js`, `apartment.js`, `menu-scene.js` | **UNCHANGED** | — | `r160` already uses physically-based light units (`useLegacyLights` was removed in `r160`) and `SRGBColorSpace`. Light intensities require no rescaling. |
| **`WebGLRenderer` WebGL 2 requirement** | `dist/game.js:102` | **REMOVED (WebGL 1)** | **`r163`** | `r160` already defaulted to WebGL 2; WebGL 1 fallback was removed in `r163`. All target browsers and headless Edge SwiftShader support WebGL 2. |

### Expected Visual Changes & Parity Plan
1. **Shadow Softness & Low-Sun Shadow Fade (`r166` + `r182`):**
   - *What would change if unpatched:* In `r166+`, `installShadowFade()` fails silently (`faded = false`), so shadows would stay at 100% strength until the sun drops below the horizon and then pop off abruptly. In `r182+`, `PCFSoftShadowMap` is deprecated and `PCFShadowMap` uses `shadow.radius`, so setting `sun.shadow.radius = plan.strength` (`0..1`) would also vary shadow blur radius as the sun sets.
   - *Parity fix:* Set `sun.shadow.intensity = plan.strength` natively on the directional light in `dist/shadows.js`, keep `sun.shadow.radius = 1`, and use `THREE.PCFShadowMap`. Inspect shadow edge softness at `2048×2048` in Stage 3 and tune `sun.shadow.radius` once if needed.
2. **Direct Lighting, Sky Dome, Ground Shader & Custom Tone Mapping:**
   - **Zero expected shift.** Because `r160` was already past `SRGBColorSpace` and physical light units, and because Eden Ridge uses its own `CustomToneMapping` (`gradeGLSL()` in `daynight.js`) and no PMREM/IBL environment maps (`r187`), direct analytic lighting (`HemisphereLight` + `DirectionalLight` + `SpotLight`) and tone-mapped colors should match pixel-for-pixel outside shadow boundaries.

---

## 4. Tests That Pin Three.js Behaviour or Visual Numbers (`tests/*.mjs`)

Out of **49 test files** that import `../dist/vendor/three.module.js` (or `GLTFLoader.js`):

### 4.1 Tests That Will Break or Need Re-Pinning on Upgrade
1. **[tests/shadows.mjs:70-83](file:///c:/Users/Michael/Documents/Projects/simproject/tests/shadows.mjs#L70-L83) (HARD FAIL in `r166+`):**
   - Asserts `installShadowFade() === true` and `chunk.length === before.length - 'return shadow;'.length + FADE_GLSL.length` against `THREE.ShaderChunk.shadowmap_pars_fragment`. Must be updated when `shadows.js` switches to `sun.shadow.intensity` (or updates its `getShadow` match).
2. **[tests/daynight.mjs:104-110](file:///c:/Users/Michael/Documents/Projects/simproject/tests/daynight.mjs#L104-L110) (Verify on upgrade):**
   - Asserts `installGrade() === true` and `THREE.ShaderChunk.tonemapping_pars_fragment.includes(gradeGLSL())`. Passes as long as `CustomToneMapping` signature in `tonemapping_pars_fragment` is unchanged.
3. **[tests/ground-shader.mjs:28-125](file:///c:/Users/Michael/Documents/Projects/simproject/tests/ground-shader.mjs#L28-L125) (Verify on upgrade):**
   - Runs `m.onBeforeCompile(sh)` against the real `THREE.ShaderLib.standard.vertexShader` and `THREE.ShaderLib.standard.fragmentShader` and asserts `!vs.fragmentShader.includes('#include <map_fragment>')`.
4. **[tests/carry-game.mjs:21-22](file:///c:/Users/Michael/Documents/Projects/simproject/tests/carry-game.mjs#L21-L22), [tests/carry-real.mjs:18-19](file:///c:/Users/Michael/Documents/Projects/simproject/tests/carry-real.mjs#L18-L19), [tests/driving-game.mjs:21-22](file:///c:/Users/Michael/Documents/Projects/simproject/tests/driving-game.mjs#L21-L22), [tests/fuel-game.mjs:19-20](file:///c:/Users/Michael/Documents/Projects/simproject/tests/fuel-game.mjs#L19-L20), [tests/startup.mjs:19-20](file:///c:/Users/Michael/Documents/Projects/simproject/tests/startup.mjs#L19-L20) (Verify `three.core.js` resolution):**
   - Each overwrites `join(dir, 'vendor/three.module.js')` in a temporary copy of the packaged release with `export * from '${threeURL}'; export class WebGLRenderer ...`. Because `threeURL` points to `dist/vendor/three.module.js`, `dist/vendor/three.core.js` must sit alongside `dist/vendor/three.module.js` and be copied by `npm run release`.
5. **[tests/assets-server.mjs:15](file:///c:/Users/Michael/Documents/Projects/simproject/tests/assets-server.mjs#L15) & [tests/hub-commit.mjs:42](file:///c:/Users/Michael/Documents/Projects/simproject/tests/hub-commit.mjs#L42):**
   - Check `/dist/vendor/three.module.js` and `/dist/vendor/GLTFLoader.js` serving and commit-allow rules; add `/dist/vendor/three.core.js` to `tests/assets-server.mjs` once vendored.
6. **[dist/credits.js:19](file:///c:/Users/Michael/Documents/Projects/simproject/dist/credits.js#L19):**
   - Not asserted on exact version text by `tests/credits.mjs`, but hardcodes `{who:'three.js',what:'The 3D engine (r160).'}` and should be updated to `(r187)`.

### 4.2 Tests That Pin Draw Calls, Triangle Counts, or Mock Shader Strings (Safe / Pure Data)
- **Shader-hook string tests using synthetic shader inputs:** [tests/cover-view.mjs:7](file:///c:/Users/Michael/Documents/Projects/simproject/tests/cover-view.mjs#L7), [tests/cover-view-job.mjs:10](file:///c:/Users/Michael/Documents/Projects/simproject/tests/cover-view-job.mjs#L10), [tests/damage-feel.mjs:43](file:///c:/Users/Michael/Documents/Projects/simproject/tests/damage-feel.mjs#L43), [tests/damage-look.mjs:37-38](file:///c:/Users/Michael/Documents/Projects/simproject/tests/damage-look.mjs#L37-L38), [tests/ground-feel.mjs:28](file:///c:/Users/Michael/Documents/Projects/simproject/tests/ground-feel.mjs#L28), [tests/tracks.mjs:44](file:///c:/Users/Michael/Documents/Projects/simproject/tests/tracks.mjs#L44).
- **GLB / Geometry triangle & draw-call budget tests:** [tests/sawmill-asset.mjs:58-60](file:///c:/Users/Michael/Documents/Projects/simproject/tests/sawmill-asset.mjs#L58-L60) (`GLTFLoader().parseAsync`, draw calls `<= 30`, exact `trianglesBefore`), [tests/character.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/character.mjs), [tests/sawmill-rig.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/sawmill-rig.mjs), [tests/eastbank.mjs:74](file:///c:/Users/Michael/Documents/Projects/simproject/tests/eastbank.mjs#L74), [tests/culling.mjs:13](file:///c:/Users/Michael/Documents/Projects/simproject/tests/culling.mjs#L13), [tests/night-lights.mjs:113-156](file:///c:/Users/Michael/Documents/Projects/simproject/tests/night-lights.mjs#L113-L156), [tests/scene-overlay.mjs:72-94](file:///c:/Users/Michael/Documents/Projects/simproject/tests/scene-overlay.mjs#L72-L94), [tests/props.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/props.mjs), [tests/nature.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/nature.mjs), [tests/atv-import.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/atv-import.mjs), [tests/flatbed.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/flatbed.mjs), [tests/forklift.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/forklift.mjs), [tests/shortbed.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/shortbed.mjs), [tests/sr90-props.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/sr90-props.mjs), [tests/farm-houses.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/farm-houses.mjs), [tests/farm-props.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/farm-props.mjs), [tests/farm-tractors.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/farm-tractors.mjs).

---

## 5. Staged Upgrade Plan

### (a) Stage 1: Baseline Measurement Script (Before Touching Three.js)
Drive a scenario JSON (or thin wrapper using [scripts/browser-lab.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/scripts/browser-lab.mjs#L1-L61)) against `r160` in headless Edge (`1400×800`, `deviceScaleFactor: 1`).
- **Metrics recorded at startup + 5 fixed camera viewpoints** via `window.__city.renderer.info`:
  - `loadMs`: wall-clock ms until `window.__city` is ready.
  - `drawCalls`: `__city.renderer.info.render.calls`
  - `triangles`: `__city.renderer.info.render.triangles`
  - `programs`: `__city.renderer.info.programs.length`
  - `geometries`: `__city.renderer.info.memory.geometries`
  - `textures`: `__city.renderer.info.memory.textures`
  - `frameMs`: median & p95 of 30 `requestAnimationFrame` intervals (measured in a normal GPU browser as well as SwiftShader if tracking relative deltas).
  - `screenshot`: PNG per spot + ground-patch mean/spread via `browser-lab.mjs`'s `measure` mode.
- **5 Fixed Camera Spots:**
  1. `spawn-noon` — Oak Street spawn (`minutes: 720`, `MAP.spawn`): buildings, trees, sightline fade, PCF shadows.
  2. `eastbank-noon` — Eastbank warehouse & yards (`minutes: 720`): dense instanced props & pallets.
  3. `forest-sawmill-dusk` — Pine Ridge sawmill (`minutes: 1095`): rigged sawmill GLB, forest `InstancedMesh`es, low-sun shadow fade, warm sky lobe.
  4. `farm-river-noon` — Willow Fields & river (`minutes: 720`): ground-cover tufts/crops (`gd-cover`), ground shader (`GD1`–`GD3`), water chunks.
  5. `town-night` — Alder Street at night (`minutes: 1380`): `night-sprites`, `night-ground`, window emissive masks, stars, `NIGHT_FLOOR` grade, player `SpotLight`.

### (b) Stage 2: Upgrade in a Scratch Copy
1. In an isolated branch or folder copy, fetch `three@0.187.0` into a temp directory (`npm pack three@0.187.0`).
2. Copy into `dist/vendor/`:
   - `build/three.module.js` → `dist/vendor/three.module.js`
   - `build/three.core.js` → `dist/vendor/three.core.js` *(new file required by `r168+`)*
   - `examples/jsm/loaders/GLTFLoader.js` → `dist/vendor/GLTFLoader.js` (rewrite `'three'` → `'./three.module.js'` and `'../utils/BufferGeometryUtils.js'` → `'./BufferGeometryUtils.js'`)
   - `examples/jsm/utils/BufferGeometryUtils.js` → `dist/vendor/BufferGeometryUtils.js` (rewrite `'three'` → `'./three.module.js'`)
3. Update code for `r166` / `r182`:
   - `dist/game.js:103` (shared file — owner/main-chat edit): `THREE.PCFSoftShadowMap` → `THREE.PCFShadowMap`.
   - `dist/shadows.js` & `tests/shadows.mjs`: use `sun.shadow.intensity = plan.strength` natively (`r166+`) instead of mutating `THREE.ShaderChunk.shadowmap_pars_fragment` via `sun.shadow.radius`.
   - `dist/credits.js:19`: `(r160)` → `(r187)`.
   - `scripts/build-characters.mjs:4,9` & `scripts/build-props.mjs:5,115`: update tool comments from `three@0.160.0` to `three@0.187.0`.

### (c) Stage 3: Compare Step
1. Run `npm run release -- --force` and `npm test` (verify all suites pass, especially `shadows.mjs`, `daynight.mjs`, `ground-shader.mjs`, `damage-feel.mjs`, `damage-look.mjs`, `sawmill-asset.mjs`, `startup.mjs`, and `assets-server.mjs`).
2. Re-run the 5-spot baseline scenario on the `r187` build and compare against the `r160` baseline:
   - `drawCalls`, `triangles`, `geometries`, and `textures` must match cleanly at all 5 spots.
   - `programs` count must match (no accidental shader recompilation or duplicate program keys).
   - Diff the 5 PNG pairs with `window.__diff`: inspect shadow edges on `spawn-noon` and fade behavior on `forest-sawmill-dusk` to verify `PCFShadowMap` + `sun.shadow.intensity` visual parity.
   - Smoke-test `dist/weld-lab.html`, `dist/item-studio.html`, `dist/vehicle-studio.html`, and `hub/viewer.html`.

### (d) Stage 4: `dist/vendor/` & Release Packaging (`scripts/package-release.mjs`)
- **Zero packaging changes needed:** [scripts/package-release.mjs:23](file:///c:/Users/Michael/Documents/Projects/simproject/scripts/package-release.mjs#L23) (`(await readdir('dist/vendor')).filter(f => f.endsWith('.js'))`), [scripts/build-launcher.mjs:13](file:///c:/Users/Michael/Documents/Projects/simproject/scripts/build-launcher.mjs#L13) (`cpSync(..., 'vendor', {recursive: true})`), and [hub/server.js:47](file:///c:/Users/Michael/Documents/Projects/simproject/hub/server.js#L47) (`/^\/dist\/(vendor\/)?[A-Za-z0-9._-]+\.(js|json|png|jpg)$/`) already copy and serve every top-level `.js` file in `dist/vendor/`, so `dist/vendor/three.core.js` is handled automatically.
- [scripts/build-index.mjs:23](file:///c:/Users/Michael/Documents/Projects/simproject/scripts/build-index.mjs#L23) already ignores `'dist/vendor/'`, so `three.core.js` costs **0 index tokens**.

### (e) Stage 5: The WebGPU Question (`WebGPURenderer` in `r187`)
- **Is `WebGPURenderer` ready as an upgrade target for Eden Ridge?** **No.** While `WebGPURenderer` (`build/three.webgpu.js`) works well for greenfield TSL (`NodeMaterial`) scenes in `r187`, it is **not** a drop-in replacement for Eden Ridge's GLSL customization pipeline.
- **What would break immediately under `WebGPURenderer`:**
  1. **All 10 `material.onBeforeCompile` hooks stop working** (`ground-shader.js`, `ground-cover-view.js`, `paint-shader.js`, `world.js` sightline fade, `debris.js`, `tracks.js`, `smoke.js`, `pallet-tags.js`, `menu-scene.js`); every one would have to be rewritten in TSL (`three/tsl`).
  2. **Both `THREE.ShaderChunk` mutations (`sky.js` `CustomToneMapping` and `shadows.js` `getShadow`) are ignored** because `WebGPURenderer` compiles WGSL/GLSL from TSL node graphs, not `ShaderChunk` strings.
  3. **All 5 raw GLSL `THREE.ShaderMaterial`s (`sky-dome`, `sky-stars`, `blob-shadows`, `night-sprites`, `night-ground`) must be rewritten as TSL `NodeMaterial`s.**
  4. **Async initialization:** `WebGPURenderer` requires `await renderer.init()` before `.render()` (`r181+`), breaking synchronous renderer mocks in `tests/carry-game.mjs`, `tests/carry-real.mjs`, `tests/driving-game.mjs`, `tests/fuel-game.mjs`, and `tests/startup.mjs`.
- **Recommendation:** **Stay on `WebGLRenderer`** for the `r160` → `r187` upgrade. It upgrades cleanly with minimal code changes (`shadows.js`, `game.js` shadow map enum, `three.core.js` vendored) while preserving all 17 custom GLSL shaders/hooks and all tests. Revisit `WebGPURenderer` only as a dedicated future TSL rewrite if WebGPU-only capabilities are needed.
