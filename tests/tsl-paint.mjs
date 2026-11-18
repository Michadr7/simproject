// Parity tests for T4 dormant TSL vehicle paint and glass (tsl-paint.js) vs paint-shader.js.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../dist/vendor/three.module.js';
import * as WGPU from '../dist/vendor/three.webgpu.js';
import * as TSL from '../dist/vendor/three.tsl.js';
import { PAINT, paintUniforms, coloursOf } from '../dist/paint.js';
import { WEAR_TILE, CRACK_PLACE } from '../dist/paint-shader.js';
import { makePaintMaterialTSL, makeGlassMaterialTSL, setPaintUniformsTSL, setLookUniformsTSL } from '../dist/tsl-paint.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const step = (e, x) => (x < e ? 0 : 1);
const mix = (a, b, t) => a * (1 - t) + b * t;
const fract = x => x - Math.floor(x);
const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// CPU-evaluating TSL adapter covering paint/glass TSL nodes & nested Ifs.
function makeCpuTSL(st) {
 const raw = v => (v && v._get ? raw(v._get()) : v && v._raw !== undefined ? raw(v._raw) : Array.isArray(v) ? v.map(raw) : v && v.isColor ? [v.r, v.g, v.b] : v && v.isVector2 ? [v.x, v.y] : v && v.isVector3 ? [v.x, v.y, v.z] : v && v.isVector4 ? [v.x, v.y, v.z, v.w] : v);
 const wrap = (val, getter = null) => {
  const get = getter || (() => raw(val));
  const bin = (o, fn) => wrap(null, () => {
   const a = get(), b = raw(o);
   if (Array.isArray(a) || Array.isArray(b)) {
    const n = Array.isArray(a) ? a.length : b.length;
    const A = Array.isArray(a) ? a : Array(n).fill(a), B = Array.isArray(b) ? b : Array(n).fill(b);
    return A.map((x, i) => fn(x, B[i]));
   }
   return fn(a, b);
  });
  const un = fn => wrap(null, () => { const a = get(); return Array.isArray(a) ? a.map(fn) : fn(a); });
  return {
   _get: get, get _raw() { return get(); },
   get x() { return wrap(null, () => get()[0]); }, get y() { return wrap(null, () => get()[1]); },
   get z() { return wrap(null, () => get()[2]); }, get w() { return wrap(null, () => get()[3]); },
   get r() { return wrap(null, () => get()[0]); }, get g() { return wrap(null, () => get()[1]); }, get b() { return wrap(null, () => get()[2]); },
   get xy() { return wrap(null, () => [get()[0], get()[1]]); },
   get rgb() { return wrap(null, () => [get()[0], get()[1], get()[2]]); },
   mul: o => bin(o, (a, b) => a * b), div: o => bin(o, (a, b) => a / b),
   add: o => bin(o, (a, b) => a + b), sub: o => bin(o, (a, b) => a - b),
   negate: () => un(a => -a),
   assign(o) { const r = raw(o); if (Array.isArray(val)) val.splice(0, val.length, ...r); else val = r; return this; },
   mulAssign(o) { const r = bin(o, (a, b) => a * b)._raw; if (Array.isArray(val)) val.splice(0, val.length, ...r); else val = r; return this; },
   toVar() { const c = get(); return wrap(Array.isArray(c) ? [...c] : c); },
   greaterThan: o => wrap(null, () => raw(get()) > raw(o)),
   greaterThanEqual: o => wrap(null, () => raw(get()) >= raw(o)),
   and: o => wrap(null, () => Boolean(raw(get())) && Boolean(raw(o)))
  };
 };
 return {
  Fn: fn => (...args) => (args.length ? fn(args) : (() => fn())),
  If: (c, f) => { if (raw(c)) f(); return {}; },
  varying: node => node,
  uniform: init => { const u = { value: init }; const w = wrap(null, () => raw(u.value)); Object.defineProperty(w, 'value', { get: () => u.value, set: v => { u.value = v; } }); return w; },
  vec2: (x, y = x) => wrap(null, () => Array.isArray(raw(x)) ? raw(x).slice(0, 2) : [raw(x), raw(y)]),
  vec3: (x, y = x, z = x) => wrap(null, () => Array.isArray(raw(x)) ? raw(x).slice(0, 3) : [raw(x), raw(y), raw(z)]),
  vec4: (a, b, c, d) => wrap(null, () => { const A = raw(a); return Array.isArray(A) ? [...A, ...(b !== undefined ? [raw(b)] : []), ...(c !== undefined ? [raw(c)] : [])].slice(0, 4) : [raw(a), raw(b), raw(c), raw(d)]; }),
  float: x => wrap(null, () => Number(raw(x))),
  abs: a => wrap(null, () => { const A = raw(a); return Array.isArray(A) ? A.map(Math.abs) : Math.abs(A); }),
  fract: a => wrap(null, () => { const A = raw(a); return Array.isArray(A) ? A.map(fract) : fract(A); }),
  clamp: (x, a, b) => wrap(null, () => { const X = raw(x), A = raw(a), B = raw(b); return Array.isArray(X) ? X.map((v, i) => clamp(v, Array.isArray(A) ? A[i] : A, Array.isArray(B) ? B[i] : B)) : clamp(X, A, B); }),
  max: (a, b) => wrap(null, () => { const A = raw(a), B = raw(b); return Array.isArray(A) ? A.map((v, i) => Math.max(v, Array.isArray(B) ? B[i] : B)) : Math.max(A, B); }),
  min: (a, b) => wrap(null, () => { const A = raw(a), B = raw(b); return Array.isArray(A) ? A.map((v, i) => Math.min(v, Array.isArray(B) ? B[i] : B)) : Math.min(A, B); }),
  step: (e, x) => wrap(null, () => step(raw(e), raw(x))),
  smoothstep: (a, b, x) => wrap(null, () => smoothstep(raw(a), raw(b), raw(x))),
  select: (c, a, b) => wrap(null, () => (raw(c) ? raw(a) : raw(b))),
  dot: (a, b) => wrap(null, () => { const A = raw(a), B = raw(b); return A[0] * B[0] + A[1] * B[1] + A[2] * B[2]; }),
  normalize: a => wrap(null, () => norm3(raw(a))),
  mix: (a, b, t) => wrap(null, () => {
   const A = raw(a), B = raw(b), T = raw(t);
   if (Array.isArray(A) || Array.isArray(B)) {
    const n = Array.isArray(A) ? A.length : B.length;
    const AA = Array.isArray(A) ? A : Array(n).fill(A), BB = Array.isArray(B) ? B : Array(n).fill(B);
    return AA.map((v, i) => mix(v, BB[i], Array.isArray(T) ? T[i] : T));
   }
   return mix(A, B, T);
  }),
  texture: (_tex, uvNode) => wrap(null, () => st.sampleTex(raw(uvNode))),
  positionLocal: wrap(null, () => st.pos),
  normalLocal: wrap(null, () => st.nrm),
  materialColor: wrap(null, () => st.matColor),
  materialOpacity: wrap(null, () => st.matOpacity)
 };
}
class MockNodeMat { constructor(p = {}) { Object.assign(this, p); this.userData = {}; } }

