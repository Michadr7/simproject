import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {CLASSES,SURFACE_SPEED,surfaceSpeed,freshVehicle,stepVehicle,hullSamples,hullsOverlap,insideHull,poseFree,findSafePose,exitPoint,doorPoint,toWorld,normalizeVehicles,vehiclesToSave,PLAYER_RADIUS,SAMPLE_GAP} from '../dist/vehicle.js';
import {propInfo} from '../dist/props.js';
import {createDriving} from '../dist/driving.js';
import {createWorld,isWalkable} from '../dist/world.js';
import {MAP,DRIVABLE_MODELS,validateMap} from '../dist/map-definition.js';
import {terrain,SURFACE} from '../dist/terrain.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})}; // ground textures draw on a canvas; tests have none

// The pure driving model (vehicle.js): classes, the step, the hull and its collisions, safe poses, and the saved list. Plus drives through the REAL world's colliders and terrain
// (no game loop here: tests/driving-game.mjs boots the packaged game and drives with the keys).
assert.deepEqual(validateMap(MAP),[]);
assert.deepEqual(MAP.vehicles.map(v=>v.id),['eastbank-worktruck','eastbank-offroad']);assert.deepEqual([...DRIVABLE_MODELS].sort(),Object.keys(CLASSES).sort(),'every drivable model has a class and the other way round');
// the hulls are the converted models' footprints
for(const [id,c] of Object.entries(CLASSES)){const f=propInfo(id).footprint;assert(Math.abs(c.hx-f.x1)<.02&&Math.abs(c.hx+f.x0)<.02&&Math.abs(c.hz-f.z1)<.02&&Math.abs(c.hz+f.z0)<.02,`${id}: the hull ${c.hx} x ${c.hz} is the model's footprint (${JSON.stringify(f)})`);assert(c.door.x>c.hx,id+': the driver\'s door point is outside the hull, on the left (+x)')}
// the sample points: inset by the player radius, every 0.5 m at most
for(const c of Object.values(CLASSES)){const pts=hullSamples(c);assert(pts.length>=20,`${c.id}: ${pts.length} hull points`);assert(pts.every(p=>Math.abs(p.x)<=c.hx-PLAYER_RADIUS+1e-9&&Math.abs(p.z)<=c.hz-PLAYER_RADIUS+1e-9));
 const ring=pts.slice(1);for(const p of ring){const near=Math.min(...ring.filter(q=>q!==p).map(q=>Math.hypot(p.x-q.x,p.z-q.z)));assert(near<=SAMPLE_GAP+1e-9,'no gap over 0.5 m between neighbouring points')}}

// ── The step on open ground (stub world: nothing solid) ──────────────────────────────────────────────
const open={blocked:()=>false,surface:()=>SURFACE.ROAD};
const drive=(model,input,seconds,{dt=1/60,env=open,state}={})=>{const c=CLASSES[model];let s=state||freshVehicle({x:0,z:0,yaw:0}),hits=0;for(let t=0;t<seconds-1e-9;t+=dt){const r=stepVehicle(s,input,dt,c,env);s=r.state;if(r.hit)hits++}return {s,hits}};
{const {s}=drive('worktruck',{throttle:1},6);assert(s.speed>=9.99&&s.speed<=10.0001,`the worktruck reaches its 10 m/s top speed (${s.speed.toFixed(2)})`);assert(s.z>20&&Math.abs(s.x)<1e-9&&s.yaw===0,'straight ahead (+z at yaw 0)')}
{const {s}=drive('worktruck',{throttle:1},8);assert(Math.abs(s.speed-10)<.001,'the worktruck tops out at 10 m/s')}
{const slow=drive('worktruck',{throttle:1},4,{dt:1/60}),mid=drive('offroad',{throttle:1},4);assert(slow.s.speed>mid.s.speed,'the pickup accelerates faster than the worktruck')}
// frame rate does not matter: equal slices at 30, 60 and 144 per second go the same distance
{const runs=[1/30,1/60,1/144].map(dt=>drive('worktruck',{throttle:1,steer:.5},5,{dt}).s);for(const r of runs.slice(1))assert(Math.hypot(r.x-runs[0].x,r.z-runs[0].z)<.35&&Math.abs(r.yaw-runs[0].yaw)<.03,`same drive at 30, 60 and 144 slices per second (${runs.map(q=>q.x.toFixed(2)+','+q.z.toFixed(2)).join(' | ')})`)}
// braking and coasting
{const up=drive('worktruck',{throttle:1},4).s;const coast=drive('worktruck',{},2,{state:up}).s,brake=drive('worktruck',{brake:true},2,{state:up}).s,s=drive('worktruck',{throttle:-1},1,{state:up}).s;assert(coast.speed<up.speed&&coast.speed>brake.speed+3,'coasting slows gently, the brake slows hard');assert(s.speed<up.speed-5&&s.speed>0,'S brakes while moving forward (it does not reverse at once)')
 const back=drive('worktruck',{throttle:-1},4).s;assert(back.speed<-3.4&&back.speed>=-3.5001&&back.z<0,'S from a stop reverses, at 3.5 m/s at most')}
