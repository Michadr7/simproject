// Parity tests for T3 dormant TSL materials (tsl-tags, tsl-menu, tsl-tracks, tsl-smoke, tsl-debris, tsl-lights, tsl-cover, tsl-sightline).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../dist/vendor/three.module.js';
import * as WGPU from '../dist/vendor/three.webgpu.js';
import * as TSL from '../dist/vendor/three.tsl.js';

import { PALLET_CAP } from '../dist/pallets.js';
import { tagCell, glyphCell, GLYPHS } from '../dist/pallet-tags.js';
import { COVER_WIND, coverBend, gust } from '../dist/menu-scene-rules.js';
import { TRACK_MAX, TRACK_FADE_FROM, TRACK_DRAW_NEAR, TRACK_DRAW_FAR, fadeOf, drawFactor } from '../dist/tracks-rules.js';
import { createTracks } from '../dist/tracks.js';
import { SMOKE_MAX, SMOKE_ALPHA, SMOKE_SIZE, GROW, createSmoke } from '../dist/smoke.js';
import { DEBRIS_MAX, createDebris } from '../dist/debris.js';
import { createNightLights } from '../dist/night-lights.js';
import { COVER_UP, COVER_ALPHA_TEST } from '../dist/ground-cover-view.js';
import { WIND_BASE, WIND_KIND_MUL, windSample, makeWind, windBend } from '../dist/wind.js';
import { coverReach } from '../dist/ground-cover-rules.js';
import { createSightlineFade } from '../dist/world.js';

