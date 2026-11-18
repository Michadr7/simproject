michadr.

# OPUS T-E: timber wiring (trunks, slabs, bucking, saw, piles, beds, saves)

Prompt: notes/eval/prompts/opus-T-E.md. Nothing was run in a browser. No git was used. Version not bumped (0.35.20 rebuilt with --force).

## Gate result (real output)
- `npm run index`: `brief 2834 tokens (target 3000), index 33652 tokens (target 34000); 223 modules, 14 generated, 277 tests, 30 scripts`
- `npm run release -- --force`: `Packaged release 0.35.20: 224 files -> dist/releases/0.35.20`
- `npm test` (second full run): `FAILED FILES: farm-tractors.mjs` / `1 of 277 test files failed.`
  - **farm-tractors.mjs is NOT mine**: it asserts `ENGINES.tractor_juff.file === 'eng-worktruck'`, but `dist/vehicle-sounds.js` (changed 00:44:47 tonight by the parallel sounds work) now says `'eng-tractor'`. I did not touch vehicle-sounds.js or the test. The runner retried it once ("failed twice"). Needs the sounds owner to re-pin the test.
  - The FIRST full run had 49 failures, all `SyntaxError: The requested module './sweep-sounds.js' does not provide an export named 'SWEEP_CORE'`: sweep-sounds.js was being edited by someone else while my release was packaged (dist copy 00:45:10, release copy 00:45:02). The second run (after a fresh release) is the one above.
- Single runs (pasted from the run log): `PASS timber-wiring.mjs`, `PASS timber-game.mjs`, `PASS timber-rules.mjs`, `PASS grid.mjs`, `PASS carry.mjs`, `PASS cargo.mjs`, `PASS cargo-game.mjs`, `PASS forest-tasks.mjs`, `PASS office-game.mjs`, `PASS tools.mjs`, `PASS planks-wiring.mjs`, `PASS skills.mjs`, plus cargo-items, cargo-hands, load-drag, sawmill-yard, sawmill-yard-trunks, sawmill-pile, sawmill-pile-timber, plank-economy, talk-memory, workforce-game, startup all PASS.

## Files changed (line counts now)
| file | lines | what |
|---|---|---|
| dist/grid.js | 156 | chopTree drops ONE trunk (`kind:'trunk'`, 1.3 m along the fall line), message "Timber! A trunk is down.", XP as before; NEW `buckTrunk`, `buckTool`, `TRUNK_FALL`, `BUCK_RANGE` (2.8 m); normalizeLogs keeps `kind:'trunk'` only (old logs get no kind) |
| dist/carry.js | 145 | shoulderLog: a trunk (empty hands) or a second log (`{kind:'log',count:2}`); putDownLog puts down 1 log, 2 logs side by side, or the trunk; NEW slabDrops (`MAX_SLAB_DROPS` 12, `normalizeSlabDrops`, `putDownSlab`, `pickUpSlab`) |
| dist/cargo.js | 177 | slotPositions: trunk/slab lengthwise over 2 cells across x 2 rows (`longSlot`); logs/planks/crates unchanged; slab h .2 -> .08 (so 60 fit the flatbed); loadCarry: trunk/slab pieces, two logs load as two (one if only one fits), ATV: "Trunks do not go on this bed.", crate-mix covers trunk/slab |
| dist/cargo-view.js | 42 | trunk/slab drawn with the GLB parts (`setTimberParts`), one InstancedMesh per kind per vehicle made on the first piece; views refresh when the parts arrive |
| dist/plank-economy.js | 170 | NEW `TIMBER_SALE_CENTS` (= world-goods trunks 2800, slabs 1800) and `sellTimber` (Ridgeline shift, cash + earned) |
| dist/game.js | 1883 (CRLF kept) | see "game.js wiring" below |
| dist/world.js | 651 (setLogs only, same line count) | setLogs leaves trunks out (game.js draws them) |
| dist/jobs.js | 71 | `slabDrops` optional field (absent when none) |
| dist/items.js | 39 | chainsaw: $350, lumberjack level 5, text "Sold only by Ridgeline Timber to a Hauler at level 5"; logging-chainsaw unchanged |
| dist/map-definition.js | 1152 | ridgeline store: chainsaw rank 6 -> 3 |
| dist/tools.js | 26 | SAWS.chainsaw level 15 -> 5, comments |
| dist/skills.js | 36 | perk texts: "One more log from every trunk you cut." / "N logs per trunk" |
| tests/timber-wiring.mjs | NEW, 81 | beds, bed view, loading, hands, sale, chainsaw, saves (fixture save-0.35.18-talk.json) |
| tests/timber-game.mjs | NEW, 56 | the packaged game: fell, carry, buck (axe + chainsaw), two logs, X, saw feed, slab pile, the three meshes (real GLB geometry) |
| tests/grid.mjs, carry.mjs, tools.mjs, office-game.mjs, forest-tasks.mjs, planks-wiring.mjs, skills.mjs | re-pinned | trunk instead of logs, second log joins, chainsaw $350/level 5/rank 3, `feedYard(p.sawmillYard,want,k)` source pin, "logs per trunk" |