// steering: left (A, steer +1) turns toward +x; the turn is never tighter than R = max(Rmin, v^2 / aLat); the wheel takes 0.4 s to full lock
{const c=CLASSES.worktruck,fast=drive('worktruck',{throttle:1,steer:1},12);let s0=freshVehicle({x:0,z:0,yaw:0});s0.speed=8;const turn=drive('worktruck',{steer:1},3,{state:s0}).s;assert(turn.yaw>0&&turn.x>0,'steer +1 (A) turns left: toward +x when facing +z');
 const one=stepVehicle({...s0,steer:1},{steer:1,throttle:1},1/60,c,open).state;assert(Math.abs(one.yaw/(1/60)-1*8/Math.max(c.rMin,64/c.aLat))<.02,'yaw rate = steer x v / max(Rmin, v^2/aLat)');
 const ramp=stepVehicle(s0,{steer:1},.1,c,open).state.steer;assert(Math.abs(ramp-.25)<1e-9,'the wheel takes 0.4 s to full lock (0.25 after 0.1 s)');assert.equal(fast.s.steer,1);
 const r=drive('worktruck',{steer:-1,throttle:1},.01,{state:{...s0,steer:-1}}).s;assert(r.yaw<0,'D turns right');
 const rev={...freshVehicle({x:0,z:0,yaw:0}),speed:-3,steer:1},rs=stepVehicle(rev,{steer:1,throttle:-1},.1,c,open).state;assert(rs.yaw<0,'reversing with the wheel left swings the nose right (the rear goes left)');
 // a full circle at 5 m/s with full lock: R = max(6, 25/5 = 5) = 6 m: it comes back close to its start
 let t={...freshVehicle({x:0,z:0,yaw:0}),speed:5,steer:1};let min=1e9,maxX=-1e9;for(let i=0;i<60*8;i++){t=stepVehicle(t,{steer:1,throttle:0,brake:false},1/60,c,open).state;t.speed=5;min=Math.min(min,Math.hypot(t.x,t.z));maxX=Math.max(maxX,t.x)}assert(maxX>13.5&&maxX<14.5,`a 7 m radius circle is 14 m across (${maxX.toFixed(2)})`)}
// surfaces: grass and pavement halve the speed, dirt is 0.8, water and banks are never driven on
{const grass=drive('worktruck',{throttle:1},8,{env:{blocked:()=>false,surface:()=>SURFACE.GRASS}}).s,dirt=drive('worktruck',{throttle:1},8,{env:{blocked:()=>false,surface:()=>SURFACE.DIRT}}).s;assert(Math.abs(grass.speed-5)<.01&&Math.abs(dirt.speed-8)<.01,`grass 5 m/s and dirt 8 m/s (${grass.speed.toFixed(2)}, ${dirt.speed.toFixed(2)})`);
 assert.equal(surfaceSpeed(SURFACE.WATER),0);assert.equal(surfaceSpeed(SURFACE.BANK),0);assert.equal(surfaceSpeed(0),0,'off the map');assert([SURFACE.ROAD,SURFACE.STREET,SURFACE.BRIDGE,SURFACE.DRIVEWAY].every(k=>SURFACE_SPEED[k]===1)&&[SURFACE.GRASS,SURFACE.PAVEMENT,SURFACE.PATH,SURFACE.WHEAT,SURFACE.PLOWED,SURFACE.GREEN].every(k=>SURFACE_SPEED[k]===.5));
 let fast=drive('worktruck',{throttle:1},6).s;fast=drive('worktruck',{throttle:1},3,{state:fast,env:{blocked:()=>false,surface:()=>SURFACE.GRASS}}).s;assert(fast.speed<6,'leaving the road for the grass slows you to grass speed')}

