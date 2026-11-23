// bakery-needs.js: Ironwood Bakery flour and coffee-beans restock needs, cadence, fill, old plank-need expiry, and gig tracker text (stage B-PURE; pure, no DOM/three/globals).
// Implements owner decisions (2026-11-19) and notes/eval/outbox/bakery-goods-assets.md: bakery needs flour and coffee beans from Eden Wholesale instead of planks; houses keep planks.
// Pure rules: no globals, no Date.now/Math.random; imports demand and prices from bakery-goods.js (never copies them) and uses needs.js constants/helpers.
import {BAKERY,GOODS,GOOD_KEYS,DEMAND,SACKS_PER_PALLET,isBakeryGood,goodOf,priceOf,palletsOf} from './bakery-goods.js';
import {NAME as WHOLESALE_NAME} from './eden-wholesale.js';
import {LOW_FRAC,REFILL_FRAC,RESTOCK_CAP,DUE_DAYS,HYSTERESIS_DAYS,hashOf,keyOf,dayOf} from './needs.js';

export {BAKERY,GOODS,GOOD_KEYS,DEMAND,SACKS_PER_PALLET,isBakeryGood,goodOf,priceOf,palletsOf};
export {LOW_FRAC,REFILL_FRAC,RESTOCK_CAP,DUE_DAYS,HYSTERESIS_DAYS};
export const SUPPLIER='property:eden-wholesale',SUPPLIER_LABEL=WHOLESALE_NAME;
export const CADENCE_MOD=8;              // hash % 8 daily cadence (matches world-tick.js plank cadence)
export const MAX_OPEN_BAKERY_NEEDS=2;    // fewer than 2 open bakery needs at a time
export const MAX_NEW_PER_DAY=1;          // at most 1 new bakery need opened per day
export const CARRY_MODES=Object.freeze({sack:'hand',pallet:'vehicle'}); // sacks carried by hand slowly like crates; pallets by vehicle only

// Per-good demand at Ironwood Bakery, referenced directly from bakery-goods.js DEMAND (flour 6/18, coffee-beans 4/12).
export const BAKERY_DEMAND=Object.freeze(Object.fromEntries(GOOD_KEYS.map(k=>[k,DEMAND[k][BAKERY]])));
export const BAKERY_DAILY_USE=1;
export function normalizeBakeryStock(stock){return Object.fromEntries(GOOD_KEYS.map(g=>[g,clamp(isInt(stock?.[g])?stock[g]:0,0,BAKERY_DEMAND[g].max)]))}
const BAKERY_LABEL=BAKERY_DEMAND[GOOD_KEYS[0]].label;

const isInt=Number.isSafeInteger;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const cloneNeed=n=>({...n,claims:n.claims&&typeof n.claims==='object'?Object.fromEntries(Object.entries(n.claims).map(([k,v])=>[k,v&&typeof v==='object'?{...v}:v])):{} });

// Deterministic hash for a bakery need check on a given day (optional good salt).
export const bakeryDayHash=(seed,day,good='bakery')=>hashOf(isInt(seed)?seed:0,BAKERY,typeof good==='string'&&good?good:'bakery',isInt(day)&&day>=0?day:dayOf(day),'bakery-need');

// True when a need is a bakery flour/coffee-beans restock need.
export const isBakeryNeed=n=>!!n&&typeof n==='object'&&n.place===BAKERY&&isBakeryGood(n.good)&&(n.kind==='restock'||n.kind===undefined);

// True when a need is an open Ironwood Bakery plank need from an old save.
export const isOldBakeryPlankNeed=n=>!!n&&typeof n==='object'&&n.place===BAKERY&&n.good==='planks'&&n.status!=='filled'&&n.status!=='expired';

// Whole sacks to request for a bakery good when stock is below LOW_FRAC of target; 0 when not low or invalid.
// `goodOrDemand` accepts a good key ('flour'/'coffee-beans') or a {target,max} demand object.
export function qtyFor(goodOrDemand,stock,supplierStock=Infinity){
 const d=typeof goodOrDemand==='string'?BAKERY_DEMAND[goodOrDemand]:goodOrDemand;
 if(!d||!Number.isFinite(d.target)||!Number.isFinite(d.max)||!isInt(stock)||stock<0||stock>=d.target*LOW_FRAC)return 0;
 const sup=supplierStock===Infinity?Infinity:(isInt(supplierStock)&&supplierStock>=0?supplierStock:0);
 const want=Math.ceil(d.target*REFILL_FRAC)-stock,room=d.max-stock;
 const qty=Math.min(want,room,RESTOCK_CAP,sup);
 return qty>=1?qty:0;
}

