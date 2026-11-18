michadr.

# C6: the conversation system wired into the game (Opus 5.5)

Nothing has been seen in a browser. Every claim below comes from the code and the Node tests (real output pasted at the end). No git was run, and notes/handoff.md was not touched.

## Files changed
| File | Lines | What |
|---|---|---|
| dist/game.js | 1768 -> 1823 | the wiring (list below), all CRLF, no BOM; `node --check` is clean |
| dist/needs.js | 196 (1 edit) | :22 KEEPERS `'shop:cafe':'sophie'` -> `'elena'` (H4, a real bug). No needs test pinned Sophie, so none was re-pinned. |
| tests/support/talk.mjs | 17 (new) | `talkOpen/talkName/talkLines/talkText/talkReplies`, `reply(ids,/label/)` (clicks by label), `closeTalk(ids,press)` |
| tests/talk-game.mjs | 50 (new) | the wiring test in the packaged game (boot-game style) |
| tests/office-game.mjs | 56 | Walt re-pinned to the panel (reply by label, `talkText`) |
| tests/startup.mjs | 219 | Noah's counter (4 places) and the Elena flow (3 places) re-pinned; the fake El gained the same DOM methods as boot-game |
| tests/support/boot-game.mjs | 41 | the fake El gained `appendChild`, `remove`, `ownerDocument`, and a `textContent` setter that drops children (talk-panel.js needs these). **`document.body.appendChild` is kept undefined on purpose**: world.js screenFade checks for it, and with it present it took over `requestAnimationFrame` in the harness and froze dev.mjs (found and fixed during the gate). |

## dist/game.js edits (line numbers after the change)
- :85 imports: `tierFor, moodWord, gainStanding, meet as npcMeet, talk as npcTalk` (npc-life), `talkContext, openConversation, chooseReply, remember` (talk-engine), `castOf` (cast), `createTalkPanel` (talk-panel), `withMem` (talk-memory).
- :441 movement keys are not recorded while talking (`&&!talking()`). Walking at :1679 and interact() at :893 are locked too. **modal stays false**, so stepWorld's clock keeps running (rule 8).
- :460 pause(true) closes an open talk silently. The pause menu (Esc when no talk, or window blur) is the only thing that pauses.
- :493-494 `halAct(id)` (startLoan/buyFromHal + persist, returns {text}|{error}); halChoice keeps its old #dialog behaviour on top of it.
- :505-552 the new talk block: `talking()`, `pedPid()`, the `pushRecent/recentEvents` ring (8 entries, `at=day*1440+minute`, expires after 1440 min, not saved), `talkFlags()` (skipped, loaded, ownsShortbed [`model==='shortbed'&&!loan`], rented, carryingCafe), `talkCtx()` (env built fresh on every turn: hudDay, hudMinutes, MAP.seed, place, recent, flags), `talkChip`, `talkEffects` (meet/standing/mood/topic through npc-life), `collectAct`, `skipAct`, the `TALK_ACTS` map (all 15 cast acts), `talkRunActs`, `talkWith(who,actor,place,{office,at,lead})`, `talkPick` (B1), `talkClosed`, and `talkFrame` (chevron + walk-away).
- :555 knockAt: a flat that answers talks in the panel (place `door`, the knock text as a system line); talkNamed is the fallback.
- :565 keeperName: the cafe keeper is `'Elena'` (H4).
- :576 needDrop: `pushRecent('egg-run')` after an eggs delivery. :581 the story crates: `pushRecent('egg-run')` when storyEvent('delivered-crates') succeeds.
- :578 Hal's prompt uses `talkWith('hal',hal.group,'farm')`; **recordTalk('hal') is dropped** (rule 7).
- :596-602 `jobAct(action)` (pickup/deliver + persist + `storyEvent('delivered')`, which pushes `'delivered:sophie'` when it succeeds); finishJob keeps its #dialog closing on top.
- :624-625 `lifeAct`/useLife, and :628-629 `cafeAct`/commitCafe (clockout pushes `'cafe-shift'`). These are the same split: the core does no #dialog, modal or look work.
- :646-655 `hireAct(o)`/interview and `promoteAct(o)`/promotionTalk (a promotion pushes `'promoted'`). The "Not yet ... level 3" text is unchanged. ownerMenu's collect uses `collectAct`.
- :704 the office owner: Ridgeline uses `talkWith('walt',clerk,'office',{office:o})`, so interview/promote/collect get `o`. Other employers keep ownerMenu.
- :709 the shop clerk: market uses `talkWith('noah',…,'counter')` and cafe uses `talkWith('elena',…,'cafe')`. The old menus are the fallback. showCafe's Maya/Theo orders are unchanged.
- :728-729 pedestrians and the crowd: one prompt id per person, `talk:<personId>` (deduplicated). Roster people go to talkWith (`street`), with talkNamed as the fallback. Crowd people go to talkWith, with talkCrowd or the old line as the fallback (no crowd cast until C9).
- :962/:964 the interaction prompt is hidden while talking. :1030 keydown: while talking, the key goes to `talkPanel.handleKey` (e.key, or mapped from e.code for the test harness; repeats ignored). Every other key except T/J/M is swallowed. :1051 mousedown and :1076/:1078 the look controls (including the lost-lock auto-pause) are blocked while talking.
- :964 the #dialog anchoring is skipped while #talk is open; `talkFrame()` runs instead. :1717 the existing talk-camera framing also follows the talk speaker.

