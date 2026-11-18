# Mikkadr Hub Gap Design (Full Pipeline Parity with VS Code Chat)

Target goal: run the entire development loop (**Start -> Approve -> Build -> Verify -> Gate -> Commit/Push -> Ship**) from the Mikkadr Hub while preserving every safety invariant: **no model call without an owner click**, `X-Hub-Token` + same-origin write guards (`hub/server.js:173-294`), no git from runs (`hub/runs.js:5`), and no deploy without the version-typed confirm (`scripts/deploy.mjs:11-21`).

---

## 1. Master Orchestration (Queueing, Chaining, Routing & Evidence Log)

### VS Code chat today
- Sequences dependent stages sequentially (`notes/handoff.md:22-24,30,86`): reads the previous report, runs `npm run index` + `release` + `npm test`, then launches the next step.
- Picks model by `MODEL ROUTING` (`notes/handoff.md:22`, `context.md:11-12`): **Sonnet** for pure modules, tests, measurements, number tuning, notes, single-file fixes; **Opus** for read-only audits/reviews, design, save formats, multiplayer, security, multi-file/`game.js` wiring, or repeated Sonnet failures; **Fable** only on explicit owner yes. Never changes model/agent without owner approval (`context.md:11`) and records every pass/mistake in the evidence log (`notes/handoff.md:22-24`).

### Hub today (verified)
- `hub/chat.js:3-4,28` keeps the master strictly read-only (`Read, Grep, Glob`). It can propose single `ACTION: approve|start|resume|close` buttons (`hub/web/run-actions.js:51-74`), but each requires a separate owner click.
- `hub/runs.js:46,80` enforces one active run slot (`.hub/run.lock`); `hub/hub-cli.mjs:42` auto-starts the zero-token `gate` job (`release -> test -> index`) when a run ends `done`.
- **Gaps:** No multi-step chain queue; no automatic step-to-step advancement after `gate` passes; no programmatic enforcement of the `MODEL ROUTING` table in `runplan.js`; no routing evidence store fed back into `HUB STATUS`. *Unverified:* exact report path conventions across legacy runs (some `plans/` steps predate `notes/eval/outbox/`).

### Design
- **Pure module (`hub/chain.js`, Sonnet):**
  - Data model `.hub/chain.json`: `{id, title, approvedAt, approvedSteps, status: 'waiting'|'running'|'paused'|'stopped'|'done', stopReason, steps: [{n, planId, revision, model, size, reportPath, status, runId, gateJobId, verifiedOk}]}`.
  - `recommendModel(planText, stats)`: classifies task keywords/paths (`dist/game.js`, save schemas, `worker/`, `security`, `audit`) against `MODEL ROUTING` (`Opus` vs `Sonnet` vs `Haiku`) and flags mismatches against `## Run` before the owner approves.
  - `nextTransition(chain, lastRun, gateJob, gaugesState)`: pure state machine returning `'wait'` | `'run-gate'` | `'launch-next'` | `'stop'`. **Hard stops** (`chain.status = 'stopped'`) trigger immediately on: `run.status === 'waiting-answer'` (`QUESTION`), `run.status !== 'done'`, `gateJob.summary.ok === false`, any `flagged` shared/forbidden path violation (`hub/runs.js:22`), report file missing/error, or `gaugesState.weekly.pct >= 92` (launch stop rule).
- **Controller & server (`hub/chain-ctl.mjs`, `hub/server.js`, Opus):**
  - `CHAIN:` block parser in `hub/chat.js` (parallel to `PLAN:` at `hub/chat.js:31-38`) creates a draft chain on `#work`.
  - **One-click chain approval + explicit Opus/Fable second-yes:** A single owner click (`POST /api/chains/:id/start` with `X-Hub-Token`) approves the fixed list of `{planId, revision, model}` steps. If any step uses `opus` or `fable`, the button requires the existing 2-minute second-yes confirmation (`hub/runs.js:17,138`) up front, naming every Opus/Fable step. Once started, each step consumes tokens only up to its pre-approved cap; changing a plan revision voids the chain.
  - **Report + gate handshake:** On `run` completion (`done`), `hub/hub-cli.mjs:42` runs `gate` (`release -> test -> index`, zero tokens). Only when `gate` finishes `ok === true`, `chain-ctl` reads the run's named report (`notes/eval/outbox/<stage>.md`), runs deterministic checks (Gap 3), logs `{at, planId, model, taskKind, passed, failures}` to `.hub/routing-log.jsonl` (surfaced in `hub/status.js` for future master prompts), and auto-starts step $n+1$ via `runs.start()`. **All other model calls (chat turns, single runs, manual retries) stay behind owner presses.**
