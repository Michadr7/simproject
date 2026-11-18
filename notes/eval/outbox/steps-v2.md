michadr.

# Footsteps v2 (`steps-v2`) report

## Files created / changed
- [dist/sweep-sounds.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/sweep-sounds.js) (`38` lines, updated):
  - Expanded `STEP_CLIPS` to 11 kinds (`pave`, `grass`, `gravel`, `wood`, `dirt`, `mud`, `soil`, `crops`, `bank` with 6 clips each; indoor `tile`, `carpet` with 5 clips each). `wood` 4..6 are creaky wooden floor clips.
  - Added `STEP_RUN_CLIPS` (4 clips each for `pave`, `grass`, `gravel`, `dirt`, `wood`) and `STEP_CLOTH` (`step-cloth-1..4`) with `STEP_CLOTH_LEVEL` (`{walk: .08, run: .15, jitter: .12}`).
  - Updated `stepKind()` to map all 15 `terrain.js` `SURFACE` ids explicitly (`GRASS->grass`, `STREET/ROAD/PAVEMENT/DRIVEWAY->pave`, `DIRT/PATH->dirt`, `GRAVEL->gravel`, `BRIDGE->wood`, `MUD->mud`, `PLOWED->soil`, `WHEAT/GREEN->crops`, `BANK->bank`, `WATER->null`) plus indoor string kinds (`tile`, `carpet`, `wood`), keeping `WATER` silent (unwalkable in `terrain.js`, no shallow surface id).
  - Added pure deterministic `nextStepClip(kind, lastIndex, foot, running, seed)` returning `{file, index, foot, nextFoot, gain, rate, cloth: {file, gain, rate}}` (or `null` for silent/unknown surfaces). Never repeats `lastIndex` back-to-back, alternates L/R feet (`0,2,4` L / `1,3,5` R), scales gain and playback rate higher when `running` is true, and uses a deterministic integer/float hash from `seed` (no `Math.random`).
  - Kept `STEP_CLIPS`, `STEP_LEVEL`, and `stepKind` backwards-compatible so `audio.step()` keeps working unchanged until switched over.
  - Updated `SWEEP_FILES` (38 -> 114 entries) and `SWEEP_CORE` (common outdoor step pools + cloth + core UI/doors/cash).
