## What it is
City Life: a buildless Three.js browser city sim (plain ES modules in `dist/`, Three.js vendored in `dist/vendor/`). A 540 x 480 m map of six districts (Westside, Alder Center, Cedar Heights, Eastbank Works, Willow Fields farm, Pine Ridge forest), a river, two bridges. Walking, jobs (the Ridgeline Timber career, the cafe), shops, homes to rent or buy, drivable vehicles with fuel, a lumber warehouse with a forklift, a multiplayer relay, accounts and cloud saves. Windows 11, VS Code, PowerShell 5.1. The user plays on a real GPU (about 165 FPS); an agent's browser is software WebGL (about 4 FPS).

## State
Last confirmed deployed: 0.35.2 (2026-11-09). 0.35.4 is committed, not deployed: Session A1, `population.js` and `schedule.js` (who lives and works where, each person's day) as pure data; nothing draws those people yet. Mikkadr Hub (a local control page) is being built in `hub/`. Queue, in the user's order: asset tracker with pictures (P3c); hub P4 to P6; character swap to the Grab3D base man and woman (CC0, heavy); A2 (walking, NPC cars, frame tiers); B (a hit knocks someone down about 3 s, they get up hurt, an incident is logged); C (minimap, big map); warehouse K1 to K3 then D4; co-op server step 1.

## Standing rules
- Start every chat with "michadr". Main models: Sonnet 5.5 (build and refactor against tests), Haiku 5.5 (tiny edits, number tweaks), Opus 5.5 (design, save formats, multiplayer, security). Fable 5.2 only when the user says so. Never switch model, start a subagent or call the advisor (`.claude/agents/advisor.md`, read-only Opus) without the user's go-ahead: say which and why, then wait.
- Tokens: the weekly limit must never reach 100% (internal stop 97, hard stop 99, warn from 60; see `npm run watcher`). Search the index with Grep, open files by line range, never read `context.md` whole.
- Flag frame-rate risks first, with a number and a cheaper option. On screen: about 15 skinned characters, 10 cars, 300 draw calls, 1,000 tree-sized instances.
- Run `npm test` after each change and report failures honestly. After changing `dist/`, run `npm run release -- --force` first (packaged-game tests run `dist/releases/<version>/`), unless that version was deployed: then bump it. Never `--force` a deployed version.
- Keep `town.js`, `world.js` and `map-definition.js` changes minimal and additive; say so.
- The user commits by hand unless asked. `git` is not on PATH: use GitHub Desktop's `%LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe`. Never commit `assets-src/`, `.claude/`, `simproject.code-workspace`, `.dev.vars` or `.hub/`.
- Real assets over fake ones; say what is missing or unverified. Small steps; stop after each with tests passing.

## Ideas that hold the code together
- Data first, pure transactions: the map, interiors, items and rules are data; changes are pure functions (state and action in, new state or error out) with tests. Money is integer cents. Saves are normalised on load (`normalizeProgress`).
- One placement path: reset, teleport, unstick and load all use `placeSafely` (`safe-spot.js`).
- 1 unit = 1 m, +Y up, north is -z, the player is 1.95 m, spawn (-5, 15). Real time runs in slices of at most 1/30 s (`timestep.js`); the game clock runs 30 game minutes per real minute.

## Commands
`npm test` (each `tests/*.mjs` in its own process) · `npm run release -- --force` · `npm run dev` (localhost:8000) · `npm run server` (relay, ws 8080) · `npm run index` (this brief and the index) · `npm run watcher` (token page, no model call; `-- --probe` takes a fresh reading with one small Haiku call, and typing it is the user's go-ahead) · `node scripts/browser-lab.mjs <outDir> <scenario.json>` (screenshots, needs `npm run dev`).

## Gotchas that cost real time
- PowerShell 5.1 `Set-Content -Encoding utf8` and `>` write a BOM that breaks `JSON.parse`: use `[IO.File]::WriteAllText(path, text, (New-Object Text.UTF8Encoding $false))` or Node.
- Repo files are CRLF. Multi-line `Edit` on `dist/game.js` and `dist/world.js` often fails: use single-line anchors and check each change landed. `game.js` is dense on purpose (one statement per line): match it.
- PowerShell double-quoted strings eat backticks: use single-quoted here-strings for JavaScript, then `node --check`.
- To run Claude Code from a script: `claude.exe` is in the VS Code extension folder (`hub/probe.js` finds it); clear `CLAUDE*` and `ELECTRON_RUN_AS_NODE`; pass `--tools=` with the equals sign; capture output from Node, not a PowerShell redirect.

## Where to change things
Map, roads, plots, props, shop hours: `map-definition.js`, then `npm test` (`map.mjs` pins tree counts and a hash). Add a model: `scripts/build-props.mjs` (the originals in `assets-src/` are not in the repo), `ASSETS.md`, `credits.js`. Prices, wages, drain: `items.js`, `jobs.js`, `contracts.js`, `housing.js`, `life.js`. Menus, HUD: `index.html`, `style.css`, `game.js`. Multiplayer: `multiplayer.js`, `server.js`, `worker/`. People: `population.js`, `schedule.js`. Tokens and the hub: `hub/`.

## Read more only when needed
`DESIGN.md` (plan, decisions, roadmap, budgets; 4.16 warehouse, 4.17 co-op, 4.19 tasks, 4.20 people), `context.md` (the long record, about 40,000 tokens: open by line range), `README.md` (a section per version), `ASSETS.md` (models and licences).
