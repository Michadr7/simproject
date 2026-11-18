// The chainsaw bucking pose (chop-path.js sawPose, sawStand, owner 2026-11-18): deterministic by elapsed time, frame-rate independent, continuous at the start,
// the end and on a cancel, the bar point on the trunk's cut line while it cuts, bounded values, the stand spot beside the trunk, and the real rig reaching it.
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {sawPose,sawStand,sawCutting,SAW_CARRY,SAW_DIR,SAW_STAND,SAW_CUT_X,SAW_REACH,SAW_TIMING,SAW_CUT,SAW_VIBRATION} from '../dist/chop-path.js';
import {TRUNK_RADIUS} from '../dist/sawmill-pile.js';
import {BUCK_SECONDS} from '../dist/tools.js';
import {createCharacter,loadCharacterAssets} from '../dist/character.js';
import {createHeldItem} from '../dist/item-models.js';
import {itemById} from '../dist/items.js';
import {outfit,OUTFITS} from '../dist/appearance.js';

const snap=p=>({point:p.point.clone(),dir:p.dir.clone(),bar:p.bar.clone(),lean:p.lean,crouch:p.crouch,step:p.step,cutting:p.cutting,done:p.done,twoHand:p.twoHand});
const pose=(t,total,rel)=>snap(sawPose(t,total,rel));
const gap=(a,b)=>Math.max(a.point.distanceTo(b.point),a.dir.distanceTo(b.dir),Math.abs(a.lean-b.lean),Math.abs(a.crouch-b.crouch),Math.abs(a.step-b.step));
for(const total of Object.values(BUCK_SECONDS)){ // 1.2 s (chainsaw) and 0.8 s (logging chainsaw)
 const a=SAW_TIMING.approach*total;
 // starts and ends at the carry: hand, bar direction, no lean, no crouch, no step
 {const p=pose(0,total);assert(p.point.distanceTo(SAW_CARRY)<1e-9&&p.dir.distanceTo(SAW_DIR)<1e-9&&p.lean===0&&p.crouch===0&&p.step===0&&!p.cutting,'starts at the carry')}
 {const p=pose(total+SAW_TIMING.recoil,total,total);assert(p.point.distanceTo(SAW_CARRY)<1e-9&&p.dir.distanceTo(SAW_DIR)<1e-9&&Math.abs(p.lean)<1e-12&&Math.abs(p.crouch)<1e-12&&p.done,'back at the carry after the recoil')}
 // deterministic: the same time gives the same pose (a fresh out object or a reused one)
 {const out=sawPose(0,total);for(const t of [.05,a,total*.7,total]){sawPose(t,total,-1,out);const b=pose(t,total);assert(snap(out).point.equals(b.point)&&snap(out).dir.equals(b.dir),'deterministic at '+t)}}
 // frame-rate independent: accumulate the hold at 30, 60 and 144 Hz as the game does (elapsed += dt) and compare at moments every rate lands on (multiples of 1/6 s)
 for(const at of [1/6,2/6,4/6]){const ps=[30,60,144].map(hz=>{let e=0;const dt=1/hz,n=Math.round(at*hz);for(let i=0;i<n;i++)e+=dt;return pose(e,total)});
  assert(gap(ps[0],ps[1])<1e-6&&gap(ps[1],ps[2])<1e-6,'30/60/144 Hz agree at '+at.toFixed(3)+' s')}
 // continuous: small steps everywhere while holding, through the completion and its recoil, and through a cancel at several moments
 const run=(rel,end)=>{let biggest=0,prev=pose(0,total,rel);for(let t=1/1000;t<=end;t+=1/1000){const p=pose(t,total,rel);biggest=Math.max(biggest,gap(p,prev));prev=p}return biggest};
 assert(run(-1,total)<.03,'no jump while holding: '+run(-1,total).toFixed(4));
 assert(run(total,total+SAW_TIMING.recoil+.1)<.03,'no jump at the completion and the recoil');
 for(const cancel of [a*.4,a,a+(total-a)*.5,total*.99]){assert(run(cancel,cancel+SAW_TIMING.recoil+.1)<.03,'no jump on a cancel at '+cancel.toFixed(2));
  const before=pose(cancel-1e-6,total),after=pose(cancel+1e-6,total,cancel);assert(gap(before,after)<1e-3,'the cancel starts where the hold was');assert(!after.cutting,'letting go stops the cut')}
 // the recoil lifts the hands above the straight line back to the carry
 {const end=pose(total,total,total),mid=pose(total+SAW_TIMING.recoil/2,total,total);assert(mid.point.y>(end.point.y+SAW_CARRY.y)/2+SAW_TIMING.lift*.8,'a recoil lift')}
 // cutting is true exactly while the bar is in the wood (after the approach, before the end)
 for(let t=0;t<total;t+=total/97){const p=pose(t,total);assert.equal(p.cutting,t>=a,'cutting at '+t.toFixed(3));assert.equal(sawCutting(t,total),p.cutting)}
 assert(!pose(total,total).cutting&&!pose(total+.1,total,total).cutting,'not after the cut');
 // the bar point stays on the trunk's cut line during the cut and goes from the top of the trunk down through it; the hand is the bar point minus the reach along the bar
 let lastY=Infinity;for(let t=a;t<=total;t+=total/200){const p=sawPose(t,total);
  assert(Math.abs(p.bar.x-SAW_CUT_X)<1e-9&&Math.abs(p.bar.z-SAW_STAND)<1e-9,'on the cut line at '+t.toFixed(3));assert(p.bar.y<=lastY+1e-9,'only goes down');lastY=p.bar.y;
  assert(p.bar.y<=2*TRUNK_RADIUS+.03&&p.bar.y>=SAW_CUT.bottom-1e-9,'within the trunk: '+p.bar.y.toFixed(3));
  const vib=SAW_VIBRATION.amp*1.5;assert(Math.abs(p.point.clone().addScaledVector(p.dir,SAW_REACH).distanceTo(p.bar))<vib,'the hand holds the saw behind the bar point');
  assert(p.dir.z>0&&p.dir.y<0,'the bar points forward and down, away from the player')}
 assert(sawPose(a,total).bar.y>=2*TRUNK_RADIUS,'the cut starts on top of the trunk');assert(sawPose(total,total).bar.y<.1,'and ends through it');
 // bounded: finite, unit bar direction, lean and crouch in range, the hand in front of the body and within reach height
 for(let t=-1;t<total+1;t+=.0137)for(const rel of [-1,total*.5,total]){const p=sawPose(t,total,rel);
  for(const v of [p.point.x,p.point.y,p.point.z,p.dir.x,p.dir.y,p.dir.z,p.lean,p.crouch,p.step])assert(Number.isFinite(v));
  assert(Math.abs(p.dir.length()-1)<1e-9&&p.lean>=-1e-12&&p.lean<=SAW_CUT.lean1+1e-9&&p.crouch>=-1e-12&&p.crouch<=SAW_CUT.crouch1+1e-9&&p.step>=0&&p.step<=1);
  assert(p.point.z>.1&&p.point.z<.6&&p.point.y>.3&&p.point.y<SAW_CARRY.y+SAW_TIMING.lift+.01&&Math.abs(p.point.x)<.25,'the hands stay in front of the body: '+p.point.toArray().map(x=>x.toFixed(2)))}
 // the vibration: a few millimetres, 40-60 Hz, only while the saw runs in the cut (none at the carry before or after)
 {const t=a+(total-a)*.5;let most=0;for(let k=0;k<200;k++){const p=sawPose(t+k/4000,total);most=Math.max(most,Math.abs(p.point.y-(p.bar.y-p.dir.y*SAW_REACH)))}assert(most>.002&&most<=SAW_VIBRATION.amp+1e-9,'the hands shake by a few mm: '+most.toFixed(4));
  assert(SAW_VIBRATION.hzX>=40&&SAW_VIBRATION.hzX<=60&&SAW_VIBRATION.hzY>=40&&SAW_VIBRATION.hzY<=60&&SAW_VIBRATION.amp>=.001&&SAW_VIBRATION.amp<=.005);
  assert(pose(0,total).point.equals(SAW_CARRY),'no vibration at rest')}
}
// garbage in: still a finite pose
for(const [t,tot,rel] of [[NaN,1.2],[1,NaN],[-5,0],[Infinity,1.2,0]]){const p=sawPose(t,tot,rel);assert([p.point.x,p.point.y,p.point.z,p.lean].every(Number.isFinite),'finite for '+[t,tot,rel])}
// the stand spot: beside the trunk's middle on your own side, facing across it, the middle landing on the cut line in character space
for(const rot of [0,.7,Math.PI/2,2.5,-1.2])for(const [px,pz] of [[3,1],[-2,-2],[.4,2.5],[0,0]]){
 const tx=10,tz=-4,s=sawStand(tx,tz,rot,tx+px,tz+pz),fx=Math.sin(s.yaw),fz=Math.cos(s.yaw),cx=Math.cos(s.yaw),cz=-Math.sin(s.yaw),rx=tx-s.x,rz=tz-s.z;
 assert(Math.abs(rx*cx+rz*cz-SAW_CUT_X)<1e-9&&Math.abs(rx*fx+rz*fz-SAW_STAND)<1e-9,'the trunk middle at the cut point');
 assert(Math.abs(fx*-Math.cos(rot)+fz*Math.sin(rot))<1e-9,'facing across the trunk');
 const side=v=>(v[0]-tx)*Math.sin(rot)+(v[1]-tz)*Math.cos(rot);if(Math.abs(side([tx+px,tz+pz]))>.01)assert(Math.sign(side([s.x,s.z]))===Math.sign(side([tx+px,tz+pz])),'stays on the side you came from')}
