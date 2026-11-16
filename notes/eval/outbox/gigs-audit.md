michadr.

# Gigs audit (read-only, 2026-11-15)

HEADLINE: the "simple old gigs" are mostly ALREADY replaced in play. S1, S2 and most of S3 are built. What is left of the old six is dead legacy code in dist/contracts.js plus its save-field plumbing. The real remaining work is: vehicle gigs, the story's truck beats (S5 rest/S8), Hal in person, and the D/C gigs from the addendum. The Shortbed exists (S6, S7 done).

## 1. Stages S1..S9
| Stage | Status | Evidence |
|---|---|---|
| S1 gigs.js pure + tests | DONE | dist/gigs.js (133 lines): GIG_TYPES l.8-17 (8 types), boardFor l.78, payFor l.52, qualityFor l.59, parRoute l.66, normalizeGigs l.40. tests/gigs.mjs (58 lines) covers payFor 3,076, board, unlock gates, accept/tick/complete, rush fail, round any order. |
| S2 save wiring + migration | DONE (differently than designed) | dist/jobs.js l.21 imports normalizeGigs/activeView/normalizeStarter; freshProgress l.30 has gigs+starter; normalizeProgress l.39 sets activeJob=null, still normalises cooldowns+gigBoard, l.45 sets gigs and activeJob=activeView(s). Old activeJob dropped silently (test: tests/gigs-game.mjs "old save ... cancelled"). No "Message" about it found. |
| S3 Gigs app + Noah's counter on gigs.js, walking types | DONE for the engine, PARTLY for UI | dist/gig-bridge.js (48 lines) maps old hooks (acceptContract, tickContract, completeContract, availableContracts, marketContracts) onto gigs.js. game.js:52 imports bridge; Noah's counter game.js:530-531 offers marketContracts; phone Gigs app uses availableContracts (phone.js:3,69). Tracker "Gigs" group exists (game.js:1246-1256). Door dialogs for parcel ("right answer tips") and the tip UI: NOT FOUND (bridge calls completeGig with no tip, gig-bridge.js:47). Round-of-three par route: bridge passes no opts.par (gig-bridge.js:47), so quality is always 100 for round in game. |
| S4 tune numbers | NOT STARTED | needs a play-test; nothing recorded |
| S5 starter.js + objective + beats 1-4, 7-9, skip, old-save rule | PARTLY | dist/starter.js (67 lines) full pure story, all 10 beats; tests/starter.mjs (35 lines) walks all 10. game.js:446-449 storyEvent/storyTick/skipChoice; objective text game.js:844-845; skip warning at Noah (Q4 done) game.js:449. Events actually emitted by game.js: 'read-message' (1192), 'delivered' (464/487 area), 'ate', 'arrived' (448). NEVER emitted: 'loaded', 'delivered-crates', 'refuelled', 'note-given', 'gig-done', 'rented', 'slept'. Story pauses at step 4 (starter.js:38 VEHICLE_BEATS_READY=false; starterObjective returns null for step>=4). tests/starter-game.mjs does NOT exist. Hal in person: NOT STARTED (no Hal dialog in game.js; Hal exists only as the farm-house owner npc, map-definition.js:297, and a population entry, map-definition.js:391). The farm porch/crate pile/truck pose places are still not chosen (starter.js l.4 comment). |
| S6 the model | DONE | dist/shortbed.js, dist/shortbed-assets.js, scripts/build-shortbed.mjs, tests/shortbed.mjs (18 hits), pictures in vehicle-pictures.js. It is the Kasumuchi S70 (map-definition.js:343). |
| S7 class, paint, deck, crate piece, MAP.vehicles, store card | DONE for the class/store; DECK/CRATE unverified | vehicle.js:30 class 'shortbed'; map-definition.js:344 slot 'eastbank-shortbed' sale 'both'; orders.js:22 VEHICLE_PRICE shortbed 50000 (=$500, NOT the $2,800 the design/skip text says: mismatch); DRIVABLE_MODELS has it (map-definition.js:315); gigs.js:74 BED_MODELS includes it. I did not verify a cargo "crate" piece on the shortbed deck (cargo.js mentions shortbed once, not read). |
| S8 story beats 5,6,10 + vehicle gig types | NOT STARTED | types 'fuel','fragile','bulk','chain' are live:false (gigs.js:13-16); no knock event wired from driving.js into tickContract (bridge tick passes no knock); no grantVehicle loan code found for the story. |
| S9 tweaks | NOT STARTED | |

