// TSL menu-scene cover wind material (notes/webgpu-spike.md T3): twin of dist/menu-scene.js:50.
import { COVER_WIND } from './menu-scene-rules.js';

export function createMenuWindMaterialTSL({ THREE, TSL, MeshLambertNodeMaterial, NodeMaterial, wind = null } = {}) {
 const Mat = MeshLambertNodeMaterial || NodeMaterial || THREE?.MeshLambertNodeMaterial || THREE?.NodeMaterial || TSL?.NodeMaterial;
 const { Fn, uniform, vec3, sin, positionLocal, attribute, referenceAttribute } = TSL;
 const uTime = uniform(wind?.uTime?.value ?? 0);
 const uGust = uniform(wind?.uGust?.value ?? 0);
 const W = COVER_WIND;

 const material = new Mat({ vertexColors: true });
 material.name = 'menu-cover-tsl';
 material.positionNode = Fn(() => {
  const cP = referenceAttribute('instanceMatrix', 'mat4').element(3).xyz;
  const bend = attribute('aBend', 'float');
  const phase = uTime.mul(W.speed).sub(cP.x.mul(W.kx)).sub(cP.z.mul(W.kz));
  const cB = bend.mul(bend).mul(uGust.mul(W.lean).add(uGust.mul(W.gust).add(W.sway).mul(sin(phase))));
  return positionLocal.add(vec3(W.x, 0.0, W.z).mul(cB));
 })();

 return { material, uniforms: { uTime, uGust } };
}
