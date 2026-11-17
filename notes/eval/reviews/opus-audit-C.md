michadr.

# Opus audit C: ground cover, saves and relay, vehicle collisions (working copy 0.35.17)

Read-only audit. The only file written is this one. Scratch scripts (outside the repo) are in C:\Users\Michael\AppData\Local\Temp\claude\8fae7b33d78fadc6\0f2b4966-c871-4c74-b62c-a63c2d7af90f\scratchpad\ (cover-sim.mjs, cover-empty.mjs, cover-cost.mjs, save-fuzz.mjs, taxi.mjs, gap.mjs).

Tests I ran: `node tests/ground-cover.mjs` gave "ground-cover: ok" and `node tests/cover-view.mjs` gave "cover-view: ok" (real chunks: average 11.1 ms, max 13.7 ms for sampler plus placement per chunk).

## Findings, most severe first

### 1. The walker cannot pass between a parked taxi and a truck: the taxi's collider is 0.24 m wider than the car (WRONG BEHAVIOUR, CONFIRMED)
- Where: scripts/build-props.mjs:260-279, which rasterises the colliders. They are used at dist/neighborhood.js:15 (the Oak Street taxi at (23, -1.9)) and dist/world.js:456 (the decor taxis and cars in the landmarks list). The walker test is dist/game.js:430 (`worldBlocked`: each box plus 0.33) together with dist/driving.js:174 (`blocksWalker`: the vehicle hull plus PLAYER_RADIUS 0.33).
- What is wrong: vehicle colliders are made from a 0.5 m grid that starts at -W/2, so the far side rounds up by almost a whole cell. For the taxi (and car, police-car, sports-car, sports-car-2, car-2), `propInfo('taxi')` gives:
  - footprint x -0.88 to 0.88, z -2.20 to 2.20;
  - collider `{x:.12, z:.05, hx:1, hz:2.25}`, which covers x -0.88 to **1.12** and z -2.20 to **2.30**.
  
  One long side sticks out **0.24 m** past the body, and on the Oak Street taxi that side faces the road, where a player parks next to it. The truck hulls are exact: CLASSES.worktruck hx 1.09 matches its model, and the flatbed and shortbed colliders equal their footprints.
