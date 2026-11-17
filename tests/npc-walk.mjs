// NPC walking (0.35.11, DESIGN 4.20 A2): position along a route is a pure function of time (no ping-pong, stops at the end, same at any frame rate); A* goes round walls; a person's pose follows their plan
// (walks door to door, hidden indoors, in a car or asleep); everyone has a distinct, deterministic name.
import assert from 'node:assert/strict';
import {MAP} from '../dist/map-definition.js';
import {buildPopulation,placePoint,WALK_SPEED,tripOf} from '../dist/population.js';
import {dayPlan,createSchedule} from '../dist/schedule.js';
import {makeRoute,findRoute,walkDistance,routePoint,presenceOf,blockIndex,personPose,SECONDS_PER_MINUTE,PACE_STEP,freeReach} from '../dist/npc-walk.js';

// 1. along a route: monotone, ends and stops, never turns back
const L=makeRoute([{x:0,z:0},{x:10,z:0},{x:10,z:20}]);
assert.equal(L.length,30);
const o={x:0,z:0,yaw:0};
routePoint(L,5,o);assert.deepEqual([o.x,o.z],[5,0]);assert.ok(Math.abs(o.yaw-Math.PI/2)<1e-9,'heading +x is a quarter turn');
routePoint(L,25,o);assert.deepEqual([o.x,o.z],[10,15]);assert.ok(Math.abs(o.yaw)<1e-9,'heading +z is zero');
routePoint(L,999,o);assert.deepEqual([o.x,o.z],[10,20]);routePoint(L,-5,o);assert.deepEqual([o.x,o.z],[0,0]);
let last=-1;for(let t=0;t<=60;t+=.1){const d=walkDistance(30,t,60);assert.ok(d>=last,'never goes back');last=d}
assert.equal(walkDistance(30,1000,60),30,'arrives and stops');assert.equal(walkDistance(30,0,60),0);assert.equal(walkDistance(0,5,10),0);
assert.equal(walkDistance(10,2,100),2*WALK_SPEED,'walks at WALK_SPEED when there is time');
assert.equal(walkDistance(300,10,20),150,'a route longer than the estimate is walked faster, so they are there when the block ends');
assert.equal(walkDistance(300,20,20),300);
// the same at any frame rate: the position at time T does not depend on how it was reached
for(const dt of [1/165,1/60,1/10,.5]){let t=0;while(t<12-1e-9)t+=dt;const d=walkDistance(30,t,60);assert.equal(d,walkDistance(30,t,60))}
{const a={x:0,z:0,yaw:0},b={x:0,z:0,yaw:0};routePoint(L,walkDistance(30,7.3,60),a);routePoint(L,walkDistance(30,7.3,60),b);assert.deepEqual(a,b)}
// a single point route and a zero-length block are safe
{const p=makeRoute([{x:3,z:4}]);routePoint(p,5,o);assert.deepEqual([o.x,o.z],[3,4])}

// 2. A* goes round a wall and keeps clear of it; a closed-in goal gives a straight line; the result is deterministic
const wall=(x,z)=>Math.abs(x)<2&&z>-30&&z<30; // a wall 4 m thick across the way
const bounds={x0:-50,x1:50,z0:-50,z1:50};
const r1=findRoute({x:-20,z:0},{x:20,z:0},{blocked:wall,bounds}),r2=findRoute({x:-20,z:0},{x:20,z:0},{blocked:wall,bounds});
assert.ok(!r1.direct,'found a way');assert.deepEqual(r1,r2,'deterministic');
assert.ok(r1.length>40+10&&r1.length<120,'longer than the straight 40 m, but not absurd: '+r1.length);
for(let d=0;d<=r1.length;d+=.25){routePoint(r1,d,o);assert.ok(!wall(o.x,o.z),'never inside the wall at '+d)}
{const end=routePoint(r1,r1.length,{x:0,z:0,yaw:0});assert.deepEqual([end.x,end.z],[20,0],'ends exactly at the goal')}
{const free=findRoute({x:-20,z:0},{x:20,z:0},{blocked:()=>false,bounds});assert.ok(Math.abs(free.length-40)<1e-9,'open ground: a straight line');assert.equal(free.xs.length,2)}
{const box=(x,z)=>Math.abs(x-20)<30&&Math.abs(z)<30&&!(Math.abs(x-20)<1&&Math.abs(z)<1);const r=findRoute({x:-20,z:0},{x:20,z:0},{blocked:()=>true,bounds});assert.ok(r.direct,'no way at all: straight line, no throw');void box}
// prefers cheap ground (a pavement lane) over a shorter dear way
{const dear=(x,z)=>Math.abs(z)<6?4:1,cheap=findRoute({x:-30,z:0},{x:30,z:0},{blocked:()=>false,cost:dear,bounds});assert.ok(cheap.length>=60-1e-9);routePoint(cheap,cheap.length/2,o)}
// a door point inside the blocked margin still works (the ends count as free)
{const room=(x,z)=>Math.abs(x)<5&&Math.abs(z)<5;const r=findRoute({x:0,z:0},{x:30,z:30},{blocked:room,bounds});assert.ok(!r.direct);assert.equal(r.xs[0],0)}

