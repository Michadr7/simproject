# Warehouse timber machine: design (owner answers 2026-11-18)

One machine, three modes, in the Ridgeline warehouse. It turns logs into the "later" products named in notes/timber-redesign-design.md section 1.4: posts, beams and dowels. The player runs it; the workforce fills unmet demand if the player does not.

## Owner decisions
1. ONE machine with THREE modes (a mode selector), not three machines.
2. Dowels are made from POSTS (post -> dowels), posts and beams from LOGS.
3. Starting prices are mine (below); tune after play.
4. The workforce fills demand when the player does not. Open questions go to the owner in the dialog (AskUserQuestion, 4 at a time).

## Reference (real machines; the model is our own Blender work, own work, no credit line)
- Four-sided planer/moulder (infeed roller table, a steel cabinet with four cutter heads, outfeed table): Wood-Mizer MP360 https://woodmizer.com/us/mp360-planer-moulder ; UK HSE description https://www.hse.gov.uk/woodworking/foursided.htm (what the guards and the four heads do).
- Log lathe for round dowels/posts (a rotating log, a cutter carriage along its length): Woodlandia LL-700 https://lumbermenonline.com/Equipment-For-Sale/Woodlandia-Woodlandia-Log-Lathe-LL-700/845
- Post peeler / debarker (round a log in one pass): Posch https://www.posch.com/en/?p=24195
Model idea: a low industrial cabinet in the style of the planer/moulder (so it reads as a factory machine), an infeed roller table at the left, a chuck-and-cutter carriage on top (the lathe, for post and dowel), a visible 3-position mode selector with three lamps (POST / BEAM / DOWEL), a lever, a stop button, a chip hopper, an outfeed table. One mesh set, a shared atlas, under 1,500 triangles, parts the game animates as separate nodes: infeed rollers (spin), cutter heads/carriage (spin or slide), selector knob (3 positions), lamps (emissive), lever. Hydrogen builds it as the next own-work Blender model after the design is accepted (prompt to write then).

## The three modes
| mode | input | output | machine time (real seconds) | note |
|---|---|---|---|---|
| POST | 1 log | 1 post (round, smooth, 1.15 m) | 10 s | lathe carriage |
| BEAM | 1 log | 1 beam (squared on four sides, 1.15 m) | 12 s | four heads, no round |
| DOWEL | 1 post | 6 dowels (thin rods, 1.15 m) | 8 s | from a POST only |
Changing mode takes 1 s and is refused while a cut is running. One piece at a time, like the saw. A cut in progress finishes first and survives a save (same rule as sawmill-yard.js: time in game minutes, frame-rate independent).

## Prices (cents, PLACEHOLDERS; world-goods.js GOODS; tune after play)
Reference points: log 1,500 c, plank 900 c (4 planks per log = 3,600 c of boards), slab 1,800 c.
- post 3,000 c (a log becomes one finished post; a bit less than its boards: posts are sold as the quick option)
- beam 3,800 c (a log squared whole, slightly above its boards: the "premium" use of a log)
- dowel 700 c each (6 per post = 4,200 c per post; the chain log -> post -> dowels is the best use of a log, which pays for the extra step and the machine time)
The warehouse BUYS these through the same demand/need system as planks (orders and needs name the product); the lumberyard does not buy them raw.

## Where things come from and go
- Inputs: logs and posts come from the player's hands/bed or the warehouse racks (pallet system: dist/pallets.js); the machine has an in-tray (cap 8 logs, 8 posts) and an out-pallet (products stack on a pallet that the forklift and the existing warehouse intake already move: dist/warehouse-intake.js).
- Placement: inside or at the loading side of the warehouse; see open questions.
- Pay: a shift task "Run the machine" (rank 4 Yard hand or higher; numbers when the quest rework lands) and delivery orders for these products (plank-delivery.js style pay by price).

## Workforce rule (fills demand if the player does not)
- Demand = open needs or orders for post/beam/dowel that nobody claimed. After the grace window of 1 game day (same as the lumber needs, Q3 of the workforce answers) the crew runs the machine at the 05:00 tick: up to 2 logs a day into the product the demand names (dowels: 1 post -> 6 dowels), from the real stock only (the log deck first, then the warehouse in-tray); nothing appears from nowhere. Priya Nair (sawyer) works the machine visibly while it runs (new pose phase 'machine'); the daily crew caps stay: planks 16 + 6 trickle, so crew use of logs here is IN ADDITION to the crew's 4 logs a day only when the log deck has more than 12 logs, otherwise it takes from the sawing share.
- Player claim blocks the crew (as the plank orders do). Deterministic by (day, seed), identical on every co-op client.

## Code plan (stages, none started)
| stage | scope | who |
|---|---|---|
| M-A | pure rules: dist/timber-machine.js (modes, times, in-tray/out state v1, tick, normalize, products), prices in world-goods.js, tests | Sonnet |
| M-B | Blender model + sounds (a planer/lathe loop, start/stop; reuse the sawmill sound pattern) | Hydrogen |
| M-C | warehouse wiring: game.js prompts (feed, mode, take), pallet link, drawing the model nodes, saves (progress.timberMachine) | Opus |
| M-D | workforce rule (workforce-tick.js, workforce-pose.js phase 'machine'), orders and needs naming the products, shift task | Opus |
Index: nothing built yet; headers short.

## Owner answers to the open questions (2026-11-18)
1. Placement: INSIDE the warehouse hall (floor space next to the racks and loading door).
2. Rank: 4 Yard hand may run it.
3. Uses now: posts, beams and dowels are SOLD ONLY through orders and needs; building-material use comes with the later construction stage.
4. Chips: the machine makes CHIPS into a hopper that fills (cap placeholder 40 units, 1 unit per cut) and can be SOLD LATER: add a 'chips' good (placeholder 100 c a unit, world-goods.js) in stage M-A as data only; the sale rule comes with the wiring (M-C), the visual is the sawdust puff.

## Touchscreen use (owner decision 2026-11-18, after the pass-2 model)
The 3D screen (node Screen, material Screen_Mat, a plain 0..1 UV quad) shows a LIVE canvas texture all the time: mode, cut progress, tray counts, out-pallet counts and chip level, readable from a few metres. Pressing E at the panel eases the camera into a close-up of the screen, the cursor appears and the buttons drawn on the canvas (POST / BEAM / DOWEL, start/stop) are clicked by raycasting the quad to its UV; keys 1/2/3, Enter and Esc also work (no mouse needed). Game time keeps running (only the Escape menu pauses). Pointer (touch) works the same way. The physical E-stop and the green/red buttons are decorations plus the same actions through E. The andon stack light (Lamp_Green/Amber/Red) shows idle/cutting/blocked. Cost: one CanvasTexture redrawn only when the displayed numbers change (dirty-checked), one raycast per click.
