# Hydro prompt: logging sounds pass 2, "the chop rings through the woods" (assets + pure files only; no game.js)

Read AGENTS.md rules first (context.md 1-45, notes/handoff.md 1-16; search PROJECT-INDEX.md, never read big files whole). You may NOT edit dist/game.js, world.js, map-definition.js, driving.js, vehicle.js, terrain.js, props-assets.js, audio.js, dist/phone*.js, scripts/build-index.mjs, notes/handoff.md. Never run git. Write files without a BOM. Another agent may edit game.js: never run the full `npm test`; run `node tests/<name>.mjs` for your own tests plus tests/logging-sounds.mjs, tests/sweep-sounds.mjs and tests/vehicle-sounds.mjs.

## What the owner said (2026-11-19, after playing 0.36.2)
The slower axe animations are good, but the sounds are not "New World" immersive yet. "The chopping should ring through the woods." Meaning: each axe hit is a sharp, weighty bite with a bright crack on top and a low body under it, and then the sound TRAVELS: a short slap-back and a tail that echoes through the trees, different on every hit. Felling a tree should be an event you hear across the forest: creaking, a loud crack, the rush of the fall, a heavy ground thump.

## Already in the repo (pass 1; read before adding, do not throw it away)
dist/logging-sounds.js (pure registry + non-repeating pickers pickLoggingClip, pickLogThud), 21 CC0 mono 22.05 kHz clips in dist/assets/sounds/ (axe-hit-1..6, wood-crack-1..3, tree-fall-seq-1..2, log-thud small/medium/heavy, wood-creak-1..6, amb-forest-pines loop), wiring in dist/logging-wiring.js and audio.js (audio.logging). Report: notes/eval/outbox/logging-sounds.md and logging-sounds-wiring.md. The owner finds these too thin, too dry and too short.

## Do
1. LISTEN-FREE ANALYSIS FIRST. You cannot listen. Measure the existing clips (length, peak, RMS, spectral centroid, how fast the tail decays, sample rate) with a small Node script and write a table in your report. State what "thin and dry" means in numbers (for example: 22.05 kHz mono, tail under 150 ms, little energy under 200 Hz).
2. NEW SOURCE CLIPS, CC0 only (Freesound CC0, OpenGameArt CC0, Kenney; record URL, author, licence per clip as README rows in assets-src/sounds-sweep/README.md). Wanted, 44.1 kHz where the source has it (the owner lifted the payload cap to 10 MB, current payload 2.93 MB, so you have about 6 MB; report the total):
   - 8+ axe-on-wood hit variants with real body (low thump) and a bright crack; no two alike; at least 2 "heavy" (felling blow) and 2 "light" (limbing).
   - 4 wood-crack / trunk-groan layers for the moment before the tree goes.
   - 3 tree-fall sequences (creak, snap, whoosh of branches, ground thud with leaf rustle), 3 to 6 s each.
   - 4 log-thud sizes with a deep sub tail.
   - 6 forest-tail / slap-back one-shots (the echo of a chop returning from the trees: roughly 300 ms to 1.5 s, soft, wide). If no good CC0 tails exist, build them yourself in Node: take a hit, apply 2 to 4 decaying delay taps with low-pass and slight pitch variation (an offline render, written as a WAV then converted), and say so in the README row as "derived".
   - A better forest bed: 60 s seamless loop, wind in pines plus faint distant creak, no birds, stereo if the budget allows; and a second quieter "deep woods" variant for far from any path.
3. Convert to the format dist/assets/sounds/ uses (check the extension, loudness and sample rate there; the existing files are .ogg). Normalise by loudness not peak, trim silence, fade tails. Keep names clear (axe-heavy-1..N, chop-tail-1..N, ...).
4. EXTEND dist/logging-sounds.js (it is a new file of yours from pass 1, so you may edit it) with: the new file lists, mix levels, and a pure function `chopLayers(kind, depth01, randomA, randomB)` that returns {hit, tail, tailDelayMs, tailGain, pitch, gain} for one axe hit: pick hit and tail non-repeating (injected randoms), tail delay 120 to 700 ms and tail gain growing with `depth01` (0 = open ground, 1 = deep in the pines), pitch +-6 percent, gain +-1.5 dB. Also `fellSequence(randomA)` returning timed steps [{atMs, clip, gain}] for creak -> crack -> fall -> thud so a game.js run only has to play the list. All pure: no DOM, no globals, no Date.now/Math.random, header comment first line says what it is.
5. TESTS in tests/logging-sounds.mjs (extend it; Node assert, one PASS line): every listed file exists and is non-empty, total payload under the cap, no repeat in 200 picks, tail delay and gain monotonic in depth, fellSequence times ascending, deterministic for equal inputs, never throws on bad input.
6. `npm run index` so new files appear (the cap is 37000; the index is about 34800 now; if over, say by how many tokens and stop).

## Not in scope
Wiring into game.js (the main chat does it from your report; give the EXACT hook list: where each hit, tail, fall step and the ambience loops should play, and a depth01 suggestion such as tree density within 20 m), changing existing clips, animation, tree hit counts, the tag and fill-ring visuals.

## Report: notes/eval/outbox/hydro-logging-sounds-ring.md
First line "michadr.". Include: the measurement table (old clips), every new clip with source and licence and loudness, total payload, real pasted test output, the exact game.js wiring list, an EAR-CHECK LIST for the owner (which 10 clips to play first, what each should sound like, what to say if it is wrong), what you could not verify (you cannot listen), and honest confidence. Never claim a sound is good; claim only what you measured.
