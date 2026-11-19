// P-E wiring test (dist/gigs.js + dist/needs.js + dist/world-goods.js): plank restock gig flow.
// Covers board appearance (supplier, bakery, houses), whole-stack pickup from sawmill yard, full delivery,
// partial delivery give-back to sawmill, abandon/cancel give-back, and old-save normalization.
import assert from 'node:assert/strict';
import {normalizeWorld} from '../dist/world-state.js';
import {needsFrom,normalizeNeeds} from '../dist/needs.js';
import {boardFor,acceptGig,pickNeedHaul,deliverHaul,abandonGig,needsPickup,normalizeGigs,freshGigs} from '../dist/gigs.js';
import {normalizeYard} from '../dist/sawmill-yard.js';
import {PLANKS_PER_STACK} from '../dist/plank-economy.js';
import {SUPPLIER,SAWMILL} from '../dist/plank-needs.js';

const DAY=10,NOW=DAY*1440+600;
const truck={uid:'v1',model:'worktruck',loan:false};
const makeProgress=(supPlanks,yardPlanks,plankStock={})=>{
 const w=normalizeWorld(null,7301,DAY);
 w.stock[SUPPLIER].planks=supPlanks;
 w.stock[SAWMILL].planks=yardPlanks;
 const needs=needsFrom(w,DAY,{boardOnly:true,plankStock});
 return {cash:0,routine:{earned:0,minutes:600},housing:{day:DAY+1},vehicles:[truck],world:w,needs,sawmillYard:normalizeYard({planks:yardPlanks}),gigs:freshGigs(),npcs:{},standing:{people:{}}};
};

// 1. Supplier plank restock appears on the board, picks up in whole stacks, delivers and pays.
{
 let p=makeProgress(0,40);
 const board=boardFor(p,NOW);
 const slot=board.find(s=>s.type==='need-restock'&&s.good==='planks'&&s.places[0].id==='eastbank-supply');
 assert(slot,'supplier plank restock appears on board');
 assert.equal(slot.mode,'vehicle');
 assert.equal(slot.blocked,'');
 assert(slot.stacks>=1&&slot.remaining%PLANKS_PER_STACK===0,'whole stacks requested');

 const acc=acceptGig(p,slot.slot,NOW);
 assert(!acc.error,'accept supplier plank gig: '+acc.error);
 p=acc.state;
 assert.equal(needsPickup(p.gigs.active),true,'needsPickup true before loading');

 // Partial capacity (10 -> floors to 2 stacks = 8 planks).
 const pk=pickNeedHaul(p,NOW+5,{uid:'v1',maxUnits:10});
 assert(!pk.error,'pickNeedHaul: '+pk.error);
 assert.equal(pk.units,8,'floors to whole stacks of 4');
 assert.equal(pk.stacks,2);
 assert.equal(pk.state.world.stock[SAWMILL].planks,32,'world sawmill stock reduced by 8');
 assert.equal(pk.state.sawmillYard.planks,32,'sawmillYard reduced by 8');
 assert.equal(needsPickup(pk.state.gigs.active),false,'needsPickup false once loaded');
 p=pk.state;

 const dl=deliverHaul(p,NOW+25);
 assert(!dl.error,'deliverHaul: '+dl.error);
 assert.equal(dl.units,8);
 assert(dl.paid>0,'paid positive cents');
 assert.equal(dl.state.world.stock[SUPPLIER].planks,8,'supplier stock increased by 8');
 assert.equal(dl.state.gigs.active,null,'active gig cleared');
}

// 2. Bakery and house (property:house-r1) plank restocks open, appear on board, load and deliver.
{
 let p=makeProgress(30,24,{'property:alder-bakery':0,'property:house-r1':0});
 const board=boardFor(p,NOW);
 const hSlot=board.find(s=>s.good==='planks'&&s.places[0].id==='house-r1');
 const bSlot=board.find(s=>s.good==='planks'&&s.places[0].id==='alder-bakery');
 assert(hSlot,'house-r1 plank restock appears on board');
 assert(bSlot,'alder-bakery plank restock appears on board');

 let s=acceptGig(p,hSlot.slot,NOW).state;
 s=pickNeedHaul(s,NOW+5,{uid:'v1',maxUnits:32}).state;
 const loaded=s.gigs.active.haul;
 assert(loaded>=PLANKS_PER_STACK&&loaded%PLANKS_PER_STACK===0);
 const dl=deliverHaul(s,NOW+20);
 assert(!dl.error,'deliver to house-r1: '+dl.error);
 assert.equal(dl.units,loaded);
 assert(dl.paid>0,'paid positive cents for house delivery');
 assert.equal(dl.state.needs.find(n=>n.id===hSlot.needId).status,'filled');
}

