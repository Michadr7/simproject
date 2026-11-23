michadr.

# 0.36.3 public release

Deployed Eden Ridge 0.36.3 directly to the public Cloudflare Worker on November 22, 2026. The previous public version was 0.36.2, and the 0.36.3 asset path returned 404 before deployment. Wrangler reported Worker version ID `9dfe8947-8817-4d7a-a501-b96f9b6682a7`.

The staging directory used the previously tested 0.36.3 package and excluded the 0.36.4 release and bakery session rules. The only edit inside the archived 0.36.3 release was disabling Dev Mode. The local browser entry point and package version remain at 0.36.4.

## Files

- `dist/releases/0.36.3/dev-flag.js` (5 lines), `notes/handoff.md` (443), and this report (30).
- Cloudflare staging used a temporary directory. No protected-file edits or Git operations were needed.

## Verification

```text
STAGED 0.36.3 PASS diner-game.mjs
STAGED 0.36.3 PASS update-check.mjs
STAGED 0.36.3 PASS rescue.mjs
STAGED 0.36.3 PASS webgpu-ground-quality.mjs
--dry-run: exiting now.
Deployed simproject triggers (0.44 sec)
  https://simproject.ghostjumper007.workers.dev
Current Version ID: 9dfe8947-8817-4d7a-a501-b96f9b6682a7
LIVE {"version":"0.36.3","released":"2026-11-22"}
PASS public entry point, update cache header, packaged game hash, Dev Mode off, and 0.36.4 asset absent
Relay smoke passed at wss://simproject.ghostjumper007.workers.dev : create, join by code (any case), snapshot, move in a house room, no-lobby, update refusal, leave, game client rejoin by code.
```

Confidence is high in the live version, asset identity, update metadata, and hosted relay. No new tests were added. This publication used targeted staged checks alongside the earlier [0.36.3 tester gate](0363-quality-diner-delivery.md). This run did not repeat the full suite or a hardware playtest.
