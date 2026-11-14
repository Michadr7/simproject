# Collision feel (C1), requested 2026-11-14

Not built. Waits until F1 (streaming) is done, because F1 rewrites how colliders are registered and removed (notes/streaming-brief.md risk 2). Do not touch collider shapes or padding before that.

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