michadr.

# PET3: the cat in the game (Opus, game.js lane), report

Version stays 0.35.22 (not deployed, no bump). I built it with `npm run release -- --force`. I did not run git.

## How it plays
- **The offer.** You get a home: you rent, or you own a property (`hasHome`). An hour of game time after that, and the next time you are at home, the shelter texts you on the Housing app. The text comes only once. The offer then opens in the dialog: "A cat for your new home?". The dialog has a name box (`NAME_MAX` 16, empty means Whiskers, cleaned by `pets.js`) and three buttons:
  - **Adopt**: the cat moves in.
  - **No thanks**: this is `declineOffer`. The offer comes back after 3 days (`REOFFER_AFTER`).
  - **Not now**: the offer is asked again on your next visit home.
  - Why the hour: an earlier version texted the moment you moved in. That broke 3 existing tests (sleep-game, startup, store-game), and it would interrupt a real player who has just stepped in.
- **The cat in the home.** It appears in the studio or in a house (`interiorSpawn`; a house uses `collidersOf(layout,0)`). It wanders in the daytime wander slots, picking a free spot with a clear straight path (it checks `room.blocked`). It sleeps from 23:00 to 06:00, and it walks and meows when it is hungry. Clips come from `clipFor` with crossfades from the actor. The cat is hidden outside its home.
- **Moving.** If you no longer hold the cat's home, the cat moves to your main home and you get a phone line about it.
- **E prompts.** The prompt is "Pet <name>" while the cat is fed, and "Feed <name>" once it is peckish (3 days or more).
  - Feeding costs **one grocery pack**. `items.js` has no cat food item, so this uses the existing food. Without a pack you get a toast pointing you to the Corner Market.
  - Patting has a cooldown of 60 game minutes and adds +5 affection.
- **Hunger.** `tickPets` runs once a game minute and only reads the clock, so a sleep or a time skip fires every event it missed, in order. The phone says "looks hungry" at 1 week and "is starving" at 2 weeks. At 3 weeks unfed the cat runs away: `pet:null`, with `lostAt` and `lostName` saved, and the `MSG.ranaway` text.
- **Sounds.** The 7 CC0 clips are copied to `dist/assets/sounds/`. A new helper, `audio.cat(kind, at, listener)`, plays them at the cat's position:
  - a greeting meow when you come home (not while it sleeps);
  - a meow at most every 30 game minutes while it is hungry (the sad meow when it is starving);
  - eat when you feed it, purr when you pat it.
  - The clips load lazily on entering a home with the cat; `hiss` is registered but not used. The sound payload is now about 2.34 MB, under the 3 MB cap.
- **Co-op.** While your cat is shown and you are online, your position message carries `petSnapshot` (at most 4 a second).
  - The relay (`relay-protocol.js`) checks it with `applyPetSnapshot` and passes it on only if it is valid; junk is dropped.
  - The other client checks it again in `receiveRemote`.
  - A player in the same room as you sees your cat as a second actor that shares the same model. That actor is created only when a remote cat is first seen.
  - `PROTOCOL` stays 1 because the field is optional: old clients and old relays simply ignore it.
- **Frame budget.** One SkinnedMesh shares the GLB's geometry and material. Per frame there is no allocation: the clip state object is reused, and the clip and waypoint are worked out once a game minute.
- **Missing model.** If `cat.glb` fails to load, the game warns `Cat model missing: dist/assets/pets/cat.glb` and the cat simply is not drawn.

## Files changed (line counts from `Measure-Object -Line`, which skips blank lines)
- `dist/game.js` (1953, was 1921; CRLF kept, 0 LF-only lines, no BOM):
  - one import line;
  - the actor and state after `houseHomes` (l.408);
  - the PET3 block before `storyKnock` (l.531-559): `petTick`, `petOffer`, `petWaypoint`, `petFrame`, `petVisit`, `petCandidate`, `petAct`, `catShare`;
  - hooks: `storyTick();petTick();` in `stepWorld`, `petFrame(view)` after `updateZones`, `petCandidate(add)` on the home's ground floor, the `remote.pet` check in `receiveRemote`, the third argument of `sendPosition`, and the 4-per-second send while the cat is shown.
