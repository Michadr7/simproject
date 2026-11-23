// W-J bakery lobby state and commands (notes/world-system-design.md).
import {applyBakeryAction,bakerySession,BAKERY_ACTIONS} from './bakery-session.js';
import {CLAIM_LAPSE_MIN} from './needs.js';
import {acceptsBakeryPallet} from './bakery-goods.js';
import {HOURS,TRUCK_BAY,worldPoint} from './eden-wholesale.js';
import {POSE} from './eden-wholesale-place.js';

export const BAKERY_REACH=2.5,BAKERY_TRUCK_REACH=5;
const bay=worldPoint(TRUCK_BAY,POSE);
const near=(a,b,r)=>!!a&&!!b&&Math.hypot(a.x-b.x,a.z-b.z)<=r;
const validMinute=n=>Number.isSafeInteger(n)&&n>=0&&n<144000000;
const validId=id=>typeof id==='string'&&id.length>0&&id.length<=80;
const day=now=>Math.floor(now/1440);

// The elected host publishes its world at the start and after its daily tick.
// The relay serializes transactions and retains the board across host handoff.
export function createBakeryLobby(snapshot){
 let state=snapshot?{...snapshot,claims:new Map(snapshot.claims)}:null;
 let now=snapshot?.now??0;
 let seedDay=snapshot?.seedDay??-1;
 const runs=new Map(snapshot?.runs);
 const accepted=new Map(snapshot?.accepted);
 const save=()=>state?{needs:state.needs,stock:state.stock,claims:[...state.claims],runs:[...runs],accepted:[...accepted],now,seedDay}:null;
 const board=()=>state?{type:'bakeryBoard',needs:state.needs,stock:state.stock,now,claims:[...state.claims].map(([id,c])=>[id,c.at+CLAIM_LAPSE_MIN,c.id])}:null;
 function seed(message,isHost){
  if(!isHost||!validMinute(message.now)||!Array.isArray(message.needs)||message.needs.length>8)return false;
  const worldDay=Number.isSafeInteger(message.worldDay)?message.worldDay:day(message.now);
  if(worldDay<0||worldDay>day(message.now)||state&&worldDay<=seedDay)return false;
  seedDay=worldDay;
  now=Math.max(now,message.now);
  state=bakerySession({needs:message.needs,bakeryStock:message.stock},state?.claims);
  for(const [id,run] of runs)if(!state.claims.has(run.gigs.active.needId))runs.delete(id);
  return true;
 }
 function leave(id){
  accepted.delete(id);
  if(!runs.delete(id))return false;
  for(const [key,claim] of state.claims)if(claim.id===id)state.claims.delete(key);
  return true;
 }
 function execute(player,message,clock){
  if(!validId(message.request)||!validId(message.needId)||!BAKERY_ACTIONS.includes(message.action)||
     !Number.isSafeInteger(message.gigId)||message.gigId<1)return null;
  const reply={type:'bakeryResult',request:message.request};
  const fail=error=>({...reply,error});
  if(!state)return fail('Waiting for the host’s bakery board.');
  const at=Math.max(now,clock??0);
  const running=runs.get(player.id),active=running?.gigs.active;
  const truck=message.truck;
  const ownedTruck=truck&&validId(truck.uid)&&acceptsBakeryPallet(truck.model);
  if(message.action==='accept'&&message.gigId<=(accepted.get(player.id)||0))return fail('This bakery job was already accepted.');
  const progress=running||{
   cash:0,routine:{},gigs:{active:null,nextId:message.gigId},
   vehicles:ownedTruck?[{uid:truck.uid,model:truck.model,cargo:[]}]:[]
  };
  if(!active&&message.action==='cancel')return {...reply,active:null,message:'You gave the job up.'};
  if(!active&&message.action!=='accept')return fail('This bakery gig is no longer yours.');
  const point=message.action==='load'?active?.origin:message.action==='deliver'?active?.places[0]:null;
  if(point&&(player.room!=='street'||!near(player.position,point,BAKERY_REACH)))return fail('Move closer to the bakery gig marker.');
  if(message.action==='load'){
   if(at%1440<HOURS[0]||at%1440>=HOURS[1])return fail('The Wholesale dock is closed.');
   if(active.mode==='vehicle'&&(!ownedTruck||truck.empty!==true||!near(truck,bay,BAKERY_TRUCK_REACH)))return fail('Park your truck with an empty bed at the Wholesale dock.');
   if(active.mode!=='vehicle'&&message.carrying===true)return fail('Put down what you are carrying first.');
  }
  if(message.action==='deliver'&&active.truck&&(!ownedTruck||truck.uid!==active.truck||!near(truck,point,BAKERY_TRUCK_REACH)))return fail('Bring the loaded truck to Ironwood Bakery.');
  const input=message.action==='load'&&ownedTruck?{...progress,vehicles:[{uid:truck.uid,model:truck.model,cargo:[]}]}:progress;
  // Daily limits are part of the player's existing local progression. The
  // relay takes the reported prior completion count, and computes the payout.
  const done=Number.isInteger(message.doneToday)?Math.max(0,Math.min(20,message.doneToday)):0;
  const result=applyBakeryAction(state,{id:player.id,progress:{...input,gigs:{...input.gigs,doneDay:Math.floor((at-300)/1440),doneToday:done}}},
   {type:message.action,needId:message.needId,gigId:message.gigId},{now:at,position:player.position,load:ownedTruck?{uid:truck.uid}:{}});
  if(result.error)return fail(result.error);
  state=result.session;
  now=at;
  if(message.action==='accept')accepted.set(player.id,message.gigId);
  if(result.state.gigs.active){
   // At most one active job per peer, and only active job/cargo data survives.
   runs.set(player.id,{cash:0,routine:{},gigs:{active:result.state.gigs.active},vehicles:result.state.vehicles,carry:result.state.carry});
  }else runs.delete(player.id);
  return {...reply,at,active:result.state.gigs.active,paid:result.paid||0,units:result.units||0,message:result.message||result.text||''};
 }
 return {save,board,seed,leave,execute};
}
