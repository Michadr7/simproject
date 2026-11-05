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
// the storey above is not drawn while you are downstairs, and is when you go up\nassert(room.scene.getObjectByName('floor-1').visible===false&&room.scene.getObjectByName('floor-0').visible===true,'downstairs: the upper floor is hidden');\nroom.setFloor(1);assert(room.scene.getObjectByName('floor-1').visible&&room.scene.getObjectByName('floor-0').visible,'upstairs: both floors are drawn');room.setFloor(0);assert(!room.scene.getObjectByName('floor-1').visible);\nconsole.log('Indoor camera: the walls between the camera and you fade on the upper floor too, the far wall stays.');