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
import {dropSpot} from './orders.js';
import {takenBy,dueText,stagingOf} from './tickets.js';
import {racksOf} from './forest.js';
import {RACK_SLOTS,HAND_LEVEL,WAREHOUSE_STAGING,WAREHOUSE_TABLE,DOCK_DOOR,HALL} from './warehouse-layout.js';
import {destinationName} from './order-table.js';

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
 if(kind==='stack'||kind==='pick'||kind==='deliver'){const w=MAP.offices.find(o=>o.kind==='warehouse');return w?{x:w.door.out.x,z:w.door.out.z}:null} // the warehouse's person door
 if(kind==='landing')return {x:LANDING.x,z:LANDING.z};
 if(kind==='mill'){const s=MAP.landmarks.find(l=>l.id==='sawmill');return s?{x:s.x,z:s.z}:null}
 if(kind==='haul')return {x:(LUMBERYARD.x0+LUMBERYARD.x1)/2,z:(LUMBERYARD.z0+LUMBERYARD.z1)/2};
 if(kind==='load')return {x:BAY.x,z:BAY.z};
 return null;
}
const PLACE_NAME={stack:'Warehouse',pick:'Warehouse',deliver:'Warehouse',fell:'Marked block',gather:'Fallen logs',stumps:'Stumps',replant:'Cleared ground',landing:'The landing',mill:'Sawmill',haul:'Lumberyard',load:'Timber yard bay'};

export function trackerItems(progress,from,room=null){
 const items=[],shift=progress.shift;
 if(shift)for(const t of shift.tasks||[]){
  if(!TASKS[t.kind])continue;
  items.push({id:'task:'+t.kind,section:'Shift',group:employerName(progress,shift.employer),title:taskText(t),detail:`${Math.min(t.done,t.target)} of ${t.target} done`,done:t.done>=t.target,pos:taskPlace(t.kind,progress,from),place:PLACE_NAME[t.kind]||''});
 }
 {const w=MAP.offices.find(o=>o.kind==='warehouse'),now=Math.floor(((progress.housing?.day||1)-1)*1440+(progress.routine?.minutes||0)); // the customer orders you took at the warehouse's order table
  for(const k of takenBy(progress.companies?.ridgeline,'me'))items.push({id:'ticket:'+k.id,section:'Orders',group:'Orders',title:`Order #${k.id} · ${k.customer}`,detail:k.status==='loaded'?`Deliver ${k.planks} planks to ${destinationName(k.dest)} · ${dueText(k,now)}`:`Pick ${k.planks} planks: ${k.staged} staged · ${k.kind==='pickup'?'pickup':'delivery'} ${dueText(k,now)}`,done:false,pos:k.status==='loaded'&&k.dest&&dropSpot(k.dest)?(({x,z})=>({x,z}))(dropSpot(k.dest)):w?{x:w.door.out.x,z:w.door.out.z}:null,place:k.status==='loaded'?destinationName(k.dest):'Warehouse'})}
 if(room)for(const i of items)if(!i.done){const w=warehouseTarget(i,progress,from,room);i.pos=w.pos;i.place=w.place}
 return items;
}
// Parcels and vehicles on the way are notifications (Messages), never items (DESIGN 4.19).
// Section order on the card: Orders, Shift, then the story (Gigs or Getting started).
export const SECTIONS=['Orders','Shift'];
// When the focused task finishes or leaves: the first open task in its section, else the next section, else the story (null).
export function focusAfter(items,section){const open=items.filter(i=>!i.done);for(let s=Math.max(0,SECTIONS.indexOf(section));s<SECTIONS.length;s++){const hit=open.find(i=>i.section===SECTIONS[s]);if(hit)return hit.id}return null}
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

// Inside the warehouse (DESIGN 4.19 B3): the arrow points at real places in the room, in the room's own coordinates. room = {carryPlanks}.
// A taken order: the rack with planks to take (or, with planks in your hands, the order's staging square); a complete one: the loading door; a loaded one, and every outdoor task: the front door.
export const WAREHOUSE_EXIT=Object.freeze({x:0,z:11.4}),RACK_FULL=40; // RACK_FULL: planks in one hand-level rack cell (warehouse.js RACK_CAP)
const HAND_RACKS=RACK_SLOTS.filter(s=>s.level<=HAND_LEVEL);
const closest=(from,list)=>list.reduce((b,s)=>!b||Math.hypot(s.stand.x-from.x,s.stand.z-from.z)<Math.hypot(b.stand.x-from.x,b.stand.z-from.z)?s:b,null);
export function warehouseTarget(item,progress,from,room){
 const exit={pos:{...WAREHOUSE_EXIT},place:'Front door'},co=progress.companies?.ridgeline,racks=racksOf(progress),rack=s=>({pos:{x:s.stand.x,z:s.stand.z},place:'Rack '+s.id});
 const ticketTarget=k=>{
  if(!k||k.status==='loaded')return exit;
  if(k.status==='staged')return k.kind==='delivery'?{pos:{x:DOCK_DOOR.x-1.6,z:HALL.halfD-1},place:'Loading door'}:{pos:{x:DOCK_DOOR.x,z:HALL.halfD-1},place:'Loading door'};
  const i=stagingOf(co).findIndex(s=>s&&s.id===k.id);
  if(room.carryPlanks&&i>=0)return {pos:{x:WAREHOUSE_STAGING[i].x,z:WAREHOUSE_STAGING[i].z},place:'Order #'+k.id+' square'};
  const s=closest(from,HAND_RACKS.filter(s=>(racks[s.id]||0)>0));return s?rack(s):i>=0?{pos:{x:WAREHOUSE_STAGING[i].x,z:WAREHOUSE_STAGING[i].z},place:'Order #'+k.id+' square'}:exit;
 };
 if(item.id.startsWith('ticket:'))return ticketTarget(ticketsFor(progress).find(k=>'ticket:'+k.id===item.id));
 if(item.id==='task:pick'||item.id==='task:deliver'){const k=ticketsFor(progress)[0];return k?ticketTarget(k):{pos:{x:WAREHOUSE_TABLE.x,z:WAREHOUSE_TABLE.z},place:'Order table'}}
 if(item.id==='task:stack'){const s=room.carryPlanks?closest(from,HAND_RACKS.filter(s=>(racks[s.id]||0)<RACK_FULL)):closest(from,HAND_RACKS.filter(s=>(racks[s.id]||0)>0));return s?rack(s):{pos:{x:WAREHOUSE_TABLE.x,z:WAREHOUSE_TABLE.z},place:'Order table'}}
 return exit;
}
const ticketsFor=progress=>takenBy(progress.companies?.ridgeline,'me');