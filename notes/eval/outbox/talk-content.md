michadr.

# Talk content pass (`hydrogen-talk-content.md`)

## 1. Files changed (data files only)
- `dist/cast-early.js`: 680 lines (was 615 lines) — Noah, Hal Brennan, Walt Hargrove, Elena, Sophie.
- `dist/npc-roster.js`: 129 lines (was 129 lines) — fixed 3 false-promise / outdated lines for Grace, Ray (dormant), and Elena's tip.
- `dist/npc-chat.js`: 20 lines (was 20 lines) — warmed up crowd `GREETINGS` and `WEATHER_REMARKS` (added `cloudy` and `storm` so all 6 `WEATHERS` are covered).

No engine, validator, or forbidden shared files (`game.js`, `talk-engine.js`, `talk-validate.js`, `world.js`, etc.) were modified.

---

## 2. Audit counts (before -> after)

### `dist/cast-early.js` (per person & relationship tier)
| Person | Nodes | Variants (before -> after) | Bye variants | Reply labels >40 chars (before -> after) | `weather` conds | `hired` (vest) conds | `tier` conds (total: stranger / acq / friend / close) |
|---|---:|---:|---:|---:|---:|---:|---|
| **Noah** | 13 | 51 -> 72 | 4 -> 7 | 2 -> 0 | 0 -> 10 | 0 -> 3 | 3 -> 10 (0 / 1 / 5 / 4) |
| **Hal Brennan** | 10 | 38 -> 46 | 2 -> 5 | 0 -> 0 | 0 -> 4 | 1 -> 3 | 2 -> 5 (0 / 0 / 3 / 2) |
| **Walt Hargrove** | 11 | 30 -> 36 | 2 -> 4 | 2 -> 0 | 0 -> 3 | 11 -> 17 | 0 -> 3 (0 / 0 / 1 / 2) |
| **Elena** | 11 | 32 -> 44 | 2 -> 4 | 2 -> 0 | 0 -> 5 | 0 -> 4 | 0 -> 4 (0 / 0 / 3 / 1) |
| **Sophie** | 10 | 33 -> 41 | 2 -> 4 | 0 -> 0 | 0 -> 3 | 0 -> 2 | 3 -> 7 (0 / 0 / 5 / 2) |

*(Note: `stranger` openings are also gated by `met:false` in entry nodes; `any`-tier variants serve as fallbacks so the coverage sweep passes every context.)*

### `dist/npc-roster.js` (Grace, Oscar, Lincoln, Brentster, plus roster mood/greeting tables)
- **11 roster entries** (9 active + 2 dormant: `foreman`, `driver`): 15 mood lines each (`3` per band: `miserable`, `low`, `okay`, `good`, `delighted`), `12` greetings each (`3` per tier: `stranger`, `acquaintance`, `friend`, `close` — custom for `oscar`, `lincoln`, `brentster`, shared `DEFAULT_GREETINGS` for the rest).
- **7** Lincoln hunting topics (3 lines each), **13** `KNOCK_LINES`, **6** `TOWN_LINES`, **11** `TIPS`.

### `dist/npc-chat.js` (20+ crowd walkers: Alex, Malik, Naomi, Peter, etc.)
- `GREETINGS`: `3` per period (`morning`, `afternoon`, `evening`, `night`).
- `WEATHER_REMARKS`: `rain` (2), `cloudy` (2, added), `storm` (2, added), `fog` (2, was 1), `snow` (2, was 1), `clear` (2).

