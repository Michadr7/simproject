michadr.

## Summary
- Created [notes/diner-design.md](notes/diner-design.md) (**182 lines**, under the 350-line cap).
- Read-only design task: no files in `dist/`, `tests/`, `scripts/`, or `notes/handoff.md` were edited, and no tests were run.

## Owner Questions (with recommended answers first)
1. **Identity — Alder Coffee vs Diner:** Expand the existing **Alder Coffee** (`shop:cafe`, Elena) into **"Alder Coffee & Diner"** (recommended), or add a separate diner building on a commercial plot (`C1–C7`)?
2. **Who hires you at the start:** **Elena hires at the counter** from minute 1 with no prerequisites (recommended), while Noah (`cast-early.js:126`) and the Phone Jobs app point you to her?
3. **Promotion pace (Waiter → Barista/Cook):** **2 shifts** (`level 2, 2 shifts, rep 15`) (recommended) to reach the espresso machine and kitchen in ~10–15 real minutes, then slower to Head Cook (5 shifts) and Shift Manager (10 shifts)?
4. **Station View depth:** **Hybrid** — 3D close-up camera + live 3D stacking parts on the counter + clean click/`1–9`/`Space`/`Enter` HUD tray (recommended), vs pure 3D drag-and-drop or a pure 2D layered card?
5. **Failed / ruined orders:** **No cash dock from wages** (recommended, matches `DESIGN.md:104`) — costs the customer tip, `-2` rep, and time/ingredients to remake, or dock wages?
6. **Tips & shift bonus balance:** **Lighter shift bonus (`$10 × rank`) + live tips (`$0.50–$3.00`)** (recommended) so speed and accuracy matter more than flat completion, or keep `shift.js` `BONUS_PER_RANK = 2500`?
7. **Uniforms (`appearance.js`):** **Optional / Rank 1–2 apron top visual while on shift** (reverted on clock-out, deferred to polish after `D-A..D-C`) (recommended), or keep the player's own clothes?
8. **Starting menu size at Rank 2 unlock:** **Tight starter menu at Rank 2** (Espresso, Americano, Latte, Iced Latte + Classic/Cheeseburger, 2 Sandwiches, Margherita/Pepperoni Pizza), unlocking Cappuccino, Hot Chocolate, Tea, Club/BLT, and Veggie Pizza at Rank 3 (recommended), or launch with the full menu?

## What I Could Not Verify
- **External CC0 asset packs & audio clips by direct inspection/ear:** Did not download, unzip, or inspect `Kenney Food Kit` (`https://kenney.nl/assets/food-kit`), `Coffee Machine` by J-Toastie on Poly Pizza, or any Freesound audio files (`assets-src/` was not opened per `PROJECT-INDEX.md:5`). Per-file licence badges (e.g., CC0 vs CC-BY on Freesound/Poly Pizza) and exact triangle counts/audio seams must be verified on each asset page at download time.
- **Exact current token count in `PROJECT-INDEX.md`:** Cited `33,032 / 34,000` from `notes/handoff.md:9` (LATER 34) and `BUDGET.index = 34000` from `scripts/build-index.mjs:16`; did not re-run `npm run index` since no code changed.
- **Interior space for rear kitchen appliances:** Verified `shops.js:11-29` (`12 × 10 m` room, counter at `z = -3.5`, Elena at `z = -4.35`), which leaves only ~`0.65 m` behind Elena before the north wall (`z = -5`); expanding the back wall or adding a kitchen alcove in `D-D` was not prototyped in 3D.

## OWNER ANSWERS 2026-11-18 (all recommended)
1 Expand Alder Coffee into 'Alder Coffee & Diner' (Elena). 2 Elena hires at the counter from minute 1. 3 Promotion: 2 shifts (Rank 2), 5 (Head Cook), 10 (Shift Manager). 4 Station View: hybrid (3D close-up + live 3D parts + click/1-9/Space/Enter tray). 5 Failed order: no wage dock; lose tip, -2 rep, remake. 6 Light shift bonus ($10 x rank) + live tips $0.50-$3.00. 7 Apron top on shift, polish after D-A..D-C. 8 Tight starter menu at Rank 2; rest at Rank 3.
