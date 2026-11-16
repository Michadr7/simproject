michadr.

# MAP-TRACK: audit, Ironwood apartments residents, A2 slope rules

## 1. Audit of P2 (map-master.md section 8.1, order from 8.2)
| Stage | Done? | Evidence |
|---|---|---|
| W1 water data contract | DONE | handoff 5b.b; tests/water-contract.mjs |
| W2 height.js | DONE | handoff 5b.f; tests/water-height.mjs |
| R1 road graph | DONE | handoff l.156; map-definition.js roadGraph; tests/road-graph.mjs |
| R2 road geometry | DONE (data side wired in R3a/R3b) | dist/road-geometry.js; handoff l.127 |
| W3 chunked water | DONE | dist/water-chunks.js:1; handoff l.151 |
| R3 (R3a, R3b) | DONE | handoff l.122, tests/road-r3a.mjs, road-r3b.mjs |
| R4 junctions | DONE | notes/eval/outbox/r4.md; dist/junctions.js; tests/junctions-r4.mjs |
| RU1 zones | DONE | outbox/ru1.md; MAP.weaponZones; tests/zones-ru1.mjs |
| RU2 rescue points, edge bands | DONE (edge trees not visible, known) | outbox/ru2.md; tests/rescue-ru2.mjs |
| A1 profile data + new SURFACE ids | MOSTLY: gravel (TR3, id 15), mud (id 14), ATV class (A4) and ATV surface column exist (surface-table.js). SAND and FORD ids do not exist | terrain.js:11; surface-table.js; vehicle.js:33 |
| A2 slope, side slide, roll back, drift, slip | NOT DONE before this run (no grade/side in the step) | grep vehicle.js: nothing |
First unfinished stage = A2 (A1's leftover sand/ford ids were deliberately deferred by the owner: "sand shore surface / wading are later small stages", handoff l.92; they would be unpainted dead ids).

## 2. Ironwood apartments edit (done FIRST)
dist/map-definition.js ~l.375-378: dwelling 'oak-apartments' units 9 -> 11 (the player's studio is separate, not one of the units; the old 9th flat was generated, now flats 9-11 are named), residents + Oscar Masic (male, Farmer), Lincoln Brambly (male, Casual_Hoodie), Brentster Lewis (male, Casual_2). All outfits are in appearance.js OUTFITS.male. FLAT_MAX 2 untouched (still fits). validateMap: residents 11 <= units 11.
Tests: every test importing map-definition.js, population, schedule, dwelling or npc-roster (87 files, including population, schedule, npc-walk, npc-life, map, properties, world-state, careers): ALL PASS with no count edits needed (none pinned the 9). No test file changed for this edit.
NOT DONE (not my files): dist/npc-roster.js still points Oscar/Lincoln/Brentster to the assumed 'dwelling:ironwood-apartments' flats 1-3 (npc-roster.js l.4); W-C must change those homes to 'dwelling:oak-apartments' flats 9, 10, 11 (personIds 'oak-apartments/9#1', '/10#1', '/11#1').

## 3. Stage built: A2 (slope part), why
Everything before it in P2 is done; A2 is the first open one, touches 3 dense-ish files only (vehicle.js, driving.js, new slope-rules.js) and needs no user model (the ATV class already exists). Design numbers from atv-handling-design.md section 2, applied ONLY to classes with slope:true (the ATV; pickup and trucks keep the old rule, per design risk note).
Built: uphill top x(1-.6 (g/25)^2), downhill x(1+.25 g/25), along-slope gravity x0.3, downhill brake x(1-.3 g/25), over 25 deg uphill the throttle is ignored and speed goes to -1.5 m/s at 2 m/s2, side slope over 18 deg slides the pose downhill .15 m/s per degree (cap 1.5), over 25 deg steering toward uphill is refused. A parked vehicle that drag can hold does not creep.
NOT built (A2 part 2): hand-brake drift and the `slip` state field (needs the Space-vs-Shift decision, a new saved/MP state field, a driving.js input). Also not built: the "Too steep" toast (the step does not return the flag yet; slopeOf().steep is ready), faster pitch smoothing/jiggle (A5 area).

Files (line counts):
- dist/slope-rules.js NEW 22 lines (pure; no DOM, no three.js)
- dist/vehicle.js 199 (was 198 plus edits): import, slope:true on the atv class, slope numbers in stepVehicle (top, brake, applySlope, slopeSteer, side slide)
- dist/driving.js 30 lines: slopeEnv(f) computes env.grade and env.side from heightAt/deckAt, only for slope:true classes (4 heightAt calls per step for the ATV only; envFor is also used in setup, so slopeEnv is a plain const defined before envFor)
- tests/slope-a2.mjs NEW 48 lines
node --check dist/vehicle.js, driving.js, slope-rules.js, map-definition.js: clean.

## 4. Real test output
node tests/slope-a2.mjs:
PASS slope-a2: grade, roll back, side slide and steer refusal for slope:true classes; others unchanged
Findings while writing it: a stopped ATV is held on 24 deg (drag 1.2 + dirt .24 beats gravity 1.2) and rolls back only past 25; the steep top is tiny so the over-top decel bleeds speed faster than 2 m/s2 (fine).
Also run, all PASS (43 files importing vehicle.js or driving.js, e.g. vehicle, collision-feel, damage*, driving-game, surface-table, atv-import, atv-rider, bog-game, tow-driven, tracks, vehicle-sounds, farm-tractors, flatbed, shortbed, fuel, garage-game, store-game, starter-game, ground-feel, footing-match, terrain-mud-gravel, map, height, water-height). The 87-file map-definition set from section 2 all PASS. I did not run release, index or npm test (as instructed); PROJECT-INDEX.md does not list slope-rules.js or slope-a2 yet: run `npm run index` (new file needs the entry; header line is its description).

## 5. Cost and risk
Draw calls: 0. Frame cost: 4 heightAt/deckAt per ATV step, only while an ATV exists (negligible). Risks: the ATV now loses speed on hills in the real game (tuning is A3, Opus); the roll-back at 26+ deg plus the existing cliff block could feel abrupt; the side-slide shifts the pose through poseFree, so the collision path handles it, but nothing was driven. dist/releases need `npm run release -- --force` before the packaged-release tests see this.

## 6. Could NOT verify
Nothing was seen or driven in a browser. grade/side sign conventions (side positive = ground falls to the LEFT, derived from tilt()'s roll) are tested in pure form but not against a real hillside; a quick ATV drive on the Blackstone slope is the check.

## 7. Eye-check list
1. ATV up a 20 deg hill: visibly slower (about 9.6 m/s top), down: faster (about 19 m/s).
2. Parked ATV on a 15 deg slope does not creep; on a 27 deg slope it rolls back slowly.
3. ATV across a 22 deg side slope drifts downhill gently; at 28 deg pressing the uphill steer key does nothing.
4. Pickup, S70 and tractors drive exactly as before on the same hills.
5. Oak Street Apartments: 11 flats, Oscar, Lincoln, Brentster appear as residents (People page/phone).

## 8. Next unfinished map stage
A2 part 2 (drift/slip, "Too steep" toast, bounce) needs the owner: Space or Shift for the hand brake drift (design Q2 leaning: Space), a saved/MP `slip` field (Opus owns save formats), then A1 leftovers SAND and FORD ids only when a beach or ford is placed. After that P2 is complete; P2's gate is the user check (drive every road, FPS at lake shore and estuary bridge). Then P3 Ironwood grows: I3 needs I2 and R4 (R4 done); I2 status is not verified in this audit.

## 9. Confidence
Ironwood residents edit: high (data plus 87 passing files). Slope rules in pure form: high. Wiring in driving.js and the feel: medium (unseen). Draw-call and memory impact: high that it is zero.