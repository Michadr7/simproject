import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {CARRY,CARRY_DIR,CARRY_POLE,CHOP_TIMING,GRIP,CARRY_GRIP,CHOKE,carryGrip,chopPose} from '../dist/chop-path.js';
import {createCharacter,loadCharacterAssets} from '../dist/character.js';
import {createHeldItem} from '../dist/item-models.js';
import {itemById} from '../dist/items.js';
import {outfit,OUTFITS} from '../dist/appearance.js';
import {AXES as AXE_MESHES} from '../dist/axe-assets.js';

// ── The swing path ────────────────────────────────────────────────────────────
const samples=[];for(let i=0;i<=400;i++)samples.push({p:i/400,...(()=>{const o=chopPose(i/400,{point:new T.Vector3(),lean:0,twoHand:0});return {point:o.point.clone(),lean:o.lean,twoHand:o.twoHand,grip:o.grip,align:o.align}})()});
assert(samples[0].point.distanceTo(CARRY)<1e-6&&samples.at(-1).point.distanceTo(CARRY)<1e-6,'starts and ends at the carry pose');
assert(samples[0].lean===0&&Math.abs(samples.at(-1).lean)<1e-9,'no lean at rest');
// Re-pinned (owner 2026-11-18, trail carry): ONE hand carries it, choked up under the head; the left hand joins by half the wind-up, the right hand slides down to the
// swing grip, both stay on through the blow, and the recovery hands it back to the one-handed carry. (Before: both hands on the handle the whole way.)
assert(samples[0].twoHand===0&&Math.abs(samples.at(-1).twoHand)<1e-9&&samples[0].grip===CARRY_GRIP&&Math.abs(samples.at(-1).grip-CARRY_GRIP)<1e-9,'one hand, choked up, at both ends');
assert(samples.filter(s=>s.p>=CHOP_TIMING.windUp/2&&s.p<=CHOP_TIMING.hold).every(s=>s.twoHand===1&&s.grip===GRIP),'both hands on the handle at the swing grip from half the wind-up through the blow');
assert(samples.every(s=>s.twoHand>=0&&s.twoHand<=1&&s.grip>=GRIP-1e-9&&s.grip<=CARRY_GRIP+1e-9));
{let jump=0;for(let i=1;i<samples.length;i++)jump=Math.max(jump,Math.abs(samples[i].twoHand-samples[i-1].twoHand),Math.abs(samples[i].grip-samples[i-1].grip)/CARRY_GRIP);assert(jump<.06,'the hand joins and the grip slides without a snap: '+jump.toFixed(3))}
assert(samples[0].align===1&&samples.at(-1).align===1&&samples.some(s=>s.align===0),'carry alignment at the ends, the forearm leads the swing');
assert.equal(carryGrip(.65),.45);assert(Math.abs(carryGrip(AXE_MESHES['steel-axe'].bounds[5])-(AXE_MESHES['steel-axe'].bounds[5]-CHOKE))<1e-9);assert.equal(carryGrip(.1),GRIP,'never below the swing grip');assert.equal(carryGrip(undefined),CARRY_GRIP);
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
 // The grip is where along the handle the hand holds it: game.js and npc-crowd.js slide the axe mesh inside its held group by -grip (the hand holds the group's origin).
 const c=createCharacter(outfit(body,OUTFITS[body][0][0])),item=axe();c.group.position.set(2,0,3);c.group.rotation.y=.8;item.children[0].position.z=-CARRY_GRIP;c.hold(item,{axis:'z',curl:1});
 const w=n=>{const v=new T.Vector3();c.bone(n).getWorldPosition(v);return v},toLocal=v=>c.group.worldToLocal(v.clone());
 // Trail carry (re-pinned, owner 2026-11-18; was a two-handed carry across the chest): the long axis points along CARRY_DIR (in the character's space) once the alignment has settled,
 // the right hand hangs at the side choked up under the head, the head is in front of the hand with its edge down, the handle trails behind, the left hand is free.
 c.alignHeld(CARRY_DIR);c.reach('R',CARRY,1,CARRY_POLE);c.setTwoHanded(0);for(let i=0;i<10;i++)c.update(.1);c.group.updateMatrixWorld(true);
 const carryDir=longAxis(c,item).applyQuaternion(c.group.getWorldQuaternion(new T.Quaternion()).invert());
 assert(carryDir.angleTo(CARRY_DIR)<.12,`${body}: carried along CARRY_DIR (${carryDir.angleTo(CARRY_DIR).toFixed(2)} rad)`);assert(carryDir.z>.9&&carryDir.y>0&&carryDir.y<.4,'the head forward and a little up, the handle trailing behind');
 {const at=z=>toLocal(item.localToWorld(new T.Vector3(0,0,z-CARRY_GRIP))),butt=at(-.07),headPoint=at(.58),hand=toLocal(w('WristR')),edge=new T.Vector3(0,-1,0).applyQuaternion(item.getWorldQuaternion(new T.Quaternion())).applyQuaternion(c.group.getWorldQuaternion(new T.Quaternion()).invert());
  assert(hand.x<-.18&&hand.y<1.15&&hand.y>.95,`${body}: the right hand hangs at the right side (${hand.toArray().map(v=>v.toFixed(2))})`);
  assert(hand.distanceTo(headPoint)<.3,`${body}: choked up just below the head (${hand.distanceTo(headPoint).toFixed(2)} m)`);assert(headPoint.z>hand.z&&butt.z<-.2,'the head ahead of the hand, the butt behind the hip');
  assert(edge.y<-.9,`${body}: the edge points down (${edge.y.toFixed(2)})`);
  const faceGap=headPoint.distanceTo(toLocal(w('Head')).add(new T.Vector3(0,.1,0)));assert(faceGap>.5,`${body}: the axe head is far from the face (${faceGap.toFixed(2)} m)`);
  const bend=a=>{const S=w('UpperArm'+a),E=w('LowerArm'+a),W=w('Wrist'+a);return Math.acos(E.clone().sub(S).normalize().dot(W.clone().sub(E).normalize()))*57.2958};assert(bend('R')<60,`${body}: a relaxed arm at the side (${bend('R').toFixed(0)} degrees)`);
  const left=w('WristL'),b=item.localToWorld(new T.Vector3(0,0,-.07-CARRY_GRIP)),ab=item.localToWorld(new T.Vector3(0,0,.58-CARRY_GRIP)).sub(b),t=Math.max(0,Math.min(1,left.clone().sub(b).dot(ab)/ab.lengthSq()));assert(b.clone().addScaledVector(ab,t).distanceTo(left)>.15,`${body}: the left hand is free`)}
 // The right hand closes around the handle: its fingers are well away from the relaxed idle fingers.
 {const rest=createCharacter(outfit(body,OUTFITS[body][0][0]));rest.update(.05);for(const name of ['Index2','Middle2','Ring2']){const angle=c.bone(name+'R').quaternion.angleTo(rest.bone(name+'R').quaternion);assert(angle>.5,`${body}: ${name}R curls around the handle (${angle.toFixed(2)} rad)`)}}
 // Released, it follows the forearm again.
 c.alignHeld(null);for(let i=0;i<10;i++)c.update(.1);const wrist=new T.Vector3(),elbow=new T.Vector3();c.bone('WristR').getWorldPosition(wrist);c.bone('LowerArmR').getWorldPosition(elbow);
 assert(longAxis(c,item).angleTo(wrist.sub(elbow).normalize())<.15,'follows the forearm when not aligned');
 // Mid-swing (the swing grip): the left hand is on the handle, both hands close around it, and leaning moves the head forward.
 item.children[0].position.z=-GRIP;
 const head=()=>{c.group.updateMatrixWorld(true);const v=new T.Vector3();c.bone('Head').getWorldPosition(v);return c.group.worldToLocal(v)};
 c.reach('R',chopPose(.55).point,1,CARRY_POLE);c.setTwoHanded(1);c.setLean(0);for(let i=0;i<4;i++)c.update(.05);const upright=head();
 const pose=chopPose(.55);c.reach('R',pose.point,1,CARRY_POLE);c.setLean(pose.lean);c.setTwoHanded(pose.twoHand);for(let i=0;i<4;i++)c.update(.05);
 assert(head().z-upright.z>.08,`${body}: leaning moves the head forward (${(head().z-upright.z).toFixed(2)} m)`);
 c.group.updateMatrixWorld(true);const left=new T.Vector3(),right=new T.Vector3();c.bone('WristL').getWorldPosition(left);c.bone('WristR').getWorldPosition(right);
 const along=longAxis(c,item),toLeft=left.clone().sub(right),offLine=toLeft.clone().sub(along.clone().multiplyScalar(toLeft.dot(along))).length();
 assert(offLine<.12,`${body}: left hand is on the handle (${offLine.toFixed(2)} m off the line)`);assert(toLeft.length()>.04&&toLeft.length()<.5,'both hands on the handle, within a forearm of each other: '+toLeft.length().toFixed(2));
 {const rest=createCharacter(outfit(body,OUTFITS[body][0][0]));rest.update(.05);for(const side of ['R','L'])for(const name of ['Index2','Middle2','Ring2']){const angle=c.bone(name+side).quaternion.angleTo(rest.bone(name+side).quaternion);assert(angle>.5,`${body}: ${name}${side} curls around the handle mid-swing (${angle.toFixed(2)} rad)`)}}
 // Letting go returns both arms and the spine to the animation.
 c.setTwoHanded(0);c.setLean(0);c.reach('R',CARRY,0);c.alignHeld(null);const control=createCharacter(outfit(body,OUTFITS[body][0][0]));c.release();for(let i=0;i<3;i++){c.update(.05);control.update(.05)}
 assert(c.bone('Torso').quaternion.angleTo(control.bone('Torso').quaternion)<.05&&c.bone('UpperArmL').quaternion.angleTo(control.bone('UpperArmL').quaternion)<.05,'spine and left arm back in the animation pose');
 assert(['Index2R','Middle2L','Ring2R','Thumb2L'].every(n=>c.bone(n).quaternion.angleTo(control.bone(n).quaternion)<.05),`${body}: fingers open again once the tool is released`);
}
console.log('Swing path (continuous, overhead then a fast blow, in front of the body, leaning; the left hand joins and the grip slides down during the wind-up and back in the recovery), the one-handed trail carry (choked up under the head, edge down, arm at the side, left hand free), two-handed grip mid-swing and spine lean passed.');
