// bakery-goods.js: the bakery's restock goods, FLOUR and COFFEE BEANS in sacks (owner decision 2026-11-19: Ironwood Bakery restocks these instead of planks): keys, names, unit, placeholder prices and stock, the models (scripts/build-bakery-goods.mjs). Pure cargo registry for bakery delivery gigs.
// No DOM, no three.js, no globals. Money is integer cents, quantities whole sacks (the needs.js shape). Every price, mass, target and max here is a PLACEHOLDER until the owner tunes it.
// Supplier: Eden Wholesale (owner 2026-11-19; placed in stage W-PLACE: map-definition.js property 'eden-wholesale' on plot C21, dist/eden-wholesale.js for its dock and pickup).
export const BAKERY='property:alder-bakery'; // world-goods.js PLACES, map-definition.js:289 (Ironwood Bakery)
export const SUPPLIER='property:eden-wholesale',SUPPLIER_LABEL='Eden Wholesale',SUPPLIER_NOTE='Pick up bakery cargo from Eden Wholesale’s dock behind the Pharmacy and Bank (07:00-17:00).';
export const PLACEHOLDER=true; // prices, masses and stock numbers below are not tuned
export const MODEL_DIR='assets/goods/'; // under dist/, loaded like assets/timber (GLTFLoader, document.baseURI)
export const VARIANTS=Object.freeze(['sack','carry','pallet']);
export const SACKS_PER_PALLET=4;
// models: sack = one sack standing (base centre origin), carry = one sack lying across the arms (long side along x; size = its bounding box for carry-pose.js boxPose), pallet = a half pallet with four sacks.
// Each GLB is ONE mesh, ONE primitive, ONE material (white x COLOR_0, roughness .95, double sided): draw each kind as one InstancedMesh and share one vertex-colour material between all of them.
const good=(key,label,plural,massKg,baseCents,target,max,carrySize)=>Object.freeze({key,label,unit:'sack',unitPlural:'sacks',plural,massKg,baseCents,group:'bakery',supplier:SUPPLIER,
 demand:Object.freeze({place:BAKERY,label:'Ironwood Bakery',target,max}),
 models:Object.freeze({sack:`${MODEL_DIR}${key}-sack.glb`,carry:`${MODEL_DIR}${key}-sack-carry.glb`,pallet:`${MODEL_DIR}${key}-pallet.glb`}),
 carrySize:Object.freeze(carrySize)});
export const GOODS=Object.freeze({
 flour:good('flour','Flour','sacks of flour',25,1800,6,18,{x:.67,y:.204,z:.449}),                    // a 25 kg cream cloth sack; $18.00 PLACEHOLDER
 'coffee-beans':good('coffee-beans','Coffee beans','sacks of coffee beans',20,8000,4,12,{x:.63,y:.221,z:.472}) // a 20 kg jute sack with green stripes; $80.00 PLACEHOLDER
});
export const GOOD_KEYS=Object.freeze(Object.keys(GOODS));
// The bakery's demand in the plank-needs.js DEMAND shape ({place:{label,target,max}}), one table per good, so a later restock module can reuse qtyFor-style rules.
export const DEMAND=Object.freeze(Object.fromEntries(GOOD_KEYS.map(k=>[k,Object.freeze({[BAKERY]:Object.freeze({label:GOODS[k].demand.label,target:GOODS[k].demand.target,max:GOODS[k].demand.max})})])));
export const isBakeryGood=key=>typeof key==='string'&&Object.prototype.hasOwnProperty.call(GOODS,key);
export const goodOf=key=>isBakeryGood(key)?GOODS[key]:null;
// modelPath('flour','pallet') -> 'assets/goods/flour-pallet.glb'; null for an unknown good or variant
export const modelPath=(key,variant='sack')=>isBakeryGood(key)&&VARIANTS.includes(variant)?GOODS[key].models[variant]:null;
// price of n whole sacks in cents (0 for garbage)
export const priceOf=(key,n=1)=>isBakeryGood(key)&&Number.isSafeInteger(n)&&n>0?GOODS[key].baseCents*n:0;
// sacks shown for a count: whole pallets of SACKS_PER_PALLET, then loose sacks
export const palletsOf=n=>Number.isSafeInteger(n)&&n>0?{pallets:Math.floor(n/SACKS_PER_PALLET),loose:n%SACKS_PER_PALLET}:{pallets:0,loose:0};
