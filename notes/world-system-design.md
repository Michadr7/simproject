# World system design (Opus advisor, 2026-11-17; owner questions in progress)

Vision: a living world where NPCs keep routines and everything the player does changes things; gigs and jobs are ways of serving the world's needs, not a card generator. Deterministic and co-op safe (no Math.random/Date.now at runtime; derive from day number + seed + saved state).

## Facts found
- population.js builds people from MAP.seed (hashOf, population.js:27); schedule.js dayPlan(person,day) is never saved and the same for everyone; errands only while shops are open (schedule.js:28-31). Every errand visit = free demand signal.
- 1 game day = 48 real minutes (0.5 game min per real s).
- DESIGN 4.17 B-E: the world is small keyed documents, every change goes through applyWorld(action), pure rules, first to act wins. The world system must use this seam.
- CONFLICT: DESIGN 4.6 line 105 says 'NPC-shop shelves refill daily and are not saved'; living stock reverses it.

## World model (rule: goods are conserved; nothing is created by delivering)
Saved: stock[place][good] (whole units); needs[] {id,kind,place,good,person,qty,filled,openedDay,dueDay,claims}; npcs[id] {mood 0-100, sickUntil, lastTalkDay, flags} (named NPCs only, 6-8); town[region] {prosperity 0-100, history[7]}; events[] {kind,at,day,autoClearDay} (blocked roads, broken fences, stranded cars); standing (PLAYER state) progress.standing={people,regions}.
Derived: price = base x clamp(target/stock) x prosperity factor within +-25%; stock at a given minute from start-of-day stock minus the day's consumption so far; weather effects and supply routes are data.
Tick: worldTick(world,day,ctx) on day rollover 05:00; a load/sleep runs one tick per missed day capped at 14; in co-op only the authority ticks.

## Needs -> gigs/jobs
Kinds: restock, harvest, errand (NPC sick/car broken), clear (storm tree on road), repair, tend (pets.js hunger), tow (later), serve/cook. Verbs reuse: carry (gig-parcel), haul (cargo, farm-beds, G5 crates), fetch (two-leg, G-B pickup), clear (axe), tow/repair (garage.js), tend (allotments, pets.js), serve (cafe shift). Channels for ONE need: public gig (pay = gig-pay floor + need value), shift task (employer's needs, wage + piece pay), career (rank decides kinds), owned business (later). If nobody fills it by dueDay: a world actor fills it late and smaller (Hal's Tuesday egg run, weekly supply truck) or it fails (owner mood -8, price up, prosperity down, NPC errands leave empty). Filling raises stock, eases price, raises owner mood, your standing, the 7-day prosperity tally.

## NPC life
Anonymous people: schedule.js unchanged (errands = demand). Named NPCs: namedPlan(npc,day,world) wraps dayPlan: sick stays home + opens an errand need; mood < 25 skips errands; rain drops the afternoon outing; day%7 sets market day / Hal's delivery day; player actions change mood/flags only (never real-time pushing). Cast (roles UNVERIFIED): Hal (farm), Noah (market keeper), Sophie (cafe), Walt (garage/Ridgeline), Grace Whitfield, the cat; optional foreman, truck driver.

## Cheese-proofing
Conservation; a need exists once with qty (over-filling pays nothing, partial fills pro rata); hysteresis (same good+place cannot reopen until 1 day after filled); standing +3 per person per day, prosperity +-2 per day; G-A fatigue/minElapsed/min distance stay as the safety net; co-op claims via applyWorld, first act wins, shared qty paid per unit, claim lapses after 60 game min idle; sleeping creates no needs (tick once per day number).