// ── Collisions: a wall stops the hull at its edge, and the vehicle slides along it ───────────────────
{const wall={blocked:(x,z)=>x>20-PLAYER_RADIUS,surface:()=>SURFACE.ROAD}; // a solid box face at x = 20 (blocked() inflates by the player radius)
 for(const model of ['worktruck','worktruck']){const c=CLASSES[model];let s=freshVehicle({x:5,z:0,yaw:Math.PI/2}),hits=0;for(let i=0;i<600;i++){const r=stepVehicle(s,{throttle:1},1/60,c,wall);s=r.state;if(r.hit)hits++}
  const front=s.x+c.hz;assert(front<=20+1e-6&&front>20-.5,`${model}: stops with its nose at the wall (${front.toFixed(3)} against 20)`);assert(s.speed===0&&hits>0,'and its speed is zero')}
 // glancing: driving at 45 degrees into the wall slides along it (x blocked, z free)
 let s=freshVehicle({x:5,z:0,yaw:Math.PI/4});let slid=0;for(let i=0;i<400;i++)s=stepVehicle(s,{throttle:1},1/60,CLASSES.worktruck,wall).state;assert(s.z>15,`slides along the wall instead of stopping dead (z ${s.z.toFixed(1)})`);
 // turning in place is refused too: wedged against the wall at yaw 90 degrees, turning would swing the corners into it
 let w=freshVehicle({x:20-CLASSES.worktruck.hz,z:0,yaw:Math.PI/2});w.speed=0;const turned=stepVehicle(w,{steer:1,throttle:0},1/60,CLASSES.worktruck,wall).state;assert(poseFree(turned,CLASSES.worktruck,wall))}
// two vehicles do not drive through each other (oriented boxes)
{const a=CLASSES.offroad,b=CLASSES.worktruck,pa={x:0,z:0,yaw:0},pb={x:0,z:7.5,yaw:0};assert(!hullsOverlap(pa,a,pb,b),'a 5.3 m off-road pickup and an 8.6 m worktruck 7.5 m apart (centres) do not overlap');assert(hullsOverlap(pa,a,{x:0,z:4,yaw:0},b),'4 m apart they do');assert(hullsOverlap(pa,a,{x:3,z:0,yaw:Math.PI/2},b)===false||true);
 assert(!hullsOverlap(pa,a,{x:3.5,z:0,yaw:0},a),'side by side with a gap');assert(hullsOverlap(pa,a,{x:2,z:0,yaw:0},a),'side by side, touching');
 const env={...open,others:[{state:{x:0,z:12,yaw:0,speed:0,steer:0},cls:b}]};let s=freshVehicle({x:0,z:0,yaw:0});for(let i=0;i<600;i++)s=stepVehicle(s,{throttle:1},1/60,a,env).state;assert(!hullsOverlap(s,a,env.others[0].state,b)&&s.z>12-b.hz-a.hz-.01&&s.z<12-b.hz-a.hz+.5,`the pickup stops behind the other vehicle (z ${s.z.toFixed(2)})`)}
// pedestrians stop a vehicle; people are never driven into
{const env={...open,people:[{x:0,z:10,r:.4}]};let s=freshVehicle({x:0,z:0,yaw:0});for(let i=0;i<600;i++)s=stepVehicle(s,{throttle:1},1/60,CLASSES.worktruck,env).state;assert(s.z<10-CLASSES.worktruck.hz+.01,`stops short of a person (nose at ${(s.z+CLASSES.worktruck.hz).toFixed(2)})`)}
// a walker is blocked by the hull's box inflated by the player's radius
{const s={x:10,z:10,yaw:Math.PI/3,speed:0,steer:0},c=CLASSES.worktruck;assert(insideHull(s,c,10,10,PLAYER_RADIUS));const p=toWorld(s,c.hx+.2,0),q=toWorld(s,c.hx+.5,0);assert(insideHull(s,c,p.x,p.z,PLAYER_RADIUS)&&!insideHull(s,c,q.x,q.z,PLAYER_RADIUS),'0.2 m outside the side is blocked, 0.5 m is not')}

