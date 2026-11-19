# Home Cooking: Design Note

Rework plan for home cooking (`life.groceries` -> stove interaction, recipes, and pantry), including why cooking currently fails, a Small vs Large scope comparison, whether to share the new `bakery-goods.js` / `eden-wholesale.js` cargo system, save migration, co-op impact, a staged build plan, and owner decisions.

---

## 1. What Is Broken Today (and Why)

Home cooking (`'cook'`) currently feels broken—and in common cases literally does nothing—for six concrete reasons verified in the codebase:

1. **No feedback, animation, sound, or time cost (`dist/game.js:698-699`):**
   - `candidates()` (`dist/game.js:786`) opens a `station()` bubble (`'Kitchen'`, `"N grocery packs in your inventory."`, button `'Cook a meal'` -> `useLife('cook')`).
   - `lifeAct('cook')` (`dist/game.js:698`) calls `lifeTransaction(GameState.progress, 'cook', 'home')` (`dist/life.js:26`), which only subtracts `1` from `life.groceries` and adds `food +65`, `energy +20` (capped at `50` if `thirst <= 0`, `dist/life.js:8-11`).
   - Unlike `'meal'` at the café (`dist/game.js:698`) and eating from inventory (`dist/game.js:1500`), **`'cook'` skips `storyEvent('ate')`, skips `audio.sweep('eat-bite')`, plays no stove sound, triggers no `busy` progress ring (`updateRing`, `dist/game.js:1614`) or arm pose (`dist/game.js:1112`), lights no burner, and advances `0` game minutes.**
2. **Cursor lock is dropped on success (`dist/game.js:699`):**
   - `useLife(action)` hides `$('dialog')` and sets `modal = false`, but **never calls `look.capture()`** (unlike `$('closeDialog').onclick` at `:512` and `closeWorldDialog` at `:275`), leaving mouse look dead until the player clicks again.
3. **Studio stove coordinate mismatch (`dist/apartment.js:22` vs `dist/game.js:409`):**
   - In Studio 2B, the kitchen counter sits along `z = -4.85` (front edge `-4.425`), the sink is at `x = 2.0`, the refrigerator is at `x = 5.6`, and the **stove + burners sit at `x = 4.2, z = -4.8`** (`x = 4.0` and `4.4`).
   - `studioHome.KITCHEN` (`dist/game.js:409`) is hardcoded to `{x: 3, z: -3.5}` — **1.77 m away** from the stove centre, aimed at the empty middle cabinet. Standing directly in front of the right stove burner (`x = 4.4, z = -4.125`) is **1.53 m** from `KITCHEN`, just outside the `< 1.5 m` interaction radius (`dist/game.js:698, 786, 1130`), so walking right up to the stove hides the prompt or triggers `"Move closer to the counter."`
4. **Trapped dialog when full or empty (`dist/game.js:699, 786`, `dist/life.js:26`):**
   - If `food >= 100 && energy >= 100` (e.g., right after sleeping or starting a session), `lifeTransaction` returns `{error: 'You are already full and rested.'}`. `useLife` calls `toast(r.error)` and `return`s **without closing the dialog**. With `0` groceries, `[Cook a meal]` is still shown as an active primary button that only errors.
5. **House utilities skipped (`dist/game.js:698`):**
   - `utilityUsage += 15` (`$0.15`) only runs when `home.kind === 'studio'`, ignoring rented/owned Cedar Heights houses (`properties`). Meanwhile `interiors.js:16` defines `USES = {'f-bed-double':'sleep','f-bed-single':'sleep','f-stove':'cook'}`, which `game.js` never reads (it only uses `home.KITCHEN`).
6. **Abstract counter instead of real items (`dist/life.js:1,23,26`, `dist/store.js:14`, `dist/inventory-ui.js:11`, `dist/game.js:559-561`):**
   - `life.groceries` is a hidden integer (`0..20`) bought via `#storeGroceries` (`$4.00`) that never enters `inventory.slots`, has no recipes or skill link, and is also consumed to feed the cat (`petAct(true)` at `dist/game.js:559-561`).

