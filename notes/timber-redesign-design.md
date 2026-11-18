# Timber Redesign & Logging Tutorial Design (0.35.20+)

Read-only design for the Timber Redesign (`notes/eval/prompts/gemini-timber-design.md`), covering the trunk -> log -> board/slab chain, sawmill shed layout, job/workforce rework, save migration, co-op impact, draw-call budget, natural wood assets, logging tutorial graphic, and staged build plan.

> **Note on line citations:** Line numbers for `dist/game.js`, `dist/world-tick.js`, `dist/supply.js`, and `dist/careers.js` were read while Opus W3 + P-D wiring was in flight and may shift after W3 lands.

---

## 1. Core Item & Process Chain

1. **Fell (`grid.js:77-101`):** Chopping a pine drops **1 Trunk** (twice a log's size and weight) instead of `logsPerTree` loose logs.
2. **Buck (`grid.js` + `tools.js`):** Cut a Trunk on the ground with an **Axe** or **Chainsaw** into **2 Logs**. Chainsaw is significantly faster than an axe. Existing `log` (1.15 m, 0.24 m diameter) stays unchanged.
3. **Saw (`sawmill-yard.js`, `sawmill.js`):**
   - **1 Log -> 4 Boards (Planks)** (unchanged).
   - **1 whole Trunk -> 2 Slabs** (new product: sold at its own price and reserved as a building material for later construction).
4. **Warehouse Machine Hook (Future):** Dowels, beams, and posts will be crafted later at `ridgeline-warehouse` from uncut **Logs** (`items.js` / `world-goods.js` placeholder product IDs `dowels`, `beams`, `posts` in `PRODUCTS` only; no machine or recipe UI built now).

---

## 2. Data Model Changes

### 2.1 Carry & Hands (`dist/carry.js`, `dist/cargo-items.js`)
- **`carry.js:14-16` (`HANDS_SPEED`, `HANDS_LOAD`, `CARRY_KINDS`):**
  - Add `trunk`: `speed: 0.6` (60%, no sprint), `load: 1.8`. Uses the existing shoulder-carry animation (`LOG_HOME`, `LOG_HAND`, `LOG_POLE` at `carry.js:30`).
  - Add **2-Log carry**: `carry` supports `{kind:'log', count:1|2}` (default `count: 1` for old saves). Carrying 2 logs uses `speed: 0.9` (90%, no sprint; see **Owner Question 1** regarding 1-log `0.8` vs 2-log `0.9`), `load: 1.6`.
  - Add `slab`: `speed: 0.8` (no sprint), `load: 1.3`.
- **Ground & Drops:**
  - `grid.js:58-71`: `progress.logs` entries gain optional `kind: 'trunk' | 'log'` (default `'log'`), preserving `MAX_LOGS = 80` and `LOG_LIFETIME = 2880`.
  - `carry.js:47-54`: `plankDrops` stays for boards; add `slabDrops` (max 12, same `quarterOf` & `unstick` rescue rules) or generalize `plankDrops` entries with optional `kind: 'slab'`.
- **`cargo-items.js:11-19, 49, 104-126`:** Add `trunk` and `slab` to `ITEM_KINDS`, `KIND_ORDER`, `isTimber`, and `toCargo`/`fromCargo`/`fromCarry`.

### 2.2 Vehicle Beds & Load Drag (`dist/cargo.js`, `dist/load-drag.js`)
- **`cargo.js:15-19` (`CARGO_KINDS`):**
  - `log`: unchanged (`space: 5, h: 0.24, l: 1.15`).
  - `planks`: unchanged (`space: 1, h: 0.4, l: 1.25`).
  - `trunk` (new): `{name:'trunk', plural:'trunks', space:10, h:0.36, l:2.25}` (2x log space/length).
  - `slab` (new): `{name:'slab', plural:'slabs', space:2, h:0.20, l:2.25}` (2 slabs = 4 space).
- **`cargo.js:21-27, 32` (`BEDS`, `capacity`):**
  - `flatbed` (space 120): **12 trunks** or 24 logs or 120 planks or 60 slabs.
  - `shortbed` (space 44): **4 trunks** or 8 logs or 44 planks or 22 slabs.
  - `worktruck` / `offroad` (space 32): **3 trunks** or 6 logs or 32 planks or 16 slabs.
  - `atv` (space 5, `maxPieces: 1`): **refuses `trunk`** (`space 10 > 5`); holds 1 log, 1 plank stack (4), or 1 slab.
- **`load-drag.js:7, 12` (`MASS_KG`):**
  - Add `trunk: 80` (2x `log: 40`), `slab: 25`. `usesLoadDrag` (`cargo.js:29`) only triggers on `atv`, while larger trucks use `vehicle.js` `withLoad(loadOf)`.

### 2.3 Sawmill Yard (`dist/sawmill-yard.js`)
- Bump `YARD_VERSION = 2`. State shape:
  `{v:2, trunks, logs, trunksSawn, logsSawn, planks, slabs, cutMin, cutKind, on, lastTrickleDay}`
- Caps: `YARD_MAX_TRUNKS = 20`, `YARD_MAX_LOGS = 40`, `YARD_MAX_PLANKS = 160`, `YARD_MAX_SLABS = 80`.
- `feed(state, count, kind = 'log')`: accepts `'log'` or `'trunk'`.
- `tick(state, dtGameMin)`: saws waiting `logs` into `LOGS_TO_PLANKS` (4 planks) and waiting `trunks` into `TRUNK_TO_SLABS` (2 slabs). Both use `SAW_MIN_PER_LOG` (`plank-economy.js:39`, 4 game min = 8 real sec) — or `1.25 * SAW_MIN_PER_LOG` for trunks.
- Add `takeSlab(state)` alongside `takeStack(state)` (`sawmill-yard.js:67-72`).

### 2.4 Tools & Skills (`dist/tools.js`, `dist/skills.js`)
- **`tools.js:13-19` (`SAWS`):** Add bucking rates:
  - `axe` / `logging-axe` / `steel-axe`: `buckHitsFor(id, level)` = 4 / 3 / 2 swings (using `hitsFor` formula).
  - `chainsaw` (tier 1, `items.js:30` lv 15) / `logging-chainsaw` (tier 2, `items.js:31` lv 20): `buckTimeSec(id)` = **1.2 s** / **0.8 s** (single hold/action, no multi-swing).
- **`skills.js:23` (`logsPerTree`):** Currently `2 + (lv>=3?1:0) + (lv>=8?1:0)`. With 1 tree = 1 Trunk -> 2 Logs, keep `trunksPerTree = 1` and convert the lv 3 / lv 8 perk to faster bucking/chopping speed (or yield a 3rd/4th log on buck at lv 3/8 — see **Owner Question 2**).

### 2.5 Prices & Economy (`dist/world-goods.js`, `dist/plank-economy.js`)
- **`world-goods.js:12` (`GOODS`):** Add `trunks` (`baseCents: 2800`) and `slabs` (`baseCents: 1800`). Existing `logs: 1500`, `planks: 900` unchanged.
- **`plank-economy.js:65-71` (`PAY`):**
  - `fellTree: 300` (unchanged), `buckTrunk: 100` (new: axe/chainsaw trunk -> 2 logs), `logToSaw: 120`, `trunkToSaw: 150`, `plankOffBelt: 25`, `slabOffBelt: 40`, `plankDelivered: 730`, `slabDelivered: 1400`, `rackCell: 500`.
  - Level-1 by-hand cycle stays >= +20% above best existing hands-on job (`WAGE_MARGIN_PCT = 20`, `plank-economy.js:73`).

---

## 3. Sawmill Shed Anchor & Pile Layout

### 3.1 Why the Near Shed Deck Looked Empty
- `dist/map-definition.js:478` places `sawmill-v4` at `(104, -278)` with `yaw: -Math.PI/2`.
- `assets-src/assets/sawmill_spec.md:12-14` defines two decks:
  - **Main deck:** `8.6 x 6.6 m` (`x: -4.3..4.3, z: -3.3..3.3, y: 0.30`). Bench is at `z: -0.6..0.6`; player/switch are at `+z` (`world.x < 104`, facing the woods lane).
  - **Shed deck:** `3.6 x 4.6 m` (`x: 4.6..8.2, z: -2.3..2.3, y: 0.20`), which holds the **conveyor** centred at `x = 6.4` (`anchor_belt_0..3`, planks `2.4 m` wide spanning `x = 5.2..7.6`) between shed posts at `x = 4.8` and `8.0`.
- `dist/sawmill-pile.js:10` anchored `PILE_BOX` at `x: -3.725..3.725, z: -2.775..-1.125` — the **far/back strip of the Main deck** (`-z` -> `world.x ~ 106`), leaving the **Shed deck** (`x = 6.4`) and near side empty. Because the conveyor occupies `x = 5.2..7.6` on the Shed deck, a 40-stack pile does **not** fit beside the belt on the Shed deck itself.

### 3.2 Recommended 3-Zone Layout (Model Coords)
1. **BOARDS (Planks) Area — Main Deck Back-East (`x: 0.2..3.7, z: -2.775..-1.125, y: 0.30`):** Closest to the conveyor output (`x = 6.4`); 3 crossed layers of `3 cols x 3 rows` + `7 cols` + `3 x 2` = ~21 stacks (84 planks) or 4 layers = 120+ planks, clear of posts (`x = 0, 4, z = -3`) and `ROOF_CLEAR = 2.38`. *(Alternative: an adjacent ground pad just south/east of the Shed deck at `x: 8.5..11.5, z: -2.3..2.3` if we want full 160-plank capacity beside `anchor_belt_clear`.)*
2. **SLABS Area — Main Deck Back-West (`x: -3.7..-0.2, z: -2.775..-1.125, y: 0.30`):** Opposite side of the shed from Boards; holds up to 40–80 slabs (`2.25 m` or `1.2 m` wide) in crossed/flat stacks with its own pickup prompt.
3. **LOG STORAGE — Feed End Ground Deck (`x < -4.3`):**
   - **Logs:** existing nested deck at `LOG_X = -5.05, z: -0.4..-3.27` (`sawmill-pile.js:43`), trimmed to `LOG_ROWS = [8, 7, 6, 5]` (26+ logs) or kept at 42.
   - **Trunks:** adjacent nested deck at `x = -5.5, z: 0.4..2.8` (clear of static `PileLog_*` and `anchor_switch` at `(-4, 0.3, 3.9)`), or parallel at `x = -6.8, z: -0.4..-3.0`, holding 20 trunks (`2.25 m` long).

---

## 4. Job Chain, Ranks & Workforce Rework

### 4.1 Quest & Shift Tasks (`dist/shift.js`, `dist/map-definition.js:409-415`)
- **Removed:** `landing` (`Carry n logs to the landing`, `shift.js:14`) and `gather` (`Gather n fallen logs`, `shift.js:15`) are retired/reworked.
- **New Logging Chain Tasks:**
  1. `fell` (Rank 1 Trainee, lv 1, `$8/hr`): `Fell n marked pines` (`300 c`/tree) — drops a Trunk.
  2. `buck` (Rank 1 Trainee, lv 1): `Cut n trunks into logs` (`100 c`/trunk) — teaches axe/chainsaw bucking.
  3. `feed_saw` (Rank 2 Feller, lv 3, `$10/hr`): `Bring n logs or trunks to the sawmill` (`120 c`/log, `150 c`/trunk) — fills Sawmill Log Storage.
  4. `mill` (Rank 2 Feller, lv 3): `Saw n boards or slabs` (`25 c`/board, `40 c`/slab off belt).
  5. `haul` (Rank 3 Hauler, lv 5, `$12/hr`): `Deliver n boards or slabs to the lumberyard` (`730 c`/board, `1400 c`/slab) + `load`.
  6. `stack` / `pick` (Rank 4 Yard hand, lv 7, `$14/hr`), `deliver` / `replant` (Rank 5 Sawyer, lv 10, `$16/hr`), `foreman` (Rank 6, lv 15, `$18/hr`, unlocks `chainsaw` store).
- **Starter Story (`dist/starter.js`):** Verified lines `1-132`: `starter.js` only mentions `ridgeline` (Walt's office for Hal's note) and `crates`/`groceries` — **no starter story steps mention logs** and none need editing.

### 4.2 Workforce Integration (`notes/workforce-design.md`, `dist/workforce-tick.js`, `dist/workforce-pose.js`)
- Keep existing daily totals: **4 logs/day -> 16 planks/day** + **6/day trickle** (`WORKFORCE_LOGS_PER_DAY = 4`, `TRICKLE_PER_DAY = 6`, `WORKFORCE_YARD_CAP = 48`).
- **Feller #1 (Peter Brennan) & Feller #2 (Tom Reyes):** Visually fell **2 trunks/day** in `markedBlocks(day)[0]` (2 trunks = 4 logs/day), buck or haul to Sawmill Log Storage (`anchor_log_in`) instead of `LANDING` (`workforce-pose.js:46-50`).
- **Sawyer (Priya Nair):** Saws the 4 logs into 16 boards/day and stacks them on the **Boards** side of the shed (`workforce-pose.js:52-58`). Workforce does **not** saw trunks into slabs or craft warehouse dowels/beams/posts — those remain player-driven.
- **Warehouse (`ridgeline-warehouse`):** Continues receiving hauled boards (and later slabs/logs for the warehouse machine).

---

## 5. Save Migration, Co-op Sync & Performance Budget

### 5.1 Save Migration (`dist/jobs.js:44-50`, owned by Opus)
- Additive fields, no breaking wipe:
  - `progress.carry`: `{kind:'log'}` stays valid (normalized as `count: 1`); `{kind:'log', count:2}`, `{kind:'trunk'}`, `{kind:'slab'}` added.
  - `progress.logs`: existing `{id, x, z, rot, t}` entries default to `kind: 'log'`.
  - `progress.vehicles[].cargo`: existing `{k:'log'}` and `{k:'planks', n, o?}` stay valid; `{k:'trunk'}` rejected on `atv` in `normalizeCargo`.
  - `progress.sawmillYard`: `normalizeYard` upgrades `v:1` (`logs, planks`) -> `v:2` (`trunks:0, logs, slabs:0, planks`).
  - `progress.tutorial`: `{loggingSeen: false}` added; existing saves with `careers.ridgeline` shifts > 0 can default `loggingSeen: false` so veterans see the new diagram once.

### 5.2 Co-op Sync Impact (`dist/relay-protocol.js`, `dist/multiplayer.js`)
- `relay-protocol.js` (`PROTOCOL = 1`) currently broadcasts only `{x, y, z, yaw}` and `clock` (`day, minutes`).
- **Zero breakage today.** When co-op carry/world sync (`DESIGN 4.17`) is wired, add a 1-byte/enum `carryKind` (`none|log|logs2|trunk|planks|slab|crate|parcel|box`) to the player pose message (fits well inside `MAX_MESSAGE_BYTES = 4096`).

### 5.3 Draw-Call & Material Budget
- **New InstancedMeshes:** `yard-trunks` (20 max), `yard-slabs` (80 max), `ground-trunks` (40 max).
- **Draw calls:** **+3 draw calls** total (beyond the existing `yard-pile` and `yard-logs` from `OPUS-sawmill-pile.md`).
- **Materials:** **+2 shared `MeshStandardMaterial`s** (trunk bark+endgrain, slab bark-edge+sawn face).
- **Shadows:** `yard-trunks` and `yard-slabs` use `castShadow = false, receiveShadow = true` (matching `yard-pile` in `game.js:432`), costing **0 shadow-pass draws**. `ground-trunks` uses `castShadow = true` (same as `ground-logs` in `world.js:564`).

---

## 6. Natural Wood Looks (Asset Audit)

### 6.1 Existing Repo Assets (`ASSETS.md`, `assets-src/`)
- **Bark textures (CC0):** `assets-src/Landscape/Stylized Nature MegaKit[Standard]/Textures/Bark_NormalTree.png` (+ `Bark_DeadTree.png`, `Bark_TwistedTree.png` + Normal maps) — already wired as `nature.logBark` (`dist/nature.js:36`).
- **Sawmill materials (`sawmill-v4`):** `Bark`, `EndGrain`, `Plank`, `Timber`, `Timber_Dark` (`sawmill_spec.md:71`).
- **Log prop (`props-assets.js`):** `polypizza/Wood_Log.glb` (202 tris, `ASSETS.md:62`) — currently decor only; ground/carried logs use an 8-sided cylinder (`world.js:563`).

### 6.2 Online Candidates (Name & Licence Only, No Downloads)
- **Poly Haven** (`Pine Bark`, `Wood Planks`, `Rough Wood`) — **CC0 1.0** (free, no credit).
- **ambientCG** (`Wood` / `Planks` / `Tree End` cross-section PBR) — **CC0 1.0**.
- **Kenney Survival Kit / Nature Kit** (logs, fallen trunks, wood props, GLB) — **CC0 1.0**.
- **Quaternius Ultimate Nature / Fantasy Props MegaKit** (cut logs, lumber, GLTF) — **CC0 1.0**.
- **Fab** (free low-poly `"wood log"`, `"lumber"`, `"wood slab"` GLB packs) — **Fab Standard License**.
- **Own Blender GLBs (Recommended):** Author 4 lightweight GLBs (Trunk, 2-Log Bundle, Live-Edge Slab, Board Stack) baking a shared 256 px bark + end-grain + heartwood atlas — **no credit required**, exact `cargo.js` & `sawmill-pile.js` dimensions.

---

## 7. Logging Tutorial Graphic (`dist/logging-tutorial.js`)

- **Module:** New pure data + DOM overlay `dist/logging-tutorial.js` (no `three.js`, no globals), styled in `style.css`, mount `#logging-tutorial` in `index.html`.
- **Trigger & Persistence:** Pops up automatically the first time `clockIn` succeeds for `employer === 'ridgeline'` when `!progress.tutorial?.loggingSeen`; sets `progress.tutorial.loggingSeen = true`. Re-openable anytime from **Phone -> Ridgeline / Help** (`phone.js`).
- **Layout (4-Step Flow + Carry Strip):**
  - **Step 1 — Fell:** `[Pine SVG]` + `[Axe / Chainsaw]` -> `[Trunk SVG]` (*"Chop a marked pine to drop 1 heavy Trunk."*)
  - **Step 2 — Buck:** `[Trunk SVG]` + `[Axe / Chainsaw]` -> `[2 Logs SVG]` (*"Cut a Trunk into 2 Logs. Chainsaws cut faster."*)
  - **Step 3 — Saw:** `[Trunk SVG]` -> `[2 Slabs SVG]` | `[Log SVG]` -> `[4 Boards SVG]` (*"Feed the saw: Logs make 4 Boards, Trunks make 2 Slabs."*)
  - **Step 4 — Haul & Sell:** `[Truck / Yard SVG]` -> `[Warehouse / $]` (*"Stack at the shed or haul to the lumberyard & warehouse."*)
  - **Carry Rules Strip:** `Trunk: 60% speed (no sprint)` · `2 Logs: 90% speed` · `Boards: 4 per stack`
- **Icons:** Reuse `ITEM_ICONS` (`dist/item-icon.js`) for Axe/Chainsaw; draw inline SVGs in `logging-tutorial.js` for Pine, Trunk, 2 Logs, 4 Boards, 2 Slabs, Saw Blade, and Truck.
- **Dismissal:** `Escape`, `Enter`, `Space`, `E`, or Close button hides overlay and restores focus/pointer lock.
- **Test:** `tests/logging-tutorial.mjs` (minimal DOM stub matching `tests/talk-panel.mjs`) verifying first-clock-in trigger, `loggingSeen` idempotency, re-open API, and `Escape`/`Enter`/`E` close.

---

## 8. Staged Build Plan & Tests

| Stage | Scope | Model | Files | Tests |
|---|---|---|---|---|
| **T-A** | Pure trunk/slab/2-log rules, bed capacities, load-drag, economy & prices | **Sonnet 5.5** | `carry.js`, `cargo.js`, `cargo-items.js`, `load-drag.js`, `tools.js`, `grid.js`, `plank-economy.js`, `world-goods.js` | `tests/carry.mjs`, `tests/cargo.mjs`, `tests/cargo-items.mjs`, `tests/load-drag.mjs`, `tests/grid.mjs`, `tests/plank-economy.mjs` |
| **T-B** | Sawmill yard v2 (trunks + slabs), 3-zone pile layout, shift tasks & workforce sync | **Sonnet 5.5** | `sawmill-yard.js`, `sawmill-pile.js`, `shift.js`, `forest.js`, `map-definition.js`, `workforce-tick.js`, `workforce-pose.js` | `tests/sawmill-yard.mjs`, `tests/sawmill-pile.mjs`, `tests/forest-tasks.mjs`, `tests/workforce-tick.mjs`, `tests/workforce-pose.mjs` |
| **T-C** | Logging tutorial graphic overlay + unit test | **Sonnet 5.5** | `dist/logging-tutorial.js` (new), `index.html`, `style.css` | `tests/logging-tutorial.mjs` (new) |
| **T-D** | Natural wood meshes/textures (Blender GLBs + `props-assets.js`/`world.js`) | **Sonnet 5.5** | `scripts/build-timber.mjs` (new), `assets-register.json`, `ASSETS.md` | `tests/real-models.mjs` |
| **T-E** | Save migration, `game.js` wiring, sawmill animations, tutorial trigger, phone re-open | **Opus 5.5** | `jobs.js`, `game.js`, `world.js`, `sawmill.js`, `phone.js`, `cargo-view.js` | Full `npm run release -- --force` + `npm test` |

---

## OWNER QUESTIONS (Max 8)

1. **1-Log vs 2-Log Carry Speed:** `carry.js:14` currently sets 1 log to `0.8` (80% speed), while the spec asks for 2 logs at **90% speed**. Should 1 log be raised to `0.95` (or `1.0`) so 2 logs at `0.9` feels heavier than 1 log, or keep 1 log at `0.8`?
   - **Recommended:** Raise 1 log to `0.95` (no sprint) and set 2 logs to `0.90` (no sprint), Trunk at `0.60`.
2. **Lumberjack Level 3 & 8 Perks (`skills.js:23`):** Currently `logsPerTree` gives 3 logs at lv 3 and 4 at lv 8. With 1 tree = 1 Trunk -> 2 Logs, should lv 3 & 8 instead speed up chopping/bucking, or grant a bonus log when bucking a Trunk?
   - **Recommended:** Speed up chopping/bucking (1 Trunk always = 2 Logs so the geometry/math stays clean).
3. **Sawmill Boards Pile Location:** The Shed deck (`x = 6.4`) is occupied by the 2.4 m conveyor (`x = 5.2..7.6`). Should we split the Main deck's back strip (`z: -2.775..-1.125`) into **Boards (east half)** and **Slabs (west half)**, or place a new **Boards pad** just east of the Shed deck (`x: 8.5..11.5`)?
   - **Recommended:** Split the Main deck back strip (Boards east, Slabs west) so both stay under the existing roof without adding a new pad.
4. **Chainsaw Unlock Rank (`map-definition.js:407`, `items.js:30`):** Chainsaws are currently gated at Rank 6 Foreman / Level 15 (`$600`). Should an entry-level chainsaw unlock earlier (e.g. Rank 2 Feller / Level 5) now that bucking trunks is core to Rank 1–2?
   - **Recommended:** Lower basic `chainsaw` to Rank 3 Hauler / Level 5 (`$350`) so players experience faster bucking mid-career, keeping `logging-chainsaw` at Level 15–20.
5. **Slab Carry & Bed Space:** Proposed `slab` carry speed `0.8` (1 slab at a time, or 2 at `0.8`?) and bed `space: 2` (`flatbed: 60`, `shortbed: 22`). Confirm?
   - **Recommended:** Carry 1 slab at `0.8` speed (or 2 slabs stacked at `0.85`), `space: 2` on beds.
6. **Natural Wood Assets Source:** Should we author 4 custom low-poly Blender GLBs (Trunk, 2-Log Bundle, Slab, Board Stack) with a shared 256 px bark/end-grain texture (no credits needed), or pull from Poly Haven / Kenney CC0 packs?
   - **Recommended:** Author 4 custom Blender GLBs using the existing CC0 `Bark_NormalTree.png` + `EndGrain` palette so dimensions match `cargo.js` and `sawmill-pile.js` to the centimetre.
7. **Old Save Migration for `progress.logs`:** Should loose logs on the ground in existing saves stay as `log` (ready to carry/saw) or convert to `trunk`?
   - **Recommended:** Keep existing ground logs as `log` (`kind: 'log'` default) so no player loses in-progress work.
8. **Sawmill Sawing Time for Trunks:** Should sawing 1 Trunk -> 2 Slabs take the same `8 s` (`SAW_MIN_PER_LOG`) as 1 Log -> 4 Boards, or `12 s`?
   - **Recommended:** Same `8 s` (`SAW_MIN_PER_LOG`) so it reuses the existing `Cut` clip cadence cleanly.

---

## OWNER ANSWERS (2026-11-18)

1. Carry: 1 log 0.95, 2 logs 0.90, trunk 0.60, no sprint.
2. Lumberjack level 3 and 8 perks: a BONUS LOG when bucking a trunk (3 and 4 logs per trunk at those levels).
3. Piles: split the Main deck back strip (boards east, slabs west).
4. Basic chainsaw at Rank 3, level 5, $350; logging-chainsaw stays at level 15-20.
5. Slab: carry 1 at 0.8, bed space 2.
6. Models: own Blender models made by Hydrogen (prompt notes/eval/prompts/hydrogen-timber-models.md); if poor, retry with Sonnet or Opus.
7. Old saves: loose logs stay logs.
8. Sawing 1 trunk into 2 slabs takes 12 s (a log stays 8 s).
