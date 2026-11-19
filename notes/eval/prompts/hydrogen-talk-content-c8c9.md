# Hydrogen prompt: conversation content stages C8 (cast-oak) and C9 (cast-crowd), one after the other

Do exactly what notes/eval/prompts/hydrogen-talk-content.md says (same rules, same forbidden files, same report format, same validator and tests), with the lessons of its report notes/eval/outbox/talk-content.md (read it first, including the before/after table and what the owner liked or not if recorded in notes/handoff.md "OWNER DECISIONS").

Owner decisions 2026-11-18: Ridgeline-vest lines stay tied to hired:'ridgeline' (no outfit flag, no game.js change). Cast-early (Noah, Hal Brennan, Walt Hargrove, Elena, Sophie) is DONE: do not touch it.

STAGE C8: dist/cast-oak.js: Oscar, Lincoln, Brentster, Grace. Report notes/eval/outbox/talk-content-c8.md.
STAGE C9 (only after C8 passes its tests): dist/cast-crowd.js plus the crowd greetings in npc-chat.js: Alex, Malik and the 20+ walkers. Walkers get short, varied, place- and time-aware lines (a crowd member says something different at a bench, a shop door, the diner, on the road); no promises the game cannot keep. Report notes/eval/outbox/talk-content-c9.md.
Each stage: audit counts first, rewrite, validator and talk tests with pasted real output, a before/after table of three lines per person, QUESTIONS FOR THE OWNER as a short list. Do not run the full `npm test` while another agent edits game.js.
