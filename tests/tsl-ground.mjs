// Parity tests for T4 dormant TSL ground shader (tsl-ground.js + tsl-ground-kinds.js) vs ground-shader.js.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../dist/vendor/three.module.js';
import * as WGPU from '../dist/vendor/three.webgpu.js';
import * as TSL from '../dist/vendor/three.tsl.js';
import * as R from '../dist/ground-rules.js';
import { GROUND_UNIFORMS, groundProgramKey, groundShaderParts, patchGround } from '../dist/ground-shader.js';
import { SKY_HORIZON } from '../dist/sky.js';
import { createGroundUniformsTSL, makeGroundMaterialTSL } from '../dist/tsl-ground.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const step = (e, x) => (x < e ? 0 : 1);
const mix = (a, b, t) => a * (1 - t) + b * t;
const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// CPU-evaluating TSL adapter with finite-difference dFdx/dFdy and If support.
function makeCpuTSL(st) {
 const raw = v => (v && v._get ? raw(v._get()) : v && v._raw !== undefined ? raw(v._raw) : Array.isArray(v) ? v.map(raw) : v && v.isColor ? [v.r, v.g, v.b] : v && v.isVector3 ? [v.x, v.y, v.z] : v && v.isVector4 ? [v.x, v.y, v.z, v.w] : v);
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
   get xy() { return wrap(null, () => [get()[0], get()[1]]); },
   get xz() { return wrap(null, () => [get()[0], get()[2]]); },
   get xyz() { return wrap(null, () => [get()[0], get()[1], get()[2]]); },
   get rgb() { return wrap(null, () => [get()[0], get()[1], get()[2]]); },
   get yzx() { return wrap(null, () => [get()[1], get()[2], get()[0]]); },
   mul: o => bin(o, (a, b) => a * b), div: o => bin(o, (a, b) => a / b),
   add: o => bin(o, (a, b) => a + b), sub: o => bin(o, (a, b) => a - b),
   negate: () => un(a => -a),
   assign(o) { const r = raw(o); if (Array.isArray(val)) val.splice(0, val.length, ...r); else val = r; return this; },
   addAssign(o) { const r = bin(o, (a, b) => a + b)._raw; if (Array.isArray(val)) val.splice(0, val.length, ...r); else val = r; return this; },
   mulAssign(o) { const r = bin(o, (a, b) => a * b)._raw; if (Array.isArray(val)) val.splice(0, val.length, ...r); else val = r; return this; },
   toVar() { const c = get(); return wrap(Array.isArray(c) ? [...c] : c); },
   greaterThan: o => wrap(null, () => raw(get()) > raw(o)),
   lessThan: o => wrap(null, () => raw(get()) < raw(o)),
   and: o => wrap(null, () => Boolean(raw(get())) && Boolean(raw(o)))
  };
 };
 const deriv = (node, key) => wrap(null, () => {
  const base = raw(node), eps = 1e-4, savedW = [...st.posWorld], savedV = [...st.posView];
  if (key === 'x') { st.posWorld = [savedW[0] + eps, savedW[1], savedW[2]]; st.posView = [savedV[0] + eps, savedV[1], savedV[2]]; }
  else { st.posWorld = [savedW[0], savedW[1], savedW[2] + eps]; st.posView = [savedV[0], savedV[1], savedV[2] + eps]; }
  const next = raw(node);
  st.posWorld = savedW; st.posView = savedV;
  return Array.isArray(base) ? next.map((v, i) => v - base[i]) : next - base;
 });
 return {
  Fn: fn => (...args) => (args.length ? wrap(null, () => raw(fn(args))) : (() => fn())),
  If: (c, f) => { if (raw(c)) f(); return {}; },
  Discard: () => { st.discarded = true; },
  uniform: init => { const u = { value: init }; const w = wrap(null, () => raw(u.value)); Object.defineProperty(w, 'value', { get: () => u.value, set: v => { u.value = v; } }); return w; },
  array: arr => ({ element: idx => wrap(null, () => arr[raw(idx)]) }),
  vec2: (x, y = x) => wrap(null, () => Array.isArray(raw(x)) ? raw(x).slice(0, 2) : [raw(x), raw(y)]),
  vec3: (x, y = x, z = x) => wrap(null, () => Array.isArray(raw(x)) ? raw(x).slice(0, 3) : [raw(x), raw(y), raw(z)]),
  vec4: (a, b, c, d) => wrap(null, () => { const A = raw(a); return Array.isArray(A) ? [...A, ...(b !== undefined ? [raw(b)] : []), ...(c !== undefined ? [raw(c)] : [])].slice(0, 4) : [raw(a), raw(b), raw(c), raw(d)]; }),
  mat2: (a, b, c, d) => ({ mul: v => wrap(null, () => { const u = raw(v); return [a * u[0] + c * u[1], b * u[0] + d * u[1]]; }) }),
  float: x => wrap(null, () => Number(raw(x))),
  int: x => wrap(null, () => Math.trunc(raw(x))),
  abs: a => wrap(null, () => { const A = raw(a); return Array.isArray(A) ? A.map(Math.abs) : Math.abs(A); }),
  sign: a => wrap(null, () => Math.sign(raw(a))),
  sqrt: a => wrap(null, () => Math.sqrt(raw(a))),
  sin: a => wrap(null, () => Math.sin(raw(a))),
  floor: a => wrap(null, () => { const A = raw(a); return Array.isArray(A) ? A.map(Math.floor) : Math.floor(A); }),
  fract: a => wrap(null, () => { const A = raw(a); return Array.isArray(A) ? A.map(x => x - Math.floor(x)) : A - Math.floor(A); }),
  mod: (a, b) => wrap(null, () => { const x = raw(a), y = raw(b); return x - y * Math.floor(x / y); }),
  pow: (a, b) => wrap(null, () => { const A = raw(a), B = raw(b); return Array.isArray(A) ? A.map((x, i) => Math.pow(x, Array.isArray(B) ? B[i] : B)) : Math.pow(A, B); }),
  clamp: (x, a, b) => wrap(null, () => { const X = raw(x), A = raw(a), B = raw(b); return Array.isArray(X) ? X.map((v, i) => clamp(v, Array.isArray(A) ? A[i] : A, Array.isArray(B) ? B[i] : B)) : clamp(X, A, B); }),
  max: (a, b) => wrap(null, () => { const A = raw(a), B = raw(b); return Array.isArray(A) ? A.map((x, i) => Math.max(x, Array.isArray(B) ? B[i] : B)) : Math.max(A, B); }),
  min: (a, b) => wrap(null, () => { const A = raw(a), B = raw(b); return Array.isArray(A) ? A.map((x, i) => Math.min(x, Array.isArray(B) ? B[i] : B)) : Math.min(A, B); }),
  step: (e, x) => wrap(null, () => step(raw(e), raw(x))),
  smoothstep: (a, b, x) => wrap(null, () => smoothstep(raw(a), raw(b), raw(x))),
  select: (c, a, b) => wrap(null, () => (raw(c) ? raw(a) : raw(b))),
  dot: (a, b) => wrap(null, () => dot3(raw(a), raw(b))),
  cross: (a, b) => wrap(null, () => cross3(raw(a), raw(b))),
  length: a => wrap(null, () => Math.hypot(...raw(a))),
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
  uv: () => wrap(null, () => st.uv),
  texture: (_tex, uvNode) => wrap(null, () => st.sampleTex(raw(uvNode))),
  vertexColor: () => wrap(null, () => st.vertexColor),
  positionWorld: wrap(null, () => st.posWorld),
  positionView: wrap(null, () => st.posView),
  cameraPosition: wrap(null, () => st.camPos),
  normalView: wrap(null, () => st.normalView),
  cameraViewMatrix: { mul: v => wrap(null, () => raw(v)) },
  screenCoordinate: wrap(null, () => st.screenCoord),
  screenSize: wrap(null, () => st.screenSize || [1400, 900]),
  faceDirection: wrap(null, () => st.faceDir),
  dFdx: node => deriv(node, 'x'),
  dFdy: node => deriv(node, 'z')
 };
}
class MockNodeMat { constructor(p = {}) { Object.assign(this, p); this.color = new THREE.Color(p.color ?? 0xffffff); this.userData = {}; } }

