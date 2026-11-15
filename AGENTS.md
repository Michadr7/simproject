# AGENTS.md: rules for any coding agent that is not the main Claude Code chat (Antigravity, Gemini, others)

This repo is Eden Ridge: a buildless Three.js browser game (plain ES modules in dist/, no bundler), tests are Node scripts in tests/*.mjs. Windows 11, PowerShell 5.1. The owner commits by hand.

## Read first (do not skip)
1. context.md lines 1-45 (standing rules, commands, environment gotchas).
2. notes/handoff.md lines 1-16 (how the project is run). Do NOT read the rest of handoff.md whole (it is long); search it with a keyword when your prompt names an entry.
3. Do not read big files whole. Search PROJECT-INDEX.md for a file or function, then read line ranges.

## Hard rules
- Work on your own branch or folder copy. Never run git. Never commit.
- Write files WITHOUT a BOM (PowerShell `Set-Content -Encoding utf8` adds one and breaks JSON: use `[IO.File]::WriteAllText(path, text, (New-Object Text.UTF8Encoding $false))`).
- DO NOT EDIT these shared files (the main Claude chat owns them): dist/game.js, dist/world.js, dist/map-definition.js, dist/driving.js, dist/vehicle.js, dist/terrain.js, dist/props-assets.js, dist/audio.js, dist/phone*.js, scripts/build-index.mjs, notes/handoff.md. If your stage seems to need one, STOP and say exactly what edit it needs (file, function, change) in your report instead of making it.
- You may add NEW pure files (dist/<name>.js with no DOM and no three.js imports unless the prompt says so) and their tests (tests/<name>.mjs), and edit only the files your prompt lists.
- Pure rule modules: no globals, no Date.now/Math.random without an injected argument, frame-rate independent where time is involved, export named constants, header comment saying what the file is and which design note it implements (the project index reads that first line).
- Match style: existing tests use Node's `assert` and print one PASS line; look at a small one (for example tests/garage.mjs or tests/surface-table.mjs) before writing yours.
- Do not raise or edit the index cap. If `npm run index` or tests/brief.mjs fails only because of the index size, say by how many tokens and stop.

## Commands
- `npm run release -- --force` (rebuilds the packaged release; needed before `npm test` if you changed anything in dist/. The version 0.35.9 has never been deployed, so --force is allowed) then `npm test` (runs every tests/*.mjs in its own process; takes a few minutes). For a quick check run just your test: `node tests/<name>.mjs`.
- `npm run index` regenerates PROJECT-INDEX.md (new files must appear in it; tests/brief.mjs checks the budget).
- A failing test you did not cause (for example because someone else is editing at the same time): re-run once, then say so; do not "fix" other people's tests.

## Report format (save it as notes/eval/outbox/<stage>.md and print it)
- Start with "michadr." on the first line.
- Files created or changed (with line counts), tests added and their results (paste the real output), what you could NOT verify.
- Anything you needed from a forbidden file, as an exact requested edit.
- Honest confidence per part. Never claim a test passes unless you ran it and pasted the output.
