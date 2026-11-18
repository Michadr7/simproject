// Parity test for dist/tsl-sky.js against dist/sky.js at 4 times of day (06:15, 12:00, 17:45, 00:00).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../dist/vendor/three.module.js';
import * as WGPU from '../dist/vendor/three.webgpu.js';
import * as TSL from '../dist/vendor/three.tsl.js';
import { skyAt, NIGHT_FLOOR } from '../dist/daynight.js';
import { createSky, STAR_COUNT, INDOOR_EXPOSURE, SUN_DISTANCE, SKY_HORIZON } from '../dist/sky.js';
import { createSkyTSL, buildStarData, SKY_TSL_STAR_SIZE } from '../dist/tsl-sky.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// CPU-evaluating TSL adapter so createSkyTSL() executes its actual dome & star colorNodes.
function makeCpuSkyTSL(state) {
 const isColor = v => v && v.isColor;
 const isVec3 = v => v && v.isVector3;
 const toArr = v => {
  if (v && v._get) return toArr(v._get());
  if (v && v._raw !== undefined) return toArr(v._raw);
  if (isColor(v)) return [v.r, v.g, v.b];
  if (isVec3(v)) return [v.x, v.y, v.z];
  return v;
 };
 const wrap = (val, getter = null) => {
  const get = getter || (() => toArr(val));
  const op = (o, fn) => {
   const a = get(), b = toArr(o);
   if (Array.isArray(a) || Array.isArray(b)) {
    const A = Array.isArray(a) ? a : [a, a, a];
    const B = Array.isArray(b) ? b : [b, b, b];
    return wrap(A.map((x, i) => fn(x, B[i])));
   }
   return wrap(fn(a, b));
  };
  return {
   _get: get,
   get _raw() { return get(); },
   get x() { return wrap(null, () => get()[0]); }, get y() { return wrap(null, () => get()[1]); },
   get z() { return wrap(null, () => get()[2]); }, get w() { return wrap(null, () => get()[3]); },
   get xy() { const a = get(); return wrap([a[0], a[1]]); },
   get xyz() { const a = get(); return wrap([a[0], a[1], a[2]]); },
   mul: o => op(o, (a, b) => a * b),
   div: o => op(o, (a, b) => a / b),
   add: o => op(o, (a, b) => a + b),
   sub: o => op(o, (a, b) => a - b),
   addAssign(o) { const r = op(o, (a, b) => a + b)._raw; val.splice(0, val.length, ...r); return this; },
   toVar() { const c = [...get()]; return wrap(c); }
  };
 };
 const sw = (v, fn) => wrap(fn(toArr(v)));
 return {
  Fn: fn => (...args) => (args.length ? fn(...args) : (() => fn())),
  uniform: initial => {
   const u = { value: initial };
   const w = wrap(null, () => toArr(u.value));
   Object.defineProperty(w, 'value', { get: () => u.value, set: v => { u.value = v; } });
   return w;
  },
  varying: (_node, name) => wrap(null, () => (name === 'vSkyDir' ? state.vDir : [0, 0, 0])),
  vec3: (x, y = x, z = x) => wrap([x, y, z]),
  vec4: (a, b, c, d) => {
   const arr = toArr(a);
   return Array.isArray(arr) ? wrap([...arr, b].slice(0, 4)) : wrap([a, b, c, d]);
  },
  float: x => wrap(x),
  max: (a, b) => wrap(Math.max(toArr(a), toArr(b))),
  mix: (a, b, t) => {
   const A = toArr(a), B = toArr(b), T = toArr(t);
   return wrap(A.map((v, i) => v * (1 - T) + B[i] * T));
  },
  smoothstep: (a, b, x) => wrap(smoothstep(toArr(a), toArr(b), toArr(x))),
  dot: (a, b) => { const A = toArr(a), B = toArr(b); return wrap(A[0] * B[0] + A[1] * B[1] + A[2] * B[2]); },
  normalize: a => sw(a, norm3),
  length: a => { const A = toArr(a); return wrap(Math.hypot(...A)); },
  pow: (a, b) => wrap(Math.pow(toArr(a), toArr(b))),
  positionGeometry: wrap(null, () => state.vDir),
  modelViewMatrix: { mul: v => wrap(toArr(v)) },
  cameraProjectionMatrix: { mul: v => wrap(toArr(v)) },
  screenSize: wrap([1400, 900]),
  uv: () => wrap(null, () => state.uv),
  instanceIndex: wrap(null, () => state.starIndex),
  instancedArray: arr => ({
   element: idx => wrap(null, () => {
    const i = toArr(idx) * 4;
    return [arr[i], arr[i + 1], arr[i + 2], arr[i + 3]];
   })
  })
 };
}

