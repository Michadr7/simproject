# Alder Diner & Coffee Career: Design Note

Expands Alder Coffee (`shop:cafe`) into an early-game career you can start by talking to Elena at the counter. Replaces the standalone 2-customer cafe loop and the `serve` gig with a ranked Waiter → Barista-Cook career featuring a multi-table waiter loop, espresso bar, modular kitchen stations (pizza, burgers, sandwiches), and a close-up station view.

---

## 1. What Exists Now & What Gets Removed

### Current state (verified)
- **Building & hours:** `ALDER COFFEE` at `(36, -16)`, door `(36, -6.3)`, hours `480–1080` (08:00–18:00), city-owned public shop (`dist/map-definition.js:151,178,274`).
- **Interior (`dist/shops.js:11-29`, `dist/map-definition.js:173`):** `12 × 10 m` room (`x -6..6, z -5..5`), counter at `x=0, z=-3.5` (talk spot `COUNTER={x:0,z:-2}`), register box at `(1.2,1.28,-3.5)`, coffee machine box at `(-1,1.38,-3.5)`. **Four tables** sit at `x ∈ {-3.8, 3.8}, z ∈ {-0.7, 2}` (`1.25×1.05 m`, top `y=0.82`), 2 chairs each (`z ± 0.85`). `usedCup` is only on the NW table (`-3.8, 0.97, -0.7`).
- **Staff & customers:** `cafe-manager` Elena (`oak-apartments/7#1`, `npc-roster.js:79`) and `cafe-barista` (unassigned resident, e.g. Naomi, `map-definition.js:386-387`, `cast-early.js:488`). One pooled customer (`shops.cafe.customer`) walks to the NW table only (`game.js:1056-1059`).
- **Current loop & pay (`dist/cafe-job.js:1-14`):** `progress.cafe` (`employed, stage, customer, day, paidDay, served`). Clock in 08:00–16:00 (`480..960`); serve Maya (`Latte`) and Theo (`Espresso`) through `order (10 m) -> brew (10 m / 3 s real) -> serve (10 m / 1.2 s) -> clean (15 m / 2.5 s)` (`game.js:660`). Clock-out pays flat `2400 c` (`$24.00`, `1600 c/hr` in `plank-economy.js:112`). Buying lunch (`cafe.meal`, `life.js:25`) costs `600 c` (`food +45, thirst +20, energy +15`).
- **Economy links:** `shop:cafe` (`world-goods.js:35-36,63`) holds `eggs`, `milk`, `bread` (bakery sends 3 loaves/day).

### What goes vs what stays
| Item | Action | Reason & Save/Story handling |
|---|---|---|
| `dist/cafe-job.js` (`progress.cafe` shift loop) | **Remove / replace** | Replaced by `MAP.employers` entry `diner` + `careers.js`/`shift.js`. In `jobs.js:49`, migrate `a.cafe?.employed`: auto-hire Rank 1 (`Waiter`), set `lastShiftDay = a.cafe.paidDay || 0`, settle any mid-shift `served > 0` (`served * 1200 c` + phone note) or reset cleanly. |
| `need-serve` (`gigs.js:24,26`, `needs.js:9,41,45`) | **Retire (`OFF_KINDS`)** | The only gig about serving shifts (`"Cover a shift"`). Add `'serve'` to `OFF_KINDS` (`needs.js:25`) so `retireOffKinds` (`needs.js:82`) drops open ones while keeping active saves payable. |
| `jobs.js:27` produce route & `needs.js:91` `restock` | **Keep** | Supply/delivery runs (`$14` Corner Market → Alder Coffee; `milk`/`eggs` restock crates for Elena) are hauling, not shift work. |
| `starter.js` (`BEATS`, `halTalk`) | **Unchanged** | Beats 0–9 (`starter.js:13-24`) never mention the cafe job. |
| Cast & UI (`cast-early.js`, `npc-roster.js`, `talk-engine.js`, `tests/startup.mjs`) | **Update** | Replace `$24 / 2 regulars` and `cafe:'none'|'employed'|'onShift'` in `noah.town` (`cast-early.js:126`), `elena.*` (`cast-early.js:388-461`), `TIPS.elena` (`npc-roster.js:128`), `talk-engine.js:83`, `talk-memory.js:85`, `plank-economy.js:112`, `tests/startup.mjs:99-101`. |

