michadr.

# W-C report: NPC roster and life rules (pure, no existing file edited)

Files created: dist/npc-roster.js (80 lines), dist/npc-life.js (195 lines), tests/npc-life.mjs (126 lines). Nothing else touched. Did not run release, index or npm test (per lane rules); PROJECT-INDEX.md does not list the two new files yet (needs `npm run index`).

Test output (node tests/npc-life.mjs):
PASS npc-life: roster, tiers, +3/day standing cap, sickness band, Oscar/Lincoln/Brentster rules, canVisit, namedPlan, visits, needs, determinism

## Verified in the code
- Hal Brennan: owner of property:farm-house, post 'farm' (Farmer, 390-1050). population id farm-house#1. (gig-clients HAL_ID='hal' matches my short id.)
- Noah: resident of oak-apartments flat 8 (id oak-apartments/8#1), post market-day, Clerk at shop:market 420-870.
- Sophie: oak-apartments flat 2 (oak-apartments/2#1), NO post (at-home or out-of-town schedule). starter.js has her groceries going to "18 Oak Street" (not the same place as her flat; unreconciled).
- Walt Hargrove: Ridgeline owner, post ridgeline-owner at office:ridgeline-office. Named but not a resident, so population.js makes him a commuter (id commuter:ridgeline-owner, home away:<exit>); roster home=null, not visitable.
- Grace Whitfield: owner of property:house-r8 (8 Cedar Loop), id house-r8#1, no post.
- No existing dialogue files for these NPCs besides Hal/Noah/Walt lines in starter.js and Noah's marketMenu in game.js.
## Assumed / not in the map
- Foreman: only a career rank 'foreman' exists (map-definition employers), no person. ASSUMED NPC 'Gus Taggart', id foreman, commuter, work zone:forest.
- Eastbank truck driver: does not exist. ASSUMED 'Ray Okonkwo', id driver, work office:ridgeline-warehouse, commuter.
- Ironwood apartments do NOT exist: the only dwelling is oak-apartments (units 9, 8 named residents, flat 9 generated). Oscar, Lincoln, Brentster are ASSUMED in dwelling:ironwood-apartments flats 1-3 (ids ironwood-apartments/N). Their personIds are not real. The map needs a new dwelling (or flats added) before they appear; tests use real residents as stand-ins for plan shape.

## Exports
npc-roster.js: MOOD_WORDS, NEED_KINDS, HUNTING_TOPICS, ROSTER, ROSTER_ORDER, byId. Each entry: id, personId, name, role, home, work, flat, assumed, traits, baseline, deliveryDay, marketDay, needs, needGoods, lines{word:[3]}, visit{atDoor,inside,doorHours,every}, rule (recluse|hunter|catowner|null), homebody, topics (Lincoln only: 7 topics, 3 lines each, placeholders).
npc-life.js: constants (TIERS, STANDING_THRESHOLDS 0/5/20/50, STANDING_DAILY_CAP=3, MOOD_DRIFT=5, SICK_EVERY_DAYS=21 and others), normalizeStanding, tierOfStanding, tierRank, standingOf, tierFor, gainStanding, newNpc, normalizeNpcs, moodWord, moodLine, isSick, sickToday, sickLength, applySickness, moodTick, talk, helped, canVisit, visitsPlayer, dayRole, namedPlan, needsFor.

## Design notes / deviations
- Saved npc shape adds id, talkDay, talksToday to the spec's fields (needed for Oscar's talks-per-day rule).
- Sickness: "never two NPCs the same day" is enforced for sickness STARTS (sickToday returns one id or null). Illnesses last 1-3 days so two can overlap in time. Measured start rate ~0.038 per NPC-day (slightly under 1/21 because collisions pick one). moodTick applies sickness itself (applySickness), so W-D only calls moodTick once per NPC per tick day.
- canVisit(npcId,tier,minute,plan,{sick}): allowed=atDoor||inside; atDoor = they talk at the door (acquaintance+); inside = player may enter (friend+, Oscar close). Reasons: stranger, asleep, not-home, door-closed, no-home-in-town, no-plan, unknown, sick, door-only, welcome.
- namedPlan(npc,day,world,basePlan), world={seed, weather(day), standing | tier, playerPlace, trip(from,to), marketPlace}. A friend's visit to the player is a block act 'shop' at world.playerPlace (ACTS has no 'visit'): W-D must treat a 'shop' block whose place===playerPlace as a visit (porch for friend, inside for close via visitsPlayer(...).at). Hal's delivery day is day%7===2: a 'work' block at shop:market. Sick: all-day home/sleep. Mood<25 or homebody (Oscar): errands dropped. Rain/storm/snow: errands starting 12:00 or later dropped. Errands at the person's own workplace (no travel) are not dropped.
- Lincoln sulks (flag 'sulking') when 3+ days since lastTalkDay, or 3+ talks and none about hunting; any hunting topic clears it.

## What W-D (game.js wiring) needs
1. Save: progress.npcs = normalizeNpcs(saved) on load; progress.standing = normalizeStanding(saved) (key .people). Persist both.
2. 05:00 tick: for each roster id, npcs[id]=moodTick(npcs[id],day,{seed:MAP.seed,catMood}) (catMood from pets.js moodOf for Brentster; missed days up to 14 in a loop).
3. Dialogue: on talk, npcs[id]=talk(npcs[id],topicId,day); standing=gainStanding(standing,id,1,day); pick a line with moodLine(npc,day,seed); Lincoln's topic menu comes from byId('lincoln').topics (skippable). After a filled need call helped().
4. Door/visit: on E at a flat door call canVisit(id,tierFor(standing,id),minuteOfDay,plan,{sick:isSick(npc,day)}); plan = namedPlan(npc,day,world,dayPlan(person,day)). Needs a map dwelling 'ironwood-apartments' (3 flats) plus interiors, or move the three NPCs into a real dwelling.
5. NPC walkers/phone People page: use namedPlan instead of dayPlan for roster people (match by personId). Phone page shows role/home/work (roster), tierFor, moodWord.
6. World system: needsFor(npc,day,{seed,tier,cat}) gives need seeds {kind,good,place,person,qty,dueDay,reason}.
7. Hal's id is 'hal' (matches gig-clients HAL_ID).

## Confidence
- Rules/data/tests: high (126-line test passes, covers determinism, boundaries, cap, band, rules, plans over 60 days x 10 NPCs).
- Roster text, need goods and numeric tuning: placeholders, medium. Real-schedule integration for the assumed NPCs: untested (they are not in the map). Not verified in a browser.