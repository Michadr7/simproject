# Neo: WebGPU freezes, find the cause (READ-ONLY investigation, no source edits)

Read AGENTS.md rules first (they apply in full), context.md lines 1-45, notes/handoff.md lines 1-16. Then read notes/eval/outbox/webgpu-drawindexed.md in full (it has the suspects and a shader-build logging snippet) and notes/eval/outbox/webgpu-T6.md (perf probe, ?perf=1).

Problem (owner, live 0.36.2, WebGPU is the default; ?webgpu=0 is the old WebGL path and is clean): short freezes in normal play, and a 1-4 second pause when the game starts. Suspects, none measured yet:
1. headlight SpotLight added/removed at runtime (dist/night-lights.js ~116-118),
2. ground-cover materials created after warm-up (dist/ground-cover-view.js ~31-32),
3. window materials changing after warm-up at dusk (dist/night-lights.js ~94-97),
4. first use of a new vehicle, and the game start itself (what is compiled before the first frame?).
5. ENTERING THE NEIGHBORHOOD (owner, 2026-11-19): after pressing play on the menu, the first 4-7 seconds in the world have slight repeated freezes. This is the biggest item: measure every frame over 30 ms from the press of Play to 10 s later (frame time series, not only the mean), and name what runs in each spike (world/chunk building, ground cover, NPC/crowd spawn, model loads, shader pipelines, audio decode, lights). Check whether work that could run during the menu (warm-up, compile, decode) runs after Play instead, and whether spreading work over several frames would remove the spikes.

Task: find out which of these really cost time, with numbers.
- Use the headless Edge + DevTools harness (a copy may exist at C:\Users\Michael\AppData\Local\Temp\eden-webgpu; scripts/webgpu-diff.mjs shows how a page is driven). Serve dist/ with a tiny static server. If WebGPU is not available headless, say so and fall back to reading code plus the snippet's reasoning; do not guess numbers.
- Measure: (a) time from page load to the first rendered game frame, split into what the code does (read dist/game.js ONLY by line ranges found via PROJECT-INDEX.md or Grep; startup path, warm-up, compile calls); (b) frame time spikes over 30 ms at dusk (window change), when the headlights turn on, when a vehicle is entered, and when ground cover chunks appear. Use the snippet from the report that logs shader builds over 4 ms and the ?perf=1 probe.
- For the start pause, also list every await/load in the startup path that blocks the first frame (models, sounds, shader compile, map build) with its time.
- Do NOT edit any file except your report. Do not run git. Do not run npm test or release (nothing in dist/ changes).

Compare WebGPU (default) against ?webgpu=0 for the enter-neighborhood series: if WebGL is clean, the cause is WebGPU pipeline creation; if both spike, it is our own world/spawn work.

Report: notes/eval/outbox/neo-webgpu-freezes.md. First line "michadr.". Sections: what you measured and how (exact commands), a table suspect -> measured ms -> verdict, the start-up timeline, and a ranked fix list where each fix names the file, function and the exact change (so the main chat can apply it; game.js edits are NOT yours). Also say whether a loading screen would hide the start pause or whether the pause can be removed (for example by compiling shaders during the menu). Say plainly what you could not verify and your confidence per finding. Never claim a number you did not measure.
