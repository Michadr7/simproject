michadr.

# Hub Ship Flow Report (`notes/hub-ship-flow-design.md` + Commit Page Grouping & Top Summary)

## Agents & roles used for this task
- **Orchestrator (Planning tier):** Read `AGENTS.md`, `context.md`, `notes/handoff.md`, `hub/web/commit.js`, `hub/commit.js`, `hub/commit-ctl.mjs`, `hub/web/deploy.js`, `hub/web/deploy-rules.js`, `hub/deploy-facts.mjs`, `hub/web/hub.css`, `package.json`, `tests/hub-commit.mjs`, and `tests/hub-deploy.mjs`; wrote the step-by-step design and edit plan covering Steps 1 & 2.
- **Orchestrator (Execution tier):** Implemented Steps 1 & 2 directly (no separate subagents were spawned because all files share the Commit page data contract and CSS block) and ran all 26 `tests/hub-*.mjs` suites plus BOM/line-count checks.

## Files created or changed (with line counts, all UTF-8 without BOM)
- `notes/hub-ship-flow-design.md` (45 lines, NEW): 1-page design note covering the one-screen Commit summary bar, release folder grouping & collapsed rows, Commit & Push options, Deploy hard gates, press order, and 4 numbered Owner Decisions with recommended answers.
- `hub/commit.js` (115 lines, edited from 101 lines): added `'Releases'` and `'Assets'` to `GROUPS`; added `PACKAGE_VERSION`, `RELEASE_PATH`, `releaseVersionOf`, `cmpSemver`, `activeReleaseVersion`; updated `groupOf`; tagged release items with `release` and `oldRelease` in `buildProposal`; defaulted old `dist/releases/*` folders (anything other than current `package.json` version) to `ticked: false`; excluded default-unticked old release files from `suggestMessage` and stale-test mtime checks when active files exist; kept `p.counts` and `checkSelection` validation intact.
- `hub/web/commit.js` (207 lines, edited from 169 lines): added exported pure helpers `releaseOfItem`, `releaseRowLabel`, `setPathsTicked`, `groupReleases`, and `summaryCounts`; added top `summaryBox` (`Summary · X of Y files ticked` + group chips); moved `msgBox` and `actions` (with `Commit N files`) above `listBox` near the top; rendered each `dist/releases/<version>/` folder as a single collapsed `<details class="fold cm-rel-fold">` row (`Release 0.35.18 · 212 files` / `Old release <v> · N files (unticked)`) with folder-level tri-state checkbox and expand toggle.
- `hub/web/hub.css` (548 lines, edited from 541 lines — append only at lines 343–349): added `.cm-summary`, `.cm-chips`, `.cm-chip`, `.cm-chip.off`, `.cm-rel-fold`, `.cm-rel-row`, `.cm-rel-meta` at the end of the Commit section without altering existing rules.
- `tests/hub-commit.mjs` (367 lines, edited from 338 lines): kept all existing assertions passing and added tests for `'Releases'`/`'Assets'`/`'Notes'` grouping, `releaseVersionOf`/`cmpSemver`/`activeReleaseVersion`, default-unticked old releases vs ticked current release (`0.35.18`), `mergeTicks`/`pickedPaths`, `groupReleases`/`releaseRowLabel`, `summaryCounts`/`setPathsTicked`, and `checkSelection` security guard.
- **No off-limits files modified:** `hub/commit-ctl.mjs`, `hub/git.mjs`, `hub/server.js`, `hub/web/deploy.js`, `hub/web/deploy-rules.js`, `hub/deploy-facts.mjs`, `dist/*`, and all existing guards/tokens/origin checks remain untouched.

