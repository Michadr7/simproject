import * as T from './vendor/three.module.js';
// A cutaway interior keeps the camera at a useful distance. Only geometry in
// the camera-to-character sightline fades; walking collisions remain solid.
export function createIndoorCamera(camera,meshes){
 const obstacles=meshes.map(mesh=>{mesh.material=mesh.material.clone();mesh.material.transparent=true;return {mesh,bounds:new T.Box3().setFromObject(mesh).expandByScalar(.15)}});
 const target=new T.Vector3(),desired=new T.Vector3(),chest=new T.Vector3(),direction=new T.Vector3(),hit=new T.Vector3(),ray=new T.Ray();
 function intersects(start,end,box){direction.subVectors(end,start);const length=direction.length();direction.divideScalar(length||1);ray.set(start,direction);return box.containsPoint(start)||!!(ray.intersectBox(box,hit)&&start.distanceTo(hit)<length)}
 return function update(player,yaw,pitch,zoom,dt){
  target.copy(player.position);target.y+=1.1;
  const distance=T.MathUtils.clamp(zoom,4.5,7),elevation=T.MathUtils.clamp(pitch,.22,.85);
  desired.set(Math.sin(yaw)*Math.cos(elevation)*distance,Math.sin(elevation)*distance,Math.cos(yaw)*Math.cos(elevation)*distance).add(target);
  camera.position.lerp(desired,1-Math.exp(-dt*12));camera.lookAt(target);chest.copy(target);chest.y-=.45;
  for(const {mesh,bounds} of obstacles){const blocked=intersects(camera.position,target,bounds)||intersects(camera.position,chest,bounds);mesh.material.opacity=T.MathUtils.lerp(mesh.material.opacity,blocked?.04:1,1-Math.exp(-dt*18));mesh.material.depthWrite=mesh.material.opacity>.95}
 };
}
