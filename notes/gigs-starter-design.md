# Gigs revamp, starter story and the short flatbed (design note)
Opus 5.5, 2026-11-13. Design only: nothing here is built. Numbers are placeholders for Haiku to tune after a play-test.
Read with DESIGN.md 4.14 (Gigs revamp bullet), 4.15, 4.19. Money is integer cents throughout.

## 0. Risks first
**Frame rate (user GPU about 165 FPS; budget 15 skinned characters, 10 cars, 300 draw calls):**
- **Hal Brennan drawn at the farm:** +1 skinned character, only while the story is active and the player is within 80 m of the farmhouse. Expected under 1 FPS. *Cheaper option:* Hal is phone-only (calls and messages, a note on the truck): 0 cost. Recommended: draw him; the farm is far from everything else, so he never shares the screen with the Oak Street walkers.
- **The short flatbed model:** target at most 4,000 triangles and at most 6 draw calls (the Tylan is 5,796 and 9). Above 6,000 triangles it must be simplified before it goes in.
- **Gig cargo (crates):** one more InstancedMesh per loaded vehicle (1 draw call, at most 12 instances). Cheaper option: reuse the plank-stack piece for every gig load (0 new draw calls, looks wrong for eggs).
- **Gig customers:** no new NPC models. A customer "answers the door" as a dialog (`speak()` with their name, as Noah and Elena do); nothing is drawn. 0 cost.
- **Agent browser (software WebGL, about 4 FPS):** an autopilot test that drives the whole story would take many minutes. Test the story as pure state steps; keep browser tests to one or two short beats.

**Tokens:** `game.js` is dense and every hook there costs reads. Rule for every stage: rules live in new pure files (`gigs.js`, `starter.js`), and `game.js` gets thin single-line hooks only. Stages S3 and S8 are the expensive ones (game.js wiring); each names the exact functions to open by line range. Do not read `context.md` whole.

