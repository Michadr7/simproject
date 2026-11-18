// Parity test for dist/tsl-grade.js against dist/daynight.js grade() & gradeGLSL(), plus mock-renderer.mjs checks.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from '../dist/vendor/three.module.js';
import * as WGPU from '../dist/vendor/three.webgpu.js';
import * as TSL from '../dist/vendor/three.tsl.js';
import { GRADE, grade, gradeGLSL } from '../dist/daynight.js';
import { createGradeTSL, installGradeTSL } from '../dist/tsl-grade.js';
import { writeMockRenderer } from './support/mock-renderer.mjs';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Miniature CPU-evaluating TSL adapter so createGradeTSL() executes its actual node math on test vectors.
function makeCpuTSL() {
 const wrap = v => {
  const isV = Array.isArray(v);
  const arr = () => (isV ? v : [v, v, v]);
  const op = (other, fn) => {
   const b = other?._raw !== undefined ? other._raw : other;
   if (isV || Array.isArray(b)) {
    const aa = arr(), bb = Array.isArray(b) ? b : [b, b, b];
    return wrap(aa.map((x, i) => fn(x, bb[i])));
   }
   return wrap(fn(v, b));
  };
  return {
   _raw: v,
   mul: o => op(o, (a, b) => a * b),
   div: o => op(o, (a, b) => a / b),
   add: o => op(o, (a, b) => a + b),
   sub: o => op(o, (a, b) => a - b),
   mulAssign(o) { const r = op(o, (a, b) => a * b)._raw; if (isV) v.splice(0, v.length, ...r); else v = r; return this; },
   toVar: () => wrap(isV ? [...v] : v)
  };
 };
 const raw = x => (x && x._raw !== undefined ? x._raw : x);
 return {
  Fn: fn => (...args) => fn(args),
  vec3: (x, y = x, z = x) => wrap([raw(x), raw(y), raw(z)]),
  float: x => wrap(raw(x)),
  max: (a, b) => {
   const A = raw(a), B = raw(b);
   if (Array.isArray(A) || Array.isArray(B)) {
    const aa = Array.isArray(A) ? A : [A, A, A], bb = Array.isArray(B) ? B : [B, B, B];
    return wrap(aa.map((v, i) => Math.max(v, bb[i])));
   }
   return wrap(Math.max(A, B));
  },
  mix: (a, b, t) => {
   const aa = raw(a), bb = raw(b), tt = raw(t);
   if (Array.isArray(aa) || Array.isArray(bb)) {
    const A = Array.isArray(aa) ? aa : [aa, aa, aa];
    const B = Array.isArray(bb) ? bb : [bb, bb, bb];
    const T = Array.isArray(tt) ? tt : [tt, tt, tt];
    return wrap(A.map((v, i) => v * (1 - T[i]) + B[i] * T[i]));
   }
   return wrap(aa * (1 - tt) + bb * tt);
  },
  smoothstep: (a, b, x) => wrap(smoothstep(raw(a), raw(b), raw(x))),
  dot: (a, b) => { const A = raw(a), B = raw(b); return wrap(A[0] * B[0] + A[1] * B[1] + A[2] * B[2]); },
  saturate: a => wrap(raw(a).map(v => clamp(v, 0, 1)))
 };
}

// CPU evaluator directly reading and executing the emitted gradeGLSL() constants & structure.
function evalGLSLSource(glsl, rgb, exposure) {
 assert(glsl.includes('toneMappingExposure'));
 const num = re => parseFloat(glsl.match(re)[1]);
 const vec = name => glsl.match(new RegExp(`${name}[^;]*vec3\\(\\s*([^)]+)\\)`))?.[1]?.split(',').map(Number);
 const gain = num(/toneMappingExposure \* ([\d.]+)/);
 const luma = glsl.match(/dot\( color, vec3\( ([^)]+) \) \)/)[1].split(',').map(Number);
 const shadowEnd = num(/smoothstep\( 0\.0, ([\d.]+), l \)/);
 const [, highStart, highEnd] = glsl.match(/float high = smoothstep\( ([\d.]+), ([\d.]+), l \)/).map(Number);
 const [shadowTint, highTint] = [...glsl.matchAll(/mix\( vec3\( 1\.0 \), vec3\( ([^)]+) \)/g)].map(m => m[1].split(',').map(Number));
 const [, satLow, satHigh, satEnd] = glsl.match(/float sat = mix\( ([\d.]+), ([\d.]+), smoothstep\( 0\.0, ([\d.]+), l \) \)/).map(Number);
 const white2 = num(/color \/ ([\d.]+) \)/);

 let c = rgb.map(v => Math.max(0, v) * exposure * gain);
 const l = c[0] * luma[0] + c[1] * luma[1] + c[2] * luma[2];
 const shadow = 1 - smoothstep(0, shadowEnd, l);
 const high = smoothstep(highStart, highEnd, l);
 c = c.map((v, i) => v * (1 + (shadowTint[i] - 1) * shadow) * (1 + (highTint[i] - 1) * high));
 const sat = satLow + (satHigh - satLow) * smoothstep(0, satEnd, l);
 const grey = c[0] * luma[0] + c[1] * luma[1] + c[2] * luma[2];
 c = c.map(v => Math.max(0, grey + (v - grey) * sat));
 return c.map(v => clamp(v * (1 + v / white2) / (1 + v), 0, 1));
}

