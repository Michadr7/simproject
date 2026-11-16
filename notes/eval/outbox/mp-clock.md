michadr.

# MP-CLOCK: joiners use the host's game clock (report)

## Result
Built and tested in Node. Nothing was seen in a browser, and I could not run two real browser clients. `npm test` passed 228 of 228 twice. Neither run printed FAILED FILES or PASSED ON RETRY. The index is 27497 tokens against the 32500 cap, and the brief is 2996 of 3000.

## How host and joiner are decided
- There was no host concept before. The relay lobby (dist/relay-protocol.js createLobby) is shared by server.js and worker/lobby.js.
- The host is now the oldest player still in the lobby, which means the first client that joined or created it. Map order is join order, and it is kept after a Durable Object restore.
- `welcome` now carries `host: <id>`.
- When the host leaves, the relay broadcasts `{type:'host', id}` for the next oldest player.
- PROTOCOL is still 1. Old clients ignore the new messages. A new client on an old relay gets no host id and treats itself as host, so it stays local.

## Protocol
- Host to relay: `{type:'clock', day, minutes}`. The day must be an integer from 1 to 100000 and the minutes finite, at least 0 and under 1440.
- The relay drops it unless it comes from the host, is valid, and is at least 0.5 s after the last one. It then relays `{type:'clock', day, minutes}` to the others.
- The relay keeps the host's latest clock. A joiner is sent it at once, aged by the real seconds since at 0.5 game minutes per second, so a join does not wait for the 30 s broadcast.
- The host client also forces a send when someone joins or when it becomes host.
- Client side (dist/multiplayer.js): `hostId`, `isHost`, `sendClock()`, and the events `host` and `clock`. Clocks reach the game only if valid and not from itself.

## Session clock (new, pure: dist/session-clock.js)
- `makeSessionClock()` has `day`, `minutes`, `abs`, `now()`, `mode` ('local', 'visit' or 'sync'), `isHost`, `following`, `savedClockMoves`, `setLocal`, `advance(dt)`, `receiveHost(msg)`, `dueBroadcast(dt, force)` and `hostMessage()`.
- Reads return one shared mutated object and getters, so nothing is allocated per frame.
- This is the single session time getter for sky, HUD and the future weatherAt(x, z, sessionClock.abs).
- Alone or as host, it mirrors the saved clock (`setLocal` runs every stepWorld).
- As a joiner it runs at the same rate as the host. The first host message snaps it. Later drift is eased exponentially, with a time constant of about 2 game minutes.
- The easing is capped at 2 game minutes per real second of catch-up. The clock never runs backwards; if it is ahead it only slows.
- A drift over 15 game minutes snaps once. Easing it would freeze or race the clock for many seconds.
- Messages older than the last host message, and junk, are ignored. A host never follows anyone. A new host starts a fresh sequence.
- Sync is blocked (button disabled, with a note) when the host's day is earlier than the save. It would turn the calendar back, so that player can only visit.

## game.js changes
- Edited by single-line anchors with .Replace(), each checked. `node --check` passed.
- All hooks sit on the existing code; see the stepWorld and sky hooks below.
- Import and `const sessionClock` on the multiplayer import line.
- stepWorld: `advanceTime(GameState.progress,step*.5)` became `sessionStep(step)`.
  - Local: same as before, then `setLocal`.
  - Visit: returns the same save object, so nothing day-based moves.
  - Sync: advances the save by (session minus save) only when that is positive, using advanceTime, so rent and housing days run properly.
- Sky: `sky.update` reads the session minutes while following.
- HUD (clockStatus and clockChip): uses hudDay() and hudMinutes(), plus " · Visiting" in visit mode. These are hoisted function declarations to avoid a TDZ.
- Wiring block before the Main menu line: join dialog logic and the host, clock, onPlayerJoined and onDisconnected handlers. On disconnect the clock resets to local.
- updateMultiplayer: a single `dueBroadcast` line that sends the host clock every 30 s, and at once on a join or promotion.
- The dialog opens when the first host clock arrives, so the host time can be shown.
- Until the player chooses, the mode is 'visit', which is the safe default.
- The choice is kept per rejoin URL for the session only. A reconnect to the same lobby re-applies it without asking again.
- A player promoted to host keeps its mode. In visit mode the saved clock stays frozen while it broadcasts the session clock.

