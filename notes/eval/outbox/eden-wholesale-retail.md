michadr.

# Eden Wholesale retail in 0.36.3

- Moved the footprint three metres south to x 30–42 and z −69 to −60. The paved rear alley runs from Barber's Walk to the Ironwood Street sidewalk. A footing covers the portion of the site that moved into the lot, and the front path stays separate from the asphalt dock approach. Removed two parking stripes from the shop footprint and path, leaving 15 lot bays.
- Added a walk-in trade counter open 7 AM to 5 PM. Dana Sato sells a bag of flour for $2 and ground coffee for $4. Both stack and save as ingredients. The prices are initial values chosen for this release.
- Set the custom façade, window and lamp materials to render and cast using the model's outward-facing triangles. The mesh still casts and receives shadows. It keeps its three material groups and uses the existing lighting. The interior is hidden while the player is outdoors.
- Rebuilt the local 0.36.3 package. The bakery delivery loop remains queued. The relocated pickup and truck bay anchors are ready for the delivery wiring.

## Files changed

| File | Lines | Change |
| --- | ---: | --- |
| dist/map-definition.js | 1176 | Site, pavement, parking, public access and trading hours |
| dist/eden-wholesale-place.js | 32 | Landmark placement |
| dist/eden-wholesale.js | 54 | Retail catalog and anchor documentation |
| dist/game.js | 2017 | Public entry, counter, exit, indoor camera and exterior shadow materials |
| dist/shops.js | 35 | Trade counter room and ceiling |
| dist/items.js | 42 | Stackable retail ingredients |
| dist/inventory-ui.js | 48 | Quantity-only display for non-consumable ingredients |
| tests/eden-wholesale-place.mjs | 82 | Extended coverage for alley clearance, retail access, hours and ingredient transactions |
| tests/inventory.mjs | 55 | Updated catalog count |
| tests/properties.mjs | 65 | Updated public-door expectations |
| tests/town.mjs | 75 | Updated parking and pavement expectations |
| notes/handoff.md | 422 | Retail handoff and link to this report |

The release packager updated the corresponding snapshots under dist/releases/0.36.3. No separate test file or change to a forbidden file was needed.

## Verification

The first verification run exposed two integration issues. Packaged ingredients had been classified with held objects that require rendered icons, and asphalt was still marked as road beneath the shifted building. The final package uses the ingredient type for the two retail items and registers the shop footing in the terrain mask.

Release and focused test output:

```text
Packaged release 0.36.3: 273 files -> dist/releases/0.36.3
dist/index.html now loads releases/0.36.3/
PASS eden-wholesale-place: C21 with 3 m rear alley, 8 SOLIDS colliders, public retail door, clear dock approach, ingredients and opening hours, 2928/112/14 body/window/lens triangles, windows lit 06:00-19:30 in the dark, supplier property:eden-wholesale
PASS fork-guide.mjs: the goal line and marker (the pallet to lift, the order square to take it to, the empty and staged cases), the ghost outline (green or amber), the assists (forks levelling, easing square and onto the middle, a carried pallet easing toward its cell, none at speed or with a key held), the real pallet shape with open pockets, and a different picture for every tool and material.
brief tests passed: 272 modules listed, brief 2834 and index 34961 estimated tokens (budgets 3000 and 37000)
```

I reviewed front and alley screenshots in Chrome with WebGL and the native WebGPU backend. The canopy cast a coherent shadow on the dock and the building cast a continuous shadow across the alley at the sampled daylight angles. Browser checks used E at the exterior door and counter, the two purchase buttons, and the interior exit trigger. The final WebGPU run reloaded the save to check cash and ingredient quantities.

```text
log {"closedRoom":null,"feedback":"Eden Wholesale hours: 7 AM–5 PM","prompt":"EEden Wholesale · Closed"}
log {"cashSpent":600,"stock":[{"id":"flour-bag","quantity":1},{"id":"ground-coffee","quantity":1}]}
log {"exitRoom":null,"exitPosition":{"x":33.7,"z":-59.6,"ry":3.14},"visible":false}
log {"savedCash":400,"savedIngredients":[{"id":"flour-bag","quantity":1},{"id":"ground-coffee","quantity":1}]}
```

Screenshots are in %TEMP%\eden-ridge-wholesale-final-0-0363 (WebGL) and %TEMP%\eden-ridge-wholesale-final-1-0363 (WebGPU). Confidence is high in placement and the retail flow. Shadow confidence is limited to the sampled daylight views. Nighttime appearance, multiple players in the store, and truck maneuvering by hand were not verified.

The final suite ran all 306 non-Hub test files against the rebuilt package. Hub tests were outside this stage, and the Hub commit test would invoke Git. The full log is in %TEMP%\eden-ridge-wholesale-final-suite.log.

```text
Final non-Hub suite: 306 of 306 test files passed.
```