### game.js wiring (all additive, single-line anchors)
- Loads dist/assets/timber/trunk.glb, logs2.glb, slab.glb with GLTFLoader (only when `document.baseURI` exists; a failure warns `Timber model missing: dist/assets/timber/<name>.glb` and that model is simply not drawn, no fake boxes). boards4.glb is NOT used (the yard's board pile does not change, as asked).
- Shoulder: trunk / two logs (logs2.glb) / slab ride in the carried-log group with the log's hand pose (`logPose` now for log, trunk, slab). Speeds come from carry.js (trunk .6, two logs .9, slab .8, no sprint).
- Ground: `ground-trunks` InstancedMesh (cap MAX_LOGS 80, casts shadow); trunks wait for the fall like logs did (pendingLogs).
- Bucking: E at a trunk with an axe = chop swings (`buckHitsFor`, hold E keeps swinging, "Cut n / need" toasts); with a chainsaw = hold E for `buckTimeSec` (1.2 s / 0.8 s), letting go stops it ("Hold E to cut through the trunk."). Empty hands = "Pick up the trunk (heavy: slow walk)". Swings already in a trunk are not saved.
- Saw: "Put the log / two logs / trunk on the bench" at the feed end (`feedYard(...,want,kind)`; if only one of two logs fits, one stays on the shoulder); tickSawYard persists on trunk changes; the Cut clip plays while logs OR trunks wait (same cadence, the yard does 8 s / 12 s); "Take a slab · n in the yard" at the slab pile; yardLine adds trunks/slabs when there are any.
- Piles: `yard-trunks` (TRUNK_SLOTS 20, in the sawmill group like yard-logs, no shadow) and `yard-slabs` (84 yard slots + 12 ground slabs in ONE mesh in world space, no shadow); the trunk and slab piles block walking like the log deck.
- X: puts down two logs, a trunk (as a trunk) or a slab (slabDrops, "Pick up the slab" prompt). The auto put-down on leaving does the same.
- Beds: LOAD_ONTO / TAKE_OFF / TAKE_ROW texts for trunk and slab.
- Selling (step 5): at the lumberyard on a Ridgeline shift: by hand ("Sell the trunk/slab to the lumberyard · $28.00/$18.00", the same spot as the plank hand delivery) or off a bed parked in the lumberyard ("Sell 2 trunks, 3 slabs at the lumberyard · $110.00", and a bulk row in the Cargo panel). Paid in cash at the world-goods base price; no company stock kept for them yet.

## What I could NOT verify (owner eye-check list; nothing seen in a browser)
1. Trunk fall: the trunk appears where the falling pine lands (1.3 m from the stump, along the fall) and lies the right way; it sits ON the ground (model origin = its bottom).
2. Trunk carry: the 2.25 m trunk on the right shoulder (centred, y -0.17 in the log's group): does it clip the head or the ground, does it look right walking at 60%?
3. Two logs: the logs2 model on the shoulder; a slab on the shoulder (I used the log pose for the slab, not a two-hand hold).
4. Bucking with the axe (the chop swing aimed at the trunk's middle) and with the chainsaw (no saw animation or sound: the arm just stays at the ready while you hold E).
5. Feeding the saw with two logs and with a trunk; the Cut clip keeps running for trunks.
6. The trunk pile (x -6.8 at the feed end) and the slab pile (x -6.2, z 0.6..2.6) drawn from the GLBs: placement, scale, orientation, no clipping with the log deck; the slab pile prompt position.
7. Bed loading on the flatbed (4 trunks a layer, 3 layers) and the shortbed (3 a layer, centred along its 2.45 m), slabs flat; the pickups (worktruck 1.8 m, offroad 1.94 m bed) let a trunk or slab overhang the open tailgate by 0.3-0.45 m (against the cab): check it looks acceptable or should be refused.
8. Draw calls with trunks on the ground and both piles filled (expected +3, +1 shadow pass for ground-trunks only).
9. The GLB textures in the real browser (Node tests use the real geometry with a plain material: textures cannot be decoded there).

## Frame-rate risk (numbers)
- +3 draw calls at most (ground-trunks, yard-trunks, yard-slabs), each made once the model has loaded; an empty one draws nothing. ground-trunks casts shadows: +1 shadow-pass draw while trunks lie around; the yard piles cast none.
- Per vehicle: +1 draw (+1 shadow) for trunks and +1 (+1) for slabs, only on a vehicle that has carried one (made on the first piece).
- Triangles: trunk 140, slab 56, two logs 72. Worst case 80 ground trunks + 20 yard trunks + 96 slabs = about 19,400 triangles.
- Materials/textures: each GLB has its own material and its own 256 px atlas copy: 3 materials and 3 textures (about 0.75 MB GPU), not the 2 shared materials of the design. Cheaper option: re-export the four GLBs sharing one atlas file (or share the texture in code after load).
- CPU: syncTimber compares 6 values per frame and rebuilds matrices (at most 80 + 116) only when something changed; the sawmill group is looked up once (a first version searched the scene every frame: fixed before the gate).
- Startup: 3 async GLB fetches, about 215 KB.

## Old tasks with trunks on the ground (step 8: decided, not reworked)
- fell: unchanged (a marked pine counts when it falls; it now drops a trunk).
- gather ("Gather n fallen logs"): every piece picked up off the ground counts once per shift by its id, as before: a picked-up trunk counts 1, and each log bucked from a trunk counts 1 (new ids). So one tree can give 1 + 2..4 gathered pieces (before: 2..4). The tracker points at the nearest piece, trunk or log.
- landing ("Carry n logs to the landing"): logs only, as before; two logs on the shoulder are stacked as two (2 pieces, 2 pile logs). A trunk has no landing prompt: buck it first.
- mill: counts planks taken off the pile, as before; slabs do NOT count.
- workforce (workforce-pose.js / workforce-tick.js) untouched: the crew still handles logs, 4 logs/day -> 16 planks + 6 trickle.
- relay-protocol.js untouched (PROTOCOL 1).

## PROPOSED new logging chain (not implemented; pay from notes/timber-redesign-design.md 4.1 and plank-economy.js)
| task | rank | label | pay |
|---|---|---|---|
| fell | 1 Trainee, lv 1 | Fell n marked pines | 300 c a tree (as now) |
| buck | 1 Trainee, lv 1 | Cut n trunks into logs | 100 c a trunk (TIMBER_PAY.buckTrunk) |
| feed_saw | 2 Feller, lv 3 | Bring n logs or trunks to the sawmill | 120 c a log (PAY.logToSaw), 150 c a trunk (TIMBER_PAY.trunkToSaw) |
| mill | 2 Feller, lv 3 | Saw n boards or slabs | 25 c a board (PAY.plankOffBelt), 40 c a slab (TIMBER_PAY.slabOffBelt) |
| haul | 3 Hauler, lv 5 | Deliver n boards or slabs to the lumberyard | 730 c a board (PAY.plankDelivered), 1400 c a slab (TIMBER_PAY.slabDelivered) |
| load / stack / pick / deliver / replant / foreman | 3-6 | as now | as now |
landing and gather retire (or gather becomes "pick up n trunks").

Questions for the owner:
1. Retire `landing` and `gather`, or keep gather as "Gather n trunks/logs"? (The landing pile would then only be the crew's.)
2. **Balance:** the lumberyard now pays the world-goods price in cash for a raw trunk ($28) and a slab ($18), as asked. That is far more than the live plank chain (a trunk = 2 logs = 8 planks at $1.00 a delivered plank piece). Keep the world price, or pay the piece rates of the chain (slab $14 delivered, no raw trunk sale)?
3. Should bucking pay only on shift and only for trunks from marked pines (felling an unmarked pine pays $0.75)?
4. Should slabs taken off the pile count for the Mill task (and pay 40 c)?
5. Switch the live haul pay from 100 c (PIECE_PAY.delivered) to 730 c (PAY.plankDelivered) together with the rework?
6. Workforce: should Peter/Tom visibly fell trunks and buck them (2 trunks a day = 4 logs), or stay with logs as now?
7. Pickups: may a trunk/slab overhang the open tailgate (now allowed), or refuse trunks on beds shorter than 2.25 m (then only the flatbed and the shortbed take them)?

## Requested edit in a file I may not touch
- `dist/cast-early.js` line 361 (Walt's line): `'At Foreman and level 15, the $600 Chainsaw opens in our company store.'` -> `'At Hauler and level 5, the $350 Chainsaw opens in our company store.'` (line 334, the rank-6 "chainsaw shelf ... open to you now", is still true for the logging chainsaw; optional: "the logging chainsaw shelf"). No test pins either line (grep).
- notes/handoff.md: not edited (main chat).

## Other limits and notes
- Bucking needs no shift (felling does): a trunk you carried away can still be cut.
- Taking a log off a bed while holding one is still refused ("Your hands are full"); only ground pick-ups combine two logs.
- cargo-items.js `fromLegacyCarry({kind:'log',count:2})` gives ONE log item (the cargo wheel does not use hands yet).
- Selling trunks/slabs keeps no company stock (they leave the world).
- tests/timber-game.mjs feeds game.js the real GLB geometry through a test-only patch of the temp release copy (the shipped game never takes that path); tests/timber-wiring.mjs uses stub box geometry only to check the bed view's instance placement.

## Confidence
- Pure rules (grid trunk/buck, carry two logs/trunk/slab drops, cargo long slots, sale, chainsaw numbers, save migration): high (tested, old bed placements checked against the old algorithm).
- game.js interactions (fell, buck axe/chainsaw, pick up, X, feed, slab pile): high for behaviour (tests/timber-game.mjs drives them in the packaged game), medium for feel.
- Drawing (piles, ground trunks, carried models, bed view): medium: counts, names and shadows are tested with the real geometry; positions/orientation/scale on screen are unseen.
- Sale at the lumberyard: medium (pure function tested; the prompts are not driven by a game test).
- Proposed chain: a proposal only, owner input needed.
