// Walk legs (notes/npc-movement-design.md & notes/owner-feedback-2026-11-18.md item 2): seeded multi-leg pedestrian loops (>= 40 m per leg, no repeat pairs, connected, fixed pauses, stays on the pavement graph over 24 h).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP} from '../dist/map-definition.js';
import {buildPopulation} from '../dist/population.js';
import {dayPlan,ACTS} from '../dist/schedule.js';
import {findRoute,personPose,isCrossing,DOOR_CLEAR} from '../dist/npc-walk.js';
import {createRouteTable,tripWithTable,crowdWarm,hurryOf,HURRY_LIMIT} from '../dist/npc-routes.js';
import {MIN_LEG_METRES,PAUSE_BY_KIND,TOWN_WALK_PLACES,walkPlacePoint,placeCategory,legPauseMinutes,candidatePlacesFor,townWalkBlocked,townWalkCost,isOnPavementGraph,isTownWalker,walkLegCandidatePairs,buildWalkLegs,legsToBlocks,applyWalkLegs,createWalkSchedule} from '../dist/walk-legs.js';

// 1. Purity and header: no DOM, no three.js, no clock, no Math.random.
{const src=fs.readFileSync(new URL('../dist/walk-legs.js',import.meta.url),'utf8');
 assert.match(src,/^\/\/ walk-legs\.js:/,'header starts with file name');
 const clean=src.replace(/\/\/.*$/gm,'');
 for(const bad of ['document','window','Date.now','Math.random','performance.now','three'])assert.ok(!clean.includes(bad),'walk-legs.js must not use '+bad);
 assert.ok(!/from '\.\/(game|world|driving|phone)/.test(clean))}

// 2. Real map obstacles, terrain surfaces and warmed route table (reusing npc-routes.js, no second pathfinder).
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
const {createWorld,isWalkable}=await import('../dist/world.js');
const {terrain,SURFACE}=await import('../dist/terrain.js');
const world=createWorld(new THREE.Scene(),{cullRadius:Infinity});
const boxes=[];
for(const b of MAP.buildings){
 if(b.shop){const gap=MAP.shops[b.shop].doorway.halfWidth;boxes.push({x:b.x-(b.w/2+gap)/2,z:b.z,hx:(b.w/2-gap)/2,hz:b.d/2},{x:b.x+(b.w/2+gap)/2,z:b.z,hx:(b.w/2-gap)/2,hz:b.d/2})}
 else boxes.push({x:b.x,z:b.z,hx:b.w/2,hz:b.d/2});
}
const T=terrain(),surfaceAt=(x,z)=>T.surfaceAt(x,z),zoneAt=(x,z)=>T.zoneAt(x,z);
const baseBlocked=(x,z)=>!isWalkable(x,z)||world.blocked(x,z)||boxes.some(b=>Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33);
const blocked=townWalkBlocked(baseBlocked,surfaceAt,zoneAt,SURFACE,MAP),cost=townWalkCost(surfaceAt,SURFACE,MAP);
const routeCache=new Map();
const routeFn=(a,b)=>{const k=a+'>'+b;if(!routeCache.has(k)){const A=walkPlacePoint(a),B=walkPlacePoint(b);routeCache.set(k,A&&B?findRoute(A,B,{blocked,cost,bounds:MAP.playable}):null)}return routeCache.get(k)};

const pop=buildPopulation(),table=createRouteTable(),pairs=walkLegCandidatePairs(pop.people,MAP);
const warm=crowdWarm(pairs,routeFn,{table}).run();
assert.equal(warm.missing.length,0,'every town walk-leg pair has a route');
assert.equal(warm.direct.length,0,'no straight-line fallback on any town walk-leg pair');

const alex=pop.people.find(p=>p.name==='Alex'),malik=pop.people.find(p=>p.name==='Malik Petrov'),oscar=pop.people.find(p=>p.name==='Oscar Masic');
assert.ok(alex&&malik&&oscar,'Alex, Malik Petrov and Oscar Masic exist in town population');
for(const tp of TOWN_WALK_PLACES){const pt=walkPlacePoint(tp.id);assert.ok(pt&&!baseBlocked(pt.x,pt.z),'place point clear: '+tp.id);assert.ok(isOnPavementGraph(pt.x,pt.z,surfaceAt,zoneAt,SURFACE,MAP),'place point on pavement: '+tp.id)}

// 3. Repeatability, minimum length (>= 40 m), connected legs, no repeat pair, fixed pause rule, real place coverage.
const pairKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;
const seenCategories=new Set();
let totalLegs=0,shortestLeg=Infinity;
for(const person of [alex,malik]){
 for(const day of [1,2,3,4,5,6,7]){
  const a=buildWalkLegs(person,day,{table,seed:MAP.seed,startMinute:540,maxEndMinute:1140});
  const b=buildWalkLegs(person,day,{table,seed:MAP.seed,startMinute:540,maxEndMinute:1140});
  assert.deepEqual(a,b,`same seed, person ${person.id} and day ${day} give identical legs`);
  assert.ok(a.length>=3,`${person.name} day ${day} has at least a 3-leg loop (got ${a.length})`);
  assert.equal(a[0].from,person.home,'starts at home');assert.equal(a.at(-1).to,person.home,'returns home');
  for(let i=0;i<a.length;i++){
   const leg=a[i],measured=table.get(leg.from,leg.to);
   assert.ok(measured!==null&&leg.metres===measured,'reuses npc-routes table length');
   assert.ok(leg.metres>=MIN_LEG_METRES,`${person.name} leg ${leg.from}->${leg.to} >= ${MIN_LEG_METRES} m (got ${leg.metres})`);
   shortestLeg=Math.min(shortestLeg,leg.metres);
   assert.ok(hurryOf(leg.metres,leg.walkMinutes)<=HURRY_LIMIT,'leg walk pace within HURRY_LIMIT');
   if(i>0){assert.equal(leg.from,a[i-1].to,'legs connect end-to-start');assert.equal(leg.startMinute,a[i-1].departMinute,'times connect');assert.notEqual(pairKey(leg.from,leg.to),pairKey(a[i-1].from,a[i-1].to),'never the same pair twice in a row')}
   if(i<a.length-1)assert.equal(leg.pauseMinutes,legPauseMinutes(leg.to,person.id,day,i,MAP.seed),'fixed pause rule');
   seenCategories.add(placeCategory(leg.to,person));
   totalLegs++;
  }
 }
 // different days produce different leg sequences; different seed changes legs
 assert.notDeepEqual(buildWalkLegs(person,1,{table,seed:MAP.seed}),buildWalkLegs(person,2,{table,seed:MAP.seed}),'different days vary');
 assert.notDeepEqual(buildWalkLegs(person,1,{table,seed:MAP.seed}),buildWalkLegs(person,1,{table,seed:MAP.seed+1}),'different seed varies');
}
for(const kind of ['home','market','diner','park','bench'])assert.ok(seenCategories.has(kind),'real place kind visited: '+kind);
assert.ok(candidatePlacesFor(malik,MAP).includes('property:alder-bakery'),'Malik includes his bakery workplace');
assert.equal(placeCategory('shop:market'),'market');assert.equal(placeCategory('shop:cafe'),'diner');assert.equal(placeCategory('park:alder-square'),'park');assert.equal(placeCategory('bench:oak-south-w'),'bench');
assert.ok(PAUSE_BY_KIND.bench>=5&&PAUSE_BY_KIND.diner>=5);
assert.equal(buildWalkLegs({id:'x',resident:false,home:'away:east'},1,{table}).length,0,'commuters get no town walk legs');
assert.equal(legsToBlocks(buildWalkLegs(alex,1,{table,seed:MAP.seed})).filter(b=>b.act==='pause').length>0,true);

// 4. 24-hour simulation across all 16 town walkers x 7 days: valid plans, Malik's shift intact, skip guard, zero allocations, never leaves pavement graph or hits walls/roads.
const trip=tripWithTable(table,MAP),pose={state:'',x:0,z:0,yaw:NaN,moving:false,walked:0},ctx={point:walkPlacePoint,route:routeFn};
const VALID_ACTS=new Set([...ACTS,'pause']);
let samples=0,townWalkers=0,alexDay1WalkM=0,malikDay1WalkM=0;
for(const person of pop.people){
 if(!isTownWalker(person,MAP))continue;
 townWalkers++;
 for(let d=1;d<=7;d++){
  const base=dayPlan(person,d,{trip,weather:()=>'clear'});
  const plan=applyWalkLegs(base,person,d,{table,seed:MAP.seed,skip:p=>p.id===oscar.id});
  if(person.id===oscar.id){assert.deepEqual(plan,base,'skip guard preserves homebody plan');continue}
  assert.equal(plan[0].from,0);assert.equal(plan.at(-1).to,1440);
  let here=person.home;
  for(let k=0;k<plan.length;k++){
   const b=plan[k];assert.ok(Number.isInteger(b.from)&&Number.isInteger(b.to)&&b.to>b.from&&VALID_ACTS.has(b.act));
   if(k)assert.equal(b.from,plan[k-1].to,'contiguous plan');
   if(b.act==='travel'){assert.equal(b.origin,here);assert.notEqual(b.place,b.origin)}else assert.equal(b.place,here);
   here=b.place;
  }
  if(person.post){const [w0,w1]=person.hours;for(const m of [w0,Math.floor((w0+w1)/2),w1-1]){const b=plan.find(x=>m>=x.from&&m<x.to);assert.equal(b.act,'work',`${person.name} keeps work hours at ${m}`)}}
  if(d===1&&(person.id===alex.id||person.id===malik.id)){
   const sum=plan.filter(b=>b.act==='travel'&&b.mode==='walk').reduce((n,b)=>n+(table.get(b.origin,b.place)||0),0);
   if(person.id===alex.id)alexDay1WalkM=sum;else malikDay1WalkM=sum;
  }
  for(let m=0;m<1440;m+=0.5){
   const ret=personPose(pose,plan,m,ctx);
   assert.equal(ret,pose,'personPose mutates out in place without allocating');
   if(pose.state==='hidden')continue;
   samples++;
   assert.ok(isOnPavementGraph(pose.x,pose.z,surfaceAt,zoneAt,SURFACE,MAP),`${person.name} day ${d} min ${m} stayed on pavement graph at (${pose.x.toFixed(2)}, ${pose.z.toFixed(2)})`);
   const s=surfaceAt(pose.x,pose.z);
   if(s===SURFACE.STREET||(s===SURFACE.ROAD&&zoneAt(pose.x,pose.z)?.id==='alder'))assert.ok(isCrossing(pose.x,pose.z,MAP.crossings),`${person.name} only on road inside crossing`);
   const blk=plan.find(b=>m>=b.from&&m<b.to),pA=blk?.origin?walkPlacePoint(blk.origin):null,pB=walkPlacePoint(blk?.place);
   const nearDoor=(pA&&Math.hypot(pose.x-pA.x,pose.z-pA.z)<DOOR_CLEAR)||(pB&&Math.hypot(pose.x-pB.x,pose.z-pB.z)<DOOR_CLEAR);
   if(!nearDoor)assert.ok(!baseBlocked(pose.x,pose.z),`${person.name} day ${d} min ${m} clear of walls at (${pose.x.toFixed(2)}, ${pose.z.toFixed(2)})`);
  }
 }
}
assert.ok(alexDay1WalkM>=400&&malikDay1WalkM>=800,`longer real day walks (Alex ${alexDay1WalkM.toFixed(1)}m, Malik ${malikDay1WalkM.toFixed(1)}m)`);
// Frame-rate independence and zero-allocation memoized schedule wrapper:
{const plan=applyWalkLegs(dayPlan(alex,1,{trip,weather:()=>'clear'}),alex,1,{table,seed:MAP.seed});
 const a={...pose},b={...pose};personPose(a,plan,620.5,ctx);personPose(pose,plan,1100,ctx);personPose(pose,plan,200,ctx);personPose(b,plan,620.5,ctx);
 assert.equal(a.x,b.x);assert.equal(a.z,b.z);assert.equal(a.state,b.state);
 const ws=createWalkSchedule({planOf:(id,d)=>dayPlan(pop.people.find(x=>x.id===id),d,{trip,weather:()=>'clear'})},pop,{table,seed:MAP.seed});
 assert.equal(ws.planOf(alex.id,1),ws.planOf(alex.id,1),'createWalkSchedule memoizes per day');}

console.log(`PASS walk-legs: ${townWalkers} town walkers, ${totalLegs} Alex/Malik legs (min ${shortestLeg.toFixed(1)} m >= ${MIN_LEG_METRES} m), ${samples} 24h poses all on pavement graph`);
