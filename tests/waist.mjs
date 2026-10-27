import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {createCharacter} from '../dist/character.js';
const {group}=createCharacter({});const shirt=group.getObjectByName('torso'),pelvis=group.getObjectByName('pelvis');
const ray=new T.Raycaster();
for(const turn of [-.035,0,.035])for(const y of [.98,1,1.025])for(let angle=.1;angle<Math.PI*2;angle+=.4){
 shirt.rotation.y=turn;group.updateMatrixWorld(true);
 const outward=new T.Vector3(Math.sin(angle),0,Math.cos(angle));
 ray.set(outward.clone().multiplyScalar(1).add(new T.Vector3(0,y,0)),outward.clone().negate());
 const a=ray.intersectObject(shirt)[0],b=ray.intersectObject(pelvis)[0];
 assert(a&&b,'both shirt and trouser top cover the waist');
 assert(b.distance-a.distance>.003,'shirt remains outside trousers while torso turns');
}
console.log('Waist coverage and surface clearance pass through the torso animation range.');
