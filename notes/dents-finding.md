# VD3b dents: finding (2026-11-17): DROPPED, nothing shipped

## Vertex density (measured from dist/*-assets.js)
| Part | Vertices | Triangles | Edge median | Edges over 0.25 m / 0.3 m |
|---|---|---|---|---|
| S70 paint (cab, fenders) | 1231 | 1234 | 0.11 m | 25% over 0.25 m (16% over 0.3 m, max 2.6 m) |
| S70 door paint (each) | 266 | 176 | 0.13 m | 30% over 0.3 m, max 1.6 m; own pivot |
| S70 body (dark parts) | 3480 | 2284 | | |
| Flatbed paint | 878 | 404 | 0.24 m | 41% over 0.3 m, max 3.1 m |
| Worktruck (one mesh) | 5348 | 5047 | | |
| Off-road pickup (one mesh) | 8525 | 8663 | | |

The paint panels are big flat quads. A dent needs edges of about 0.1 m or less over its 0.3 to 0.5 m footprint, so vertex displacement in the 'vehicle-paint' shader would give faceted blobs, and the doors (parts with their own pivots) would tear at the seams. Vertex displacement rejected.

## What was tried instead
A shading-only dent in the same 'vehicle-paint' fragment shader (no program key change, no vertex moves, hulls untouched): a bump height field of elliptical bowl dents on a jittered grid in the face plane, localised by the hit mask [front, rear, left, right], scaled by damage, seeded from the vehicle uid. Headless Edge screenshots of a hit S70 (front and left, plus a wreck):
- Strong depth: reads as polka-dot rings / craters, clearly fake.
- Soft depth: at game distance (9 m) it reads as faint blotchy smudges, like dirt, not dents. Close up (5 m) the left door looks a little like hail dents.
- The front of the S70 is a curved cab, so dents there were barely visible at all; scratches and primer patches (VD7b) dominate.

## Decision
Dropped as the design asks ("if it looks fake, drop dents"). The code was removed again (dist/paint-shader.js and dist/driving.js are back to the VD7b state). The grime, scratches, primer patches and cracks (VD3, VD7b) stay the damage look.

## If dents are wanted later
Needs a model change, not a shader: Blender-made damaged variants (or shape keys) of the S70 paint part with a denser mesh on the front, rear and sides, swapped or blended by the hit mask. That adds vertices and either a morph target (one extra attribute set, no extra draw call) or a second mesh (extra draw call and material). Costs a model job per vehicle; recommend only for the S70.
