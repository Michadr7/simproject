// What the player carries, the sawmill belt and planks put down. Pure transactions: (progress, ...) -> {state, message} or {error}. Saved as three additive progress fields (no schema change):
//   carry:      null | {kind:'log'} (on the shoulder) | {kind:'planks', count:1..4} (in the hands) | {kind:'crate'|'box'} | {kind:'parcel',gig,model,large?} (cargo redesign). One thing at a time. A carried log is NOT in the bag.
//   belt:       0..4, the stacks of 4 planks on the sawmill's conveyor. Where they sit is derived (they ride to the end stop), so nothing per plank is saved.
//   plankDrops: [{id,x,z,count,q}] planks put down on the ground (q: quarter turns, 0..3), at most 12 stacks; they never expire and block like a low box.
//   crateDrops: optional [{id,x,z,k:'crate'|'box',q}] crates and boxes put down on the ground (C-B), at most 12, same rules as plankDrops.
// A log put into the saw counts as a stack on the belt at once (the cut animation is cosmetic), so a save or a reload mid-cut loses nothing.
import {MAX_LOGS,nextLogIdFor} from './grid.js';
import {isWalkable} from './world.js';
import {freshStats} from './skills.js';import {parcelHeld,PARCEL_HANDS,PARCEL_DEFAULT} from './gig-parcel.js';

export const BELT_SLOTS=4,PLANKS_PER_STACK=4,MAX_PLANK_DROPS=12;
// What carrying does to the body: a log slows you to 80%, planks to 85%; no sprinting while carrying; stamina drains 1.5x (log) or 1.25x (planks). Dropped stacks never expire.
// Cargo redesign (C-B): the ONE table of hands numbers per carry kind (cargo-items.js handsRule reads it): a crate walks at 60% (no sprint, 1.5x stamina), the parcel and a box at 90%.
export const HANDS_SPEED=Object.freeze({log:.8,planks:.85,crate:.6,parcel:.9,box:.9});
export const HANDS_LOAD=Object.freeze({log:1.5,planks:1.25,crate:1.5,parcel:1.1,box:1.1});
export const CARRY_KINDS=Object.freeze(['log','planks','crate','parcel','box']);
export const carryEffects=carry=>{const k=typeof carry?.kind==='string'&&Object.prototype.hasOwnProperty.call(HANDS_SPEED,carry.kind)?carry.kind:null;return k?{speed:HANDS_SPEED[k],sprint:false,load:HANDS_LOAD[k]}:{speed:1,sprint:true,load:1}};
// Items lie on whatever they were put down on: the deck height under them (null on open ground) plus the item's own rest height.
export const restHeight=(floor,base)=>(Number.isFinite(floor)?floor:0)+base;
export const LOG_REST=.12,PLANK_REST=.06,PLANK_LENGTH=1.2; // PLANK_LENGTH: metres, one length for every plank stack (belt, ground, hands)
// Picking up from the ground and putting down are the same short bend: the spine leans forward BEND_LEAN radians (50 degrees) and the hips drop BEND_DROP metres, hold at the bottom, then come back
// over BEND_TIME seconds. The item changes hands at the bottom (BEND_RELEASE of the way through). bendAmount is 0..1 with a flat bottom between about 21% and 79% of the way.
export const BEND_TIME=.8,BEND_LEAN=.87,BEND_DROP=.22,BEND_RELEASE=.5;
export const bendAmount=t=>Math.min(1,1.6*Math.sin(Math.PI*Math.max(0,Math.min(1,t))));
export const bendLean=t=>bendAmount(t)*BEND_LEAN,bendDrop=t=>bendAmount(t)*BEND_DROP;
// Planks carried in both hands: the stack is held low in front of the chest; each hand goes to one side under it (character space, metres, +z forward). Poles point the elbows out and down.
// (the character's right hand is at negative x when it faces +z, as in chop-path.js's CARRY)
export const PLANK_HANDS={R:{x:-.3,y:1.05,z:.4},L:{x:.3,y:1.05,z:.4}},PLANK_STACK={x:0,y:1.25,z:.5},PLANK_POLES={R:{x:-.8,y:-1,z:-.2},L:{x:.8,y:-1,z:-.2}};
// The stack (1.2 m long, 0.45 m wide) is held crosswise at chest height with both hands under it, its back edge clear of the body; a log rides on the right shoulder below the chin, held up from underneath by the right hand.
export const LOG_HOME={x:-.27,y:1.4,z:.05},LOG_GROUND={x:0,y:.3,z:.95},LOG_HAND={x:-.34,y:1.25,z:.3},LOG_POLE={x:-.4,y:-1,z:-.4};
// How far the two-handed pose has blended in: it moves toward 1 while planks are carried and toward 0 otherwise.
export const poseBlend=(current,carrying,dt)=>{const to=carrying?1:0;return Math.abs(to-current)<.002?to:current+(to-current)*Math.min(1,dt*8)};
// A put-down stack is an axis-aligned box on the ground (the long side along x or z): `size` is its footprint at quarter-turn 0, q the quarter turns (0..3).
export const plankBox=(d,size)=>{const odd=(d.q||0)%2===1;return {x:d.x,z:d.z,hx:(odd?size.z:size.x)/2,hz:(odd?size.x:size.z)/2}};
export const quarterOf=yaw=>((Math.round(yaw/(Math.PI/2))%4)+4)%4;
const minutesOf=p=>((p.housing?.day||1)-1)*1440+(p.routine?.minutes||0);

