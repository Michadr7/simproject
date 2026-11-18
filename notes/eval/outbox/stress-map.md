michadr.

Browser: Chrome/157.0.8103.79 (C:/Program Files/Google/Chrome/Application/chrome.exe)
WebGL GPU: ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti (0x00002782) Direct3D11 vs_5_0 ps_5_0, D3D11) (Google Inc. (NVIDIA))
Startup to playable: 3095 ms
Console errors: 3
- Failed to load resource: the server responded with a status of 404 (Not Found)
- Failed to load resource: the server responded with a status of 404 (Not Found)
- Failed to load resource: the server responded with a status of 404 (Not Found)

## Spot Measurements (10 s after 3 s warm-up)

| Spot | Time | Mean (ms) | p95 (ms) | Max (ms) | FPS | Calls | Tris | Progs | Tex | Geom | Heap (MB) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Spawn | 12:00 | 6.32 | 6.2 | 18.2 | 158.3 | 528 | 3971037 | 78 | 48 | 724 | 175.6 |
| Oak Street | 12:00 | 6.65 | 12.1 | 24.2 | 150.3 | 627 | 3083404 | 78 | 86 | 1017 | 156.9 |
| Corner Market | 12:00 | 6.12 | 6.2 | 18.2 | 163.4 | 788 | 4003716 | 78 | 89 | 1041 | 164.9 |
| Ridgeline Warehouse | 12:00 | 6.07 | 6.2 | 12.2 | 164.8 | 256 | 3239389 | 79 | 95 | 1062 | 111.3 |
| Sawmill Yard | 12:00 | 6.08 | 6.2 | 12.2 | 164.4 | 272 | 6161970 | 82 | 98 | 1101 | 150.5 |
| Pine Ridge Forest | 12:00 | 6.06 | 6.1 | 6.2 | 165 | 227 | 7846549 | 82 | 98 | 1120 | 113.7 |
| Willow Fields (Farm) | 12:00 | 6.06 | 6.1 | 6.2 | 165 | 124 | 6793717 | 82 | 99 | 1128 | 123.1 |
| County Bridge | 12:00 | 6.06 | 6.1 | 6.2 | 165 | 138 | 5332729 | 82 | 100 | 1127 | 108.9 |
| Lake Shore | 12:00 | 6.06 | 6.2 | 6.5 | 165 | 91 | 5040322 | 82 | 100 | 1063 | 103.3 |
| Estuary / Coast | 12:00 | 6.06 | 6.2 | 6.2 | 165 | 132 | 1794767 | 82 | 100 | 1083 | 124.6 |
| Far East Edge | 12:00 | 6.06 | 6.2 | 6.2 | 165 | 53 | 2765781 | 82 | 100 | 1057 | 108.9 |
| Spawn | 20:00 | 6.11 | 6.2 | 12.2 | 163.8 | 532 | 3982059 | 82 | 101 | 1115 | 127.1 |
| Oak Street | 20:00 | 6.48 | 12.1 | 12.3 | 154.4 | 974 | 3172758 | 82 | 102 | 1133 | 111 |
| Corner Market | 20:00 | 6.15 | 6.2 | 12.3 | 162.7 | 813 | 4023826 | 82 | 102 | 1147 | 117.4 |
| Ridgeline Warehouse | 20:00 | 6.06 | 6.2 | 12.1 | 164.9 | 152 | 3196763 | 82 | 102 | 1141 | 119.9 |
| Sawmill Yard | 20:00 | 6.06 | 6.2 | 6.2 | 165 | 149 | 5790398 | 82 | 102 | 1134 | 100.9 |
| Pine Ridge Forest | 20:00 | 6.06 | 6.1 | 6.2 | 165 | 108 | 7409209 | 82 | 102 | 1153 | 108.9 |
| Willow Fields (Farm) | 20:00 | 6.06 | 6.1 | 6.3 | 165 | 167 | 7014721 | 82 | 102 | 1143 | 115.7 |
| County Bridge | 20:00 | 6.06 | 6.2 | 6.2 | 165 | 141 | 5343369 | 82 | 102 | 1140 | 120.6 |
| Lake Shore | 20:00 | 6.06 | 6.1 | 6.2 | 165 | 64 | 5032872 | 82 | 102 | 1077 | 103.4 |
| Estuary / Coast | 20:00 | 6.06 | 6.1 | 6.2 | 165 | 135 | 1805407 | 82 | 102 | 1097 | 101 |
| Far East Edge | 20:00 | 6.06 | 6.2 | 6.2 | 165 | 56 | 2776421 | 82 | 102 | 1071 | 105.8 |

## Chunk Boundary Hitch Test (Driving)

Drove from x=212 to x=248.28 (z=68): mean 6.06 ms, p95 6.2 ms, max single frame 6.2 ms (165 FPS).

## Worst 3 Spots

1. **Oak Street (12:00)** — mean 6.65 ms, p95 12.1 ms, max 24.2 ms, 627 draw calls, 3,083,404 triangles. Likely cause: dense downtown buildings, street furniture, shopfronts, NPCs, and shadow-pass draw calls (first time visiting downtown also triggers shader/texture uploads and occasional 2–4× vsync misses up to 24.2 ms).
2. **Oak Street (20:00)** — mean 6.48 ms, p95 12.1 ms, max 12.3 ms, 974 draw calls, 3,172,758 triangles. Likely cause: highest draw-call count on the map (974 calls, +347 over noon) from night streetlamps, lit building windows, and vehicle lights added on top of downtown geometry.
3. **Spawn (12:00)** — mean 6.32 ms, p95 6.2 ms, max 18.2 ms, 528 draw calls, 3,971,037 triangles. Likely cause: first spot measured after startup, looking north up Westside/Oak Street with ~4M triangles and initial shader/chunk warm-up causing a 3-frame (18.2 ms) spike.

## Notes & What Could Not Be Verified

- **165 Hz vsync cap**: Chrome on Windows 11 remained capped at the display's 165 Hz (6.06 ms/frame) via DWM even with `--disable-gpu-vsync`, so true uncapped GPU headroom below 6.06 ms is not visible — instead, draw calls, triangle counts, and missed-vsync spikes (12.1–24.2 ms) show where the ceiling is approached.
- **Chunk boundary hitch test**: Driving east from `x=212` for 8 s reached `x=248.28` (1.72 m short of the `x=250` chunk boundary), so crossing `x=250` while driving was not verified in that run.
- **Console 404s**: 3 `404 (Not Found)` resource errors appeared during startup/run (likely missing optional/favicon or asset URLs); no JS exceptions occurred.
- **Files & tests**: Created `scripts/stress-map.mjs` (194 lines) and `tests/stress-map.mjs` (16 lines). `node tests/stress-map.mjs` passed; `npm run index` and `node tests/brief.mjs` passed (brief 2834/3000, index 33134/34000). No forbidden shared files were edited.
