# Ironwood Arcade & Lounge — Later-Pass Design & Classic Game Shortlist

Planned follow-up stage (not yet implemented) to transform **Ironwood Arcade & Lounge** (`ironwood-arcade` in `dist/ironwood-interiors.js`) from a plain lounge with 4 placeholder box cabinets and an open sky ceiling into an authentic retro arcade with bespoke 3D models, playable mini-games, NPC challenges, and Co-Op multiplayer tables.

## 1. Visual Room & 3D Model Overhaul (replacing placeholder boxes)
- **Room architecture:** Add a dark acoustic ceiling (`#1a1526`) with recessed neon cove strips (`#47e5ff`, `#ff6ec7`) so the open sky never shows above the interior walls; replace the flat purple floor with a dark speckle-patterned retro arcade carpet texture/grid (`#221c30`); add illuminated wall posters, neon tubing signs, and a lit token/prize counter case behind Attendant Leo/desk.
- **Upright CRT Arcade Cabinets (`arcade-cabinet`):** Multi-part visual meshes featuring a curved upper CRT bezel with glowing artwork screen, illuminated overhead title marquee, angled control deck with ball-top joystick and colored push buttons, molded side panels, and coin-door detail at knee height (not plain stacked cubes).
- **Pinball Machines (`pinball-machine`):** Angled playfield cabinet on four chrome legs, clear tempered-glass top over a lit bumper/ramp playfield diorama, vertical illustrated backbox + LED score scoreboard, and plunger pull handle on the front right corner.
- **Ping-Pong Table (`ping-pong-table`):** Regulation blue/green 2-half tabletop with white perimeter lines, center seam, tensioned net mesh across the middle, trestle legs, and two resting paddles + ball.
- **Checkers Lounge Table (`checkers-table`):** Dedicated 8×8 inlaid hardwood checkerboard café/arcade table in the lounge area (`f-table` size) with stacked red/black pieces and two opposite chairs ready for solo vs NPC or Co-Op seating.

## 2. Playable Games Shortlist (Tabletop + 412-in-1 Classic Arcade Board Inspired)
Curated mix combining real tabletop multiplayer with original playable tribute games inspired by the **412-in-1 Classic Arcade Game List** (`https://www.funtimeclassicarcade.com/412-arcade-classic-game-list`, golden-age JAMMA vertical & classic arcade hits):

### Tabletop & Sports (Solo vs NPC + 2-Player Co-Op)
1. **Checkers (Lounge Table):** Full 8×8 standard American checkers rules (mandatory captures, multi-jump chains, king crowning). Play Solo vs Lounge Patron **Lena** / Attendant AI, or challenge a second joined player over Relay Protocol 2 (`relay-protocol.js`).
2. **Ping-Pong / Table Tennis:** Fast-paced Canvas 2D top-down / pseudo-3D rally game with topspin/smash timing, mouse/A-D/W-S paddle control, first to 11 (win by 2), Solo vs **Toby** (varying NPC skill) or 2-player Co-Op match sync.

### Pinball Cabinet
3. **Ironwood Pinball** *(inspired by #106 Pinball Action / classic steel-ball tables)*: Real-time 2D circle-vs-segment/bumper physics canvas with plunger charge, left/right Shift flippers, kickers, drop targets, spinner lane, multiball bonus, and persistent high-score table.

### Upright CRT Arcade Cabinets (Original Tributes Inspired by 412-in-1 Classics)
4. **Maze Muncher** *(inspired by #001 Ms. Pac-Man & #021 Pac-Man)*: 4-direction pellet maze, 4 distinct-personality chasers, power pellets & bonus fruit pickups.
5. **Star Swarm** *(inspired by #004 Galaga & #011 Galaxian)*: Wave-based dive-bombing insectoid formation shooter with twin-fighter capture/rescue risk-reward.
6. **River Hopper** *(inspired by #005 Frogger)*: Lane-timing highway + log-raft river crossings into five home alcoves.
7. **Brick Buster** *(inspired by #044 Arkanoid & #043 Super Breakout)*: Vaus-style paddle & laser/catch/multiball power capsules breaking patterned brick stages.
8. **Timber Climber** *(inspired by #007 Donkey Kong)*: Multi-tier girder & ladder climb dodging rolling barrels to reach the top platform (fits Eden Ridge's logging flavor).
9. **Stack & Serve** *(inspired by #031 BurgerTime)*: Chef platformer dropping giant burger layers down ladders while pepper-stunning kitchen pests (cross-tie with Alder Coffee & Diner).
10. **Sky Aces 1942** *(inspired by #029 1942 & #038 Time Pilot)*: Vertical-scrolling propeller fighter shmup with limited-use barrel-roll dodge.
11. **Garden Crawler** *(inspired by #033 Centipede & #034 Millipede)*: Mushroom-field rapid-blaster clearing segmented crawlers & bouncing spiders.

## 3. Economy, Social & Relationship Integration
- **Arcade Tokens:** Buy tokens at the attendant counter (`$1 = 4 tokens` / `$5 = 25 tokens`) or earn daily free plays from high social tier with Attendant / Toby.
- **Prize Tickets & Collectibles:** Every cabinet run and Ping-Pong/Checkers win pays **Prize Tickets** redeemable at the counter for apartment/house decor trophies (`f-trophy`, handheld mini-games, posters) and Energy snacks/sodas.
- **NPC Challenges & Comfort:** Challenging **Toby** (cabinet high scores / Ping-Pong) or **Lena** (Checkers) grants Hospitality/Rapport points toward `relationships.js` Friendship meters and restores **Energy** (+comfort unwind indoor boost) on par with Ironwood Cinema.
- **Persistent Leaderboards:** High scores per machine saved cleanly on `GameState.progress.arcade` (optional field with normalizer defaults, zero `SCHEMA` bump) and shared across hosted Co-Op rooms.

## 4. Planned Implementation Order
- **AR-1 (Visual Room & Models):** Dark ceiling, patterned arcade carpet texture, neon trim lighting, trophy/prize case, detailed 3D upright CRT cabinets, angled pinball machines, ping-pong table, and 8×8 checkers table in `ironwood-interiors.js`.
- **AR-2 (Pure Rules + Tabletop Solo/Co-Op):** Pure deterministic `dist/arcade-checkers.js` and `dist/arcade-pong.js` + relay message sync for 2-player tables and AI opponents.
- **AR-3 (Pinball + Core Cabinets):** Canvas 2D arcade runtime (`dist/arcade-cabinets.js` / UI overlay `#arcadeModal`) launching **Ironwood Pinball**, **Maze Muncher**, **Star Swarm**, and **River Hopper**.
- **AR-4 (Full 8-Cabinet Lineup, Tickets & NPC Challenges):** Add **Brick Buster**, **Timber Climber**, **Stack & Serve**, **Sky Aces**, and **Garden Crawler**, prize ticket redemption, persistent high scores, and Toby/Lena/Brentster challenge dialogue hooks.
