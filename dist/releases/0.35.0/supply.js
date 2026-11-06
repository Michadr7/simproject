// The warehouse's plank supply (DESIGN 4.16 H and I, decided 2026-11-06): an order has to come from somewhere. When the open orders need more planks than the warehouse holds (every pallet:
// racks, forks), a Ridgeline crew (NPCs) brings the shortfall after SUPPLY.delay game minutes, as pallets. For now the crew puts them straight into the racks (pallets.js crewPutAway);
// the visible supply truck and the outdoor staging replace that in step 3 of 4.16 I. Pure and server-ready like tickets.js: the company's own state and the time come in, nothing is read.
//   company.supply = {at, planks}   one delivery on its way: arrives when now >= at (absolute game minutes)
// The planks come from the lumberyard's stock (company.stock.planks: what the sawmill and players produce and dock) first, and from a mill off the map for the rest.
// When a player owns the company and plays alone, this becomes a job they hire NPCs for (later).
import {ticketsOf} from './tickets.js';
import {totalPlanks,crewPutAway} from './pallets.js';

export const SUPPLY=Object.freeze({delay:60,batch:40,maxBatch:120,open:360,close:1080});
// planks the orders still need on a pallet (open and taken ones; a staged order already has its planks)
export const planksNeeded=company=>ticketsOf(company).list.filter(k=>k.status==='open'||k.status==='taken').reduce((s,k)=>s+Math.max(0,k.planks-k.staged),0);
// planks the warehouse already holds: every pallet (racks and forks) and what a player holds in their hands
export const planksHeld=(company,carried=0)=>totalPlanks(company)+carried;
export const shortfall=(company,carried=0)=>Math.max(0,planksNeeded(company)-planksHeld(company,carried));
export const supplyOrder=missing=>Math.min(SUPPLY.maxBatch,Math.ceil(missing/SUPPLY.batch)*SUPPLY.batch);
export const supplyOf=company=>company?.supply||null;

// The clock moved: land a delivery that is due, or send for one when the orders need more than the warehouse has (only in the working day).
// Returns {company, delivered (planks), pallets, fromStock, scheduled, message}; `company` is the same object when nothing changed.
export function tickSupply(company,{now,carried=0}){
 const co=company||{},s=co.supply,minute=now%1440,none={delivered:0,pallets:0,fromStock:0,scheduled:null,message:''};
 if(s&&now>=s.at){
  const {supply,...rest}=co,put=crewPutAway(rest,s.planks),inStock=co.stock?.planks||0,fromStock=Math.min(inStock,put.placed);
  const next=fromStock?{...put.company,stock:{logs:co.stock?.logs||0,planks:inStock-fromStock}}:put.company;
  // a full warehouse: what did not fit stays with the mill, and the same order goes out again later if the orders still need it
  return {...none,company:next,delivered:put.placed,pallets:put.pallets,fromStock,message:put.placed?`A Ridgeline crew put ${put.pallets} pallet${put.pallets>1?'s':''} (${put.placed} planks) in the racks.`:'The racks are full: the crew took the planks back.'};
 }
 if(s||minute<SUPPLY.open||minute>=SUPPLY.close)return {...none,company};
 const missing=shortfall(co,carried);if(!missing)return {...none,company};
 const planks=supplyOrder(missing),at=now+SUPPLY.delay;
 return {...none,company:{...co,supply:{at,planks}},scheduled:{at,planks}};
}
// a supply delivery as saved: {at, planks} with sane numbers, or null
export function normalizeSupply(value){
 if(!value||typeof value!=='object')return null;
 const ok=x=>Number.isSafeInteger(x)&&x>0&&x<=1e9;
 return ok(value.at)&&ok(value.planks)?{at:value.at,planks:Math.min(1000,value.planks)}:null;
}
