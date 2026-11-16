// G2c (notes/handoff.md): the held box sits at the belly with its back on the sweater and both hands on its sides (dist/carry-pose.js), checked on the real rig, plus when the pose applies.
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {loadCharacterAssets,createCharacter} from '../dist/character.js';
import {outfit,OUTFITS} from '../dist/appearance.js';
import {createProp} from '../dist/props.js';
import {boxPose,freshBoxPose,poseFor,TORSO_FRONT,BACK_GAP,BOX_CENTRE_Y,HAND_OUT,BOX_POLES} from '../dist/carry-pose.js';
import {PARCEL_MODELS} from '../dist/gig-parcel.js';

// ---- pure numbers, both carton sizes ----
const sizes={};
for(const id of PARCEL_MODELS.small.concat(PARCEL_MODELS.large)){const m=createProp(id,{apply:x=>x});m.geometry.computeBoundingBox();sizes[id]=m.geometry.boundingBox.getSize(new T.Vector3())}
for(const [id,s] of Object.entries(sizes)){
 const p=boxPose(s,0);
 assert(Math.abs(p.box.y+s.y/2-BOX_CENTRE_Y)<1e-9,`${id}: the box's centre is at belly height`);
 assert(Math.abs((p.box.z-s.z/2)-(TORSO_FRONT+BACK_GAP))<1e-9,`${id}: the back face touches the sweater`);
 assert(p.R.x<0&&p.L.x>0&&Math.abs(p.R.x+p.L.x)<1e-9,`${id}: the right hand is on the right side (negative x) and the left on the left`);
 assert(Math.abs(p.L.x-(s.x/2+HAND_OUT))<1e-9&&p.L.y===BOX_CENTRE_Y&&Math.abs(p.L.z-p.box.z)<1e-9,`${id}: each palm is level with the box's centre, just outside its side`);
 const b=boxPose(s,1);assert(b.box.y<p.box.y-.5&&b.box.z>p.box.z+.25&&b.R.y<p.R.y-.5,`${id}: stooping lowers and pushes out the box and hands together`);
}
const o=freshBoxPose(),again=boxPose(sizes['prop.carton-small'],0,o);assert.equal(again,o,'an out object is reused (no allocation)');
assert.doesNotThrow(()=>boxPose(null,NaN),'bad input falls back to a small box');
assert(BOX_POLES.R.x<0&&BOX_POLES.L.x>0&&BOX_POLES.R.y<0,'the elbows point out and down');
// ---- when the pose applies ----
assert.equal(poseFor({carry:null},{parcelInHands:true}),'box','the gig box in the hands');
assert.equal(poseFor({carry:null},{parcelInHands:false}),null,'nothing carried, no pose (box put down, delivered, gig over)');
assert.equal(poseFor({carry:null},{parcelInHands:true,seated:true}),null,'a vehicle seat releases the pose');
assert.equal(poseFor({carry:null,equipped:'axe'},{parcelInHands:true}),null,'a tool in the hand keeps its own arm pose');assert.equal(poseFor({carry:{kind:'planks',count:2}},{}),'planks');assert.equal(poseFor({carry:{kind:'log'}},{}),'log');
assert.equal(poseFor({carry:{kind:'log'}},{freeArms:false}),null,'indoors the log and plank poses stay off, as before');
assert.equal(poseFor({carry:{kind:'log'}},{seated:true}),null);
assert.equal(poseFor({carry:{kind:'log'}},{parcelInHands:true}),'log','a log in the hands is never the box pose');

// ---- the real rig: the hands reach the box's sides and the elbows bend ----
await loadCharacterAssets();
for(const body of ['male','female']){
 const c=createCharacter(outfit(body,OUTFITS[body][0][0]));
 const where=n=>{c.group.updateMatrixWorld(true);const v=new T.Vector3();c.bone(n).getWorldPosition(v);return c.group.worldToLocal(v)};
 for(const id of ['prop.carton-small','prop.carton-medium']){
  const p=boxPose(sizes[id],0);
  c.update(.05);const idle=where('WristR').clone();
  c.reach('R',new T.Vector3(p.R.x,p.R.y,p.R.z),1,new T.Vector3(BOX_POLES.R.x,BOX_POLES.R.y,BOX_POLES.R.z));c.reach('L',new T.Vector3(p.L.x,p.L.y,p.L.z),1,new T.Vector3(BOX_POLES.L.x,BOX_POLES.L.y,BOX_POLES.L.z));c.update(.05);
  const wr=where('WristR'),wl=where('WristL'),er=where('LowerArmR'),el=where('LowerArmL'),sh=where('UpperArmR');
  console.log(`  ${body} ${id}: wrist R ${wr.toArray().map(v=>v.toFixed(2))} target ${p.R.x.toFixed(2)},${p.R.y.toFixed(2)},${p.R.z.toFixed(2)}; elbow z ${er.z.toFixed(2)} (shoulder z ${sh.z.toFixed(2)})`);
  assert(wr.distanceTo(new T.Vector3(p.R.x,p.R.y,p.R.z))<.14,`${body} ${id}: the right wrist is at the box's right side`);
  assert(wl.distanceTo(new T.Vector3(p.L.x,p.L.y,p.L.z))<.14,`${body} ${id}: the left wrist is at the box's left side`);
  assert(wr.z>idle.z+.05&&wl.z>idle.z+.05,`${body} ${id}: the hands came forward from hanging at the sides`);
  assert(er.z>sh.z-.02&&el.z>sh.z-.02,`${body} ${id}: the elbows are not behind the shoulders`);
  c.clearReach();c.update(.05);assert(where('WristR').distanceTo(idle)<.06,`${body} ${id}: clearing the reach releases the pose`);
 }
}
console.log('Carry pose: the box rests at the belly against the sweater (both cartons), both hands on its sides, bend, the pose rules and release passed.');
