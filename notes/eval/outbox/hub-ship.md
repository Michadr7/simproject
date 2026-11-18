michadr.

# Hub Ship Flow Decisions 2, 3, and 4 (`gemini-hub-ship.md`)

- **Date:** 2026-11-17
- **Scope:** Implemented Owner Decisions 2, 3, and 4 from [notes/hub-ship-flow-design.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/hub-ship-flow-design.md) across `hub/` and `tests/hub-deploy.mjs`. Did **not** touch `dist/`, game code, `scripts/`, or `notes/handoff.md`, made zero model calls, and ran zero live `wrangler` or `Publish` deploys.
- **Note for Owner:** **Restart the hub** (`npm run hub -- --runs` or the Tools `Restart` button) so the updated `hub/deploy-facts.mjs` and browser assets (`hub/web/deploy-rules.js`, `hub/web/deploy.js`, `hub/web/hub.css`) take effect.

## Agent & Model Routing Used
- **Planning & Implementation (Strongest reasoning model):** Audited `hub/web/deploy-rules.js`, `hub/deploy-facts.mjs`, `hub/web/deploy.js`, `hub/web/hub.css`, `hub/server.js`, `hub/jobs.js`, and `tests/hub-deploy.mjs`, planned Decisions 2–4, applied all edits, extended tests, and verified all 26 `tests/hub-*.mjs` suites.
- **Subagents / Flash:** None used.

