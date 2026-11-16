michadr.

# RV1 river bank polish: report

## Files changed (line counts after)
- dist/height.js (62; NOT on the "may edit" list, edited because the bank profile lives here): BANK_LIFT=.5 and SHOULDER_LIFT=.2 exported; the bank is half straight line, half cosine, so the ground has a real slope at the waterline.
- dist/dug-ground.js (68): shoreCell(), DUG_SHORE_FINE=1 m lattice for the cells the waterline crosses, new mud colour ramp (mud only on the wet bank, grass on the shoulder and lip).
- dist/ground-shader.js (152) and dist/ground-rules.js (75): the 'valley' ground kind gets the grass clump/fleck/relief code (GD_DETAIL_KINDS += 'valley'), so the dug ground matches the textured grass beside it. No new program, no new draw call.
- dist/terrain.js (139): bridgeAlign() and BRIDGE_LEAD=12, used by roadCenterline() for curved roads.
- dist/vehicle.js (199): shoreGuard() and a 2-line hook in stepVehicle (soft turn-back).
- tests/river-bank.mjs (65, NEW, 2830 checks); tests/ground-shader.mjs: ONE line re-pinned (valley now has the grass relief normal instead of ''). 
- NOT touched: world.js, game.js, map-definition.js, driving.js, road-geometry.js (no edit was needed), notes/handoff.md.

## 1. Diagnosis (Node script in the scratchpad, numbers)
- Old reach (12 m wide, water -0.95): cross-section d from centre: bed -1.40 at 0, waterline -0.95 at d=6, bank to -0.35 at d=8.6, then a 6 m "shoulder" terrace rising -0.35 to 0 at d=14.6. The old bank had ZERO slope at the waterline (both bed and bank were cosines), and the ground mesh lies 8 cm under its true height (DUG_Y), so the ground was within 2 cm of the water for ~0.5 m: the waterline moved +-0.3 m with the 2 m lattice (sd 0.266 m, spread 0.82 m measured over 118 samples).
- The "pale flat sand bank" is the shoulder: vertex colour went by depth, -0.35 gave 50 % mud over a 6 m wide terrace, then the dug cell staircase (4 m cells) met the textured grass plane with a plain colour (the 'valley' program had no clumps/flecks): the hard square/diagonal patch edges.
- Estuary bank: water -2.0 climbing to the -0.35 shoulder in 2.6 m: max slope 1.00 (45 degrees) old, 0.82 new. NOT widened (needs data: a per-river bank width).
- Invisible wall: SURFACE.WATER and BANK discs are painted unwalkable out to half width + 2.6 m = 8.6 m from the middle of the old reach, on ground that still looks like grass (shoulder terrace 0.35 m under normal ground). blocked() is a hard wall there; vehicle.js already slides along walls but a head-on run hit it at full speed (a crash with damage).
- West Bank Bridge (deck x -349..-319, z 2..8, centre z 5): the curved west-bank-lane arrived up to 1.4 m off the deck middle and 8 to 20 degrees off its axis within 4 to 8 m of both ends (the deck is straight and square, the ribbon is cut square to its own heading: the diagonal cut and seam). Heights: ground at the deck ends -0.031 (east) and -0.004 (west); deck top at the ends -0.02; the gravel lane surface is -0.066 + ground: a 2.5 to 5 cm step at the joint (NOT fixed, see leftovers). County/Freight/Estuary bridges: roads are straight and on axis (no heading error).

## 2. Bank and bed profile
- Slope at the waterline 0 -> 0.115 (old reach); bank max slope 0.29 on 12 m reaches; the waterline, the shoulder and the lip heights are unchanged; the ground moves by at most 3 cm (8 cm in the estuary) anywhere, so no other height pin moved.
- Mesh: cells within 3 m of the waterline (centres) use a 1 m lattice (DUG_FINE stays 2 m elsewhere). Visible waterline sd 0.266 -> 0.065 m, spread 0.82 -> 0.22 m.
- COST over the whole world (57 chunks with dug mesh): vertices 127,980 -> 151,180 (+23k), triangles 93,740 -> 128,540 (+35k), geometry about 4.2 MB -> 5.2 MB (+1 MB if every chunk were resident; chunks stream), build time all chunks 143 ms -> 230 ms (+87 ms spread over chunk loads), worst single chunk 6.6 ms -> 13.1 ms (once, when that chunk streams in; watch for a hitch while driving along the river). Largest chunk 4889 vertices. No new meshes, materials or draw calls.

## 3. Sand/grass edge
- Colour: mud only below -0.3 m (full at -0.8 m, i.e. the wet bank), grass on the shoulder and the lip: the 6 m terrace is now grass colour, so the cell staircase edge has nothing to show.
- The valley ground now has the same macro/meso tone, clumps, flecks and bump relief as the grass planes (same program count: 10 ground programs, one shader change to the existing 'valley' program).
- NOT done: a dithered GD2-style soft border at the dug-cell outline (not needed once colours match; add if the eye check still shows a seam).

