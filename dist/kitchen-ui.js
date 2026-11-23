// Kitchen & 20-slot Fridge overlay controller (notes/cooking-design.md).
import {RECIPES,COOKING_INGREDIENTS,canCook} from './recipes.js';
import {itemById} from './items.js';
import {fillIcon} from './item-icon.js';
import {inventoryCapacity} from './inventory.js';

const slotsOf=inv=>Array.isArray(inv)?inv:Array.isArray(inv?.slots)?inv.slots:[];
const countIn=(slots,id)=>slots.reduce((n,s)=>n+(s?.id===id&&Number.isInteger(s.quantity)&&s.quantity>0?s.quantity:0),0);

export function canCookFromPools(inventory,fridge,recipe){
 const combined=[...slotsOf(inventory),...slotsOf(fridge)];
 return canCook(combined,recipe);
}

export function consumeFromPools(inventory,fridge,recipe){
 if(!canCookFromPools(inventory,fridge,recipe))return null;
 const need=Object.fromEntries(recipe.ingredients.map(req=>[req.id,req.qty]));
 const pull=slots=>{
  const out=[];
  for(const s of slotsOf(slots)){
   if(!s||typeof s!=='object')continue;
   const rem=need[s.id]||0;
   if(rem<=0||!Number.isInteger(s.quantity)||s.quantity<=0){out.push({...s});continue}
   const take=Math.min(s.quantity,rem);
   need[s.id]=rem-take;
   if(s.quantity-take>0)out.push({...s,quantity:s.quantity-take});
  }
  return out;
 };
 const invSlots=pull(inventory),fridgeSlots=pull(fridge);
 const nextInv=Array.isArray(inventory)?invSlots:{...(inventory&&typeof inventory==='object'?inventory:{}),slots:invSlots};
 return {inventory:nextInv,fridge:fridgeSlots};
}

export function createKitchenUI({document:doc,getState,homeFridge,canOpen,onOpen,onClose,onCook,onStoreOne,onStoreAll,onTakeOne,onGroceries}){
 const $=id=>doc.getElementById(id);let opened=false,previousFocus=null,msgTimer=null;
 $('kitchenOverlay').hidden=true;
 const say=(text,kind='')=>{const el=$('kitchenMessage');el.textContent=text;el.dataset.kind=text?kind:'';clearTimeout(msgTimer);if(text){msgTimer=setTimeout(()=>say(''),5000);msgTimer.unref?.()}};
 const act=r=>{if(r?.error)say(r.error,'error');else if(r?.message)say('✓ '+r.message,'ok');refresh()};

 function refresh(){
  const p=getState().progress,inv=p.inventory,fridge=homeFridge(),cap=inventoryCapacity(inv);
  $('kitchenSummary').textContent=`Fridge: ${fridge.length}/20 slots · Bag: ${inv.slots.length}/${cap} slots`;
  $('kitchenFridgeCap').textContent=`(${fridge.length}/20)`;
  $('kitchenBagCap').textContent=`(${inv.slots.length}/${cap})`;
  const gro=$('kitchenGroceries');
  if(gro){gro.hidden=!(p.life?.groceries>0);gro.textContent=`Cook grocery pack (${p.life?.groceries||0})`}

  const recWrap=$('kitchenRecipes');recWrap.replaceChildren();
  for(const r of RECIPES){
   const ready=canCookFromPools(inv,fridge,r);
   const card=doc.createElement('article');card.className='kitchen-recipe'+(ready?' ready':'');
   const head=doc.createElement('div');head.className='kitchen-rec-head';
   const title=doc.createElement('h4');title.textContent=r.name;
   const meta=doc.createElement('span');meta.className='kitchen-rec-meta';meta.textContent=`${r.cookSec}s · ${r.gameMinutes}m`;
   head.append(title,meta);
   const ings=doc.createElement('div');ings.className='kitchen-ings';
   for(const req of r.ingredients){
    const have=countIn(inv.slots,req.id)+countIn(fridge,req.id);
    const pill=doc.createElement('span');pill.className='kitchen-ing '+(have>=req.qty?'have':'miss');
    pill.textContent=`${itemById(req.id)?.name||req.id} ${have}/${req.qty}`;
    ings.append(pill);
   }
   const stats=doc.createElement('p');stats.className='kitchen-rec-stats';
   const yld=[['Food',r.food],['Thirst',r.thirst],['Energy',r.energy]].filter(([,v])=>v>0).map(([k,v])=>`${k} +${v}`).join(' · ');
   stats.textContent=yld+` · +${r.xp} Hospitality`+(r.packItem?' · Packable':'');
   const btn=doc.createElement('button');btn.className='kitchen-cook';btn.id='cook-'+r.id;
   btn.textContent=ready?'Cook '+r.name:'Missing ingredients';btn.disabled=!ready;
   btn.onclick=()=>{close();onCook(r)};
   card.append(head,ings,stats,btn);recWrap.append(card);
  }

  const fWrap=$('kitchenFridge');fWrap.replaceChildren();
  if(!fridge.length){const empty=doc.createElement('p');empty.className='kitchen-empty';empty.textContent='Fridge is empty. Store ingredients from your bag.';fWrap.append(empty)}
  for(const s of fridge){
   const item=itemById(s.id);
   const row=doc.createElement('div');row.className='kitchen-slot';
   const icon=doc.createElement('span');icon.className='kitchen-slot-icon';if(item)fillIcon(icon,item);
   const lbl=doc.createElement('span');lbl.className='kitchen-slot-name';lbl.textContent=`${item?.name||s.id} ×${s.quantity}`;
   const take=doc.createElement('button');take.textContent='To bag';take.onclick=()=>act(onTakeOne(s.id));
   row.append(icon,lbl,take);fWrap.append(row);
  }

  const bWrap=$('kitchenBag');bWrap.replaceChildren();
  const bagIngs=inv.slots.filter(s=>COOKING_INGREDIENTS.includes(s.id)||s.id==='cat-food');
  $('kitchenStoreAll').disabled=!bagIngs.length;
  if(!bagIngs.length){const empty=doc.createElement('p');empty.className='kitchen-empty';empty.textContent='No cooking ingredients in bag.';bWrap.append(empty)}
  for(const s of bagIngs){
   const item=itemById(s.id);
   const row=doc.createElement('div');row.className='kitchen-slot';
   const icon=doc.createElement('span');icon.className='kitchen-slot-icon';if(item)fillIcon(icon,item);
   const lbl=doc.createElement('span');lbl.className='kitchen-slot-name';lbl.textContent=`${item?.name||s.id} ×${s.quantity}`;
   const put=doc.createElement('button');put.textContent='To fridge';put.onclick=()=>act(onStoreOne(s.id));
   row.append(icon,lbl,put);bWrap.append(row);
  }
 }

 function open(){
  if(opened||(canOpen&&!canOpen()))return;
  previousFocus=doc.activeElement;opened=true;onOpen?.();$('kitchenOverlay').hidden=false;say('');refresh();$('kitchenClose').focus?.();
 }
 function close(){
  if(!opened)return;
  opened=false;say('');$('kitchenOverlay').hidden=true;onClose?.();previousFocus?.focus?.();
 }
 $('kitchenClose').onclick=close;
 $('kitchenStoreAll').onclick=()=>act(onStoreAll());
 if($('kitchenGroceries'))$('kitchenGroceries').onclick=()=>{close();onGroceries?.()};
 return {open,close,refresh,get isOpen(){return opened}};
}
