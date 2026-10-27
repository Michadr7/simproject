import * as THREE from './vendor/three.module.js';

// Keep the entire near-camera area clear, rather than only testing one pixel ray.
const direction = new THREE.Vector3(), hit = new THREE.Vector3();
const ray = new THREE.Ray();
export function constrainCamera(target, position, bounds) {
  direction.subVectors(position, target);
  const length = direction.length();
  if (length < .001) return position;
  direction.divideScalar(length);
  ray.set(target, direction);
  let distance = length;
  for (const box of bounds) {
    if (box.containsPoint(target)) continue;
    if (ray.intersectBox(box, hit)) {
      distance = Math.min(distance, Math.max(.1, target.distanceTo(hit) - .05));
    }
  }
  return position.copy(target).addScaledVector(direction, distance);
}
const segment = new THREE.Line3(), closest = new THREE.Vector3();
export function blocksView(start, end, sphere, margin = .45) {
  segment.set(start, end).closestPointToPoint(sphere.center, true, closest);
  return closest.distanceToSquared(sphere.center) < (sphere.radius + margin) ** 2;
}

export function createCameraController(camera, solids, trees) {
  const bounds = solids.map(mesh => new THREE.Box3().setFromObject(mesh).expandByScalar(.3));
  const desired = new THREE.Vector3(), target = new THREE.Vector3();
  const chest = new THREE.Vector3();
  const foliage = trees.map(tree => ({...tree,
    sphere: new THREE.Sphere(new THREE.Vector3(tree.x,4.7,tree.z),1.5)
  }));
  return function update(player, yaw, pitch, zoom, dt) {
    target.copy(player.position); target.y += 1.5;
    desired.set(Math.sin(yaw)*Math.cos(pitch)*zoom,Math.sin(pitch)*zoom,Math.cos(yaw)*Math.cos(pitch)*zoom).add(target);
    constrainCamera(target, desired, bounds);
    const currentDistance = camera.position.distanceTo(target);
    // Move inward immediately at a wall, and ease back out after leaving it.
    camera.position.lerp(desired, desired.distanceTo(target)<currentDistance ? 1 : 1-Math.exp(-dt*12));
    constrainCamera(target, camera.position, bounds);
    camera.lookAt(target);
    chest.copy(target); chest.y -= .7;
    for (const tree of foliage) {
      const obstructed = blocksView(camera.position,target,tree.sphere) || blocksView(camera.position,chest,tree.sphere);
      const opacity = THREE.MathUtils.lerp(tree.canopy.material.opacity,obstructed?.12:1,1-Math.exp(-dt*14));
      tree.canopy.material.opacity = opacity;
      tree.trunk.material.opacity = opacity;
      tree.canopy.castShadow = opacity>.85;
    }
  };
}
