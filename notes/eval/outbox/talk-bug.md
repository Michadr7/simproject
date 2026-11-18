michadr.

# talk-bug: "Talk to Noah/Elena, press E, nothing shows" (2026-11-18)

## Root cause (found)
The bug is in the page markup, not in the talk code. In `dist/index.html`, line 13 is `<section id="talk" hidden></section>`. That line sits inside line 12, which ends in the middle of the Settings markup (`<section id="settings" class="veil" hidden> <div class="dialog"> ... <div class="control-groups">`). So in a real browser the talk panel is a child of `#settings > .dialog > .control-groups`, and `#settings` is hidden. When you press E, `talkWith` (dist/game.js:565-573) runs normally: `talkNow` is set, `talkPanel.show()` sets `#talk.hidden=false`, and `talking()` is true. Because the panel's ancestor is `display:none`, the panel never draws. No error is thrown, so the console stays clean, and because `talkWith` returned true the old `#dialog` menu is not used either. The headless game tests cannot see this: in tests/support/boot-game.mjs every `id` is a loose element with no parent. That is why talk-game.mjs and the bootGame scans pass. It affects every docked talk: Noah, Elena, Walt, Hal, door knocks and the crowd. My scan with save variants (fresh, story done, npcs null, junk mem/standing, Ridgeline hired with an axe, old `talk.people` save) opened the panel correctly in every case, so the save is not the cause.

## Fix
- `dist/talk-panel.js` (now 92 lines; 2 lines added in `createTalkPanel`): if the root is not a direct child of `document.body`, the panel moves itself there. It is `position:fixed` and every CSS rule targets it by `#talk`, so the move changes nothing else. It does nothing when the document has no usable `body.appendChild` (the boot-game stub) or when the root is already at body level.
- Requested edit in a file outside my list (please apply; the code fix works without it): in `dist/index.html`, move `<section id="talk" hidden></section>` from line 13 (inside `#settings .control-groups`) to body level, for example just before the `<section id="dialog" ...>` on line 12 or just before the closing `</body>`. The regression test passes either way.

## Second bug found on the logger path (fixed, small)
`openLoggingTutorial` (dist/game.js:1217) closes the guide from a `document` keydown listener, and that listener ran `modal=false` straight away. The same keydown then reaches the `window` handler with modal already false. Pressing E (the guide's own hint says "Esc, Enter, Space, or E to close") therefore also ran `interact()`. At the office time clock, right after clocking in, that clocked the player straight back out (`doClockOut`). Esc opened the pause menu. The fix is one line in game.js:1217: the close now drops `modal` in a `setTimeout(...,0)`, after the key event. E then does nothing more, and Esc becomes `pause(false)`, which just resumes. With the phone open, Esc still closes the phone first (handled before that line). I could not test this headless, because boot-game never opens the guide (its `document.body` has no `appendChild`). Note: someone else has changed `dist/logging-tutorial.js` and `style.css` since the 0.35.20 release (a focus-trapped redesign). I did not touch either file. A cleaner long-term fix there would be `e.stopPropagation()` in `bindClose`'s onKey.

## Files created or changed
- dist/talk-panel.js: 92 lines (+2)
- dist/game.js: 1925 lines (one line edited at 1217, CRLF kept, no BOM, `node --check` OK)
- tests/talk-stuck.mjs: 54 lines, NEW. It parses the real dist/index.html into a tree, runs createTalkPanel + show() on `#talk` and asserts that no ancestor is hidden and that the panel is at body level. It also checks that a panel already at body level is not moved and that a body-less stub is left alone.
- PROJECT-INDEX.md regenerated (`npm run index`).

## Tests (real output)
Before the fix (the same test pointed at releases/0.35.20/talk-panel.js):
```
AssertionError [ERR_ASSERTION]: no hidden ancestor may keep the open talk panel from rendering (it sat inside div.control-groups < div.dialog < section#settings.veil < body < html < #root)
+   'section#settings.veil'
```
After:
```
PASS talk-stuck.mjs: the docked talk panel renders in the real index.html tree (no hidden ancestor such as #settings), sits at body level, and a panel already there is not moved.
PASS talk-panel
PASS talk-cast.mjs: 5 early casts validated (0 errors, 0 warnings), 762 sweep contexts (19279 terminal walks, 39647 bubbles, zero cycles/repeats/time-leaks), castOf + pinned phrases passed.
Talk engine: ... (talk-engine.mjs passes)
brief 2834 tokens (target 3000), index 33637 tokens (target 34000); 231 modules, 14 generated, 290 tests, 30 scripts
brief tests passed
```
- A bootGame run with the fixed talk-panel.js copied into the release (Ridgeline save, Corner Market at 10:00, E) gave: talkOpen true, name Noah, still open after 1 s.
- tests/talk-memory.mjs FAILS, twice: "old field kept unchanged: skills" (a `hospitality: {xp:0}` skill appears). I did not cause it: dist/skills.js was changed at 09:42 today by the diner D-A work. I did not touch it.

## Not verified
- I did not run `npm run release -- --force` or the full `npm test`. The prompt says "bump nothing; the main chat releases", and 0.35.20 is live. The game-level tests (talk-game.mjs and the others) still run the old packaged 0.35.20, so they do not exercise these two changes until the main chat releases.
- Not seen in a real browser. The cause is certain from the markup (and the test reproduces the tree), but a browser check after release should confirm the panel now shows at Noah's and Elena's counters.
- The tutorial E/clock-out fix is untested (see above).

## NPC-NAMES (the unnamed flatmate beside Noah)
Not done. Fixing it needs a browser repro first: who is the drawn person (a pedestrian from neighborhood.js or a pooled crowd avatar) and why does `npcCrowd.talkable` not offer a prompt? That is more than a few lines, so per the prompt I am asking first.

## Confidence
- Root cause: high (the HTML nesting is unambiguous and explains "no panel, no options, no console error, cannot reproduce headless").
- talk-panel.js fix: high.
- Tutorial E fix: medium-high (simple reasoning, untested in a browser).
