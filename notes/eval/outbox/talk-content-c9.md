michadr.

# Talk content pass — Stage C9 (`dist/cast-crowd.js` + `dist/npc-chat.js`)

## 1. Files created / changed (data files & tests only)
- `dist/cast-crowd.js`: 533 lines (new) — full `talk-engine` casts (`kind:'crowd'`) for all 19 non-roster `townPopulation().people` walkers (Alex, Malik Petrov, Marta & Anton Ellison, Tom & Hannah Reyes, Priya Nair, Peter Brennan, Jonas Carver, Robert, Julia, Carlos, Tessa Dalton, Megan, Jonas Hale, Naomi Castillo, Ruth Ibarra, Bruno Lindqvist, Henry Hale).
- `dist/npc-chat.js`: 39 lines (was 20 lines) — expanded `GREETINGS` (3 -> 5 per period) and `WEATHER_REMARKS` (2 -> 3 per weather), added `PLACE_REMARKS` (`bench`, `shop`, `diner`, `road`, 3 each) and optional `place` parameter in `chatLine`.
- `tests/talk-cast-crowd.mjs`: 94 lines (new) — verifies all 19 non-roster walkers are covered, runs `validateCasts` across all 28 casts (`EARLY_CAST` + `OAK_CAST` + `CROWD_CAST`), sweeps 1,026 contexts, and verifies place-aware `npc-chat.js` output.

`dist/cast-early.js`, `dist/cast.js`, `dist/talk-engine.js`, `dist/talk-validate.js`, and all forbidden shared files (`dist/game.js`, `dist/world.js`, `dist/neighborhood.js`, etc.) were left untouched.

---

## 2. Audit counts (before -> after)

### Before
- **Crowd `talk-engine` casts:** `0` (all 19 non-roster walkers only had `npc-chat.js` one-liners).
- **`dist/npc-chat.js`:** `GREETINGS` had 3 per period, `WEATHER_REMARKS` had 2 per weather, `0` place-aware remarks (`bench`, `shop`, `diner`, `road`).

### After
- **`dist/cast-crowd.js` (`CROWD_CAST`):** **19** `kind:'crowd'` casts, **5** nodes each (`door`, `open`, `work`, `rumour`, `tip`), **26** say variants + **4** `bye` variants each (**570** total authored variants), **3** first-person replies per opening (`<= 28` chars), `facts:{name, job, home, hint}` on all 19, `hired:'ridgeline'` vest reactions on all 19, all 6 `weather` types covered, and all 4 `period`s + `friend`/`close` tiers covered.
- **`dist/npc-chat.js`:** `GREETINGS` (`5` per period = 20), `WEATHER_REMARKS` (`3` per weather = 18), `PLACE_REMARKS` (`3` each for `bench`, `shop`, `diner`, `road` = 12).

---

## 3. Before / After sample lines (3 per group)

### Alex (`oak-apartments/1#1`)
| Context / Slot | Before | After |
|---|---|---|
| Street, first meeting | *(generic `npc-chat` greeting)* | `Hi there! I am Alex.` / `I live in Flat one at Oak Street Apartments.` |
| Street, Ridgeline vest | *(no vest reaction)* | `Nice Ridgeline vest! Good steady pay out at the timber yard.` |
| Tip (`alex.tip`) | `Elena at the café is hiring. Speak to her at the counter before starting work.` | `Elena at Alder Coffee is hiring—speak to her at the counter if you want a shift.` |

### Malik Petrov (`oak-apartments/11#2`)
| Context / Slot | Before | After |
|---|---|---|
| Street, morning | *(generic `npc-chat` greeting)* | `Good morning! Up since four pulling loaves out of the Ironwood ovens.` |
| Street, Ridgeline vest | *(no vest reaction)* | `Ridgeline vest! Hungry work—grab a fresh loaf at Corner Market.` |
| Tip (`malik.tip`) | *(no tip node)* | `Corner Market stocks my Ironwood Bakery loaves at three-fifty a loaf.` |

### Other crowd walkers & `npc-chat.js` places
| Person / Place | Before | After |
|---|---|---|
| Bruno Lindqvist (`weather:'fog'`) | *(generic fog remark)* | `Hard to spot the pump lights through Eastbank fog.` |
| Megan (`megan.tip`) | *(generic `npc-chat` line)* | `Watch your speed through Oak Street and Alder Center—the corners come up fast.` |
| `npc-chat.js` (`place:'bench'` / `'diner'`) | *(no `place` awareness)* | `Just resting my feet on the bench for five minutes.` / `Smell of fresh coffee by the diner gets me every time.` |

---

## 4. Validator and test output (pasted real output)

### `node scripts/talk-check.mjs dist/cast-crowd.js --problems-only`
```text
===== Marta Ellison (marta) =====
No problems for Marta Ellison.
===== Anton Ellison (anton) =====
No problems for Anton Ellison.
===== Tom Reyes (tom) =====
No problems for Tom Reyes.
===== Hannah Reyes (hannah) =====
No problems for Hannah Reyes.
===== Priya Nair (priya) =====
No problems for Priya Nair.
===== Peter Brennan (peter) =====
No problems for Peter Brennan.
===== Alex (alex) =====
No problems for Alex.
===== Jonas Carver (jonas-carver) =====
No problems for Jonas Carver.
===== Robert (robert) =====
No problems for Robert.
===== Julia (julia) =====
No problems for Julia.
===== Carlos (carlos) =====
No problems for Carlos.
===== Tessa Dalton (tessa) =====
No problems for Tessa Dalton.
===== Megan (megan) =====
No problems for Megan.
===== Jonas Hale (jonas-hale) =====
No problems for Jonas Hale.
===== Naomi Castillo (naomi) =====
No problems for Naomi Castillo.
===== Malik Petrov (malik) =====
No problems for Malik Petrov.
===== Ruth Ibarra (ruth) =====
No problems for Ruth Ibarra.
===== Bruno Lindqvist (bruno) =====
No problems for Bruno Lindqvist.
===== Henry Hale (henry) =====
No problems for Henry Hale.
```

