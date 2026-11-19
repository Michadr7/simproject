// Cargo items (notes/cargo-redesign.md, stage C-A): ONE pure item shape for everything carriable (log, planks, crate, parcel, box), the bed rules by model on top of cargo.js BEDS, take/load/summary for the future wheel, the hands rule, and conversions to and from the saved cargo and carry shapes and the old gigs.active parcel. No DOM, no three.js, no globals, no random; every function returns new objects.
// Item: {kind, count, space, massKg, hand, stackable, o, gig, model, large}. count is 1 for every piece except planks (a stack of 1..4); space and massKg are the totals of the piece; o = an order id (planks of a delivery: not yours to take off); gig = the gig a parcel belongs to; model = the carton prop id; large = the medium carton.
// Saved bed piece (superset of cargo.js): {k:'log'} | {k:'planks',n,o?} | {k:'crate'} | {k:'parcel',g,m,l?} | {k:'box'}. Saved hands (progress.carry): {kind:'log'} | {kind:'planks',count} | {kind:'crate'} | {kind:'parcel',gig,model,large?} | {kind:'box'}.
import {BEDS,CARGO_KINDS,CRATE_MIX,fits,hasBed} from './cargo.js';
import {PLANKS_PER_STACK,HANDS_SPEED} from './carry.js';
import {MASS_KG,BOX_KG} from './load-drag.js';
import {parcelTaken,parcelModelId,PARCEL_DEFAULT} from './gig-parcel.js';

// Per kind: space units per piece (planks: per plank), kg, whether hands may carry it, whether pieces pile up, hands speed multiplier. Sizes and masses reuse cargo.js and load-drag.js.
export const ITEM_KINDS=Object.freeze({
 log:Object.freeze({unitSpace:CARGO_KINDS.log.space,unitKg:MASS_KG.log,hand:true,stackable:false,speedMul:HANDS_SPEED.log}),
 trunk:Object.freeze({unitSpace:CARGO_KINDS.trunk.space,unitKg:MASS_KG.trunk,hand:true,stackable:false,speedMul:HANDS_SPEED.trunk}),
 slab:Object.freeze({unitSpace:CARGO_KINDS.slab.space,unitKg:MASS_KG.slab,hand:true,stackable:false,speedMul:HANDS_SPEED.slab}),
 planks:Object.freeze({unitSpace:CARGO_KINDS.planks.space,unitKg:MASS_KG.plank,hand:true,stackable:true,speedMul:HANDS_SPEED.planks}), // stackable: up to PLANKS_PER_STACK planks make one piece
 crate:Object.freeze({unitSpace:CARGO_KINDS.crate.space,unitKg:MASS_KG.crate,hand:true,stackable:true,speedMul:HANDS_SPEED.crate}), // piles two high on a bed (cargo.js fits); one crate in hands, slow walk
 parcel:Object.freeze({unitSpace:1,unitKg:MASS_KG.parcelSmall,hand:true,stackable:false,speedMul:HANDS_SPEED.parcel}), // small carton; a large one takes 2 space and weighs MASS_KG.parcelMedium
 box:Object.freeze({unitSpace:1,unitKg:BOX_KG,hand:true,stackable:false,speedMul:HANDS_SPEED.box}) // generic goods for the future
});
// C-B: the switch for the parcel as a real piece (hands or bed). false = game.js still uses the old gigs.active flag only: save normalisation, gig end and the hands do nothing with pieces. The owner's main chat flips it to true when game.js is wired (syncParcel reads the piece).
export const PARCEL_PIECES_ENABLED=true; // ON since the game.js wiring (OPUS-wiring 2026-11-17): X, E, the vehicle seat, syncParcel and the Cargo panel all use the piece
export const KIND_ORDER=Object.freeze(['log','trunk','slab','planks','crate','parcel','box']); // the wheel's slice order
export const LARGE_PARCEL_SPACE=2;
export const MIX_CRATES=false; // legacy rule: crates and timber do not mix on a bed. The wheel stage may turn it on (pass {mixCrates:true}); cargo.js normalizeCargo would then need the same change.
export const NOT_CARGO='That cannot go on the bed.';
export const NO_BED='This vehicle has no bed.';
export const BED_EMPTY='The bed is empty.';
export const CRATES_REFUSED='Crates do not go on this bed.';
const isInt=(v,lo,hi)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi;

