# Sawmill (new model) - asset spec for game code

Written from the Blender build scripts and the first GLB summary. **Verify against a fresh `glb_summary.txt` of the final export before relying on any number**
(the summary was taken before the rig-split fix). Anything marked *proposal* is a suggested rule, not something already in DESIGN.md.

## Conventions
- 1 unit = 1 m. Origin on the ground at the root node `Sawmill`. glTF is Y up. Blender (x, y, z) becomes glTF (x, z, -y), so the Blender "front" (-Y) is glTF +Z.
- Coordinates below are glTF (x, y, z) relative to the `Sawmill` root. The log feed runs along +X.
- This replaces the old fused sawmill mesh. The blade and the other moving parts are now separate nodes.

## Footprint and heights
- Main deck 8.6 x 6.6 m, centred on the root, top surface at y = 0.30 (a floor-height surface, like the old sawmill deck).
- Shed deck 3.6 x 4.6 m centred at x = 6.4, top at y = 0.20 (a 0.1 m step down from the main deck).
- Main posts at x = -4, 0, 4 and z = -3, +3. Shed posts at x = 4.8 and 8.0, z = -2.1 and +2.1. Roof ridge at y = 5.58.
- Overall footprint x from about -4.6 to +8.2, z from about -3.3 to +3.3.
- Bench top surface at y = 1.15 and about 4.4 x 1.2 m, with an 0.08 m gap at z = 0 where the blade passes.
- Suggested colliders: main deck, shed deck, each post, the bench, and the conveyor frame. The roof does not need one.

## Node tree
- `Sawmill` (root) holds everything. Static building meshes (posts, beams, braces, gables, roof, rails, pulley, axle housing, switch mount and plate, `Switch_Lamp`, pile logs `PileLog_*`) are plain meshes.
- `SawmillRig` (armature) with bones `Switch` and `Lamp`. Skinned meshes: `Switch_Lever` and `Switch_Lamp_On`.
- `BladeRig` (armature) with the single bone `Blade`. Skinned mesh: `Blade_Mesh`. (Bone `Blade` and mesh `Blade_Mesh` are named differently on purpose so the loader cannot confuse them.)
- Animated objects: `FeedLog`, `Plank_Out_0` to `Plank_Out_3`, `Belt_Roller_0` to `Belt_Roller_7`.
- Conveyor statics: `Belt_Beam_L`, `Belt_Beam_R`, `Belt_Leg_*`, `Belt_EndStop`.
- Beacon statics: `Beacon_Arm`, `Beacon_Base`, `Beacon_Cap`, `Beacon_Lens_Green`, `Beacon_Lens_Red`.
- The old placeholder plank stacks (`PlankStackA/B/C`) are gone; planks on the pile and belt are created by code.

## Animations (glTF animation names)
| name | what it moves | length | notes |
|---|---|---|---|
| `BladeSpin` | bone `Blade` on `BladeRig` | 1 turn per loop, about 24 frames (1.0 s) | Loop it while the saw is on. If the exported duration is 1.042 s, trim to 24 frames so the loop does not hitch. |
| `SwitchOn` | bones `Switch` and `Lamp` on `SawmillRig` | 9 frames | Lever swings 60 degrees; the lamp bone scales from 0.001 to 1 at frames 6 to 7 (the lamp lights just before the lever lands). |
| `SwitchOff` | bones `Switch` and `Lamp` | 9 frames | Lever returns; the lamp bone scales to 0.001 at frames 3 to 4. |
| `Cut` | `FeedLog` and `Plank_Out_0..3` | 100 frames at 24 fps (about 4.1 s) | See the sequence below. |
| `BeltRun` | `Belt_Roller_0..7` | loop of 24 frames | Rollers turn 450 degrees per loop (a multiple of the 8-sided symmetry, so it loops cleanly). Play while a stack advances. |

`Cut` sequence: frames 1 to 4 the log rests at its feed position; 4 to 14 it lifts onto the bench; 14 to 46 it feeds through the blade (x = -2.0 to +1.6); at frame 47 the log disappears (scale 0.001) and four planks appear, narrow; each plank (4 frames apart) then slides about 28 frames to hover above belt slot 0, then falls 9 frames and lands stacked (bottom plank first). The last plank lands near frame 96.

