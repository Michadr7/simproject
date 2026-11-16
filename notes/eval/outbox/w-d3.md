michadr.

# W-D3: named NPC dialogue, standing, door knock, People page, walkers use namedPlan

Not run (per the brief): npm run release, npm run index, npm test. Nothing seen in a real browser. A scratch boot of the new dist/game.js in the Node harness (synthetic DOM, copy of dist outside the repo) was run: see "What I could verify".

## Files (lines)
NEW
- dist/npc-dialogue.js 143 (pure): openTalk, talkOutcome, registerTalk, topicsFor, pagedChoices, knock, flatDoors, peopleRows, placeLabel, improveHint, metIds/isMet, createRosterPlanner (the namedPlan wrapper for walkers), rosterByPersonId.
- dist/phone-people.js 29 (UI only): the People app (list, details, back).
- tests/npc-dialogue.mjs 146.
CHANGED
- dist/npc-roster.js 118 (was 82): dialogue text only: GREETINGS (oscar, lincoln, brentster: 3 per tier x 4 tiers, all different), DEFAULT_GREETINGS (3 per tier for the rest), KNOCK_LINES, OSCAR_REFUSAL ('Leave me be.'), OSCAR_DOOR_STRANGER, CAT_STEERS (5), CAT_ANSWERS, COMMON_TOPICS, TOWN_LINES, TIPS (one per NPC). Noah's and Hal's starter dialogue untouched.
- dist/npc-life.js 197 (was 195): saved NPC field metDay (-1 = not met; a legacy save with lastTalkDay >= 0 counts as met), talk() sets it, new meet(npc, day). No other rule changed.
- dist/npc-crowd.js 66: new option planOf(personId, day) replaces schedule.planOf; new talkable(x, z, range, ids) (nothing allocated when nobody is near).
- dist/game.js (+about 20 lines, all inserted): imports; one line near the crowd (npcTown, npcSchedule, rosterPlanner, rosterPersonIds, pedRoster; planOf wired into the crowd); a W-D3 block after talkHal (npcDay, BUZZER, npcKeep, recordTalk, npcSay, topicMenu, topicRun, talkNamed, buzzerPanel, knockAt); Noah's counter and Hal's 'Talk to' wrapped with recordTalk; pedestrian loop uses talkNamed for roster pedestrians (Sophie); one candidates line for the buzzers and for pooled crowd people.
- dist/phone.js 148: People app wired (create, render on screen, reset, Back, app list). The screen loop now guards a missing section.
- dist/index.html: People app button (icon) + phoneScreen-people section. dist/style.css: 2 lines (.people-icon etc.).
- tests/store-game.mjs, tests/tickets-game.mjs, tests/delivery-game.mjs: see "A bug I found" (test robustness, not rule changes).

## 1. Dialogue (done)
- Talk prompt 'Talk to <name>' for: roster pedestrians (Sophie), pooled crowd people who are roster members (Noah outdoors, Oscar/Lincoln/Brentster when they are outside; reach 2.2 m, prompt range 1.6), Noah's counter and Hal (their own menus, now plus recordTalk: met, mood, standing).
- Flow: opening a talk = met + greeting by standing tier + the person's moodLine + topic buttons. Choosing a topic = ONE talk(npc, topic, day) + gainStanding(+1, cap +3/day). Opening and leaving is free (no talk counted).
- Topic menus: most: 'How are you doing?', 'What is new in town?', 'Any advice for me?'. Oscar: 'Just checking in.', 'Anything I can do for you?'. Brentster: cat topics + chat. Lincoln: his 7 hunting topics + 'Something else'. More than 3 choices: two topics and a 'More topics' button (the dialog has 3 buttons).
- Oscar: the 1st and 2nd talk of a day are normal; from the 3rd he says 'Leave me be.', the mood drop is npc-life's rule, no standing is earned, no further buttons.
- Lincoln: each hunting topic is three pages (Next / Skip); the effect is applied once at the choice, so Skip or walking away costs nothing more. A non-hunting answer ends with 'Which reminds me: ...' (steers back). The sulk rule is npc-life's (3 talks and none about hunting, or 3 days silent).
- Brentster: every non-cat answer is followed by a CAT_STEERS line; the cat topics ('How is Brentster Jr.?', food, vet) give his answer and the +6 mood.
- Day number used for talks: housing.day - 1 (same as the daily tick day after 05:00).

