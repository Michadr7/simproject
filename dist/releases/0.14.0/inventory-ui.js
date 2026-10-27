import {ITEMS,itemById} from './items.js';
import {inventoryCapacity,quickItems} from './inventory.js';
import {money} from './jobs.js';
export function createInventoryUI({document:doc,getState,canOpen,canBuy,onOpen,onClose,onUse,onUnequip,onBuy}){
 const $=id=>doc.getElementById(id);let mode=null,page=0,previousFocus=null;
 $('inventoryOverlay').hidden=true;
 for(const item of ITEMS){const option=doc.createElement('option');option.value=item.id;option.textContent=`${item.icon} ${item.name} · ${money(item.price)}`;$('inventoryShopItem').append(option)}
 $('inventoryShopItem').value=ITEMS[0].id;
 function act(result){$('inventoryMessage').textContent=result?.error||result?.message||'';refresh()}
 function refresh(){
  const p=getState().progress,inv=p.inventory,capacity=inventoryCapacity(inv);
  $('inventoryCapacity').textContent=`${inv.slots.length} / ${capacity} slots · ${money(p.cash)}`;
  $('inventoryGroceries').textContent=`${p.life.groceries} grocery packs for home cooking.`;
  $('inventoryGrid').replaceChildren();
  for(let i=0;i<Math.max(capacity,inv.slots.length);i++){
   const slot=inv.slots[i],item=itemById(slot?.id),button=doc.createElement('button');button.id='inventorySlot-'+i;button.className='inventory-slot';
   if(item){
    const icon=doc.createElement('span');icon.className='item-icon';icon.textContent=item.icon;
    const name=doc.createElement('span');name.textContent=item.name;
    const count=doc.createElement('small');count.textContent=item.type==='equipment'?`Equip · +${item.slotBonus} slots`:`×${slot.quantity} · Use`;
    button.append(icon,name,count);button.title=item.type==='equipment'?`Equip ${item.name}`:`Food +${item.foodRestore} · Thirst +${item.thirstRestore} · Energy +${item.energyRestore}`;
    button.onclick=()=>act(onUse(i));
   }else{button.textContent='Empty';button.disabled=true}
   $('inventoryGrid').append(button);
  }
  for(const type of ['jacket','backpack']){
   const item=itemById(inv.equipment[type]);$('equipment-'+type).textContent=item?`${item.icon} ${item.name} · Unequip`:`No ${type} equipped`;
   $('equipment-'+type).disabled=!item;
  }
  $('inventoryBuy').disabled=!canBuy();
  $('inventoryShopNote').textContent=canBuy()?'Buy supplies at the market counter.':'Visit the market counter to buy supplies.';
  const quick=quickItems(p),pages=Math.max(1,Math.ceil(quick.length/6));page=Math.min(page,pages-1);
  $('radialItems').replaceChildren();
  quick.slice(page*6,page*6+6).forEach(({item,index,quantity},i)=>{
   const button=doc.createElement('button');button.className='radial-item';button.style.setProperty('--angle',i*60+'deg');button.style.setProperty('--reverse-angle',-i*60+'deg');
   const icon=doc.createElement('span');icon.className='item-icon';icon.textContent=item.icon;
   const name=doc.createElement('span');name.textContent=item.name;
   const count=doc.createElement('small');count.textContent=`${i+1} · ×${quantity}`;
   button.append(icon,name,count);button.onclick=()=>act(onUse(index));$('radialItems').append(button);
  });
  $('radialEmpty').hidden=quick.length>0;$('radialPage').textContent=`Page ${page+1} / ${pages}`;$('radialNext').disabled=pages===1;
 }
 function open(next='grid'){
  if(mode){if(mode===next){close();return}mode=next}else{if(!canOpen())return;previousFocus=doc.activeElement;mode=next;page=0;onOpen()}
  $('inventoryOverlay').hidden=false;$('inventoryPanel').hidden=mode!=='grid';$('radialPanel').hidden=mode!=='wheel';$('inventoryMessage').textContent='';refresh();$('inventoryClose').focus();
 }
 function close(){if(!mode)return;mode=null;$('inventoryOverlay').hidden=true;onClose();previousFocus?.focus?.()}
 for(const type of ['jacket','backpack'])$('equipment-'+type).onclick=()=>act(onUnequip(type));
 $('inventoryBuy').onclick=()=>act(onBuy($('inventoryShopItem').value));
 $('radialNext').onclick=()=>{const pages=Math.max(1,Math.ceil(quickItems(getState().progress).length/6));page=(page+1)%pages;refresh()};
 $('inventoryClose').onclick=close;$('bagButton').onclick=()=>open('grid');
 return {open,close,get isOpen(){return !!mode},useQuick(number){if(mode!=='wheel')return;const entry=quickItems(getState().progress)[page*6+number];if(entry)act(onUse(entry.index))}};
}
