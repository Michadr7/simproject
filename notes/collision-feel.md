# Collision feel (C1), requested 2026-11-14

Built for vehicles 2026-11-17 (see the bottom). Waited for F1 (streaming) is done, because F1 rewrites how colliders are registered and removed (notes/streaming-brief.md risk 2). Do not touch collider shapes or padding before that.

## What the user wants
- Walking and driving can get right up to things (walls, props, cars, lamp posts): no big invisible gap.
- Touching something feels smooth: a soft push or slide, not an abrupt stop, while walking, and at low speed when driving.
- Only a real crash while driving (impact speed above the threshold in notes/vehicle-damage-design.md) may stop the vehicle hard.

## Evidence so far (hypotheses, not measured)
- S70 hull is the full model footprint 2.21 x 5.51 m including mirrors; the body is about 2.0 m wide.
- blocked() adds PLAYER_RADIUS 0.33 m around every solid box (vehicle.js line 11); vehicle hull points are inset by the same amount so they cancel for vehicles, but props and buildings keep the visible gap for walkers.
- A parked car at an angle may collide as a padded or axis-aligned box (screenshot 2026-11-14: a large gap between the S70 and a parked car).

## Plan (Sonnet, after F1, before the damage build VD1; about 60 to 90k tokens (e))
1. Measure the real gaps in metres: truck vs wall, parked car, lamp post, building, prop; walker vs the same.
2. Tighter hulls (no mirrors), true oriented boxes, smaller padding where it shows.
3. Soft contact: slide along the surface and ease the speed down (a damped push) below the crash threshold; keep the hard stop for crashes.
4. Keep the tests that pin collision numbers green; add a gap test (max visible gap per prop class).

## Built (C1, 2026-11-17, Sonnet 5.5): vehicles only
Cause found: `stepVehicle` refused the whole step when the pose was blocked, so the vehicle stopped up to one step short (8 cm at 5 m/s, 20 cm at 12 m/s at 60 fps, 50 cm at 30 fps), and the only slide tried was along the world x then z axis with a "must keep 20% of the step" rule. At any other heading the slide was rejected, speed was set to 0 and the yaw change refused, so the vehicle was stuck until you reversed. No normals exist (blocked() is a yes/no point test), so the fix works from the step itself.
What changed: dist/vehicle.js only. On a blocked step: (1) bisect (7 rounds) to the furthest free pose along the step, so the stop is within a few mm; (2) slide: turn the intended direction away from the obstacle by the smallest angle (5 degree steps up to 80, found by halving) that lets the hull fit, move the part of the step along it, speed kept (0.5 x dt x sin loss); (3) head on (within 10 degrees of square, or wedged in a concave corner) the vehicle stops at the contact and speed is 0, and with the wheel turned and throttle held the nose may swing along at walking pace if that is free; (4) a start pose already inside something is eased out (rings up to 0.4 m). Return fields: `state`, `hit` unchanged; added `impact` (m/s into the obstacle, |v| x sin of the slide turn; head on = |v|; free = 0) and `hitKind` ('world' | 'vehicle' | 'person' | null) for VD1. No damage code.
Test: tests/collision-feel.mjs (pure, 9 groups). Pins: gap at first contact at most 5 cm head on (S70 and worktruck, 4 speeds, 30 and 60 fps); nose-in at 1 m/s then reverse; 15 degree nose-in drives along the wall; slide along a wall at 10 to 75 degrees at 3 and 10 m/s; round post hit with the nose corner; concave and convex corners; parked car (oriented hull) gap and glance; 25 m/s crash stops dead, 10 degree scrape at 15 m/s has impact under 5; push-out; blocked() calls per contact step.
Numbers: gap at first contact under 1 cm at any speed (was up to 20 cm at 12 m/s). A contact step costs about 220 blocked() calls on average (worst 270 in the real world, 884 in the synthetic worst case) against 29 for a free step; 0.33 microseconds per call, so about 0.1 ms per contact step; free driving is unchanged.
Known limits: the flat nose square on to a post or a wall is a head-on stop (that is the physics of a flat face: reverse or steer); colliders are still axis-aligned boxes inflated by 0.33 m (the corner of a diagonal inflated box is up to 14 cm fatter than the object), and the S70 hull still includes the mirrors; neither was touched. Walkers were not changed: they already slide along axis-aligned boxes and their stop gap is one step (3 cm at 165 fps, about 15 cm at 30 fps); the vehicle cause (whole-step refusal with a bad slide) is not shared.