# Gemini prompt: lumber sounds (stage SND2, sourcing and processing only). Use your strongest reasoning model.

Eden Ridge is a buildless Three.js browser game. Read first: AGENTS.md (hard rules: no git, no BOM, never edit the shared dist files; tell me exact edits instead), context.md lines 1-45, then dist/vehicle-sounds.js and the section "Vehicle, crash and yell sounds (SND1)" of ASSETS.md (search ASSETS.md for "SND1"). That is how the project does recorded sound: Ogg Vorbis, mono, 22.05 kHz, files in dist/assets/sounds/, every clip listed in ASSETS.md with source, author, URL and the cut used, ALL CC0. Do the same for lumber. Do not read big files whole.

Today the axe and tree felling are silent, the chainsaw has no sound, and the sawmill blade is a synthesized sawtooth in dist/audio.js. The owner wants real recordings, and NEWER-sounding saws (a modern gas or battery chainsaw, a modern sawmill / band saw / circular saw, not an old rusty one).

Find and prepare these clips (CC0 only; Freesound, Pixabay-CC0 style sites, BBC is NOT allowed; if a source is not CC0 skip it and say so):
1. axe-chop-1..4: an axe or hatchet biting into standing pine, dry, one chop each, 0.3 to 0.6 s, with small variations.
2. tree-fall: a tree creaking and then crashing, 3 to 5 s, plus tree-thud: the trunk landing, 0.6 to 1.0 s.
3. log-drop-1..3: a log or trunk dropped on the ground / on a pile, 0.4 to 0.8 s.
4. chainsaw-start: pull-cord and catch, 2 to 3 s. chainsaw-idle: loop, 3 to 6 s, seamless. chainsaw-cut: loop of cutting wood at full revs, 3 to 6 s, seamless. chainsaw-stop: spin down, 1 to 2 s. Modern saw (Stihl/Husqvarna class).
5. sawmill-blade-idle: loop (blade spinning free), sawmill-blade-cut: loop (blade cutting a log, bigger and lower than the idle), sawmill-blade-stop: spin down, 2 to 3 s. Industrial but modern.
6. plank-drop-1..3: boards dropped or stacked on a pile, 0.3 to 0.6 s; plank-stack: a few boards laid down in a row, 1 to 2 s.
7. optional: conveyor-belt loop (steady rubber belt with wood on it).

Processing (ffmpeg if installed; check with `ffmpeg -version`; if it is missing say so and write the exact commands instead): cut to the part you want, mono, 22.05 kHz, Ogg Vorbis (-q:a 3), loops get a 0.3 s cross-fade so they are seamless and are normalised to -20 dBFS rms, one-shots get a 10 ms fade-in and 30 ms fade-out and peak at -4 dBFS. Keep every file under 120 KB (the whole set under 1.5 MB).

Output goes in a NEW folder assets-src/sounds-timber/ (NOT dist/): the .ogg files named exactly as above, plus a README table in the same shape as the SND1 rows of ASSETS.md (file, source title + id, author + URL, cut used, loudness). If you cannot download from the internet, do not invent anything: list for each clip the best candidate URLs (with the licence line you saw) so the owner can download them, and stop.

Also write notes/eval/outbox/SND2.md (first line "michadr."): what you got, what you could not get, honest quality notes (which clips sound modern, which are the weakest), file sizes. Do NOT edit dist/audio.js or game.js: at the end list the exact wiring plan (which game event plays which clip, which loops need start/stop, volume levels, distance falloff via the existing attenuate()), so Opus or Sonnet can wire it in the next stage.