// carry: null | {kind:'log'} | {kind:'planks',count} | {kind:'crate'} | {kind:'box'} | {kind:'parcel',gig,model,large?} (the last three are the cargo redesign: one thing in the hands)
export const normalizeCarry=v=>{
 if(!v||typeof v!=='object')return null;
 if(v.kind==='log'||v.kind==='crate'||v.kind==='box')return {kind:v.kind};
 if(v.kind==='planks')return Number.isSafeInteger(v.count)&&v.count>=1&&v.count<=PLANKS_PER_STACK?{kind:'planks',count:v.count}:null;
 if(v.kind==='parcel'&&Number.isSafeInteger(v.gig)&&v.gig>=1&&v.gig<=1e9)return {kind:'parcel',gig:v.gig,model:typeof v.model==='string'&&v.model&&v.model.length<=64?v.model:PARCEL_DEFAULT,...(v.large===true?{large:true}:{})};
 return null;
};
export const normalizeBelt=v=>Number.isSafeInteger(v)?Math.max(0,Math.min(BELT_SLOTS,v)):0;
export function normalizePlankDrops(value){
 const out=[],seen=new Set();
 for(const r of Array.isArray(value)?value:[]){
  if(!r||!Number.isSafeInteger(r.id)||r.id<1||seen.has(r.id)||!Number.isFinite(r.x)||!Number.isFinite(r.z)||!isWalkable(r.x,r.z)||!Number.isSafeInteger(r.count)||r.count<1||r.count>PLANKS_PER_STACK)continue;
  seen.add(r.id);out.push({id:r.id,x:r.x,z:r.z,count:r.count,q:Number.isSafeInteger(r.q)?((r.q%4)+4)%4:0});
 }
 return out.slice(0,MAX_PLANK_DROPS);
}
export const beltFull=progress=>(progress.belt||0)>=BELT_SLOTS;

