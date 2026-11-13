## What it is
Eden Ridge: a buildless Three.js browser city sim (ES modules in `dist/`, Three.js in `dist/vendor/`). A 540 x 480 m map of six districts (Westside, Alder Center, Cedar Heights, Eastbank Works, Willow Fields, Pine Ridge), a river, two bridges. Walking, jobs (Ridgeline Timber, the cafe), shops, homes to rent or buy, vehicles with fuel, a lumber warehouse with a forklift, a multiplayer relay, accounts, cloud saves. Windows 11, VS Code, PowerShell 5.1. The user's GPU gives about 165 FPS; an agent's browser is software WebGL (about 4 FPS).

## State
Deployed: 0.35.2 (2026-11-09). 0.35.4 is committed, not deployed: Session A1, `population.js` and `schedule.js` as pure data; nothing draws them yet. Mikkadr Hub (`hub/`) has the watcher, asset tracker, P4 (Waiting, Plans) and P5 (runs, master chat, corner bot: `-- --runs`; context.md "Mikkadr Hub P5"). All work goes through the hub; VS Code only changes it. Queue, in order: hub real-CLI checks; character swap (Grab3D man and woman, heavy); A2 (walking, NPC cars); B (knockdown, incident log); C (minimap); warehouse K1 to K3 then D4; co-op server step 1.

## Standing rules
- Start every chat with "michadr". Main models: Sonnet 5.5 (build and refactor against tests), Haiku 5.5 (tiny edits, number tweaks), Opus 5.5 (design, save formats, multiplayer, security). Fable 5.2 only when the user says so. Never switch model, start a subagent or call the advisor (read-only Opus) without the user's go-ahead: say which and why, then wait.
- Tokens: the weekly limit must never reach 100% (stop 97, hard stop 99, warn from 60; `npm run watcher`). Grep the index, open files by line range, never read `context.md` whole.
- Flag frame-rate risks first, with a number and a cheaper option. Budget on screen: about 15 skinned characters, 10 cars, 300 draw calls, 1,000 tree instances.
- Run `npm test` after each change; report failures honestly. After changing `dist/`, run `npm run release -- --force` first (packaged tests run `dist/releases/<version>/`), unless deployed: then bump the version.
- Keep `town.js`, `world.js`, `map-definition.js` changes minimal and additive; say so.
- The user commits by hand unless asked (or from the hub's Commit page). `git` is not on PATH: use GitHub Desktop's `%LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe`. Never commit `assets-src/`, `.claude/`, `simproject.code-workspace`, `.dev.vars`, `.hub/`.
- Plans: send one with `npm run plan -- <file.md>`; build only an approved revision (`--status <id>`). After finishing a plan's work in VS Code, run `npm run plan -- --close <id> --why "built in VS Code"` so Work stays true.
- Real assets over fake ones; say what is missing or unverified. Credit gaps wait until the public release. Small steps; stop with tests passing.

## Ideas that hold the code together
- Data first, pure transactions: the map, interiors, items and rules are data; changes are pure functions (state and action in, new state or error out) with tests. Money is integer cents. Saves are normalised on load.
- One placement path: reset, teleport, unstick and load use `placeSafely` (`safe-spot.js`).
- 1 unit = 1 m, +Y up, north is -z, the player is 1.95 m, spawn (-5, 15). Real time runs in slices of at most 1/30 s (`timestep.js`); the clock runs 30 game minutes per real minute.

## Commands
`npm test` (each `tests/*.mjs` in its own process) · `npm run release -- --force` · `npm run dev` (localhost:8000) · `npm run server` (relay, ws 8080) · `npm run index` (this brief and the index) · `npm run watcher` (token page, no model call; `-- --probe` takes a fresh reading with one small Haiku call, and typing it is the user's go-ahead) · `npm run hub` (127.0.0.1:8765; no model calls) · `npm run plan` (`-- <file.md>`, `--status`, `--list`) · `npm run assets` (pictures, asset page) · `node scripts/browser-lab.mjs <outDir> <scenario.json>` (screenshots, needs `npm run dev`).

## Gotchas that cost real time
- PowerShell 5.1 `Set-Content -Encoding utf8` and `>` write a BOM that breaks `JSON.parse`: use `[IO.File]::WriteAllText(path, text, (New-Object Text.UTF8Encoding $false))`.
- Multi-line `Edit` on `dist/game.js` and `dist/world.js` (CRLF) often fails: use single-line anchors, check each landed. `game.js` is dense on purpose: match it.
- PowerShell double-quoted strings eat backticks and `${}`: use single-quoted here-strings for JavaScript, then `node --check`.
- Claude Code from a script: `hub/probe.js` finds `claude.exe`; clear `CLAUDE*` and `ELECTRON_RUN_AS_NODE`.

## Where to change things
Map, roads, plots, props, shop hours: `map-definition.js`, then `npm test` (`map.mjs` pins tree counts and a hash). Add a model: `scripts/build-props.mjs` (originals in `assets-src/` are not in the repo), `ASSETS.md`, `assets-register.json`, `credits.js`. Prices, wages, drain: `items.js`, `jobs.js`, `contracts.js`, `housing.js`, `life.js`. Menus, HUD: `index.html`, `style.css`, `game.js`. Multiplayer: `multiplayer.js`, `server.js`, `worker/`. People: `population.js`, `schedule.js`. Tokens and the hub: `hub/`.

## Read more only when needed
`DESIGN.md` (plan, decisions, roadmap, budgets; 4.16 warehouse, 4.17 co-op, 4.20 people), `context.md` (the long record: line ranges only), `README.md` (per version), `ASSETS.md` (models, licences).
