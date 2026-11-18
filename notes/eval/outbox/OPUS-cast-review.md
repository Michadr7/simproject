michadr.

# Opus review of the five early casts (C4, Gemini) before C5/C6

Reviewer: Opus 5.5, read-only. Nothing was edited except this report. No git.
Read: context.md 1-45, handoff.md 1-16, notes/conversation-design.md, outbox/C4-cast-early.md, dist/cast-early.js (all 601 lines), dist/cast.js, talk-engine.js (60-260), talk-validate.js (grep), talk-memory.js (grep), and line ranges of game.js (483-632, 660-675), starter.js, cafe-job.js, jobs.js, needs.js, gigs.js, npc-roster.js, map-definition.js, world-goods.js, items.js, vehicle.js, plank-economy.js, damage.js, garage.js, world-state.js. I also ran node on population.js to see who holds each job.

Commands run (real output):
```
node tests/talk-cast.mjs
PASS talk-cast.mjs: 5 early casts validated (0 errors, 0 warnings), 762 sweep contexts (19379 terminal walks, 39657 bubbles, zero cycles/repeats/time-leaks), castOf + pinned phrases passed.
node tests/talk-validate.mjs
Talk validator: good cast has zero problems; the bad cast fires all 11 rules (15 codes) exactly once ... (passes now)
```
The talk-validate failure Gemini reported is gone. Someone already fixed scripts/talk-check.mjs.

## Verdict

The structure is good: no glued fragments, story beats line up with starter.js step numbers, and most numbers match the code. These are correct: $90 studio = $30 + $60 + $7, $500 Shortbed, $28-$40 crate pay, $24 shift, $6 meal, clock-in 8 AM-4 PM, Ridgeline hours 6 AM-6 PM with last clock-in 5:30 PM, $8 trainee wage, $3 / $0.75 per pine, chain pay $1.20 / $0.25 / $7.30 / $5 per rack cell, the S70 (65 mph, 5 mpg, 20 gal, 44 planks, 4 crates), Tylan Flatbed $8,000 at level 5, Chainsaw $600 at Foreman and level 15, repair kit +15% up to 40%, prices within ±25%, fuel truck weekly at $4 / $4.20, farm output 8/6/10 a day, harvest opens at 90%, Oscar answers 10-12 and hates a second knock, crate sizes 4/6/5.

The validator cannot see the problems below. These are logic against game state, not wording. **Six are C6 blockers.** Each needs either a cast edit or a C6 wiring rule, and most are cheap.

---

## A. BLOCKERS for C6 (ranked)

### B1. Act replies announce success before the act runs (C6 wiring rule)
The engine returns the act effect and the next node's lines in one result, so game.js applies the act after the line is already written. If the act fails, the line is false:
- `walt.offer` "I will take it." (act walt.hire, go walt.hired-confirm) says "You are on the crew. Here is your starter axe...". But hire() can fail, and the axe can be owed when the bag is full.
- `elena.work` "I would like the job." (cafe.hire, go elena.hired) says "Wonderful—welcome aboard!". But cafeTransaction fails beyond 1.35 m from the manager ("Move closer to the work station").
- `hal.open` "Hand over the groceries" (do act hal.groceries, go hal.loan): startLoan can fail.
- `noah.sophie-order` (node `do` act job.pickup): finishJob refuses when the market is shut, or when you are already carrying a bag.

**C6 rule:** for any result with an `act` effect, run the act first. On `{error}`, show the error as a system line and keep the OLD session, so the previous replies stay offered and the new lines are dropped. Commit the new session only when the act succeeds.

**Second rule:** no ACT may call a function that touches #dialog, `modal`, `clearWorldPanel` or `look.capture()`. Today commitCafe, finishJob, useLife, halChoice, interview, promotionTalk and the collectOwed branch of ownerMenu all do, and some call speak(), which would open #dialog on top of the panel. Each ACT should do the pure transaction plus persist() and return `{ok, text}`. The panel appends that text. Also, interview(o) and promotionTalk(o) need the office object `o`, so pass it into talkWith.

