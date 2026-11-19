# Hydro prompt: logging sounds + forest ambience (assets and pure files only; no game.js)

Read AGENTS.md rules first (context.md 1-45, notes/handoff.md 1-16; search PROJECT-INDEX.md, never read big files whole). You may NOT edit dist/game.js, world.js, map-definition.js, driving.js, vehicle.js, terrain.js, props-assets.js, audio.js, dist/phone*.js, scripts/build-index.mjs, notes/handoff.md. Never run git. Write files without a BOM. Another agent edits game.js: never run the full `npm test`; run `node tests/<name>.mjs` for your own tests and tests/sweep-sounds.mjs.

Owner request (2026-11-19): logging sounds in a "New World" style (weighty, woody, layered: axe bite, wood crack, trunk groan, tree fall, bucking cuts, log thud) plus more ambience (forest bed, wood creaks, falling-tree sequence, distant birds already exist: check first).

Do:
1. Read assets-src/sounds-sweep/README.md and dist/timber-sounds.js, dist/sweep-sounds.js (shape of the registries). List what already exists for axe, tree, logs, chainsaw. Do not replace what is good; add variety.
2. Source CC0 clips only (Freesound CC0, OpenGameArt CC0, Kenney; record the URL, author, licence per clip in assets-src/sounds-sweep/README.md rows). Wanted: 5+ axe-hit variants (not the same hit each swing), 3 wood-crack/groan layers, 2 tree-fall sequences (creak, crack, whoosh, ground thud), 3 log-thud sizes, a 40-60 s seamless forest-ambience loop (wind in pines, no birds), 6 wood-creak one-shots. Convert to the project format used in dist/assets/sounds/ (check the existing extension and loudness; trim silence; mono unless the existing ones are stereo).
3. Put them in dist/assets/sounds/ with clear names and add a NEW pure registry dist/logging-sounds.js (header line saying what it is and that it implements this prompt; no DOM, no globals, no Math.random: a pure picker taking an injected random number so the same clip never plays twice in a row; exports named constants for file lists and mix levels) with tests/logging-sounds.mjs (Node assert, one PASS line; copy the style of tests/sweep-sounds.mjs).
4. `npm run index` so the new file appears (index cap is fixed; if over, say by how many tokens and stop).

Not in scope: wiring into game.js (a later game.js-lane run does it from your report), changing existing clips, anything about animation.

Report: notes/eval/outbox/logging-sounds.md, first line "michadr.". Files created with line counts, clip table (name, source URL, licence, duration), pasted real test output, what you could NOT verify (you cannot hear them: say so), an exact wiring request for the game.js lane (which event gets which picker call: swing hit, tree crack, tree fall, bucking cut, log thud, ambience loop start/stop with forest proximity), questions for the owner, honest confidence.