// itemOf(kind,props): a full item or null for garbage (unknown kind, NaN, negative, a stack over four, a parcel with no gig). Never throws.
export function itemOf(kind,props){
 const K=typeof kind==='string'&&Object.prototype.hasOwnProperty.call(ITEM_KINDS,kind)?ITEM_KINDS[kind]:null;if(!K)return null;
 const p=props&&typeof props==='object'?props:{};
 let count=1;if(kind==='planks'){if(!isInt(p.count,1,PLANKS_PER_STACK))return null;count=p.count}
 const o=p.o==null?null:isInt(p.o,1,Number.MAX_SAFE_INTEGER)?p.o:undefined;if(o===undefined)return null;
 let gig=null,model=null,large=false;
 if(kind==='parcel'){if(!isInt(p.gig,1,1e9))return null;gig=p.gig;large=p.large===true;model=typeof p.model==='string'&&p.model&&p.model.length<=64?p.model:PARCEL_DEFAULT}
 const space=kind==='parcel'?(large?LARGE_PARCEL_SPACE:K.unitSpace):K.unitSpace*count,massKg=kind==='parcel'?(large?MASS_KG.parcelMedium:MASS_KG.parcelSmall):K.unitKg*count;
 return {kind,count,space,massKg,hand:K.hand,stackable:K.stackable,o,gig,model,large};
}
// An item or a loose {kind,...props} object back to a clean item (null if bad). Normalising twice gives the same item.
export const normalizeItem=v=>v&&typeof v==='object'?itemOf(v.kind,v):null;
export const normalizeItems=list=>Array.isArray(list)?list.map(normalizeItem).filter(Boolean):[];

// Bed rules by model, from cargo.js BEDS. null for a vehicle without a bed.
export function bedRules(model){
 const b=typeof model==='string'&&Object.prototype.hasOwnProperty.call(BEDS,model)?BEDS[model]:null;if(!b)return null;
 return {model,space:b.space,maxPieces:b.maxPieces||Infinity,crates:!!b.crates,accepts:KIND_ORDER.filter(k=>k!=='crate'||!!b.crates)};
}
export const usedSpaceOf=items=>(items||[]).reduce((s,i)=>s+(i&&Number.isFinite(i.space)?i.space:0),0);
const isTimber=i=>i.kind==='log'||i.kind==='trunk'||i.kind==='slab'||i.kind==='planks';

// canLoad(model,items,item,opts) -> {ok:true} | {error}. Checks the kind, the space, maxPieces (the ATV rack: one piece in total) and cargo.js fits() (height and cells) for the timber and crates.
export function canLoad(model,items,item,opts={}){
 const rules=bedRules(model);if(!rules)return {error:NO_BED};
 const it=normalizeItem(item);if(!it)return {error:NOT_CARGO};
 const cur=normalizeItems(items);
 if(it.kind==='crate'&&!rules.crates)return {error:CRATES_REFUSED};
 const mix=opts.mixCrates===undefined?MIX_CRATES:!!opts.mixCrates;
 if(!mix&&((it.kind==='crate'&&cur.some(isTimber))||(isTimber(it)&&cur.some(i=>i.kind==='crate'))))return {error:CRATE_MIX};
 const next=[...cur,it];
 if(next.length>rules.maxPieces)return {error:`The bed is full (${next.length-1} piece${next.length-1===1?'':'s'}).`};
 if(usedSpaceOf(next)>rules.space)return {error:'The bed is full.'};
 if(!fits(model,toLegacyCargo(next)||[]))return {error:'It does not fit on that bed.'};
 return {ok:true};
}
// Put an item on the bed (last on). Returns {items} | {error}; the input list is untouched.
export function loadItem(model,items,item){
 const c=canLoad(model,items,item);if(!c.ok)return c;
 return {items:[...normalizeItems(items),normalizeItem(item)]};
}
// Take the last piece that is yours (an order's planks stay). Returns {items,item} | {error}.
export function unloadItem(items){
 const cur=normalizeItems(items);if(!cur.length)return {error:BED_EMPTY};
 let i=cur.length-1;while(i>=0&&cur[i].o)i--;
 if(i<0)return {error:`Those planks belong to order #${cur[cur.length-1].o}: deliver them to the customer.`};
 return {items:[...cur.slice(0,i),...cur.slice(i+1)],item:cur[i]};
}
// Take one (the last of that kind) or all pieces of a kind that are yours. Returns {items,taken:[item...]} | {error}.
export function takeKind(items,kind,all=false){
 if(!Object.prototype.hasOwnProperty.call(ITEM_KINDS,String(kind)))return {error:NOT_CARGO};
 const cur=normalizeItems(items),idx=[];cur.forEach((it,i)=>{if(it.kind===kind&&!it.o)idx.push(i)});
 if(!idx.length){const owned=cur.find(it=>it.kind===kind&&it.o);return {error:owned?`Those planks belong to order #${owned.o}: deliver them to the customer.`:`There are no ${kind} on the bed.`}}
 const pick=new Set(all===true?idx:[idx[idx.length-1]]);
 return {items:cur.filter((_,i)=>!pick.has(i)),taken:cur.filter((_,i)=>pick.has(i))};
}
// What the wheel shows: one row per kind present, in KIND_ORDER: count (planks counted singly), space used, free (yours to take).
export function summarize(items){
 const cur=normalizeItems(items),out=[];
 for(const kind of KIND_ORDER){const of=cur.filter(i=>i.kind===kind);if(!of.length)continue;
  out.push({kind,count:of.reduce((s,i)=>s+i.count,0),space:usedSpaceOf(of),free:of.filter(i=>!i.o).reduce((s,i)=>s+i.count,0)})}
 return out;
}
export const massOf=items=>normalizeItems(items).reduce((s,i)=>s+i.massKg,0);
// The hands rule: what carrying this does to the walk. Nothing (or garbage) in hands: free walk and sprint.
export function handsRule(item){
 const it=normalizeItem(item);if(!it||!it.hand)return {carryable:false,speedMul:1,sprint:true};
 return {carryable:true,speedMul:ITEM_KINDS[it.kind].speedMul,sprint:false};
}