## 2. OLD simple gigs: what still exists
The six old templates (dist/contracts.js l.4-9): bench-check "Bench maintenance", notice-check "Apartment notices", street-check "Sidewalk survey", heavy-delivery "Heavy box delivery", cafe-shift "Cafe shift", courier-run "Express courier run".
- Reachable by the player? NO. gig-bridge.js replaced the hooks; CONTRACTS in the bridge (l.28) is 4 generic slots. Phone and Noah's counter show only gigs.js board entries (grocery/parcel/round/rush at rep 0-10). tests/gigs-game.mjs asserts acceptContract('bench-check') errors.
- Where contracts.js is still imported: ONLY dist/jobs.js:7 (normalizeActiveJob, normalizeCooldowns, normalizeGigBoard). Nothing else imports it (grep dist/, tests/, scripts/). dist/releases/* hold frozen older copies (ignore).
- Still-live leftovers in game.js that assume the old job shape: game.js:1063-1063 area "heavy-delivery" load check (l.1463 `activeJob?.id==='heavy-delivery'` is dead, id never matches), the timed-ring code l.1282 (`job.mode==='timed'`, dead: bridge mode is always 'delivery'), updateGig labels l.1330 ('timed'/'courier' branches dead), phone.js uses progress.activeJob (fine, derived view).
- Save fields: progress.cooldowns and progress.gigBoard (jobs.js:30,39) are still written; activeJob is a derived view, not saved truth. Removing cooldowns/gigBoard = delete l.7 import, the two fields in freshProgress l.30 and normalizeProgress l.39, then delete contracts.js. Old saves with those keys just get ignored (normalizer reads only known keys), no schema bump.
- Tests that would break or need edits: tests/gigs-game.mjs (feeds `cooldowns:{'bench-check':..}` and expects activeJob null: still passes if fields are ignored; also calls refreshGigBoard, which bridge keeps); any test asserting freshProgress().cooldowns/gigBoard (not searched exhaustively: grep before). tests/jobs.mjs is the OLD market-clerk delivery flow (transactJob, ROUTES) and is separate, NOT a gig: it stays. The classic market run (ROUTES, jobs.js:24-28, Noah "first order $12/$14/$18") also still exists as Noah's first conversation (game.js:530-531). The user said "simple gigs": confirm whether this counts (question 1).
- Cafe: cafe-job.js (tests/cafe-job.mjs) is the separate Elena counter shift, not an old gig. The old 'cafe-shift' gig is gone from play.

## 3. GIG_TYPES: playable vs data only
Playable now (live, walking): grocery (60 min limit, late = 60%), parcel (tip range 200-800 but the door dialog/tip is NOT wired, so no tip ever), round (3 stops any order; par-route quality not wired, so always 100%), rush (20 min hard limit, fails to 0 and rep -2; works, tested in gigs-game.mjs).
Data only (live:false, filtered out in gigs.js:73 and bridge LIVE set): fuel, fragile, bulk, chain. They need: cargo load on the bed, knock events from driving.js, fuel purchase flow, and for chain the vehicle requirement. hasBed() (gigs.js:75) already counts shortbed.
Addendum gigs D1-D7 and C1-C5: NOT in code at all (no types, no tests).

## 4. Shortest stage list to "old gigs gone, new gigs in"
Rule: only G2, G3, G5 touch game.js/phone*.js, run them strictly one at a time (and not while the minimap/game.js agent is working).
| Stage | Work | Files | Model | game.js/phone |
|---|---|---|---|---|
| G1 | Delete legacy: drop contracts.js import, cooldowns/gigBoard fields, delete contracts.js, remove dead 'timed'/'courier'/heavy-delivery branches; one-time Message "your old gigs were replaced" if wanted | dist/jobs.js, dist/contracts.js (delete), tests/gigs-game.mjs (+grep other tests), scripts/index | Sonnet | no (jobs.js only); game.js dead-branch cleanup goes in G2 |
| G2 | Finish S3 UI: parcel door dialog + tip, par route into completeGig for round, dead-code cleanup, tracker row text | game.js (~1312-1334, 1462-1466), gig-bridge.js, gigs.js, tests/gigs-game.mjs | Sonnet | YES game.js |
| G3 | Story emits its missing events + Hal in person at farm (character, dialog, porch spot), 'gig-done' and 'rented' hooks, resolve VEHICLE_BEATS_READY (shortbed now exists) and the loan/crates/fuel/gift/sleep beats (S5 rest + S8 story half) | starter.js, game.js, orders.js (grantVehicle/loan), new tests/starter-game.mjs | Sonnet (Opus only if multiplayer rest rule is hard) | YES game.js |
| G4 | Vehicle gig types live: knock event from driving, cargo load/crates on shortbed, fuel rescue, flip live flags (S8 gig half) | gigs.js, gig-bridge.js, driving.js (shared: needs owner OK), cargo.js | Sonnet | gig-bridge only if driving.js hook is bridged; driving.js is on the forbidden list |
| G5 | New gigs D1-D5 (walking: lunch run, where-is-it, paper round, pharmacy rush, flowers) data+rules | gigs.js, new tests, game.js hooks for timer/phone call | Sonnet | YES |
| G6 | Cafe gigs C1-C5 (after cafe-job.js check) | cafe-job.js, game.js, phone | Sonnet | YES |
| G7 | Number tuning after play-test (S4/S9) | gigs.js, starter.js data | Haiku | no |
Minimal "old gone, new in" = G1 + G2 (about one session). G3 and G4 are the story and truck gigs. D6/D7 need G4 first.

## 5. Open questions (max 6)
1. The old six simple gigs are already unreachable. Do you mean (a) delete their dead code only (G1), or (b) also retire Noah's first "grocery order $12" market run (jobs.js ROUTES + game.js:530)?
2. Is the goal today "gigs replaced, story later", or must the story's truck beats (loan, egg crates, gift) work today too? (they need game.js hooks and Hal in person)
3. Shortbed price: design and the skip warning say $2,800; code sells it at $500 (orders.js:22) with tag "cheap starter truck". Which is right?
4. Should old saves get a Message saying their old gig was cancelled, or stay silent (current behaviour)?
5. Which of D1-D5 first? (Suggest Lunch Run and Morning Paper Round: pure walking, no new UI.)
6. Parcel gig: do you want the door dialog with the "right answer tips" now, or drop the tip and keep parcel as a plain walk?

## Not verified
- Cargo deck / crate piece on the shortbed (cargo.js not read); whether driving.js already exposes a knock count usable by gigs.
- Exact game.js lines 464/487 emitting 'delivered'/'ate' (saw only the event names via grep).
- No exhaustive grep of tests for freshProgress().cooldowns/gigBoard.
- Hal's farm look/outfit rendering (only data entries found); multiplayer behaviour of the story.
- Did not run any test or npm command.
