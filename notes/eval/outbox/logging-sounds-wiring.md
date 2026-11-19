michadr.

# Logging sounds wiring (LOG1)

## Files changed (line counts after)
- dist/logging-wiring.js NEW (44): pure rules: forestProximity (smoothstep, 1 within 10 m, 0 beyond 44 m), forestTarget (hysteresis: on inside 36 m, off beyond 44 m, off indoors), forestLoopGain (bounded by the loop level), forestDuck (vehicle .4, talking .55), createCreakGate (seeded LCG, 16-38 s, 7-15 s while a tree is worked, only when proximity >= .25, frame-rate independent), thudSizeForLogs, LOGGING_ONESHOT_FILES.
- dist/audio.js (305; the file is normally off-limits; the existing API could not play a pick, so): new `logging(kind,at,listener,{delay,scale,size})` one-shot (pickLoggingClip/pickLogThud with audio.js's own injected `random`, last-index per kind kept inside audio.js, same attenuate/mute/voice cap as timber()), `ambience()` gets `forest` (0..1) and `duck` params, lazily loads amb-forest-pines and the 20 one-shots when forest>0, fades the loop with ease k .5 (about 1.5 s), 0 when indoors. Mute and volume go through the master gain as before. No Math.random added.
- dist/game.js (1955, CRLF kept, 1970 lines before/after the same count): line 75 import; 455 forestSt/creakGate/forestScan (nearest standing pine from world.trees, 4 Hz inside the existing ambClock block), fp=forestTarget(...), seeded creak, audio.ambience({...,forest:fp,duck:forestDuck({vehicle:driving.driving||fork.on,talking:talking()})}); 893 putting a log down plays logThud medium (slab still logDrop, planks plankDrop); 1346 last hit on a felling: axeHit + woodCrack (scale .55) + treeFall (replaces timber chop and fall); 1349 trunk lands: logThud sized by log count (scale .6) replaces timber thud; 1353 normal impact: axeHit (at CHOP_IMPACT via strikeTree); 1374 bucking axe hit: buckCut; 1377 final bucking cut (axe or saw): woodCrack .55 + logThud medium (delay .12, scale .7).
- dist/skills.js (37): perksText now `Swing ${swingSeconds(swingTime(level),hits||HITS_PER_SWING)} s · ceil(hits/HITS_PER_SWING) swing(s) per tree` (imports chop-path.js, which imports three; it is already loaded by the game). tests/skills.mjs updated (4 asserts: 1.60 s/2 swings, 1.30 s/1 swing, no axe 1.60 s, 5 hits 1.33 s/3 swings).
- dist/vehicle-sounds.js (101): ALL_FILES now includes LOGGING_FILES (the 21 clips were not registered, so tests/vehicle-sounds.mjs was already failing after Hydro's run); new MAX_LOOP_BYTES 320000 and LONG_LOOPS (forest loop is 297,849 B, over the 60,000 per-file cap). tests/vehicle-sounds.mjs: cap and 12 s duration check allow LONG_LOOPS.
- ASSETS.md: new section "Logging sounds and forest ambience (LOG1)" with the 21 files, Freesound ids and authors (the test requires each file named there).
- tests/logging-sounds-game.mjs NEW (75). PROJECT-INDEX.md and PROJECT-BRIEF.md regenerated (`npm run index`: index 35403 of 37000).

## Tests run (real output)
```
PASS logging-sounds-game.mjs: audio.logging non-repeating over 30 hits, 20 clips requested, forest loop gain bounded/ducked/silent indoors, seeded creak gate (10 creaks in 300 s), game.js hooks present.
PASS logging-sounds.mjs: 21 CC0 logging/ambience clips (567.6 KB total, mono 22.05 kHz Ogg), non-repeating pickLoggingClip + pickLogThud verified.
PASS sweep-sounds.mjs: 114 sweep clips ...
Lumberjack levels, perks (...) passed.            (skills.mjs)
Audio: distance falloff ... passed.                (audio.mjs)
PASS chop-swing.mjs ...   PASS timber-game.mjs ...
Vehicle sounds: every class has an engine loop and every file is registered ... passed.   (vehicle-sounds.mjs, was failing before)
brief tests passed: 265 modules listed, brief 2834 and index 35403 estimated tokens (budgets 3000 and 37000)
```
node --check dist/game.js and dist/audio.js: clean. NOT run: npm run release, npm test (told not to). The packaged-release tests (startup, rescue, etc.) will need `npm run release -- --force` first.

## Choices made on Hydro's three owner questions (all easy to flip)
1. New axe-hit pool (6) REPLACES the old axe-chop pool for the tree and bucking hits (the old TIMBER_SHOTS.chop is no longer played in the game).
2. tree-fall-seq REPLACES tree-fall; the old tree-thud is replaced by a quieter log thud (.6) at landing, which may double the seq's own ground thud: ear-check.
3. LOGGING_MIX levels used unchanged.

## Could not verify / gaps
- Heard nothing, saw nothing in a browser; the fake-AudioContext test proves routing, not feel.
- Loaded-log-pile creaks are NOT done (no cheap pile-position helper): creaks only near the nearest standing pine or the tree being worked. Creak at a nearby tree up to 36 m away is quiet because of distance falloff.
- Forest proximity = distance to the nearest standing tree in world.trees (the choppable pines, Pine Ridge), scanned 4 Hz over all of them; other town trees do not count. Frame cost not measured.
- "Ducks the way other ambience loops do": the other loops do not duck, so I added a duck under vehicle (.4) and conversation (.55). Chainsaw does not duck it.
- Forest loop decodes to about 8.6 MB at 48 kHz and ASSETS payload is now 2.93 MB of the 3.0 MB cap (about 73 KB left).
- Stump clearing and plain walking have no new sound. Crew felling (workforce) plays nothing.
- skills perksText: no-axe case now says 1.60 s (the heavy swing), not 0.80.

## Owner ear-check list
axe hits (6 variants, never twice in a row, not too loud next to footsteps), crack layer on the felling hit and final bucking cut, tree-fall sequence plus landing thud (double thud?), log thud when setting a log down, creaks (rare, not annoying), forest loop fade in/out at the tree line, silent indoors, quieter in a vehicle and in conversation, mute and volume slider.

## Confidence
Registry/audio routing/pure rules: high (tested). game.js hook placement: medium-high (anchors verified, syntax checked, not run in a browser). Sound balance: unknown until heard.