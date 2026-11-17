michadr.

# Conversation design: real talks with every person in Eden Ridge

Design note (Opus 5.5, 2026-11-17). Nothing is built yet. Sources: the Gemini audit `notes/eval/reviews/npc-dialogue-audit.md`, plus my own spot checks of `dist/npc-dialogue.js`, `npc-roster.js`, `npc-life.js`, `npc-chat.js`, `starter.js` (halTalk), `game.js` (talk functions, read by line range), `index.html` #dialog, `scripts/package-release.mjs` and the tests. game.js line numbers below are from today (another agent was editing it, so they move; the audit's numbers are already about 9 lines out of date).

## 1. What is wrong today

- **Lines are glued fragments with no clock.** `openTalk` returns `greet + ' ' + moodLine(...)` (npc-dialogue.js:44) and gets no minute at all. I reproduced the owner's example with node: `openTalk({}, 'lincoln', 1, MAP.seed)` gives "Hey! Do you hunt? You look like you could hunt. Morning. Cold enough for a hunt." on days 1 and 2, at any hour. Day 0 gives two greetings in a row ("Hi. Are you here about the woods? Hey. Did I tell you about the deer last week?"). `moodLine` hashes only (seed, id, day) (npc-life.js:69), so "How are you doing?" repeats the opening line word for word all day.
- **Topics are not conversations.** Each topic is one canned line (or 3 pages for Lincoln) and then "Anything else?". Nothing branches, nothing is remembered except a count, and the 21 social topics change only mood and standing. The audit's "100% dead ends" is correct.
- **People do not know what you did with them.** Greetings follow the standing tier only. Walt greets a worker he hired as a stranger in the street, Elena on the street is a crowd stranger ("Hi. I'm Elena." via talkCrowd, game.js:903), and Sophie never mentions the groceries from story beat 1. **Audit correction:** the audit blames Walt's case on ownerMenu not calling registerTalk. That is only part of it. registerTalk adds +1 standing, and the tier needs 5 points, so Walt would still say "Do I know you?" for days. The real cause is that greetings ignore job, story and gig state.
- **Six separate entry points and a 3-button UI.** There are talkHal, talkNamed, marketMenu, ownerMenu, managerMenu and talkCrowd, plus a separate pedestrian prompt (game.js:674). The pedestrian prompt is skipped only for roster names (`!pedRoster.has`, :675), so Alex, Robert, Julia, Carlos and Megan (who are also population people, which I checked with node) can get two different talks. #dialog has 3 buttons plus Close (index.html:12). It overwrites `#dialogText` every reply with no history, and every frame it is re-placed at the speaker's head by raw screen projection, with an `offsetHeight` read and no smoothing (game.js:910). That per-frame placement is my best guess for the "stutter" the owner sees. I have not verified it in a browser.
- **Facts contradict the world.** Population gives Lincoln the `market-evening` Clerk post and Brentster the `alder-store` Shopkeeper post (I checked with node), but their roster says "Young hunter" / no job, and the People page says "No regular job". Hal calls his Shortbed a "flatbed". Gus Taggart and Ray Okonkwo have roster entries but no post and no body. Crowd lines say "I work as Yard hand at ridgeline." (npc-chat.js:12). **Audit correction:** "talkCrowd does not pass weather" is true, but there is no weather system yet (game.js:139: every day is `NPC_WEATHER_WORD`), so passing it would change nothing today.

## 2. The design

### 2a. The conversation model: pure data and pure functions

A person is a **cast entry**: facts plus a small graph of **nodes**. A node holds what the person says, the player's replies, conditions and effects. The engine never joins two authored strings: it picks ONE whole variant, and a variant may be 1 to 3 bubbles written together as a unit. "Glued fragments" therefore cannot happen by construction.

