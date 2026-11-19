// Idempotent migration of legacy life.groceries into fridge/inventory stacks (notes/cooking-design.md section 5, L-PURE).
import {BASE_SLOTS} from './inventory.js';
import {itemById} from './items.js';
import {addMessage} from './messages.js';

export const FRIDGE_SLOTS=20;
export const INGREDIENT_STACK=10;
export const PACK_REFUND_CENTS=400;
export const MIGRATE_MESSAGE='Your grocery packs have been unpacked into your kitchen fridge (plus cat food for your pet).';

function cloneSlots(list){
 if(!Array.isArray(list))return [];
 return list.filter(s=>s&&typeof s.id==='string'&&Number.isInteger(s.quantity)&&s.quantity>0).map(s=>({...s}));
}

function insertInto(slots,maxSlots,id,qty){
 let rem=qty;
 const out=cloneSlots(slots);
 for(const s of out){
  if(s.id!==id||s.quantity>=INGREDIENT_STACK)continue;
  const add=Math.min(rem,INGREDIENT_STACK-s.quantity);
  s.quantity+=add;rem-=add;
  if(rem<=0)return {slots:out,leftover:0};
 }
 while(rem>0&&out.length<maxSlots){
  const add=Math.min(rem,INGREDIENT_STACK);
  out.push({id,quantity:add});rem-=add;
 }
 return {slots:out,leftover:rem};
}

function bagCapacity(inv){
 const eq=inv?.equipment;
 if(!eq||typeof eq!=='object')return BASE_SLOTS;
 let bonus=0;
 for(const id of Object.values(eq))bonus+=itemById(id)?.slotBonus||0;
 return BASE_SLOTS+bonus;
}

function safeGameMinutes(p){
 const day=Number.isSafeInteger(p?.housing?.day)&&p.housing.day>=1?p.housing.day:1;
 const min=Number.isFinite(p?.routine?.minutes)&&p.routine.minutes>=0?Math.floor(p.routine.minutes):0;
 return (day-1)*1440+min;
}

function targetHome(p){
 if(p?.housing?.rented===true)return {kind:'housing'};
 const props=p?.properties;
 if(props&&typeof props==='object'){
  for(const id of Object.keys(props)){
   if(props[id]&&typeof props[id]==='object')return {kind:'property',id};
  }
 }
 return null;
}

export function migrateGroceries(progress){
 if(!progress||typeof progress!=='object')return progress;
 const raw=progress.life?.groceries;
 if(!Number.isFinite(raw)||raw<=0)return progress;
 const packs=Math.min(20,Math.floor(raw));
 if(packs<=0)return progress;

 const home=targetHome(progress);
 let fridgeSlots=home?(home.kind==='housing'?cloneSlots(progress.housing?.fridge):cloneSlots(progress.properties?.[home.id]?.fridge)):null;
 let invSlots=cloneSlots(progress.inventory?.slots);
 const invCap=bagCapacity(progress.inventory);

 const place=(id,qty)=>{
  let rem=qty;
  if(fridgeSlots){
   const res=insertInto(fridgeSlots,FRIDGE_SLOTS,id,rem);
   fridgeSlots=res.slots;rem=res.leftover;
  }
  if(rem>0){
   const res=insertInto(invSlots,invCap,id,rem);
   invSlots=res.slots;rem=res.leftover;
  }
  return rem;
 };

 let refundPacks=0;
 for(let i=0;i<packs;i++){
  const leftEggs=place('eggs',1);
  const leftProd=place('produce',1);
  if(leftEggs>0&&leftProd>0)refundPacks++;
 }
 const catFoodQty=Math.max(progress.pets?.pet?1:0,Math.ceil(packs/3));
 if(catFoodQty>0)place('cat-food',catFoodQty);

 let next={
  ...progress,
  cash:(Number.isSafeInteger(progress.cash)&&progress.cash>=0?progress.cash:0)+refundPacks*PACK_REFUND_CENTS,
  life:{...progress.life,groceries:0},
  inventory:{...(progress.inventory&&typeof progress.inventory==='object'?progress.inventory:{slots:[],equipment:{jacket:null,backpack:null}}),slots:invSlots}
 };
 if(home?.kind==='housing'){
  next={...next,housing:{...progress.housing,fridge:fridgeSlots}};
 }else if(home?.kind==='property'){
  next={...next,properties:{...progress.properties,[home.id]:{...progress.properties[home.id],fridge:fridgeSlots}}};
 }
 const msg=addMessage(next,{app:'player',text:MIGRATE_MESSAGE,at:safeGameMinutes(next)});
 return {...next,messages:msg.state.messages};
}