- **UI:** Dedicated "Queue / Chain" card at top of `#work` (`hub/web/work.js`) showing step pills, current `gate` status, the exact stop reason on failure, and one `Resume after fix` / `Cancel chain` button.
- **Tests:** `tests/hub-chain.mjs` (Sonnet) covering routing recommendations, hard-stop transitions on test failure/question/92% weekly/forbidden path, revision mismatch invalidation, and `gate -> step 2` controller transitions with stubbed `runs`/`jobs`.

### Open owner questions (max 3)
1. **Should a chain auto-advance into step $n+1$ immediately after `gate` passes, or pause for 1 click between steps when a step hits a warning?** *(Recommended: auto-advance on clean pass + 0 warnings; pause on any failure or warning.)*
2. **Allow a chain to edit shared files (`dist/game.js`) when an Opus step is explicitly approved in the chain?** *(Recommended: yes for Opus steps with `X-Hub-Token` confirmation; still forbidden for Sonnet/Haiku runs.)*
3. **Should the routing evidence summary live only in `.hub/routing-log.jsonl` (shown in `HUB STATUS`) or also append to `notes/handoff.md` via a button?** *(Recommended: keep in `.hub/routing-log.jsonl` + `HUB STATUS` so the hub never edits repo markdown behind the owner's back.)*

---

## 2. Usage Meter (Local Source Audit & One-Tap Owner Entry)

### VS Code chat today
- `notes/handoff.md:13-15,26`: cannot read account weekly/5-hour usage percentages; asks the owner before heavy launches and stops launching new agents at **92% weekly** (`never reach 100%`).

### Hub today & read-only audit
- **Audit result (verified across `hub/`):** **No reliable local source exists** for account-wide weekly or 5-hour percentages.
  - `hub/watcher.js:101-110` and `hub/tokens-page.mjs:9-21` scan `~/.claude/projects/**/*.jsonl`, which only contain local PC per-message token counts (`billable`) and explicitly exclude web/other devices (`hub/page.js:66`: `"other devices and the web are not included"`).
  - Real `weekly` and `fiveHour` `utilization` percentages arrive **only** in stdout `rate_limit_event` JSON lines emitted during a live Claude CLI call (`hub/watcher.js:22-33`, captured by `hub/probe.js:3-4,33-34` at ~7,600 tokens, `hub/runs.js:101`, `hub/chat.js:140`).
  - Current UI (`hub/web/index.html:11-16`, `hub/web/app.js:84-95`) hides behind `?` when stale/reset; `hub/watcher.js:16,84-88` sets `internalGuard: 97` (`stop: 99`) for both pre-start checks (`canStart`) and mid-run abort (`shouldStop`).

### Design
- **No invented API:** Keep `.hub/usage.jsonl` as the single source of truth; add an explicit `manual` entry path alongside `probe`/`run`/`chat`.
- **Pure rules (`hub/watcher.js`, Sonnet):**
  - Add `parseManualReading(text, now)`: parses `"weekly 47%"` or `"47% / 62%"` into `{at: now, source: 'manual', weekly: {pct, resetsAt: existingWeeklyReset}, fiveHour: optional, tokensTotal: null}`. Rejects values outside `0..100` or malformed strings.
  - Split launch vs mid-run thresholds in `DEFAULTS`: keep `internalGuard: 97` and `stop: 99` for `shouldStop` (aborting an already-running turn), and add **`launchStop: 92`** in `canStart` (`hub/watcher.js:73-82`) and `hub/chain.js` so no new run or chain step launches at `>= 92%` weekly.
- **Server & UI (`hub/server.js`, `hub/web/index.html`, `hub/web/app.js`, Opus for route security):**
  - New authenticated POST route `POST /api/gauges/set` (`X-Hub-Token` + same-origin required; validates plain JSON `{text}` or `{weekly, fiveHour}` via `parseManualReading`, attaches `tokensTotal: logTotal()`, appends to `.hub/usage.jsonl`, returns updated `gaugesOf(root)`).
  - **Always shown UI:** Top gauge bar (`hub/web/index.html:11-16`) displays `#g-weekly` (`stop launch at 92%`), age/source pill (`manual` vs `probe` vs `run`), and a **one-tap `"Set %"` inline chip/input** pre-accepting `"weekly 47%"` (plus same quick chip above `#chat` composer when `weekly >= 85%` or stale). Updating triggers `refresh()` across the hub immediately and updates `HUB STATUS` (`hub/status.js:80,106`).
- **Builder models & tests:** Pure parser + 92% launch gate in **Sonnet**; `server.js` route + shell UI in **Opus**; tests in `tests/hub-watcher.mjs` (extending existing tests for `parseManualReading`, `launchStop: 92`, and `POST /api/gauges/set`).

### Open owner questions (max 3)
1. **Should `launchStop: 92` also pause master chat turns in `#chat`, or only block starting new build runs and chain steps?** *(Recommended: block build runs/chains at 92%, warn-only in `#chat` until `internalGuard: 97` so you can still ask the master for a handoff.)*
2. **When `source: 'manual'` is saved with no `probe`, should it keep the last known `resetsAt` timestamp from `.hub/usage.jsonl` if still in the future?** *(Recommended: yes, preserve future `resetsAt` so weekly window rollovers still auto-expire stale manual readings.)*

---

## 3. Loop Detection and Separate Verifier for Runs

### VS Code chat today
- The owner/main chat watches for repeated failed edits/commands, stops runaway work after a second failure (`notes/handoff.md:9,23`), runs the real gate (`npm run release && npm test`) independently of agent claims, and spawns separate read-only auditors/reviewers (`notes/handoff.md:9,29,70`).

### Hub today (verified)
- `hub/runner.js:71-100,123-130` tracks `tool_use` events (`Read`, `Edit`, `Write`, `Shell`) and stops only on `cap` (100% tokens), `gauge-stop` (97%), `pause`, or disallowed-tool `violation`. **No loop detector exists**: a run can edit/fail the same file 20 times until its token cap burns out.
- `hub/hub-cli.mjs:42` triggers `gate` (`release -> test -> index`) after a `done` run, but nothing compares a run's claimed changed files or report claims against actual disk changes/test results, and there is no second read-only verifier agent.

### Design
- **Loop detector (`hub/loop-detect.js`, Sonnet; wired into `hub/runner.js:124`, Opus):**
  - Pure `createLoopDetector({windowSize: 12, sameEditLimit: 4, sameCmdFailLimit: 3})`: slides over normalized `{kind, tool, target, ok}` feed events from `reducer.take(line)`.
  - Triggers `{loop: true, reason}` when: (a) identical `(tool, target)` repeats `>= 4` times consecutively (or `>= 5` edits to the same file inside 8 events with zero test progress), or (b) the same `Shell` command fails `>= 3` times in a row.
  - Inside `runTurn` (`hub/runner.js:124`), triggers `emit({kind: 'loop-stop', reason})` and `stop('loop')`; `hub/runs.js:102-112` records `run.status = 'loop-stopped'` cleanly instead of burning remaining cap.
- **Two-stage Verifier (`hub/verifier.mjs`, Sonnet; chain/UI wiring in `hub/runs.js`, `hub/runs-page`, Opus):**
  - **Stage A (Zero-token deterministic script, automatic after `gate`):** checks `run.paths` against forbidden paths (`AGENTS.md` / `hub/runs.js:22`), checks UTF-8 BOM absence (`0xEF 0xBB 0xBF`) on modified JSON/JS/MD files, confirms expected outbox report exists with `"michadr."` line 1, and reconciles `gate` test output (`tests` passed count & failing list) against `run.resultText` claims (flagging mismatched counts or missing test runs as `verifyProblems`).
  - **Stage B (Optional read-only verifier turn, behind owner press or chain step flag):** spawns a `readOnly: true` Claude turn (`model: 'sonnet'`, `Read/Grep/Glob` only) fed `{planText, run.paths, gateOutput, outboxReport}` to output strict `VERDICT: PASS | FAIL` + defect list. Never edits code; requires owner press (`ACTION: verify <run-id>`) outside an approved chain.
- **Tests:** `tests/hub-loop.mjs` (Sonnet: synthetic tool streams hitting edit loops, shell-fail loops, and non-loop multi-file edits) and `tests/hub-verifier.mjs` (Sonnet: BOM detection, forbidden-file flagging, claim-vs-gate mismatch, and `VERDICT` parsing).

### Open owner questions (max 3)
1. **Should Stage B (read-only LLM verifier) run automatically after every chain build step (~50k–150k Sonnet tokens), or only on Opus/multi-file steps and when Stage A flags something?** *(Recommended: run Stage A always [0 tokens] and Stage B automatically only on Opus/wiring steps or when explicitly requested.)*
2. **When loop detection fires mid-run, auto-stop (`loop-stopped`) or pause into `waiting-answer` so you can steer it?** *(Recommended: auto-stop as `loop-stopped` so no runaway tokens burn; `Resume` stays available.)*

---

## 4. Screenshots in the Hub Chat

### VS Code chat today
- The owner pastes screenshots directly (`context.md:7,14`) so the chat inspects visual bugs, shaders, or layout issues without copying paths manually.

### Hub today (verified)
- `hub/web/chat.js:26-38` only has `<textarea>` text input; `hub/server.js:40,176-178` caps JSON bodies on `/api/chat/send` at `MAX_BODY = 64 KB`; `hub/server.js:46-49` only serves static `.png/.jpg` from `/previews/` and `/assets-src/`, not chat uploads.
- Git & commit safety (`hub/commit.js:12`, `.gitignore:13`): **`.hub/` is already in both `.gitignore` and `hub/commit.js` `FORBIDDEN`**, so files placed inside `.hub/` can never be staged or committed by the hub. *Unverified:* exact CLI flag/prompt mechanism headless `claude.exe` (`-p --output-format stream-json --tools=Read,Grep,Glob`) accepts for reading local image paths vs multimodal stdin (`stream-json` input); using local file paths via `Read` (since Claude Code `Read` tool supports images) must be verified with one test turn.

### Design
- **Pure validator & store (`hub/chat-images.mjs`, Sonnet):**
  - Allowed MIME/extensions: PNG (`image/png`), JPEG (`image/jpeg`), WebP (`image/webp`) verified by **file magic bytes** (never trusting extension alone).
  - Limits: `MAX_IMAGE_BYTES = 5 * 1024 * 1024` (5 MB per image), `MAX_CHAT_IMAGES = 4` per message; stored under `.hub/chat-images/<sha256-16>.<ext>` (inside `.hub/`, **never committed** by `.gitignore:13` and `hub/commit.js:12` `FORBIDDEN`, plus pruned to latest 100 files).
- **Server & security (`hub/server.js`, Opus):**
  - Dedicated upload endpoint `POST /api/chat/image` (with `X-Hub-Token`, same-origin check, `Content-Type` allowlist or JSON base64 capped at `7 MB` encoded for 5 MB raw), returning `{id, name, bytes, relPath: '.hub/chat-images/...'}`. Rejects SVG (scriptable XSS risk) and invalid magic bytes (`415`).
  - Read endpoint `GET /api/chat-images/<id>.<ext>` with strict regex `^[a-f0-9]{16}\.(png|jpg|webp)$` and `X-Content-Type-Options: nosniff` (`hub/server.js:159`) so attached thumbnails render in `#chat`.
  - When `chat.send({text, images})` runs (`hub/chat.js:175`), append validated `.hub/chat-images/...` paths in the prompt so the read-only master reads them with `Read` (note: keep `.hub/chat-images/**` readable while leaving `.hub/**` edits blocked in `runner.js:22`, which already only denies `Edit(.hub/**)`/`Write(.hub/**)`!).
- **UI (`hub/web/chat.js`, Sonnet):** Paste (`paste` event on `<textarea>`), drag-drop, and `Attach image` button showing removable thumbnail chips with byte sizes; still sends only when the owner presses `Send`.
- **Tests:** `tests/hub-chat-images.mjs` (Sonnet: magic-byte spoof rejection, SVG rejection, 5 MB cap, path-traversal 404, `.gitignore`/`FORBIDDEN` guarantee).

### Open owner questions (max 3)
1. **Downscale pasted screenshots in browser canvas above e.g. `1920 px` before uploading, or store lossless original up to 5 MB?** *(Recommended: cap upload at 5 MB raw and optionally downscale >2000 px PNG/WebP to save tokens when Claude reads the image.)*
2. **Allow attaching screenshots on `#runs` question replies (`answerForm` in `hub/web/runs.js:58-63`) too, or `#chat` only first?** *(Recommended: `#chat` first, reuse `/api/chat/image` for `#runs` in a follow-up if needed.)*

---

## 5. Rollback and Release-Notes Line on Publish

### VS Code chat / repo today
- Releases are immutable snapshots in `dist/releases/<version>/` (`context.md:25,30`), `dist/index.html` points to `./releases/<version>/game.js`, and Cloudflare Pages serves the working copy via `wrangler deploy`. Live deployed versions are never overwritten (`notes/handoff.md:26`).

### Hub today (verified)
- `hub/web/deploy-rules.js:20-23,52-54` blocks republishing a live or older version (`c <= 0`), and `scripts/deploy.mjs:24` runs only `wrangler deploy` (verified in `tests/hub-deploy.mjs:69` — never `--force`, never `rollback`).
- `hub/web/deploy.js:68-74` has no release-notes field; `.hub/jobs/` stores raw publish tail output, with no clean version ledger.

### Design (non-destructive, confirm-gated)
- **What rollback means here:** Cloudflare Pages (`wrangler deploy` of static `dist/`) and immutable release caching mean rolling back NEVER deletes git history, never overwrites an already-deployed version number (`0.35.19` stays untouched), and never runs `wrangler rollback` behind a script's back. Instead, **"Roll back to `<oldVersion>`"** creates a **forward patch** (`nextVersion(live, 'patch')`) whose release folder is copied cleanly from `dist/releases/<oldVersion>/` (plus `dist/index.html` pointing to it and a brief check), keeping release URLs valid and `cmpVersion(new, live) === 1`.
- **Release-notes line (`hub/web/deploy-rules.js`, `hub/web/deploy.js`, `hub/server.js`, Sonnet/Opus):**
  - Optional 1-line `<input>` (`max 160 chars`, no control chars/newlines) on the `#deploy` card, persisted alongside `{version, note, at}` in `.hub/deploy-confirm.json` (`hub/server.js:235`) and appended on successful publish (`DEPLOYED {..., ok: true}`) to `.hub/releases.jsonl` (shown as a clean history table at the bottom of `#deploy`). Note is **never** passed as a shell flag to `wrangler` (`hub/jobs.js:4`, `scripts/deploy.mjs:24`).
- **Safe Rollback flow (`scripts/rollback-release.mjs` as a `JOBS` entry, Opus):**
  - Owner selects a prior `dist/releases/<target>/` folder on `#deploy`, types the **exact version number** in a confirmation prompt (same version-typed confirm safety pattern as `Publish`/`Bump`), and clicks `Stage rollback as <nextPatch>`.
  - Refuses if tests/release check fails or if `<target>` fails integrity check (`game.js` missing). Stages the snapshot under `dist/` -> runs `gate` (`test`) -> **still requires the normal `Check` + `Publish` version-typed confirm before anything goes online (`wrangler deploy`)**. Nothing live changes without explicit Publish confirmation.
- **Tests:** Extend `tests/hub-deploy.mjs` (Sonnet) covering release-note sanitization/ledger recording, forward-patch rollback refusing missing/corrupt targets, and proof `scripts/deploy.mjs` never gains destructive flags.

### Open owner questions (max 3)
1. **For rollback, prefer forward-patch release (`0.35.20` re-exporting `0.35.18` assets -> `Check` -> `Publish`) over running Cloudflare's `wrangler pages deployment rollback`?** *(Recommended: forward-patch release, so `version.json`, `index.html`, and git stay 100% consistent with local `dist/`.)*
2. **Require the 1-line release note to be non-empty before `Publish`/`Ship`, or keep it optional?** *(Recommended: optional with an auto-placeholder from recent commit/run title, editable before Publish.)*
3. **Should rollback copy `dist/releases/<target>/*` back into working `dist/*.js` as well, or only stage the release folder and update `dist/index.html`?** *(Recommended: copy back into `dist/` too so future edits/commits match what is live, after confirming uncommitted warning.)*

---

## 6. Staged Order (`H1..H6`) & Dependencies

| Stage | Scope & Files | Depends On | Builder Model | Verification Tests |
|---|---|---|---|---|
| **H1: Usage Meter (Manual + 92% Gate)** | `hub/watcher.js`, `hub/server.js`, `hub/status.js`, `hub/web/index.html`, `hub/web/app.js` | None (unblocks H2/H3) | **Sonnet** (`watcher.js`, tests) + **Opus** (`server.js`, `app.js` wiring) | `node tests/hub-watcher.mjs`, `node tests/hub-server.mjs` |
| **H2: Loop Detection & Script Verifier** | `hub/loop-detect.js`, `hub/verifier.mjs`, `hub/runner.js`, `hub/runs.js`, `hub/web/runs.js` | H1 (`92%` + feed stability) | **Sonnet** (`loop-detect.js`, `verifier.mjs`, tests) + **Opus** (`runner.js`, `runs.js`) | `node tests/hub-loop.mjs`, `node tests/hub-verifier.mjs`, `node tests/hub-runner.mjs` |
| **H3: Master Chain Orchestration & Routing Log** | `hub/chain.js`, `hub/chain-ctl.mjs`, `hub/chat.js`, `hub/status.js`, `hub/server.js`, `hub/web/work.js`, `hub/hub-cli.mjs` | H1 (92% stop), H2 (loop/verifier gate) | **Sonnet** (`chain.js`, tests) + **Opus** (`chain-ctl.mjs`, `server.js`, multi-file wiring) | `node tests/hub-chain.mjs`, `node tests/hub-chat.mjs`, `node tests/hub-runs.mjs` |
| **H4: Screenshots in Hub Chat** | `hub/chat-images.mjs`, `hub/server.js`, `hub/chat.js`, `hub/web/chat.js` | Independent (parallel after H1) | **Sonnet** (`chat-images.mjs`, `web/chat.js`, tests) + **Opus** (`server.js` upload security) | `node tests/hub-chat-images.mjs`, `node tests/hub-server.mjs` |
| **H5: Release Notes Line & Ledger** | `hub/web/deploy-rules.js`, `hub/web/deploy.js`, `hub/server.js`, `scripts/deploy.mjs` | Existing `hub-ship` Decisions 2–4 | **Sonnet** (`deploy-rules.js`, `deploy.js`, tests) + **Opus** (`server.js`, `scripts/deploy.mjs`) | `node tests/hub-deploy.mjs`, `node tests/hub-jobs.mjs` |
| **H6: Safe Forward-Patch Rollback** | `scripts/rollback-release.mjs`, `hub/jobs.js`, `hub/server.js`, `hub/web/deploy.js` | H5 (`.hub/releases.jsonl` ledger) | **Opus** (security, fs copy, `jobs.js` & `server.js` confirm gate) | `node tests/hub-deploy.mjs`, `node tests/hub-jobs.mjs` |
