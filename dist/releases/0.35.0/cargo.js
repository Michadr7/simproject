// Cargo on a vehicle's bed (0.35, flatbed step 2; DESIGN 4.15 D and K). Pure: the beds, what fits, where each piece sits, loading and unloading what you carry.
// A bed holds a MIXED load: a list of pieces in the order they went on (the last one on is the first one off): a log, or a stack of planks (1 to 4, what you carry).
// Space: a bed has `space` units; a plank takes 1, a log 5 (so the flatbed's 120 is 120 planks, or 24 logs, or any mix). Boxes and pallets come with the warehouse work.
// The load slows the vehicle (vehicle.js withLoad) and burns more fuel.
//   vehicle cargo (saved on the owned vehicle, progress.vehicles[].cargo) = null | [{k:'log'} | {k:'planks', n:1..4}, ...]
// Bed rectangles are local to the vehicle (front +z, metres, y = the bed floor): the flatbed's from its model's cargo anchors and timber rails, the pickups' measured from their
// converted meshes (the widest upward floor behind the cab). Pieces are laid on a grid of cells across and along the bed; each new piece goes on the lowest cell (front first),
// so a mixed load stacks up evenly and never higher than MAX_HEIGHT above the floor.
import {PLANKS_PER_STACK} from './carry.js';

export const CARGO_KINDS=Object.freeze({
 log:Object.freeze({name:'log',plural:'logs',space:5,h:.24,l:1.15}),
 planks:Object.freeze({name:'plank',plural:'planks',space:1,h:.4,l:1.25}) // per plank; a piece is a stack of up to four, drawn as one stack
});
const CELL={w:.26,l:1.25},MAX_HEIGHT=1.25;
export const BEDS=Object.freeze({
 flatbed:Object.freeze({x0:-1.25,x1:1.25,z0:-4.2,z1:.75,y:1.3,space:120,gate:'rear'}),
 worktruck:Object.freeze({x0:-.88,x1:.88,z0:-2.75,z1:-.95,y:.9,space:32}),
 offroad:Object.freeze({x0:-1,x1:1,z0:-2.74,z1:-.8,y:.8,space:32})
});
export const hasBed=model=>!!BEDS[model];
export const spaceOf=model=>BEDS[model]?.space||0;
// how many of a kind fit on an empty bed (24 logs or 120 planks on the flatbed)
export const capacity=(model,kind)=>CARGO_KINDS[kind]?Math.floor(spaceOf(model)/CARGO_KINDS[kind].space):0;
const pieceSpace=p=>p.k==='planks'?p.n:CARGO_KINDS.log.space;
export const usedSpace=c=>(c||[]).reduce((s,p)=>s+pieceSpace(p),0);
export const countOf=(c,kind)=>(c||[]).reduce((s,p)=>s+(p.k!==kind?0:kind==='planks'?p.n:1),0);
export const cargoText=c=>{const logs=countOf(c,'log'),planks=countOf(c,'planks');if(!logs&&!planks)return 'empty';return [logs?`${logs} log${logs===1?'':'s'}`:'',planks?`${planks} plank${planks===1?'':'s'}`:''].filter(Boolean).join(', ')};
// How full the bed is, 0..1 (what the load does to the vehicle).
export const loadOf=(model,c)=>Math.min(1,usedSpace(c)/Math.max(1,spaceOf(model)));
export function normalizeCargo(value,model){
 if(!hasBed(model))return null;let list=[];
 if(Array.isArray(value))list=value.filter(p=>p&&(p.k==='log'||(p.k==='planks'&&Number.isInteger(p.n)&&p.n>=1&&p.n<=PLANKS_PER_STACK))).map(p=>p.k==='log'?{k:'log'}:{k:'planks',n:p.n});
 else if(value&&typeof value==='object'&&CARGO_KINDS[value.kind]&&Number.isFinite(value.count)){ // the first cargo build saved {kind, count}
  let n=Math.floor(value.count);if(value.kind==='log')list=Array.from({length:Math.max(0,n)},()=>({k:'log'}));else while(n>0){const take=Math.min(PLANKS_PER_STACK,n);list.push({k:'planks',n:take});n-=take}}
 const out=[];let used=0;for(const p of list){if(used+pieceSpace(p)>spaceOf(model))break;used+=pieceSpace(p);out.push(p)}
 return out.length?out:null;
}
// Where each piece lies, local to the vehicle: [{kind, x, y, z, yaw}] in load order (yaw 0: lengthwise along the bed). The lowest cell, front first, then side to side.
export function slotPositions(model,c){
 const bed=BEDS[model];if(!bed||!c)return [];
 const cols=Math.max(1,Math.floor((bed.x1-bed.x0)/CELL.w)),rows=Math.max(1,Math.floor((bed.z1-bed.z0)/CELL.l)),tops=new Array(cols*rows).fill(0),out=[];
 const x0=(bed.x0+bed.x1)/2-(cols*CELL.w)/2+CELL.w/2,z0=bed.z1-CELL.l/2;
 for(const p of c){const kind=p.k==='log'?'log':'planks',h=CARGO_KINDS[kind].h;let best=0;for(let i=1;i<tops.length;i++)if(tops[i]<tops[best]-1e-9)best=i;
  const row=Math.floor(best/cols),col=best%cols;out.push({kind,x:+(x0+col*CELL.w).toFixed(3),y:+(bed.y+tops[best]+h/2).toFixed(3),z:+(z0-row*CELL.l).toFixed(3),yaw:0});tops[best]+=h}
 return out;
}
export const fits=(model,c)=>slotPositions(model,c).every(s=>s.y-BEDS[model].y<=MAX_HEIGHT);
// Where you stand to load: behind the bed and beside its middle (local). Within LOAD_REACH of one of these, you can load or unload.
export const LOAD_REACH=1.7;
export function loadPoints(model){const b=BEDS[model];if(!b)return [];const mid=(b.z0+b.z1)/2;return [{x:0,z:b.z0-(b.gate?1.6:.9),side:'rear'},{x:b.x1+.95,z:mid,side:'left'},{x:b.x0-.95,z:mid,side:'right'}]}

