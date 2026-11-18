michadr.

# C4-fixes: pure-side fixes from the Opus cast review

## Files changed
- dist/talk-engine.js (270 lines): `talkContext` now reads `env.flags` (object {skipped:true,...} or a list of names, `is.` prefix optional). Only the five names in the new export `DERIVED_FLAGS` (skipped, loaded, ownsShortbed, rented, carryingCafe) are accepted. They appear as beats `is.skipped` etc. for that turn only, inside the 16-beat cap, de-duplicated, never saved (remember() keeps only session beats).
- dist/cast-early.js (558 lines): all B2-B6 fixes, H1-H6, and the medium/low text items listed below.
- dist/talk-memory.js: lines 79-80 got an explicit `st?.skipped!==true` guard. The review's claim was already handled (step is forced to 0 when skipped), and tests/talk-memory.mjs already pins "skipped story gives no beats". The guard is just explicit now.
- tests/talk-cast.mjs (211 lines): re-pinned old :133 (now `/crew/` and NO axe/logs) and old :142 (now `/sheet/`, no "earned it"); `hal.loaded` -> `is.loaded` in the pin; new block 4f with pins for B2 (delivery only with is.carryingCafe), B3 (Noah door reply, Sophie thanks, Sophie groceries line for skippers), B4 (Foreman greeting, no stale "Feller rank"), B5 (no truck sale with is.ownsShortbed), B6 (no "crates are on" without is.loaded), H1 ($12.00), H3 (no Studio 2B / across the street at the door).
- tests/talk-engine.mjs (161 lines): new block 11b for derived beats (flags as object and list, unknown/false dropped, cap, line gating, never saved).
- tests/talk-memory.mjs: unchanged.

## Cast edits done (cast-early.js)
B2 delivery gated on is.carryingCafe. B3 `notBeat:[...,'is.skipped']` on Sophie door/open (4 conditions), skipper groceries line, Noah door reply now `story:[2,10],notBeat:'is.skipped'`, Noah labels at the counter and town. B4 Foreman variant, Sawyer line made rank-neutral (so it cannot mis-greet a Foreman if the Foreman line was recently said), new walt.open evening line, promote node, hired-confirm; hal.loaded -> is.loaded; hal.peter beat dropped; B5 owner line plus gated truck line and Buy reply. H1 $12 everywhere, H2 geography, H3 Oak Street wording, H5 harvest/restock lines, H6 Naomi/Peter/pay. M1 wrap variants (noah, hal, elena, walt, sophie), M3 tomorrow fixes and bye split, M4/:280 hour:[5,8], M5 safety/wrap/`hired:false` on Walt's note line, M6 Hal voice, M8 wording, M11 landing/stairs/hall wording, M12 is.rented line, L :93 split [2,2]/[3,3], :499 Sophie bye, :142 "Every dozen", extra Walt street variant.
Own wording (review had no exact text): Noah morning-wrap pairing, Sophie/Walt/Elena wrap variants, Walt's extra street line, Noah [3,3] work line, Hal harvest in hal.coop ("The harvest run, eh? ... fuller than I can sell", changed because the validator rejects identical bubbles), Walt Foreman 2nd bubble "What can I do for you?" (same reason).
Not done: M2 (C8), M7 contractions (risk to pinned phrases; one editorial pass later), M9 ($ constants check; needs the constants, wait for cast.js), L :47 (harmless), M10 done.

## Output (real)
talk-check noah/hal/walt/elena/sophie --problems-only: "No problems for <name>." for all five.
node tests/talk-cast.mjs:
PASS talk-cast.mjs: 5 early casts validated (0 errors, 0 warnings), 762 sweep contexts (19279 terminal walks, 39647 bubbles, zero cycles/repeats/time-leaks), castOf + pinned phrases passed.
node tests/talk-engine.mjs: ends with its summary line "Talk engine: period picks and edges, ... no clock or chance." (no throw; this test prints no PASS word).
node tests/talk-memory.mjs: PASS talk-memory: caps (6/32/16, 48 people), junk, frozen, helpers, old 0.35.18 save loads unchanged, migration beats, Elena met via the cafe, once only
node tests/talk-validate.mjs: "Talk validator: good cast has zero problems; the bad cast fires all 11 rules ..." (passed)
npm run index: brief 2834 tokens (target 3000), index 32850 tokens (target 34000); 221 modules ...
node tests/brief.mjs: brief tests passed: 221 modules listed, brief 2834 and index 32850 estimated tokens (budgets 3000 and 34000)

Not run: `npm run release` and full `npm test` (nothing in game code changed; the needs tests untouched). Nothing seen in a browser.

## C6 wiring rules I could NOT do here (forbidden files)
1. env.flags, computed fresh on EVERY turn and on every chooseReply (never saved), passed in `env.flags`:
   `{skipped: starter.skipped===true, loaded: starter.step===4 && starter.loaded===true, ownsShortbed: vehicles.some(v=>v.model==='shortbed' && !v.loan), rented: housing.rented===true, carryingCafe: carry.phase==='carrying' && completed%3===1}` (carryingCafe per jobs.js ROUTES[1]).
   Call remember() with the STORED mem; talkContext does not put flags in mem.
2. Acts (B1): for any result with an `act` effect, run the act FIRST. On `{error}` show it as a system line and KEEP THE OLD session (old replies stay, new lines dropped); commit the new session only on success. Affects walt.hire, cafe.hire, hal.groceries, job.pickup.
3. Acts must not touch #dialog, `modal`, clearWorldPanel or look.capture(): commitCafe, finishJob, useLife, halChoice, interview, promotionTalk and the collectOwed branch of ownerMenu do today and some call speak(). Each ACT should do the pure transaction plus persist() and return `{ok,text}`; the panel appends the text. Pass the office object `o` into talkWith so interview(o) and promotionTalk(o) work.
4. dist/game.js:516 `keeperName`: return 'Elena' (not 'Sophie') for the cafe.
5. dist/needs.js:22 KEEPERS: `'shop:cafe':'sophie'` -> `'elena'` (needs.js is on my forbidden list; may re-pin a needs test, unverified).
6. recentEvents: keep a ring of 8 `{ev, at}` with `at=day*1440+minute`; build `env.recent` from entries with `at >= now-1440`. Push points (re-grep line numbers): `delivered:sophie` when storyEvent('delivered') returns true in finishJob (~:550); `egg-run` when storyEvent('delivered-crates') returns true (~:532) and in needDrop success when a.needGood==='eggs' (~:527); `promoted` on promote success in promotionTalk (~:600); `cafe-shift` on clockout success.
7. H7: when a Noah talk opens at starter.step===0, call storyEvent('read-message') first (marks his phone message read, avoids the step-0 story stall).
8. Call storyEvent('note-given') (ownerMenu ~:589) BEFORE building the Walt ctx.
9. Place mapping: market interior -> counter, cafe interior -> cafe, Ridgeline office -> office, buzzer -> door, Hal -> farm, crowd/street -> street. Use personId for castOf on crowd/npc candidates.
10. Drop recordTalk('hal') (~:529) once talkWith applies `meet`.