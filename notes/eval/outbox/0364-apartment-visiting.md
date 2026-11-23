michadr.

# 0364 · Oak Street Hallways, Schedule-Aware Knocking & Indoor Talk Camera Fix

## Files Created or Changed (with line counts)
- `dist/apartment-visits.js` (103 lines) — Added `OAK_FLOORS` (`[2, 3, 4]`), `STUDIO_DOOR_X` (`3.0`), `personId`/`floor`/`doorX` metadata on `OAK_UNITS`, `unitsOnFloor(floor)`, `floorLabel(floor)`, `hallwayKnockOutcome(unit, progress, plan)` (`"There's nobody home."` when away, asleep/sick handling, open-door when home & awake), and fixed `oakElevatorUnits` to look up schedules by `planOf(u.personId, day) || planOf(u.id, day)`.
- `dist/apartment-lobby.js` (202 lines) — Added `HALLWAY_ORIGIN`, `HALLWAY_ENTRY`, `HALLWAY_ELEVATOR`, and `createApartmentHallway(floor)` with 3D corridor geometry, carpet runner, sconces, elevator alcove, numbered unit doors (plus Studio 2B on Floor 2), headless-safe canvas door plaques, reusable doorway NPC avatar (`doorNpc`), `showDoorNpc`/`hideDoorNpc`, `occluders`, `blocked`, and `storey: floor` (following earlier `f-desk-chair` move to `-2.35, -3.95, -0.5` clear of concierge).
- `dist/game.js` (2633 lines) — Added `ensureHallway(floor)` + bounded indoor cameras on `oakLobby`, `hallwayHomes`, and `hotelLobby`; fixed indoor `talkActor` camera branch in `frame()` to stay inside `(home.camera || indoorCamera)` instead of outdoor `updateCamera`; added `findCast(who)` checking `castOf` + `OAK_CAST` (leaving `dist/cast.js` untouched); updated `enterHome`/`leaveHome`/`talkClosed`/HUD prompts/`startSleep`/`currentRoom`/`roomScene`/`petTick`; replaced flat-menu elevator directory with real Floor 2–4 hallway elevator rides and `knockHallwayDoor(door)` using live `npcWalkSched.planOf(unit.personId, day)`.
- `tests/apartment-visits.mjs` (61 lines) — Added tests for `OAK_FLOORS`, `unitsOnFloor(2/3/4)`, `floorLabel`, `personId` schedule status lookup, and `hallwayKnockOutcome` (away, asleep, home, sick).
- `tests/apartment-lobby.mjs` (39 lines) — Added tests for `createApartmentHallway(2/3/4)` scene creation, door layout, `occluders`, door/wall/elevator colliders, and `showDoorNpc`/`hideDoorNpc`.
- `tests/startup.mjs` (241 lines) — Added Floor 3 hallway end-to-end check in the existing-save run: Lobby elevator -> `OAK STREET · FLOOR 3`, Unit 8 Noah knock (`"There's nobody home."`), Unit 9 Oscar knock (`Oscar Masic` `#talk` + bounded camera inside hallway walls), and elevator return to `OAK STREET LOBBY`.
- `notes/handoff.md` (476 lines) — Added dated `0.36.4` entry documenting hallway visiting, knocking, and indoor camera fix.

## Verification & Command Output
- `node tests/apartment-visits.mjs`:
  `PASS apartment-visits: 6 Oak Street NPC units, residential floors, personId schedule status, hallway knock outcomes, and co-op units verified`
- `node tests/apartment-lobby.mjs`:
  `PASS apartment-lobby: lobby & residential hallway floors 2-4, doors, occluders, colliders, and doorway NPC verified`
- `node tests/startup.mjs`:
  `Fresh save: creator, phone apps/controls/gigs, and multiplayer frame checks passed.`
  `Existing save: gameplay, phone apps/controls/gigs, and multiplayer frame checks passed.`
- `npm.cmd run index; node tests/brief.mjs`:
  `brief 2840 tokens (target 3000), index 32295 tokens (target 37000); 295 modules, 15 generated, 353 tests, 34 scripts; 13 modules without a header comment`
  `brief tests passed: 295 modules listed, brief 2840 and index 32295 estimated tokens (budgets 3000 and 37000)`
- `npm.cmd run release -- --force`:
  `Packaged release 0.36.4: 296 files -> dist/releases/0.36.4`
  `dist/index.html now loads releases/0.36.4/`
- `npm.cmd test`:
  `FAILED FILES: hub-runner.mjs`
  `1 of 353 test files failed.` (`352/353` PASS across the full suite; includes `talk-cast.mjs`, `talk-cast-oak.mjs`, `talk-game.mjs`, `npc-dialogue.mjs`, `no-pause.mjs`, `apartment-lobby.mjs`, `apartment-visits.mjs`, `startup.mjs`).
- Single retry `node tests/hub-runner.mjs`:
  Failed on pre-existing Hub gauge polling check (`AssertionError [ERR_ASSERTION]: stopped near the 97 line: 900000` at `tests/hub-runner.mjs:125:41`; untouched per `AGENTS.md`).

## What Could Not Be Verified
- Live GPU browser rendering & visual lighting/framing inside `Oak Street Lobby` and Floors 2–4 hallways (Chrome DevTools remote debugging is unavailable in this sandbox; requires owner browser GPU eye-check).

## Requests / Forbidden Edits Needed
- None.

## Confidence Per Part
- **High:** Schedule-aware door-knocking rules (`dist/apartment-visits.js`), `personId` schedule lookup fix, 3D hallway collision/door geometry (`dist/apartment-lobby.js`), bounded indoor talk camera math (`dist/game.js`), and Node integration coverage (`tests/apartment-visits.mjs`, `tests/apartment-lobby.mjs`, `tests/startup.mjs`).
- **Medium:** Live visual look of hallway door plaques, sconce lighting, and door swing framing under WebGPU/WebGL until verified visually in the browser by the owner.
