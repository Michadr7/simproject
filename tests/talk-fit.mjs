// Talk panel fit rules (hydrogen-talk-panel-fit.md): pure tests for dist/talk-fit.js.
import assert from 'node:assert/strict';
import {
 MAX_VISIBLE_LINES, CHARS_PER_LINE, SHRINK_CHARS, CLAMP_CHARS, FADE_MS, GRID_THRESHOLD, PAGE_SIZE,
 lineCost, visibleLines, replyLayout,
} from '../dist/talk-fit.js';

// 1. Named constants.
assert.equal(MAX_VISIBLE_LINES, 3);
assert.equal(FADE_MS, 200);
assert.equal(GRID_THRESHOLD, 4);
assert.equal(PAGE_SIZE, 7);
assert.ok(CLAMP_CHARS > SHRINK_CHARS && SHRINK_CHARS > CHARS_PER_LINE);

// 2. lineCost counts wrapped lines and explicit newlines.
assert.equal(lineCost('', 64), 1);
assert.equal(lineCost('Hello!', 64), 1);
assert.equal(lineCost('x'.repeat(65), 64), 2);
assert.equal(lineCost('a\nb\nc', 64), 3);

// 3. visibleLines keeps newest 2-3 lines, assigns fade levels, and drops older ones.
assert.deepEqual(visibleLines([]), []);
assert.deepEqual(visibleLines(null), []);
{
 const lines = [
  { who: 'noah', text: 'One' },
  { who: 'you', text: 'Two' },
  { who: 'noah', text: 'Three' },
  { who: 'noah', text: 'Four' },
 ];
 const v = visibleLines(lines, 3, 64);
 assert.equal(v.length, 3, 'keeps only newest 3 short lines');
 assert.deepEqual(v.map(x => x.index), [1, 2, 3]);
 assert.deepEqual(v.map(x => x.fade), [0.64, 0.84, 1], 'older lines fade');
 assert.equal(v.every(x => !x.shrink && !x.clamp), true);
}

// 4. Long reply counts as >1 line, pushing older lines out; very long reply is always kept and flagged shrink/clamp.
{
 const lines = [
  { who: 'noah', text: 'Earlier greeting' },
  { who: 'you', text: 'What happened?' },
  { who: 'noah', text: 'A'.repeat(130) }, // 3 visual lines at 64 chars
 ];
 const v = visibleLines(lines, 3, 64);
 assert.equal(v.length, 1, '3-line reply fills the 3-line budget');
 assert.equal(v[0].index, 2);
 assert.equal(v[0].fade, 1);
 assert.equal(v[0].shrink, false);
}
{
 const lines = [
  { who: 'noah', text: 'Old' },
  { who: 'noah', text: 'B'.repeat(SHRINK_CHARS + 1) },
 ];
 const v = visibleLines(lines, 3, 64);
 assert.equal(v.length, 1);
 assert.equal(v[0].shrink, true, 'exceeding SHRINK_CHARS sets shrink');
 assert.equal(v[0].clamp, false);
}
{
 const lines = [
  { who: 'noah', text: 'Old' },
  { who: 'noah', text: 'C'.repeat(CLAMP_CHARS + 10) },
 ];
 const v = visibleLines(lines, 3, 64);
 assert.equal(v.length, 1, 'always keeps at least the newest line even if > maxLines');
 assert.equal(v[0].shrink, true);
 assert.equal(v[0].clamp, true, 'exceeding CLAMP_CHARS sets clamp');
}

// 5. replyLayout: 1-4 options use 1 column; 5-7 options use 2-column grid with no paging; >7 pages with More.
{
 const r3 = replyLayout([{ id: '1' }, { id: '2' }, { id: '3' }]);
 assert.equal(r3.columns, 1);
 assert.equal(r3.hasMore, false);
 assert.equal(r3.pageCount, 1);
 assert.equal(r3.items.length, 3);

 const r7 = replyLayout(Array.from({ length: 7 }, (_, i) => ({ id: String(i + 1) })));
 assert.equal(r7.columns, 2, 'up to 7 use 2-column grid');
 assert.equal(r7.hasMore, false, '7 options fit without paging');
 assert.equal(r7.items.length, 7);

 const all9 = Array.from({ length: 9 }, (_, i) => ({ id: String(i + 1) }));
 const p0 = replyLayout(all9, { page: 0 });
 assert.equal(p0.columns, 2);
 assert.equal(p0.hasMore, true);
 assert.equal(p0.pageCount, 2);
 assert.equal(p0.items.length, 6, '6 real options + 1 More row = 7');
 assert.equal(p0.remaining, 3);
 const p1 = replyLayout(all9, { page: 1 });
 assert.equal(p1.page, 1);
 assert.equal(p1.items.length, 3);
 assert.equal(p1.items[0].id, '7');
 const pWrap = replyLayout(all9, { page: 2 });
 assert.equal(pWrap.page, 0, 'page wraps modulo pageCount');
}

console.log('PASS talk-fit');
