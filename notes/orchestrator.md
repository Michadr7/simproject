# Orchestrator Guide & Agent Routing (Eden Ridge)

## 1. Standing Rules & Read-First Order
- Start every conversation and report with `michadr.` on the first line.
- **Read order for new chats:** `AGENTS.md`, `PROJECT-BRIEF.md`, `context.md` (lines 1–45), `notes/handoff.md` (lines 1–75), and `notes/orchestrator.md` (this file).
- Never read big files whole (`dist/game.js`, `context.md`, `PROJECT-INDEX.md`, `notes/handoff.md`): grep `PROJECT-INDEX.md` or target files and read bounded line ranges.
- Write all files in UTF-8 **without a BOM** (in PowerShell 5.1 never use `Set-Content -Encoding utf8` or `>`; use `[IO.File]::WriteAllText(path, text, (New-Object Text.UTF8Encoding $false))`).
- Never run `git` or commit (`git` is handled manually by the owner).
- Never switch models or spawn subagents/advisors without asking the owner first (state which model/agent and why, then wait for approval).
- **Every question to the owner is asked as dialog options** (AskUserQuestion in Claude Code: up to 4 per call, recommended option first), never as a typed question in prose. Owner 2026-11-17, widened 2026-11-18. Agents that write reports put open questions in a "QUESTIONS FOR THE OWNER" list so the main chat can turn them into dialog options.

---

## 2. Agent & Model Routing Table

