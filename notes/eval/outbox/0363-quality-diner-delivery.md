michadr.

# 0.36.3 quality switch, diner cup, and bakery routes

- Updated `dist/game.js` (2,075 lines) to hold the diner cup at the animated left hand and limit explicit material invalidation to the GLSL path.
- Updated `dist/vendor/three.webgpu.js` (53,718 lines) to refresh lighting and shadow keys before async compilation.
- Extended `tests/diner-game.mjs` (87 lines) with in-hand placement and serve visibility checks. Added zero test files.
- Updated `notes/handoff.md` (430 lines) and created this report (47 lines). Rebuilt `dist/releases/0.36.3` and generated release metadata. The public version endpoint returned 0.36.2 before rebuilding. Protected files required no edits.

## WebGPU

On the traced RTX 4070 Ti run, the baseline High → Low gap was 1,194 ms. Chrome recorded an 811 ms WebGPU command-buffer flush in the GPU process during that gap. The Low → High run showed a 506 ms flush. The baseline could still generate synchronous draw-time pipelines because async compilation reused a lighting and shadow key cached by the previous render.

| WebGPU switch | Peak gap without cache refresh | Peak gap with cache refresh | Synchronous pipelines before → after |
| --- | ---: | ---: | ---: |
| High → Low | 1030.3 ms | 72.7 ms | 64 → 2 |
| Low → High | 363.7 ms | 72.8 ms | 40 → 1 |

Both comparison runs used pipeline logging and the same automated pickup route with staged Eastbank entry. The traces are under `%TEMP%/eden-quality-trace-gDtCN7` in `baseline`, `targeted`, and `lighting-refresh`. Confidence is high in the reproduced cause and the improvement on this route. Other adapters and uninstrumented live play remain unverified.

## Diner and deliveries

The diner check used a staged espresso customer and the actual pickup and serve actions. The cup stayed within 7 cm of the left wrist while standing and moving. I inspected the pre-serve screenshot. Serving succeeded and hid the mesh.

The bakery checks started at Wholesale with eligible demand and an owned pickup. After accepting and loading through the phone and E prompt, I used movement and steering keys for the entire delivery leg. The sack was walked to the bakery. The truck drove via Ironwood Street and the cross street. Both paid and cleared their cargo.

```text
espresso-after-serving {"served":1,"table":"eating","tipCents":300,"meshVisible":false}
log {"payout":8230,"carry":null,"stock":{"flour":0,"coffee-beans":1}}
driven-pallet-delivery {"payout":7645,"cargo":null,"stock":{"flour":4,"coffee-beans":0}}
```

The lobby protocol currently syncs player position, pet snapshots, and clock. Bakery needs and claims live in individual saves. A shared claim requires the planned host-authority work. Confidence is high in the single-player route and current protocol reading. A shared co-op claim and the Station View feature remain open.

## Verification

The browser scenarios exited successfully. The packaged diner and WebGPU ground tests passed with the known fake-DOM ground-cover warning (Image is not defined). The repository runner passed all 306 Three.js test files with the 26 Hub files filtered out. The local playtest and relay ports were verified closed.

```text
Packaged release 0.36.3: 273 files -> dist/releases/0.36.3
PASS needs: one need opens, hysteresis, claims + lapse, pro-rata fills, conservation, over-fill pays nothing, expiry (late fill, mood, prosperity, price), cap, determinism, slot shape, pay, no clock/chance
PASS diner-game.mjs: hired at Elena on day 1 and clocked in through the talk; order taken, collected at the pass, served with a $0.50-$3.00 tip, table cleared; wage + pieces + tips + $10 x rank bonus paid at clock-out; a forgotten order costs -2 rep and the tip but never wages; promoted to Barista & Cook after 2 counted shifts; an old cafe-employed save loads as a Rank 1 diner employee.
PASS webgpu-ground-quality.mjs: live high->low->high rebuilt 55 TSL ground materials (55 meshes), disposed old materials, updated groundProgramKey, preserved polygonOffset, and reused the materials when reselecting the current tier.
PASS brief.mjs: brief tests passed: 272 modules listed, brief 2840 and index 34961 estimated tokens (budgets 3000 and 37000)
ALL 306 PASSED
All 306 test files passed.
```