---

## 2. Career, Ranks, Promotion & Hiring

- **Employer (`MAP.employers`, `map-definition.js:405`):** `id: 'diner'`, `name: 'Alder Coffee & Diner'` (or keep `'Alder Coffee'`; see Q1), `skill: 'hospitality'` (`skills.js`), `office: 'shop:cafe'` (or `hireAt: {shop:'cafe'}` so shops can hire without needing `MAP.offices`), `owner: {kind:'npc', id:'elena', name:'Elena', title:'Manager'}`, `hours: {from:480, to:1080, lastIn:1020}` (08:00–18:00, last clock-in 17:00), `sites: [{room:'cafe'}]`.
- **Early hire ("talk to the store person"):** Available from day 1 with no prerequisite. Talk to **Elena** at the Alder Coffee counter (`elena.cafe` → `elena.work`, `act: 'diner.hire'`). Noah (`cast-early.js:126`) and Sophie (`cast-early.js:594`) still point new players next door. On hire: `careers.hire(p, 'diner')` sets Rank 1, `START_REP = 10`, and posts a welcome phone message (`messages.js:addMessage`): *"Elena: Welcome to the crew! Clock in on your phone (Jobs) or with me at the counter from 8 AM."*
- **Ranks, wages & unlocks (`careers.js:104-116`):**

| Rank | Needs (`level / shifts / rep`) | Wage (`c/hr`) | Tasks (`shift.js` pool) | Unlocks |
|---|---|---|---|---|
| 1. **Waiter** | `1 / 0 / 0` | `800` ($8/h) | `take_order`, `serve_plate`, `bus_table` | Dining floor; NPC barista/cook fills tickets at pass counter |
| 2. **Barista & Cook** | `2 / 2 / 15` | `1100` ($11/h) | + `brew_drink`, `prep_food` | Espresso machine, grinder, grill, oven, fryer, station view (reached in ~2 shifts!) |
| 3. **Head Cook** | `4 / 5 / 35` | `1400` ($14/h) | + `combo_order`, `bake_pizza` | Multi-item combo tickets, larger rush waves, priority pass |
| 4. **Shift Manager** | `7 / 10 / 55` | `1700` ($17/h) | + `rush_hour` | Can delegate floor tables to NPC waiter while cooking (future: daily special) |

- **Promotion rule:** Uses `careers.js:104` `nextRank` (`level`, `shifts`, `rep` all met). Rank 1 → 2 needs only **2 counted shifts** (≥ 60 game min each, `shift.js:10`), `hospitality` level 2 (40 XP, `skills.js:5`), `rep 15` (1–2 good shifts). Phone Jobs tab shows *"Elena wants to see you"*; talk to Elena (`act: 'diner.promote'`) to promote.
- **Clock-in/out & Shift Tasks (`shift.js`):** Clock in via **Phone → Jobs → Shift** (`phone-jobs.js:53`) or **Elena at counter**. Fix `shift.js:68` hardcoded `"6:00 AM to 6:00 PM"` string to read `formatClock(e.hours.from/to/lastIn)`. Leaving `room:'cafe'` starts the existing `OFF_SITE_LIMIT` (`60 min`) timer (`shift.js:108`).
- **Piece pay, tips & bonus:** `PIECE_PAY` adds `ordersTaken: 50`, `platesServed: 100`, `tablesBused: 50`, `drinksBrewed: 120`, `foodPrepped: 160` (cents). **Tips:** accumulated per served customer in `shift.tipsCents` (`0–300 c`), added to `shiftPay` and `payStubs` alongside `wage + piecePay + bonus` (`BONUS_PER_RANK` scaled or `1000 * rank` for diner so Rank 1 bonus is `$10` vs `$25` for heavy logging — or keep `BONUS_PER_RANK = 2500`? Flagged in Q5).
- **Tracker text (`tracker.js`):** Outdoors, diner shift tasks point to `SHOPS.cafe` (`{x:36, z:-6.3}`, `'Alder Coffee'`). Inside `shop === 'cafe'`, a new `cafeTarget()` helper (mirroring `warehouseTarget()` in `tracker.js:70`) aims the arrow at the next table needing order/service/busing, the pass counter, or the espresso/kitchen station.