### Key audit problems found
1. **Zero weather reactivity:** All 5 early-cast people had `0` `weather` conditions; `npc-chat.js` lacked `cloudy` and `storm`.
2. **Missing tier differentiation:** Walt and Elena had `0` tier-specific variants; Noah, Hal, and Sophie had `0` `close`-tier variants.
3. **No Ridgeline vest / job awareness outside Walt & Hal:** Noah, Elena, and Sophie never noticed the player's Ridgeline hi-vis vest (`hired:'ridgeline'`).
4. **Stiff / long / non-first-person option labels:** Labels like `"Ask about Walt Hargrove."`, `"Read me today’s exact prices."`, `"Let me browse items for sale."`, `"Tell me about Naomi and the Oak Street regulars."` (48 chars), and `"Wait, you post restock jobs when stock drops?"` (45 chars). All reply labels are now first-person and `<= 40` chars.
5. **Overcrowded option lists:** Nodes like `noah.counter`, `hal.open`, `walt.office`, `elena.work` had 5–6 replies unconditionally. Gated secondary topics so at most 4 authored options show at once (plus the engine's `See you` last).
6. **False promises / outdated facts in `npc-roster.js`:** Grace invited you inside for supper (`"Come in, come in, stay for supper."`), dormant Ray offered a lift (`"You want a lift to the yard?"`), and Elena's tip still described the old two-customer diner shift instead of `$8/hr + tips`.

---

## 3. Before / After sample lines (3 per person)

### Noah
| Context / Slot | Before | After |
|---|---|---|
| Counter, Ridgeline vest | *(no vest reaction)* | `Morning! Hard to miss that Ridgeline vest—up early for the woods?` / `Grab coffee or a snack before you head over.` |
| Counter, rain | *(no weather reaction)* | `Wet day out there! Shake your coat off by the door.` / `Warm coffee and dry shelves in here, at least.` |
| Reply option (`noah.shelves`) | `Wait, you post restock jobs when stock drops?` (45 chars) | `You post restock jobs?` (22 chars) |

### Hal Brennan
| Context / Slot | Before | After |
|---|---|---|
| Farm, Ridgeline vest | *(no greeting reaction)* | `Good seeing that Ridgeline vest out here.` / `Walt keeping you and Peter busy?` |
| Farm, close friend morning | *(same as friend)* | `Morning. Poured you a mug—coffee is on the stove.` / `Good to have someone I trust around the place.` |
| Reply option (`hal.open`) | `Ask about Walt Hargrove.` (third-person) | `How is Walt to work for?` (first-person) |

### Walt Hargrove
| Context / Slot | Before | After |
|---|---|---|
| Office, Ridgeline rank 2+ | `Good to see you. Keep your gloves on and your eyes on the work.` | `Good to see you. Vest on, eyes on the work.` / `Office runs six to six for gear or promotion papers.` |
| Office, close friend | *(same as stranger)* | `There is my best hand. Pull up a chair a second if you need papers or gear.` |
| Reply option (`walt.office`) | `What is moving at the sawmill and warehouse?` (44 chars) | `How is the mill running?` (24 chars) |

### Elena
| Context / Slot | Before | After |
|---|---|---|
| Cafe, Ridgeline vest + rain | *(no vest/weather reaction)* | `Came in out of the rain in that Ridgeline vest?` / `Let me pour you something warm.` |
| Cafe, close friend | *(same as stranger)* | `Hey, my favourite customer! Fresh pot just finished.` / `What can I get you?` |
| Reply option (`elena.door`) | `Tell me about Naomi and the Oak Street regulars.` (48 chars) | `Tell me about the regulars.` (27 chars) |

### Sophie
| Context / Slot | Before | After |
|---|---|---|
| Street, rain | *(no weather reaction)* | `Of course it rains the minute I step out without a hood!` / `How are you holding up?` |
| Street, close friend | *(same as friend)* | `Hey, my favourite neighbour! Got two minutes to catch up?` |
| Coffee invite (`sophie.coffee`) | `...we ought to grab two chairs at Alder Coffee once your truck runs steady.` | `Truthfully, I live on Elena’s lattes—come grab a cup at Alder Coffee sometime.` |

### Crowd / Roster (`npc-roster.js` & `npc-chat.js`)
| Person / Slot | Before | After |
|---|---|---|
| Grace (`npc-roster.js`, delighted) | `Come in, come in, stay for supper.` | `Lovely to see you, dear. Pull up a chair on the porch a minute.` |
| Elena (`npc-roster.js`, `TIPS`) | `Shifts run from eight. Serve two customers, reset the table, and I pay you the same day.` | `Shifts run eight to five: eight bucks an hour plus tips, and a bonus when you clear the tasks.` |
| Crowd walkers (`npc-chat.js`, `storm`) | *(missing; fell back to `clear`)* | `Rough storm blowing through—stay safe out there.` |

---

## 4. Validator and test output (pasted real output)

### `node scripts/talk-check.mjs dist/cast-early.js --problems-only`
```text
===== Noah (noah) =====
No problems for Noah.
===== Hal Brennan (hal) =====
No problems for Hal Brennan.
===== Walt Hargrove (walt) =====
No problems for Walt Hargrove.
===== Elena (elena) =====
No problems for Elena.
===== Sophie (sophie) =====
No problems for Sophie.
```

### Talk & NPC tests (`talk-cast`, `talk-engine`, `talk-validate`, `talk-memory`, `talk-panel`, `talk-stuck`, `npc-chat`, `npc-dialogue`, `talk-badge`)
```text
=== talk-cast ===
PASS talk-cast.mjs: 5 early casts validated (0 errors, 0 warnings), 762 sweep contexts (17180 terminal walks, 36847 bubbles, zero cycles/repeats/time-leaks), castOf + pinned phrases passed.
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

---

## 5. What I could NOT verify
- Nothing was heard or seen in a live browser.
- `npm run release -- --force` and `npm test` were NOT run because another agent (Opus WebGPU T5) is actively editing `dist/game.js`. Therefore `tests/talk-game.mjs` (which runs against the packaged release) was not re-run after my edits.

---

## 6. Exact requested edits for forbidden files
1. **`dist/game.js` (`talkCtx` at ~line 587 and `talkCrowd` at ~line 1048):**
   - `talkCtx` currently hardcodes `weather:'clear'`. Pass the live weather state when weather is active so the new `weather` variants fire in-game.
   - `talkCrowd` currently omits `weather` in `chatLine(person, {day:..., minute:...})`. Pass `weather` there too so crowd walkers use `WEATHER_REMARKS`.
2. **`dist/game.js` (`talkFlags` at ~line 586) + `dist/talk-engine.js` (`DERIVED_FLAGS` at line 25):**
   - Optional: right now, Ridgeline vest reactions use `hired:'ridgeline'` (which covers everyone employed at Ridgeline). If you want NPCs to react strictly to the player *wearing* the hi-vis vest outfit (`appearance.js` `Worker`), add `'vest'` to `DERIVED_FLAGS` in `dist/talk-engine.js` and `vest: ...` to `talkFlags()` in `dist/game.js`.

---

## 7. QUESTIONS FOR THE OWNER
1. Should Ridgeline vest lines stay tied to `hired:'ridgeline'` (always active once hired at Ridgeline), or should a later `game.js` + `talk-engine.js` edit add a `vest` derived flag for the equipped Worker outfit?
2. Should `cast-oak.js` (full `talk-engine` graphs for Oscar, Lincoln, Brentster, Grace) and `cast-crowd.js` (20+ crowd walkers including Alex and Malik) be scheduled as the next content stages (C8/C9)?

---

## 8. Confidence
- **High:** `dist/cast-early.js`, `dist/npc-roster.js`, and `dist/npc-chat.js` syntax, validator compliance (`talk-check.mjs` 0 problems), and all 9 pure talk/NPC test suites passing.
- **Medium:** Live in-game feel of weather/vest triggers (weather lines wait on `game.js` passing live weather instead of `'clear'`, and packaged-release verification waits until `game.js` is idle for `npm run release -- --force`).
