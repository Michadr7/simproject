michadr.

# 0364 · Oak Street Apartments See-Through Entrance & Matching Interior Door

## Files Changed (with line counts)
- `dist/apartment-lobby.js` (267 lines) — Extracted shared `addLobbyFrontWall()` (framed double glass door, glass sidelights, low-sill picture windows, upper transom lintel; glass excluded from `occluders` and doorway clear of `LOBBY_EXIT`) and `populateLobbyInterior()` so `createApartmentLobby()` and new `buildOakLobbyExterior(scene, originX, frontZ)` share identical layout, doors, concierge, elevator alcove, mailboxes, and furniture; added outside Oak Street vista for interior look-out and daylight `#9fc1d6` sky background.
- `dist/game.js` (2633 lines) — Imported `buildOakLobbyExterior`; split `OAK STREET APARTMENTS` building shell (`building()`) into upper brick stories, two `1.5 m` ground corner brick piers, and back brick closure wall (`name = 'oak-apt-brick'`) while preserving the exact outer footprint collider; skipped opaque ground `#3d555a` window slabs on `OAK STREET APARTMENTS`; replaced brick-backed entrance with `buildOakLobbyExterior(scene, MAP.studio.x, -8.5)` + canopy and `'18'` plaque.
- `dist/visuals.js` (20 lines) — Extended brick texture pass in `polishWorld()` to apply repeating brick textures onto all `'oak-apt-brick'` structural meshes cleanly.
- `tests/apartment-lobby.mjs` (59 lines) — Added assertions for `LOBBY_EXIT` clearance, 4 transparent non-occluding `'lobby-storefront-glass'` panes, transparent interior `exitDoor` panels, and matching `buildOakLobbyExterior(extScene, 1, -8.5)`.
- `tests/startup.mjs` (244 lines) — Added assertions verifying `'oak-lobby-exterior'`, 4 transparent `'lobby-storefront-glass'` panes, and `'oak-apt-brick'` ground bay opening in the booted `0.36.4` world scene.
- `notes/handoff.md` (477 lines) — Documented the see-through apartment door & matching lobby interior update.

## Verification & Command Output
- `node tests/apartment-lobby.mjs`:
  `PASS apartment-lobby: lobby & residential hallway floors 2-4, doors, occluders, colliders, and doorway NPC verified`
- `node tests/storefronts.mjs`:
  `Glass sightlines reveal real interiors; no leftover doorBits; counter stays solid/opaque; setLight dims/restores; café work stations are reachable.`
- `node tests/doors.mjs`:
  `Doors: sliding stays automatic; hinged and double doors are manual, swing into the room about their hinges, a pair mirrors, snap shuts without the swing, a handle-less leaf is one mesh; the market is sliding, the cafe and the office have double glass doors.`
- `node tests/map.mjs`:
  `Map data is valid and frozen; zones, roads, fields, trees, shops, hours, studio and spawn match the numbers they replaced; 77 broken maps are each caught; Ironwood, Cedar Heights, Eastbank Works, the second bridge and the plots are in place.`
- `node tests/street-trees.mjs`:
  `Street trees: 15 (11 on Oak Street, the rest in the town), none in a road.`
- `npm.cmd run index; node tests/brief.mjs`:
  `brief 2840 tokens (target 3000), index 32295 tokens (target 37000); 295 modules, 15 generated, 353 tests, 34 scripts; 13 modules without a header comment`
  `brief tests passed: 295 modules listed, brief 2840 and index 32295 estimated tokens (budgets 3000 and 37000)`
- `npm.cmd run release -- --force`:
  `Packaged release 0.36.4: 296 files -> dist/releases/0.36.4`
  `dist/index.html now loads releases/0.36.4/`
- `node tests/startup.mjs`:
  `Fresh save: creator, phone apps/controls/gigs, and multiplayer frame checks passed.`
  `Existing save: gameplay, phone apps/controls/gigs, and multiplayer frame checks passed.`
- `npm.cmd test`:
  `ALL 353 PASSED`
  `All 353 test files passed.`

## What Could Not Be Verified
- Live browser GPU visual inspection looking through the Oak Street Apartments entrance both from the street and from inside the lobby (Chrome remote debugging is not active in this sandbox; requires owner browser GPU check).

## Requests / Forbidden Edits Needed
- None.

## Confidence Per Part
- **High:** Shared storefront/interior geometry alignment, collider/occluder isolation, brick texture preservation, `brief` token budget, and `353/353` automated test pass.
- **Medium:** Visual glare/warm-emissive balance through the exterior glass in live WebGPU/WebGL lighting pending owner eye-check.
