# Farm vehicle contract (tractors and tow-behind units)

Same pattern as notes/atv-model-prompt.md. Written 2026-11-17 with the first two conforms (`scripts/farm-conform.py`, outputs in `assets-src\Farm\conformed\`).

## Space
- Metres, flat colours, no textures. Transforms applied (scale 1, rotation 0).
- glTF axes: +Y up, nose to +Z (Blender -Y), +X = the vehicle's LEFT (so FL is +X, FR is -X).
- Origin on the ground (y = 0) centred between the two REAR tyre contact patches (tow units: centred between the axles, or under the single axle). Every tyre touches y = 0 (within 1 mm); nothing is below y = 0.
- Believable size: compact farm tractor about 3.0 to 3.6 m long, rear wheel radius 0.55 to 0.8 m, front 0.35 to 0.5 m. Scale is applied to the geometry, never left on a node.

## Nodes (exact names, case matters)
- Root empty `Tractor_<Name>_Source` (tow unit: `Tow_<Name>_Source`). Body meshes are its children, split BY MATERIAL: `Body_Paint`, `Body_Frame`, `Body_Trim`, `Body_Metal`, `Body_Glass`, `Body_Light` (only the ones that exist).
- Wheels: `wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR`: EMPTIES with the origin at the hub centre, spin about local X, one mesh child (`wheel_XX_mesh`) holding tyre + rim (two material slots: Tire, Rim). Tow units with a tandem axle use the same four names (front axle = FL/FR, rear axle = RL/RR) and do not steer.
- Steering: `steer_FL`, `steer_FR` empties at the front hub centres; they are the PARENTS of `wheel_FL` / `wheel_FR` (child at local 0); they turn about local Y. Rear wheels are children of the root.
- `steering_wheel`: empty pivot at the wheel centre, local Y = the column axis (rotate about local Y); the wheel mesh is its child. Hands anchors sit on the rim.
- Tow unit carried by the tractor model (the tank): a child group `tank` at the ground point between the trailer axles; every node inside is prefixed `tank_` (`tank_wheel_FL`, `tank_hitch_front`, `tank_fill`, `tank_cargo`, `tank_drain`, meshes `Tank_Body_*`). The same unit is also delivered alone (`Tow_<Name>_Source`, no prefix except `tank_fill`).

## Materials (names exact, flat colour, at most 8 per file)
`Paint` (body panels, game recolours it), `Frame`, `Tire`, `Rim`, `Trim`, `Metal`, `Glass` (alpha < 1 allowed, BLEND), `Light` (lens, nothing emissive in the file). Tow units that carry a tank may add `Tank` (shell) and `TowFrame` (drawbar and chassis) in place of the ones they do not use.

## Anchors (empties, glTF axes, metres from the origin)
`seat` and `anchor_driver_seat` (hip point), `anchor_engine_sound`, `exhaust` and `anchor_exhaust` (pipe tip), `anchor_headlight_L/R`, `anchor_taillight_L/R`, `anchor_hitch_front`, `anchor_hitch_rear` (the pin point where a trailer or the tank drawbar eye sits), `anchor_pto` (rear shaft), `anchor_hands_L/R` (on the steering wheel rim), `anchor_foot_L/R`. Tow units: `anchor_hitch_front` (the tongue eye), `anchor_cargo` (centre of the load volume), `tank_fill` (top of the filler), `anchor_drain` (rear low point). No bed entry is needed for a tractor in dist/cargo.js; the tank unit needs one (liquid, not boxes).

## Cleanliness
Duplicate vertices merged, closed parts have outward normals, no loose vertices, no degenerate faces, smooth shading by angle (30 degrees). OPEN single-sided sheets (fenders, cab frame) cannot be oriented by rule: the materials stay double-sided. No floating parts is checked by eye only (renders), not by a distance test.

## Verify
Re-import the .glb with `node scripts/glb-inspect.cjs` and `glb-tree.cjs`; lowest point y = 0; 4 renders (front 3/4, side, rear 3/4, top) looked at.
