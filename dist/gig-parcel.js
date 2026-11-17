// The gig parcel on the ground (notes/handoff.md G2b): pure rules, no DOM. While a gig is active you hold the box; X puts it down, E picks it up.
// Saved inside the active gig as `drop: {x,z}` (null = in your hands), so ending, failing or expiring the gig clears it with the gig. One thing in hands at a time.
export const PARCEL_HANDS='You are holding the parcel. Put it down first (X).';
export const PARCEL_FIRST='Pick up the parcel first.';
export const MAX_DROP=2000;
// G3b: which carton model the box is. An ordinary gig carries the small shipping carton, a large gig the medium one; the clean or the dirty (taped, scuffed) texture comes from a fixed hash of the client and the gig id, so one gig always shows the same box. No random.
export const PARCEL_MODELS=Object.freeze({small:Object.freeze(['prop.carton-small','prop.carton-small-dirty']),large:Object.freeze(['prop.carton-medium','prop.carton-medium-dirty'])});
export const PARCEL_DEFAULT=PARCEL_MODELS.small[0];
export function parcelModelId(a){
 if(!a)return PARCEL_DEFAULT;let h=2166136261;for(const ch of `${a.client||''}|${a.id||0}`){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}
 return PARCEL_MODELS[a.large?'large':'small'][(h>>>0)%7<2?1:0]; // about two in seven are the dirty carton
}
export const normalizeDrop=v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)?{x:Math.max(-MAX_DROP,Math.min(MAX_DROP,v.x)),z:Math.max(-MAX_DROP,Math.min(MAX_DROP,v.z))}:null;
// G-D: the box is only yours after the pickup step. A gig with an origin starts with the box at the pickup point (pickedAt null); an old gig (origin null) was always picked up. Same rule as gigs.js pickedUp (kept here because gigs.js imports this file).
export const PARCEL_PICKUP_FIRST='Go to the pickup point and pick up the parcel first.';
export const parcelPickedUp=a=>!!a&&(!a.origin||a.pickedAt!=null);
// parcelTaken: picked up and not on the ground (in the hands, on a bed, or the old flag). parcelPiece: the cargo redesign's real piece of the active gig is in progress.carry or on a saved vehicle's cargo.
// parcelHeld (what blocks the hands): taken and NOT a piece anywhere, i.e. the old flag. Once the parcel is a piece, progress.carry blocks the hands instead, and a parcel left on a bed leaves them free.
export const parcelTaken=p=>{const a=p?.gigs?.active;return !!a&&!a.drop&&!a.needId&&parcelPickedUp(a)};
export const parcelPiece=p=>{const a=p?.gigs?.active;if(!a)return false;if(p.carry?.kind==='parcel'&&p.carry.gig===a.id)return true;return Array.isArray(p.vehicles)&&p.vehicles.some(v=>Array.isArray(v?.cargo)&&v.cargo.some(q=>q?.k==='parcel'&&q.g===a.id))};
export const parcelHeld=p=>parcelTaken(p)&&!parcelPiece(p);
// The box still waits at the pickup point (not in the hands, not on the ground): a parcel gig that has an origin and no pickedAt.
export const parcelWaiting=p=>{const a=p?.gigs?.active;return !!a&&!a.needId&&!a.drop&&!parcelPickedUp(a)};
export const parcelDropped=p=>!!p?.gigs?.active?.drop;
// Audit #3 (notes/eval/reviews/gemini-audit-0.35.17.md): a parcel left on a bed counts at a stop only while it is with you: in the hands, or on the vehicle you sit in, or on one within reach. fleet: the live vehicles [{cargo, state:{x,z}}]; driven: the one you sit in (null on foot); position: you. true = the parcel is on a bed somewhere else: no stop ticks off and nothing pays.
export const PARCEL_ON_BED='Take the parcel off the truck first.',PARCEL_BED_REACH=12;
export function parcelAway(p,fleet,position,driven=null,reach=PARCEL_BED_REACH){
 const a=p?.gigs?.active;if(!a||a.needId||a.drop||!position)return false;
 if(p.carry?.kind==='parcel'&&p.carry.gig===a.id)return false;
 for(const f of fleet||[]){const c=f?.cargo;if(!Array.isArray(c)||!c.some(q=>q?.k==='parcel'&&q.g===a.id))continue;
  if(f===driven)return false;const x=f.state?.x,z=f.state?.z;return !(Number.isFinite(x)&&Number.isFinite(z)&&Math.hypot(x-position.x,z-position.z)<=reach)}
 return false;
}
// ATV-STOW: a small parcel rides on the rear rack of these vehicles (model ids). The saved state does not change: the gig stays active with drop null (= held by the rider), so save/load, dying and delivery see the same parcel; only the picture (rack, not arms) and the hands rule differ while the rider sits on it. Getting off gives the hands back.
export const STOW_MODELS=Object.freeze(['atv','shortbed','worktruck','offroad','flatbed']); // every vehicle with a cargo bed (cargo.js BEDS): the parcel rides in the bed (the ATV's small rack, a truck's deck); a car without a bed still refuses it
export const canStow=model=>STOW_MODELS.includes(model);
export const STOW_TOAST='Parcel stowed on board.';
export const UNSTOW_TOAST='You take the parcel back.';
export const stowed=(p,model)=>canStow(model)&&parcelHeld(p);
// Why a player cannot get on a vehicle of this model right now (null = free to mount): hands full, or a held parcel with no rack to stow it on.
export const RACK_BUSY='Unload the cargo first: the parcel needs the space.';
export const mountError=(p,model,cargo=null)=>p?.carry&&p.carry.kind!=='parcel'?'Your hands are full. Put it down first (X).':(parcelHeld(p)||p?.carry?.kind==='parcel')&&!canStow(model)?PARCEL_HANDS:parcelHeld(p)&&cargo&&cargo.length>0?RACK_BUSY:null; // FIX-R1: a loaded rack leaves no room for the stowed carton (old flag). C-B: a parcel PIECE in the hands goes onto the bed when you get in; whether it fits is cargo.js loadCarry's call (game.js enterVehicle)
// Puts the box on the ground at {x,z}; the gig stays active. Returns {state,message} or {error}.
export function dropParcel(p,at){
 const a=p?.gigs?.active;if(!a)return {error:'You have no parcel to put down.'};
 if(a.drop)return {error:'The parcel is already on the ground.'};if(!parcelPickedUp(a))return {error:PARCEL_PICKUP_FIRST};
 const d=normalizeDrop(at);if(!d)return {error:'Find some clear ground to put it down.'};
 return {state:{...p,gigs:{...p.gigs,active:{...a,drop:d}}},message:'You put the parcel down. Press E beside it to pick it up.'};
}
// Takes the box back; refused while a log or planks are in the hands.
export function pickParcel(p){
 const a=p?.gigs?.active;if(!a?.drop)return {error:'There is no parcel here.'};
 if(p.carry)return {error:'Your hands are full. Put it down first (X).'};
 return {state:{...p,gigs:{...p.gigs,active:{...a,drop:null}}},message:'You pick up the parcel.'};
}