michadr.

# GD4 report: wind + ground cover rules (pure modules)

## Files (all new, no BOM, no existing file touched)
- dist/wind.js (33 lines): first line says GD4 wind, design 2c.
- dist/ground-cover-rules.js (70 lines): first line says GD4 cover rules, design 2a/2b + decision 6. Imports only ground-rules.js (macroAt, valueNoise, groundTone).
- tests/ground-cover.mjs (92 lines).
- notes/eval/outbox/gd4.md (this report).

## Exports GD5 must call
wind.js: windSample(t,out,weather) (writes {dx,dz,gust,strength,t}, no allocation), makeWind(), windUniform(wind,arr) -> [dx,dz,strength,gust] for the shader uniform, windBend(wind,x,z,bend,mul,out) (CPU twin of the vertex formula), swayPhase(x,z), makeWindClock/advanceWindClock(clock,dt)/setWindWeather(clock,w) (game.js: one advance per frame, then windSample(clock.t,WIND,clock.weather)), WIND_KIND_MUL (reed 1.8, crop 1.3, rocks 0), WIND_BASE, windGust, windAngle.
ground-cover-rules.js: coverFor(chunkX,chunkZ,seed,sampler,{tier,bounds,cap}) -> [{kind,model,variant,x,z,scale,yaw,tint:[r,g,b],rank,phase}] grouped in COVER_ORDER; coverStats(list) -> {total,byKind,drawCalls,kindDrawCalls}; coverReach(kind,tier) -> {near,far}; lodKeep/lodScale/lodVisible(kind,dist,tier,rank) (rank<lodKeep keeps the instance, scale by lodScale: shrink then thin, no pop); densityAt(kind,x,z,sampler); COVER_RULES (models, scale, surfaces, exclusions), COVER_TIER (density, reach, kinds, variants, chunkCap), COVER_KINDS, COVER_ORDER, SURF (checked equal to terrain.js SURFACE), tierOf, maxDensity, cellRand.
Sampler (all functions optional, safe defaults): surfaceAt(x,z)->surface id, slopeAt(x,z)->rise/run, roadDist, buildingDist, waterDist (metres, land distance to the nearest edge; 0 in it), biomeAt(x,z)->'forest'|'farm'|'open'. chunkX/Z are chunk indices (origin x*100) unless opts.bounds is given (pass chunks.js chunkBounds(i,j), since FRAME.x0 is not 0). Cells are a global jittered grid, so neighbouring chunks agree with no seam and no double plants (tested).

## What the rules say (High, per 100 m2; Medium x.65, Low x.4)
grass 36 (GRASS, GREEN 30, BANK 10; 0.4x forest, 1.3x farm); tallgrass 14 in lusher macro patches; clover 8; fern 1.5 open, 12 forest; flower 12 only where macro noise > .6 (meadow patches, user decision 4); bush 2.4 (more in forest); pebble on DIRT 16, PATH 10, MUD 6, GRAVEL 16, BANK 12; rock .5 to 1.2; mushroom forest only (4.8); reed (code-made) 25-27 only 0.5 to 4 m from water; crop (code-made) 120 on WHEAT only. Nothing on STREET, ROAD, PAVEMENT, WATER, BRIDGE, DRIVEWAY; verge clearances per kind (grass .3 m, rocks/bushes 2.5 m); slope limits; building and water clearances. Models: Grass_Common_Short/Grass_Wispy_Short, Grass_Common_Tall/Wispy_Tall, Clover_1/2, Fern_1, Flower_3/4 Group+Single, Bush_Common(+_Flowers), Pebble_Round_1-3/Square_1-3, Rock_Medium_1-3, Mushroom_Common/_Laetiporus; reed and crop are null (code-made). Test checks every model name exists as a .gltf in the kit folder (it ran: kit present). Scale ranges are multipliers on the model's native size and are GUESSES (see below).
Tier reach: Low 12/20 m, Medium 20/32, High 40/60 (user decision 2; per-kind reach multiplier, never past 64 m fog cap; pebbles .5x, clover .6x, bushes 1.3x capped).
Tier kinds: Low grass; Medium grass, fern, crop; High all 11. Model variants used per kind: 1 / 1 / 2.

