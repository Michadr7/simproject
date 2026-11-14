michadr. New chat, 2026-11-15 or later. Eden Ridge map planning is done; building starts now.

READ FIRST (in this order, do not read whole big files): context.md top section and the "How the user wants you to work" list; notes/map-master.md section 8 (build order, Grep "### 8."); notes/streaming-brief.md; notes/map-overview-hub.md (one page).

STATE
- Nothing is committed or deployed from the last session. Built but uncommitted: I1 (Ironwood display rename), I2 (street trees and square planters removed, three benches moved), BZ1 (Ridgeline office and warehouse interior origins now (420, 0.165, 1500) and (440, 0.165, 1500)), plus test message fixes, the asset register entries (eden-signs, weld-shop-props), notes/, scripts/glb-inspect.cjs and scripts/glb-tree.cjs.
- npm test: 168 of 169. The one red file is tests/real-models.mjs ("15 street trees as models: 24 !== 15"): it runs the packaged release 0.35.7, which is older than the source. It goes green after a version bump to 0.35.8 and `npm run release` (no --force: 0.35.7 may be live).
- The user says the planks bug is fixed (not verified by Claude).

NEXT STEPS, in order (ask before switching model or agent; name the model per stage; stop and report after each stage)
1. Haiku: bump package.json to 0.35.8, `npm run release`, `npm test` (expect 169 of 169). The user commits by hand and deploys.
2. Sonnet: stage F1 (streaming on the old map) from notes/streaming-brief.md. It is the riskiest stage. Then F2, F3, RU6.
3. Then phase P2 of notes/map-master.md section 8.1.

USAGE
Weekly limit resets Tuesday 08:00. Last reading 86% on 2026-11-14, Fable 67%. Never reach 100% weekly: stop launching agents at about 92 to 95%. Opus design runs cost about 60 to 80k tokens each; Sonnet build stages about 50 to 110k. Fable only if the user says yes, stage by stage.

ASK THE USER ONLY WHEN A STAGE NEEDS IT (the user said "ask me later, when needed in a pass")
Ridgeline's new office (own building or a room in the warehouse); plot prices; fast travel; lone sleeper in co-op; Eden products beyond Tier 5; fines and Standing numbers; chase end rules and police vehicles; ATV speeds and price per model; the 5 streaming questions at the end of notes/streaming-brief.md.

USER-SIDE WORK (do not wait on it)
- Hotel props (counter, bell, key rack, suitcase) from DeepSeek: the user will copy them to assets-src\Hotel; then add a register entry (licence "Own work", no credit) like eden-signs.
- Weldingv3.glb in assets-src\Factory: manifests are missing; mannequin is not on the game's rig. Ignore until Eden Industries is built.
- ATV (default) from DeepSeek flash; Tier 5 welding parts (utility trailer and jig first) from Sonnet 5.5 / Sol 6.1.

RULES THAT APPLY
Own Blender models need no credit. Triangle caps are soft; flag draw calls, materials, shadows. Check .glb files with `node scripts/glb-inspect.cjs file.glb` and `node scripts/glb-tree.cjs file.glb`. Design notes: notes/crime-system-design.md, atv-handling-design.md, water-design.md, welding-job-brief.md, welding-reconcile.md, welding-tier5-plan.md.