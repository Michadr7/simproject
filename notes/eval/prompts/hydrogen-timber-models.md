# Hydrogen prompt: four timber models in Blender (stage T-D). Read-only on the repo; output goes to a NEW folder.

You are making game assets for Eden Ridge (a low-poly Three.js city sim, stylized look). Read first: AGENTS.md (hard rules: no git, no BOM, never edit shared dist files), notes/timber-redesign-design.md sections 5-6 (sizes, pile layout, assets), ASSETS.md (how a model is registered). Do not read big files whole.

Make 4 GLB models. They are our own work: licence "Own work", no credit line.
1. trunk.glb: one felled pine trunk, about 2.3 m long, about 0.34 m diameter, lying along +X, origin at its base centre on the ground plane. Bark on the sides, cut end-grain with growth rings on both ends, 2 or 3 stub knots.
2. logs2.glb: a pair of logs side by side (each 1.15 m long, 0.24 m diameter, same look as the existing log), touching, lying along +X.
3. slab.glb: one live-edge slab: a 2.3 m long, about 0.35 m wide, 0.06 m thick half-round cut, bark on the curved edge, pale flat sawn face, lying flat.
4. boards4.glb: a stack of 4 sawn boards, each 1.15 m x 0.14 m x 0.03 m, neat, squared, pale pine.
Check real sizes against dist/cargo.js, dist/sawmill-pile.js (PILE_BOX) and dist/carry.js and match them to the centimetre; if my numbers above disagree, the code wins, and say so.

Limits: each model under 600 triangles, one material, ONE shared 256 px atlas texture for all four (bark, end grain, pale sawn wood). You may start from the CC0 bark in assets-src/Landscape/Stylized Nature MegaKit[Standard]/Textures/Bark_NormalTree.png (downscale it into the atlas). Y up, metres, apply transforms, flat-shaded or simple smooth normals, no animation, no lights, no cameras.

Deliver: the .blend source and the 4 GLB files plus the atlas PNG in assets-src/timber/ (new folder; do not touch dist/), a turntable-style preview PNG of each model, and a short report notes/eval/outbox/T-D-models.md starting with "michadr." that lists sizes, triangle counts, and anything you could not verify. Do not wire them into the game; Sonnet does that in stage T-D.