---

## 3. Waiter Loop

- **Tables (`shops.js:22`):** Reuse all **4 existing tables** (`T0: (-3.8, -0.7)`, `T1: (-3.8, 2.0)`, `T2: (3.8, -0.7)`, `T3: (3.8, 2.0)`), expanding from 1 customer to up to **4 seated customers** (2 tables active at quiet hours / Rank 1, up to 4 during lunch/afternoon rush).
- **Customer spawning (deterministic):** Pool drawn from `townPopulation().people` (`population.js:72`) using `dayPlan` (`schedule.js:32`) `'shop'`/`'outside'` visitors near `shop:cafe`, seeded by `(day, slot)` (identical across co-op clients). Customers enter at `(0, 4.2)`, walk a waypoint aisle (`x = ±2.3`, avoiding tables) to their chair, sit (`y = -0.35`, `setSeated(true)` like `game.js:1058`), then leave after eating.
- **Loop & Order Ticket:**
  1. **Seat & Signal:** Customer sits; small overhead badge / HUD ticket strip shows `Table 1 · Waiting`.
  2. **Take Order (`E` at table):** Waiter greets customer; ticket opens (`{id, table, customerName, items:[...], orderedAt, stage:'queued'}`). At Rank 1, ticket queues to Elena/NPC Cook behind the counter (`10–15 real s` prep time per item).
  3. **Pick up & Walk Plates (`E` at pass counter):** Finished drinks/plates appear on the counter pass (`x: -1.5..1.5, z: -3.5`); Waiter picks up up to **2 items** (`carry` / tray pose, `90%` walk speed).
  4. **Serve & Bus (`E` at table):** Deliver matching items (`serve` piece + tip calculated). Customer eats (`20–30 game min`), stands and leaves, leaving `dirtyPlate`/`usedCup` visible. Press `E` (`1.2 s`) to bus & wipe table (`clean` piece), freeing the seat.
- **Tips by speed & accuracy:** `tip = round(baseTip * accuracyMul * speedMul)`. Under `60 game min` (2 real min) from order = `1.0x`; `60–100 min` = `0.5x`; `>100 min` = `0x` + `-2 rep`. Wrong item = `0` tip, customer refuses (`"That's not what I ordered"`).

---

## 4. Barista & Cook Loop

Unlocked at **Rank 2 (Barista & Cook)**. Orders spawn on a **Ticket Rail** (HUD top-left strip + physical counter ticket): up to 3 active tickets; player can cook/brew directly instead of waiting for NPC pass.

### Espresso Machine Station (`x: -1.25, z: -3.5` on counter)
- **Steps:** (1) Pick cup (`demitasse` / `mug` / `tall_iced`), (2) **Grind & Tamp** (click Grinder, `1.5 s`), (3) **Pull Shot** (click Brew, click Stop in sweet spot `2.5–3.5 s`; `<2 s` = sour `-25%`, `>4.5 s` = bitter `-30%`), (4) **Steam / Finish** (hold Steam Wand on milk pitcher until `60–65°C` gauge turns green, or add Hot Water / Ice + Milk), (5) **Pour** onto tray/pass.
- **Fail states:** Scorched milk (`>80°C`) or burnt shot (`>6 s`) ruins the drink (`quality < 40`): player can **Dump** (costs 1 milk/coffee portion, retries cleanly) or serve ruined (`0` tip, `-2 rep`).

