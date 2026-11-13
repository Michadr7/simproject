# Visual overhaul: brief for the build agent (DRAFT, 2026-11-13, not yet approved by the user)

Written for: the agent (Fable or Opus) that designs and builds the sky and day/night rig. Read PROJECT-BRIEF.md, notes/menu-scene-design.md and DESIGN.md first.

## Goal
A complete visual update of City Life: better lighting and shaders, a real day and night cycle, lights that matter at night. The main menu uses the same rig at the time saved in the profile (log out at night: night menu).

## The look
- Base: **Firewatch**. Flat, confident colour; a warm-to-cool sky gradient; strong haze that fades distance into the sky colour; low-poly shapes read well because of colour and fog.
- Night: **darker than Firewatch, lighter than Valheim.** Dark and moonlit blue, but the player can still read the street and the ground without a light. Make the darkness a number the user can tune (`NIGHT_FLOOR`, ambient at midnight, first guess 0.12 of day), with a dev slider. Light sources (lamps, windows, headlights) are the readable islands; a vehicle's headlights are the only way to see far.
- Not photoreal. Do not add detail that the models cannot carry.

## Hard rules
- **Target PC:** 8 GB RAM, about a GTX 1060. The Low tier (the game's existing quality setting) must run at the current frame rate: no shadows, no post effects, no extra real lights. High tier may add one directional shadow and soft bloom, each with a measured frame-time cost reported.
- **Draw calls stay about 300; skinned characters about 15; tree instances about 1,000.** Report any change with a number.
- **Night lights are glow materials, not real lights:** lamp posts, house windows, shop signs and vehicle lights are emissive meshes or sprites. At most ONE real light for the player's own headlights (a spotlight) on High; Low fakes it with a cone mesh or a ground decal.
- Vehicles: headlights on at night when in use (driver in, or NPC car moving); the player can switch their own on and off (a key, shown in the vehicle panel). Houses: windows lit in the evening according to a simple per-house rule (occupied hours), not per-frame work.
- Day and night follow the existing game clock (30 game minutes per real minute, `routine.minutes` in the profile). All lighting values are pure functions of the clock (`lightAt`-style), unit-tested.
- The menu snaps to four moods (dawn, day, dusk, night) blended smoothly from the real saved time.
- Keep `town.js`, `world.js`, `map-definition.js` changes minimal and additive. No new dependencies; Three.js is in `dist/vendor/`.
- `npm run release -- --force`, then tests; never use git; do not touch `hub/`.

## Stages (build one at a time, tests passing at each; report after each)
1. **Audit and design note** (no code): what the renderer, fog, lights, materials and the existing menu lighting do now and what each costs; propose the sky, the colour-grade curve, the night-light plan and the quality tiers. Write it to `notes/visual-overhaul-design.md` and stop for the user.
2. **Sky and day/night rig:** sky dome, sun and moon (angle from the clock), stars at night, fog and ambient by time, a final colour grade; the four moods table; unit tests for the pure functions.
3. **Night lights:** street lamps, windows, shop signs, vehicle headlights and the player's switch; Low-tier fakes.
4. **Shadows** (High only) and **materials/shader pass** (tone mapping, fake ambient occlusion, rim light, water and foliage wind).
5. **Post** (High only): soft bloom, vignette.
6. **Menu:** read the saved time, use the rig; drop the menu's own `lightAt`.

## Report format
Files changed, tests run with real results, measured costs (draw calls, triangles, frame time where measurable), and what is unverified (the agent browser is software WebGL, about 4 FPS: visuals and frame rate are unverified, say so).
