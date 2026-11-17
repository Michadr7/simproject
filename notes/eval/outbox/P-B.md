michadr.

# Stage P-B (pure side only): player-fed sawmill yard (`dist/sawmill-yard.js`)

## Files created (with line counts) and index update
- `dist/sawmill-yard.js` (98 lines, NEW, UTF-8 without BOM): pure sawmill yard state machine (`freshYard`, `normalizeYard`, `switchSaw`, `feed`, `tick`, `takeStack`, `trickle`, `summarize`) and constants (`YARD_VERSION`, `YARD_MAX_LOGS`, `YARD_MAX_PLANKS`, `YARD_CAPACITY`), importing `LOGS_TO_PLANKS` (4), `PLANKS_PER_STACK` (4), `TRICKLE_PER_DAY` (6), and `SAW_MIN_PER_LOG` (4) from `dist/plank-economy.js`. Line 1 cites `notes/planks-economy-design.md stage P-B`.
- `tests/sawmill-yard.mjs` (128 lines, NEW, UTF-8 without BOM): Node `assert/strict` test suite covering constant cross-checks against `plank-economy.js`, `carry.js`, and `world-goods.js`; `1` log = `4` planks; switch toggle; frame-rate independent sawing at `30`, `60`, and `144` steps/s (partial and full runs); idempotent `6`/day trickle; capacity clamps (`40` logs / `160` planks); `takeStack` capped at `4` and available stock; `summarize`; `normalizeYard` on `null` / `{}` / old version (`v: 0`, `logsWaiting`, `stock`); garbage inputs; input immutability; determinism; and source purity.
- `PROJECT-INDEX.md` and `PROJECT-BRIEF.md` regenerated via `npm run index` (`sawmill-yard.js` appears at line 151 and `sawmill-yard` test at line 420).
- No existing `.js` or test files were edited.

## Test and index results (real output)
```text
> node tests/sawmill-yard.mjs
PASS sawmill-yard: 1 log = 4 planks, 30/60/144 Hz frame-rate independent sawing (4 game min/log), trickle 6/day idempotent, clamp 40 logs / 160 planks, takeStack max 4, normalizeYard/garbage safe, immutable, deterministic, pure
exit=0

> npm run index
> city-life-local-multiplayer@0.35.17 index
> node scripts/build-index.mjs

brief 2834 tokens (target 3000), index 31226 tokens (target 32500); 210 modules, 14 generated, 251 tests, 28 scripts; 13 modules without a header comment
exit=0

> node tests/plank-economy.mjs
Plank economy: 1 log = 4 planks, trickle 6/day vs old 24, level 1 worktruck cycle 32 planks in 182.1 game min = $263.20 (8672 c/h) beats the best existing job ridgeline-fell (6934 c/h) by 25%, levels 1:+25% 3:+18% 5:+11% 7:+4% 10:-12%, Prices screen low/high/normal notes, garbage safe, frozen, pure
exit=0

> node tests/brief.mjs
brief tests passed: 210 modules listed, brief 2834 and index 31226 estimated tokens (budgets 3000 and 32500)
exit=0
```

## What could NOT be verified
- Full `npm test` and `npm run release -- --force` were NOT run (per instructions while another agent edits `game.js`, `gigs.js`, `cargo-view.js`, `carry-pose.js`, and `cargo-items.js`).
- Live in-game sawmill integration (3D animations, switch/bench/stack prompts, save persistence round-trip in a browser, and syncing `world.stock['property:sawmill'].planks` with `sawmillYard`) was not tested because this stage builds the pure rule module only.

## Requested edits in forbidden/shared files (for a later wiring stage, NOT made here)
Nothing was edited in shared files. To wire `sawmill-yard.js` into the live game later:
1. `dist/jobs.js` (`freshProgress` line 30 and `normalizeProgressWith` lines 33–55): add optional/saved `sawmillYard: freshYard()` normalized via `normalizeYard(a.sawmillYard)` so the yard state persists in `edenridge.progress.v1`.
2. `dist/world-goods.js` (`PLACES['property:sawmill'].goods.planks` line 38): change `rate: 24` to `rate: 6` (matching `TRICKLE_PER_DAY`) when ready to turn off free NPC plank overproduction — note `tests/plank-economy.mjs:17` currently asserts `P.OLD_SAWMILL_RATE === PLACES['property:sawmill'].goods.planks.rate` and will need updating at that time.
3. `dist/game.js` (lines 686–689, 724–728, 1288, and `worldDayPassed` line 499): feed carried logs (`kind === 'log'`) into `feed(p.sawmillYard, 1)`, step `tick(p.sawmillYard, dt * GAME_MIN_PER_REAL_SEC)` when open/on, apply `trickle(p.sawmillYard, day)` on day pass, and take stacks via `takeStack` into `{kind:'planks', count}`.

## Honest confidence
- `dist/sawmill-yard.js` pure rules, 30/60/144 Hz frame-rate invariance, capacity clamps, trickle idempotence, garbage handling, immutability, and `normalizeYard`: **high (95%+)** — verified directly with `tests/sawmill-yard.mjs`.
- Future live gameplay balance constants (`YARD_MAX_LOGS = 40`, `YARD_MAX_PLANKS = 160`, `SAW_MIN_PER_LOG = 4`): **medium (80%)** — marked `PLACEHOLDER` per spec for later in-game playtest tuning.
