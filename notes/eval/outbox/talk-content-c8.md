michadr.

# Talk content pass — Stage C8 (`dist/cast-oak.js`)

## 1. Files created / changed (data files & tests only)
- `dist/cast-oak.js`: 402 lines (new) — full `talk-engine` casts for Oscar Masic, Lincoln Brambly, Brentster Lewis, and Grace Whitfield (`OAK_CAST`).
- `tests/talk-cast-oak.mjs`: 120 lines (new) — validator, cross-cast uniqueness check against `dist/cast-early.js`, 376-context breadth-first sweep, and pinned behaviour checks.

`dist/cast-early.js`, `dist/cast.js`, `dist/talk-engine.js`, `dist/talk-validate.js`, and all forbidden shared files (`dist/game.js`, `dist/world.js`, etc.) were left untouched.

---

## 2. Audit counts (before -> after)

### Before (legacy `dist/npc-roster.js` + `dist/npc-dialogue.js`)
- **Oscar Masic:** 15 mood lines, 12 custom greetings, 2 flat topics (`chat`, `tips`), `0` weather conditions, `0` period conditions, `0` Ridgeline vest (`hired:'ridgeline'`) reactions, `0` `doorway` vs `street` nodes.
- **Lincoln Brambly:** 15 mood lines, 12 custom greetings, 7 hunting topics (21 static lines) + 1 `chat` ("Something else"), `0` weather/period/vest conditions, `0` `counter` vs `door` vs `street` nodes (ignored his evening Corner Market clerk job).
- **Brentster Lewis:** 15 mood lines, 12 custom greetings, 3 cat answers + 5 `CAT_STEERS` + 1 `chat`, `0` weather/period/vest conditions, `0` `counter` vs `door` vs `street` nodes (ignored his Ironwood Store job).
- **Grace Whitfield:** 15 mood lines, shared `DEFAULT_GREETINGS` (no custom greetings), 3 generic `COMMON_TOPICS` (`chat`, `town`, `tips`), `0` weather/period/vest conditions, `0` `doorway` vs `street` nodes.

### After (`dist/cast-oak.js`)
| Person | Nodes | Variants | Bye variants | Max reply label | `weather` conds | `hired` (vest) conds | `tier` conds (total: str / acq / friend / close) |
|---|---:|---:|---:|---:|---:|---:|---|
| **Oscar Masic** | 6 | 44 | 6 | 28 chars | 6 | 4 | 14 (0 / 1 / 9 / 4) |
| **Lincoln Brambly** | 10 | 45 | 6 | 31 chars | 8 | 4 | 6 (0 / 0 / 3 / 3) |
| **Brentster Lewis** | 7 | 41 | 6 | 24 chars | 7 | 2 | 6 (0 / 0 / 3 / 3) |
| **Grace Whitfield** | 5 | 34 | 6 | 29 chars | 8 | 2 | 6 (0 / 0 / 4 / 2) |

*(All reply labels are first-person, `<= 31` chars, and at most 4 authored options show at once before `See you`.)*

---

## 3. Before / After sample lines (3 per person)

### Oscar Masic
| Context / Slot | Before | After |
|---|---|---|
| Doorway, 10:00–12:00, stranger | `"I do not know you. Go away." Through the door.` | `I do not know you.` / `State your business or move along.` |
| Doorway, outside 10:00–12:00 | *(generic `door-closed` knock line)* | `Door stays shut after noon.` / `Come back tomorrow between ten and noon.` |
| Doorway, Ridgeline vest (friend) | *(no vest reaction)* | `Ridgeline vest. Good.` / `At least you work for a living.` |

### Lincoln Brambly
| Context / Slot | Before | After |
|---|---|---|
| Counter, evening, Ridgeline vest | *(no counter node or vest reaction)* | `Evening! Spot that Ridgeline vest straight away.` / `Long shift out in the timber? Tell me if you saw any deer by the cut.` |
| Hunting topic (`lincoln.hunt`) | *(static 3-page dump, "Something else" cost mood)* | `Once I sat four hours in the cold for one clean deer shot.` / `Wind has to come to you, never from you—that is the whole trick.` *(branches to `Where do you hunt?`, `What rifle or scope do you use?`, `Need any gear or ammo?`)* |
| Weather (`snow`) | *(no weather reaction)* | `Fresh snow! Best tracking weather of the year, honestly.` / `Grabbing warm supplies?` |

