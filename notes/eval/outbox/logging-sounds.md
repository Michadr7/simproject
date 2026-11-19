michadr.

# Logging Sounds + Forest Ambience (`hydrogen-logging-sounds.md`)

## Files Created or Changed
- `dist/logging-sounds.js` (created, 75 lines): pure CC0 logging & forest-ambience clip registry (`AXE_HITS`, `WOOD_CRACKS`, `TREE_FALL_SEQS`, `LOG_THUDS`, `WOOD_CREAKS`, `FOREST_AMBIENCE`, `LOGGING_MIX`, `LOGGING_SHOTS`, `LOGGING_LOOPS`, `LOGGING_FILES`) and pure non-repeating pickers (`pickLoggingClip`, `pickLogThud`) taking an injected random number.
- `tests/logging-sounds.mjs` (created, 78 lines): validates all 21 `.ogg` files (existence, OggS container, mono, 22.05 kHz, size budgets), frozen exports, and `pickLoggingClip` / `pickLogThud` determinism and no-back-to-back-repeat guarantees.
- `assets-src/sounds-sweep/README.md` (updated, 71 lines; +21 rows): recorded Freesound URL, author, CC0 1.0 licence, cut window, and loudness for all 21 new clips.
- `dist/assets/sounds/*.ogg` (21 new mono 22.05 kHz Ogg Vorbis 56 kbps files, 567.6 KB total).
- `PROJECT-INDEX.md` & `PROJECT-BRIEF.md` (regenerated via `npm run index`).

## Existing Clips Checked (unchanged)
- `dist/timber-sounds.js` (`assets-src/sounds-timber/README.md`): `axe-chop-1..4`, `tree-fall`, `tree-thud`, `log-drop-1..3`, `plank-drop-1..3`, `plank-stack`, `chainsaw-{start,idle,cut,stop}`, `sawmill-blade-{idle,cut,stop}`, `conveyor-belt`.
- `dist/sweep-sounds.js` (`assets-src/sounds-sweep/README.md`): `amb-birds`, `amb-crickets`, `amb-wind` (4.70 s), `amb-water`.

