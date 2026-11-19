michadr.

# Shops Pass Diagnosis & Prep (`notes/owner-feedback-2026-11-18.md` items 3, 4, 7, 9)

## Files Created or Changed
- `dist/shop-presence.js` (created, 40 lines): pure rule module exporting `shopPresence(kind, hourFloat, hoursTable)` and `stepLightScale(current, target, dt)` with `DEFAULT_HOURS`, `LIGHT_DIM=0.2`, `LIGHT_FULL=1`, `LIGHT_RAMP_HOURS=0.25`, `LIGHT_RATE=4`.
- `tests/shop-presence.mjs` (created, 51 lines): Node `assert` tests for market/cafe hours, smooth `lightScale` ramp, frame-rate independence, and purity.
- `dist/indoor-camera.js` (changed, 25 lines): added optional `{ bounds, maxDistance, minDistance }` room ray-clamping so bounded shop rooms never clip through walls or above the ceiling while preserving cutaway behavior for houses/offices.
- `tests/indoor-camera.mjs` (changed, 26 lines): added shop-room bounds clamping assertions.
- `dist/shops.js` (changed, 32 lines):
  - Removed obsolete `doorBits` (`glass-door`, `x=±0.9` posts, `#d9c899` tan handle slab) that overlapped `exitDoor` (item 4).
  - Kept counter (`shop-counter`), shelves, tables, chairs, and register out of `occluders` so `createIndoorCamera` never marks them `transparent: true` or fades them out (item 7).
  - Set `storefront-glass` `renderOrder = 2`, `side: T.FrontSide`, `opacity: .14` (item 7).
  - Added `setLight(scale)` to dim/restore interior non-glass meshes without adding `PointLight`s (item 9).
- `tests/storefronts.mjs` (changed, 7 lines): added assertions for `doorBits.length === 0`, no `glass-door`, opaque `shop-counter` not in `occluders`, `renderOrder === 2` on glass, and `setLight`.

## Test Output
Ran targeted tests (`npm test` was not run while the WebGPU T5 agent is editing `game.js`):
```
Shop presence: market 07:00-22:00 and cafe 08:00-18:00 hide clerk/customers/cups when closed, ramp lightScale smoothly, stepLightScale is frame-rate independent, and module is pure.
Indoor camera: the walls between the camera and you fade on the upper floor too, the far wall stays, and bounded shop rooms clamp inside walls and ceiling.
Glass sightlines reveal real interiors; no leftover doorBits; counter stays solid/opaque; setLight dims/restores; café work stations are reachable.
Doors: sliding stays automatic; hinged and double doors are manual, swing into the room about their hinges, a pair mirrors, snap shuts without the swing, a handle-less leaf is one mesh; the market is sliding, the cafe and the office have double glass doors.
```

## Diagnosis Notes
- **Item 9 (Closed shops not empty) & Clerk schedule:**
  - `dist/shops.js` creates `clerk` (`shops[kind].clerk.group`), `customers`, and `usedCups`, all of which were either always visible (`clerk`) or only gated by active shift state (`updateCafeVisuals`), never by `shopOpen` / `shopPresence`.
  - Clerk schedule check (`dist/map-definition.js` lines 384-386, `dist/schedule.js` lines 44-48): `market-day` (Noah) is `[420, 870]` (07:00-14:30, leaving up to 9 min late e.g. 14:37) and `market-evening` is `[870, 1320]` (14:30-22:00, arriving 5-14 min early). There is **no schedule gap** in `MAP.posts`; the visual issue was `shops[kind].clerk.group` staying visible when the shop is closed.
