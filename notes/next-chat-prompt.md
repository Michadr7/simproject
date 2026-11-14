michadr. New chat, 2026-11-17 or later (after the Tuesday 08:00 weekly reset). Read notes/todo-after-reset.md FIRST, then context.md top section and its "How the user wants you to work" list, notes/streaming-brief.md, and notes/map-master.md section 8 (Grep "### 8."). Do not read big files whole.

STATE
- Package 0.35.8 (not deployed, so `npm run release -- --force` is allowed for it). npm test: 170 of 170. The user commits in the hub; ask whether the last work is committed.
- Last session built (uncommitted until the user commits): I1, I2, BZ1; the Kasumuchi S70 shortbed (V7 model with raised cab, interior, lights, doors, seated driver with hands on the wheel, cargo bed 44 planks); menu and vehicle headlight fixes; hotel props register entry; notes (damage design, collision feel, ATV prompts, to-do).
- The old ATV files were deleted on request. assets-src\Vehicles\ATV does not exist. The user will copy a new ATV (GPT Sol V5 is the best candidate) and say its file name. The register entry atv-default is stage "wanted".

NEXT, IN ORDER (ask the user for the weekly meter before each agent; ask before switching model or agent; one stage per run; stop and report after each)
1. F1 streaming on the old map (Sonnet 5.5, notes/streaming-brief.md). The user's answers are in notes/todo-after-reset.md. Then F2, F3, RU6.
2. A small S70 fix stage (Sonnet): rear cab wall is single-sided so you can see out the back; enter and exit lag (ask the user: every time or first time, day or night); canopy clearance; check hands at full lock.
3. ATV conform: run `node scripts/glb-inspect.cjs` and `glb-tree.cjs` on the user's file, then a Sonnet conform job to the contract in notes/atv-model-prompt.md.
4. C1 collision feel (notes/collision-feel.md) after F1; then the damage build VD1 to VD4 (notes/vehicle-damage-design.md, user decisions in section 12).
5. The user's smear-when-moving report: diagnostics in notes/todo-after-reset.md (ask the monitor/other-game tests first).

USAGE RULES: never reach 100% weekly; stop launching agents at about 92 to 95% (the user reads the meter; 1% is roughly 150k tokens from last week); Fable only when the user says yes; Opus is on standby for design only (every call needs a yes). Blender 5.2 headless is installed and usable from the chat.

ASK THE USER ONLY WHEN A STAGE NEEDS IT: plot prices, Ridgeline's new office, fast travel, lone sleeper in co-op, Eden products beyond Tier 5, fines and Standing, chase rules, ATV speeds and price, the damage questions not yet answered (see todo note), the 5 streaming questions are answered.

USER-SIDE WORK (do not wait on it): ATV file; Tier 5 welding parts (the Blender agent has the Tier 4 fixes; next is the jig, trailer, ATV frame per notes/welding-tier5-plan.md); hotel props are in assets-src\Hotel (registered, not converted until stages I7 to I10).

RULES THAT APPLY: own Blender models need no credit; triangle caps are soft (flag draw calls, materials, shadows); every new cargo vehicle gets a bed entry in dist/cargo.js; the user commits by hand and wants smooth push-style collisions with no big gaps (after F1).