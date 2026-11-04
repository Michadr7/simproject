// What the player carries, the sawmill belt and planks put down. Pure transactions: (progress, ...) -> {state, message} or {error}. Saved as three additive progress fields (no schema change):
//   carry:      null | {kind:'log'} (on the shoulder) | {kind:'planks', count:1..4} (in the hands). One thing at a time. A carried log is NOT in the bag.
//   belt:       0..4, the stacks of 4 planks on the sawmill's conveyor. Where they sit is derived (they ride to the end stop), so nothing per plank is saved.
//   plankDrops: [{id,x,z,count,q}] planks put down on the ground (q: quarter turns, 0..3), at most 12 stacks; they never expire and block like a low box.
// A log put into the saw counts as a stack on the belt at once (the cut animation is cosmetic), so a save or a reload mid-cut loses nothing.
import {MAX_LOGS,nextLogIdFor} from './grid.js';
import {isWalkable} from './world.js';
import {freshStats} from './skills.js';

export const BELT_SLOTS=4,PLANKS_PER_STACK=4,MAX_PLANK_DROPS=12;
// What carrying does to the body: a log slows you to 80%, planks to 85%; no sprinting while carrying; stamina drains 1.5x (log) or 1.25x (planks). Dropped stacks never expire.
export const carryEffects=carry=>carry?.kind==='log'?{speed:.8,sprint:false,load:1.5}:carry?.kind==='planks'?{speed:.85,sprint:false,load:1.25}:{speed:1,sprint:true,load:1};
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

export const normalizeCarry=v=>v?.kind==='log'?{kind:'log'}:v?.kind==='planks'&&Number.isSafeInteger(v.count)&&v.count>=1&&v.count<=PLANKS_PER_STACK?{kind:'planks',count:v.count}:null;
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
 if(progress.carry)return {error:HANDS};
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
 if(progress.carry)return {error:HANDS};
 if(!(progress.belt>0))return {error:'The belt is empty.'};
 return {state:{...progress,carry:{kind:'planks',count:PLANKS_PER_STACK},belt:progress.belt-1},message:`You pick up ${PLANKS_PER_STACK} planks. Press X to put them down.`};
}
export function putDownPlanks(progress,at){
 if(progress.carry?.kind!=='planks')return {error:'You are not carrying planks.'};
 const drops=progress.plankDrops||[];if(drops.length>=MAX_PLANK_DROPS)return {error:'There is no room for more plank stacks. Pick one up first.'};
 const id=1+Math.max(0,...drops.map(d=>d.id));
 return {state:{...progress,carry:null,plankDrops:[...drops,{id,x:at.x,z:at.z,count:progress.carry.count,q:Number.isSafeInteger(at.q)?((at.q%4)+4)%4:0}]},message:'You put the planks down.'};
}
export function pickUpPlanks(progress,id){
 if(progress.carry)return {error:HANDS};
 const drop=(progress.plankDrops||[]).find(d=>d.id===id);if(!drop)return {error:'Those planks are gone.'};
 return {state:{...progress,carry:{kind:'planks',count:drop.count},plankDrops:progress.plankDrops.filter(d=>d.id!==id)},message:`You pick up ${drop.count} planks. Press X to put them down.`};
}
