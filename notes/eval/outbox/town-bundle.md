michadr.

# R2 Report: Town Bundle (Shops Pass + Talk Camera + Walk-Loop Wiring + WebGPU Ground-Quality Live Rebuild)

## Files created or changed
- `dist/game.js` (1970 lines, CRLF preserved, no BOM):
  - **Item (a) Shops pass (`notes/eval/outbox/shops-pass.md`):**
    - Line `67`: imported `shopPresence` from `./shop-presence.js`.
    - Line `178`: passed `{minDistance:2.2, maxDistance:5.5, bounds:{minX:SHOPS[kind].x-5.57, maxX:SHOPS[kind].x+5.57, minY:origin.y+.35, maxY:origin.y+3.05, minZ:origin.z-4.57, maxZ:origin.z+4.57}}` to `createIndoorCamera` for `market` and `cafe`.
    - Line `694`: updated `enterShop` camera start position from `(SHOPS[kind].x, 3, -5.5)` to `(SHOPS[kind].x, 2.4, MAP.shops[kind].interior.origin.z+4.2)`.
    - Line `1105`: gated `want` in `updateCafeVisuals` on `cafeOpen = shopOpen('cafe', GameState.progress.routine)`.
    - Line `1559`: replaced `shopOpen` with `shopPresence(front.kind, routine.minutes/60, MAP.shops)` in `updateDoors`, toggling `rm.clerk.group.visible`, `rm.setLight(pres.lightScale)`, and hiding `rm.customers` / `rm.usedCups` when closed.
  - **Item (b) Talk camera (`notes/eval/outbox/talk-visual.md`):**
    - Line `1864`: raised talk midpoint `mid.y += .25` and lowered talk camera pitch from `.32` to `.26` in both `shops[shop].camera(...)` and `updateCamera(...)`.
  - **Item (c) Walk-loop wiring (`notes/eval/outbox/npc-walk-loops.md`):**
    - Line `76`: imported `{createWalkSchedule, walkLegCandidatePairs, townWalkBlocked, townWalkCost}` from `./walk-legs.js`.
    - Line `138`, `139`, `145` (**adapted — see below**): kept `npcSchedule.planOf` delegating to `npcSchedBase` for `rosterPlanner`, introduced `let npcWalkSched = rosterPlanner`, passed `planOf: (id, day) => npcWalkSched.planOf(id, day)` plus `blocked: npcWalkBlock` (`townWalkBlocked`) and `cost: npcWalkCostFn` (`townWalkCost`) to `createNpcCrowd`, and rebuilt `npcWalkSched = createWalkSchedule(rosterPlanner, npcTown, {table: npcRouteTable, seed: MAP.seed, skip: p => !!npcById(rosterByPersonId(p.id)?.id)?.homebody})` after `rosterPlanner.clear()` in `npcRoutesReady()`.
    - Line `146`: added `...walkLegCandidatePairs(npcTown.people, MAP)` to `npcWarmStart(...)`.
  - **Item (d) WebGPU ground-quality live rebuild (`notes/eval/outbox/webgpu-T6.md`):**
    - Line `88`: added `tslKit` to the `./render-backend.js` import.
    - Line `1179`: added `if(tslKit())world.rebuildGroundTSL(high);` inside `applyQuality`.
- `dist/npc-crowd.js` (130 lines, no BOM):
  - Line `7`: replaced `placePoint` import from `./population.js` with `walkPlacePoint` from `./walk-legs.js`.
  - Line `31`: switched `point` lookup from `placePoint(place, map)` to `walkPlacePoint(place, map)`.
- `dist/world.js` (654 lines, no BOM):
  - Line `218`: tracked every TSL ground material created by `groundPatch` in `tslGround` (`Map<material, {kind, base}>`).
  - Lines `567`, `569`: lifted `gmat` to `createWorld` scope so streaming chunk shared ground materials (`asphalt`, `driveway`, `path`) are also updated on rebuild.
  - Line `587`: exported `world.rebuildGroundTSL(high)` which calls `setGroundQuality(high)`, rebuilds every active TSL ground material via `makeGroundMaterialTSL` preserving `polygonOffset`/`polygonOffsetFactor`/`polygonOffsetUnits` and `name`, swaps `mesh.material` across `group` and `gmat`, disposes old materials, and returns the rebuilt count.
- `tests/shop-closed-game.mjs` (created, 67 lines, no BOM): boot-game test (`?debug&webgpu=0`) checking 03:00 closed market/cafe hide clerk/customers/cups and dim lights, 12:00 open restores clerk/lights, entering market clamps camera inside room bounds, and `__npcRoutes` warms walk-loop pairs.
- `tests/webgpu-ground-quality.mjs` (created, 73 lines, no BOM): WebGPU mock-renderer boot test verifying live `high -> low -> high` quality changes rebuild all 42 TSL ground materials, dispose all old materials, flip `groundProgramKey` (`-lo` vs high), and preserve `polygonOffset`.
- `dist/releases/0.36.0/`, `dist/index.html`, `PROJECT-BRIEF.md`, `PROJECT-INDEX.md`: updated by `npm run release -- --force` and `npm run index` (version kept at `0.36.0`, not bumped).

