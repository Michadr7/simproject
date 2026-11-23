michadr.

# 0.36.4 public release

Deployed Eden Ridge `0.36.4` (including Protocol 2 `worker/relay.js` + `worker/lobby.js` and `./dist` static assets) to the public Cloudflare Worker on November 23, 2026 (`https://simproject.ghostjumper007.workers.dev`). Wrangler reported Worker Version ID `da8c7312-1f3b-45ca-94d1-aaabe607cb0d`.

The `0.36.4` release folder (`dist/releases/0.36.4/`, `296` files) was packaged with `--public` (`DEV_MODE=false` inside `dist/releases/0.36.4/dev-flag.js`, while keeping `dist/dev-flag.js` `true` for local dev tests). Because `0.36.4` is now deployed live under immutable caching, bump `package.json` to `0.36.5` before running the next `npm run release`.

## Verification (real outputs)
- Pre-deploy packaged checks:
  - `npm.cmd run release -- --public --force` -> `Packaged release 0.36.4: 296 files -> dist/releases/0.36.4` (`DEV_MODE=false` inside release, `DEV_MODE=true` in `dist/dev-flag.js`)
  - `node tests/update-check.mjs` -> `Update notice: ...` PASS
  - `node tests/dev.mjs` -> `Dev mode: ...` PASS
  - `node tests/startup.mjs` -> `Fresh save` & `Existing save` PASS
- Deploy:
  - `npx.cmd wrangler deploy --dry-run` -> `Read 2524 files from the assets directory`, `Total Upload: 540.99 KiB / gzip: 111.87 KiB`
  - `npx.cmd wrangler deploy` -> `Uploaded 78 files (2420 already uploaded) (1.80 sec)`, `Deployed simproject triggers (0.85 sec)`, `https://simproject.ghostjumper007.workers.dev`, `Current Version ID: da8c7312-1f3b-45ca-94d1-aaabe607cb0d`
- Post-deploy live checks:
  - `/version.json` -> `200 no-cache {"version":"0.36.4","released":"2026-11-23"}`
  - `/releases/0.36.4/dev-flag.js` -> `200 export const DEV_MODE=false;`
  - `/` -> `200 no-cache loads 0.36.4= true`
  - `node scripts/relay-smoke.mjs wss://simproject.ghostjumper007.workers.dev` -> `created lobby 5MPDAX in 541 ms`, `move relayed in 74 ms`, `Relay smoke passed at wss://simproject.ghostjumper007.workers.dev : create, join by code (any case), snapshot, move in a house room, no-lobby, update refusal, leave, game client rejoin by code.`
