michadr.
# Stage C4 Report: Early Cast (`dist/cast-early.js`, `dist/cast.js`, `tests/talk-cast.mjs`)

- **Agent & model routing:** Performed directly by the Orchestrator (**Opus-equivalent**, strongest reasoning model) for design/schema verification, authoring all 5 casts, writing `dist/cast.js` and `tests/talk-cast.mjs`, and running all checks. No Flash or subagents were spawned.
- **Repo hygiene:** Only new files listed below plus regenerated `PROJECT-INDEX.md` / `PROJECT-BRIEF.md` (`npm run index`). Zero existing source or shared files edited; no `git`, no `npm run release`, no full `npm test`. All created files verified UTF-8 without BOM.

## Files Created

| File | Lines | `hasBOM` | Header Length | Purpose |
| --- | ---: | --- | ---: | --- |
| `dist/cast-early.js` | 601 | `False` | 86 chars | `NOAH`, `HAL`, `WALT`, `ELENA`, `SOPHIE`, `EARLY_CAST` (deeply frozen) |
| `dist/cast.js` | 12 | `False` | 94 chars | `CASTS`, `castOf(who)` (matches `id`, `personId`, or `name`, case-insensitive) |
| `tests/talk-cast.mjs` | 187 | `False` | 42 chars | `validateCast`/`validateCasts`, `castOf`, 762-context BFS sweep, pinned phrases |
| `notes/eval/outbox/C4-cast-early.md` | — | `False` | — | This report |

## Real Check & Index Output

### 1. Cast Sweep, Pinned Phrases & `scripts/talk-check.mjs`

```text
PASS talk-cast.mjs: 5 early casts validated (0 errors, 0 warnings), 762 sweep contexts (19379 terminal walks, 39657 bubbles, zero cycles/repeats/time-leaks), castOf + pinned phrases passed.
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

*(Checked both together via `node scripts/talk-check.mjs dist/cast-early.js --problems-only` and individually via bare ids `node scripts/talk-check.mjs <id> --problems-only` using `dist/cast.js`.)*

### 2. Index Budget (`npm run index` & `node tests/brief.mjs`)

```text
> city-life-local-multiplayer@0.35.19 index
> node scripts/build-index.mjs

brief 2834 tokens (target 3000), index 32342 tokens (target 32500); 217 modules, 14 generated, 262 tests, 29 scripts; 13 modules without a header comment
brief tests passed: 217 modules listed, brief 2834 and index 32342 estimated tokens (budgets 3000 and 32500)
```

Index headroom remaining: **`158` tokens** (`32,342` / `32,500`). Header lines kept under 95 chars (`86` and `94` for `dist/`, `42` for test).

### 3. Existing Talk Tests (`talk-engine.mjs`, `talk-memory.mjs`, `talk-validate.mjs`)

```text
Talk engine: period picks and edges, the current time on every turn, specificity and w, one variant per turn (no glue), no repeats within last (8 variants x 25 talks), least-recent fallback, replay determinism, unknown go (strict throws, runtime hides), effects as data and same-talk beats, talkContext from progress, memory caps, all 20 conditions, garbage in, inputs frozen, no clock or chance.
PASS talk-memory: caps (6/32/16, 48 people), junk, frozen, helpers, old 0.35.18 save loads unchanged, migration beats, Elena met via the cafe, once only
```

**Reproduced pre-existing regression triggered by creating `dist/cast.js` (`node tests/talk-validate.mjs`, re-run once per `AGENTS.md`):**

```text
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /is not a file/. Input:

'talk-check: no cast "C:\\Users\\Michael\\AppData\\Local\\Temp\\talkcheck-XjthoI\\missing.mjs" in C:\\Users\\Michael\\AppData\\Local\\Temp\\talkcheck-XjthoI\\missing.mjs; found: noah, hal, walt, elena, sophie'

    at file:///C:/Users/Michael/Documents/Projects/simproject/tests/talk-validate.mjs:135:208
