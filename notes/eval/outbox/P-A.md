michadr.

# P-A planks economy numbers: reconstructed report (2026-11-17)

The Sonnet P-A agent stopped before writing its report. This file was written afterwards by the main chat from the files on disk and a test run. It is NOT the agent's own account.

## Files
- dist/plank-economy.js (151 lines, 55 exports): one table of plank prices, pay per step, ratios, rates, cycle times, plus the pure wage maths. Pure, no DOM, no Math.random/Date.now. Header says it implements notes/planks-economy-design.md stage P-A. Nothing in dist/ imports it yet.
- tests/plank-economy.mjs (86 lines).

## Result (run by the main chat, `node tests/plank-economy.mjs`, and inside full `npm test`: ALL 250 PASSED)
PASS line: 1 log = 4 planks, trickle 6/day vs old 24, level 1 worktruck cycle 32 planks in 182.1 game min = $263.20 (8672 c/h) beats the best existing job ridgeline-fell (6934 c/h) by 25%; levels 1:+25% 3:+18% 5:+11% 7:+4% 10:-12%; Prices screen low/high/normal notes, garbage safe, frozen, pure.

## Not verified / open
- The header promises an edit list for stages P-B onward "in notes/eval/outbox/P-A.md". The agent never wrote it, so it does not exist; P-B must derive its edits from the exports.
- At level 10 the cycle is 12% BELOW the best existing job (the wage rule is +25% at level 1 and shrinks with skill). The owner should decide whether the rule only holds up to a level.
- Not seen in play; nothing uses the numbers yet.

Confidence: file and test correct as far as the test goes (high); design fit to the owner's rule at high levels (low, see above).
