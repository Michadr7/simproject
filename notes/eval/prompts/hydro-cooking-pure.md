# Hydro: cooking pure modules (stage L-PURE). NEW FILES ONLY, no game.js.

Read AGENTS.md rules first (they apply in full), context.md lines 1-45, notes/handoff.md lines 1-16, and notes/eval/outbox/cooking-design.md (the design). Owner decisions (2026-11-19): LARGE version; timed ring with a sweet spot; Eat now + Pack for later; NO spoilage; warm-meal buff that slows hunger/energy drain for a while (no mood bar); dedicated cat-food item; idempotent migrateGroceries with no save schema bump.

Create (pure, no DOM, no three.js, injected time/random only, named exports, first-line header comment saying what it is and which design note):
1. dist/recipes.js: the 8-recipe table (ingredients, food/energy restore, cook seconds, hospitality XP gain, quality-scaled output) plus helpers recipeFor(id), canCook(inventory, recipe), consume(inventory, recipe) returning a new inventory.
2. dist/cook-ring.js: timed ring as a pure function of progress 0..1: sweetSpot window, ringResult(progress, hospitalityLevel) -> {quality: 'burnt'|'ok'|'good'|'perfect', mult}. Frame-rate independent; higher level widens the window slightly.
3. dist/warm-meal.js: buff state {untilGameMin, drainMult}, applyBuff(state, nowMin, quality), drainFactor(state, nowMin), serialisable plain object.
4. dist/grocery-migrate.js: migrateGroceries(progress) turns old life.groceries (0..20) into ingredient stacks, idempotent (running twice changes nothing), no schema bump, never throws on old/missing fields. Do NOT edit jobs.js; propose the exact one-line hook in your report.
Tests: tests/recipes.mjs, cook-ring.mjs, warm-meal.mjs, grocery-migrate.mjs (Node assert, one PASS line each; copy the style of tests/garage.mjs).
Run `npm run index` (new files must appear; do not raise the cap). Do not edit items.js, life.js, game.js or any forbidden file: list needed edits (exact file, function, change) in the report.
Report: notes/eval/outbox/hydro-cooking-pure.md, first line "michadr.", real pasted test output, what you could not verify, confidence.
