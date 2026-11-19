michadr.

# R1 Report: Talking to NPCs Never Pauses Time (`no-pause`)

## Files created or changed
- `dist/game.js` (1970 lines, CRLF preserved, no BOM):
  - Added `dialogTalking` flag (line 484), cleared in `clearWorldPanel()` (line 502), and set in `showWorld()` (line 708).
  - Updated `stepWorld()` time/world block (line 1828) and `updateCafeVisuals(step)` (line 1833), `updateWork()` autosave (line 1141), and `updateDoors()` (line 1554) to continue running when `active && (!modal || dialogTalking) && !document.hidden` (while movement, driving, forklift, look, hotkeys, and door triggers still check `!modal`).
  - Extracted shared walk-away / disappear / shop-close / vehicle-hit rules (`crowdSlotId`, `roomOpen`, `actorShown`, `actorGone`, `vehicleHit`, `talkGone`, `worldPanelFrame`) at line 620, wired into both `talkFrame()` (line 621) and `updateWorldUI()` (line 1055), and stored `{from, shop, inside, slotId}` on both `talkNow` (line 603) and `worldPanel` (line 708).
  - Closed `talkPanel` if open on `openCreator()` (line 1230), `startPassOut()` (line 1675), and `startSleep()` (line 1701).
- `tests/no-pause.mjs` (142 lines, no BOM): new `bootGame` integration test covering `showWorld` / `#dialog` families, `#talk`, walk-away/speaker-gone/shop-close/vehicle-hit auto-close, and blocking-modal pauses.
- `dist/releases/0.35.22/`, `dist/index.html`, `PROJECT-BRIEF.md`, `PROJECT-INDEX.md`: updated by `npm run release -- --force` and `npm run index` (version kept at `0.35.22`, not bumped).

## Forbidden file edits needed
- None for R1.

