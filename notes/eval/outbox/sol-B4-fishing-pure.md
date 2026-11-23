michadr.

Completed and wired **B4 Fishing** across pure gameplay rules, unit/persistence tests, save normalization, and live `dist/game.js` shore/pier interaction.

### Files Created or Changed

- `dist/fishing.js` (`179` lines): pure `B4` state machine (`FISHING_SKILL`, `FISHING_LOG_LIMIT` `30`, `FISHING_TIMING`, `FISHING_SPECIES`, `FISHING_CATCH_TABLES` for `blackstone-lake`, `stream-mouth`, `outflow-weir`, `kaspian-bay`, `isFishingPeak`, `fishingWaterFor`, `castFishing`, `hookFishing`, `cancelFishing`, `stepFishing`, `recordFishingCatch`, plus added `normalizeFishingLog`).
- `tests/fishing.mjs` (`82` lines, new): verifies dawn/dusk peak wrap, `fishingWaterFor` against `fishingAt(x, z)`, cast validation/modifiers, `early-hook` / `missed-bite` / `cancelFishing`, determinism and `30` / `60` / `144 Hz` frame-rate independence across full catch loops, `line-broke` / `fish-escaped` bounds, Kaspian species pool, and `fishingLog` save normalization.
- `dist/jobs.js` (`87` lines): persists optional `fishingLog` array via `normalizeFishingLog` in `normalizeProgressWith` without bumping `SCHEMA`.
- `dist/game.js` (`2467` lines):
  - Imports `fishingAt` (`./map-definition.js`) and `B4` APIs (`./fishing.js`), adds `normalizeInventory` import.
  - Offers `fish-cast` in `interactables()` wherever `fishingAt(x, z)` maps to `blackstone-lake` or `kaspian-bay`, consuming `bait-pack` (`worms`) or reusing `lure-set` (`lure`) if player holds `fishing-rod`.
  - Handles `Escape` (cancel line) and `KeyE` (hook on `bite` / hold to reel during `reeling`) in `keydown`, steps physics in `updateFishing(step)` inside `stepWorld(step)`, renders wait/bite/tension progress in `updateRing()` (`#workProgress`), and awards `fishing` XP + `fishingLog` entry on catch.

### Verification

- Focused test output (`node tests/fishing.mjs`):
  ```text
  PASS fishing: B4 rules, 7 species, 30/60/144 Hz reel stability, snap/escape gates, and persistent catch log (30 cap)
  ```
- Rebuilt index (`36752 / 37000` tokens) and `0.36.4` release (`289 files -> dist/releases/0.36.4`).

### Not Verified Directly Here

- Interactive timing feel of bite ping and reel tension bar in a live 3D session by `blackstone-lake` / `kaspian-pier` (queued in browser check / owner playtest).

### Confidence

- **High:** `dist/fishing.js` rules, deterministic seeded state transitions, 30/60/144 Hz integration, and `jobs.js` save persistence.
- **Medium-High:** HUD/input feel in `dist/game.js` pending live browser walkthrough.
