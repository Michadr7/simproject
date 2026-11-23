michadr.

# 0.36.4 local public package and shared bakery rules

Cloudflare returned `{"version":"0.36.2","released":"2026-11-19"}`. The local entry point and update metadata point to 0.36.4. Dev Mode is off in the public package. Compared by SHA-256 with the 0.36.3 package, the new bakery rules, the Dev Mode flag, and the version module are the three changed or new packaged files. Publishing follows the owner's manual commit and push. The Cloudflare dry run built the Worker and asset manifest locally.

## Files

- New host rules and regression test: `dist/bakery-session.js` (83 lines), `tests/bakery-session.mjs` (51).
- Public packaging: `package.json` (28), `scripts/package-release.mjs` (39), `DEPLOY.md` (61). Generated `dist/index.html` (61), `dist/version.js` (2), `dist/version.json` (1), `dist/_headers` (8), and `dist/releases/0.36.4/` (274 files, including its one-line Dev Mode flag).
- Test fixtures: `tests/support/boot-game.mjs` (41), `tests/dev.mjs` (154), `tests/dev-wipe.mjs` (19), `tests/scene-editor.mjs` (141), `tests/rescue.mjs` (38), `tests/support/mock-renderer.mjs` (93), `tests/carry-game.mjs` (108), `tests/carry-real.mjs` (83), `tests/chainsaw-game.mjs` (40), `tests/timber-game.mjs` (71).
- Navigation and handoff: `PROJECT-INDEX.md` (838), `PROJECT-BRIEF.md` (39), `notes/handoff.md` (437), and this report.

## Verification

```text
Packaged release 0.36.4: 274 files -> dist/releases/0.36.4
dist/index.html now loads releases/0.36.4/
PASS bakery-session: competing claims, cancellation, loading, payout once, and stale claim cleanup
brief tests passed: 273 modules listed, brief 2840 and index 35117 estimated tokens (budgets 3000 and 37000)
PASS eden-wholesale-place: C21 with 3 m rear alley, 8 SOLIDS colliders, public retail door, clear dock approach, ingredients and opening hours, 2928/112/14 body/window/lens triangles, windows lit 06:00-19:30 in the dark, supplier property:eden-wholesale
--dry-run: exiting now.
THREE.JS GATE: 307 of 307 passed; 26 Hub files excluded.
```

Disabling Dev Mode exposed an implicit dependency in the Node fixtures. The Dev Mode import had given the sawmill model time to decode before tests pumped synthetic frames. The carry, chainsaw, and timber fixtures now wait for that model explicitly. The rescue scenario that uses the Dev panel explicitly enables it in its temporary copy. The packaged update test passed, including save before reload and detecting a newer version.

The full `npm.cmd test` run started before the final fixture fixes. It reproduced `FAIL hub-boot.mjs` after retry with `Error: EPERM, Permission denied` cleaning up its temporary directory. It then stalled in `tests/hub-jobs.mjs` with its `slow.mjs` fixture process still running. I stopped that test process tree after the clean Three.js run finished. Logs are in `%TEMP%\eden-0364-full.log` and `%TEMP%\eden-0364-threejs-final.log`.

## Map and scope

I3 built River Street, new crossings and sidewalks, and the Bus Plaza. Wholesale has moved 3 m south and the rear alley is paved. The dock apron remains deferred. I4 commercial asset conversion is the next downtown step in the roadmap, followed by I5 property placement. The standard asset source directory has the Industrial kit and no Commercial kit directory. No map edits were needed for this release package.

## Confidence and remaining verification

- High in the package version, Dev Mode setting, update notice, and Cloudflare build dry run. Deployment and the live update still need verification after the owner's push. Hub Check currently reads the development source flag, which is on.
- High in the deterministic bakery authority checks. The action API takes time and player progress from its caller. Game and relay wiring, position checks, handoff between hosts, and a two-client browser playtest remain open. The public package retains the existing per-player co-op behavior.
- High in the map data and Wholesale placement checks. This pass did not repeat a hardware playtest or check the deferred dock apron visually.
- No protected-file edits were needed. The owner's repository instruction reserves committing and pushing for the owner.
