// plank-needs.js: town plank demand, the pure gig-board restock needs of the Eastbank Building Supplier, the bakery and the houses; implements P-E of notes/planks-economy-design.md (needs.js shape, no clock, no chance).
// plankNeedsFrom(world,day,opts) returns ONLY the new plank needs to add (needs.js merges them): {id,kind:'restock',place,good:'planks',qty (whole stacks),openedDay,dueDay,unitCents (the world price),origin:the sawmill,status:'open'}.
// Rules: a place under LOW_FRAC of its target asks for enough stacks to reach REFILL_FRAC; ids are stable (`restock|place|planks|day`); the Ridgeline pallet place is never asked (audit A F5); an unknown stock opens nothing.
import {GOODS,PLACES,PALLET_LINK} from './world-goods.js';
import {priceOf} from './world-state.js';
import {LOW_FRAC,REFILL_FRAC,RESTOCK_CAP,DUE_DAYS,HYSTERESIS_DAYS,hashOf,keyOf,dayOf} from './needs.js';
import {PLANKS_PER_STACK} from './plank-economy.js';

export const GOOD='planks',SUPPLIER='property:eastbank-supply',SAWMILL='property:sawmill';
export const MAX_NEW_PER_CALL=3;                 // the board never floods (needs.js MAX_OPEN_NEEDS is 6 for everything)
export {PLANKS_PER_STACK,RESTOCK_CAP};
const house=n=>[`property:house-r${n}`,Object.freeze({label:`House ${n}`,target:4,max:12})];
// target = the stock that is "full" for the place, max = what it can hold. The supplier's numbers are world-goods.js (read live); the bakery and houses are placeholders (no stock exists for them in world-goods.js).
export const DEMAND=Object.freeze({[SUPPLIER]:Object.freeze({label:'Eastbank Building Supplier',target:PLACES[SUPPLIER].goods.planks.target,max:PLACES[SUPPLIER].goods.planks.max}),
 'property:alder-bakery':Object.freeze({label:'Ironwood Bakery',target:8,max:24}),...Object.fromEntries([1,2,3,4,5,6,7,8].map(house))});

const isInt=Number.isSafeInteger;
const stacksOf=n=>Math.floor(n/PLANKS_PER_STACK);
export const isLinked=(place,good=GOOD)=>place===PALLET_LINK.place&&good===PALLET_LINK.good;

// The world price of one plank in cents: the supplier's live band price (stock and prosperity), or the base price when the world is missing or broken.
export function plankPriceCents(world){
 try{const p=priceOf(world,SUPPLIER,GOOD);if(isInt(p)&&p>0)return p}catch(e){}
 return GOODS.planks.baseCents;
}
// Planks (a whole number of stacks) a place asks for: up to REFILL_FRAC of its target, no more than its room, RESTOCK_CAP, or what the sawmill can give; 0 when it is not low.
export function qtyFor(d,stock,sawmillPlanks=Infinity){
 if(!d||!isInt(stock)||stock<0||stock>=d.target*LOW_FRAC)return 0;
 const want=Math.ceil(d.target*REFILL_FRAC)-stock,room=d.max-stock,cap=Math.min(RESTOCK_CAP,room,sawmillPlanks);
 const stacks=Math.min(Math.ceil(want/PLANKS_PER_STACK),stacksOf(cap));
 return stacks>=1?stacks*PLANKS_PER_STACK:0;
}
// world: a world-state world (or anything); day: whole day number. opts: {stock:{place:planks} (bakery and houses; also overrides the world's), needs:[the current list, so the same need is not opened twice], demand:{place:{target,max}} override, max}.
export function plankNeedsFrom(world,day,opts={}){
 const o=opts&&typeof opts==='object'?opts:{},d0=isInt(day)&&day>=0?day:dayOf(day),demand=o.demand&&typeof o.demand==='object'?o.demand:DEMAND;
 const have=Array.isArray(o.needs)?o.needs.filter(n=>n&&typeof n==='object'):[];
 const yard=world&&world.stock&&isInt(world.stock[SAWMILL]?.planks)?world.stock[SAWMILL].planks:Infinity;
 const cands=[];
 for(const [place,d] of Object.entries(demand)){
  if(!d||!Number.isFinite(d.target)||!Number.isFinite(d.max)||isLinked(place))continue;
  const s=isInt(o.stock?.[place])?o.stock[place]:world?.stock?.[place]?.[GOOD];
  const qty=qtyFor(d,s,yard);if(qty<1)continue;
  const key=keyOf({kind:'restock',place,good:GOOD});
  if(have.some(n=>keyOf(n)===key&&(n.status==='open'||(isInt(n.closedDay)&&d0-n.closedDay<HYSTERESIS_DAYS))))continue;
  cands.push({place,key,qty,fill:s/d.target});
 }
 cands.sort((a,b)=>a.fill-b.fill||(a.key<b.key?-1:a.key>b.key?1:0));
 const unit=plankPriceCents(world),seed=world&&isInt(world.seed)?world.seed:0,lim=isInt(o.max)&&o.max>=0?o.max:MAX_NEW_PER_CALL;
 return cands.slice(0,lim).map(c=>({id:`${c.key}|${d0}`,kind:'restock',place:c.place,good:GOOD,person:'',qty:c.qty,filled:0,openedDay:d0,dueDay:d0+DUE_DAYS.restock+hashOf(seed,c.key,d0,'due')%2,closedDay:-1,unitCents:unit,claims:{},status:'open',origin:SAWMILL}));
}
// What a need pays at today's world price (cents, before the gig floor and urgency).
export const payOf=n=>n&&isInt(n.qty)&&isInt(n.unitCents)?n.qty*n.unitCents:0;