import { createPalletTagMaterialTSL, tagAtlasGrid } from '../dist/tsl-tags.js';
import { createMenuWindMaterialTSL } from '../dist/tsl-menu.js';
import { createTracksMaterialTSL, TRACK_SHADER } from '../dist/tsl-tracks.js';
import { createSmokeMaterialTSL, createSmokeMeshTSL, SMOKE_SHADER } from '../dist/tsl-smoke.js';
import { createDebrisMaterialTSL, createDebrisMeshTSL, DEBRIS_KIND, DEBRIS_SHADER } from '../dist/tsl-debris.js';
import { createNightLightsMaterialsTSL, NIGHT_SHADER } from '../dist/tsl-lights.js';
import { createCoverMaterialTSL, createCoverWindTSL } from '../dist/tsl-cover.js';
import { createSightlineFadeTSL, SIGHTLINE_FADE, BAYER_4X4 } from '../dist/tsl-sightline.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const step = (e, x) => (x < e ? 0 : 1);
const mix = (a, b, t) => a * (1 - t) + b * t;
const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// Minimal CPU-evaluating TSL adapter covering all nodes used across T3 modules.
function makeCpuTSL(st) {
 const raw = v => (v && v._get ? raw(v._get()) : v && v._raw !== undefined ? raw(v._raw) : Array.isArray(v) ? v.map(raw) : v && v.isColor ? [v.r, v.g, v.b] : v && v.isVector3 ? [v.x, v.y, v.z] : v && v.isVector4 ? [v.x, v.y, v.z, v.w] : v);
 const wrap = (val, getter = null) => {
  const get = getter || (() => raw(val));
  const bin = (o, fn) => wrap(null, () => {
   const a = get(), b = raw(o);
   if (Array.isArray(a) || Array.isArray(b)) {
    const n = Array.isArray(a) ? a.length : b.length;
    const A = Array.isArray(a) ? a : Array(n).fill(a);
    const B = Array.isArray(b) ? b : Array(n).fill(b);
    return A.map((x, i) => fn(x, B[i]));
   }
   return fn(a, b);
  });
  const un = fn => wrap(null, () => { const a = get(); return Array.isArray(a) ? a.map(fn) : fn(a); });
  return {
   _get: get,
   get _raw() { return get(); },
   get x() { return wrap(null, () => get()[0]); },
   get y() { return wrap(null, () => get()[1]); },
   get z() { return wrap(null, () => get()[2]); },
   get w() { return wrap(null, () => get()[3]); },
   get xy() { return wrap(null, () => { const a = get(); return [a[0], a[1]]; }); },
   get xz() { return wrap(null, () => { const a = get(); return [a[0], a[2]]; }); },
   get xyz() { return wrap(null, () => { const a = get(); return [a[0], a[1], a[2]]; }); },
   get rgb() { return wrap(null, () => { const a = get(); return [a[0], a[1], a[2]]; }); },
   get a() { return wrap(null, () => get()[3]); },
   mul: o => bin(o, (a, b) => a * b),
   div: o => bin(o, (a, b) => a / b),
   add: o => bin(o, (a, b) => a + b),
   sub: o => bin(o, (a, b) => a - b),
   negate: () => un(a => -a),
   element: i => wrap(null, () => get()[raw(i)]),
   assign(o) { flushIfs(); const r = raw(o); if (Array.isArray(val)) val.splice(0, val.length, ...r); else val = r; return this; },
   mulAssign(o) { flushIfs(); const r = bin(o, (a, b) => a * b)._raw; if (Array.isArray(val)) val.splice(0, val.length, ...r); else val = r; return this; },
   toVar() { const c = get(); return wrap(Array.isArray(c) ? [...c] : c); },
   toVarying() { return this; },
   normalize: () => wrap(null, () => norm3(get())),
   greaterThan: o => wrap(null, () => raw(get()) > raw(o)),
   greaterThanEqual: o => wrap(null, () => raw(get()) >= raw(o)),
   lessThan: o => wrap(null, () => raw(get()) < raw(o)),
   lessThanEqual: o => wrap(null, () => raw(get()) <= raw(o)),
   and: o => wrap(null, () => Boolean(raw(get())) && Boolean(raw(o))),
   or: o => wrap(null, () => Boolean(raw(get())) || Boolean(raw(o)))
  };
 };
 const chainIf = (cond, fn) => {
  const branches = [{ cond, fn }]; let elseFn = null;
  const api = {
   ElseIf(c, f) { branches.push({ cond: c, fn: f }); return api; },
   Else(f) { elseFn = f; return api; },
   _run() {
    for (const b of branches) if (raw(b.cond)) { b.fn(); return; }
    if (elseFn) elseFn();
   }
  };
  queueMicrotask(() => {});
  // Execute synchronously on next expression or immediately when constructed in Fn body
  const evalNow = { ElseIf(c, f) { branches.push({ cond: c, fn: f }); return evalNow; }, Else(f) { elseFn = f; return evalNow; } };
  // Proxy runs immediately after synchronous chain? No, caller creates statement inside Fn, so run via delayed flush?
  // Simpler: return a thunk-registered object and execute all pending Ifs at Fn exit, OR run eagerly via micro? No, eager: we track st._ifs!
  st._ifs.push(api);
  return api;
 };
 const flushIfs = () => { while (st._ifs.length) st._ifs.shift()._run(); };
 const T = {
  Fn: fn => (...args) => {
   if (args.length) { const r = fn(...args); flushIfs(); return r; }
   return () => { const r = fn(); flushIfs(); return r; };
  },
  If: (c, f) => {
   flushIfs();
   const branches = [{ cond: c, fn: f }]; let elseFn = null; let ran = false;
   const run = () => { if (ran) return; ran = true; for (const b of branches) if (raw(b.cond)) { b.fn(); return; } if (elseFn) elseFn(); };
   const api = { ElseIf(c2, f2) { branches.push({ cond: c2, fn: f2 }); return api; }, Else(f2) { elseFn = f2; return api; }, _run: run };
   st._ifs.push(api);
   return api;
  },
  Discard: () => { st.discarded = true; },
  uniform: init => { const u = { value: init }; const w = wrap(null, () => raw(u.value)); Object.defineProperty(w, 'value', { get: () => u.value, set: v => { u.value = v; } }); return w; },
  varying: node => node,
  array: arr => ({ element: idx => wrap(null, () => arr[raw(idx)]) }),
  vec2: (x, y = x) => wrap(null, () => Array.isArray(raw(x)) ? raw(x).slice(0, 2) : [raw(x), raw(y)]),
  vec3: (x, y = x, z = x) => wrap(null, () => Array.isArray(raw(x)) ? raw(x).slice(0, 3) : [raw(x), raw(y), raw(z)]),
  vec4: (a, b, c, d) => wrap(null, () => { const A = raw(a); return Array.isArray(A) ? (A.length === 4 ? A : [...A, ...(b !== undefined ? [raw(b)] : []), ...(c !== undefined ? [raw(c)] : [])].slice(0, 4)) : [raw(a), raw(b), raw(c), raw(d)]; }),
  float: x => wrap(null, () => Number(raw(x))),
  int: x => wrap(null, () => Math.trunc(raw(x))),
  abs: a => wrap(null, () => { const A = raw(a); return Array.isArray(A) ? A.map(Math.abs) : Math.abs(A); }),
  atan: (y, x) => wrap(null, () => Math.atan2(raw(y), raw(x))),
  clamp: (x, a, b) => wrap(null, () => clamp(raw(x), raw(a), raw(b))),
  cos: a => wrap(null, () => Math.cos(raw(a))),
  sin: a => wrap(null, () => Math.sin(raw(a))),
  exp: a => wrap(null, () => Math.exp(raw(a))),
  floor: a => wrap(null, () => Math.floor(raw(a))),
  fract: a => wrap(null, () => { const x = raw(a); return x - Math.floor(x); }),
  mod: (a, b) => wrap(null, () => { const x = raw(a), y = raw(b); return x - y * Math.floor(x / y); }),
  pow: (a, b) => wrap(null, () => Math.pow(raw(a), raw(b))),
  max: (a, b) => wrap(null, () => Math.max(raw(a), raw(b))),
  min: (a, b) => wrap(null, () => Math.min(raw(a), raw(b))),
  step: (e, x) => wrap(null, () => step(raw(e), raw(x))),
  smoothstep: (a, b, x) => wrap(null, () => smoothstep(raw(a), raw(b), raw(x))),
  select: (c, a, b) => wrap(null, () => (raw(c) ? raw(a) : raw(b))),
  dot: (a, b) => wrap(null, () => { const A = raw(a), B = raw(b); return A.reduce((s, v, i) => s + v * B[i], 0); }),
  length: a => wrap(null, () => Math.hypot(...raw(a))),
  distance: (a, b) => wrap(null, () => { const A = raw(a), B = raw(b); return Math.hypot(...A.map((v, i) => v - B[i])); }),
  normalize: a => wrap(null, () => norm3(raw(a))),
  mix: (a, b, t) => wrap(null, () => {
   const A = raw(a), B = raw(b), k = raw(t);
   if (Array.isArray(A) || Array.isArray(B)) {
    const AA = Array.isArray(A) ? A : Array(B.length).fill(A);
    const BB = Array.isArray(B) ? B : Array(A.length).fill(B);
    return AA.map((v, i) => mix(v, BB[i], k));
   }
   return mix(A, B, k);
  }),
  uv: () => wrap(null, () => st.uv),
  texture: (_tex, uvNode) => wrap(null, () => { st.sampledUv = raw(uvNode); return [1, 1, 1, 1]; }),
  attribute: name => wrap(null, () => st.attrs[name]),
  referenceAttribute: name => wrap(null, () => st.attrs[name]),
  positionGeometry: wrap(null, () => st.posGeom),
  positionLocal: wrap(null, () => st.posLocal),
  positionWorld: wrap(null, () => st.posWorld),
  normalLocal: wrap(null, () => st.normalLocal),
  cameraPosition: wrap(null, () => st.camPos),
  screenSize: wrap(null, () => st.screenSize),
  screenCoordinate: wrap(null, () => st.screenCoord),
  modelViewMatrix: { mul: v => wrap(null, () => { const x = raw(v); return [x[0], x[1], x[2] - st.viewZ, 1]; }) },
  modelWorldMatrix: { mul: v => wrap(null, () => raw(v)) },
  cameraViewMatrix: { mul: v => wrap(null, () => { const x = raw(v); return [x[0], x[1], x[2] - st.viewZ, 1]; }) },
  cameraProjectionMatrix: {
   mul: v => wrap(null, () => { const x = raw(v); return [x[0], x[1], x[2], Math.max(1e-4, -x[2])]; }),
   element: c => c === 0 ? wrap([st.projX, 0, 0, 0]) : wrap([0, st.projY, 0, 0])
  },
  modelViewProjection: wrap(null, () => [0, 0, 0, 1]),
  transformNormalToView: n => n
 };
 return T;
}
class MockNodeMat { constructor(p = {}) { Object.assign(this, p); } }

