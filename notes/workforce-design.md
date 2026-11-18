michadr.
# Ridgeline Workforce Design: Active Forest Crew & Honest Lumber Fallback

Implements owner request (2026-11-17): make the Ridgeline hard-hat workers visibly work in the forest and sawmill, and slowly fill lumber stock, needs, and orders from conserved stock when the player does not, while keeping the player clearly faster and better paid.

---

## 1. What the Workers Are Today (`file:line` & Why They Stand)

### Roster & Posts (`dist/map-definition.js`, `dist/population.js`)
- `dist/map-definition.js:388-391` defines four staffed posts for `employer: 'ridgeline'`, all with `hours: [360, 1080]` (06:00–18:00):
  1. `ridgeline-owner` at `{office: 'ridgeline-office'}` — **Walt Hargrove** (`commuter:ridgeline-owner`, `Suit`). Drawn indoors by `dist/office.js:55` (`office-owner`).
  2. `ridgeline-fellers` at `{zone: 'forest'}`, `count: 2`, `outfit: 'Worker'` (hard hat + hi-vis vest, `dist/appearance.js:20-29`) — `dist/population.js:101-119` assigns:
     - `ridgeline-fellers#1`: **Peter Brennan** (`farm-house#2`, male, walks from Willow Farm).
     - `ridgeline-fellers#2`: **Tom Reyes** (`house-r4#1`, male, `drives: true` from Cedar Heights).
  3. `ridgeline-sawyer` at `{property: 'sawmill'}`, `count: 1`, `outfit: 'Worker'` — **Priya Nair** (`house-r6#1`, female, `drives: true`).
  4. `ridgeline-yard` at `{office: 'ridgeline-warehouse'}`, `count: 1`, `outfit: 'Worker'` — **Anton Ellison** (`house-r2#2`, male, walks). Separately, `dist/warehouse.js:72` places a static `warehouse-hand` character behind the indoor order table.
- `dist/npc-roster.js:69-78` also lists two `dormant: true` placeholders (`foreman` Gus Taggart at `zone:forest`, `driver` Ray Okonkwo at `office:ridgeline-warehouse`) with no map posts yet.

### Why the Two Fellers Stand Motionless All Day (`dist/schedule.js`, `dist/npc-walk.js`, `dist/npc-crowd.js`)
1. **Single static work block:** `dist/schedule.js:46-50` gives every resident with a post one block `{from: arrive, to: leave, act: 'work', place: 'zone:forest'}` spanning ~05:45 to ~18:10.
2. **`'zone'` is not indoor, so `presenceOf` returns `'stand'`:** `dist/npc-walk.js:77-84` sets `INDOOR_KINDS = ['shop', 'office', 'property', 'dwelling']`. Because `placeKind('zone:forest')` is `'zone'`, `presenceOf(block)` (`L79-84`) returns `'stand'`. (Conversely, `property:sawmill` is in `INDOOR_KINDS` even though `dist/map-definition.js:304` marks the sawmill `enterable: false, reason: 'An open-sided working yard; the machinery is its inside.'`, so Priya Nair disappears into `state: 'hidden'` when she reaches work.)
3. **One point for the whole forest, and `pace()` only runs for `act === 'outside'`:** In `personPose()` (`dist/npc-walk.js:110`), `kind === 'stand'` looks up `ctx.point('zone:forest')` (`dist/population.js:46`), which is the centre of the `forest` zone rectangle (`dist/map-definition.js:14,19`, `{x: 82.5, z: -266}`). It calls `pace()` **only** when `b.act === 'outside'`. Because `b.act === 'work'`, `out.moving` stays `false` and `out.x, out.z` stay pinned at `(82.5, -266)` for 12 hours.
4. **Golden-angle nudge in the crowd pool:** `dist/npc-crowd.js:46-53` finds both fellers overlapping at `(82.5, -266)`, pushes them `SEPARATION = 0.8 m` apart (`L17, L47`), calls `avatar.setMotion(0)` (`Idle_Neutral`, `dist/character.js:199`), and leaves them standing empty-handed all day.

