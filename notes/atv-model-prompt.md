# Prompt: model the game's default ATV (paste into any modelling agent)

You are modelling ONE vehicle for a browser game (Three.js, low-poly, flat colours): a four-wheel utility ATV, the kind a farm or ranger crew uses (think Honda Foreman or Polaris Sportsman, not a racing quad). Deliver a single glTF binary (.glb) that follows the contract below exactly. Work in Blender (headless or UI). Real-looking is the goal: a chunky, believable machine, not a box with wheels.

## Look (reference)
- Style: low-poly, flat colours, no textures, soft rounded plastics (like the user's Kasumuchi S70 truck: smooth rounded panels, clean separate trim). Readable at 10 to 30 m in a game.
- Real utility ATV proportions: long low body; a front cowl that slopes down to the nose; a fuel tank cover between the knees; a long flat rider seat that rises slightly at the back; a rear tail section; four large fenders that wrap over fat tyres; a tubular front rack over the cowl and a flat rear rack behind the seat; a front bumper bar attached to the frame; foot platforms on both sides between the wheels; a handlebar with two grips, two levers and a small instrument cluster; a muffler on the right side; two headlights in the nose and two tail lights.
- Tyres: fat knobby off-road tyres (visible tread blocks attached to the tread, a thick sidewall), on rims with a lip and a hub with 4 to 6 bolts. Tyre radius 0.30 m, width about 0.23 m.
- Colours (flat): body plastics one colour (game recolours them), frame and racks dark grey, tyres near black, rims light grey, seat black, lenses bright.

## Hard rules (a previous attempt failed on these)
1. NO floating or detached pieces: every part touches or overlaps its neighbour (lugs sit on the tread, bumper bolts to the frame, racks stand on posts).
2. Smooth, intentional surfaces: merge duplicate vertices, recalculate normals outward, flat shading only where it is meant; no random dents or spikes on the plastics. Use bevels for the rounded look.
3. Headlights are bright LIGHT lenses in a housing (material `ATV_Headlight`), never black hexagons. Tail lights red (`ATV_Taillight`). Nothing emissive in the file (the game adds the glow).
4. Nothing below y = 0 at rest except the tyre contact; all four tyres touch y = 0 (within 5 mm). Apply every transform (scale 1, rotation 0) before export.
5. Triangles about 3,000 to 6,000 (a soft cap; fewer is better); at most 8 materials; every material a flat colour.

## Size and axes
- Units metres. About 2.05 m long, 1.16 m wide, 1.14 m high, wheelbase 1.24 m, hub track 0.93 m, wheel radius 0.30 m.
- Origin on the ground, centred between the four tyre contact patches.
- The nose points to Blender -Y (so +Z forward in the exported glTF, +Y up, local +X = the vehicle's LEFT). Blender to glTF is (X, Y, Z) -> (X, Z, -Y). Export with +Y up.

## Nodes (exact names, case matters)
- Wheels: `wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR`: origin at the hub centre, they spin about local X. Each has one mesh child holding tyre + rim.
- Steering: empties `steer_FL`, `steer_FR` at the front hub centres; they are the PARENTS of `wheel_FL` / `wheel_FR` (child at local 0); they turn about local Y.
- `handlebar`: empty pivot at the column base (0, 0.70, 0.34 in glTF axes); the handlebar bars, grips, levers and cluster are its children.
- Empties: `seat` (rider seat point), `seat_2` (second rider, optional), `exhaust` (tail pipe tip).
- Body meshes split BY MATERIAL as children of the root so the game can merge them: `Body_Paint`, `Body_Frame`, `Body_Trim`, `Body_Metal`, `Body_Headlights`, `Body_Taillights`.
- Root empty named `ATV_Default_Source`.

## Materials (names exact)
`Paint` (body plastics ONLY: cowl, tank cover, seat cowl and tail, four fenders), `ATV_Frame` (frame, wishbones, racks, bumper, handlebar tube), `ATV_Tire`, `ATV_Rim`, `ATV_Trim` (seat, foot platforms, grips, levers, cluster), `ATV_Metal` (muffler, pipes, fuel cap, hub stubs), `ATV_Headlight`, `ATV_Taillight`.

## Anchors (empties, glTF axes: X left, Y up, Z forward, metres)
anchor_driver_seat (0, 0.86, -0.30) | anchor_engine_sound (0, 0.45, -0.05) | anchor_exhaust (-0.27, 0.57, -1.00) | anchor_fuel_port (0.07, 0.835, 0.16) | anchor_headlight_L / _R (+0.15 / -0.15, 0.52, 0.92) | anchor_taillight_L / _R (+0.34 / -0.34, 0.62, -0.975) | anchor_cargo_front (0, 0.82, 0.66) | anchor_cargo_rear (0, 0.76, -0.82) | anchor_hands_L / _R (+0.37 / -0.37, 1.05, 0.23) | anchor_foot_L / _R (+0.36 / -0.36, 0.35, 0.00) | anchor_load_left / _right (+0.95 / -0.95, 0, 0) | anchor_load_rear (0, 0, -1.60). Hubs: front (+/-0.465, 0.30, +0.62), rear (+/-0.465, 0.30, -0.62). The exhaust is on the vehicle's right (-X).
The anchors are positions the game relies on: keep the grips at the hands anchors, the seat top at the seat anchor, the foot platforms at the foot anchors, the lenses at the headlight anchors.

## Verify before you hand it in
1. Re-import the .glb and list: node names, triangle count, materials, bounds in glTF axes (x +/-0.58, y 0 to 1.14, z about -1.04 to +1.01), lowest point y = 0.
2. Render at least front 3/4, side, rear 3/4, top and a close-up of the front and LOOK at each: floating pieces, spikes, black lenses, missing tread, tyres not touching the ground, handlebar too close to the seat, fenders hitting the steered wheels (turn the front wheels 35 degrees and check).
3. Report honestly what you did not check.

## Deliver
`ATV <your name> - V1 Game.glb`, the generating script if any, and 4 to 6 preview PNGs. Do not change any game files.