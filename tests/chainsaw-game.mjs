// STEP 4 in the packaged game: holding E with a chainsaw at a trunk steps the player in beside its middle, facing across it (chop-path.js sawStand), the arms follow
// sawPose (crouched and leaning while the bar is in the wood), chips fly into the sawmill's one sawdust pool (no new Points object), the cut still completes in buckTimeSec,
// and letting go early (or finishing) eases back to the two-handed carry; the axe is carried one-handed at the side (trail carry) between swings.
import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {waitForSawmill} from './support/mock-renderer.mjs';
import {equipTool,addItem} from '../dist/inventory.js';
import {SAW_STAND,SAW_CUT_X,SAW_CARRY,CARRY,CARRY_DIR,sawStand} from '../dist/chop-path.js';
import {MAP} from '../dist/map-definition.js';
import * as THREE from '../dist/vendor/three.module.js';

const SAW=MAP.landmarks.find(l=>l.id==='sawmill'),start={x:SAW.x+14,z:SAW.z-16}; // open ground near the sawmill (its sawdust pool is loaded)
const g=await bootGame({position:start});
try{
 const {GameState,pump,send,scene}=g,p=()=>GameState.progress,me=()=>GameState.me,obj=n=>scene().getObjectByName(n);
 await waitForSawmill(scene());
 const player=()=>obj('player'),local=v=>player().worldToLocal(v.clone()),wrist=()=>{const v=new THREE.Vector3();player().getObjectByName('WristR').getWorldPosition(v);return local(v)};
 const alive=()=>{const pts=[];scene().traverse(o=>{if(o.name==='sawdust')pts.push(o)});assert.equal(pts.length,1,'one sawdust Points object (the sawmill\'s)');const a=pts[0].geometry.attributes.position.array;let n=0;for(let i=1;i<a.length;i+=3)if(a[i]>-50)n++;return n};
 GameState.progress=equipTool(addItem(p(),'chainsaw').state,'chainsaw').state;pump(.6);
 // carried: the hand low in front (SAW_CARRY)
 assert(wrist().distanceTo(SAW_CARRY)<.03,'the chainsaw is carried two-handed in front: '+wrist().toArray().map(v=>v.toFixed(2)));
 const trunk={id:7001,x:me().position.x+1.4,z:me().position.z+.3,rot:.4,t:p().logs?.[0]?.t??0,kind:'trunk'};GameState.progress={...p(),logs:[...(p().logs||[]),trunk],nextLogId:7002};pump(.3);
 const from={x:me().position.x,z:me().position.z},want=sawStand(trunk.x,trunk.z,trunk.rot,from.x,from.z),dust0=alive();
 send('keydown','KeyE');pump(.48); // past the approach (0.336 s of 1.2): stepped in, the bar in the wood
 assert(Math.hypot(me().position.x-want.x,me().position.z-want.z)<.05,'stepped in beside the trunk: '+[me().position.x,me().position.z,want.x,want.z].map(v=>v.toFixed(2)));
 {const rel=local(new THREE.Vector3(trunk.x,player().position.y,trunk.z));assert(Math.abs(rel.x-SAW_CUT_X)<.05&&Math.abs(rel.z-SAW_STAND)<.05,'the trunk\'s middle on the cut line in front: '+rel.toArray().map(v=>v.toFixed(2)))}
 assert(wrist().y<.75,'crouched and leaning, the hands low at the trunk: '+wrist().y.toFixed(2));assert(alive()>dust0,'chips in the sawdust pool');
 pump(1);send('keyup','KeyE');pump(.2);assert(!p().logs.some(l=>l.id===7001),'cut through in buckTimeSec');assert(p().logs.filter(l=>!l.kind).length>=2,'logs where it lay');
 pump(.6);assert(wrist().distanceTo(SAW_CARRY)<.03,'back at the carry after the recoil');
 // letting go early: no cut, and the hands ease back up (no snap: a frame later they are still on the way)
 me().position.x-=6;pump(.3);const t2={...trunk,id:7003,x:me().position.x+1.2,z:me().position.z};GameState.progress={...p(),logs:[...p().logs,t2],nextLogId:7004};pump(.3);
 send('keydown','KeyE');pump(.6);const low=wrist().y;send('keyup','KeyE');pump(.04);const next=wrist().y;
 assert(low<.75,'it was cutting when E was let go: '+low.toFixed(2));assert(p().logs.some(l=>l.id===7003),'let go early: still a trunk');assert(next-low<.25&&next<SAW_CARRY.y-.1,'the recoil eases up, no snap: '+[low,next].map(v=>v.toFixed(2)));
 pump(.8);assert(wrist().distanceTo(SAW_CARRY)<.03,'and settles at the carry: '+wrist().toArray().map(v=>v.toFixed(2))+' low '+low.toFixed(2)+' next '+next.toFixed(2)+' eq '+p().equipped);
 // the axe: the one-handed trail carry at the side
 GameState.progress=equipTool(addItem(p(),'axe').state,'axe').state;pump(1);
 {const axe=player().getObjectByName('held-item'),q=new THREE.Quaternion(),along=new THREE.Vector3(0,0,1).applyQuaternion(axe.getWorldQuaternion(q)).applyQuaternion(player().getWorldQuaternion(q).invert());
  assert(wrist().distanceTo(CARRY)<.03&&along.angleTo(CARRY_DIR)<.15,'the axe in the trail carry: '+along.toArray().map(v=>v.toFixed(2)))}
}finally{await g.done()}
console.log('PASS chainsaw-game.mjs: the chainsaw is carried two-handed in front; holding E at a trunk steps in beside its middle facing across it, crouches the hands down to the trunk, throws chips into the sawmill\'s one sawdust pool, cuts in buckTimeSec and recoils back to the carry; letting go early eases back without a snap; the axe rides in the one-handed trail carry.');