### Why They Do Not Move the Lumber Economy Today
- `dist/world-goods.js:35-38`: `zone:forest` produces `rate: 16` abstract logs/day in `world.stock['zone:forest'].logs`, which nothing converts into planks. `property:sawmill` has no `rate`; `dist/world-tick.js:58` only adds `trickle(yard, d)` (`TRICKLE_PER_DAY = 6` planks/day from `dist/plank-economy.js:27`) to `progress.sawmillYard`, and `SUPPLY` (`dist/world-goods.js:58`) ships up to `6/day` straight to `property:eastbank-supply`.
- `dist/world-goods.js:60-62` & `dist/world-tick.js:31-37`: `mirrorPallets` overwrites `world.stock['office:ridgeline-warehouse'].planks` from `totalPlanks(company)` every morning *before* `worldTick`, so the warehouse's `daily: 10` consumption (`world-goods.js:40`) never reduces `company.pallets`, and sawmill planks never reach the warehouse unless the player hauls them.
- `dist/supply.js:5,21-33`: `tickSupply` only runs when the player is hired at Ridgeline and `rank >= 4` (`dist/game.js:246`), and when `company.stock.planks` is empty it mints free planks from "a mill off the map".
- `dist/tickets.js:38-46`: Tickets only release when the player is clocked in at `rank >= 4` (`dist/game.js:229`), and unworked open tickets simply expire at `CLOSE` (`1080`).

---

## 2. Workforce Design

### A. Visible Work Animations & Positions (Felling, Hauling, Sawing)
Keep all three outdoor timber workers visible during shift hours (`360..1080`) via a pure module `dist/workforce-pose.js` called from `personPose` (`dist/npc-walk.js:107`) when `block.act === 'work'` and `block.place` is `'zone:forest'` or `'property:sawmill'`:

1. **Feller #1 — Cutter (`ridgeline-fellers#1`, Peter Brennan):**
   - **Where:** Works inside today's two marked cut blocks `markedBlocks(day)` (`dist/forest.js:18`). Picks a standing pine from `worldLayout().cuttable` (`dist/world.js:98`) in the active block using `hashOf(seed, person.id, day, slotIndex)` (5-game-minute slots).
   - **Cycle (5 game min = 10 real sec per tree):**
     - `walk` (`0.0..1.5` min): walks from the previous tree to `1.35 m` in front of the next pine along clear forest ground, facing the trunk (`yaw = atan2(dx, dz)`).
     - `chop` (`1.5..4.5` min): stands at the trunk and loops the existing axe swing `chopPose(phase)` (`dist/chop-path.js:17`, `swingTime(3) = 0.74 s` per swing via `dist/skills.js:22` -> `reach('R', pose.point, 1)`, `setLean(pose.lean)`, `setTwoHanded(pose.twoHand)`).
     - `rest/inspect` (`4.5..5.0` min): holds the axe in the chest carry pose (`CARRY`, `CARRY_DIR`, `dist/chop-path.js:6-7`).
2. **Feller #2 — Hauler (`ridgeline-fellers#2`, Tom Reyes):**
   - **Where:** Loops between an active tree in `markedBlocks(day)[0]`, the log pile at `LANDING` (`{x: 129.2, z: -279.8}`, `dist/forest.js:25`), and the sawmill feed deck `anchor_log_in` (`{x: 103.05, z: -281.2}` via `anchorWorld` in `dist/sawmill.js:20,48`).
   - **Cycle (8 game min = 16 real sec):**
     - `0.0..0.5` min: bends (`bendAmount`, `dist/game.js:42`) at the felled tree to shoulder a log.
     - `0.5..3.8` min: walks at `WALK_SPEED * LOG_CARRY_FACTOR` (`1.68 m/s`, `dist/population.js:13`, `dist/plank-economy.js:33`) to `LANDING` or `anchor_log_in` with the right hand in the shoulder-log pose (`LOG_HOME`, `LOG_HAND`, `LOG_POLE`, `dist/game.js:42`).
     - `3.8..4.3` min: bends to stack the log on the waiting deck.
     - `4.3..8.0` min: walks back empty-handed to the cut block.
