// plank-delivery.js: delivery pay & run size (planks-economy-design P-D).
import {PLANK_BASE_CENTS,PLANKS_PER_STACK,PAY,OLD_PAY,PLANK_PLACES} from './plank-economy.js';
import {BEDS,CARGO_KINDS,hasBed,spaceOf,capacity,usedSpace,hasCrates,CRATE_MIX,addPlanks} from './cargo.js';

const freeze=Object.freeze;
export const BASE_PLANK_CENTS=PLANK_BASE_CENTS;
export const DELIVERY_PAY_PER_PLANK=PAY.plankDelivered;
export const OLD_DELIVERY_PAY=OLD_PAY.orderDelivery;
export const DELIVERY_PRICE_RATIO=PAY.plankDelivered/PLANK_BASE_CENTS;
export const DOLLAR_CENTS=100;
export const BED_RUN_PLANKS=freeze(Object.fromEntries(Object.keys(BEDS).map(m=>[m,spaceOf(m)])));
export const BED_FIT_PLANKS=freeze(Object.fromEntries(Object.keys(BEDS).map(m=>{
 const mp=BEDS[m].maxPieces;return [m,Math.min(capacity(m,'planks'),Number.isFinite(mp)?mp*PLANKS_PER_STACK:Infinity)];
})));
export const REFUSAL=freeze({
 NO_BED:'This vehicle has no bed.',
 CRATE_MIX,
 ZERO_ORDER:'There are no planks to deliver.',
 NO_STOCK:'There are no staged planks to load.',
 BED_FULL:'The bed is full.',
 OVERFULL:'The order does not fit on that bed.'
});

const clampInt=(v,lo,hi)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.floor(v))):0;
const posCents=v=>Number.isFinite(v)&&v>0?Math.round(v):0;

function resolveBed(vehicleOrBed){
 if(typeof vehicleOrBed==='string'){
  const m=vehicleOrBed.trim();
  return hasBed(m)?{model:m,bed:BEDS[m],cargo:null}:null;
 }
 if(vehicleOrBed&&typeof vehicleOrBed==='object'&&!Array.isArray(vehicleOrBed)){
  const m=typeof vehicleOrBed.model==='string'?vehicleOrBed.model.trim():(typeof vehicleOrBed.id==='string'?vehicleOrBed.id.trim():'');
  if(m&&hasBed(m))return {model:m,bed:BEDS[m],cargo:Array.isArray(vehicleOrBed.cargo)?vehicleOrBed.cargo:null};
  if(Number.isFinite(vehicleOrBed.space)&&vehicleOrBed.space>0){
   return {model:m||'custom',bed:{space:Math.floor(vehicleOrBed.space),maxPieces:Number.isFinite(vehicleOrBed.maxPieces)?vehicleOrBed.maxPieces:Infinity},cargo:Array.isArray(vehicleOrBed.cargo)?vehicleOrBed.cargo:null};
  }
 }
 return null;
}

export function bedCapacity(vehicleOrBed){
 const r=resolveBed(vehicleOrBed);
 if(!r)return 0;
 const sp=Math.max(0,Math.floor(r.bed.space/CARGO_KINDS.planks.space));
 const mp=Number.isFinite(r.bed.maxPieces)?r.bed.maxPieces*PLANKS_PER_STACK:Infinity;
 return Math.min(sp,mp);
}

export function remainingBedPlanks(vehicleOrBed,cargo=null){
 const r=resolveBed(vehicleOrBed);
 if(!r)return 0;
 const c=Array.isArray(cargo)?cargo:r.cargo;
 if(hasCrates(c))return 0;
 const freeSpace=Math.max(0,Math.floor((r.bed.space-usedSpace(c))/CARGO_KINDS.planks.space));
 const mp=Number.isFinite(r.bed.maxPieces)?Math.max(0,r.bed.maxPieces-(c?c.length:0))*PLANKS_PER_STACK:Infinity;
 const byCount=Math.min(freeSpace,mp);
 if(hasBed(r.model)){
  for(let n=byCount;n>=1;n--)if(!addPlanks(c,r.model,n).error)return n;
  return 0;
 }
 return byCount;
}

export function plankPriceOf(priceTable,placeOrKey='warehouse'){
 if(typeof priceTable==='number')return posCents(priceTable)||PLANK_BASE_CENTS;
 const place=PLANK_PLACES[placeOrKey]||placeOrKey;
 if(Array.isArray(priceTable)){
  const hit=priceTable.find(e=>e&&(e.key===placeOrKey||e.place===place||e.place===placeOrKey)&&posCents(e.priceCents)>0)
   ||priceTable.find(e=>e&&(e.key==='warehouse'||e.place===PLANK_PLACES.warehouse)&&posCents(e.priceCents)>0)
   ||priceTable.find(e=>e&&posCents(e.priceCents)>0);
  return hit?posCents(hit.priceCents):PLANK_BASE_CENTS;
 }
 if(priceTable&&typeof priceTable==='object'){
  for(const k of [placeOrKey,place,'warehouse',PLANK_PLACES.warehouse,'priceCents','planks']){
   const raw=priceTable[k];
   const v=typeof raw==='number'?raw:raw?.priceCents;
   if(posCents(v)>0)return posCents(v);
  }
 }
 return PLANK_BASE_CENTS;
}