---

## 2. Should Home Cooking Share the Bakery Goods / Eden Wholesale System?

**Short answer: No for bulk cargo sacks (`cargo.js` / `bakery-goods.js`); optionally yes for a small retail counter at Eden Wholesale.**

- **Why NOT share `bakery-goods.js` / `cargo.js` / `cargo-items.js`:**
  - `dist/bakery-goods.js:17-18` defines **wholesale B2B restock goods**: `25 kg` sacks of `flour` (`$18.00` placeholder) and `20 kg` sacks of `coffee-beans` (`$80.00` placeholder), backed by `6` GLBs (`788–2,396` tris each) for `cargo.js` / `cargo-items.js` hand-carry (`progress.carry`, slow walk, 1 item in hands, 0 pocket slots) and truck-bed / pallet deliveries to `property:alder-bakery`.
  - Forcing a player to carry a 25 kg sack across town (or own a truck) just to cook breakfast in Studio 2B breaks early-game progression and tangles physical world cargo (`progress.carry`) with pocket/pantry storage (`progress.inventory`).
- **What CAN connect cleanly:**
  - **Pocket retail items (`items.js` / `inventory.js`):** Home cooking uses small stackable grocery items (e.g., `1 kg` flour bag `$2.50`, ground coffee tin `$4.50`, carton of eggs, milk jug, produce, bread loaf).
  - **Two clean shop options:**
    1. **Corner Market (`shop:market`) sells all home ingredients** (plus `cat-food`), keeping one familiar grocery stop in Alder Center.
    2. **Optional Eden Wholesale retail link (`dist/eden-wholesale.js:14` `COUNTER`):** Once Eden Wholesale is wired in map stage `I3`, its outdoor shop `COUNTER` (separate from the rear loading `PICKUP` dock) can sell retail `flour-bag` and `ground-coffee` at a slight discount (`07:00–17:00`), giving Bruce Hughes's store a player-facing use beyond truck hauls.
  - **World stock (`world-goods.js:7-10`):** `eggs`, `milk`, `produce`, and `bread` already exist in `shop:market` with `decayDays` (`21, 7, 10, 4` days; currently `"DATA ONLY in W-A: nothing spoils yet"`). Large-option market purchases can optionally decrement `world.stock['shop:market']` when in stock, without blocking survival if a shelf hits 0 (fallback restock or canned dry goods).

---

## 3. Two Options: Small vs Large

### Option A — Small: Fix & Polish the Existing Pack System
Keep `life.groceries` (`0..20`, `$4.00` at Corner Market) and cat-feeding intact, and make the stove interaction real and responsive:
- Move `studioHome.KITCHEN` (`dist/game.js:409`) to `{x: 4.2, z: -3.85}` and anchor the prompt on the stove `{x: 4.2, y: 1.15, z: -4.8}`.
- Add a **3.0 s `busy` cooking phase** (`#workProgress` ring, `"Cooking a meal…"`), dual-hand cooking reach (`avatar.reach`, `game.js:1112`), a burner emissive glow / skillet mesh on the stove while cooking, `10` game-minutes elapsed (`advanceTime`), `storyEvent('ate')`, `look.capture()`, and clean disabled/closed state when `groceries === 0` or `food >= 100 && energy >= 100`.
- **Sound within budget:** Reuse existing clips from `dist/diner-sounds.js` (`grill-sizzle` / `plate-clink`) and `dist/sweep-sounds.js` (`eat-bite`) — **0 KB added** (handoff notes only ~73 KB left in the 3.0 MB audio budget).

