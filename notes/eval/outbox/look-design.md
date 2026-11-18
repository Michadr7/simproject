michadr.

# Visual Identity Design Note (`notes/visual-identity-design.md`)

## Files created (with line counts)
- `notes/visual-identity-design.md` (`99` lines, `< 250` limit, first line `# Eden Ridge Visual Identity Design: GLSL Look Pipeline & Compute Horizon`, NEW, UTF-8 without BOM): read-only design note tying the Four Pillars (**colour grade**, **toon ramps + rim**, **selective inverted-hull outlines**, **sky dome**) to the real `r187` `WebGLRenderer` GLSL pipeline, detailing chunk/hook attachment points, draw-call/program/texture/fill-rate budgets, tests that could break, a staged `V-A..V-E` plan (`Sonnet 5.5 high` vs `Opus 5.5`), a compute-only effects table + TSL migration trigger, and 5 owner questions with recommended answers first.
- No code files or index files were modified; neither `npm run index` nor `npm test` was run (per `notes/eval/prompts/gemini-look-design.md`).

## What could NOT be verified
- GPU frame-time impact (`< 0.05 ms` ALU for toon ramp + `< 1.5%` fill rate for selective outlines) and live visual quality at `165 FPS` — all timings are estimates anchored to `r187` chunk complexity and `notes/visual-overhaul-design.md` scene counts, not live hardware GPU measurements.
- `ShaderChunk.lights_physical_pars_fragment` compilation parity across target drivers (verified chunk structure in `dist/vendor/three.module.js:399,497` on disk, not compiled live in WebGL 2).

## Exact requested edits for forbidden/shared files (future stages `V-D` & `V-E`, NOT made here)
1. `dist/game.js` (`createCharacter` / `applyQuality` at lines `99–106` and frame loop):
   - In Stage `V-E` (`Opus 5.5`): pass outline visibility / quality toggle (`quality === 'high'`) into `character.js` / `outline.js` and sync vehicle hulls when `driving.active` or `applyQuality` changes, while keeping `world.js` and `props-assets.js` untouched.
2. `dist/world.js`:
   - **No edit needed** for `V-A..V-E` (ground roughness attenuation `smoothstep(0.94, 0.90, material.roughness)` keeps `world.js:241-256` ground planes smooth automatically via global `lights_physical_pars_fragment` without modifying `world.js`).

## Honest confidence
- Architecture fit (`CustomToneMapping`, `RE_Direct_Physical` chunk edit, selective `BackSide` outlines off `c.meshes`, `DOME_FRAGMENT` clouds) and test-pinning risk audit: **high (95%)** — every claim is grounded directly in read files (`three.module.js:399,497`, `daynight.js`, `sky.js`, `ground-shader.js`, `paint-shader.js`, `character.js`, `world.js`, `props.js`, `tests/daynight.mjs`, `tests/ground-shader.mjs`, `tests/damage-look.mjs`, `tests/character.mjs`, `tests/sawmill-asset.mjs`).
- Unseen visual tuning parameters (toon feather width, outline pixel thickness `2.2 mm`, cloud opacity): **medium (75%)** — explicit eye-checks scheduled in Stages `V-D` and `V-E`.
