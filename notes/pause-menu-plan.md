# Pause menu: plan (NOT built, waiting for approval)

Written 2026-11-13. Nothing in this plan is built. Say yes (or edit it) and it becomes one build session.

## What is wrong now
The pause menu (`<section id="controls">` in `dist/index.html`, opened by `pause(true)` in `game.js` line 419, from the HUD "Controls ?" button `#help` or Esc) is one dialog holding everything at once: the three-column controls list (Movement, Actions, Menus), the mouse-capture line and retry button, the Graphics select (`#quality`), Turn left / Turn right (`#lookLeft`, `#lookRight`), Edit character, Credits, the lobby info line, "Save and go to the main menu" (`#mainMenu`) and "Back to the block" (`#resume`). It reads as a wall of text, and the buttons the player wants are at the bottom.

## The new shape: a short menu, each option opens its own panel
**Pause menu (the first screen).** Title "Paused". Four big buttons, same width, nothing else on the screen:
1. **Resume** (primary, first, focused). Closes the menu and re-captures the mouse. This replaces "Back to the block".
2. **Settings** opens the Settings panel.
3. **Edit character** opens the character creator, as the button does now (`openCreator`; Back returns to the game).
4. **Save and exit to menu** does what `#mainMenu` does now (cloud sync, save, back to the main menu). One line of small text under it only when `#lobbyInfo` has something (multiplayer lobby), as now.

Credits stay on the main menu (they already have `#menuCredits` there); in the pause menu they move into Settings as a small last row, so the first screen stays at four buttons. Decision for you below (Q3).

**Settings panel** (a second `.veil` section, `#settings`, with a Back button at the bottom; Back returns to the pause menu). Sub-sections as small headings, no sub-panels, because there are only a few items:
- **Controls**: the three lists (Movement, Actions, Menus) moved here unchanged, collapsed under a "Controls" heading that is open by default. Includes the Esc line.
- **Graphics**: the `#quality` select (High / Low).
- **Camera**: Turn left / Turn right buttons (the keyboard-less way to turn; they are only useful on touch or when the mouse is not captured), plus the mouse-capture line and "Try mouse capture again".
- **Credits**: a button opening the existing credits panel; its Back returns to Settings (today `openCredits('controls')` returns to the controls dialog, so this just changes what it re-shows).

If the Settings panel gets long on a small screen, it scrolls inside the dialog (the `.dialog` already has `max-height` handling for the old controls list; check).

## Esc and keys
- In game, nothing open: Esc opens the pause menu (as now).
- In the pause menu: Esc resumes (as now: `pause(!modal)`).
- In Settings (or Credits opened from it): Esc goes back one level to the pause menu, not straight to the game. Esc again resumes. This is the one new rule.
- The HUD "Controls ?" button (`#help`) now opens the pause menu; its label changes to "Menu" (or stays, your call, Q2). The Esc line in the controls list changes to "Esc: Pause menu / back".
- Other Esc handlers (store, phone, inventory, dialog, consuming) stay first in the chain and are untouched.

## Code and tests that change
Files: `dist/index.html` (split the `#controls` section into the short menu and a new `#settings` section; same ids for the controls that already exist: `#quality`, `#lookLeft`, `#lookRight`, `#editCharacter`, `#showCredits`, `#mainMenu`, `#resume`, `#retryCapture`, `#mouseMode`, `#lobbyInfo`, so existing wiring keeps working), `dist/style.css` (stacked full-width menu buttons, Settings sub-headings), `dist/game.js` (small: `pause()` to also hide `#settings`; a `showSettings(on)` helper, three click handlers, the Esc rule above; `openCredits` return target; I will touch only `pause`, the `#help`/`#resume` line 420 to 424 area, and the Esc line 823, and tell the other agent exact lines), `scripts/package-release.mjs` needs no change. No change to saves, keys or ids that tests use.

Tests: `tests/startup.mjs`, `tests/main-menu-return.mjs` and `tests/night-lights.mjs` click `controls`, `resume` and `editCharacter` by id: these must keep passing with the same ids (the plan keeps them). New cases in a new `tests/pause-menu.mjs`: the first screen has exactly Resume, Settings, Edit character, Save and exit to menu; Settings opens and Back returns; Esc order (game -> pause -> Settings -> pause -> game); Credits from Settings returns to Settings; quality change still saves; Turn left/right still turn; Save and exit still goes to the main menu. The packaged tests run `dist/releases/<version>/`, so this needs `npm run release -- --force` before testing, as always.

## Risks
- The packaged tests drive these elements by id; renaming any id breaks them. Mitigation: keep ids, add new ones only.
- `modal`, `keys.clear()`, `look.release()` and `look.capture()` must stay paired. Switching between the pause menu and Settings must not re-capture the mouse in between (no `pause(false)` while moving between the two panels).
- Touch screens: Turn left/right live in Settings now, one more tap away. If touch players use them a lot, keep them on the first screen (Q4).
- A scrolling Settings dialog on small screens is not verified in a real browser here (software WebGL, no screenshots of layout).
- Size: small. About 40 lines of HTML and CSS, about 15 lines of game.js. `game.js` is shared with another agent, so edits stay in the three places above.

## Questions for you
1. Is "Settings + Edit character + Save and exit to menu" plus Resume the right first screen (four buttons)?
2. Keep the HUD "Controls ?" label, or call it "Menu"?
3. Credits only inside Settings, or also a fifth button on the first screen?
4. Turn left/right: inside Settings (my plan), or keep on the first screen for touch players?