**Rest state** (what you see with no clip playing): `FeedLog` visible at its feed position, `Plank_Out_*` hidden (scale 0.001), `Switch_Lamp_On` hidden (bone scale 0.001), lever up.

Playing clips together is safe: since the rig split, each clip only touches its own bones or objects (`BladeSpin` on `BladeRig`, `SwitchOn/Off` on `SawmillRig`).

## Conveyor
- 4 slots, 1.0 m apart along z, centred at x = 6.4. Roller tops at y = 0.80. Slot 0 is at z = +1.5 (where the planks land), slot 3 at z = -1.5 (the clearing end).
- One stack = 4 planks, each 2.4 x 0.9 x 0.12 m, stacked 0.48 m high, laid across the belt.
- Moving stacks along the belt is done in code (the count changes), one slot per stack, with `BeltRun` playing meanwhile.

## Anchors (glTF x, y, z)
| name | position |
|---|---|
| anchor_blade_sound | 0, 1.15, 0 |
| anchor_sawdust | 0, 1.38, 0 |
| anchor_log_in | -3.2, 1.4, 0.95 |
| anchor_player | 0, 0.3, 1.7 |
| anchor_switch | -4, 0.3, 3.9 |
| anchor_switch_prompt | -4, 1.45, 3.35 |
| anchor_lamp | -4, 1.56, 3.315 |
| anchor_plank_out | 3.2, 1.3, -0.95 |
| anchor_plank_pile | 6, 0.3, 0 |
| anchor_belt_0 | 6.4, 0.8, 1.5 |
| anchor_belt_1 | 6.4, 0.8, 0.5 |
| anchor_belt_2 | 6.4, 0.8, -0.5 |
| anchor_belt_3 | 6.4, 0.8, -1.5 |
| anchor_belt_clear | 6.4, 1.0, -2.3 |
| anchor_belt_sound | 6.4, 1.05, 0 |
| anchor_beacon | 7.6, 2.3, -2.1 |

## Materials and lights
- `Lamp_On` (emission 4), `Beacon_Green` (emission 4) and `Beacon_Red` (emission 4) carry their emissive colours in the file. Both beacon lenses are lit in the file: the code should set the unused lens to emissive intensity 0 and use the other. `Lamp_Off` is the dark static lamp mesh.
- The lamp is shown by the `Lamp` bone scaling (not by a material swap), so no code is needed for that beyond playing `SwitchOn` / `SwitchOff`.
- Other materials: `Bark`, `EndGrain`, `Iron_Dark`, `Lever_Red`, `Plank`, `Roof_Slate`, `Steel`, `Stone`, `Timber`, `Timber_Dark`.

## Proposed gameplay rules (not yet in DESIGN.md)
- The saw only cuts while the switch is on. One log gives one cut and 4 planks (one stack). A stack lands on slot 0 and every stack on the belt moves one slot.
- The belt holds 4 stacks. When it is full the saw switches itself off (`SwitchOff`), the beacon turns red, and the lever refuses to switch on; the player clears the belt at `anchor_belt_clear` and receives the planks.
- Save the belt as one integer (stacks on the belt, 0 to 4) plus the usual plank item counts. Positions are derived, nothing per plank is saved.
- DESIGN.md already says: planks are saved as a count, the pile is instanced with a cap, scripted animation instead of physics, and a spare saw blade is a supply item that wears (replaced every few hundred planks).

## Sound and sawdust (not built yet; there is no audio system)
- Blade sound at `anchor_blade_sound`, belt hum at `anchor_belt_sound`, lever click at `anchor_switch`.
- Sawdust: a few hundred short-lived points at `anchor_sawdust` while a log feeds through the blade, no shadows.

## Performance
- The first export had 67 meshes and about 1,440 triangles before the conveyor, lamp and beacon; the new parts add a few hundred triangles. Expect on the order of 70 draw calls for this one prop unless the converter merges the static meshes by material, which would bring it to roughly 30. Your rule is to flag more than about 300 draw calls in total.
- Skinned meshes: 3 (blade, lever, lamp). All textures are flat colours (no image textures).
