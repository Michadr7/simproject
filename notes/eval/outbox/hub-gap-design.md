michadr.

# Hub Gap Design Report (`gemini-hub-design.md`)

- **Date:** 2026-11-17
- **Scope:** Read-only architecture and staging design note comparing VS Code workflow (`notes/handoff.md`, `context.md`) against current Mikkadr Hub source (`hub/`), saved to [notes/hub-gap-design.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/hub-gap-design.md) (`149` lines — well under the `300`-line cap). Changed **no code**, ran **no deploy**, and per prompt instructions did **not** run `npm run index` or tests afterwards.

## Agent & Model Routing Used
- **Strongest reasoning model:** Inspected `hub/chat.js`, `hub/runs.js`, `hub/runner.js`, `hub/server.js`, `hub/status.js`, `hub/watcher.js`, `hub/probe.js`, `hub/tokens-page.mjs`, `hub/page.js`, `hub/hub-cli.mjs`, `hub/jobs.js`, `hub/commit.js`, `hub/work.js`, `hub/web/app.js`, `hub/web/index.html`, `hub/web/chat.js`, `hub/web/runs.js`, `hub/web/deploy.js`, `hub/web/deploy-rules.js`, `.gitignore`, `notes/handoff.md`, and `context.md` read-only; authored `notes/hub-gap-design.md` and this report.
- **Subagents / Flash:** None used.

## Files Created
1. [notes/hub-gap-design.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/hub-gap-design.md) — **149 lines** (`21,693` bytes, `HasBOM: False`). Covers all 6 sections:
   - **1. Master Orchestration:** `hub/chain.js` + `hub/chain-ctl.mjs` (`.hub/chain.json`, `.hub/routing-log.jsonl`), `MODEL ROUTING` compliance check, one-click chain approval with up-front Opus/Fable second-yes, post-`gate` report inspection before step $n+1$, and hard stops on `QUESTION`, failing test/gate, forbidden paths, or `weekly >= 92%`.
   - **2. Usage Meter:** Confirmed read-only across `hub/watcher.js`, `hub/tokens-page.mjs`, `hub/probe.js`, `hub/page.js`, and `hub/server.js` that **no reliable local source exists** for account-wide weekly/5-hour percentages (session logs hold local PC billable token counts only; `rate_limit_event` only arrives during a CLI model call). Designed one-tap manual entry (`"weekly 47%"`) stored in `.hub/usage.jsonl` with timestamp + `logTotal()`, shown always in the gauge strip, with `launchStop: 92` blocking new launches at 92% weekly.
   - **3. Loop Detection & Separate Verifier:** `hub/loop-detect.js` sliding-window tool/fail detector inside `hub/runner.js`, plus two-stage verifier `hub/verifier.mjs` (Stage A deterministic zero-token BOM/forbidden-path/claim-vs-gate audit + Stage B optional read-only verifier turn via owner action or chain flag).
   - **4. Screenshots in Hub Chat:** `hub/chat-images.mjs` magic-byte/5 MB validation stored inside `.hub/chat-images/` (already excluded from git by `.gitignore:13` and `hub/commit.js:12` `FORBIDDEN`), authenticated `POST /api/chat/image` and `GET /api/chat-images/...` in `hub/server.js`, and composer paste/drop/attach UI in `hub/web/chat.js`.
   - **5. Rollback & Release-Notes Line:** Optional 1-line release note stored in `.hub/deploy-confirm.json` and `.hub/releases.jsonl`, plus safe non-destructive forward-patch rollback (`scripts/rollback-release.mjs` copying a verified prior release folder into the next patch version and still requiring `gate -> Check -> version-typed Publish confirm`).
   - **6. Staged Order (`H1..H6`):** Dependency-ordered stages naming files, Sonnet vs Opus builder assignments, and test files.
2. [notes/eval/outbox/hub-gap-design.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/eval/outbox/hub-gap-design.md) — this report.

## Requested Edits to Forbidden Files
- **None** (read-only design task).

## Test Results
- Not run (`npm run index` and `npm test` omitted per prompt instructions: `"Do not run the index or tests."`).

## What Could Not Be Verified
- Whether headless `claude.exe` (`-p --tools=Read,Grep,Glob`) accepts local `.hub/chat-images/...` PNG/JPEG/WebP paths reliably via `Read` without `--input-format stream-json` image blocks was marked unverified in Section 4 (needs a 1-turn live check during `H4`).
- Legacy outbox report path consistency for older plans created before `notes/eval/outbox/` conventions was marked unverified in Section 1.

## Confidence
- **Codebase Audit (`file:line` findings & usage meter source check):** **High** — every cited file and line range was directly read in this session.
- **Design & Staging (`H1..H6`, security boundaries, owner questions):** **High** — grounded in existing `hub/server.js`, `hub/runs.js`, `hub/watcher.js`, `hub/commit.js`, and `scripts/deploy.mjs` guards.

## Files to Share With Your Other Agent
- [notes/hub-gap-design.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/hub-gap-design.md)
- [notes/eval/outbox/hub-gap-design.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/eval/outbox/hub-gap-design.md)