// Independent CPU reimplementation of dist/ground-shader.js GLSL formulas.
function evalGlslGround(kind, st, { isHigh = true, edgeBox = null, gravel = 0, wet = 1, amount = 1, baseColor = [1, 1, 1], roughness = 1, hasMap = true, sky = [0.62, 0.74, 0.86], vertexColors = false } = {}) {
 const x = st.posWorld[0], z = st.posWorld[2], edge = !!(edgeBox && isHigh && R.edgeOf(kind));
 let edgeM = 1, discarded = false;
 if (edge) {
  const e = R.edgeOf(kind);
  const d = Math.min(Math.min(x - edgeBox.x0, edgeBox.x1 - x), Math.min(z - edgeBox.z0, edgeBox.z1 - z));
  const ec = R.edgeCover(kind, d, x, z);
  edgeM = ec.m;
  if (amount > 0.5 && ec.cover < R.bayerAt(st.screenCoord[0], (st.screenSize || [1400, 900])[1] - st.screenCoord[1])) discarded = true;
 }
 let diff = [...baseColor];
 if (vertexColors) diff = diff.map((c, i) => c * st.vertexColor[i]);
 if (hasMap) {
  const muv = [st.uv[0] * 4, st.uv[1] * 3];
  let samp = st.sampleTex(muv);
  if (isHigh) {
   const c = Math.cos(R.GD_NOTILE_ROT), s = Math.sin(R.GD_NOTILE_ROT);
   const ruv = [c * muv[0] - s * muv[1], s * muv[0] + c * muv[1]].map((v, i) => v * R.GD_NOTILE_ZOOM + R.GD_NOTILE_OFFSET[i]);
   const w = smoothstep(R.GD_NOTILE_LO, R.GD_NOTILE_HI, R.notileAt(x, z));
   const alt = st.sampleTex(ruv);
   samp = samp.map((v, i) => mix(v, alt[i], w));
  }
  diff = diff.map((v, i) => v * samp[i]);
 }
 const dist = Math.hypot(x - st.camPos[0], st.posWorld[1] - st.camPos[1], z - st.camPos[2]);
 const gdFar = clamp((dist - R.GD_DETAIL_NEAR) / (R.GD_DETAIL_FAR - R.GD_DETAIL_NEAR), 0, 1), gdDet = 1 - gdFar;
 const mac = R.macroAt(x, z), tone = R.groundTone(x, z, dist);
 let col = diff.map(v => v * tone);
 if (R.DRY_KINDS.includes(kind)) {
  const lin = R.hexToLinear(R.GD_DRY_TINT), luma = lin[0] * 0.2126 + lin[1] * 0.7152 + lin[2] * 0.0722;
  const hue = lin.map(v => v / luma), cLum = col[0] * 0.2126 + col[1] * 0.7152 + col[2] * 0.0722;
  col = col.map((v, i) => mix(v, hue[i] * cLum, R.GD_DRY_AMOUNT * mac));
 }
 if (edge && kind === 'mud') col = col.map(v => v * mix(R.GD_MUD_RIM_DARK, 1, edgeM));
 const plain = [...col];
 let gdH = 0, gdPud = 0;
 const heightAt = (qx, qz, em) => {
  if (kind === 'grass' || kind === 'farm' || kind === 'valley') return R.valueNoise(qx / R.GD_CLUMP_CELL + R.GD_SEED_CLUMP[0], qz / R.GD_CLUMP_CELL + R.GD_SEED_CLUMP[1]) * R.GD_GRASS_H;
  if (kind === 'forest') {
   const lx = qx / R.GD_LITTER_CELL, lz = qz / R.GD_LITTER_CELL, ix = Math.floor(lx), iz = Math.floor(lz);
   const lh = R.hash2(ix + R.GD_SEED_DETAIL[0], iz + R.GD_SEED_DETAIL[1]);
   const lm = step(lh, R.GD_LITTER) * (1 - smoothstep(0.28, 0.4, Math.hypot(lx - ix - 0.5, lz - iz - 0.5)));
   return lm * R.GD_LITTER_H;
  }
  if (kind === 'dirt') {
   const pc = mix(R.GD_PEBBLE_CELL, R.GD_GRAVEL_CELL, gravel);
   const pb = R.pebbleAt(qx, qz, pc, mix(R.GD_PEBBLE_OCC, R.GD_GRAVEL_OCC, gravel), [mix(R.GD_PEBBLE_R[0], R.GD_GRAVEL_R[0], gravel), mix(R.GD_PEBBLE_R[1], R.GD_GRAVEL_R[1], gravel)]);
   const wx = qx / R.GD_CRACK_CELL + (R.valueNoise(qx * 0.9 + R.GD_SEED_CRACK[0], qz * 0.9 + R.GD_SEED_CRACK[1]) - 0.5) * R.GD_CRACK_WARP * 2;
   const wz = qz / R.GD_CRACK_CELL + (R.valueNoise(qx * 0.9 + R.GD_SEED_CRACK[0] + 31, qz * 0.9 + R.GD_SEED_CRACK[1] + 31) - 0.5) * R.GD_CRACK_WARP * 2;
   const eg = 0.5 - Math.max(Math.abs(wx - Math.floor(wx) - 0.5), Math.abs(wz - Math.floor(wz) - 0.5));
   const ck = (1 - smoothstep(0, R.GD_CRACK_W, eg)) * smoothstep(R.GD_CRACK_COVER, R.GD_CRACK_COVER + 0.1, R.valueNoise(qx * R.GD_CRACK_MASK_SCALE + R.GD_SEED_CRACK[0], qz * R.GD_CRACK_MASK_SCALE + R.GD_SEED_CRACK[1])) * (1 - gravel);
   return pb.h * mix(R.GD_PEBBLE_H, R.GD_GRAVEL_H, gravel) - ck * R.GD_CRACK_H;
  }
  if (kind === 'plowed') {
   const fs = R.furrowAt(qz), cr = smoothstep(0.2, 1, fs), ch = R.valueNoise(qx / R.GD_CLOD_CELL + R.GD_SEED_DETAIL[0], qz / R.GD_CLOD_CELL + R.GD_SEED_DETAIL[1]);
   return fs * 0.5 * R.GD_FURROW_H + cr * ch * R.GD_CLOD_H;
  }
  if (kind === 'mud') {
   const pd = R.puddleMask(R.puddleAt(qx, qz), wet) * em;
   const rg = 1 - Math.abs(2 * R.valueNoise(qx / R.GD_MUD_RIDGE_CELL + R.GD_SEED_DETAIL[0], qz / R.GD_MUD_RIDGE_CELL + R.GD_SEED_DETAIL[1]) - 1);
   const mh = mix(R.valueNoise(qx * R.GD_MUD_CLOD_SCALE + R.GD_SEED_PEBBLE[0], qz * R.GD_MUD_CLOD_SCALE + R.GD_SEED_PEBBLE[1]), rg, R.GD_MUD_RIDGE);
   return mix(mh * R.GD_MUD_H, 0, pd);
  }
  return 0;
 };
 if (kind === 'grass' || kind === 'farm' || kind === 'valley') {
  const cl = R.valueNoise(x / R.GD_CLUMP_CELL + R.GD_SEED_CLUMP[0], z / R.GD_CLUMP_CELL + R.GD_SEED_CLUMP[1]);
  col = col.map(v => v * mix(R.GD_CLUMP_DARK, 1, smoothstep(0.25, 0.6, cl)));
  if (isHigh) {
   const fx = x / R.GD_FLECK_CELL, fz = z / R.GD_FLECK_CELL, fh = R.hash2(Math.floor(fx) + R.GD_SEED_DETAIL[0], Math.floor(fz) + R.GD_SEED_DETAIL[1]);
   const m = step(1 - R.GD_FLECK_FILL, fh) * step(Math.hypot(fx - Math.floor(fx) - 0.5, fz - Math.floor(fz) - 0.5), 0.3);
   col = col.map(v => v * mix(1, R.GD_FLECK_GAIN, m));
  }
 } else if (kind === 'forest') {
  const lx = x / R.GD_LITTER_CELL, lz = z / R.GD_LITTER_CELL, ix = Math.floor(lx), iz = Math.floor(lz);
  const lh = R.hash2(ix + R.GD_SEED_DETAIL[0], iz + R.GD_SEED_DETAIL[1]);
  const lm = step(lh, R.GD_LITTER) * (1 - smoothstep(0.28, 0.4, Math.hypot(lx - ix - 0.5, lz - iz - 0.5)));
  const ls = lh / R.GD_LITTER, lc = R.hexToLinear(R.GD_LITTER_COLORS[ls < 0.34 ? 0 : ls < 0.67 ? 1 : 2]);
  const j = 0.8 + 0.4 * R.hash2(ix + 7.7, iz + 7.7);
  col = col.map((v, i) => mix(v, lc[i] * j, lm * R.GD_LITTER_MIX));
 } else if (kind === 'dirt') {
  const pc = mix(R.GD_PEBBLE_CELL, R.GD_GRAVEL_CELL, gravel);
  const pb = R.pebbleAt(x, z, pc, mix(R.GD_PEBBLE_OCC, R.GD_GRAVEL_OCC, gravel), [mix(R.GD_PEBBLE_R[0], R.GD_GRAVEL_R[0], gravel), mix(R.GD_PEBBLE_R[1], R.GD_GRAVEL_R[1], gravel)]);
  const pin = step(0.0001, pb.h), shD = mix(1, mix(R.GD_PEBBLE_RIM, 1 + R.GD_PEBBLE_TOP, pb.h), pin);
  const tint = R.GD_GRAVEL_TINTS[pb.id < 0.34 ? 0 : pb.id < 0.67 ? 1 : 2];
  col = col.map((v, i) => v * mix(shD, mix(R.GD_GRAVEL_GAP, tint[i] * (1 + R.GD_PEBBLE_TOP * pb.h), pin), gravel));
  if (isHigh) {
   const wx = x / R.GD_CRACK_CELL + (R.valueNoise(x * 0.9 + R.GD_SEED_CRACK[0], z * 0.9 + R.GD_SEED_CRACK[1]) - 0.5) * R.GD_CRACK_WARP * 2;
   const wz = z / R.GD_CRACK_CELL + (R.valueNoise(x * 0.9 + R.GD_SEED_CRACK[0] + 31, z * 0.9 + R.GD_SEED_CRACK[1] + 31) - 0.5) * R.GD_CRACK_WARP * 2;
   const eg = 0.5 - Math.max(Math.abs(wx - Math.floor(wx) - 0.5), Math.abs(wz - Math.floor(wz) - 0.5));
   const ck = (1 - smoothstep(0, R.GD_CRACK_W, eg)) * smoothstep(R.GD_CRACK_COVER, R.GD_CRACK_COVER + 0.1, R.valueNoise(x * R.GD_CRACK_MASK_SCALE + R.GD_SEED_CRACK[0], z * R.GD_CRACK_MASK_SCALE + R.GD_SEED_CRACK[1])) * (1 - gravel);
   col = col.map(v => v * (1 - ck * R.GD_CRACK));
  }
 } else if (kind === 'plowed') {
  const fs = R.furrowAt(z), cr = smoothstep(0.2, 1, fs), ch = R.valueNoise(x / R.GD_CLOD_CELL + R.GD_SEED_DETAIL[0], z / R.GD_CLOD_CELL + R.GD_SEED_DETAIL[1]);
  col = col.map(v => v * (1 + fs * R.GD_FURROW_AMP * 0.3 + cr * (ch - 0.5) * 0.25));
 } else if (kind === 'paving') {
  const slab = R.slabTone(x, z); col = col.map(v => v * slab);
  if (isHigh) {
   const sx = (x / R.GD_SLAB - Math.floor(x / R.GD_SLAB)) * R.GD_SLAB, sz = (z / R.GD_SLAB - Math.floor(z / R.GD_SLAB)) * R.GD_SLAB;
   const se = Math.min(Math.min(sx, R.GD_SLAB - sx), Math.min(sz, R.GD_SLAB - sz));
   col = col.map(v => v * mix(1, R.GD_SLAB_EDGE_DARK, 1 - smoothstep(0, R.GD_SLAB_EDGE, se)));
  }
 } else if (kind === 'mud') {
  const pd = R.puddleMask(R.puddleAt(x, z), wet) * edgeM; gdPud = pd * gdDet;
  if (isHigh) {
   const rg = 1 - Math.abs(2 * R.valueNoise(x / R.GD_MUD_RIDGE_CELL + R.GD_SEED_DETAIL[0], z / R.GD_MUD_RIDGE_CELL + R.GD_SEED_DETAIL[1]) - 1);
   const mh = mix(R.valueNoise(x * R.GD_MUD_CLOD_SCALE + R.GD_SEED_PEBBLE[0], z * R.GD_MUD_CLOD_SCALE + R.GD_SEED_PEBBLE[1]), rg, R.GD_MUD_RIDGE);
   col = col.map(v => v * (1 + 0.3 * (mh - 0.5)));
  }
 }
 col = col.map((v, i) => mix(plain[i], v, gdDet));
 if (kind === 'mud') {
  const wt = wet * R.GD_MUD_WET;
  col = col.map(v => v * mix(1, R.GD_WET_DARK, wt) * mix(1, R.GD_PUDDLE_DARK, gdPud));
 }
 const rgb = diff.map((v, i) => mix(v, col[i], amount));
 const eps = 1e-4, nk = 1 - smoothstep(R.GD_NORMAL_NEAR, R.GD_NORMAL_FAR, dist);
 gdH = heightAt(x, z, edgeM);
 const emX = edge ? R.edgeCover(kind, Math.min(Math.min(x + eps - edgeBox.x0, edgeBox.x1 - (x + eps)), Math.min(z - edgeBox.z0, edgeBox.z1 - z)), x + eps, z).m : 1;
 const emZ = edge ? R.edgeCover(kind, Math.min(Math.min(x - edgeBox.x0, edgeBox.x1 - x), Math.min(z + eps - edgeBox.z0, edgeBox.z1 - (z + eps))), x, z + eps).m : 1;
 const dAx = (heightAt(x + eps, z, emX) - gdH) * nk * amount * R.GD_NORMAL, dAz = (heightAt(x, z + eps, emZ) - gdH) * nk * amount * R.GD_NORMAL;
 const sx = [eps, 0, 0], sy = [0, 0, eps], nrm = st.normalView;
 const r1 = cross3(sy, nrm), r2 = cross3(nrm, sx), dt = dot3(sx, r1) * st.faceDir;
 const normal = Math.abs(dt) > 1e-12 ? norm3(nrm.map((v, i) => Math.abs(dt) * v - Math.sign(dt) * (dAx * r1[i] + dAz * r2[i]))) : norm3(nrm);
 const rough = kind === 'mud' ? mix(roughness, mix(mix(1, R.GD_WET_ROUGH, wet * R.GD_MUD_WET), R.GD_PUDDLE_ROUGH, gdPud), amount) : roughness;
 const gdC = clamp(dot3([0, 1, 0], norm3([-st.posView[0], -st.posView[1], -st.posView[2]])), 0, 1);
 const emissive = kind === 'mud' && isHigh ? sky.map(c => Math.pow(Math.max(c, 1e-5), R.GD_SKY_GAMMA) * R.schlick(gdC) * R.GD_SHEEN_GAIN * gdPud * amount) : [0, 0, 0];
 return { rgb, discarded, normal, rough, emissive };
}