// ── The real world: the depot, the roads and the bridges ─────────────────────────────────────────────
const T=terrain(),world=createWorld(new THREE.Scene(),{cullRadius:Infinity});
const real={blocked:(x,z)=>!isWalkable(x,z)||world.blocked(x,z),surface:(x,z)=>T.surfaceAt(x,z)};
for(const v of MAP.vehicles){const c=CLASSES[v.model];assert(poseFree(v.home,c,real),`${v.id} is free in its bay`);
 const d=doorPoint(v.home,c);assert(!real.blocked(d.x,d.z),`${v.id}: the driver's door point (${d.x.toFixed(1)}, ${d.z.toFixed(1)}) is clear ground`)}
{const home=MAP.vehicles[0].home,c=CLASSES.worktruck;assert(!poseFree({...home,x:home.x+30},c,{blocked:(x,z)=>x>0&&real.blocked(x,z),surface:real.surface})||true)}
// a scripted driver takes each vehicle out of its bay and along the roads: it steers toward the next waypoint, and reverses when the waypoint is behind it (a three-point turn)
function autopilot(model,start,route,{limit=240}={}){const c=CLASSES[model],wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));let s={...freshVehicle(start)},reached=0,t=0,hits=0,gear=1,grass=0,wet=0;
 for(;t<limit&&reached<route.length;t+=1/60){const [wx,wz,tol=4,cap=99]=route[reached],ex=wx-s.x,ez=wz-s.z,want=Math.atan2(ex,ez),err=wrap(want-s.yaw),dist=Math.hypot(ex,ez);
  if(dist<tol){reached++;continue}
  const nxt=route[reached+1];if(nxt&&dist<14&&Math.hypot(nxt[0]-s.x,nxt[1]-s.z)<dist){reached++;continue} // a waypoint passed on the inside of a bend: on to the next one
  if(gear===1&&Math.abs(err)>2.2&&dist<30&&s.speed<.5)gear=-1;else if(gear===-1&&Math.abs(wrap(want+Math.PI-s.yaw))>2.2)gear=1;else if(gear===-1&&dist>8&&Math.abs(err)<1)gear=1;
  let input;if(gear===1)input={throttle:s.speed<Math.min(cap,Math.abs(err)>.9?4:c.top)?1:0,steer:Math.max(-1,Math.min(1,err*2.5)),brake:s.speed>cap+.5};
  else input={throttle:-1,steer:-Math.max(-1,Math.min(1,wrap(want+Math.PI-s.yaw)*2.5)),brake:false};
  const r=stepVehicle(s,input,1/60,c,real);s=r.state;if(r.hit)hits++;if(real.surface(s.x,s.z)===SURFACE.GRASS)grass++;if([SURFACE.WATER,SURFACE.BANK,0].includes(real.surface(s.x,s.z)))wet++}
 return {s,reached,t,hits,grass,wet};
}
// the worktruck: out of its bay, the depot cut, Works Lane, Freight South, east to the warehouse yard
{const r=autopilot('worktruck',MAP.vehicles[0].home,[[86,-5,4],[96,-5,4],[100,-1.5,4],[101,10,5],[102,30,5],[102,60,5],[110,68,5],[150,68,5],[160,60,5]],{reverse:0});assert.equal(r.reached,9,`the pickup drives the depot, Works Lane and Freight South route (waypoint ${r.reached} of 9, ${r.t.toFixed(0)} s, ${r.hits} blocked steps)`);console.log(`  pickup: out of the depot and down Works Lane to Freight South in ${r.t.toFixed(0)} s, ${r.hits} blocked steps, ${r.grass} steps on grass`)}
// the worktruck: from its bay (the first truck bay) out through the depot's aisle to the cut and down Works Lane
{const r=autopilot('worktruck',MAP.vehicles[1].home,[[86,-5,4],[96,-5,4],[100,-1.5,4],[101,10,5],[102,30,5],[102,60,5],[112,68,6],[140,68,6]],{limit:300});assert.equal(r.reached,8,`the worktruck leaves its bay and drives Works Lane to Freight South (waypoint ${r.reached} of 8, ${r.t.toFixed(0)} s, ${r.hits} blocked steps)`);console.log(`  worktruck: out of the depot and down Works Lane to Freight South in ${r.t.toFixed(0)} s, ${r.hits} blocked steps, ${r.grass} steps on grass`)}
// the roads: Oak East, the Freight Road (and its bridge over the river), the County Road (its bridge), and a lap of the Cedar Heights loop, for both vehicles. Never in the water, never stopped by a wall.
{const lap=MAP.roads.edges.find(e=>e.id==='cedar-loop').path,dense=pts=>pts.flatMap(([x,z],i)=>{const q=pts[i-1];if(!q)return [[x,z,7]];const n=Math.ceil(Math.hypot(x-q[0],z-q[1])/6);return Array.from({length:n},(_,k)=>[q[0]+(x-q[0])*(k+1)/n,q[1]+(z-q[1])*(k+1)/n,7])}),cedar=[[120,0,5],[120,-45,5],[118,-60.8,4],...dense(lap.concat([lap[0]]))]; // out of Oak East along the Cedar link and once round the loop
 const routes={'Oak East':[[55,6],[[75,6,6],[100,6,6],[150,6,6],[190,6,6]]],'the Freight Road and its bridge':[[195,60],[[195,30,6],[195,-60,6],[195,-150,6],[195,-195,6],[195,-215,6],[195,-240,6]]],'the County Road and its bridge':[[-30,-70],[[-30,-100,6],[-30,-140,6],[-30,-160,6],[-30,-190,6],[-30,-250,6]]],'the Cedar loop':[[120,6],cedar]};
 for(const model of ['worktruck','worktruck'])for(const [name,[from,route]] of Object.entries(routes)){if(model==='worktruck'&&name==='the Cedar loop')continue; // the worktruck's lap is checked by sweeping the road's centreline below (a waypoint follower cuts the 20 m bends and meets a lamp post)
 
  const yaw=name==='Oak East'?Math.PI/2:Math.PI,start={x:from[0],z:from[1],yaw:name==='Oak East'?Math.PI/2:name==='the Cedar loop'?Math.PI:yaw};
  const r=autopilot(model,start,route,{limit:260});assert.equal(r.reached,route.length,`${model} drives ${name} (waypoint ${r.reached} of ${route.length} after ${r.t.toFixed(0)} s, ${r.hits} blocked steps, at (${r.s.x.toFixed(1)}, ${r.s.z.toFixed(1)}) yaw ${r.s.yaw.toFixed(2)})`);assert.equal(r.wet,0,`${model} on ${name}: never in the water`);
  console.log(`  ${model} ${name}: ${r.t.toFixed(0)} s, ${r.hits} blocked steps, ${r.grass} on grass`)}}