- [tests/sweep-sounds.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/sweep-sounds.mjs) (`83` lines, extended): re-pinned `SWEEP_FILES.length` 38 -> 114, updated `SURFACE.WHEAT` -> `'crops'` and `SURFACE.PATH` -> `'dirt'` to match the new surface kinds, added explicit assertions for all 15 `SURFACE` ids, indoor strings (`tile`, `carpet`, `wood`), Ogg mono 22.05 kHz / `< 30 KB` / `< 400 KB` budget checks, and `nextStepClip` determinism, L/R alternation, non-repeat, run scaling, and cloth layer checks.
- `dist/assets/sounds/step-*.ogg` (76 new `.ogg` files, copied also in `assets-src/sounds-steps/`): all mono, 22.05 kHz, Ogg Vorbis (`44 kbps`), DC offset removed, trimmed tight at 5% onset (`lead_ms <= 4.1 ms`), 3 ms fade-in, 30–80 ms fade-out, peak-normalised to `-4.0 dBFS` prior to encode. Total new audio: **396,064 bytes (386.8 KB)** (< 400 KB); individual clip sizes **4,630–6,559 bytes** (< 30 KB each); durations **0.176–0.511 s**; post-encode peaks **-4.5 to -2.8 dBFS**, RMS **-31.5 to -14.2 dBFS**.
- [assets-src/sounds-steps/README.md](file:///c:/Users/Michael/Documents/Projects/simproject/assets-src/sounds-steps/README.md) (`86` lines, created) & [ASSETS.md](file:///c:/Users/Michael/Documents/Projects/simproject/ASSETS.md) (`580` lines, appended): full source table (every clip's Freesound id, title, author, URL, **CC0 1.0** licence verified 2026-11-18, cut timestamps, duration, lead onset, spectral centroid, peak/RMS, and byte size). Recorded in `ASSETS.md` because `tests/vehicle-sounds.mjs` requires every file in `ALL_FILES` to appear in `ASSETS.md`.
- `PROJECT-BRIEF.md` & `PROJECT-INDEX.md` regenerated via `npm run index` (index stayed at 33,852 / 34,000 tokens without touching `BUDGET`).

## Sources (all CC0 1.0, Freesound)
Full per-clip table in [assets-src/sounds-steps/README.md](file:///c:/Users/Michael/Documents/Projects/simproject/assets-src/sounds-steps/README.md):
- `step-pave-4..6`: Freesound 465299 "Concrete Footsteps" by SoftDistortionFX (https://freesound.org/people/SoftDistortionFX/sounds/465299/)
- `step-grass-4..6`: Freesound 556042 "Footsteps_Mountain_Boots_Grass_Mono.wav" by Nox_Sound (https://freesound.org/people/Nox_Sound/sounds/556042/)
- `step-gravel-4..6`: Freesound 556002 "Footsteps_Mountain_Boots_Gravel_Mono.wav" by Nox_Sound (https://freesound.org/people/Nox_Sound/sounds/556002/)
- `step-wood-4..6`: Freesound 851223 "Footsteps on old creaky wooden floor - Vintage Hotel" by JoanCalsina (https://freesound.org/people/JoanCalsina/sounds/851223/)
- `step-dirt-1..6`: Freesound 264469 "Footsteps Dirt 01" by aglinder (https://freesound.org/people/aglinder/sounds/264469/)
- `step-mud-1..6`: Freesound 548384 "Footsteps_Mountain_Boots_Mud_Mono.wav" by Nox_Sound (https://freesound.org/people/Nox_Sound/sounds/548384/)
- `step-soil-1..6`: Freesound 832849 "Earthy footsteps in combat boots, varying speed (Royalty free!)" by vaal01 (https://freesound.org/people/vaal01/sounds/832849/)
- `step-crops-1..6`: Freesound 559082 "Foley_Movement_High_Grass_Mono.wav" by Nox_Sound (https://freesound.org/people/Nox_Sound/sounds/559082/)
- `step-bank-1..6`: Freesound 564893 "Footsteps_Mountain_Boots_Wet_Sand_Sequence_Mono.wav" by Nox_Sound (https://freesound.org/people/Nox_Sound/sounds/564893/)
- `step-tile-1..5`: Freesound 555868 "Footsteps_Mountain_Boots_Tile_Mono.wav" by Nox_Sound (https://freesound.org/people/Nox_Sound/sounds/555868/)
- `step-carpet-1..5`: Freesound 234855 "Footsteps_Carpet.wav" by mlsulli (https://freesound.org/people/mlsulli/sounds/234855/)
- `step-cloth-1..4`: Freesound 481075 "Foley - Cotton clothes rustling - Fabric movement sound.wav" by khenshom (https://freesound.org/people/khenshom/sounds/481075/)
- `step-pave-run-1,2,4`: Freesound 732563 "Running Concrete" by LewisEmmott5 (https://freesound.org/people/LewisEmmott5/sounds/732563/); `step-pave-run-3`: Freesound 693242 "Concrete Steps shoes slippers walking & running.wav" by pointnemoprod (https://freesound.org/people/pointnemoprod/sounds/693242/)
- `step-grass-run-1..4`: Freesound 635052 "Panicked Running Footsteps on Grass" by sillygrizzlies (https://freesound.org/people/sillygrizzlies/sounds/635052/)
- `step-gravel-run-1..4`: Freesound 456038 "Footsteps of a runner on gravel" by florianreichelt (https://freesound.org/people/florianreichelt/sounds/456038/)
- `step-dirt-run-1..4`: Freesound 319225 "Running Dirt Tennis Shoes.wav" by worthahep88 (https://freesound.org/people/worthahep88/sounds/319225/)
- `step-wood-run-1..4`: Freesound 682772 "Running footsteps on wood.WAV" by thomasanthony321 (https://freesound.org/people/thomasanthony321/sounds/682772/)

Note on L/R variants: Freesound source metadata does not tag left vs right foot explicitly. Even/odd pool indices (`0,2,4` L / `1,3,5` R) were cut from consecutive alternating steps in continuous walking/running sequences where available.

## Tests run & output
```
> node tests/sweep-sounds.mjs
PASS sweep-sounds.mjs: 114 sweep clips (386.8 KB new step audio), all 15 SURFACE ids + indoor tile/carpet/wood, nextStepClip deterministic L/R + run + cloth, 20 lumber clips, audio.js safe without a sound card.

> node tests/vehicle-sounds.mjs
Vehicle sounds: every class has an engine loop and every file is registered, mono Ogg under the size cap with the payload under 2 MB and decoded memory under 25 MB, yells under 1.2 s, all listed in ASSETS.md; crash tier by impact (light, medium, hard), glass at Damaged or worse, a person is a thud and a yell; the yell gate (4 m/s, 4 m, 8 s each, nearest first, 2 voices) and the 12-voice cap; the loader fetches nothing before a vehicle, one file at a time, its own engine first, never twice; a missing or corrupt file keeps the generated sound; engine rate follows the revs, misfire dips, hidden tab and mute are silent.

> npm run index
brief 2834 tokens (target 3000), index 33852 tokens (target 34000); 232 modules, 14 generated, 291 tests, 30 scripts; 13 modules without a header comment

> node tests/brief.mjs
brief tests passed: 232 modules listed, brief 2834 and index 33852 estimated tokens (budgets 3000 and 34000)
```

## Requested edits to forbidden files (for main chat)
1. **`dist/audio.js`** (`line 4` import + `lines 142-146` `step()`):
   - Import `nextStepClip, STEP_RUN_CLIPS, STEP_CLOTH` from `./sweep-sounds.js`.
   - In `step(surface, at, listener, running=false, foot=null, seed=random())`:
     - Keep `const k = stepKind(surface); if (!k || !ctx || settings.muted) return false; if (!tim.warm) { tim.warm = true; want(SWEEP_CORE); } want(running && STEP_RUN_CLIPS[k] ? STEP_RUN_CLIPS[k] : STEP_CLIPS[k]); want(STEP_CLOTH);`
     - Call `const s = nextStepClip(k, last['step'+k] ?? -1, foot ?? last['foot'+k] ?? 'L', running, seed); if (!s) return false; last['step'+k] = s.index; last['foot'+k] = s.nextFoot;`
     - Trigger `shot(s.file, s.gain * a, {rate: s.rate})` and layer `shot(s.cloth.file, s.cloth.gain * a, {rate: s.cloth.rate})` on top.
2. **`dist/game.js`** (`line 451` `footstep`):
   - When switching to animation foot-contact events, pass `foot` (`'L'`/`'R'`) and indoor floor kind (`'tile'` / `'carpet'` / `'wood'`) to `audio.step(sf, null, null, run, foot)`.

## What could not be verified
- **Listening by ear**: I cannot hear audio clips. All 76 cuts were chosen and verified solely by waveform/onset/RMS/tail-decay/spectral-centroid measurement (`numpy` + Blender `aud`).
- **In-browser playback & full `npm test` / packaged release**: I did not modify `dist/audio.js` or `dist/game.js`, did not run `npm run release -- --force`, and did not run the full 291-test `npm test` suite or boot the game in a browser.

## Confidence
- `dist/sweep-sounds.js` pure rules, surface mapping, and `tests/sweep-sounds.mjs`: **High** (verified by unit tests + `vehicle-sounds.mjs` + `brief.mjs`).
- Audio file format, trimming, normalisation, and size budgets: **High** (all 76 Ogg files measured post-encode).
- Subjective ear quality of individual cuts (`step-wood-4..6` creak feel, `step-cloth-1..4` subtlety, `step-soil-1..6` vs `step-dirt-1..6`): **Medium** (unheard; relies on waveform/spectral measurements until owner ear-check).
