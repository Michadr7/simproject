// The warehouse's plank supply (DESIGN 4.16 H and I, decided 2026-11-06): an order has to come from somewhere. When the open orders need more planks than the warehouse holds (every pallet:
// racks, forks), a Ridgeline crew (NPCs) brings the shortfall after SUPPLY.delay game minutes, as pallets. For now the crew puts them straight into the racks (pallets.js crewPutAway);
// the visible supply truck and the outdoor staging replace that in step 3 of 4.16 I. Pure and server-ready like tickets.js: the company's own state and the time come in, nothing is read.
//   company.supply = {at, planks}   one delivery on its way: arrives when now >= at (absolute game minutes)
// The planks come from the lumberyard's stock (company.stock.planks) first and the sawmill yard (progress.sawmillYard, passed in as `yard`) second; nothing comes from off the map (W3, owner answer 4, 2026-11-18).
// When a player owns the company and plays alone, this becomes a job they hire NPCs for (later).
import {ticketsOf} from './tickets.js';
import {totalPlanks,crewPutAway} from './pallets.js';
import {normalizeYard} from './sawmill-yard.js';

// The crew's load from the two real sources: up to `want` planks, the lumberyard stock first, then the yard; only what fits the racks leaves either. The same rule as workforce-tick.js supplyFromStocks
// (repeated here: importing it closes a module cycle through careers.js; tests/workforce-game.mjs checks they agree). -> {company, yard, placed, pallets, fromStock, fromYard}
export function supplyFromStocks(company,yardState,wantPlanks){
 const co=company||{},y=normalizeYard(yardState),want=Math.max(0,Math.floor(Number(wantPlanks)||0)),inStock=Math.max(0,Math.floor(co.stock?.planks||0));
 const takeStock=Math.min(want,inStock),takeYard=Math.min(want-takeStock,y.planks);
 if(!(takeStock+takeYard))return {company:co,yard:y,placed:0,pallets:0,fromStock:0,fromYard:0};
 const put=crewPutAway(co,takeStock+takeYard),fromStock=Math.min(takeStock,put.placed),fromYard=Math.max(0,put.placed-fromStock),nextStock=inStock-fromStock,logs=Math.max(0,Math.floor(co.stock?.logs||0));
 let next;if(nextStock||logs)next={...put.company,stock:{logs,planks:nextStock}};else{const {stock,...rest}=put.company;next=rest}
 return {company:next,yard:fromYard>0?normalizeYard({...y,planks:y.planks-fromYard}):y,placed:put.placed,pallets:put.pallets,fromStock,fromYard};
}

export const SUPPLY=Object.freeze({delay:60,batch:40,maxBatch:120,open:360,close:1080});
// planks the orders still need on a pallet (open and taken ones; a staged order already has its planks)
export const planksNeeded=company=>ticketsOf(company).list.filter(k=>k.status==='open'||k.status==='taken').reduce((s,k)=>s+Math.max(0,k.planks-k.staged),0);
// planks the warehouse already holds: every pallet (racks and forks) and what a player holds in their hands
export const planksHeld=(company,carried=0)=>totalPlanks(company)+carried;
export const shortfall=(company,carried=0)=>Math.max(0,planksNeeded(company)-planksHeld(company,carried));
export const supplyOrder=missing=>Math.min(SUPPLY.maxBatch,Math.ceil(missing/SUPPLY.batch)*SUPPLY.batch);
export const supplyOf=company=>company?.supply||null;

// The clock moved: land a delivery that is due, or send for one when the orders need more than the warehouse has (only in the working day).
// Returns {company, yard (the new sawmill yard when planks came out of it, else null), delivered (planks), pallets, fromStock, fromYard, scheduled, message}; `company` is the same object when nothing changed.
export function tickSupply(company,{now,carried=0,yard=null}={}){
 const co=company||{},s=co.supply,minute=now%1440,none={yard:null,delivered:0,pallets:0,fromStock:0,fromYard:0,scheduled:null,message:''};
 const have=(co.stock?.planks||0)+normalizeYard(yard).planks; // what the two real sources hold
 if(s&&now>=s.at){
  const {supply,...rest}=co,res=supplyFromStocks(rest,yard,s.planks);
  // a full warehouse (or empty sources): what did not fit stays where it was, and the same order goes out again later if the orders still need it
  return {...none,company:res.company,yard:res.fromYard>0?res.yard:null,delivered:res.placed,pallets:res.pallets,fromStock:res.fromStock,fromYard:res.fromYard,message:res.placed?`A Ridgeline crew put ${res.pallets} pallet${res.pallets>1?'s':''} (${res.placed} planks) in the racks.`:have>0?'The racks are full: the crew took the planks back.':'The lumberyard and the sawmill yard are out of planks: the crew came back empty.'};
 }
 if(s||minute<SUPPLY.open||minute>=SUPPLY.close)return {...none,company};
 const missing=shortfall(co,carried);if(!missing||!have)return {...none,company}; // nothing to bring from: no crew goes out
 const planks=Math.min(supplyOrder(missing),have),at=now+SUPPLY.delay;
 return {...none,company:{...co,supply:{at,planks}},scheduled:{at,planks}};
}
// a supply delivery as saved: {at, planks} with sane numbers, or null
export function normalizeSupply(value){
 if(!value||typeof value!=='object')return null;
 const ok=x=>Number.isSafeInteger(x)&&x>0&&x<=1e9;
 return ok(value.at)&&ok(value.planks)?{at:value.at,planks:Math.min(1000,value.planks)}:null;
}

// Planks that came back (an order failed or ran out of time: its staged planks, or the planks taken back off the truck) go to open rack space as pallets, the same way a delivery from the crew does;
// if the racks are full what is left goes into the lumberyard's stock, so nothing is lost. Returns {company, placed (planks on pallets), toStock (planks sent to the lumberyard), cells}.
export function returnPlanks(company,planks){
 const co=company||{},n=Math.max(0,Math.floor(planks)),put=crewPutAway(co,n),left=put.left||0;
 const next=left>0?{...put.company,stock:{logs:put.company.stock?.logs||0,planks:(put.company.stock?.planks||0)+left}}:put.company;
 return {company:n?next:company,placed:put.placed,toStock:left,cells:put.cells};
}