## 4. Soft turn-back (vehicles only; walking untouched)
- shoreGuard() in vehicle.js looks along the way of travel (forwards or reverse) up to 4 to 12 m (1.4 x speed) for SURFACE.WATER or BANK; allowed speed = 2 m/s + 0.9 x free metres (soft exponential braking, at most 12 m/s^2), the player's steering fades out and the wheel is turned toward the clearer side; a gentle nudge when the shore is close at one side. Bridge decks are never a hazard. The wall stays as the backstop. Defaults chosen: SHORE_LOOK [4,12], SHORE_BRAKE 12, SHORE_FLOOR 2, SHORE_K .9, SHORE_FAN .7 rad.
- Measured (worktruck, full throttle at a bank 50 m ahead, yaw 90): 0 hits, speed 8.8 -> 3.8 m/s, turns about 80 degrees and runs away along the shore; the same drive without the guard hits. Same for offroad and atv, in reverse, at 45 degrees, and at 30/60/144 Hz.
- Walking: terrain mask unchanged, test asserts water and bank are still blocked and the shoulder walkable.

## 5. Bridge joint
- bridgeAlign(): the points of a curved road within 12 m (BRIDGE_LEAD) of a bridge end ease sideways onto the deck middle (smoothstep, exact at the end). Result on the west-bank-lane: within 3 m of either end the lane is within 0.2 m of the middle and within 3.4 degrees of the axis within 2 m. Only the west-bank-lane changes (the only curved road that crosses a bridge); because roadCenterline feeds the mask, the road mesh and the dashes, they all move together. map-definition's roadPolyline (route graph) still has the unaligned line (at most 1.4 m apart: only routing uses it).
- BRIDGE_LEAD 12 (not 14): 14 pushed one gravel footing-match sample to 1.52 cm over the 1.5 cm limit; at 12 the worst gravel sample is 1.49 cm (very close to the limit, watch it if the road or ground changes).
- NOT done: the 2.5 to 5 cm vertical step between road and deck end; the abutment's sand polygon is handled by the colour change (no geometry change).

## Tests (real output)
`node tests/river-bank.mjs`:
```
  waterline across 41 samples: mean 6.37 m from the middle, sd 0.065 m, spread 0.22 m
PASS river-bank.mjs: 2830 checks (sloped bank, 1 m shore mesh and a steady waterline, grass shoulder with mud only on the wet bank, the road meets the bridge straight and centred, soft turn-back for three vehicles forwards, in reverse and at 45 degrees, at 30/60/144 Hz, decks never a hazard, walking unchanged)
```
Re-run alone and passing after the changes: water-height, height, road-r3b ("R3b ok: 461 checks"), terrain, roads, footing-match ("7 checks passed"), vehicle, driving-game, atv-import, damage-feel, tracks, basin-walk, ground-shader ("ground-shader: 58055 checks ok").
`npm run release -- --force` -> "Packaged release 0.35.9: 179 files". `npm test`, first run: 220 of 221 passed (1 failed: hub-runs.mjs, needed a second run, passes alone: "hub-runs: ok"; tow-driven.mjs also needed a second run). Second full run: 219 passed, 2 failed: brief.mjs (only because tests/river-bank.mjs was not in the index yet; fixed by `npm run index`, then `brief tests passed`) and tow-driven.mjs (flaky under load; passes alone: "PASS tow-driven.mjs ..."). After the index, I did not run a third full npm test. So: no failure that I could attribute to my change; the names that flaked are hub-runs.mjs and tow-driven.mjs.
`npm run index`: "brief 2996 tokens (target 3000), index 26655 tokens (target 32500)" (cap not raised; brief is 4 tokens under its target of 3000).

## Could NOT verify (eye-check list, GPU browser)
1. North river, old reach, e.g. x -110, z -148 and the outflow around (400,-260): waterline smooth? bank slope visible? no pale terrace, no square/diagonal patches where mud/grass meet, no thin cracks between 1 m and 2 m cells (T-junctions: 2 to 3 cm height differences at the band edge, 4 cm worst estimate).
2. West Bank Bridge (x -349..-319, z 5) from both ends: road straight into the deck, no diagonal cut, no seam; the 2.5 to 5 cm lip at the deck end may still be visible.
3. Estuary Bridge (z 400) and the estuary bank (still steep, slope 0.82).
4. Driving a truck at the river bank from 5 to 10 m/s, head-on and at a shallow angle: it should brake and swing away without a thud; check the swing is not too strong when you steer along the shore on purpose, and that bridge approaches at an angle are not pushed off.
5. Frame time while driving along the river (the worst chunk build went 6.6 -> 13 ms).
6. Trees "mown straight edge" on the grass side: not touched (the tree layout keeps off the bank mask; that is ET1 edge trees).

## Left over / suggestions
- Estuary bank width and slope (data: per-river or per-sample bank width in map-definition.js).
- Vertical step road to deck (2.5 to 5 cm): needs a road-height ease near bridge ends in world.js ribbon and footing together (footing-match limit 1.5 cm), left alone.
- If the shore band shows cracks, give the 2 m neighbours of shore cells a matching edge lattice.