| | Option A (Small) |
|---|---|
| **Pros** | Ships in 1 `game.js`-lane stage; zero save migration; zero `store.js` / `items.js` / `pets.js` churn; immediately fixes the broken stove bug, cursor capture, and studio coordinates. |
| **Cons** | Still an abstract `0..20` counter; no recipes, no fridge storage, no `hospitality` skill link, no packable home lunches; cat still eats "grocery packs". |
| **Files touched** | `dist/game.js`, `dist/apartment.js` (burner/skillet visual node), `tests/cooking.mjs` (or extend `tests/energy.mjs`). |

### Option B — Large: Real Ingredients, Fridge Storage, Recipes, Skill & Cat Food
Replace `life.groceries` with a complete home kitchen & pantry loop:
- **Real items (`dist/items.js`, `dist/store.js`):** Add stackable ingredients (`eggs`, `milk`, `produce`, `bread-loaf`, `flour-bag`, `ground-coffee`, `meat-pack`, `sugar`) and a dedicated `cat-food` item (`$3.00`, stack 10), keeping `BASE_SLOTS = 8` manageable via home storage.
- **Home Fridge Storage (`dist/apartment.js`, `dist/interiors.js`, `dist/housing.js` / `dist/ownership.js`):** Make the existing studio refrigerator (`x = 5.6, z = -4.85`) and house `f-fridge` a **20-slot home pantry** (matching `DESIGN.md:100`). Cooking reads from **both pocket inventory and the current home's fridge** (fridge first so players don't have to shuffle items into their pockets first).
- **Recipes & Timed Stove Action (`dist/home-recipes.js`, `dist/home-cooking.js`):** Reuse the `diner-recipes.js` structure (`{id, name, category, station, cookSec, burnSec, gameMinutes, ingredients, food, thirst, energy}`). At the stove (`E`), pick a recipe; a `3–5 s` timed cook runs (`busy` ring + sizzle audio + optional 1-click stop window before `burnSec` like `diner-recipes.js:65-75`, or deterministic timed cook). Player can **Eat hot** (`storyEvent('ate')`) or **Pack in inventory** (uses `item-models.js` existing bowl/sandwich/cup handhelds for work lunches).
- **Hospitality Skill (`dist/skills.js`):** Home cooking grants `+4` to `+8` `hospitality` XP per dish (smaller than diner shifts) and scales meal quality: `+5%` food/energy bonus per 2 levels (capped at `+25%`) and slightly wider sweet-spot timing.
- **Hunger, Energy & Warm-Meal Effect (`dist/life.js`):** Today `life` has only `{food, thirst, energy, groceries}` and **no player `mood` stat** (`mood` only exists on NPCs in `npc-life.js` and cats in `pets.js`). Rather than adding an unrequested 4th HUD bar, home-cooked meals grant higher `food` + `energy` than raw snacks plus an optional **Warm meal** buff (`wellFedUntil`, `-20%` food/energy drain for `180` game min).
- **Spoilage (optional / coarse):** Perishables (`milk` 7d, `produce` 10d, `bread-loaf` 4d, `eggs` 21d, cooked packed meals 3d; dry `flour-bag`, `ground-coffee`, `cat-food` never spoil) record an integer `expDay` per lot (`×2` shelf life inside a fridge). Past `expDay`, items turn into `'spoiled'` (clear warning, discardable).
- **Cat Food (`dist/pets.js`, `dist/game.js:559-561`):** `petAct(true)` uses `cat-food` from pocket or home fridge instead of `life.groceries`.

| | Option B (Large) |
|---|---|
| **Pros** | Fulfils `DESIGN.md:100` (working fridge + stove); connects Corner Market, Eden Wholesale, `hospitality` skill, packable logging lunches, and proper `cat-food`. |
| **Cons** | Multi-stage build; requires `life.groceries` migration and UI for recipe picker + fridge transfer; spoilage splits inventory stacks by expiry day if enabled. |
| **Files touched** | New: `dist/home-recipes.js`, `dist/home-cooking.js`, tests. Edited: `dist/items.js`, `dist/inventory.js`, `dist/life.js`, `dist/skills.js`, `dist/store.js`, `dist/inventory-ui.js`, `dist/jobs.js`, `dist/housing.js`, `dist/ownership.js`, `dist/apartment.js`, `dist/interiors.js`, `dist/game.js`, `dist/index.html`, `dist/style.css`. |

