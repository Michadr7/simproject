import assert from 'node:assert/strict';
import {ITEMS,itemById} from '../dist/items.js';
import {addItem,useItem,unequipItem,inventoryCapacity,normalizeInventory,quickItems} from '../dist/inventory.js';
import {freshProgress,normalizeProgress,transactJob} from '../dist/jobs.js';
assert.equal(ITEMS.filter(i=>i.type==='food').length,10);assert.equal(ITEMS.filter(i=>i.type==='drink').length,5);assert.equal(ITEMS.filter(i=>i.type==='equipment').length,3);
assert.equal(new Set(ITEMS.map(i=>i.id)).size,18);
for(const item of ITEMS){assert(item.icon);for(const field of ['foodRestore','thirstRestore','energyRestore'])assert(Number.isFinite(item[field]));if(item.type==='drink')assert(item.thirstRestore>0)}
for(const item of ITEMS.filter(i=>i.type!=='equipment')){
 let s=freshProgress();s.life={...s.life,food:90,thirst:90,energy:90};s=addItem(s,item.id).state;
 const result=useItem(s,0);assert(!result.error);assert.equal(result.state.inventory.slots.length,0);
 assert.equal(result.state.life.food,Math.min(100,90+item.foodRestore));assert.equal(result.state.life.thirst,Math.min(100,90+item.thirstRestore));assert.equal(result.state.life.energy,Math.min(100,90+item.energyRestore));
}
let s=addItem(freshProgress(),'water').state;assert(useItem(s,0).error);assert.equal(s.inventory.slots[0].quantity,1,'full stats do not waste item');
s=freshProgress();s.cash=100;s=addItem(s,'water',{purchase:true}).state;assert.equal(s.cash,0);assert(addItem(s,'water',{purchase:true}).error);
s=addItem(s,'basic-jacket').state;s=useItem(s,1).state;assert.equal(inventoryCapacity(s.inventory),10);
s=addItem(s,'small-backpack').state;s=useItem(s,1).state;assert.equal(inventoryCapacity(s.inventory),20);
s=addItem(s,'large-backpack').state;s=useItem(s,1).state;assert.equal(inventoryCapacity(s.inventory),30);assert.equal(s.inventory.slots[1].id,'small-backpack','swapped gear goes into bag');
s=useItem(s,1).state;assert.equal(inventoryCapacity(s.inventory),20,'backpack bonuses do not stack');
s=unequipItem(s,'jacket').state;assert.equal(inventoryCapacity(s.inventory),18);
while(s.inventory.slots.length<18)s=addItem(s,'basic-jacket').state;
assert(addItem(s,'large-backpack').error);assert(unequipItem(s,'backpack').error,'cannot unequip if inventory would overflow');
const before=JSON.stringify(s);const smallIndex=s.inventory.slots.findIndex(slot=>slot.id==='basic-jacket');s=useItem(s,smallIndex).state;assert.equal(inventoryCapacity(s.inventory),20);
assert.equal(normalizeProgress(s).inventory.slots.length,s.inventory.slots.length);assert.deepEqual(transactJob(s,'pickup',{x:0,z:-2},{shop:'market'}).state.inventory,s.inventory);
let stacked=freshProgress();for(let i=0;i<11;i++)stacked=addItem(stacked,'water').state;assert.deepEqual(stacked.inventory.slots.map(s=>s.quantity),[10,1]);assert.equal(quickItems(stacked).length,1);assert.equal(quickItems(stacked)[0].quantity,11);
assert.deepEqual(normalizeInventory({slots:[{id:'bad',quantity:2}],equipment:{backpack:'apple'}}),{slots:[],equipment:{jacket:null,backpack:null}});
console.log('18 item definitions, restoration, stacking, equipment swaps, capacity safeguards, purchases and save preservation passed.');
