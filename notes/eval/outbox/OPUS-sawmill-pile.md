michadr.

# OPUS: the sawmill yard's planks piled INSIDE the shed (+ waiting logs shown) - 2026-11-17

Version 0.35.19 (never deployed), rebuilt with `npm run release -- --force`. No version bump.

## What changed
- **NEW dist/sawmill-pile.js (54 lines)**. Pure, deterministic, no DOM, no three.js. It gives the place of each stack slot and each log slot in the sawmill model's own coordinates, and turns a plank count into stacks.
- **NEW tests/sawmill-pile.mjs (47 lines).**
- **dist/game.js (still 1768 lines; every change is inside existing lines; CRLF kept, no BOM, `node --check` passes):**
  - Line 39: imports `anchorWorld` from sawmill.js, plus the sawmill-pile.js import.
  - Line 152: the controller's `belt` option is now `()=>0`. The belt no longer shows the stock.
  - Line 409: new `yardBoxes=[]` and `yardPile=null`, declared next to `plankBoxes`.
  - Line 415: comment updated.
  - Line 421: new `yardRect`, `syncYardPile` and `yardTakeAt`, placed in front of `function syncSawmill(){`.
  - Line 428: a stack that reaches the belt's end is lifted off (`c.take()`), then `syncYardPile(p,c)` runs.
  - worldBlocked: the pile and the log deck are solid (`yardBoxes`).
  - Prompt: `sawmill-belt` became `sawmill-pile`. Its point is the nearest spot on the pile's edge and its range is 1.6 m. The label floats over the top stack.
  - `takeBeltPlanks`: removed the "still riding down the belt" check and `sawmillCtl.take()`.
- Not edited: sawmill-yard.js, forest.js, props-assets.js, sawmill.js and every forbidden file. needs.js, gigs.js and their tests were not touched.
- Regenerated: PROJECT-INDEX.md and PROJECT-BRIEF.md (`npm run index`), and dist/releases/0.35.19.

## Footprint and slot maths (sawmill model coordinates, measured from the embedded GLB)
- **Main deck (the white platform):** x -4.3..4.3, z -3.3..3.3, top at y 0.30. Fixed parts on it:
  - the bench at z ±0.6
  - the iron feed rails at z ±0.95 (0.12 m high)
  - posts at x -4, 0 and 4 on z ±3
  - the lowest beam over the deck at y 2.38
- **The planks' Cut path stays at z 0..1.5** (the front half), so the back strip is free.
- **Pile area:** the back strip, x -3.725..3.725, z -2.775..-1.125. It is open toward the yard (east in the world), between the back posts.
- **One plank:** 1.2 × 0.45 m (the existing `sizedPlank`), 0.12 m pitch. A stack of 4 is 0.48 m high.
- **Layers, crossed like a real lumber pile:**

| Layer | Plank direction | Stacks |
|---|---|---|
| 0 | along x, 6 columns × 3 rows | 18 |
| 1 | along z, 15 columns, across every stack below | 15 |
| 2 | along x, 6 × 2, kept inside layer 1 so nothing overhangs | 12 |
| **Total** | | **45 stacks (180 planks of room)** |

- The cap needs 40 stacks (160 planks): 18 + 15 + 7. The top plank sits at y 1.73, well under the 2.38 beam.
- **Cap decision:** no change. YARD_MAX_PLANKS stays 160 and everything fits.
- **Clash check:** a scratch script split every static mesh of the real model into its parts. All 160 planks and all 40 logs had **0 intersections** with any of them (posts, braces, rails, roof, the log pile, the deck). The lowest plank sits at y 0.307 on the deck.
- **Count mapping:**
  - Every plank is drawn.
  - The odd planks (planks % 4) form one short stack in slot 0, at the bottom.
  - Every other stack is full.
  - So `takeStack` (4 planks) always removes exactly the **top** stack (tested for every count 0..160).
  - Example: 6 planks show as [2 in slot 0, 4 in slot 1].
- **Waiting logs:**
  - They use the carried-log geometry and material (1.15 m long, 0.24 m across).
  - They form a nested log deck on the ground at the feed end, just off the deck: x -5.6..-4.5, z -0.28..-3.27.
  - Rows are 12 + 11 + 10 + 9 = 42 places for the 40-log cap, 0.89 m high.
  - They stay clear of the static decorative log pile (z > 0.1) and the deck.