## 1. The early game today (from the code)
- **Start:** a fresh save has `cash: 0`, day 1, 9:00 AM (`routine.js freshRoutine`, minutes 540), spawn at (-5, 15) on Oak Street. The objective card says "Earn your first wages. Speak to Noah at the market counter for delivery work" (`game.js` ~787).
- **Noah's delivery work** (`jobs.js ROUTES`, `transactJob`): three fixed routes in a fixed cycle, `ROUTES[completed % 3]`: 18 Oak Street $12, Alder Coffee $14 (handed to Elena at the café counter, `completed % 3 === 1`), Oak Street Laundry $18. Pick up at the market counter, walk 15 to 30 m, press E. **No cooldown, no cap, no time limit, no choice:** the same three walks forever, about 30 to 60 real seconds each.
- **The Gigs app** (`contracts.js`): six fixed templates (bench check $10, notices $12, sidewalk survey $14, heavy box $22, café hold $24, courier run $20). Four of the six are "stand on a spot for N seconds"; all six are inside about 50 m of the market. The board shows 3, shuffled with `Math.random`, refreshed every 30 game minutes (1 real minute); a gig rests 120 game minutes (4 real minutes) after you accept it. With six templates and a 4-minute rest the same three come back at once.
- **Café job** (`cafe-job.js`): hire, one shift a day 8 AM to 4 PM, the same two customers (Maya: Latte, Theo: Espresso) every time, $24.
- **Careers** (`careers.js`, `shift.js`): Ridgeline Timber is the deep job (ranks, 11 task kinds, piece pay, bonus), but it starts at Pine Ridge about 300 m from spawn, needs an interview in the office, and the first vehicle you may drive there is the company flatbed at Hauler (rank 3). Tickets (`tickets.js`) need rank 4 and 5.
- **Vehicles:** Worktruck $4,500, Tylan Flatbed $8,000 (Lumberjack level 5), Off Road Pickup $11,000 (`orders.js VEHICLE_PRICE`). **You may only own a vehicle if you hold a home** (`orders.js vehicleCapacity`: the studio counts 1). At $12 to $18 a walk, the Worktruck is about 300 walks away.
- **Tracker** (`tracker.js`): the story objective (Noah's work or the active gig) plus shift tasks and orders, one focused with an arrow.

**Why it repeats:** (1) the only early income is two pools of fixed content (3 routes, 6 templates) in a 50 m circle; (2) nothing changes with time, place, skill or reputation; (3) pay is flat, so the best play is spamming the shortest walk; (4) the board's rest (4 real minutes) is shorter than the time it takes to get bored; (5) the first vehicle, the thing that would open the map, is hours away, so the player never leaves the circle.

## 2. The starter story: "A Hand for Hal" (about 16 to 22 real minutes)
**Characters (all already in the town data, `map-definition.js` dwellings and posts):** **Noah** (Corner Market clerk, guide for the first beats), **Hal Brennan** (the Willow Farmhouse owner, farmer, bad knee, the truck's owner), **Sophie** (Oak Street Apartments, first customer), **Walt Hargrove** (Ridgeline owner, one short scene). Clock: 30 game minutes per real minute; the story starts 9:00 AM and ends with the first night's sleep.

| # | Beat (where) | What the player does | Teaches | Real min (est.) | Pay |
|---|---|---|---|---|---|
| 1 | Oak Street spawn (-5, 15) | The phone shakes: a Message from Noah, "Come by the market, I could use a hand." Open the phone, read it; the tracker card points at the market. | walk, run, phone, Messages, tracker arrow | 1 | - |
| 2 | Corner Market (19, -6.3) then 18 Oak Street (3.8, -7) | Noah hands over Sophie's groceries (route 0 of today's `ROUTES`). At the door Sophie talks (dialog, two answers); the friendly one gets a tip. | E to talk, carrying, delivering, cash on the HUD, tips | 2 | $12 + $3 tip |
| 3 | Corner Market | Noah: "Hal Brennan phoned. He needs someone today. Take him his groceries, and eat something first, it's a walk." Buy any food and a water at Noah's shelf; eat one. Noah adds: "The phone's Store delivers too." | buying, inventory, the needs bars, the Store app exists | 2 | - |
| 4 | Willow Farmhouse (-62, -244), about 250 m | Walk to the farm (the arrow leads). Hal on his porch: groceries in, $25 paid. His knee is bad; his old flatbed has stood since spring. "Can you drive? Take her for the day." He lends the truck (a **loan**, see 5). | long walk, energy, a person with a story | 3 | $25 |
| 5 | Farm yard to the Corner Market | Load 4 egg crates from the porch onto the truck's deck (E with a crate, as with logs). Drive them to Noah. Each hard knock (collision) lowers quality: the pay is shown on arrival with the reason. | driving (enter, drive, park), cargo on a bed, quality changes pay | 4 | $40 at 100% quality, at least $28 |
| 6 | Gas station (156.5, -8.25) | The gauge is near empty (the truck arrives with 3 of 14 gallons). Hal phones: "I left $32 with the truck for gas." Fill up at the pump. | fuel gauge, the pump, paying for fuel | 2 | +$32 cash for fuel |
| 7 | Ridgeline office (I5, Eastbank) | Hal's message: "Drop my note at Walt's while you're in Eastbank." Walt reads it: "Hal says you're reliable. Come and see me when you want steady work." The Jobs app opens on Employers. Being hired is optional (the existing interview). | careers exist, the Jobs app, office hours | 2 | - |
| 8 | Phone, Gigs app | Two starter gigs are on the board (types 1 and 7 of section 3, marked "Starter"). Take either one and finish it. | the Gigs app, accept, tracker focus, a gig twist | 3 | at least $25 |
| 9 | Oak Street Apartments door (1, -6.3) | Hal: "If she's to stay with you she needs somewhere to park. Studio 2B is for rent." Rent it ($90: $30 deposit + $60 week). If cash is short, the tracker offers Noah's grocery run until it is not. | money, rent and bills, the vehicle limit (a home holds a vehicle) | 1 | -$90 |
| 10 | The studio | Hal phones: "Keep her. My knee's done driving, and she likes you." The loan becomes yours (owned vehicle, parked at the studio's lot spot). It is evening: sleep in the studio bed; wake at morning. A last Message: "Come by the farm some mornings, I'll have work." | sleep skips time (single player), energy, the next day | 1 | the truck |

- **Money check:** 1,200 + 300 + 2,500 + 4,000 + 2,500 = 10,500 cents earned, minus about 500 for food = **about $100 at beat 9**, so the $90 rent is reachable without grinding. Fuel money is separate (Hal's $32). Worst case (low quality, short gig) about $85: the Noah fallback covers the gap.
- **Order is fixed, with two soft spots:** beats 7 and 8 can be done in either order; beat 3's food is checked as "ate something since beat 3" (any food counts, a phone order does not block).
- **Skipping:** a "Skip the introduction" choice in Noah's first dialog. Recommended: skipping gives no cash and no truck; Hal sells the truck at the farm for $2,800 instead (open question 4).
- **Multiplayer:** the story is per player; beat 10's sleep becomes "rest in the bed" (time never skips online, DESIGN 4.14). Everything else is local state.
- **Map changes:** **`town.js`: none. `world.js`: none. `map-definition.js`: one added line**, the `MAP.vehicles` entry for the new model (`sale:'online'`, no `home`, so no lot bay is needed; the lot's three truck bays are full). All story places (Hal's porch, the crate pile, the truck's farm pose, the studio parking spot for the gift) live in `starter.js` as data and are checked by a test with `world.js isWalkable` and the existing safe-pose search, so a map change that breaks them fails a test. The studio parking spot: the apartments have a lot beside the building (DESIGN 4.14); its pose must be measured in S5 (unverified).

## 3. Gig variety
**One new pure module, `gigs.js`, replaces `contracts.js` and the endless `ROUTES` cycle** (ROUTES stays only for beat 2). A gig = a **type** (rules, one twist) + a **client** (a real resident and home from `population.js buildPopulation(MAP)`, deterministic, nothing saved) + **places** (from map data: homes' drop spots `orders.js dropSpot`, shops, Eastbank buildings, the farm). With 20 residents, 14 households and about 15 places, the same gig text practically never repeats.

| # | Type | Needs | The one twist | Quality from | Base pay (cents) | Real min |
|---|---|---|---|---|---|---|
| 1 | Grocery run (Noah) | - | **Time window:** deliver within 60 game minutes (2 real min) | on time 100; late 60 | 1,200 | 1.5 |
| 2 | Doorstep parcel | - | **A person with dialogue and a tip:** the client answers the door; the gig text hints at what they like ("Robert works nights: knock quietly"); the right answer tips | dialog answer: tip 200 to 800 | 1,000 + tip | 1.5 |
| 3 | Round of three | - | **Route choice:** three drops in any order; a "par" distance is computed from the best order | par or better 100; each 10% over par -10 | 2,700 | 3 |
| 4 | Rush envelope | - | **Hard time limit:** 20 game minutes (40 real s) across Alder Center; fail pays 0 and costs 2 rep | on time or fail | 2,000 | 1 |
| 5 | Fuel rescue | Gas Can ($15) | **Risk and money up front:** a stranded driver at a map edge or roadside; you buy the fuel, fill their tank (the existing gas-can pour), they repay the fuel plus a tip | fuel repaid in full + tip 300 to 1,000 by speed | 1,800 + fuel | 3 |
| 6 | Fragile haul | a vehicle with a bed | **Risk:** eggs, glass, a cake; every collision above a speed threshold breaks one piece | -15 per knock, floor 40 | 3,500 | 3 |
| 7 | Bulk haul | a vehicle with a bed | **Capacity choice:** 6 to 10 sacks or bundles from the Eastbank supplier to a home; a small bed means two trips (choose: one long trip or two) | on time 100; 2 trips do not cost quality, only time | 4,500 | 4 |
| 8 | Chain errand (Hal, later others) | a vehicle | **A chain with a problem:** step 1 collect a part at the supplier; step 2 the supplier gave the wrong part, take it to the vehicle workshop (I4) to swap; step 3 deliver to the client. The problem is revealed at step 2 | finished by the deadline 100; late 70 | 6,000 | 5 |

Kept as they are: the café shift (`cafe-job.js`) and Ridgeline careers. Retired: the six `contracts.js` templates (the bench, notices and sidewalk "stand still" gigs go; the heavy box and courier ideas live on as types 1 and 4).

**Pay formula (pure, `gigs.js payFor`), integer cents, rounded down to whole cents:**
`pay = floor(base * qualityMul * repeatMul * repMul) + tip`, where
- `qualityMul = (60 + 40 * quality / 100) / 100` (quality 0 to 100: 60% to 100% of base);
- `repeatMul` from how many gigs **of this type** you finished in the last 24 game hours (48 real minutes): 1st and 2nd 100%, 3rd 85%, 4th 70%, 5th and later 55%;
- `repMul = 1 + min(rep, 60) / 200` (gig reputation 0 to 100; at most +30%).
Example: a fragile haul at quality 85, the 3rd today, rep 20: floor(3500 x 0.94 x 0.85 x 1.10) = 3,076 cents ($30.76).

**Anti-repetition rules:**
- **Board:** 4 slots. Each slot has its own expiry (90 game minutes = 3 real minutes, staggered by 22 minutes so one slot changes about every 45 real seconds). Never two of the same type on the board; a type you just finished is not offered for that slot's next refresh. Picks are **by counters** (day, slot, completed count), not `Math.random`, like `tickets.js`: a save always gets the same board, and tests can pin it.
- **Unlocks by gig reputation:** rep 0: types 1, 2, 4. Rep 10: 3 and 5. Owning a vehicle with a bed: 6 and 7. Rep 25: 8. Rep 40: "large" versions (more stops, bigger loads, +40% base; the largest bulk loads need 100+ space units, so only the Tylan takes them in one trip).
- **Reputation:** +2 per gig at quality 80+, +1 at 50 to 79, -2 for a failed or abandoned gig, floor 0, cap 100.
- **Noah's counter** shows only type 1 and 2 gigs from the board (a market subset), never a fixed cycle.
- **Clients rest:** a client is not offered again within 2 game days.

**Pay curve against prices (rough, real time):** walking types average about $13 per 1.5 real min, about $500 per real hour before the repeat rule, about $380 with a mix after it; vehicle types about $40 per 3.5 real min, about $600 per real hour. So the Worktruck ($4,500) is about 7 to 8 real hours of mixed gigs, the pickup ($11,000) about 18; the Tylan stays gated by Lumberjack level 5 and logging pays more per hour (DESIGN 5: about $400 to $600 an hour) plus rank growth, so a career stays the better long-term choice. Today's Noah loop pays roughly $1,000 an hour with no cap: the new rates are lower per hour but varied; Haiku tunes after a play-test.

## 4. The vehicle ladder and the short flatbed
**Recommendation: the truck is the story's reward (beat 10), not a purchase after N gigs.** Reasons: (1) the testers' complaint is "I want a vehicle right away" and 16 to 22 minutes is right away; (2) "buy after N gigs" recreates the grind they called boring; (3) the loan in beats 5 and 6 doubles as the driving and fuel lesson, so the gift is earned in play; (4) it stays fair because it is small, slow-ish and has a small deck, and every later truck beats it at something. A second one can be **bought online for $2,800** (for a second home, or after skipping the story).

| Class | Price | Top m/s (mph) | Accel | mpg | Tank | Bed (space units) | Gate |
|---|---|---|---|---|---|---|---|
| **Corvan Shortbed** (new, `shortbed`) | gift, or $2,800 online | 16.5 (37) | 2.6 | 10 | 14 gal gas | 50 (10 logs or 50 planks; flat deck) | none |
| Worktruck | $4,500 | 17.9 (40) | 3 | 8 | 21 gal diesel | 32 | none |
| Tylan Flatbed | $8,000 | 15.6 (35) | 1.6 | 6 | 30 gal diesel | 120 | Lumberjack 5 |
| Off Road Pickup | $11,000 | 26.8 (60) | 4.5 | 14.5 | 18 gal diesel | 32 | none |

**Class line for `dist/vehicle.js` (placeholders; `hx`, `hz`, `doorZ`, `exhaust` come from the received model, `tests/vehicle.mjs` checks them):**
`shortbed:makeClass({id:'shortbed',tier:'low',mpg:10,name:'Corvan Shortbed',hx:1.0,hz:2.75,top:16.5,reverse:4.5,accel:2.6,brake:8,drag:.9,rMin:5.5,aLat:10,doorZ:.9,exhaust:{x:-.6,y:.3,z:-2.7}})` // the starter flatbed: short, nimble, small deck
- `map-definition.js` (the one added line): `{id:'online-shortbed',model:'shortbed',name:'Corvan Shortbed',sale:'online',fuel:{type:'gas',tankMgal:14000,port:{x:1.0,z:-.6}}}` (port from the model).
- **Deck** (`cargo.js`): about 1.9 x 2.6 m, floor height from the model (about 0.9 m); 50 space units; drop sides, no tailgate animation needed. New piece kind `crate` (4 space units) for gig loads, drawn as one InstancedMesh of boxes.
- **Paint** (`paint.js`, `direct:true` if the model has its own paint material, like the Tylan): Farm green `#4f6b3a` (Hal's, the gift's colour), Cream `#e6dcc0`, Sky blue `#5b8fc9`, Brick red `#9e3b2c`, Charcoal `#333333`, White `#e8e8e4`. Online stock and restock rules as every other vehicle (4.14).

**How it differs from the Tylan (both stay worth having):** the Shortbed is the town truck (tight turning circle 5.5 m vs 9, fits a car bay and a house driveway, cheap petrol at 10 mpg, no level gate, carries gig crates and long items); the Tylan is the timber truck (2.4 x the deck, all Ridgeline hauling and customer loads, the "large" bulk gigs in one trip, the company's work), slow and thirsty. Against the Worktruck: the Worktruck is faster and the Shortbed carries more and turns tighter.

**The model: missing.** Checked: `ASSETS.md`, `assets-register.json` and `assets-src/` hold the Tylan Flatbed (the user's 8.83 m logging truck), the Worktruck (00amza "Pickup Truck", CC-BY-4.0), the Off Road Pickup (Aditya Graphical, CC-BY-4.0), three forklifts. **No short single-cab flatbed exists.** The removed SpawnCamp flatbed (13,024 triangles, no wheels) is gone from the repo and was a big truck. Options, best first:
1. **The user models it** (like the Tylan; own work, no credit gap). Spec to hand over: single cab, about 2.0 m wide, 5.4 to 5.6 m long, flat deck with low drop sides, at most 4,000 triangles, colour-only materials with one separate `Truck_Paint` material, separate Wheel_FL/FR/RL/RR (spin about X) and Steer_FL/FR, +Z forward, anchors: driver seat and door, fuel port, exhaust, headlights, tail lights, 4 deck slots.
2. **A licensed model** from Sketchfab, Poly Pizza or a Kenney/Quaternius pack (CC0 or CC-BY). I have not verified any specific file; the user picks one and it is recorded in `ASSETS.md`, `assets-register.json`, `credits.js`.
Not recommended: a generated box truck or the Worktruck cab with a generated deck (fake asset). Until the model exists, stages S1 to S5 are buildable; S6 to S8 wait.

## 5. Data, save, functions, stages
**Save (no schema bump; optional fields normalised in `jobs.js normalizeProgress`, like `orders` and `careers`):**
- `progress.starter = {step: 0..10, done: bool, skipped: bool, quality: 0..100 (beat 5), fuelGiven: bool, loanUid: null | 'vN'}`. Normalise: step clamped to 0..10 and integer; `done` true forces step 10. **Old saves** (a save with `completed > 0`, or any owned vehicle, home, career or `cash > 0`): `{done:true, skipped:true}`, so nobody already playing is pulled into the tutorial.
- `progress.gigs = {rep: 0..100, recent: [{type, at}] (at most 30, last 24 game hours kept), board: {slots: [{type, client, places, expiresAt}] (4)}, active: null | {id, type, client, places, stage, startedAt, dueAt, quality, knocks, metres, tip}, nextId, clientsSeen: {clientId: day}}`. Normalise every field by type and range; an `active` gig whose type or places no longer exist is dropped with a Message.
- **Migration from `contracts.js`:** an old `activeJob` is cancelled without penalty (Message: "The gig board has changed: your old gig was cancelled."); `cooldowns` and `gigBoard` are read once and dropped. `contracts.js` stays one version for that read, then is deleted with `tests/contracts.mjs`.
- **Vehicles:** the loan is a normal `progress.vehicles` entry with an optional `loan:'hal'` field. A loan **does not count** toward `vehicleCount` and **cannot be bought or sold**; `normalizeVehicles` keeps `loan` only while `starter.step` is 5..9, otherwise a loaned vehicle is removed (a broken save never keeps a free extra truck). At beat 10, `loan` is removed (it becomes owned) only if `vehicleCapacity` allows; it is then moved to the studio's parking pose with `placeSafely`.

**Pure functions to write (each with tests):**
- `gigs.js`: `GIG_TYPES` (data), `normalizeGigs(v)`, `boardFor(p, now)` (counters, unlock rules, no duplicate type, client rest), `acceptGig(p, slot, now)`, `tickGig(p, {position, room, dt, moving, knock, metres})`, `completeGig(p, position, room, now)`, `failGig(p, now, why)`, `payFor(type, quality, repeats, rep)`, `repeatsToday(recent, type, now)`, `parRoute(points, start)` (best order of 3 stops, brute force over 6 orders).
- `starter.js`: `BEATS` (data: id, title, text, place, the event that finishes it), `PLACES` (Hal's porch, crate pile, truck farm pose, studio parking pose), `normalizeStarter(v, p)`, `starterObjective(p)` -> `{title, text, aim}` (the objective card and the tracker's story row read this instead of the hard-coded text at `game.js` ~787), `advanceStarter(p, event)` -> `{state, message}` or `{error}` (events: `read-message`, `delivered`, `ate`, `arrived`, `loaded`, `delivered-crates`, `refuelled`, `note-given`, `gig-done`, `rented`, `slept`).
- `orders.js`: `VEHICLE_PRICE.shortbed = 280000`; `grantVehicle(p, model, colour, pose)` (the gift and loan path: room check, no payment, new uid).
- `vehicle.js` class, `cargo.js` deck and `crate` piece, `paint.js` colours (data).

**Stages (each small, each stops with `npm test` passing; model per stage):**
| Stage | What | Model | Files | Tests |
|---|---|---|---|---|
| S1 | `gigs.js` pure: types, board, pay, repeat rule, rep, par route, normalise | Sonnet | new `dist/gigs.js` | new `tests/gigs.mjs`: board repeatable for a fixed save, never two types, unlock gates, `payFor` cents examples (incl. the 3,076 one), repeat multipliers, rep cap, par route, normalise junk |
| S2 | Save wiring and migration: `progress.gigs`, old `activeJob`/`cooldowns`/`gigBoard` dropped with a Message | Sonnet | `jobs.js`, `contracts.js` (read-only use) | `tests/gigs.mjs` migration cases; existing `tests/jobs*` still pass |
| S3 | Gigs app and Noah's counter on `gigs.js`; walking types 1 to 4; door dialogs; tracker row | Sonnet | `game.js` (gig hooks near lines 515-524, 561, 1131-1140, the tracker at ~1187-1240), `phone*.js` | `tests/gigs-game.mjs` (accept, deliver, paid amount) |
| S4 | Tune numbers after a play-test | Haiku | `gigs.js` data only | existing |
| S5 | `starter.js` pure + objective card text; beats 1-4 and 7-9 (no vehicle yet); skip choice; old-save rule | Sonnet | new `dist/starter.js`, `jobs.js` (normalise), `game.js` (objective text ~786-790, Noah ~515-524, Hal's dialog), Hal drawn near the farm via the existing character code | new `tests/starter.mjs` (every beat's event, wrong events refused, old save skipped, places walkable); one short `tests/starter-game.mjs` (beats 1-2) |
| S6 | The model: received, converted (`scripts/build-shortbed.mjs`), `ASSETS.md`, `assets-register.json`, `credits.js` if licensed | user, then Sonnet | `scripts/`, `dist/shortbed-assets.js` | `tests/vehicle.mjs` hull vs model |
| S7 | Class, paint, deck, `crate` piece, `MAP.vehicles` line, Store card (online, $2,800), `npm run pictures` | Sonnet | `vehicle.js`, `paint.js`, `cargo.js`, `cargo-view.js`, `orders.js`, `map-definition.js` (one line) | `tests/vehicle.mjs`, `tests/paint.mjs`, `tests/cargo.mjs`, `tests/store-categories.mjs` (picture present) |
| S8 | Story beats 5, 6, 10 (loan, crates, fuel cash, gift, sleep) and vehicle gig types 5 to 8 (knock detection from driving) | Sonnet | `starter.js`, `gigs.js`, `orders.js grantVehicle`, `game.js` hooks, `driving.js` (a knock event) | `tests/starter.mjs` (loan not counted, removed if broken, gift needs room), `tests/gigs.mjs` (knocks to quality) |
| S9 | Text and number tweaks after the second play-test | Haiku | data only | existing |

After any `dist/` change: `npm run release -- --force` before the packaged tests (0.35.4 is not deployed); bump the version if it is deployed by then. Send each stage as a hub plan (`npm run plan`), build only an approved revision.

## 6. Open questions for the user
1. **Gift or purchase:** the truck as the story's reward (recommended), or "buy for $2,800 after 5 gigs"?
2. **The model:** will you model the Shortbed yourself (like the Tylan), or should we look for a licensed one? Without it S6 to S8 wait.
3. **Names:** "Corvan Shortbed" and Hal Brennan as the story's giver: keep, or rename?
4. **Old saves and skippers:** no story, and Hal sells the truck at the farm for $2,800 (recommended), or a free truck for everyone?
5. **Hal in person** (+1 character at the farm) or phone-only (free)?
6. **Hal as a regular client** after the story (farm chain errands some mornings)?
7. **Retire the six old gigs completely** (recommended), or keep the café "hold the station" one?
8. **Multiplayer:** allow the story online (sleep becomes rest), or single player only?

## 7. Unverified (check in the stage that touches it)
- Beat timings: walking and driving speeds were estimated from distances (spawn to market about 32 m, market to farm about 250 m, farm to gas station about 320 m); only a play-test gives real minutes.
- That `normalizeVehicles` and the Store accept an `online` model with no `home` the way the design in 4.14 says; and where the studio's parking pose is.
- That the character code has a farmer outfit for Hal (`character.js` has no "Farmer" match; `map-definition.js` names `outfit:'Farmer'` for Hal).
- That `driving.js` exposes a collision event usable as a "knock" (one match for collision wording; not read).
- That Hal's porch, the crate pile and the farm truck pose are walkable and drivable (positions not chosen yet).
- Whether any specific licensed single-cab flatbed exists in a usable licence; and whether the Worktruck model is single-cab.
- Population-driven clients assume `population.js buildPopulation(MAP)` is cheap enough to call once at load (it is pure and cached by design; not measured).

## Addendum 2026-11-13 (user's answers, more gigs)
Decisions by the user: Q3 keep the names Corvan Shortbed and Hal Brennan; Q4 a player who skips the story is WARNED they will not get the reward (no free truck for skippers; Hal's $2,800 sale stays open to them); Q5 Hal appears in person at the farm; Q6 Hal becomes a regular gig customer after the story; Q7 retire all six old gigs; Q8 the story runs in multiplayer (sleep becomes rest there). Q1 reward at the end of the story. Q2: the user asked for a licensed shortbed model to be found (see the chat; none confirmed yet).
The user also asked for delivery gigs and short fun cafe shifts. Draft additions, each with ONE twist (to be designed in detail, then built in the gigs.js stages):
| # | Gig | Twist | Needs |
|---|---|---|---|
| D1 | Lunch Run | 3 bagged orders, food cools: the tip shrinks every game minute | walking, timer |
| D2 | Where Is It? | a parcel with a vague address ("green door above the laundry"): find it from clues, a tip for the first guess | population data, dialog |
| D3 | Morning Paper Round | 8 doors on a loop before 07:00, pay per door, bonus for all | on foot or the shortbed |
| D4 | Pharmacy Rush | urgent, the customer phones with a shrinking time; shortest route wins | phone messages |
| D5 | Flowers | fragile: running spills petals and lowers quality | carry state |
| D6 | Farm Crates | Hal's produce on the shortbed to 3 shops; bumps lower quality | shortbed, cargo |
| D7 | Moving Day | two homes, a few furniture pieces on the bed; choose one trip or two | shortbed, cargo |
| C1 | Lunch Rush (5 min) | orders pile up; serve in a good order for combo tips | cafe orders |
| C2 | Latte Pour | a timing mini-game; stars set the tip | a small UI |
| C3 | The Regular | a regular's secret "usual": remember what they ordered last time | order memory |
| C4 | Closing Time | a quick tidy, then one late customer with a short story | dialog |
| C5 | Taste Test | a new item day: serve samples, read the reactions, small bonus | dialog |
Unverified: what items and customers the cafe already supports, whether a carry-state "spill" exists, whether order memory can be saved cheaply.
