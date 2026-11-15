# To do after the weekly reset (Tuesday 2026-11-17 08:00). Written 2026-11-14 at 94% weekly.

Rule: never reach 100% weekly; stop launching agents at about 92 to 95%. Ask the user for the meter before each agent. Ask before switching model or agent. One stage per run, report after each.

## State when this was written
- Uncommitted (the user commits in the hub): 0.35.8 with I1, I2, BZ1, the Kasumuchi S70 (shortbed, V7 model, interior, lights, doors, seated driver), the cargo bed for the S70 (44 planks), ATV V1 files and previews, hotel props, register entries (hotel-props, atv-default), notes. npm test: 170 of 170.
- Not deployed: 0.35.8 (so `npm run release -- --force` is allowed for it).

## DONE 2026-11-17 (committed by the user): F1, F2, F3, RU6 and the fork-sign move. 0.35.9, npm test 172 of 172 (about 126 s). Limits left: draw calls still over 300 (about 300 come from game.js city meshes, about 500 unmerged Meshes); hills, fields, dirt roads, pavements, landmarks, props and street-furniture parts still global; whole 0.5 m mask (old ground, 3.4 MB) still built in the browser; night-lights and minimap have no add/remove hooks (view.on('build'|'dispose') unwired); edge scenery belts not at the new edges; player leaves the old block only through the Freight South gate (x 290..300). Next: a draw-call stage "F2b", then items 2 to 5 below.

## Order
1. [DONE: F1, F2, F3, RU6] F1 streaming (Sonnet 5.5, notes/streaming-brief.md). The user's answers: short fade (about 0.3 s) only when a teleport target is outside the loaded ring, spawn/load behind the loading screen; a wall at the ring edge if streaming lags; far trucks and NPCs keep moving on the road graph (no meshes, no collision), nothing freezes near the player; the whole-map mask stays in tests only unless the map screen needs a coarse one (undecided); target the highest FPS we can, 144 acceptable. Then F2, F3, RU6.
2. S70 small fix stage (Sonnet, about 50k): (a) the cab's rear wall is single-sided so you can see out the back from inside: add an inner rear wall or draw the cab double-sided; (b) the user's lag question (below); (c) check seated driver from outside and hands at full lock; (d) gas-station canopy clearance for the 2.41 m roof.
3. ATV: Sol's V5 is the best base (see below). Run `node scripts/glb-inspect.cjs` and `glb-tree.cjs` on it, then a Sonnet conform job (30 to 50k, no modelling) to the contract in notes/atv-model-prompt.md. Stage A4 puts it in the game later. Fable pass only if the user says yes.
4. C1 collision feel (notes/collision-feel.md), after F1.
5. Damage build VD1 to VD4 in P6 (notes/vehicle-damage-design.md, section 12 has the user's decisions; repair price approved: 25% of price scaled by damage, minimum $25).

## Open questions and diagnostics
- Lag when entering and leaving the S70: cause not found (two 250 ms stalls on the first enter at night). Ask: every time or only the first time, day or night? Cheap fix candidate: add the SpotLight at dusk, not on enter.
- Smear when moving (user report 2026-11-14): happens whenever moving, worst at a sideways view angle, on foot and in vehicles; the screenshot is sharp (so the drawn frame is sharp); turning shadows off did not obviously fix it (the user's sentence was unclear: ask again). The engine has no motion blur, no post-process, no temporal AA, no camera easing found in game.js. Suspects: display sample-and-hold blur or overdrive, browser frame pacing, camera or player update order. Tests for the user: another 3D game or web demo at the same sweep, change monitor overdrive/refresh rate, v-sync on/off, a short screen recording. If nothing changes: measure frame pacing in the browser lab and check the order of player and camera updates in frame().
- Pedestrian hit as a crime with a fine (user said yes): changes notes/crime-system-design.md; decide in the L stages.
- Tow truck model: yes, later (user).
- Damage visuals: real dents wanted; crack textures made with headless Blender 5.2.
- Passengers seen inside vehicles in multiplayer: needs the M2..M5 seat sync (not built).
- Collision gap screenshot (S70 next to a parked car): ask which two objects.

## ATV status (2026-11-14)
- Ranking of the one-prompt tests: Sol first, Gemini Hydrogyn second, Sonnet 5.5 third; second round: Sol v2/V4/V5 best, Sonnet V2 better but toy-like. Prompts: notes/atv-model-prompt.md and notes/atv-round2-prompts.md.
- Sol V5 (screenshot 2026-11-14): bright headlight lenses, neat tread blocks, rims with bolts, bumper cage attached, tubular racks, tank cap, seat, foot platform. Remaining: fender plastics are flat angular slabs (bevel), small stray dark tabs/chips on the front rack and fenders (remove), front rack sits high over the cowl, no visible tail lenses from the front. The user must copy the file into assets-src\Vehicles\ATV\ (only my V1 is there).