Example node (Noah; the content is only an illustration):
```js
{id:'noah.open', topic:'chat', when:{place:'counter'},
 say:[{if:{period:'morning',met:false}, t:['Morning! You must be new. I am Noah.','I keep this counter, and the shelves, more or less.']},
      {if:{period:['evening','night'],tierMin:'acquaintance'}, t:'Late shop again? Doors shut at ten, so be quick.'},
      {if:{gig:'need-restock',gigClient:'noah'}, t:'Is that my egg run? Hal\'s crates go on the left shelf.'}],
 replies:[{label:'Any work going?',go:'noah.work'},{label:'What is on the shelves?',go:'noah.shelves'},{label:'Can I look around?',act:'openStore'}],
 do:[{meet:true}]}
```
(the free "See you" reply is added by the engine to every node; authors never write it.)

**Conditions** (a closed list that the validator checks): `period` (morning/afternoon/evening/night from the minute), `hour:[from,to)`, `weather` (default 'clear' until weather exists), `place` (counter, street, door, doorway, farm, office, cafe), `met`, `tierMin/tierMax`, `mood` band, `story:[fromStep,toStep]` or `storyDone`, `gig` / `gigClient` (the active gig's type and client), `hired:'ridgeline'`, `rankMin`, `cafe:'employed'|'onShift'`, `beat`/`notBeat` (the conversation's own memory flags), `seen:{node,min|max}`, `daysSince` (since the last talk), `recent` (events from the last in-game day: 'delivered:sophie', 'egg-run', 'promoted', 'slept-rough' and so on, which game.js passes as a short list).

**Selection.** The engine keeps the variants whose `if` passes, then removes the ones in the person's `last` memory (the last 6 line keys), then picks by `hash(seed, who, nodeId, day, talkCount)`. If every variant was used recently, it takes the least recent one. Most specific first: a variant with more conditions beats a generic one (an author can set `w:` weights to override). So the gig line wins over a plain greeting while the gig is active.

**Effects** (`do` on nodes, replies and variants): `meet`, `standing:+1` (still through gainStanding with its +3/day cap), `mood:+n`, `beat:'sophie.thanked'`, `topic:'deer'` (feeds the old npc-life mood rules unchanged), and `act:'<id>'`. An act is a NAME that game.js maps to the existing function (`openStore`, `gigBoard`, `shelves`, `hal.groceries`, `hal.buy`, `walt.hire`, `walt.promote`, `walt.collect`, `cafe.hire`, `cafe.clockin`, `cafe.clockout`, `cafe.meal`, `job.pickup`, `job.deliver`, `skipStory`). The engine stays pure and the menus become ordinary nodes, so the shop/office/cafe menus and the social talk are ONE conversation.

**New pure modules (no DOM, no three.js, no clock, no chance):**
- `dist/talk-engine.js`
  - `talkContext(progress, who, env)` takes `env={day, minute, weather, place, seed, recent}` and returns a flat `ctx` (tier, mood band, story step, gig, career, cafe, beats, seen).
  - `openConversation(cast, who, ctx, mem)` returns `{session, lines:[{who,text}], replies:[{id,label}]}`.
  - `chooseReply(session, cast, replyId, ctx, mem)` returns `{session, lines, replies, effects:[...], ended}`.
  - `remember(mem, session)` returns the new mem (the line keys said, the nodes seen, the beats set, `lastMin`).
  - `lineKey(text)` is a short base-36 hash of the text.
