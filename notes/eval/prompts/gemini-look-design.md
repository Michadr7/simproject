Use the strongest reasoning model available (Opus-equivalent), not Flash. This is a READ-ONLY design task: write one note, change no code.

You are working on Eden Ridge (buildless Three.js browser game). FIRST read AGENTS.md in the repo root and obey it. Then read context.md lines 1-45 and notes/handoff.md lines 1-16 only. Also read your own earlier audit notes/eval/reviews/threejs-upgrade-audit.md (inventory of the 17 GLSL shaders/hooks) and the memory-style summary in notes/ for the visual overhaul (search notes/ for "visual overhaul", sky, day/night).

Owner plan (decided): (1) upgrade to Three.js r187 on WebGL (Opus is doing this now as 0.35.20; assume it is in); (2) build the game's visual identity in the EXISTING GLSL pipeline: colour grade, toon ramps, outlines, sky; (3) keep a short list of effects that really need compute (dense grass, huge crowds) and only then consider a TSL rewrite, which can target WebGPU and WebGL2.

Write notes/visual-identity-design.md (first line a title; under 250 lines) containing:
1. Goals and a one-paragraph look statement for Eden Ridge (cosy rural, readable at a glance), stated as testable properties.
2. For each of grade, toon ramps, outlines and sky: where it plugs in (which existing file/hook: ground-shader.js, paint-shader.js, sky.js, shadows.js, the post/tone-mapping path, etc.), the exact approach (shader chunk, onBeforeCompile hook, extra pass, inverted-hull mesh), cost in draw calls, programs, textures and fill rate, and what could break (tests that pin shader strings or object counts).
3. A staged plan V-A..V-n with a builder model per stage (Sonnet for pure modules/tests/number tuning, Opus for wiring in game.js/world.js), files touched, test and eye-check per stage, and which stages are independent.
4. The compute-only effects list: each effect, why GLSL cannot do it acceptably, a rough budget, and a trigger for when to consider TSL.
5. Open questions for the owner (max 5), each with a recommended answer first.
Keep every claim tied to a file and line you actually read; mark anything unverified. Report: notes/eval/outbox/look-design.md (first line "michadr."), per AGENTS.md. Do not run the index or tests.