### All talk & NPC tests (`talk-cast`, `talk-cast-oak`, `talk-cast-crowd`, `talk-engine`, `talk-validate`, `talk-memory`, `talk-panel`, `talk-stuck`, `npc-chat`, `npc-dialogue`, `talk-badge`)
```text
=== talk-cast ===
PASS talk-cast.mjs: 5 early casts validated (0 errors, 0 warnings), 762 sweep contexts (17180 terminal walks, 36847 bubbles, zero cycles/repeats/time-leaks), castOf + pinned phrases passed.
=== talk-cast-oak ===
PASS talk-cast-oak.mjs: 4 Oak/Cedar casts validated against 5 early casts (0 errors, 0 warnings), 376 sweep contexts (3670 terminal walks, 4628 bubbles), pinned checks passed.
=== talk-cast-crowd ===
PASS talk-cast-crowd.mjs: 19 crowd casts validated against 9 named casts (0 errors, 0 warnings), 1026 sweep contexts (4104 terminal walks, 3040 bubbles), place-aware npc-chat passed.
=== talk-engine ===
Talk engine: period picks and edges, the current time on every turn, specificity and w, one variant per turn (no glue), no repeats within last (8 variants x 25 talks), least-recent fallback, replay determinism, unknown go (strict throws, runtime hides), effects as data and same-talk beats, talkContext from progress, memory caps, all 20 conditions, garbage in, inputs frozen, no clock or chance.
=== talk-validate ===
Talk validator: good cast has zero problems; the bad cast fires all 11 rules (15 codes) exactly once with person, node, line, what and how; the 7 shape and voice extras once each; time words, glue, ids, slots, cross-cast repeats, the coverage sweep, garbage in, inputs untouched.
=== talk-memory ===
PASS talk-memory: caps (6/32/16, 48 people), junk, frozen, helpers, old 0.35.18 save loads unchanged, migration beats, Elena met via the cafe, once only
=== talk-panel ===
PASS talk-panel
=== talk-stuck ===
PASS talk-stuck.mjs: the docked talk panel renders in the real index.html tree (no hidden ancestor such as #settings), sits at body level, and a panel already there is not moved.
=== npc-chat ===
PASS npc-chat: 28 people greet by name, deterministic, time of day, home and job facts, garbage safe
=== npc-dialogue ===
PASS npc-dialogue: talk effects and caps, Oscar refusal, Lincoln pages and sulk, Brentster steers, met set and save round trip, People rows (unmet hidden), door-knock table, roster planner (sick stay home)
=== talk-badge ===
PASS talk-badge.mjs: portrait initial/colour deterministic across 10 names (6 colours), friendly tier/mood chip mapping, and purity.
```

### `npm run index; node tests/brief.mjs`
```text
brief 2834 tokens (target 3000), index 36103 tokens (target 37000); 256 modules, 14 generated, 307 tests, 30 scripts; 13 modules without a header comment
brief tests passed: 256 modules listed, brief 2834 and index 36103 estimated tokens (budgets 3000 and 37000)
```

---

## 5. What I could NOT verify
- Nothing was heard or seen in a live browser.
- `npm run release -- --force` and full `npm test` were NOT run because another agent is editing `dist/game.js`.
- `dist/cast.js` was intentionally left untouched (still exports `EARLY_CAST` only), so `dist/cast-crowd.js` is not yet wired into `talkWith` in-game.

---

## 6. Exact requested edits for unwired / forbidden files
1. **`dist/cast.js` (when ready to wire C8 + C9 into `talkWith`):**
   - Import `OAK_CAST` from `./cast-oak.js` and `CROWD_CAST` from `./cast-crowd.js`, and export `CASTS = [...EARLY_CAST, ...OAK_CAST, ...CROWD_CAST]`.
2. **`dist/game.js` (`talkCrowd` at ~line 1048):**
   - Pass `weather` and `place` (`'bench'|'shop'|'diner'|'road'` from the walker's nearby landmark/stop) into `chatLine(person, {day, minute, weather, place})`, or route `talkCrowd` through `talkWith` once `CROWD_CAST` is wired in `cast.js`.

---

## 7. QUESTIONS FOR THE OWNER
1. When `game.js` is idle, should `cast.js` wire `OAK_CAST` and `CROWD_CAST` into `talkWith` (replacing `talkCrowd`'s `chatLine` toast with the full talk panel), or keep `chatLine` for quick street barks?
2. Any crowd walker's tone or local hint you want adjusted before wiring?

---

## 8. Confidence
- **High:** `dist/cast-crowd.js` and `dist/npc-chat.js` syntax, validator compliance (`talk-check.mjs` 0 problems across all 19 crowd casts), cross-cast uniqueness across all 28 casts, all 11 talk/NPC test suites passing, and `brief.mjs` passing within the 37000-token index budget (36103).
- **Medium:** Live in-game feel of place-aware `npc-chat` remarks and `CROWD_CAST` dialogues once wired in `cast.js` and `game.js`.