// 1. Source imports constants from ground-rules, ground-shader, sky (no copied numbers).
const srcMain = await readFile('dist/tsl-ground.js', 'utf8');
const srcKinds = await readFile('dist/tsl-ground-kinds.js', 'utf8');
assert(srcMain.includes("from './ground-rules.js'") && srcMain.includes("from './ground-shader.js'") && srcMain.includes("from './sky.js'"));
assert(srcKinds.includes("from './ground-rules.js'"));

// 2. Real vendored WGPU + TSL material builds for ALL 11 kinds + unknown throw + keys/flags.
assert.throws(() => makeGroundMaterialTSL('lava', { THREE, TSL, MeshStandardNodeMaterial: WGPU.MeshStandardNodeMaterial }), /unknown ground kind/);
const shared = createGroundUniformsTSL({ TSL });
assert.equal(shared.uSkyHorizon.value, SKY_HORIZON.value, 'shares SKY_HORIZON color reference');
assert.equal(shared.uGdWet.value, GROUND_UNIFORMS.uGdWet.value);
const map = new THREE.DataTexture(new Uint8Array([200, 180, 160, 255]), 1, 1); map.repeat.set(4, 3);
for (const kind of R.GROUND_KINDS) {
 const edgeBox = R.edgeOf(kind) ? { x0: -20, x1: 20, z0: -15, z1: 15 } : null;
 for (const isHigh of [true, false]) {
  const mat = makeGroundMaterialTSL(kind, {
   THREE, TSL, MeshStandardNodeMaterial: WGPU.MeshStandardNodeMaterial,
   color: '#8a9a7c', map: kind === 'valley' ? null : map, roughness: 0.95,
   vertexColors: kind === 'valley', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
   isHigh, edgeBox, gravel: kind === 'dirt', shared
  });
  assert.equal(mat.isMeshStandardNodeMaterial, true);
  assert.equal(mat.userData.groundKind, kind);
  assert.equal(mat.userData.groundProgramKey, groundProgramKey(kind, isHigh, !!(edgeBox && isHigh)));
  assert.equal(Object.hasOwn(mat, 'customProgramCacheKey'), false, 'T5: no shared program key on a node material (WebGPURenderer would reuse the first material\'s node build)');
  assert.equal(mat.polygonOffset, true);
  assert.equal(mat.polygonOffsetFactor, -2);
  assert.equal(!!mat.normalNode, isHigh && R.GD_DETAIL_KINDS.includes(kind) && kind !== 'paving');
  assert.equal(!!mat.roughnessNode, kind === 'mud');
  assert.equal(!!mat.emissiveNode, kind === 'mud' && isHigh);
  assert.equal(mat.vertexColors, false, 'valley vertexColors handled inside colorNode before dryHue');
 }
}

