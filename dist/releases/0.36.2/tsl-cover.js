// TSL ground cover wind & fade (notes/webgpu-spike.md T3): twin of ground-cover-view.js.
import { COVER_UP, COVER_ALPHA_TEST } from './ground-cover-view.js';
import { WIND_BASE, WIND_KIND_MUL } from './wind.js';
import { coverReach, tierOf } from './ground-cover-rules.js';
import { kindUniform } from './cover-pack.js';

export const COVER_SHADER = Object.freeze({ swayPhaseMul: 0.35, strengthRef: 0.85, shrinkMul: 2.0 });

export function createCoverWindTSL({ THREE, TSL } = {}) {
 return {
  uWind: TSL.uniform(new THREE.Vector4(WIND_BASE.dx, WIND_BASE.dz, COVER_SHADER.strengthRef, 0.5)),
  uWindT: TSL.uniform(0)
 };
}

export function createCoverMaterialTSL({ THREE, TSL, MeshStandardNodeMaterial, NodeMaterial, kind, height = 1, reach = null, tier = 'high', atlas = null, wind = null } = {}) {
 const Mat = MeshStandardNodeMaterial || NodeMaterial || THREE?.MeshStandardNodeMaterial || THREE?.NodeMaterial || TSL?.NodeMaterial;
 const {
  Fn, uniform, vec3, float, clamp, distance, min, mix, normalize, select, sin, smoothstep,
  attribute, referenceAttribute, positionGeometry, positionLocal, normalLocal, cameraPosition, transformNormalToView
 } = TSL;

 const r = reach || coverReach(kind, tierOf(tier));
 const u = kindUniform(kind, r, WIND_KIND_MUL[kind] ?? 1, height);
 const uKind = uniform(new THREE.Vector4(u[0], u[1], u[2], u[3]));
 const uUp = uniform(COVER_UP[kind] ?? 0.5);
 const w = wind || createCoverWindTSL({ THREE, TSL });

 const material = new Mat({
  map: atlas,
  vertexColors: true,
  alphaTest: COVER_ALPHA_TEST,
  side: THREE.DoubleSide,
  roughness: 1,
  metalness: 0
 });
 material.name = 'cover-tsl-' + kind;
 material.positionNode = Fn(() => {
  const cvRoot = referenceAttribute('instanceMatrix', 'mat4').element(3).xyz;
  const aInst = attribute('aInst', 'vec2');
  const cvKeep = float(1.0).sub(smoothstep(uKind.x, uKind.y, distance(cvRoot.xz, cameraPosition.xz)));
  const cvScale = select(cvKeep.greaterThan(aInst.x), float(1.0), float(0.0)).mul(min(1.0, cvKeep.mul(COVER_SHADER.shrinkMul)));
  const cvB0 = clamp(positionGeometry.y.mul(uKind.w), 0.0, 1.0);
  const cvB = cvB0.mul(cvB0);
  const phase = w.uWindT.mul(WIND_BASE.speed).sub(cvRoot.x.mul(w.uWind.x).add(cvRoot.z.mul(w.uWind.y)).mul(WIND_BASE.k)).add(aInst.y.mul(COVER_SHADER.swayPhaseMul));
  const cvM = cvB.mul(w.uWind.w.mul(WIND_BASE.lean).add(w.uWind.w.mul(WIND_BASE.gust).add(WIND_BASE.sway).mul(sin(phase)))).mul(w.uWind.z).mul(uKind.z).div(COVER_SHADER.strengthRef);
  return cvRoot.add(positionLocal.sub(cvRoot).mul(cvScale)).add(vec3(w.uWind.x.mul(cvM), 0.0, w.uWind.y.mul(cvM)));
 })();
 material.normalNode = transformNormalToView(normalize(mix(normalLocal, vec3(0.0, 1.0, 0.0), uUp))).toVarying('vCoverNormal').normalize();

 return { material, uniforms: { uKind, uUp, uWind: w.uWind, uWindT: w.uWindT } };
}
