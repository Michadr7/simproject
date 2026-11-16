michadr.

# RU1 weapon and fishing zones: done

Files changed
- dist/map-definition.js (minimal, additive; main-chat file): MAP.weaponZones (1 hunting + 5 noWeapon), MAP.fishing (basin rect, 5 spots, water kinds), exports weaponZoneAt(x,z,map) and fishingAt(x,z,map), a new validateMap block before the roadProblems line. R4 towns, links and wild signs untouched. No props files touched.
- tests/zones-ru1.mjs (new, 32 checks): data pins, both lookups, 15 broken-map cases.
- PROJECT-INDEX.md regenerated (index 30393 of 31500 tokens, brief 2996 of 3000).

Data (map-master 7.1)
- hunting 'blackstone' 350..1050 / -1200..-700, roadMargin 100, keepOut circles r100: camps C1 (760,-790), C2 (480,-900), C3 (700,-1040), plots P1 (600,-690), P2 (900,-900).
- noWeapon: old-block -250..290/-380..100, kaspian-bay 160..520/250..440, eden 700..1000/-360..-60, eden-outdoors 680..730/-430..-390, ranch-growth -330..-35/-420..-178.
- fishing: lake-basin 520..800/-660..-440; spots dock-end (650,-470), stream-mouth (700,-660), outflow-weir (540,-470), rocky-point (790,-540), p1-shore (600,-680), r 10; water kinds river and sea within 6 m.
- weaponZoneAt: noWeapon wins, then hunting (outside keep-outs, 100 m from nearestRoad), else 'open'. Event-time only, not per frame (nearestRoad scans the road graph).

validateMap checks: valid rect inside world, known kind, unique id, hunting margin >= 100 and sane keep-outs, hunting overlaps neither hunting nor noWeapon, spawn and every town centre are noWeapon, fishing rect and spots inside world and outside hunting, no duplicate spot, known water kinds.

Decisions to confirm
- Design says weapon zones must not overlap, but ranch-growth overlaps old-block (x -250..-35, z -380..-178). I let no-weapon zones overlap each other (same rule) and forbid any overlap with a hunting ground.
- Dock end taken as 20 m north of (650,-450), i.e. (650,-470): design wording is ambiguous.
- Camps and plots P1..P9 are not in MAP yet, so the keep-out circles hold their design coordinates; RU2/plot stages should link them.
- No lake exists in MAP.water yet, so lake fishing relies on the basin rect and spots; 'lake' is an allowed water kind for later.

Tests: node tests/zones-ru1.mjs -> PASS zones-ru1 (32 checks). npm run release -- --force then npm test: All 209 test files passed (one run, no failures). tests/map.mjs and road-graph pass.

Not verified: nothing seen in a browser; no game code reads the zones yet (no game.js edit needed for RU1). Frame cost: none (data only).
Left: RU2 (rescue points, edge scenery, remaining validateMap checks); hooking zones into crime/weapon code (B5).