// Wait: flushIfs() runs at the start of assign/mulAssign/If and at Fn() exit so chained .ElseIf/.Else always finish before the next mutating statement.
function makeCpuTSLOrdered(st) {
 return makeCpuTSL(st);
}

// ── 1. tsl-tags ──────────────────────────────────────────────────────────────
{
 const tex = new THREE.DataTexture(new Uint8Array(4), 1, 1);
 const res = createPalletTagMaterialTSL({ THREE, TSL, NodeMaterial: WGPU.NodeMaterial, map: tex });
 assert.deepEqual(tagAtlasGrid(), { cols: 8, rows: 12 });
 assert.equal(res.material.name, 'pallet-tags-tsl');
 assert.equal(res.material.transparent, true);
 assert.equal(res.material.toneMapped, false);
 assert.equal(res.material.fog, false);
 assert.equal(res.material.lights, false);

 const st = { _ifs: [], uv: [0.5, 0.5], attrs: { tagCell: [0, 0] } };
 const cpu = createPalletTagMaterialTSL({ THREE, TSL: makeCpuTSLOrdered(st), NodeMaterial: MockNodeMat, map: tex });
 let maxDiff = 0, n = 0;
 for (const order of [false, true]) {
  for (let count = 1; count <= PALLET_CAP; count += 7) {
   const c = tagCell(count, order);
   for (const uv of [[0, 0], [0.5, 0.5], [1, 1]]) {
    st.uv = uv; st.attrs.tagCell = [c.col, c.row];
    const got = cpu.uvNode._raw;
    const exp = [(uv[0] + c.col) / 8, (uv[1] + c.row) / 12];
    for (let k = 0; k < 2; k++) { const d = Math.abs(got[k] - exp[k]); maxDiff = Math.max(maxDiff, d); assert(d < 1e-12); }
    n++;
   }
  }
 }
 for (const ch of GLYPHS) {
  const g = glyphCell(ch);
  st.uv = [0.25, 0.75]; st.attrs.tagCell = [g.col, g.row];
  const got = cpu.uvNode._raw;
  assert(Math.abs(got[0] - (0.25 + g.col) / 8) < 1e-12);
  assert(Math.abs(got[1] - (0.75 + g.row) / 12) < 1e-12);
  n++;
 }
 assert(maxDiff < 1e-12 && n > 30);
}

