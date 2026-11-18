michadr.

# Hub Decision 1: Secondary `Commit & push` Button

- **Date:** 2026-11-17
- **Scope:** Implemented **only** Owner Decision 1 from [notes/hub-ship-flow-design.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/hub-ship-flow-design.md) — added a secondary **`Commit & push`** button beside the primary **`Commit N files`** button in `hub/web/commit.js`, backed by unit and live HTTP/git tests in `tests/hub-commit.mjs`. Did **not** touch `hub/server.js`, `hub/git.mjs`, `hub/commit-ctl.mjs`, guards/tokens/origin checks, or Decisions 2, 3, or 4.
- **Note for Owner:** **Restart the hub** to load the updated `hub/web/commit.js` in the browser.

## Agent & Model Routing Used
- **Planning & Audit (Opus-equivalent reasoning model):** Reviewed `hub/web/commit.js`, `hub/commit-ctl.mjs`, `hub/web/runs-api.js`, `hub/web/run-actions.js`, `hub/web/hub.css`, and `tests/hub-commit.mjs` to design the exact secondary button gating (`canPushAfterCommit`, `commitAndPushBlock`, `runCommitAndPush`) and edge-case test plan.
- **Execution:** Applied the planned edits to `hub/web/commit.js` and `tests/hub-commit.mjs`, ran all 26 `tests/hub-*.mjs` suites, and verified zero UTF-8 BOMs.
- **Flash / Subagents:** None used.

