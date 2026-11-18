Use the strongest reasoning model available (Opus-equivalent), not Flash.

You are working on Eden Ridge (buildless Three.js browser game). FIRST read AGENTS.md in the repo root and obey it exactly. Then read context.md lines 1-45 and notes/handoff.md lines 1-16 only.

TASK P-D: plank delivery pay and run size, pure module.
Read notes/planks-economy-design.md (stage P-D: "Ridgeline orders pay by plank price; truck bed capacity per model decides the run size (cargo.js BEDS)"). Also read the existing pure modules it builds on: dist/plank-economy.js, dist/sawmill-yard.js, dist/warehouse-intake.js, dist/cargo.js (BEDS only, do not edit), and one of their tests for style.

Create ONLY new files:
- dist/plank-delivery.js: pure (no DOM, no three.js, no globals, no Date.now/Math.random without an injected argument). Export named constants and functions that, given a vehicle model/bed, the plank price table and the order, return: the run size (planks per trip, from the bed capacity), the pay for a delivered load (plank price based, rounded in whole dollars), and a refusal reason when the bed cannot take the load. Must not give free planks: pay is for planks that really moved.
- tests/plank-delivery.mjs: Node `assert`, one PASS line; cover every vehicle in cargo.js BEDS, zero/overfull loads, rounding, determinism.
First line of dist/plank-delivery.js: ONE short header comment (under 90 characters) naming the file and "planks-economy-design P-D". The project index is nearly full (158 tokens left): no extra files, never raise the cap; if `npm run index` fails only on size, report by how many tokens and stop.

Do NOT edit cargo.js, game.js or any forbidden file; wiring is mine. List any needed wiring edit exactly (file, function, change) in the report.
Verify with `node tests/plank-delivery.mjs` and paste the real output. Report: notes/eval/outbox/P-D.md, first line "michadr.", per AGENTS.md.