3. **Sawyer (`ridgeline-sawyer`, Priya Nair at `property:sawmill`):**
   - **Why visible:** Treat `property:sawmill` (`enterable: false`) as an outdoor work place in `presenceOf()` (`dist/npc-walk.js:79`).
   - **Cycle (6 game min = 12 real sec around the open shed at `104, -278`):**
     - Walks from the log deck (`LOG_X = -5.05` model space, `dist/sawmill-pile.js:43`) to `anchor_log_in`, pauses at `anchor_switch`, walks to `anchor_belt_clear`, and carries a 4-plank stack (`PLANK_HANDS`, `PLANK_STACK`, `dist/game.js:42`) to `topStack` on `PILE_BOX` (`dist/sawmill-pile.js:10,38`).
     - While the sawyer is on shift (`360..1080`) and `sawmillYard.logs > 0 && sawmillYard.planks < YARD_MAX_PLANKS`, the saw runs automatically.

### B. Pure Rate Model (No Free Planks; Player Clearly Faster)
All numbers derive from `dist/plank-economy.js` (`LOGS_TO_PLANKS = 4`, `PLANKS_PER_STACK = 4`, `TRICKLE_PER_DAY = 6`, `TOWN_USE_PER_DAY = 16`, `SAW_MIN_PER_LOG = 4`, `RACK_CELL_PLANKS = 40`) and `dist/sawmill-yard.js`:

| Metric | Workforce (Autonomous Crew) | Player (Level 1, `worktruck`, by hand) | Ratio |
| --- | --- | --- | --- |
| Felling & feeding saw | `4 logs / day` (`0.33 logs / shift hr`, from `zone:forest` stock) | `8 logs / 182 min` (`2.64 logs / hr`) | **Player is ~8x faster** |
| Sawn planks from fed logs | `16 planks / day` (`4 logs x LOGS_TO_PLANKS`, via `feed` + `tick`) | `32 planks / 182 min` (`10.5 planks / hr`) | **Player is ~8x faster** |
| Daily baseline trickle | `6 planks / day` (`TRICKLE_PER_DAY`, via `sawmill-yard.js` `trickle`) | Same `6 / day` | Shared baseline |
| Total planks entering yard | Max **`22 planks / day`** (`6` trickle + `16` from `4` real logs), paused when `yard.planks >= 48` | Up to `160` (`YARD_MAX_PLANKS`) | Workforce stops at buffer |
| Warehouse haul (`yard -> racks`) | Max **`12 planks / day`** (`3` stacks via `takeStack` -> `intakeFromYard`) when warehouse `< 60` | `32 planks / trip` (`120` with `flatbed`) | **Player is ~8–10x faster** |
| Player cash / XP from crew work | **`$0.00` and `0 XP`** | **`$263.20 / cycle`** (`8672 c/h`, +25% over best job) | Player paid only for own work |

- **Strict conservation (zero free planks beyond `TRICKLE_PER_DAY = 6`):**
  1. Every non-trickle plank the workforce makes (`<= 16/day`) consumes `1` log per `4` planks (`LOGS_TO_PLANKS`) from `world.stock['zone:forest'].logs` via `feed(yard, logs)` + `tick(yard, minutes)`. If forest log stock is `0`, `0` extra planks are sawn.
  2. Every plank the workforce puts into warehouse racks (`<= 12/day`) comes out of `progress.sawmillYard` via `takeStack(yard)` and into `companies.ridgeline.pallets` via `warehouse-intake.js` (`intakeFromYard` / `toCompany`).
  3. In `dist/supply.js:23-28`, remove the free "mill off the map" fallback: `tickSupply` takes planks from `company.stock.planks` (lumberyard) first and `progress.sawmillYard` second (`takeStack`), placing only what those stocks actually hold.

### C. Tying Into `world-tick.js`, `needs.js`, and `tickets.js` (Honest Stock)
1. **Two-way `mirrorPallets` in `dist/world-tick.js`:**
   - Before `catchUp`: sync `world.stock['office:ridgeline-warehouse'].planks = totalPlanks(company)` and `world.stock['property:sawmill'].planks = yard.planks`.
   - Inside each ticked day `d`:
     - Run `workforceDay({world, yard, company, needs, day: d, seed})`:
       - Moves up to `WORKFORCE_LOGS_PER_DAY` (`4`) logs from `world.stock['zone:forest'].logs` into `yard` (while `yard.planks < WORKFORCE_YARD_CAP = 48`), runs `trickle(yard, d)` (`6`) + `tick(yard, 720)`, and copies `yard.planks` into `world.stock['property:sawmill'].planks`.
       - Runs `worldTick` (`SUPPLY` moves up to `6` planks from sawmill to `property:eastbank-supply`; warehouse `daily: 10` consumes up to `10` planks from `office:ridgeline-warehouse`).
       - Deducts the warehouse planks consumed in `worldTick` from `company.pallets` via `consumeFromRacks(company, consumedWarehousePlanks)` so `company.pallets` and `world.stock` never diverge.
       - Hauls up to `WORKFORCE_HAUL_PER_DAY` (`12` planks) from `yard` into `company.pallets` while `totalPlanks(company) < 60`, updating both `yard.planks` and `world.stock`.