// Independent CPU GLSL evaluators from dist/paint-shader.js.
function vPlaneCPU(p, n) {
 const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
 return ax >= ay && ax >= az ? [p[2], p[1]] : (ay >= az ? [p[0], p[2]] : [p[0], p[1]]);
}
function rgb2hsvCPU(c) {
 const K = [0, -1 / 3, 2 / 3, -1];
 const sb = step(c[2], c[1]), p = [mix(c[2], c[1], sb), mix(c[1], c[2], sb), mix(K[3], K[0], sb), mix(K[2], K[1], sb)];
 const sp = step(p[0], c[0]), q = [mix(p[0], c[0], sp), mix(p[1], p[1], sp), mix(p[3], p[2], sp), mix(c[0], p[0], sp)];
 const d = q[0] - Math.min(q[3], q[1]), e = 1e-10;
 return [Math.abs(q[2] + (q[3] - q[1]) / (6 * d + e)), d / (q[0] + e), q[0]];
}
function hsv2rgbCPU(c) {
 return [0, 1, 2].map(i => {
  const k = [1, 2 / 3, 1 / 3][i];
  const p = Math.abs(fract(c[0] + k) * 6 - 3);
  return c[2] * mix(1, clamp(p - 1, 0, 1), c[1]);
 });
}
function evalGlslPaint(st, u) {
 let col = st.matColor.slice(0, 3);
 if (u.band > 0) {
  const h = rgb2hsvCPU(col), dh = Math.abs(fract(h[0] - u.paint[3] + 0.5) - 0.5);
  const m = (1 - smoothstep(u.band * 0.6, u.band, dh)) * smoothstep(0.12, 0.25, h[1]);
  if (m > 0) {
   const nh = u.paint[0] >= 0 ? fract(u.paint[0] + (h[0] - u.paint[3]) * 0.4) : h[0];
   const r = hsv2rgbCPU([nh, clamp(h[1] * u.paint[1], 0, 1), h[2] * u.paint[2]]);
   col = col.map((v, i) => mix(v, r[i], m));
  }
 }
 if (u.wear > 0) {
  const w = u.wear, n = norm3(st.nrm), pp = vPlaneCPU(st.pos, st.nrm).map(v => v / WEAR_TILE);
  const t = st.sampleTex(pp), t2 = st.sampleTex([pp[1] * 1.35 + 0.31, pp[0] * 1.35 + 0.17]);
  const lum = col[0] * 0.3 + col[1] * 0.59 + col[2] * 0.11;
  col = col.map(v => mix(v, lum, w * 0.1) * (1 - w * 0.06));
  const zf = Math.max(smoothstep(0.4, 0.85, n[2]), 0.6 * smoothstep(0.45, 0.8, st.pos[2] / u.ext[1]));
  const zr = Math.max(smoothstep(0.4, 0.85, -n[2]), 0.6 * smoothstep(0.45, 0.8, -st.pos[2] / u.ext[1]));
  const zl = smoothstep(0.4, 0.85, n[0]), zt = smoothstep(0.4, 0.85, -n[0]);
  const loc = Math.max(Math.max(u.hit[0] * zf, u.hit[1] * zr), Math.max(u.hit[2] * zl, u.hit[3] * zt));
  const s = clamp(loc * (0.5 + 0.5 * w) * (0.4 + 0.6 * (1 - smoothstep(0.5, 1.8, st.pos[1]))), 0, 1);
  const cr = smoothstep(0.05, 0.3, 1 - Math.max(Math.abs(n[0]), Math.abs(n[1]), Math.abs(n[2])));
  const thr = 0.74 - s * 0.46, pat = smoothstep(thr, thr + 0.04, t2[1]), rim = pat * (1 - smoothstep(thr + 0.04, thr + 0.12, t2[1]));
  const scorch = smoothstep(0.3, 0.6, t[1]) * smoothstep(0.15, 0.6, s);
  col = col.map(v => v * (1 - scorch * 0.55 * (1 - pat)));
  col = col.map((v, i) => mix(v, [0.24, 0.25, 0.29][i] * (0.8 + 0.5 * t[0]), pat * 0.95));
  col = col.map((v, i) => mix(v, [0.12, 0.12, 0.14][i], rim * 0.6));
  const fk = smoothstep(0.95 - 0.6 * s - 0.3 * cr * s, 1 - 0.6 * s - 0.3 * cr * s, t[2]) * smoothstep(0.1, 0.45, s);
  col = col.map((v, i) => mix(v, [0.26, 0.27, 0.3][i], fk * 0.9));
  const sa = smoothstep(0.03, 0.3, s), halo = smoothstep(0.08, 0.3, Math.max(t[0], t2[0] * 0.8)) * (1 - smoothstep(0.3, 0.6, t[0])) * sa;
  const sc = smoothstep(0.5, 0.8, Math.max(t[0], t2[0] * smoothstep(0.4, 0.9, s))) * sa;
  col = col.map(v => mix(v, v * 0.45, halo * 0.7));
  col = col.map((v, i) => mix(v, [0.9, 0.91, 0.94][i], sc));
 }
 return col;
}
function evalGlslGlass(st, u, hasMap) {
 let rgb = st.matColor.slice(0, 3), a = (hasMap ? st.matColor[3] : 1) * st.matOpacity;
 if (u.crack > 0) {
  const pl = vPlaneCPU(st.pos, st.nrm), cp = [(pl[0] - u.map[0]) / u.map[2] + 0.5, (pl[1] - u.map[1]) / u.map[2] + 0.5];
  let k = st.sampleTex(cp)[0] * step(0, cp[0]) * step(cp[0], 1) * step(0, cp[1]) * step(cp[1], 1) * step(0.3, st.nrm[2]);
  k = smoothstep(0.12, 0.55, k * (0.5 + u.crack * 0.9));
  rgb = rgb.map((v, i) => mix(v, [0.95, 0.97, 1][i], k));
  a = Math.min(1, Math.max(a, k * 0.92) + u.crack * 0.08);
 }
 return { rgb, a };
}

