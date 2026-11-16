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
export const parcelHeld=p=>!!p?.gigs?.active&&!p.gigs.active.drop&&!p.gigs.active.needId;
export const parcelDropped=p=>!!p?.gigs?.active?.drop;
// Puts the box on the ground at {x,z}; the gig stays active. Returns {state,message} or {error}.
export function dropParcel(p,at){
 const a=p?.gigs?.active;if(!a)return {error:'You have no parcel to put down.'};
 if(a.drop)return {error:'The parcel is already on the ground.'};
 const d=normalizeDrop(at);if(!d)return {error:'Find some clear ground to put it down.'};
 return {state:{...p,gigs:{...p.gigs,active:{...a,drop:d}}},message:'You put the parcel down. Press E beside it to pick it up.'};
}
// Takes the box back; refused while a log or planks are in the hands.
export function pickParcel(p){
 const a=p?.gigs?.active;if(!a?.drop)return {error:'There is no parcel here.'};
 if(p.carry)return {error:'Your hands are full. Put it down first (X).'};
 return {state:{...p,gigs:{...p.gigs,active:{...a,drop:null}}},message:'You pick up the parcel.'};
}