// ── 2. tsl-menu ──────────────────────────────────────────────────────────────
{
 const res = createMenuWindMaterialTSL({ THREE, TSL, MeshLambertNodeMaterial: WGPU.MeshLambertNodeMaterial });
 assert.equal(res.material.name, 'menu-cover-tsl');
 assert.equal(res.material.isMeshLambertNodeMaterial, true);
 assert.equal(res.material.vertexColors, true);
 assert.equal(res.uniforms.uTime.value, 0);
 assert.equal(res.uniforms.uGust.value, 0);

 const st = { _ifs: [], posLocal: [1, 0.2, 2], attrs: { instanceMatrix: [null, null, null, [3, 0, -4, 1]], aBend: 0 } };
 const cpu = createMenuWindMaterialTSL({ THREE, TSL: makeCpuTSLOrdered(st), MeshLambertNodeMaterial: MockNodeMat });
 let maxDiff = 0;
 for (const t of [0, 1.7, 5.3, 12.1]) {
  cpu.uniforms.uTime.value = t;
  cpu.uniforms.uGust.value = gust(t);
  for (const [rx, rz] of [[0, 0], [3.5, -2.1], [-8.2, 6.4]]) {
   st.attrs.instanceMatrix = [null, null, null, [rx, 0, rz, 1]];
   for (const bend of [0, 0.3, 0.7, 1.0]) {
    st.attrs.aBend = bend;
    st.posLocal = [rx + 0.1, 0.25, rz - 0.1];
    const got = cpu.material.positionNode()._raw;
    const b = coverBend(t, rx, rz, bend);
    const exp = [st.posLocal[0] + COVER_WIND.x * b, st.posLocal[1], st.posLocal[2] + COVER_WIND.z * b];
    for (let k = 0; k < 3; k++) { const d = Math.abs(got[k] - exp[k]); maxDiff = Math.max(maxDiff, d); assert(d < 1e-12); }
   }
  }
 }
 assert(maxDiff < 1e-12);
}

// ── 3. tsl-tracks ────────────────────────────────────────────────────────────
{
 const glTracks = createTracks(new THREE.Group());
 const res = createTracksMaterialTSL({ THREE, TSL, MeshBasicNodeMaterial: WGPU.MeshBasicNodeMaterial });
 assert.equal(res.material.name, 'tyre-tracks-tsl');
 assert.equal(res.material.vertexColors, glTracks.mesh.material.vertexColors);
 assert.equal(res.material.transparent, glTracks.mesh.material.transparent);
 assert.equal(res.material.depthWrite, glTracks.mesh.material.depthWrite);
 assert.equal(res.material.polygonOffset, glTracks.mesh.material.polygonOffset);
 assert.equal(res.material.polygonOffsetFactor, glTracks.mesh.material.polygonOffsetFactor);
 assert.equal(res.material.polygonOffsetUnits, glTracks.mesh.material.polygonOffsetUnits);
 assert.equal(res.material.alphaTest, TRACK_SHADER.alphaCut);
 assert.equal(res.uniforms.uTime.value, glTracks.uTime.value);

 const st = { _ifs: [], posLocal: [0, 0, 0], camPos: [0, 2, 0], attrs: { aInfo: [0, 10, 0.75, 0] } };
 const cpu = createTracksMaterialTSL({ THREE, TSL: makeCpuTSLOrdered(st), MeshBasicNodeMaterial: MockNodeMat });
 let maxDiff = 0;
 for (const time of [0, 5, 7, 8.5, 10.5]) {
  cpu.uniforms.uTime.value = time;
  for (const dist of [5, 70, 80, 95]) {
   st.posLocal = [dist, 0, 0]; st.camPos = [0, 0, 0];
   for (const side of [-1, -0.6, 0, 0.55, 0.85, 1]) {
    st.attrs.aInfo = [0, 10, 0.75, side];
    const got = cpu.material.opacityNode()._raw;
    const exp = 0.75 * fadeOf(time, 10) * drawFactor(dist) * (1 - smoothstep(0.55, 1.0, Math.abs(side)));
    const d = Math.abs(got - exp); maxDiff = Math.max(maxDiff, d); assert(d < 1e-12);
   }
  }
 }
 assert(maxDiff < 1e-12);
}

