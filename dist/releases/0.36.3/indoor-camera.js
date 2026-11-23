import * as T from './vendor/three.module.js';
// A cutaway interior keeps the camera at a useful distance. Only geometry in
// the camera-to-character sightline fades; walking collisions remain solid.
export function createIndoorCamera(camera,meshes,options={}){
 const {bounds=null,maxDistance=12,minDistance=3}=options;
 const obstacles=meshes.map(mesh=>{mesh.material=mesh.material.clone();mesh.material.transparent=true;mesh.updateWorldMatrix(true,false);return {mesh,bounds:new T.Box3().setFromObject(mesh).expandByScalar(.15)}}); // updateWorldMatrix(true): the parents too (an upper floor is a group raised by 3.4 m: its walls fade only if their box is where they really are)
 const target=new T.Vector3(),desired=new T.Vector3(),chest=new T.Vector3(),direction=new T.Vector3(),hit=new T.Vector3(),ray=new T.Ray();
 const roomBox=bounds?new T.Box3(new T.Vector3(bounds.minX,bounds.minY,bounds.minZ),new T.Vector3(bounds.maxX,bounds.maxY,bounds.maxZ)):null;
 function intersects(start,end,box){direction.subVectors(end,start);const length=direction.length();direction.divideScalar(length||1);ray.set(start,direction);return box.containsPoint(start)||!!(ray.intersectBox(box,hit)&&start.distanceTo(hit)<length)}
 function clampDesired(start,end){
  if(!roomBox)return;
  direction.subVectors(end,start);
  let t=1;
  for(const ax of ['x','y','z']){const d=direction[ax];if(d>1e-6)t=Math.min(t,(roomBox.max[ax]-start[ax])/d);else if(d<-1e-6)t=Math.min(t,(roomBox.min[ax]-start[ax])/d)}
  end.copy(start).addScaledVector(direction,Math.max(0,Math.min(1,t))).clamp(roomBox.min,roomBox.max);
 }
 return function update(player,yaw,pitch,zoom,dt){
  target.copy(player.position);target.y+=1.1;
  const distance=T.MathUtils.clamp(zoom,minDistance,maxDistance),elevation=T.MathUtils.clamp(pitch,.22,.85);
  desired.set(Math.sin(yaw)*Math.cos(elevation)*distance,Math.sin(elevation)*distance,Math.cos(yaw)*Math.cos(elevation)*distance).add(target);
  clampDesired(target,desired);
  camera.position.lerp(desired,1-Math.exp(-dt*12));if(roomBox)camera.position.clamp(roomBox.min,roomBox.max);camera.lookAt(target);chest.copy(target);chest.y-=.45;
  for(const {mesh,bounds:b} of obstacles){const blocked=intersects(camera.position,target,b)||intersects(camera.position,chest,b);mesh.material.opacity=T.MathUtils.lerp(mesh.material.opacity,blocked?.04:1,1-Math.exp(-dt*18));mesh.material.depthWrite=mesh.material.opacity>.95}
 };
}
