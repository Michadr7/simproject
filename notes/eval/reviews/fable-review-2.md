# Fable review 2 (world, needs, NPC, save: W-D1 to W-D3). Filed 2026-11-16
Status: OPEN. Nothing fixed yet. Needs a second fix stage (touches gigs.js and game.js, so serial, one stage at a time).

Held up: old saves load and keep cash; normalising twice is stable; saves about 7 kB after 120 days, all lists capped; daily tick once per day, deterministic, no double fire on reload; stock never negative/NaN; claims cannot stick; map data validates; NPC planner 3.7 ms per 1,000 frames for 28 people.

Problems, in order:
1. No way to give up a gig. abandonContract exists, nothing calls it. A need gig you cannot finish (lost the truck) blocks gigs for 2 to 4 game days. Fix: "Give up" button on the active gig card.
2. Chore gigs use made-up coordinates (needs.js placeholders). Forest point is z 120, outside the playable area (ends z 100); the foreman's "Clear the way" gig can show an unreachable marker. Fix: use the map's real place positions, drop unreachable ones.
3. New player has almost no work. 120-day sim from a fresh save: first gig day 3 and it was the unreachable forest chore; from day 4 nearly all say "Needs a truck" (every restock that passes the distance filter is a crate good). Only about 14 doable chores in 120 days. Fix: one guaranteed walkable gig per day; allow hand-carry of small crate loads (4 or fewer). MOST IMPORTANT design fix.
4. Cafe eggs delivered to the market: cafe restock shows "Eggs for the market" with a marker at the cafe, hand-over prompt exists only at the market door; phone says Noah's shelf stocked while the market says "Sold out"; missing space in "Delivered14 dozen".
5. Co-op clients never tick the world (needs and stock freeze, board empties after 2-3 days, a client's need gig cannot be settled). Needs host sync (with MP-AVATAR). Interim: clients tick locally.
6. Invisible needs wreck balance: needs that can never reach the board (sick errands, harvests, warehouse planks restock) fill the 6-need cap and expire. Sim: Alder Center prosperity 61 to floor 30 by day 20, 17 sick people lost mood, "nearly out of..." phone spam almost daily. Fix: only open needs that can become a board slot; give the warehouse a supply row.
7. Corrupt world.day (huge, or clock set back in dev) freezes the world silently. One-line clamp.

Minor: returned eggs can vanish when the farm is full; Oscar's stranger knock gives +1 standing up to 3 times a day (acquaintance in 2 days); Oscar's "Leave me be" still shows topic buttons that cost mood; knocking on an empty flat at 03:00 answers "Who is it?"; Lincoln's first words can be "low" lines; People page says "No regular job" for Lincoln and Brentster; foreman and driver NPCs are not in the population but post needs; a talk with a crowd walker can anchor to a shared avatar that gets reassigned.

Suggested fix stage order: Give up button, real place points, guaranteed daily walkable gig, cafe delivery, need pruning plus warehouse supply, clamp, Oscar fixes. Client tick waits for MP-AVATAR host sync.