// ── 4. tsl-smoke ─────────────────────────────────────────────────────────────
{
 const glSmoke = createSmoke(new THREE.Group());
 const tslSmoke = createSmokeMeshTSL({ THREE, TSL, MeshBasicNodeMaterial: WGPU.MeshBasicNodeMaterial });
 assert.equal(tslSmoke.mesh.name, glSmoke.points.name);
 assert.equal(tslSmoke.mesh.isInstancedMesh, true);
 assert.equal(tslSmoke.mesh.count, SMOKE_MAX);
 assert.equal(tslSmoke.material.transparent, glSmoke.points.material.transparent);
 assert.equal(tslSmoke.material.opacity, SMOKE_ALPHA);
 assert.equal(tslSmoke.material.depthWrite, false);
 assert.equal(tslSmoke.material.alphaTest, SMOKE_SHADER.alphaTest);
 assert.equal(tslSmoke.particles.pos.length, glSmoke.particles.pos.length);

 const st = { _ifs: [], uv: [0.5, 0.5], posGeom: [0, 0, 0], screenSize: [1400, 900], viewZ: 10, attrs: { aPos: [0, 1, 0], aColor: [0.6, 0.6, 0.6], aSize: 1.2, aFade: 0.5 } };
 const cpu = createSmokeMaterialTSL({ THREE, TSL: makeCpuTSLOrdered(st), MeshBasicNodeMaterial: MockNodeMat });
 for (const a of [0, 0.05, 0.5, 0.9, 1.0]) {
  const fade = a >= 1 ? 0 : Math.min(1, a * 8) * (1 - a);
  const sz = SMOKE_SIZE[0] * (1 + GROW * a);
  st.attrs.aFade = fade; st.attrs.aSize = sz;
  assert(Math.abs(cpu.material.opacityNode()._raw - SMOKE_ALPHA * fade) < 1e-12);
  assert.deepEqual(cpu.material.colorNode()._raw, [0.6, 0.6, 0.6, 1]);
 }
}

