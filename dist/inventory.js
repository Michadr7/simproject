import {ITEMS,itemById,isConsumable} from './items.js';
import {normalizeLife} from './life.js';
export const BASE_SLOTS=8;
export const freshInventory=()=>({slots:[],equipment:{jacket:null,backpack:null}});
export function normalizeInventory(value){
 const inv=freshInventory();
 for(const slot of (Array.isArray(value?.slots)?value.slots:[]).slice(0,128)){
  const item=itemById(slot?.id);
  if(item&&Number.isInteger(slot.quantity)&&slot.quantity>0)inv.slots.push({id:item.id,quantity:Math.min(slot.quantity,item.stackLimit)});
 }
 for(const type of ['jacket','backpack']){
  const item=itemById(value?.equipment?.[type]);if(item?.type==='equipment'&&item.equipSlot===type)inv.equipment[type]=item.id;
 }
 return inv;
}
export function inventoryCapacity(inv){return BASE_SLOTS+Object.values(inv.equipment).reduce((sum,id)=>sum+(itemById(id)?.slotBonus||0),0)}
function insert(inv,item){
 const stack=inv.slots.find(slot=>slot.id===item.id&&slot.quantity<item.stackLimit);
 if(stack){stack.quantity++;return true}
 if(inv.slots.length>=inventoryCapacity(inv))return false;
 inv.slots.push({id:item.id,quantity:1});return true;
}
export function addItem(progress,id,{purchase=false}={}){
 const item=itemById(id);if(!item)return {error:'Unknown item.'};
 if(purchase&&progress.cash<item.price)return {error:'You do not have enough cash.'};
 const inventory=normalizeInventory(progress.inventory);
 if(!insert(inventory,item))return {error:'Your bag is full. Use an item or equip a larger bag.'};
 return {state:{...progress,inventory,cash:progress.cash-(purchase?item.price:0)},message:item.name+' added to your bag.'};
}
export function useItem(progress,index){
 const inventory=normalizeInventory(progress.inventory),slot=inventory.slots[index],item=itemById(slot?.id);
 if(!item)return {error:'This slot is empty.'};
 if(item.type==='equipment'){
  const old=inventory.equipment[item.equipSlot];
  inventory.slots.splice(index,1);inventory.equipment[item.equipSlot]=item.id;
  if(old&&!insert(inventory,itemById(old)))return {error:'Not enough room to swap this equipment.'};
  if(inventory.slots.length>inventoryCapacity(inventory))return {error:'Use or remove items before equipping a smaller bag.'};
  return {state:{...progress,inventory},message:item.name+' equipped.'};
 }
 if(!isConsumable(item))return {error:item.type==='tool'?`${item.name}: ${item.description}. Put it on your hotbar, then press E near a pine.`:`${item.name}: ${item.description}.`};
 const life=normalizeLife(progress.life);
 const restores={food:item.foodRestore,thirst:item.thirstRestore,energy:item.energyRestore};
 if(!Object.entries(restores).some(([key,value])=>value>0&&life[key]<100))return {error:'These stats are already full.'};
 for(const [key,value] of Object.entries(restores))life[key]=Math.min(100,life[key]+value);
 slot.quantity--;if(slot.quantity===0)inventory.slots.splice(index,1);
 return {state:{...progress,life,inventory},message:item.name+' consumed.'};
}
export function unequipItem(progress,type){
 const inventory=normalizeInventory(progress.inventory),id=inventory.equipment[type];
 if(!['jacket','backpack'].includes(type)||!id)return {error:'Nothing equipped here.'};
 inventory.equipment[type]=null;
 if(inventory.slots.length+1>inventoryCapacity(inventory)||!insert(inventory,itemById(id)))return {error:'Make room in your bag before removing this equipment.'};
 return {state:{...progress,inventory},message:itemById(id).name+' put in your bag.'};
}
export function quickItems(progress){
 // One button per consumable type, even when there are multiple stacks.
 const seen=new Set();return (progress.inventory?.slots||[]).flatMap((slot,index)=>{
  const item=itemById(slot.id);if(!isConsumable(item)||seen.has(item.id))return [];
  seen.add(item.id);return [{item,index,quantity:progress.inventory.slots.filter(s=>s.id===item.id).reduce((n,s)=>n+s.quantity,0)}];
 });
}
export const countItem=(progress,id)=>(progress.inventory?.slots||[]).reduce((n,slot)=>n+(slot.id===id?slot.quantity:0),0);
export const hasItem=(progress,id)=>countItem(progress,id)>0;
// The hotbar lists every tool and consumable you own (one slot each, bag order), up to six.
export function hotbarItems(progress){
 const seen=new Set();
 return (progress.inventory?.slots||[]).flatMap((slot,index)=>{
  const item=itemById(slot.id);if(!item||(item.type!=='tool'&&!isConsumable(item))||seen.has(item.id))return [];
  seen.add(item.id);return [{item,index,quantity:countItem(progress,item.id)}];
 }).slice(0,6);
}
// Equips a tool, or puts it away if it is already equipped.
export function equipTool(progress,id){
 const item=itemById(id);
 if(!item||item.type!=='tool')return {error:'That cannot be equipped.'};
 if(!hasItem(progress,id))return {error:`You do not have a ${item.name.toLowerCase()}.`};
 const equipped=progress.equipped===id?null:id;
 return {state:{...progress,equipped},equipped,message:equipped?`${item.name} equipped.`:`${item.name} put away.`};
}
export function sellLogs(progress){
 const count=countItem(progress,'wood-log');
 if(!count)return {error:'You have no wood logs to sell.'};
 const earned=count*itemById('wood-log').price;
 return {state:{...progress,cash:progress.cash+earned,inventory:{...progress.inventory,slots:progress.inventory.slots.filter(slot=>slot.id!=='wood-log')}},count,earned,message:`Sold ${count} wood log${count===1?'':'s'} for $${(earned/100).toFixed(2)}.`};
}
