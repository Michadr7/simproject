michadr.

# minimap-design (Opus 5.5, design only, 2026-11-15)

Files created
- notes/minimap-design.md (150 lines, no BOM). No game code touched, notes/handoff.md not touched, git not run, no tests changed.

What the note decides or proposes
- Bake once and crop each frame, instead of redrawing vectors: about 0.05..0.15 ms per blit at 12 fps, against an estimated
  1.5..4 ms per redraw for vectors.
- Two resolution levels: BASE covers the whole world at 2 m/px (750 x 900 px, 2.7 MB, baked at load in slices). L0 tiles are
  0.5 m/px, 128 m (256 px plus a 1 px gutter), baked on demand with an LRU cache of 24 tiles (6.4 MB), or 32 while the full map is open.
  A tile is used when the view needs finer than 1.0 m per device px, otherwise BASE. The shared baker gets 3 ms per frame. invalidateAt(x,z)
  rebakes about 1 tile instead of the whole map.
- Corner map: north-up, 200 x 200 rounded square, 150 m across, player always centred (no clamp at the world edge). When driving the
  view looks up to 0.2 W ahead. Vehicle silhouettes, an icon atlas, edge chevrons for a pin or job off the map, up to 4 street names, a
  multiply tint for night, a scale bar.
- Zoom curve: W = 150 + 250 * smoothstep(6, 28 m/s). Smoothed frame-rate independently: tau 0.8 s zooming out, 2.5 s zooming in, with a
  1.5 s hold before zooming in. '-' and '=' set a user factor of 0.5/1/2.
- R6 full map screen (new map-screen.js): Fit, 1 m/px and 0.5 m/px, wheel to zoom, drag to pan, labels with a collision rule, legend,
  layer toggles (RU1 weapon/fishing zones, rescue points, plots), click drops the GPS pin.
- The phone GPS uses the same bake through createMapView. This removes GP1's first-open hitch of up to 1 s. The GP1 update/pick
  contract is kept.
- Test plan: pure dist/map-view.js tested in tests/map-view.mjs, plus a stub-canvas test tests/map-bake.mjs.
- Stages MM1..MM8 (Sonnet), each with its files, order and conflicts. MM2 needs GP1 committed. game.js stages go one at a time.
  phone*.js is only touched in MM7.
- 8 open questions, each with a recommended answer first.

What I could NOT verify
- Bake speed: the 1..3 us/px figure is inferred from the GP1 report ("up to 1 s" for the 600 x 490 phone map). It is not measured.
  MM2 must measure it and replace the (e) numbers.
- The fastest vehicle's top speed (vehicle.js is not read). The 28 m/s end of the curve becomes that top speed if it is lower.
- Free keys for '-' and '=' in game.js keydown. MM4 greps for clashes first.
- Where the daylight value comes from. The visual overhaul may change it, so the note reads it through one getter.
- Nothing was run in a browser and no tests were run (none were needed: no code changed).

Forbidden-file edits needed: none for this design stage. Later stages edit game.js, phone-gps.js and phone.js. They are for the main
chat or Sonnet, and the stage table lists each one.

Confidence
- Architecture (bake + tiles + shared views): high.
- Memory numbers: high (arithmetic).
- Timing numbers: medium (estimates until MM2 measures them).
- Stage order and conflicts: high.
- Look details: medium, pending the user's answers to Q1..Q8.

Index note: GP1 left 772 tokens of index budget. MM1 adds 2 files, so the index trim should land first.