// Whether a delivery of `qty` sacks needs a vehicle (whole pallet or more) vs hand-carryable loose sacks.
export const needsVehicle=qty=>isInt(qty)&&qty>=SACKS_PER_PALLET;

// Evaluate bakery stock against the cadence hash and current needs; returns ONE new restock need or null.
// stock: {flour:n, 'coffee-beans':n}. dayHash: non-negative safe integer hash (fires when dayHash % CADENCE_MOD === 0) or {seed, day}.
// openNeeds: current needs array (open and recently closed). opts: {day, supplierStock:{good:n}}.
export function needsForStock(stock,dayHash,openNeeds=[],opts={}){
 if(!stock||typeof stock!=='object'||Array.isArray(stock))return null;
 const o=opts&&typeof opts==='object'?opts:{};
 const byObj=!!dayHash&&typeof dayHash==='object'&&!Array.isArray(dayHash);
 if(!byObj&&(!isInt(dayHash)||dayHash<0))return null;
 const d0=byObj?(isInt(dayHash.day)&&dayHash.day>=0?dayHash.day:null):(isInt(o.day)&&o.day>=0?o.day:0);
 if(d0===null)return null;
 const seed=byObj?(isInt(dayHash.seed)?dayHash.seed:0):0;
 if(!byObj&&(dayHash>>>0)%CADENCE_MOD!==0)return null;

 const list=Array.isArray(openNeeds)?openNeeds.filter(n=>n&&typeof n==='object'):[];
 const openBakery=list.filter(n=>isBakeryNeed(n)&&n.status==='open');
 if(openBakery.length>=MAX_OPEN_BAKERY_NEEDS)return null;
 if(o.day!==undefined||byObj){
  if(list.filter(n=>isBakeryNeed(n)&&n.openedDay===d0).length>=MAX_NEW_PER_DAY)return null;
 }

 const cands=[];
 for(const good of GOOD_KEYS){
  const s=stock[good];if(!isInt(s)||s<0)continue;
  const sup=o.supplierStock&&typeof o.supplierStock==='object'&&o.supplierStock[good]!==undefined?o.supplierStock[good]:Infinity;
  const qty=qtyFor(good,s,sup);if(qty<1)continue;
  const key=keyOf({kind:'restock',place:BAKERY,good});
  if(list.some(n=>keyOf(n)===key&&(n.status==='open'||(isInt(n.closedDay)&&d0-n.closedDay<HYSTERESIS_DAYS))))continue;
  const h=byObj?bakeryDayHash(seed,d0,good):(dayHash>>>0);
  if(byObj&&h%CADENCE_MOD!==0)continue;
  cands.push({good,key,qty,fill:s/BAKERY_DEMAND[good].target,dueHash:h});
 }
 if(!cands.length)return null;
 cands.sort((a,b)=>a.fill-b.fill||(a.good<b.good?-1:a.good>b.good?1:0));
 const c=cands[0];
 return {id:`${c.key}|${d0}`,kind:'restock',place:BAKERY,good:c.good,person:'',qty:c.qty,filled:0,openedDay:d0,
  dueDay:d0+DUE_DAYS.restock+(c.dueHash%2),closedDay:-1,unitCents:GOODS[c.good].baseCents,claims:{},status:'open',origin:SUPPLIER};
}