| Drink ID | Cup | Steps | Ingredients (portion) | Prep (real s) | Price (`c`) |
|---|---|---|---|---|---|
| `espresso` | demitasse | grind → pull shot | `coffee: 1` | ~5 s | `250` |
| `americano` | mug | grind → pull → hot water | `coffee: 1` | ~6 s | `300` |
| `latte` | mug | grind → pull → steam milk → pour | `coffee: 1, milk: 1` | ~9 s | `400` |
| `cappuccino` | mug | grind → pull → heavy foam steam → pour | `coffee: 1, milk: 1` | ~9 s | `425` |
| `hot_chocolate` | mug | cocoa scoop → steam milk → pour | `milk: 1, cocoa: 1` | ~6 s | `350` |
| `tea` | mug | tea bag → hot water | `tea: 1` | ~4 s | `250` |
| `iced_latte` | tall_iced | ice → cold milk → grind → pull shot | `coffee: 1, milk: 1` | ~8 s | `450` |
| `iced_tea` | tall_iced | ice → tea steep | `tea: 1` | ~4 s | `300` |

### Kitchen Stations (Rear Counter / Alcove along `z = -4.5`, room widened/arranged behind bar)
- **Stations:** **Prep Board** (cold assembly), **Flat-Top Grill** (`4–6 s` cook, flip at `3 s`, burns `>9 s`), **Pizza Deck Oven** (`7 s` bake, timer ding, burns `>12 s`), **Deep Fryer** (`5 s` fries/hashbrowns, burns `>10 s`).
- **Modular Recipes as Data (`diner-recipes.js`):** Each recipe is `{id, name, category, station, cookSec, burnSec, parts:[{id, slot, required, heat?}], priceCents}`:
  - **Pizza** (`margherita`, `pepperoni`, `veggie`): `dough_base` → `tomato_sauce` → `mozzarella` → toppings (`pepperoni`, `mushroom`, `onion`, `pepper`, `olives`) → **Oven** (`7 s`) → `plate` or `pizza_box`.
  - **Burgers** (`classic_burger`, `cheeseburger`, `bacon_burger`): `bun_bottom` → `patty` (**Grill** `5 s`) → `[cheese]` → `[bacon]` → `lettuce`, `tomato`, `onion`, `sauce` → `bun_top` → `plate` (+ optional `fries` from **Fryer** `5 s`).
  - **Sandwiches** (`club`, `blt`, `grilled_cheese`, `egg_melt`): `bread_bottom` → fillings (`ham`, `bacon`, `fried_egg` from **Grill**, `cheese`, `lettuce`, `tomato`, `sauce`) → `bread_top` (toasted on **Grill** if `grilled_cheese`/`egg_melt`).
- **Quality scoring (`0–100`):** Starts at `100`; `-25` per missing/extra topping, `-10` for wrong stack order (e.g. sauce on top of cheese, missing bottom bun), `-20` undercooked, `-45` burnt. Score ≥ 80 = full tip; 50–79 = half tip; `< 50` or wrong dish category = customer refuses (`0` tip, must bin/remake).

---

## 5. The Station View (Close-Up): Three-Way Comparison

Modelled on `notes/warehouse-machine-design.md` (`touchscreen` close-up): pressing `E` at a station eases the camera (`0.25 s` lerp) into a first-person counter view, calls `look.release()` so the cursor appears, and keeps **game time running** (only `Escape` menu pauses; `Esc` / right-click exits station view).