### B2. Elena offers a produce delivery nobody has (cast-early.js:407)
The reply "I have your produce delivery from the market." shows on every cafe visit from story step 1 onwards. In the game the cafe route (jobs.js ROUTES[1]) is reachable only when `phase==='carrying' && completed%3===1`, and marketWork offers a pickup only when `completed===0` (game.js:617). So today the delivery is effectively unreachable, and the reply would toast an error on every visit.
- Old: `{label:'I have your produce delivery from the market.',if:{story:[1,10]},go:'elena.delivery'},`
- New: `{label:'I have your produce delivery from the market.',if:{beat:'is.carryingCafe'},go:'elena.delivery'},` (a derived beat, see section C), or delete the line until the route exists.
- Gemini's ACTS table also mixes this up: `delivered:sophie` is pushed on the 18 Oak Street route (storyEvent('delivered') returns true, game.js:550). It is not pushed on Elena's job.deliver.

### B3. Players who skipped the story are thanked for groceries they never carried
skipStarter() sets `step:10, done:true, skipped:true`. So every `story:[2,10]` / `story:[4,10]` condition is true for players who skipped, and no condition can tell them apart. On top of that, talk-memory.js:79 (`if(who==='sophie'&&step>=2)`) gives skippers `sophie.groceries-delivered` during migration.
Fix with a derived beat `is.skipped` (section C) and these edits:
- :504 `if:{story:[2,10],notBeat:'sophie.thanked'}` → `if:{story:[2,10],notBeat:['sophie.thanked','is.skipped']}`
- :519 same change. :505 and :520 `notBeat:'sophie.thanked'` → `notBeat:['sophie.thanked','is.skipped']`
- :539 sophie.groceries: add before the default `{if:{beat:'is.skipped'},t:['Noah sends my orders over now and then. The bigger runs go up on the Gigs board.']},`
- :53 and :127 `if:{story:[2,10]}` → `if:{story:[2,10],notBeat:'is.skipped'}`
- :27 (Noah door) `if:{beat:'sophie.groceries-delivered'}` → `if:{story:[2,10],notBeat:'is.skipped'}`. As written this reply can never show: beats are per person, and that beat is only ever written to SOPHIE's memory (talk-memory.js:79), never Noah's.
- talk-memory.js:79-80 (not a forbidden file; needs Opus or Sonnet): add `&&st?.skipped!==true` to the `sophie.groceries-delivered` and `hal.met` migration lines.

### B4. Walt misreads the rank (cast-early.js:279, :295, :325-328)
Ranks from map-definition.js:410-415: 1 Trainee, 2 Feller, 3 Hauler, 4 Yard hand, 5 Sawyer, 6 Foreman.
- :279 `rankMin:5` greets a Foreman as "Sawyer". Add a variant before it: `{if:{hired:'ridgeline',rankMin:6},w:5,t:['Good to see you, Foreman. The crew sets its pace by you now.','What do you need?']},`
- :295 says "Feller rank suits you" at ANY rank of 2 or more. New t: `['Off the clock now. Office shut at six.','The new rank suits you. Doors open again at six sharp.']` (this also removes a "Tomorrow" that is wrong after midnight).
- :327 `rankMin:2` "You have earned it. Feller pays $10.00 an hour..." runs BEFORE the check, so a Feller or a Hauler is told they earned Feller. New: `{if:{rankMin:2},t:['Promotions go by the sheet: your level, shifts worked and reputation. Nothing else.','Want me to check it now?']}`
- :328 "Not yet, or maybe you are close!" → `t:['Feller needs level 3, three shifts worked and a reputation of 20.','Not yet met all three? Then come back. Want me to check the sheet?']` (keeps "Not yet" and "level 3").
- The real verdict text comes from promotionTalk via the act (B1).
- **tests/talk-cast.mjs:142** pins the wrong behaviour (`/Feller/` + `/earned it/` at rank 2). Re-pin it to `/sheet/`.
- :319 walt.hired-confirm duplicates and overclaims interview()'s exact lines. New: `t:['Welcome to the crew. Start with the marked pines in Pine Ridge.','Clock in on your phone or at the wall clock.']`. Re-pin **talk-cast.mjs:133** (drop `/axe/` and `/logs/`, keep `/crew/`). The axe and buy-back details come from the act text.

