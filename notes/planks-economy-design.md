# Planks economy (owner request 2026-11-17; decisions made, nothing built)

## What the owner wants
Planks become important in the economy. The logging job should reflect the whole chain: cut trees -> turn logs into planks -> move planks to the warehouse -> deliver them. The player should be the base of that chain, not a bystander.

## Decisions (owner answers, dialog 2026-11-17)
1. PAY: every step pays a share and the DELIVERY pays most. Fell and cut, planks off the sawmill, stack in the warehouse, deliver an order. The delivery order pays roughly the world price of the planks (a plank is a $9 world good, `world-goods.js` baseCents 900, marked ASSUMED there), so a full truck is real money.
2. SAWMILL: player-fed. The sawmill makes planks from the logs the player brings, plus a small trickle so the town never runs dry. Logging is the base of the whole plank economy.
3. DEMAND (all three): the existing Ridgeline orders (paid properly); town builders and shops (Eastbank Building Supplier, bakery, houses) open plank needs on the gig board when stock is low, so planks also leave the warehouse by truck; construction and repairs (fences, broken walls, new buildings) consume planks, so large plank runs have a late-game use.
4. SCOPE: this design note first, then build in small serial stages after the cargo model (C-A) exists, because planks must be ordinary cargo items.

## Today's facts (to check before building; from the 2026-11-17 audits)
- A plank is a world good at 900 cents; the sawmill makes 24 a day on its own (`world-goods.js` rate 24, sawmill to Eastbank supplier 6 a day). The player is not needed.
- Delivering a plank order pays about $1 a plank (`forest.js` deliverPlanks); stacking a full rack cell pays $5 once per cell per shift; the warehouse stock is the Ridgeline pallets (world-tick `mirrorPallets` overwrites the world's warehouse planks every day, so a gig that adds planks to that stock without adding pallets is destroyed: audit A F5 closed that loop by keeping plank restocks for the warehouse off the board).
- Plank orders: `staged`, `taken`, `delivery` pieces in `forest.js`; a planks stack in the hands is `carry {kind:'planks',count}`; planks on a bed are cargo pieces tagged with the order (`o`).
- Gig needs cannot move non-crate goods yet (audit A F4); they are kept off the board until a pickup step exists. The cargo model (`notes/cargo-redesign.md`, C-A) is the right place to give planks a real pickup.

## The chain, as stages (small, serial; game.js is shared, one stage at a time)
- P-A economy numbers (pure, no game.js): one table for the chain: price per plank at the sawmill, supplier and warehouse, pay per step (felling, log haul, sawmill work, stacking, delivery), the log-to-plank ratio and sawmill rate, the trickle, and a test that a full cycle by hand earns more per game hour than the existing odd jobs but less than a skilled job (the owner sets the target hourly wage; ask before fixing it).
- P-B sawmill fed by the player: logs delivered to the sawmill become planks in its yard (a stock the player takes from), no free output beyond the trickle; the world-state sawmill rate becomes the trickle. Needs a pickup step for planks (cargo C-A items).
- P-C warehouse intake: planks from the sawmill yard stacked into the racks (existing racks and pallets), pay per rack as now but at the new rate; `mirrorPallets` stays the truth.
- P-D delivery pay: Ridgeline orders pay by plank price; truck bed capacity per model decides the run size (cargo.js BEDS).
- P-E town demand: Eastbank supplier, bakery and houses open plank restock needs on the gig board (needs.js; remove the audit-A-F4 filter for planks once P-B gives them a pickup) and pay the world price.
- P-F construction and repair sinks: fences, walls and new buildings consume planks from a build site stock; the late-game use.
- P-G the logging job text, tasks, XP and perks reflect the chain (jobs and the career ladder).

## Answers to the open questions below (owner, 2026-11-17, dialog)
- WAGE: a full by-hand cycle is the BEST hands-on job in town (clearly above the cafe and the odd jobs); the main chat sets the exact number and a test pins it.
- SAWMILL: 1 log = 4 planks (matches the belt stack of 4); the player runs the saw (feed the log, switch on, take the stacks).
- PRICES: yes, a Prices screen on the phone (planks at supplier, sawmill, warehouse; note when stock is low and price high).
- CONSTRUCTION: later, with the map and plot work (P-F moves out of this pass; repairs and building sinks come with plots).
So P-A can start: numbers table, wage test, Prices screen data (pure), then P-B onward.

## Open questions (ANSWERED above; kept for the record)
- Target hourly wage for a full by-hand cycle versus the cafe and the odd jobs (a number, so the tests can pin it).
- How many logs make a plank (and how many planks per log), and whether the player runs the saw (a mini task) or drops the logs and waits.
- Do plank prices move with stock (they do in `world-state.js`: price band) and should the player see the price on the phone?
- Whether construction sinks (P-F) belong in this pass or the map/plot work (plots, building by the player).
