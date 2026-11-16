michadr.

# RU2 rescue points, edge scenery bands, validateMap checks: done (data and checks), edge trees NOT yet visible

Files changed (minimal, additive)
- dist/map-definition.js: MAP.rescuePoints (9), export nearestRescuePoint(x,z,map), MAP.scenery.edgeBands (3 rectangles), a new validateMap block after the RU1 block.
- dist/world.js: one line after the old belts loop: `for(const spec of scenery.edgeBands||[])belt(...spec);`
- dist/game.js: import nearestRescuePoint; reset() outdoors now places you at the nearest rescue point instead of always the spawn (the Ironwood point IS the spawn, so nothing changes in the old block).
- tests/rescue-ru2.mjs (new, 31 checks). PROJECT-INDEX.md regenerated (index 30399 of 31500, brief 2996 of 3000).

Data
- Rescue points: ironwood (-5,15 = spawn), kaspian-harbor (340,400), eden-gate (690,-200), lake-car-park (620,-420), trailhead (830,-720), camp-c1 (760,-790), camp-c2 (480,-900), camp-c3 (700,-1040), husky-farmstead (-200,-250).
- Edge bands (30 m inside the wilds): north [-440..1040, z -1190..-1160], west [x -440..-410, z -1160..590], east [x 1010..1040, z -1160..590]; spacing 5.5, chance .2, salts 31..33. South is skipped (the sea closes it).
- validateMap: rescue ids unique, finite, inside world and walkable ground, no water within 10 m, not on or within 1.5 m of a building, one point at the spawn; edge bands valid rectangles inside the wilds, off every zone, not covering a rescue point.

Tests: node tests/rescue-ru2.mjs -> PASS rescue-ru2 (31 checks). zones-ru1 (32) and map.mjs pass. npm run release -- --force then npm test: All 210 test files passed (no re-run needed, no pins moved).

PROBLEM FOUND (edge trees are not visible yet)
- The edge bands produce zero trees: worldLayout() still gives 525 decor. world.js claimed() treats any point outside the old-ground terrain mask as claimed, so the wilds get no scenery. Making the bands real needs the wilds' terrain mask (chunks) to answer claimed(), or a chunk-time scenery pass: a world.js/chunks stage (forbidden territory for a data stage). The data and the world.js loop are ready and will start working when claimed() works in the wilds.

DECISIONS TO CONFIRM
- The old belts (around the old block, partly now in open wilds) were NOT removed: removing them re-pins the old-block tree layout (world.mjs 395 pines + 525 decor and others). "Moved" is therefore half done: new bands added, old belts kept. Say if you want them removed and the pins moved.
- Husky farmstead point (-200,-250) is a guess (no farmstead exists in MAP yet); move it when the ranch is built.
- Ironwood hotel door does not exist in MAP: the spawn stands in for it.
- Owned-plot rescue points are not in the data (plots P1..P9 are not in MAP yet).
- validateMap cannot run the 300 m2 OPEN_AREA test (it needs colliders): it checks dry ground and building clearance only; safe-spot.js does the real test at run time.

Not verified: nothing seen in a browser. R from the wilds going to the nearest point is untested in the running game (game.js hook is one expression). Frame cost: none now (zero trees); once claimed() works, about 1000 decor trees at the three edges, culled at 158 m.
Left: edge trees in the wilds (claimed), old belt removal, plot rescue points, Husky farmstead coordinates, soft wall + fade at the edge.