## Files Created or Changed
1. [hub/web/commit.js](file:///c:/Users/Michael/Documents/Projects/simproject/hub/web/commit.js) — **257 lines** (`21,319` bytes, `hasBOM: False`; was 207 lines):
   - Exported `COMMIT_PUSH_LABEL`, `canPushAfterCommit(push)`, `commitAndPushBlock(p, push, picked, message, working, pushing)`, and `runCommitAndPush({...})`.
   - Placed secondary `<button class="btn">Commit & push</button>` directly beside primary `Commit N files` in `mountCommit` (uses existing `.btn` + `.cm-actions` CSS in `hub/web/hub.css`; no CSS edit required).
   - Wired `doCommitAndPush()` to run `commit-do`, and **only** when `commit-do` returns `ok` and `GET /api/push/status` returns `canPush: true` for the new `commit.id`, chain `push-do` with `{head: commit.id}`. On any error, it stops, displays the real error (`say(r.error)`), and leaves the local commit intact with Undo still available (`p.last.canUndo === true`).
   - Also aligned `doCommit()` guard (`working || pushing`) so `Commit` cannot fire while `Commit & push` is in the push phase.
2. [tests/hub-commit.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/hub-commit.mjs) — **451 lines** (`53,762` bytes, `hasBOM: False`; was 367 lines):
   - Added pure unit tests for `COMMIT_PUSH_LABEL`, `canPushAfterCommit`, `commitAndPushBlock`, and `runCommitAndPush` (guard refusal, commit 409 error forwarding `proposal`, `push-status` refusal/head-mismatch stopping before `push-do`, `push-do` failure leaving commit intact, and happy path chaining `commit-do` then `push-do` with new `head`).
   - Added live hub HTTP + temporary bare/work git tests over `/api/commit`, `/api/push/status`, `/api/push`, `/api/commit/proposal`, and `/api/commit/undo` verifying both remote-ahead push failure (commit kept + Undo works) and clean end-to-end commit & push (Undo cleared).
3. [notes/eval/outbox/hub-commit-push.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/eval/outbox/hub-commit-push.md) — this report (`hasBOM: False`).

## Requested Edits to Forbidden Files
- **None.** All existing server routes and guards (`hub/server.js`, `hub/git.mjs`, `hub/commit-ctl.mjs`, `hub/web/runs-api.js`) already supported chaining `commit-do` -> `GET /api/push/status` -> `push-do` cleanly without changes.

## Test Results (Real Output)

Quick check (`node tests/hub-commit.mjs`):
```text
hub-commit: ok
```

Full `tests/hub-*.mjs` sweep (all 26 suites, 0 failures):
```text
[0] hub-actions.mjs: hub-actions: ACTION lines parsed strictly, the possible actions sent to the master with their ids, the hub-made Approve for a filed plan, stale buttons switched off, and Approve, Start and Close clicked through the real routes and gates passed.
[0] hub-activity.mjs: hub-activity: the chat feed (names and counts, starts over per message, ends with how the turn ended), the activity builder (idle, working, question, stopped) and the two GET routes passed.
[0] hub-asset-facts.mjs: hub-asset-facts: the measured facts, the plain-word problems for a character and for a prop, the header reader with its cache, the Assets summary, the status block of the master, and the page passed.
[0] hub-boot.mjs: hub-boot: the hub folder starts with runs on, answers who it is, hands out its token, serves the jobs, activity, tokens and home pages, and prints no start-up error passed.
[0] hub-bot.mjs: hub-bot: fold states, clicks, poll pace, speech line, count, link, room made on the page, text-only DOM with one read, and the runs-off notice passed.
[0] hub-cache.mjs: hub-cache: usage, context and split, hit and miss, lifetime not sure on thin data, model switch ignored, countdown only when sure, warnings, and the runner window passed.
[0] hub-chat.mjs: hub-chat: ok
[0] hub-commit.mjs: hub-commit: ok
[0] hub-deploy.mjs: hub-deploy: the version rules, every blocking and warning result, the job summary, the page sentence, and the proof that the check publishes nothing, the Publish rules, the refusals of the script, the route of the hub, and Bump version (the number rules, the refusals of the script, the route) passed.
[0] hub-fetch.mjs: hub-fetch: the link, address, folder and file-name rules, the summary, every refusal of the script before any network or file, the route of the hub, and the page passed.
[0] hub-jobs.mjs: hub-jobs: the job table (no shell strings), the summariser, the lock, the record, services, the index after a finished run, restart on exit code 75, replacing only a real older hub, every refused route, the master's tool buttons and Quick fix passed.
[0] hub-lanes.mjs: hub-lanes ok
[0] hub-markdown.mjs: hub-markdown ok
[0] hub-plans.mjs: hub-plans ok
[0] hub-records.mjs: hub-records: ok
[0] hub-records-server.mjs: hub-records-server: ok
[0] hub-runner.mjs: hub-runner: ok
[0] hub-runplan.mjs: hub-runplan: ok
[0] hub-runs.mjs: hub-runs: ok
[0] hub-runs-page.mjs: hub-runs-page: ok
[0] hub-server.mjs: hub-server ok
[0] hub-shell.mjs: hub-shell ok
[0] hub-sound.mjs: hub-sound: off by default, a switch for every sound, which change deserves which sound, silent first answer, no repeat while the state holds, the cooldown, and the wiring passed.
[0] hub-status.mjs: hub-status: ok
[0] hub-waiting.mjs: hub-waiting ok
[0] hub-work.mjs: hub-work: grouping, the eight statuses, next-step sentences, the count, items, old hashes, plain feed words, the layout rule and GET /api/work passed.
TOTAL: 26 suites, FAILURES: 0
```

## What Could Not Be Verified
- **Live browser DOM rendering and click interaction in `hub/web/index.html#commit`:** Node tests exercise `canPushAfterCommit`, `commitAndPushBlock`, and `runCommitAndPush` against both mocks and the live `hub/server.js` + temporary `git` routes, but `mountCommit` was not opened or clicked inside a browser (you must restart the hub to see it in Chrome/Edge).
- Full game test suite (`npm test` outside `tests/hub-*.mjs`) was not run because only `hub/web/commit.js` and `tests/hub-commit.mjs` were modified.

## Confidence
- **Gating & Chained Orchestration (`canPushAfterCommit`, `commitAndPushBlock`, `runCommitAndPush`):** **High** — pinned by unit tests plus live HTTP + real temporary git failure/Undo and success tests in `tests/hub-commit.mjs`.
- **Browser UI Wiring (`mountCommit`, `doCommitAndPush`, `updateActions`):** **Medium-High** — reviewed carefully against `hub/web/commit.js` and `hub/web/hub.css`, though unverified in a live browser click.
- **No Unwanted Changes (No server/git/controller/Decision 2-4 changes):** **High** — verified only `hub/web/commit.js`, `tests/hub-commit.mjs`, and this report were modified.

## Files to Share With Your Other Agent
- [hub/web/commit.js](file:///c:/Users/Michael/Documents/Projects/simproject/hub/web/commit.js)
- [tests/hub-commit.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/hub-commit.mjs)
- [notes/eval/outbox/hub-commit-push.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/eval/outbox/hub-commit-push.md)
