// TSL crash debris quad SDF material (notes/webgpu-spike.md T3): twin of debris.js:47.
import { DEBRIS_MAX } from './debris.js';
import { createParticles } from './sawdust.js';

export const DEBRIS_KIND = Object.freeze({ chip: 0, glass: 1, spark: 2, dust: 3, mud: 4, drop: 5 });
export const DEBRIS_SHADER = Object.freeze({ pointSize: 0.16, maxPx: 72, velLead: 0.04, streakMin: 1, streakMax: 6, minZ: 1e-4 });

export function createDebrisMaterialTSL({ THREE, TSL, MeshBasicNodeMaterial, NodeMaterial } = {}) {
 const Mat = MeshBasicNodeMaterial || NodeMaterial || THREE?.MeshBasicNodeMaterial || THREE?.NodeMaterial || TSL?.NodeMaterial;
 const {
  Fn, If, Discard, varying, vec2, vec3, vec4, float,
  abs, atan, clamp, cos, dot, exp, floor, fract, length, max, min, mix, select, sin, smoothstep,
  attribute, positionGeometry, modelViewMatrix, cameraProjectionMatrix, screenSize, uv
 } = TSL;
 const aPos = attribute('aPos', 'vec3'), aCol = attribute('aColor', 'vec3');
 const aVel = attribute('aVel', 'vec3'), aKind = attribute('aKind', 'float'), aT = attribute('aT', 'float');

 const mv = modelViewMatrix.mul(vec4(aPos, 1.0));
 const clip = cameraProjectionMatrix.mul(mv);
 const pa = cameraProjectionMatrix.mul(modelViewMatrix.mul(vec4(aPos.add(aVel.mul(DEBRIS_SHADER.velLead)), 1.0)));
 const dd0 = pa.xy.div(pa.w).sub(clip.xy.div(clip.w));
 const dd = vec2(dd0.x.mul(cameraProjectionMatrix.element(1).y.div(cameraProjectionMatrix.element(0).x)), dd0.y);
 const dl = length(dd);
 const dir = select(dl.greaterThan(1e-5), dd.div(dl), vec2(1.0, 0.0));
 const k = floor(aKind);
 const st = select(k.greaterThan(1.5).and(k.lessThan(2.5)), smoothstep(DEBRIS_SHADER.streakMin, DEBRIS_SHADER.streakMax, length(aVel)), float(0.0));
 const sMul = select(
  k.greaterThan(4.5), float(0.55),
  select(k.greaterThan(3.5), float(1.1),
   select(k.greaterThan(2.5), float(2.0).add(aT.mul(4.0)),
    select(k.greaterThan(1.5), float(0.8).add(st.mul(3.4)), select(k.greaterThan(0.5), float(1.15), float(0.9)))))
 );
 const basePx = float(DEBRIS_SHADER.pointSize).mul(screenSize.y.mul(0.5)).div(max(mv.z.negate(), DEBRIS_SHADER.minZ));
 const pxOff = positionGeometry.xy.mul(min(basePx.mul(sMul), float(DEBRIS_SHADER.maxPx))).mul(2.0).div(screenSize).mul(clip.w);

 const vKind = varying(k, 'vDebKind'), vSeed = varying(fract(aKind), 'vDebSeed'), vT = varying(aT, 'vDebT');
 const vDir = varying(dir, 'vDebDir'), vStreak = varying(st, 'vDebStreak'), vCol = varying(aCol, 'vDebCol');

 const material = new Mat({
  color: '#ffffff', transparent: true, opacity: 1, depthWrite: false, fog: false,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
 });
 material.name = 'crash-debris-tsl';
 if (!material.isMeshBasicNodeMaterial) material.lights = false;
 material.vertexNode = vec4(clip.xy.add(pxOff), clip.z, clip.w);
 material.colorNode = Fn(() => {
  const q = uv().mul(2.0).sub(1.0);
  const out = vec4(0.0).toVar(), keep = float(1.0).toVar();
  If(vKind.greaterThan(2.5).and(vKind.lessThan(3.5)), () => {
   const a = float(1.0).sub(smoothstep(0.15, 1.0, length(q))).mul(0.5).mul(float(1.0).sub(vT)).mul(smoothstep(0.0, 0.1, vT));
   If(a.lessThan(0.01), () => { keep.assign(0.0); }).Else(() => { out.assign(vec4(vCol.mul(a), a)); });
  }).ElseIf(vKind.greaterThan(4.5), () => {
   const r = length(q), a = float(1.0).sub(smoothstep(0.55, 0.85, r)).mul(float(1.0).sub(smoothstep(0.8, 1.0, vT)));
   If(a.lessThan(0.02), () => { keep.assign(0.0); }).Else(() => { out.assign(vec4(vCol.mul(float(0.85).add(float(1.0).sub(r).mul(0.3))).mul(a), a)); });
  }).ElseIf(vKind.greaterThan(1.5).and(vKind.lessThan(2.5)), () => {
   const al = dot(q, vDir), pe = dot(q, vec2(vDir.y.negate(), vDir.x)), pw = mix(0.9, 0.07, vStreak);
   const r2 = al.mul(al).div(0.9).add(pe.mul(pe).div(pw.mul(pw)));
   const ks = exp(r2.mul(-3.2)).mul(mix(1.0, float(0.25).add(smoothstep(-1.0, 0.9, al).mul(0.75)), vStreak)).mul(float(1.0).sub(smoothstep(0.6, 1.0, vT)));
   If(ks.lessThan(0.01), () => { keep.assign(0.0); }).Else(() => {
    const hot = select(vT.lessThan(0.35), mix(vec3(1.0, 0.95, 0.7), vec3(1.0, 0.55, 0.12), vT.div(0.35)), mix(vec3(1.0, 0.55, 0.12), vec3(0.3, 0.07, 0.02), clamp(vT.sub(0.35).div(0.65), 0.0, 1.0)));
    out.assign(vec4(hot.mul(ks).mul(float(2.0).sub(vT)), 0.0));
   });
  }).Else(() => {
   const c = cos(vSeed.mul(6.2832)), s = sin(vSeed.mul(6.2832));
   const p = vec2(c.mul(q.x).sub(s.mul(q.y)), s.mul(q.x).add(c.mul(q.y)));
   const a = float(0.0).toVar(), col = vCol.toVar();
   If(vKind.greaterThan(0.5).and(vKind.lessThan(1.5)), () => {
    a.assign(float(1.0).sub(smoothstep(0.6, 0.72, abs(p.x).mul(1.15).add(abs(p.y).mul(0.65)))));
    col.assign(mix(col, vec3(1.0), float(0.35).mul(float(0.5).add(p.x.mul(0.5)))));
   }).Else(() => {
    const r = length(p.mul(vec2(1.0, 0.82))).add(sin(atan(p.y, p.x).mul(3.0).add(vSeed.mul(20.0))).mul(0.1));
    a.assign(float(1.0).sub(smoothstep(0.55, 0.8, r)));
    col.mulAssign(0.8);
   });
   a.mulAssign(float(1.0).sub(smoothstep(0.75, 1.0, vT)));
   If(a.lessThan(0.02), () => { keep.assign(0.0); }).Else(() => { out.assign(vec4(col.mul(a), a)); });
  });
  If(keep.lessThan(0.5), () => { Discard(); });
  return out;
 })();
 return { material };
}

