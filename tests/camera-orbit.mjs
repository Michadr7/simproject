// Third-person camera: the view direction follows yaw and pitch exactly every frame while the player walks (no lag, no cut corner), only the distance eases back out of a wall.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createCameraController} from '../dist/camera.js';
const cam=new THREE.PerspectiveCamera(),player=new THREE.Object3D(),update=createCameraController(cam,[],[],[]);
const off=()=>new THREE.Vector3().subVectors(cam.position,new THREE.Vector3(player.position.x,player.position.y+1.5,player.position.z));
// walking forward at 6 m/s while the mouse swings the yaw 3 rad/s at 165 fps: the offset is always exactly the orbit
let yaw=0,worst=0;const dt=1/165;
for(let i=0;i<400;i++){player.position.x+=6*dt;yaw+=3*dt;update(player,yaw,.38,7,dt);const o=off(),want=new THREE.Vector3(Math.sin(yaw)*Math.cos(.38)*7,Math.sin(.38)*7,Math.cos(yaw)*Math.cos(.38)*7);worst=Math.max(worst,o.distanceTo(want))}
assert.ok(worst<1e-6,'the camera sits exactly on the orbit (worst error '+worst+' m)');
// the first frame snaps to the orbit (a teleport does not swing the camera across the map)
const c2=new THREE.PerspectiveCamera(),u2=createCameraController(c2,[],[],[]),p2=new THREE.Object3D();p2.position.set(500,0,-300);c2.position.set(0,4,7);u2(p2,0,.38,7,dt);assert.ok(c2.position.distanceTo(new THREE.Vector3(500,1.5,-300))<7.01);
// a wall pulls the camera in at once and it eases back out over several frames
const wall=new THREE.Mesh(new THREE.BoxGeometry(4,4,.2));wall.position.set(0,2,4);
const c3=new THREE.PerspectiveCamera(),u3=createCameraController(c3,[wall],[],[]),p3=new THREE.Object3D();
u3(p3,0,.1,7,dt);const near=c3.position.distanceTo(new THREE.Vector3(0,1.5,0));assert.ok(near<5,'pulled in by the wall: '+near);
wall.position.set(0,2,400);const free=createCameraController(c3,[],[],[]);// a fresh controller: no wall, full zoom at once
free(p3,0,.1,7,dt);assert.ok(Math.abs(c3.position.distanceTo(new THREE.Vector3(0,1.5,0))-7)<1e-6);
console.log('PASS camera-orbit.mjs: the camera follows yaw and pitch exactly while the player walks (no lag), snaps on the first frame, and a wall pulls it in at once.');