- `dist/talk-memory.js`: `normalizeTalkMem(raw)`, `migrateTalkMem(npc, progress, who)` and `normalizeTalkPeople(raw)` (see 2f).
- `dist/talk-validate.js`: `validateCast(cast, {acts, conditions})` returns a list of problems (see 2d).
- `dist/barks.js`: `barkFor(person, ctx, kind)` returns a line or null, and `pairBark(a, b, ctx)` returns `[lineA, lineB]` or null (see 2c).
- Cast data: `dist/cast-early.js` (Noah, Hal, Walt, Elena, Sophie), `dist/cast-oak.js` (Oscar, Lincoln, Brentster, Grace), `dist/cast-crowd.js` (20 walkers: facts and templates), and the registry `dist/cast.js`, which imports the groups and exports `castOf(who)`. The files must be **flat in dist/**: `scripts/package-release.mjs:21` copies only top-level `dist/*.js`, so a `dist/cast/` folder would silently not ship. I use few group files, not one per person, to keep PROJECT-INDEX inside its budget.

### 2b. The UI: a talk panel, not a floating box

- **A new `#talk` panel, docked low and centred** (about 640 px wide, about 38% of the height at most; full width with a 16 px gutter on a narrow screen). It is NOT anchored to the head, so it never jitters and it works the same indoors, at counters, at the buzzer and in a doorway.
  - The header shows the name once, plus a small tier/mood chip ("Friend · cheerful") and an empty 48 px portrait slot for later.
  - Below it is a **transcript** of the last 6 bubbles: NPC bubbles on the left, the player's chosen reply on the right in a different tone. Older bubbles scroll up and fade. A new line fades in over 120 ms (no typewriter effect; Space shows all of it at once).
  - Replies are a vertical list (up to 6 plus "See you"), numbered 1-7, and written as short first-person lines ("Any work going?"). A reply already asked today is dimmed, not hidden.
- **Keys:** 1-7 picks, Up/Down plus E/Enter, Esc/Q means "See you". Walking away (more than 3 m) closes it with "See you". The panel keeps `modal` behaviour as now (movement locked while it is open).
- **Gamepad:** the game has none today (Grep finds no `getGamepad`). The panel exposes `focusNext/focusPrev/confirm/leave`, so a later gamepad stage maps D-pad, A and B with no panel change.
- **Stations stay on #dialog.** Bed, bills, board, buzzer panel, coffee machine, company store and gig door keep the old box, which limits the change and keeps garage, tickets and sleep tests untouched.
- **World bubbles over heads:** not worth it as the main view (they cost readability, need per-frame projection, and the owner dislikes head tags). The cheap alternative is that, during a talk only, one 14 px "speaking" chevron marks the current speaker.
  - It is placed with `transform: translate3d`, smoothed as `pos += (target - pos) * (1 - exp(-14*dt))`, with no layout reads per frame, and hidden when off screen or when the speaker is out of view.
  - Plus the existing talk camera framing (clearWorldPanel already turns the camera to the speaker).
  - Cost: one projection and one style write per frame while talking, nothing otherwise. No name tags anywhere.

### 2c. Ambient chatter (barks): a separate, cheap layer

- **Barks to the player:** when the player walks past a crowd person within 3 m and is NOT in a talk, `barkFor(person, ctx, 'pass')` may return one line of 60 characters or less (for example "Mind the ice by the bank." when it snows later, or "Shift's starting, can't stop!" when they are late for their post). It shows as a small bubble at the docked subtitle spot (bottom-left) for 2.5 s with the person's first name.
- **Walker to walker:** when two walkers pass within 2 m and the player is within 12 m, `pairBark` gives an authored couplet (both lines written together, and family pairs know each other: the Ellisons, the Reyeses, the Hales).
- **Throttle (in game.js):** one bark per 20 s overall, the same person at most once per in-game hour, none while driving above 15 km/h. Pure selection by hash: no allocation per frame (the check runs on the existing `npcCrowd.talkable` result, every 0.5 s).
- Barks never change state. Talking (E) always opens the full panel.

### 2d. Authoring and tooling

- **Adding a person:** a writer (the owner, Gemini or Sonnet) adds one object to a cast group file: `{id, name, personId, voice:'one line for writers', facts:{...}, nodes:[...]}`. A new group means one import line in `dist/cast.js`. game.js is never touched for content: talk prompts look up `castOf(personId|rosterId)`.
- **Writer rules (in the file header):**
  - One variant is one complete utterance.
  - Time words (morning, tonight, evening, late) only inside a matching `period`/`hour` condition.
  - Each node ends in replies or `end`.
  - A bubble is 160 characters or less.
  - No two people share a line.
  - Use facts, not ids ("a sawyer at the Ridgeline mill", never `ridgeline-sawyer`).
- **`validateCast` catches:**
  1. Unknown condition keys and unknown acts.
  2. Nodes no `go` can reach.
  3. Dead ends (no replies and no `end`).
  4. `go` to a missing node.
  5. More than 6 replies.
  6. Duplicate labels in one node.
  7. The same text in two places, in this cast or across all casts (normalised: lower case, no punctuation).
  8. Time words whose variant allows a wrong period (a word list per period).
  9. Glue suspects: one bubble with two greeting openers (`/^(hi|hey|hello|morning|evening)\b/` on two sentences).
  10. Bubbles over 160 characters, raw ids or `undefined`/`{` leaking into text.
  11. A node whose variants can all fail for some ctx (checked by the sweep below).
- **`scripts/talk-check.mjs <who>`** prints the validator result and a sample transcript for each period x tier (morning stranger ... night close friend), so the owner can read a person in one screen without playing.
- **`tests/talk-cast.mjs` (the sweep):** for every cast person, every period x tier x mood band x story step 0..10 plus done, open the conversation and walk every reply breadth-first to depth 6. It asserts that something is always said, that every path can end, that no line breaks the time rules, that no line repeats within one walk, and that every act is known.

### 2e. Co-op and determinism

Dialogue state lives in each player's own `progress` (as npcs/standing do today), so two players can be at different story steps with the same NPC. All choice comes from `hash(MAP.seed, who, node, day, talkCount)` plus that player's memory. The ctx is built from `hudDay()`/`hudMinutes()` (the host clock while visiting), so a visitor hears the right time of day. No Math.random, no Date.now and no shared NPC talk state over the relay. The engine is replayable: the same progress and env give the same transcript (a test pins this).

### 2f. Save format (additive only)

- **`progress.npcs[id].mem`** (roster people) = `{last:[lineKey] (6 at most), seen:{nodeId:count} (32 keys at most), beats:[string] (16 at most), lastMin:int}`.
  - `talks` (40 keys) and `flags` (12) keep their meaning for the mood rules. The engine still calls `talk(npc, topic, day)` with the node's `topic`, so Lincoln's hunting mood and Brentster's cat rule work unchanged.
  - **normalizeNpcs drops unknown fields today** (npc-life.js:63 rebuilds the object), so it must learn to carry `mem` through `normalizeTalkMem`. npc-life.js is not a forbidden file.
- **`progress.talk`** = `{v:1, people:{personId:{metDay, lastDay, last:[...], seen:{...}, beats:[...]}}}` covers people outside the roster (Elena until she joins the roster, and the crowd). It is capped at 48 people (the oldest `lastDay` is dropped) and normalised in jobs.js `normalizeProgress` the same way as the other blocks.
- **Migration (`migrateTalkMem`, run once when `mem` is missing):**
  - `metDay >= 0` gives `seen[who+'.first'] = 1`, so old players skip the first meeting.
  - Lincoln's `talks.deer` and similar counts copy into `seen['lincoln.hunt.deer']`.
  - `starter.step >= 2` sets the beat `sophie.groceries-delivered`, `>= 3` sets `hal.met`, and `noteGiven` sets `walt.note`.
  - `careers.ridgeline.hired` sets `walt.hired` for the street.
  - `cafe.employed` gives Elena `metDay`.
  - Old saves without any of this load as empty memory. A test loads an old fixture and checks that nothing is lost.

**Tests that pin today's strings, and the plan for each:**

| Test | Pins | Plan |
|---|---|---|
| `tests/npc-dialogue.mjs` | GREETINGS, openTalk/talkOutcome pages ("Which reminds me"), CAT_*, pagedChoices, knock, flatDoors, peopleRows, createRosterPlanner | Keep it whole until wiring (C6). In C10, delete the greeting/talkOutcome/pagedChoices parts together with the dead exports, on purpose, with talk-cast.mjs taking over. knock/flatDoors/peopleRows/planner tests stay (peopleRows re-pinned to show the real jobs). |
| `tests/npc-chat.mjs` | chatLine format, `/^I work as/` | Kept until the crowd cast lands (C9), then chatLine and this test are removed together. The validator checks that every population person has a cast entry. |
| `tests/starter-game.mjs` | halTalk text (`Four crates`, `waiting|Noah`, `Come by some mornings`, `$500`) and choice ids groceries/buy | halTalk stays as the story facts (unchanged). Hal's cast nodes reuse those phrases, and talk-cast asserts that step 3 offers `act:'hal.groceries'`. Nothing is re-pinned. |
| `tests/office-game.mjs` | prompt "Talk to Walt Hargrove"; #dialogText `/Can I help you/`, `/bottom|axe/`, `/crew/`, `/Not yet/`, `/level 3/`, `/Good to see you/`, `/Feller/`, positional `jobAction` clicks | Prompt kept. In C6 it is re-pinned to read `#talkLog` and to click by label through a new `tests/support/talk.mjs` (`talkText(ids)`, `reply(ids, /regex/)`). Walt's nodes keep those key words. |
| `tests/startup.mjs` | the Elena cafe flow by positional `extraAction`/`jobAction` clicks (lines 93-98) | Re-pinned in C6 with the same helper. Stations in that test (studio, bed, store) stay unchanged. |
| `tests/jobs-game.mjs`, `careers.mjs`, `population.mjs` | the name "Walt Hargrove" | Untouched. |
| `tests/npc-life.mjs`, `needs-loop.mjs` | mood and standing rules, moodLine changing with mood | Untouched (moodLine stays for the People page). npc-life.mjs gains a check that `mem` survives normalisation and respects its caps. |

## 3. The cast plan

Voice plus topics. A topic "does" something real. ASSUMED marks a fact I made up that needs the owner's OK.

**Noah (Corner Market clerk, Flat 8).** Voice: chatty, tidy, counts things out loud, worries about stock.
- First meeting (step 0-1, counter): introduces himself and the market. He asks you to take Sophie's groceries (`act:job.pickup`; starts the story) and offers "Skip the introduction" (`act:skipStory`).
- Repeat opener: by period, by his mood, and by `recent` ("Eggs came in yesterday, thanks to you").
- Topics:
  1. **Shelves:** the live stock in his words, plus a low-stock remark that hints at the restock gig.
  2. **Work:** the gig board (`act:gigBoard`). He names the need and who it is for.
  3. **Sophie** (after delivery): her thanks, a +1 standing story beat, and he says she is across the street in Flat 2.
  4. **The eggs** (after the crate beat): reacts to `starter.quality` (gentle or impressed). This is a consequence you hear about.
  5. **Town:** ONE rumour built from real state (Ridgeline hiring if you are not hired, the cafe hiring if you are not employed, the Eastbank pump), never a random list.
  6. **Look around** (`act:openStore`).
- At his flat door at night he is off duty and tired ("Ask me at the counter tomorrow"), with a different set of nodes.

**Hal Brennan (Willow Farm).** Voice: gruff and warm, bad knee, up before dawn, short sentences.
- First meeting: by story step (today's halTalk beats, rewritten as nodes; "Shortbed", not "flatbed").
- Repeat: morning coffee on the porch only in the morning.
- Topics:
  1. **The farm:** the coop and egg stock from world state, which hints at the egg-run need gig.
  2. **The truck:** care and fuel tips; after the story, the sale (`act:hal.buy`).
  3. **Walt:** why the note matters, which steers you to Ridgeline.
  4. **His knee:** mood. At low mood he asks for help, which unlocks a `tend` need.
  5. **Peter:** Peter Brennan, a feller at Ridgeline, is his son (ASSUMED, same surname). It is a story beat that links farm and mill.

**Walt Hargrove (Ridgeline owner).** Voice: gruff, fair, punctual, talks in rules.
- First meeting at the office: today's interview (`act:walt.hire`). With Hal's note (step 6-8) he reads it first ("Hal vouches for you"), sets the beat `walt.note`, and the interview is shorter.
- Repeat at the office: promotion (`act:walt.promote`, keeps the "Not yet ... level 3" facts), tools waiting (`act:walt.collect`), how a shift works.
- New topics:
  - **Safety:** one rule per rank.
  - **The mill today:** sawmill and order state, a hint.
- On the street he knows you are hired and your rank ("Feller now. Gloves on?"), and after six he says "Office is shut. Tomorrow."
- Gus and Ray are mentioned only once they exist.

**Elena (Alder Coffee manager).** Voice: brisk, warm, organised, a little proud of her coffee.
- First meeting: introduces the cafe; asks if you are looking for work (`act:cafe.hire`).
- Repeat at the counter: clock in or out, next task, lunch (`act:cafe.*`, keeping the "$24" and "$6" facts).
- New topics:
  - **How did I do?** Feedback from the shift (`cafe` stage counts).
  - **Naomi:** her barista; a crowd link.
  - **Sophie:** "she lives on my lattes", a link to Sophie's cafe invite.
- On the street she knows she employs you ("Eight sharp tomorrow").
- She needs a memory (roster entry or `progress.talk`; question 3).

**Sophie (Flat 2, gig client).** Voice: kind, rushed, apologetic, funny when relaxed.
- First meeting after story beat 1: thanks you for the groceries (beat `sophie.thanked`, +standing). Before beat 1 she is a polite neighbour in a hurry.
- Topics:
  1. **Errands:** her errand need gig, as a hint.
  2. **The neighbours:** who is who in the building. Crucially, "Oscar only answers between ten and noon, and he hates the buzzer twice". This is the hint that makes Oscar reachable.
  3. **Coffee:** at friend tier she suggests the cafe (a beat, with a later scene).
  4. **Her day:** mood, chosen by period.

**Other named people (stage C8).**
- Lincoln is the evening market clerk who would rather hunt. At the counter in the evening he rings you up while telling hunting stories (his 7 topics become 2-3 node chains with real replies: "Where do you hunt?", "Need ammo?", which gives a restock hint). "Something else" no longer costs mood.
- Brentster keeps the Alder general store and steers to Junior. The cat gets state as beats (lost, found, vet), and his need gigs set them.
- Oscar: door-only, with short replies that grow longer with standing, and his truck repair/tow as the consequence chain.
- Grace: doorstep talks at 8 Cedar Loop, not "come in" on a public street; the garden `tend` need.
- Roster `role` and `work` are fixed to match population, so the People page tells the truth.

**The 20 crowd walkers** (Marta and Anton Ellison, Tom and Hannah Reyes, Priya Nair, Peter Brennan, Alex, Jonas Carver, Robert, Julia, Carlos, Tessa Dalton, Megan, Jonas Hale, Naomi Castillo, Malik Petrov, Ruth Ibarra, Bruno Lindqvist, Henry Hale, plus Elena on the street until she joins the roster):
- Each gets a `facts` block: `job` (an authored phrase), `home` phrase, `family` (an id link), `likes`, `worry`, `knows` (one rumour domain: fuel, jobs, housing, police, books...) and `hint` (one useful game fact, such as Robert at the pharmacy, Bruno about fuel prices, Megan about speeding).
- Shared template nodes (greet by period, "What do you do?", "Know anyone hiring?", "Heard anything?", farewell) take whole-sentence slots from facts. Each person adds 2-4 personal lines.
- The validator rejects a crowd entry without `job`/`home`/`hint`.

**Dead roster entries.** Recommended: keep Gus Taggart and Ray Okonkwo in ROSTER with `dormant:true` (they are skipped by the People page, needs, talk and the validator) until the map gives them a post. Deleting them would touch world-tick and needs tests for no gain. I could not verify whether needs are generated for them today; C3 must check `needsFor` and gate it on `dormant`.

**Duplicate pedestrian prompts.** There is one talk prompt per person. The `person-` prompt (game.js:674) looks up the same cast by name, and candidates are de-duplicated by person id. The static Oak Street lines in neighborhood.js:6 become those five people's `hint` facts.

## 4. Stages (serial; each stops with tests passing for the owner to check and commit)

Builders: **Sonnet 5.5 (high)** for pure modules and tests. **Opus 5.5** for save formats and all game.js wiring. Forbidden shared files (AGENTS.md): only the main chat edits `dist/game.js` and `notes/handoff.md`. Each wiring stage below lists its exact game.js edits.

| Stage | Builds | Files | Tests and eye-check |
|---|---|---|---|
| **C1** engine (Sonnet) | conditions, selection, effects, sessions | new `dist/talk-engine.js`, `tests/talk-engine.mjs` | a tiny inline cast: period picks, no repeats within `last`, specificity wins, one variant only (no glue), replay determinism, unknown `go` throws in tests. Eye-check: none |
| **C2** validator + checker (Sonnet) | rules 1-11 above | new `dist/talk-validate.js`, `scripts/talk-check.mjs`, `tests/talk-validate.mjs` | a bad cast that triggers every rule once, and a good one with zero problems |
| **C3** memory + save (Opus) | `mem`, `progress.talk`, migration, `dormant` | new `dist/talk-memory.js`, `tests/talk-memory.mjs`; edit `dist/npc-life.js` (normalizeNpcs carries mem; needsFor skips dormant), `dist/jobs.js` (normalizeProgress calls normalizeTalkPeople), `dist/npc-roster.js` (dormant flag; true roles for Lincoln/Brentster) | old-save fixture round trip, caps, migration beats; npc-life.mjs and needs-loop.mjs still pass |
| **C4** early cast (Sonnet for structure, content by Opus or the owner) | Noah, Hal, Walt, Elena, Sophie | new `dist/cast-early.js`, `dist/cast.js`, `tests/talk-cast.mjs` (sweep) | sweep is green; starter-game phrases present. **Eye-check:** the owner reads `node scripts/talk-check.mjs noah` (and the others) |
| **C5** talk panel (Sonnet) | the DOM panel, keys, transcript, chevron | new `dist/talk-panel.js` (DOM, no three.js; exports `createTalkPanel(root)` with `show({name,chip,lines,replies})`, `append`, `close`, `focusNext/Prev`, `confirm`, `leave`); edit `dist/index.html` (a `#talk` block next to #dialog), `dist/style.css` | a small node test with a minimal stub of only the methods it uses (and NOT pretending to be the game). **Eye-check:** a dev-only `?talkdemo` page or the dev panel, in the owner's browser |
| **C6** wiring (Opus, main chat) | all people talk through the engine | **dist/game.js** (exact list below); `tests/support/talk.mjs`; re-pin `tests/office-game.mjs` and `tests/startup.mjs` | `npm run release -- --force` then `npm test`. **Eye-check:** Noah at morning and night, Walt hired/unhired, the Elena shift, Hal at step 3 |
| **C7** barks (Sonnet for barks.js, Opus for wiring) | ambient lines | new `dist/barks.js`, `tests/barks.mjs`; game.js: a 0.5 s bark tick in the crowd update and a subtitle element | frame time unchanged (owner's GPU); no bark more than once an hour per person |
| **C8** Oak Street content (Sonnet + owner) | Lincoln, Brentster, Oscar, Grace, door nodes | `dist/cast-oak.js`; knock open text becomes a `doorway` place | sweep; talk-check transcripts read by the owner |
| **C9** crowd content (Gemini/Sonnet with the validator) | 20 walkers' facts + templates | `dist/cast-crowd.js`; remove `chatLine` + `tests/npc-chat.mjs`; `neighborhood.js` lines become facts | validator: every population person has an entry |
| **C10** cleanup (Sonnet) | dead code out | trim `npc-dialogue.js` (openTalk, talkOutcome, pagedChoices, topicsFor) and `npc-roster.js` (GREETINGS, DEFAULT_GREETINGS, TOWN_LINES, CAT_*, mood `lines` stay for moodLine); re-pin `tests/npc-dialogue.mjs` on purpose | `npm test`; `npm run index` stays within budget |

**C6 exact game.js edits** (for the main chat):
1. Import `talkContext, openConversation, chooseReply, remember` from talk-engine.js, `castOf` from cast.js and `createTalkPanel` from talk-panel.js.
2. Add `talkWith(who, actor, place)`. It builds the env from `hudDay()`, `hudMinutes()`, `MAP.seed`, place and `recentEvents()`, opens the panel, and on each reply applies the effects:
   - `standing`, `mood` and `topic` through the existing `talk`/`gainStanding`;
   - `act` through an `ACTS` map onto halChoice, finishJob, commitCafe, interview, promotionTalk, collectOwed, openStore, marketWork and skipChoice's body;
   - then `persist()`.
3. Make the bodies of talkHal, talkNamed, marketMenu, ownerMenu, managerMenu (non-station parts) and talkCrowd call `talkWith`. showCafe's customer order (Maya/Theo) stays as is.
4. The `person-` / `npc-` candidates use one id per person (`talk:<personId>`).
5. Add a small `recentEvents()` ring (8 entries) fed where storyEvent, deliverNeedCrates, promote and finishJob already run.
6. The per-frame #dialog anchoring at :910 is skipped while `#talk` is open; the chevron update goes there instead.

## 5. Risks and open questions for the owner (recommended answer first)

1. **Docked panel or bubbles at heads?** I recommend the docked transcript panel plus a small smoothed chevron over the speaker, and no name tags. Bubbles at heads only for barks, if you later want them.
2. **Does time stop while talking?** I recommend no (co-op cannot pause, and talks are short). The panel shows the clock so "Morning" never lies for long.
3. **Should Elena join the roster** (mood, standing, People page)? I recommend yes, in C3. It touches roster-count assumptions in npc-life.mjs and world-tick.mjs, which I have not checked line by line.
4. **May talks give money effects** (a discount at close tier, a free coffee from Hal)? I recommend only hints, gigs and story beats now. A 5% close-friend discount at Noah could come as one later stage, after the economy owner says yes.
5. **Lincoln and Brentster have jobs** (evening clerk, general store) that their writing ignores. I recommend keeping the jobs and writing them in. The alternative is to remove their posts in population.js.
6. **Who writes the words?** I recommend Opus writes the 5 early casts in C4 (voice matters most there), you edit them, and Gemini or Sonnet fill the crowd facts in C9 under the validator.
7. **Gus and Ray:** I recommend keeping them dormant until the map has a foreman and driver post. The alternative is to delete them now.
8. **Risk: test churn and the index budget.** C6 re-pins two big game tests and C10 rewrites npc-dialogue.mjs. Six new dist files plus 3 cast files may push PROJECT-INDEX near its cap; if `npm run index` complains, the cast files' header lines get shortened (never the cap raised).

**What I could not verify:** whether the per-frame anchoring (game.js:910) is really the stutter the owner sees (no browser); whether the `person-` and `npc-` prompts can show for the same person at the same moment (that depends on both bodies being visible); whether needs or gigs are generated for Gus and Ray; how the panel looks at 165 FPS; and the exact game.js line numbers at build time (another agent is editing it, so C6 must re-grep).