// 1. Source imports constants from paint-shader, damage-textures, paint.
const src = await readFile('dist/tsl-paint.js', 'utf8');
assert(src.includes("from './paint-shader.js'") && src.includes('WEAR_TILE') && src.includes('CRACK_PLACE'));
assert(src.includes("from './damage-textures.js'") && src.includes("from './paint.js'"));

// 2. Real vendored WGPU + TSL builds & uniform helpers.
const basePaint = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.2 });
const baseGlass = new THREE.MeshStandardMaterial({ color: '#a8c8d8', transparent: true, opacity: 0.35, roughness: 0.08 });
const pWGPU = makePaintMaterialTSL({ THREE, TSL, MeshStandardNodeMaterial: WGPU.MeshStandardNodeMaterial, base: basePaint });
const gWGPU = makeGlassMaterialTSL({ THREE, TSL, MeshStandardNodeMaterial: WGPU.MeshStandardNodeMaterial, base: baseGlass, model: 'shortbed' });
assert.equal(pWGPU.material.isMeshStandardNodeMaterial, true);
assert.equal(gWGPU.material.isMeshStandardNodeMaterial, true);
assert.equal(gWGPU.material.transparent, true);
assert.deepEqual(gWGPU.uniforms.uCrackMap.value.toArray(), CRACK_PLACE.shortbed);
setPaintUniformsTSL(pWGPU.uniforms, 'worktruck', 'red');
const expU = paintUniforms('worktruck', 'red');
assert.equal(pWGPU.uniforms.uBand.value, expU.band);
assert(Math.abs(pWGPU.uniforms.uPaint.value.x - expU.hue) < 1e-6);
setLookUniformsTSL({ paintUniforms: [pWGPU.uniforms], glassUniforms: [gWGPU.uniforms] }, { wear: 0.75, crack: 0.6, hit: [1, 0, 0.4, 0] }, 'flatbed', [1.1, 2.8]);
assert.equal(pWGPU.uniforms.uWear.value.y, 0.75);
assert.deepEqual(pWGPU.uniforms.uHit.value.toArray(), [1, 0, 0.4, 0]);
assert.deepEqual(pWGPU.uniforms.uExt.value.toArray(), [1.1, 2.8]);
assert.equal(gWGPU.uniforms.uCrack.value, 0.6);
assert.deepEqual(gWGPU.uniforms.uCrackMap.value.toArray(), CRACK_PLACE.flatbed);

