// Ridgeline's forest work (0.35 step 4, DESIGN 4.15 C): the cut blocks of Pine Ridge, which two are marked each day, the landing where logs are stacked, and what a felled tree or a
// stacked log counts for on shift. Pure: (progress, ...) -> {state, ...}. Trees are cuttable trees from world.js (worldLayout().cuttable): {key, x, z}.
import {MAP,zoneById} from './map-definition.js';
import {recordPiece} from './shift.js';
import {RACK_IDS,reachableByHand} from './warehouse-layout.js';

export const EMPLOYER='ridgeline';
export const BLOCKS_X=5,BLOCKS_Z=2,MARKED_PER_DAY=2;
const F=zoneById('forest').bounds,BW=(F.x1-F.x0)/BLOCKS_X,BH=(F.z1-F.z0)/BLOCKS_Z;
// block ids: a letter for the column (west to east) and a digit for the row (north to south): A1 ... E2
export const BLOCK_IDS=Object.freeze(Array.from({length:BLOCKS_X*BLOCKS_Z},(_,i)=>String.fromCharCode(65+i%BLOCKS_X)+(1+Math.floor(i/BLOCKS_X))));
export const blockOf=(x,z)=>{const c=Math.floor((x-F.x0)/BW),r=Math.floor((z-F.z0)/BH);return c<0||c>=BLOCKS_X||r<0||r>=BLOCKS_Z?null:BLOCK_IDS[r*BLOCKS_X+c]};
export const blockCentre=id=>{const i=BLOCK_IDS.indexOf(id);return {x:F.x0+(i%BLOCKS_X+.5)*BW,z:F.z0+(Math.floor(i/BLOCKS_X)+.5)*BH}};
// The marked blocks of a game day: two different blocks, chosen by the day number alone (never random), so a save always shows the same marks and the forest rotates through all ten.
export function markedBlocks(day){
 const d=Math.max(1,Math.floor(day)),n=BLOCK_IDS.length,a=(d*3+Math.floor(d/n))%n,b=(a+3+(d%4))%n; // 3 + (0..3): never the same block as a
 return [BLOCK_IDS[a],BLOCK_IDS[b]];
}
export const isMarked=(tree,day)=>markedBlocks(day).includes(blockOf(tree.x,tree.z));
export const markedTrees=(trees,day)=>trees.filter(t=>isMarked(t,day));
// The landing: the company's log pile by the yard hut in the woods; a log on your shoulder is stacked here for pay.
export const LANDING=Object.freeze({x:129.2,z:-279.8,radius:2.4});
export const atLanding=p=>!!p&&Math.hypot(p.x-LANDING.x,p.z-LANDING.z)<=LANDING.radius;
// Company stock (DESIGN 4.15 K): what the company holds, saved on the company (progress.companies[id].stock), so a player owner inherits it: logs in the landing pile,
// planks at the lumberyard. Orders for planks and logs will draw on it later.
export const stockOf=(progress,id=EMPLOYER)=>({logs:progress.companies?.[id]?.stock?.logs||0,planks:progress.companies?.[id]?.stock?.planks||0});
export const addStock=(progress,patch,id=EMPLOYER)=>{const s=stockOf(progress,id),c=progress.companies?.[id]||{};return {...progress,companies:{...(progress.companies||{}),[id]:{...c,stock:{logs:Math.max(0,s.logs+(patch.logs||0)),planks:Math.max(0,s.planks+(patch.planks||0))}}}}};
const onShift=progress=>progress.shift?.employer===EMPLOYER;
const done=(r,plain)=>r.finished?.length?`Task done: ${r.finished[0]}.`:plain;

