michadr.

# Eastbank drive, bakery deliveries and 0.36.3

## Eastbank and quality changes

The original Eastbank capture placed the player next to the vehicle in one frame. The follow-up drove from x 39 to x 95 with normal vehicle input. The headed gaps near the Eastbank boundary peaked at 6.2 ms in WebGL and 12.1 ms in WebGPU. The longest WebGL gap on the drive was before Eastbank. The teleport stress case still spikes. I left chunk streaming unchanged.

The nighttime High → Low switch reproduced. The game now prepares the new shader variants before its next world draw. On the same headed route, before/after frame gaps were 951.4/175.8 ms in WebGL and 860.6/763.6 ms in WebGPU. Low → High was 6.2/24.2 ms in WebGL and 109.1/78.8 ms in WebGPU. In the updated WebGL High → Low run, the first world draw began about 397 ms after the switch, with 33 callbacks in between. The WebGPU stall remains. Confidence is high for the sampled route and lower for how broadly the timing generalizes.

Raw traces are in %TEMP%/eden-eastbank-idle-04042517, %TEMP%/eden-eastbank-drive-cb80b377, %TEMP%/eden-eastbank-headed-f725be71, and %TEMP%/eden-quality-async-7d4905be.

## Bakery deliveries

Orders use flour and coffee beans. Pick up at the current Wholesale dock anchor from 7 AM to 5 PM. Each trip carries one sack by hand or one four-sack pallet on a suitable empty truck bed. Unfilled quantities stay on the board for another trip. The bakery uses one sack per ingredient per elapsed day. Legacy active bakery plank jobs and house plank orders are preserved. Cargo and claims clear on cancel or delivery. Bakery models load on demand, and an active local load shows one cargo model at a time.

## Files changed

| File | Lines |
| --- | ---: |
| dist/game.js | 2057 |
| dist/index.html | 61 |
| dist/needs.js | 209 |
| dist/gigs.js | 327 |
| dist/world-tick.js | 116 |
| dist/jobs.js | 76 |
| dist/plank-needs.js | 52 |
| dist/bakery-needs.js | 147 |
| dist/bakery-goods.js | 30 |
| dist/carry.js | 147 |
| dist/cargo.js | 187 |
| dist/cargo-view.js | 43 |
| dist/load-drag.js | 15 |
| dist/gig-bridge.js | 80 |
| tests/bakery-needs.mjs | 166 |
| tests/plank-gig.mjs | 124 |
| notes/handoff.md | 426 |

The release packager also updated the 0.36.3 snapshots. No forbidden-file edit or new test file was needed.

## Verification

```text
Packaged release 0.36.3: 273 files -> dist/releases/0.36.3
dist/index.html now loads releases/0.36.3/
PASS bakery-needs: demand, cadence, caps, fill, old-plank expiry, tracker text, garbage
PASS plank-gig.mjs: supplier and house board slots, whole-stack pickup, full/partial delivery with give-back, cancel give-back, and old-save load passed.
```

I seeded eligible needs and placed the player and truck at the interaction points. In WebGL and WebGPU I accepted on the phone, loaded and delivered with E, and verified the physical cargo and payout. Both runs produced the same output.

```text
hand-sack {"hand":{"kind":"sack","good":"coffee-beans","gig":1},"haul":1,"mesh":true}
log {"payout":8230,"carry":null,"stock":{"flour":0,"coffee-beans":1}}
truck-pallet {"haul":4,"cargo":[{"k":"bakery-pallet","g":"flour","j":2}],"mesh":true}
log {"payout":7645,"cargo":null,"stock":{"flour":4,"coffee-beans":1}}
```

The extended test covers cancellation, save normalization, duplicate-payout refusal and the legacy active job. Screenshots for both jobs and nighttime Wholesale are under %TEMP%/eden-bakery-truck-0363 (WebGPU) and %TEMP%/eden-bakery-webgl-0363 (WebGL). Confidence is high in the single-player transactions and visible cargo. Co-op claims, unassisted delivery drives and GPU pipeline execution time remain unverified.

Final test output (the Hub tests are deferred; the Hub commit test would invoke Git). Full log: %TEMP%/eden-0363-tester-final-suite.log.

```text
Three.js tester gate: 306 of 306 test files passed.
```

## Tester notes

- Accept a bakery gig from the phone. Follow the marker to the dock and then to the bakery. Try both cargo sizes and give up a loaded job once to check it clears.
- At Wholesale, check the rear alley and lighting after dark, and try a retail purchase during posted hours.
- In the pickup at night, switch High → Low → High. Record the renderer and direction if it hitches.