// 1. Real vendored TSL + StandardNodeLibrary integration
const realGradeFn = createGradeTSL({ TSL });
assert.equal(typeof realGradeFn, 'function', 'createGradeTSL returns a TSL Fn');
assert.equal(realGradeFn.isNode, true, 'gradeTSL is a real TSL node');
const callNode = realGradeFn(TSL.vec3(0.5, 0.25, 0.1), TSL.float(1.12));
assert.ok(callNode && callNode.isNode, 'gradeTSL builds a valid TSL call node');

const lib = new WGPU.StandardNodeLibrary();
const fakeRenderer = { library: lib, toneMapping: 0 };
const installed = installGradeTSL({ THREE, TSL, renderer: fakeRenderer });
assert.equal(typeof installed, 'function', 'installGradeTSL returns the registered Fn');
assert.equal(fakeRenderer.toneMapping, THREE.CustomToneMapping, 'sets CustomToneMapping');
assert.equal(typeof lib.getToneMappingFunction(THREE.CustomToneMapping), 'function', 'registered in real StandardNodeLibrary');
assert.equal(installGradeTSL({ THREE, TSL, renderer: {} }), null, 'returns null when renderer.library is absent');

// 2. Source checks: tsl-grade.js imports GRADE rather than copying magic numbers
const tslSrc = await readFile('dist/tsl-grade.js', 'utf8');
assert(tslSrc.includes("from './daynight.js'") && tslSrc.includes('GRADE'), 'tsl-grade.js imports GRADE from daynight.js');

// 3. Numerical parity across a 24-entry colour + exposure table (TSL CPU execution vs gradeGLSL() vs grade())
const cpuTSL = makeCpuTSL();
const cpuGrade = createGradeTSL({ TSL: cpuTSL });
const glsl = gradeGLSL();
const table = [
 [[0, 0, 0], 1], [[-0.2, -0.1, 0], 1], [[0.005, 0.005, 0.005], 1], [[0.01, 0.01, 0.01], 1],
 [[0.012, 0.006, 0.006], 1], [[0.05, 0.08, 0.04], 1], [[0.18, 0.18, 0.18], 1.12], [[0.25, 0.25, 0.25], 1.12],
 [[0.6, 0.2, 0.1], 1.05], [[0.1, 0.7, 0.2], 1.12], [[0.1, 0.2, 0.8], 1.0], [[0.9, 0.85, 0.7], 1.05],
 [[1.5, 1.5, 1.5], 1.12], [[2.0, 2.0, 2.0], 1.0], [[3.0, 1.5, 0.5], 1.6], [[50, 50, 50], 1.12],
 [[0.02, 0.03, 0.06], 0.8], [[0.4, 0.4, 0.4], 0.5], [[0.4, 0.4, 0.4], 2.0], [[1.2, 0.1, 0.9], 1.12],
 [[0.0, 0.0, 1.0], 1.12], [[1.0, 0.0, 0.0], 1.12], [[0.0, 1.0, 0.0], 1.12], [[0.3, 0.5, 0.2], 1.1]
];
let maxDiff = 0;
for (const [rgb, exp] of table) {
 const tslOut = cpuGrade(cpuTSL.vec3(...rgb), cpuTSL.float(exp))._raw;
 const glslOut = evalGLSLSource(glsl, rgb, exp);
 const jsOut = grade(rgb, exp);
 for (let i = 0; i < 3; i++) {
  const d1 = Math.abs(tslOut[i] - glslOut[i]);
  const d2 = Math.abs(tslOut[i] - jsOut[i]);
  maxDiff = Math.max(maxDiff, d1, d2);
  assert(d1 < 1e-12, `TSL vs GLSL mismatch at ${rgb} exp=${exp} ch=${i}: ${tslOut[i]} vs ${glslOut[i]}`);
  assert(d2 < 1e-12, `TSL vs grade() mismatch at ${rgb} exp=${exp} ch=${i}: ${tslOut[i]} vs ${jsOut[i]}`);
 }
}
assert.equal(GRADE.gain, 1.6);

// 4. Mock WebGPURenderer contract verification (tests/support/mock-renderer.mjs)
const dir = await mkdtemp(join(tmpdir(), 'tsl-grade-mock-'));
try {
 await cp('dist/vendor', join(dir, 'vendor'), { recursive: true });
 await writeMockRenderer(dir);
 const mockWgpu = await import(pathToFileURL(join(dir, 'vendor/three.webgpu.js')).href);
 const r = new mockWgpu.WebGPURenderer();
 assert.equal(r.initialized, false);
 assert.equal(r.backend.isWebGLBackend, true);
 assert.throws(() => r.render({ name: 'world' }, {}), /init\(\) must be awaited/);
 assert.throws(() => r.compute(), /init\(\) must be awaited/);
 const pipe = new mockWgpu.RenderPipeline(r);
 assert.throws(() => pipe.render(), /init\(\) must be awaited/);
 await r.init();
 assert.equal(r.initialized, true);
 pipe.render();
 installGradeTSL({ THREE, TSL, renderer: r });
 assert.equal(r.toneMapping, THREE.CustomToneMapping);
 assert.equal(typeof r._toneMappings.get(THREE.CustomToneMapping), 'function', 'mock library.addToneMapping recorded gradeTSL');
} finally {
 await rm(dir, { recursive: true, force: true });
}

// Note: WGSL/GLSL backend shader compilation & pixel output under WebGPURenderer can only be verified on a real GPU/browser.
console.log(`PASS tsl-grade: ${table.length} colour/exposure pairs matched gradeGLSL() & grade() (maxDiff=${maxDiff.toExponential(2)}), StandardNodeLibrary + mock-renderer verified.`);