// CPU evaluator of dist/sky.js DOME_FRAGMENT math using the GLSL createSky() uniforms directly.
function evalGlslDome(U, dir) {
 const d = norm3(dir);
 const up = Math.max(d[1], 0), low = 1 - up;
 const t = low * low * low;
 const top = U.uTop.value, hor = U.uHorizon.value;
 const col = [top.r * (1 - t) + hor.r * t, top.g * (1 - t) + hor.g * t, top.b * (1 - t) + hor.b * t];
 const sunDir = [U.uSunDir.value.x, U.uSunDir.value.y, U.uSunDir.value.z];
 const moonDir = [U.uMoonDir.value.x, U.uMoonDir.value.y, U.uMoonDir.value.z];
 const s = Math.max(d[0] * sunDir[0] + d[1] * sunDir[1] + d[2] * sunDir[2], 0);
 const m = Math.max(d[0] * moonDir[0] + d[1] * moonDir[1] + d[2] * moonDir[2], 0);
 const above = smoothstep(-0.01, 0.02, d[1]);
 const sc = U.uSunColor.value, mc = U.uMoonColor.value;
 const glow = Math.pow(s, 6) * low * low * U.uSunGlow.value * 0.45;
 const sunD = (smoothstep(0.9993, 0.9996, s) * 6 + Math.pow(s, 220) * 0.6) * U.uSunDisc.value * above;
 const moonD = (smoothstep(0.99955, 0.9998, m) * 1.4 + Math.pow(m, 900) * 0.15) * U.uMoonDisc.value * above;
 return [
  col[0] + sc.r * (glow + sunD) + mc.r * moonD,
  col[1] + sc.g * (glow + sunD) + mc.g * moonD,
  col[2] + sc.b * (glow + sunD) + mc.b * moonD
 ];
}

// 1. Source check: tsl-sky.js imports constants from sky.js and daynight.js
const tslSrc = await readFile('dist/tsl-sky.js', 'utf8');
assert(tslSrc.includes("from './sky.js'") && tslSrc.includes('STAR_COUNT') && tslSrc.includes('SUN_DISTANCE') && tslSrc.includes('INDOOR_EXPOSURE'));

// 2. Real vendored WGPU + TSL scene rig parity against createSky()
const makeScene = () => {
 const scene = new THREE.Scene();
 scene.background = new THREE.Color('#b9cbd0');
 scene.fog = new THREE.Fog('#b9cbd0', 65, 155);
 const hemi = new THREE.HemisphereLight('#d8e8f0', '#777655', 1.7);
 const sun = new THREE.DirectionalLight('#ffe3b9', 3.1);
 const hills = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
 hills.name = 'distant-hills';
 scene.add(hemi, sun, sun.target, hills);
 return { scene, hemi, sun, hills };
};

const a = makeScene(), b = makeScene();
const glRenderer = { toneMapping: 0, toneMappingExposure: 1, getPixelRatio: () => 2 };
const wgLib = new WGPU.StandardNodeLibrary();
const wgRenderer = { toneMapping: 0, toneMappingExposure: 1, getPixelRatio: () => 2, library: wgLib };

const skyGL = createSky({ ...a, renderer: glRenderer });
const skyTSL = createSkyTSL({ THREE, TSL, NodeMaterial: WGPU.NodeMaterial, ...b, renderer: wgRenderer });

assert.equal(skyTSL.graded, true, 'TSL sky installed gradeTSL');
assert.equal(wgRenderer.toneMapping, THREE.CustomToneMapping);
assert.equal(skyTSL.dome.name, 'sky-dome');
assert.equal(skyTSL.dome.renderOrder, -3);
assert.equal(skyTSL.dome.material.side, THREE.BackSide);
assert.equal(skyTSL.dome.material.depthTest, false);
assert.equal(skyTSL.dome.material.depthWrite, false);
assert.equal(skyTSL.dome.material.fog, false);
assert.equal(skyTSL.dome.material.lights, false);
assert.equal(skyTSL.stars.name, 'sky-stars');
assert.equal(skyTSL.stars.isInstancedMesh, true, 'stars converted from Points to InstancedMesh');
assert.equal(skyTSL.stars.count, STAR_COUNT, '600 star billboard instances');
assert.equal(skyTSL.stars.renderOrder, -2);
assert.equal(skyTSL.stars.material.blending, THREE.AdditiveBlending);
assert.equal(skyTSL.stars.material.toneMapped, false);

// Verify star positions & brightnesses match GLSL Points attributes bit-for-bit
const glPos = skyGL.stars.geometry.attributes.position.array;
const glBri = skyGL.stars.geometry.attributes.aBright.array;
const tslStars = buildStarData(STAR_COUNT);
for (let i = 0; i < STAR_COUNT; i++) {
 for (let k = 0; k < 3; k++) assert.equal(tslStars[i * 4 + k], glPos[i * 3 + k], `star ${i} pos[${k}]`);
 assert.equal(tslStars[i * 4 + 3], glBri[i], `star ${i} brightness`);
}

