// Ridgeline's forest work (0.35 step 4, DESIGN 4.15 C): the cut blocks of Pine Ridge, which two are marked each day, the landing where logs are stacked, and what a felled tree or a
// stacked log counts for on shift. Pure: (progress, ...) -> {state, ...}. Trees are cuttable trees from world.js (worldLayout().cuttable): {key, x, z}.
import {MAP,zoneById} from './map-definition.js';
import {recordPiece} from './shift.js';
import {RACK_IDS,reachableByHand} from './warehouse-layout.js';
import {PALLET_CAP,racksMap,forkCount,addToRack,takeFromRackCell,useForkPlanks} from './pallets.js';

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
// The warehouse racks (0.35 step 2, DESIGN 4.16 and 4.16 I): 120 shelf cells (warehouse-layout.js: five faces of eight bays, three levels), each holding one pallet of up to 40 planks (pallets.js); by hand you reach
// level 1, the forklift reaches the rest. Pallets are saved on the company (companies.ridgeline.pallets). They arrive with the crew's supply (supply.js; the old inside delivery pile is gone). E at a floor-level cell
// takes a stack of four into your hands, E at a cell puts it in; a cell filled to 40 counts as a rack ($5.00, the Stack task).
export {RACK_IDS};export const RACK_CAP=PALLET_CAP,RECEIVE_BATCH=4;
const coOf=(progress,id=EMPLOYER)=>progress.companies?.[id]||{};
const setCo=(progress,company,id=EMPLOYER)=>({...progress,companies:{...(progress.companies||{}),[id]:company}});
// {slot: planks} of the racks, derived from the pallets
export const racksOf=(progress,id=EMPLOYER)=>racksMap(coOf(progress,id));
export const rackPlanks=(progress,id=EMPLOYER)=>Object.values(racksOf(progress,id)).reduce((s,n)=>s+n,0);
// planks stacked by hand filled a cell to the cap: the Stack task piece, once per cell per shift (moving planks back and forth cannot be farmed). Moving a pallet with the forklift is not stacking and pays nothing.
const filledPay=(moved,slot,put,pays=true)=>{
 if(!pays||!moved.shift||(moved.shift.stacked||[]).includes(slot))return {state:moved,finished:[],filled:true,put,message:`Rack ${slot} is full: ${RACK_CAP} planks.`};
 const r=recordPiece({...moved,shift:{...moved.shift,stacked:[...(moved.shift.stacked||[]),slot].slice(-120)}},'racks',1);return {state:r.state,finished:r.finished,filled:true,put,message:done(r,`Rack ${slot} is full: ${RACK_CAP} planks · $5.00.`)}};
export function stackPlanks(progress,slot){
 if(!onShift(progress))return {error:'Clock in to stack planks for Ridgeline Timber.'};
 if(progress.carry?.kind!=='planks')return {error:'Carry planks to stack them: take a stack from a rack.'};
 if(!RACK_IDS.includes(slot))return {error:'There is no such rack.'};
 if(!reachableByHand(slot))return {error:'Too high to reach by hand: the upper shelves need a forklift.'};
 const cur=racksOf(progress)[slot]||0;if(RACK_CAP-cur<=0)return {error:`Rack ${slot} is full.`};
 const r=addToRack(coOf(progress),slot,progress.carry.count);if(!r.put)return {error:'The warehouse has no room for another pallet.'};
 const left=progress.carry.count-r.put,moved=setCo({...progress,carry:left>0?{...progress.carry,count:left}:null},r.company);
 if(cur+r.put<RACK_CAP)return {state:moved,finished:[],filled:false,put:r.put,message:`Rack ${slot}: ${cur+r.put} / ${RACK_CAP} planks.`};
 return filledPay(moved,slot,r.put);
}
// Planks out of a floor-level rack cell (picking an order): a stack of up to four into your hands. The game offers it only while one of your orders still needs planks.
export function takeFromRack(progress,slot){
 if(!onShift(progress))return {error:'Clock in to pick orders for Ridgeline Timber.'};
 if(progress.carry)return {error:'Your hands are full.'};
 if(!RACK_IDS.includes(slot))return {error:'There is no such rack.'};
 if(!reachableByHand(slot))return {error:'Too high to reach by hand: the upper shelves need a forklift.'};
 const cur=racksOf(progress)[slot]||0;if(!cur)return {error:`Rack ${slot} is empty.`};
 const r=takeFromRackCell(coOf(progress),slot,RECEIVE_BATCH);
 return {state:{...setCo(progress,r.company),carry:{kind:'planks',count:r.taken}},message:`Took ${r.taken} planks from rack ${slot} · ${cur-r.taken} left.`};
}
// The forklift (DESIGN 4.16 D and I): its forks carry one pallet of up to RACK_CAP planks (pallets.js, at {fork:true}), lifted and set down physically (fork-pallets.js).
export const forkLoadOf=(progress,id=EMPLOYER)=>forkCount(coOf(progress,id));// planks left the forks (onto a staging pallet): `used` of them
export const forkUsed=(progress,used)=>setCo(progress,useForkPlanks(coOf(progress),used));
// Anti-exploit note (DESIGN 4.16 I): a cell can be emptied and refilled to collect the Stack pay again; the put-away task (step 4) replaces the Stack piece with a per-pallet pay for pallets from outdoors.
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