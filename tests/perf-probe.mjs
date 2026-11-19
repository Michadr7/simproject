// ?perf=1 frame-time probe (dist/perf-probe.js, WebGPU T6): the flag needs Dev Mode, the sampler keeps fixed arrays, the summary is nearest-rank, and the browser glue (fake renderer,
// fake clock, fake WebGL timer queries, fake WebGPU timestamps) counts CPU frame = frame start to the end of the last render, skips the warm-up, and prints once after N frames.
import assert from 'node:assert/strict';
import { perfFlag, createPerfSampler, summarize, perfRows, perfLine, createPerfProbe, PERF_FRAMES } from '../dist/perf-probe.js';

assert.equal(perfFlag('?perf=1', true), true); assert.equal(perfFlag('?debug&perf', true), true); assert.equal(perfFlag('?perf=0', true), false);
assert.equal(perfFlag('?perf=1', false), false, 'no Dev Mode, no probe'); assert.equal(perfFlag('', true), false); assert.equal(perfFlag(null, true), false);
assert.equal(PERF_FRAMES, 600);

const s = createPerfSampler(4); const arrays = [s.cpu, s.gpu, s.interval];
for (const v of [4, 1, 3, 2, 9]) s.pushCpu(v);
assert.equal(s.cpuCount, 4, 'stops at n'); assert(s.full()); s.pushCpu(-1); s.pushGpu(0); s.pushGpu(NaN); assert.equal(s.gpuCount, 0, 'no zero, negative or NaN GPU samples');
assert.deepEqual(summarize(s.cpu, s.cpuCount), { n: 4, min: 1, mean: 2.5, p95: 4, p99: 4, max: 4 });
s.reset(); assert.equal(s.cpuCount, 0); assert.deepEqual([s.cpu, s.gpu, s.interval], arrays, 'the same arrays after a reset (no allocation)');
const hundred = Float64Array.from({ length: 100 }, (_, i) => i + 1);
assert.deepEqual(summarize(hundred), { n: 100, min: 1, mean: 50.5, p95: 95, p99: 99, max: 100 }, 'nearest rank');
assert.equal(summarize(new Float64Array(3), 0), null);

// glue: classic WebGL with a fake timer-query extension; the clock moves 16 ms per frame, the render ends 5 ms after the frame starts, the GPU takes 3 ms
let t = 0; const logs = [];
const ext = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 };
const queries = []; let activeQ = null;
const gl = { getExtension: n => n === 'EXT_disjoint_timer_query_webgl2' ? ext : null, createQuery: () => { const q = { done: false }; queries.push(q); return q; },
 beginQuery: (_, q) => { assert.equal(activeQ, null, 'one query at a time'); activeQ = q; q.done = false; }, endQuery: () => { activeQ.done = true; activeQ = null; },
 getParameter: () => false, QUERY_RESULT_AVAILABLE: 10, QUERY_RESULT: 11, getQueryParameter: (q, p) => p === 10 ? q.done : 3e6 };
const glRenderer = { render() { t += 5; }, getContext: () => gl };
const probe = createPerfProbe({ renderer: glRenderer, backend: 'WebGL', doc: null, now: () => t, log: { table: rows => logs.push(['table', rows]), log: m => logs.push(['log', m]) }, frames: 10, skip: 3, size: () => [1280, 720] });
assert.equal(probe.gpuSource, 'WebGL timer query'); assert.equal(queries.length, 4, 'four queries made once');
probe.begin(false); glRenderer.render(); t = 16; // the menu: nothing counted
for (let f = 0; f < 20 && !probe.done; f++) { probe.begin(true); glRenderer.render(); t += 11; }
assert(probe.done, 'finished after skip + frames');
assert.equal(probe.sampler.cpuCount, 10);
assert.deepEqual(summarize(probe.sampler.cpu, 10), { n: 10, min: 5, mean: 5, p95: 5, p99: 5, max: 5 }, 'CPU frame = start to the end of the last render');
assert.deepEqual(summarize(probe.sampler.interval, 10).mean, 16, 'frame interval');
assert(probe.sampler.gpuCount >= 8 && summarize(probe.sampler.gpu, probe.sampler.gpuCount).mean === 3, 'GPU 3 ms from the timer queries');
assert.equal(logs.filter(l => l[0] === 'table').length, 1, 'printed once'); const rows = logs.find(l => l[0] === 'table')[1];
assert.deepEqual(rows.map(r => r.metric), ['CPU frame ms', 'frame interval ms', 'GPU ms (WebGL timer query)']);
assert(/WebGL 1280x720, 10 frames/.test(logs.find(l => l[0] === 'log')[1]));
probe.restart(); assert.equal(probe.done, false); assert.equal(probe.sampler.cpuCount, 0);

// glue: WebGPURenderer with timestamps (resolve is async; frames that pile up while one is in flight are averaged)
t = 0; let resolves = 0;
const gpuR = { isWebGPURenderer: true, backend: { trackTimestamp: true, isWebGPUBackend: true }, render() { t += 2; }, resolveTimestampsAsync: () => { resolves++; return Promise.resolve(8); } };
const p2 = createPerfProbe({ renderer: gpuR, backend: 'WebGPU', doc: null, now: () => t, log: { log() {} }, frames: 5, skip: 0 });
assert.equal(p2.gpuSource, 'timestamp-query');
for (let f = 0; f < 8; f++) { p2.begin(true); gpuR.render(); t += 4; await Promise.resolve(); await Promise.resolve(); }
assert(p2.done); assert(p2.sampler.gpuCount >= 3, 'GPU samples from timestamps'); assert(resolves <= 8, 'at most one resolve per frame');
assert.equal(createPerfProbe({ renderer: { isWebGPURenderer: true, backend: {}, render() {} }, backend: 'WebGPU', doc: null, log: { log() {} } }).gpuSource, 'n/a', 'no timestamps: n/a');
console.log(perfLine(rows).split('\n')[0]); assert.equal(perfRows(createPerfSampler(2), 'x', null)[2].mean, 'n/a');
console.log('PASS perf-probe: Dev Mode + ?perf=1 only, fixed sample arrays, nearest-rank min/mean/p95/p99, CPU frame and interval from the frame loop, GPU from WebGL timer queries or WebGPU timestamps, printed once, click restarts.');
