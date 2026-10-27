import assert from 'node:assert/strict';
import {ITEMS,itemById,isConsumable,isBuyable} from '../dist/items.js';
import {addItem,useItem,unequipItem,inventoryCapacity,normalizeInventory,quickItems,countItem,hasItem,hotbarItems,equipTool,sellLogs} from '../dist/inventory.js';
import {freshProgress,normalizeProgress,transactJob} from '../dist/jobs.js';
assert.equal(ITEMS.filter(i=>i.type==='food').length,10);assert.equal(ITEMS.filter(i=>i.type==='drink').length,5);assert.equal(ITEMS.filter(i=>i.type==='equipment').length,3);
assert.equal(ITEMS.filter(i=>i.type==='tool').length,1);assert.equal(ITEMS.filter(i=>i.type==='material').length,1);
assert.equal(new Set(ITEMS.map(i=>i.id)).size,20);assert(isBuyable(itemById('axe'))&&!isBuyable(itemById('wood-log')));
for(const item of ITEMS){assert(item.icon);for(const field of ['foodRestore','thirstRestore','energyRestore'])assert(Number.isFinite(item[field]));if(item.type==='drink')assert(item.thirstRestore>0)}
for(const item of ITEMS.filter(isConsumable)){
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
// Tools and materials are never consumed or put on the quick wheel.
{let t=addItem(freshProgress(),'axe').state;t=addItem(t,'wood-log').state;t=addItem(t,'apple').state;
 for(const i of [0,1]){const r=useItem(t,i);assert(r.error);assert.equal(r.state,undefined)}
 assert.deepEqual(quickItems(t).map(q=>q.item.id),['apple']);assert.equal(addItem(t,'axe').state.inventory.slots.filter(s=>s.id==='axe').length,2,'axes do not stack');
 assert.equal(countItem(t,'wood-log'),1);assert(hasItem(t,'axe'));assert(!hasItem(freshProgress(),'axe'));}
// Hotbar: tools and consumables, one slot each in bag order (max 6); equipment and materials stay out.
{let t=addItem(freshProgress(),'apple').state;t=addItem(t,'apple').state;t=addItem(t,'small-backpack').state;t=addItem(t,'axe').state;t=addItem(t,'wood-log').state;t=addItem(t,'water').state;
 assert.deepEqual(hotbarItems(t).map(h=>[h.item.id,h.quantity]),[['apple',2],['axe',1],['water',1]]);
 t={...t,inventory:{...t.inventory,slots:[...t.inventory.slots,...['banana','yogurt','soup','salad','granola-bar'].map(id=>({id,quantity:1}))]}};assert.equal(hotbarItems(t).length,6,'capped at six');
 // Equipping toggles, needs the tool, and refuses anything else.
 let e=equipTool(t,'axe');assert.equal(e.state.equipped,'axe');assert.match(e.message,/equipped/);e=equipTool(e.state,'axe');assert.equal(e.state.equipped,null);assert.match(e.message,/put away/);
 assert.match(equipTool(freshProgress(),'axe').error,/do not have/);assert.match(equipTool(t,'apple').error,/cannot be equipped/);assert.match(equipTool(t,'nope').error,/cannot be equipped/);
 // Selling logs.
 let logs=freshProgress();for(let i=0;i<12;i++)logs=addItem(logs,'wood-log').state;logs={...logs,cash:50};
 const sold=sellLogs(logs);assert.equal(sold.count,12);assert.equal(sold.earned,1200);assert.equal(sold.state.cash,1250);assert.equal(countItem(sold.state,'wood-log'),0);assert.match(sold.message,/12 wood logs.*\$12\.00/);
 assert.match(sellLogs(sold.state).error,/no wood logs/);assert.match(sellLogs(addItem(freshProgress(),'wood-log').state).message,/1 wood log for \$1\.00/);
 assert.equal(itemById('wood-log').price,100);}
console.log('20 item definitions (incl. axe and wood log), restoration, stacking, equipment swaps, capacity safeguards, purchases and save preservation passed.');