- `dist/jobs.js` (75): imports `pets.js`; `pets:freshPets()` in `freshProgress`; `s.pets=normalizePets(a.pets)` in `normalizeProgress`. Optional field, no schema bump.
- `dist/audio.js` (295): imports `cat-sounds.js`; new method `cat()`.
- `dist/vehicle-sounds.js` (100): `CAT_FILES` added to `ALL_FILES`.
- `dist/relay-protocol.js` (91): optional, validated `pet` on a player (in `view` only when present).
- `dist/multiplayer.js` (98): `sendPosition(position, room, pet=null)`.
- NEW `dist/cat-sounds.js` (5): `CAT_SHOTS`, `CAT_FILES`, `MEOW_GAP`.
- NEW `dist/assets/sounds/cat-{eat,hiss,meow-1,meow-2,meow-3,meow-sad,purr}.ogg` (107,407 B in total), copied from `assets-src/sounds-cat/`.
- `ASSETS.md`: new section "Sounds in dist/assets/sounds/cat-*.ogg" (the 7 rows from the cat sounds README).
- NEW `tests/pet-game.mjs` (79).
- `PROJECT-INDEX.md` and `PROJECT-BRIEF.md`: regenerated.

No other test was re-pinned or edited. `worker/lobby.js` was not touched: it gets the relay change through its import of `dist/relay-protocol.js`. After a hibernation wake the cat comes back with the next position message.

## Tests (real output)
`node tests/pet-game.mjs` (after `npm run release -- --force`):
```
PASS pet-game: offer text + dialog on moving in, naming, cat shown in the studio and hidden outside, pat (cooldown) and feed (a grocery pack), save round-trip, run-away after 3 weeks with both warnings, relay cleans co-op cat snapshots, 7 cat sounds registered.
```
It also checks:
- there is no text before an hour has passed, nor while you are out;
- the cat wanders by day and stays inside the room;
- a visitor's cat shows as a second cat and goes away when its owner leaves the room;
- the cooldown, the toasts and the `normalizeProgress` round-trip;
- an old save has no cat.

The existing pet tests:
```
PASS pets: offer, hunger, feed, pat, tick, run-away, normalise, rehome, mood
PASS pet-view: clipFor variety/sleep/hunger, nextWaypoint bounds/furniture, blendTime, petSnapshot validation, interiorSpawn, purity.
PASS pet-actor: GLB verified (630880B, 24 joints, 12 clips), stride/turn/crossfade/anchors, shared clone & zero-alloc update.
```
`npm run index` and `node tests/brief.mjs`:
```
brief 2834 tokens (target 3000), index 35535 tokens (target 36000); 246 modules, 14 generated, 299 tests, 30 scripts; 13 modules without a header comment
brief tests passed: 246 modules listed, brief 2834 and index 35535 estimated tokens (budgets 3000 and 36000)
```
Full `npm test`:
```
All 299 test files passed.
```
The first full run had 4 failures, all caused by me and now fixed:
- game-name: the literal "Eden Ridge" was in the shelter text.
- sleep-game, startup, store-game: the instant offer and text got in their way. Fixed by the hour delay and texting only at home.

## What I could NOT verify
- The real GLTFLoader load and render of `cat.glb`, how the animation feels (walk speed is the actor's 0.226 m/s stride), and the crossfades. Tests have no `document.baseURI`, so the model is never loaded there. The missing-file warning path is also not exercised.
- The cat clipping through furniture between waypoints: only 3 points on the straight line are sampled.
- The sounds by ear: levels, the greeting meow, how often the hungry meow plays.
- In-game co-op over a real socket. The relay lobby rules and the visitor-cat drawing (through `GameState.otherPlayers`) are tested; a live two-browser session is not. The hosted relay needs a worker redeploy before visitors can see each other's cats; the game works without it.
- The house spawn and wander in the browser: houses are covered only by the `pet-view` unit tests and this code path.

## Notes and open items for the owner
- Feeding uses grocery packs. A real cat food item and a food bowl remain open (the bowl is optional).
- After the cat runs away, `pets.js` offers no new adoption: the offer status stays 'accepted'. If you want a second chance later, that is a change to the rules in `pets.js`.
- I made no edits to forbidden files beyond what the prompt asked for. The prompt explicitly listed audio.js, relay-protocol.js and multiplayer.js.

## Confidence
- Saves (jobs.js): **High**.
- Offer, naming, feed, pat, warnings, run-away in game.js: **High** (end-to-end in the packaged game).
- Wander, spawn, sleep, visibility: **Medium-high** (logic tested; how it looks is unseen).
- Sounds wiring: **Medium** (registry tested; the `audio.cat` call path was not run against a fake context).
- Co-op: **Medium** (relay and drawing tested, no live socket).
- GLB in the browser: **Medium** (depends on pet-actor.js, which Hydrogen tested with stubs).
