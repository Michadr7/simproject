// Gigs (notes/gigs-starter-design.md section 3): pure rules, no DOM. Money is integer cents. Times are game minutes.
// The board is DERIVED from counters (day, slot, completed count), never Math.random, so a save always shows the same board and tests can pin it.
// ctx = {clients:[{id,name}], places:[{id,x,z,room}]}; the default is built lazily from the town (population.js + orders.js dropSpot).
import {townPopulation} from './population.js';
import {dropSpot} from './orders.js';
import {propertyById} from './properties.js';import {normalizeDrop,PARCEL_FIRST,PARCEL_PICKUP_FIRST,PARCEL_ON_BED} from './gig-parcel.js';
import {payFor as payGig,parMetres,meetsMinPar,canTakeMore,fatigueFactor,WALK_M_PER_GAME_MIN,FASTEST_M_PER_GAME_MIN,HANDLING_C,MIN_PAR_M} from './gig-pay.js'; // G-B (notes/gig-overhaul-design.md): pay, par, daily fatigue live in gig-pay.js
// W-D2 (notes/world-system-design.md, Needs -> gigs): the board of normal play is the world's open needs; a need gig claims its need, fills it on completion and is paid by needPay.
import {needSlots,claim,fill,release,needPay,openNeeds,remainingOf,dayOf,isBoardable} from './needs.js';import {buy,deliver} from './world-state.js';import {CRATE_UNITS,PLACES as WORLD_PLACES,GOODS} from './world-goods.js';import {helped,gainStanding} from './npc-life.js';import {ROSTER} from './npc-roster.js';import {acceptsCrates,takesCrateGigs} from './cargo.js';import {PARCEL_PIECES_ENABLED,removeParcelPieces} from './cargo-items.js';
const T=(id,title,base,o={})=>Object.freeze({id,title,base,stops:1,rep:0,bed:false,limit:0,hard:false,...o});
export const GIG_TYPES=Object.freeze([
 T('grocery','Grocery run',1200,{limit:60,twist:'Deliver within 60 game minutes'}),
 T('parcel','Doorstep parcel',1000,{twist:'The client answers the door: the right answer tips',tip:[200,800]}),
 T('round','Round of three',2700,{stops:3,rep:10,twist:'Three drops in any order; par distance sets quality'}),
 T('rush','Rush envelope',2000,{limit:20,hard:true,twist:'Hard 20 minute limit; failing pays 0'}),
 T('fuel','Fuel rescue',1800,{rep:10,live:false,tip:[300,1000],twist:'Buy the fuel up front; the driver repays it plus a tip'}),
 T('fragile','Fragile haul',3500,{bed:true,live:false,twist:'Every hard knock breaks a piece'}),
 T('bulk','Bulk haul',4500,{bed:true,live:false,twist:'One long trip or two'}),
 T('chain','Chain errand',6000,{stops:3,rep:25,vehicle:true,live:false,limit:150,twist:'The supplier gave the wrong part'}),
 // W-D2: one type per need kind (handling fee from gig-pay HANDLING_C, one stop); only the needs board offers them (the hashed board skips `need` types). needPay does the real pay.
 T('need-restock','Restock run',1200,{need:true,handling:HANDLING_C.vehicle,twist:'The shop is running low'}),T('need-harvest','Harvest run',1200,{need:true,handling:HANDLING_C.vehicle,twist:'Bring in the harvest'}),
 T('need-errand','Neighbour errand',1000,{need:true,handling:HANDLING_C.walk,twist:'A neighbour needs a hand'}),T('need-clear','Clear the way',1000,{need:true,handling:HANDLING_C.walk,twist:'Something is in the way'}),
 T('need-repair','Repair job',1000,{need:true,handling:HANDLING_C.walk,twist:'Something is broken'}),T('need-tend','Tend the animals',1000,{need:true,handling:HANDLING_C.walk,twist:'The animals need looking after'}),
 T('need-tow','Tow job',1200,{need:true,handling:HANDLING_C.vehicle,twist:'A vehicle needs a tow'}),T('need-serve','Cover a shift',1000,{need:true,handling:HANDLING_C.walk,twist:'Someone has to serve'})
]);
export const CHORE_KINDS=Object.freeze(['clear','repair','tend','tow','serve']);
const NEEDS_PICKUP_KINDS=['restock','errand','harvest']; // audit A F4: goods needs with no pickup step (everything but the crate goods) paid out without the goods ever moving, so only crate goods reach the board
export const NEED_PLAYER='player',NO_WORK_POSTED='No work posted. Check back tomorrow.',NEEDS_TRUCK='Needs a truck';
const NAMES=Object.freeze(Object.fromEntries(ROSTER.map(r=>[r.id,r.name])));
export const typeById=id=>GIG_TYPES.find(t=>t.id===id)||null;
export const BOARD_SLOTS=4,SLOT_LIFE=90,SLOT_STAGGER=22,RECENT_MAX=30,CLIENT_REST_DAYS=2,PAIR_REST_DAYS=1,LARGE_REP=40,LARGE_MUL_PCT=140;
export const WORLD_SEED=7919; // the board hash uses this, never g.completed: every player in a world sees the same board
export const DAY_START_MIN=300; // a gig day starts at 05:00 (sleeping does not reset the daily count)
export const NO_MORE_WORK='No more work today.';
export const ON_TIME_FACTOR=2,ON_TIME_EXTRA_MIN=10; // on-time limit = par walking time x ON_TIME_FACTOR + ON_TIME_EXTRA_MIN game minutes (clock starts at pickup, else at accept)
export const LEGACY_CAP_C=3000; // an old active gig (no origin) pays its old flat base, clamped to this
export const STARTER_MIN_PAY_C=2500; // the beat-8 starter gigs pay at least $25 (notes/gigs-starter-design.md section 2)
export const STARTER_TYPES=Object.freeze(['grocery','parcel']);
export const MARKET_ORIGIN=Object.freeze({id:'market',name:'Corner Market',x:19,z:-6.3,room:'street'});
// Default pickup points (ctx.origins overrides). The town's own addresses are all within about 230 m par of each other, so with MIN_PAR_M.walk 300 only far pickups make a board:
// coordinates from notes/gigs-starter-design.md section 2 (gas station (156.5,-8.25)); the farm point is the open yard west of the porch (-80,-236.5): audit A F1 found the old centre (-62,-244) inside the farmhouse colliders, so a farm gig could never be finished; the porch (-62,-236.5) is reachable too but only 293 m par from the market (under the 300 m board minimum), the yard point is 300 m.
export const FARM_ORIGIN=Object.freeze({id:'farm',name:'Willow Farmhouse',x:-80,z:-236.5,room:'street'}),GAS_ORIGIN=Object.freeze({id:'gas',name:'the gas station',x:156.5,z:-8.25,room:'street'});
export const DEFAULT_ORIGINS=Object.freeze([MARKET_ORIGIN,FARM_ORIGIN,GAS_ORIGIN]);
export const dayKey=now=>Math.floor((now-DAY_START_MIN)/1440);
// A type's own limit (rush 20 min, grocery 60) never undercuts a sprint over the par route x 1.5, or a 300 m+ route would be impossible.
export const limitFloor=parM=>Math.ceil(Math.max(0,parM||0)/FASTEST_M_PER_GAME_MIN.walk*1.5);
export const onTimeLimit=parM=>Math.ceil(Math.max(0,parM||0)/WALK_M_PER_GAME_MIN*ON_TIME_FACTOR+ON_TIME_EXTRA_MIN);
export const gameMinutes=p=>((p.housing?.day||1)-1)*1440+(p.routine?.minutes||0);
const int=(v,lo,hi,d=0)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.floor(v))):d;
const hash=(...a)=>{let h=2166136261;for(const ch of a.join('|')){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;return (h>>>0)};
const pt=v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)?{id:typeof v.id==='string'?v.id.slice(0,60):'',x:Math.max(-2000,Math.min(2000,v.x)),z:Math.max(-2000,Math.min(2000,v.z)),room:typeof v.room==='string'?v.room.slice(0,24):'street',name:typeof v.name==='string'?v.name.slice(0,60):''}:null;
let defaultCtx=null;
const EXTRA_PLACES=[{id:'oak-18',name:'18 Oak Street',x:3.8,z:-7},{id:'alder-coffee',name:'Alder Coffee',x:36,z:-6.3},{id:'oak-laundry',name:'Oak Street Laundry',x:-10.2,z:-7}];
export function townContext(){
 if(defaultCtx)return defaultCtx;
 const pop=townPopulation(),clients=[],places=[],seen=new Set();
 for(const m of pop.people)if(m.resident&&m.home?.startsWith('property:')&&m.home!=='property:farm-house')clients.push({id:m.id,name:m.name,home:m.home.slice(9)});
 for(const c of clients){if(seen.has(c.home))continue;seen.add(c.home);const d=dropSpot(c.home);if(d)places.push({id:c.home,name:propertyById(c.home)?.name||'a house',x:d.x,z:d.z,room:'street'})}
 for(const e of EXTRA_PLACES)places.push({...e,room:'street'}); // the street's own addresses near the market: short walks
 return defaultCtx={clients,places};
}
export const freshGigs=()=>({rep:0,recent:[],active:null,nextId:1,taken:{},clientsSeen:{},pairsSeen:{},completed:0,doneToday:0,doneDay:-2});
// doneToday = gigs finished this game day (05:00 to 05:00), counted with doneDay = dayKey of the last one. Old saves have neither: 0.
export const doneTodayOf=(g,now)=>g&&g.doneDay===dayKey(now)?g.doneToday||0:0;
export const bumpDone=(g,now)=>({doneDay:dayKey(now),doneToday:doneTodayOf(g,now)+1});
export const noMoreWork=(p,now=gameMinutes(p))=>!canTakeMore(doneTodayOf(p.gigs,now));
const modeOfType=t=>t.vehicle||t.bed?'vehicle':'walk';
export function normalizeActive(v){
 const t=typeById(v?.type);if(!t||!Array.isArray(v.places))return null;
 const places=v.places.slice(0,3).map(pt);if(!places.length||places.some(x=>!x))return null;
 const origin=pt(v.origin),parM=origin&&Number.isFinite(v.parM)?int(v.parM,0,1e6):null,points=Array.isArray(v.points)?v.points.slice(0,3).map(pt):[];
 // origin null = an old save: the box counts as already picked up and the gig pays its old flat base (LEGACY_CAP_C).
 const need=t.need&&typeof v.needId==='string'&&v.needId?{needId:v.needId.slice(0,120),needGood:typeof v.needGood==='string'?v.needGood.slice(0,24):'',needQty:int(v.needQty,0,1000,0),needTitle:typeof v.needTitle==='string'?v.needTitle.slice(0,80):'',needText:typeof v.needText==='string'?v.needText.slice(0,240):'',haul:int(v.haul,0,1000,0),needReward:int(v.needReward,0,1e7,0),truck:typeof v.truck==='string'?v.truck.slice(0,40):''}:{}; // W-D2: a need gig keeps its need id, what it carries and in which truck
 return {...need,id:int(v.id,1,1e9,1),type:t.id,client:typeof v.client==='string'?v.client.slice(0,60):'',places,visited:places.map((_,i)=>v.visited?.[i]===true),stage:int(v.stage,0,places.length,0),startedAt:int(v.startedAt,0,1e9),dueAt:int(v.dueAt,0,1e9),quality:int(v.quality,0,100,100),knocks:int(v.knocks,0,100),metres:int(v.metres,0,1e6),tip:int(v.tip,0,100000),large:v.large===true,trips:int(v.trips,1,2,1),start:pt(v.start),drop:normalizeDrop(v.drop),
  origin,parM,points:points.length===places.length&&!points.some(x=>!x)?points:places.map(x=>({...x})),mode:v.mode==='vehicle'?'vehicle':'walk',acceptedAt:int(v.acceptedAt,0,1e9,int(v.startedAt,0,1e9)),pickedAt:Number.isFinite(v.pickedAt)&&origin?int(v.pickedAt,0,1e9):null,onTimeMin:int(v.onTimeMin,0,1e6),starter:v.starter===true};
}
export function normalizeGigs(v){
 const g=freshGigs();if(!v||typeof v!=='object')return g;
 g.rep=int(v.rep,0,100);g.nextId=int(v.nextId,1,1e9,1);g.completed=int(v.completed,0,1e9);
 g.recent=(Array.isArray(v.recent)?v.recent:[]).filter(r=>typeById(r?.type)&&Number.isFinite(r.at)&&r.at>=0).map(r=>({type:r.type,at:int(r.at,0,1e9)})).slice(-RECENT_MAX);
 for(let i=0;i<BOARD_SLOTS;i++)if(Number.isFinite(v.taken?.[i]))g.taken[i]=int(v.taken[i],0,1e9);
 for(const [k,d] of Object.entries(v.clientsSeen&&typeof v.clientsSeen==='object'?v.clientsSeen:{}).slice(0,60))if(Number.isFinite(d)&&k.length<=60)g.clientsSeen[k]=int(d,0,1e6);
 for(const [k,d] of Object.entries(v.pairsSeen&&typeof v.pairsSeen==='object'?v.pairsSeen:{}).slice(0,120))if(Number.isFinite(d)&&k.length<=160)g.pairsSeen[k]=int(d,0,1e6);
 g.doneDay=int(v.doneDay,-2,1e9,-2);g.doneToday=g.doneDay===-2?0:int(v.doneToday,0,1000,0);
 g.active=normalizeActive(v.active);return g;
}
// rep 0-100 to the pay multiplier: 1 normally; a large gig (rep 40+, more than one stop) keeps its x1.4. (The old rep bonus up to +30% is gone.)
export const repMulFor=(rep,large)=>large&&int(rep,0,100)>=LARGE_REP?LARGE_MUL_PCT/100:1;
// The old entry point, kept for gig-bridge/game.js: payFor(typeId,quality,doneToday,rep,tip,large,parM,starter) -> cents.
// parM given: gig-pay.payFor (handling + par x rate, fatigue by doneToday, x quality, x repMul). parM null (an old gig): the old flat base clamped to LEGACY_CAP_C, still x quality, fatigue, repMul.
// tip = the door dialog's tip, clamped to the type's range. Starter gigs ignore fatigue and pay at least STARTER_MIN_PAY_C.
export function payFor(typeId,quality,doneToday,rep,tip=0,large=false,parM=null,starter=false){
 const t=typeById(typeId);if(!t)return 0;
 const q=int(quality,0,100,100),done=starter?0:int(doneToday,0,1e6),mul=repMulFor(rep,large);
 let pay;
 if(Number.isFinite(parM))pay=payGig({mode:modeOfType(t),type:{handling:t.handling},parM,quality:q,repMul:mul,doneToday:done}).pay;
 else pay=Math.floor(Math.min(t.base,LEGACY_CAP_C)*q*Math.round(mul*100)*Math.round(fatigueFactor(done)*100)/1000000);
 if(starter)pay=Math.max(pay,STARTER_MIN_PAY_C);
 const range=t.tip;return pay+(range?Math.max(range[0],Math.min(range[1],int(tip,0,1e6))):0)*(tip>0?1:0);
}
export function qualityFor(typeId,f={}){
 if(typeId==='grocery'||typeId==='chain')return f.late?(typeId==='chain'?70:60):100;
 if(typeId==='rush')return f.late?0:100;
 if(typeId==='fragile')return Math.max(40,100-15*int(f.knocks,0,100));
 if(typeId==='round')return Math.max(0,100-10*Math.floor(Math.max(0,int(f.overPct,0,1000))/10));
 return 100;
}
export function parRoute(points,start){
 const perms=a=>a.length<2?[a]:a.flatMap((x,i)=>perms([...a.slice(0,i),...a.slice(i+1)]).map(r=>[x,...r]));
 let best=null;
 for(const order of perms(points.map((_,i)=>i))){let at=start,len=0;for(const i of order){len+=Math.hypot(points[i].x-at.x,points[i].z-at.z);at=points[i]}if(!best||len<best.length)best={order,length:len}}
 return best||{order:[],length:0};
}
// live:false types (the vehicle gigs and the fuel rescue) are defined but not offered until their code exists.
const unlocked=(g,type,p)=>type.live!==false&&!type.need&&type.rep<=g.rep&&(!type.bed&&!type.vehicle||hasBed(p));
const BED_MODELS=['worktruck','flatbed','shortbed','offroad'];
export const hasBed=p=>(p.vehicles||[]).some(v=>BED_MODELS.includes(v.model)&&!v.loan);
export const isLarge=(g,type)=>g.rep>=LARGE_REP&&type.stops>1;
// The route a gig walks: from the pickup through the stops in the shortest order. points = the stops in that order; parM = par metres (gig-pay.parMetres, slack included).
export function routeOf(origin,places){
 const order=parRoute(places,origin).order,points=order.map(i=>places[i]);
 return {points,parM:parMetres([origin,...points])};
}
const pairKey=(origin,places)=>origin.id+'>'+places.map(x=>x.id).join('+');
// ---- W-D2: the needs board and the egg run. The world lives in progress.world, the need list in progress.needs; a claim is held under NEED_PLAYER.
export const hasCrateBed=p=>(p.vehicles||[]).some(v=>!v.loan&&takesCrateGigs(v.model)); // Hal's loan truck belongs to the starter story: it never carries need crates
export const needsPickup=a=>!!a?.needId&&a.type==='need-restock'&&!!CRATE_UNITS[a.needGood]&&!(a.haul>0); // the crates are still at the farm
export const cratesFor=(good,units)=>CRATE_UNITS[good]?Math.ceil(Math.max(0,units)/CRATE_UNITS[good]):0;
export function needBoard(p,now=gameMinutes(p)){
 const list=openNeeds(p.needs||[]).filter(n=>isBoardable(n.kind)&&remainingOf(n)>0&&!n.claims[NEED_PLAYER]&&(n.dueDay+1)*1440>now);
 // goods that must travel (restock, harvest, errand) need a route of at least the walking minimum par, like every board gig since G-B; a chore (clear, repair, tend, tow, serve) is done where it is. Places with only a placeholder point (sawmill, forest, warehouse: parM 0 to 45 m) therefore stay off the board until W-E gives them real points.
 return needSlots(list,{names:NAMES},12).filter(s=>(CHORE_KINDS.includes(s.kind)||s.parM>=MIN_PAR_M.walk)&&(!NEEDS_PICKUP_KINDS.includes(s.kind)||!!CRATE_UNITS[s.good])).slice(0,BOARD_SLOTS).map((s,i)=>{const crate=s.type==='need-restock'&&!!CRATE_UNITS[s.good];return {...s,slot:i,mode:crate?'vehicle':s.mode,blocked:crate&&!hasCrateBed(p)?NEEDS_TRUCK:'',crates:crate?cratesFor(s.good,s.remaining):0}});
}
// What a need gig pays right now (the card shows it): needPay on a quality 100 on-time run. need = the live need record.
export function needReward(p,need,mode,parM,now=gameMinutes(p)){
 if(!need)return 0;return needPay(need,remainingOf(need),100,mode,parM,{day:dayOf(now),before:need.filled,doneToday:doneTodayOf(p.gigs,now),onTime:true}).total;
}
export const needOf=(p,a)=>a?.needId?(p.needs||[]).find(n=>n.id===a.needId)||null:null;
const slotReward=(p,s,now)=>needReward(p,(p.needs||[]).find(n=>n.id===s.needId),s.mode,s.parM,now);
export const slotOffer=(p,s,now=gameMinutes(p))=>({reward:slotReward(p,s,now),terms:s.blocked||`${s.remaining} ${s.good||'unit'}${s.crates?` (${s.crates} crate${s.crates===1?'':'s'})`:''} · due day ${s.expiresAt/1440}`});
// The board: BOARD_SLOTS slots, each with its own expiry staggered by SLOT_STAGGER; never two of one type; a type you just finished is skipped.
// Keyed on day/window/slot and WORLD_SEED only (not g.completed), so every player in a world sees the same board. Offers whose par is below MIN_PAR_M[mode] are dropped
// (a different client/place/type is tried first); a pair (pickup to drop) done today rests PAIR_REST_DAYS; at the daily hard stop the board is empty.
// opts.starter: the beat-8 starter gigs: grocery and parcel only, exempt from minimum par, fatigue and the hard stop; each slot is marked starter:true.
export function boardFor(p,now=gameMinutes(p),ctx=townContext(),opts={}){
 const g=p.gigs||freshGigs(),starter=opts.starter===true,last=g.recent.at(-1)?.type,day=Math.floor(now/1440);
 if(!starter&&!canTakeMore(doneTodayOf(g,now)))return [];
 if(!starter&&!opts.hashed)return needBoard(p,now); // W-D2: normal play posts the world's open needs, and nothing else (an empty board is fine); opts.hashed is the old derived board (tests only)
 const types=GIG_TYPES.filter(t=>unlocked(g,t,p)&&(!starter||STARTER_TYPES.includes(t.id))),origins=ctx.origins?.length?ctx.origins:DEFAULT_ORIGINS;
 const slots=[],usedT=new Set(),usedC=new Set();
 for(let i=0;i<BOARD_SLOTS;i++){
  const w=Math.floor((now+i*SLOT_STAGGER)/SLOT_LIFE),expiresAt=(w+1)*SLOT_LIFE-i*SLOT_STAGGER;
  if(g.taken[i]===w)continue;
  const pool=types.filter(t=>!usedT.has(t.id)&&t.id!==last);if(!pool.length)continue;
  const first=hash('t',w,i,WORLD_SEED)%pool.length,o0=hash('o',w,i,WORLD_SEED);let made=null;
  for(let ti=0;ti<pool.length&&!made;ti++){
   const type=pool[(first+ti)%pool.length],mode=modeOfType(type);
   for(let k=0;k<12&&!made;k++){
    const origin=pt(origins[(o0+k)%origins.length]); // each attempt moves to the next pickup point, so a far pickup is found
    const rested=ctx.clients.filter(c=>!usedC.has(c.id)&&!(c.id in g.clientsSeen&&day-g.clientsSeen[c.id]<CLIENT_REST_DAYS));
    const cl=rested.length?rested[hash('c',w,i,WORLD_SEED,k)%rested.length]:ctx.clients[0];
    const places=[],home=ctx.places.find(x=>x.id===cl?.home);for(let s=0;s<type.stops;s++)places.push(s===0&&home?home:ctx.places[hash('p',w,i,s,WORLD_SEED,k)%ctx.places.length]);
    const route=routeOf(origin,places);
    if(!starter&&!meetsMinPar(route.parM,mode))continue;
    const pk=pairKey(origin,places);if(!starter&&pk in(g.pairsSeen||{})&&day-g.pairsSeen[pk]<PAIR_REST_DAYS)continue;
    made={type,mode,cl,places,route,pair:pk,origin};
   }
  }
  if(!made)continue;
  usedT.add(made.type.id);if(made.cl)usedC.add(made.cl.id);
  slots.push({slot:i,window:w,expiresAt,type:made.type.id,client:made.cl?.id||'',clientName:made.cl?.name||'',places:made.places.map(x=>({...x})),large:isLarge(g,made.type),origin:{...made.origin},points:made.route.points.map(x=>({...x})),parM:made.route.parM,mode:made.mode,pair:made.pair,starter});
 }
 return slots;
}
export const starterBoard=(p,now,ctx)=>boardFor(p,now,ctx,{starter:true});
// Noah's counter shows only the grocery and parcel gigs of the board.
export const marketBoard=(p,now,ctx)=>boardFor(p,now,ctx).filter(s=>s.type==='grocery'||s.type==='parcel'||!!s.needId);
// opts.starter: take one of the starter gigs (exempt from the daily stop and minimum par). Records origin, ordered points, parM and acceptedAt on the active gig.
export function acceptGig(p,slot,now=gameMinutes(p),ctx,start=null,opts={}){
 const g=p.gigs||freshGigs(),starter=opts.starter===true;
 if(g.active)return {error:'Finish your active gig before accepting another.'};
 if(!starter&&noMoreWork(p,now))return {error:NO_MORE_WORK};
 const s=boardFor(p,now,ctx,{starter,hashed:opts.hashed}).find(x=>x.slot===slot);if(!s)return {error:'This gig is unavailable.'};
 if(s.needId){ // W-D2: a need gig claims its need (what is left of it) and keeps the need's id, title and text
  if(s.blocked)return {error:s.blocked==='Needs a truck'?'This job needs a truck with a bed.':s.blocked};
  const c=claim(p.needs||[],s.needId,NEED_PLAYER,s.remaining,now);if(c.error||c.claimed<1)return {error:c.error||'Already claimed by others.'};
  const active=normalizeActive({id:g.nextId,type:s.type,client:s.client,places:s.places.map(pt),startedAt:now,acceptedAt:now,dueAt:0,large:false,start,origin:s.origin,parM:s.parM,points:s.points,mode:s.mode,onTimeMin:onTimeLimit(s.parM),starter:false,needId:s.needId,needGood:s.good,needQty:c.claimed,needTitle:s.title,needText:s.description,haul:0,truck:'',needReward:slotReward(p,s,now)});
  return {state:{...p,needs:c.needs,gigs:{...g,active,nextId:g.nextId+1}}};
 }
 const t=typeById(s.type),places=s.places.map(pt),active=normalizeActive({id:g.nextId,type:s.type,client:s.client,places,startedAt:now,acceptedAt:now,dueAt:t.limit?now+Math.max(t.limit,s.origin?limitFloor(s.parM):0):0,large:s.large,start,origin:s.origin,parM:s.parM,points:s.points,mode:s.mode,onTimeMin:onTimeLimit(s.parM),starter});
 return {state:{...p,gigs:{...g,active,nextId:g.nextId+1,taken:{...g.taken,[slot]:s.window}}}};
}
// The player picks the box up at the origin (G-D calls this on E there, within PICKUP_RADIUS_M): the on-time and too-fast clocks start now. Old gigs (origin null) are already picked up.
export const PICKUP_RADIUS_M=2;
export const atPickup=(a,position,room='street')=>!!a?.origin&&a.pickedAt==null&&room===a.origin.room&&!!position&&Math.hypot(position.x-a.origin.x,position.z-a.origin.z)<=PICKUP_RADIUS_M;
export const pickedUp=a=>!!a&&(!a.origin||a.pickedAt!=null);
export function pickUpGig(p,now=gameMinutes(p)){
 const a=p.gigs?.active;if(!a)return {error:'You have no active gig.'};if(pickedUp(a))return {error:'Already picked up.'};
 return {state:{...p,gigs:{...p.gigs,active:{...a,pickedAt:now,dueAt:a.dueAt?now+Math.max(0,a.dueAt-(a.acceptedAt??now)):0}}}}; // FIX-R1: the deadline runs from the pickup, same total allowance
}
const near=(pos,pl)=>Math.hypot(pos.x-pl.x,pos.z-pl.z)<=1.35;
// Per frame: knocks and metres add up, and the player reaching a place ticks it off (round of three: any order, the rest in order). Only the pure state moves; completeGig pays.
export function tickGig(p,{position,room='street',dt=0,moving=false,knock=0,metres=0,now=gameMinutes(p),requirePickup=false,parcelAway=false}={}){ // parcelAway (gig-parcel.js parcelAway): the parcel is on a bed far from you, so no stop ticks off (audit #3)
 const g=p.gigs;if(!g?.active)return p;
 const a={...g.active,visited:[...g.active.visited]};a.knocks=Math.min(100,a.knocks+int(knock,0,10));a.metres=Math.min(1e6,a.metres+Math.max(0,Number.isFinite(metres)?metres:0));
 if(position&&!a.drop&&!(parcelAway&&!a.needId)&&!needsPickup(a)&&!(a.needId&&a.type==='need-restock'&&CRATE_UNITS[a.needGood])&&(!requirePickup||a.needId||pickedUp(a)))for(let i=0;i<a.places.length;i++){
  if(a.visited[i]||a.places[i].room!==room||!near(position,a.places[i]))continue;
  if(a.type!=='round'&&a.visited.slice(0,i).includes(false))continue;
  a.visited[i]=true;
 }
 a.stage=a.visited.filter(Boolean).length;
 if(typeById(a.type).hard&&a.dueAt&&pickedUp(a)&&now>a.dueAt)return failGig({...p,gigs:{...g,active:a}},now,'late');
 return {...p,gigs:{...g,active:a}};
}
// The parcel's door (design section 3): the client likes one of three ways of being greeted; the gig text hints which; the right answer tips 200 to 800 cents, the others tip nothing.
export const DOOR_STYLES=Object.freeze([{id:'quiet',label:'Knock quietly',hint:'works nights and sleeps days: knock quietly'},{id:'bell',label:'Ring the bell',hint:'likes a proper ring of the bell'},{id:'step',label:'Leave it on the step',hint:'is shy: just leave it on the step'}]);
export const doorStyle=client=>DOOR_STYLES[hash('door',client)%DOOR_STYLES.length];
export const doorTip=(client,id)=>200+100*(hash('tip',client,id)%7);
export const doorHint=(type,client,name)=>type==='parcel'?` ${name||'The client'} ${doorStyle(client).hint}.`:'';
export const doorChoices=a=>a?.type==='parcel'?DOOR_STYLES.map(s=>({id:s.id,label:s.label,tip:s.id===doorStyle(a.client).id?doorTip(a.client,a.id):0})):null;
export const gigDone=p=>!!p.gigs?.active&&p.gigs.active.stage>=p.gigs.active.places.length;
// C-B: the gig's parcel piece (hands or a bed) goes when the gig ends, but only when pieces are on (pieces: the test switch, default PARCEL_PIECES_ENABLED).
export const endParcel=(p,a,pieces=PARCEL_PIECES_ENABLED)=>pieces&&a&&!a.needId?removeParcelPieces(p,a.id):p;
export function failGig(p,now=gameMinutes(p),why='failed',pieces=PARCEL_PIECES_ENABLED){
 const g=p.gigs;if(!g?.active)return p;
 return endParcel({...p,gigs:{...g,active:null,rep:Math.max(0,g.rep-2)}},g.active,pieces);
}
// opts.tip: the dialog's tip in cents (clamped to the type's range); par: par route length for the round.
export function completeGig(p,now=gameMinutes(p),opts={}){
 const g=p.gigs,a=g?.active;if(!a)return {error:'You have no active gig.'};
 if(!gigDone(p))return {error:'Finish the marked stops first.'};if(a.drop)return {error:PARCEL_FIRST};if(!a.needId&&!pickedUp(a))return {error:PARCEL_PICKUP_FIRST};if(!a.needId&&opts.parcelAway)return {error:PARCEL_ON_BED}; // audit #3: the parcel sits on a bed far from you
 if(a.needId)return completeNeed(p,now,opts);
 const t=typeById(a.type),late=!!(t.limit&&a.dueAt&&now>a.dueAt);
 const pieces=opts.pieces===undefined?PARCEL_PIECES_ENABLED:!!opts.pieces;
 if(t.hard&&late)return {state:failGig(p,now,'late',pieces),paid:0,failed:true};
 let overPct=0;if(a.type==='round'&&opts.par>0){const walked=Math.max(0,a.metres);overPct=Math.max(0,Math.round((walked/opts.par-1)*100))}
 const quality=qualityFor(a.type,{late,knocks:a.knocks,overPct}),done=doneTodayOf(g,now),mul=repMulFor(g.rep,a.large);
 // A gig with an origin pays by gig-pay (handling + par, fatigue, tip, too fast = handling only). An old gig (origin null) pays its old flat base, clamped.
 let pay,tooFast=false,tip=0;const elapsed=now-(a.pickedAt??a.acceptedAt);
 if(a.origin&&Number.isFinite(a.parM)){
  const onTime=!late&&elapsed<=(a.onTimeMin||onTimeLimit(a.parM)),r=payGig({mode:a.mode,type:{handling:t.handling},parM:a.parM,quality,repMul:mul,doneToday:a.starter?0:done,generosity:opts.generosity||0,onTime,elapsedMin:a.starter?undefined:elapsed});
  pay=r.total;tooFast=r.tooFast;tip=r.tip;
  if(a.starter)pay=Math.max(pay,STARTER_MIN_PAY_C);
  if(t.tip&&opts.tip>0&&!tooFast)pay+=Math.max(t.tip[0],Math.min(t.tip[1],int(opts.tip,0,1e6))); // the door dialog's tip, as before
 }else pay=payFor(a.type,quality,a.starter?0:done,g.rep,opts.tip||0,a.large,null,a.starter);
 const rep=g.rep+(quality>=80?2:quality>=50?1:0),day=Math.floor(now/1440);
 const recent=[...g.recent,{type:a.type,at:now}].filter(r=>r.at>now-1440).slice(-RECENT_MAX);
 const pairsSeen=a.origin?{...g.pairsSeen,[pairKey(a.origin,a.places)]:day}:g.pairsSeen,count=a.starter?{doneDay:g.doneDay,doneToday:g.doneToday}:bumpDone(g,now);
 return {paid:pay,quality,tooFast,tip,state:endParcel({...p,cash:p.cash+pay,routine:{...p.routine,earned:(p.routine?.earned||0)+pay},gigs:{...g,active:null,rep:Math.min(100,rep),recent,completed:g.completed+1,clientsSeen:{...g.clientsSeen,[a.client]:day},pairsSeen,...count}},a,pieces)};
}

