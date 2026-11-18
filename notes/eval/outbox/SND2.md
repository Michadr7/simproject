michadr.

# SND2: Lumber, Chainsaw & Sawmill Sounds (Sourcing & Processing)

## Summary
All 21 requested clips (20 core + 1 optional `conveyor-belt.ogg`) were sourced from **CC0 1.0** Freesound recordings, verified on each Freesound page on 2026-11-18 (`Creative Commons 0`), and processed into `assets-src/sounds-timber/` (NOT `dist/`). No `ffmpeg` is installed on this machine, so all decoding, trimming, DC-removal, cross-fading, normalisation, and Vorbis encoding (mono, 22.05 kHz, 56 kbps) were performed with Blender 5.2's `aud` module and `numpy`.

## Files Created (`assets-src/sounds-timber/`)
- `assets-src/sounds-timber/README.md` (33 lines): ASSETS.md-style source/author/cut/loudness table.
- 21 `.ogg` files, **369.4 KB total (0.36 MB)**, all well under the 120 KB per-file and 1.5 MB set caps:
  - `axe-chop-1.ogg` (0.40 s, 6.3 KB), `axe-chop-2.ogg` (0.40 s, 6.4 KB), `axe-chop-3.ogg` (0.43 s, 6.7 KB), `axe-chop-4.ogg` (0.40 s, 6.6 KB)
  - `tree-fall.ogg` (4.50 s, 35.2 KB), `tree-thud.ogg` (0.90 s, 10.1 KB)
  - `log-drop-1.ogg` (0.60 s, 7.6 KB), `log-drop-2.ogg` (0.55 s, 7.5 KB), `log-drop-3.ogg` (0.60 s, 7.8 KB)
  - `chainsaw-start.ogg` (2.50 s, 22.3 KB), `chainsaw-idle.ogg` (4.10 s loop, 38.4 KB), `chainsaw-cut.ogg` (4.50 s loop, 34.4 KB), `chainsaw-stop.ogg` (1.70 s, 14.9 KB)
  - `sawmill-blade-idle.ogg` (4.70 s loop, 33.9 KB), `sawmill-blade-cut.ogg` (4.70 s loop, 35.4 KB), `sawmill-blade-stop.ogg` (3.00 s, 23.6 KB)
  - `plank-drop-1.ogg` (0.40 s, 6.7 KB), `plank-drop-2.ogg` (0.50 s, 7.3 KB), `plank-drop-3.ogg` (0.50 s, 7.0 KB), `plank-stack.ogg` (1.95 s, 16.7 KB)
  - `conveyor-belt.ogg` (4.70 s loop, 34.8 KB)

## What Could Not Be Verified / Honest Quality Notes
- **Not listened to by ear**: Cut windows and loop steadiness were selected by RMS/spectral-centroid/onset measurements (`numpy`), not human listening. Needs a quick ear-check before copying into `dist/assets/sounds/`.
- **Strongest / most modern**:
  - `sawmill-blade-idle.ogg` (Freesound 528163, modern vertical panel saw in a sawmill, `cv=0.026` RMS stability) and `sawmill-blade-stop.ogg` (Freesound 449118, modern Elite 80 table saw spin-down) sound clean and modern industrial.
  - `chainsaw-idle.ogg` and `chainsaw-cut.ogg` (Freesound 431741, `cv=0.028` cutting loop) are from the same saw so idle-to-cut transitions match in tone.
  - `axe-chop-1..4.ogg` (Freesound 706978) are four crisp, isolated hits into a standing tree trunk with -60 dB silence between hits.