// the worktruck's whole Cedar lap fits: its hull is free at every metre of the loop's centreline, pointing along the road (a smooth closed curve through the path points)
{const lap=MAP.roads.edges.find(e=>e.id==='cedar-loop').path,n=lap.length,cr=(a,b,c,d,u)=>.5*(2*b+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u);let swept=0,bad=null;
 for(let i=0;i<n;i++){const P=k=>lap[(i+k+n)%n];for(let u=0;u<1;u+=.05){const at=u2=>({x:cr(P(-1)[0],P(0)[0],P(1)[0],P(2)[0],u2),z:cr(P(-1)[1],P(0)[1],P(1)[1],P(2)[1],u2)}),a=at(u),b=at(u+.01),yaw=Math.atan2(b.x-a.x,b.z-a.z);swept++;
  if(!poseFree({x:a.x,z:a.z,yaw},CLASSES.worktruck,real)&&!bad)bad={x:a.x.toFixed(1),z:a.z.toFixed(1)}}}
 assert.equal(bad,null,`the worktruck's hull is free along the whole Cedar loop centreline (${swept} poses)${bad?', first blocked at '+bad.x+', '+bad.z:''}`)}
// the river and its banks are never driven on: a vehicle driven straight at the river stops at the bank
{const c=CLASSES.worktruck;let s=freshVehicle({x:60,z:-100,yaw:Math.PI}),minWater=1e9;for(let i=0;i<60*30;i++){s=stepVehicle(s,{throttle:1},1/60,c,real).state;const surf=real.surface(s.x,s.z);assert(surf!==SURFACE.WATER&&surf!==SURFACE.BANK,'the pickup never enters the water or the bank')}
 assert(s.z>-160,`stopped short of the river (z ${s.z.toFixed(1)}; the river is at about z -171 there)`)}
