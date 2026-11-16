michadr.

# ATV V6 -> V7 polish (Opus, headless Blender 5.2), 2026-11-15

Prompt: notes/atv-v6-polish-prompt.md. No game files touched (dist/, tests/, build-props), no git, notes/handoff.md not edited.

## Files
- NEW `C:\Users\Michael\Documents\Projects\Assets Sim Project\ATV Utility - V7 Game.blend` (772,234 B) and `ATV Utility - V7 Game.glb` (1,361,832 B).
- NEW `...\Assets Sim Project\ATV V7 previews\` (16 PNGs): front34, side, rear34, top, low_front, low_beside, rider_view, front_close_steer35, front_steer35_from_front, tyre_close, handlebar_close, lights_front_close, tail_close, fender_close, fender_side_close, front_far_20m (50 deg lens at 20 m).
- CHANGED `scripts/atv-finish.py` (637 -> 888 lines, no BOM). New `polish` mode (V6 -> V7), plus `check` / `render` / `glbcheck` now point at V7 (`ATV_VER=6` for V6). `render name1 name2` renders a subset. `build` was kept as history.
- Scratch probes and A/B renders are in the session scratchpad only. Nothing was left in the repo.

## 1. Headlights (request 1)
In V6 each headlight was a pale box (a Trim box plus a flat lens) glued 3 cm in front of a flat cowl face, so it read as a floating slab. In V7 each side, at the same x / z (+/-0.150, 0.520), has:
- a dark rounded-rectangle bezel housing (ATV_Trim, 20.8 x 13.4 cm). It is sunk 2.5 cm into the cowl and its chamfered flange stands only about 1.4 cm proud of the cowl face, so it reads as set in, not stuck on;
- a grey reflector ring (ATV_Metal) that steps back into the opening;
- a bright lens (ATV_Headlight, unchanged colour, not emissive) with a flat outer band and a raised dome. This inner step is what makes it read as a lamp. In front_far_20m.png it shows as two distinct white lamps.
The lens tip is at y -0.915 (Blender), 5 mm behind the anchor (-0.920), which is a good spot for the game glow. Anchors are unchanged.

Tail lights ("if they look flat": they did, and the two at the anchors were also half buried in the rear fender lip; the centre one z-fought along its top edge): all three were rebuilt with a dark bezel and a red lens with a chamfered edge and a raised inner panel. Each is tilted to the sloping tail face, using a plane fitted to the paint under its footprint (21.9 deg for the side ones). The side ones were raised 2.8 cm (centre z 0.648) so they clear the fender lip.

## 2. Other findings
Fixed:
- Front rack outer frame was a 23-vertex diamond-section loop: pointed ends, 3.4 cm thick, faceted in every close view. It is now a round 8-sided tube (r 1.6 cm) on the same rectangle with bent corners.
- Front rack posts: the four posts stood at |x| 0.29 / 0.335 under no rail, so they were pegs ending in the air (seen in rider_view). The bottom of one poked through the cowl side as a dark sliver under the left front fender. All four were moved out under the side rails (|x| 0.445); they now stand on the fender tops and end in the rail.
- ATV_Frame colour went from 0.045 to 0.072 linear (still dark grey). Frame, racks and bumper were almost as black as the tyres (0.021) and seat (0.030), so the underside read as one black mass in daylight.
- Hidden triangles: 2,867 tris in the body and handlebar that lie inside other closed parts were deleted. A face is deleted only if it is invisible from 600 directions at its centre and corners AND inside another part by a ray-parity test.

Left as is:
- Front A-arm inner ends and the lower shock mount touch the steered tyre's inner sidewall at full 35 deg lock, by up to 1.3 cm (Body_Frame only, low down near the hub). These clashes are identical in V6. Fixing them means reshaping the suspension, which is a redesign.
- Seat: a plain bevelled slab (63 verts). It reads fine at game distance; crowning it needs a remodel.
- Gauge pod: a black box with a grey glass top. It reads as a pod; left.
- The handlebar is a "V" with long risers; left as is (no redesign).
- Inner cowl side under the front fenders has slightly uneven shading from the V6 tuck. It is in shadow, minor.
- Rim lip faceting (low segment count): it only shows in close-ups.
- Muffler, tread blocks, hub bolts, fender-to-tyre gaps, foot platforms: nothing cheap to fix. All looked fine in the renders.

Tried and rolled back: also stripping hidden faces from the wheels (saved 2,664 tris). A zoomed A/B render showed it changed how the metallic rim looked near the lip, so the wheels are left whole.

## 3. Final numbers (re-verified)
| | V6 | V7 |
|---|---|---|
| Triangles | 37,191 | 36,346 (-2.3%) |
| Meshes | 13 | 13 |
| Materials | 8 | 8 (same names) |
| Draw calls (mesh x material) | 21 | 21 |
| Bounds glTF | x +/-0.611, y 0..1.082, z -1.043..+1.023 | identical |

Per mesh (V7): Body_Frame 4,827, Body_Headlights 646, Body_Metal 1,197, Body_Paint 7,020, Body_Taillights 428, Body_Trim 2,085, Handlebar_Frame 1,657, Handlebar_Metal 710, Handlebar_Trim 3,984, each WheelMesh 3,448.

Real output (abridged):
```
node scripts/glb-inspect.cjs ... V7 Game.glb
 total tris 36346 materials [ ATV_Frame [0.07,0.08,0.08,1], ATV_Headlight [0.94,0.96,1,1], ATV_Metal [0.17,0.19,0.2,1], Paint [0.26,0.31,0.19,1], ATV_Taillight [0.8,0.02,0.03,1], ATV_Trim [0.03,0.03,0.04,1], ATV_Tire [0.02,0.03,0.03,1], ATV_Rim [0.29,0.32,0.34,1] ]
 nodes: all 17 anchor_* empties at contract values, exhaust, handlebar t[0,0.7,0.34], seat, seat_2, steer_FL/FR -> wheel_FL/FR -> WheelMesh_FL/FR, wheel_RL/RR, ATV_Default_Source root