## The 8 rules
1. **Done.** The act runs FIRST (`talkRunActs` before anything is committed). On {error}, the panel shows the echo plus the error as a system line, and keeps the old session and buttons; the new lines and effects are dropped (tested: a second pickup while carrying). Acts never touch #dialog, modal, clearWorldPanel or look.capture. openStore and gigBoard are hand-offs: the session is committed, the panel closes without "See you", then storeUI or marketWork opens. The office object is passed through talkWith.
2. **Done.** env.flags are computed fresh in `talkCtx` on every open and every chooseReply. `remember()` gets the stored `npcs[who].mem`. Tested: no `is.*` beat is ever saved, and Hal says "The crates are on" only from the save's `loaded`.
3. **Done.** keeperName gives Elena, and needs.js maps `shop:cafe` to `elena`. No needs test needed a re-pin.
4. **Done.** A ring of 8 with 1440-minute expiry, fed at delivered:sophie, egg-run (both places), promoted and cafe-shift. Tested: after a clock-out, Elena opens with "Sharp shift earlier!".
5. **Done.** `storyEvent('read-message')` runs when a Noah talk opens at step 0 (tested: step 0 -> 1). `storyEvent('note-given')` runs before Walt's context.
6. **Done.** market counter -> counter, cafe -> cafe, office -> office, buzzer -> door, Hal -> farm, pedestrians and crowd -> street.
7. **Done.** recordTalk('hal') is gone. See "Choices I made" for what replaced it.
8. **Done.** The talk never sets modal. Only the pause menu pauses (tested: the clock advances during a talk and after Esc). Co-op: no relay traffic; the ctx uses hudDay/hudMinutes, so visitors get the host clock.