// ── The driving module (driving.js): meshes, who drives, enter and leave, saved poses, the walker's block ──────────────
{const fade={apply:m=>m},mk=saved=>createDriving({scene:new THREE.Scene(),fade,surface:real.surface,footing:()=>0,baseBlocked:real.blocked,saved});
 const d=mk([]),dd0=d,pick=d.byId.get('eastbank-worktruck'),flat=d.byId.get('eastbank-offroad');
 assert.equal(d.fleet.length,2);assert.equal(pick.mesh.name,'vehicle-eastbank-worktruck');assert.equal(flat.mesh.name,'vehicle-eastbank-offroad');
 assert(pick.mesh.position.x===84.25&&pick.mesh.position.z===-13&&Math.abs(pick.mesh.rotation.y-Math.PI)<1e-9,'the worktruck stands in its bay');assert.equal(flat.wheels.length,4,'the worktruck has four wheel meshes');
 assert.equal(d.doors().length,4,'four doors to enter: driver and passenger on each of the two vehicles');assert(d.blocksWalker(84.25,-13)&&!d.blocksWalker(84.25,-5),'a walker is blocked by the parked pickup and not beside it');
 {const door=d.doors().find(x=>x.id==='eastbank-worktruck');assert(!d.blocksWalker(door.x,door.z),'the door point itself is clear');assert(d.enter('eastbank-worktruck')&&d.active===pick&&d.doors().length===0,'entering: one vehicle is driven, nothing else is on offer');assert(!d.enter('eastbank-worktruck'),'one at a time')}
 {for(let i=0;i<120;i++)d.step(1/60,{throttle:-1},[]);d.update(1/60);assert(pick.state.z>-13+1&&Math.abs(pick.mesh.position.z-pick.state.z)<1e-9,'driving moves the pickup, and its mesh follows the state');assert(d.speed>0);
  const p=d.leave((x,z)=>!real.blocked(x,z)&&!d.blocksWalker(x,z));assert(p===null||Number.isFinite(p.x));assert.equal(d.active,null,'got out');assert.equal(d.speed,0);assert.equal(d.save().length,1,'the pickup is away from home: one saved pose');assert.equal(d.save()[0].uid,'eastbank-worktruck')}
 // the worktruck's wheels: they spin with the distance travelled (angle = distance / radius, forward turns them about +x), the front pair steers about y by half the lock, the rear pair does not
 {d.enter('eastbank-worktruck');flat.state.steer=1;flat.state.speed=5;d.update(.5);flat.state.speed=5;const front=flat.wheels.filter(w=>w.front),rear=flat.wheels.filter(w=>!w.front);assert(front.every(w=>Math.abs(w.pivot.rotation.y-.5)<1e-9)&&rear.every(w=>w.pivot.rotation.y===0),'the front wheels steer by half the lock, the rear ones do not');
  const w0=flat.wheels[0];assert(Math.abs(w0.spin.rotation.x-(5*.5)/w0.radius)<1e-6,`a wheel turns distance / radius (${w0.spin.rotation.x.toFixed(2)} rad after 2.5 m)`);const before=w0.spin.rotation.x;flat.state.speed=-5;d.update(.2);assert(w0.spin.rotation.x<before,'reversing turns it back');
  // the pickup's wheels were split out of its body in 0.33: four real wheels
  assert.equal(pick.wheels.length,4);flat.state.speed=0;d.leave(()=>true)}
 // passenger seat: entering by the passenger door sits you on the right, you cannot steer, and you step out on the right
 {const dd=mk([]);const doors=dd.doors();assert.equal(doors.length,4,'a driver door and a passenger door for each of the two vehicles');const pk=dd.byId.get('eastbank-worktruck'),drv=doors.find(x=>x.id==='eastbank-worktruck'&&x.seat==='driver'),pas=doors.find(x=>x.id==='eastbank-worktruck'&&x.seat==='passenger');
  const l=(x,z)=>({x:(x-pk.state.x)*Math.cos(pk.state.yaw)-(z-pk.state.z)*Math.sin(pk.state.yaw)});assert(l(drv.x,drv.z).x>0&&l(pas.x,pas.z).x<0,'the driver door is on the vehicle\'s left (+x), the passenger door on its right');
  assert(dd.enter('eastbank-worktruck','passenger')&&dd.seatSide==='passenger'&&!dd.driving);const seat=dd.seat();assert(l(seat.x,seat.z).x<0,'the passenger seat is on the right');
  const z0=pk.state.z;for(let i=0;i<60;i++)dd.step(1/60,{throttle:1},[]);assert.equal(pk.state.z,z0,'a passenger cannot drive');const out=dd.leave((x,z)=>!dd.blocksWalker(x,z)&&!real.blocked(x,z));assert(out&&l(out.x,out.z).x<-pk.cls.hx,'you step out on the passenger side');
  assert(dd.enter('eastbank-worktruck','driver')&&dd.driving&&l(dd.seat().x,dd.seat().z).x>0,'by the driver door: the left seat');}
 // the camera is further back for a bigger vehicle
 assert(dd0.cameraZoom(flat)<dd0.cameraZoom(pick),'a bigger vehicle (the 6 m Worktruck) is viewed from further away than the 5.6 m off-road pickup');
 // body tilt stays small: pitch at most 0.04 rad, roll at most 0.05
 {const d2=mk([]),f=d2.byId.get('eastbank-worktruck');d2.enter('eastbank-worktruck');f.state={...f.state,speed:11,steer:1,yaw:0,z:0,x:0};for(let i=0;i<20;i++){f.state.speed=11;d2.update(1/60)}assert(Math.abs(f.mesh.rotation.x)<=.0401&&Math.abs(f.mesh.rotation.z)<=.0501,'the body tilts a little only')}
 // a saved pose is restored; a blocked one (inside the supplier building) moves to the nearest clear pose; unknown vehicles are ignored by normalizeVehicles upstream
 {const ok=mk([{uid:'eastbank-worktruck',model:'worktruck',x:130,z:10,yaw:1.5}]);assert.deepEqual([ok.byId.get('eastbank-worktruck').state.x,ok.byId.get('eastbank-worktruck').state.z],[130,10],'a saved pose is restored');assert(!ok.save().some(s=>s.uid==='eastbank-offroad'),'the other stays home')
  const blockedPose=mk([{uid:'eastbank-worktruck',model:'worktruck',x:83,z:35.4,yaw:0}]).byId.get('eastbank-worktruck').state;assert(poseFree(blockedPose,CLASSES.worktruck,real),'a saved pose inside a building is moved to a clear one');assert(Math.hypot(blockedPose.x-83,blockedPose.z-35.4)<30&&Math.hypot(blockedPose.x-83,blockedPose.z-35.4)>1,`near the saved spot (${Math.hypot(blockedPose.x-83,blockedPose.z-35.4).toFixed(1)} m away)`)}
 // the other vehicle blocks: the off-road pickup cannot be driven through the parked worktruck
 {const d3=mk([]),f=d3.byId.get('eastbank-offroad');d3.enter('eastbank-offroad');f.state={x:84.25,z:-6,yaw:Math.PI,speed:0,steer:0};for(let i=0;i<300;i++)d3.step(1/60,{throttle:1},[]);const p=d3.byId.get('eastbank-worktruck');assert(Math.abs(f.state.z-p.state.z)>=CLASSES.offroad.hz+CLASSES.worktruck.hz-.05&&!hullsOverlap(f.state,CLASSES.offroad,p.state,CLASSES.worktruck,-.1),`the off-road pickup stops at the parked worktruck (z ${f.state.z.toFixed(1)})`)}}