// 3. CPU-evaluated parity across all 6 triplanar faces, HSV models/swatches, wear/hit, and glass cracks.
const st = {
 pos: [0.4, 1.1, 2.0], nrm: [0, 0, 1], matColor: [0.35, 0.45, 0.22, 0.8], matOpacity: 0.35,
 sampleTex: u => [clamp(0.45 + 0.4 * Math.sin(u[0] * 5.2 + u[1] * 2.1), 0, 1), clamp(0.55 + 0.4 * Math.cos(u[1] * 4.7 - u[0]), 0, 1), clamp(0.6 + 0.35 * Math.sin(u[0] * 7.3 - u[1] * 3.9), 0, 1)]
};
const cpuTSL = makeCpuTSL(st);
const pCPU = makePaintMaterialTSL({ THREE, TSL: cpuTSL, NodeMaterial: MockNodeMat, wearTex: {} });
const gCPU = makeGlassMaterialTSL({ THREE, TSL: cpuTSL, NodeMaterial: MockNodeMat, crackTex: {}, model: 'shortbed' });
const normals = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0.577, 0.577, 0.577]];
const swatches = [[0.35, 0.48, 0.2, 1], [0.18, 0.28, 0.75, 1], [0.7, 0.16, 0.14, 1], [0.15, 0.15, 0.15, 1]];
let maxPaintDiff = 0, maxGlassDiff = 0, pChecks = 0, gChecks = 0;

