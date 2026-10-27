import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createApartment,ENTRY,EXIT,BED} from '../dist/apartment.js';
import {createIndoorCamera} from '../dist/indoor-camera.js';
const room=createApartment();
// Flood-fill navigable floor to catch furniture layouts that isolate interactions.
const step=.2,seen=new Set(),queue=[ENTRY];const key=(x,z)=>Math.round(x/step)+','+Math.round(z/step);
while(queue.length){const p=queue.pop(),k=key(p.x,p.z);if(seen.has(k)||room.blocked(p.x,p.z))continue;seen.add(k);for(const [dx,dz]of [[step,0],[-step,0],[0,step],[0,-step]])queue.push({x:p.x+dx,z:p.z+dz})}
for(const point of [BED,EXIT,{x:-2,z:2.5},{x:2,z:-3}])assert(seen.has(key(point.x,point.z)),'interaction and living areas are reachable');
const camera=new T.PerspectiveCamera(52,1,.1,200),player=new T.Group();player.position.set(0,.02,4.5);camera.position.set(0,3,10);const update=createIndoorCamera(camera,room.occluders);
for(let i=0;i<120;i++)update(player,0,.4,6,1/60);
const target=player.position.clone().add(new T.Vector3(0,1.1,0));assert(camera.position.distanceTo(target)>5.8,'rear wall does not push camera into character');assert(room.solids.some(m=>m.material.opacity<.1),'obstructing wall becomes a cutaway');assert(room.scene.getObjectByName('front-door').material.opacity<.1,'door fades along with its wall');assert(room.blocked(0,5.45),'faded wall remains physically solid');
for(let i=0;i<120;i++)update(player,Math.PI,.4,6,1/60);
assert(room.solids.some(m=>m.material.opacity>.99),'clear furniture and walls stay visible');
console.log('Interior route connectivity, camera distance, wall cutaway and solid collisions passed.');