| Task Type | Assigned Agent / Model | Why |
|---|---|---|
| **Read-only code audits, deep bug hunts, save-format migrations (`normalizeProgress`), design notes, multiplayer determinism, cross-module wiring (`game.js` + saves)** | **Gemini 4 Argon** (`pro` / `inherit` via `invoke_subagent`, or `gemini-4-argon-high`) or **Claude Opus 5.5** | Highest reasoning depth; catches cross-file state invariant bugs, collider math issues, and streaming/serialization edge cases. Use `research` subagent for read-only audits so writes are sandbox-blocked. |
| **Deep reasoning backup bucket** | **Gemini 4 Hydrogen** (`gemini-4-hydrogen-xhigh` / `high`) | Full reasoning fallback tier when conserving Gemini 4 Argon / Opus weekly quota. |
| **Pure modules (`dist/<name>.js` + `tests/<name>.mjs`), mechanical/single-module audits, measurements, number tuning, single-file fixes with tests** | **Gemini 3.8 Flash** (`flash` via `invoke_subagent`) or **Claude Sonnet 5.5** | Fast, economical, and verified against `AGENTS.md` pure-module rules and Node `assert` test style. Ideal for bounded 1–3 file checks and pure math/economy specs. |
| **Diagnosis and edit-spec tasks (trace code across game.js/shops.js/indoor-camera.js/world.js, verify line numbers, write copy-pasteable old -> new edit specs for the game.js lane), pure rule modules + Node assert tests, isolated non-forbidden edits (e.g. `indoor-camera.js`, `shops.js`)** | **Gemini 4 Hydrogen, Medium effort** (Gemini's own routing advice, owner pasted 2026-11-18) | Enough depth to catch edge cases (schedule gaps, Three.js depthWrite/renderOrder/opacity quirks, camera clamps) without heavy-run latency or cost. Step UP to Pro / High for large multi-system wiring inside `game.js`, renderer architecture (WebGPU T5), save-format migrations, multiplayer state. Step DOWN to Flash / Flash-Lite for single-file lookups, simple renames, repetitive mechanical checks. First live use: shops pass (`notes/eval/prompts/hydrogen-shops-pass.md`). **Trial 2026-11-18:** the owner runs the map status audit (`gemini-map-audit.md`) on **Neon (Medium)** to compare with Hydrogen Medium; record the result (evidence quality, UNKNOWN count, invented claims) here after the report. **Neon (Medium) map-audit result 2026-11-18:** good. Full report notes/map-status.md (P0-P8 tables, critical path, dense-file conflict matrix) + 63-line summary in outbox/map-status.md; 24 single Node tests run and passed; the two claims I spot-checked (Ironwood zone bounds at map-definition.js:21, Alder Ave pavement gap at :470) are true; honest about what it could not verify (browser, packaged-release tests). Verdict: Neon Medium is fine for read-only audits and status tables. |
| **Pre/post-flight verification & shared-file coordination** | **Coordinator (Orchestrator)** | Runs `npm run index`, `npm run release -- --force`, `npm test`, and release SHA-256 parity checks; cross-checks subagent `file:line` claims; compiles exact edit lists for shared files. |

---

## 3. File Ownership Lanes (`AGENTS.md`)

- **Shared / Forbidden to Outside Subagents (strictly serial, main chat or explicitly owner-authorized run only):**
  - `dist/game.js`, `dist/world.js`, `dist/map-definition.js`, `dist/driving.js`, `dist/vehicle.js`, `dist/terrain.js`, `dist/props-assets.js`, `dist/audio.js`, `dist/phone*.js`, `scripts/build-index.mjs`, `notes/handoff.md`.
  - When a stage needs edits in any of these files, outside subagents MUST stop or return exact `file:line` requested edit lists in their outbox report instead of modifying them.
- **Parallelizable Pure Module Lanes:**
  - New or isolated `dist/<name>.js` modules (no DOM, no Three.js imports unless specified, line-1 header comment explaining purpose and design note, frozen named constants, no globals, injected clock/random, frame-rate independent time) paired with `tests/<name>.mjs`.
  - Read-only `research` subagents can safely run in parallel across distinct subsystems (e.g., Argon on cross-module wiring + Flash on single-module economy/performance).

---

## 4. Pre-Flight & Post-Flight Verification Gates

1. **Release Parity Gate:** Verify `dist/*.js` vs `dist/releases/<version>/*.js` hashes match before interpreting packaged test results (`startup`, `rescue`, `dev`, `real-models`, `house-signs`, `main-menu-return`, and `*-game.mjs` tests load the packaged release folder).
2. **`dist/game.js` Editing Hazards:**
   - `game.js` uses CRLF and dense single-statement lines: use single-line anchors with count-checked replacements.
   - **Never put a mid-line `//` comment before trailing code on the same line** (`node --check` passes while silently swallowing code).
   - Test DOM is minimal/fake (no `.after`, no `body.appendChild`: place UI elements in `index.html`).
3. **Standard Completion Sequence:**
   - Targeted test: `node tests/<name>.mjs`
   - Regenerate index (respecting brief/index token budgets without raising caps): `npm run index` and `node tests/brief.mjs`
   - Rebuild packaged release (only with `--force` if version in `package.json` has never been deployed): `npm run release -- --force`
   - Full test suite: `npm test`
   - Save stage report starting with `michadr.` to `notes/eval/outbox/<stage>.md` (or audit report to `notes/eval/reviews/`).

---

## 5. Evidence Log (Updated 2026-11-17)

- **2026-11-15 — Gemini 3.8 Flash Eval & Stage FV3:** Passed 6-task evaluation benchmark ([notes/eval/gemini-3.8-flash.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/eval/gemini-3.8-flash.md)) with zero hallucinated line numbers, and built Stage `FV3` (`dist/hitch-rules.js`, `dist/farm-beds.js`, + tests; all 205 tests passing).
- **2026-11-17 — Interrupted `OPUS-wiring` & `Sonnet P-A` Recovery Audit:** Verified that `dist/plank-economy.js` + `tests/plank-economy.mjs` and `OPUS-wiring` edits in `dist/game.js`, `dist/cargo-items.js`, `dist/cargo.js`, `dist/carry.js`, `dist/jobs.js`, `dist/world-tick.js`, and `dist/releases/0.35.17/` landed cleanly (209/209 `dist/*.js` files match `dist/releases/0.35.17/` SHA-256 byte-for-byte; 18 checked test suites pass; 0 swallowed statements in `game.js`), though outbox reports were not written before cutoff.
- **2026-11-17 — Hybrid Read-Only Audit (`0.35.17`):** Paired **Gemini Pro / Argon** (`research` on Lanes 2–3 cross-module wiring & saves) with **Gemini 3.8 Flash** (`research` on Stage P-A `plank-economy.js` & Lanes 4–5 performance/needs/disposals), cross-checked by the Orchestrator. Produced [notes/eval/reviews/gemini-audit-0.35.17.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/eval/reviews/gemini-audit-0.35.17.md).