---

## 4. Draft Recipe Table (Large Option)

All ingredients use pocket `items.js` units (`[new]` = new `items.js` id; `[existing]` = already in `items.js` or `item-models.js` handheld geometry). All durations are **real seconds** at the stove + **game minutes** elapsed (`advanceTime`):

| ID | Dish | Ingredients | Real (`cookSec` / `burnSec`) | Game Min | Food | Thirst | Energy | Output / Notes |
|---|---|---|---|---|---|---|---|---|
| `home-coffee` | Mug of Coffee | `ground-coffee` `[new]` ×1 | `2.5 s` / `6 s` | `5 m` | `0` | `+20` | `+25` | Reuses `coffee` (`items.js:22`) if packed; kettle/stove |
| `fried-eggs` | Fried Eggs | `eggs` `[new]` ×1 | `3.0 s` / `7 s` | `8 m` | `+35` | `0` | `+12` | Fast starter breakfast |
| `egg-toast` | Egg on Toast | `eggs` `[new]` ×1, `bread-loaf` `[new]` ×1 | `3.5 s` / `8 s` | `10 m` | `+55` | `0` | `+20` | Matches `diner-recipes.js` `egg_melt` feel |
| `pancakes` | Stack of Pancakes | `flour-bag` `[new]` ×1, `eggs` `[new]` ×1, `milk` `[new]` ×1 | `4.5 s` / `9 s` | `15 m` | `+70` | `0` | `+25` | Uses flour (`Eden Wholesale` or Market); 2 servings if packed |
| `veggie-omelette` | Veggie Omelette | `eggs` `[new]` ×1, `produce` `[new]` ×1 | `4.0 s` / `8 s` | `12 m` | `+65` | `+5` | `+22` | Balanced morning meal |
| `grilled-sandwich` | Toasted Sandwich | `bread-loaf` `[new]` ×1, `produce` `[new]` ×1 | `3.0 s` / `7 s` | `8 m` | `+50` | `+5` | `+15` | Packable into `sandwich` (`items.js:12`) for work |
| `hearty-soup` | Hearty Vegetable Soup | `produce` `[new]` ×2, `bread-loaf` `[new]` ×1 | `5.0 s` / `11 s` | `18 m` | `+75` | `+20` | `+25` | Packable into `soup` (`items.js:17`); hydrates too |
| `camp-skillet` | Hearty Skillet | `meat-pack` `[new]` ×1, `produce` `[new]` ×1, `eggs` `[new]` ×1 | `5.5 s` / `11 s` | `20 m` | `+90` | `0` | `+35` | High-energy lumberjack meal; optional warm-meal buff |

*(Note: one `flour-bag` or `eggs` unit can represent a kitchen pack/portion of ~4–6 uses or 1 recipe unit per purchase priced at `$2.00–$4.50` so cooking at home stays roughly 2× cheaper per food point than buying `$4–$6` café/market ready meals.)*

---

## 5. Save-Format Impact & `life.groceries` Migration