for (const model of Object.keys(PAINT)) {
 for (const col of coloursOf(model)) {
  setPaintUniformsTSL(pCPU.uniforms, model, col.id);
  const pu = paintUniforms(model, col.id);
  for (const wear of [0, 0.6, 1]) {
   const hit = [1, 0.3, 0.7, 0.1], ext = [1.0, 2.2];
   setLookUniformsTSL({ paintUniforms: [pCPU.uniforms] }, { wear, crack: 0, hit }, model, ext);
   for (const nrm of normals) {
    for (const mc of swatches) {
     st.pos = [0.45, 0.95, 1.75]; st.nrm = nrm; st.matColor = mc;
     const got = pCPU.material.colorNode()._raw;
     const exp = evalGlslPaint(st, { paint: [pu.hue, pu.sat, pu.val, pu.src], band: pu.band, wear, hit, ext });
     for (let k = 0; k < 3; k++) { const d = Math.abs(got[k] - exp[k]); maxPaintDiff = Math.max(maxPaintDiff, d); assert(d < 1e-11, `paint ${model}/${col.id}: ${got[k]} vs ${exp[k]}`); }
     pChecks++;
    }
   }
  }
 }
}

for (const model of ['default', 'shortbed', 'flatbed']) {
 for (const crack of [0, 0.4, 1]) {
  setLookUniformsTSL({ glassUniforms: [gCPU.uniforms] }, { wear: 0, crack }, model);
  for (const pos of [[0.1, 1.8, 0.9], [0, 0, 1], [3, 4, 1]]) {
   for (const nrm of [[0, 0, 1], [0, 0.2, 0.25], [1, 0, 0]]) {
    st.pos = pos; st.nrm = nrm; st.matColor = [0.6, 0.75, 0.85, 0.8]; st.matOpacity = 0.35;
    const gotRgb = gCPU.material.colorNode()._raw;
    const gotA = gCPU.material.opacityNode()._raw;
    const exp = evalGlslGlass(st, { crack, map: CRACK_PLACE[model] }, false);
    for (let k = 0; k < 3; k++) { const d = Math.abs(gotRgb[k] - exp.rgb[k]); maxGlassDiff = Math.max(maxGlassDiff, d); assert(d < 1e-11); }
    const da = Math.abs(gotA - exp.a); maxGlassDiff = Math.max(maxGlassDiff, da); assert(da < 1e-11);
    gChecks++;
   }
  }
 }
}
console.log(`PASS tsl-paint: ${pChecks} paint cases & ${gChecks} glass cases matched paint-shader.js (paintDiff=${maxPaintDiff.toExponential(2)}, glassDiff=${maxGlassDiff.toExponential(2)}).`);
