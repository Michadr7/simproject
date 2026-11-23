// TSL exhaust smoke billboard material (notes/webgpu-spike.md T3): twin of smoke.js:39.
import { SMOKE_MAX, SMOKE_COLOURS, SMOKE_SIZE, SMOKE_ALPHA } from './smoke.js';
import { createParticles } from './sawdust.js';

export const SMOKE_SHADER = Object.freeze({ pointSize: 1, alphaTest: 0.01, minZ: 1e-4 });

export function createSmokeMaterialTSL({ THREE, TSL, MeshBasicNodeMaterial, NodeMaterial, map = null } = {}) {
 const Mat = MeshBasicNodeMaterial || NodeMaterial || THREE?.MeshBasicNodeMaterial || THREE?.NodeMaterial || TSL?.NodeMaterial;
 const {
  Fn, varying, vec4, float, max,
  attribute, positionGeometry, modelViewMatrix, cameraProjectionMatrix, screenSize, uv, texture
 } = TSL;
 const aPos = attribute('aPos', 'vec3');
 const aColor = attribute('aColor', 'vec3');
 const aSize = attribute('aSize', 'float');
 const aFade = attribute('aFade', 'float');

 const mv = modelViewMatrix.mul(vec4(aPos, 1.0));
 const clip = cameraProjectionMatrix.mul(mv);
 const pxSize = float(SMOKE_SHADER.pointSize).mul(aSize).mul(screenSize.y.mul(0.5)).div(max(mv.z.negate(), SMOKE_SHADER.minZ));
 const pxOff = positionGeometry.xy.mul(pxSize).mul(2.0).div(screenSize).mul(clip.w);

 const vCol = varying(aColor, 'vSmokeCol');
 const vFade = varying(aFade, 'vSmokeFade');

 const material = new Mat({
  color: '#ffffff',
  transparent: true,
  opacity: SMOKE_ALPHA,
  depthWrite: false,
  alphaTest: SMOKE_SHADER.alphaTest
 });
 material.name = 'exhaust-smoke-tsl';
 if (!material.isMeshBasicNodeMaterial) material.lights = false;
 if (map) material.map = map;
 material.vertexNode = vec4(clip.xy.add(pxOff), clip.z, clip.w);
 material.colorNode = Fn(() => {
  if (!map) return vec4(vCol, 1.0);
  const tex = texture(map, uv());
  return vec4(vCol.mul(tex.rgb), tex.a);
 })();
 material.opacityNode = Fn(() => float(SMOKE_ALPHA).mul(vFade))();

 return { material };
}

export function createSmokeMeshTSL({ THREE, TSL, MeshBasicNodeMaterial, NodeMaterial, max = SMOKE_MAX, map = null } = {}) {
 const P = createParticles(max);
 const geometry = new THREE.PlaneGeometry(1, 1);
 const col = new Float32Array(max * 3);
 const base = new Float32Array(max).fill(SMOKE_SIZE[0]);
 const size = new Float32Array(max).fill(SMOKE_SIZE[0]);
 const fade = new Float32Array(max);
 const tier0 = new THREE.Color(SMOKE_COLOURS[0]);
 for (let i = 0; i < max; i++) tier0.toArray(col, i * 3);

 const aPos = new THREE.InstancedBufferAttribute(P.pos, 3).setUsage(THREE.DynamicDrawUsage);
 const aColor = new THREE.InstancedBufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage);
 const aSize = new THREE.InstancedBufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
 const aFade = new THREE.InstancedBufferAttribute(fade, 1).setUsage(THREE.DynamicDrawUsage);
 geometry.setAttribute('aPos', aPos);
 geometry.setAttribute('aColor', aColor);
 geometry.setAttribute('aSize', aSize);
 geometry.setAttribute('aFade', aFade);

 const { material } = createSmokeMaterialTSL({ THREE, TSL, MeshBasicNodeMaterial, NodeMaterial, map });
 const mesh = new THREE.InstancedMesh(geometry, material, max);
 const id = new THREE.Matrix4();
 for (let i = 0; i < max; i++) mesh.setMatrixAt(i, id);
 mesh.instanceMatrix.needsUpdate = true;
 mesh.name = 'exhaust-smoke';
 mesh.frustumCulled = false;
 mesh.visible = false;
 mesh.castShadow = false;

 return { mesh, particles: P, geometry, material, aPos, aColor, aSize, aFade, col, base, size, fade };
}
