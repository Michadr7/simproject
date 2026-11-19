// rory-routes (notes/npc-movement-design.md N4 + rory-spots.js): Rory's real camp, benches and edge spots on the real map are walkable and routable with the crowd's own functions
// (walk-legs.js townWalkBlocked/townWalkCost over world.blockedStatic and the building boxes, npc-walk.js findRoute, 2 m cells, default MAX_NODES), and a whole day with the real route lengths fits inside the day.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP} from '../dist/map-definition.js';
import {findRoute,DOOR_CLEAR} from '../dist/npc-walk.js';
import {townWalkBlocked,townWalkCost,walkPlacePoint} from '../dist/walk-legs.js';
import {createRouteTable,walkLegMinutes,hurryOf,HURRY_LIMIT} from '../dist/npc-routes.js';
import {WALK_SPEED} from '../dist/population.js';
import {RORY_SPOTS,RORY_CAMP_ID,RORY_MAX_ROUTE_M,RORY_MAX_DETOUR} from '../dist/rory-spots.js';
import {RORY,RORY_WAKE,RORY_BEDTIME,visitorPlan} from '../dist/visitors.js';

globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
const {createWorld,isWalkable}=await import('../dist/world.js');const {terrain,SURFACE}=await import('../dist/terrain.js');
const world=createWorld(new THREE.Scene(),{cullRadius:Infinity});
const boxes=[];for(const b of MAP.buildings){if(b.shop){const gap=MAP.shops[b.shop].doorway.halfWidth;boxes.push({x:b.x-(b.w/2+gap)/2,z:b.z,hx:(b.w/2-gap)/2,hz:b.d/2},{x:b.x+(b.w/2+gap)/2,z:b.z,hx:(b.w/2-gap)/2,hz:b.d/2})}else boxes.push({x:b.x,z:b.z,hx:b.w/2,hz:b.d/2})}
const inBox=(x,z)=>boxes.some(b=>Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33);
const hitsCollider=(x,z)=>world.blockedStatic(x,z)||inBox(x,z);                        // the static colliders (game.js npcStaticBlocked)
const base=(x,z)=>!isWalkable(x,z)||hitsCollider(x,z);                                  // game.js npcStaticBlocked
const surfaceAt=(x,z)=>terrain().surfaceAt(x,z),zoneAt=(x,z)=>terrain().zoneAt(x,z);
const blocked=townWalkBlocked(base,surfaceAt,zoneAt,SURFACE,MAP),cost=townWalkCost(surfaceAt,SURFACE,MAP); // what game.js hands the crowd (npcWalkBlock, npcWalkCostFn)
const P=MAP.playable;

// 1. The spots: the right kinds, unique ids, one camp, inside the playable map, on walkable ground, clear of every collider; the benches are the real bench points.
{const ids=new Set(RORY_SPOTS.map(s=>s.id));assert.equal(ids.size,RORY_SPOTS.length,'unique ids');
 assert.equal(RORY_SPOTS.filter(s=>s.kind==='camp').length,1);assert.equal(RORY_SPOTS.find(s=>s.kind==='camp').id,RORY_CAMP_ID);
 assert(RORY_SPOTS.filter(s=>s.kind==='bench').length>=1&&RORY_SPOTS.filter(s=>s.kind==='edge').length>=3,'a bench and a few edge spots');
 for(const s of RORY_SPOTS){assert(Number.isFinite(s.x)&&Number.isFinite(s.z),s.id);
  assert(s.x>P.x0+10&&s.x<P.x1-10&&s.z>P.z0+10&&s.z<P.z1-10,s.id+' is inside the playable map (10 m in)');
  assert(isWalkable(s.x,s.z),s.id+' is on the walk mask');assert(!hitsCollider(s.x,s.z),s.id+' hits no collider');assert(!blocked(s.x,s.z),s.id+' is not blocked for the crowd');
  const sf=surfaceAt(s.x,s.z);assert(sf!==SURFACE.WATER&&sf!==SURFACE.ROAD&&sf!==SURFACE.STREET,s.id+' is not in water or on the carriageway');
  if(s.place){const q=walkPlacePoint(s.place);assert(q&&Math.abs(q.x-s.x)<1e-9&&Math.abs(q.z-s.z)<1e-9,s.id+' still equals the real '+s.place+' point')}}}

