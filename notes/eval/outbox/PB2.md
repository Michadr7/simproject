michadr.

# PB2 feet-sink MEASUREMENT (re-measure of the current tree, 0.35.17)

## Short answer
Nothing left to fix inside the road width. The earlier PB2 stage (handoff line 203: world.js footingAt asks the loaded tile first, refine() splits ribbons, terrain.js BRIDGE -.02, game.js street boxes) already removed the sink. This run re-measured it at 1 m spacing on 54,339 points (58,349 planned; 4,010 skipped as STREET cells whose boxes are built in game.js, or water). Every road's interior is within 1.5 cm of the drawn top. No edit is proposed. Two cosmetic leftovers are listed at the end.

## Method
- Scratch scripts in the scratchpad (no repo edits, no new test, no git): pb2-scan.mjs (centreline 1 m along x 1 m across, every edge of MAP.roads.edges, plus a 28x28 m grid at each node of degree 3 or more: cedarLoopStart (120,-57) and edenJoin (600,68)), pb2-edge.mjs and pb2-edge2.mjs (the band from 1 m inside to 2 m outside the ribbon edge, 0.25 m across), pb2-deck.mjs (every 0.5 m on all 4 bridge decks).
- createWorld(streaming:true), world.ensure() on every point, then a THREE.Raycaster straight down against the ground meshes (ground-asphalt/driveway/path/base, dug-, gravel-road, dirt-road, track-, mud-, field-, hill-, lot-, bridge-deck, pavement, eastbank-paving, road-joints). Painted dashes and markings are excluded (they are decals).
- Error d = standHeight(x,z) (what the player and vehicles stand on) minus the top of the drawn mesh, in cm. Negative = feet sink, positive = float.
- "OLD" columns = same mesh, but standing on the pre-fix footing source (terrain().footingAt, the whole-map mask). This reproduces the sink the user saw; it is a reconstruction (the meshes are the fixed ones), not a replay of the old build.
- Not measurable here: Oak Street and Alder Avenue (boxes built in game.js, not in the Node scene). Those are covered by the source-text check in tests/footing-match.mjs (street 1.5 cm, pavement slab 1.5 cm), which passes.

## Numbers (cm, stand minus mesh top; interior samples)
| group | n | min | mean | max | mean abs | sink>3 | float>3 | OLD min / max / mean abs / sink>3 |
|---|---|---|---|---|---|---|---|---|
| old roads | 18,054 | -0.92 | 0.00 | 0.92 | 0.01 | 0 | 0 | same (-0.92/0.92/0.01/0) |
| R3b roads | 34,603 | -1.07 | 0.00 | 1.43 | 0.01 | 0 | 0 | -8.57 / 0.00 / 4.26 / 24,116 (70%) |
| bridge decks (road samples) | 1,159 | -1.07 | -0.01 | 1.06 | 0.36 | 0 | 0 | -8.57 / 0.92 / 3.91 / 575 |
| junction grids (2 nodes) | 1,682 | -5.00 | -0.71 | 4.20 | 0.83 | 46 | 17 | see below |

Per road (all interior samples within 1.5 cm after the fix). The old-footing column shows what the user felt:
| road | n | min | max | OLD sink>3 |
|---|---|---|---|---|
| eden-road | 3720 | 0.00 | 0.00 | 3600 (-5.0) |
| eden-spine | 5280 | 0.00 | 0.00 | 5280 (-5.0) |
| eden-haul | 1170 | 0.00 | 0.00 | 1170 (-5.0) |
| eden-car-link | 600 | 0.00 | 0.00 | 600 |
| bay-road | 3320 | 0.00 | 0.00 | 2900 |
| bay-front | 4320 | 0.00 | 0.00 | 4320 |
| bay-cross-west / -east | 1200 / 1200 | 0.00 | 0.00 | 1200 / 1200 |
| coast-link | 2592 | 0.00 | 0.00 | 2592 |
| estuary-road (incl. bridge) | 980 | -0.46 | 0.88 | 980 (-7.96 at the bridge) |
| west-bank-lane (gravel + bridge) | 2700 | -1.07 | 1.43 | 175 (-8.57 at the bridge) |
| blackstone-access, lake-road, p5-spur (gravel) | 3423 / 2940 / 1158 | 0.00 | 0.00 | 66 / 0 / 33 (gravel -.066 vs grass -.095: +2.9 float, no sink) |
| county-road, freight-road (incl. their bridges) | 2048 / 2898 | -0.92 / -0.61 | 0.92 / 0.60 | 0 / 0 |
| alder-cross, works-lane, freight-south/-out, cedar-link/-loop, oak-east, alder-street | about 8,000 | -0.00 | 0.00 | 0 |
| farm-road, woods-road, woods-lane (dirt) | about 3,000 | -0.20 | 0.00 | 0 (the -0.20 is the mud-woods-dip plane) |
| bridge decks over the whole deck, 0.5 m grid (county, freight, west-bank, estuary) | 1120 / 1600 / 720 / 1600 | -1.21 / -0.60 / -1.06 / -0.60 | 1.21 / 0.60 / 1.08 / 0.60 | 0 |