// ---- conversions ----
// Saved bed pieces (cargo.js shape plus parcel and box) to items. Bad pieces are skipped.
export function fromLegacyCargo(cargo){
 if(!Array.isArray(cargo))return [];const out=[];
 for(const p of cargo){if(!p||typeof p!=='object')continue;let it=null;
  if(p.k==='log'||p.k==='trunk'||p.k==='slab')it=itemOf(p.k);else if(p.k==='crate')it=itemOf('crate');else if(p.k==='planks')it=itemOf('planks',{count:p.n,o:p.o});
  else if(p.k==='parcel')it=itemOf('parcel',{gig:p.g,model:p.m,large:p.l===1||p.l===true});else if(p.k==='box')it=itemOf('box');
  if(it)out.push(it)}
 return out;
}
// Items to the saved bed pieces cargo.js knows (log, planks, crate): parcels and boxes are NOT in this shape and are left out. null when empty.
export function toLegacyCargo(items){
 const out=[];for(const it of normalizeItems(items)){
  if(it.kind==='log'||it.kind==='trunk'||it.kind==='slab')out.push({k:it.kind});else if(it.kind==='crate')out.push({k:'crate'});else if(it.kind==='planks')out.push({k:'planks',n:it.count,...(it.o?{o:it.o}:{})})}
 return out.length?out:null;
}
// Items to the full saved bed list (adds the parcel {k:'parcel',g,m,l?} and {k:'box'}). null when empty. fromLegacyCargo reads it back.
export function toSavedCargo(items){
 const out=[];for(const it of normalizeItems(items)){
  if(it.kind==='parcel')out.push({k:'parcel',g:it.gig,m:it.model,...(it.large?{l:1}:{})});else if(it.kind==='box')out.push({k:'box'});else{const l=toLegacyCargo([it]);if(l)out.push(l[0])}}
 return out.length?out:null;
}
// Hands: progress.carry <-> one item.
export function fromLegacyCarry(carry){
 if(!carry||typeof carry!=='object')return null;
 if(carry.kind==='planks')return itemOf('planks',{count:carry.count,o:carry.o});
 if(carry.kind==='parcel')return itemOf('parcel',{gig:carry.gig,model:carry.model,large:carry.large===true});
 return carry.kind==='log'||carry.kind==='trunk'||carry.kind==='slab'||carry.kind==='crate'||carry.kind==='box'?itemOf(carry.kind):null;
}
export function toLegacyCarry(item){
 const it=normalizeItem(item);if(!it||!it.hand)return null;
 if(it.kind==='planks')return {kind:'planks',count:it.count};
 if(it.kind==='parcel')return {kind:'parcel',gig:it.gig,model:it.model,...(it.large?{large:true}:{})};
 return {kind:it.kind};
}
// The parcel of the old save shape: gigs.active held in the hands (not on the ground, not waiting at the pickup, not a need gig) -> a parcel item, else null.
export function fromLegacyParcel(active){
 if(!active||typeof active!=='object')return null;
 if(!parcelTaken({gigs:{active}}))return null;
 return itemOf('parcel',{gig:active.id,model:parcelModelId(active),large:active.large===true});
}

