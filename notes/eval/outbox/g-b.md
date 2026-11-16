michadr.

# G-B report: gigs.js on gig-pay.js

Files: dist/gigs.js (211 lines, was 139), tests/gigs.mjs (132, was 70), dist/gig-pay.js (constants only: MIN_PAR_M.walk 300, vehicle fastest 29 m/s, comments), tests/gig-pay.mjs (2 lines changed), dist/gig-bridge.js (59 lines; forced: it imported repeatsToday; added NO_MORE_WORK check, starter option, starterContracts). Not touched: game.js, starter.js, handoff.md. Did not run release/index/npm test.

## Test output (real)
node tests/gigs.mjs -> gigs ok
node tests/gig-pay.mjs -> PASS gig-pay: par, wage, fatigue, tip cap, too-fast, integer cents
node tests/gig-parcel.mjs -> gig-parcel ok
node tests/session-clock.mjs -> PASS session-clock: ...
node tests/starter-game.mjs -> starter-game ok ; node tests/starter.mjs -> starter ok
node tests/gigs-game.mjs -> FAILS: AssertionError "the offer shows what you get" 150 !== 823 (line 26)

gigs-game failure is a test expectation, not a bug: it accepts a gig and completes it in the same game minute, so the new too-fast rule pays only the 150 c handling fee. Fix (not my file): advance game time before completeContract, e.g. p=advanceTime(p, Math.ceil(p.gigs.active.parM/16.4)+1) just before line 22. The 'offer shows what you get' check then also needs on-time quality 100. Other importers of gigs.js (jobs.js, game.js, phone.js, gig-bridge) load fine in the tests above; the full suite was not run.

## What changed in gigs.js
1. REPEAT_PCT and repeatsToday removed. doneToday + doneDay (day key = floor((now-300)/1440)) live in progress.gigs; normalizeGigs: old saves = 0. Helpers: doneTodayOf(g,now), bumpDone(g,now), dayKey, noMoreWork(p,now). Resets when the key changes (05:00).
2. payFor(typeId,quality,doneToday,rep,tip,large,parM=null,starter=false): wrapper kept. With parM it calls gig-pay.payFor; without it (old gig) it pays min(old base, LEGACY_CAP_C 3000) x quality x fatigue x repMul. repMulFor(rep,large): 1.4 for large at rep>=40, else 1 (the old +30% rep bonus is gone). NOTE: 3rd argument now means doneToday (was repeats); quality 0 now pays 0 (old floor was 60%).
3. Slots and actives carry origin, points (stops in shortest order), parM, mode, acceptedAt, pickedAt, onTimeMin, starter, pair (slot). Old actives: origin null = already picked up, flat pay.
4. Board drops par < MIN_PAR_M[mode]: it retries other types, clients, places and pickup points (12 attempts) before skipping a slot. Starter board exempt. MIN_PAR_M.walk 150 -> 300 and tests updated. Vehicle speeds: fastest road class shortbed top 29 m/s (dist/vehicle.js:30); worktruck 17.9 (:28), offroad 26.8 (:31), flatbed 15.6 (:29), ATV 15.6 (:33), tractors 6.3/7.2 (:35,:36). FASTEST vehicle changed 40 -> 29. Typical 12 kept (below the worktruck's 17.9 for corners/accel; a judgement).
5. acceptedAt recorded; ON_TIME_FACTOR 2 and ON_TIME_EXTRA_MIN 10: limit = par/9 x 2 + 10 game min (onTimeLimit). Clock starts at pickup (pickedAt) when G-D calls pickUpGig, else at accept. elapsed goes to payFor; too fast = handling only.
6. acceptGig returns {error:'No more work today.'} when noMoreWork (starter exempt); the board is [] at the stop. Bridge acceptContract returns the same message. One of each type per board (existing); pair rests 1 day (pairsSeen, PAIR_REST_DAYS), client 2 days (kept).
7. Board hash uses WORLD_SEED (7919), not g.completed. Same counts and windows. (Per-player filters remain: rep unlocks, taken slots, last finished type, clientsSeen, pairsSeen.)
8. Tests cover: tiers via real completeGig (10 gigs, 100/70/40%), hard stop (accept, board, bridge), 05:00 reset and no midnight reset, old-save load, short routes dropped, board identical for completed 0 vs 57, starter exempt and uncounted, pickup clocks, too fast, late, pair rest, one per type.

Also added: limitFloor (a type's own limit never undercuts a sprint over par x1.5: rush 20 min would be impossible on a 330 m route), starter pay floor STARTER_MIN_PAY_C 2500 (design table "at least $25"), default pickup points.

## IMPORTANT finding: the town is too small for a 300 m minimum
Every pair of the 7 town places is at most about 230 m par (market to houses 150-190). With MIN_PAR_M.walk 300 and only the market as pickup the board was EMPTY at every sampled minute. To keep gigs alive I added DEFAULT_ORIGINS in gigs.js: market (19,-6.3), Willow Farmhouse (-62,-244) and gas station (156.5,-8.25), coordinates taken from notes/gigs-starter-design.md, NOT checked against the map or the walkable mask. Result over 3 game days sampled every 30 min: board has 2 slots 22 times, 3 slots 121 times, never 0, but almost all pickups are the farm (par about 300-335). Owner should know: either more places/clients arrive with the 1,500 m map, or the minimum should drop (about 200 m fits the current town). ctx.origins overrides the list.

## What G-D (game.js pickup wiring) needs (all pure, in gigs.js; bridge re-exports nothing new yet)
- Active gig fields: a.origin {id,name,x,z,room}, a.pickedAt (null until picked up), a.parM, a.points, a.acceptedAt, a.onTimeMin, a.starter.
- atPickup(active, position, room) -> bool (within PICKUP_RADIUS_M 2 m, not picked up); pickedUp(active); pickUpGig(p, now) -> {state}|{error}; call on E at the origin, then rebuild the activeView (withView in the bridge is not exported: either add a bridge wrapper pickGigBox(p) or call it from game.js).
- tickGig/tickContract: pass requirePickup:true so stops tick only after pickup (default false keeps today's behaviour). tickContract in the bridge does not forward requirePickup yet: G-D needs that one-line forward.
- Spawn the box at a.origin; arrow to a.origin while !pickedUp(a). Card data: slot/offer has parM, origin.name, reward (offer.reward is the quote at quality 100 with parM).
- completeGig(p,now,{tip,par,generosity}) now also returns {tooFast,tip}; show 'handling fee only' when tooFast.
- Starter flow (beat 8): starterContracts(p) (bridge, 2 offers, id 'slot-N') and acceptContract(p,id,position,{starter:true}); or boardFor/starterBoard + acceptGig(p,slot,now,ctx,start,{starter:true}). Starter gigs pay at least $25, are never too fast, and do not count toward doneToday. game.js must call them with starter true while starter.step is 7 (beat 8).
- Daily-cap UI (G-E): noMoreWork(p) and NO_MORE_WORK; doneTodayOf(p.gigs, now).

## Not verified
- Full suite, release, index (PROJECT-INDEX must list the new exports; not run). No browser run. Starter story in-game flow with the new rules (only tests/starter*.mjs, which do not touch gigs pay). Farm/gas coordinates reachable. Walking speed 4.5 m/s and 0.5 game min/s are G-A's findings, pinned in gig-pay.mjs.
- Door tip (parcel dialog) is still added on top of gig-pay's tip; tip cap 25% applies only to the generosity tip.

Confidence: gigs.js rules and tests high (ran, pass). Board usefulness with the 300 m minimum low until places/origins are confirmed. gigs-game.mjs needs a one-line update by its owner.