// Parity test for dist/tsl-shadows.js blob-shadows against dist/shadows.js BLOB_FRAGMENT.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../dist/vendor/three.module.js';
import * as WGPU from '../dist/vendor/three.webgpu.js';
import * as TSL from '../dist/vendor/three.tsl.js';
import { BLOB, blobOpacity } from '../dist/shadow-rules.js';
import { skyAt } from '../dist/daynight.js';
import { createShadows } from '../dist/shadows.js';
import { BLOB_SMOOTH, createBlobMaterialTSL, createBlobMeshTSL } from '../dist/tsl-shadows.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// CPU-evaluating TSL adapter so createBlobMaterialTSL() executes its actual opacityNode math.
function makeCpuShadowTSL(state) {
 const toVal = v => (v && v._get ? toVal(v._get()) : v && v._raw !== undefined ? toVal(v._raw) : v);
 const wrap = (val, getter = null) => {
  const get = getter || (() => toVal(val));
  const op = (o, fn) => wrap(null, () => {
   const a = get(), b = toVal(o);
   if (Array.isArray(a) || Array.isArray(b)) {
    const A = Array.isArray(a) ? a : [a, a];
    const B = Array.isArray(b) ? b : [b, b];
    return A.map((x, i) => fn(x, B[i]));
   }
   return fn(a, b);
  });
  return {
   _get: get,
   get _raw() { return get(); },
   get x() { return wrap(null, () => get()[0]); },
   get y() { return wrap(null, () => get()[1]); },
   get xz() { return wrap(null, () => { const a = get(); return [a[0], a[2]]; }); },
   mul: o => op(o, (a, b) => a * b),
   add: o => op(o, (a, b) => a + b),
   sub: o => op(o, (a, b) => a - b)
  };
 };
 return {
  Fn: fn => (...args) => (args.length ? fn(...args) : (() => fn())),
  uniform: initial => {
   const u = { value: initial };
   const w = wrap(null, () => u.value);
   Object.defineProperty(w, 'value', { get: () => u.value, set: v => { u.value = v; } });
   return w;
  },
  varying: node => node,
  vec3: (x, y, z) => wrap([x, y, z]),
  float: x => wrap(x),
  abs: a => { const A = toVal(a); return wrap(Array.isArray(A) ? A.map(Math.abs) : Math.abs(A)); },
  sqrt: a => wrap(Math.sqrt(toVal(a))),
  length: a => { const A = toVal(a); return wrap(Math.hypot(...A)); },
  mix: (a, b, t) => { const A = toVal(a), B = toVal(b), T = toVal(t); return wrap(A * (1 - T) + B * T); },
  smoothstep: (a, b, x) => wrap(smoothstep(toVal(a), toVal(b), toVal(x))),
  positionGeometry: wrap(null, () => [state.vAt[0] / 2, 0, state.vAt[1] / 2]),
  attribute: name => wrap(null, () => (name === 'aBox' ? state.vBox : 0)),
  reference: (prop, _type, obj) => wrap(null, () => obj[prop]),
  rangeFogFactor: (near, far) => wrap(null, () => smoothstep(toVal(near), toVal(far), state.depth))
 };
}

// CPU evaluator directly matching dist/shadows.js BLOB_FRAGMENT GLSL source.
function evalGlslBlob({ vAt, vBox, uOpacity, fogNear, fogFar, vDepth }) {
 const px = Math.abs(vAt[0]), py = Math.abs(vAt[1]);
 const qx = px * px * px * px, qy = py * py * py * py;
 const len = Math.hypot(px, py);
 const superEllipse = Math.sqrt(Math.sqrt(qx + qy));
 const d = len * (1 - vBox) + superEllipse * vBox;
 const inner = 0.3 * (1 - vBox) + 0.75 * vBox;
 return (1 - smoothstep(inner, 1.0, d)) * uOpacity * (1 - smoothstep(fogNear, fogFar, vDepth));
}

// 1. Check dist/tsl-shadows.js imports BLOB from shadow-rules.js and matches shadows.js material flags
const tslSrc = await readFile('dist/tsl-shadows.js', 'utf8');
assert(tslSrc.includes("from './shadow-rules.js'") && tslSrc.includes('BLOB'));

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#000000', 65, 155);
const sun = new THREE.DirectionalLight('#ffffff', 3.1);
scene.add(sun);
const glShadows = createShadows({ scene, renderer: { shadowMap: { enabled: false } }, sun, parked: [] });
const tslMesh = createBlobMeshTSL({ THREE, TSL, NodeMaterial: WGPU.NodeMaterial, fog: scene.fog });

