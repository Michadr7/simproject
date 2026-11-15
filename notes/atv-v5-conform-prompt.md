# Prompt: conform the user's ATV V5 to the game contract (for a Sonnet agent in this repo)

Project: c:\Users\Michael\Documents\Projects\simproject. Read notes/handoff.md lines 1-50 and context.md lines 1-45 first (standing rules), then notes/atv-model-prompt.md in full: its "Size and axes", "Nodes", "Materials" and "Anchors" sections are the contract. One stage, then stop and report. Do not commit. Do not edit notes/handoff.md. Do not change any game file (dist/, tests/, scripts/build-props.mjs): the game import is a later stage (A4).

## Input
The user's own model (own work: licence 'Own work', no credit line) is `assets-src\Vehicles\ATV\` (the V5 file; the user copies it there; if the folder is empty, stop and say so). It is a utility ATV: olive-green body plastics (cowl, tank cover, seat cowl, four big fenders), black tubular front and rear racks, front bumper bar, ribbed black seat, black foot platforms, handlebar with grips and a gauge pod, two bright headlight lenses on the nose, fat knobby tyres (separate tread blocks) on grey rims with bolts.

## Task: conform, do not redesign
Keep the user's shapes and proportions exactly. Only restructure so the file meets the contract:
1. Inspect first: `node scripts/glb-inspect.cjs <file>` and `node scripts/glb-tree.cjs <file>`; list node names, materials, triangle count, bounds, lowest point, which way the nose points.
2. Orientation and scale: nose to Blender -Y (exported +Z forward, +Y up, local +X = the vehicle's left), metres, origin on the ground centred between the four contact patches, all transforms applied (scale 1, rotation 0). If the model is a different size, scale uniformly to about 2.05 m long (report the original size). All four tyres touch y = 0 (within 5 mm); nothing below y = 0 otherwise.
3. Nodes (exact names): root empty `ATV_Default_Source`; `wheel_FL/FR/RL/RR` with the origin at the hub centre, spinning about local X, each with one mesh child (tyre + rim); `steer_FL/FR` empties at the front hub centres as the PARENTS of the front wheels; `handlebar` empty pivot at the column base with the bars, grips, levers and cluster as children; empties `seat`, `seat_2`, `exhaust`.
4. Materials: merge to at most 8 flat-colour materials named `Paint` (body plastics ONLY), `ATV_Frame` (frame, racks, bumper, handlebar tube), `ATV_Tire`, `ATV_Rim`, `ATV_Trim` (seat, foot platforms, grips, levers, cluster), `ATV_Metal` (muffler, pipes, fuel cap, hub stubs), `ATV_Headlight` (bright lenses, never black), `ATV_Taillight` (red). Nothing emissive. Split the body meshes by material as children of the root: `Body_Paint`, `Body_Frame`, `Body_Trim`, `Body_Metal`, `Body_Headlights`, `Body_Taillights`. Join the tread blocks into the tyre mesh (one mesh per wheel, so draw calls stay low). Report the final material and mesh count (flag anything over 8 materials or over about 10 meshes).
5. Anchors: add the empties from the contract's Anchors list at the exact glTF positions (anchor_driver_seat, engine_sound, exhaust, fuel_port, headlight_L/R, taillight_L/R, cargo_front, cargo_rear, hands_L/R, foot_L/R, load_left/right/rear). If the user's model puts the grips, seat top, foot platforms or lenses somewhere else, do NOT move the anchors silently: report the difference per anchor (metres) and place the anchor at the model's real part.
6. Fix only real defects, and report each: floating or detached parts (tread blocks off the tyre, bumper not touching the frame), flipped normals, duplicate vertices (merge by distance 0.1 mm), non-manifold junk, black headlight lenses, fenders touching the front tyres when steered 35 degrees (check, report; do not reshape).
7. The tail lights, if the model has none, are not added: report it.

## Verify
Re-import the exported .glb and list node names, triangle count, materials, bounds, lowest point. Render front 3/4, side, rear 3/4, top, and a close-up of the front with the front wheels turned 35 degrees, and LOOK at each. Report honestly what you did not check.

## Deliver
`assets-src\Vehicles\ATV\conformed\ATV V5 - Game.glb`, the script you used (keep it in scripts/, named atv-conform.py or .cjs; it is the only repo file you may add), 4 to 6 preview PNGs in the same folder, and a short report: original vs final size, anchor differences, material and mesh counts, defects fixed, anything for the user to fix in Blender.
