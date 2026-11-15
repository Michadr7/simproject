# Antigravity model evaluation prompt (2026-11-17)

How to use: open the repo in Antigravity on a NEW BRANCH (or a copy of the folder). Run the prompt below once per model (its own models, Sonnet 5.5, Opus 5.5), each time in a fresh conversation, and ask it to save its report as notes/eval/<model-name>.md. Bring the reports (or just the results table at the end of each) back to the Claude Code chat for comparison.

```
You are being evaluated on a real project (Eden Ridge: a buildless Three.js browser game, plain ES modules in dist/, Node tests in tests/*.mjs, Windows PowerShell 5.1). This is a benchmark, not production work. RULES: read context.md lines 1-45 first. Do NOT edit anything in dist/, scripts/, or existing tests. Write only inside notes/eval/ (create it) and tests/eval/ (create it). Never run git. Write files WITHOUT a BOM. Do not read big files whole: use search and line ranges. For each task below, record: the model name you are, the wall-clock time you took, how many files you read, and your own confidence (0-100%) that the result is correct. Finish all tasks, even if one fails: say plainly what failed. Do not claim something works unless you ran it.

TASK 1 (read and explain, no edits): In dist/garage.js, explain exactly what happens when the player calls the tow service while driving their own vehicle, from the phone Call app click to the vehicle appearing at the shop. Name each function and file in order (dist/phone-call.js, dist/game.js towCall, dist/garage.js towTo). Under 200 words. Say what you are unsure about.

TASK 2 (pure module + tests): create notes/eval/crop-growth.mjs: a pure function stageOf(plantedHours, nowHours, {fertilised=false, season='spring'}) returning {stage 0..3, ripe: bool, hoursToNext}. Rules: 2 game days (48 h) per stage, 6 days seed to ripe is stage 3 at 144 h; fertilised grows 25% faster; season multipliers spring 1, summer 1, autumn .75, winter .5 (applied to the growth rate; the user wants winter shortest-growing). Then create tests/eval/crop-growth.test.mjs using Node's built-in assert (match the style of an existing small test in tests/, find one yourself) with at least 12 cases incl. edge cases (negative elapsed time, exactly on a stage boundary, huge values). Run it with node and paste the output.

TASK 3 (bug hunt): in dist/phone-calls.js, dist/garage.js and dist/surface-table.js, find any real bug, inconsistency or unclear rule (not style). Report at most 5, ranked, each with file:line, a failing example, and a proposed fix. If you find none, say so. Do not fix.

TASK 4 (data task): read notes/map-master.md section 6.1 (the roads table, around lines 515-540). Produce notes/eval/roads-check.md: a table of every road with its start and end points and a computed length in metres (straight-line sum of its listed points), then flag any row where your computed length differs from the table's stated length by more than 10%. Show your arithmetic for those rows.

TASK 5 (planning): read notes/farm-vehicles-design.md (use line ranges: the stage table around lines 195-215 and section 2 'Hitch and tow'). Write notes/eval/fv3-plan.md: a build plan for stage FV3 (hitch rules, pure file dist/hitch-rules.js) as a list of at most 12 steps, each naming files, functions and the tests it adds, plus the top 3 risks. Do not write the code.

TASK 6 (Blender, only if you can run Blender here; otherwise write SKIPPED and why): C:\Program Files\Blender Foundation\Blender 5.2\blender.exe -b assets-src\Farm\sr90\ exists as glb files. Write a Python script notes/eval/glb-report.py that opens assets-src/Farm/sr90/bale_round_hay.glb headless and prints triangles, material count and bounding-box size in metres. Run it and paste the output.

At the end print a RESULTS TABLE: task, model, minutes, confidence %, passed/failed/skipped, one-line note. Save the whole report as notes/eval/<your-model-name>.md.
```

What to look at when comparing (for the Claude Code chat): did the tests actually run and pass (task 2), did it invent functions or line numbers (tasks 1 and 3: spot-check three), did it do the arithmetic right (task 4), did the plan respect the repo rules and name real files (task 5), and how long and how many tokens each took.
