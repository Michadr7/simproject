michadr.

PB3 report: three small bugs from the Gemini bug hunt. All three were real, and all three are fixed.

Files changed:
- dist/garage.js: line 146 (pullOut) and line 159 (statusOf).
- dist/phone-calls.js: line 38 (towLabel).
- tests/phone-calls.mjs: 2 assertion lines added in the existing tow-options block.
No new files. I did not touch notes/handoff.md or the stepBog sink===0 item.

1. pullOut had no '!free&&' guard. Real. When the pull-out was free, the fee was 0, but a player with negative cash still hit "A pull-out costs $0.00". Fix: `if(!free&&(p.cash||0)<fee)`. Test: a free hard-luck pull-out with cash -500 now succeeds.
2. towLabel had no null guard. Real. A null tow with inShop false showed "Tow to the repair shop · $0.00". Fix: a null tow now shows 'Already at the shop'. That matches the existing comment in towOptions that null means the vehicle is already at the shop. Test: towLabel({inShop:false,tow:null}) returns 'Already at the shop'.
3. statusOf quoted a tow fee for a vehicle parked in the bay. Real. towTo then refused it with "already at the shop". Fix: `tow:e||inBay(v)?null:...`. Test: a vehicle in the bay but not in the shop gets tow null and inShop false. With fix 2, the phone then shows 'Already at the shop' for it.

Tests:
- `node tests/phone-calls.mjs` prints PASS.
- `npm run release -- --force` packaged release 0.35.9 (177 files).
- `npm run index` reports index 30728 tokens (target 31500), unchanged, and brief 2996 of 3000.
- `npm test` ends with "All 213 test files passed."

Not verified: nothing was seen in a browser. I checked the phone Call app layout only by reading the code (phone-call.js uses the towOptions and towLabel output as-is).
Confidence: high on all three.