assert.equal(tslMesh.blobs.name, glShadows.blobs.name);
assert.equal(tslMesh.blobs.isInstancedMesh, true);
assert.equal(tslMesh.blobs.instanceMatrix.count, BLOB.capacity);
assert.equal(tslMesh.blobs.renderOrder, glShadows.blobs.renderOrder);
assert.equal(tslMesh.blobs.frustumCulled, false);
assert.equal(tslMesh.blobs.castShadow, false);
assert.equal(tslMesh.blobs.receiveShadow, false);
assert.equal(tslMesh.geometry.index.count, glShadows.blobs.geometry.index.count);
assert.deepEqual(
 [...tslMesh.geometry.attributes.position.array],
 [...glShadows.blobs.geometry.attributes.position.array],
 'quad geometry matches shadows.js'
);
assert.equal(tslMesh.material.transparent, true);
assert.equal(tslMesh.material.depthWrite, false);
assert.equal(tslMesh.material.toneMapped, false);
assert.equal(tslMesh.material.fog, false, 'fog faded via opacityNode rather than RGB fog mix');
assert.equal(tslMesh.material.polygonOffset, true);
assert.equal(tslMesh.material.polygonOffsetFactor, glShadows.blobs.material.polygonOffsetFactor);
assert.equal(tslMesh.material.polygonOffsetUnits, glShadows.blobs.material.polygonOffsetUnits);
assert.equal(BLOB_SMOOTH.circleInner, 0.3);
assert.equal(BLOB_SMOOTH.boxInner, 0.75);

// 2. Super-ellipse & fog falloff numerical parity across people (aBox=0) and vehicles (aBox=1)
const cpuState = { vAt: [0, 0], vBox: 0, depth: 10 };
const cpuTSL = makeCpuShadowTSL(cpuState);
class MockNodeMat {}
const fog = new THREE.Fog('#000000', 65, 155);
const cpuBlob = createBlobMaterialTSL({ THREE, TSL: cpuTSL, NodeMaterial: MockNodeMat, fog });

const noonOp = blobOpacity(skyAt(720)), nightOp = blobOpacity(skyAt(0));
const coords = [0, 0.2, 0.45, 0.7, 0.88, 0.99, 1.05];
let maxDiff = 0, tested = 0;

for (const vBox of [0, 1]) {
 for (const [opacity, fNear, fFar, depth] of [[noonOp, 65, 155, 10], [noonOp, 65, 155, 110], [noonOp, 65, 155, 160], [nightOp, 30, 120, 75]]) {
  fog.near = fNear;
  fog.far = fFar;
  cpuBlob.uniforms.uOpacity.value = opacity;
  cpuState.vBox = vBox;
  cpuState.depth = depth;
  for (const x of coords) {
   for (const y of coords) {
    cpuState.vAt = [x, y];
    const tslAlpha = cpuBlob.material.opacityNode()._raw;
    const glslAlpha = evalGlslBlob({ vAt: [x, y], vBox, uOpacity: opacity, fogNear: fNear, fogFar: fFar, vDepth: depth });
    const diff = Math.abs(tslAlpha - glslAlpha);
    maxDiff = Math.max(maxDiff, diff);
    assert(diff < 1e-12, `blob mismatch box=${vBox} at=${x},${y} depth=${depth}: ${tslAlpha} vs ${glslAlpha}`);
    tested++;
   }
  }
 }
}

// Sanity checks on super-ellipse geometry: box corners survive longer than circle corners, fog clears at fogFar
fog.near = 65; fog.far = 155;
cpuBlob.uniforms.uOpacity.value = noonOp;
cpuState.depth = 10;
cpuState.vAt = [0.65, 0.65];
cpuState.vBox = 0;
const circleCorner = cpuBlob.material.opacityNode()._raw;
cpuState.vBox = 1;
const boxCorner = cpuBlob.material.opacityNode()._raw;
assert(boxCorner > circleCorner, `super-ellipse box fills corners more than circle (${boxCorner.toFixed(3)} > ${circleCorner.toFixed(3)})`);
cpuState.depth = 155;
assert.equal(cpuBlob.material.opacityNode()._raw, 0, 'fog clears blob shadow completely at fogFar');

// Note: WebGPU WGSL/GLSL compilation, InstancedBufferAttribute aBox step-rate, and polygonOffset depth behaviour require a real GPU/browser.
console.log(`PASS tsl-shadows: ${tested} (vBox, uv, opacity, depth) samples matched shadows.js BLOB_FRAGMENT (maxDiff=${maxDiff.toExponential(2)}).`);