Worst places inside the road width after the fix: the bridge arches (West Bank Bridge (-348 .. -320, 8) -1.07 and +1.43 at its east end where the gravel lane meets the deck; County Bridge (-33.5, -146.5) +-0.92; Estuary Bridge +0.88). All under 1.5 cm.

Junctions (28 m grids): the 5 cm "sink" (46 samples) and 3.7 to 4.2 cm "float" (17) are not in the road. Detailed offender list: they are all points that lie exactly on a ribbon edge or on a bit of grass, driveway or footpath next to it (edenJoin: z 74.0 and 60..61, x 586..614; cedarLoopStart: z -54, z -62..-64, the path at x 119 and the driveway at x 125). The grid used integer metres, which coincide with the ribbon edge (road z 68 +- 6 = 74.0). That is a tie between the 0.5 m mask cell and the mesh edge, not a junction patch error. No junction fillet or apron interior exceeds 1.5 cm.

## Where the remaining error comes from (edge band, 0.25 m across)
Offsets from the drawn ribbon edge: -1.5 m to -0.5 m: 0 of 10,593 over 3 cm. At -0.25 m: 20. At exactly 0.00 m: 3,282 of 10,433 (the tie). From +0.25 m outward: about 0.5 to 1% (mostly the same 3.7 cm float on a ROAD mask cell where the mesh is not drawn, and 5 cm sink on grass cells covered by the ribbon). So the mismatch is a strip of at most one 0.5 m mask cell (<= 0.25 m wide each side) along every asphalt road: SAMPLING RESOLUTION of terrain.js (0.5 m cells, road cell if its centre is inside the road rectangle), not the footing table and not the mesh heights. Its size is the asphalt-to-grass step itself (FOOTING.ROAD -.045 vs GRASS -.095 = 5 cm). A person walking across the edge gets one step of 5 cm within the cell; vehicles do not notice. The tile mask exported to the world has the same cell size.

Source split of the original bug (confirmed by the OLD column): footing (terrain().footingAt via the whole-map mask) was the cause on all R3b roads outside the old ground (5.0 cm sink on ROAD, 7.3 to 8.6 cm on the new bridges and gravel-to-bridge joins). Mesh heights were already good after the refine() change (interior +-0.0). Sampling only matters at the edge strip.

## Proposed edit
None required. Predicted effect of doing nothing: interior error stays under 1.5 cm everywhere measured.

Optional (not recommended now, tiny): to remove the exact-edge tie, terrain.js buildTerrain could paint a road cell when ANY of its corners is inside the road (conservative edge); predicted effect: the 0.00 m bin drops from 31% to about 0 over 3 cm, but it makes roads 0.25 m wider in the mask on both sides (affects walkable/road speed at the verge and the junction pins in tests). I did not prototype it; do not apply without a feel check.

## Not verified
- No browser, no GPU: nothing seen. The "feet" are the origin plus SOLE_LIFT (avatar idle soles measured 0.86 cm worst by tests/footing-match.mjs; walking animation and carry poses not measured).
- Oak Street, Alder Avenue and the city pavement slabs are game.js boxes: only the source-text check applies. (A raw scan reported them as +24.7 / +21 cm because the box meshes are absent in Node: false alarm, do not act on it.)
- Vehicles: wheel contact height (vehicle.js wheel offsets, suspension) not measured; only the stand height they share.
- Slopes: samples are on the centreline plane; cross-slope on dug banks (estuary-road dug-5:16 sample showed +4.4 to +9.4 cm floats at x 108..140, z 405..406.5, i.e. the 0.25 m band beside the estuary bridge where the dug bank mesh rises above the mask's grass) is a one-off at the bridge sides.
- Grass remains 1.3 cm sink on average (-2.63 worst) because the city is pinned to -.095 (tests/footing-match.mjs soft limit 3.0).
- tests/footing-match.mjs ran and passed (7 checks; output: GRASS -2.63/-1.31/-0.27, ROAD 0.00/0.00/0.47, BRIDGE -1.06/-0.13/0.72, GRAVEL 0.00/0.01/1.49). I did not add tests/footing-roads.mjs, so release and index were not re-run.

## Confidence
- Interior roads, bridges, gravel: high (58k raycasts, all consistent with the 20 m test).
- Edge-strip diagnosis (cell quantisation): medium-high (offset bins show it, but I did not change the mask to confirm).
- Junctions: medium (two nodes with degree 3 or more only; R4 patches at (600,-200) and (520,330) were reached by the road scan, no outlier, but not grid-scanned).