# Hub Commit & Deploy ("Ship") Flow Design

## 1. One-Screen Top Summary (Commit Page)
When the Commit page opens, the owner should see everything needed to act on **one screen without scrolling**:
1. **Next-step line & test status** (top strip): states whether tests passed **after the newest changed file** and offers **Run tests**.
2. **Summary bar**: total ticked vs. changed files plus per-group chips (`Game`, `Releases`, `Tests`, `Hub`, `Plans`, `Notes`, `Assets`, `Other` showing `ticked/total`).
3. **Suggested Commit message box**: pre-filled by script from finished run titles or active groups, editable immediately.
4. **ONE primary button (`Commit N files`) right under the message box** (near the top, above the file list), with `Cancel` beside it.

## 2. Release Folders (`dist/releases/*`)
`npm run release` snapshots ~212 files per version under `dist/releases/<version>/`, drowning normal code changes.
- **Grouping:** All `dist/releases/*` files go into the `Releases` group.
- **Default ticks:**
  - **Current `package.json` version (`dist/releases/<version>/`):** ticked by default (`ticked: true`).
  - **All older `dist/releases/*` folders:** unticked by default (`ticked: false`), excluded from default `Commit N files` count and default message suggestion unless the owner ticks them.
- **Collapsed row UI:** Each release folder renders as **one collapsed row** instead of 200+ lines — e.g. `Release 0.35.18 · 212 files` (or `Old release 0.35.17 · 212 files (unticked)`), with a single folder-level checkbox to tick/untick the whole release and an expand toggle (`<details>`) to inspect individual files.
- **Safety invariant:** `hub/commit-ctl.mjs` (`checkSelection`) continues to verify every submitted path against `proposal.files`; no collapsed shortcut can ever bypass path validation.

## 3. "Commit and Push" Choice
- **Proposed action:** Place a secondary **`Commit & push`** button next to the primary **`Commit N files`** button (enabled only when `pushStatus.canPush || (branch has upstream)`). It runs `commit-do` and, only on HTTP `200` + clean branch head, chains `push-do` using the new `head` SHA (falling back cleanly to the separate Push card on any error).
- **OWNER DECISION 1 — Combine Commit + Push?**
  - **Recommended:** Keep **`Commit N files`** as the ONE primary button (so local commits stay undoable) and add **`Commit & push`** as an explicit secondary button beside it.
  - **Alternatives:** (a) Replace both with a single `Commit & push` checkbox opt-in; (b) keep Commit and Push strictly separate clicks.

## 4. What Deploy Needs to Be Allowed
In `hub/web/deploy-rules.js`, `Publish` (and auto-ship) should require ALL four hard gates (`state: 'fail'` blocks publishing):
1. **Version never deployed:** `cmpVersion(package.version, live.version) === 1` (never reuse a live or older version).
2. **Current release packaged & linked:** `dist/releases/<version>/` exists and `dist/index.html` points to it.
3. **Tests passed after the last file change:** `lastTest.ok === true` AND `lastTest.endedAt >= newestChangedMtime` (excluding untouched old release folders).
4. **Cloudflare authenticated:** `wrangler === 'in'`.

- **OWNER DECISION 2 — Strict test freshness gate on Deploy:**
  - **Recommended:** Block `Publish` (`fail`) when tests have never run, failed, or any `dist/`/`tests/` file is newer than the last passing test run.
  - **Alternative:** Keep stale/missing tests as `warn` with an extra confirm dialog line.
- **OWNER DECISION 3 — Uncommitted files on Deploy:**
  - **Recommended:** Warn on uncommitted changes (Cloudflare Pages deploys the local working tree), with a link to `#commit`.
  - **Alternative:** Require `0` uncommitted changes in `Game`/`Releases` before `Publish` enables.

## 5. Order of Presses (Streamlined Flow)
1. **Build & test (`#deploy` or `#tools`):** Press **Bump** if current version is already live (raises version -> `release` -> `test`), or **Run tests** if version is unreleased (`1` press).
2. **Save to git (`#commit`):** Review the top summary chips + `Release <ver> · N files` row + suggested message; press **Commit** or **Commit & push** (`1` press).
3. **Go online (`#deploy`):** Press **Check**, then **Publish** (`2` presses, or `1` press if approved below).
- **OWNER DECISION 4 — Add a chained `Ship <ver>` button on `#deploy`?**
  - **Recommended:** Yes — once Decisions 1–2 are settled, add one `Ship <ver>` button that runs `Check` and, only if all hard gates pass, prompts once to `Publish` (never skipping the version confirm dialog).
  - **Alternative:** Keep **Check** and **Publish** as two separate presses.