// 3. Partial delivery: destination can only fit 4 of 8 loaded planks -> remaining 4 go back to sawmill + yard.
{
 let p=makeProgress(0,20);
 const sSlot=boardFor(p,NOW).find(s=>s.good==='planks'&&s.places[0].id==='eastbank-supply');
 assert(sSlot&&sSlot.remaining>=8,'supplier asks >= 8 planks');
 let s=acceptGig(p,sSlot.slot,NOW).state;
 s=pickNeedHaul(s,NOW+5,{uid:'v1',maxUnits:8}).state;
 assert.equal(s.gigs.active.haul,8);
 assert.equal(s.world.stock[SAWMILL].planks,12);
 assert.equal(s.sawmillYard.planks,12);
 // Fill supplier to 96 (room = 4 of max 100) before arrival.
 s={...s,world:{...s.world,stock:{...s.world.stock,[SUPPLIER]:{...s.world.stock[SUPPLIER],planks:96}}}};
 const dl=deliverHaul(s,NOW+20);
 assert(!dl.error,'partial deliverHaul: '+dl.error);
 assert.equal(dl.units,4,'only 4 planks fit');
 assert.equal(dl.state.world.stock[SUPPLIER].planks,100,'supplier capped at max 100');
 assert.equal(dl.state.world.stock[SAWMILL].planks,16,'leftover 4 returned to sawmill world stock');
 assert.equal(dl.state.sawmillYard.planks,16,'leftover 4 returned to sawmillYard');
}

// 4. Cancel / abandon after pickup gives all loaded planks back to sawmill + yard and releases claim.
{
 let p=makeProgress(0,24);
 const slot=boardFor(p,NOW).find(s=>s.good==='planks'&&s.places[0].id==='eastbank-supply');
 let s=acceptGig(p,slot.slot,NOW).state;
 s=pickNeedHaul(s,NOW+5,{uid:'v1',maxUnits:12}).state;
 assert.equal(s.gigs.active.haul,12);
 assert.equal(s.world.stock[SAWMILL].planks,12);
 assert.equal(s.sawmillYard.planks,12);
 const ab=abandonGig(s);
 assert(!ab.error);
 assert.equal(ab.state.gigs.active,null);
 assert.equal(ab.state.world.stock[SAWMILL].planks,24,'cancel returns 12 planks to sawmill stock');
 assert.equal(ab.state.sawmillYard.planks,24,'cancel returns 12 planks to sawmillYard');
 assert.deepEqual(ab.state.needs.find(n=>n.id===slot.needId).claims,{},'claim released');
}

// 5. Old save without new fields loads cleanly and world.stock shape is unchanged.
{
 const oldWorld=normalizeWorld({v:1,seed:7,day:5,stock:{'shop:market':{eggs:10},'property:alder-bakery':{bread:15}}},7,5);
 assert.equal(oldWorld.stock['property:alder-bakery'].bread,15);
 assert.equal('planks' in oldWorld.stock['property:alder-bakery'],false,'world.stock save shape unchanged');
 assert.equal('property:house-r1' in oldWorld.stock,false,'no new house keys added to world.stock');
 const oldGigs=normalizeGigs({active:{type:'need-restock',client:'noah',places:[{x:19,z:-6.3}],needId:'restock|shop:market|eggs|5',needGood:'eggs',needQty:8,haul:0}});
 assert.equal(oldGigs.active.needGood,'eggs');
 const oldNeeds=normalizeNeeds([{id:'restock|property:house-r1|planks|5',kind:'restock',place:'property:house-r1',good:'planks',qty:4,status:'open',origin:SAWMILL}]);
 assert.equal(oldNeeds.length,1);
}

console.log('PASS plank-gig.mjs: supplier/bakery/house board slots, whole-stack pickup, full/partial delivery with give-back, cancel give-back, and old-save load passed.');