```

- **Why:** In `scripts/talk-check.mjs:74-75`, when `arg` (`missing.mjs`) is not a file on disk, `load()` used `if (!fs.existsSync(reg)) throw ... "${arg}" is not a file...` while `dist/cast.js` did not exist yet. Now that `dist/cast.js` exists, `load()` falls through to `castOf(arg)` instead of failing fast when `arg` is clearly a file path.
- **Requested edit (not made by me, new-files-only rule):** In `scripts/talk-check.mjs:74`, before resolving `dist/cast.js`, add:
  `if (/[\\/]|\.(m?js)$/i.test(arg)) throw new Error(\`"\${arg}" is not a file.\`);`

---

## Sample Transcripts (`node scripts/talk-check.mjs <id>`)

```text
===== Noah (noah) =====
--- morning, stranger (first meeting), place: counter, story: 0 ---
  Noah: Welcome in! I am Noah, and you look like you just moved into the studio.
  Noah: We keep fresh food, tools and packs from seven until ten. Could you help me with one bag?
    (effects: meet)
  you could say: "What is on the shelves today?" | "Any work going?" | "Let me browse items for sale." | "What is new round town?" | "See you"

===== Hal Brennan (hal) =====
--- afternoon, friend, place: farm, story: 3 ---
  Hal Brennan: You must be Noah's helper. My knee says thank you.
  Hal Brennan: My old Shortbed has stood since spring. Take her for the day if you can drive.
    (effects: meet)
  you could say: "Hand over the groceries" | "Tell me about the Shortbed." | "How is the egg coop looking?" | "Ask about Walt Hargrove." | "How is that knee holding up?" | "Seen your son Peter lately?" | "See you"

===== Walt Hargrove (walt) =====
--- morning, stranger (first meeting), place: office, story: 6 ---
  Walt Hargrove: Hal Brennan sent word you had a hand with his crates. If Hal vouches for you, my counter is open.
  Walt Hargrove: Come up to the desk—let us get you sorted. Can I help you with work?
    (effects: meet, beat:walt.note, standing+1)
  you could say: "I am looking for work." | "How does a Ridgeline shift work?" | "What is moving at the sawmill and warehouse?" | "What safety rules do I need to know?" | "See you"

===== Elena (elena) =====
--- morning, acquaintance, place: cafe ---
  Elena: Hi there! Fresh roast is on and the tables are spotless.
  Elena: What can I help you with?
    (effects: meet)
  you could say: "Let us talk about cafe work." | "I would like something to eat and drink." | "How are supplies holding up?" | "How do Oak Street regulars treat you?" | "See you"

===== Sophie (sophie) =====
--- evening, friend, place: street, story: 2 ---
  Sophie: Hey! You are Noah’s runner who dropped my groceries by 18 Oak Street, aren’t you? Thank you!
  Sophie: Saved me two trips with sore arms.
    (effects: meet, beat:sophie.thanked, standing+1, mood+2)
  you could say: "About those market groceries..." | "Who else lives in 18 Oak Street?" | "Need a hand with errands?" | "Fancy grabbing a coffee sometime?" | "Know the story with Studio 2B?" | "See you"
```

---

## Exact `dist/game.js` Hooks Needed by Stage C6 for the `ACTS` Map

Line numbers verified in `dist/game.js` (remember another agent may edit `game.js`; grep by function name):

| `act` id in cast | Used on | Existing `dist/game.js` handler to invoke | Notes for C6 |
| --- | --- | --- | --- |
| `openStore` | Noah | `openStore()` (`:629`) | Close talk panel (`modal=false`) before opening `storeUI`. |
| `gigBoard` | Noah | `marketWork()` (`:616-619`) or open Phone Gigs tab | `marketWork` currently opens `#dialog` with `marketContracts` + `skipChoice`; or open `phone` to Gigs. |
| `shelves` | Noah | `shelfLines()` (`:622`) | Append/toast `shelfLines().join(' | ') || 'The shelves are being restocked.'` into `#talk` log. |
| `hal.groceries` | Hal | Body of `halChoice('groceries')` (`:493`) | Call `startLoan(GameState.progress)`, `driving.sync`, `notifyPhone('player', r.text)`, `persist()`. Do **not** call `speak(...)`; `hal.loan` already displays `'Keys are in her. Four crates of eggs are on the pallet by the barn: take them to Noah.'`. |
| `hal.buy` | Hal | Body of `halChoice('buy')` (`:493`) | Call `buyFromHal(GameState.progress)`, `driving.sync`, `persist()`, `toast(r.text)`. |
| `walt.hire` | Walt | Body of `interview(o)` (`:594-596`) | Call `hire(GameState.progress, 'ridgeline')`, `persist()`, `toast('Hired · '+...)`. Append `r.owed` / `r.boughtBack` summary if non-empty. |
| `walt.promote` | Walt | `promote` / `nextRank` (`:597-601`) | If `!n || n.top` or `!n.ready`, append `promotionTalk`'s real requirements message (`Not yet. To be a ...`) or `promote(...)` result + `'promoted'` into `recentEvents()`. |
| `walt.collect` | Walt | `collectOwed(GameState.progress, 'ridgeline')` (`:591`) | If `r.error`, toast `r.error`; else `persist()` and append `'Here you go: ...'`. |
| `cafe.hire` | Elena | `commitCafe('hire')` (`:577`) | Runs `cafeTransaction(GameState.progress, 'hire', me.position, shop)`. (Only enabled when `place` is `cafe`/`counter`.) |
| `cafe.clockin` | Elena | `commitCafe('clockin')` (`:577`) | Runs `cafeTransaction(GameState.progress, 'clockin', me.position, shop)`. |
| `cafe.clockout` | Elena | `commitCafe('clockout')` (`:577`) | Runs `cafeTransaction(..., 'clockout', ...)`; push `'cafe-shift'` into `recentEvents()`. |
| `cafe.meal` | Elena | `useLife('meal')` (`:574`) | Charges $6 / calls `storyEvent('ate')`. |
| `job.pickup` | Noah | `finishJob('pickup')` (`:547-552`) | Collects Sophie's grocery bag at Corner Market. |
| `job.deliver` | Elena | `finishJob('deliver')` (`:547-552`) | Delivers Corner Market produce bag to Alder Coffee ($14). Push `'delivered:sophie'` when beat 1 `delivered` fires (`:550`). |
| `skipStory` | Noah | `skipStarter()` body (`:535`) | `GameState.progress={...GameState.progress, starter:skipStarter()}; persist(); toast('Introduction skipped.');`. |

Additional `talkContext` / memory hooks C6 should wire:
1. Push into `recentEvents()` ring (checked by casts): `'delivered:sophie'`, `'egg-run'`, `'promoted'`, `'cafe-shift'`.
2. When `storyEvent('loaded')` fires (`:531`), also set beat `'hal.loaded'` in `npcs.hal.mem` (or pass `'hal.loaded'` when `starter.loaded` is true) so `hal.open` switches from `'Four crates of eggs are on the pallet...'` to `'The crates are on. Noah is waiting, so mind the bumps.'`.
3. Persist session memory on end or walk-away via `remember(mem, session)` + `withMem(...)` (roster) / `notePerson(...)` (non-roster), and apply `meet`, `standing` (`gainStanding`), `mood`, and `topic` (`talk()`).

---

## What Could NOT Be Verified & Confidence

- **Not verified:**
  - Live in-game play in a browser (`dist/talk-panel.js` and C6 `dist/game.js` wiring do not exist yet).
  - Full `npm test` / `npm run release` (excluded per task instructions).
- **Confidence:**
  - **Cast quality, rule compliance & sweep coverage (`NOAH`, `HAL`, `WALT`, `ELENA`, `SOPHIE`, `castOf`):** **High** — `validateCasts` reports `0` errors / `0` warnings; `762` contexts (`19,379` walks, `39,657` bubbles) passed with `{strict: true}`, zero repeats, zero cycles, valid time words, and verified prices/hours from `world-goods.js`, `items.js`, `map-definition.js`, `orders.js`, `starter.js`, and `cafe-job.js`.
  - **Index budget headroom:** **High** — `npm run index` and `tests/brief.mjs` passed at `32,342 / 32,500` tokens.
  - **`scripts/talk-check.mjs` + `tests/talk-validate.mjs` interaction:** **Medium-High** — diagnosed exact 1-line fix needed in `scripts/talk-check.mjs:74` for C6/main chat.
