michadr.

# Three.js notes consolidation

- Updated [the main handoff](../../handoff.md) (429 lines excluding trailing blanks) with one current queue, the renderer capture instructions, and earlier verification. Folded in and removed `threejs-handoff-2026-11-21.md` (15 lines) and `threejs-gpt-handoff.md` (25 lines). Older entries remain under Historical notes.
- Created `notes-consolidation-2026-11-21.md` (21 lines). Added zero tests. Protected files required no edits.

**Where we are.** Three.js feature and fix work is active per the newest handoff. The local tester build is 0.36.3. The last confirmed publish was 0.36.2. NPC dialogue, the parcel pose, and Corner Market glass fixes are owner-confirmed. Wholesale retail and Ironwood Bakery deliveries are in the tester build. The nighttime High → Low gap still reached 764 ms in WebGPU on the sampled route.

**Next.** Play 0.36.3 through a sack and pallet delivery, cancel a loaded job, revisit Wholesale after dark, and switch quality both ways at night in both renderers. Michadr decides on publishing. Trace the remaining WebGPU hitch, then continue with home cooking, starting with ingredient purchases and fridge storage.

**Verification.** Ran the repository runner with the 26 Hub files filtered out against the existing 0.36.3 package.

```text
PASS handoff: one current section, history retained, valid links, UTF-8 without BOM, packaged 0.36.3 confirmed (429 lines excluding trailing blanks).
PASS brief.mjs: brief tests passed: 272 modules listed, brief 2834 and index 34961 estimated tokens (budgets 3000 and 37000)
ALL 306 PASSED
All 306 test files passed.
```

Confidence is high in the consolidation, local package version, and Three.js test results. The public endpoint could not be checked. Unassisted deliveries, co-op claims, and GPU execution timing remain unverified.

## Diner follow-up

- Updated `notes/handoff.md` (430 lines) with the Table 1 espresso cup pose bug, the fixed player-group offset in `dist/game.js`, and the open Station View stage. The two duplicate handoffs removed during consolidation are still absent.
- Updated `brief-notes.md` (35 lines) and `PROJECT-BRIEF.md` (39 lines) to point to the current dated section and queue. Updated this report (37 lines). Added zero tests. Protected files required no edits.
- The diner shift and promotion are already playable. Rank 2+ uses automatic prep quality. Station View is still open and covers equipment models, recipe assembly, cook timing, and quality-based tips.
- Verified the current notes and ran the Three.js suite against the existing package with Hub files excluded.

```text
PASS diner handoff: one handoff, Table 1 bug and Station View in the current queue, links and brief pointers verified.
PASS brief.mjs: brief tests passed: 272 modules listed, brief 2840 and index 34961 estimated tokens (budgets 3000 and 37000)
ALL 306 PASSED
All 306 test files passed.
```

Confidence is high in the source and backlog checks. The screenshot shows the reported pose. I did not reproduce it in a rendered browser. The diner game test passed with a ground-cover warning because its fake DOM has no Image constructor.
