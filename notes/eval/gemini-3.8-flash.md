# Model Evaluation Report: Gemini 3.8 Flash

- **Model Name**: Gemini 3.8 Flash
- **Wall-Clock Time**: ~19 minutes
- **Files Read**: 11 distinct files (19 targeted line-range reads, 0 whole-file reads)
- **Repo Rules**: No edits to `dist/`, `scripts/`, or existing tests; no `git` executed; BOM-free UTF-8 files written only in `notes/eval/` and `tests/eval/`.

---

## TASK 1: Tow Service Call Flow (Read and Explain)

When the player clicks a vehicle's tow button in the phone Call app (`choose(uid)` in `dist/phone-call.js`), it invokes `onTow(uid)` wired in `dist/game.js`.

In `dist/game.js`, `towCall(uid)` runs. It probes feasibility with `towTo` using a state copy (`GameState.progress` merged with `driving.save()`). Since the player is currently driving the vehicle (`drivenNow` is true), `towCall` forces the player out via `driving.leave(() => false)`, returns any fuel nozzle (`fuel.putBack()`), and resets inputs/camera.

Next, `garageDo` executes `towTo` in `dist/garage.js`. `towTo` verifies ownership, confirms the vehicle is not already in the shop/bay, and assesses fee (or applies `hardLuck` for a free tow + auto-repair via `startRepair`). It updates coordinates to `bayPose()` (`MAP.garage.pose`), deducts cash, and returns `{state, fee, appear, message}`.

`garageDo` applies `state` to `GameState.progress`, invokes `garageSync(appear)` to relocate the vehicle mesh via `driving.place`, and persists. In `towCall`, `placeSafely` teleports the player on foot to the shop counter (`MAP.garage.counter`).

**Uncertainties**: `towCall` does not pass `drivenUid` into `towTo` options (unlike `pullOut`), and the player's teleportation occurs without a visual fade while the phone Call app stays open in 'done' state.

---

## TASK 2: Crop Growth Pure Module & Tests

- **Pure Module**: `notes/eval/crop-growth.mjs`
- **Test File**: `tests/eval/crop-growth.test.mjs`

### Test Execution Output
```
PASS crop-growth.test.mjs: 14 test cases covering stages 0..3, ripeness, hoursToNext, negative elapsed time, exact boundaries, huge values, fertilised rate, and all season multipliers.
```

---

## TASK 3: Bug Hunt (At Most 5 Ranked Bugs)

### 1. `dist/garage.js:146` — Negative Cash Rejects Free Pull-Outs (High)
- **Failing Example**:
  If a player qualifies for `hardLuck` or `pullFreeWeekly` (`free === true`, `fee === 0`), but has negative cash (e.g. `p.cash = -50` cents due to rental or automated charges), line 146 checks:
  `if((p.cash||0)<fee) return fail(...)`
  Since `-50 < 0` is true, the free pull-out fails with: `"A pull-out costs $0.00: you have -$0.50. Rock it with W and S, or wait a few seconds."`
  (Contrast with line 127 in `towTo` which correctly includes `!free &&`).
- **Proposed Fix**:
  `if(!free&&(p.cash||0)<fee)return fail(...)`

### 2. `dist/surface-table.js:53, 55, 56` — `stepBog` Inconsistency with `FIRM_BELOW` (High)
- **Failing Example**:
  Line 43 defines `FIRM_BELOW = .1`, which classifies ground with `sink < 0.1` (such as `GRASS`, where `SINK[S.GRASS] = 0.05`) as firm ground. `vehicle.js:142` and `driving.js:131` rely on this definition.
  However, `stepBog` explicitly tests `sink === 0`. Consequently, on grass:
  1) When stuck, `sink === 0` is false, so `BOG_FALL_FIRM` (0.5/s) does not engage.
  2) When driving with throttle under 2 m/s, `sink > 0` is true, causing bog to accumulate (`bogRate * dt`) on open grass.
- **Proposed Fix**:
  Replace `sink === 0` with `sink < FIRM_BELOW` (and `sink > 0` with `sink >= FIRM_BELOW`) in `stepBog`.

### 3. `dist/garage.js:159` — Vehicle in Shop Bay Quotes Tow Fee Instead of Refusing (Medium)
- **Failing Example**:
  When a vehicle is parked in the shop bay (`inBay(v) === true`) but not in the shop, `statusOf` calculates `tow: towFee(v, bayPose())` ($75+). `phone-call.js` displays the button as enabled. Clicking it invokes `towTo`, which immediately rejects on line 125 with `"The ... is already at the shop."`.
- **Proposed Fix**:
  In `statusOf`, check `inBay(v)`: if `inBay(v)` is true, return `tow: null` or set an appropriate status.