// Where the active gig's parcel is now: 'hands' | 'bed' (on a saved vehicle's cargo) | 'ground' | 'waiting' | 'held' (old save, not yet migrated) | null (no parcel gig).
export function parcelLocation(progress){
 const a=progress?.gigs?.active;if(!a||typeof a!=='object'||a.needId)return null;
 if(a.drop)return 'ground';
 if(!parcelTaken(progress))return 'waiting';
 if(progress.carry?.kind==='parcel'&&progress.carry.gig===a.id)return 'hands';
 if((progress.vehicles||[]).some(v=>Array.isArray(v?.cargo)&&v.cargo.some(p=>p?.k==='parcel'&&p.g===a.id)))return 'bed';
 return 'held';
}
// migrateParcel(progress,opts): converts an OLD save, where the held parcel is only the flag gigs.active (drop null, picked up), into a real item: first onto the bed of opts.vehicleUid (the vehicle the player was riding; old saves do not record it, so the caller passes it only if it knows), else into the hands. The gig keeps drop null, which now means "carried: in hands or on a bed", so every old reader still works. Pure: returns a new progress (the same object when there is nothing to do). Safe to run any number of times: once the parcel has a place, parcelLocation is 'hands' or 'bed' and nothing changes. If the hands hold something else and no bed takes it, the save is left as it was ('held') and the next load tries again.
export function migrateParcel(progress,opts={}){
 if(!progress||typeof progress!=='object'||parcelLocation(progress)!=='held')return progress;
 const item=fromLegacyParcel(progress.gigs.active);if(!item)return progress;
 const uid=opts&&opts.vehicleUid,list=progress.vehicles;
 if(uid!=null&&Array.isArray(list)){
  const i=list.findIndex(v=>v&&v.uid===uid);
  if(i>=0&&hasBed(list[i].model)){const cur=fromLegacyCargo(list[i].cargo),r=loadItem(list[i].model,cur,item);
   if(!r.error){const vehicles=list.map((v,j)=>j===i?{...v,cargo:toSavedCargo(r.items)}:v);return {...progress,vehicles}}}}
 if(!progress.carry)return {...progress,carry:toLegacyCarry(item)};
 return progress;
}

// ---- C-B: ending a gig and cleaning a save (used by gigs.js and jobs.js, behind PARCEL_PIECES_ENABLED)
// Removes parcel pieces from the hands and from every vehicle's cargo: gigId given = only that gig's parcel, gigId null = every parcel. Pure; returns the SAME object when nothing was there.
export function removeParcelPieces(progress,gigId=null){
 if(!progress||typeof progress!=='object')return progress;
 const gone=g=>gigId==null||g===gigId;let changed=false,next=progress;
 if(progress.carry?.kind==='parcel'&&gone(progress.carry.gig)){next={...next,carry:null};changed=true}
 if(Array.isArray(progress.vehicles)&&progress.vehicles.some(v=>Array.isArray(v?.cargo)&&v.cargo.some(p=>p?.k==='parcel'&&gone(p.g)))){
  next={...next,vehicles:progress.vehicles.map(v=>{if(!Array.isArray(v?.cargo)||!v.cargo.some(p=>p?.k==='parcel'&&gone(p.g)))return v;const left=v.cargo.filter(p=>!(p?.k==='parcel'&&gone(p.g)));const {cargo,...rest}=v;return left.length?{...rest,cargo:left}:rest})};changed=true}
 return changed?next:progress;
}
// A parcel piece whose gig is not the active carried one (the gig ended, was never this one, or the parcel is on the ground) cannot be delivered and would sit in the hands for ever: it is removed on load.
export function purgeOrphanParcels(progress){
 const a=progress?.gigs?.active,valid=a&&typeof a==='object'&&parcelTaken(progress)?a.id:null; // audit minor: a parcel not yet picked up (still waiting at the pickup point) has no piece either
 if(!progress||typeof progress!=='object')return progress;
 let next=progress;
 if(next.carry?.kind==='parcel'&&next.carry.gig!==valid)next={...next,carry:null};
 if(Array.isArray(next.vehicles)){const ids=new Set();for(const v of next.vehicles)for(const p of Array.isArray(v?.cargo)?v.cargo:[])if(p?.k==='parcel'&&p.g!==valid)ids.add(p.g);
  for(const g of ids)next=removeParcelPieces(next,g)}
 return next;
}
// Audit #2: a need run's crates go only onto a bed that holds crates or nothing: cargo.js addCrates refuses any other piece beside them (CRATE_MIX), and the farm's stock would be taken with no crates loaded.
export const NEED_BED_BUSY='Clear the bed first.';
export const needCratesFit=cargo=>!(Array.isArray(cargo)?cargo:[]).some(p=>p?.k!=='crate');
export const parcelCarried=progress=>{const l=parcelLocation(progress);return l==='hands'||l==='bed'||l==='held'}; // a gig counts its parcel as carried in the hands or on a bed ('held' = an old save not yet migrated)