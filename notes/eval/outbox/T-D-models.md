michadr.

# T-D Timber Models Report (Hydrogen)

Created 4 low-poly timber GLBs, the `.blend` source, the shared 256x256 atlas PNG, and 4 turntable preview PNGs in `assets-src/timber/` using Blender 5.2.3 LTS. No `dist/` files, `ASSETS.md`, or `assets-register.json` were modified; no tests or index runs were executed.

## Deliverables in `assets-src/timber/`
- `timber_models.blend` (97,475 bytes) — Blender source containing all 4 models, shared `TimberAtlasMat` material, and `timber_atlas.png`.
- `timber_atlas.png` (65,113 bytes, 256x256 PNG) — 4 quadrants: Pine Bark (downscaled from CC0 `assets-src/Landscape/Stylized Nature MegaKit[Standard]/Textures/Bark_NormalTree.png`), procedural cut End-Grain with growth rings, pale sawn Pine wood, and dark bark/knot accent.
- `trunk.glb` (74,248 bytes) — `preview_trunk.png`
- `logs2.glb` (70,880 bytes) — `preview_logs2.png`
- `slab.glb` (70,008 bytes) — `preview_slab.png`
- `boards4.glb` (69,968 bytes) — `preview_boards4.png`

## Sizes, Triangle Counts & Code Discrepancies
All models are Y-up in exported GLB (built Z-up in Blender with `export_yup=True`), metres, transforms applied, 1 material (`TimberAtlasMat`), no lights/cameras/animations, all well under the 600-triangle limit:

| Model | Triangles | Exported Size (X x Y x Z m) | Notes |
|---|---|---|---|
| `trunk.glb` | **140** | `2.300 x 0.350 x 0.363` | 2.30 m long (+X), ~0.34 m diameter (slight natural taper) + 3 stub knots, origin at base centre on ground (`Y=0`). |
| `logs2.glb` | **72** | `1.150 x 0.240 x 0.468` | Pair of touching logs side by side (`1.15 m` x `0.24 m` dia each, matching `cargo.js:16` `l:1.15, h:0.24` and `sawmill-pile.js:43`). |
| `slab.glb` | **56** | `2.300 x 0.060 x 0.360` | Live-edge slab lying flat (`Y=0`), curved bark sides (`+-1.2 cm` organic wave), pale sawn top/bottom, cut end-grain ends. |
| `boards4.glb` | **48** | `1.200 x 0.465 x 0.450` | **Code-winning dimensions** (see below): 4 boards, each `1.20 m x 0.45 m x 0.105 m`, stacked at `0.12 m` pitch. |

### Prompt vs Code Discrepancy (Code Wins)
- **`boards4.glb`:** The prompt listed `1.15 m x 0.14 m x 0.03 m`, whereas `dist/carry.js:20, 29` (`PLANK_LENGTH = 1.2`, "1.2 m long, 0.45 m wide") and `dist/sawmill-pile.js:8-9` (`PLANK_WIDTH = 0.45, PLANK_PITCH = 0.12`, 4 boards = `0.48 m` stack height) define the in-game plank stack as **`1.20 m x 0.45 m x 0.48 m`**. Built to match the code (`1.200 x 0.465 x 0.450 m` with `0.105 m` board thickness + `0.015 m` seam gap per `sawmill.js:30` `PLANK_THIN`).
- **`trunk.glb` / `slab.glb`:** `2.30 m` (`2 x LOG_LENGTH = 1.15 m`) matches `cargo.js` flatbed/shortbed fit (`shortbed` bed length `2.45 m` at `cargo.js:26`).

## What Could Not Be Verified
- Models were visually verified via the 4 Blender EEVEE preview PNGs (`preview_*.png`); they have not yet been loaded into Three.js / `scripts/build-props.mjs` (deferred to Sonnet stage T-D).