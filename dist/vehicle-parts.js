// Parts a converted vehicle came out without. The flatbed truck (SpawnCamp Games, FBX) converted with its wheel arches and underbody but no wheels at all
// (its only round parts are four small white discs); the original file is not in the repository to convert again, so its wheels are added here in the prop's own
// coordinates (metres, ground at y = 0): a single axle under the load end (z -2.7) and a pair under the cab end (the cab is at +z), a wheel each side, one in each arch.
// If the original is ever converted again with its wheels, delete the entry and this file's use in props.js.
import * as THREE from './vendor/three.module.js';

export const WHEELS={flatbed:{radius:.75,width:.7,x:1.5,z:[-2.7,1.48,3.04]}}; // the arches: one 2.0 m long at z -2.7, one 3.08 m long at z 2.26 (two wheels)

let shared=null;
function parts(){
 if(shared)return shared;
 const tyre=new THREE.CylinderGeometry(1,1,1,24).rotateZ(Math.PI/2),hub=new THREE.CylinderGeometry(1,1,1,16).rotateZ(Math.PI/2);
 return shared={tyre,hub,tyreMaterial:new THREE.MeshStandardMaterial({color:'#1a1c1e',roughness:.95}),hubMaterial:new THREE.MeshStandardMaterial({color:'#9aa1a8',roughness:.6})};
}
// Adds the wheels for prop `id` (if it has an entry) as two small instanced meshes (tyres, hubs) parented to `mesh`. fade: the world's sightline fade.
export function addWheels(id,mesh,fade){
 const spec=WHEELS[id];if(!spec)return null;
 const {tyre,hub,tyreMaterial,hubMaterial}=parts(),count=spec.z.length*2;
 const tyres=new THREE.InstancedMesh(tyre,fade.apply(tyreMaterial.clone()),count),hubs=new THREE.InstancedMesh(hub,fade.apply(hubMaterial.clone()),count),m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
 let i=0;
 for(const z of spec.z)for(const side of [-1,1]){
  p.set(side*spec.x,spec.radius,z);
  tyres.setMatrixAt(i,m.compose(p,q,s.set(spec.width,spec.radius,spec.radius)));
  // the cylinders' axis is x (baked in parts()), so the scale is (width, radius, radius); the hub stands a little proud of the tyre's face
  hubs.setMatrixAt(i,m.compose(p.set(side*(spec.x+.02),spec.radius,z),q,s.set(spec.width+.04,spec.radius*.52,spec.radius*.52)));i++;
 }
 tyres.name='wheels-tyres';hubs.name='wheels-hubs';
 for(const part of [tyres,hubs]){part.castShadow=part.receiveShadow=true;part.computeBoundingSphere();mesh.add(part)}
 return {tyres,hubs};
}