node scripts/glb-tree.cjs ...
 bytes 1361832 nodes 41 meshes 13 materials 8 images 0 ... roots 1 total tris 36346
 ATV_Default_Source |  | 36346 | 13 | 21 | 8 | 20 | ...   suffixed names 0
atv-finish.py check:  ANCHOR x17 "off contract by 0.0 mm"; LOWZ WheelMesh_FL/FR/RL/RR +0.0000; no Body_Paint (fender) clash at 0 / +35 / -35 deg
atv-finish.py glbcheck: GLB unexpected meshes []; parents as contract; lowest point 0.0000 on all four wheel meshes
```
Anchor vs part offsets: headlight lens centre 1.8 cm behind its anchor (y). The taillight lens is 3.0 cm from its anchor (2.7 cm higher, 1.3 cm further back). Grips, seat top and foot platforms are as in V6 (0 / 0 / 1 cm).

## 4. Clean up (done after all checks passed and every render was looked at)
Deleted (exact paths and sizes, listed before deleting):
- `C:\Users\Michael\Documents\Projects\Assets Sim Project\ATV Utility - V4.1 Detail Cleanup.blend` (801,358 B)
- `C:\Users\Michael\Documents\Projects\Assets Sim Project\ATV Utility - V6 Game.blend` (793,287 B)
- `C:\Users\Michael\Documents\Projects\Assets Sim Project\ATV Utility - V6 Game.glb` (1,383,964 B)
- `C:\Users\Michael\Documents\Projects\Assets Sim Project\ATV Utility - V7 Game.blend1` (754,525 B). This was a stale backup Blender wrote when I re-saved V7 during this job (an earlier, unverified V7 pass), not one of the user's files.
- `C:\Users\Michael\Documents\Projects\Assets Sim Project\ATV V6 previews\` (folder, 9 PNGs, 11,836,494 B)

Kept and untouched: Dropzoneprops.blend, FirstPersonWeld.blend, GasStationProps.blend, Kasamuchi_shortbed.blend, Weldingv3.blend / .blend1 / .glb (not ATV files). No other ATV versions were found. scripts/atv-finish.py is kept.
Consequence: `atv-finish.py -- build` and `-- polish` can no longer run because their source files are gone. The V7 .blend is now the source of truth.

## What I could NOT verify
- How it looks in the game itself (three.js lighting, the glow at the anchors, mipmapping and aliasing of the 1.6 cm rack tubes on a real GPU). That is stage A4, and it was not imported.
- Removing the hidden body faces made some closed parts open. Blender A/B renders of V6 vs V6-stripped show no holes. Only 0.03 to 0.15% of pixels changed, all along soft shadow edges (Eevee). I did not test three.js shadow maps.
- Handlebar rotation: I did not check grip or lever clearance against the racks at the game's real steering angle (the handlebar is a pivot the game turns). The grips are 27 cm above the front rack, so a clash is unlikely.
- The A-arm clashes at full lock (above) remain; they are not fenders.

## Decisions for the user
1. Taillight anchors: the lenses now sit at glTF (+/-0.34, 0.648, -0.99), while the anchors are still at (+/-0.34, 0.62, -0.975). That is 3 cm low, because at the anchor height the lamp sank into the fender lip. **Recommend: move anchor_taillight_L/R to y 0.648 at A4** (a contract number change, so it needs your OK). Otherwise the glow sits on the lens's lower edge.
2. Frame colour lightened to 0.072 linear. **Recommend: keep** (the underside no longer reads as one black blob). If you preferred the old near-black, it is one number in `extra_fixes`.
3. A-arm / tyre touch at full 35 deg lock (1.3 cm, unchanged from V6). **Recommend: leave it and cap the game's visual steer at about 30 deg at A4.** That is cheaper than reshaping the suspension.

## Confidence
- Headlights and tail lights: high. They are visibly real lamps in every view and at 20 m.
- Rack fix and post move: high.
- Contract (names, anchors, materials, draw calls, y=0, bounds, fenders clear at 35 deg): high. Checked by re-import with both Blender and the repo's node scripts.
- Hidden-face strip: medium-high (A/B checked in Blender only, not in three.js).