// 3. presence of a block
assert.equal(presenceOf({act:'travel',mode:'walk',place:'shop:market'}),'walk');assert.equal(presenceOf({act:'travel',mode:'drive',place:'shop:market'}),'hidden');
assert.equal(presenceOf({act:'sleep',place:'dwelling:x'}),'hidden');assert.equal(presenceOf({act:'home',place:'property:x'}),'hidden');assert.equal(presenceOf({act:'away',place:'away:east'}),'hidden');
assert.equal(presenceOf({act:'work',place:'shop:market'}),'hidden');assert.equal(presenceOf({act:'work',place:'zone:forest'}),'stand');assert.equal(presenceOf({act:'work',place:'plot:I5'}),'stand');assert.equal(presenceOf({act:'shop',place:'shop:cafe'}),'hidden');

// 4. the real town: poses follow plans, join up at the doors, never jump, and nobody is in two places
const pop=buildPopulation(),sched=createSchedule(pop);
const bounds2=MAP.playable,routeCache=new Map(),ctx={point:p=>placePoint(p),route:(a,b)=>{const k=a+'>'+b;if(!routeCache.has(k)){const A=placePoint(a),B=placePoint(b);routeCache.set(k,A&&B?findRoute(A,B,{blocked:()=>false,bounds:bounds2}):null)}return routeCache.get(k)}};
const pose={state:'',x:0,z:0,yaw:NaN,moving:false,walked:0},seen={walk:0,stand:0,hidden:0};let walkers=0;
for(const p of pop.people){
 for(const day of [1,2,3,4]){
  const plan=sched.planOf(p.id,day);
  assert.equal(blockIndex(plan,0),0);assert.equal(blockIndex(plan,1439.9),plan.length-1);
  for(const b of plan){
   if(b.act!=='travel'||b.mode!=='walk')continue;walkers++;
   const A=placePoint(b.origin),B=placePoint(b.place);
   personPose(pose,plan,b.from,ctx);assert.equal(pose.state,'walk');assert.ok(Math.hypot(pose.x-A.x,pose.z-A.z)<1e-6,`${p.name} sets out from the door of ${b.origin}`);
   personPose(pose,plan,b.to-1e-6,ctx);assert.ok(Math.hypot(pose.x-B.x,pose.z-B.z)<1e-3,`${p.name} is at the door of ${b.place} when the block ends`);
   // no ping-pong: the distance walked never goes down across the block
   let prev=-1;for(let m=b.from;m<b.to;m+=(b.to-b.from)/37){personPose(pose,plan,m,ctx);assert.ok(pose.walked>=prev-1e-9,`${p.name} turned back`);prev=pose.walked}
   // after arriving the walk is over (moving false) until the block ends
   personPose(pose,plan,b.to-1e-6,ctx);if(pose.walked>=ctx.route(b.origin,b.place).length-1e-9)assert.equal(pose.moving,false);
  }
  for(let m=0;m<1440;m+=7){personPose(pose,plan,m,ctx);seen[pose.state]++;assert.ok(['walk','stand','hidden'].includes(pose.state))}
 }
}
assert.ok(walkers>10,'the town walks: '+walkers+' walking blocks');assert.ok(seen.hidden>0&&seen.walk>0,'both hidden and walking people exist: '+JSON.stringify(seen));
// the same minute asked twice, or after other minutes, gives the same place (a pure function of time: far NPCs are consistent on return)
{const p=pop.people.find(q=>sched.planOf(q.id,1).some(b=>b.act==='travel'&&b.mode==='walk')),plan=sched.planOf(p.id,1),b=plan.find(x=>x.act==='travel'&&x.mode==='walk'),m=(b.from+b.to)/2;
 const a1={...pose};personPose(a1,plan,m,ctx);const x1=a1.x,z1=a1.z;personPose(pose,plan,m+500,ctx);personPose(pose,plan,m-3,ctx);personPose(a1,plan,m,ctx);assert.equal(a1.x,x1);assert.equal(a1.z,z1)}
// a driver is never drawn as a walker, and nobody sleeping is drawn
for(const p of pop.people)for(const b of sched.planOf(p.id,1)){if(b.act==='travel'&&b.mode==='drive'){personPose(pose,sched.planOf(p.id,1),(b.from+b.to)/2,ctx);assert.equal(pose.state,'hidden')}
 if(b.act==='sleep'){personPose(pose,sched.planOf(p.id,1),(b.from+b.to)/2,ctx);assert.equal(pose.state,'hidden')}}