- **Option A (Small):** Zero save-format change; `life.groceries` (`0..20`) stays unchanged.
- **Option B (Large):** Keep `SCHEMA` unchanged (additive optional fields, matching `migrateCafe` in `dist/jobs.js:34-36` and `migrateParcel` in `dist/cargo-items.js:153-163`):
  1. **Keep legacy field tolerated on read:** `normalizeLife` (`dist/life.js:1`) reads `life.groceries` (`0..20`), then a dedicated `migrateGroceries(s, a)` in `dist/jobs.js` converts any `groceries > 0` once and writes `s.life.groceries = 0`.
  2. **Conversion rule (value-preserving & idempotent):** Each legacy `$4.00` (`400 c`) pack converts into `1 × eggs` + `1 × produce` (or `1 × bread-loaf`), plus `1 × cat-food` per `3` packs (rounded up, minimum `1` if `s.pets?.pet` exists) so cat owners never lose the ability to feed their cat on load.
  3. **Where migrated items go:** First into the player's home fridge (`housing.fridge` on Studio 2B if rented, or the main owned/rented `properties[id].fridge`); if the player owns no home yet (edge-case old save) or the fridge is full, into `inventory.slots`, and any remainder refunded as `cash += leftover * 400`.
  4. **Player notice:** Append one `messages.js` Phone notification (`app: 'player'`): *"Your grocery packs have been unpacked into your kitchen fridge (plus cat food for your pet)."* Because `s.life.groceries` becomes `0`, running `normalizeProgress()` twice is a strict no-op.
  5. **Additive fridge & spoilage fields:**
     - `housing.fridge`: optional array of `{id, quantity, expDay?}` (max `20` slots), normalized cleanly to `[]` if absent.
     - `properties[id].fridge`: same optional array on rented/owned houses (`dist/ownership.js`).
     - `inventory.slots[i].expDay`: optional integer game day; omitted on non-perishables and pre-migration items.

---

## 6. Multiplayer / Co-op Impact

Verified against `dist/relay-protocol.js` (`PROTOCOL = 1`) and `dist/game.js:1717-1804`:

- **Room isolation already works:** `validRoom` (`relay-protocol.js:18`) allows `'home'` and `/^house:[a-z0-9-]{1,40}$/`, and `roomScene` (`game.js:1717`) places remote avatars in `apartment.scene` or `houseHomes.get(id).room.scene`. No `PROTOCOL` bump is needed.
- **Client-owned saves:** `life`, `inventory`, `housing.fridge`, `properties`, and `pets` live strictly on each client (`localStorage` / cloud save); the relay only carries `{id, position, room, pet}` and the host's `clock`.
- **Clock handling online (`session-clock.js`, `game.js:1756-1763`):** Like `sleepThrough` (`game.js:1709`), a joiner following the host (`sessionClock.following`) must **not** jump their local clock ahead on `advanceTime` during cooking, or their time drifts from the host's clock; cooking should simply take `3–5 s` real time without forcing a clock jump while `multiplayer.online && sessionClock.following`.
- **What stays client-local:** Two players standing in Studio 2B each cook from their own pantry/fridge and do not see each other's pan/burner props (consistent with chopping/eating today). A shared co-op house fridge is out of scope without server-owned container state.

---

## 7. Staged Build Plan

| Stage | Scope & Files | Lane | Suggested Model |
|---|---|---|---|
| **S0 (If Small chosen)** | Fix `studioHome.KITCHEN`, add `3.0 s` `busy` cook loop, burner glow, `advanceTime(10)`, `diner-sounds` / `eat-bite` audio, `storyEvent('ate')`, `look.capture()`, house utility billing; add `tests/cooking.mjs`. | **`game.js` lane** (sole editor) | **Opus** (`game.js` wiring) |
| **L1 (Large: Pure Recipes)** | New `dist/home-recipes.js` (recipe table, ingredient list, `hospitality` quality/XP math, packable meal mapping) + `tests/home-recipes.mjs`. | New files only | **Sonnet** |
| **L2 (Large: Pantry, Save & Migration)** | New `dist/home-cooking.js` (fridge container rules, cook transaction, optional `expDay` spoilage); edit `dist/items.js`, `dist/inventory.js`, `dist/life.js`, `dist/skills.js`, `dist/housing.js`, `dist/ownership.js`, `dist/jobs.js` (`migrateGroceries`) + migration/unit tests. | Pure modules (no `game.js`) | **Opus** (save format & migration), **Sonnet** (tests) |
| **L3 (Large: Store, Inventory & Kitchen UI)** | Update `dist/store.js`, `dist/inventory-ui.js`, `dist/index.html`, `dist/style.css` (ingredient & `cat-food` cards, fridge/recipe picker modal or world panel) + UI tests. | UI modules (no `game.js`) | **Sonnet** |
| **L4 (Large: `game.js` & Interiors Wiring)** | Wire `dist/game.js`, `dist/apartment.js` (stove/fridge spots + pan visual), `dist/interiors.js` (`USES` / `f-fridge` + `f-stove` spots), `petAct` -> `cat-food`, `utilityUsage` for all homes, stove `busy` animation + existing sizzle audio, `look.capture()`, `tests/cooking-game.mjs`. | **`game.js` lane** (sole editor) | **Opus** |
| **L5 (Large: Balance & Release Gate)** | Tune ingredient prices, portions, `hospitality` XP, and `decayDays`; run `npm run release -- --force`, `npm test`, and browser visual check. | Tuning / Gate | **Haiku** (tuning) + **Opus** (gate) |

