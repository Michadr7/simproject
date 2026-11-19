michadr.

# Toast sound candidates (round 2)

8 CC0 candidates (asked 8-10) in assets-src/sounds-sweep/candidates2/, each as .ogg and .wav, mono 22.05 kHz, 10 ms fade-in, 40 ms fade-out, peak -12 dBFS. Details per file in candidates2/README.md. Licence read from each Freesound page (all CC0 1.0). Previews downloaded directly from the Freesound CDN, processed with Blender 5.2 aud + numpy. candidates/ and ui-toast.ogg untouched. No git, no tests, no index.

| File | Character | Length s | Source |
|---|---|---|---|
| toast2-01-kalimba-g4-soft | kalimba | 0.70 | https://freesound.org/people/hollandm/sounds/691805/ |
| toast2-02-kalimba-b3 | kalimba (lower) | 0.70 | https://freesound.org/people/nemaavla/sounds/441134/ |
| toast2-03-woodblock-soft | wood tap | 0.15 | https://freesound.org/people/hollandm/sounds/692828/ |
| toast2-05-soft-pluck | pluck | 0.70 | https://freesound.org/people/nomiqbomi/sounds/578807/ |
| toast2-06-music-box-note | music box | 0.70 | https://freesound.org/people/thomasjaunism/sounds/218459/ |
| toast2-07-felt-note-e-soft | soft felt/piano-like note (dark) | 0.70 | https://freesound.org/people/pinevoc/sounds/473624/ |
| toast2-08-soft-bell-ding | soft bell | 0.70 | https://freesound.org/people/LegitCheese/sounds/571513/ |
| toast2-09-marimba-first-note | marimba | 0.35 | https://freesound.org/people/Ryan_Ouellette4706/sounds/805919/ |

6 character types: kalimba, wood, pluck, music box, felt note, bell, marimba.

## Not verified
- Nobody listened. Judgement of warmth/obviousness is by measurement only (spectral centroid 725-2580 Hz, <4% energy above 4 kHz after processing).
- 01, 02, 03, 08 were low-passed at 2.5 kHz because raw clips were bright; may sound duller than the originals.
- 09 marimba is cut from a trill; a second note could leak into the end. 07 source instrument is only guessed from its title. 06 is the loudest by rms (-20.8 dBFS) so may feel more present than the rest at the same peak.
- Tails of 0.70 s clips are cut by the 40 ms fade, not natural silence.

## Skipped
- 556139 Tibetan bell muted and 732950 music box F6: processed, still too bright (centroid > 4.4 kHz), deleted.
- No CC0 single marimba note or felt mallet note found by search (only VSCO/Samulis marimba hits that are CC-BY); paper/cloth rustle not included because the CC0 hits were long noisy recordings without a tone.
- Freesound API/login not needed; nothing blocked.