## Files Created or Changed
1. [hub/web/deploy-rules.js](file:///c:/Users/Michael/Documents/Projects/simproject/hub/web/deploy-rules.js) — **83 lines** (`9,214` bytes, `HasBOM: False`; was 70 lines):
   - Exported `isTrackedCodePath(p, currentVersion)`, `newestCodeMtime(entries, currentVersion)`, and `shipButtonText(version)`.
   - **Decision 2 (Test freshness hard gate):** In `deployChecks`, missing tests (`tests: null`), failing tests (`!t.ok`), and passing tests older than the newest changed `dist/` or `tests/` file (`testAt < newest`, excluding old untouched `dist/releases/<other>/` folders) now emit `state: 'fail'` and block `Publish` (`ready: false`). Kept all existing hard gates (`version`, `releaseFolder`, `indexPointsHere`, `live` newer than live site, `wrangler === 'in'`).
   - **Decision 3 (Uncommitted files warn only + link):** Kept `changed > 0` as `state: 'warn'` (never blocks) and added `href: '#commit'` plus a `#commit` mention in the warning message.
2. [hub/deploy-facts.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/hub/deploy-facts.mjs) — **37 lines** (`3,620` bytes, `HasBOM: False`; was 27 lines):
   - Added `scanNewestTrackedMtime(root, currentVersion)` populating `facts.newestChangedMtime` from `dist/` and `tests/` while skipping old `dist/releases/<other>/` directories.
   - Included `gate` alongside `test` and `check` when scanning `.hub/jobs/` for `facts.tests`, returning both `at` and `endedAt`.
   - Kept the single `LIVE_URL` `fetchFn(` read and single `[w,'whoami']` `wrangler` call unchanged.
3. [hub/web/deploy.js](file:///c:/Users/Michael/Documents/Projects/simproject/hub/web/deploy.js) — **116 lines** (`11,398` bytes, `HasBOM: False`; was 81 lines):
   - **Decision 3 link UI:** When `c.href === '#commit'` (or `c.key === 'changed' && c.state === 'warn'`), appends an `Open Commit (#commit)` anchor (`class="dlink"`, `href="#commit"`) inside the Results item.
   - **Decision 4 chained `Ship <version>` button:** Exported `runShip` and `shipButtonText`, added a `Ship <version>` button beside the existing `Publish` button on `#deploy` (while keeping `Check`, `Publish`, and `Bump`). Pressing `Ship` starts `deploy-check`, polls `/api/jobs` until it completes (`waitForCheck`), validates `canPublish(checkRec, now, lastPublished)`, and **only if all hard gates pass**, prompts with the existing `confirm(confirmText(sum))` dialog before calling `job-start` for `deploy` with `{confirm: sum.version}`. Preserved text-only DOM construction (no `innerHTML`, no external URLs, no `:null)`).
4. [hub/web/hub.css](file:///c:/Users/Michael/Documents/Projects/simproject/hub/web/hub.css) — **549 lines** (`56,827` bytes, `HasBOM: False`; +1 line appended):
   - Appended `.dlink` styling so the `#commit` link inside Deploy Results matches hub link colors.
5. [tests/hub-deploy.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/hub-deploy.mjs) — **203 lines** (`28,361` bytes, `HasBOM: False`; was 125 lines):
   - Updated the missing-test expectation (`tests: null` -> `fail`, `ready: false`).
   - Added unit, `gatherFacts` filesystem-mtime (verifying old release folders are excluded while `dist/` and `tests/` files fail freshness), `runShip` orchestration, `#commit` link, and live `createHubServer` HTTP tests proving `Ship` never bypasses failing hard gates or the confirm dialog.
6. [notes/eval/outbox/hub-ship.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/eval/outbox/hub-ship.md) — this report.

## Requested Edits to Forbidden Files
- **None.** All work fit inside `hub/` and `tests/hub-deploy.mjs`. Because no new files were added to `dist/`, `tests/`, or top-level `hub/` and no top-level header comments or imports in `tests/hub-deploy.mjs` / `hub/deploy-facts.mjs` were renamed/added at index level (`scripts/build-index.mjs` indexes `hub/*.js|mjs`, not `hub/web/`), `PROJECT-INDEX.md` is unchanged (no index run needed; `npm run index` was not run).

## Test Results (Real Output)

Quick check (`node tests/hub-deploy.mjs`):
```text
hub-deploy: the version rules, every blocking and warning result, the job summary, the page sentence, and the proof that the check publishes nothing, the Publish rules, the refusals of the script, the route of the hub, Bump version, and Decisions 2-4 passed.
```

Full `tests/hub-*.mjs` sweep (all 26 suites, 0 failures):
```text
hub-actions.mjs [0]: hub-actions: ACTION lines parsed strictly, the possible actions sent to the master with their ids, the hub-made Approve for a filed plan, stale buttons switched off, and Approve, Start and Close clicked through the real routes and gates passed.
hub-activity.mjs [0]: hub-activity: the chat feed (names and counts, starts over per message, ends with how the turn ended), the activity builder (idle, working, question, stopped) and the two GET routes passed.
hub-asset-facts.mjs [0]: hub-asset-facts: the measured facts, the plain-word problems for a character and for a prop, the header reader with its cache, the Assets summary, the status block of the master, and the page passed.
hub-boot.mjs [0]: hub-boot: the hub folder starts with runs on, answers who it is, hands out its token, serves the jobs, activity, tokens and home pages, and prints no start-up error passed.
hub-bot.mjs [0]: hub-bot: fold states, clicks, poll pace, speech line, count, link, room made on the page, text-only DOM with one read, and the runs-off notice passed.
hub-cache.mjs [0]: hub-cache: usage, context and split, hit and miss, lifetime not sure on thin data, model switch ignored, countdown only when sure, warnings, and the runner window passed.
hub-chat.mjs [0]: hub-chat: ok
hub-commit.mjs [0]: hub-commit: ok
hub-deploy.mjs [0]: hub-deploy: the version rules, every blocking and warning result, the job summary, the page sentence, and the proof that the check publishes nothing, the Publish rules, the refusals of the script, the route of the hub, Bump version, and Decisions 2-4 passed.
hub-fetch.mjs [0]: hub-fetch: the link, address, folder and file-name rules, the summary, every refusal of the script before any network or file, the route of the hub, and the page passed.
hub-jobs.mjs [0]: hub-jobs: the job table (no shell strings), the summariser, the lock, the record, services, the index after a finished run, restart on exit code 75, replacing only a real older hub, every refused route, the master's tool buttons and Quick fix passed.
hub-lanes.mjs [0]: hub-lanes ok
hub-markdown.mjs [0]: hub-markdown ok
hub-plans.mjs [0]: hub-plans ok
hub-records.mjs [0]: hub-records: ok
hub-records-server.mjs [0]: hub-records-server: ok
hub-runner.mjs [0]: hub-runner: ok
hub-runplan.mjs [0]: hub-runplan: ok
hub-runs.mjs [0]: hub-runs: ok
hub-runs-page.mjs [0]: hub-runs-page: ok
hub-server.mjs [0]: hub-server ok
hub-shell.mjs [0]: hub-shell ok
hub-sound.mjs [0]: hub-sound: off by default, a switch for every sound, which change deserves which sound, silent first answer, no repeat while the state holds, the cooldown, and the wiring passed.
hub-status.mjs [0]: hub-status: ok
hub-waiting.mjs [0]: hub-waiting ok
hub-work.mjs [0]: hub-work: grouping, the eight statuses, next-step sentences, the count, items, old hashes, plain feed words, the layout rule and GET /api/work passed.
TOTAL: 26 suites, FAILURES: 0
```

## What Could Not Be Verified
- **Live browser DOM rendering and click interaction in `hub/web/index.html#deploy`:** Node tests cover `deployChecks`, `gatherFacts`, `runShip`, `#commit` markup presence, and `createHubServer` routes with test stubs, but the `#deploy` page was not opened or clicked inside a browser (owner must restart the hub to load and click it).
- Non-hub `tests/*.mjs` files were not run because no `dist/` game code was touched.

## Confidence
- **Decision 2 (Test freshness gate in `deploy-rules.js` & `deploy-facts.mjs`):** **High** — pinned with unit tests and real temp-directory `gatherFacts` file mtime tests.
- **Decision 3 (Uncommitted files warn + `#commit` link):** **High** for rule behavior (`ready: true` on `warn`, `#commit` href); **Medium-High** for visual styling in browser (unseen in a live browser).
- **Decision 4 (`Ship <version>` chained flow & confirm safety):** **High** for gating and confirm-bypass prevention (tested standalone and against live `createHubServer`); **Medium-High** for `mountDeploy` poll loop in browser (reviewed by inspection, not clicked in DOM).

## Files to Share With Your Other Agent
- [hub/web/deploy-rules.js](file:///c:/Users/Michael/Documents/Projects/simproject/hub/web/deploy-rules.js)
- [hub/deploy-facts.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/hub/deploy-facts.mjs)
- [hub/web/deploy.js](file:///c:/Users/Michael/Documents/Projects/simproject/hub/web/deploy.js)
- [hub/web/hub.css](file:///c:/Users/Michael/Documents/Projects/simproject/hub/web/hub.css)
- [tests/hub-deploy.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/hub-deploy.mjs)
- [notes/eval/outbox/hub-ship.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/eval/outbox/hub-ship.md)
