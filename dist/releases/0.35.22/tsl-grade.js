// TSL colour grade (notes/webgpu-spike.md T2): CustomToneMapping twin of daynight.js gradeGLSL.
import { GRADE } from './daynight.js';

export function createGradeTSL({ TSL }) {
 const { Fn, vec3, float, max, mix, smoothstep, dot, saturate } = TSL;
 return Fn(([colorIn, exposure]) => {
  const G = GRADE;
  const lumaVec = vec3(G.luma[0], G.luma[1], G.luma[2]);
  const c = max(vec3(0.0), colorIn).mul(exposure).mul(G.gain).toVar();
  const l = dot(c, lumaVec).toVar();
  const shadow = float(1.0).sub(smoothstep(0.0, G.shadowEnd, l));
  const high = smoothstep(G.highStart, G.highEnd, l);
  c.mulAssign(mix(vec3(1.0), vec3(...G.shadowTint), shadow).mul(mix(vec3(1.0), vec3(...G.highTint), high)));
  const sat = mix(G.satLow, G.satHigh, smoothstep(0.0, G.satEnd, l));
  const satCol = max(vec3(0.0), mix(vec3(dot(c, lumaVec)), c, sat));
  const w2 = G.white * G.white;
  const outCol = satCol.mul(satCol.div(w2).add(1.0)).div(satCol.add(1.0));
  return saturate(outCol);
 }, { colorIn: 'vec3', exposure: 'float', return: 'vec3' });
}

export function installGradeTSL({ THREE, TSL, renderer }) {
 if (!renderer?.library?.addToneMapping) return null;
 const gradeTSL = createGradeTSL({ TSL });
 renderer.library.addToneMapping(gradeTSL, THREE.CustomToneMapping);
 renderer.toneMapping = THREE.CustomToneMapping;
 return gradeTSL;
}