// 3. Evaluate sky colour at the 4 spike times of day (06:15, 12:00, 17:45, 00:00) through live createSkyTSL
const cpuState = { vDir: [0, 1, 0], uv: [0.5, 0.5], starIndex: 0 };
const cpuTSL = makeCpuSkyTSL(cpuState);
const c = makeScene();
const cpuRenderer = { toneMapping: 0, toneMappingExposure: 1, getPixelRatio: () => 2, library: { addToneMapping() {} } };
class MockNodeMat {}
const cpuSky = createSkyTSL({ THREE, TSL: cpuTSL, NodeMaterial: MockNodeMat, ...c, renderer: cpuRenderer });

const TIMES = [375, 720, 1065, 0]; // 06:15, 12:00, 17:45, 00:00
let worstDomeDiff = 0, worstStarDiff = 0;
for (const m of TIMES) {
 const at = { x: 12, z: -8 };
 const sGL = skyGL.update(m, { target: at });
 const sTSL = skyTSL.update(m, { target: at });
 const sCPU = cpuSky.update(m, { target: at });
 assert.deepEqual(sTSL, sGL);
 assert.equal(skyTSL.stars.visible, skyGL.stars.visible);
 assert.equal(wgRenderer.toneMappingExposure, glRenderer.toneMappingExposure);
 assert.equal(b.scene.fog.near, a.scene.fog.near);
 assert.equal(b.scene.fog.far, a.scene.fog.far);
 assert.equal(skyTSL.uniforms.uSize.value, SKY_TSL_STAR_SIZE * 2);
 assert.ok(sCPU);

 const dirs = [
  [0, 1, 0], [1, 0.05, 0], [0, 0.2, 1], [-0.7, 0.1, -0.7],
  sGL.sunDir, sGL.moonDir, [0, -0.5, 0]
 ];
 for (const dir of dirs) {
  cpuState.vDir = dir;
  const rgbTSL = cpuSky.dome.material.colorNode()._raw;
  const rgbGLSL = evalGlslDome(skyGL.dome.material.uniforms, dir);
  for (let k = 0; k < 3; k++) {
   const d = Math.abs(rgbTSL[k] - rgbGLSL[k]);
   worstDomeDiff = Math.max(worstDomeDiff, d);
   assert(d < 1e-12, `dome mismatch at m=${m} dir=${dir} ch=${k}: ${rgbTSL[k]} vs ${rgbGLSL[k]}`);
  }
 }

 // Star brightness & radial disc falloff at midnight + daytime
 for (const idx of [0, 17, 299, 599]) {
  for (const uv of [[0.5, 0.5], [0.65, 0.5], [0.95, 0.5]]) {
   cpuState.starIndex = idx;
   cpuState.uv = uv;
   const starTSL = cpuSky.stars.material.colorNode()._raw;
   const dist = Math.hypot(uv[0] - 0.5, uv[1] - 0.5);
   const aDisc = smoothstep(0.5, 0.15, dist);
   const sb = glBri[idx] * smoothstep(0.02, 0.22, glPos[idx * 3 + 1]);
   const expected = [0.85, 0.9, 1.0].map(ch => ch * sb * skyGL.stars.material.uniforms.uStars.value * aDisc);
   for (let k = 0; k < 3; k++) {
    const d = Math.abs(starTSL[k] - expected[k]);
    worstStarDiff = Math.max(worstStarDiff, d);
    assert(d < 1e-12, `star mismatch at m=${m} idx=${idx} uv=${uv}`);
   }
  }
 }
}

// Indoors + tune() parity
skyGL.update(0, { indoors: true });
skyTSL.update(0, { indoors: true });
assert.equal(wgRenderer.toneMappingExposure, INDOOR_EXPOSURE);
skyTSL.tune({ nightFloor: 0.3, exposureScale: 1.5 });
assert.deepEqual(skyTSL.tuning(), { minutes: null, nightFloor: 0.3, exposureScale: 1.5 });
skyTSL.tune({ nightFloor: null, exposureScale: null });
assert.deepEqual(skyTSL.tuning(), { minutes: null, nightFloor: NIGHT_FLOOR, exposureScale: 1 });
assert.ok(SKY_HORIZON.value.isColor && SUN_DISTANCE === 60);

// Note: WebGPU WGSL compilation, InstancedMesh billboard screenSize alignment, and pixel output require a real GPU/browser.
console.log(`PASS tsl-sky: 4 times of day x 7 dome dirs + 600 stars matched dist/sky.js (domeDiff=${worstDomeDiff.toExponential(2)}, starDiff=${worstStarDiff.toExponential(2)}).`);