// Put what you carry on the bed. carry: the progress carry ({kind:'log'} or {kind:'planks', count}). Returns {carry: null, cargo} or {error}.
export function loadCarry(carry,cargo,model){
 if(!hasBed(model))return {error:'This vehicle has no bed.'};
 if(!carry)return {error:'Carry a log or planks to load them.'};
 const piece=carry.kind==='log'?{k:'log'}:carry.kind==='planks'?{k:'planks',n:carry.count}:null;if(!piece)return {error:'That cannot go on the bed.'};
 const next=[...(cargo||[]),piece];
 if(usedSpace(next)>spaceOf(model)||!fits(model,next))return {error:`The bed is full (${cargoText(cargo)}).`};
 return {carry:null,cargo:next,message:`Loaded · ${cargoText(next)} on the bed`};
}
// Take the last piece that went on into your hands. Returns {carry, cargo} or {error}.
export function unloadOne(carry,cargo,model){
 if(carry)return {error:'Your hands are full.'};
 if(!cargo?.length||!hasBed(model))return {error:'The bed is empty.'};
 const piece=cargo[cargo.length-1],left=cargo.slice(0,-1);
 return {carry:piece.k==='planks'?{kind:'planks',count:piece.n}:{kind:'log'},cargo:left.length?left:null,message:`Took ${piece.k==='planks'?`${piece.n} plank${piece.n===1?'':'s'}`:'a log'} off · ${left.length?cargoText(left)+' left':'the bed is empty'}`};
}
// Take every piece of one kind off (the dock takes all the planks at once). Returns {cargo, count}.
export function takeAll(cargo,kind){const left=(cargo||[]).filter(p=>p.k!==kind);return {cargo:left.length?left:null,count:countOf(cargo,kind)}}
// Take the last piece of one kind off (the Cargo panel: you pick what you need, the rest of the load closes up). Returns {carry, cargo} or {error}.
export function unloadKind(carry,cargo,model,kind){
 if(carry)return {error:'Your hands are full.'};
 const i=(cargo||[]).map(p=>p.k).lastIndexOf(kind);if(i<0)return {error:`There are no ${CARGO_KINDS[kind]?.plural||kind} on the bed.`};
 const piece=cargo[i],left=[...cargo.slice(0,i),...cargo.slice(i+1)];
 return {carry:piece.k==='planks'?{kind:'planks',count:piece.n}:{kind:'log'},cargo:left.length?left:null,message:`Took ${piece.k==='planks'?`${piece.n} plank${piece.n===1?'':'s'}`:'a log'} off · ${left.length?cargoText(left)+' left':'the bed is empty'}`};
}