// A pine was felled on a Ridgeline shift: a marked one pays as a tree ($3.00, the Fell task); an unmarked one pays less ($0.75) and counts for no task.
export function treeFelled(progress,tree){
 if(!onShift(progress))return {state:progress,counted:false,message:''};
 if(isMarked(tree,progress.shift.day)){const r=recordPiece(progress,'trees',1);return {state:r.state,counted:true,marked:true,finished:r.finished,message:done(r,'A marked pine: $3.00.')}}
 const r=recordPiece(progress,'stray',1);return {state:r.state,counted:false,marked:false,finished:[],message:'Not a marked tree: it pays $0.75 instead of $3.00.'};
}
// The warehouse racks (0.35 step 2, DESIGN 4.16): 120 shelf cells (warehouse-layout.js: five faces of eight bays, three levels), each holding up to 40 planks; by hand you reach level 1, the forklift reaches the rest. They are saved on
// the company (companies.ridgeline.racks = {A1: n, ...}; empty bays are not stored). Planks come from the company's yard stock: E at the delivery pile inside takes a stack of four
// into your hands, E at a bay puts it in; a bay filled to 40 counts as a rack ($5.00, the Stack task).
export {RACK_IDS};export const RACK_CAP=40,RECEIVE_BATCH=4;
export const racksOf=(progress,id=EMPLOYER)=>progress.companies?.[id]?.racks||{};
export const rackPlanks=(progress,id=EMPLOYER)=>Object.values(racksOf(progress,id)).reduce((s,n)=>s+n,0);
const setRacks=(progress,racks,id=EMPLOYER)=>{const clean=Object.fromEntries(Object.entries(racks).filter(([,n])=>n>0)),c=progress.companies?.[id]||{},next={...c};if(Object.keys(clean).length)next.racks=clean;else delete next.racks;return {...progress,companies:{...(progress.companies||{}),[id]:next}}};
export function takeReceiving(progress){
 if(!onShift(progress))return {error:'Clock in to move planks for Ridgeline Timber.'};
 if(progress.carry)return {error:'Your hands are full.'};
 const have=stockOf(progress).planks;if(!have)return {error:'The delivery pile is empty: planks arrive from the lumberyard.'};
 const n=Math.min(RECEIVE_BATCH,have),s=addStock(progress,{planks:-n});
 return {state:{...s,carry:{kind:'planks',count:n}},message:`Took ${n} planks from the delivery pile · ${stockOf(s).planks} left.`};
}
export function stackPlanks(progress,slot){
 if(!onShift(progress))return {error:'Clock in to stack planks for Ridgeline Timber.'};
 if(progress.carry?.kind!=='planks')return {error:'Carry planks to stack them: take a stack from the delivery pile.'};
 if(!RACK_IDS.includes(slot))return {error:'There is no such rack.'};
 if(!reachableByHand(slot))return {error:'Too high to reach by hand: the upper shelves need a forklift.'};
 const racks=racksOf(progress),cur=racks[slot]||0,room=RACK_CAP-cur;if(room<=0)return {error:`Rack ${slot} is full.`};
 const put=Math.min(progress.carry.count,room),left=progress.carry.count-put,moved=setRacks({...progress,carry:left>0?{...progress.carry,count:left}:null},{...racks,[slot]:cur+put});
 if(cur+put<RACK_CAP)return {state:moved,finished:[],filled:false,put,message:`Rack ${slot}: ${cur+put} / ${RACK_CAP} planks.`};
 const r=recordPiece(moved,'racks',1);return {state:r.state,finished:r.finished,filled:true,put,message:done(r,`Rack ${slot} is full: ${RACK_CAP} planks · $5.00.`)};
}
// Planks out of a floor-level rack cell (picking an order): a stack of up to four into your hands. The game offers it only while one of your orders still needs planks.
export function takeFromRack(progress,slot){
 if(!onShift(progress))return {error:'Clock in to pick orders for Ridgeline Timber.'};
 if(progress.carry)return {error:'Your hands are full.'};
 if(!RACK_IDS.includes(slot))return {error:'There is no such rack.'};
 if(!reachableByHand(slot))return {error:'Too high to reach by hand: the upper shelves need a forklift.'};
 const racks=racksOf(progress),cur=racks[slot]||0;if(!cur)return {error:`Rack ${slot} is empty.`};
 const n=Math.min(RECEIVE_BATCH,cur);
 return {state:{...setRacks(progress,{...racks,[slot]:cur-n}),carry:{kind:'planks',count:n}},message:`Took ${n} planks from rack ${slot} · ${cur-n} left.`};
}
// The forklift (0.35 step 5, DESIGN 4.16 D): its forks carry one pallet of up to RACK_CAP planks, saved on the company (forkload). It lifts a whole rack bay to another bay or onto a staging pallet in one trip;
// the upper shelves are only reachable this way. The same clock-in rule as by hand (rank 4 and up work the warehouse).
export const forkLoadOf=(progress,id=EMPLOYER)=>progress.companies?.[id]?.forkload||0;
const setForkLoad=(progress,n,id=EMPLOYER)=>{const c=progress.companies?.[id]||{},next={...c};if(n>0)next.forkload=n;else delete next.forkload;return {...progress,companies:{...(progress.companies||{}),[id]:next}}};
export function forkTake(progress,slot){
 if(!onShift(progress))return {error:'Clock in to work the forklift for Ridgeline Timber.'};
 if(forkLoadOf(progress))return {error:'The forks are already loaded.'};
 if(!RACK_IDS.includes(slot))return {error:'There is no such rack.'};
 const racks=racksOf(progress),cur=racks[slot]||0;if(!cur)return {error:`Rack ${slot} is empty.`};
 return {state:setForkLoad(setRacks(progress,{...racks,[slot]:0}),cur),message:`Lifted ${cur} planks from rack ${slot}.`};
}
export function forkTakePile(progress){
 if(!onShift(progress))return {error:'Clock in to work the forklift for Ridgeline Timber.'};
 if(forkLoadOf(progress))return {error:'The forks are already loaded.'};
 const have=stockOf(progress).planks;if(!have)return {error:'The delivery pile is empty: planks arrive from the lumberyard.'};
 const n=Math.min(RACK_CAP,have),s=addStock(progress,{planks:-n});
 return {state:setForkLoad(s,n),message:`Lifted ${n} planks from the delivery pile · ${stockOf(s).planks} left.`};
}
export function forkPut(progress,slot){
 if(!onShift(progress))return {error:'Clock in to work the forklift for Ridgeline Timber.'};
 const load=forkLoadOf(progress);if(!load)return {error:'The forks are empty.'};
 if(!RACK_IDS.includes(slot))return {error:'There is no such rack.'};
 const racks=racksOf(progress),cur=racks[slot]||0,room=RACK_CAP-cur;if(room<=0)return {error:`Rack ${slot} is full.`};
 const put=Math.min(load,room),moved=setForkLoad(setRacks(progress,{...racks,[slot]:cur+put}),load-put);
 if(cur+put<RACK_CAP)return {state:moved,finished:[],filled:false,put,message:`Rack ${slot}: ${cur+put} / ${RACK_CAP} planks.`};
 const r=recordPiece(moved,'racks',1);return {state:r.state,finished:r.finished,filled:true,put,message:done(r,`Rack ${slot} is full: ${RACK_CAP} planks · $5.00.`)};
}
// planks left the forks (onto a staging pallet): `used` of them
export const forkUsed=(progress,used)=>setForkLoad(progress,Math.max(0,forkLoadOf(progress)-used));
// A log picked up off the ground on a Ridgeline shift counts as gathered ($0.25), once per log per shift (putting it down and picking it up again pays nothing more).
export function logGathered(progress,logId){
 if(!onShift(progress))return {state:progress,counted:false,message:''};
 const seen=progress.shift.gathered||[];if(seen.includes(logId))return {state:progress,counted:false,message:''};
 const r=recordPiece({...progress,shift:{...progress.shift,gathered:[...seen,logId].slice(-300)}},'gathered',1);
 return {state:r.state,counted:true,finished:r.finished,message:done(r,'')};
}
// A stump dug out on a Ridgeline shift ($1.50) and a sapling planted in cleared ground ($0.50).
export function stumpCleared(progress){if(!onShift(progress))return {state:progress,counted:false,message:''};const r=recordPiece(progress,'stumps',1);return {state:r.state,counted:true,finished:r.finished,message:done(r,'Stump dug out: $1.50.')}}
export function saplingPlanted(progress){if(!onShift(progress))return {state:progress,counted:false,message:''};const r=recordPiece(progress,'saplings',1);return {state:r.state,counted:true,finished:r.finished,message:done(r,'Sapling planted: $0.50.')}}
// A log stacked at the landing: it leaves your shoulder, joins the company's log pile, and counts as a log carried to the landing ($0.25).
export function stackLog(progress,position){
 if(!onShift(progress))return {error:'Clock in to stack logs for Ridgeline Timber.'};
 if(progress.carry?.kind!=='log')return {error:'Carry a log on your shoulder to stack it here.'};
 if(!atLanding(position))return {error:'The landing is by the yard hut.'};
 const r=recordPiece(addStock({...progress,carry:null},{logs:1}),'logs',1);
 return {state:r.state,finished:r.finished,message:done(r,`Log stacked at the landing · ${stockOf(r.state).logs} in the pile.`)};
}
// A log taken back off the pile (to the sawmill's bench, or onto a truck): on shift, empty-handed, at the landing.
export function takeLogFromPile(progress,position){
 if(!onShift(progress))return {error:'Clock in to take logs from the company pile.'};
 if(progress.carry)return {error:'Your hands are full.'};
 if(!atLanding(position))return {error:'The landing is by the yard hut.'};
 if(!stockOf(progress).logs)return {error:'The pile is empty.'};
 const s=addStock(progress,{logs:-1});return {state:{...s,carry:{kind:'log'}},message:`Took a log from the pile · ${stockOf(s).logs} left.`};
}
// Planks taken off the sawmill belt count as milled (the Mill task; they pay when they reach the lumberyard).
export function planksMilled(progress,count){
 if(!onShift(progress))return {state:progress,finished:[]};
 return recordPiece(progress,'planks',count);
}
// The lumberyard (the Eastbank timber yard, the UNLOAD sign): planks delivered here, by hand or off a truck's bed, join the company's stock and pay $1.00 each.
export const LUMBERYARD=Object.freeze({x0:80,x1:94,z0:44,z1:60,sign:Object.freeze({x:80.8,z:50})});
export const inLumberyard=p=>!!p&&p.x>=LUMBERYARD.x0&&p.x<=LUMBERYARD.x1&&p.z>=LUMBERYARD.z0&&p.z<=LUMBERYARD.z1;
export function deliverPlanks(progress,count){
 if(!onShift(progress))return {error:'Clock in to deliver planks to Ridgeline Timber.'};
 if(!(count>0))return {error:'There are no planks to deliver.'};
 const r=recordPiece(addStock(progress,{planks:count}),'delivered',count);
 return {state:r.state,finished:r.finished,message:done(r,`${count} plank${count===1?'':'s'} delivered · $${count.toFixed(2)} · ${stockOf(r.state).planks} at the lumberyard.`)};
}