2. **Honest `needs.js` fills by the workforce:**
   - For any open lumber need (`n.good === 'planks' || n.good === 'logs'`) that has been open for `>= WORKFORCE_NEED_DELAY_DAYS` (`1` day) and has no active player claim (`Object.keys(n.claims).length === 0`), the workforce calls `fill(needs, world, n.id, 'workforce', WORKFORCE_NEED_STEP, d * 1440)` (`WORKFORCE_NEED_STEP = 8` planks or `4` logs).
   - Because `fill()` (`dist/needs.js:126-138`) calls `world-state.js` `deliver(world, n.place, n.good, ask, n.origin)`, units are physically deducted from `n.origin` (`property:sawmill`, `office:ridgeline-warehouse`, or `zone:forest`), and `workforceDay` mirrors that deduction back into `yard.planks` / `company.pallets`. If the source stock is empty, `fill()` moves `0` units.
3. **Slow ticket fallback (`dist/tickets.js`):**
   - When an open pickup/delivery ticket has waited untouched for `>= 180` game minutes (`3` hours), `workforceTicketStep` stages `4` planks every `30` game minutes from `company.pallets` (`takeFromRackCell` + `stageByHand`) and completes the ticket with `effects: []` (`$0` pay, `0` player rep) only when all planks were genuinely staged from rack pallets.

### D. Co-op Determinism, Save Format, and Performance
- **Co-op determinism:** `workforcePose(out, person, day, minute, ctx)` is a pure function of `(person.id, day, minute, seed)` using `population.js` `hashOf`. No `Math.random()`, no `Date.now()`, and no frame-accumulated state. All co-op clients sharing `sessionClock` (`dist/session-clock.js`) render identical worker positions and swing phases. Daily stock/need changes run inside `runWorldDay` (gated by `worldDue(progress, authority)` in `dist/world-tick.js:25`).
- **Save format (additive, backwards-compatible):**
  - No new required top-level save keys. `progress.sawmillYard` (`dist/sawmill-yard.js`), `progress.companies.ridgeline.pallets` (`dist/pallets.js`), `progress.world`, and `progress.needs` already store all stocks.
  - Optional `progress.companies.ridgeline.workforce: {lastMin}` (normalized inside `normalizeCompanies` at `dist/careers.js:26-39`, omitted when idle) tracks intraday ticket/haul steps cleanly without touching `save-file.mjs` or `cloud-save.mjs`.
- **Performance (0 extra draw calls):**
  - The 2 fellers and 1 sawyer use the existing `npcCrowd` pool (`POOL = 9`, `DRAW_RADIUS = 120 m`, `dist/npc-crowd.js:12-14`) — **0 new `SkinnedMesh`es**.
  - Worker carried logs and plank stacks reuse 1 instance in the existing `yard-logs` / `ground-logs` and `yard-pile` `InstancedMesh`es (`dist/game.js:421`), and the feller's axe reuses `axeMesh('axe')`'s shared `BufferGeometry` (`dist/item-models.js:11`) only on the active feller slot within `120 m` (or 1 shared `InstancedMesh` of 2 axes) — **0 extra draw calls in town, 0–1 in the forest**, and **0 grid A* searches per frame** (local clearing segments are straight-line walkable).

---

## 3. Implementation Stages (`W1..W3`)