const HANDS='Your hands are full. Put it down first (X).';
// Lifts a log off the ground onto the shoulder (not into the bag).
export function shoulderLog(progress,id){
 if(progress.carry||parcelHeld(progress))return {error:progress.carry?HANDS:PARCEL_HANDS};
 if(!(progress.logs||[]).some(l=>l.id===id))return {error:'That log is gone.'};
 const stats={...(progress.stats||freshStats()),logsCollected:(progress.stats?.logsCollected||0)+1};
 return {state:{...progress,carry:{kind:'log'},stats,logs:progress.logs.filter(l=>l.id!==id)},message:'Log on your shoulder. Press X to put it down.'};
}
// Puts the carried log on the ground at {x, z, rot}.
export function putDownLog(progress,at){
 if(progress.carry?.kind!=='log')return {error:'You are not carrying a log.'};
 const id=nextLogIdFor(progress.nextLogId,progress.logs||[]);
 return {state:{...progress,carry:null,logs:[...(progress.logs||[]),{id,x:at.x,z:at.z,rot:at.rot||0,t:Math.floor(minutesOf(progress))}].slice(-MAX_LOGS),nextLogId:id+1},message:'You put the log down.'};
}
// The carried log goes into the saw. The saw must be on and the belt must have room (the stack counts at once).
export function feedLog(progress,sawOn){
 if(progress.carry?.kind!=='log')return {error:'You need a log on your shoulder.'};
 if(!sawOn)return {error:'Switch the saw on first.'};
 if(beltFull(progress))return {error:'The belt is full. Take some planks away first.'};
 return {state:{...progress,carry:null,belt:(progress.belt||0)+1},message:'The saw takes the log.'};
}
// One stack (4 planks) off the end of the belt into the hands.
export function takePlanks(progress){
 if(progress.carry||parcelHeld(progress))return {error:progress.carry?HANDS:PARCEL_HANDS};
 if(!(progress.belt>0))return {error:'The belt is empty.'};
 return {state:{...progress,carry:{kind:'planks',count:PLANKS_PER_STACK},belt:progress.belt-1},message:`You pick up ${PLANKS_PER_STACK} planks. Press X to put them down.`};
}
export function putDownPlanks(progress,at){
 if(progress.carry?.kind!=='planks')return {error:'You are not carrying planks.'};
 // Putting down must ALWAYS work (hands full + ground full used to be a dead end: you cannot pick up with full hands). At the limit the oldest stack on the ground is cleared away to make room.
 let drops=progress.plankDrops||[],cleared=false;while(drops.length>=MAX_PLANK_DROPS){const oldest=drops.reduce((a,d)=>d.id<a.id?d:a,drops[0]);drops=drops.filter(d=>d!==oldest);cleared=true}
 const id=1+Math.max(0,...drops.map(d=>d.id));
 return {state:{...progress,carry:null,plankDrops:[...drops,{id,x:at.x,z:at.z,count:progress.carry.count,q:Number.isSafeInteger(at.q)?((at.q%4)+4)%4:0}]},message:cleared?'You put the planks down. The oldest stack on the ground was cleared away to make room.':'You put the planks down.'};
}
// Rescue for a save that is already stuck: planks in the hands and the ground full of stacks. On load the oldest stack is cleared so the hands can be emptied with X.
export function rescueCarry(progress){
 const drops=progress.plankDrops||[];if(progress.carry?.kind!=='planks'||drops.length<MAX_PLANK_DROPS)return progress;
 const oldest=drops.reduce((a,d)=>d.id<a.id?d:a,drops[0]);return {...progress,plankDrops:drops.filter(d=>d!==oldest)};
}
export function pickUpPlanks(progress,id){
 if(progress.carry||parcelHeld(progress))return {error:progress.carry?HANDS:PARCEL_HANDS};
 const drop=(progress.plankDrops||[]).find(d=>d.id===id);if(!drop)return {error:'Those planks are gone.'};
 return {state:{...progress,carry:{kind:'planks',count:drop.count},plankDrops:progress.plankDrops.filter(d=>d.id!==id)},message:`You pick up ${drop.count} planks. Press X to put them down.`};
}
// C-B (cargo redesign): a crate or a box put down on the ground. Saved as the optional progress field crateDrops: [{id,x,z,k:'crate'|'box',q}] (q: quarter turns), at most MAX_CRATE_DROPS; they never expire and block like a low box (CRATE_SIZE is the footprint at q 0).
// Like planks, a put-down ALWAYS works: at the limit the oldest one on the ground is cleared away, so full hands are never a dead end.
export const MAX_CRATE_DROPS=12,CRATE_SIZE=Object.freeze({x:.58,z:.38});
export function normalizeCrateDrops(value){
 const out=[],seen=new Set();
 for(const r of Array.isArray(value)?value:[]){
  if(!r||!Number.isSafeInteger(r.id)||r.id<1||seen.has(r.id)||(r.k!=='crate'&&r.k!=='box')||!Number.isFinite(r.x)||!Number.isFinite(r.z)||!isWalkable(r.x,r.z))continue;
  seen.add(r.id);out.push({id:r.id,x:r.x,z:r.z,k:r.k,q:Number.isSafeInteger(r.q)?((r.q%4)+4)%4:0});
 }
 return out.slice(0,MAX_CRATE_DROPS);
}
export function putDownCrate(progress,at){
 const k=progress.carry?.kind;if(k!=='crate'&&k!=='box')return {error:'You are not carrying a crate.'};
 let drops=progress.crateDrops||[],cleared=false;while(drops.length>=MAX_CRATE_DROPS){const oldest=drops.reduce((a,d)=>d.id<a.id?d:a,drops[0]);drops=drops.filter(d=>d!==oldest);cleared=true}
 const id=1+Math.max(0,...drops.map(d=>d.id));
 return {state:{...progress,carry:null,crateDrops:[...drops,{id,x:at.x,z:at.z,k,q:Number.isSafeInteger(at.q)?((at.q%4)+4)%4:0}]},message:cleared?`You put the ${k} down. The oldest one on the ground was cleared away to make room.`:`You put the ${k} down.`};
}
export function pickUpCrate(progress,id){
 if(progress.carry||parcelHeld(progress))return {error:progress.carry?HANDS:PARCEL_HANDS};
 const drop=(progress.crateDrops||[]).find(d=>d.id===id);if(!drop)return {error:'That crate is gone.'};
 return {state:{...progress,carry:{kind:drop.k},crateDrops:progress.crateDrops.filter(d=>d.id!==id)},message:`You pick up the ${drop.k}. It is heavy: you walk slowly. Press X to put it down.`};
}
