michadr.

# ATV V7 -> V8 underside (Opus, headless Blender 5.2), 2026-11-15

No game files touched (dist/, tests/, build-props). No git. notes/handoff.md not edited. V7 files untouched: SHA-256 before and after are the same (blend D2213458..., glb 6F9D0C1D...).

## Files
- NEW `C:\Users\Michael\Documents\Projects\Assets Sim Project\ATV Utility - V8 Game.blend` (745,657 B) and `ATV Utility - V8 Game.glb` (1,449,744 B).
- NEW `...\Assets Sim Project\ATV V8 previews\` (28 PNGs): the 16 V7 views, plus 9 underside views (`u_straight`, `u_rear_low`, `u_front_low`, `u_side_left`, `u_side_right`, `u_jump_34`, `u_close_rear`, `u_close_front`, `u_steer35` at 35 deg lock) and 3 ground-level low views (`g_low_rear`, `g_low_side`, `g_low_right`). In the u_* views the floor is hidden and a weak fill sun lights from below so the parts can be read.
- CHANGED `scripts/atv-finish.py` (888 -> 1286 lines, no BOM). New `v8` mode rebuilds V8 from the V7 .blend (V7 is only read). `check`, `render` and `glbcheck` now default to V8 (`ATV_VER=7` or `6` for older files). `render` has the new underside views.
- Deleted only my own stale backup `ATV Utility - V8 Game.blend1` (745,202 B), which Blender wrote when I re-ran v8. Scratch probes are in the session scratchpad. Nothing extra was added to the repo.

## What was added (all low poly, all static, all merged into existing meshes)
Removed: V7's plain grey box (`Body_Metal`, 91 verts) and the old exhaust (pipe, muffler, tip; 168 verts). The old exhaust sat up inside the right rear fender, where nobody could see it, and its muffler ran through the rear shock. V7's hidden-face strip had removed faces of parts that touched these. The 5 holes this opened (rear fender inner wall, rear shock mount, tank bottom) were found by an inside test and closed (74 tris).
1. **Engine** (reshaped, not stacked): crankcase (ATV_Metal, chamfered, x +/-0.125, z 0.27-0.44), a lower, narrower gearbox behind it, front and rear output bosses, a finned cylinder leaning 35 deg forward out of the tank's front face, and a black CVT cover on the left side (ATV_Trim, rounded two-pulley outline, chamfered outer face).
2. **Drivetrain**: front and rear prop shafts with joint collars. Front and rear differentials (round housing, pinion nose, side outputs). 4 half-shafts on the hub line (x 0.085-0.336) with ribbed black CV boots at both ends and a metal hub stub into the wheel hub. They pass between the A-arm legs without touching them.
3. **Exhaust** (right side): a header from the cylinder head that curls round to the right and runs back beside the engine (above the rail, under the tank). It rises before the rear upper-arm pivot, passes inside the rear shock (about 1.2 cm gap by design) and enters a muffler canister behind the right rear wheel (r 6 cm, y 0.675-0.926). The tip points back and slightly up and out, with a dark bore, and ends just under the tail at glTF (-0.282, 0.490, -1.035). Also 2 clamp bands, 2 muffler hangers (one down to the rail end, one tab up to the body) and 2 pipe hangers down to the rail. The canister is 2 mm below the body (measured).
4. **Skid plates** (ATV_Frame): front plate under the nose and the front half of the front diff, joined into the existing front guard block. Engine plate y -0.30..0.33 x +/-0.19, with its front lip bent up. Both have hex bolt heads. Lowest new point z 0.196 (bolt heads), so it stays above y 0.12.
5. **Other** (judged from the renders): steering column stub, pitman arm and two tie rods with ball joints, ending just behind the front hubs. Fuel tank: the existing black block over the engine already reads as one (kept). Skipped: battery (would be hidden), brake lines (1-2 mm lines alias badly).

Attachment / contract: every new part is in `Body_Frame`, `Body_Metal` or `Body_Trim` (parent `ATV_Default_Source`). Nothing new is under `steer_*`, `wheel_*` or `WheelMesh_*`, so wheel spin and steering are untouched. Half-shafts are round, so a static shaft looks the same whether or not the wheel spins. Their hub end is on the steering axis's hub point. Measured with the steered wheel's volume (outside the 6 cm hub core):

| Front lock | Deepest a new part reaches into the wheel |
|---|---|
| 0 deg | 0 cm |
| 25 deg | 0.3 cm |
| 30 deg | 1.1 cm (hub stub edge) |
| 35 deg | 2.0 cm (hub stub edge); 1.2 cm (tie-rod end); 0.6 cm (outer boot) |

All of this is low down inside the rim, next to V7's A-arm clash, which is unchanged.

## Numbers (re-verified)
| | V7 | V8 |
|---|---|---|
| Triangles | 36,346 | **39,295 (+2,949, +8.1%)** |
| Meshes / materials / draw calls | 13 / 8 / 21 | 13 / 8 / 21 (same names, same colours) |
| Bounds glTF | x +/-0.611, y 0..1.082, z -1.043..+1.023 | identical |
| Lowest point | wheels 0.0000 | wheels 0.0000; body 0.1851 (old front guard), new parts 0.196 |

Per mesh V8: Body_Frame 5,224 (+397), Body_Metal 2,947 (+1,750), Body_Trim 2,850 (+765), Body_Paint 7,071 (+51), Body_Headlights 632 (-14), Body_Taillights 428. Handlebar and wheels are unchanged. To fit the +3,000 budget, the same hidden-face strip as V7 was run again (it removed 221 tris: shaft end caps inside boots and collars, engine tops inside the tank, 7 lens faces hidden inside the headlight bezels). The A/B render of `lights_front_close` V7 vs V8 looks the same.

Real output (abridged):
```
node scripts/glb-inspect.cjs ".../ATV Utility - V8 Game.glb"
 bytes 1449744 ... total tris 39295 materials [ATV_Frame [0.07,0.08,0.08,1], ATV_Headlight [0.94,0.96,1,1], ATV_Metal [0.17,0.19,0.2,1],
 Paint [0.26,0.31,0.19,1], ATV_Taillight [0.8,0.02,0.03,1], ATV_Trim [0.03,0.03,0.04,1], ATV_Tire [0.02,0.03,0.03,1], ATV_Rim [0.29,0.32,0.34,1]]
 nodes: all 17 anchor_* at contract values (anchor_exhaust t[-0.27,0.57,-1]), exhaust, handlebar t[0,0.7,0.34], seat, seat_2,
 steer_FL/FR -> wheel_FL/FR -> WheelMesh_FL/FR, wheel_RL/RR, ATV_Default_Source