### B5. Hal sells the truck to players who already own one (regression vs halTalk)
halTalk (starter.js:124) checks `has` (the player owns a shortbed). The cast offers "Buy the truck · $500" and "The Shortbed is still in my yard" to every story-done player, including those who got her as a gift. buyFromHal then errors.
- :198 `if:{storyDone:true}` → `if:{storyDone:true,notBeat:'is.ownsShortbed'}`; add `{if:{beat:'is.ownsShortbed'},t:['She is yours now. Keep oil in her and she will outlast us both.']},`
- :202 reply `if:{storyDone:true}` → `if:{storyDone:true,notBeat:'is.ownsShortbed'}`
- Derived beat: `vehicles.some(v=>v.model==='shortbed'&&!v.loan)`. Exclude the loan truck.

### B6. `hal.loaded` must be derived, not stored (cast-early.js:171)
Gemini's option 1 writes `hal.loaded` into npcs.hal.mem when storyEvent('loaded') fires. Beats are permanent. STARTER_EPOCH resets (starter.js:3) restart the story at step 0 but leave the memory alone, so after a reset Hal would say "The crates are on" at step 4 before anything is loaded. Use Gemini's option 2: derive the beat each turn from `starter.loaded && step===4`, and never persist it. I recommend renaming it `is.loaded` so derived beats are recognisable: `{if:{story:[4,4],storyDone:false,beat:'is.loaded'},...}`.

---

## B. HIGH: fix before the owner's eye-check (not wiring blockers)

