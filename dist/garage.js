// The repair shop, repair kits and tows (VD4, notes/vehicle-damage-design.md section 4 and 12). Pure: no DOM, no three.js, no clock, no random. `now` is game hours (hoursNow(p) reads it from a progress); money is whole cents.
// Every rule takes a progress `p` and returns {state, message, ...} or {state: p, error}. It works on the SAVED vehicle list (progress.vehicles: uid, model, x, z, yaw, cond?), never on a loaded mesh, so a wreck left in an unloaded chunk is towable.
// A later repair JOB (jobs.js) calls the same quote/startRepair rules: nothing here knows who stands at the counter.
import {repairCents,repairHours,bandOf,percent,PERFECT} from './damage.js';
import {VEHICLE_PRICE} from './orders.js';
import {MAP} from './map-definition.js';
import {countItem} from './inventory.js';
import {advanceTime} from './routine.js';
import {BOG_PULL_CENTS,BOG_PULL_HOURS} from './surface-table.js';
export {BOG_PULL_CENTS,BOG_PULL_HOURS};
export const HARD_LUCK_DAYS=7; // a broke player gets one free tow and repair this often
export const HARD_LUCK_TO=400; // ...up to this condition (Worn: it drives, at 95% speed)
export const LIMPING_BELOW=150; // "nothing runs" means every vehicle is under this (Limping or Wrecked)
export const TOW_MIN_CENTS=7500,TOW_MAX_CENTS=25000,TOW_CENTS_PER_100M=1000; // $75 at the shop door up to $250 (reached at 1.75 km, about the map's width)
export const KIT_POINTS=150,KIT_CAP=400; // a repair kit: +15% condition, never above 40% (a wreck becomes Damaged and can crawl to the shop)
export const KIT_ITEM='repair-kit';
export const PARTIAL_TO=700; // "fix to 70%": the cheap option for a player short of cash (the start of the Fine band)
const SHOP_NAME='Eastbank repair shop';
const cash=n=>'$'+(n/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fixed3=n=>Math.round(n*1000)/1000;
const bay=()=>MAP.garage;
export const bayPose=()=>({x:bay().pose.x,z:bay().pose.z,yaw:+bay().pose.yaw.toFixed(3)}); // rounded like a saved pose
export const condOf=v=>Number.isInteger(v?.cond)&&v.cond>=0&&v.cond<PERFECT?v.cond:PERFECT; // missing = a perfect vehicle
export const priceOf=model=>VEHICLE_PRICE[model]||0;
export const PULL_FREE_DAYS=7; // TR4b: a player short of the pull-out fee gets one free pull-out this often (game days)
export const freshGarage=()=>({hardLuckDay:null,shop:{}}); // optional pullFreeAt (game hours of the last free pull-out) is added when used
export const hoursNow=p=>((p.housing?.day||1)-1)*24+(p.routine?.minutes||0)/60; // game hours since day 1, 0:00
export const dayOf=p=>Math.max(1,Math.floor(p.housing?.day||1));
// The save: {hardLuckDay: int|null, pullFreeAt?: game hours, shop: {uid: {readyAt: game hours, to: the condition it leaves at}}}. Additive: an old save has none and loads empty. Unknown uids and nonsense are dropped.
export function normalizeGarage(value,vehicles=[]){
 const out=freshGarage(),g=value&&typeof value==='object'?value:{};
 if(Number.isSafeInteger(g.hardLuckDay)&&g.hardLuckDay>=0&&g.hardLuckDay<=1e7)out.hardLuckDay=g.hardLuckDay;
 if(Number.isFinite(g.pullFreeAt)&&g.pullFreeAt>=0&&g.pullFreeAt<=1e9)out.pullFreeAt=fixed3(g.pullFreeAt);
 const shop=g.shop&&typeof g.shop==='object'&&!Array.isArray(g.shop)?g.shop:{};
 for(const v of Array.isArray(vehicles)?vehicles:[]){const e=Object.prototype.hasOwnProperty.call(shop,v.uid)?shop[v.uid]:null;
  if(e&&typeof e==='object'&&Number.isFinite(e.readyAt)&&e.readyAt>=0&&e.readyAt<=1e9&&Number.isInteger(e.to)&&e.to>condOf(v)&&e.to<=PERFECT)out.shop[v.uid]={readyAt:fixed3(e.readyAt),to:e.to}}
 return out;
}
const garageOf=p=>normalizeGarage(p.garage,p.vehicles);
const owned=p=>Array.isArray(p.vehicles)?p.vehicles:[];
const find=(p,uid)=>owned(p).find(v=>v.uid===uid)||null;
const nameOf=v=>MAP.vehicles.find(s=>s.model===v.model)?.name?.replace(/^Eastbank /,'')||v.model;
export const inShop=(p,uid)=>!!garageOf(p).shop[uid];
// Is the vehicle parked inside the marked bay (its centre inside the box)?
export const inBay=v=>!!v&&v.x>=bay().x0&&v.x<=bay().x1&&v.z>=bay().z0&&v.z<=bay().z1;
// ---- quotes ----
// The bill and the time to bring cond up to `to` (default: perfect). A partial repair is priced like a repair of that many points: full price share x the points restored (minimum $25), time likewise. Null when there is nothing to do.
export function quote(v,to=PERFECT){
 const cond=condOf(v),price=priceOf(v?.model);if(!price||!(to>cond)||to>PERFECT)return null;
 const gained=to-cond,cents=repairCents(price,PERFECT-gained),hours=repairHours(PERFECT-gained);
 return {cond,to,gained,cents,hours,price,pct:percent(cond),toPct:percent(to),band:bandOf(cond).id};
}
export const towFee=(from,to)=>Math.min(TOW_MAX_CENTS,TOW_MIN_CENTS+Math.round(Math.hypot(from.x-to.x,from.z-to.z)/100*TOW_CENTS_PER_100M));
export const hoursText=h=>{const m=Math.round(h*60),H=Math.floor(m/60),M=m%60;return H===0?`${M} min`:M===0?`${H} h`:`${H} h ${M} min`}; // e.g. 5 h 29 min
// ---- hard luck ----
// Nothing can run (every vehicle Limping or Wrecked), nothing is already in the shop, cash is short of the cheapest tow plus repair, and it has not been used in the last HARD_LUCK_DAYS days.
export function hardLuck(p){
 const list=owned(p),g=garageOf(p);if(!list.length||Object.keys(g.shop).length)return false;
 if(g.hardLuckDay!==null&&dayOf(p)-g.hardLuckDay<HARD_LUCK_DAYS)return false;
 if(!list.every(v=>condOf(v)<LIMPING_BELOW))return false;
 const cheapest=Math.min(...list.map(v=>repairCents(priceOf(v.model),condOf(v))+(inBay(v)?0:towFee(v,bayPose()))));
 return (p.cash||0)<cheapest;
}
// ---- repair ----
// What the counter offers for a vehicle parked in the bay: [{id, to, cents, hours, free?, label}] (full, the cheap 70% line, and the free hard-luck fix).
export function offers(p,uid){
 const v=find(p,uid);if(!v||!inBay(v)||inShop(p,uid)||condOf(v)>=PERFECT)return [];
 const out=[],full=quote(v);out.push({id:'full',to:PERFECT,cents:full.cents,hours:full.hours,label:`Repair fully · ${cash(full.cents)} · ${hoursText(full.hours)}`});
 if(condOf(v)<PARTIAL_TO){const q=quote(v,PARTIAL_TO);out.push({id:'partial',to:PARTIAL_TO,cents:q.cents,hours:q.hours,label:`Fix to ${q.toPct}% · ${cash(q.cents)} · ${hoursText(q.hours)}`})}
 if(hardLuck(p)){const q=quote(v,HARD_LUCK_TO);out.push({id:'free',to:HARD_LUCK_TO,cents:0,hours:q.hours,free:true,label:`Free fix to ${q.toPct}% (hard luck) · ${hoursText(q.hours)}`})}
 return out;
}
// Leave the vehicle with the shop: pay, and it is ready after the quoted game hours (`now`). `to` is the condition it leaves at; `free` is the hard-luck repair (cost 0, to HARD_LUCK_TO).
export function startRepair(p,uid,now,{to=PERFECT,free=false}={}){
 const fail=error=>({state:p,error}),v=find(p,uid);
 if(!v)return fail('You do not own that vehicle.');
 const g=garageOf(p);
 if(g.shop[uid])return fail(`The ${nameOf(v)} is already in the shop.`);
 if(!inBay(v))return fail(`Park the ${nameOf(v)} in the marked bay first.`);
 if(condOf(v)>=PERFECT)return fail(`The ${nameOf(v)} is in perfect shape.`);
 if(free&&!hardLuck(p))return fail('The shop cannot do that for free right now.');
 const target=free?HARD_LUCK_TO:to,q=quote(v,target);
 if(!q)return fail(`The ${nameOf(v)} is already at ${percent(condOf(v))}% or better.`);
 const cents=free?0:q.cents;
 if(!free&&(p.cash||0)<cents)return fail(`You need ${cash(cents)} to repair the ${nameOf(v)}.`);
 const shop={...g.shop,[uid]:{readyAt:fixed3(now+q.hours),to:target}};
 const state={...p,cash:p.cash-cents,garage:{...g,hardLuckDay:free?dayOf(p):g.hardLuckDay,shop}};
 return {state,quote:q,readyAt:shop[uid].readyAt,free,message:free?`The shop will fix the ${nameOf(v)} for free this time (to ${q.toPct}%, ${hoursText(q.hours)}). Next time it costs.`:`The ${nameOf(v)} is in the shop: ${cash(cents)}, ready in ${hoursText(q.hours)}.`};
}
// Is the repair finished at `now`? (false if it is not in the shop)
export const repairDone=(p,uid,now)=>{const e=garageOf(p).shop[uid];return !!e&&now>=e.readyAt};
export const hoursLeft=(p,uid,now)=>{const e=garageOf(p).shop[uid];return e?Math.max(0,+(e.readyAt-now).toFixed(2)):0};
// The shop's list: [{uid, model, name, readyAt, to, done}] in the order the vehicles are owned.
export const shopList=(p,now)=>{const g=garageOf(p);return owned(p).filter(v=>g.shop[v.uid]).map(v=>({uid:v.uid,model:v.model,name:nameOf(v),readyAt:g.shop[v.uid].readyAt,to:g.shop[v.uid].to,done:now>=g.shop[v.uid].readyAt}))};
// Take it back: when the time is up the vehicle is at its new condition and stands in the bay (`appear` is the pose; the game puts the mesh there).
export function collect(p,uid,now){
 const fail=error=>({state:p,error}),v=find(p,uid),g=garageOf(p),e=g.shop[uid];
 if(!v||!e)return fail('That vehicle is not in the shop.');
 if(now<e.readyAt)return fail(`The ${nameOf(v)} is not ready: ${hoursText(e.readyAt-now)} to go.`);
 const shop={...g.shop};delete shop[uid];
 const vehicles=owned(p).map(x=>{if(x.uid!==uid)return x;const y={...x,...bayPose()};delete y.cond;if(e.to<PERFECT)y.cond=e.to;return y});
 return {state:{...p,vehicles,garage:{...g,shop}},appear:{uid,...bayPose()},cond:e.to,message:`Your ${nameOf(v)} is ready: ${percent(e.to)}%.`};
}
// ---- repair kit (in the field) ----
export function useKit(p,uid){
 const fail=error=>({state:p,error}),v=find(p,uid);
 if(!v)return fail('You do not own that vehicle.');
 if(inShop(p,uid))return fail(`The ${nameOf(v)} is in the shop.`);
 if(countItem(p,KIT_ITEM)<1)return fail('You have no repair kit.');
 const cond=condOf(v);if(cond>=KIT_CAP)return fail(`A kit cannot fix more than ${percent(KIT_CAP)}%: take the ${nameOf(v)} to the shop.`);
 const next=Math.min(KIT_CAP,cond+KIT_POINTS),slots=[];let taken=false;
 for(const s of p.inventory.slots){if(!taken&&s.id===KIT_ITEM){taken=true;if(s.quantity>1)slots.push({...s,quantity:s.quantity-1})}else slots.push(s)}
 const vehicles=owned(p).map(x=>x.uid===uid?{...x,cond:next}:x);
 return {state:{...p,inventory:{...p.inventory,slots},vehicles},cond:next,message:`Repair kit used: the ${nameOf(v)} is at ${percent(next)}%${next>=KIT_CAP?' (a kit goes no further)':''}.`};
}
// ---- towing ----
// Tow a vehicle to `dest` ({x, z, yaw}; the shop bay for "Call a tow"). Works on saved data. Refused while you drive it or while it is in the shop. The fee comes from the straight-line distance; if hard luck applies and the destination is the shop, the tow is free and the shop starts the free repair too.
// `opts.drivenUid`: the vehicle being driven (if any); `opts.now`: game hours (needed for the free repair's ready time).
export function towTo(p,uid,dest,{drivenUid=null,now=hoursNow(p)}={}){
 const fail=error=>({state:p,error}),v=find(p,uid);
 if(!v)return fail('You do not own that vehicle.');
 if(drivenUid===uid)return fail('Get out of it first: a tow truck cannot take a vehicle you are driving.');
 if(inShop(p,uid))return fail(`The ${nameOf(v)} is already in the shop.`);
 if(![dest?.x,dest?.z,dest?.yaw].every(Number.isFinite))return fail('Nowhere to tow it to.');
 const toShop=dest.x===bay().pose.x&&dest.z===bay().pose.z;
 if(toShop&&inBay(v))return fail(`The ${nameOf(v)} is already at the shop.`);
 const free=toShop&&hardLuck(p),fee=free?0:towFee(v,dest);
 if(!free&&(p.cash||0)<fee)return fail(`A tow costs ${cash(fee)}: you have ${cash(p.cash||0)}.`);
 const moved={...v,x:+dest.x.toFixed(2),z:+dest.z.toFixed(2),yaw:+dest.yaw.toFixed(3)};
 let state={...p,cash:p.cash-fee,vehicles:owned(p).map(x=>x.uid===uid?moved:x)};
 if(free){const r=startRepair(state,uid,now,{free:true});if(r.error)return fail(r.error);
  return {state:r.state,fee:0,free:true,appear:{uid,x:moved.x,z:moved.z,yaw:moved.yaw},readyAt:r.readyAt,message:`The tow truck brought your ${nameOf(v)} to the shop. The shop fixed it for free this time. Next time it costs.`}}
 return {state,fee,free:false,appear:{uid,x:moved.x,z:moved.z,yaw:moved.yaw},message:`The tow truck brought your ${nameOf(v)} to ${toShop?'the shop':'where you asked'} for ${cash(fee)}.`};
}
// ---- pull me out (TR4, notes/terrain-vehicle-design.md section 2) ----
// The Call app's 'Pull me out': only for the vehicle you are driving while it is Stuck or on soft ground (vailable, from driving.bogOf). Costs BOG_PULL_CENTS and BOG_PULL_HOURS of game time (the clock moves on half an hour), puts the vehicle on dest (the nearest firm free pose, found by the game: never a blocked spot). A broke player in hard luck (hardLuck) gets it free and the weekly hard-luck day is NOT used up.
// TR4b: a broke player (cash under the fee) gets ONE free pull-out per PULL_FREE_DAYS game days, even in a healthy truck. It is independent of hardLuck: that path stays free and uses up neither; this one is recorded as garage.pullFreeAt (game hours).
export const pullFreeLeft=(p,now=hoursNow(p))=>{const at=garageOf(p).pullFreeAt;return at===undefined?0:Math.max(0,+(at+PULL_FREE_DAYS*24-now).toFixed(3))}; // game hours until the next free one (0 = ready)
export const pullFreeWeekly=(p,now=hoursNow(p))=>(p.cash||0)<BOG_PULL_CENTS&&pullFreeLeft(p,now)===0;
export const pullFee=(p,now=hoursNow(p))=>hardLuck(p)||pullFreeWeekly(p,now)?0:BOG_PULL_CENTS;
export function pullOut(p,uid,dest,{drivenUid=null,available=false,now=hoursNow(p)}={}){
 const fail=error=>({state:p,error}),v=find(p,uid);
 if(!v||drivenUid!==uid)return fail('A pull-out only works for the vehicle you are driving.');
 if(!available)return fail('You are not stuck: there is nothing to pull you out of.');
 if(![dest?.x,dest?.z,dest?.yaw].every(Number.isFinite))return fail('There is no firm ground nearby to pull you to.');
 const hl=hardLuck(p),weekly=!hl&&pullFreeWeekly(p,now),free=hl||weekly,fee=free?0:BOG_PULL_CENTS;
 if((p.cash||0)<fee)return fail(`A pull-out costs ${cash(fee)}: you have ${cash(p.cash||0)}. Rock it with W and S, or wait a few seconds.`);
 const moved={...v,x:+dest.x.toFixed(2),z:+dest.z.toFixed(2),yaw:+dest.yaw.toFixed(3)};
 let base={...p,cash:p.cash-fee,vehicles:owned(p).map(x=>x.uid===uid?moved:x)};
 if(weekly)base.garage={...garageOf(p),pullFreeAt:fixed3(now)};
 const state=advanceTime(base,BOG_PULL_HOURS*60);
 const next=weekly?` You are broke, so this one was free. The next free pull-out is in ${PULL_FREE_DAYS} game days.`:'';
 return {state,fee,free,weekly,hours:BOG_PULL_HOURS,appear:{uid,x:moved.x,z:moved.z,yaw:moved.yaw},message:free?`The tow truck pulled your ${nameOf(v)} out for free this time (half an hour lost).${next}`:`The tow truck pulled your ${nameOf(v)} out for ${cash(fee)} (half an hour lost).`};
}
// What the phone shows for one vehicle: the condition and the shop state, as {line, tow}: tow is the quote for "Call a tow" to the shop.
export function statusOf(p,uid,now=hoursNow(p)){
 const v=find(p,uid);if(!v)return null;
 const cond=condOf(v),e=garageOf(p).shop[uid],b=bandOf(cond);
 const line=e?(now>=e.readyAt?`Repair done: ready to collect at the ${SHOP_NAME}.`:`In the shop: ready in ${hoursText(e.readyAt-now)}.`):`Condition ${percent(cond)}% (${b.label}).`;
 return {line,inShop:!!e,ready:!!e&&now>=e.readyAt,readyAt:e?.readyAt??null,tow:e?null:hardLuck(p)?0:towFee(v,bayPose())};
}
