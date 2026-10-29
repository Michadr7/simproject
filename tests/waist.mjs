import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {loadCharacterAssets,createCharacter} from '../dist/character.js';
import {outfit,OUTFITS} from '../dist/appearance.js';

// The waist is the skeleton's spine now (the old test looked for a primitive "torso" mesh that no longer exists).
await loadCharacterAssets();
for(const body of ['male','female']){
 const c=createCharacter(outfit(body,OUTFITS[body][0][0]));
 const where=name=>{c.group.updateMatrixWorld(true);const v=new T.Vector3();c.bone(name).getWorldPosition(v);return c.group.worldToLocal(v)};
 for(const name of ['Hips','Abdomen','Torso','Chest','Neck','Head'])assert(c.bone(name),`${body}: has a ${name} bone`);
 assert(!c.group.getObjectByName('torso'),`${body}: the primitive torso mesh is gone`);
 // The spine stacks up from the hips to the head.
 const heights=['Hips','Abdomen','Torso','Chest','Neck','Head'].map(n=>where(n).y);
 assert(heights.every((y,i)=>i===0||y>heights[i-1]),`${body}: spine ordered hips to head ${heights.map(v=>v.toFixed(2))}`);
 assert(heights[0]>.85&&heights[0]<1.15&&heights.at(-1)>1.6,`${body}: a waist near 1 m and a head above 1.6 m`);
 // Leaning bends at the waist: the head goes forward, the hips and feet stay put.
 const head0=where('Head'),hips0=where('Hips'),foot0=where('FootR');
 c.setLean(.3);c.update(.05);const head1=where('Head'),hips1=where('Hips'),foot1=where('FootR');
 assert(head1.z-head0.z>.08,`${body}: leaning moves the head forward (${(head1.z-head0.z).toFixed(2)} m)`);
 assert(hips1.distanceTo(hips0)<.01&&foot1.distanceTo(foot0)<.01,`${body}: the hips and feet stay where they are`);
 c.setLean(-.3);c.update(.05);assert(where('Head').z<head0.z-.05,`${body}: leaning back moves it back`);
 c.setLean(0);c.update(.05);assert(where('Head').distanceTo(head0)<.01,`${body}: leaning back to zero restores the pose`);
 // Sitting swings the thighs forward from the hips (the knees come up and out in front of the body) while the hips stay put.
 const hipsBefore=where('Hips'),kneeBefore=where('LowerLegR');c.setSeated(true);c.update(.05);const knee=where('LowerLegR');
 assert(knee.z-kneeBefore.z>.25&&knee.y-kneeBefore.y>.3,`${body}: sitting raises and advances the knees (${(knee.z-kneeBefore.z).toFixed(2)} m forward, ${(knee.y-kneeBefore.y).toFixed(2)} m up)`);assert(where('Hips').distanceTo(hipsBefore)<.02,`${body}: the hips stay put`);
}
console.log('Skeletal waist: spine order and height, lean at the waist (both ways), no primitive torso, and seated thighs passed.');
