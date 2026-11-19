# Neo: bakery needs pure module (stage B-PURE). NEW FILES ONLY, no game.js.

Read AGENTS.md rules first (they apply in full), context.md lines 1-45, notes/handoff.md lines 1-16, then notes/eval/outbox/bakery-goods-assets.md ('wiring request') and dist/plank-needs.js + tests/plank-needs.mjs (the model to follow). Owner decisions: the bakery no longer needs planks; it needs FLOUR and COFFEE BEANS (houses keep planks, target 4). Supplier = Eden Wholesale ('property:eden-wholesale'). Sacks are carried by hand slowly like crates; pallets by vehicle only. Plank restocks stay exempt from the 300 m walk filter; keep the cadence rules style (hash-based, max 1 new need a day, fewer than 2 open).

Create:
1. dist/bakery-needs.js: pure module (header comment first line) with: BAKERY_DEMAND (flour target 6/18, coffee 4/12 from dist/bakery-goods.js; import its constants, do not copy them), needsForStock(stock, dayHash, openNeeds) -> new need or null, fillNeed(need, delivered), expireOldPlankNeeds(needs) which drops open 'property:alder-bakery' plank needs from old saves (idempotent), and text helpers for the gig tracker ('Load the flour sacks at Eden Wholesale (E)').
2. tests/bakery-needs.mjs (Node assert, one PASS line; style of tests/plank-needs.mjs): cadence, caps, idempotent expiry, old-save shapes, never throws.
Do NOT edit world-goods.js, plank-needs.js, needs.js, gigs.js, game.js or any forbidden file. In the report list the exact wiring edits for the game.js lane (file, function, change), matching the wiring request.
Run node tests/bakery-needs.mjs and `npm run index` (do not raise the cap).
Report: notes/eval/outbox/neo-bakery-needs-pure.md, first line "michadr.", real pasted test output, what you could not verify, confidence.
