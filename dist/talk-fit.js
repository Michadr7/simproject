// Talk panel fit rules (pure): visible transcript windowing, long-reply shrink/clamp, and option grid/paging.
// No DOM, no three.js, no globals. Used by dist/talk-panel.js.
export const MAX_VISIBLE_LINES = 3;
export const CHARS_PER_LINE = 64;
export const SHRINK_CHARS = 180;
export const CLAMP_CHARS = 320;
export const FADE_MS = 200;
export const GRID_THRESHOLD = 4;
export const PAGE_SIZE = 7;

const FADE_BY_AGE = [1, 0.84, 0.64];

export function lineCost(text, maxChars = CHARS_PER_LINE) {
 const s = typeof text === 'string' ? text : '';
 const w = Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : CHARS_PER_LINE;
 if (!s) return 1;
 return s.split('\n').reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / w)), 0);
}

export function visibleLines(lines, maxLines = MAX_VISIBLE_LINES, maxChars = CHARS_PER_LINE) {
 if (!Array.isArray(lines) || !lines.length) return [];
 const cap = Number.isFinite(maxLines) && maxLines > 0 ? Math.floor(maxLines) : MAX_VISIBLE_LINES;
 const w = Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : CHARS_PER_LINE;
 const kept = [];
 let used = 0;
 for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i];
  const text = typeof line === 'string' ? line : (line && typeof line.text === 'string' ? line.text : '');
  const weight = lineCost(text, w);
  if (kept.length > 0 && used + weight > cap) break;
  kept.push({
   index: i,
   line,
   weight,
   fade: 1,
   shrink: text.length > SHRINK_CHARS,
   clamp: text.length > CLAMP_CHARS,
  });
  used += weight;
  if (used >= cap) break;
 }
 kept.reverse();
 const n = kept.length;
 for (let i = 0; i < n; i++) {
  const age = n - 1 - i;
  kept[i].fade = FADE_BY_AGE[Math.min(age, FADE_BY_AGE.length - 1)];
 }
 return kept;
}

export function replyLayout(replies, opts = {}) {
 const list = Array.isArray(replies) ? replies : [];
 const total = list.length;
 const twoCol = Number.isFinite(opts.twoColThreshold) ? opts.twoColThreshold : GRID_THRESHOLD;
 const rawSize = Number.isFinite(opts.pageSize) && opts.pageSize >= 2 ? Math.floor(opts.pageSize) : PAGE_SIZE;
 const columns = total > twoCol ? 2 : 1;
 if (total <= rawSize) {
  return { columns, page: 0, pageCount: 1, items: list.slice(), hasMore: false, remaining: 0, total };
 }
 const perPage = rawSize - 1;
 const pageCount = Math.ceil(total / perPage);
 const rawPage = Number.isFinite(opts.page) ? Math.floor(opts.page) : 0;
 const page = ((rawPage % pageCount) + pageCount) % pageCount;
 const start = page * perPage;
 const items = list.slice(start, start + perPage);
 const remaining = total - items.length;
 return { columns, page, pageCount, items, hasMore: true, remaining, total };
}