## Cost numbers (measured by the test on an all-grass chunk, 100 x 100 m)
Instances per chunk: High 5704 (grass 3529, tallgrass 568, clover 801, fern 179, flower 184, bush 227, mushroom 89, pebble 78, rock 49), Medium 2385, Low 1370. Hard per-chunk caps: 15000 / 6250 / 1500 (tier totals 60k/25k/6k over about 4 chunks). Over the cap, big rare kinds are kept first and grass is thinned by stable rank. Placement CPU: about 3 ms per High chunk (synthetic sampler; a real sampler reading c.tile adds its own cost), so one chunk per frame is fine.
Draw calls if instanced per (kind, model) per chunk: High 17 (worst case 19 with reed and crop), Medium 2 (3 with crop on wheat), Low 1. FLAG: High is up to about 19 per chunk, so up to roughly 76 with 4 chunks in reach, over the design table's 20 for High. It is NOT one per kind. Options for GD5: (a) set COVER_TIER.high.variants to 1 (11 per chunk, about 44 for 4 chunks), (b) merge a kind's variants into one geometry with a per-vertex variant id and collapse the others in the vertex shader (1 draw per kind, vertices x variants), (c) group 2x2 chunks per InstancedMesh. Vertex cost is the real unknown: MegaKit triangle counts were not measured here (soft cap per memory, but note the instance counts x model tris).

## Real test output
```
node tests/ground-cover.mjs
INFO high/medium/low instances per all-grass chunk: 5704 / 2385 / 1370; draw calls 17 / 2 / 1; by kind (high) {"bush":227,"rock":49,"mushroom":89,"flower":184,"fern":179,"pebble":78,"clover":801,"tallgrass":568,"grass":3529}; synthetic chunk with road, shore, building: 3305 in 2.9 ms
ground-cover: ok
```
Covers: SURF equals terrain.js; gust curve and ranges; direction stays near base; sway phase deterministic, continuous, in range; bend 0 at root, squared, tip a few cm, rocks do not sway; clock agrees at 240/60/30 fps and 2 s steps (time and eased weather), huge step clamped, negative/NaN ignored; junk (NaN, Infinity, undefined, strings) in wind and cover; same seed same output, other seed differs; nothing on road, paving, water, steep strip; reeds only 0.5-4 m from water; crop only on wheat; pebbles on dirt, no grass in mud; forest has more ferns and mushrooms; density per 100 m2 within 12 percent over 9 chunks; per-tier kinds, caps, draw call ceilings; tiny cap keeps big kinds first, deterministic; no seam between chunks; LOD monotone, 60 m on High; junk chunk/seed/sampler/tier.

## NOT verified
Nothing is wired or seen: no shader, no screenshot, no in-game look. Scale ranges and MegaKit native sizes/triangle counts were not checked (glTF not opened). The wind amplitude matches the menu's numbers by formula and by a test bound (tip push 3-15 cm), not by eye. A real sampler (c.tile surface, zone/biome, distances to road/water/buildings, slope from heightAt) does not exist yet; roadDist/waterDist/buildingDist/biomeAt must be built in GD5 (the terrain mask gives surface only). Not run: npm test, release, index (parallel lane): the two new files are not in PROJECT-INDEX.md until the consolidation pass; the index line for tests will be `ground-cover`.

## Deviations and decisions to confirm
- menu-scene-rules.js was NOT changed to import wind.js (off limits). wind.js repeats its gust curve and constants (WIND_BASE = COVER_WIND); a later edit should make menu-scene-rules import windGust/WIND_BASE from wind.js (design 2c "one source"). Request: dist/menu-scene-rules.js, replace `gust` and COVER_WIND by imports from ./wind.js; keep tests/menu-scene.mjs green. Not needed to ship GD5.
- Crop density 1.2 per m2 (design said 3.0): 3.0 needs 0.58 m cell and 30000 instances per wheat chunk. Reeds also 25 per 100 m2, not 80 (design 0.8/m2) for the same reason; raise only with the caps.
- Mud rim "sparse dead grass" (design 2a) is not implemented: it needs a distance-to-mud-edge in the sampler; grass is 0 on MUD.
- Wind direction drifts +-0.5 rad slowly (design had a fixed direction); shaders sample it through windUniform.
- Junk tier name falls back to 'low' (cheapest).

## Forbidden-file edits needed
None for GD4. For GD5: world.js hook (chunkView.on) and game.js (clock advance, uniform update, quality tier), as in the design.

## Open questions
1. Draw-call option (a), (b) or (c) above for High (recommend (b) or (a) on first wiring).
2. Should petals (Petal_1-5) be added as a flower-litter kind? Left out.
3. Confidence: rules and tests high (all pass); look and cost on a real GPU unknown until GD5.