// ── 5. tsl-debris ────────────────────────────────────────────────────────────
{
 const glDeb = createDebris(new THREE.Group());
 const tslDeb = createDebrisMeshTSL({ THREE, TSL, MeshBasicNodeMaterial: WGPU.MeshBasicNodeMaterial });
 assert.equal(tslDeb.mesh.name, glDeb.points.name);
 assert.equal(tslDeb.mesh.isInstancedMesh, true);
 assert.equal(tslDeb.mesh.count, DEBRIS_MAX);
 assert.equal(tslDeb.material.blending, glDeb.points.material.blending);
 assert.equal(tslDeb.material.blendSrc, glDeb.points.material.blendSrc);
 assert.equal(tslDeb.material.blendDst, glDeb.points.material.blendDst);
 assert.equal(tslDeb.material.depthWrite, false);

 const st = {
  _ifs: [], discarded: false, uv: [0.5, 0.5], posGeom: [0, 0, 0], screenSize: [1400, 900], viewZ: 5, projX: 2, projY: 2,
  attrs: { aPos: [0, 1, 0], aColor: [0.5, 0.4, 0.3], aVel: [3, 2, 0], aKind: 0.25, aT: 0.2 }
 };
 const cpu = createDebrisMaterialTSL({ THREE, TSL: makeCpuTSLOrdered(st), MeshBasicNodeMaterial: MockNodeMat });
 const evalGlslDebris = (uv, kind, vT, col, vDir, vStreak) => {
  const k = Math.floor(kind), vSeed = kind - k;
  const qx = uv[0] * 2 - 1, qy = uv[1] * 2 - 1;
  if (k === 3) { const a = (1 - smoothstep(0.15, 1, Math.hypot(qx, qy))) * 0.5 * (1 - vT) * smoothstep(0, 0.1, vT); return a < 0.01 ? null : [...col.map(c => c * a), a]; }
  if (k === 5) { const r = Math.hypot(qx, qy), a = (1 - smoothstep(0.55, 0.85, r)) * (1 - smoothstep(0.8, 1, vT)); return a < 0.02 ? null : [...col.map(c => c * (0.85 + 0.3 * (1 - r)) * a), a]; }
  if (k === 2) {
   const al = qx * vDir[0] + qy * vDir[1], pe = -qx * vDir[1] + qy * vDir[0], pw = mix(0.9, 0.07, vStreak);
   const r2 = al * al / 0.9 + pe * pe / (pw * pw), ks = Math.exp(-r2 * 3.2) * mix(1, 0.25 + 0.75 * smoothstep(-1, 0.9, al), vStreak) * (1 - smoothstep(0.6, 1, vT));
   if (ks < 0.01) return null;
   const hot = vT < 0.35 ? [1, mix(0.95, 0.55, vT / 0.35), mix(0.7, 0.12, vT / 0.35)] : [mix(1, 0.3, clamp((vT - 0.35) / 0.65, 0, 1)), mix(0.55, 0.07, clamp((vT - 0.35) / 0.65, 0, 1)), mix(0.12, 0.02, clamp((vT - 0.35) / 0.65, 0, 1))];
   return [...hot.map(c => c * ks * (2 - vT)), 0];
  }
  const c = Math.cos(vSeed * 6.2832), s = Math.sin(vSeed * 6.2832), px = c * qx - s * qy, py = s * qx + c * qy;
  let a, out = [...col];
  if (k === 1) { a = 1 - smoothstep(0.6, 0.72, Math.abs(px) * 1.15 + Math.abs(py) * 0.65); out = out.map(v => mix(v, 1, 0.35 * (0.5 + 0.5 * px))); }
  else { const r = Math.hypot(px, py * 0.82) + 0.1 * Math.sin(Math.atan2(py, px) * 3 + vSeed * 20); a = 1 - smoothstep(0.55, 0.8, r); out = out.map(v => v * 0.8); }
  a *= 1 - smoothstep(0.75, 1, vT);
  return a < 0.02 ? null : [...out.map(v => v * a), a];
 };
 let maxDiff = 0;
 const vel = [3 * DEBRIS_SHADER.velLead, 2 * DEBRIS_SHADER.velLead];
 const vl = Math.hypot(vel[0], vel[1]);
 const expDir = [vel[0] / vl, vel[1] / vl];
 for (const kind of [DEBRIS_KIND.chip + 0.3, DEBRIS_KIND.glass + 0.4, DEBRIS_KIND.spark + 0.1, DEBRIS_KIND.dust + 0.5, DEBRIS_KIND.mud + 0.7, DEBRIS_KIND.drop + 0.2]) {
  for (const vT of [0.1, 0.5, 0.92]) {
   for (const uv of [[0.5, 0.5], [0.6, 0.55], [0.95, 0.95]]) {
    st.discarded = false; st.uv = uv; st.attrs.aKind = kind; st.attrs.aT = vT;
    const got = cpu.material.colorNode()._raw;
    const streak = Math.floor(kind) === 2 ? smoothstep(1, 6, Math.hypot(3, 2, 0)) : 0;
    const exp = evalGlslDebris(uv, kind, vT, st.attrs.aColor, expDir, streak);
    assert.equal(st.discarded, exp === null, `discard mismatch kind=${kind} t=${vT} uv=${uv}`);
    if (exp) for (let k = 0; k < 4; k++) { const d = Math.abs(got[k] - exp[k]); maxDiff = Math.max(maxDiff, d); assert(d < 1e-11, `kind=${kind} t=${vT} uv=${uv} ch=${k} got=${got[k]} exp=${exp[k]}`); }
   }
  }
 }
 assert(maxDiff < 1e-11);
}

