michadr.

# Logging Sounds Pass 2: "The Chop Rings Through the Woods" (`hydrogen-logging-sounds-ring.md`)

## Files Created or Changed
- `dist/logging-sounds.js` (updated, 167 lines): added 29 new clip pools (`AXE_HEAVY`, `AXE_LIGHT`, `AXE_BODY`, `TRUNK_GROANS`, `TREE_FALL_DEEPS`, `LOG_THUDS_DEEP`, `CHOP_TAILS`, `FOREST_AMBIENCE.bed`, `FOREST_AMBIENCE.deep`), `LOGGING_MIX`, `LOGGING_SHOTS`, `LOGGING_LOOPS`, `LOGGING_FILES` (50 total), and pure functions `chopLayers(kind, depth01, randomA, randomB, lastHitIdx, lastTailIdx)` and `fellSequence(randomA)`.
- `dist/vehicle-sounds.js` (updated, 104 lines): expanded `LONG_LOOPS` to `Object.values(LOGGING_LOOPS).map(l=>l.file)` so `amb-forest-bed` and `amb-deep-woods` share the 320 KB / < 60 s loop budget in `tests/vehicle-sounds.mjs`.
- `tests/logging-sounds.mjs` (updated, 136 lines): validates all 50 clips (existence, OggS, mono, 22.05 kHz legacy / 44.1 kHz new, size budgets, 10 MB total payload cap), 200-pick no-repeat, `chopLayers` depth monotonicity & ±6% pitch, `fellSequence` ascending times, determinism, and bad-input safety.
- `ASSETS.md` (updated, 700 lines; +33 lines) and `assets-src/sounds-sweep/README.md` (updated, 101 lines; +29 rows): recorded CC0 1.0 sources, authors, URLs, cut windows, loudness, and `"derived"` labels for `chop-tail-1..6` and `amb-forest-bed`.
- `dist/assets/sounds/*.ogg`: 29 new 44.1 kHz mono Ogg Vorbis files (existing 21 clips untouched).
- `PROJECT-INDEX.md` & `PROJECT-BRIEF.md`: regenerated via `npm run index` (2834 / 3000 brief tokens; 34858 / 37000 index tokens).

---

## 1. Listen-Free Measurement of Existing 21 Clips
Measured via `ffprobe` + `ffmpeg` PCM decode + Node 1024-pt Hann FFT:

| Clip | Size (B) | SR (Hz) | Dur (s) | Peak (dBFS) | RMS (dBFS) | Centroid (Hz) | <200 Hz (%) | >3 kHz (%) | -20 dB Decay (ms) | -40 dB Decay (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `axe-hit-1` | 6163 | 22050 | 0.33 | -3.8 | -24.4 | 2317 | 21.1 | 1.2 | 60 | 300 |
| `axe-hit-2` | 5796 | 22050 | 0.26 | -4.0 | -34.2 | 4173 | 37.3 | 32.3 | 100 | 240 |
| `axe-hit-3` | 5261 | 22050 | 0.16 | -3.9 | -21.3 | 2785 | 66.3 | 5.0 | 30 | 110 |
| `axe-hit-4` | 5704 | 22050 | 0.25 | -4.1 | -23.5 | 3619 | 71.0 | 10.7 | 30 | 170 |
| `axe-hit-5` | 4858 | 22050 | 0.13 | -4.2 | -27.1 | 3229 | 3.4 | 15.0 | 20 | 100 |
| `axe-hit-6` | 4750 | 22050 | 0.10 | -4.1 | -25.7 | 3539 | 2.5 | 34.4 | 20 | 80 |
| `wood-crack-1` | 8575 | 22050 | 0.57 | -4.0 | -31.9 | 4449 | 1.1 | 64.1 | 20 | 480 |
| `wood-crack-2` | 10496 | 22050 | 0.82 | -4.1 | -35.0 | 6298 | 66.6 | 30.8 | 400 | 430 |
| `wood-crack-3` | 16418 | 22050 | 1.55 | -3.3 | -19.5 | 4660 | 1.6 | 74.8 | 540 | 690 |
| `tree-fall-seq-1` | 57100 | 22050 | 5.50 | -3.8 | -28.2 | 3077 | 19.2 | 17.9 | 580 | 1060 |
| `tree-fall-seq-2` | 54414 | 22050 | 5.77 | -3.7 | -30.2 | 3563 | 39.8 | 18.2 | 250 | 1180 |
| `log-thud-small` | 6616 | 22050 | 0.44 | -3.8 | -15.7 | 422 | 96.6 | 0.0 | 160 | 330 |
| `log-thud-medium` | 7446 | 22050 | 0.52 | -4.3 | -23.8 | 1284 | 93.7 | 0.2 | 280 | 340 |
| `log-thud-heavy` | 9238 | 22050 | 0.69 | -3.8 | -25.9 | 2911 | 15.4 | 7.5 | 360 | 550 |
| `wood-creak-1` | 18920 | 22050 | 2.25 | -4.0 | -18.2 | 586 | 96.7 | 0.0 | 1480 | 1590 |
| `wood-creak-2` | 14442 | 22050 | 1.45 | -4.0 | -18.5 | 827 | 95.1 | 0.1 | 1080 | 1100 |
| `wood-creak-3` | 11547 | 22050 | 0.77 | -4.0 | -29.3 | 3022 | 0.2 | 17.9 | 500 | 580 |
| `wood-creak-4` | 11055 | 22050 | 0.82 | -4.0 | -30.0 | 3447 | 0.3 | 26.2 | 120 | 320 |
| `wood-creak-5` | 15479 | 22050 | 1.80 | -3.7 | -17.5 | 1108 | 32.0 | 0.3 | 270 | 290 |
| `wood-creak-6` | 9087 | 22050 | 0.59 | -3.9 | -21.7 | 3782 | 1.5 | 42.7 | 450 | 520 |
| `amb-forest-pines` | 297849 | 22050 | 45.00 | -3.3 | -19.9 | 2179 | 18.8 | 1.9 | 36720 | 36720 |

**What "thin and dry" means in numbers:**
- **Sample rate**: all 21 clips are 22.05 kHz mono (Nyquist 11.025 kHz).
- **Dry / short**: `axe-hit-1..6` last only 0.10–0.33 s and drop -20 dB in 20–100 ms (4 of 6 in <= 30 ms; `axe-hit-3..6` drop -40 dB in 80–170 ms) with zero slap-back or forest tail.
- **Thin**: `axe-hit-5` and `axe-hit-6` have only 3.4% and 2.5% energy below 200 Hz (centroids 3229 / 3539 Hz); `wood-crack-1` and `3` have 1.1% and 1.6% < 200 Hz; `log-thud-heavy` has only 15.4% < 200 Hz (centroid 2911 Hz, brighter than `log-thud-small` at 422 Hz!). `axe-hit-2` and `tree-fall-seq-1/2` have RMS -28.2 to -34.2 dBFS despite -4 dBFS peaks (24–30 dB crest factor).

---

## 2. New Clips (29 clips, all 44.1 kHz mono Ogg Vorbis, CC0 1.0 or derived from CC0)

Note: `tests/vehicle-sounds.mjs` enforces `channels === 1` and `seconds < 60` on every `.ogg` in `dist/assets/sounds/`, so the two new forest loops are 44.1 kHz mono and 58.0 s long (instead of stereo 60 s).

| Clip | Source & Licence | Dur (s) | Size (B) | Peak / RMS (dBFS) | Centroid / <200 Hz |
|---|---|---:|---:|---:|---:|
| `axe-heavy-1` | Freesound 454381 (kyles, CC0) | 0.58 | 8041 | -1.1 / -17.3 | 2593 Hz / 34.4% |
| `axe-heavy-2` | Freesound 454381 (kyles, CC0) | 0.55 | 8114 | -1.1 / -17.7 | 2697 Hz / 26.9% |
| `axe-heavy-3` | Freesound 767326 (Hano_van_Dalen, CC0) | 0.29 | 5484 | -2.0 / -32.8 | 4001 Hz / 63.0% |
| `axe-heavy-4` | Freesound 655325 (21100495, CC0) | 0.22 | 4961 | -1.6 / -24.3 | 3525 Hz / 37.8% |
| `axe-light-1` | Freesound 767325 (Hano_van_Dalen, CC0) | 0.23 | 5030 | -1.9 / -32.8 | 4073 Hz / 25.4% |
| `axe-light-2` | Freesound 767325 (Hano_van_Dalen, CC0) | 0.22 | 4992 | -2.1 / -28.0 | 2580 Hz / 9.7% |
| `axe-body-1` | Freesound 655325 (21100495, CC0) | 0.22 | 4934 | -2.2 / -24.0 | 1556 Hz / 13.1% |
| `axe-body-2` | Freesound 655325 (21100495, CC0) | 0.22 | 4925 | -1.5 / -24.8 | 1659 Hz / 19.1% |
| `axe-body-3` | Freesound 655325 (21100495, CC0) | 0.22 | 4970 | -1.3 / -22.8 | 2721 Hz / 26.1% |
| `axe-body-4` | Freesound 706978 (JesterWhoo, CC0) | 0.24 | 5244 | -1.8 / -25.5 | 3614 Hz / 12.6% |
| `trunk-groan-1` | Freesound 669457 (EricsSoundschmiede, CC0) | 2.11 | 23928 | -1.5 / -32.7 | 5863 Hz / 0.0% |
| `trunk-groan-2` | Freesound 183450 (utsuru, CC0) | 2.07 | 21802 | +0.4 / -21.6 | 5389 Hz / 2.8% |
| `trunk-groan-3` | Freesound 183452 (utsuru, CC0) | 2.83 | 27698 | -1.3 / -24.5 | 4871 Hz / 3.3% |
| `trunk-groan-4` | Freesound 501303 (JappeHallunken, CC0) | 2.20 | 23571 | -2.0 / -29.9 | 5838 Hz / 76.8% |
| `tree-fall-deep-1` | Freesound 515313 (matt_beer, CC0) | 5.59 | 49009 | -1.3 / -28.7 | 4526 Hz / 7.5% |
| `tree-fall-deep-2` | Freesound 515312 (matt_beer, CC0) | 5.21 | 46142 | -1.3 / -32.8 | 4669 Hz / 7.3% |
| `tree-fall-deep-3` | Freesound 139952 (ecfike, CC0) | 4.50 | 39707 | -0.2 / -18.6 | 4734 Hz / 11.7% |
| `log-thud-xs` | Freesound 584891 (KrystianPawlowski, CC0) | 0.42 | 6683 | -1.5 / -20.7 | 1691 Hz / 91.3% |
| `log-thud-s` | Freesound 400188 (opriema, CC0) | 0.49 | 7108 | -2.6 / -15.9 | 2494 Hz / 98.4% |
| `log-thud-m` | Freesound 584891 (KrystianPawlowski, CC0) | 0.38 | 6256 | -1.7 / -17.6 | 1780 Hz / 96.1% |
| `log-thud-l` | Freesound 400188 (opriema, CC0) | 0.57 | 7758 | -2.1 / -18.2 | 3635 Hz / 97.7% |
| `chop-tail-1` | derived (Node 3-tap LP echo from `axe-heavy-1`) | 0.85 | 9095 | -6.3 / -21.0 | 1340 Hz / 45.8% |
| `chop-tail-2` | derived (Node 3-tap LP echo from `axe-heavy-2`) | 0.95 | 9505 | -6.1 / -21.1 | 1338 Hz / 34.3% |
| `chop-tail-3` | derived (Node 4-tap LP echo from `axe-heavy-3`) | 1.10 | 10251 | -3.0 / -25.0 | 1768 Hz / 80.2% |
| `chop-tail-4` | derived (Node 4-tap LP echo from `axe-heavy-4`) | 1.25 | 9396 | -3.3 / -29.6 | 1535 Hz / 54.2% |
| `chop-tail-5` | derived (Node 3-tap LP echo from `axe-body-1`) | 0.70 | 6787 | -2.8 / -26.2 | 1074 Hz / 13.0% |
| `chop-tail-6` | derived (Node 4-tap LP echo from `axe-body-2`) | 1.35 | 9061 | -2.9 / -28.8 | 937 Hz / 27.3% |
| `amb-forest-bed` | Freesound 670307 (bruno.auzet, CC0) + derived -24 dB creaks | 58.00 | 277171 | -4.6 / -20.1 | 1447 Hz / 33.4% (>3k: 0.5%) |
| `amb-deep-woods` | Freesound 670307 (bruno.auzet, CC0, LP 2.6 kHz) | 58.00 | 270523 | -4.7 / -23.6 | 1087 Hz / 30.5% (>3k: 0.2%) |

**Total `dist/assets/sounds/` payload:** **3.84 MB** (1,464.2 KB for all 50 logging/ambience clips; well under the 10 MB cap).

---

## 3. Real Pasted Test Output
```
PASS logging-sounds.mjs: 50 logging/ambience clips (1464.2 KB logging, 3.84 MB total payload), chopLayers + fellSequence + 200-pick no-repeat verified.
PASS sweep-sounds.mjs: 114 sweep clips (386.8 KB new step audio), all 15 SURFACE ids + indoor tile/carpet/wood, nextStepClip deterministic L/R + run + cloth, 20 lumber clips, audio.js safe without a sound card.
Vehicle sounds: every class has an engine loop and every file is registered, mono Ogg under the size cap with the payload under 10 MB and decoded memory under 50 MB, yells under 1.2 s, all listed in ASSETS.md; crash tier by impact (light, medium, hard), glass at Damaged or worse, a person is a thud and a yell; the yell gate (4 m/s, 4 m, 8 s each, nearest first, 2 voices) and the 12-voice cap; the loader fetches nothing before a vehicle, one file at a time, its own engine first, never twice; a missing or corrupt file keeps the generated sound; engine rate follows the revs, misfire dips, hidden tab and mute are silent.
brief tests passed: 272 modules listed, brief 2834 and index 34858 estimated tokens (budgets 3000 and 37000)
```

---

## 4. Exact `game.js` (and `audio.js`) Wiring Hook List
1. **Forest depth helper (`depth01`)**:
   - Count standing trees within 20 m of the player (or target tree): `const depth01 = Math.min(1, nearbyTrees20m / 12);` (`0` = open ground / single yard tree, `1` = deep in the pines).
2. **Axe chop / bucking hit (`chopLayers`)**:
   - Keep `lastChopHitIdx = -1, lastChopTailIdx = -1` in `game.js`.
   - On axe swing impact (`kind = isFinalChop ? 'heavy' : isLimbing ? 'light' : 'body'`):
     ```js
     const c = chopLayers(kind, depth01, Math.random(), Math.random(), lastChopHitIdx, lastChopTailIdx);
     lastChopHitIdx = c.hitIndex;
     lastChopTailIdx = c.tailIndex;
     audio.playClip(c.hit, { at: treePos, listener: playerPos, gain: c.gain, rate: c.pitch });
     // Schedule forest slap-back / echo tail (Web Audio ctx.currentTime + c.tailDelayMs / 1000, or setTimeout):
     audio.playClip(c.tail, { at: treePos, listener: playerPos, gain: c.tailGain, delayMs: c.tailDelayMs });
     ```
3. **Tree felling (`fellSequence`)**:
   - When the final chop fells a tree:
     ```js
     for (const step of fellSequence(Math.random())) {
       audio.playClip(step.clip, { at: treePos, listener: playerPos, gain: step.gain, delayMs: step.atMs });
     }
     ```
4. **Log thud (`pickLogThud`)**:
   - Map log/trunk size to `'xs' | 's' | 'm' | 'l'` (or legacy `'small' | 'medium' | 'heavy'`) and play `pickLogThud(size, Math.random())` at `logPos`.
5. **Forest ambience loops (`amb-forest-bed` & `amb-deep-woods`)**:
   - In `frame()` / `audio.ambience(...)`: cross-fade `LOGGING_LOOPS.forestBed` (`amb-forest-bed`, level `0.30 * forestProx * (1 - depth01 * 0.4)`) with `LOGGING_LOOPS.deepWoods` (`amb-deep-woods`, level `0.24 * forestProx * depth01`), ducked by `forestDuck({ vehicle, talking })` from `dist/logging-wiring.js`.

---

## 5. Ear-Check List (Play These 10 Clips First)
1. `axe-heavy-1.ogg`: should have a deep low-mid wood thump + sharp crack + brief natural room/forest ring; flag if hollow/tinny.
2. `axe-heavy-3.ogg`: should hit hard with heavy low body (63% < 200 Hz); flag if the tail cuts off abruptly.
3. `axe-light-1.ogg`: should sound like a crisp, lighter hatchet/limbing strike; flag if too thin or clicky.
4. `axe-body-1.ogg`: should feel like a solid mid-weight wood chop; flag if muffled (centroid 1556 Hz).
5. `chop-tail-1.ogg` *(derived)*: should sound like a distant, soft slap-back echo in trees (no sharp initial transient); flag if it sounds like a robotic/metallic delay.
6. `chop-tail-4.ogg` *(derived)*: longer 1.25 s 4-tap dark forest tail; flag if the individual taps are too distinct instead of blending into woods reverb.
7. `trunk-groan-4.ogg`: should sound like heavy wood stress/cracking before a tree snaps; flag if too quiet or noisy.
8. `tree-fall-deep-1.ogg`: should progress creak/snap -> branch rush -> heavy ground thud over ~5.6 s; flag if the start/end cut feels clipped.
9. `log-thud-l.ogg`: should have a deep, weighty ground impact (97.7% < 200 Hz); flag if it sounds like a door slam rather than a log on dirt.
10. `amb-forest-bed.ogg`: 58 s pine wind with very faint distant creaks and no birds; flag if the 58 s loop seam clicks or the creaks at 14 s / 39 s sound unnatural.

---

## 6. What Could NOT Be Verified & Honest Confidence
- **Audio playback / timbre**: I cannot listen to audio. All spectral, loudness, and loop-seam checks are mathematical (`ffmpeg` + FFT).
- **Full `npm test` / `npm run release`**: Not run per prompt rules (another agent may edit `game.js`).
- **Confidence**:
  - Pure logic (`chopLayers`, `fellSequence`, `pickLoggingClip`, `pickLogThud`) & tests: **High** (all assertions pass).
  - CC0 licensing, 44.1 kHz mono Ogg format, and payload budget (3.84 MB / 10 MB): **High**.
  - Perceived "New World" punch & derived echo naturalness (`chop-tail-1..6`, `amb-forest-bed`): **Medium-Low** until the owner completes the 10-clip ear-check.