## Every `modal` use in `dist/game.js`
- `484`: `let ... modal=false, dialogTalking=false` and `keys=createMovementInput(..., ()=>active&&!modal&&!creatorOpen&&!actionBusy()&&!talking())` — movement keys stay locked while `modal` is true (including `dialogTalking`).
- `503`: `pause(show)` — sets `modal=show`, closes `talkPanel`, phone, inventory, store, and `#dialog` (`clearWorldPanel()` clears `dialogTalking`). Pauses time.
- `541`: `petTick()` — `if(inside&&!catNow.asked&&!modal&&!talking())petOffer()` — prevents adoption modal from interrupting any open dialog/modal.
- `606`: `talkWith()` — closes any open `#dialog`, calls `clearWorldPanel()`, sets `modal=false`.
- `667`: `showDialog()` — sets `modal=true`, releases look, clears keys (`dialogTalking` stays `false` unless `showWorld()` sets it).
- `275, 512, 673, 677, 686, 699, 754, 1168`: `#dialog` close paths (`closeWorldDialog`, `#closeDialog`, `finishJob`, `enterHome`, `changeHousing`, `useLife`, `marketMenu` View items for sale, `Escape`) — hide `#dialog`, call `clearWorldPanel()` (`dialogTalking=false`), set `modal=false`.
- `944, 967`: `canTick()`, `fuelTick()` — guard `!modal`, so holding F to fuel does not run during any dialog/modal.
- `984`: `interact()` — guards `!modal`, so E/H/C do not trigger while a dialog/modal is open.
- `1052, 1053`: `updateWorldUI()` — hides tree highlight and `#prompt` while `modal` is true.
- `1126, 1130, 1139`: `updateWork()` — hides `#prompt` while `modal` is true.
- `1141`: `updateWork()` — outdoor autosave updated to `active&&(!modal||dialogTalking)` so autosave keeps ticking during `dialogTalking`.
- `1151`: `keydown` consuming — `Escape` toggles `pause(!modal)`.
- `1152-1156`: `keydown` (`KeyO`, `KeyG`, `LIGHT_KEY`, `KeyX`, `Digit1-6`) — guard `!modal` so hotkeys/hotbar are locked during dialogs.
- `1168`: `keydown` (`Escape`, `KeyE`, `KeyF`, `KeyH`, `KeyN`, `KeyC`) — `Escape` closes `#dialog` first; action keys guard `!modal`.
- `1169`: `blur` — auto-pauses only when `!modal`.
- `1172, 1175, 1177`: `mousedown`, `look`, `wheel` — guard `!modal` so mouse-look/zoom/click-interact stay locked.
- `1230, 1237`: `openCreator()`, `closeCreator()` — character creator sets `modal=true` / `false`. Pauses time.
- `1259`: `openLoggingTutorial()` — sets `modal=true`, drops `modal=false` on close. Pauses time.
- `1311, 1317`: `updateChop()` — guards `!modal`.
- `1451`: `hotbarUse()` — guards `!modal`.
- `1483, 1486`: `updateZones()` — grid highlight and chainsaw idle audio guard `!modal`. (`world.update`, `advanceWindClock`, `sawmillCtl.update`, `tickSawYard`, `minimap.update` already run every frame.)
- `1498`: `updateConsumption()` — guards `!modal`.
- `1507-1527`: `inventoryUI`, `storeUI`, `cargoUI`, `phone` — `canOpen` guards `!modal`; `onOpen` sets `modal=true` (`clearWorldPanel()` clears `dialogTalking`); `onClose` sets `modal=false`. All pause time.
- `1546, 1548`: `startDoorFade()`, `updateDoorFade()` — guard `!modal` so a door fade waits behind a blocking modal.
- `1554, 1557`: `updateDoors()` — updated early return to `if(modal&&!dialogTalking)return;` so shop doors/signs update if a shop closes during `dialogTalking`, while `ready` (line 1557) still checks `!modal` so no doorway teleport triggers.
- `1617`: `updateRing()` — hides work progress ring while `modal` is true.
- `1675, 1696, 1700, 1710`: `startPassOut()`, `updatePassOut()`, `startSleep()`, `updateSleep()` — set `modal=true` / `false` (both now close `talkPanel` and `#dialog`). Pause time.
- `1818, 1822, 1823, 1826`: `forkSound()`, `stepWorld()` fork/driving/walking — guard `!modal` so walking, driving, and forklift controls stay locked.
- `1828, 1833`: `stepWorld()` time/world block (`sessionStep`, `worldDayPassed`, `tickLife`, `passOut` check, `tickContract`, `storyTick`, `petTick`, `garageTick`, `npcCrowd.update`, `hal.update`, `regrowClock`/`tickRegrowth`, indoor `saveElapsed`) and `updateCafeVisuals(step)` — updated to `active&&(!modal||dialogTalking)&&!document.hidden`.
- `1869`: `frame()` — `updateEquipped(modal?0:view)`, `updateDock(modal?0:view)`, `avatar.update(modal?0:view)`, `clerk.update(modal?0:view)`, and vehicle exhaust/spray/driveFx keep `modal` so avatar/walk/camera updates still respect `modal`.
- `1935`: `dev` teleport — blocked while `modal` is true.

## Which dialogs keep time running vs pause time
- **Keep time, needs, world tick, crowd, vehicles, and shift clock running (walking/actions locked):**
  - Docked `#talk` panel (`talkWith`: Noah, Elena, Walt, Hal, and any cast NPC).
  - All in-world `#dialog.in-world` (`showWorld` / `speak` / `station`): Noah fallback (`marketMenu`), Noah route/gig board (`marketWork`), `skipChoice`, Elena fallback (`managerMenu`), employer office menus (`ownerMenu`, `interview`, `promotionTalk`, `companyStore`, `noticeBoard`), warehouse `orderTable` / `orderDetail`, Hal fallback (`talkHal`, `halChoice`), street pedestrians/crowd (`talkCrowd`, `talkNamed`), apartment buzzer (`buzzerPanel`, `knockAt`), parcel door greeting (`gigDoor`), repair shop (`garageMenu`), delivery box, kitchen, bed prompt, Studio 2B listing, locked house doors, parked car inspect.
