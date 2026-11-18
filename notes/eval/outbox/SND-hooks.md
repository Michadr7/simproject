michadr.

# SND-hooks: remaining game.js sound calls

Only dist/game.js (CRLF kept, no BOM, every anchor matched exactly once by a Replace helper) and tests/sweep-sounds.mjs were edited. Version 0.35.20 not bumped.

## Hooked (function: sound)
- perkText wrapper (import line): level-up whenever a skill level-up message is built (4 lumberjack sites); promoteAct: level-up.
- Doors: leaveHomeSwing door-open; enterHome door-close; exitDoorOffer (shop/office hand door toggle) door-open or door-close from toggle()'s return, replacing audio.click. Shop bell untouched. The auto sliding shop front door is not hooked (bell covers it).
- Money, cash-register: store onBuy (success only), buyAtLot, changeHousing rent and pay bills, commitCafe order, lifeAct meal. coins-pay: collectAct, jobAct deliver (paid), shiftEnded (stub total > 0), commitCafe clockout, both gig-complete toasts, world-need delivery toast, the two warehouse plank "Paid" notices (290, 375 area) and the vehicle plank delivery payout.
- Life: eat-bite in updateConsumption (food) and lifeAct meal; sleep-chime in updateSleep after waking; breath-tired (8 s cooldown, breathTired helper) when moving with Shift held and needsEffects(life).canRun is false.
- Fuel: both audio.click calls (take nozzle, hangNozzle) now audio.sweep('fuel-nozzle', pump.use, me.position).
- Vehicles: car-door-open at the start of enterVehicle (not on the go=true re-entry), car-door-close once seated and on exitVehicle after leave; car-horn on KeyN while driving.driving (KeyN is unused everywhere in dist; KeyH is interact); brake-squeal (1.5 s cooldown) when Space is held above 6 m/s.
- Forklift: forkSound() at the end of stepWorld, one reused object, called only while fork.on and once more after getting off so the loops fade. raise = R minus F.

## Skipped
- Nothing skipped outright. Not hooked: the sliding shop front door (bell exists), gate/tailgate click (not in the list), per-cent ticks.

## Tests (real output)
- node tests/sweep-sounds.mjs: PASS sweep-sounds.mjs: ... (new source scan: every audio.sweep name in game.js is in SWEEP_SHOTS and the 16 hooked names plus audio.forklift are present).
- npm run index: brief 2834 tokens (target 3000), index 33032 tokens (target 34000).
- npm run release -- --force: Packaged release 0.35.20: 229 files.
- npm test: ALL 281 PASSED. All 281 test files passed.

## Ear-check list
Door open/close at home and at a shop hand door; cash register on market buy, rent, bills, cafe order; coins on shift end, gig/delivery pay, Walt collect; level-up on a log chop level and a promotion; eat a sandwich (bite) and sleep (chime); sprint with zero stamina (breath, not more than every 8 s); fuel nozzle take and hang; enter car (open then close), exit (close), N horn, Space at speed (squeal, 1.5 s apart); forklift reverse beep and R/F whine, and silence after getting off.

## Not verified / confidence
Nothing was listened to or run in a browser; only tests. Possible double sounds: lifeAct meal plays bite and register together (intended); enterVehicle plays open then close back to back when the vehicle has no door animation. enterHome's door-close also fires when a saved game restores inside a house (silent until audio is unlocked). Confidence: high for syntax and wiring (node --check and 281 tests), medium for feel. The perkText wrapper depends on perkText being called only for level-up messages (true for all 4 current uses).