## Join dialog (dist/index.html, style.css)
- Section `#clockChoice`, built on the existing `.veil` and `.dialog` classes.
- Step 1: "Whose clock?", the host time, "Just visit" (default focus) with its note, and "Sync to the host" (disabled with a note if the host's day is earlier).
- Step 2, after choosing sync: the confirm text, "Sync my save" or "Back". Esc means visit from step 1 and back from step 2.
- The text is `SYNC_WARNING` in session-clock.js: crops grow, rent may fall due, the cat can go hungry, gig timers run. It adds "About N game hours will pass for you." when 60 or more game minutes would pass.

## Sleep online (found, kept consistent)
- sleep.js already does nothing to the clock online: `sleepThrough` and `passOutThrough` with `online:true` restore energy only, and pass-out holds a 60 s black screen instead.
- game.js passes `multiplayer.online` to both, so neither a joiner nor the host can skip the shared clock by sleeping. No change was needed.
- Not gated: the cafe shift (advanceTime 10 or 15 game minutes per action, cafe-job.js) and the bog pull (garage.js, hours) still call advanceTime on the saved clock.
  - In sync mode this is absorbed, because the save only moves forward.
  - In visit mode those few minutes still count on the saved clock. They are rare. Gating them means a `sessionClock.savedClockMoves` check at each call site.

## Day-based systems paused in visit mode
All of these read the saved clock (housing.day and routine.minutes), and visit never advances it. Rent and housing days, property and ownership days, and the cafe order and parcel day clock all run through advanceTime, which is not called in visit mode. The other four are:
1. Crops, stumps and replant (nowM in game.js, grid.js).
2. Pet hunger (pets.js takes gameMinutes(p)).
3. Gig expiry and timers (gigs.js).
4. Shift day.

Could not gate, or side effects to know:
- Shop and office opening hours (shopOpen, officeOpen, market pickup) use the frozen saved minutes, not the host's. A visitor who joins at night can find shops stuck closed. Fix: make shopOpen and officeOpen read hudMinutes() while visiting.
- Pedestrian and NPC schedules use the saved clock too, so a visitor sees NPCs on their own time, not the host's. This is not gated.
- Night lights use the sky's day/night state, which already follows the session clock.
- Life (hunger, thirst, energy) drains in real time and keeps running in visit mode. It is not day-based, so I left it.

## Tests (real output)
- `node tests/session-clock.mjs`: PASS session-clock: validation, join snap, same-rate run, drift easing (no jumps, converges, never backwards), 30 s broadcast, visit vs sync, relay host rules
- `node tests/mp-clock.mjs` (real relay server and real WebSocket clients on localhost, a new test): PASS mp-clock: real relay and clients: host is the first player, a join gets the host time at once, only the host can send a clock, junk is not relayed, the next oldest player becomes host
- Updated tests/relay-protocol.mjs for the welcome `host` field and the `host` message after a host leaves. It passed afterwards.
- `npm run release -- --force`: Packaged release 0.35.9: 184 files.
- `npm test`, both runs: ALL 228 PASSED / All 228 test files passed. No retries. The first run was with the index regenerated just before; the second after the final `npm run index`.
- `npm run index`: brief 2996 tokens (target 3000), index 27497 tokens (target 32500); 183 modules. dist/multiplayer.js now has a header comment.

## Files (lines)
New:
- dist/session-clock.js (70)
- tests/session-clock.mjs (126)
- tests/mp-clock.mjs (46)

Changed:
- dist/relay-protocol.js (95)
- dist/multiplayer.js (100)
- dist/game.js (1648)
- dist/index.html: one section added
- dist/style.css: one block appended
- tests/relay-protocol.mjs: 2 assertions

Not touched:
- server.js and worker/lobby.js (both use createLobby, so they got the host and clock rules automatically)
- routine.js
- main-menu.js
- profile.js and state.js (no save field was needed)

## Defaults and choices
- Default is "Just visit", and Esc means visit.
- Ease constant is 2 game minutes, with a 2 game minute per second cap. The snap threshold is 15 game minutes.
- Broadcast every 30 s. The relay allows at most one clock per 0.5 s.
- The remembered choice lives in memory per lobby URL, never saved.

## Not verified (cannot be, here)
- Nothing was seen in a browser. The two-client Node test uses the real relay and the client class but not game.js.
- game.js wiring (dialog, HUD, sky, sessionStep) is covered only by node --check, the unchanged startup and game tests passing, and a unit-level replica of sessionStep in session-clock.mjs. The real flow (menu connect, then dialog over the menu) has not been run.
- The dialog opens over the menu while startGame runs, so the world is live behind it and WASD works. Visit is the default, so nothing is lost. I did not set `modal`.

## Eye-check list
1. Host a lobby on one tab and join on another with an older save. The dialog should show the host's day and time and default to Just visit.
2. Visit: the sky, HUD and weather follow the host. Pause menu or HUD shows " · Visiting". After you leave, your save day and time are unchanged. Check that crops, rent and the cat did not move.
3. Sync: the warning text appears and Back works. After confirming, your day jumps to the host's, rent is billed, and the cat is hungrier.
4. A host day earlier than your save: Sync is disabled with the note.
5. Time easing: let the two tabs drift (throttle one tab). Within about 5 s the clock should converge with no visible sky jump.
6. Join with the host mid-sunset: you should see the same sky at once.
7. Host leaves: the next player gets the toast "You are the host now", and the others keep following.
8. Sleep online restores energy only and the clock does not move.
9. Reconnect in the same lobby: it does not ask again.
10. Frame time while online (the added per-frame work is trivial).

## Frame-rate risks
- Clock reads allocate nothing: shared view object and getters.
- The only per-frame work is sessionStep (one advance) and one dueBroadcast. The 30 s message is a small object.
- advanceTime allocates, as it did before.

## Leftovers
- Gate shopOpen and officeOpen (and NPC schedule time) to the visitor's clock. Needs a hook where hours are read.
- Gate the cafe shift and bog pull advanceTime calls in visit mode.
- Set `modal` while the join dialog is open, or pause the world.
- An option to re-choose sync or visit mid-session (a menu entry).
- Host migration while a joiner is in sync mode keeps its clock but the new host's time may differ by a few seconds. It is eased or snapped, and there is no test for that exact case.

## Forbidden-file needs
None. world.js, terrain.js, props-assets.js, audio.js, phone*.js, scripts/build-index.mjs and notes/handoff.md were not touched.