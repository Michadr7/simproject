michadr.

# OPUS: name tags removed + planks chain wired (P-B, P-C) — 2026-11-17

Version bumped to **0.35.18**, as the coordinator asked, because 0.35.17 is live. package.json was written without a BOM. `npm run release` was run without --force and built `dist/releases/0.35.18`; dist/version.js, index.html and version.json were rewritten by the script. **0.35.17 was not touched.** To play-test this build, reload the page.

## Step 0: the floating NPC name tags are gone
- dist/game.js: removed `tagEls/tagV/tagNext/tagList`, `nameTagsTick()` (it built 4 DOM divs and moved them every frame) and its call in `updateWorldUI()`. Rewrote the NPC-NAMES comment.
- dist/index.html: removed `<div id="nameTags"></div>`.
- dist/style.css: removed the `.name-tag` rule.
- Kept as they were: the generic "Talk to <name>" prompt (`npcCrowd.talkable` at range 2.2) and `talkCrowd()`, which shows the name in the dialogue panel. The tags never used a sprite or canvas (they were plain DOM divs), so there were no GPU resources to free.
- No test pinned the tags. tests/planks-wiring.mjs now checks that `nameTagsTick` and `name-tag` are gone from game.js.

## Step 1: the planks chain is wired in

### a) ONE plank source (my choice, and why)
**The player-fed yard (`progress.sawmillYard`) IS the sawmill's stock. The world sawmill has no rate (it used to make 24 a day). The yard's trickle of 6 a day is the only free supply.**
- dist/world-goods.js: `property:sawmill` planks changed from `g(60,160,60,{rate:24})` to `g(60,160,0)`. So it has no rate and a fresh yard starts empty.
- dist/world-tick.js `runWorldDay` now does this:
  1. It takes the yard (the saved one, or for a progress without one, a yard holding the world's sawmill planks).
  2. It applies `trickle(yard,d)` once for each ticked day. That is at most 14 days, the same cap as the world catch-up, and it is idempotent through `lastTrickleDay`.
  3. It copies the yard into the world's sawmill stock.
  4. It runs `catchUp`, so SUPPLY still moves 6 a day to the Eastbank supplier, taken from that stock.
  5. After the needs step it writes the world's sawmill number back into the yard, so whatever the supply or a late restock took leaves the yard.
  - New exports: `yardOf` and `SAWMILL_PLACE`.
- Why this option: there is exactly one stock and one free source. SUPPLY and the world-state conservation tests keep working. `needs.js` no longer opens a "harvest" need at the sawmill, because it has no rate. The 10-day conservation test passes: planks in = the trickle only; planks out = what the town used.
- dist/plank-economy.js line 26: `OLD_SAWMILL_RATE` read the live world rate, so it would have become `undefined`. I pinned it to the literal 24 as history. **This file was not on my list**; it is a one-line change and nothing else was touched there.
- tests/plank-economy.mjs line 17: now asserts that OLD = 24, that the world sawmill rate is `undefined`, and that the start is 0.
- tests/world-tick.mjs line 65 and tests/needs.mjs line 87: these gave the sawmill 0 planks and expected it to ship. They now put 60 planks in it explicitly, because a fresh sawmill is now empty.

### b) Save
- dist/jobs.js `normalizeProgressWith`: `s.sawmillYard=normalizeYard(a.sawmillYard)`.
- An **old save without a yard** gets a yard holding its world sawmill planks plus its old belt stacks × 4. This happens once: normalising a second time does not add them again (tested).
- `s.belt` is now **derived** from the yard as min(4, planks/4), so the belt only shows the yard. The carry.mjs belt tests still pass unchanged.
- `freshProgress()` deliberately has no yard. normalize creates it, and `world-tick yardOf` covers progress that was never normalised.
- tests/save-file.mjs: the "tight disk" went from 7000 to 7500 bytes, because the save grew by about 100 bytes. This follows the same precedent as W-D1.

### c) Gameplay at the sawmill (game.js)
- New import from sawmill-yard.js (aliased so no names clash).
- New top-level helpers before `syncSawmill`:
  - `beltOf`
  - `yardLine` (status text from `summarize()`)
  - `setYard` (sets progress and persists)
  - `tickSawYard`: runs the saw by the change in `gameMinutes(progress)`, capped at 1440. It runs every frame from `updateZones`, before `syncSawmill`. Because it uses game time it does not depend on frame rate, and the saw also cuts during a sleep. It persists when a log finishes, and when the saw stops it toasts within 25 m.
- `syncSawmill`: the lever follows `yard.on`. The Cut clip loops while logs are waiting. The belt shows `beltOf(progress)` stacks.
- `feedSawmill`: a carried log goes onto the bench through `feed`. Up to 40 can wait. The saw switches itself on. The toast shows the yard status.
- `toggleSawmill`: uses `switchSaw`. It refuses to switch on with "Put a log on the bench first." or "yard full".
- `takeBeltPlanks`: uses `takeStack`, which puts up to 4 planks into `carry {kind:'planks',count}`. It keeps the "still riding down the belt" check and still counts `planksMilled`. That piece pays 0, so trickle planks cannot be farmed.
- Prompts: the switch prompt shows the yard line. The belt-end prompt reads "Take N planks · M in the yard". Removed `onCutDone`, which was dead.
- The sawmill is still closed off shift, but the yard keeps ticking.
- No new DOM nodes.

### d) Warehouse (P-C)
- dist/shift.js: `PIECE_PAY.racks = PAY.rackCell` (imported from plank-economy.js; still 500).
- dist/forest.js `stackPlanks`:
  - It now plans with `intakePlan(racksOf, min(count, room in this cell), {handOnly:true, slot})`. Offering only what fits in the chosen cell means nothing spills into a cell the player did not pick, and what does not fit stays in the hands.
  - It applies the plan with `addToRack`. The pallets stay the truth, and `mirrorPallets` is untouched.
  - The pay gate is `payFor(...)` plus the existing `shift.stacked` guard, so a cell pays once per shift.
  - The message shows `RACK_CELL_PAY` instead of a hard-coded "$5.00".
- tests/warehouse.mjs passes unchanged: pay once, the leftover case, the refill. tests/planks-wiring.mjs checks it again.

### e) Prices screen: NOT done (it needs a phone file I may not edit). The exact edit wanted:
- dist/phone.js:
  - Add `'prices'` to `APP_IDS` (line 26) and to both screen-name lists (lines 126 and 143).
  - Render `priceTable(world, day, minute)` from plank-economy.js: one row per place with label, priceCents, stock and note.
  - Pass in a world whose sawmill stock is the live yard: `{...world,stock:{...world.stock,'property:sawmill':{planks:progress.sawmillYard.planks}}}`. The world copy only updates at the 05:00 tick.
- dist/index.html: add a `phoneApp-prices` button and a `<section id="phoneScreen-prices">`.

## Files (line counts after the change)
dist/game.js 1768 (+7 net) · dist/jobs.js 70 · dist/forest.js 118 · dist/shift.js 117 · dist/world-goods.js 66 · dist/world-tick.js 94 · dist/plank-economy.js 159 · dist/index.html · dist/style.css · package.json (0.35.18) · NEW tests/planks-wiring.mjs 68 · tests/plank-economy.mjs, tests/world-tick.mjs, tests/needs.mjs, tests/save-file.mjs (pins, as above) · PROJECT-INDEX.md / PROJECT-BRIEF.md regenerated · dist/releases/0.35.18 (new).

## Real output
```
> node tests/planks-wiring.mjs
PASS planks-wiring: one plank source (world sawmill rate gone, trickle 6/day into the yard, supply to the supplier from the yard, 10-day conservation), old saves move world planks + belt into the yard once, junk yards load, 1 log = 4 planks in 4 game min, rack cell pays $5.00 once per shift with leftovers in the hands, game.js wired, name tags removed

> npm run index
brief 2834 tokens (target 3000), index 31544 tokens (target 32500); 211 modules, 14 generated, 256 tests, 28 scripts; 13 modules without a header comment

> npm run release
Packaged release 0.35.18: 212 files -> dist/releases/0.35.18
dist/index.html now loads releases/0.35.18/

> npm test   (first run: 1 of 256 failed, save-file.mjs "a full disk keeps fewer backups: 0", fixed as above; second full run:)
ALL 256 PASSED
All 256 test files passed.
```

## Could NOT verify (nothing was seen in a browser)
- The lever following the yard and the Cut clip looping while logs wait: I could not check how it looks, the timing between the clip and the 4 game minutes per log, or whether the belt stacks snap in when the yard has more than 4 stacks.
- The red "full" beacon now lights whenever the yard has 16 or more planks. Its meaning has changed.
- Toast spam: the stop toast fires once per stop. I could not check how it feels.
- The world's sawmill number (and so any price read from it) only follows the yard at the 05:00 tick.
- Co-op: each player has their own yard (it lives in progress). I did not test that with two players.

## Edits wanted in forbidden files
- phone.js and index.html for the Prices screen (see e).
- None needed elsewhere.

## Confidence
- Step 0 (name tags): high.
- a) one source and conservation: high (tested over 10 days, the catch-up and an old save).
- b) save and migration: high.
- c) sawmill gameplay: medium. The rules are tested, but the visuals and feel were never seen.
- d) warehouse: high.
- e) not done.
