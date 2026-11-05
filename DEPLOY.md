# Deploying City Life (Cloudflare Pages)

The game is static files in `dist/`, with no build step. Cloudflare Pages watches the GitHub repo: a push to `main` goes live in about a minute.

## One-time setup (Cloudflare dashboard)
1. Log in at dash.cloudflare.com, open **Workers & Pages**, then **Create**.
2. Pick the **Pages** tab and **Connect to Git**. If the dashboard offers a Worker first, look for the "Pages" or "Looking to deploy Pages?" link.
3. Authorise GitHub and choose this repository.
4. Build settings:
   - Production branch: `main`
   - Framework preset: `None`
   - Build command: leave empty
   - Build output directory: `dist`
   - Root directory: leave empty
5. Click **Save and Deploy**. The site appears at `https://<project-name>.pages.dev`.

Every other branch gets its own preview address (`https://<branch>.<project-name>.pages.dev`). A `testing` branch can be the testers' build while `main` stays the public one.

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
- Cloudflare Pages allows 20,000 files and 25 MiB per file. Today the site has about 1,600 files, and the largest is 4.7 MB (`props-assets.js`).
- Pages uploads only the files that changed, so the old release folders (about 170 MB) are uploaded once.

## What does not work on the hosted site yet
- **Online multiplayer:** Pages only serves files; it cannot run `server.js`. Hosted lobbies need a separate relay (Cloudflare Durable Objects or a small server). Not built yet.
- **LAN multiplayer from the hosted page:** the page is `https://`, and browsers block it from opening a plain `ws://` connection to another machine on the network. `ws://localhost` is usually allowed. LAN play works from a local copy (`npm run dev`), and later from the launcher.
- **Dev Mode:** `DEV_MODE` in `dist/dev-flag.js` decides whether testers see the Dev Mode button (free money, teleport). Set it to `false` for a public build.
- **Saves:** they live in the browser (`localStorage`) and belong to the site's address. A save on `localhost:8000` does not appear on `pages.dev`, and the reverse. Export and import of saves is planned.