function parseOrder(order,opts={}){
 if(order===undefined)return {omitted:true,planks:0,available:Infinity,kind:'delivery'};
 if(typeof order==='number')return {omitted:false,planks:clampInt(order,0,1e6),available:Infinity,kind:'delivery'};
 if(!order||typeof order!=='object'||Array.isArray(order))return {omitted:false,planks:0,available:0,kind:null};
 const planks=clampInt(order.planks??order.count??0,0,1e6);
 const staged=Number.isFinite(order.staged)?clampInt(order.staged,0,1e6):Infinity;
 const moved=Number.isFinite(order.moved)?clampInt(order.moved,0,1e6):Infinity;
 const optAvail=Number.isFinite(opts?.availablePlanks)?clampInt(opts.availablePlanks,0,1e6):Infinity;
 const capByStaged=order.status==='loaded'||order.status==='staged'?planks:staged;
 return {omitted:false,planks,available:Math.min(planks,capByStaged,moved,optAvail),kind:order.kind||'delivery'};
}

export function runSize(vehicleOrBed,order,cargo=null){
 const free=remainingBedPlanks(vehicleOrBed,cargo);
 if(free<=0)return 0;
 const o=parseOrder(order);
 if(o.omitted)return free;
 const avail=Math.min(o.planks,o.available);
 return avail>0?Math.min(free,avail):0;
}

export function deliveryPay(planksMoved,priceTable,opts={}){
 const placeKey=opts?.placeKey||'warehouse';
 const priceCents=plankPriceOf(priceTable,placeKey);
 const unitPayCents=Math.round(priceCents*DELIVERY_PRICE_RATIO);
 const cap=Number.isFinite(opts?.availablePlanks)?clampInt(opts.availablePlanks,0,1e6):Infinity;
 const moved=Math.min(clampInt(planksMoved,0,1e6),cap);
 if(moved<=0)return freeze({planks:0,priceCents,unitPayCents,rawCents:0,payCents:0,payDollars:0});
 const rawCents=moved*unitPayCents;
 const payDollars=Math.round(rawCents/DOLLAR_CENTS);
 const payCents=payDollars*DOLLAR_CENTS;
 return freeze({planks:moved,priceCents,unitPayCents,rawCents,payCents,payDollars});
}

export function refusalReason(vehicleOrBed,order,cargo=null,opts={}){
 const r=resolveBed(vehicleOrBed);
 if(!r)return REFUSAL.NO_BED;
 const c=Array.isArray(cargo)?cargo:r.cargo;
 if(hasCrates(c))return REFUSAL.CRATE_MIX;
 const o=parseOrder(order,opts);
 if(o.kind==='crate')return REFUSAL.CRATE_MIX;
 if(!o.omitted&&o.planks<=0)return REFUSAL.ZERO_ORDER;
 if(!o.omitted&&o.available<=0)return REFUSAL.NO_STOCK;
 const free=remainingBedPlanks(vehicleOrBed,c);
 if(free<=0)return REFUSAL.BED_FULL;
 if(!o.omitted&&!opts?.partial&&Math.min(o.planks,o.available)>free)return REFUSAL.OVERFULL;
 return null;
}

export function planDelivery(vehicleOrBed,priceTable,order,opts={}){
 const r=resolveBed(vehicleOrBed),c=Array.isArray(opts?.cargo)?opts.cargo:(r?.cargo||null);
 const bedCap=bedCapacity(vehicleOrBed),freeCap=remainingBedPlanks(vehicleOrBed,c);
 const o=parseOrder(order,opts),want=o.omitted?freeCap:o.planks,avail=o.omitted?freeCap:Math.min(want,o.available);
 const reason=refusalReason(vehicleOrBed,o.omitted?{planks:freeCap,status:'staged'}:order,c,opts);
 const load=reason&&reason!==REFUSAL.ZERO_ORDER&&reason!==REFUSAL.NO_STOCK&&opts?.partial&&freeCap>0&&avail>0?Math.min(freeCap,avail):(reason?0:Math.min(freeCap,avail));
 const pay=deliveryPay(load,priceTable,opts);
 const tripPlanks=freeCap>0?Math.min(freeCap,avail>0?avail:freeCap):0;
 const trips=freeCap>0&&avail>0?Math.ceil(avail/freeCap):0;
 return freeze({
  ok:!reason,
  model:r?.model||null,
  bedCapacity:bedCap,
  remainingCapacity:freeCap,
  runSize:tripPlanks,
  orderPlanks:want,
  moved:pay.planks,
  left:Math.max(0,avail-pay.planks),
  trips,
  priceCents:pay.priceCents,
  unitPayCents:pay.unitPayCents,
  rawCents:pay.rawCents,
  payCents:pay.payCents,
  payDollars:pay.payDollars,
  reason,
  error:reason
 });
}