export function createDebrisMeshTSL({ THREE, TSL, MeshBasicNodeMaterial, NodeMaterial, max = DEBRIS_MAX } = {}) {
 const P = createParticles(max);
 P.g = new Float32Array(max).fill(1); P.dr = new Float32Array(max).fill(1); P.bn = new Float32Array(max).fill(1);
 const geometry = new THREE.PlaneGeometry(1, 1);
 const col = new Float32Array(max * 3).fill(0.5), kinds = new Float32Array(max), frac = new Float32Array(max);
 const aPos = new THREE.InstancedBufferAttribute(P.pos, 3).setUsage(THREE.DynamicDrawUsage);
 const aColor = new THREE.InstancedBufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage);
 const aVel = new THREE.InstancedBufferAttribute(P.vel, 3).setUsage(THREE.DynamicDrawUsage);
 const aKind = new THREE.InstancedBufferAttribute(kinds, 1);
 const aT = new THREE.InstancedBufferAttribute(frac, 1).setUsage(THREE.DynamicDrawUsage);
 geometry.setAttribute('aPos', aPos); geometry.setAttribute('aColor', aColor);
 geometry.setAttribute('aVel', aVel); geometry.setAttribute('aKind', aKind); geometry.setAttribute('aT', aT);
 const { material } = createDebrisMaterialTSL({ THREE, TSL, MeshBasicNodeMaterial, NodeMaterial });
 const mesh = new THREE.InstancedMesh(geometry, material, max);
 const id = new THREE.Matrix4();
 for (let i = 0; i < max; i++) mesh.setMatrixAt(i, id);
 mesh.instanceMatrix.needsUpdate = true;
 mesh.name = 'crash-debris'; mesh.frustumCulled = false; mesh.visible = false; mesh.castShadow = false;
 return { mesh, particles: P, geometry, material, aPos, aColor, aVel, aKind, aT, col, kinds, frac };
}
