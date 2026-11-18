Use the strongest reasoning model available (Opus-equivalent), not Flash.

You are working on Eden Ridge (buildless Three.js browser game). FIRST read AGENTS.md in the repo root and obey it exactly (no git, no BOM, forbidden shared files, report format). Then read context.md lines 1-45 and notes/handoff.md lines 1-16 only (search the rest by keyword). Do not read big files whole: search PROJECT-INDEX.md and read line ranges.

TASK W2: pure workforce economy and stock sync.
Read notes/workforce-design.md (sections 1-3; stage W2 is in the table in section 3, the daily/need/ticket rules are in section 2.C). W1 is done (dist/workforce-pose.js). OWNER ANSWERS (2026-11-18, final):
1. Pace: 4 logs felled per day -> 16 sawn planks, plus the 6/day trickle = 22 planks/day max into the sawmill yard (pausing above 48 yard planks); up to 12 planks/day hauled to the warehouse.
2. Chopping is visual only; the only world change is at most 2 pines turned into stumps in yesterday's marked block at the 05:00 daily tick (return them as data; do not touch progress.plots in this module).
3. Grace: the workforce waits 1 full game day before filling an unclaimed lumber gig-board need (8 planks or 4 logs per step), and 180 game minutes before slowly staging untouched warehouse order tickets (4 planks per 30 minutes).
4. supply.js: the free off-map planks are REMOVED; tickSupply must draw from company.stock.planks (lumberyard) first and progress.sawmillYard second. Return what supply.js must change as an exact edit list (supply.js is a shared file you may not edit).
5. The sawyer (ridgeline-sawyer) is shown working; no economy effect beyond the above.

Create or edit ONLY: dist/workforce-tick.js (new), tests/workforce-tick.mjs (new), and dist/pallets.js (add `consumeFromRacks` only; keep every existing export and behaviour; run tests/pallets*.mjs). Pure: no DOM, no three.js, no globals, no Date.now/Math.random without an injected argument; frame-rate independent; named constants; deterministic from (day, seed) via population.js hashOf for co-op. Export `workforceDay` and `workforceTicketStep` reusing plank-economy.js, sawmill-yard.js, warehouse-intake.js, needs.js (fill(..., 'workforce', ...)). Two-way pallet stock sync. Optional save field progress.companies.ridgeline.workforce {lastMin} must be additive and omitted when idle (normalization in careers.js is a shared-file edit: list it, do not make it).
Test (`node tests/workforce-tick.mjs`, Node assert, one PASS line; look at tests/garage.mjs for style): 14-day plank and log conservation (zero free planks beyond the trickle), the player is at least 6x faster than the workforce, crew fills pay $0 and give 0 player rep, grace periods respected, a player claim blocks the workforce, empty source stock moves 0, determinism.
Header comment: ONE short line (under 90 characters) naming the file and "workforce-design W2". The index budget is 34000 tokens (about 1,400 left): add no other new files. If `npm run index` or tests/brief.mjs fails only on size, say by how many tokens and stop.

Do NOT edit supply.js, careers.js, world-tick.js, game.js or any forbidden file; wiring is stage W3 (Opus): put every needed edit (file, function, change) in the report.
Verify with `node tests/workforce-tick.mjs` and the pallets tests and paste the real output. Report: notes/eval/outbox/W2.md, first line "michadr.", per AGENTS.md. Never claim a test passes unless you ran it.
