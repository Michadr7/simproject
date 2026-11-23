# AGENTS.md

Eden Ridge is a buildless Three.js browser game. It uses plain ES modules in dist/ and Node test scripts in tests/*.mjs. The workspace runs on Windows 11 with PowerShell 5.1. The owner commits by hand.

The Three.js game is back on the active main pipeline (`notes/map-master.md` Phases P3–P8, NOT in maintenance). Take feature stages, bug fixes, and their verification here. The Godot project has its own workspace and handoff. The newest dated entry in notes/handoff.md governs current scope and release status.

## Read first (do not skip)
1. context.md lines 1-45 (standing rules, commands, environment gotchas).
2. notes/handoff.md lines 1-16 (how the project is run). Do NOT read the rest of handoff.md whole (it is long); search it with a keyword when your prompt names an entry.
3. Do not read big files whole. Search PROJECT-INDEX.md for a file or function, then read line ranges.

## GPT assignments

- **Lead Codex agent.** Triage the reported bug, set the scope and acceptance checks, and own the final review and integration. Coordinate the release build, full test suite, index update when required, and outbox report.
- **GPT-6.2 Sol for implementation.** Take a narrowly scoped fix in explicitly listed files. Good assignments include pure gameplay rules, isolated UI logic, and a focused regression test when coverage needs one.
- **GPT-6.2 Sol for verification.** Independently reproduce the reported behavior through its normal entry point, run focused tests, and report expected versus actual results. Send screenshots and frame-time evidence when the task calls for them, and flag checks that need the owner's GPU.
- **GPT-6.2 Astra for investigation.** Take read-only diagnosis of cross-system bugs involving saves, multiplayer, or frame rate. Report the evidence, the smallest proposed fix and its risks, and the files and functions involved.

The owner approves each agent launch or model change. Before requesting approval, name the model, explain why the assignment needs it, and list the task and files the worker would own. Keep parallel assignments in separate copies with disjoint write scopes. Workers run focused checks. The lead coordinates shared release, index, and full-suite commands after integration.

## Hard rules
- The lead Codex agent may edit the Three.js workspace directly. Workers use their own folder copies for delegated work. Never run git. Never commit.
- Write files WITHOUT a BOM (PowerShell `Set-Content -Encoding utf8` adds one and breaks JSON: use `[IO.File]::WriteAllText(path, text, (New-Object Text.UTF8Encoding $false))`).
- The lead Codex agent owns shared Three.js files and may edit them as part of the assigned task. These include dist/game.js, dist/world.js, dist/map-definition.js, dist/driving.js, dist/vehicle.js, dist/terrain.js, dist/props-assets.js, dist/audio.js, dist/phone*.js, scripts/build-index.mjs, and notes/handoff.md. A worker edits shared files only when the lead assigns them explicitly. Assign one writer per shared file.
- Keep edits within the assigned Three.js task. New pure rule files in dist/ use no DOM or Three.js imports and can have tests in tests/. The Godot workspace is outside this assignment.
- Pure rule modules: no globals, no Date.now/Math.random without an injected argument, frame-rate independent where time is involved, export named constants, header comment saying what the file is and which design note it implements (the project index reads that first line).
- Match style: existing tests use Node's `assert` and print one PASS line; look at a small one (for example tests/garage.mjs or tests/surface-table.mjs) before writing yours.
- Do not raise or edit the index cap. If `npm run index` or tests/brief.mjs fails only because of the index size, say by how many tokens and stop.

## Commands
- After changes in dist/, rebuild the packaged release before running the full suite. Use `npm run release -- --force` only after verifying that the current package version has never been deployed. For a deployed version, coordinate a version bump and run `npm run release`.
- `npm test` runs every tests/*.mjs in its own process. In PowerShell, use `npm.cmd test` if execution policy blocks `npm.ps1`. For a quick check, run `node tests/<name>.mjs`.
- `npm run index` regenerates PROJECT-INDEX.md (new files must appear in it; tests/brief.mjs checks the budget).
- A failing test you did not cause (for example because someone else is editing at the same time): re-run once, then say so; do not "fix" other people's tests.

## Report format (save it as notes/eval/outbox/<stage>.md and print it)
- Start with "michadr." on the first line.
- Files created or changed (with line counts), tests added and their results (paste the real output), what you could NOT verify.
- Anything you needed from a forbidden file, as an exact requested edit.
- Honest confidence per part. Never claim a test passes unless you ran it and pasted the output.