## New Clip Table (all CC0 1.0, mono 22.05 kHz Ogg Vorbis 56 kbps)
| Clip | Source URL | Author | Licence | Duration | Loudness |
|---|---|---|---|---|---|
| `axe-hit-1.ogg` | https://freesound.org/people/Hano_van_Dalen/sounds/767326/ | Hano_van_Dalen | CC0 1.0 | 0.34 s | peak -4.0 dBFS, rms -24.6 dBFS |
| `axe-hit-2.ogg` | https://freesound.org/people/Hano_van_Dalen/sounds/767326/ | Hano_van_Dalen | CC0 1.0 | 0.27 s | peak -4.0 dBFS, rms -34.4 dBFS |
| `axe-hit-3.ogg` | https://freesound.org/people/xkeril/sounds/753925/ | xkeril | CC0 1.0 | 0.17 s | peak -4.0 dBFS, rms -21.6 dBFS |
| `axe-hit-4.ogg` | https://freesound.org/people/xkeril/sounds/753925/ | xkeril | CC0 1.0 | 0.23 s | peak -4.0 dBFS, rms -23.1 dBFS |
| `axe-hit-5.ogg` | https://freesound.org/people/ElSchorscho/sounds/847818/ | ElSchorscho | CC0 1.0 | 0.14 s | peak -4.0 dBFS, rms -27.4 dBFS |
| `axe-hit-6.ogg` | https://freesound.org/people/ElSchorscho/sounds/847818/ | ElSchorscho | CC0 1.0 | 0.11 s | peak -4.0 dBFS, rms -26.1 dBFS |
| `wood-crack-1.ogg` | https://freesound.org/people/Sheyvan/sounds/567053/ | Sheyvan | CC0 1.0 | 0.58 s | peak -4.0 dBFS, rms -32.0 dBFS |
| `wood-crack-2.ogg` | https://freesound.org/people/viwright2112/sounds/630400/ | viwright2112 | CC0 1.0 | 0.80 s | peak -4.0 dBFS, rms -34.9 dBFS |
| `wood-crack-3.ogg` | https://freesound.org/people/craigsmith/sounds/483354/ | craigsmith | CC0 1.0 | 1.55 s | peak -4.0 dBFS, rms -19.6 dBFS |
| `tree-fall-seq-1.ogg` | https://freesound.org/people/Kinoton/sounds/494071/ | Kinoton | CC0 1.0 | 5.50 s | peak -4.0 dBFS, rms -28.3 dBFS |
| `tree-fall-seq-2.ogg` | https://freesound.org/people/ozymandias37/sounds/869103/ | ozymandias37 | CC0 1.0 | 5.77 s | peak -4.0 dBFS, rms -30.2 dBFS |
| `log-thud-small.ogg` | https://freesound.org/people/Breviceps/sounds/449955/ | Breviceps | CC0 1.0 | 0.42 s | peak -4.0 dBFS, rms -15.5 dBFS |
| `log-thud-medium.ogg` | https://freesound.org/people/KrystianPawlowski/sounds/584891/ | KrystianPawlowski | CC0 1.0 | 0.50 s | peak -4.0 dBFS, rms -23.7 dBFS |
| `log-thud-heavy.ogg` | https://freesound.org/people/dorian.mastin/sounds/381609/ | dorian.mastin | CC0 1.0 | 0.70 s | peak -4.0 dBFS, rms -25.9 dBFS |
| `wood-creak-1.ogg` | https://freesound.org/people/Oleh.Ibrahimov/sounds/620759/ | Oleh.Ibrahimov | CC0 1.0 | 2.25 s | peak -4.0 dBFS, rms -18.2 dBFS |
| `wood-creak-2.ogg` | https://freesound.org/people/Oleh.Ibrahimov/sounds/620759/ | Oleh.Ibrahimov | CC0 1.0 | 1.45 s | peak -4.0 dBFS, rms -18.5 dBFS |
| `wood-creak-3.ogg` | https://freesound.org/people/Sacha.Julien/sounds/726217/ | Sacha.Julien | CC0 1.0 | 0.75 s | peak -4.0 dBFS, rms -29.2 dBFS |
| `wood-creak-4.ogg` | https://freesound.org/people/Sacha.Julien/sounds/726217/ | Sacha.Julien | CC0 1.0 | 0.80 s | peak -4.0 dBFS, rms -30.0 dBFS |
| `wood-creak-5.ogg` | https://freesound.org/people/Breviceps/sounds/456814/ | Breviceps | CC0 1.0 | 1.80 s | peak -4.0 dBFS, rms -17.6 dBFS |
| `wood-creak-6.ogg` | https://freesound.org/people/Rudmer_Rotteveel/sounds/506665/ | Rudmer_Rotteveel | CC0 1.0 | 0.60 s | peak -4.0 dBFS, rms -21.8 dBFS |
| `amb-forest-pines.ogg` | https://freesound.org/people/nicotep/sounds/843926/ | nicotep | CC0 1.0 | 45.00 s (0.50 s cross-fade loop) | rms -20.0 dBFS, peak -3.3 dBFS |

## Real Test Output
```
PASS logging-sounds.mjs: 21 CC0 logging/ambience clips (567.6 KB total, mono 22.05 kHz Ogg), non-repeating pickLoggingClip + pickLogThud verified.
PASS sweep-sounds.mjs: 114 sweep clips (386.8 KB new step audio), all 15 SURFACE ids + indoor tile/carpet/wood, nextStepClip deterministic L/R + run + cloth, 20 lumber clips, audio.js safe without a sound card.
brief tests passed: 262 modules listed, brief 2834 and index 34922 estimated tokens (budgets 3000 and 37000)
```