### 4. `dist/phone-calls.js:38` — `null` Tow Fee Formats as `$0.00` (Medium)
- **Failing Example**:
  If `o.tow` is `null` (e.g. from `statusOf` when an option has no valid quote) and `o.inShop` is false, `towLabel(o)` evaluates `(null/100).toFixed(2)` which returns `"0.00"`. The label displays `"Tow to the repair shop · $0.00"` instead of indicating that a tow is unavailable.
- **Proposed Fix**:
  Check `if (o.tow == null) return 'Unavailable';` before number formatting.

### 5. `dist/garage.js:87, 129` — `state.cash` Becomes `NaN` When `p.cash` is Undefined (Low/Medium)
- **Failing Example**:
  If `p.cash` is undefined in state and a free repair or free tow executes (`cents = 0` or `fee = 0`), lines 85 and 127 pass because `(p.cash || 0) < fee` is false. However, lines 87 and 129 evaluate `cash: p.cash - fee`, resulting in `undefined - 0 === NaN`.
- **Proposed Fix**:
  Use `cash: (p.cash || 0) - fee` and `cash: (p.cash || 0) - cents`.

---

## TASK 4: Road Network Geometry Verification

Full report saved to `notes/eval/roads-check.md`.

Summary of Flagged Rows (> 10% discrepancy):
1. **Row 10 (Farm road + Ranch Lane)**:
   - Stated: `lane 250`
   - Start `farmGate (-164, -160)` to `P7 (-300, -330)`
   - Computed: $\sqrt{(-136)^2 + (-170)^2} = \sqrt{47396} \approx 217.71$ m
   - Discrepancy: $12.92\%$ (**FLAGGED**)
2. **Row 11 (West Bank Lane)**:
   - Stated: `410`
   - Direct straight line from Oak St west `(-58.5, 5)` to `P3 (-390, -100)`: $\sqrt{(-331.5)^2 + (-105)^2} \approx 347.73$ m (Discrepancy: $15.19\%$, **FLAGGED**).
   - Via West Bank Bridge at `(-330, 5)`: $271.50 + 120.93 = 392.43$ m (Discrepancy: $4.29\%$, within 10%).
3. **Row 12 (Pine track)**:
   - Stated: `200`
   - Start Woods Road end `(195, -250)` (shifted $z = n(-180) = -250$) to `P8 (100, -520)`
   - Computed: $\sqrt{(-95)^2 + (-270)^2} = \sqrt{81925} \approx 286.23$ m
   - Discrepancy: $43.12\%$ (**FLAGGED**)

---

## TASK 5: Stage FV3 Build Plan

Full plan saved to `notes/eval/fv3-plan.md`.

Summary of Plan:
- 12 concise steps covering constants, hitch reach predicate, single-axle tractrix step, 30/60/165 Hz frame-rate invariance, jackknife limits, clearance verification at $\pm 70^\circ$, reverse assist exponential decay, towed load derating, combination collision bisection, trailer vehicle class (`CLASSES.tow_tank`), liquid/bulk bed definitions (`BEDS`), and cargo validation/load factor.
- Top 3 risks addressed: numerical singularity at $H \approx A$ ($\text{atan2}(0,0)$), oscillatory jackknife flutter during forward clamping, and collision bisection state desynchronization.

---

## TASK 6: Headless Blender GLB Inspection

- **Script**: `notes/eval/glb-report.py`
- **Executable**: `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`
- **Target Asset**: `assets-src/Farm/sr90/bale_round_hay.glb`

### Command Executed
`& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b -P notes\eval\glb-report.py`

### Output
```
--- GLB REPORT ---
File: bale_round_hay.glb
Triangles: 1622
Material count: 2
Bounding box size (m): 1.272 x 1.452 x 1.504 (W x D x H / X x Y x Z)
------------------
```

---

## RESULTS TABLE

| Task | Model | Minutes | Confidence % | Passed / Failed / Skipped | One-Line Note |
|---|---|---|---|---|---|
| TASK 1: Tow Flow Explanation | Gemini 3.8 Flash | 3.5 | 95% | Passed | Accurate call-chain traced across phone-call.js, game.js, and garage.js under 200 words. |
| TASK 2: Crop Growth Module | Gemini 3.8 Flash | 4.0 | 100% | Passed | Created pure module & test with 14 test cases; verified pass via node. |
| TASK 3: Bug Hunt | Gemini 3.8 Flash | 4.5 | 95% | Passed | Found 5 concrete bugs with line numbers, failing examples, and fixes. |
| TASK 4: Road Geometry Check | Gemini 3.8 Flash | 3.0 | 100% | Passed | Verified all 12 rows in Section 6.1; flagged rows 10, 11 (direct), and 12 with arithmetic. |
| TASK 5: FV3 Build Plan | Gemini 3.8 Flash | 2.5 | 95% | Passed | 12-step plan with files, functions, tests, and top 3 risks saved to notes/eval/fv3-plan.md. |
| TASK 6: Blender GLB Report | Gemini 3.8 Flash | 1.5 | 100% | Passed | Headless Blender 5.2 executed glb-report.py; reported 1622 triangles, 2 materials. |
