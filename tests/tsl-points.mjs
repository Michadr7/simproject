// Sized points on the node path (dist/tsl-points.js, WebGPU T6, T5 gap 6): one instanced Sprite with the real PointsNodeMaterial, same colour/size/opacity as the PointsMaterial it replaces.
import assert from 'node:assert/strict';
import * as W from '../dist/vendor/three.webgpu.js';
import * as TSL from '../dist/vendor/three.tsl.js';
import { createPointsSpriteTSL } from '../dist/tsl-points.js';

const position = new W.InstancedBufferAttribute(new Float32Array(300 * 3), 3);
const s = createPointsSpriteTSL({ THREE: W, TSL, PointsNodeMaterial: W.PointsNodeMaterial, position, color: '#d9b47c', size: 0.075, opacity: 0.85, name: 'sawdust' });
assert(s.isSprite, 'a Sprite (WebGPU honours point size only on sprites)'); assert.equal(s.count, 300, 'one instance per point: one draw call');
const m = s.material;
assert(m.isPointsNodeMaterial); assert.equal(m.name, 'sawdust-tsl'); assert.equal(m.size, 0.075); assert.equal(m.sizeAttenuation, true, 'shrinks with distance like WebGL');
assert.equal(m.opacity, 0.85); assert.equal(m.transparent, true); assert.equal(m.depthWrite, false); assert.equal(m.color.getHexString(), new W.Color('#d9b47c').getHexString());
assert(m.positionNode && m.positionNode.isNode, 'positions come from the instanced attribute');
assert.equal(s.frustumCulled, false); assert.equal(s.castShadow, false);
const hits = []; s.raycast(new W.Raycaster(), hits); assert.equal(hits.length, 0, 'never picked (and no "Raycaster.camera" error)');
const opaque = createPointsSpriteTSL({ THREE: W, TSL, PointsNodeMaterial: W.PointsNodeMaterial, position, size: 0.05 });
assert.equal(opaque.material.transparent, false);
console.log('PASS tsl-points: sawdust/menu dust become one instanced Sprite with PointsNodeMaterial (size 0.075 m, attenuated, same colour and opacity), never raycast.');
