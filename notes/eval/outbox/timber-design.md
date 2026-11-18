michadr.

# Timber Redesign Design Report (gemini-timber-design)

Read-only design task completed. No code files were modified, no git commands were run, and neither `npm run index` nor `npm test` was executed per the prompt.

## Files Created
- `notes/timber-redesign-design.md` (191 lines, UTF-8 without BOM; under the 350-line limit, ending with 8 Owner Questions with recommended answers first).
- `notes/eval/outbox/timber-design.md` (this report).

## What Was Checked
- **Cargo, Carry & Drag:** `dist/carry.js` (`L1-122`), `dist/cargo.js` (`L1-158`), `dist/cargo-items.js` (`L1-186`), `dist/load-drag.js` (`L1-14`), `dist/cargo-view.js` (`L1-32`).
- **Forest, Tools, Skills & Economy:** `dist/grid.js` (`L1-101`), `dist/tools.js` (`L1-23`), `dist/skills.js` (`L23-35`), `dist/forest.js` (`L1-118`), `dist/plank-economy.js` (`L1-159`), `dist/world-goods.js` (`L12-61`), `dist/items.js` (`L29-35`), `dist/inventory.js` (`L93-97`).
- **Sawmill & Pile Layout:** `assets-src/assets/sawmill_spec.md` (`L1-71`), `dist/sawmill-pile.js` (`L1-54`), `dist/sawmill-yard.js` (`L1-98`), `dist/sawmill.js` (`L1-60`), `dist/map-definition.js` (`L304-557`), `notes/eval/outbox/OPUS-sawmill-pile.md` (`L1-80`), `dist/game.js` (`L432-438`, `L801`, `L1255`, `L1275`).
- **Jobs, Workforce, Starter & Needs:** `dist/shift.js` (`L1-40`), `dist/careers.js` (`L34, L87-92`), `dist/starter.js` (`L6, L20, L122`), `dist/needs.js` (`L33-92`), `dist/workforce-tick.js` (`L1-150`), `dist/workforce-pose.js` (`L4-208`), `notes/workforce-design.md` (`L13-105`).
- **Saves, Co-op, UI & Assets:** `dist/jobs.js` (`L11-70`), `dist/relay-protocol.js` (`L4-26`), `dist/talk-panel.js` (`L1-25`), `dist/item-icon.js` (`L1-16`), `dist/phone.js` (`L22-112`), `dist/nature.js` (`L36`), `dist/world.js` (`L556-565`), `ASSETS.md`, `assets-register.json`, `assets-src/` directory listing, and online CC0/Fab asset search.
- **Pinned Tests:** `tests/grid.mjs`, `tests/carry.mjs`, `tests/cargo.mjs`, `tests/cargo-items.mjs`, `tests/load-drag.mjs`, `tests/plank-economy.mjs`, `tests/skills.mjs`, `tests/forest-tasks.mjs`, `tests/talk-panel.mjs`.

## What Could Not Be Verified
- `dist/game.js`, `dist/world-tick.js`, `dist/supply.js`, and `dist/careers.js` were read while Opus W3 + P-D wiring was running (`OPUS-W3-PD.md` not yet present), so cited line numbers in those files may shift once W3 finishes.
- Exact visual clearance of the proposed Sawmill Main-deck split (Boards east vs Slabs west) and ground Trunk deck (`x = -5.5`) was checked against `sawmill_spec.md` coordinates only, not in-browser or via a 3D intersection script.
- No tests were run (read-only design task).

## Confidence
- **Data model, cargo/carry/economy & save migration:** High (all pure modules read directly).
- **Sawmill shed deck diagnosis & 3-zone layout:** High (verified `sawmill_spec.md` + `sawmill-pile.js` + `map-definition.js` `yaw: -Math.PI/2`).
- **Workforce & `game.js` line numbers:** Medium (pending final W3 edits).
- **Logging tutorial graphic & asset candidates:** High.