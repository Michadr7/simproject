michadr.

Executed the chained 1–5 pipeline across 4 parallel Wave 1 subagents (`I6`, `BZ3`/`BZ7`, `E-I3`/`WJ`, `B5`) followed by Lead Wave 2 integration (`E-I2` yard batching, save persistence, open interiors/prompts in `dist/game.js`), `PROJECT-INDEX.md`, `0.36.4` rebuild, and full `350`-test suite verification.

### Wave 1 Workers (Parallel Disjoint Scopes)

1. **`I6` Awnings (`4f3ab8ba-ffdd-4d0e-a73e-c361ae583c31`):**
   - [dist/downtown.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/downtown.js) (`84` lines) & [tests/downtown.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/downtown.mjs) (`45` lines): mounted all 9 `DOWNTOWN_LANDMARKS` awnings + 5 `LEGACY_FRONTS` awnings into `DOWNTOWN_DETAILS` (`18` total details including 4 parasols, all verified on `SURFACE.PAVEMENT`).
2. **`BZ3` Freight Exchange & `BZ7` Harbor Gigs (`65fdfb17-9b5c-484c-b7ad-b4170d410a2c`):**
   - [dist/freight.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/freight.js) (`241` lines, new) & [tests/freight.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/freight.mjs) (`199` lines, new): `FREIGHT_HUBS` (`6` hubs), `freightOffers(day)` (`4` contracts/day, `BRUCE_FEE_RATE = 0.12`), load/deliver `FREIGHT_REACH = 14`, `HARBOR_GIGS` (`ferry-deckhand`, dawn `fish-porter` `[300, 720]`, `boat-recovery`, `bay-tour`, `container-spotter`), and `normalizeFreight`.
3. **`E-I3` Shipping & `WJ` Welding Shifts (`f168bccc-c401-4481-ad90-9e8e72c3f5f`):**
   - [dist/weld-core.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/weld-core.js) (`319` lines) & [tests/weld-core.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/weld-core.mjs) (`199` lines): added `EDEN_HOURS`, `WELD_JOBS` (`bracket-t1`..`atv-frame-t5`), `SHIPPING_TASKS` (`load-steel`, `check-manifest`), real `seamPath`/`weldSampler`-backed `scoreWeldPass`, `startWeldJob`, `completeShippingTask`, and `normalizeEdenWork`.
4. **`B5` Wildlife & Hunting (`8c8afdfa-6ede-4569-9f56-3ff5aef8ee71`):**
   - [dist/wildlife.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/wildlife.js) (`147` lines, new) & [tests/wildlife.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/wildlife.mjs) (`114` lines, new): `WILDLIFE_MAX = 12`, `DAILY_BAG_LIMIT = 3`, `WILDLIFE_SPECIES` (`rabbit`, `turkey`, `deer`, `elk`), `rollChunkWildlife`, `canHuntAt`, `harvestAnimal`, `sellHuntHaul`, and `normalizeHunting`.

### Wave 2 Integration (`dist/` + `tests/` + `notes/`)

- [dist/world.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/world.js#L491-L504) (`705` lines) & [tests/regions.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/regions.mjs) (`36` lines): added `E-I2` instanced Eden stockyard/loading-yard props (`prop.pallet-crate`, `prop.crate-large`, `prop.pallet-medium-boxes` — `3` draw calls total + colliders).
- [dist/jobs.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/jobs.js#L13-L77) (`93` lines): persisted optional `freight`, `edenWork`, and `hunting` fields in `normalizeProgressWith` (zero `SCHEMA` bump).
- [dist/map-definition.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/map-definition.js#L336-L347) (`1244` lines), [dist/downtown-rooms.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/downtown-rooms.js#L79) (`86` lines), [dist/ironwood-interiors.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/ironwood-interiors.js#L31-L268) (`268` lines), [tests/properties.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/properties.mjs#L20) (`68` lines): opened `kaspian-harbor` (`05:00–20:00`) and `eden-hall-a` (`06:00–18:00`) with full interiors, staff NPCs (`Harbor Pilot Quinn`, `Master Welder Ray`), Harbor/Welding services, Freight Board (`eastbank-gas-kiosk`, `kaspian-harbor`, `eden-hall-a`), and `sell-hunt` buy-back (`eden-outdoors`).
- [dist/game.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/game.js#L82-L1506) (`2513` lines): wired paginated Freight Exchange dialog, Harbor Gig step flow, Hall A Welding Station & shipping dock payouts, outdoor `BZ3` hub pickup/delivery prompts, outdoor `B5` Blackstone wildlife tracking/harvest, `eden-outdoors` hunt haul buy-back, and regional location subtitles.
- [notes/handoff.md](file:///c:/Users/Michael/Documents/Projects/simproject/notes/handoff.md#L6-L7) (`455` lines): updated `0.36.4` release status & pipeline next steps.

### Verification

- `npm.cmd run index`:
  ```text
  brief 2840 tokens (target 3000), index 36954 tokens (target 37000); 290 modules, 15 generated, 350 tests, 34 scripts; 13 modules without a header comment
  ```
- `npm.cmd run release -- --force`:
  ```text
  Packaged release 0.36.4: 291 files -> dist/releases/0.36.4
  dist/index.html now loads releases/0.36.4/
  ```
- `node` save round-trip check:
  ```text
  PASS jobs.js roundtrip: freight + harborGig + edenWork + hunting preserved
  ```
- `npm.cmd test`:
  ```text
  ALL 350 PASSED (some only on retry)
  PASSED ON RETRY (flaky, still counted as passed): hub-runner.mjs
  All 350 test files passed.
  ```

### Could Not Verify Here

- Live Chrome/WebGPU verification (`browser` subagent `8e376e36-7dd2-4d78-acce-6e594591ac34`): blocked because Chrome remote debugging (`chrome://inspect/#remote-debugging`) is not enabled (`C:\Users\Michael\AppData\Local\Google\Chrome\User Data\DevToolsActivePort` missing). Temporary `localhost:8001` dev server (`task-1434`) was stopped cleanly.
- Owner hardware GPU frame times and live in-browser visuals across lobbies, storefronts/awnings, and P4/P5 regions.

### Notes / Constraints

- `PROJECT-INDEX.md` is at `36954 / 37000` (`46` tokens headroom remaining) — future new modules will need header/index trimming per `AGENTS.md`.