// the real rig: the wrist reaches the pose and the saw's bar point lands within 3 cm of the cut line, both bodies, through the cut
await loadCharacterAssets();
for(const body of ['male','female']){
 const c=createCharacter(outfit(body,OUTFITS[body][0][0])),saw=createHeldItem(itemById('chainsaw'));c.hold(saw,{axis:'z',grip:0,curl:1});c.group.position.set(4,0,-2);c.group.rotation.y=1.1;
 const wrist=new T.Vector3(),local=v=>c.group.worldToLocal(v);
 for(const t of [0,.5,.9,1.2]){const p=sawPose(t,1.2);c.reach('R',p.point,1);c.alignHeld(p.dir);c.setLean(p.lean);c.setCrouch(p.crouch);c.setTwoHanded(1);for(let i=0;i<20;i++)c.update(.05);c.group.updateMatrixWorld(true);
  c.bone('WristR').getWorldPosition(wrist);assert(local(wrist).distanceTo(p.point)<.01,`${body}: the wrist reaches the pose at ${t} s`);
  if(t>=.5){const bar=local(saw.localToWorld(new T.Vector3(0,0,SAW_REACH-.045)));assert(bar.distanceTo(p.bar)<.03,`${body}: the saw's bar is on the cut line at ${t} s (${bar.distanceTo(p.bar).toFixed(3)} m)`)}}
 // carried: both hands on the saw (the left wrist on the bar's line)
 c.reach('R',SAW_CARRY,1);c.alignHeld(SAW_DIR);c.setLean(0);c.setCrouch(0);for(let i=0;i<20;i++)c.update(.05);c.group.updateMatrixWorld(true);
 {const L=new T.Vector3();c.bone('WristL').getWorldPosition(L);const a0=saw.localToWorld(new T.Vector3()),ab=saw.localToWorld(new T.Vector3(0,0,.3)).sub(a0),k=L.clone().sub(a0).dot(ab)/ab.lengthSq();assert(a0.clone().addScaledVector(ab,k).distanceTo(L)<.04,`${body}: the left hand is on the saw while carried`)}
}
console.log('PASS chainsaw-pose.mjs: the chainsaw bucking pose (both saws) starts and ends at the two-handed carry, is the same at 30/60/144 Hz and for the same time, has no jump at the start, the end or a cancel, cuts only after the approach, keeps the bar point on the trunk\'s cut line from its top down through it, recoils with a lift, vibrates a few mm at 47/53 Hz, stays bounded; the stand spot faces across the trunk on your side; the real rig reaches it with the bar within 3 cm of the line.');
