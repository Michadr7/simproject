// What the forklift driver should do next, and where (user feedback 2026-11-06: "not knowing where to take the pallet"). Pure, no THREE: game.js asks for the goal each frame and the view
// (fork-guide-view.js) draws it. The goal is one sentence for the vehicle panel plus an optional place to mark with a beam: the pallet to lift, or the order square to take it to.
import {WAREHOUSE_STAGING} from './warehouse-layout.js';
import {heightOf,restingOn,approaching,probe,carriedBox,levelBase} from './fork-pallets.js';
import {PALLET} from './pallets.js';

const needOf=k=>k&&k.status==='taken'?Math.max(0,k.planks-k.staged):0;
const where=b=>b.kind==='rack'?`rack ${b.slot}`:'on the floor';
// staging: the three order squares ([ticket|null]); boxes: the pallets in racks and on the floor; pos: {x, z} the forklift. Returns {text, target} where target is
// {kind:'staging'|'pallet', x, z, y} (y: the height to put the marker at) or null.
export function forkGoal({carried=0,boxes=[],staging=[],pos={x:0,z:0}}){
 const need=staging.map(needOf),i=need.findIndex(n=>n>0);
 if(carried>0){
  if(i>=0){const k=staging[i],sq=WAREHOUSE_STAGING[i];return {text:`Order #${k.id} needs ${need[i]} more planks: take this pallet to square S${i+1} (marked) and lower it onto it.`,target:{kind:'staging',x:sq.x,z:sq.z,y:.14}}}
  return {text:'No order needs planks right now: set the pallet in an empty rack cell or on the floor.',target:null};
 }
 if(i>=0){
  const k=staging[i],near=[...boxes].filter(b=>b.count>0).sort((a,b)=>Math.hypot(a.x-pos.x,a.z-pos.z)-Math.hypot(b.x-pos.x,b.z-pos.z))[0];
  if(!near)return {text:`Order #${k.id} needs ${need[i]} planks but there are no pallets: the crew brings them within the hour.`,target:null};
  return {text:`Order #${k.id} needs ${need[i]} planks: lift the marked pallet (${where(near)}, ${near.count} planks) and take it to square S${i+1}.`,target:{kind:'pallet',x:near.x,z:near.z,y:near.base+heightOf(near.count)}};
 }
 const ready=staging.find(k=>k&&k.status==='staged');
 if(ready)return {text:`Order #${ready.id} is staged: get off and load the truck at the loading door (E).`,target:null};
 return {text:'Nothing to move yet: take an order at the order table (front left); the pallets to fill it are in the racks.',target:null};
}

// The ghost outline the view draws, or null: with a pallet on the forks, where it will rest (green) or why it cannot (amber); with empty forks, the pallet they are lined up with
// (green when the tines are in its pocket, amber while they are not yet). `ctx` is fork-pallets.js's: {boxes, carried, occupied, solidAt, stagingTaken}.
export function forkGhost(s,ctx){
 if(ctx.carried>0){
  const r=restingOn(s,ctx),c=carriedBox(s,ctx.carried);
  if(r.kind==='rack'){const cell=ctx.cellOf(r.slot);return {x:cell.x,z:cell.z,yaw:0,y:r.surface,w:PALLET.w,d:PALLET.d,h:heightOf(ctx.carried),ok:true}}
  if(r.kind==='staging'){const sq=WAREHOUSE_STAGING[r.index];return {x:sq.x,z:sq.z,yaw:0,y:r.surface,w:PALLET.w,d:PALLET.d,h:heightOf(ctx.carried),ok:true}}
  if(r.kind==='floor')return {x:c.x,z:c.z,yaw:c.yaw,y:0,w:PALLET.w,d:PALLET.d,h:heightOf(ctx.carried),ok:true};
  return {x:c.x,z:c.z,yaw:c.yaw,y:Math.max(0,c.base),w:PALLET.w,d:PALLET.d,h:heightOf(ctx.carried),ok:false};
 }
 const a=approaching(s,ctx.boxes);if(!a)return null;
 const b=a.box;return {x:b.x,z:b.z,yaw:b.yaw,y:b.base,w:PALLET.w,d:PALLET.d,h:heightOf(b.count),ok:probe(s,b).state==='pocket'};
}
