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
- **Online multiplayer:** the Worker only serves files today; `server.js` does not run there. Hosted lobbies need the relay rebuilt as a Durable Object in this Worker. Not built yet.
- **LAN multiplayer from the hosted page:** the page is `https://`, and browsers block it from opening a plain `ws://` connection to another machine on the network. `ws://localhost` is usually allowed. LAN play works from a local copy (`npm run dev`), and later from the launcher.
- **Dev Mode:** `DEV_MODE` in `dist/dev-flag.js` decides whether testers see the Dev Mode button (free money, teleport). Set it to `false` for a public build.
- **Saves:** they live in the browser (`localStorage`) and belong to the site's address. A save on `localhost:8000` does not appear on `workers.dev`, and the reverse. Export and import of saves is planned.

## Deploying from this PC (the route that works now)
The GitHub link did not trigger builds, so deploys go from the command line:
1. `npm run release` (only if `dist/` changed), then `npm test`.
2. `npx wrangler deploy`. It uploads `dist/` to the `simproject` Worker and prints the live address.
3. Check `https://simproject.ghostjumper007.workers.dev/` shows the new version.

The first time on a PC: `npx wrangler login` (browser sign-in, one time). `wrangler` is a dev dependency (`npm install` installs it).