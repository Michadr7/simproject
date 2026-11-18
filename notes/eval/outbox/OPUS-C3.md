michadr.

# OPUS-C3: talk memory, save, roster (notes/conversation-design.md stage C3)

Built by Opus 5.5. No game.js or other forbidden file touched. No git.

## Files (line counts by Measure-Object, blank lines not counted)
| File | State | Lines |
|---|---|---|
| dist/talk-memory.js | NEW, pure (header 155 chars) | 89 |
| tests/talk-memory.mjs | NEW | 53 |
| tests/fixtures/save-0.35.18-talk.json | NEW: an old save, normalised by the published 0.35.18 code | 3562 bytes |
| dist/npc-life.js | normalizeNpcs carries `mem`; needsFor and sickToday skip dormant people | 198 |
| dist/npc-roster.js | `dormant` flag, `ACTIVE_ORDER`, true jobs for Lincoln/Brentster, Elena added, line 1 shortened | 126 |
| dist/jobs.js | normalizeProgress: progress.talk + one-time migration (one line) | 70 |
| tests/npc-life.mjs | re-pinned on purpose + mem checks | 128 |
| tests/npc-dialogue.mjs | re-pinned on purpose (flat doors) + true jobs on the People rows | 147 |
| package.json | version 0.35.18 -> **0.35.19** (coordinator's correction; written with Edit, no BOM) | |

Not changed: world-tick.js, needs.js, population.js, save-file.js and their tests. They were not needed: the dormant gate in needsFor already covers world-tick, and the save-file "tight disk" test passes at 7500 with no raise.

## Data shapes (all additive, optional)
- `progress.npcs[id].mem = {last:[lineKey] (newest last, at most 6), seen:{nodeId:count} (at most 32), beats:[string] (at most 16), lastMin:int (absolute game minute, -1 = never)}`. It is present **only when not empty**, so a save without talks gains no bytes. talks (40 keys) and flags (12) keep their caps. Other unknown fields are still dropped.
- `progress.talk = {v:1, people:{personId:{metDay, lastDay, last, seen, beats, lastMin}}}`: at most 48 people. When it overflows, the oldest `lastDay` goes, but never the person just written. It is present only when not empty (a fresh or old save has no `talk` key).
- Keys (line keys, node ids, beats, person ids) must match `/^[A-Za-z0-9][A-Za-z0-9_.:#\/-]{0,63}$/` and must not be `__proto__`, `constructor` or `prototype`.
- How each cap overflows:
  - `last`: a repeated key moves to the end.
  - `seen`: a new node in a full map pushes out the least-seen one (on a tie, the oldest goes). The normaliser keeps the 32 highest counts.
  - `beats`: they are permanent, so a full list (16) **ignores new beats** rather than dropping old ones. Writers must keep each person under 16 beats; C2's validator could check this.
- Exports of talk-memory.js:
  - normalizers: `normalizeTalkMem`, `normalizeTalkPeople`
  - writes: `recordLine`, `recordNode`, `recordBeat`, `stampMem`, `withMem(npc,mem)` (drops an empty mem), `notePerson(talk,personId,day,mem)`
  - reads: `hasBeat`, `seenCount`, `personMem(talk,personId)`, `isEmptyMem`, `isEmptyTalk`, `validKey`
  - migration: `migrateTalkMem(npc,progress,who)`, `migrateNpcsTalk(npcs,progress,day)`
  - constants: `EMPTY_MEM`, `MEM_LAST=6`, `MEM_SEEN=32`, `MEM_BEATS=16`, `TALK_PEOPLE=48`, `TALK_V=1`
- Every result is new and frozen. There is no clock and no chance.

## Migration (in jobs.js normalizeProgress, after npcs/standing; it runs while a person has no mem, and an empty result stays absent)
- metDay >= 0 gives `seen['<id>.first']=1`.
- Lincoln's `talks.<hunting topic>` counts are copied into `seen['lincoln.hunt.<topic>']`.
- The starter story (only when it was **not skipped**):
  - step >= 2 gives Sophie the beat `sophie.groceries-delivered`;
  - step >= 3 gives Hal `hal.met`;
  - `noteGiven` gives Walt `walt.note`.
- `careers.ridgeline.hired` gives Walt `walt.hired`.
- `cafe.employed` with Elena not met yet sets her metDay to the npc day (housing.day - 1), and that gives her `elena.first`.
- A roster person's old `progress.talk` entry (by personId) is merged into their mem.
- Dormant people never get a mem.
- The test loads the 0.35.18 fixture and checks four things:
  1. Every top-level field except npcs is deep-equal to the old save.
  2. Every old npc record is unchanged apart from the added `mem`.
  3. The input is not mutated.
  4. A second load is identical, so the migration runs once.

## Roster
- **Elena** is new: id `elena`, personId `oak-apartments/7#1`, Manager at Alder Coffee, Flat 7.
  - I verified her post (cafe-manager, 480-1080) and her flat with node and population.js.
  - She has mood lines, visit rules and a tip. All her facts match the cafe flow (from eight; two customers, reset the table, paid the same day).
  - She gets mood, sickness, needs and a People row once met.
  - On the street the crowd's Elena now goes through talkNamed automatically. game.js builds pedRoster and the `npc-` prompt from NPC_ROSTER personIds, which I checked by reading game.js:136/674-675.
- **Lincoln:** role `Evening clerk (Corner Market), keen hunter`, work `shop:market`.
- **Brentster:** role `Shopkeeper (Ironwood Store), owner of the cat Brentster Jr.`, work `property:alder-store`. Its label is "Ironwood Store", not "Alder general store".
- The People page now shows Corner Market, Ironwood Store and Alder Coffee instead of "No regular job".
- **Gus Taggart / Ray Okonkwo:** `dormant:true`. They stay in ROSTER and in saves. needsFor returns [] for them and sickToday skips them. **Finding:** before this change, needsFor DID make need seeds for them (routine seeds at `zone:forest` / `office:ridgeline-warehouse`), and they took part in the sickness draw.
- `ACTIVE_ORDER` (exported) = the roster without the dormant people.

## Tests re-pinned on purpose
- npc-life.mjs:
  - ROSTER 10 -> 11.
  - New check: the dormant set is exactly foreman+driver.
  - The sickness band now divides by `ACTIVE_ORDER.length` instead of 10, and loops perNpc over ACTIVE_ORDER, because dormant people are never sick (asserted).
  - Real-person check widened to elena/lincoln/brentster/oscar, including work == population work.
  - Added: dormant people have no needs.
  - Added mem checks: caps, round trip, talk/moodTick keep mem, junk mem dropped, no mem on a fresh save.
- npc-dialogue.mjs: flatDoors `[2,8,9,10,11]` -> `[2,7,8,9,10,11]` (Elena's flat). Added the true work labels for Lincoln/Brentster/Elena and Elena's home row.
- I weakened no assertions. needs-loop.mjs and world-tick.mjs pass without edits, because they use ROSTER_ORDER rather than a count.

## Test output (real)
```
PASS talk-memory: caps (6/32/16, 48 people), junk, frozen, helpers, old 0.35.18 save loads unchanged, migration beats, Elena met via the cafe, once only
PASS npc-life: roster, tiers, +3/day standing cap, sickness band, Oscar/Lincoln/Brentster rules, canVisit, namedPlan, visits, needs, determinism
PASS npc-dialogue: talk effects and caps, Oscar refusal, Lincoln pages and sulk, Brentster steers, met set and save round trip, People rows (unmet hidden), door-knock table, roster planner (sick stay ...
PASS needs-loop: need opened day 103 (14 dozen), board slot, 14 dozen (4 crates) farm 66->52, shelf 0->14, price 563->563, paid 8658, mood 60->64, standing 0->1
Save files: stored save read/write in the game's own shapes, ... backups (newest first, duplicates skipped, 5 kept, 1 MB cap, full storage), import and restore keep a backup.
```
`npm run release` (0.35.19, new, no --force): `Packaged release 0.35.19: 214 files -> dist/releases/0.35.19`
`npm run index`: `brief 2834 tokens (target 3000), index 31776 tokens (target 32500)`
`npm test`: `ALL 257 PASSED` / `All 257 test files passed.`

After that, tests/brief.mjs failed once with "a dist module is missing from PROJECT-INDEX.md: talk-validate.js". The other agent had added that file after my index run. I re-ran `npm run index`, which now gives `index 31998 tokens (target 32500); 214 modules`, and then:
`brief tests passed: 214 modules listed, brief 2834 and index 31998 estimated tokens (budgets 3000 and 32500)`

## What I could NOT verify
- Nothing in a browser.
- Elena's buzzer door (Flat 7 now shows on the panel) and her street talk are reached through the existing game.js knock/talkNamed paths, but I have not seen them.
- dist/releases/0.35.19 was packaged before talk-validate.js existed. If the other agent needs it in the release, run `npm run release -- --force` again (0.35.19 has never been deployed).
- A sick Elena (or Noah) stays home in the crowd while the static cafe/market counter clerk still serves. This inconsistency existed before for Noah; now Elena has it too.
- If 32 is too small for `seen`, the oldest first-meeting markers could be pushed out on a very chatty save. A first-meeting node is seen once, which is exactly the least-seen case, so C4 may want `.first` nodes pinned or tracked as beats instead.

## Edits wanted in files I may not touch
1. **dist/game.js:655** (C6, or now if wanted): the cafe counter does not register a talk, so Elena's standing/met never grows at the counter. Change
   `shop==='market'?()=>{recordTalk('noah');marketMenu()}:managerMenu`
   to
   `shop==='market'?()=>{recordTalk('noah');marketMenu()}:()=>{recordTalk('elena');managerMenu()}`
2. **dist/npc-dialogue.js peopleRows / flatDoors** (C10 owner, not on my allowed list): add `if(r.dormant)continue` in peopleRows. Today it cannot matter, because dormant people have no body and so are never met.
3. C6 should write memory with `withMem(npc, remember(...))` for roster people and `notePerson(progress.talk, personId, npcDay(), mem)` for crowd people, then `persist()`.

## Confidence
- talk-memory.js shapes, caps, normalizers: high (tested, deterministic).
- Old-save migration/compatibility: high for the 0.35.18 shape (fixture made by the published code); medium for much older saves (normalizeProgress already handles them; not re-tested here).
- Roster facts (Elena/Lincoln/Brentster): high (checked with node against population.js).
- Dormant gating: high in npc-life (needs, sickness); low effect elsewhere (moodTick still runs for them, harmless).
- In-game behaviour of Elena on the street and at the buzzer: medium (code paths read, not played).