| Option | How it draws & plays | Draw calls & allocs (in station) | Pros & Cons |
|---|---|---|---|
| **A. Pure 3D Snapping Parts** | Every bun, patty, topping, and cup is a 3D mesh; drag-and-drop 3D raycast to snap sockets. | `+8–18` draws (1 shared food atlas, pooled meshes), `0` outdoor cost. Needs per-frame raycast on drag. | **Pros:** Best tactile feel; co-op sees every piece. **Cons:** Raycast dragging tiny pepperoni/olives with mouse/trackpad is fiddly; high UI code complexity. |
| **B. Pure 2D Layered Card** | Dark translucent DOM/Canvas modal over dimmed cafe; stacked 2D PNG/SVG sprites built on click. | `0` 3D draws (DOM/2D canvas only), zero 3D mesh work. | **Pros:** Fast to build, crisp `slop-newyork` HUD look, trivial click targets. **Cons:** Disconnected from 3D world/appliances; co-op sees nothing on counter; duplicates art work. |
| **C. Hybrid (RECOMMENDED)** | **3D station camera** frames the counter/espresso/grill; **pooled 3D food parts** snap visibly onto the plate/board using **1 shared food atlas**; a compact **slop-newyork dark translucent tray** (`hud-cards` style) holds ingredient/action buttons (`1–9`, `Space`, `Enter`, `Esc` fallbacks) + direct 3D clicks on machine levers/portafilter. | **`+6–10` draw calls**, `< 2,500` tris total inside room (`0` outdoors). Dirty-checked DOM + 1 reused `Raycaster`/`Vector2` (`0` per-frame heap allocs). | **Pros:** Real 3D food & live animated machine/grill visible to co-op, zero fiddly 3D drag, full keyboard accessibility, matches `warehouse-machine-design.md` touchscreen & `ui-look-references.md` HUD style. |

- **Controls & Fallbacks:** Click tray buttons or 3D station hotspots; keys `1–9` pick ingredient/drink, `Space` grinds/pulls/flips/steams, `R` clears/bins ruined item, `Enter`/`E` plates & exits, `Esc` leaves station view. HUD hides crosshair prompt and shows a compact **Order Ticket Strip** at left (`slop-newyork` dark card `#121316b8`).

---

## 6. Economy & Off-Shift Workforce

- **Real Ingredient Stock (`world-goods.js`):** Extend `shop:cafe` goods beyond `eggs, milk, bread` (`world-goods.js:35-36`) to include `produce` (existing good: tomatoes/lettuce/onions/potatoes) and 2–3 new kitchen goods (`coffee` beans, `cheese`, `meat`), or keep `coffee, dairy, meat, produce, bread, eggs`. Each ingredient unit converts to **kitchen prep portions** (e.g., `1 milk` = 6 drinks, `1 bread` = 4 sandwiches/buns, `1 coffee` = 8 shots, `1 produce` = 5 toppings, `1 meat` = 4 patties/pepperoni).
- **Conservation:** Cooking/brewing deducts portions from `shop:cafe`'s kitchen prep buffer (refilled from `world.stock['shop:cafe']`). When a stock falls below 30% (`LOW_FRAC`, `needs.js:11`), `needsFrom` automatically opens a `restock` gig on the Gigs board (`shop:cafe` already has `PLACE_POINTS['shop:cafe']` in `needs.js:30` and Elena delivery lines in `game.js:595-607`!). If an ingredient is `0`, that dish shows `"Sold out — needs delivery"`.
- **Off-shift workforce (Ridgeline crew pattern, `workforce-tick.js`):** `cafe-barista` (Naomi) + Elena run the diner `08:00–18:00` when the player is off shift. Unclaimed NPC visits (`strollDemand` + `errand` baskets in `world-tick.js:31`) consume real stock; restock needs left unclaimed past a **1-day grace window** can be partially filled by Hal/bakery supply (`needs.js:143` + `world-goods.js:63`), never conjuring free stock.
- **Menu Pricing & Player Pay Balance:**
  - Customer pay: drinks `$2.50–$4.50`, sandwiches/burgers `$5.50–$8.50`, whole pizzas `$8.00–$10.00` (matches `items.js:12-23` sandwich `$4.00`, pizza slice `$4.50`, coffee `$2.50`).
  - Expected player earnings (`plank-economy.js` comparison: old cafe `1600 c/hr`, Rank 1 logging `~1500–2200 c/hr`):
    - **Rank 1 Waiter:** `$8/h` wage + `~$6–10/h` pieces & tips = **~$14–$18/hr** (smooth starter income).
    - **Rank 2 Barista-Cook:** `$11/h` wage + `~$10–15/h` brew/prep pieces & tips = **~$21–$26/hr** (rewards skill & speed without making hauling obsolete).

