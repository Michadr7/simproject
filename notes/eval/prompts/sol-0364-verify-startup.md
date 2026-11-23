# GPT-6.2 Sol prompt: Fix tests/startup.mjs two-boot memory limit & verify 0.36.4

Read `context.md` lines 1-45 and `notes/handoff.md` lines 1-16 first. Work in an isolated copy of the repo (never edit `dist/`, never run `git`).

## Scope & Files Owned
- `tests/startup.mjs` (only file you edit in the repo)
- Output report: `notes/eval/outbox/sol-0364-verify-startup.md` (first line `michadr.`) + screenshots in `notes/eval/outbox/`

## Tasks
1. **Fix `tests/startup.mjs` two-boot V8 ArrayBuffer limit:**
   - Currently `tests/startup.mjs` runs both `Fresh save` and `Existing save` full `bootGame()` passes in one Node process, which can hit `RangeError: Array buffer allocation failed` on the second boot.
   - Split the two phases into isolated child processes (or clean helper invocations under `tests/startup.mjs`) so `node tests/startup.mjs` runs both halves reliably in default Node memory and exits 0.
2. **Run Three.js test gate:**
   - Run all `tests/*.mjs` excluding `hub-*` (`$env:THREEJS_ONLY=1` or run via `scripts/run-tests.mjs` / loop) against the packaged `0.36.4` release and report exact counts and any failures.
3. **Independent Browser Verification (`scripts/browser-lab.mjs`):**
   - Start `npm.cmd run dev` (or use a free port with `LAB_URL`) and capture screenshots + console/error checks for:
     - `Oak Street Apartments` (`18 Oak Street` double glass door -> Lobby -> Elevator -> `Studio 2B`)
     - `Ironwood Arcade` (`C11`) & `Post Office` (`C14`) door heights / reflective glass
     - `Alder Coffee & Diner` (`18 x 16 m` counter, Back Kitchen, Restroom)
   - Flag hardware GPU frame-time checks needed from the owner.

## Report Format
Start `notes/eval/outbox/sol-0364-verify-startup.md` with `michadr.`, list exact line counts of `tests/startup.mjs`, paste real test outputs, include screenshots, and state confidence per part.