- **Item 3 (Shop/diner camera):**
  - Shop rooms are `12 m` wide (`x` in `[-6, 6]`), `10 m` deep (`z` in `[-5, 5]`), `3.4 m` ceiling height, at `origin.y = 0.165`, `origin.z = -13.5` (wall thickness `0.16`, inner half-widths `5.92` and `4.92`).
  - `createIndoorCamera` previously allowed `distance = clamp(zoom, 3, 12)` and `elevation` up to `0.85` rad (`desired.y` up to `~10.3 m`), pushing the camera above the `3.4 m` ceiling into `shopShells[kind]` and outside the `12 x 10 m` walls.
  - Numbers for `game.js` shop camera bounds (with `minClearance = 0.35 m`):
    - `minX = SHOPS[kind].x - 5.57`, `maxX = SHOPS[kind].x + 5.57`
    - `minY = origin.y + 0.35` (`0.515`), `maxY = origin.y + 3.05` (`3.215`, below `3.565` ceiling)
    - `minZ = origin.z - 4.57` (`-18.07`), `maxZ = origin.z + 4.57` (`-8.93`)
    - `minDistance = 2.2`, `maxDistance = 5.5`
- **Item 4 (Leftover door stuff):**
  - `dist/shops.js` line 19 built `doorBits` (`glass-door`, two `x = ±0.9` posts, and the `#d9c899` tan handle slab at `(0.62, 1.35, 5.06)`) which `game.js` `roomDoorShown` showed inside, overlapping `exitDoor` at `z = 4.96`. Removed in `dist/shops.js`.
- **Item 7 (Counter see-through / market glass):**
  - `dist/shops.js` line 12 pushed every `y > 0` mesh (including the counter, countertop, register, shelves, tables, chairs) into `occluders`. `createIndoorCamera` cloned every occluder material with `transparent: true`, putting the counter in the Three.js transparent pass (causing sorting artifacts behind storefront glass and fading to `opacity = 0.04` when between camera and player). Fixed in `dist/shops.js`.

## EDITS FOR THE GAME.JS LANE

1. **Import `shopPresence` in `dist/game.js`**
   - File: `dist/game.js`, line `67`
   - Old:
     `import {advanceTime,clockText,shopOpen,hoursText,formatClock} from './routine.js';`
   - New:
     `import {advanceTime,clockText,shopOpen,hoursText,formatClock} from './routine.js';import {shopPresence} from './shop-presence.js';`

2. **Pass shop room `bounds` and `maxDistance`/`minDistance` to `createIndoorCamera` in `dist/game.js`**
   - File: `dist/game.js`, line `176`
   - Old:
     `const shops={market:createShop('market'),cafe:createShop('cafe')};for(const [kind,room] of Object.entries(shops)){{const {origin}=MAP.shops[kind].interior;room.scene.position.set(SHOPS[kind].x,origin.y,origin.z)}scene.add(room.scene);scene.updateMatrixWorld(true);room.camera=createIndoorCamera(camera,[...room.occluders,...shopShells[kind]]);roomDoorShown(room,false);}`
   - New:
     `const shops={market:createShop('market'),cafe:createShop('cafe')};for(const [kind,room] of Object.entries(shops)){const {origin}=MAP.shops[kind].interior;room.scene.position.set(SHOPS[kind].x,origin.y,origin.z);scene.add(room.scene);scene.updateMatrixWorld(true);room.camera=createIndoorCamera(camera,[...room.occluders,...shopShells[kind]],{minDistance:2.2,maxDistance:5.5,bounds:{minX:SHOPS[kind].x-5.57,maxX:SHOPS[kind].x+5.57,minY:origin.y+.35,maxY:origin.y+3.05,minZ:origin.z-4.57,maxZ:origin.z+4.57}});roomDoorShown(room,false);}`