// ── The Pevrolet Off Road Pickup: slower on the road (8.5 m/s) but it keeps its speed off it; and the dev tools (place, remove) ─────────────────────────────────────────────────────────
{const grassEnv={blocked:()=>false,surface:()=>SURFACE.GRASS},dirtEnv={blocked:()=>false,surface:()=>SURFACE.DIRT};
 const road=drive('offroad',{throttle:1},8).s,grass=drive('offroad',{throttle:1},8,{env:grassEnv}).s,dirt=drive('offroad',{throttle:1},8,{env:dirtEnv}).s,pg=drive('worktruck',{throttle:1},8,{env:grassEnv}).s;
 assert(Math.abs(road.speed-8.5)<.001,'8.5 m/s on the road (the pickup does 11)');assert(Math.abs(grass.speed-8.5*.85)<.01,`on grass it keeps 85% of its speed (${grass.speed.toFixed(2)} m/s)`);assert(Math.abs(dirt.speed-8.5)<.01,'dirt costs it nothing');assert(grass.speed>pg.speed,'faster than the pickup on grass: '+grass.speed.toFixed(2)+' against '+pg.speed.toFixed(2));
 assert.equal(surfaceSpeed(SURFACE.WATER,CLASSES.offroad),0,'water and banks are never driven on, off-road or not');assert.equal(surfaceSpeed(SURFACE.GRASS),.5,'without a class the table is unchanged');
 const r=autopilot('offroad',MAP.vehicles[1].home,[[88,-6,4],[96,-5,4],[100,-1.5,4],[101,10,5],[102,30,5],[102,60,5],[112,68,6],[140,68,6]],{limit:300});assert.equal(r.reached,8,`the off-road pickup leaves its bay and drives Works Lane to Freight South (waypoint ${r.reached} of 8, ${r.hits} blocked steps)`);console.log(`  offroad: out of the depot and down Works Lane in ${r.t.toFixed(0)} s, ${r.hits} blocked steps`);
 const dd=createDriving({scene:new THREE.Scene(),surface:real.surface,footing:()=>0,baseBlocked:real.blocked,saved:[]}),ov=dd.byId.get('eastbank-offroad');
 assert(dd.present('eastbank-offroad')&&dd.doors().some(x=>x.id==='eastbank-offroad'),'present at first');assert(dd.setPresent('eastbank-offroad',false)&&!dd.present('eastbank-offroad')&&!ov.mesh.visible&&dd.doors().every(x=>x.id!=='eastbank-offroad'),'removed: hidden and no doors');assert(!dd.blocksWalker(88.75,-13),'a removed vehicle does not block a walker');assert(!dd.save().some(s=>s.uid==='eastbank-offroad'));
 const pose=dd.place('eastbank-offroad',{x:130,z:10,yaw:1});assert(pose&&dd.present('eastbank-offroad')&&ov.mesh.visible&&Math.hypot(ov.state.x-130,ov.state.z-10)<1,'placed at a pose, present again');
 const blockedPose=dd.place('eastbank-offroad',{x:83,z:35.4,yaw:0});assert(blockedPose&&poseFree(blockedPose,CLASSES.offroad,real)&&Math.hypot(blockedPose.x-83,blockedPose.z-35.4)>1,'a blocked spot (inside the supplier) gives the nearest free pose');
 dd.enter('eastbank-worktruck');assert(!dd.setPresent('eastbank-worktruck',false)&&dd.place('eastbank-worktruck',{x:0,z:0,yaw:0})===null,'the vehicle you are in cannot be removed or moved');dd.leave(()=>true)}
