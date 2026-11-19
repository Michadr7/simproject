// Frame-time probe for ?perf=1 (Dev Mode only; WebGPU T6, notes/eval/outbox/webgpu-T6.md): 600 frames of CPU frame time, frame interval and GPU time, then min/mean/p95/p99 per backend.
// GPU time: WebGPURenderer's timestamp queries (renderer built with trackTimestamp, both of its backends), or EXT_disjoint_timer_query_webgl2 on the classic WebGLRenderer; "n/a" when the
// adapter has neither. CPU frame = from the start of the game's frame() to the end of its last renderer.render() (what the main thread spends; the GPU runs after it).
// Sampling writes into preallocated Float64Arrays (no allocations per frame; the one exception is the Promise WebGPURenderer.resolveTimestampsAsync returns, at most one in flight).
// Click the overlay to measure again (for example after walking to a night spot). The pure parts (perfFlag, createPerfSampler, summarize, perfRows) are tested in tests/perf-probe.mjs.
export const PERF_FRAMES = 600, PERF_SKIP = 120, PERF_TIMER_SLOTS = 4;
const ON = new Set(['', '1', 'true', 'on', 'yes']);
// search: location.search. dev: DEV_MODE. Only both together turn the probe on.
export function perfFlag(search = '', dev = false) {
 if (!dev) return false;
 try { const q = new URLSearchParams(String(search || '')); return q.has('perf') && ON.has(String(q.get('perf')).toLowerCase()); } catch { return false; }
}
// Three fixed series of n samples each.
export function createPerfSampler(n = PERF_FRAMES) {
 const s = { n, cpu: new Float64Array(n), interval: new Float64Array(n), gpu: new Float64Array(n), cpuCount: 0, intervalCount: 0, gpuCount: 0 };
 s.pushCpu = ms => { if (s.cpuCount < n && Number.isFinite(ms) && ms >= 0) s.cpu[s.cpuCount++] = ms; };
 s.pushInterval = ms => { if (s.intervalCount < n && Number.isFinite(ms) && ms > 0) s.interval[s.intervalCount++] = ms; };
 s.pushGpu = ms => { if (s.gpuCount < n && Number.isFinite(ms) && ms > 0) s.gpu[s.gpuCount++] = ms; };
 s.full = () => s.cpuCount >= n;
 s.reset = () => { s.cpuCount = s.intervalCount = s.gpuCount = 0; };
 return s;
}
// Nearest-rank percentiles over the first `count` values (copies and sorts: call once, at the end).
export function summarize(values, count = values.length) {
 if (!count) return null;
 const v = Array.from(values.subarray ? values.subarray(0, count) : values.slice(0, count)).sort((a, b) => a - b);
 const rank = p => v[Math.min(count - 1, Math.max(0, Math.ceil(p * count) - 1))];
 let sum = 0; for (const x of v) sum += x;
 const r = x => Math.round(x * 100) / 100;
 return { n: count, min: r(v[0]), mean: r(sum / count), p95: r(rank(0.95)), p99: r(rank(0.99)), max: r(v[count - 1]) };
}
// Rows for console.table and the overlay.
export function perfRows(sampler, backend, gpuSource) {
 const row = (metric, s) => s ? { backend, metric, ...s } : { backend, metric, n: 0, min: 'n/a', mean: 'n/a', p95: 'n/a', p99: 'n/a', max: 'n/a' };
 return [
  row('CPU frame ms', summarize(sampler.cpu, sampler.cpuCount)),
  row('frame interval ms', summarize(sampler.interval, sampler.intervalCount)),
  row('GPU ms (' + (gpuSource || 'n/a') + ')', summarize(sampler.gpu, sampler.gpuCount))
 ];
}
export const perfLine = rows => rows.map(r => `${r.backend} | ${r.metric}: min ${r.min} mean ${r.mean} p95 ${r.p95} p99 ${r.p99} (n=${r.n})`).join('\n');

