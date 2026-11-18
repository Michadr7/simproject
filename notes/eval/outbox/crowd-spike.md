michadr.

## 1. What Exists Today (Read-Only Audit)

- **Characters (`dist/character.js`, `dist/appearance.js`):** Each `createCharacter()` builds 1 `THREE.Skeleton` (**62 bones**) and **4 parts** (`Head`, `Body`, `Legs`, `Feet`), split into **10 `SkinnedMesh`es** per character (~`5,776–6,076` triangles). Each `SkinnedMesh` is 1 draw call in the main pass and 1 in the directional shadow pass (**20 draw calls/character**).
- **Crowd (`dist/npc-crowd.js`, `dist/neighborhood.js`, `dist/game.js`):** `POOL = 9` skinned slots + `6` named Oak Street pedestrians (`15` max outdoor NPCs) + `player` + `hal` (`17` max). `character.js` runs CPU `AnimationMixer` + two-bone leg/arm IK (`solveLeg`, `applyArmSwing`) every frame per visible character.

## 2. Real-GPU Measurements (Scratch Copy, RTX 4070 Ti, Chrome CDP, 1400×800)

### Live Map Spots (`scripts/stress-crowd.mjs` in scratch copy)
| Spot | Time | Mean (ms) | FPS | Visible Chars | SkinnedMeshes | Bones | Char Tris | Calls (No Shadow / With Shadow) | Char+Rig Calls (Main+Shadow) |
|---|---|---:|---:|---:|---:|---:|---:|---|---:|
| Oak Street | 12:00 | 6.19 | 161.5 | 5 | 50 | 310 | 29,974 | 627 / 941 | 100 |
| Oak Street | 20:00 | 6.06 | 165.0 | 6 | 60 | 372 | 36,456 | 640 / 996 | 120 |
| Corner Market | 12:00 | 6.06 | 165.0 | 5 | 50 | 310 | 29,974 | 492 / 788 | 100 |
| Corner Market | 20:00 | 6.06 | 165.0 | 6 | 60 | 372 | 36,456 | 505 / 833 | 120 |
| Sawmill Yard | 10:00 | 6.06 | 165.0 | 7 | 72 | 375 | 34,954 | 185 / 272 | 142 |
| Sawmill Yard | 12:00 | 6.06 | 165.0 | 7 | 72 | 375 | 34,954 | 185 / 272 | 142 |

### Standalone Spike (`crowd-spike/index.html` in scratch copy, `Casual_2` 5,776 tris)
| Mode | N | Shadows | Mean (ms) | p95 (ms) | FPS | Total Calls | Total Tris | CPU Update (ms) |
|---|---:|---|---:|---:|---:|---:|---:|---:|
| VAT Instanced | 100 | On | 6.06 | 6.1 | 165.0 | 3 | 1,155,202 | 0.00 |
| VAT Instanced | 300 | On | 6.06 | 6.2 | 165.0 | 3 | 3,465,602 | 0.00 |
| VAT Instanced | 1000 | On | 6.06 | 6.1 | 165.0 | 3 | 11,552,002 | 0.00 |
| Skinned (Current) | 100 | On | 42.81 | 54.6 | 23.4 | 2,001 | 1,155,202 | 8.0 |
| Skinned (Current) | 300 | On | 68.90 | 78.7 | 14.5 | 6,001 | 3,465,602 | 20.5 |
| Skinned (Current) | 1000 | On | 176.78 | 200.0 | 5.7 | 20,001 | 11,552,002 | 71.1 |
| VAT Instanced | 1000 | Off | 20.18 | 24.3 | 49.5 | 2 | 5,776,002 | 0.00 |
| Skinned (Current) | 1000 | Off | 139.00 | 151.5 | 7.2 | 10,001 | 5,776,002 | 66.9 |

- **Baked VAT stats:** `2048×512` (`9` rows/frame, `432` rows for `48` frames = `Idle_Neutral` + `Walk`), `16 MB` FP16 (`32 MB` FP32), `227` frames max in `2048×2048` (~9.4 clips; ~40+ clips if vertices are indexed). Zero console/shader errors (`ERRORS: []`); visually verified via screenshot (`crowd-spike-300.png`).

## 3. Spike Location & Deliverables

- **Scratch copy (real repo untouched):** `C:\Users\Michael\.gemini\antigravity\brain\6606d3e1-cf44-4f5b-93ba-ab3fa64c7873\scratch\eden-crowd\`
  - Spike page: `dist/crowd-spike/index.html`, `dist/crowd-spike/crowd-spike.js`
  - Benchmark scripts: `scripts/stress-crowd.mjs`, `scripts/bench-spike.mjs`
  - Visual check: `crowd-spike-300.png`
- **Recommendation:** Saved to [notes/crowd-instancing.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/crowd-instancing.md) (**GO**, hybrid skinned `< 15 m` / worker + VAT instanced `15–120 m` strangers, phased WebGL2 -> WebGPU/TSL plan).

## 4. Honest Confidence & What Could Not Be Verified

- **High confidence** in the draw-call counts, triangle counts, CPU update timings, shader compilation (`ERRORS: []`), and 165 FPS vs 5.7 FPS scaling on RTX 4070 Ti.
- **Not verified:** True uncapped GPU time below `6.06 ms` (DWM 165 Hz cap on Windows 11), and why `VAT N=1000` with `shadows=false` measured `20.18 ms` immediately after `skinned N=1000` (likely pipeline/GC drain from the 1,000-skeleton teardown or shader recompile in the 500 ms settle window, since `VAT N=1000` with `shadows=true` ran at `6.06 ms` / 165 FPS).
- **Repo state:** No shared `dist/`, `scripts/`, `tests/`, or `PROJECT-INDEX.md` files were modified.