## First slice: eggs (market low on eggs -> farm has eggs -> haul crates -> shelf refills -> Noah's mood + price change)
W-A dist/world-goods.js (~180) + dist/world-state.js (~120) + tests/world-state.mjs (pure); W-B dist/needs.js (~150) + tests; W-C dist/npc-life.js (~110) + tests; W-D game.js wiring (~120 lines: progress.world save, 05:00 tick + catch-up, crate pickup at the farm via G5 crates/cargo, drop at the market, egg count/price in the market UI, Noah's line; serial). Later: W-E gig board from needs (adapt gigs.js), W-F weather hooks, W-G shift tasks from employer needs, W-H more goods/places, W-I visible NPC routines, W-J co-op documents, W-K owned shops/hired help.
Tests: determinism by seed+day; 7 untouched days -> eggs run out, price hits cap; delivery <= farm stock; need opens once; pro-rata partial fills; no Date.now/Math.random; 20-day catch-up runs 14.
Built modules: G-A gig-pay KEEP (pay floor + fatigue); G-B gigs.js ADAPT (keep pickup/origin/pair rest/world seed/starter override, replace hashed board types with needs, retire REPEAT_PCT and EXTRA_PLACES); G-C gig-clients KEEP+ADAPT (client = named NPC/person id; 'not home' reads schedule stateAt; HAL_ID is a guess).

## Risks / unverified
Reverses DESIGN 4.6; tick cost (every person's dayPlan once a day; population size unchecked); game.js wiring serial and large; co-op authority (4.17) may not exist yet (keep W-A..C shaped as actions behind applyWorld); UNVERIFIED: weatherAt API, NPC roles, market interior/shelves, pets.js hunger fields, goods in items.js, farm/allotments built state, starter beat 8; old saves need a fresh world with default stock and a first tick that does not flood needs.

## OWNER ANSWERS (2026-11-17; * = differs from the advisor's recommendation)
1* Goods: FOOD + LUMBER + FUEL from the start (not just 3; the first build is bigger: eggs, milk, produce, plus timber/lumber and fuel stock).
2 Scope: town + Willow Farm first, then grow region by region.
3 Farm output depends on Hal (sick, unfed animals lower it).
4* Eight named NPCs with saved state (adds the Ridgeline foreman and the Eastbank truck driver).
5 Shop stock saved and runs down during the day in ALL shops (reverses DESIGN 4.6 line 105; update DESIGN.md).
6 NPCs fall sick rarely (about every 3 weeks), which opens errand needs.
7* NPC reaction: mood + dialogue + tips AND they change routines to visit you (friends drop by; needs namedPlan to read player standing/relationship).
8 Prices move at most +-25%.
9* Neglect: 'it shouldn't be just up to the player, but yes it can slowly fall': the world can decline on its own too (events, weather, supply trouble, sick NPCs), slowly; use a floor (30) so it stays recoverable (confirm at W-B).
10* Shift tasks from needs for ALL jobs: CONVERT RIDGELINE TOO (not only new jobs).
11 First career tied to the world: farmhand at Willow Farm.
12 Gig board = only real needs (can be empty).
13 Several players fill one need, split by units.
14 Unfilled need: an NPC fills it late and smaller, plus a mood hit.
15 Standing unlocks content per person (tiers).
16 Standing per player, world state shared.
17 World ticks once at 05:00, up to 14 catch-up days.
18 Subtle visibility: shelves, prices, NPC lines, phone 'Town news'; no dashboard.

## NEW NPCS (owner brainstorm 2026-11-17; all live in the Ironwood apartments for now)
- Oscar Masic: old, grumpy, wants to be left alone, hardly ever leaves his flat; owns an old black work truck (parked; possible jump-start/tow need, rare earned favour). Too much talking lowers mood; quiet help warms him.
- Lincoln Brambly: young adult hunter, always talks about hunting, LONG-WINDED dialogue; sulks if you ignore him or never talk hunting (needs mood + topic tracking; skippable, varied topics; needs: gear/ammo, game meat for the market).
- Brentster Lewis: young adult whose only care is his cat Brentster Jr. (needs: cat food, vet, missing-cat search; ties to PET1-PET3; mood follows the cat).
- VISITS (owner answer): the player gets the option to VISIT each NPC's apartment depending on the relationship (standing tier). Needs: per-person standing tiers (Q15), an invitation/knock interaction at the flat door, interior access rule per tier (stranger no, acquaintance at the door, friend inside), NPC at home per schedule.
- OWNER DECISION: EVERYONE HAS A NAME (also the anonymous population: deterministic names from population.js hashOf, never 'resident'), but the player must still KNOW WHO THEY ARE (role/home/where they work shown once met). The PHONE gets a Relations/People page: people you have met, their role, standing tier, mood word, home/work place, last seen; hidden until met. Named count: the foreman and the Eastbank truck driver become NAMED NPCs too (10 with saved state: Hal, Noah, Sophie, Walt, Grace, Oscar, Lincoln, Brentster, the foreman, the driver); the rest of the town keeps names and stateless schedules. Phone app files (phone*.js) belong to the main chat.
- Open: which flats; whether hunting is a real system; the 8-NPC count now exceeds the list (Hal, Noah, Sophie, Walt, Grace + Oscar, Lincoln, Brentster = 8, so the foreman and truck driver are NOT named NPCs unless the count is raised).
- NPC WALKING FIX asap (owner): visible NPCs ping-pong back and forth; make them follow schedule.js stateAt (doors, sidewalks, destinations, vanish indoors); find the current walker code first (not found in a quick search; probably game.js placeholder). Own stage before W-A.

## Owner questions (advisor's recommended option first)
World scope: 1 goods count (3: eggs, milk, produce); 2 scope (town + Willow Farm first); 3 can the farm change (Hal's output depends on his state).
NPC life: 4 named NPC count (6); 5 stock saved and runs out during the day, replacing 4.6 (yes); 6 NPCs get sick (rarely, about every 3 weeks); 7 NPC reaction (mood + one line + tips).
Economy: 8 price range (+-25%); 9 neglect (slow decline, prosperity floor 30).
Jobs: 10 shift tasks from needs (new jobs yes, Ridgeline keeps its tasks); 11 first new career (farmhand at Willow Farm).
Gigs: 12 board = needs only; 13 several players fill one need (split by units).
Consequences: 14 unfilled need (NPC fills late and smaller + mood hit); 15 standing unlocks content (per-person tiers).
Co-op: 16 standing per player, world shared. Pacing: 17 tick once at 05:00, cap 14 catch-up days. Tone: 18 subtle (shelves, prices, NPC lines, phone 'Town news').

## VISITORS AND OUTDOOR LIFE (owner 2026-11-16; design only, nothing built; stage NPC-VISIBLE)
Problem: by the schedule people are visible only about 2.4% of the day (walking) plus 3.6% standing (forest only), hidden 94%. The town feels empty. Fix has two parts:
1. Outdoor blocks for residents: short outdoor acts (sit on a bench, chat at a shop door, stroll the pavement, smoke outside, wait for the bus) worth about 10 to 15% of the day, drawn by npc-crowd. Needs a new act (e.g. 'outside') in schedule.js ACTS and presenceOf (stand outdoors at a place point). Pure data, no run-time cost.
2. THROUGH PEOPLE (not residents, not in population.js; a separate pure module, e.g. dist/visitors.js, with a day plan per visitor). Needs an NPC CAR SYSTEM that does not exist yet (drive blocks draw nothing): pooled vehicles from the existing vehicle models driving the real road data (map-master 6.1 roads table), no per-frame allocation, speed per visitor, one lane, they leave the map at the ends. Collisions with the player later.
 - MATT ROSSION: drives fast, no regard for safety. Flags for the police system (not built): speeding, red-light running, pulled over often. Rarely stops in Ironwood. Appears on random days at random hours, any direction.
 - JENNI CRAIN: drives through Ironwood to work 3 days a week: about 08:00 one way (west to east, assumed), and back east to west at about 15:00. Which days = OPEN (default Mon/Wed/Fri).
 - RORY DOBBINSON: homeless, loiters around the edge of town on foot all day (standing and slow wandering at the edge points, sleeps rough at night: hidden). Talkable; later a need/standing hook. Needs a 'loiter' act and a few edge place points.
 - More visitors later (owner will add).
Open: Jenni's days, which vehicle model each drives, whether visitors get names on the People page (suggest: only once met), whether Rory can be helped (food gifts) now or later.
Build order: (a) outdoor blocks (small, data), (b) visitors.js + tests (pure, plan per visitor, no drawing), (c) NPC car system + drawing (serial, game.js, big), (d) Rory as a walker via the crowd pool. Police flags stay data only until the police system exists.
- Answers 2026-11-16: Jenni works Mon/Wed/Fri, west to east at about 08:00 and back east to west at about 15:00 (yes). Matt Rossion drives the Pevrolet. Jenni drives the work truck for now. Rory can be helped by the player (yes; food gifts etc. can be built with him).
