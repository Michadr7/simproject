// The drop spots for Store orders (0.34), drawn: a parcel locker beside the studio's entrance (a steel cabinet with a lamp that glows green while something waits), and a cardboard parcel box on the
// grass in front of each house's door (shown only while a parcel waits). Simple primitives for now (no model yet). update(progress) is cheap: it only sets visibility and the lamp.
import * as THREE from './vendor/three.module.js';
import {MAP} from './map-definition.js';
import {homesHeld,dropSpot,waiting,STUDIO_ID} from './orders.js';
export function createParcels(scene,{colliders=[]}={}){
 const steel=new THREE.MeshStandardMaterial({color:'#6d7a80',roughness:.6,metalness:.4}),door=new THREE.MeshStandardMaterial({color:'#4a5a60',roughness:.6,metalness:.3}),cardboard=new THREE.MeshStandardMaterial({color:'#b98f5a',roughness:.9}),tape=new THREE.MeshStandardMaterial({color:'#8d6a3c',roughness:.9});
 const lampOff=new THREE.MeshStandardMaterial({color:'#2b3a30',roughness:.5}),lampOn=new THREE.MeshStandardMaterial({color:'#52e08a',emissive:'#52e08a',emissiveIntensity:1.4,roughness:.4});
 const group=new THREE.Group();group.name='parcel-drops';scene.add(group);const spots=new Map();
 const part=(parent,geometry,material,x,y,z)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m};
 {const d=dropSpot(STUDIO_ID),g=new THREE.Group();g.name='parcel-locker';g.position.set(d.x,0,d.z);
  part(g,new THREE.BoxGeometry(1.2,1.9,.6),steel,0,.95,0);for(const dx of [-.3,.3])for(const dy of [.55,1.35])part(g,new THREE.BoxGeometry(.5,.62,.04),door,dx,dy,.32);
  const lamp=part(g,new THREE.BoxGeometry(.5,.1,.05),lampOff,0,1.8,.33);g.visible=false;group.add(g);spots.set(STUDIO_ID,{group:g,lamp});colliders.push({x:d.x,z:d.z,hx:.6,hz:.3})}
 for(const p of MAP.properties.filter(q=>q.listing)){const d=dropSpot(p.id);if(!d)continue;const g=new THREE.Group();g.name='parcel-box-'+p.id;g.position.set(d.x,0,d.z);g.rotation.y=d.yaw;
  part(g,new THREE.BoxGeometry(.7,.45,.5),cardboard,0,.225,0);part(g,new THREE.BoxGeometry(.72,.02,.1),tape,0,.46,0);part(g,new THREE.BoxGeometry(.4,.3,.3),cardboard,.62,.15,.1);g.visible=false;group.add(g);spots.set(p.id,{group:g})}
 return {group,spots,
  update(progress){const held=new Set(homesHeld(progress).map(h=>h.id));
   for(const [id,s] of spots){const has=waiting(progress,id)>0&&held.has(id);
    if(id===STUDIO_ID){s.group.visible=held.has(id);if(s.lamp.material!==(has?lampOn:lampOff))s.lamp.material=has?lampOn:lampOff}else s.group.visible=has}}};
}