// 3. CPU-evaluated parity across ALL 11 kinds + gravel + edge + near/far + wet + faceDirection.
const st = {
 posWorld: [10, 0, 10], posView: [2, -1.5, -6], camPos: [10, 2, 18], normalView: [0, 1, 0],
 faceDir: 1, uv: [0.3, 0.7], screenCoord: [3, 2], vertexColor: [0.6, 0.7, 0.45], discarded: false,
 sampleTex: u => [0.55 + 0.25 * Math.sin(u[0] * 3.1), 0.5 + 0.2 * Math.cos(u[1] * 2.7), 0.42 + 0.15 * Math.sin(u[0] + u[1])]
};
let maxColDiff = 0, maxNrmDiff = 0, maxRghDiff = 0, maxEmiDiff = 0, checks = 0;
const cpuShared = createGroundUniformsTSL({ TSL: makeCpuTSL(st), skyHorizon: new THREE.Color(0.62, 0.74, 0.86) });
for (const kind of R.GROUND_KINDS) {
 for (const isHigh of [true, false]) {
  const edgeBox = R.edgeOf(kind) ? { x0: 0, x1: 20, z0: 0, z1: 20 } : null;
  const gravel = kind === 'dirt' ? 1 : 0;
  const hasMap = kind !== 'valley';
  const mat = makeGroundMaterialTSL(kind, {
   THREE, TSL: makeCpuTSL(st), NodeMaterial: MockNodeMat, color: '#9ab088',
   map: hasMap ? map : null, roughness: 0.95, vertexColors: kind === 'valley',
   isHigh, edgeBox, gravel: !!gravel, shared: cpuShared
  });
  const baseCol = [mat.color.r, mat.color.g, mat.color.b];
  const pts = edgeBox ? [[0.4, 0.4], [1.1, 1.5], [10.3, 9.7]] : [[3.2, -7.4], [10.3, 9.7]];
  for (const [px, pz] of pts) {
   for (const camY of [2, 70]) {
    for (const wet of (kind === 'mud' ? [0, 0.5, 1] : [1])) {
     cpuShared.uGdWet.value = wet;
     st.posWorld = [px, 0, pz]; st.camPos = [px, camY, pz + (camY > 20 ? 50 : 6)];
     st.posView = [1.5, -1.6, -5]; st.faceDir = camY > 20 ? -1 : 1; st.discarded = false;
     const gotCol = mat.colorNode()._raw;
     const exp = evalGlslGround(kind, st, { isHigh, edgeBox, gravel, wet, baseColor: baseCol, roughness: 0.95, hasMap, sky: [0.62, 0.74, 0.86], vertexColors: kind === 'valley' });
     assert.equal(st.discarded, exp.discarded, `discard mismatch ${kind} (${px},${pz})`);
     if (!exp.discarded) {
      for (let k = 0; k < 3; k++) { const d = Math.abs(gotCol[k] - exp.rgb[k]); maxColDiff = Math.max(maxColDiff, d); assert(d < 1e-11, `${kind} col[${k}]: ${gotCol[k]} vs ${exp.rgb[k]}`); }
     }
     if (mat.normalNode) {
      const gotN = mat.normalNode()._raw;
      for (let k = 0; k < 3; k++) { const d = Math.abs(gotN[k] - exp.normal[k]); maxNrmDiff = Math.max(maxNrmDiff, d); assert(d < 1e-10, `${kind} nrm[${k}]: ${gotN[k]} vs ${exp.normal[k]}`); }
     }
     if (mat.roughnessNode) {
      const gotR = mat.roughnessNode()._raw;
      const d = Math.abs(gotR - exp.rough); maxRghDiff = Math.max(maxRghDiff, d); assert(d < 1e-11);
     }
     if (mat.emissiveNode) {
      const gotE = mat.emissiveNode()._raw;
      for (let k = 0; k < 3; k++) { const d = Math.abs(gotE[k] - exp.emissive[k]); maxEmiDiff = Math.max(maxEmiDiff, d); assert(d < 1e-11); }
     }
     checks++;
    }
   }
  }
 }
}
console.log(`PASS tsl-ground: all 11 ground kinds (${checks} cases) matched ground-shader.js (col=${maxColDiff.toExponential(2)}, nrm=${maxNrmDiff.toExponential(2)}, rgh=${maxRghDiff.toExponential(2)}, emi=${maxEmiDiff.toExponential(2)}).`);