---

## 7. Assets List & CC0 Sources

All new models follow `ASSETS.md:3-8` (`1 unit = 1 m`, `+Y` up, `+Z` forward, base-centre origin, **1 shared 256 px diner/food colour atlas** or baked vertex colours so instanced toppings/cups stay at **1 material / 1 draw call per kind**).

| Asset Group | Items Needed | Source / Action | Licence & URL / Budget |
|---|---|---|---|
| **Already in repo** | Counters, cabinets, sink, tables, chairs, fridge, stove | `Kenney Furniture Kit` (`assets-src/`, `ASSETS.md:55,98`) | **CC0 1.0** (`https://kenney.nl/assets/furniture-kit`) |
| **Already in repo (fused)** | Whole coffee cup, whole foods (decor/display only) | `Quaternius Ultimate Food Pack` (50 GLB, `ASSETS.md:75`) | **CC0 1.0** (`https://quaternius.com/packs/ultimatefood`, `https://poly.pizza/bundle/Ultimate-Food-Pack`) |
| **Modular Food Kit (CC0 ref)** | Plate, tray, bun halves, patty, cheese slice, lettuce, tomato, onion, pizza base, toppings, bread, fries | **Kenney Food Kit** (`200+` modular GLBs; burgers & pizzas split into parts!) | **CC0 1.0** (`https://kenney.nl/assets/food-kit`, `https://poly.pizza/bundle/Food-Kit`) — or re-bake onto 1 shared atlas |
| **Espresso Bar** | Espresso machine (portafilter, steam wand, group heads), burr grinder, milk pitcher, cups (espresso/mug/iced) | **Author in Blender** (Hydrogen) *(ref: Poly Pizza `Coffee Machine` by J-Toastie — verify licence if used; Fab packs require Fab Standard License check per `notes/timber-redesign-design.md:141`)* | **Own work** (no credit): machine `≤1,400 tris` (4 animated nodes), grinder `≤450 tris`, pitcher `≤250 tris`, 3 cups `≤180 tris` each; 1 atlas + 1 emissive mat |
| **Kitchen Appliances** | Deck pizza oven, flat-top grill/griddle, deep fryer + basket | **Author in Blender** (Hydrogen) | **Own work**: `600–900 tris` each; 1 atlas + emissive heat/lamp |
| **Modular Food & Service Parts** | Pizza base/sauce/cheese/5 toppings (`InstancedMesh`), burger parts, sandwich parts, pizza box, order ticket spike | **Import Kenney Food Kit (CC0)** or **Author in Blender** on 1 shared atlas | **CC0 / Own work**: `30–180 tris` per part (`<2,200 tris` total); 1 shared material (`InstancedMesh` for toppings) |

**Hydrogen Blender build order:** (1) `diner-espresso.glb` + grinder + pitcher + 3 cups (needed for Rank 1/2 showcase & Alder Coffee counter immediately); (2) `diner-appliances.glb` (oven, grill, fryer); (3) `diner-food-parts.glb` (or Kenney Food Kit atlas-bake script) + tray/plate/pizza box/ticket.

---

## 8. Sounds (`dist/diner-sounds.js` + `audio.js`)