### Brentster Lewis
| Context / Slot | Before | After |
|---|---|---|
| Counter, first meeting | *(no Ironwood Store counter node)* | `Oh, hello! Welcome into Ironwood Store—I am Brentster.` / `Sorry if I look distracted; my cat Junior knocked my keys behind the counter.` |
| Ridgeline vest | *(no vest reaction)* | `I like that Ridgeline vest—bright enough that Junior would spot you from Flat eleven!` / `Busy shift at the mill?` |
| Junior / vet (`brentster.vet`) | `The vet says he is fine. I do not believe her.` | `The vet says he is completely fine, just dramatic.` / `I do not entirely believe her, though Junior did eat two treats on the way out.` |

### Grace Whitfield
| Context / Slot | Before | After |
|---|---|---|
| Doorway, close friend | *(shared `DEFAULT_GREETINGS`, no porch distinction)* | `What a wonderful surprise!` / `Pull up a chair on the porch a minute and catch your breath.` |
| Weather (`rain`) | *(no weather reaction)* | `Lovely steady rain for the garden, though I am glad of the porch roof!` / `Come stand under the eaves a moment.` |
| Ridgeline vest | *(no vest reaction)* | `I see that bright Ridgeline vest from the porch!` / `Hard work up in the timber, I expect.` |

---

## 4. Validator and test output (pasted real output)

### `node scripts/talk-check.mjs dist/cast-oak.js --problems-only`
```text
===== Brentster Lewis (brentster) =====
No problems for Brentster Lewis.
===== Grace Whitfield (grace) =====
No problems for Grace Whitfield.
===== Lincoln Brambly (lincoln) =====
No problems for Lincoln Brambly.
===== Oscar Masic (oscar) =====
No problems for Oscar Masic.
```

### `node tests/talk-cast-oak.mjs`
```text
PASS talk-cast-oak.mjs: 4 Oak/Cedar casts validated against 5 early casts (0 errors, 0 warnings), 376 sweep contexts (3670 terminal walks, 4628 bubbles), pinned checks passed.
```

---

## 5. What I could NOT verify
- Nothing was heard or seen in a live browser.
- `npm run release -- --force` and full `npm test` were NOT run because another agent is editing `dist/game.js`.
- `dist/cast.js` was intentionally left untouched (still exports `EARLY_CAST` only), so `dist/cast-oak.js` is not yet wired into `talkWith` in-game.

---

## 6. Exact requested edits for unwired / forbidden files
1. **`dist/cast.js` (when ready to wire C8 into `talkWith`):**
   - Import `OAK_CAST` from `./cast-oak.js` and export `CASTS = [...EARLY_CAST, ...OAK_CAST]` (and update `tests/talk-cast.mjs` line 9 & 22 accordingly).
2. **`dist/game.js` (`talkCtx` at ~line 587):**
   - Already noted in `talk-content.md`: pass live `weather` instead of hardcoded `'clear'` so weather variants fire in-game.

---

## 7. QUESTIONS FOR THE OWNER
1. Should `dist/cast.js` be wired to include `OAK_CAST` in a follow-up stage once `game.js` is idle, or bundled with C10 cleanup?
2. Should Brentster's Ironwood Store counter offer `openStore` (currently Corner Market only) or stay dialogue-only?

---

## 8. Confidence
- **High:** `dist/cast-oak.js` syntax, validator compliance (`talk-check.mjs` 0 problems), cross-cast uniqueness against `dist/cast-early.js`, and `tests/talk-cast-oak.mjs` passing all 376 sweep contexts.
- **Medium:** Live in-game feel of doorway/counter/weather triggers once `cast.js` and `game.js` wire `OAK_CAST` and live weather.