// Browser glue. renderer: the game's renderer (WebGLRenderer or WebGPURenderer). backend: the HUD name. doc: document (the overlay). now: performance.now.
export function createPerfProbe({ renderer, backend, doc = globalThis.document, now = () => performance.now(), log = console, frames = PERF_FRAMES, skip = PERF_SKIP, size = () => [globalThis.innerWidth || 0, globalThis.innerHeight || 0] }) {
 const sampler = createPerfSampler(frames);
 let start = -1, end = -1, skipped = 0, done = false, framesSince = 0, pending = false, resolveN = 1;
 // the CPU end stamp: after every renderer.render (the last one of a frame wins)
 const render = renderer.render.bind(renderer);
 renderer.render = (...a) => { const v = render(...a); end = now(); return v; };
 // GPU source
 let gpuSource = 'n/a', gl = null, ext = null;
 const ring = [], busy = new Uint8Array(PERF_TIMER_SLOTS); let active = -1, head = 0;
 const timestamps = !!(renderer.isWebGPURenderer && renderer.backend && renderer.backend.trackTimestamp && renderer.resolveTimestampsAsync);
 if (timestamps) gpuSource = renderer.backend.isWebGPUBackend ? 'timestamp-query' : 'WebGL2 timer query';
 else if (!renderer.isWebGPURenderer && renderer.getContext) {
  try { gl = renderer.getContext(); ext = gl && gl.getExtension('EXT_disjoint_timer_query_webgl2'); } catch { ext = null; }
  if (ext) { for (let i = 0; i < PERF_TIMER_SLOTS; i++) ring.push(gl.createQuery()); gpuSource = 'WebGL timer query'; }
 }
 const counting = () => !done && start >= 0 && skipped >= skip; // GPU samples only while CPU samples are being taken
 const onResolved = ms => { pending = false; if (counting() && ms > 0) sampler.pushGpu(ms / resolveN); };
 const onFailed = () => { pending = false; };
 const pollTimers = () => {
  if (active >= 0) { gl.endQuery(ext.TIME_ELAPSED_EXT); busy[active] = 1; active = -1; }
  const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
  for (let k = 0; k < PERF_TIMER_SLOTS; k++) {
   const i = (head + k) % PERF_TIMER_SLOTS;
   if (!busy[i] || !gl.getQueryParameter(ring[i], gl.QUERY_RESULT_AVAILABLE)) continue;
   if (!disjoint && counting()) sampler.pushGpu(gl.getQueryParameter(ring[i], gl.QUERY_RESULT) / 1e6);
   busy[i] = 0;
  }
  for (let k = 0; k < PERF_TIMER_SLOTS; k++) { const i = (head + k) % PERF_TIMER_SLOTS; if (!busy[i]) { gl.beginQuery(ext.TIME_ELAPSED_EXT, ring[i]); active = i; head = (i + 1) % PERF_TIMER_SLOTS; break; } }
 };
 // overlay
 let box = null;
 if (doc && doc.createElement) {
  box = doc.createElement('pre');
  box.id = 'perfProbe';
  box.title = 'Click to measure again';
  box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;margin:0;padding:6px 8px;background:rgba(0,0,0,.72);color:#e8f2e0;font:11px/1.35 monospace;white-space:pre;cursor:pointer;max-width:96vw;overflow:hidden';
  box.textContent = `perf: ${backend}, warming up...`;
  box.addEventListener('click', () => restart());
  doc.body && doc.body.appendChild(box);
 }
 const finish = () => {
  done = true;
  const [w, h] = size(), rows = perfRows(sampler, backend, gpuSource), text = perfLine(rows);
  if (log.table) log.table(rows);
  log.log(`[perf] ${backend} ${w}x${h}, ${sampler.cpuCount} frames\n${text}`);
  if (box) box.textContent = `perf ${backend} ${w}x${h} (click to measure again)\n${text}`;
  return rows;
 };
 function restart() { sampler.reset(); skipped = 0; done = false; start = -1; if (box) box.textContent = `perf: ${backend}, warming up...`; }
 // Call at the very start of every frame. record: false on the main menu (nothing is counted there).
 function begin(record = true) {
  const t = now();
  if (gl && ext) pollTimers();
  if (timestamps) { framesSince++; if (!pending && !done) { pending = true; resolveN = framesSince; framesSince = 0; renderer.resolveTimestampsAsync('render').then(onResolved, onFailed); } }
  if (!record || done) { start = -1; return; }
  if (start >= 0 && end >= start) {
   if (skipped < skip) skipped++;
   else { sampler.pushCpu(end - start); sampler.pushInterval(t - start); if (box && (sampler.cpuCount % 60) === 0) box.textContent = `perf: ${backend}, ${sampler.cpuCount}/${frames} frames`; if (sampler.full()) finish(); }
  }
  start = t;
 }
 return { begin, restart, finish, sampler, get gpuSource() { return gpuSource; }, get done() { return done; } };
}
