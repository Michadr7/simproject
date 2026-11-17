// Load drag: how much cargo slows a vehicle (stage ATV-STOW). Pure: no DOM, no three.js. Each piece of cargo has a mass in kg; the load slows the top speed and the acceleration by loadFactor(kg), a multiplier 0.6..1.
// 4 % slower per 10 kg of load, never below 0.6 (reached at 100 kg). cargo.js and vehicle.js withLoad (how full the bed is) still apply: driving.js takes the stronger of the two, so a load never slows twice.
export const DRAG_PER_KG=.004;
export const MIN_FACTOR=.6;
export const HEAVY_BELOW=.85; // under this a short toast says the load is heavy (once per session)
export const HEAVY_TEXT='Heavy load: the ATV is slower.';
export const MASS_KG=Object.freeze({log:40,plank:6,crate:12,parcelSmall:3,parcelMedium:6});
export const loadFactor=massKg=>{const m=Number.isFinite(massKg)&&massKg>0?massKg:0;return Math.max(MIN_FACTOR,1-DRAG_PER_KG*m)};
export const isHeavy=massKg=>loadFactor(massKg)<HEAVY_BELOW;
// kg on a bed: cargo.js pieces {k:'log'} | {k:'planks',n} | {k:'crate'} | {k:'parcel',g,m,l?} | {k:'box'}
export const BOX_KG=5; // a generic box (cargo-items.js)
export const cargoMassKg=cargo=>{let kg=0;if(Array.isArray(cargo))for(const p of cargo)if(p)kg+=p.k==='planks'?(p.n||0)*MASS_KG.plank:p.k==='crate'?MASS_KG.crate:p.k==='log'?MASS_KG.log:p.k==='parcel'?(p.l?MASS_KG.parcelMedium:MASS_KG.parcelSmall):p.k==='box'?BOX_KG:0;return kg};
// kg of the gig parcel a rider has stowed: a large gig is the medium carton, an ordinary one the small carton (gig-parcel.js)
export const parcelMassKg=active=>!active?0:active.large?MASS_KG.parcelMedium:MASS_KG.parcelSmall;