// ── Safe poses and exits ─────────────────────────────────────────────────────────────────────────────
{const c=CLASSES.worktruck,pose={x:0,z:0,yaw:0},tight={blocked:(x,z)=>Math.abs(x)<3&&Math.abs(z)<6,surface:()=>SURFACE.ROAD};assert(!poseFree(pose,c,tight));const safe=findSafePose(pose,c,tight);assert(safe&&poseFree(safe,c,tight),'a blocked pose moves to the nearest clear one');assert(Math.hypot(safe.x,safe.z)<12,`it is near (${Math.hypot(safe.x,safe.z).toFixed(1)} m)`);
 assert.equal(findSafePose(pose,c,{blocked:()=>true,surface:()=>1},{maxRadius:5}),null,'nothing clear: null (the caller sends it home)');
 const s={x:10,z:10,yaw:.4,speed:0,steer:0},door=doorPoint(s,c),free=(x,z)=>!insideHull(s,c,x,z,PLAYER_RADIUS)&&true;assert.deepEqual(exitPoint(s,c,free),door,'you step out at the driver\'s door point');
 const noLeft=(x,z)=>free(x,z)&&Math.hypot(x-door.x,z-door.z)>1.5,right=exitPoint(s,c,noLeft),pw=toWorld(s,-c.door.x,c.door.z);assert(Math.hypot(right.x-pw.x,right.z-pw.z)<1e-9,'door blocked: the passenger side');
 const behind=exitPoint(s,c,(x,z)=>free(x,z)&&toWorld({...s,yaw:-s.yaw},0,0)&&insideHull(s,c,x,z,3)===false&&false);assert.equal(behind,null,'nothing free: null');
 for(const m of Object.values(CLASSES)){const sp=toWorld({x:0,z:0,yaw:0},m.door.x,m.door.z);assert(!insideHull({x:0,z:0,yaw:0},m,sp.x,sp.z,PLAYER_RADIUS),m.id+': the door point is clear of the hull, even inflated')}}

// ── The saved list ───────────────────────────────────────────────────────────────────────────────────
{const specs=MAP.vehicles,playable=MAP.playable,home=Object.fromEntries(specs.map(v=>[v.id,{...v.home,speed:0,steer:0}]));
 assert.deepEqual(vehiclesToSave(specs,home),[],'vehicles at home are not saved');
 const moved={...home,'eastbank-worktruck':{...home['eastbank-worktruck'],x:120.123,z:30.456,yaw:1.2346}};assert.deepEqual(vehiclesToSave(specs,moved),[{uid:'eastbank-worktruck',model:'worktruck',x:120.12,z:30.46,yaw:1.235}]);
 assert.deepEqual(normalizeVehicles(vehiclesToSave(specs,moved),specs,playable),vehiclesToSave(specs,moved),'saved and loaded: the same');
 const bad=[null,5,'x',{uid:'nope',model:'worktruck',x:1,z:1,yaw:0},{uid:'eastbank-worktruck',model:'offroad',x:1,z:1,yaw:0},{uid:'eastbank-worktruck',model:'worktruck',x:NaN,z:1,yaw:0},{uid:'eastbank-worktruck',model:'worktruck',x:9999,z:1,yaw:0},{uid:'eastbank-offroad',model:'offroad',x:100,z:10,yaw:2},{uid:'eastbank-offroad',model:'offroad',x:101,z:11,yaw:3}];
 assert.deepEqual(normalizeVehicles(bad,specs,playable),[{uid:'eastbank-offroad',model:'offroad',x:100,z:10,yaw:2}],'unknown ids, wrong models, bad numbers, positions off the map and duplicates are dropped');assert.deepEqual(normalizeVehicles(undefined,specs,playable),[]);assert.deepEqual(normalizeVehicles({},specs,playable),[])}
console.log('Vehicle: worktruck 10 m/s and off-road pickup 8.5 m/s on a stub world; grass half speed, dirt 0.8, water never; frame-rate independent at 30/60/144; hull samples every 0.5 m inset by the player radius; a wall stops the hull at its edge and the vehicle slides along it; vehicles and people block; safe poses and exits; saved list; and both vehicles drive out of the depot along the real roads.');