## What Could NOT Be Verified
- **Audio playback / ear-check**: I cannot listen to any of the 21 clips. Cut windows, silence trimming, loop steadiness, and low high-frequency (> 3 kHz) bird-chirp absence on `amb-forest-pines.ogg` (`hf>3k = 0.012`, `rms_std = 1.61 dB`) were verified mathematically via `numpy` only. The owner must ear-check them.
- **Full `npm test` / `npm run release`**: Not run per prompt instructions (another agent owns `game.js`).

## Exact Wiring Request for the `game.js` (and `audio.js`) Lane
`dist/logging-sounds.js` is pure data + pickers; `dist/audio.js` currently only preloads/plays `TIMBER_SHOTS` and `SWEEP_LOOPS`. To wire these in:
1. **`dist/audio.js`** (add `LOGGING_FILES` to the sound loader / `logging(pick, at, listener)` one-shot helper + `amb-forest-pines` loop channel in `audio.ambience(...)` using `LOGGING_LOOPS.forestPines.level`):
   - Play `pick.file` at `pick.level` (distance-attenuated from `at` to `listener`) with `playbackRate = pick.rate`.
2. **`dist/game.js`** (keep per-slot `lastIdx` state in `game.js` and pass `Math.random()` into the pure picker):
   - **Axe swing hit**: `const p = pickLoggingClip('axeHit', lastAxeIdx, Math.random()); lastAxeIdx = p.index; audio.playLogging(p, treePos, playerPos);`
   - **Tree crack / groan layer** (on final 1-2 chops before felling or mid-chop stress): `const p = pickLoggingClip('woodCrack', lastCrackIdx, Math.random()); lastCrackIdx = p.index; audio.playLogging(p, treePos, playerPos);`
   - **Tree fall sequence** (replaces or layers over `tree-fall` when a tree begins falling): `const p = pickLoggingClip('treeFall', lastFallIdx, Math.random()); lastFallIdx = p.index; audio.playLogging(p, treePos, playerPos);`
   - **Bucking cut** (when cutting felled trunk into logs with axe): `const p = pickLoggingClip('buckCut', lastBuckIdx, Math.random()); lastBuckIdx = p.index; audio.playLogging(p, logPos, playerPos);`
   - **Log thud** (when a log lands or is dropped, keyed by log size `'small' | 'medium' | 'heavy'`): `const p = pickLogThud(size, Math.random()); audio.playLogging(p, logPos, playerPos);`
   - **Forest ambience loop + random wood creaks**: in `frame()` / `ambience(...)`, pass `forestProximity` (0..1 based on distance to forest/pine plot) to start/scale `LOGGING_LOOPS.forestPines` (`amb-forest-pines`, level `0.28 * forestProximity`) and stop/mute when `forestProximity <= 0`. On a slow timer while in the forest (`forestProximity > 0.25`), occasionally trigger `pickLoggingClip('woodCreak', lastCreakIdx, Math.random())` at a nearby tree position.

## Questions for the Owner
1. After ear-checking `axe-hit-1..6`, do you want `dist/logging-sounds.js` to replace `TIMBER_SHOTS.chop` (`axe-chop-1..4`) or combine both pools into a 10-clip axe pool?
2. Should `tree-fall-seq-1/2` replace `tree-fall` + `tree-thud` for felled trees (since they already include creak -> crack -> whoosh -> ground thud), or layer underneath?
3. Are the default mix levels in `LOGGING_MIX` (`axeHit: 0.72`, `woodCrack: 0.68`, `treeFall: 0.88`, `woodCreak: 0.42`, `forestPines: 0.28`) balanced against your footsteps and chainsaw in-game?

## Honest Confidence
- **Clip sourcing, CC0 verification, Ogg format & loudness**: High (all 21 Freesound pages verified `Creative Commons 0`; all Oggs verified mono 22.05 kHz via `tests/logging-sounds.mjs`).
- **Pure registry & picker (`dist/logging-sounds.js`)**: High (zero DOM/globals/`Math.random`, all assertions in `tests/logging-sounds.mjs` pass).
- **Audio feel / timbre ("New World" weight, zero stray birds/artifacts)**: Medium-Low until owner ear-checks, since no audio playback was possible here.