node scripts/glb-tree.cjs ...
 bytes 1449744 nodes 41 meshes 13 materials 8 images 0 ... roots 1 total tris 39295
 ATV_Default_Source |  | 39295 | 13 | 21 | 8 | 20 | ...   suffixed names 0
atv-finish.py check: TOTAL tris 39295 meshes 13 draw calls 21; ANCHOR x17 "off contract by 0.0 mm"; LOWZ WheelMesh_* +0.0000;
 CLASH lines: only V7's A-arm / lower-shock-mount touches at +/-35 deg (Body_Frame, 0.3-1.3 cm, same as V7), no new part listed
atv-finish.py glbcheck: GLB bounds glTF: x -0.611..+0.611 y +0.000..+1.082 z -1.043..+1.023; unexpected meshes []; parents as contract
```
Coplanar-face (z-fighting) scan of all body meshes: the same 144 face pairs as V7, all of them old V7 contact faces. None involve a new part. The one new pair I found during the work (prop shaft caps on the collar planes) was fixed.

## What I could NOT verify
- Nothing was checked in three.js or in the game: lighting of the underside with the game's ambient light (my underside renders use a fill light from below), shadow maps, and aliasing of the 9 mm tie rods and 7-8 mm hangers at distance.
- Holes: the closed loops and the stripped faces were checked only in Blender renders from 9 underside + ground angles (no holes seen) and by boundary-edge counts, not in three.js.
- The exhaust pipe is hidden from straight below by the frame rail and from the side by the footboards. You see it at the header (front) and in the rising run to the muffler (rear-low views). The muffler, tip, diffs, shafts, boots and plates all read clearly.

## Decisions for the user
1. **anchor_exhaust**: the visible tip now ends at glTF (-0.282, 0.490, -1.035), 8.8 cm from the anchor (-0.27, 0.57, -1.00). The anchor sits inside the tail panel, as in V7. **Recommend: move anchor_exhaust (and the `exhaust` empty) to (-0.28, 0.49, -1.035) at A4** so the smoke comes out of the tip. This is a contract number change, so I did not make it.
2. **Steering cap** (repeat of V7 decision 3): at 35 deg the static hub stub and tie-rod end go 1-2 cm into the steered rim, low down where V7's A-arm already touches. **Recommend: cap the visual steer at about 30 deg at A4** (1.1 cm, and hidden inside the rim at that angle).
3. **Triangles +2,949 (+8.1%)**, inside the +3,000 you allowed. If you want it lighter, the cheapest cuts are 6-sided boots and shafts (about -400) or dropping the bolt heads (-160). **Recommend: keep as is.**

## Confidence
- Contract (names, parents, 17 anchors, 8 materials, 21 draw calls, bounds, tyres lowest at y=0): high. Re-imported with Blender and both node scripts.
- Underside reads as a real ATV from below, behind, the side and in a jump: high, from the renders.
- Clearances (new parts vs suspension, shocks, tyres, body): medium-high. Measured: muffler to body 2 mm, and the steered-wheel table above. The pipe-to-shock 1.2 cm gap comes from the planned coordinates against the shock's bounding box, not from a mesh measurement. Everything else was checked by eye in the renders.
- Not checked in three.js: see above.
