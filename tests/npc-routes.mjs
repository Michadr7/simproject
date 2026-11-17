// npc-routes (notes/npc-movement-design.md N2): the schedule sizes walking blocks from real route lengths, so with the measured routes of the real map nobody needs more than 1.15x walking speed (N1 found 1.35x with the 1.3 detour guess);
// the table falls back to the old estimate; crowdWarm fills every pair over many frames within a budget, with the same result as doing it at once.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP} from '../dist/map-definition.js';
import {buildPopulation,placePoint,tripOf,WALK_SPEED} from '../dist/population.js';
import {dayPlan} from '../dist/schedule.js';
import {findRoute} from '../dist/npc-walk.js';
import {createRouteTable,tripWithTable,walkPairsOf,crowdWarm,hurryOf,HURRY_LIMIT} from '../dist/npc-routes.js';

// 1. the table: set, get, reverse fallback, junk ignored, signature is order-free
{const t=createRouteTable();t.set('a','b',100.04).set('c','d',NaN).set('e','f',-3);
 assert.equal(t.get('a','b'),100,'rounded to 0.1 m');assert.equal(t.get('b','a'),100,'reverse pair falls back');assert.equal(t.get('x','y'),null);assert.equal(t.size,1);
 const u=createRouteTable();u.set('k','l',5).set('a','b',100);const v=createRouteTable();v.set('a','b',100).set('k','l',5);assert.equal(u.signature(),v.signature(),'order of insertion does not matter');
 v.set('k','l',6);assert.notEqual(u.signature(),v.signature())}

// 2. tripWithTable: walkers get length/WALK_SPEED rounded up; the estimate is the fallback; drivers and same-place trips are untouched
{const map=MAP,person={drives:false},t=createRouteTable(),A='shop:market',B='shop:cafe';
 const est=tripOf(A,B,person,map);assert.equal(est.mode,'walk');
 const trip=tripWithTable(t,map);assert.deepEqual(trip(A,B,person),est,'no entry: the old estimate');
 t.set(A,B,210);const r=trip(A,B,person);assert.equal(r.metres,210);assert.equal(r.minutes,Math.ceil(210/WALK_SPEED*.5));assert.equal(r.mode,'walk');
 assert.equal(trip(A,A,person).minutes,0);
 const far='away:east',d=tripWithTable(t,map)(far,A,{drives:true});assert.equal(d.mode,'drive');assert.deepEqual(d,tripOf(far,A,{drives:true},map))}

// 3. crowdWarm: a budget spreads the work, a clock-less budget is one route per step, every pair is done once, results equal one big run
{const pairs=[];for(let i=0;i<20;i++)pairs.push({from:'p'+i,to:'q'+i});pairs.push(['p0','q0'],{from:'z',to:'z'}); // a repeat and a same-place pair are dropped
 let calls=0;const fn=(a,b)=>{calls++;return a==='p7'?null:{length:parseInt(a.slice(1))*10+1,direct:a==='p3'}};
 const all=crowdWarm(pairs,fn).run();assert.equal(all.total,20);assert.equal(calls,20);assert.ok(all.done);assert.equal(all.table.size,19);assert.deepEqual(all.missing,['p7>q7']);assert.deepEqual(all.direct,['p3>q3']);
 let clock=0;calls=0;const slow=(a,b)=>{clock+=2;return fn(a,b)}; // every route costs 2 ms
 const job=crowdWarm(pairs,slow,{now:()=>clock,budgetMs:5});let steps=0,most=0;while(!job.done){const before=calls;job.step();most=Math.max(most,calls-before);steps++;assert.ok(steps<100)}
 assert.ok(steps>=7&&steps<=20,'spread over '+steps+' steps');assert.ok(most<=3,'a 5 ms budget at 2 ms a route is at most 3 routes a step, got '+most);assert.equal(job.table.signature(),all.table.signature(),'same table as one run');
 const one=crowdWarm(pairs,fn,{budgetMs:1});let n=0;while(!one.done){one.step();n++}assert.equal(n,20,'a budget with no clock is one route per step');
 const per=crowdWarm(pairs,fn,{perStep:6});assert.equal(per.step(),14,'perStep 6 leaves 14');assert.equal(crowdWarm([],fn).run().total,0)}