- **Rebuilds:** only when `sawmillYard.planks` or `.logs` changes (cached counts). Nothing is rebuilt per frame.

## Draw calls and materials
- **Planks:** 1 InstancedMesh (`yard-pile`, 160 instances) on the existing plank geometry. Its material is one clone of the model's `Plank` material with a small emissive (colour × 0.14, `PILE_GLOW`) so the pile is not black at night. There is no texture, and the material uses the same shader type as the belt.
- **Logs:** 1 InstancedMesh (`yard-logs`, 42 instances) reusing the ground-log geometry and material as they are.
- **Cost:** +2 draw calls, +1 material. Neither mesh casts shadows (like the belt), so the shadow pass costs nothing. Both live under the `Sawmill` node, so they hide with the prop.
- **Belt:** it now only carries the freshly cut stack to its end stop. There the stack is lifted away (about 6 s), and the pile already counts it. The belt is never a second copy of the stock.

## Collision and the prompt
- The pile and the log deck are solid boxes (`yardBoxes`, inflated by the player's 0.33 m like `plankBoxes`). They are recomputed when the counts change.
- **Reaching the pile:** you can step onto the deck at the open back, between the posts, and stand about 0.35 m from the pile. You can also come round the bench's belt end. The prompt range is 1.6 m from the nearest edge, so it does **not** show through the bench from the front.
- **If the pile grows under the player:** the existing `unstick()` (after 1 s of blocked movement) moves them out.
- **NPCs:** they do not see these boxes, the same as with put-down planks.

## Real output
```
> node tests/sawmill-pile.mjs
PASS sawmill-pile: 45 stack slots in the shed (cap needs 40), 3 crossed layers, none overlap, all under the beams; every plank 0..160 drawn, odd planks in slot 0, taking lifts the top stack; 42 log places for 40 logs

> node tests/planks-wiring.mjs
PASS planks-wiring: one plank source (...), game.js wired, name tags removed

> npm run index
brief 2834 tokens (target 3000), index 32143 tokens (target 32500); 215 modules, 14 generated, 261 tests, 29 scripts; 13 modules without a header comment

> npm run release -- --force
Packaged release 0.35.19: 216 files -> dist/releases/0.35.19
dist/index.html now loads releases/0.35.19/

> npm test
ALL 261 PASSED
All 261 test files passed.
```
- **Stub harness (scratch only):** I also ran the exact `syncYardPile` and `yardTakeAt` source from game.js against real three.js with stubs.
  - (0, 0) gives 0 instances and no boxes.
  - (6 planks, 3 logs) gives 6 + 3 instances and 2 boxes.
  - (160, 40) gives 160 + 40 instances.
  - The take point lands on the pile edge, and the label sits over the top stack.

## Could NOT verify (nothing was seen in a browser). Owner, please check:
1. **Day:** the pile sits on the white deck at the back half, behind the saw bench, on the yard (east) side. It should not poke through posts, braces or the roof. The layers should cross: the bottom along the bench, the middle across it, the top along it again. With 160 planks it should be about 1.4 m high.
2. **Night:** the planks should read as wood, not black (emissive 0.14). If they glow too much by day or stay too dark at night, `PILE_GLOW` on game.js line 421 is the only knob. Global lighting was not touched.
3. **Waiting logs:** a small log deck on the ground just past the feed end of the bench, next to the existing big log pile. Check that it looks sensible and does not block your path to the bench when you feed.
4. **Taking:** walk up to the pile from the open back (or round the belt end) and press E. Check that the top stack vanishes, the prompt is easy to reach, and it does not show from in front of the bench.
5. **Cutting:** the Cut clip still lands 4 planks on the belt, and the stack rides to the end stop and disappears there. The belt beacon now stays green (it used to turn red at 4 belt stacks; the belt never fills now).
6. **Collision:** you cannot walk through the pile or the log deck, and you can still reach the switch, the feed (log in) and the belt end.
7. The odd planks (for example after the trickle of 6) are a short bundle at the bottom corner of the pile, at the belt end. With a part-filled middle layer one end of a bundle can sit on a short stack (a small gap). This is cosmetic.

## Edits wanted in forbidden files
None.

## Confidence
- Pile maths, count mapping and fit (pure, tested, plus the clash check against the real model): high.
- game.js wiring (runs in the stub harness, full suite green): medium-high.
- The look by day and night, prompt feel and collision feel: medium. Never seen in a browser.
