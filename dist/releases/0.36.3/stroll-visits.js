// stroll-visits.js: how many stroll visits each shop gets in a day, so a stroll that ends at a shop front counts as a REAL shop visit in the world's demand (notes/npc-movement-design.md section 6 decision 1, stage N2). Pure.
// schedule.js plans a stroll as travel to 'shop:<id>', an 'outside' block there, and the walk home. Such a block is one visit if the shop is open at some minute of it (a shop front outside the opening hours is just a wait on the street).
// world-tick.js demandFor must add this to visitCounts (see strollDemand) or the owner's decision is not in the world; nothing else changes (the people still stand in the open and are drawn, only the shelf feels them).
export const STROLL_BASKET=1; // a stroll visit counts as this many errand visits (1 = the same as an errand; lower it in the test-checked tuning if the shelves empty)
const shopKind=place=>typeof place==='string'&&place.startsWith('shop:');

// -> {place: visits}. planOf(person,day) is dayPlan (injected); hoursOf(place)->[opens,closes]|null tells when the shop is open (default: map.shops[id].hours).
export function strollVisits(people,day,planOf,map){
 const hoursOf=typeof map==='function'?map:place=>{const s=map&&map.shops&&map.shops[place.slice(5)];return s&&s.hours?s.hours:null};
 const out={};
 for(const person of people)for(const b of planOf(person,day)){
  if(b.act!=='outside'||!shopKind(b.place))continue;
  const h=hoursOf(b.place);if(!h)continue;
  if(b.from<h[1]&&b.to>h[0])out[b.place]=(out[b.place]||0)+STROLL_BASKET;
 }
 return out;
}
// errand counts + stroll counts, place by place (both are {place: visits}; the inputs are not changed)
export function addVisits(a,b){const out={...a};for(const k of Object.keys(b||{}))out[k]=(out[k]||0)+b[k];return out}
// The one call world-tick.js needs: demandFor = day => strollDemand(people,day,dayPlan,visitCounts,MAP)
export const strollDemand=(people,day,planOf,visitCounts,map)=>addVisits(visitCounts(people,day,planOf),strollVisits(people,day,planOf,map));