3. **Start camera inside the shop on `enterShop` in `dist/game.js`**
   - File: `dist/game.js`, line `692`
   - Old:
     `function enterShop(kind,entry=SHOP_ENTRY){if(!shopOpen(kind,GameState.progress.routine)){toast(`${SHOPS[kind].name} hours: ${hoursText(kind)}`);return}persist();shop=kind;shops[kind].exitDoor.manual&&shops[kind].exitDoor.snap(false);roomDoorShown(shops[kind],true);audio.sweep('shop-bell');shops[kind].scene.add(player);setMePosition(entry.x,.02,entry.z);yaw=0;pitch=.4;camera.position.set(SHOPS[kind].x,3,-5.5);$('dialog').hidden=true;clearWorldPanel();keys.clear()}`
   - New:
     `function enterShop(kind,entry=SHOP_ENTRY){if(!shopOpen(kind,GameState.progress.routine)){toast(`${SHOPS[kind].name} hours: ${hoursText(kind)}`);return}persist();shop=kind;shops[kind].exitDoor.manual&&shops[kind].exitDoor.snap(false);roomDoorShown(shops[kind],true);audio.sweep('shop-bell');shops[kind].scene.add(player);setMePosition(entry.x,.02,entry.z);yaw=0;pitch=.4;camera.position.set(SHOPS[kind].x,2.4,MAP.shops[kind].interior.origin.z+4.2);$('dialog').hidden=true;clearWorldPanel();keys.clear()}`

4. **Hide closed-shop clerk, customers, used cups, and dim interior lights in `dist/game.js`**
   - File: `dist/game.js`, line `1557`
   - Old:
     `  const dw=MAP.shops[front.kind].doorway,open=shopOpen(front.kind,routine);front.open.visible=open;front.closed.visible=!open;`
   - New:
     `  const dw=MAP.shops[front.kind].doorway,pres=shopPresence(front.kind,routine.minutes/60,MAP.shops),open=pres.open;front.open.visible=open;front.closed.visible=!open;{const rm=shops[front.kind];rm.clerk.group.visible=pres.clerkVisible;rm.setLight(pres.lightScale);if(!pres.customersVisible)for(const c of rm.customers)c.group.visible=false;if(!pres.cupsVisible)for(const u of rm.usedCups)u.visible=false}`
   - Also in `updateCafeVisuals` (`dist/game.js`, line `1103`), gate `want` on `shopOpen('cafe', GameState.progress.routine)` so customers don't re-spawn while closed:
     - Old:
       ` for(let i=0;i<TABLES.length;i++){const cu=room.customers[i],v=dinerCust[i],tb=d?.tables[i],g=cu.group,chair=TABLES[i].chairs[0],aisle=TABLES[i].x<0?-2.3:2.3,want=!!tb&&(tb.status==='seated'||tb.status==='ordered'||tb.status==='eating');`
     - New:
       ` const cafeOpen=shopOpen('cafe',GameState.progress.routine);for(let i=0;i<TABLES.length;i++){const cu=room.customers[i],v=dinerCust[i],tb=d?.tables[i],g=cu.group,chair=TABLES[i].chairs[0],aisle=TABLES[i].x<0?-2.3:2.3,want=cafeOpen&&!!tb&&(tb.status==='seated'||tb.status==='ordered'||tb.status==='eating');`

## What Could NOT Be Verified
- Nothing was seen in a browser (no live WebGL/WebGPU render check of the storefront glass, counter opacity, camera angles, or dimmed closed interiors).
- Full `npm test` and `npm run release` were not run because the WebGPU T5 agent is concurrently editing `dist/game.js`.

## Confidence
- **Item 9 (Closed shops empty + `shop-presence.js`):** High for pure logic and tests; Medium-High for `game.js` edit spec (straightforward, verified line numbers).
- **Item 3 (Shop/diner camera):** High for `indoor-camera.js` clamping math and tests; Medium-High for feel in-browser (needs owner eyes on `maxDistance: 5.5` and `minClearance: 0.35`).
- **Item 4 (Leftover door stuff):** High — `doorBits` in `shops.js` was the exact duplicate of `exitDoor`.
- **Item 7 (Counter see-through / market glass):** High — `occluders` + `createIndoorCamera` setting `transparent = true` on the counter was the root cause.