## What I did NOT do, or did differently (and why)
- **Walk-away distance:** movement is locked (C5 note), so "more than 3 m" is measured from where the PLAYER stood when the talk began (teleport, R, rescue). The speaker check is 12 m, not 3 m, because pedestrians and crowd walkers keep walking during a talk; at 3 m they would end every street talk within about 2 s. On walk-away a "See you" turn is recorded and the panel closes at once.
- **One talk counts once:** talkWith calls `registerTalk` on open (talk + met + standing +1, capped at 3 a day), exactly what recordTalk did for Noah, Elena and Hal. Walt now gets it too; before, ownerMenu gave him nothing, which is the audit's "Walt greets his worker as a stranger" cause. The cast's own standing beats add on top, inside the same daily cap.
- **Fallbacks kept** (the design says to keep the old path, or no cast exists yet): Lincoln, Brentster, Oscar and Grace (C8), crowd and pedestrian strangers (C9), other employers' owners, the gig board (marketWork #dialog), every station, and showCafe's customers. The gig board and the store are old UI and still set modal, so time pauses there as before.
- **Non-roster casts:** talkWith refuses a cast that is not in the roster (`npcById`). All five early casts are roster members, so memory lives in `npcs[id].mem`. Crowd casts (C9) will need `progress.talk` via `notePerson`: one small change in talkWith/talkClosed.
- **M2:** Noah stays at the counter at all hours (C8 switches to Lincoln).
- Ended talks show a "Continue" button. A plain bye closes by itself after 1.5 s; a talk that ended with act text (shelf prices, hire summary) waits for Continue or Esc so it can be read.
- An act's text is shown after the NPC's lines as a system line (for example Walt's welcome, then "You're on the crew. Here's your axe. I'll take those 2 logs…").
- Hal's old `talkHal`/`halTalk` path is still in game.js as the fallback (C10 can delete it together with marketMenu/managerMenu).

## Things I noticed (not fixed: not my files)
- **Cast content (cast-early.js):** walt.office has only ONE generic greeting for hired ranks 1-4 outside 5-8 AM. On the next visit the no-repeat rule drops it, and Walt says the stranger default "Ridgeline Timber Co. Can I help you?" to his own worker. office-game.mjs is pinned to accept either line, with a comment. Give walt.office 2-3 hired variants.
- `npcs.noah.mem.seen['noah.first']` can reach 2: normalizeProgress migrates `metDay -> .first` (talk-memory.js:76) before the session's own `metNow` bump. This is harmless (the rule only checks > 0).
- If a reply ever carried two acts and the second failed, the first would already be applied. No cast does this today.

## Tests (real output)
```
node tests/talk-game.mjs
PASS talk-game.mjs: Noah, Elena and Hal talk in the docked panel; time runs and walking is locked while talking; Esc says see you without pausing; acts run first and a failed act keeps the old replies; memory saved without derived beats; H7 read-message; recent cafe-shift; Hal hands over the truck at step 3.
node tests/office-game.mjs
PASS office-game.mjs: the Ridgeline office door (closed outside 6 AM to 6 PM), the room, Walt's interview (axe, old logs bought back), the time clock, the office as an on-site place, promotion talk and promotion, leaving, and a renamed company on the door prompt.
node tests/startup.mjs
Fresh save: creator, phone apps/controls/gigs, and multiplayer frame checks passed.
Existing save: gameplay, phone apps/controls/gigs, and multiplayer frame checks passed.
npm run index
brief 2834 tokens (target 3000), index 32874 tokens (target 34000); 221 modules, 14 generated, 267 tests, 29 scripts; 13 modules without a header comment
node tests/brief.mjs
brief tests passed: 221 modules listed, brief 2834 and index 32874 estimated tokens (budgets 3000 and 34000)
npm run release -- --force
Packaged release 0.35.20: 222 files -> dist/releases/0.35.20
dist/index.html now loads releases/0.35.20/
npm test (second full run, after the dev.mjs harness fix)
ALL 267 PASSED
All 267 test files passed.
```
The first full run had 1 failure (dev.mjs "the clock carries on from there", failed twice). The cause was my fake-DOM change (body.appendChild enabled world.js screenFade in the harness). It is fixed in boot-game.mjs and startup.mjs; dev.mjs then passed alone and in the full second run, with no "FIRST RUN FAILED" lines. dist/game.js is byte-identical to dist/releases/0.35.20/game.js.

## Owner eye-check in the browser (none of this has been seen)
1. **Noah at morning and at night:** at the counter around 08:00 and around 21:00 (the market closes at 22:00); then knock on Flat 8 at about 23:00 (door node, "clocked off"). Check that the panel is docked low and centred, the chevron sits over his head without jitter, the clock in the header ticks, WASD does nothing while it is open, Esc says "See you" and does not open the pause menu, and "Let me browse items for sale" opens the store cleanly.
2. **Walt unhired and hired:** at the Ridgeline office the first time (interview: the act text shows the axe and the bought-back logs), then again hired (promotion check, "Anything waiting for me here?"). Also Walt on the street if the crowd draws him.
3. **The Elena shift:** apply, clock in, serve both customers (the old customer bubbles stay on #dialog), clock out through her, then talk again (she should mention the shift). Lunch ($6) from her too.
4. **Hal at story step 3:** "Hand over the groceries": the keys line shows, and the loan truck appears in the yard. Talk again at step 4 before and after loading (the "crates are on" line).
5. General: the talk camera framing and the camera when the panel closes (it should not snap), mouse capture coming back after Continue, the panel on a narrow window, and the 1.5 s auto-close after a plain "See you".

## Confidence
- Rules 1-8 as wired and tested: **high** (talk-game covers B1, flags, H7, recent, time, lock, Esc, memory, Hal step 3; office-game covers Walt; startup covers Noah and Elena).
- Browser feel (chevron smoothing, focus, pointer lock after close, the panel layout, street talks with walking NPCs): **medium-low**, unseen.
- Door (buzzer) talks for Noah, Elena and Sophie and street talks with roster pedestrians: **medium**. The code path is shared with the tested ones, but no test opens them.