- **Still pause time and the world:**
  - Pause / Controls / Settings / Credits (`pause`), Phone (`phone`), Inventory (`inventoryUI`), Market Store (`storeUI`), Cargo UI (`cargoUI`), Character Creator (`openCreator`), Logging Guide (`openLoggingTutorial`), Pass-out (`startPassOut`), Sleep (`startSleep`), Animal Shelter phone adoption popup (`petOffer` via `showDialog`), Weekly Bills popup (`showBills` via `showDialog`).

## Tests and command results

### `node tests/no-pause.mjs`
```
ground cover models not loaded ReferenceError: Image is not defined
    at makeAtlas (file:///C:/Users/Michael/AppData/Local/Temp/city-boot-t0HJKO/ground-cover-view.js:30:34)
    at Object.setAssets (file:///C:/Users/Michael/AppData/Local/Temp/city-boot-t0HJKO/ground-cover-view.js:55:31)
    at file:///C:/Users/Michael/AppData/Local/Temp/city-boot-t0HJKO/world.js:579:45
[map-bake] base base 82.7 ms
PASS no-pause.mjs: Noah route offer/fallback, Ridgeline store/ownerMenu/orderTable, buzzer, Hal fallback all keep clock and needs running with walking locked; shop-close, walk-away, speaker-disappear and vehicle-hit close talk cleanly; pause and bills modals still freeze time.
```

### `npm run release -- --force`
```
> city-life-local-multiplayer@0.35.22 release
> node scripts/package-release.mjs --force

Packaged release 0.35.22: 259 files -> dist/releases/0.35.22
dist/index.html now loads releases/0.35.22/
```

### `npm run index` and `node tests/brief.mjs`
```
> city-life-local-multiplayer@0.35.22 index
> node scripts/build-index.mjs

brief 2834 tokens (target 3000), index 36438 tokens (target 37000); 258 modules, 14 generated, 311 tests, 31 scripts; 13 modules without a header comment
brief tests passed: 258 modules listed, brief 2834 and index 36438 estimated tokens (budgets 3000 and 37000)
```

### `npm test`
```
ALL 311 PASSED
All 311 test files passed.
```
(Including `PASS no-pause.mjs` and `PASS talk-game.mjs`.)

## What could NOT be verified
- Nothing was seen or played in a live browser (all tests ran in Node with the synthetic DOM and mock renderer).
- Live two-client multiplayer `sessionStep` under `dialogTalking` was checked by reading `sessionStep()` in `dist/game.js`, not with two live relay clients.

## QUESTIONS FOR THE OWNER
1. `petOffer` (`PHONE · ANIMAL SHELTER`) and `showBills` (`HOME / WEEK ...`) call `showDialog` directly rather than `showWorld`, so both currently still pause time like the phone/store modals. Should either of those also keep time running, or stay paused?
2. During `showWorld` (`dialogTalking = true`), `shops[shop].clerk.update` still receives `0` (`modal ? 0 : view`) like the player avatar. Should clerks keep idle-animating during `dialogTalking` (matching `#talk`), or stay still?

## Confidence
- `dialogTalking` frame-loop gate & modal split: high (all 311 test files pass, including `no-pause.mjs`, `talk-game.mjs`, `office-game.mjs`, `startup.mjs`, `tickets-game.mjs`, `orders-game.mjs`, `pet-game.mjs`).
- Walk-away / speaker-disappears / shop-close / vehicle-hit close rules: high in Node simulation (`no-pause.mjs` covers walk-away, shop-close on both `#talk` and `#dialog`, Hal disappearing on both `#talk` and `#dialog`, and vehicle overlap); `npcCrowd` pooled slot disappearance in a live crowd was checked by code inspection of `npc-crowd.js` and `game.js`.
- Multiplayer `sessionStep` parity: medium-high by inspection (`sessionStep` runs inside the same `active && (!modal || dialogTalking) && !document.hidden` gate as normal walking and `#talk`), not tested with two live peers.