## 2. Visit door (door talk only)
- There are NO flat doors and NO flat interiors: Oak Street Apartments has one door; apartment.js is only the player's studio (Studio 2B). So I added a buzzer panel beside the studio door (position guessed: x = STUDIO.x - 2.4, z = -8.1): 'Knock on a flat door' -> Flat 2, 8 (page 1), 9, 10, 11 (page 2). Names show on the buttons only once met (Flat 9 · Oscar).
- knock() uses canVisit(id, tierFor, minute, namedPlan-plan, {sick}): stranger = 'Who is it?' and nothing (no meet); acquaintance = a talk at the door; friend = 'Come in, come in' and the talk happens in the doorway (inside: true is returned for the future); Oscar: stranger or out of 10:00-12:00 refused, inside only at 'close'; asleep / not home / sick get a line through the door.
- DECISION (please confirm): Oscar never leaves his flat (homebody), so strangers could never reach 'acquaintance' with him. During his door hours a stranger's knock gives +1 standing a day (cap +3, so 5 days of persistence), meets him and he says 'I do not know you. Go away.' through the door. Only homebodies get this. One line in knock() if you want it removed.
- LEFT for interiors: (a) a flat interior per named resident (room data + interior camera + furniture), (b) real flat doors in the building's model (the buzzer would become a door knock at each door), (c) a 'friend' inside rule (ignores the talk-at-door fallback), (d) the other residents of the building (Alex, Robert, Julia, Carlos, Megan) are not named NPCs with state, so they get no knock.
- Friends who visit the player (act 'shop' at world.playerPlace) are NOT planned or drawn: I pass no playerPlace to namedPlan, so no visit block ever reaches the crowd (a test checks 0 over 40 days x 10 people). Gap recorded, nothing guessed. To start: pass playerPlace (the player's home place string), draw the NPC on the porch for 'friend' (visitsPlayer(...).at === 'porch') or put them in the home for 'close', and make the knock decide 'not-home' while they are away.

## 3. People page (done)
- App 'People' (icon, button, section, phone-people.js): rows ONLY for people with metDay >= 0 (from progress.npcs, normalised; saved with the game): name, tier word, role, mood, last talked; tap = details: standing tier and points, mood (and 'unwell'), Lives (place + flat), Works, Last talked, 'How to get closer' (next tier and what is missing + the person's own tip). Empty state text when nobody is met.
- Met by: opening a talk, a Noah/Hal talk, or hearing Oscar through the door. An unanswered knock meets nobody.
- Not done: 'last seen' (only last talked), no badge on the icon (not a message app), the 'town news' app.

## 4. Walkers use namedPlan (done)
- createRosterPlanner wraps schedule.planOf: for roster people (by personId) it calls namedPlan(npc, schedDay-1, {seed}, basePlan): sick NPCs stay home all day, a low mood or a homebody (Oscar) drops errands. Memoised per person (number compare per call, no allocation). Others: the plain plan, same object.
- Cost: 28 planOf calls = 0.71 us per frame (plain schedule 0.37 us). npc-walk test green.
- Rain does not change walkers (no weather function is passed; not wired).

## 5. Mood effects share state (verified, nothing new)
gigs.js completeNeed does helped(p.npcs[client]) and gainStanding on progress.npcs / progress.standing; world-tick.js runWorldDay does moodTick on progress.npcs; dialogue reads and writes the same two keys. The test round-trips talk -> normalizeProgress -> runWorldDay -> helped and checks metDay and lastTalkDay survive.

## Test output (real)
```
node tests/npc-dialogue.mjs
PASS npc-dialogue: talk effects and caps, Oscar refusal, Lincoln pages and sulk, Brentster steers, met set and save round trip, People rows (unmet hidden), door-knock table, roster planner (sick stay home)
node tests/npc-life.mjs
PASS npc-life: roster, tiers, +3/day standing cap, sickness band, Oscar/Lincoln/Brentster rules, canVisit, namedPlan, visits, needs, determinism
node tests/npc-walk.mjs
PASS npc-walk: 28 people, 174 walking blocks over 4 days, {"walk":532,"stand":837,"hidden":21703} poses sampled
```
Also run and passing: starter, starter-game, jobs, gigs, gigs-game, needs-loop (PASS needs-loop: need opened day 103 (11 dozen) ... paid 6970, mood 60->64, standing 0->1), needs, world-tick, world-state, messages, phone-calls, schedule, population, neighborhood, save-file, gig-parcel, gig-clients.

## What I could verify beyond unit tests (scratch copy of dist outside the repo, the packaged-release harness pointed at it)
- 40 boot-game tests (all except the ones that read the old packaged release themselves: startup, fuel-game, and ones needing ASSETS.md) pass against the NEW dist/game.js, including phone ones: gps-game, messages-game, jobs-game, store-game, garage-game, tow-driven. ground-feel failed only because the scratch folder has no ASSETS.md.
- Scripted play: at the apartments the prompt 'Knock on a flat door' appears; Flat 9 at 11:00 as a stranger gives 'I do not know you. Go away.', standing 1, met; as friend Lincoln (flat 10, 12:00): door line + greeting + 'Deer season / Rifles and scopes / More topics', Deer season shows 3 pages with Next / Skip, Skip returns to 'Anything else?', Lincoln mood 55 -> 61, standing 25 -> 26; the phone People page then lists Lincoln with details and 'All people' goes back to the list. At 20:00 Lincoln was out ('You knock twice. Empty.').
- NOT run: the real packaged release (needs the version bump + `npm run release -- --force`), startup.mjs, the whole npm test.

## A bug I found (fixed) and two test notes
1. game.js line 135 (the NPC-WALK edit) had `// ...no more walking to and fro` and `const hal=createHal(...)` on the SAME line, so Hal was commented out and the game would throw `hal is not defined` on the first frame (node --check cannot see it; all earlier tests ran the old packaged release). I put `const hal=createHal(...)` on its own line. Please check the next release boots (the scratch boot now does).
2. W-D1/W-D2's daily tick pushes a town-news toast and message ('Brentster is under the weather and needs bread.') whenever a test jumps housing.day. That broke store-game (toast text and 'counts one unread'), tickets-game and delivery-game against the new game.js. Fixed in the tests only: they now read the saved phone message instead of the toast, and store-game also advances world.day with housing.day so the tick does not run. After the release rebuild, `npm test` should be re-run for those three.
3. Roster NPCs now appear in the map (Oscar etc. in flats 9-11): population tests changed numbers (24 residents, 4 commuters), which they handle.

## Per-frame cost
- planOf for 28 people: 0.71 us. crowd.talkable runs only from candidates() (28 entries scan, no allocation unless someone is near). Nothing else is per frame. Dialogue, knock and People page are click-time only. phone People render only when the screen is open.

## Could NOT verify
Nothing was seen in a real browser. The buzzer position (-1.4, -8.1) is a guess at where the building's front is: it sits 2.4 m left of the studio door whose prompt range is 2.8 m (the nearest prompt wins; unchecked). Whether the pooled people actually come into reach (2.2 m) and the 'Talk to' prompt shows for them is untested (needs the real crowd running). The phone grid now has 10 apps (was 9): the 4th row is unseen.

## Eye-check (8 points)
1. Stand at the left side of the Oak Street Apartments door: 'Knock on a flat door' appears (not the studio's prompt) and Flat 2/8, then 9/10/11 via 'More flats'.
2. Knock on Flat 9 as a stranger between 10:00 and 12:00: a voice says go away; knocking on any flat at night says nobody comes; on a Flat with a stranger: 'Who is it?'
3. Talk to Sophie in the street, and to a pooled person who walks by (Noah in the evening): 'Talk to <name>', a greeting, topic buttons.
4. Talk to Oscar three times in one day: the third answer is 'Leave me be.' and his mood falls. Lincoln: a topic runs three pages, Skip drops out cleanly.
5. Brentster: every topic ends on the cat.
6. Phone -> People: empty message before meeting anyone; after one talk a row shows; tap = details with the hint; Back (phone Back button) returns to the list.
7. Noah and Hal now count as met after one talk at the counter / farm; Noah's old menu is unchanged.
8. Hal is drawn again at the farm and the game starts (the commented-out createHal fix).

## MP-AVATAR (co-op) needs
- progress.npcs, progress.standing and progress.world are per save today. Co-op needs: the HOST owns NPC state (npcs, world, cat) and the guest never ticks (already so); a guest's talk must be sent to the host as {npcId, topic, day} and applied there with talkOutcome (the Oscar per-day counter and the mood are shared), while standing stays per player (OWNER ANSWER 16) and metDay per player: so metDay and standing move to a per-player record, and mood/sickUntil/talks stay world-side. The cat (Brentster Jr.) and Brentster's mood need one shared record on the host. Visible NPC positions are pure functions of (plan, game minute), so a guest only needs the host's npcs (sick flags, moods) and the day to draw the same people; the roster planner reads progress.npcs through a getter (getNpcs), so a guest can feed it the host's copy. The buzzer panel and the door decisions are per player (standing) plus shared npcs.

## Confidence
Rules and data (pure parts, tests, People rows, door table): high. game.js wiring: medium (booted and scripted in a scratch copy, never in the real packaged game or a browser). Roster text: placeholders, medium. Buzzer placement and the pooled-person prompt: low until seen.