// 2. Every ordered pair (camp -> spot, spot -> camp, bench -> edge and so on: Rory walks spot to spot too): a real A* route, not a straight line, never off the mask or into a collider, not absurdly long.
const table=createRouteTable();let worst=0,worstPair='',worstDetour=0,pairs=0;
const SOFT_LIMIT_M=3;let softWorst=0; // findRoute only tests cell centres, edge middles and quarter points on each 2 m step, so a diagonal step may clip the corner of a forbidden cell by a few tenths of a metre: that is how every crowd walker behaves, so it is bounded, not forbidden
for(const a of RORY_SPOTS)for(const b of RORY_SPOTS){if(a===b)continue;pairs++;let soft=0;
 const r=findRoute(a,b,{blocked,cost,bounds:P}),tag=a.id+' > '+b.id,straight=Math.hypot(a.x-b.x,a.z-b.z);
 assert.equal(r.direct,false,tag+': A* fell back to a straight line');
 assert(r.length>=straight-1e-6,tag+': a route is never shorter than the straight line');
 assert(r.length<=RORY_MAX_ROUTE_M,tag+': '+r.length.toFixed(0)+' m is over '+RORY_MAX_ROUTE_M+' m');
 assert(r.length<=RORY_MAX_DETOUR*Math.max(straight,100),tag+': '+r.length.toFixed(0)+' m is over '+RORY_MAX_DETOUR+' x the straight '+straight.toFixed(0)+' m (a short straight line counts as 100 m)');
 assert(Math.hypot(r.xs[0]-a.x,r.zs[0]-a.z)<1e-9&&Math.hypot(r.xs.at(-1)-b.x,r.zs.at(-1)-b.z)<1e-9,tag+': starts and ends at the spots');
 for(let i=1;i<r.xs.length;i++){const dx=r.xs[i]-r.xs[i-1],dz=r.zs[i]-r.zs[i-1],len=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(len/.25));
  for(let q=0;q<=n;q++){const x=r.xs[i-1]+dx*q/n,z=r.zs[i-1]+dz*q/n;
   assert(x>=P.x0&&x<=P.x1&&z>=P.z0&&z<=P.z1,tag+': leaves the playable rectangle at '+x.toFixed(1)+','+z.toFixed(1));
   assert(isWalkable(x,z),tag+': leaves the walk mask at '+x.toFixed(1)+','+z.toFixed(1));
   assert(!hitsCollider(x,z),tag+': hits a collider at '+x.toFixed(1)+','+z.toFixed(1));
   if(blocked(x,z))soft+=.25}} // townWalkBlocked's pavement rule only (the mask and colliders are strict above)
 assert(soft<=SOFT_LIMIT_M,tag+': '+soft+' m of the route is on ground the town pavement rule forbids (limit '+SOFT_LIMIT_M+' m)');if(process.env.RORY_DEBUG&&soft)console.log(tag,'soft',soft);softWorst=Math.max(softWorst,soft)
 table.set(a.id,b.id,r.length);if(r.length>worst){worst=r.length;worstPair=tag}worstDetour=Math.max(worstDetour,r.length/Math.max(straight,100))}
assert.equal(pairs,RORY_SPOTS.length*(RORY_SPOTS.length-1));
// the way home from the camp is about as long as the way out (the route table's reverse fallback is only an estimate)
for(const s of RORY_SPOTS)if(s.id!==RORY_CAMP_ID){const out=table.get(RORY_CAMP_ID,s.id),back=table.get(s.id,RORY_CAMP_ID);assert(Math.abs(out-back)<=.1*Math.max(out,back)+5,s.id+': out '+out+' m, back '+back+' m')}

// 3. The full day with the real route lengths (the N4 midnight bug: a walk home that runs past 24:00). 60 days x (no weather, fine, storm).
const trip=(a,b)=>({minutes:walkLegMinutes(table.get(a,b))}); // the same sum as npc-routes tripWithTable
let stayedIn=0,latestHome=0,walks=0,hurry=0,roamMinutes=0;
for(let day=1;day<=60;day++)for(const weather of [undefined,()=>'clear',()=>'storm']){
 const plan=visitorPlan(RORY,day,{weather,trip}),msg='day '+day;
 assert.equal(plan[0].from,0);assert.equal(plan.at(-1).to,1440);for(let i=1;i<plan.length;i++)assert.equal(plan[i].from,plan[i-1].to,msg+': contiguous');
 assert.equal(plan[0].act,'sleep');assert.equal(plan.at(-1).act,'sleep');assert.equal(plan.at(-1).place,RORY_CAMP_ID,msg+': ends asleep at camp');
 for(const b of plan){if(b.act!=='travel')continue;walks++;
  const len=table.get(b.origin,b.place);assert(len!==null,msg+': a measured route for '+b.origin+' > '+b.place);
  assert.equal(b.to-b.from,walkLegMinutes(len),msg+': the walk block is sized from the real length, not cut short by midnight');
  hurry=Math.max(hurry,hurryOf(len,b.to-b.from));assert(b.to<=1440,msg+': a walk ends inside the day')}
 const lastWalk=plan.filter(b=>b.act==='travel').at(-1);if(!lastWalk){stayedIn++;continue} // a storm day: he never leaves camp
 assert.equal(lastWalk.place,RORY_CAMP_ID,msg+': the last walk is the way home');
 assert(lastWalk.to<=RORY_BEDTIME[0]+RORY_BEDTIME[1]+150,msg+': home by '+lastWalk.to+', long before midnight');
 assert(1440-lastWalk.to>=60,msg+': at least an hour asleep at camp before midnight, got '+(1440-lastWalk.to)+' min');
 latestHome=Math.max(latestHome,lastWalk.to);
 for(const b of plan)if(b.act!=='sleep'&&b.place!==RORY_CAMP_ID)roamMinutes+=b.to-b.from}
assert(hurry<=HURRY_LIMIT,'Rory never needs more than '+HURRY_LIMIT+' x walking speed, worst '+hurry.toFixed(3));
assert(roamMinutes>0,'he does leave camp');
// worst case by arithmetic: the latest bedtime-start walk. He only sets out when out + minimum stay + back fits before bedtime, so the longest possible walk home ends before bedtime + one walk.
const longest=walkLegMinutes(worst);assert(RORY_BEDTIME[0]+RORY_BEDTIME[1]+longest<1440,'even the longest walk starting at the latest bedtime ends before midnight ('+(RORY_BEDTIME[0]+RORY_BEDTIME[1]+longest)+')');
console.log(`PASS rory-routes: ${RORY_SPOTS.length} real spots, ${pairs} routes none direct, longest ${worst.toFixed(0)} m (${worstPair}, ${walkLegMinutes(worst)} game min at ${WALK_SPEED} m/s), worst detour ${worstDetour.toFixed(2)}x, ${walks} walk blocks over 180 days, latest home ${Math.floor(latestHome/60)}:${String(latestHome%60).padStart(2,'0')}, worst hurry ${hurry.toFixed(2)}x, ${stayedIn} days at camp, most pavement-rule clipping ${softWorst} m on one route`);
setTimeout(()=>{},0).unref?.();
