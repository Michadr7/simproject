// Axes (0.35, DESIGN 4.15 F): the three tiers, how many swings a pine takes with each, and what each needs. Pure.
//   Axe (tier 1, the starter, a Trainee is handed one), Logging Axe (tier 2, Lumberjack level 5), Steel Axe (tier 3, level 10).
// Hits to fell a pine = ceil(toughness / (damage x (1 + 0.04 x (level - 1)))), at least 1. Wear and repairs arrive in 0.37; chainsaws too.
export const PINE_TOUGHNESS=12;
export const AXES=Object.freeze({
 'axe':Object.freeze({tier:1,damage:3,level:1}),
 'logging-axe':Object.freeze({tier:2,damage:4,level:5}),
 'steel-axe':Object.freeze({tier:3,damage:6,level:10})
});
export const AXE_IDS=Object.freeze(Object.keys(AXES));
export const isAxe=id=>typeof id==='string'&&Object.prototype.hasOwnProperty.call(AXES,id);
export const hitsFor=(id,level)=>Math.max(1,Math.ceil(PINE_TOUGHNESS/(AXES[id].damage*(1+.04*(Math.max(1,level)-1)))-1e-9));
// Chainsaws (user-supplied models, 0.35; felling with them, fuel and wear arrive in 0.37; bucking a trunk works now, T-E): sold only by Ridgeline Timber's company store, the basic one to a Hauler (rank 3, level 5), the logging one to a Foreman.
export const SAWS=Object.freeze({
 'chainsaw':Object.freeze({tier:1,level:5}),
 'logging-chainsaw':Object.freeze({tier:2,level:20})
});
// Bucking a felled trunk into logs (T-A): an axe takes BUCK_HITS swings of the felling ladder, a chainsaw one short hold. Chainsaw ranks: the basic one unlocks at Rank 3 / level 5 ($350, owner 2026-11-18; items.js and map-definition.js, T-E).
export const BUCK_HIT_RATIO=.5;export const buckHitsFor=(id,level)=>Math.max(1,Math.ceil(hitsFor(id,level)*BUCK_HIT_RATIO-1e-9));
export const BUCK_SECONDS=Object.freeze({'chainsaw':1.2,'logging-chainsaw':.8});export const buckTimeSec=id=>BUCK_SECONDS[id]||0;
export const SAW_IDS=Object.freeze(Object.keys(SAWS));
export const isSaw=id=>typeof id==='string'&&Object.prototype.hasOwnProperty.call(SAWS,id);
// The axe in your hands, or null.
export const equippedAxe=progress=>isAxe(progress.equipped)?progress.equipped:null;
// The best axe in the bag (the highest tier), or null: what the phone's perks line describes when none is in your hands.
export const bestAxe=progress=>{let best=null;for(const slot of progress.inventory?.slots||[])if(isAxe(slot.id)&&(!best||AXES[slot.id].tier>AXES[best].tier))best=slot.id;return best};
