# Welding job brief vs the master map (Eden Industries section 5)

2026-11-14. The owner's welding brief (pasted in chat, not yet saved in the repo) is the source for the welder job. Section 5 of notes/map-master.md only held a one-line placeholder for it ("hold a button and follow a seam line"). Where they differ, the brief wins.

## Replaced by the brief
- The welder mini-game: first-person, mouse moves the torch tip, left button holds the arc; scored on line accuracy, travel speed and dwell; poor welds lower the score but do not block completion; pay at shift end; leaving forfeits the task.
- Job flow: time clock, task board (E), tickets, stock work and customer orders, company inventory and a finished-parts rack, modelled on the logging job ("previous company rules").
- Progression: tiers 1 to 4 (flat seams in 1 to 3, vertical work and staged products in 4).

## Conflicts to settle
1. Products. Brief: Tier 4 products are fan housing, table legs, picture/window/gate frames, steel drum, mailbox stand. Section 5: ATV frames, utility trailers, truck bodies, tools and machined parts. Proposal: the seven brief products are Tier 4; the vehicle-scale products (ATV frames, trailers, truck bodies) become a later tier 5 that needs big jigs and parts supplied by laser and CNC. The brief's rule stands: use the previous company rules for products, no new ones.
2. Where and when. Section 5 puts welding in Hall A at Eden Industries, which comes late (needs the map growth). The brief is independent of the map. Proposal: build the welding job first in a small shop on the current map (Eastbank), then move its props into Hall A when Eden Industries is built.
3. Assets. Already modelled by the owner: welder, weld table, task board, time clock, parts rack, steel rack, helmet, wire spool, extinguisher, gas cylinder, supply cart, scrap bin, first-person torch and glove, tier 1 to 4 parts. Remove "welding bay with screen" and most "steel rack and coil" from the section 5 list of assets still to model. Still to model: hall kit, office, gantry crane, laser cutter, CNC machine, Eden logo, trailer and truck-body props.
4. Budgets. The task board has 32 primitives against a cap of 30: merge materials or use one atlas. Other props within cap (checked by the owner in Python only). First-person welding is an interior-style view: one at a time, so no outdoor cost.
5. Axes. Blender Z up, front -Y; game point (x, z, -y), normals converted too. The ATV Blender contract already says nose -Y (consistent). The Eden sign prompt wrote glTF-style axes (+Y up, +Z forward): in Blender use front -Y and export Y up.
6. Not done: the 7 other Eden jobs need briefs of this kind; the welding brief is not merged into DESIGN.md and its WELDING_*.md files are not in this repo.