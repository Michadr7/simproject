michadr.

# 0.36.4 bakery co-op and Ironwood I4/I5

## Changes

- The elected host publishes bakery needs. The relay applies the claim, pickup, cancellation, and payout rules in order. It keeps a surviving player's claim through host departure and releases the departing player's claim. Socket attachments restore the board and active runs after Worker hibernation. The phone uses the need's ID so moving an offer between slots cannot redirect a click. Receipts authorize the local cargo and cash changes.
- Converted 20 models from [Kenney City Kit (Commercial) 2.1](https://opengameart.org/content/city-kit-commercial), including six facade details for I6. Placed nine exteriors with street-facing doors, hours, staffed posts, short conversations, and painted-window lighting. Each exterior adds one mesh, or up to nine visible main-pass building draw calls across the whole district, plus shadow passes where enabled. The placed geometry totals 23,322 triangles. The prior core and farm asset modules are byte-identical to the existing package.
- Built 0.36.4 locally with Dev Mode off. The public version endpoint still returned 0.36.3, and 0.36.4 returned HTTP 404. Future deployment must ship the protocol 2 game and relay together.

## Files

- Bakery and relay: `dist/bakery-client.js` (42 lines), `dist/bakery-goods.js` (32), `dist/bakery-lobby.js` (83), `dist/bakery-session.js` (141), `dist/cargo.js` (187), `dist/game.js` (2,151), `dist/gig-bridge.js` (82), `dist/multiplayer.js` (107), `dist/phone.js` (151), `dist/relay-protocol.js` (114), `worker/lobby.js` (116).
- Map and assets: `dist/cast-crowd.js` (581), `dist/credits.js` (23), `dist/downtown.js` (30), `dist/map-definition.js` (1,181), `dist/night-lights.js` (163), `dist/night-lights-rules.js` (121), `dist/props.js` (79), `dist/props-assets-downtown.js` (2 generated lines, 1,410 KiB), `dist/properties.js` (34), `scripts/build-props.mjs` (339), `ASSETS.md` (702), `assets-register.json` (90).
- New tests: `tests/bakery-coop.mjs` (79), `tests/bakery-coop-game.mjs` (114), `tests/downtown.mjs` (36). Updated fixtures and registry checks in `tests/map.mjs` (180), `tests/properties.mjs` (66), `tests/town.mjs` (75), `tests/night-lights.mjs` (194), `tests/pet-game.mjs` (82), `tests/session-clock.mjs` (126), `tests/worker-relay.mjs` (96), `tests/credits.mjs` (23).
- Index and release: `scripts/build-index.mjs` (128), `PROJECT-INDEX.md` (845), `PROJECT-BRIEF.md` (39), `dist/index.html` (61), `dist/version.json` (1), `dist/releases/0.36.4/` (278 files), `notes/handoff.md` (449), this report (44), and the three screenshots below.

## Verification

```text
PASS bakery-coop: host-only board, competing claims, cancel, pickup, host exit, single payout, replay rejection and rejoin
PASS bakery-coop-game: packaged phone accept/cancel, shared board, dock pickup and one delivery payout after host departure
Hosted relay object: create, taken code 409, hibernation restore with position and bakery claims, host departure on wake, hello timeout, empty lobby kept 10 min then forgotten, unknown codes, routing and Origin passed.
PASS downtown: 9 unique facades, sidewalk doors, staff posts and 6 converted details; 23322 placed triangles
PASS talk-cast-crowd.mjs: 29 crowd casts validated against 9 named casts (0 errors, 0 warnings), 1566 sweep contexts (6264 terminal walks, 4640 bubbles), place-aware npc-chat passed.
Packaged release 0.36.4: 278 files -> dist/releases/0.36.4
brief 2840 tokens (target 3000), index 35472 tokens (target 37000); 277 modules, 15 generated, 336 tests, 34 scripts; 13 modules without a header comment
Total Upload: 540.98 KiB / gzip: 111.86 KiB
--dry-run: exiting now.
ironwood-east [true,true]
shot ironwood-east
shot ironwood-river
shot alder-hardware
log "Alder Hardware · not open"
THREE.JS GATE: 310 of 310 passed; 26 Hub files excluded.
FAILED FILES: hub-runner.mjs
1 of 336 test files failed.
```

The final full suite ran with Windows cleanup permissions. The remaining Hub test failed twice at `tests/hub-runner.mjs:125` with `AssertionError [ERR_ASSERTION]: stopped near the 97 line: 800000`. The complete logs are `%TEMP%\eden-0364-chain-npm-test.log` and `%TEMP%\eden-0364-chain-final.log`.

Inspected [Ironwood Street](0364-ironwood-east.png), [River Street at dusk](0364-ironwood-river.png), and [Alder Hardware](0364-alder-hardware.png) in headless Windows Edge. The Edge capture used software WebGL. Confidence is high in placement, sidewalk access, and the local two-client phone and delivery flow. Hosted hibernation is covered by the Durable Object fixture. Production 0.36.4, a browser-to-browser co-op playtest, and frame times on the owner's GPU were outside this pass. The Wholesale dock apron, separate I6 signs and awnings, Diner Station View, and home cooking remain queued.

No protected-file edits were needed.