// ---- W-D2: finishing a need gig and the egg run's two handovers (all pure: state in, state out; game.js moves the crates on the truck).
// The gig is over without paying (abandoned, or its need closed under it): the claim goes, goods the player carried go back to the source (never lost), no rep change.
function giveBack(p,a){
 let {world,needs}=p;
 if(a.needId){needs=release(needs||[],a.needId,NEED_PLAYER);const n=(needs||[]).find(x=>x.id===a.needId);if(a.haul>0&&n?.origin&&world)world=deliver(world,n.origin,a.needGood,a.haul,null).world}
 return {...p,world,needs,gigs:{...p.gigs,active:null}};
}
export function abandonGig(p,pieces=PARCEL_PIECES_ENABLED){const a=p.gigs?.active;if(!a)return {error:'You have no active gig.'};let s=endParcel(giveBack(p,a),a,pieces);if(!a.needId&&typeById(a.type)?.hard&&pickedUp(a))s={...s,gigs:{...s.gigs,rep:Math.max(0,s.gigs.rep-2)}};return {state:s,text:'You gave the job up.'}} // audit A F9: giving up a rush gig you had already picked up costs the same rep as failing it
// After the daily tick: a need gig whose need closed (expired, or the shelf recovered) ends. Returns {state, text?}.
export function settleNeed(p){
 const a=p.gigs?.active;if(!a?.needId)return {state:p};const n=needOf(p,a);if(n&&n.status==='open')return {state:p};
 return {state:giveBack(p,a),text:`${a.needTitle||'The job'}: it was taken care of without you.`};
}
// E at the farm pile: take the goods out of the farm (the farm's stock goes DOWN now) and put them on the truck. opts {uid, maxUnits (what the bed holds)}.
export function pickNeedHaul(p,now=gameMinutes(p),opts={}){
 const a=p.gigs?.active;if(!a?.needId)return {error:'You have no job that needs loading.'};
 if(a.type!=='need-restock'||!CRATE_UNITS[a.needGood])return {error:'Nothing to load for this job.'};if(a.haul>0)return {error:'Already loaded.'};
 const need=needOf(p,a);if(!need||need.status!=='open')return {error:'That job is closed.'};
 const src=need.origin,have=p.world?.stock?.[src]?.[a.needGood]||0;
 if(have<1)return {error:a.needGood==='eggs'?'The coop is empty today.':'There is nothing to load today.'};
 const room=Number.isFinite(opts.maxUnits)?Math.max(0,Math.floor(opts.maxUnits)):1e9,want=Math.min(a.needQty,remainingOf(need),room);
 if(want<1)return {error:'The truck has no room for crates.'};
 const b=buy(p.world,src,a.needGood,want);if(b.sold<1)return {error:'The coop is empty today.'};
 const c=claim(p.needs,need.id,NEED_PLAYER,b.sold,now);if(c.error||c.claimed<1)return {error:c.error||'Already claimed by others.'};
 const label=WORLD_PLACES[src]?.label||'the farm',left=b.world.stock[src][a.needGood],n=cratesFor(a.needGood,b.sold);
 return {state:{...p,world:b.world,needs:c.needs,gigs:{...p.gigs,active:{...a,haul:b.sold,truck:typeof opts.uid==='string'?opts.uid.slice(0,40):'',pickedAt:now}}},units:b.sold,crates:n,left,message:`Loaded ${n} crate${n===1?'':'s'} (${b.sold} ${GOODS[a.needGood].unit}) · ${label} has ${left} left`};
}
// E at the market door with the truck beside it: hand the goods over and finish the gig (fill the need, pay, mood, standing).
export function deliverHaul(p,now=gameMinutes(p),opts={}){
 const a=p.gigs?.active;if(!a?.needId||a.type!=='need-restock'||!(a.haul>0))return {error:'You are not carrying anything for the shop.'};
 return completeGig({...p,gigs:{...p.gigs,active:{...a,visited:a.visited.map(()=>true),stage:a.places.length}}},now,opts);
}
function completeNeed(p,now,opts={}){
 const g=p.gigs,a=g.active,day=dayOf(now),need=needOf(p,a);
 if(!need||need.status!=='open')return {state:giveBack(p,a),paid:0,failed:true,closed:true};
 const crate=a.type==='need-restock'&&!!CRATE_UNITS[a.needGood];if(crate&&!(a.haul>0))return {error:'Load the goods first.'};
 const r=fill(p.needs,p.world,need.id,NEED_PLAYER,crate?a.haul:a.needQty,now,{carried:crate});if(r.units<1)return {error:'Nothing could be delivered.'};
 let world=r.world;const left=crate?a.haul-r.units:0;if(left>0&&need.origin)world=deliver(world,need.origin,a.needGood,left,null).world; // what the shelf could not take goes back to the farm
 const elapsed=now-(a.pickedAt??a.acceptedAt),onTime=elapsed<=(a.onTimeMin||onTimeLimit(a.parM)),pay=needPay(need,r.units,100,a.mode,a.parM,{day,before:need.filled,doneToday:doneTodayOf(g,now),generosity:opts.generosity||0,onTime,elapsedMin:elapsed});
 const npcs=p.npcs&&p.npcs[a.client]?{...p.npcs,[a.client]:helped(p.npcs[a.client],day)}:p.npcs,standing=a.client?gainStanding(p.standing,a.client,1,day):p.standing;
 const recent=[...g.recent,{type:a.type,at:now}].filter(x=>x.at>now-1440).slice(-RECENT_MAX),filled=r.needs.find(x=>x.id===need.id)?.status==='filled';
 return {paid:pay.total,quality:100,tooFast:pay.tooFast,tip:pay.tip,units:r.units,needFilled:filled,client:a.client,
  state:{...p,cash:p.cash+pay.total,routine:{...p.routine,earned:(p.routine?.earned||0)+pay.total},world,needs:release(r.needs,need.id,NEED_PLAYER),npcs,standing, // audit A F6: a partial delivery frees the player's claim (a left-over claim hid the need from the board until it expired)
   gigs:{...g,active:null,rep:Math.min(100,g.rep+2),recent,completed:g.completed+1,clientsSeen:{...g.clientsSeen,[a.client]:day},pairsSeen:a.origin?{...g.pairsSeen,[pairKey(a.origin,a.places)]:day}:g.pairsSeen,...bumpDone(g,now)}}};
}