// Apply `delivered` whole sacks to a need without mutating it. Returns {need, accepted, over, remaining, filled, cents}.
export function fillNeed(need,delivered,opts={}){
 const want=isInt(delivered)&&delivered>0?delivered:0;
 if(!need||typeof need!=='object'||Array.isArray(need))return {need:null,accepted:0,over:want,remaining:0,filled:false,cents:0};
 const copy=cloneNeed(need),qty=isInt(need.qty)&&need.qty>0?need.qty:0,prev=clamp(isInt(need.filled)?need.filled:0,0,qty);
 const rem=Math.max(0,qty-prev);
 if(need.status!=='open'||qty<1||!want)return {need:copy,accepted:0,over:want,remaining:rem,filled:need.status==='filled',cents:0};
 const accepted=Math.min(want,rem),over=want-accepted,nextFilled=prev+accepted,done=nextFilled>=qty;
 const o=opts&&typeof opts==='object'?opts:{};
 const day=isInt(o.day)&&o.day>=0?o.day:(isInt(need.openedDay)&&need.openedDay>=0?need.openedDay:0);
 const unit=isInt(need.unitCents)&&need.unitCents>=0?need.unitCents:priceOf(need.good,1);
 copy.filled=nextFilled;
 if(done){copy.status='filled';copy.closedDay=day;copy.claims={}}
 return {need:copy,accepted,over,remaining:qty-nextFilled,filled:done,cents:accepted*unit};
}

// Drop open 'property:alder-bakery' plank needs from old saves (idempotent; preserves house/supplier planks, bakery flour/coffee, and closed history).
// Optional keepIds (e.g. active gig's needId) lets a caller retain an in-flight need until the gig ends.
export function expireOldPlankNeeds(needs,keepIds=[]){
 if(!Array.isArray(needs))return [];
 const keep=new Set(Array.isArray(keepIds)?keepIds.filter(x=>typeof x==='string'):[]);
 return needs.filter(n=>!!n&&typeof n==='object'&&!Array.isArray(n)&&(!isOldBakeryPlankNeed(n)||keep.has(n.id)));
}

// ---- Gig tracker & board text helpers ----
const sackPhrase=good=>good==='flour'?'flour sacks':good==='coffee-beans'?'coffee bean sacks':isBakeryGood(good)?`${GOODS[good].label.toLowerCase()} sacks`:'';
const capFirst=s=>s?s[0].toUpperCase()+s.slice(1):'';

// Pickup prompt text for the gig tracker: e.g. 'Load the flour sacks at Eden Wholesale (E)'.
export function pickupText(good,supplierName=SUPPLIER_LABEL){
 const p=sackPhrase(good);if(!p)return '';
 const who=typeof supplierName==='string'&&supplierName?supplierName:SUPPLIER_LABEL;
 return `Load the ${p} at ${who} (E)`;
}

// Loaded prompt text for the gig tracker: e.g. 'Flour sacks loaded: deliver them to Ironwood Bakery.'
export function loadedText(good,bakeryName=BAKERY_LABEL){
 const p=sackPhrase(good);if(!p)return '';
 const dest=typeof bakeryName==='string'&&bakeryName?bakeryName:BAKERY_LABEL;
 return `${capFirst(p)} loaded: deliver them to ${dest}.`;
}

// Tracker suffix for gig-bridge.js activeView: accepts an active gig object {needGood, haul} or a good key + {loaded, supplierName, bakeryName}. Returns '' for non-bakery goods.
export function trackerText(activeOrGood,opts={}){
 const o=opts&&typeof opts==='object'?opts:{};
 const isObj=!!activeOrGood&&typeof activeOrGood==='object';
 const good=isObj?(activeOrGood.needGood??activeOrGood.good):activeOrGood;
 if(!isBakeryGood(good))return '';
 const loaded=isObj?Number(activeOrGood.haul)>0:!!o.loaded;
 if(loaded)return loadedText(good,o.bakeryName);
 return `${pickupText(good,o.supplierName)}, then deliver them.`;
}

// Gig board title and description for bakery restock needs.
export const needTitle=good=>isBakeryGood(good)?`${GOODS[good].label} for the bakery`:'';
export function needDescription(good,qty,supplierName=SUPPLIER_LABEL,bakeryName=BAKERY_LABEL){
 if(!isBakeryGood(good)||!isInt(qty)||qty<1)return '';
 const g=GOODS[good],who=typeof supplierName==='string'&&supplierName?supplierName:SUPPLIER_LABEL,dest=typeof bakeryName==='string'&&bakeryName?bakeryName:BAKERY_LABEL;
 const unit=qty===1?`${g.unit} of ${g.label.toLowerCase()}`:g.plural;
 return `${dest} is running low. Bring ${qty} ${unit} from ${who}.`;
}