// 4. the real map: blocks sized from the real routes never need more than HURRY_LIMIT x walking speed (N1: up to 1.35 with the estimate)
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
const R='../dist/';
const {createWorld,isWalkable}=await import(R+'world.js');const {terrain,SURFACE}=await import(R+'terrain.js');
const world=createWorld(new THREE.Scene(),{cullRadius:Infinity});
const boxes=[];for(const b of MAP.buildings){if(b.shop){const gap=MAP.shops[b.shop].doorway.halfWidth;boxes.push({x:b.x-(b.w/2+gap)/2,z:b.z,hx:(b.w/2-gap)/2,hz:b.d/2},{x:b.x+(b.w/2+gap)/2,z:b.z,hx:(b.w/2-gap)/2,hz:b.d/2})}else boxes.push({x:b.x,z:b.z,hx:b.w/2,hz:b.d/2})}
const blocked=(x,z)=>!isWalkable(x,z)||world.blocked(x,z)||boxes.some(b=>Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33);
const cost=(x,z)=>{const s=terrain().surfaceAt(x,z);return s===SURFACE.PAVEMENT||s===SURFACE.PATH||s===SURFACE.DRIVEWAY?1:s===SURFACE.ROAD||s===SURFACE.STREET?2.5:1.4};
const routeFn=(a,b)=>{const A=placePoint(a),B=placePoint(b);return A&&B?findRoute(A,B,{blocked,cost,bounds:MAP.playable}):null};
const pop=buildPopulation(),days=[1,2,3,4,5,6,7];
const table=createRouteTable();
let before=null,rounds=0;
// the plans choose their strolls by trip time, so new pairs can appear once the table is used: warm until no plan asks for a pair that is not in the table
for(;;){const trip=tripWithTable(table,MAP),pairs=walkPairsOf(pop.people,days,(p,d)=>dayPlan(p,d,{trip})).filter(p=>!table.has(p.from,p.to)&&!table.has(p.to,p.from));
 if(!pairs.length)break;assert.ok(++rounds<=8,'the pair set closes');if(before===null)before=pairs.length;crowdWarm(pairs,routeFn,{table}).run()}
console.log('table: '+table.size+' pairs (first round '+before+'), closed after '+rounds+' rounds');
const trip=tripWithTable(table,MAP);let worst=0,worstOld=0,blocks=0;
for(const p of pop.people)for(const d of days){
 for(const b of dayPlan(p,d,{trip}))if(b.act==='travel'&&b.mode==='walk'){const len=table.get(b.origin,b.place);assert.ok(len!==null,'every walking block has a measured length: '+b.origin+'>'+b.place);blocks++;worst=Math.max(worst,hurryOf(len,b.to-b.from))}
 for(const b of dayPlan(p,d))if(b.act==='travel'&&b.mode==='walk'){const len=table.get(b.origin,b.place);if(len!==null)worstOld=Math.max(worstOld,hurryOf(len,b.to-b.from))}}
assert.ok(worstOld>HURRY_LIMIT,'sanity: the old estimate does make people hurry ('+worstOld.toFixed(2)+'x) on these routes');
assert.ok(worst<=HURRY_LIMIT,'nobody needs more than '+HURRY_LIMIT+'x walking speed, worst '+worst.toFixed(3));
// the warm job over frames gives the same table as the one-shot (budget 3 ms with a fake clock)
{let clock=0;const pairs=table.entries().map(([from,to])=>({from,to})),job=crowdWarm(pairs,(a,b)=>{clock+=1;return routeFn(a,b)},{now:()=>clock,budgetMs:3});let steps=0;while(!job.done){job.step();steps++}
 assert.equal(job.table.signature(),table.signature(),'the same lengths over '+steps+' frames')}
console.log('PASS npc-routes: '+blocks+' walking blocks, worst hurry '+worst.toFixed(2)+'x (old estimate '+worstOld.toFixed(2)+'x), table '+table.size+' pairs');
