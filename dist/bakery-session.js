// W-J host rules for shared bakery gigs (notes/world-system-design.md).
import {isBakeryGood,isBakeryNeed,normalizeBakeryStock,SACKS_PER_PALLET} from './bakery-needs.js';
import {acceptsBakeryPallet} from './bakery-goods.js';
import {CLAIM_LAPSE_MIN,claim,dayOf,fill,needPay,needToSlot,normalizeNeeds,release,remainingOf} from './needs.js';
import {canTakeMore,WALK_M_PER_GAME_MIN} from './gig-pay.js';

export const BAKERY_ACTIONS=Object.freeze(['accept','load','cancel','deliver']);
export const BAKERY_ON_TIME_FACTOR=2,BAKERY_ON_TIME_EXTRA_MIN=10;
const NEED_PLAYER='player';

// Seed from the host's saved world or daily tick. Session ownership uses lobby IDs,
// so a saved offline claim must never be restored as an online reservation.
export function bakerySession(progress,claims=new Map()){
 const needs=normalizeNeeds(progress.needs).filter(isBakeryNeed).map(n=>({...n,claims:{}}));
 const open=new Set(needs.filter(n=>n.status==='open').map(n=>n.id));
 return {
  needs,
  stock:normalizeBakeryStock(progress.bakeryStock),
  claims:new Map([...claims].filter(([id])=>open.has(id)))
 };
}

const liveClaim=(session,id,now)=>{
 const claim=session.claims.get(id);
 return claim&&now-claim.at<CLAIM_LAPSE_MIN?claim:null;
};

const sizeOf=active=>active.mode==='vehicle'?SACKS_PER_PALLET:1;
const truckOf=(p,uid)=>p.vehicles?.find(v=>v.uid===uid&&!v.loan&&acceptsBakeryPallet(v.model));
function clearLoad(progress,active){
 const vehicles=active.truck?progress.vehicles?.map(v=>v.uid===active.truck
  ?{...v,cargo:v.cargo?.filter(c=>c.k!=='bakery-pallet'||c.j!==active.id)||null}:v):progress.vehicles;
 const carry=progress.carry?.kind==='sack'&&progress.carry.gig===active.id?null:progress.carry;
 return {...progress,gigs:{...progress.gigs,active:null},vehicles,carry};
}

function accept(p,need,now,position){
 const slot=needToSlot(need),g=p.gigs,done=g.doneDay===Math.floor((now-300)/1440)?g.doneToday||0:0;
 if(!slot||slot.expiresAt<=now||!canTakeMore(done))return {error:'This gig is unavailable.'};
 if(slot.mode==='vehicle'&&!p.vehicles?.some(v=>!v.loan&&acceptsBakeryPallet(v.model)))return {error:'This job needs a truck with a bed.'};
 const accepted=claim(p.needs,need.id,NEED_PLAYER,remainingOf(need),now);
 if(accepted.error)return accepted;
 const {origin,places,points,parM,mode,client,type}=slot;
 const active={id:g.nextId,type,client,origin,places,points,parM,mode,start:position,stage:0,visited:[false],
  acceptedAt:now,startedAt:now,dueAt:0,haul:0,truck:'',needId:need.id,needGood:need.good,needQty:accepted.claimed,
  needTitle:slot.title,needText:slot.description,onTimeMin:Math.ceil(parM/WALK_M_PER_GAME_MIN*BAKERY_ON_TIME_FACTOR+BAKERY_ON_TIME_EXTRA_MIN)};
 active.needReward=needPay(need,sizeOf(active),100,mode,parM,{day:dayOf(now),before:need.filled,doneToday:done,onTime:true}).total;
 return {state:{...p,needs:accepted.needs,gigs:{...g,nextId:g.nextId+1,active}}};
}

function loadCargo(p,need,active,now,options){
 if(active.haul>0)return {error:'Already loaded.'};
 const units=sizeOf(active),pallet=active.mode==='vehicle';
 const truck=pallet?truckOf(p,options.uid):null;
 if(pallet&&!truck)return {error:'Park your truck with an open bed by the Wholesale dock.'};
 if(pallet&&(options.bed??truck.cargo)?.length)return {error:'Clear the truck bed before loading the bakery pallet.'};
 if(!pallet&&p.carry)return {error:'Put down what you are carrying before picking up a sack.'};
 if(remainingOf(need)<units||active.needQty<units)return {error:'There is no room for this load.'};
 const loaded=claim(p.needs,need.id,NEED_PLAYER,units,now);
 if(loaded.error||loaded.claimed!==units)return {error:loaded.error||'Already claimed by others.'};
 const next={...active,haul:units,truck:truck?.uid||'',pickedAt:now};
 const state={...p,needs:loaded.needs,gigs:{...p.gigs,active:next}};
 if(pallet)state.vehicles=p.vehicles.map(v=>v.uid===truck.uid?{...v,cargo:[{k:'bakery-pallet',g:need.good,j:active.id}]}:v);
 else state.carry={kind:'sack',good:need.good,gig:active.id};
 return {state,units,message:pallet?'Pallet loaded at Eden Wholesale.':'Sack picked up at Eden Wholesale.'};
}

