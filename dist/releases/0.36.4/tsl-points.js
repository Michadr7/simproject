// TSL sized points (WebGPU T6, T5 gap 6): WebGPU draws THREE.Points 1 px wide, so on the node path a PointsMaterial cloud becomes ONE instanced Sprite with a PointsNodeMaterial
// (still one draw call): the same square points, `size` in world units shrinking with distance as WebGL's sizeAttenuation does. Used by sawdust.js and the menu dust (menu-scene.js).
// position: an InstancedBufferAttribute (one point per instance; the caller keeps writing into its array and setting needsUpdate). Returns the Sprite (name it, add it, hide it as before).
export function createPointsSpriteTSL({ THREE, TSL, PointsNodeMaterial, position, color = '#ffffff', size = 1, opacity = 1, sizeAttenuation = true, name = 'points' }) {
 const material = new PointsNodeMaterial({ color, size, sizeAttenuation, transparent: opacity < 1, opacity, depthWrite: false });
 material.name = name + '-tsl';
 material.positionNode = TSL.instancedBufferAttribute(position);
 const sprite = new THREE.Sprite(material);
 sprite.count = position.count;
 sprite.frustumCulled = false;
 sprite.castShadow = sprite.receiveShadow = false;
 sprite.raycast = () => {}; // a Sprite needs raycaster.camera; these points are never picked
 sprite.userData.pointsTSL = true;
 return sprite;
}
