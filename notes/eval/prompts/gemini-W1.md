Use the strongest reasoning model available (Opus-equivalent), not Flash.

You are working on Eden Ridge (buildless Three.js browser game). FIRST read AGENTS.md in the repo root and obey it exactly (no git, no BOM, forbidden shared files, report format). Then read context.md lines 1-45 and notes/handoff.md lines 1-16 only.

TASK W1: pure workforce pose module.
Read notes/workforce-design.md (sections 1-3; stage W1 is in the table in section 3). Owner answers (2026-11-18): pace 4 logs/day; chopping is VISUAL only; the sawyer Priya Nair (ridgeline-sawyer) IS shown working at the sawmill shed, alongside ridgeline-fellers#1 (Cutter) and #2 (Hauler).

Create ONLY these new files:
- dist/workforce-pose.js: pure, no DOM, no three.js, no globals, no Date.now/Math.random. Export named constants and `isOutdoorWork` and `workforcePose(out, person, day, minute, ctx)` that fills a reusable `out` object (zero allocations per call) with position, heading, and a phase/animation tag (chop, carry, bend, walk, saw). Deterministic from (person.id, day, minute, seed) using population.js hashOf, so co-op clients agree; frame-rate independent (same result at 30/60/144 Hz). All waypoints must be walkable on the real MAP.
- tests/workforce-pose.mjs: Node `assert`, one PASS line. Pin determinism at 30/60/144 Hz, co-op agreement, all waypoints walkable on real MAP, chop/carry/bend phases, zero allocations. Look at tests/garage.mjs or tests/surface-table.mjs for style first.
First line of dist/workforce-pose.js must be a SHORT header comment (under 90 characters) saying what it is and "workforce-design.md W1". The project index is nearly full (158 tokens left): keep the header to one short line, do not add other files, do not run anything that raises the cap. If `npm run index` fails only on size, say by how many tokens and stop.

Do NOT edit npc-walk.js, npc-crowd.js, game.js or any forbidden file; wiring is stage W3 (Opus). If W3 needs a specific edit, list it exactly in the report.
Verify with `node tests/workforce-pose.mjs` and paste the real output. Report: notes/eval/outbox/W1.md, first line "michadr.", per AGENTS.md.
