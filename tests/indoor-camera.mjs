import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {buildHouseRoom,FLOOR_HEIGHT} from '../dist/interiors.js';
import {createIndoorCamera} from '../dist/indoor-camera.js';

// The indoor camera fades the walls between it and you, upstairs too (0.34): an upper floor is a group raised by FLOOR_HEIGHT, and the walls' fade boxes must be where the walls really are.
const room=buildHouseRoom('house-c'),{layout}=room,camera=new THREE.PerspectiveCamera(),update=createIndoorCamera(camera,room.occluders);
const player={position:new THREE.Vector3(0,FLOOR_HEIGHT,0)};
for(let i=0;i<60;i++)update(player,0,.25,12,.05); // the camera sits south of the room (yaw 0), low and far: the south wall is between it and you
room.scene.updateMatrixWorld(true);
const upper=room.occluders.filter(m=>m.getWorldPosition(new THREE.Vector3()).y>FLOOR_HEIGHT),south=upper.filter(m=>m.getWorldPosition(new THREE.Vector3()).z>layout.D/2-.01);
assert(south.length>0,'the upper floor has a south wall');
assert(south.every(m=>m.material.opacity<.2),`the south wall of the upper floor fades (opacity ${south.map(m=>m.material.opacity.toFixed(2)).join(', ')})`);
const north=upper.filter(m=>m.getWorldPosition(new THREE.Vector3()).z<-layout.D/2+.01);assert(north.every(m=>m.material.opacity>.9),'the far wall stays solid');
// the storey above is not drawn while you are downstairs, and is when you go up
assert(room.scene.getObjectByName('floor-1').visible===false&&room.scene.getObjectByName('floor-0').visible===true,'downstairs: the upper floor is hidden');
room.setFloor(1);assert(room.scene.getObjectByName('floor-1').visible&&room.scene.getObjectByName('floor-0').visible,'upstairs: both floors are drawn');room.setFloor(0);assert(!room.scene.getObjectByName('floor-1').visible);
// Room bounds clamping (shops): camera stays below ceiling and inside walls even at max zoom/pitch
{const cam2=new THREE.PerspectiveCamera(),bounds={minX:13.43,maxX:24.57,minY:.515,maxY:3.215,minZ:-18.07,maxZ:-8.93};
 const clampUpdate=createIndoorCamera(cam2,[],{bounds,maxDistance:5.5,minDistance:2.2});
 const p2={position:new THREE.Vector3(19,.165,-16)};
 for(let i=0;i<60;i++)clampUpdate(p2,Math.PI,.85,12,.05);
 assert(cam2.position.y<=bounds.maxY+1e-6&&cam2.position.y>=bounds.minY-1e-6,`camera Y clamped inside ceiling (${cam2.position.y.toFixed(3)})`);
 assert(cam2.position.z>=bounds.minZ-1e-6&&cam2.position.z<=bounds.maxZ+1e-6,`camera Z clamped inside walls (${cam2.position.z.toFixed(3)})`);
 assert(cam2.position.x>=bounds.minX-1e-6&&cam2.position.x<=bounds.maxX+1e-6,`camera X clamped inside walls (${cam2.position.x.toFixed(3)})`);}
console.log('Indoor camera: the walls between the camera and you fade on the upper floor too, the far wall stays, and bounded shop rooms clamp inside walls and ceiling.');