---

## 8. Questions for the Owner (Recommended Answer First)

1. **Scope — Small fix now vs Large rework:**
   - **Build Small (`S0`) first, or go straight to Large (`L1–L5`)?** *(Recommended: **Small (`S0`) first** if you want cooking working in the next ship while the bakery/I3 lane finishes, then **Large (`L1–L5`)** after I3 lands; or skip `S0` and go straight to `L1–L5` if you'd rather touch `game.js` once.)*
2. **Eden Wholesale vs Corner Market for home flour & coffee:**
   - **Keep all home ingredients at Corner Market (`shop:market`), or also sell small `flour-bag` / `ground-coffee` at Eden Wholesale's front `COUNTER`?** *(Recommended: **Sell all home ingredients at Corner Market** so players have one convenient grocery trip, and optionally also sell retail `flour-bag` / `ground-coffee` at **Eden Wholesale's `COUNTER`** at ~15% off once `I3` wires it — keeping `25 kg` / `20 kg` cargo sacks strictly for bakery haul gigs.)*
3. **Cooking minigame vs simple timed cook at the stove:**
   - **Pick recipe -> `3–5 s` progress ring (no fail state), or include a 1-click "Take off heat" sweet spot (`cookSec`..`burnSec` like `diner-recipes.js`)?** *(Recommended: **Simple `3–5 s` progress ring first** so eating at home stays relaxing, with the `burnSec` sweet-spot minigame optional later or only for bonus quality.)*
4. **Eating hot vs packing cooked meals:**
   - **Allow both "Eat now" and "Pack for later" (into pocket inventory for logging/hauling lunches), or eat immediately at the stove?** *(Recommended: **Both "Eat now" and "Pack for later"** — packing reuses existing `items.js` / `item-models.js` food slots and makes home cooking genuinely useful on long Pine Ridge shifts.)*
5. **Ingredient spoilage (`expDay`):**
   - **Skip spoilage at launch (`decayDays` on shops only), or enable per-lot expiry on home fridge/pocket ingredients (`2×` life in fridge)?** *(Recommended: **Skip spoilage in L1–L4** to avoid split-stack clutter in an 8-slot bag, and add coarse day-expiry later only if you want pantry pressure.)*
6. **Warm-meal bonus instead of a 4th HUD bar:**
   - **Use a temporary "Well fed" drain-reduction buff (`-20%` food/energy drain for 3 game hours) from cooked meals, or add a full Player Mood stat?** *(Recommended: **Temporary "Well fed" buff** — gives home cooking a clear mechanical edge over vending snacks without cluttering the HUD or `life.js` save shape.)*
7. **Cat food (`petAct`):**
   - **Add a dedicated `cat-food` item at Corner Market (`$3.00`, usable from pocket or fridge) and migrate old `life.groceries` into starter ingredients + `cat-food`, or keep cat feeding free/abstract?** *(Recommended: **Dedicated `cat-food` item + auto-grant `cat-food` in `migrateGroceries`** so existing cat owners are never stranded.)*
