// TSL blob shadows (notes/webgpu-spike.md T2): NodeMaterial twin of dist/shadows.js blob-shadows.
import { BLOB } from './shadow-rules.js';

export const BLOB_SMOOTH = Object.freeze({
 circleInner: 0.3,
 boxInner: 0.75,
 outer: 1.0,
 fogNearDefault: 65,
 fogFarDefault: 155
});

export function createBlobMaterialTSL({ THREE, TSL, NodeMaterial, fog = null } = {}) {
 const NM = NodeMaterial || THREE?.NodeMaterial || TSL?.NodeMaterial;
 const {
  Fn, uniform, varying, vec3, float, abs, sqrt, length, mix, smoothstep,
  positionGeometry, attribute, rangeFogFactor, reference
 } = TSL;
 const uOpacity = uniform(0);
 const uFogNear = uniform(fog?.near ?? BLOB_SMOOTH.fogNearDefault);
 const uFogFar = uniform(fog?.far ?? BLOB_SMOOTH.fogFarDefault);
 const nearNode = fog ? reference('near', 'float', fog) : uFogNear;
 const farNode = fog ? reference('far', 'float', fog) : uFogFar;

 const vAt = varying(positionGeometry.xz.mul(2.0), 'vBlobAt');
 const vBox = varying(attribute('aBox', 'float'), 'vBlobBox');

 const material = new NM();
 material.name = 'blob-shadows-tsl';
 material.transparent = true;
 material.depthWrite = false;
 material.fog = false;
 material.toneMapped = false;
 material.lights = false;
 material.polygonOffset = true;
 material.polygonOffsetFactor = -1;
 material.polygonOffsetUnits = -2;
 material.colorNode = vec3(0.0, 0.0, 0.0);
 material.opacityNode = Fn(() => {
  const p = abs(vAt);
  const q0 = p.mul(p);
  const q = q0.mul(q0);
  const d = mix(length(p), sqrt(sqrt(q.x.add(q.y))), vBox);
  const inner = mix(BLOB_SMOOTH.circleInner, BLOB_SMOOTH.boxInner, vBox);
  const shape = float(1.0).sub(smoothstep(inner, BLOB_SMOOTH.outer, d));
  const fogFade = float(1.0).sub(rangeFogFactor(nearNode, farNode));
  return shape.mul(uOpacity).mul(fogFade);
 })();

 return { material, uniforms: { uOpacity, uFogNear, uFogFar } };
}

export function createBlobMeshTSL({ THREE, TSL, NodeMaterial, fog = null, capacity = BLOB.capacity } = {}) {
 const geometry = new THREE.InstancedBufferGeometry();
 geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-.5, 0, -.5, .5, 0, -.5, .5, 0, .5, -.5, 0, .5]), 3));
 geometry.setIndex([0, 2, 1, 0, 3, 2]);
 const box = new Float32Array(capacity);
 const aBox = new THREE.InstancedBufferAttribute(box, 1);
 aBox.setUsage(THREE.DynamicDrawUsage);
 geometry.setAttribute('aBox', aBox);

 const { material, uniforms } = createBlobMaterialTSL({ THREE, TSL, NodeMaterial, fog });
 const blobs = new THREE.InstancedMesh(geometry, material, capacity);
 blobs.name = 'blob-shadows';
 blobs.count = 0;
 blobs.visible = false;
 blobs.frustumCulled = false;
 blobs.renderOrder = 4;
 blobs.castShadow = blobs.receiveShadow = false;
 blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 return { blobs, material, geometry, aBox, box, uniforms };
}
