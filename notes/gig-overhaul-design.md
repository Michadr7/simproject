# Gig overhaul design (Opus advisor, 2026-11-17; awaiting the owner's answers to the 5 questions)

Problem: a gig can be finished in about 10 seconds and repeated for easy money; gigs feel redundant.

## Diagnosis (high confidence, from dist/gigs.js, gig-bridge.js, gig-parcel.js, shift.js)
1. No pickup: acceptGig (gigs.js ~96) puts the box in hand anywhere; accepting at the client's door pays at once (tickGig ~108).
2. Pay is a flat base, ignores distance (gigs.js ~52). EXTRA_PLACES are 15-30 m from the market: about $10 + up to $8 tip for 15 m beats every job wage.
3. Repeats never stop paying: REPEAT_PCT floors at 55% and counts only the same type; the board avoids only the last type; 4 slots refresh every 22-90 game minutes; no daily cap.
4. Job wages for comparison: 800-1800 c per game hour by rank (map-definition.js ~409), plus piece pay and a 2500 c rank shift bonus (shift.js).

## Rules
- pay = HANDLING[type] + parMetres x CENTS_PER_M[mode], then x quality x rep x fatigue (integer cents, floor once), then + tip. Par = shortest route pickup -> stops x PAR_SLACK 1.2.
- CENTS_PER_M_WALK = TARGET_C_PER_GAME_MIN (20 c = $12/h, between job ranks 2 and 3) / WALK_M_PER_GAME_MIN. Vehicle gigs 30 c per game minute plus cargo risk. Read walk speed and clock rate from the game and pin them in a test (UNVERIFIED).
- Handling fee 150 c walking, 400 c vehicle. Minimum par distance 150 m walking, 500 m vehicle: the board never offers shorter.
- Daily fatigue (per game day): gigs 1-5 pay 100%, 6-8 pay 70%, 9-10 pay 40%, then 'No more work today'. Replaces REPEAT_PCT. Sleep does not reset it until 05:00 the next day.
- Rest: client 2 days (exists), pickup-to-drop pair 1 day, one of each type on the board.
- Board hash keyed on day, window, slot and a world seed (not g.completed) so all players in a world see the same board.
- Tip = client generosity (0-3, hashed) x quality band (>=90 full, >=70 half, else 0), capped 25% of pay, only if on time.
- Complication on about 1 in 4 gigs, shown before accepting: not home (leave with a neighbour, second stop, +30%), wrong item (go back), signature (home after 4 PM).

## Variety
D1 groceries (time limit, perishable), D2 parcel, D3 round of three, D4 cafe run (hot drinks lose quality per game minute over par), D5 laundry return (two legs), G4 bulk or fragile haul (crash lowers quality; needs the driving knock event), G5 farm crates (cratePay, cargo.js), G7 fuel rescue (buy fuel up front, repaid plus tip).

## Progression
Gig rep tiers: Newcomer 0-9 (D1, D2), Known 10+ (D3-D5), Trusted 25+ (vehicle gigs), Regular 40+ (large gigs x1.4, exists). A client with 3 gigs at quality >= 80 becomes a regular: a direct phone request every 3 days at +15%, outside the board slots but counted in fatigue. Hal is the first regular. Gigs stay side income, ceiling about one rank-2 shift a day. Starter beat 8: the two starter gigs are fixed, exempt from minimum distance and fatigue, still need a pickup, still fire gig-done.

## Anti-cheese
- Accept at the door and finish: box exists only after E at the pickup; places tick only after pickup.
- Drop the parcel by the door: completing needs the box in hand within 3 m; a box dropped more than 60 game minutes ago fails the gig (-2 rep).
- Teleport/vehicle: minElapsed = parMetres / FASTEST_M_PER_GAME_MIN[mode]; faster pays only the handling fee.
- Same pair/type spam: pair rest, client rest, one per type, fatigue.
- Board refresh by sleeping: fatigue per day, hash ignores completed.
- Multiplayer duplicates: claims in shared world state, host pays (assumes multiplayer; unverified).
- Accept-abandon-reroll: a taken slot stays taken; abandon costs 2 rep.

## Build plan
Pure lane (parallel, new files + tests): G-A dist/gig-pay.js + tests/gig-pay.mjs (about 90 lines); G-B gigs.js additive (origin on slots/actives, old saves load as picked up, min distance, pair rest, world seed, starter override; payFor kept as a wrapper; tests/gigs.mjs updated); G-C dist/gig-clients.js (generosity, complications, regulars).
Serial lane (game.js): G-D pickup wiring (box spawns at origin, E to pick up, arrow to pickup first, card shows distance/minutes/pay); G-E complications, regular phone messages, daily-cap UI; G-F vehicle gigs G4/G5 (after the driving knock event); G-G cafe G6 + laundry D5; G-H multiplayer claims (only if multiplayer exists).
Risks: old saves with an active gig; tests/starter-game.mjs beat 8; tests/gigs.mjs expectations change when REPEAT_PCT goes.

## Unverified (the advisor did not read these)
Game minutes per real second, walking speed, rent period (housing.js:3 rent 6000; map-definition.js ~277 rentCents 14000-19000: per day or week?), whether multiplayer claims apply, where the two starter gigs come from (game.js ~869). Not read: context.md, DESIGN.md, G4-G7 handoff entries, game.js, cargo.js, damage.js.

## Owner questions (recommended default first)
1. Target gig wage: $12 per game hour.
2. Daily cap: 5 full, then 70%, 40%, hard stop at 10.
3. Driving on walking gigs: allowed, with the minimum-time check.
4. Complication rate: about 1 in 4, always shown before accepting.
5. Regulars: 3 good gigs, +15%, a request every 3 days, Hal first.
