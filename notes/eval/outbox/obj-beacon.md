michadr.

# OBJ-BEACON report

Files:
- dist/beacon-style.js (new, 26 lines): kinds, colours (pickup amber #f2ca79, dropoff green #6fdc8c, shop blue #6fb7ff, story white-gold #ffe9a8, urgent red #ff5a4a), kindOf, colourFor, fadeFor(distance, daylight) -> {ringAlpha, beamAlpha, padScale}.
- tests/beacon-style.mjs (new, 28 lines).
- dist/game.js (edited, beacon parts only): import; the old ring+diamond block at ~873 replaced by shared glow/beam textures (made once), makeBeacon() (2 additive depthWrite:false materials per beacon, 3 beacons: marker, gig, one reused ghost), updateBeacons() called after updateTracker in frame(); gigRing replaced by gigBeacon; marker/gig Y now follows heightAt; minimap marker colours use beaconColour; diamonds kept, tinted and shrunk to the pad scale.
- dist/objective.js NOT changed (tests deepEqual its beacon shape); purpose is derived in game.js from objective.kind and the gig stage.

Behaviour: glow decal + 2 crossed beam quads (+3 meshes per beacon, no per-frame allocation; Color.set only on kind change). Beam fades out within 6 m; inside 3 m the glow shrinks to a 0.4x pad. Daylight dims to 0.55x (day weight from sky.state().weights.day; indoors counts as day). Completion: when a visible beacon turns hidden while you were within 8 m, a ghost beacon flashes (colour kept) and expands/dissolves over 0.7 s. All marker.visible=false paths (focus, shop, inside) untouched; updateBeacons only draws visible ones.
Mapping used: door/counter -> blue, delivery and gig return -> green, gig travel -> amber. 'story' (white-gold) and 'urgent' (red) exist and are tested but nothing in game.js passes urgent yet (no deadline field wired) and no story marker exists yet.

Tests (scratch copy, after release --force + index):
PASS beacon-style: colours by purpose, fades in 0..1 and monotonic with distance, dimmer by day.
Objective resolver (...) passed.   PASS minimap-local ...
npm run index: index 29950 tokens (target 32500), beacon-style.js listed with its header; tests/brief.mjs passed (brief 2985/3000).
Full npm test: ALL 241 PASSED. (First run failed startup/dev because the test canvas stub returns undefined gradients; fixed by guarding gradient creation in game.js.)

Could NOT verify: nothing was seen in a browser; looks, additive brightness, pulse, flash timing, and z-fighting of the glow on slopes are untested. The completion flash trigger (visible->hidden within 8 m) is a heuristic.

Eye-check: 1) amber/green/blue colours read well and are not blown out in daylight (additive may be faint or washed out); 2) beam visible from far, gone when close, pad small and not blocking the view at the stop zone; 3) glow sits on the ground on slopes and the flash+dissolve plays when finishing a gig/delivery.
Confidence: pure file high; game.js wiring medium (tests pass, no render check).