- **Weakest / caveats**:
  - `chainsaw-start.ogg` and `chainsaw-stop.ogg` come from Freesound 637359 (different saw from 431741's idle/cut) because 431741 did not have a clean isolated pull-cord start and shut-off; ear-check whether the timbre shift between start -> idle is noticeable. (Backup modern battery chainsaw: Freesound 595765 "Chainsaw Stihl MSA 200 C" was downloaded to scratch if a battery saw is ever wanted.)
  - `sawmill-blade-cut.ogg` (Freesound 501169, 2x6 circular saw cut) is from a different saw than `sawmill-blade-idle.ogg` (528163), though both sit in the modern circular/panel saw timbre range (~3.8-4.9 kHz centroid).
  - `log-drop-2.ogg` and `log-drop-3.ogg` (Freesound 659430 "Wood log impact reverbed pack") have slight natural room/forest reverb tail compared to `log-drop-1.ogg` (681416).
  - `conveyor-belt.ogg` (Freesound 478247) was very quiet in the raw recording (-61 dBFS rms) and was boosted ~41 dB to -20 dBFS rms; ear-check for hiss/noise floor.
  - Freesound MP3 previews (`-hq.mp3`) were used instead of lossless originals (Freesound original downloads require login).

## Exact Wiring Plan (for Opus / Sonnet in next stage; no shared files edited here)

1. **Copy assets**: Copy `assets-src/sounds-timber/*.ogg` -> `dist/assets/sounds/`.
2. **Pure registry (`dist/timber-sounds.js` or add to `dist/vehicle-sounds.js`)**:
   - Export `TIMBER_CLIPS`:
     - `AXE_CHOPS = ['axe-chop-1','axe-chop-2','axe-chop-3','axe-chop-4']`
     - `TREE_FALL = 'tree-fall'`, `TREE_THUD = 'tree-thud'`
     - `LOG_DROPS = ['log-drop-1','log-drop-2','log-drop-3']`
     - `CHAINSAW = {start:'chainsaw-start', idle:'chainsaw-idle', cut:'chainsaw-cut', stop:'chainsaw-stop'}`
     - `SAWMILL = {idle:'sawmill-blade-idle', cut:'sawmill-blade-cut', stop:'sawmill-blade-stop'}`
     - `PLANK_DROPS = ['plank-drop-1','plank-drop-2','plank-drop-3']`, `PLANK_STACK = 'plank-stack'`, `CONVEYOR = 'conveyor-belt'`
   - Register all 21 names in `ALL_FILES` (if tested by `tests/vehicle-sounds.mjs`), and load lazily via `want(...)` when logging or near the sawmill (never in `VEHICLE_SET`).
3. **`dist/audio.js` additions** (keeping existing synthesized `bladeTone`/`beltRumble` as fallback until decoded):
   - **One-shots with world falloff**: Add `worldShot(poolOrName, at, listener, level, rateJitter=0.06)` using `const a = attenuate(distance(listener, at)); if (a < 0.02) return false;` and `pickShot` / `shot(..., level * a, {rate: 1 + (random()-0.5)*rateJitter})`:
     - Axe chop (`chopTree` swing impact in `dist/game.js`): `AXE_CHOPS`, `level = 0.65`, `rateJitter = 0.08`.
     - Tree fall (`treeFelled` in `dist/game.js`): `TREE_FALL` (`level = 0.85`), then `TREE_THUD` (`level = 0.90`, `delay = 3.6` or synced to fall animation landing).
     - Log drop (`putDownLog` / trunk bucked in `dist/game.js`): `LOG_DROPS`, `level = 0.70`, `rateJitter = 0.08`.
     - Plank drop (`putDownPlanks` / `stackPlanks` in `dist/game.js`): `PLANK_DROPS`, `level = 0.60`, `rateJitter = 0.08`; `PLANK_STACK` (`level = 0.65`) when a full stack lands on a rack/pile/bed.
   - **Chainsaw state machine** (`audio.chainsaw({active, cutting, at, listener})` called from `game.js` frame loop):
     - On `active: true` transition: play `chainsaw-start` (`level = 0.75 * a`), then cross-fade into `chainsaw-idle` loop (`level = 0.55 * a`).
     - While `active`: cross-fade between `chainsaw-idle` (`0.55 * a`) and `chainsaw-cut` (`0.75 * a`) based on `cutting`.
     - On `active: false` transition: fade out active loop and play `chainsaw-stop` (`level = 0.65 * a`).
   - **Sawmill upgrade in `audio.update({listener, blade, belt})` (`dist/audio.js:126-133`)**:
     - When `sawmill-blade-idle` and `sawmill-blade-cut` are decoded in `buffers`: mute `v.bladeToneGain` / `v.bladeHissGain` (set to `0`) and drive the two looping `BufferSource` nodes with `b = attenuate(distance(listener, blade.at)) * blade.level`:
       - `idle` gain: `0.55 * b * (1 - 0.75 * load)`, `playbackRate`: `0.85 + 0.25 * blade.level`
       - `cut` gain: `0.75 * b * load`
     - On `blade.level` dropping from `> 0.2` to `0` (saw switched off): play `sawmill-blade-stop` (`level = 0.65 * attenuate(distance(listener, blade.at))`).
     - Optional `conveyor-belt`: when decoded, replace `v.beltRumbleGain` / `v.beltHumGain` with `conveyor-belt` loop at `gain = 0.45 * attenuate(distance(listener, belt.at)) * belt.level`.
