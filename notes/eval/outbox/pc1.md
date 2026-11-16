michadr.

# PC1: Ironwood police car, Blender finishing (report)

## Files
- Created `C:\Users\Michael\Documents\Projects\Assets Sim Project\IronwoodPDCar Game.blend` (copy; `IronwoodPDCarV1.blend` was only read) and `IronwoodPDCar Game.glb` (256 KB, Draco off, one embedded 1024x1024 JPEG, no camera/light).
- Created `scripts\police-finish.py` (227 lines; modes `rendersrc | build | render | glbrender | glbcheck | slices`). Rebuild: `blender -b --python scripts/police-finish.py -- build`.
- Previews in `Assets Sim Project\IronwoodPD previews\`: `src_*` (untouched source), `glb_*` (re-imported GLB, 6 views), `glb_mk_*` (same with pink spheres on every anchor/pivot).
- Nothing under dist/, tests/, hub/, scripts/build-*.mjs touched; no npm/git run.

## What I saw (source, rendered and viewed)
Good model: closed body, no holes visible, normals look right, black/white livery clean, light bar, bull bar, mirrors with pillar spotlights, door handles, amber indicator, tail pipe, plates. Flaws:
- Underside is a closed, flat, dark floor; wheel arches are plain boxes (fine for a game, nothing visible from the ground).
- Cabin is a dark hollow behind tinted glass: NO modelled seats/steering wheel were visible (my cut-away renders showed black). Driver anchors are placed by proportion, not on a visible seat.
- Texture detail baked in and unreadable at game distance: garbled trunk badge, a bilingual-looking plate text (rear plate and trunk plate show blurry pseudo-text), a "TT"-like reflection pattern on the windscreen, an odd logo mark on the light bar top. All baked into the 4096 basecolor; not geometry.
- The car_body mesh has 1,114 open/non-manifold edges (mostly Tripo seams); not visible in any render.
- 'PushbarRubber_-1' excluded: 40 tris, material V2_Trim, sits at x 2.6..2.7 (about 2.6 car-lengths beside the car), is 0.58 tall, taller than the whole car (0.34); belongs to another model. The car already has its own bull bar in car_body. Dropped, and camera, light, the parent EMPTY and all 25 orphan materials/images purged.
- Not verified: wheels visibly turning/steering in-game; texture seams under motion.

## Texture (looked at both)
512 loses the livery edges: white halo/blur along door frames and A-pillar, grille and blue/red strip smudge. 1024 is clearly better and the GLB is only 256 KB (512 was 204 KB), so I used 1024. Set `PD_TEX=512` to rebuild at 512. The GLB image is JPEG (exporter AUTO); fine on viewed renders.

## Result (re-imported GLB)
- Scale factor 4.95 (source length 1.0 -> 4.950 m). Body bounds (Blender x left, y length, z up): x +-1.138 (incl. mirrors; wheels span +-0.939, body shell about 1.91), y -2.45 .. 2.50 (bull bar to rear), z 0 .. 1.661 (roof bar top). Overall 2.275 W x 4.950 L x 1.661 H.
- Wheels: dia 0.699 m, width 0.203 m, track (hub to hub) 1.766 m, wheelbase 2.788 m, tyres touch y=0.
- Origin: on the ground at the wheelbase centre (shifted 0.025 m from the source centre). glTF: nose +Z, left +X (verified in the GLB JSON: steer_FL t = 0.883, 0.352, +1.394; re-import gives nose -Y in Blender).
- Triangles 6,062 total: car_body 4,426, lightbar 300, four wheels 334 each. Meshes 6 = draw calls 6, materials 1 ('PoliceCar', opaque, metallic 0, roughness 0.55), nodes 25 (6 meshes + 19 empties).
- Lightbar separated cleanly (two loose islands above the roof, 200 verts, UVs kept, lenses stay in the shared texture). Looks fine in all views. Its underside is open but sits in the roof.

## Node names (same scheme as the ATV: steer_XX > wheel_XX > WheelMesh_XX; build-props `nodes:true, splitWheels:'nodes', keepOrigin:true` should work as for 'atv')
Meshes: `car_body`, `lightbar`, `WheelMesh_FL/FR/RL/RR`. Empties: `steer_FL`, `steer_FR` (front pivots, at the hub), `wheel_FL`, `wheel_FR` (children of steer_*), `wheel_RL`, `wheel_RR` (at the hub, top level). Mesh vertices are local to the hub, so they spin about X and steer about Y.
Pivots (glTF x, y, z; x left, y up, z nose): steer_FL / wheel_FL (0.883, 0.352, 1.394), steer_FR (-0.883, 0.352, 1.394), wheel_RL (0.886, 0.350, -1.394), wheel_RR (-0.886, 0.350, -1.394).
Note: the body mesh is called `car_body` (the ATV used Body_Paint etc.): PC2 may need to rename or allow it in build-props.

## Anchors (glTF x, y, z; marked by pink spheres in `glb_mk_*`)
- anchor_driver_seat (0.347, 0.520, 0.222): left-hand drive (driver on +X = left), hip point, estimated
- anchor_hands_L (0.446, 1.015, 0.693), anchor_hands_R (0.248, 1.015, 0.693): steering wheel
- anchor_foot_L (0.520, 0.223, 0.717), anchor_foot_R (0.322, 0.248, 0.816)
- anchor_headlight_L (0.668, 0.817, 2.252), anchor_headlight_R (-0.668, 0.817, 2.252)
- anchor_taillight_L (0.703, 0.965, -2.411), anchor_taillight_R (-0.703, 0.965, -2.411)
- anchor_exhaust (-0.505, 0.307, -2.475): the pipe is on the car's RIGHT, rear
- anchor_fuel_port (0.940, 0.817, -1.857): left rear quarter panel; no visible flap in the texture, placed on the panel
- anchor_lightbar (0, 1.604, -0.290)
- anchor_engine_sound (0, 0.594, 1.460)
No cargo/load anchors (not a cargo vehicle). Seat, steering wheel and pedal anchors are estimates from proportions (no interior is modelled); the PC2 stage should check the driver pose in game and nudge with `moveAnchors`.

## PC2 notes
- build-props entry like `atv` (file `Vehicles/Police/IronwoodPDCar Game.glb` after copying into assets-src). Hull about 1.9 wide x 4.95 long x 1.5 high excluding the bar. CLASSES.police in vehicle.js, PAINT/livery (texture-baked black/white; a second force would need a second texture, same model), MAP.vehicles slot at the Ironwood police station (C8) replacing the police car prop.
- Later options (not done): lettering as decals ('POLICE' large, 'IRONWOOD PD' small; the baked trunk/plate pseudo-text should be painted over then), doors that open (needs hand separation), a modelled interior, a cleaner underside, an emissive lightbar material split (the lightbar is its own mesh so the game can flash it; the lens colours are in the shared texture, so a flash needs an emissive overlay or a second material, which would add a draw call).

## Licence
Yes: record it as 'Tripo Pro plan output' (the same wording as the cat), plus 'cleaned by the owner in Blender'. Not verified: that the Tripo plan terms cover the commercial use planned.