// ── 6. tsl-lights ────────────────────────────────────────────────────────────
{
 const glLights = createNightLights({ scene: new THREE.Scene() });
 const tslLights = createNightLightsMaterialsTSL({ THREE, TSL, MeshBasicNodeMaterial: WGPU.MeshBasicNodeMaterial });
 assert.equal(tslLights.spriteMat.blending, glLights.sprites.material.blending);
 assert.equal(tslLights.spriteMat.depthWrite, false);
 assert.equal(tslLights.spriteMat.fog, false);
 assert.equal(tslLights.groundMat.polygonOffset, true);
 assert.equal(tslLights.groundMat.polygonOffsetFactor, glLights.ground.material.polygonOffsetFactor);
 assert.equal(tslLights.groundMat.polygonOffsetUnits, glLights.ground.material.polygonOffsetUnits);
 assert.equal(tslLights.uniforms.uFogNear.value, NIGHT_SHADER.fogNear);
 assert.equal(tslLights.uniforms.uFogFar.value, NIGHT_SHADER.fogFar);

 const st = { _ifs: [], posGeom: [0, 0, 0], viewZ: 40, attrs: { aCentre: [0, 0, 0], aTint: [1, 0.8, 0.5], aSize: 2, aLamp: 1 } };
 const cpu = createNightLightsMaterialsTSL({ THREE, TSL: makeCpuTSLOrdered(st), MeshBasicNodeMaterial: MockNodeMat });
 let maxDiff = 0;
 for (const level of [0, 0.5, 1]) {
  cpu.uniforms.uLevel.value = level;
  for (const lamp of [0, 1]) {
   st.attrs.aLamp = lamp;
   for (const depth of [10, 75, 130, 155]) {
    st.viewZ = depth;
    for (const p of [[0, 0], [0.25, 0], [0.5, 0]]) {
     st.posGeom = [p[0], p[1], 0];
     const sGot = cpu.spriteMat.colorNode()._raw;
     const gGot = cpu.groundMat.colorNode()._raw;
     const k = mix(1, level, lamp);
     const a = 1 - smoothstep(0, 1, Math.hypot(p[0] * 2, p[1] * 2));
     const glow = a * a + 0.6 * Math.pow(a, 8);
     const sf = 1 - smoothstep(30, 120 * 1.25, depth);
     const gf = 1 - smoothstep(30, 120, depth);
     for (let c = 0; c < 3; c++) {
      const ds = Math.abs(sGot[c] - st.attrs.aTint[c] * k * glow * sf);
      const dg = Math.abs(gGot[c] - st.attrs.aTint[c] * k * gf);
      maxDiff = Math.max(maxDiff, ds, dg);
      assert(ds < 1e-12 && dg < 1e-12);
     }
    }
   }
  }
 }
 assert(maxDiff < 1e-12);
}

// ── 7. tsl-cover ─────────────────────────────────────────────────────────────
{
 const wind = createCoverWindTSL({ THREE, TSL });
 const res = createCoverMaterialTSL({ THREE, TSL, MeshStandardNodeMaterial: WGPU.MeshStandardNodeMaterial, kind: 'grass', height: 0.4, wind });
 assert.equal(res.material.name, 'cover-tsl-grass');
 assert.equal(res.material.alphaTest, COVER_ALPHA_TEST);
 assert.equal(res.material.side, THREE.DoubleSide);
 assert.equal(res.material.roughness, 1);
 assert.equal(res.material.metalness, 0);
 assert.equal(res.uniforms.uUp.value, COVER_UP.grass);

 const reach = coverReach('grass', 'high');
 const st = { _ifs: [], posGeom: [0.05, 0.2, 0.02], posLocal: [10.05, 0.2, 5.02], normalLocal: [1, 0, 0], camPos: [0, 1.5, 0], attrs: { instanceMatrix: [null, null, null, [10, 0, 5, 1]], aInst: [0.5, 1.2] } };
 const cpuWind = createCoverWindTSL({ THREE, TSL: makeCpuTSLOrdered(st) });
 const cpu = createCoverMaterialTSL({ THREE, TSL: makeCpuTSLOrdered(st), MeshStandardNodeMaterial: MockNodeMat, kind: 'grass', height: 0.4, wind: cpuWind });
 const wObj = makeWind(); windSample(4.2, wObj, 1.2);
 cpuWind.uWind.value.set(wObj.dx, wObj.dz, wObj.strength, wObj.gust);
 cpuWind.uWindT.value = wObj.t;
 let maxDiff = 0;
 for (const distX of [5, (reach.near + reach.far) / 2, reach.far + 2]) {
  for (const rank of [0.1, 0.9]) {
   st.attrs.instanceMatrix = [null, null, null, [distX, 0, 0, 1]];
   st.attrs.aInst = [rank, 1.2];
   st.posLocal = [distX + st.posGeom[0], st.posGeom[1], st.posGeom[2]];
   const got = cpu.material.positionNode()._raw;
   const keep = 1 - smoothstep(reach.near, reach.far, distX);
   const sc = (keep > rank ? 1 : 0) * Math.min(1, keep * 2);
   const bend = clamp(st.posGeom[1] / 0.4, 0, 1);
   const cvM = bend * bend * (WIND_BASE.lean * wObj.gust + (WIND_BASE.sway + WIND_BASE.gust * wObj.gust) * Math.sin(wObj.t * WIND_BASE.speed - distX * wObj.dx * WIND_BASE.k + 1.2 * 0.35)) * wObj.strength * (WIND_KIND_MUL.grass ?? 1) / 0.85;
   const exp = [distX + st.posGeom[0] * sc + wObj.dx * cvM, st.posGeom[1] * sc, st.posGeom[2] * sc + wObj.dz * cvM];
   for (let k = 0; k < 3; k++) { const d = Math.abs(got[k] - exp[k]); maxDiff = Math.max(maxDiff, d); assert(d < 1e-11); }
  }
 }
 assert(maxDiff < 1e-11 && typeof windBend === 'function');
}