## Real test output (all 26 `tests/hub-*.mjs` suites)
```text
[hub-actions.mjs] (exit 0): hub-actions: ACTION lines parsed strictly, the possible actions sent to the master with their ids, the hub-made Approve for a filed plan, stale buttons switched off, and Approve, Start and Close clicked through the real routes and gates passed.
[hub-activity.mjs] (exit 0): hub-activity: the chat feed (names and counts, starts over per message, ends with how the turn ended), the activity builder (idle, working, question, stopped) and the two GET routes passed.
[hub-asset-facts.mjs] (exit 0): hub-asset-facts: the measured facts, the plain-word problems for a character and for a prop, the header reader with its cache, the Assets summary, the status block of the master, and the page passed.
[hub-boot.mjs] (exit 0): hub-boot: the hub folder starts with runs on, answers who it is, hands out its token, serves the jobs, activity, tokens and home pages, and prints no start-up error passed.
[hub-bot.mjs] (exit 0): hub-bot: fold states, clicks, poll pace, speech line, count, link, room made on the page, text-only DOM with one read, and the runs-off notice passed.
[hub-cache.mjs] (exit 0): hub-cache: usage, context and split, hit and miss, lifetime not sure on thin data, model switch ignored, countdown only when sure, warnings, and the runner window passed.
[hub-chat.mjs] (exit 0): hub-chat: ok
[hub-commit.mjs] (exit 0): hub-commit: ok
[hub-deploy.mjs] (exit 0): hub-deploy: the version rules, every blocking and warning result, the job summary, the page sentence, and the proof that the check publishes nothing, the Publish rules, the refusals of the script, the route of the hub, and Bump version (the number rules, the refusals of the script, the route) passed.
[hub-fetch.mjs] (exit 0): hub-fetch: the link, address, folder and file-name rules, the summary, every refusal of the script before any network or file, the route of the hub, and the page passed.
[hub-jobs.mjs] (exit 0): hub-jobs: the job table (no shell strings), the summariser, the lock, the record, services, the index after a finished run, restart on exit code 75, replacing only a real older hub, every refused route, the master's tool buttons and Quick fix passed.
[hub-lanes.mjs] (exit 0): hub-lanes ok
[hub-markdown.mjs] (exit 0): hub-markdown ok
[hub-plans.mjs] (exit 0): hub-plans ok
[hub-records.mjs] (exit 0): hub-records: ok
[hub-records-server.mjs] (exit 0): hub-records-server: ok
[hub-runner.mjs] (exit 0): hub-runner: ok
[hub-runplan.mjs] (exit 0): hub-runplan: ok
[hub-runs.mjs] (exit 0): hub-runs: ok
[hub-runs-page.mjs] (exit 0): hub-runs-page: ok
[hub-server.mjs] (exit 0): hub-server ok
[hub-shell.mjs] (exit 0): hub-shell ok
[hub-sound.mjs] (exit 0): hub-sound: off by default, a switch for every sound, which change deserves which sound, silent first answer, no repeat while the state holds, the cooldown, and the wiring passed.
[hub-status.mjs] (exit 0): hub-status: ok
[hub-waiting.mjs] (exit 0): hub-waiting ok
[hub-work.mjs] (exit 0): hub-work: grouping, the eight statuses, next-step sentences, the count, items, old hashes, plain feed words, the layout rule and GET /api/work passed.
SUMMARY: 26 hub test files, failures=0
```

## Owner action required & what could NOT be verified
- **Restart required:** Stop and restart the hub (`npm run hub -- --runs`) before checking the updated Commit page in the browser.
- **Not verified in a browser:** DOM rendering, CSS visual spacing/scroll behavior of `.cm-summary` / `<details class="cm-rel-fold">`, sticky `.cm-actions` interaction when placed above `listBox`, and interactive clicking inside a running hub browser tab were NOT exercised visually (Node tests exercise pure helpers and HTTP routes without a browser).
- **Not run (per instructions):** `npm run release` and full `npm test` were NOT run.

## Honest confidence per part
- Pure proposal grouping, `PACKAGE_VERSION` active release detection, default-unticked old releases, and security guards (`hub/commit.js`, `tests/hub-commit.mjs`): **high (95%+)** — directly covered by unit and HTTP integration tests.
- Commit page top summary bar, collapsed release rows, and DOM event wiring (`hub/web/commit.js`, `hub/web/hub.css`): **medium-high (85%)** — pure helpers (`summaryCounts`, `groupReleases`, `releaseRowLabel`, `setPathsTicked`) passed tests cleanly; visual layout in browser still needs an eye-check after restarting the hub.
- Design note (`notes/hub-ship-flow-design.md`): **high (90%)** — aligns with `hub/web/deploy-rules.js`, `hub/commit-ctl.mjs`, and `hub/web/commit.js`, with the 4 policy choices clearly marked for the owner.