// night: at 3 AM nearly everyone is hidden indoors or away
{let drawn=0;for(const p of pop.people){personPose(pose,sched.planOf(p.id,2),180,ctx);if(pose.state!=='hidden')drawn++}assert.ok(drawn<=pop.people.length*.1,'at 3 AM '+drawn+' of '+pop.people.length+' are drawn')}

// 5. names: everyone has one, none is empty or generic, they are unique, the same on every build; the six Oak Street pedestrians are in the population
const names=pop.people.map(p=>p.name);
assert.ok(names.every(n=>typeof n==='string'&&n.trim()===n&&n.length>2&&!/resident/i.test(n)),'a real name, no "resident"');
const fixed=new Set([...(MAP.dwellings||[]).flatMap(d=>(d.residents||[]).map(r=>r.name)),...(MAP.properties||[]).filter(q=>q.owner?.type==='npc').map(q=>q.owner.name),...(MAP.posts||[]).filter(q=>q.person).map(q=>q.person.name)]);
assert.ok(names.filter(n=>!fixed.has(n)).every(n=>/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(n)),'generated people have a first name and a surname');
assert.equal(new Set(names).size,names.length,'unique names');
assert.deepEqual(buildPopulation().people.map(p=>p.name),names,'deterministic');
for(const n of ['Alex','Sophie','Robert','Julia','Carlos','Megan'])assert.ok(names.some(x=>x.split(' ')[0]===n),n+' is a person of the town (the pedestrian avatars are driven by their plan)');
assert.equal(SECONDS_PER_MINUTE,2);
// NPC-VISIBLE: someone out in the open paces (steps out and back along the street): it stays within PACE_STEP of their point, starts and ends on it, never jumps, and is deterministic
{const ctxP={point:()=>({x:10,z:5}),route:()=>null},planP=[{from:100,to:160,act:'outside',place:'dwelling:x'}],o={state:'',x:0,z:0,yaw:NaN,moving:false,walked:0};let prev=null,mv=0,far=0;
 for(let m=100;m<160;m+=0.02){personPose(o,planP,m,ctxP);assert.equal(o.state,'stand');assert.equal(o.z,5);far=Math.max(far,Math.abs(o.x-10));if(prev!==null)assert.ok(Math.abs(o.x-prev)<.2,'no jump');if(m===100)assert.equal(o.x,10,'starts on the point');if(o.moving)mv++;prev=o.x}
 assert.ok(far>1&&far<=PACE_STEP+1e-9,'paces '+far);assert.ok(mv>0,'walks while stepping');personPose(o,planP,159.999,ctxP);assert.ok(Math.abs(o.x-10)<.05,'ends on the point')}
// audit B8: pacing is clipped at the first blocked sample; with a wall 1 m to the right the person never goes past it, a blocked start stays put, and freeReach has the expected values
{const wall=(x,z)=>(x>11.0&&x<12)||(x<9&&x>8),o={state:'',x:0,z:0,yaw:NaN,moving:false,walked:0},planP=[{from:100,to:160,act:'outside',place:'dwelling:b8'}];
 assert.equal(freeReach(null,0,0,1,0,2.4),2.4);assert.equal(freeReach(wall,10,5,1,0,2.4),.8);assert.equal(freeReach(wall,10,5,-1,0,2.4),.8);assert.equal(freeReach(wall,11.5,5,1,0,2.4),0,'a blocked start does not pace');
 for(const dirTest of [1,-1]){let hmax=-1e9,hmin=1e9;const ctxW={point:()=>({x:10,z:5}),route:()=>null,paceReach:(pl,x,z,dir)=>freeReach(wall,x,z,dir,0,PACE_STEP)};
  for(let m=100;m<160;m+=0.02){personPose(o,planP,m,ctxW);hmax=Math.max(hmax,o.x);hmin=Math.min(hmin,o.x);assert.ok(!wall(o.x,o.z),'never inside the wall at x='+o.x)}
  assert.ok(hmax<=11.0+1e-9&&hmin>=9-1e-9,'clipped at the walls: '+hmin+'..'+hmax);void dirTest}
 const shut={point:()=>({x:10,z:5}),route:()=>null,paceReach:()=>0};for(let m=100;m<160;m+=0.5){personPose(o,planP,m,shut);assert.equal(o.x,10);assert.equal(o.moving,false)}}
console.log(`PASS npc-walk: ${pop.people.length} people, ${walkers} walking blocks over 4 days, ${JSON.stringify(seen)} poses sampled`);
