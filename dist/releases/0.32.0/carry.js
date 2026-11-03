// What the player carries, the sawmill belt and planks put down. Pure transactions: (progress, ...) -> {state, message} or {error}. Saved as three additive progress fields (no schema change):
//   carry:      null | {kind:'log'} (on the shoulder) | {kind:'planks', count:1..4} (in the hands). One thing at a time. A carried log is NOT in the bag.
//   belt:       0..4, the stacks of 4 planks on the sawmill's conveyor. Where they sit is derived (they ride to the end stop), so nothing per plank is saved.
//   plankDrops: [{id,x,z,count}] planks put down on the ground, at most 8 stacks.
// A log put into the saw counts as a stack on the belt at once (the cut animation is cosmetic), so a save or a reload mid-cut loses nothing.
import {MAX_LOGS,nextLogIdFor} from './grid.js';
import {isWalkable} from './world.js';
import {freshStats} from './skills.js';

export const BELT_SLOTS=4,PLANKS_PER_STACK=4,MAX_PLANK_DROPS=8;
const minutesOf=p=>((p.housing?.day||1)-1)*1440+(p.routine?.minutes||0);

export const normalizeCarry=v=>v?.kind==='log'?{kind:'log'}:v?.kind==='planks'&&Number.isSafeInteger(v.count)&&v.count>=1&&v.count<=PLANKS_PER_STACK?{kind:'planks',count:v.count}:null;
export const normalizeBelt=v=>Number.isSafeInteger(v)?Math.max(0,Math.min(BELT_SLOTS,v)):0;
export function normalizePlankDrops(value){
 const out=[],seen=new Set();
 for(const r of Array.isArray(value)?value:[]){
  if(!r||!Number.isSafeInteger(r.id)||r.id<1||seen.has(r.id)||!Number.isFinite(r.x)||!Number.isFinite(r.z)||!isWalkable(r.x,r.z)||!Number.isSafeInteger(r.count)||r.count<1||r.count>PLANKS_PER_STACK)continue;
  seen.add(r.id);out.push({id:r.id,x:r.x,z:r.z,count:r.count});
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
 return {state:{...progress,carry:null,plankDrops:[...drops,{id,x:at.x,z:at.z,count:progress.carry.count}]},message:'You put the planks down.'};
}
export function pickUpPlanks(progress,id){
 if(progress.carry)return {error:HANDS};
 const drop=(progress.plankDrops||[]).find(d=>d.id===id);if(!drop)return {error:'Those planks are gone.'};
 return {state:{...progress,carry:{kind:'planks',count:drop.count},plankDrops:progress.plankDrops.filter(d=>d.id!==id)},message:`You pick up ${drop.count} planks. Press X to put them down.`};
}
