// The task tracker (0.35): every active task in one list, one of them focused (the arrow points at it). Pure: (progress, where you stand) -> items.
// An item: {id, group, title, detail, done, pos}. pos is {x, z} outdoors or null when there is nowhere to walk to (an order on the way, a task whose place is not built).
// The "story" objective (the starter walk, delivery work, a gig) is not an item: game.js already knows it, and the focus value null means "that one".
// The focus is saved on the progress as `focus` (an item id or null); a focus that no longer exists, or is finished, falls back to the story.
import {MAP} from './map-definition.js';
import {TASKS,taskText} from './shift.js';
import {employerName} from './careers.js';
import {markedBlocks,blockCentre,LANDING,LUMBERYARD} from './forest.js';
import {BAY} from './customers.js';
import {felledStages} from './grid.js';
import {parseCellKey,cellCenter} from './world.js';
import {waitingHomes,dropSpot,arrivalText} from './orders.js';

export const FOCUS_PATTERN=/^[a-z0-9:_-]{1,40}$/i;
export const normalizeFocus=v=>typeof v==='string'&&FOCUS_PATTERN.test(v)?v:null;

const nearest=(from,pts)=>pts.reduce((best,p)=>!best||Math.hypot(p.x-from.x,p.z-from.z)<Math.hypot(best.x-from.x,best.z-from.z)?p:best,null);
// Where each kind of task is done. The warehouse tasks (stack, pick, deliver) have no point yet: they show without a distance.
export function taskPlace(kind,progress,from){
 const day=progress.shift?.day||progress.housing?.day||1;
 if(kind==='fell')return nearest(from,markedBlocks(day).map(blockCentre));
 if(kind==='gather'){const logs=(progress.logs||[]).map(l=>({x:l.x,z:l.z}));return logs.length?nearest(from,logs):nearest(from,markedBlocks(day).map(blockCentre))}
 if(kind==='stumps'||kind==='replant'){const now=((progress.housing?.day||1)-1)*1440+(progress.routine?.minutes||0),plots=felledStages(progress,now).map(([key,stage])=>({stage,...(c=>cellCenter(c.ix,c.iz))(parseCellKey(key))}));
  const want=kind==='stumps'?['stump']:['cleared','stump'];for(const s of want){const here=plots.filter(p=>p.stage===s);if(here.length)return nearest(from,here.map(p=>({x:p.x,z:p.z})))}return nearest(from,markedBlocks(day).map(blockCentre))}
 if(kind==='landing')return {x:LANDING.x,z:LANDING.z};
 if(kind==='mill'){const s=MAP.landmarks.find(l=>l.id==='sawmill');return s?{x:s.x,z:s.z}:null}
 if(kind==='haul')return {x:(LUMBERYARD.x0+LUMBERYARD.x1)/2,z:(LUMBERYARD.z0+LUMBERYARD.z1)/2};
 if(kind==='load')return {x:BAY.x,z:BAY.z};
 return null;
}
const PLACE_NAME={fell:'Marked block',gather:'Fallen logs',stumps:'Stumps',replant:'Cleared ground',landing:'The landing',mill:'Sawmill',haul:'Lumberyard',load:'Timber yard bay'};

export function trackerItems(progress,from){
 const items=[],shift=progress.shift;
 if(shift)for(const t of shift.tasks||[]){
  if(!TASKS[t.kind])continue;
  items.push({id:'task:'+t.kind,group:employerName(progress,shift.employer),title:taskText(t),detail:`${Math.min(t.done,t.target)} of ${t.target} done`,done:t.done>=t.target,pos:taskPlace(t.kind,progress,from),place:PLACE_NAME[t.kind]||''});
 }
 for(const h of waitingHomes(progress)){const pos=dropSpot(h);items.push({id:'parcel:'+h,group:'Orders',title:'Collect your order',detail:'It is waiting at your door.',done:false,pos:pos?{x:pos.x,z:pos.z}:null,place:'Your order'})}
 for(const o of progress.orders?.queue||[])items.push({id:'order:'+o.id,group:'Orders',title:o.vehicle?'A vehicle is on the way':'An order is on the way',detail:'Arrives '+arrivalText(o.arrivesAt)+'.',done:false,pos:null,place:''});
 return items;
}
// The focused item, or null (the story objective is focused): the saved focus if it is there and not finished.
export function focusedItem(progress,items){const id=normalizeFocus(progress.focus);return id?items.find(i=>i.id===id&&!i.done)||null:null}
// Y: the next focus after the current one, going story -> each open item -> story. Returns an id or null (the story).
export function nextFocus(progress,items){
 const open=items.filter(i=>!i.done),current=focusedItem(progress,items);
 if(!open.length)return null;
 if(!current)return open[0].id;
 const i=open.findIndex(o=>o.id===current.id);return i+1<open.length?open[i+1].id:null;
}
export const distanceTo=(from,pos)=>pos?Math.round(Math.hypot(pos.x-from.x,pos.z-from.z)):null;
