michadr.

# PET3 prep report

## Files created or changed
- [dist/pet-view.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/pet-view.js) (282 lines, no BOM): pure ES module (imports only from `dist/pets.js`; no DOM, no three.js, no globals, no `Date.now`/`Math.random`) exporting:
  - Constants: `CLIP_IDS`, `CLIP_LOOP`, `VARIETY_CLIPS`, `VARIETY_MINUTES`, `DEFAULT_BLEND`, `BLEND_TIMES`, `CAT_RADIUS`, `COORD_MAX`
  - `clipFor(pet, nowMinutes, ctx)`: maps `pets.js` state (`eat` for `EAT_MINUTES` after a real meal, `pet` for `PURR_MINUTES` after a pat, `Meow` or `walk` when `hungry`/`starving` overriding sleep, `sleep` during `23:00-06:00`, `walk`/`Run` when moving, otherwise deterministic variety among `idle`/`Sit`/`Sit_Groom`/`Stretch` from `ctx.seed` and `VARIETY_MINUTES` bucket) -> `{clip, loop, speed}`.
  - `nextWaypoint(roomBounds, seed, step, avoid)` and `blendTime(fromClip, toClip)`: deterministic room waypoint planner supporting `{x0,x1,z0,z1}`, `{minX,maxX,minZ,maxZ}`, `{W,D}`, `{width,depth}`, `{hw,hd}` bounds and obstacle rectangles (`{x0,x1,z0,z1}`, `{x,z,hx,hz}`, `{x,z,w,d}`) with padded sampling + grid fallback, plus crossfade `BLEND_TIMES` table.
  - `petSnapshot(pet, extra)` and `applyPetSnapshot(snapshot)`: compact `{name, homeId, clip, x, z, yaw}` snapshot with strict validation (`null` on bad inputs/missing fields/unknown clips/non-finite numbers, `name` cleaned & trimmed to `NAME_MAX`, `x`/`z` clamped to `[-COORD_MAX, COORD_MAX]`, `yaw` wrapped to `[-Math.PI, Math.PI]`).
  - `interiorSpawn(homeId, layout)`: deterministic `{x, z, floor, yaw}` spawn from free-point lists, `houseLayout()` objects, or built-in `'studio'` / default safe points.
- [tests/pet-view.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/pet-view.mjs) (186 lines, no BOM): covers `clipFor`, `nextWaypoint`, `blendTime`, `petSnapshot`/`applyPetSnapshot`, `interiorSpawn`, and module purity.
- [PROJECT-INDEX.md](file:///c:/Users/Michael/Documents/Projects/simproject/PROJECT-INDEX.md) and [PROJECT-BRIEF.md](file:///c:/Users/Michael/Documents/Projects/simproject/PROJECT-BRIEF.md): regenerated via `npm run index`.

## Tests and checks run (real output)
`node tests/pet-view.mjs; node tests/pets.mjs`:
```
PASS pet-view: clipFor variety/sleep/hunger, nextWaypoint bounds/furniture, blendTime, petSnapshot validation, interiorSpawn, purity.
PASS pets: offer, hunger, feed, pat, tick, run-away, normalise, rehome, mood
```

`npm run index`:
```
> city-life-local-multiplayer@0.35.20 index
> node scripts/build-index.mjs

brief 2834 tokens (target 3000), index 33559 tokens (target 34000); 231 modules, 14 generated, 288 tests, 30 scripts; 13 modules without a header comment
```

`node tests/brief.mjs`:
```
brief tests passed: 231 modules listed, brief 2834 and index 33559 estimated tokens (budgets 3000 and 34000)
```

## What I could NOT verify
- Full `npm run release -- --force` and full `npm test` suite (288 files) were not run because this prep stage only adds new pure files (`dist/pet-view.js`, `tests/pet-view.mjs`) without touching `game.js` or packaged release wiring.
- Live Three.js `AnimationMixer` crossfading and GLB playback of `assets-src/cat/cat_v2.glb` in a browser (deferred to PET3 Opus wiring).

## Requested edits to forbidden / shared files (none made)
None required for `dist/pets.js` (all needed constants and `hungerOf` are already exported). Later, during PET3 wiring (not part of this prep stage):
- `dist/game.js`: import `{clipFor, blendTime, nextWaypoint, petSnapshot, applyPetSnapshot, interiorSpawn}` from `./pet-view.js`, pass `collidersOf(layout, 0)` in `{...layout, colliders}` to `interiorSpawn`/`nextWaypoint` for houses (or studio collider list for `'studio'`).
- `dist/relay-protocol.js` / `dist/multiplayer.js`: when adding co-op cat sync, validate incoming `pet` snapshots with `applyPetSnapshot(msg.pet)` from `./pet-view.js`.

## Confidence per part
- `clipFor`: High — tested all `pets.js` state branches, seed determinism, same-minute stability, sleep window boundaries, and hunger override.
- `nextWaypoint` & `blendTime`: High — tested bounds, obstacle shapes, tight-room fallback, fully-blocked `null`, and `BLEND_TIMES` validity.
- `petSnapshot` & `applyPetSnapshot`: High — tested round-trip, `NAME_MAX` trimming, coordinate clamping, yaw wrapping, and 16 garbage shapes.
- `interiorSpawn`: High — tested `'studio'`, explicit free-point lists, and real `houseLayout('house-a')` with `collidersOf()`.
