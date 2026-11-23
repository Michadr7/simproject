// TSL night-light additive glow (notes/webgpu-spike.md T3): twin of night-lights.js:18-75.
export const NIGHT_SHADER = Object.freeze({ fogNear: 30, fogFar: 120, spriteFogScale: 1.25, glowPow: 8, glowBoost: 0.6 });

export function createNightLightsMaterialsTSL({ THREE, TSL, MeshBasicNodeMaterial, NodeMaterial } = {}) {
 const Mat = MeshBasicNodeMaterial || NodeMaterial || THREE?.MeshBasicNodeMaterial || THREE?.NodeMaterial || TSL?.NodeMaterial;
 const {
  Fn, uniform, varying, vec4, float, length, mix, pow, smoothstep,
  attribute, positionGeometry, modelViewMatrix, cameraViewMatrix, cameraProjectionMatrix
 } = TSL;

 const uLevel = uniform(0);
 const uFogNear = uniform(NIGHT_SHADER.fogNear);
 const uFogFar = uniform(NIGHT_SHADER.fogFar);
 const uniforms = { uLevel, uFogNear, uFogFar };

 const vAt = varying(positionGeometry.xy.mul(2.0), 'vNightAt');
 const sMv = cameraViewMatrix.mul(vec4(attribute('aCentre', 'vec3'), 1.0));
 const vDepth = varying(sMv.z.negate(), 'vNightDepth');
 const vTint = varying(attribute('aTint', 'vec3').mul(mix(1.0, uLevel, attribute('aLamp', 'float'))), 'vNightTint');

 const makeMat = name => {
  const m = new Mat({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false });
  m.name = name;
  if (!m.isMeshBasicNodeMaterial) m.lights = false;
  m.userData = { ...(m.userData || {}), uniforms };
  return m;
 };

 const spriteMat = makeMat('night-sprites-tsl');
 spriteMat.vertexNode = cameraProjectionMatrix.mul(vec4(sMv.xy.add(positionGeometry.xy.mul(attribute('aSize', 'float'))), sMv.z, sMv.w));
 spriteMat.colorNode = Fn(() => {
  const a = float(1.0).sub(smoothstep(0.0, 1.0, length(vAt)));
  const glow = a.mul(a).add(pow(a, NIGHT_SHADER.glowPow).mul(NIGHT_SHADER.glowBoost));
  const fogFade = float(1.0).sub(smoothstep(uFogNear, uFogFar.mul(NIGHT_SHADER.spriteFogScale), vDepth));
  return vTint.mul(glow).mul(fogFade);
 })();

 const gMv = modelViewMatrix.mul(vec4(positionGeometry, 1.0));
 const gDepth = varying(gMv.z.negate(), 'vGroundDepth');
 const gTint = varying(attribute('aTint', 'vec3').mul(mix(1.0, uLevel, attribute('aLamp', 'float'))), 'vGroundTint');

 const groundMat = makeMat('night-ground-tsl');
 groundMat.polygonOffset = true;
 groundMat.polygonOffsetFactor = -1;
 groundMat.polygonOffsetUnits = -2;
 groundMat.vertexNode = cameraProjectionMatrix.mul(gMv);
 groundMat.colorNode = Fn(() => gTint.mul(float(1.0).sub(smoothstep(uFogNear, uFogFar, gDepth))))();

 return { spriteMat, groundMat, uniforms };
}