function deliver(p,need,active,now){
 if(!(active.haul>0))return {error:'You are not carrying anything for the shop.'};
 const loaded=active.truck?truckOf(p,active.truck)?.cargo?.some(c=>c.k==='bakery-pallet'&&c.g===need.good&&c.j===active.id)
  :p.carry?.kind==='sack'&&p.carry.good===need.good&&p.carry.gig===active.id;
 if(!loaded)return {error:'Bring the bakery load with you.'};
 const result=fill(p.needs,p.world,need.id,NEED_PLAYER,active.haul,now,{carried:true});
 if(!result.units)return {error:'Nothing could be delivered.'};
 const elapsedMin=now-active.pickedAt,g=p.gigs;
 const paid=needPay(need,result.units,100,active.mode,active.parM,{
  day:dayOf(now),before:need.filled,doneToday:g.doneDay===Math.floor((now-300)/1440)?g.doneToday:0,
  onTime:elapsedMin<=active.onTimeMin,elapsedMin
 }).total;
 const stock=normalizeBakeryStock(p.bakeryStock);
 stock[need.good]+=result.units;
 return {paid,units:result.units,state:{...clearLoad(p,active),cash:p.cash+paid,
  bakeryStock:normalizeBakeryStock(stock),needs:release(result.needs,need.id,NEED_PLAYER)}};
}

// The caller supplies current time and player progress from the authority. The
// command itself carries only intent, a stable need ID and the player's gig ID.
// The caller checks street/dock reach and vehicle placement before load/deliver.
export function applyBakeryAction(session,player,command,{now,position=null,load={}}){
 const {id,progress}=player;
 const {type,needId,gigId}=command;
 if(!BAKERY_ACTIONS.includes(type)||!Number.isFinite(now)||!id||
    !Number.isSafeInteger(gigId)||gigId<1)return {error:'Invalid bakery action.'};
 const need=session.needs.find(n=>n.id===needId);
 const owner=liveClaim(session,needId,now);
 const active=progress.gigs?.active;
 const outOfDate={error:'This bakery gig is no longer yours.'};
 if(type==='accept'){
  if(!need||need.status!=='open')return {error:'This gig is unavailable.'};
  if(owner)return {error:'Another player has already claimed this gig.'};
  if(gigId!==progress.gigs?.nextId||active)return {error:'This gig cannot be accepted.'};
 }else if(active?.id!==gigId||active.needId!==needId||!isBakeryGood(active.needGood)){
  return outOfDate;
 }else if(owner?.id!==id||owner.gigId!==gigId){
  // A player can always clear their own stale cargo, without touching a new claim.
  if(type!=='cancel')return outOfDate;
  return {text:'You gave the job up.',session,state:clearLoad(progress,active)};
 }

 const projected={
  ...progress,
  bakeryStock:session.stock,
  needs:[{...need,claims:owner?{[NEED_PLAYER]:{qty:owner.qty,at:owner.at}}:{}}]
 };
 let result;
 if(type==='accept'){
  result=accept(projected,need,now,position);
 }else if(type==='load'){
  result=loadCargo(projected,need,active,now,load);
 }else if(type==='deliver'){
  result=deliver(projected,need,active,now);
 }else{
  result={text:'You gave the job up.',state:{...clearLoad(projected,active),needs:release(projected.needs,need.id,NEED_PLAYER)}};
 }
 if(result.error)return result;

 const [updated]=result.state.needs;
 const claims=new Map(session.claims);
 const reservation=updated.claims[NEED_PLAYER];
 if(reservation)claims.set(needId,{id,gigId,...reservation});
 else claims.delete(needId);
 return {
  ...result,
  session:{
   needs:session.needs.map(n=>n.id===needId?{...updated,claims:{}}:n),
   stock:result.state.bakeryStock,
   claims
  },
  state:{...result.state,needs:progress.needs}
 };
}