- Scenario (gap.mjs, using the game's own formulas): taxi at (23, -1.9) facing -pi/2, worktruck parked parallel to it. The walkable band between them:

  | Visible gap | Now | Box clipped to footprint |
  |---|---|---|
  | 0.70 m | 0.000 m | 0.040 m |
  | 0.80 m | 0.000 m | 0.140 m |
  | 0.90 m | 0.000 m | 0.235 m |
  | 1.00 m | 0.095 m | 0.335 m |

  So today a gap only works above about 0.91 m of visible space. With the box clipped to the body, about 0.67 m is enough (2 x 0.33 m player radius).
- Smallest fix that keeps the smooth push: change only the shape, not the player radius or the push.
  - Option (a), no asset rebuild: in dist/props.js `propInfo` (not a forbidden file), clip each collider box to `footprint` once per record, for example `x0=max(b.x-b.hx,f.x0), x1=min(b.x+b.hx,f.x1)`, the same for z, then rebuild the box as centre and half sizes. A collider can never correctly reach past the mesh footprint, so this is safe for every prop. It also removes the same up-to-one-cell overshoot on buildings and other grid-collided props.
  - Option (b), at the source: in build-props.mjs, clamp each pushed box to [wx0, wx1] x [wz0, wz1], or give the car specs `collide.fit`, then rebuild props-assets.js. That is a forbidden file, so the main chat would do it.
  
  After either fix, re-check tests/vehicle.mjs and any test that counts colliders. Optional: a walker-only margin of 0.28 m for vehicle hulls would buy another 0.1 m, but the shape is the real bug.

### 2. COVER-FIX moved the stutter but did not remove it: two whole-chunk pieces are still done in one frame, and maxPlaceMs no longer sees them (WRONG BEHAVIOUR / performance, CONFIRMED in Node, PLAUSIBLE in the browser)
- Where: dist/ground-cover-view.js:69 (`makeCoverSampler` runs in the frame that starts a job) and :64 (`stageB` packs and creates every kind's InstancedMesh for the chunk in one frame). The stat at :67 only times `job.step()`.
- Measured with cover-cost.mjs, real chunks, High tier:

  | Piece | Time per chunk |
  |---|---|
  | Each step (one kind) | 1.5-2.4 ms |
  | `makeCoverSampler` | 2.4-16 ms (warm 2.4-8) |
  | `packRun` for the whole chunk | 4.4-10.7 ms (about 4000-6800 instances) |

  The sampler and pack frames do not count in `stats().maxPlaceMs`, which now reads about 2 ms. The meter therefore says "fixed" while one frame per chunk still costs 5-11 ms, before the GPU upload of the instance buffers. The old single placement frame was 11-14 ms, so the worst frame is perhaps 30-50% lower, not gone.
- Fix: in `update()`, make the mesh stage one `kindRuns` run per call (keep a `meshing={c,list,runs,i,group}` state and add the group to `parent` when the last run is done). Add `stat.maxFrameMs` that times the whole `update()` call (sampler frame and mesh frames included) and use it for the eye-check. The sampler (chamfer distance fields) could also be split into road, water and buildings over three calls if 8-16 ms shows up in the browser.

### 3. The chunk in `work` is not left out of the queue, so a finished chunk is popped again (MINOR, CONFIRMED by tracing)
- Where: dist/ground-cover-view.js:62. It leaves out `pending` but not `work`.
- Scenario: a 0.25 s check during chunk A's job pushes A into the queue. A finishes, is meshed and built, then `queue.shift()` returns A, `built.has` is true, and that `update()` call does nothing. That is one lost frame per chunk at most; there is no double build, because the `built.has` guards at :64 and :69 hold. Checked by simulation: buildNear during a job, setTier during a job, and gone-then-back during a job all build each chunk exactly once.
- Fix: `&&!(work&&work.c.key===c.key)` in the same condition.

### 4. A chunk that places nothing is placed again forever (MINOR in practice, CONFIRMED by simulation)
- Where: dist/ground-cover-view.js:65 (also in 0.35.16). `built` is set only `if(r.draws)`.
- Scenario (cover-sim.mjs): the player stands in an all-road chunk next to a grass chunk. The empty chunk is placed again after every 0.25 s check: placement time totals 44-84 ms over 600 frames, against 11 ms when both chunks have grass. At 30 fps the grass chunk was built at frame 77 instead of frame 25.
- On the real map today no chunk is empty (cover-empty.mjs: 169 tiles, 0 empty on Low or High), so this is latent. It becomes real when a chunk is all water, road or plaza (Kaspian Bay, P4).
- Fix: on `r.draws===0`, still `built.set(c.key,{group:null,instances:0,draws:0})`, and make `disposeChunk` handle a null group.

### 5. After a teleport the running job finishes a far chunk first (MINOR, CONFIRMED by tracing)
- Where: dist/ground-cover-view.js:67-68.
- Scenario: the player teleports (bed, tow, menu Continue) while `work` holds chunk A. A's remaining kinds (up to 11 frames) and its mesh frame still run, then the next check drops A as farther than 95 m. That is about 15 ms of wasted CPU and the chunk near the player is delayed by about 12 frames.
- Fix: at the check, if `work` (or `pending`) is for a chunk with `d>COVER_BUILD_DIST`, set it to null.

### 6. The new path has no tests (GAP, CONFIRMED)
- tests/ground-cover.mjs and tests/cover-view.mjs call only `coverFor` (which loops the job internally). Nothing calls `coverJob` step by step, and nothing runs `createCoverView().update()`: no test in tests/ mentions `coverView`, `coverStats()` or `maxPlaceMs`.
- So the `work` and `pending` state machine, `onChunkGone`, `setTier` and `buildNear` during a job, and the build order are untested.
- Equivalence of `coverFor` is fine: I compared 0.35.16's `coverFor` with the new one in 144 cases (3 samplers x 4 tiers including a junk tier x 4 caps x 3 chunks, plus bad-bounds and NaN cases). All were deep-equal.
- Suggested test: cover-sim.mjs already has a 15-line fake THREE that runs the real view with the real cover-assets. Turn it into tests/cover-view-update.mjs that asserts every ready chunk within 62 m is built within (number of kinds + 3) x chunks calls, each chunk once, and that teardown during a job leaves no `work` or `pending`.

### 7. Pop-in timing (ACCEPTABLE, CONFIRMED by simulation)
- One High chunk takes 11 kinds + 1 sampler frame + 1 mesh frame. In the simulation the first chunk was built at frame 12 and the second at frame 25 at 60 fps (0.2 s and 0.42 s). At 30 fps the second chunk needs about 0.9 s. Low tier (grass only) takes about 3 frames per chunk.
- The build distance is 62 m to the chunk's nearest edge, and instances past 40 m (High) are already shrunk and thinned. So the late chunk shows up in the thin fade zone, not at the player's feet. That holds except right after a teleport or setTier, where the four nearest chunks fill one after another over about 1-2 s at 30-60 fps. Acceptable; `buildNear` exists for teleports behind a loading screen, but nothing in dist/ calls it (I only checked that it is not called through `cover.`).

### 8. A bad truck day in a save is kept, so the supply truck never comes (MINOR, CONFIRMED)
- Where: dist/world-state.js:37-39. `truck.nextDay` is checked only for `isInt(nd)&&nd>=0`, with no upper limit.
- Scenario (save-fuzz.mjs): `normalizeWorld({day:5,truck:{nextDay:9e15}})` keeps 9e15, so the weekly supply truck never comes and the depot stock only drains. Through normalizeProgress the same value survives (`.world.truck.nextDay=1e15`).
- Fix: `nd<=dy+TRUCK.everyDays`; otherwise use the fresh value.

### 9. The housing day and the world day are clamped differently (MINOR, CONFIRMED, hand-edited saves only)
- Where: dist/housing.js:8 resets `day` to 1 when it is over 100000, but dist/world-state.js:29 clamps `world.day` to 100000.
- Scenario: progress with `{housing:{day:150000},world:{day:200000}}` normalizes to housing.day 1 and world.day 100000. `tickTargetDay` stays below `world.day`, so the world never ticks again: stock, needs and NPCs are frozen for this save. Normal play cannot reach this, because advanceHousingDays clamps at 100000.
- Fix: clamp housing.day to 100000 (not reset), or in normalizeProgress cap `s.world.day` at `tickTargetDay(s)`, which also covers a world that runs ahead for any reason.

### 10. Relay: after the hosted lobby wakes from hibernation the host can change and the clock is lost (MINOR, PLAUSIBLE)
- Where: worker/lobby.js:53 rebuilds players in `ctx.getWebSockets()` order. dist/relay-protocol.js:49 says map order is join order "also after a restore", but the Workers API does not promise that order for getWebSockets.
- `lastClock`, the clock rate limit and the position buckets are also reset on wake-up (:50 and :47).
- Scenario: in a 3-player lobby that hibernates, the restore order can put a non-host first. That player becomes host silently: no `host` message is broadcast, so clients keep their old `hostId`. Then the real host's clock messages are refused (`hostPeer()!==peer`), and the new host never knows it is host, so no clock flows at all.
- Fix: store `joinedAt` in the attachment (lobby.js:85), sort `restore` by it, and after a restore broadcast `{type:'host'}` if the host changed.

Everything else I checked in the relay is sound:
- the hello and protocol check;
- the message size limit (characters, not bytes, but MAX 4096 with ws `maxPayload` locally);
- room and position validation;
- the per-peer token bucket;
- only the host may send clock messages;
- the relay never trusts a client's id;
- the client validates every message it receives.

The aged clock can produce day 100001, which the client then drops silently. That is harmless.

### 11. Saves: what passed
- `normalizeProgress` on null, an array, a string, a fresh save and a "huge" save (1e300 cash, NaN position, 1e15 days, junk vehicles, NaN life values) did not throw.
- Apart from item 8, it produced no non-finite number or number over 1e13, and normalizing twice gave the same result in all cases.
- save-file.js sends every path (stored save, import, backups) through `cleanProfile` and `normalizeProgress`, and limits file size and format version. I found nothing wrong there.

## What I did NOT get to
- How the walker's movement handles a blocked step (sliding along the box or a hard stop). I only measured the shapes, not the feel of the push, and did not check whether the vehicle-against-vehicle code in hullsOverlap feels like a "smooth push".
- Whether the user's "truck" was the worktruck, the customer or dock flatbed, or the Oak Street taxi versus a lot taxi. The overshoot is on every car prop either way, and the flatbed hull is exact.
- Browser timings: every millisecond figure above is from Node on this machine, not from the user's GPU machine, and there was no GPU upload cost.
- The multiplayer visit mode and whether a joiner's saved housing.day or world.day changes while it follows the host's clock (session-clock.js, sleep.js).
- worker/accounts.js and cloud-save.js (cloud save trust and size limits), and normalizers other than the top level of normalizeProgress (careers, gigs, npc-life and others were only fuzzed indirectly through the "huge" save).
- Disposal when a world is torn down: `cover.disposeAll` is never called in dist/, and its shared geometries, materials and atlas are never disposed. That only matters if a world is ever rebuilt in the same page, which I did not check.
