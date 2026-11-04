import assert from 'node:assert/strict';
import {ITEMS,itemById,isConsumable,isBuyable} from '../dist/items.js';
import {addItem,useItem,unequipItem,inventoryCapacity,normalizeInventory,quickItems,countItem,hasItem,hotbarItems,equipTool,sellLogs} from '../dist/inventory.js';
import {freshProgress,normalizeProgress,transactJob} from '../dist/jobs.js';
assert.equal(ITEMS.filter(i=>i.type==='food').length,10);assert.equal(ITEMS.filter(i=>i.type==='drink').length,5);assert.equal(ITEMS.filter(i=>i.type==='equipment').length,3);
assert.equal(ITEMS.filter(i=>i.type==='tool').length,2);assert.equal(ITEMS.filter(i=>i.type==='material').length,1);
assert.equal(new Set(ITEMS.map(i=>i.id)).size,21);assert(isBuyable(itemById('axe'))&&!isBuyable(itemById('wood-log')));
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
// The gas can: a tool you can buy and equip, whose fuel and fuel type live on its bag slot and survive a save; bad fields are dropped.
{import('../dist/inventory.js').then(({canOf,setCan})=>{
 const can=itemById('gas-can');assert(can&&can.type==='tool'&&can.capacityMgal===5000&&isBuyable(can)&&can.price===1500,'a $15 gas can that holds 5 gallons');
 let p=freshProgress();p={...p,cash:5000};const bought=addItem(p,'gas-can',{purchase:true});assert(!bought.error&&bought.state.cash===3500,'bought for $15');p=bought.state;
 assert.deepEqual(canOf(p),{fuel:null,mgal:0},'new cans are empty');assert.deepEqual(normalizeInventory(p.inventory).slots.find(s=>s.id==='gas-can'),{id:'gas-can',quantity:1,fuelMgal:0,fuelType:null});
 p=setCan(p,{fuel:'diesel',mgal:3250});assert.deepEqual(canOf(p),{fuel:'diesel',mgal:3250},'fuel is kept on the slot');assert.deepEqual(canOf(normalizeProgress(JSON.parse(JSON.stringify(p)))),{fuel:'diesel',mgal:3250},'and in a save');
 const bad=normalizeInventory({slots:[{id:'gas-can',quantity:1,fuelMgal:9999,fuelType:'gas'},{id:'axe',quantity:1,fuelMgal:100,fuelType:'gas'}]});assert.deepEqual(bad.slots,[{id:'gas-can',quantity:1,fuelMgal:0,fuelType:null},{id:'axe',quantity:1}],'a can cannot hold more than 5 gallons, and only cans have fuel');
 assert.equal(normalizeInventory({slots:[{id:'gas-can',quantity:1,fuelMgal:100,fuelType:'water'}]}).slots[0].fuelMgal,0,'an unknown fuel type is emptied');
 assert.equal(setCan({inventory:{slots:[]}},{fuel:'gas',mgal:50}),null,'no can, nothing to set');assert.equal(canOf({inventory:{slots:[]}}),null);
 assert(hotbarItems(p).some(h=>h.item.id==='gas-can')&&equipTool(p,'gas-can').equipped==='gas-can','it shows on the hotbar and can be equipped');
 console.log('Gas can: bought, equipped, fuel saved on its slot.')})}