- **Already in repo (`dist/sweep-sounds.js:11-16`):** `shop-bell` (door chime), `cash-register`, `coins-pay`, `ui-click`, `ui-toast`, `level-up`, `door-open`, `door-close`, `eat-bite`.
- **New CC0 clips to source & convert (mono Ogg Vorbis 32 kHz via Blender `aud` + numpy, `ASSETS.md:220`):**

| Clip id | Purpose | Verified CC0 Source Lead (check page CC0 badge before download) |
|---|---|---|
| `espresso-grind` | Grinder burr burst (1.5 s) | Freesound `"coffee grinder"` by `organicmanpl` or `"Zassenhaus Electric Coffee Grinder"` by `DrNI` (CC0) |
| `espresso-brew` | Pump + espresso extraction | Freesound `"Coffee Machine_Espresso.wav"` by `KaleidacousticsAudio` (CC0) |
| `espresso-steam` | Milk wand hiss + purge | Freesound `"COFFEE MAKER STEAMING.wav"` by `simo170075` / `"Cappuccino coffee steamer dry blast"` by `AGFX` (check CC0) |
| `grill-sizzle` | Grill/fryer loop (3–4 s x-fade) | Freesound `"Frying Pan Noise 3.wav"` by `Joao_Janz` (CC0) |
| `oven-timer` | Mechanical tick + bell ding | Freesound `"Kitchen Timer Ticking.wav"` by `earthsounds` (CC0) |
| `plate-clink` / `cafe-murmur` | Serve clink + warm room bed | CC0 pack e.g. CreatorAssets *Lively Cafe Ambience* (CC0) or Freesound CC0 search |

---

## 9. Implementation Stages, Tests & Risks

| Stage | Scope & Files | Model | Tests |
|---|---|---|---|
| **D-A** | Pure data & rules: `dist/diner-recipes.js` (drinks, modular food, scoring), `dist/diner-job.js` (tables, tickets, tips, cook timers), `MAP.employers` `diner`, `skills.js` (`hospitality`), `shift.js` (`formatClock` fix, diner pieces/tips), `needs.js` (`serve` → `OFF_KINDS`), `jobs.js` (`progress.cafe` migration). | **Sonnet** (or **Opus** for `jobs.js` migration) | `tests/diner-recipes.mjs`, `tests/diner-job.mjs`, re-pin `careers`/`cafe-job` |
| **D-B** | Assets & audio: Hydrogen builds espresso machine, appliances, food parts (or Kenney Food Kit import) + CC0 sounds (`dist/diner-sounds.js`), `ASSETS.md`. | **Hydrogen** | `tests/diner-assets.mjs` (or extend `sweep-sounds`) |
| **D-C** | Station View: `dist/diner-station.js` (camera ease, raycast + tray UI, keyboard fallbacks, 3D food stack builder) + `index.html`/`style.css` tray markup. | **Sonnet** | `tests/diner-station.mjs` (DOM stub, scoring, keys) |
| **D-D** | Wiring & Cast: `dist/shops.js` (kitchen alcove, 4-table seats, appliances), `dist/game.js` (NPC customers, waiter/cook flow, audio hooks), `dist/cast-early.js` & `npc-roster.js` (Elena/Noah/Sophie text), `dist/tracker.js` (`cafeTarget`), `dist/world-goods.js` & `workforce-tick.js` (cafe stock/barista). | **Opus** | Update `tests/startup.mjs`, `tests/talk-cast.mjs`, full gate |

**Key Risks:**
1. **Index Token Budget (`scripts/build-index.mjs:16`, `tests/brief.mjs:70`):** Index is at `33,032 / 34,000` tokens (`handoff.md:9`), leaving only **~968 tokens**. Adding 3–4 new `dist/*.js` + `tests/*.mjs` files will exceed `34,000` unless we keep file headers compact, merge `diner-recipes` + `diner-job` cleanly, or ask the owner to raise `BUDGET.index`.
2. **Save Migration (`jobs.js:49`):** Must keep `SCHEMA = 2` (no schema bump), convert `progress.cafe.employed` to `progress.careers.diner` idempotently, and retire `need-serve` without breaking saves mid-gig.
3. **Co-op Visibility (`multiplayer.js:83-94`):** Relay currently syncs only `{position, room}` and host `clock`. Customer seating, orders, and plates on tables will be local-only unless the relay adds a lightweight room-scoped diner broadcast (or co-op restricts shifts to per-player local customers).