| # | Where | Problem | Old → New |
|---|---|---|---|
| H1 | :91, :97, :118, :38 | Sophie's run pays $12.00 (jobs.js ROUTES[0] pay 1200) plus a $3 story bonus. The cast says $3. | :91 "three dollars on delivery" → "twelve dollars on delivery"; :97 and :118 "($3.00)" → "($12.00)"; :38 "Three dollars for your pocket and a grateful neighbour to boot." → "Twelve dollars for you and a grateful neighbour to boot." |
| H2 | :22, :91, :92, :133, :417, :521, :575, :583, :38 | "Across the street" is wrong. The apartments (x 1), the market (x 19) and the cafe (x 36) are one row at z -6.3 (map-definition.js:177-178, starter.js:6). Noah lives in Sophie's building. | :22 "across the street." → "just down the street."; :91 "Sophie across at 18 Oak Street" → "Sophie in Flat two at 18 Oak Street"; :92 "across the street at 18 Oak Street" → "at 18 Oak Street, just up the road"; :133 "She is in Flat two across the street." → "She is in Flat two, same building as me."; :417 "right across from Studio 2B" → "a few doors down from 18 Oak Street"; :521 "Flat two across the street." → "Flat two at 18 Oak Street."; :575 "across the street?" → "down the street?"; :583 "across from us" → "just down the street"; :38 "made Sophie’s day across the street!" → "made Sophie’s day!" |
| H3 | :22, :32 | A new player has NO home: Studio 2B is rented at story step 8 (game.js:969 "No home"). | :22 "You must be new at Studio 2B." → "You must be new on Oak Street."; :32 "you look like you just moved into the studio." → "you look new to Oak Street." |
| H4 | :397, :471 | `gigClient:'elena'` never matches: needs.js:22 KEEPERS maps `'shop:cafe':'sophie'`, and game.js:516 keeperName says "Hand the crates to Sophie" at the cafe. That is a real game bug, and it also gives Sophie Elena's mood hits. | Data fix: needs.js:22 `'shop:cafe':'sophie'` → `'elena'` (allowed file; may re-pin a needs test, unverified). Requested game.js edit for C6: line 516, `keeperName` `'Sophie'` → `'Elena'`. |
| H5 | :168, :216 | The egg run loaded at Hal's pallet is a `need-restock` gig (game.js:517 needCandidates handles only need-restock). `need-harvest` has no pallet prompt, and its good may be milk or produce. | :168 and :216 new t: "You took the harvest job? Good. The shed is fuller than I can sell." Add to hal.open: `{if:{gig:'need-restock'},w:6,t:['On the egg run? Crates are on the pallet by the barn. Back the truck up and load.']},` |
| H6 | :479, :244, :245 | Naomi Castillo is the barista on 8-18, the same hours as Elena (population: cafe-barista). Peter Brennan is a Feller ($10) who LIVES at the farm (farm-house#2). | :479 "Naomi handles the late shifts—between us, she practically keeps the grinder running smooth." → "Naomi works the bar with me most days—between us, she keeps the grinder running smooth."; :244 "eight bucks an hour" → "ten dollars an hour"; :245 "Sends a quiet word back whenever I need fence rails." → "He still mends my fence rails when he gets home." |
| H7 | C6 | Story stall: a pickup at step 0 (phone message unread) completes the route, but storyEvent('delivered') fails at step 0. The route is never offered again (completed>0). The game already has this risk, but the cast now invites the pickup in Noah's first line. | C6: when a Noah talk opens at `starter.step===0`, call `storyEvent('read-message')` first. |

## C. The hooks: recentEvents and derived beats

**recentEvents: sensible and cheap**, with two gaps:
1. "Recent" must expire. Keep a ring of 8 `{ev, at}` with `at = day*1440+minute`, and build `env.recent` from entries with `at >= now-1440`. Otherwise "congrats on the promotion" lasts until 8 more events push it out. Persisting the ring is optional: losing it on reload is harmless.
2. Gemini never said where `egg-run` is pushed. Feed points (all game.js, today's line numbers; re-grep):
   - `delivered:sophie`: storyEvent('delivered') returns true in finishJob (:550)
   - `egg-run`: storyEvent('delivered-crates') returns true (:532), and needDrop success when `a.needGood==='eggs'` (:527)
   - `promoted`: promote success in promotionTalk (:600)
   - `cafe-shift`: clockout success
   - Since need runs vary in size, change :142 "All sixteen dozen stacked clean on the rack!" → "Every dozen stacked clean on the rack!"

**Derived beats** (recommended, one mechanism for B2/B3/B5/B6/M12): C6 computes, on EVERY turn, `is.skipped` (starter.skipped), `is.loaded` (starter.step===4&&starter.loaded), `is.ownsShortbed` (non-loan shortbed owned), `is.rented` (housing.rented), `is.carryingCafe` (phase==='carrying'&&completed%3===1).
- They must reach the view but never the save.
- Cleanest: a one-line talk-engine.js change (Sonnet, pure, plus a test). `talkContext` accepts `env.flags` and passes `beats:[...cleanMem(memRaw).beats.slice(-(16-flags.length)), ...flags]` to baseContext.
- Zero-engine alternative: C6 passes an augmented `env.mem`, but must then call `remember()` with the STORED mem, never the augmented one. That is easy to get wrong.
- `remember()` saves only session beats, so derived beats are never persisted either way. The validator sweep already tries every beat a condition names.

## D. MEDIUM (editorial and logic)

- **M1 Repetition: every wrap node has ONE line**, and most chains end there, so each person closes every talk with the identical sentence (:150, :260, :368, :486, :596). Give each 2-3 variants. Examples:
  - noah.wrap: `{if:{period:'morning'},t:'Off you go. I have a delivery to count before noon.'}`, `{t:'Holler if you see an empty shelf!'}`
  - hal.wrap: `{if:{mood:['miserable','low']},t:'Go on. I will sit a minute.'}`, `{t:'Mind the bridge curve on the way out.'}`
  - elena.wrap: replace "a friend walks in" (said to strangers too) with `'Eight to six, every day.'`, plus `{if:{cafe:'employed'},t:'See you behind the bar.'}`
  - walt.wrap: see M5.
- **M2 Who is at the counter.** Population gives Noah 07:00-14:30 (market-day) and Lincoln 14:30-22:00 (market-evening), but marketMenu always speaks as Noah. Recommendation: C6 keeps Noah at all hours, as today; C8 switches by post hours once Lincoln's cast exists. Noah's evening counter lines then become C8's to retire.
- **M3 "Tomorrow" inside `night` (22:00-05:00) is wrong after midnight.** :19 "Come by the Corner Market tomorrow." → "Come by the Corner Market from seven."; :386 "Cafe opens at eight tomorrow." → "Cafe opens again at eight."; :295 fixed in B4. Also :62 and :12 bye "Doors stay open until ten." can be said after ten → `{if:{period:['morning','afternoon','evening']},t:'Always good talking. Doors stay open until ten.'}`, plus a plain `{t:'Always good talking. See you.'}`.
- **M4** :414 "See you behind the machine at eight sharp" fires all morning (05-12), including after 8 AM. `if:{cafe:'employed',period:'morning'}` → `if:{cafe:'employed',hour:[5,8]}`. I did not check whether the time-word rule accepts `hour` for "Morning!"; if it does not, drop "Morning!".
- **M5 Walt safety and info dumps.**
  - :354 mixes a vehicle unlock into "safety". Also the red beacon means the belt is FULL (sawmill.js:58), not danger. New: `['Stand clear when a pine starts to go, and never reach past the blade.','When the beacon turns red the belt is full. Take planks off before you feed another log.']`. Move the Tylan Flatbed fact to walt.mill if wanted.
  - :368 "punch the clock before five-thirty if you want full pay" (wrong: 5:30 PM is the last clock-in and pay is per minute) → "Stay sharp on the bridge. Last clock-in is half past five."
  - :278 add `hired:false`, so an already-hired player at story 6-8 is not offered "Can I help you with work?".
- **M6 Hal's voice** is meant to be short and plain, but :199-200, :209 and :226 read like a spec sheet. :200 "Damage costs twenty-five percent of her value at Eastbank Garage, minimum twenty-five dollars." → "Wreck her and the Eastbank repair shop charges up to a quarter of her price. Twenty-five dollars at least." (damage.js:51 scales with damage). :200 "That little white S70" → "That little S70" (colour not verified). :209 "Eastbank Garage" → "The Eastbank repair shop" (map-definition.js:419 name).
- **M7 Tone.** Speech avoids contractions ("I am Noah", "Let us talk about cafe work.", "I will see Walt soon."), and the file mixes straight and curly apostrophes. In a cosy game this reads stiff. One pass to "I'm / let's / I'll" in both speech and labels; keep the pinned phrases.
- **M8** :387 "my barista" → "my cafe assistant" (the player is "café assistant", cafe-job.js:7; Naomi is the barista). :400 "Maya even left a tip on the saucer." → "Maya said it was the best latte all week." (no tips exist). :447 "keeps tips and reputation tidy" → "keeps the regulars happy".
- **M9 Hard-coded numbers will drift.** $7.30 / $1.20 / $0.25 are marked PLACEHOLDER in plank-economy.js:67-69, and the owner's workforce answers are changing that economy. Add a talk-cast.mjs check that every "$x" in the casts matches its constant, or fill these as `{slot}` facts from the constants when cast.js is built.
- **M10** Noah's first line (:32) asks "Could you help me with one bag?" but offers no direct answer; the player has to guess "Any work going?". New 2nd bubble: "We keep fresh food, tools and packs from seven until ten. If you can carry a bag, ask me about work." This avoids a 7th authored reply on noah.counter, which the max-6 rule might flag.
- **M11 Door talks happen at the street buzzer** (flats have no interiors, game.js:496), but Noah, Elena and Sophie talk of the landing, stairs and hall. :19 "Oh, hello on the landing. I am Noah from down the hall, Flat eight." → "Oh, hello! Noah here, Flat eight."; :20 → `['Just heading out for the counter rush.','Walk over with me if you are going to the shop.']`; :23 "Good to bump into you on the stairs." → "Hello! You caught me between chores."; :506 "on the landing" → "on the intercom"; :508 "What brings you up the hall?" → "What brings you to my buzzer?"
- **M12** Sophie pitches renting Studio 2B (:514, :533, :585, :590) to players who already rent it. Add to sophie.studio `{if:{beat:'is.rented'},t:['How is the studio treating you? The radiator knocks, but you get used to it.']}`.

## E. LOW

- :47 Noah's night counter variant can never be reached (market closes at 22:00, when night starts). Harmless.
- :93 "Remember to buy food and eat first" is stale at step 3 (already ate). Split [2,2] from [3,3].
- :243 `do:[{beat:'hal.peter'}]` is set but read nowhere; it uses one of Hal's 16 beat slots. Drop it.
- :499 Sophie's bye "Text if you run into Oscar" is odd → "Thanks for making Oak Street feel friendlier!"
- :280 "on time this morning" also fires at 11:30. Use `hour:[5,8]`.
- :297 Walt's off-hours street line and :299 default repeat every visit for an unhired player (only 1-2 variants match). Add one more.

## F. Notes for C5 (talk panel)

- `lines[].who` is the cast id or `'you'` (the echo). Map ids to `cast.name`.
- `replies[].asked` means dim the reply. Labels run up to 60 chars and include `·`, `$`, curly quotes and em dashes.
- `ended:true` comes in two kinds:
  - with lines (a bye or a wrap): show them, hide the replies, close on a key or after ~1.5 s;
  - with NO lines (act-only replies: openStore, shelves, clockin, clockout, promote, collect, deliver, meal, skipStory, pickup): C6 appends the act's text, then closes.
- So the panel needs `append({who:'system',text})`. Act texts can exceed 160 chars: shelfLines() joins 4 goods (~200+ chars). Let system lines wrap, or show one line per good.
- `openStore` and `gigBoard` hand off to other UI (storeUI, or marketWork's #dialog with dynamic gig choices). The panel must close cleanly first (modal off) without saying "See you".
- Tests should click by label (`tests/support/talk.mjs`). Reply order changes with conditions.

## G. Notes for C6 (wiring), beyond B1-B6

- Verified in game.js today: openStore :629, marketWork :616, shelfLines :622, halChoice :493, startLoan/buyFromHal via halChoice, interview(o) :594, promotionTalk(o) :597 (Gemini wrote "promote/nextRank"; promotionTalk is the function), collectOwed (inline in ownerMenu :591), commitCafe :577 (cafeTransaction inside), useLife :574, finishJob :547, skipChoice :535 (body calls skipStarter), storyEvent :483, storyEvent('loaded') :531, storyEvent('delivered-crates') :532, deliverNeedCrates in needDrop :527. All 15 act names in the cast are in DEFAULT_ACTS (talk-validate.js:18).
- Place mapping: market interior → `counter`; cafe interior → `cafe`; Ridgeline office → `office`; buzzer knock → `door`; Hal → `farm` (his node has no `when`, so any place works); crowd and street → `street`.
- ownerMenu calls `storyEvent('note-given')` on open (:589). Keep that BEFORE building the ctx, so Walt sees steps 7/8 and the note greeting fires.
- Standing is counted twice today: recordTalk('hal') (:529) adds talk standing, and the cast adds `standing:1` on beats. That is fine (gainStanding caps at +3/day), but drop recordTalk once talkWith applies `meet`.
- `gigBoard` → marketWork also offers skipChoice. That duplicates the cast's skip and is harmless.
- Rebuild the ctx (and the derived beats) on every chooseReply, because an act can change state mid-talk.
- castOf matches id, personId or name. Use personId for crowd and npc candidates, so one person gets one prompt.

## Requested edits in forbidden files (main chat)
1. dist/game.js:516 `keeperName`: return `'Elena'` for the cafe, not `'Sophie'` (pairs with the needs.js:22 KEEPERS fix, H4).
2. dist/game.js, C6: the B1 act rules, the H7 `storyEvent('read-message')` at the first Noah talk, the recentEvents ring with expiry and the feed points in section C, and the derived beats.

## Files the fixes touch (none edited by me)
dist/cast-early.js (all the line fixes above), tests/talk-cast.mjs (re-pin :133 and :142), dist/talk-memory.js:79-80 (skip guard), dist/needs.js:22 (cafe keeper), optionally dist/talk-engine.js `talkContext` (`env.flags`). Afterwards run `node tests/talk-cast.mjs`, `node tests/talk-validate.mjs`, `node tests/talk-memory.mjs`, the needs tests, then release and `npm test`.

## Confidence
- **High:** facts checked against code. Pay $12 vs $3, the ranks, Naomi's and Peter's posts (node on population.js), Noah's 7-14:30 post, KEEPERS cafe→sophie, Elena's delivery being unreachable, skipped players at step 10, the per-person beat scope (talk-engine.js baseContext/viewOf), act-then-go ordering (chooseReply), the hal truck regression.
- **Medium:** geography ("across the street" is wrong by coordinates only; I did not look in a browser). The harvest gig having no pallet prompt (from needCandidates only). The step-0 stall (read from starter.js and finishJob; not played).
- **Low/unverified:** whether my replacement lines pass the validator's time-word and duplicate rules (not run; Gemini or Sonnet should apply them and run talk-cast). Whether `hour:[5,8]` satisfies the "Morning!" time-word rule. Whether a needs test pins `'sophie'` as the cafe keeper. Nothing was seen in a browser.