| Stage | Files | Builder Model | Scope, Tests & Eye-Checks |
| --- | --- | --- | --- |
| **W1: Pure Workforce Pose & Loops** | `dist/workforce-pose.js` (new)<br>`tests/workforce-pose.mjs` (new) | **Sonnet 5.5 high** | Pure `isOutdoorWork`, `workforcePose(out, person, day, minute, ctx)` for `ridgeline-fellers#1` (Cutter), `ridgeline-fellers#2` (Hauler), and `ridgeline-sawyer` (Sawyer).<br>**Test:** `node tests/workforce-pose.mjs` — pins determinism at 30/60/144 Hz, co-op agreement, all waypoints walkable on real `MAP`, chop/carry/bend phases, zero allocations. |
| **W2: Pure Workforce Economy & Stock Sync** | `dist/workforce-tick.js` (new)<br>`dist/pallets.js` (`consumeFromRacks`)<br>`tests/workforce-tick.mjs` (new) | **Sonnet 5.5 high** | Pure `workforceDay` and `workforceTicketStep` reusing `plank-economy.js`, `sawmill-yard.js`, `warehouse-intake.js`, `needs.js`. Two-way pallet-stock sync and honest `needs.fill(..., 'workforce', ...)`.<br>**Test:** `node tests/workforce-tick.mjs` — pins 14-day plank/log conservation (0 free planks beyond trickle), player >= 6x faster than workforce, `$0` player pay for crew fills. |
| **W3: World, Crowd & Game Wiring** | `dist/npc-walk.js`<br>`dist/npc-crowd.js`<br>`dist/world-tick.js`<br>`dist/supply.js`<br>`dist/careers.js`<br>`dist/game.js`<br>`tests/workforce-game.mjs` (new) | **Opus 5.5** | Wire `workforcePose` into `npc-walk.js` / `npc-crowd.js` (axe swing, shoulder log, plank stack poses), `workforceDay` into `world-tick.js`, `sawmillYard` draw into `supply.js`, and `game.js` hooks.<br>**Test:** `npm run release -- --force && npm test` + `node tests/workforce-game.mjs`.<br>**Eye-check:** Pine Ridge at `10:00`: feller #1 chopping a marked pine, feller #2 hauling a log to the sawmill, sawyer working the shed pile, draw calls unchanged. |

---

## 4. Owner Questions (Recommended Answers First)

1. **Workforce daily pace:**
   - **(Recommended)** **4 logs felled/day -> 16 sawn planks/day (+ 6 trickle = 22 planks/day max into the sawmill yard, pausing above 48 yard planks) and up to 12 planks/day hauled to the warehouse.** Covers the town's `16 planks/day` baseline (`10` warehouse + `6` supplier) while a level-1 player with the starter truck moves `32 planks` in ~3 hours (~8x faster).
   - *Alternative:* Slower (`2 logs = 8 sawn planks + 6 trickle = 14 planks/day`), so town stock slowly dips unless the player helps every couple of days.
2. **Real trees (`progress.plots`) vs cosmetic chopping:**
   - **(Recommended)** **Keep live feller chopping purely visual (no `progress.plots` edits during the frame loop), and optionally turn at most 2 pines into stumps in yesterday's marked block during the `05:00` daily tick.** Co-op poses stay stateless and a worker never fells the tree the player is walking up to.
   - *Alternative:* 100% visual trees only (`progress.plots` touched only by the player; workforce logs come solely from `world.stock['zone:forest'].logs`).
3. **Grace period before the workforce fills open lumber needs & tickets:**
   - **(Recommended)** **Wait 1 full day before chipping away at unclaimed gig-board lumber needs (`8 planks/day`), and 3 game hours (`180` min) before slowly staging untouched warehouse order tickets (`4 planks / 30 min`).** Gives the player first pick of every job and ticket.
   - *Alternative:* Only fill unclaimed needs and tickets at the `05:00` daily tick.
4. **`supply.js` "mill off the map" fallback:**
   - **(Recommended)** **Remove the free off-map planks; `tickSupply` draws from `company.stock.planks` (lumberyard) first and `progress.sawmillYard` second.** Keeps every warehouse pallet 100% backed by conserved planks.
   - *Alternative:* Keep a small off-map fallback only when the player is clocked in on a warehouse shift and both stocks are `0`.
5. **Sawyer visibility at the sawmill shed (`ridgeline-sawyer`, Priya Nair):**
   - **(Recommended)** **Show her working outdoors in the open-sided sawmill shed** (walking between the log deck, saw switch, and plank pile) alongside the two forest fellers.
   - *Alternative:* Only animate the two forest fellers (`ridgeline-fellers#1` and `#2`) and leave the sawyer hidden.
