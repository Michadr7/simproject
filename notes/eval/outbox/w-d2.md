michadr.

# W-D2: the egg-haul vertical slice (needs -> board -> farm crates -> market -> pay, mood, standing)

## Files (lines)
- dist/gigs.js 292 (was 211): 8 GIG_TYPES need-restock/-harvest/-errand/-clear/-repair/-tend/-tow/-serve (need:true, one stop, handling from HANDLING_C: vehicle for restock/harvest/tow, walk for the rest); boardFor = needBoard (needSlots) for non-starter play, EMPTY when nothing is open; `opts.hashed` keeps the old hashed board for tests only; starter board unchanged; acceptGig claims the need (needs.claim) and keeps needId/needGood/needQty/needTitle/needText/needReward/haul/truck on the active gig (normalizeActive); tickGig does not tick the market stop until the crates are loaded; completeGig -> completeNeed (needs.fill, pays needPay(...).total once, Noah helped(), gainStanding +1, rep +2, doneToday); NEW pickNeedHaul, deliverHaul, abandonGig, settleNeed, hasCrateBed, needsPickup, needBoard, needReward, slotOffer, NO_WORK_POSTED, NEEDS_TRUCK.
- dist/gig-bridge.js 68: offers/active view read need cards (title, text, terms, reward by needPay, marker leads to the farm until loaded), marketContracts shows the needs board, pickNeedCrates, deliverNeedCrates, abandonContract, settleNeedGig, NO_WORK_POSTED.
- dist/needs.js 186: fill(...,opts.carried) (goods already taken from the source at pickup are not taken twice), release(), newsText().
- dist/world-tick.js 83: newsFor(before, after, max) (phone lines for newly opened needs).
- dist/game.js 1677 (+~35 lines, all syntax-checked only): imports, worldDayPassed (tick + settle a closed need gig + at most 2 'Town news' lines through notifyPhone('gigs', ...)), syncNeedCargo (crates on the truck deck follow the active gig), needCandidates/needLoad/needDrop (E prompts at Hal's pallet and at the market door), Noah's greeting = moodLine(noah mood), 'What is on the shelves?' choice (In stock: N unit at $X a unit / Sold out), empty board text, a local `parcelHeld` that ignores need gigs, syncParcel hides the box for need gigs.
- tests/needs-loop.mjs NEW 120; tests/gigs.mjs (hashed board via opts.hashed + empty-board check), tests/gigs-game.mjs (a clear-the-way need stands in for the old offers), tests/needs.mjs (need-* types now exist), tests/gig-parcel.mjs (takes its parcel from the hashed board).

## Real test output
- node tests/needs-loop.mjs -> PASS needs-loop: need opened day 103 (11 dozen), board slot, 11 dozen (3 crates) farm 66->55, shelf 3->14, price 563->563, paid 6970, mood 60->64, standing 0->1
- node tests/gigs.mjs -> gigs ok ; gigs-game.mjs -> gigs-game ok ; gig-parcel.mjs -> gig-parcel ok
- node tests/needs.mjs -> PASS needs: ... ; starter.mjs -> starter ok ; starter-game.mjs -> starter-game ok
- world-tick, world-state, npc-life, session-clock, gig-pay, gig-clients, cargo, cargo-game, cartons, customer-game, delivery-game, dock-game, fuel, jobs: PASS (each run alone). startup.mjs prints "Existing save: gameplay, phone apps/controls/gigs, and multiplayer frame checks passed." but it runs the OLD packaged release, so it does NOT exercise this game.js.
- node --check OK on game.js, gigs.js, gig-bridge.js, needs.js, world-tick.js. NOT run: npm run release / index / npm test (as instructed). brief.mjs will still need `npm run index` (new test file, new exports).

## What the chain does (pure, tested)
7 untouched days -> market eggs 3 -> need opens (day 103, 11 dozen) -> Town news 'Noah: we are nearly out of eggs.' -> board card 'Eggs for the market' (reward from needPay, terms 'Needs a truck' if you own no crate-bed truck; accept refused with 'This job needs a truck with a bed.') -> accept claims the need -> E at the pile (pickNeedHaul): farm stock 66 -> 55 (refuses 'The coop is empty today.' when 0), 3 crates -> E at market door (deliverHaul): shelf 3 -> 14, claim released, need filled, cash +$69.70, Noah mood +4, standing +1 -> total dozens conserved at every step (in transit = on the truck). Too fast = handling fee only. Abandon / need expired / shelf recovered meanwhile = claim released and the carried dozens go back to the farm. Old saves with a hashed gig active still load (normalizeActive).

## Decisions I made (say if wrong)
- Crates never go by hand, so ANY need-restock of a crate good (eggs) needs an OWNED non-loan truck whose bed takes crates (worktruck, offroad, shortbed; not the flatbed). Hal's loan truck is excluded (starter story owns it). With none, the card says 'Needs a truck'. Simple thing, as asked.
- Units: haul is in dozens; crates = ceil(dozens / 4). The farm gives only what the need wants, so nothing is left over.
- Board rule: goods that must travel (restock/harvest/errand) only appear with a route of at least 300 m (walking min par), chores always. This keeps placeholder places (sawmill, forest, warehouse, par 0 to 45 m) off the board: without it a harvest of 30 planks at the sawmill paid about $270 for walking to a point. The farm to market egg route is 309 m, only just over.
- Starter beat 5 still does NOT touch the world stock (its 4 crates = 16 dozen is just the unit). If wanted: farm -16 at 'loaded', market +16 at 'delivered-crates' (4 lines in applyStory; left out to keep the story byte-identical).

## Left / not done
- Shop UI: the store window (store.js / items.js, not on my list) sells items.js goods only (no eggs), so the shelf count and price are in Noah's dialog ('What is on the shelves?'), not in the buy window.
- Phone: the Gigs app text for an empty board is phone.js's own; it needs the text 'No work posted. Check back tomorrow.' (NO_WORK_POSTED is exported from gig-bridge.js). No abandon button exists in the phone (abandonContract is exported and unused): a stuck need gig ends by itself when the need expires (2 to 3 days). Town news uses the existing 'gigs' app (messages.js has no 'news' app; adding one means editing messages.js APP_NAMES + phone.js).
- Edit needed in dist/gig-parcel.js line 14: `parcelHeld=p=>!!p?.gigs?.active&&!p.gigs.active.drop&&!p.gigs.active.needId`. Without it carry.js/forest.js still refuse planks/logs while a need gig is active (I shadowed parcelHeld inside game.js for vehicles, forklift, nozzle, so driving works).
- Only need-restock of crate goods has the pickup/haul flow. harvest/errand/chores complete at their place point through the normal 'Report back' prompt (fill buys from the source then). Errands to a dwelling and any place with no PLACE_POINT have no slot yet.
- Quality is 100 (no knock tracking for need crates; story has storyKnocks). Hal's pallet mesh is not hidden when the farm has 0 eggs (only the story hides it).
- Price: the shelf is refilled to 70% of target (14 of 20), and the +25% price cap holds until the shelf passes 16 dozen, so a single run shows the same price 563 (the test proves 24 dozen is cheaper). The egg need pays about $70 for a 309 m run (value of 11 dozen at the capped price): high next to the $25 starter gig; tune CHORE/unit value or pay the floor + a fraction.
- Pallet write-back to Ridgeline, NPC standing tiers in dialogue, co-op (claims use the fixed id 'player').

## Per-frame cost
worldDue unchanged (17 ns). New: syncNeedCargo = 2 to 4 property reads when no need gig (nothing allocated); with a loaded run one countOf over at most 16 pieces. needCandidates runs inside the existing candidates() pass: 1 property read when idle. Daily tick work: newsFor over at most 60 needs plus 1 settleNeedGig.

## Could NOT verify
Nothing was seen in a browser. game.js is only syntax-checked: the prompts (reach 2.6 m at the pile, 3.2 m at the market door), crates appearing on the deck via syncNeedCargo, toasts, Noah's dialog and the shelf lines are untested in the real game. The packaged release was not rebuilt.

## Eye-check (8 points)
1. Fresh non-starter save, sleep 3 to 7 days with the market low on eggs: a phone message 'Noah: we are nearly out of eggs.' (Gigs app) appears once; no flood on load.
2. Gigs app / Noah 'View jobs': 'Eggs for the market' with a reward; with no truck the terms say 'Needs a truck' and accepting says so. No open need: 'No work posted. Check back tomorrow.' (Noah's dialog; the phone text is phone.js's).
3. Own a Shortbed/worktruck/offroad, accept it: the gold marker leads to Willow Farm; no box appears in your hands; you can still enter the truck.
4. Park beside Hal's pallet: prompt 'Load the crates onto the truck'; toast 'Loaded 3 crates (11 dozen) · Willow Farm has N left'; crates appear on the deck; the marker now leads to the market. With the coop at 0: 'The coop is empty today.'
5. Drive to the market door: prompt 'Hand the crates to Noah' (truck within 14 m, market open); crates leave the deck, toast with pay.
6. Talk to Noah: 'What is on the shelves?' shows Eggs In stock: N dozen at $X a dozen (higher N, lower price after the delivery once above 16) and 'Sold out' at 0; his greeting line is his mood line and changes after a few deliveries (+4 each).
7. Save and reload with crates loaded: crates are still on the truck and the gig card still says 'Hand over at the market'.
8. Starter story still plays through beat 5 (Hal's 4 crates) and beat 8 (starter gigs) unchanged.

## W-D3 and MP-AVATAR still need
W-D3: dialogue with moodLine/talk()/Lincoln's topics, standing tiers shown, visit door (canVisit, friends dropping by), People page (needs a phone app = phone*.js), per-NPC client ids for the board (needs use short ids noah/hal), harvest/errand hauls with real place points, 'news' phone app. MP-AVATAR: claims keyed by player id (now 'player'), crates/haul in co-op (applyWorld), other players seeing the loaded deck.

## Confidence
Pure rules (board, claim, pickup, fill, pay, mood, standing, abandon/expire, conservation, old saves): high (tested). gigs.js/bridge integration with the starter: high (starter tests pass). game.js wiring: medium-low (about 35 lines, syntax only, nothing run in a browser).