import {ITEMS,isBuyable} from './items.js';
import {inventoryCapacity} from './inventory.js';
import {money} from './jobs.js';

const FILTERS=['all','food','drink','equipment','tool'];
export function createStoreUI({document:doc,getState,canOpen,onOpen,onClose,onBuy,onGroceries,onWork}){
 const $=id=>doc.getElementById(id);let opened=false,category='all',previousFocus=null;
 $('storeOverlay').hidden=true;
 function refresh(){
  const p=getState().progress;
  $('storeBalance').textContent=money(p.cash);
  $('storeCapacity').textContent=`Bag ${p.inventory.slots.length} / ${inventoryCapacity(p.inventory)} slots`;
  $('storeGroceries').disabled=p.cash<400||p.life.groceries>=20;
  $('storeItems').replaceChildren();
  for(const item of ITEMS.filter(item=>isBuyable(item)&&(category==='all'||item.type===category))){
   const card=doc.createElement('article');card.className='store-item';
   const icon=doc.createElement('span');icon.className='store-item-icon';icon.textContent=item.icon;
   const title=doc.createElement('h3');title.textContent=item.name;
   const effects=doc.createElement('p');effects.textContent=item.description?item.description:item.type==='equipment'?`+${item.slotBonus} slots · ${item.equipSlot}`:[['Food',item.foodRestore],['Thirst',item.thirstRestore],['Energy',item.energyRestore]].filter(([,n])=>n>0).map(([label,n])=>`${label} +${n}`).join(' · ');
   const button=doc.createElement('button');button.className='store-buy';button.id='buy-'+item.id;button.textContent='Buy · '+money(item.price);button.disabled=p.cash<item.price;button.setAttribute('aria-label',`Buy ${item.name} for ${money(item.price)}`);
   button.onclick=()=>transaction(onBuy(item.id));
   card.append(icon,title,effects,button);$('storeItems').append(card);
  }
  for(const name of FILTERS)$('storeFilter-'+name).setAttribute('aria-pressed',String(name===category));
 }
 function transaction(result){$('storeMessage').textContent=result?.error||result?.message||'';refresh()}
 function open(){
  if(opened||!canOpen())return;
  previousFocus=doc.activeElement;opened=true;category='all';onOpen();$('storeOverlay').hidden=false;$('storeMessage').textContent='';refresh();$('storeClose').focus();
 }
 function close(){if(!opened)return;opened=false;$('storeOverlay').hidden=true;onClose();previousFocus?.focus?.()}
 for(const name of FILTERS)$('storeFilter-'+name).onclick=()=>{category=name;refresh()};
 $('storeClose').onclick=close;$('storeGroceries').onclick=()=>transaction(onGroceries());
 $('storeWork').onclick=()=>{close();onWork()};
 return {open,close,get isOpen(){return opened}};
}