## Adaptation note (Item c)
- The draft edit in `notes/eval/outbox/npc-walk-loops.md` had `npcSchedule.planOf` return `npcWalkSched.planOf` *under* `rosterPlanner`. On boot, `rosterPlanner` feeds `basePlan` into `namedPlan()` (`dist/npc-life.js:175`), whose `blockOk` checks `ACTS.includes(b.act)`. Because `'pause'` is not in `schedule.js` `ACTS`, `namedPlan()` rejected walk-leg plans and returned `[]`, crashing `npc-walk.js` `presenceOf(undefined)`.
- **Adaptation:** `rosterPlanner` continues to wrap `npcSchedule` (`npcSchedBase`, which only produces `schedule.js` `ACTS`), and `npcWalkSched = createWalkSchedule(rosterPlanner, ...)` wraps `rosterPlanner` instead, feeding `npcCrowd`'s `planOf`. This keeps `namedPlan` and `knockAt` on valid `ACTS`, preserves sick/homebody/low-mood overrides before `applyWalkLegs` runs, and requires zero edits to `npc-life.js` or `schedule.js`.

## Forbidden file edits needed
- None.

## Tests and command results

### `npm run release -- --force`
```text
> city-life-local-multiplayer@0.36.0 release
> node scripts/package-release.mjs --force

Packaged release 0.36.0: 260 files -> dist/releases/0.36.0
dist/index.html now loads releases/0.36.0/
```

### New tests (`node tests/shop-closed-game.mjs`, `node tests/webgpu-ground-quality.mjs`)
```text
PASS shop-closed-game.mjs: 03:00 hides market/cafe clerk+customers+cups and dims lights; 12:00 restores clerk+lights; market camera clamped inside room; __npcRoutes warmed 232 pairs.
PASS webgpu-ground-quality.mjs: live high->low->high rebuilt 42 TSL ground materials (42 meshes), disposed old materials, updated groundProgramKey, and preserved polygonOffset.
```

### `npm run index` and `node tests/brief.mjs`
```text
> city-life-local-multiplayer@0.36.0 index
> node scripts/build-index.mjs

brief 2834 tokens (target 3000), index 34459 tokens (target 37000); 259 modules, 14 generated, 314 tests, 31 scripts; 13 modules without a header comment
brief tests passed: 259 modules listed, brief 2834 and index 34459 estimated tokens (budgets 3000 and 37000)
```

### Full `npm test` summary
```text
ALL 314 PASSED
All 314 test files passed.
```
(Including `shop-closed-game.mjs`, `webgpu-ground-quality.mjs`, `webgpu-flag.mjs`, `shop-presence.mjs`, `storefronts.mjs`, `indoor-camera.mjs`, `walk-legs.mjs`, `npc-walk.mjs`, `npc-crowd-separation.mjs`, `talk-game.mjs`, `no-pause.mjs`, `brief.mjs`.)

## What could NOT be verified
- Nothing was seen or played in a live browser (all tests ran in Node with the synthetic DOM and mock renderer).
- Visual feel of the shop camera clamping (`maxDistance: 5.5`), dimmed closed-shop interiors through storefront glass, talk camera framing (`mid.y += .25`, `pitch = .26`) over `#talk`, Alex/Malik walk loops in live town traffic, and live WebGPU shader recompilation / frame hitch on ground quality toggle need eye-checking in a browser.

## Confidence
- **Item (a) Shops pass wiring:** High for logic and integration (`shop-closed-game.mjs`, `shop-presence.mjs`, `storefronts.mjs`, `indoor-camera.mjs` all pass); Medium for live camera feel until seen in a browser.
- **Item (b) Talk camera:** High that the exact offset landed; Medium for framing until seen over the live 3D scene and `#talk` panel.
- **Item (c) Walk-loop wiring:** High (`walk-legs.mjs`, `npc-walk.mjs`, `npc-crowd-separation.mjs`, `shop-closed-game.mjs` warming 232 pairs, and all 314 tests pass after fixing the `rosterPlanner` / `namedPlan` wrapping order).
- **Item (d) WebGPU ground-quality live rebuild:** High in Node (`webgpu-ground-quality.mjs` proves all 42 TSL ground materials rebuild, dispose old materials, flip `groundProgramKey`, and keep `polygonOffset`); Medium-High for live WebGPU GPU pipeline compilation until toggled in a browser.

## QUESTIONS FOR THE OWNER
1. `dist/game.js` line 103's startup `console.info` still says `"the ground keeps the quality it was built with until a reload"` — want that log message updated in the next `game.js` run now that `world.rebuildGroundTSL` applies quality live?
2. Should `dist/npc-life.js`'s `blockOk` stay untouched (since wrapping `createWalkSchedule` outside `rosterPlanner` keeps `namedPlan` cleanly on `schedule.js` `ACTS`), or should `'pause'` also be accepted by `npc-life.js` later?