// ── 8. tsl-sightline ─────────────────────────────────────────────────────────
{
 const glFade = createSightlineFade();
 const tslFade = createSightlineFadeTSL({ THREE, TSL });
 assert.equal(tslFade.uniforms.uFadeRadius.value, glFade.uniforms.uFadeRadius.value);
 assert.equal(tslFade.uniforms.uFadeEnabled.value, glFade.uniforms.uFadeEnabled.value);
 const mat = new WGPU.MeshStandardNodeMaterial();
 assert.equal(tslFade.apply(mat), mat);
 assert.ok(mat.maskNode);
 tslFade.update({ position: new THREE.Vector3(1, 2, 3) }, new THREE.Vector3(4, 5, 6));
 assert.deepEqual(tslFade.uniforms.uFadeCamera.value.toArray(), [1, 2, 3]);
 assert.deepEqual(tslFade.uniforms.uFadeTarget.value.toArray(), [4, 5, 6]);

 const st = { _ifs: [], posWorld: [0, 0, 0], screenCoord: [0.5, 0.5], screenSize: [1400, 900] }; // T6: TSL screenCoordinate counts y from the top (900 - glY)
 const cpu = createSightlineFadeTSL({ THREE, TSL: makeCpuTSLOrdered(st) });
 cpu.update({ position: new THREE.Vector3(0, 2, 10) }, new THREE.Vector3(0, 1, 0));
 const evalGlslKeep = (wp, cam, tgt, radius, enabled, px, py) => {
  const seg = [tgt[0] - cam[0], tgt[1] - cam[1], tgt[2] - cam[2]];
  const lenSq = Math.max(seg[0] * seg[0] + seg[1] * seg[1] + seg[2] * seg[2], 1e-4);
  const t = clamp(((wp[0] - cam[0]) * seg[0] + (wp[1] - cam[1]) * seg[1] + (wp[2] - cam[2]) * seg[2]) / lenSq, 0, 1);
  const d = Math.hypot(wp[0] - (cam[0] + seg[0] * t), wp[1] - (cam[1] + seg[1] * t), wp[2] - (cam[2] + seg[2] * t));
  const fade = (1 - smoothstep(radius * 0.45, radius, d)) * step(0.02, t) * (1 - smoothstep(0.86, 0.97, t)) * enabled;
  const n = Math.floor(px % 4) + Math.floor(py % 4) * 4;
  return !(fade * 0.88 > (BAYER_4X4[n] + 0.5) / 16);
 };
 let checked = 0;
 for (const wp of [[0, 1.5, 5], [1.2, 1.5, 5], [3, 1.5, 5], [0, 1, 0], [0, 2, 10]]) {
  for (let py = 0; py < 4; py++) for (let px = 0; px < 4; px++) {
   st.posWorld = wp; st.screenCoord = [px + 0.5, 900 - (py + 0.5)];
   const got = cpu.keepNode()._raw;
   const exp = evalGlslKeep(wp, [0, 2, 10], [0, 1, 0], SIGHTLINE_FADE.radius, 1, px + 0.5, py + 0.5);
   assert.equal(got, exp, `sightline mismatch wp=${wp} px=${px},${py}`);
   checked++;
  }
 }
 assert.equal(checked, 80);
}

// ── 9. Verify source imports (no copied numbers from exported rules) ─────────
for (const [file, token] of [
 ['dist/tsl-tags.js', "from './pallet-tags.js'"],
 ['dist/tsl-menu.js', "from './menu-scene-rules.js'"],
 ['dist/tsl-tracks.js', "from './tracks-rules.js'"],
 ['dist/tsl-smoke.js', "from './smoke.js'"],
 ['dist/tsl-debris.js', "from './debris.js'"],
 ['dist/tsl-cover.js', "from './ground-cover-view.js'"]
]) {
 const s = await readFile(file, 'utf8');
 assert(s.includes(token), `${file} must import ${token}`);
}

console.log('PASS tsl-materials: all 8 T3 NodeMaterial factories & CPU math parity checks matched GLSL sources.');
