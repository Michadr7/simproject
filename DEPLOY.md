# Deploying City Life (Cloudflare Worker, static assets)

The game is static files in `dist/`, with no build step. A Cloudflare **Worker** named `simproject` serves them (`wrangler.jsonc` at the repo root: `assets.directory` is `./dist`). It is connected to the GitHub repo, so a push to `main` deploys in about a minute. The hosted multiplayer relay will be added to the same Worker later (Durable Objects).

## One-time setup (Cloudflare dashboard, Workers & Pages > simproject)
1. **Settings > Build:** connect the Git repository `Michadr7/simproject` if it is not connected yet.
   - Branch: `main`
   - Build command: empty
   - Deploy command: `npx wrangler deploy` (the default)
   - Root directory: `/`
2. **Domains:** turn on the **Production** `workers.dev` switch. The game is then at `https://simproject.ghostjumper007.workers.dev`. Turn on **Preview** too if you want a link per branch (for example a `testing` branch for testers).
3. **Deployments:** after a push, the newest build should show there as successful. If it failed, its log says why.

## Every release
1. Bump `version` in `package.json` (for example 0.34.0 to 0.35.0).
2. `npm run release` writes `dist/releases/<version>/` and points `dist/index.html` at it.
3. `npm test`.
4. Commit everything, including the new `dist/releases/<version>/` folder, and push.

**Never `--force` a version that has been deployed.** Release folders are cached by browsers for a year (`dist/_headers`), so a changed file under an old version number never reaches players. `--force` is only for a version that was never pushed.

## What the headers do (`dist/_headers`)
- `/` and `/index.html` are never cached: a reload always finds the newest release.
- `/releases/*` are cached forever: each version's files never change.

## Limits and costs
- Cloudflare static assets allow 20,000 files on the free plan and 25 MiB per file. Today the site has about 1,600 files, and the largest is 4.7 MB (`props-assets.js`).
- Only changed files are uploaded, so the old release folders (about 170 MB) are uploaded once.

## What does not work on the hosted site yet
- **LAN multiplayer from the hosted page:** the page is `https://`, and browsers block it from opening a plain `ws://` connection to another machine on the network. `ws://localhost` is usually allowed. LAN play works from a local copy (`npm run dev`), and later from the launcher.
- **Dev Mode:** `DEV_MODE` in `dist/dev-flag.js` decides whether testers see the Dev Mode button (free money, teleport). Set it to `false` for a public build.
- **Saves:** they live in the browser (`localStorage`) and belong to the site's address. A save on `localhost:8000` does not appear on `workers.dev`, and the reverse. Export and import of saves is planned.

## Deploying from this PC (the route that works now)
The GitHub link did not trigger builds, so deploys go from the command line:
1. `npm run release` (only if `dist/` changed), then `npm test`.
2. `npx wrangler deploy`. It uploads `dist/` to the `simproject` Worker and prints the live address.
3. Check `https://simproject.ghostjumper007.workers.dev/` shows the new version.

The first time on a PC: `npx wrangler login` (browser sign-in, one time). `wrangler` is a dev dependency (`npm install` installs it).

## Update notice (0.34.1)
- `npm run release` also writes `dist/version.json` (the newest version; never cached) and `dist/version.js` (each release's own number).
- A running game asks for `version.json` 2.5 s after loading and every 10 minutes. A newer version shows the banner (Reload saves first, then reloads). So deploying a new version is all it takes to notify players.
- Do not edit `version.json` or `version.js` by hand.

## Hosted relay (0.34.2, worker/)
- `worker/relay.js` is the Worker's script (`main` in `wrangler.jsonc`); the logic is in `worker/lobby.js`. Files are still served first: the script runs only for paths no file matches, and answers only `/relay/new` (create a lobby and join it) and `/relay/<CODE>` (join). Each lobby is one SQLite-backed Durable Object (`LOBBY` binding, class `Lobby`, migration tag `v1`). The first deploy with it creates the class.
- Try it locally: `npx wrangler dev` (serves the site and the relay at http://127.0.0.1:8787), then `node scripts/relay-smoke.mjs ws://127.0.0.1:8787`. After a deploy: `node scripts/relay-smoke.mjs wss://simproject.ghostjumper007.workers.dev`.
- Only this site and `localhost` pages may open a relay socket (Origin check).
- Costs on the free plan: incoming WebSocket messages count as one request per 20; the game sends up to 20 positions a second while moving, so about 3,600 requests per hour of walking per player, against 100,000 a day. An idle lobby hibernates (no time billed). An empty lobby is forgotten after 10 minutes.
- Bump `PROTOCOL` in `dist/relay-protocol.js` whenever the messages change shape: older open tabs are then refused with `update`.
