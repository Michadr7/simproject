import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {CARRY,CARRY_DIR,CARRY_POLE,CHOP_TIMING,chopPose} from '../dist/chop-path.js';
import {createCharacter,loadCharacterAssets} from '../dist/character.js';
import {createHeldItem} from '../dist/item-models.js';
import {itemById} from '../dist/items.js';
import {outfit,OUTFITS} from '../dist/appearance.js';

// ── The swing path ────────────────────────────────────────────────────────────
const samples=[];for(let i=0;i<=400;i++)samples.push({p:i/400,...(()=>{const o=chopPose(i/400,{point:new T.Vector3(),lean:0,twoHand:0});return {point:o.point.clone(),lean:o.lean,twoHand:o.twoHand}})()});
assert(samples[0].point.distanceTo(CARRY)<1e-6&&samples.at(-1).point.distanceTo(CARRY)<1e-6,'starts and ends at the carry pose');
assert(samples[0].lean===0&&Math.abs(samples.at(-1).lean)<1e-9,'no lean at rest');assert(samples.every(s=>s.twoHand===1),'both hands stay on the handle the whole way');
// Continuous: no jump between neighbouring samples (the old path had snaps between segments).
let biggest=0;for(let i=1;i<samples.length;i++)biggest=Math.max(biggest,samples[i].point.distanceTo(samples[i-1].point));assert(biggest<.06,'largest step '+biggest);
// Rises to overhead, then comes down fast: the hand is quickest just before impact.
const speed=i=>samples[i].point.distanceTo(samples[i-1].point);
const peak=samples.reduce((a,b)=>b.point.y>a.point.y?b:a);assert(Math.abs(peak.p-CHOP_TIMING.windUp)<.03&&peak.point.y>1.9,'overhead at the end of the wind-up');
let fastest=1;for(let i=2;i<samples.length;i++)if(speed(i)>speed(fastest))fastest=i;assert(samples[fastest].p>CHOP_TIMING.windUp&&samples[fastest].p<=CHOP_TIMING.impact+.01,'fastest during the strike: '+samples[fastest].p);
const impact=chopPose(CHOP_TIMING.impact).point;assert(impact.z>.45&&impact.y<1.3,'the blow lands in front of and below the shoulder');
// Never behind the body, always on the right side.
for(const s of samples){assert(s.point.z>-.3,'stays in front of the back: '+s.point.z);assert(s.point.x<-.05,'right side');}
// Leans back to wind up, forward on the blow, and holds still at impact.
assert(Math.min(...samples.map(s=>s.lean))<-.1&&Math.max(...samples.map(s=>s.lean))>.3);assert.equal(chopPose(CHOP_TIMING.impact+.01).lean,chopPose(CHOP_TIMING.hold-.01).lean,'holds at impact');
// ── The character performs it ─────────────────────────────────────────────────
await loadCharacterAssets();
const axe=()=>createHeldItem(itemById('axe')),longAxis=(c,item)=>{item.updateMatrixWorld(true);return new T.Vector3(0,0,1).applyQuaternion(item.getWorldQuaternion(new T.Quaternion()))};
for(const body of ['male','female']){
 const c=createCharacter(outfit(body,OUTFITS[body][0][0])),item=axe();c.group.position.set(2,0,3);c.group.rotation.y=.8;c.hold(item,{axis:'z',curl:1});
 // Carried head-up: the long axis points along CARRY_DIR (in the character's space) once the alignment has settled.
 c.alignHeld(CARRY_DIR);c.reach('R',CARRY,1,CARRY_POLE);for(let i=0;i<10;i++)c.update(.1);
 const carryDir=longAxis(c,item).applyQuaternion(c.group.getWorldQuaternion(new T.Quaternion()).invert());
 assert(carryDir.angleTo(CARRY_DIR)<.12,`${body}: carried along CARRY_DIR (${carryDir.angleTo(CARRY_DIR).toFixed(2)} rad)`);assert(carryDir.x>.5&&carryDir.y>.45,'carried across the chest: head up and toward the left shoulder');
 // Both hands are on the handle while it is carried: the left wrist sits on the shaft and the elbows are bent, not locked.
 c.setTwoHanded(1);for(let i=0;i<6;i++)c.update(.05);c.group.updateMatrixWorld(true);
 {const w=n=>{const v=new T.Vector3();c.bone(n).getWorldPosition(v);return v},left=w('WristL'),butt=item.localToWorld(new T.Vector3(0,0,-.07)),headPoint=item.localToWorld(new T.Vector3(0,0,.58)),ab=headPoint.clone().sub(butt),t=Math.max(0,Math.min(1,left.clone().sub(butt).dot(ab)/ab.lengthSq())),off=butt.clone().addScaledVector(ab,t).distanceTo(left);
  assert(off<.07,`${body}: the left hand is on the shaft while carrying (${off.toFixed(3)} m off)`);
  const bend=a=>{const S=w('UpperArm'+a),E=w('LowerArm'+a),W=w('Wrist'+a);return Math.acos(E.clone().sub(S).normalize().dot(W.clone().sub(E).normalize()))*57.2958};assert(bend('R')>40&&bend('R')<120&&bend('L')>40&&bend('L')<120,`${body}: relaxed elbows (${bend('R').toFixed(0)}, ${bend('L').toFixed(0)} degrees)`);
  const faceGap=headPoint.distanceTo(w('Head').add(new T.Vector3(0,.1,0)));assert(faceGap>.3,`${body}: the axe head stays clear of the head (${faceGap.toFixed(2)} m)`)}
 // Both hands close around the handle: the fingers are well away from the relaxed idle fingers.
 {const rest=createCharacter(outfit(body,OUTFITS[body][0][0]));rest.update(.05);for(const side of ['R','L'])for(const name of ['Index2','Middle2','Ring2']){const angle=c.bone(name+side).quaternion.angleTo(rest.bone(name+side).quaternion);assert(angle>.5,`${body}: ${name}${side} curls around the handle (${angle.toFixed(2)} rad)`)}}
 // Released, it follows the forearm again.
 c.alignHeld(null);for(let i=0;i<10;i++)c.update(.1);const wrist=new T.Vector3(),elbow=new T.Vector3();c.bone('WristR').getWorldPosition(wrist);c.bone('LowerArmR').getWorldPosition(elbow);
 assert(longAxis(c,item).angleTo(wrist.sub(elbow).normalize())<.15,'follows the forearm when not aligned');
 // Mid-swing: the left hand is on the handle, and leaning moves the head forward.
 const head=()=>{c.group.updateMatrixWorld(true);const v=new T.Vector3();c.bone('Head').getWorldPosition(v);return c.group.worldToLocal(v)};
 c.reach('R',chopPose(.55).point,1,CARRY_POLE);c.setTwoHanded(1);c.setLean(0);for(let i=0;i<4;i++)c.update(.05);const upright=head();
 const pose=chopPose(.55);c.reach('R',pose.point,1,CARRY_POLE);c.setLean(pose.lean);for(let i=0;i<4;i++)c.update(.05);
 assert(head().z-upright.z>.08,`${body}: leaning moves the head forward (${(head().z-upright.z).toFixed(2)} m)`);
 c.group.updateMatrixWorld(true);const left=new T.Vector3(),right=new T.Vector3();c.bone('WristL').getWorldPosition(left);c.bone('WristR').getWorldPosition(right);
 const along=longAxis(c,item),toLeft=left.clone().sub(right),offLine=toLeft.clone().sub(along.clone().multiplyScalar(toLeft.dot(along))).length();
 assert(offLine<.12,`${body}: left hand is on the handle (${offLine.toFixed(2)} m off the line)`);assert(toLeft.length()>.04&&toLeft.length()<.5,'both hands on the handle, within a forearm of each other: '+toLeft.length().toFixed(2));
 // Letting go returns both arms and the spine to the animation.
 c.setTwoHanded(0);c.setLean(0);c.reach('R',CARRY,0);c.alignHeld(null);const control=createCharacter(outfit(body,OUTFITS[body][0][0]));c.release();for(let i=0;i<3;i++){c.update(.05);control.update(.05)}
 assert(c.bone('Torso').quaternion.angleTo(control.bone('Torso').quaternion)<.05&&c.bone('UpperArmL').quaternion.angleTo(control.bone('UpperArmL').quaternion)<.05,'spine and left arm back in the animation pose');
 assert(['Index2R','Middle2L','Ring2R','Thumb2L'].every(n=>c.bone(n).quaternion.angleTo(control.bone(n).quaternion)<.05),`${body}: fingers open again once the tool is released`);
}
console.log('Swing path (continuous, overhead then a fast blow, in front of the body, leaning), carry alignment, two-handed grip and spine lean passed.');
