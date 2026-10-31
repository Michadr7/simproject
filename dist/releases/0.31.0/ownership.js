// Owning and renting the vacant houses (0.30). `progress.properties` holds what the player holds: {[propertyId]: {tenure: 'rent' | 'own', since, nextBillDay, rentDue, missed, deposit}}.
// Rent is taken from the player's cash every 7 game days (the same clock as the studio's bills); a week that cannot be paid is a warning, a second one is an eviction. All changes are pure transactions.
import {MAP} from './map-definition.js';

export const WEEK=7,GRACE=2,SCHEMA=2;
const cash=n=>'$'+(n/100).toFixed(2);
export const listingOf=id=>MAP.properties.find(p=>p.id===id&&p.listing)?.listing??null;
export const LISTED=MAP.properties.filter(p=>p.listing).map(p=>({id:p.id,name:p.name,...p.listing}));
const nameOf=id=>MAP.properties.find(p=>p.id===id)?.name??id;
const int=(v,lo,hi,d)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi?v:d;

export function normalizeProperties(value){
 const out={};if(!value||typeof value!=='object')return out;
 for(const [id,e] of Object.entries(value)){
  const listing=listingOf(id);if(!listing||!e||typeof e!=='object'||(e.tenure!=='rent'&&e.tenure!=='own'))continue;
  const rent=e.tenure==='rent',since=int(e.since,1,100000,1);
  out[id]={tenure:e.tenure,since,nextBillDay:rent?int(e.nextBillDay,1,100000,since+WEEK):0,rentDue:rent?int(e.rentDue,0,1e9,0):0,missed:rent?int(e.missed,0,GRACE,0):0,deposit:rent?int(e.deposit,0,1e9,listing.depositCents):0};
 }
 return out;
}
export const normalizeNotices=v=>Array.isArray(v)?v.filter(x=>typeof x==='string').map(x=>x.slice(0,160)).slice(-6):[];
// Which doors open for this player: every house they rent or own.
export const heldIds=state=>Object.keys(normalizeProperties(state.properties));

export function propertyTransaction(state,action,id){
 const properties=normalizeProperties(state.properties),s={...state,properties},fail=error=>({state:s,error}),listing=listingOf(id),held=properties[id],day=state.housing.day,name=nameOf(id);
 if(!listing)return fail('That home is not for rent or sale.');
 if(action==='rent'){
  if(held)return fail('You already live here.');
  const need=listing.depositCents+listing.rentCents;if(s.cash<need)return fail(`You need ${cash(need)}: ${cash(listing.depositCents)} deposit and ${cash(listing.rentCents)} for the first week.`);
  return {state:{...s,cash:s.cash-need,properties:{...properties,[id]:{tenure:'rent',since:day,nextBillDay:day+WEEK,rentDue:0,missed:0,deposit:listing.depositCents}}},message:`You rent ${name}. Rent is ${cash(listing.rentCents)} every 7 days.`};
 }
 if(action==='buy'){
  if(held?.tenure==='own')return fail('You already own this home.');
  if(held&&held.rentDue>0)return fail('Pay the rent you owe before you buy.');
  const price=listing.priceCents-(held?held.deposit:0);if(s.cash<price)return fail(`You need ${cash(price)} to buy ${name}${held?' (your deposit counts)':''}.`);
  return {state:{...s,cash:s.cash-price,properties:{...properties,[id]:{tenure:'own',since:held?.since??day,nextBillDay:0,rentDue:0,missed:0,deposit:0}}},message:`You bought ${name} for ${cash(listing.priceCents)}.`};
 }
 if(action==='pay'){
  if(!held||held.tenure!=='rent'||!held.rentDue)return fail('There is no rent to pay.');
  if(s.cash<held.rentDue)return fail(`You need ${cash(held.rentDue)} for the rent.`);
  return {state:{...s,cash:s.cash-held.rentDue,properties:{...properties,[id]:{...held,rentDue:0,missed:0}}},message:`Rent paid: ${cash(held.rentDue)}.`};
 }
 if(action==='leave'){
  if(!held||held.tenure!=='rent')return fail('You do not rent this home.');
  const refund=held.rentDue?0:held.deposit,next={...properties};delete next[id];
  return {state:{...s,cash:s.cash+refund,properties:next},message:refund?`You moved out of ${name}. Deposit returned: ${cash(refund)}.`:`You moved out of ${name}. The deposit stays with the landlord (rent was owing).`};
 }
 return fail('Unknown home action.');
}

// Called when the game day changes (routine.js advanceTime): bills every rented home whose day has come, taking the rent from cash. A week that cannot be paid raises `missed`; the second evicts.
export function advanceProperties(state){
 const props=normalizeProperties(state.properties),day=state.housing.day;let money=state.cash,notices=normalizeNotices(state.homeNotices);const out={};
 for(const [id,e] of Object.entries(props)){
  if(e.tenure!=='rent'){out[id]=e;continue}
  const rent=listingOf(id).rentCents,name=nameOf(id);let entry={...e},evicted=false;
  while(day>=entry.nextBillDay){
   entry.rentDue+=rent;entry.nextBillDay+=WEEK;
   if(money>=entry.rentDue){money-=entry.rentDue;notices.push(`Rent paid for ${name}: ${cash(entry.rentDue)}.`);entry.rentDue=0;entry.missed=0}
   else{entry.missed+=1;if(entry.missed>=GRACE){notices.push(`You were evicted from ${name}: two weeks of rent went unpaid.`);evicted=true;break}notices.push(`Rent for ${name} is overdue (${cash(entry.rentDue)}). Pay it in the Homes app within a week or you will be evicted.`)}
  }
  if(!evicted)out[id]=entry;
 }
 return {...state,cash:money,properties:out,homeNotices:notices.slice(-6)};
}
