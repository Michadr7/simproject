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
export const parcelHeld=p=>{const a=p?.gigs?.active;return !!a&&!a.drop&&!a.needId&&parcelPickedUp(a)};
// The box still waits at the pickup point (not in the hands, not on the ground): a parcel gig that has an origin and no pickedAt.
export const parcelWaiting=p=>{const a=p?.gigs?.active;return !!a&&!a.needId&&!a.drop&&!parcelPickedUp(a)};
export const parcelDropped=p=>!!p?.gigs?.active?.drop;
// ATV-STOW: a small parcel rides on the rear rack of these vehicles (model ids). The saved state does not change: the gig stays active with drop null (= held by the rider), so save/load, dying and delivery see the same parcel; only the picture (rack, not arms) and the hands rule differ while the rider sits on it. Getting off gives the hands back.
export const STOW_MODELS=Object.freeze(['atv']);
export const canStow=model=>STOW_MODELS.includes(model);
export const STOW_TOAST='Parcel stowed on the rack.';
export const UNSTOW_TOAST='You take the parcel back.';
export const stowed=(p,model)=>canStow(model)&&parcelHeld(p);
// Why a player cannot get on a vehicle of this model right now (null = free to mount): hands full, or a held parcel with no rack to stow it on.
export const RACK_BUSY='Unload the rack first: the parcel needs the space.';
export const mountError=(p,model,cargo=null)=>p?.carry?'Your hands are full. Put it down first (X).':parcelHeld(p)&&!canStow(model)?PARCEL_HANDS:parcelHeld(p)&&cargo&&cargo.length>0?RACK_BUSY:null; // FIX-R1: a loaded rack leaves no room for the stowed carton
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