import * as THREE from './vendor/three.module.js';

// Geometry is shifted so the mesh origin is at the player's feet.
export function createRemotePlayer(position = {x: 0, y: 0, z: 0}) {
  const geometry = new THREE.CapsuleGeometry(.32, 1.05, 4, 8);
  geometry.translate(0, .845, 0);
  const material = new THREE.MeshStandardMaterial({color: '#368cff', roughness: .65});
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'remote-player';
  mesh.castShadow = true;
  mesh.position.set(position.x, position.y, position.z);
  mesh.userData.target = mesh.position.clone();
  return mesh;
}
export function updateRemotePlayer(mesh, dt) {
  mesh.position.lerp(mesh.userData.target, 1 - Math.exp(-12 * dt));
}
export function disposeRemotePlayer(mesh) {
  mesh.removeFromParent();
  mesh.geometry.dispose();
  mesh.material.dispose();
}