---

## 10. Owner Questions (up to 8, recommended answer first)

1. **Identity — Alder Coffee vs Diner:** Expand the existing **Alder Coffee** (`shop:cafe`, Elena) into **"Alder Coffee & Diner"** (adds kitchen alcove + grill/oven behind the counter), or add a separate second diner building on a commercial plot (`C1–C7`)?
   - **Recommended:** Expand **Alder Coffee** (`shop:cafe`) into **"Alder Coffee & Diner"** — reuses Elena, the 4 tables, Oak Street location, and bakery/farm deliveries with zero new map-lot work.
2. **Who hires you at the start:** Talk to **Elena** at the Alder Coffee counter (just two doors east of spawn/Corner Market), or also let Noah/phone advertise and refer you?
   - **Recommended:** **Elena hires at the counter** from minute 1 (no prerequisites), while Noah's town rumor (`cast-early.js:126`) and the Phone Jobs app point you to her.
3. **Promotion pace (Waiter → Barista/Cook):** How fast should Rank 1 → Rank 2 happen?
   - **Recommended:** **2 shifts** (`level 2, 2 shifts, rep 15`) — fast enough to reach the espresso machine & kitchen in ~10–15 real minutes, then slower to Head Cook (5 shifts) and Shift Manager (10 shifts).
4. **How deep should the Station View assembly be:** Pure 3D drag-and-drop, 2D layered card, or **Hybrid** (3D close-up camera + live 3D stacking parts on the counter + clean click/hotkey tray)?
   - **Recommended:** **Hybrid** — tactile 3D food/machine feedback with crisp button + `1–9`/`Space`/`Enter` controls and zero fiddly mouse dragging.
5. **Failed / ruined orders:** If you burn a patty or serve the wrong dish, does the cost come out of your wages, or just waste the ingredient/time and cost the tip + `-2` reputation?
   - **Recommended:** **No cash dock from wages** — costs the tip, `-2` rep, and time/stock to remake (matches `DESIGN.md:104` cashier rule: mistakes cost tips, not wages).
6. **Tips & shift bonus balance:** Keep `shift.js` `BONUS_PER_RANK = 2500` ($25 × rank) for the diner too, or use a lighter bonus (`$10 × rank`) plus customer tips (`$0.50–$3.00` per table)?
   - **Recommended:** **Lighter shift bonus (`$10 × rank`) + live tips** so speed and accuracy matter more than flat completion, keeping Rank 1–2 hourly pay (`$14–$26/h`) balanced against Ridgeline logging.
7. **Uniforms (`appearance.js`):** Should clocking in at the diner temporarily swap the player's top to an apron/barista shirt (like `appearance.js` outfit parts), or keep the player's own clothes?
   - **Recommended:** **Optional / Rank 1–2 apron top visual while on shift** (saved outfit untouched, reverted on clock-out) — skip in `D-A..D-C` and add as a small polish item if wanted.
8. **Starting menu size at Rank 2 unlock:** Launch with the full 8 drinks + 3 food families (pizza, burgers, sandwiches), or a tight starter menu (4 drinks + burgers + sandwiches + 2 pizzas) expanded by rank?
   - **Recommended:** **Tight starter menu at Rank 2** (Espresso, Americano, Latte, Iced Latte + Classic/Cheeseburger, 2 Sandwiches, Margherita/Pepperoni Pizza), unlocking Cappuccino, Hot Chocolate, Tea, Club/BLT, and Veggie Pizza at **Rank 3 Head Cook**.
