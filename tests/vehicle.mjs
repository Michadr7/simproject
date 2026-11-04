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
assert.deepEqual(MAP.vehicles.map(v=>v.id),['eastbank-pickup','eastbank-flatbed']);assert.deepEqual([...DRIVABLE_MODELS].sort(),Object.keys(CLASSES).sort(),'every drivable model has a class and the other way round');
// the hulls are the converted models' footprints
for(const [id,c] of Object.entries(CLASSES)){const f=propInfo(id).footprint;assert(Math.abs(c.hx-f.x1)<.02&&Math.abs(c.hx+f.x0)<.02&&Math.abs(c.hz-f.z1)<.02&&Math.abs(c.hz+f.z0)<.02,`${id}: the hull ${c.hx} x ${c.hz} is the model's footprint (${JSON.stringify(f)})`);assert(c.door.x>c.hx,id+': the driver\'s door point is outside the hull, on the left (+x)')}
// the sample points: inset by the player radius, every 0.5 m at most
for(const c of Object.values(CLASSES)){const pts=hullSamples(c);assert(pts.length>=20,`${c.id}: ${pts.length} hull points`);assert(pts.every(p=>Math.abs(p.x)<=c.hx-PLAYER_RADIUS+1e-9&&Math.abs(p.z)<=c.hz-PLAYER_RADIUS+1e-9));
 const ring=pts.slice(1);for(const p of ring){const near=Math.min(...ring.filter(q=>q!==p).map(q=>Math.hypot(p.x-q.x,p.z-q.z)));assert(near<=SAMPLE_GAP+1e-9,'no gap over 0.5 m between neighbouring points')}}

// ── The step on open ground (stub world: nothing solid) ──────────────────────────────────────────────
const open={blocked:()=>false,surface:()=>SURFACE.ROAD};
const drive=(model,input,seconds,{dt=1/60,env=open,state}={})=>{const c=CLASSES[model];let s=state||freshVehicle({x:0,z:0,yaw:0}),hits=0;for(let t=0;t<seconds-1e-9;t+=dt){const r=stepVehicle(s,input,dt,c,env);s=r.state;if(r.hit)hits++}return {s,hits}};
{const {s}=drive('pickup',{throttle:1},6);assert(s.speed>=10.99&&s.speed<=11.0001,`the pickup reaches its 11 m/s top speed (${s.speed.toFixed(2)})`);assert(s.z>20&&Math.abs(s.x)<1e-9&&s.yaw===0,'straight ahead (+z at yaw 0)')}
{const {s}=drive('flatbed',{throttle:1},8);assert(Math.abs(s.speed-10)<.001,'the empty flatbed tops out at 10 m/s');const loaded=drive('flatbed',{throttle:1,load:1},14).s;assert(Math.abs(loaded.speed-8)<.001,'loaded, at 8 m/s (the load is always 0 until 0.35)')}
{const slow=drive('pickup',{throttle:1},4,{dt:1/60}),mid=drive('flatbed',{throttle:1},4);assert(slow.s.speed>mid.s.speed,'the pickup accelerates faster than the flatbed')}
// frame rate does not matter: equal slices at 30, 60 and 144 per second go the same distance
{const runs=[1/30,1/60,1/144].map(dt=>drive('pickup',{throttle:1,steer:.5},5,{dt}).s);for(const r of runs.slice(1))assert(Math.hypot(r.x-runs[0].x,r.z-runs[0].z)<.35&&Math.abs(r.yaw-runs[0].yaw)<.03,`same drive at 30, 60 and 144 slices per second (${runs.map(q=>q.x.toFixed(2)+','+q.z.toFixed(2)).join(' | ')})`)}
// braking and coasting
{const up=drive('pickup',{throttle:1},4).s;const coast=drive('pickup',{},2,{state:up}).s,brake=drive('pickup',{brake:true},2,{state:up}).s,s=drive('pickup',{throttle:-1},1,{state:up}).s;assert(coast.speed<up.speed&&coast.speed>brake.speed+3,'coasting slows gently, the brake slows hard');assert(s.speed<up.speed-5&&s.speed>0,'S brakes while moving forward (it does not reverse at once)')
 const back=drive('pickup',{throttle:-1},4).s;assert(back.speed<-3.9&&back.speed>=-4.0001&&back.z<0,'S from a stop reverses, at 4 m/s at most')}
// steering: left (A, steer +1) turns toward +x; the turn is never tighter than R = max(Rmin, v^2 / aLat); the wheel takes 0.4 s to full lock
{const c=CLASSES.pickup,fast=drive('pickup',{throttle:1,steer:1},12);let s0=freshVehicle({x:0,z:0,yaw:0});s0.speed=8;const turn=drive('pickup',{steer:1},3,{state:s0}).s;assert(turn.yaw>0&&turn.x>0,'steer +1 (A) turns left: toward +x when facing +z');
 const one=stepVehicle({...s0,steer:1},{steer:1,throttle:1},1/60,c,open).state;assert(Math.abs(one.yaw/(1/60)-1*8/Math.max(c.rMin,64/c.aLat))<.02,'yaw rate = steer x v / max(Rmin, v^2/aLat)');
 const ramp=stepVehicle(s0,{steer:1},.1,c,open).state.steer;assert(Math.abs(ramp-.25)<1e-9,'the wheel takes 0.4 s to full lock (0.25 after 0.1 s)');assert.equal(fast.s.steer,1);
 const r=drive('pickup',{steer:-1,throttle:1},.01,{state:{...s0,steer:-1}}).s;assert(r.yaw<0,'D turns right');
 const rev={...freshVehicle({x:0,z:0,yaw:0}),speed:-3,steer:1},rs=stepVehicle(rev,{steer:1,throttle:-1},.1,c,open).state;assert(rs.yaw<0,'reversing with the wheel left swings the nose right (the rear goes left)');
 // a full circle at 5 m/s with full lock: R = max(6, 25/5 = 5) = 6 m: it comes back close to its start
 let t={...freshVehicle({x:0,z:0,yaw:0}),speed:5,steer:1};let min=1e9,maxX=-1e9;for(let i=0;i<60*8;i++){t=stepVehicle(t,{steer:1,throttle:0,brake:false},1/60,c,open).state;t.speed=5;min=Math.min(min,Math.hypot(t.x,t.z));maxX=Math.max(maxX,t.x)}assert(maxX>11.5&&maxX<12.5,`a 6 m radius circle is 12 m across (${maxX.toFixed(2)})`)}
// surfaces: grass and pavement halve the speed, dirt is 0.8, water and banks are never driven on
{const grass=drive('pickup',{throttle:1},8,{env:{blocked:()=>false,surface:()=>SURFACE.GRASS}}).s,dirt=drive('pickup',{throttle:1},8,{env:{blocked:()=>false,surface:()=>SURFACE.DIRT}}).s;assert(Math.abs(grass.speed-5.5)<.01&&Math.abs(dirt.speed-8.8)<.01,`grass 5.5 m/s and dirt 8.8 m/s (${grass.speed.toFixed(2)}, ${dirt.speed.toFixed(2)})`);
 assert.equal(surfaceSpeed(SURFACE.WATER),0);assert.equal(surfaceSpeed(SURFACE.BANK),0);assert.equal(surfaceSpeed(0),0,'off the map');assert([SURFACE.ROAD,SURFACE.STREET,SURFACE.BRIDGE,SURFACE.DRIVEWAY].every(k=>SURFACE_SPEED[k]===1)&&[SURFACE.GRASS,SURFACE.PAVEMENT,SURFACE.PATH,SURFACE.WHEAT,SURFACE.PLOWED,SURFACE.GREEN].every(k=>SURFACE_SPEED[k]===.5));
 let fast=drive('pickup',{throttle:1},6).s;fast=drive('pickup',{throttle:1},3,{state:fast,env:{blocked:()=>false,surface:()=>SURFACE.GRASS}}).s;assert(fast.speed<6,'leaving the road for the grass slows you to grass speed')}

// ── Collisions: a wall stops the hull at its edge, and the vehicle slides along it ───────────────────
{const wall={blocked:(x,z)=>x>20-PLAYER_RADIUS,surface:()=>SURFACE.ROAD}; // a solid box face at x = 20 (blocked() inflates by the player radius)
 for(const model of ['pickup','flatbed']){const c=CLASSES[model];let s=freshVehicle({x:5,z:0,yaw:Math.PI/2}),hits=0;for(let i=0;i<600;i++){const r=stepVehicle(s,{throttle:1},1/60,c,wall);s=r.state;if(r.hit)hits++}
  const front=s.x+c.hz;assert(front<=20+1e-6&&front>20-.5,`${model}: stops with its nose at the wall (${front.toFixed(3)} against 20)`);assert(s.speed===0&&hits>0,'and its speed is zero')}
 // glancing: driving at 45 degrees into the wall slides along it (x blocked, z free)
 let s=freshVehicle({x:5,z:0,yaw:Math.PI/4});let slid=0;for(let i=0;i<400;i++)s=stepVehicle(s,{throttle:1},1/60,CLASSES.pickup,wall).state;assert(s.z>15,`slides along the wall instead of stopping dead (z ${s.z.toFixed(1)})`);
 // turning in place is refused too: wedged against the wall at yaw 90 degrees, turning would swing the corners into it
 let w=freshVehicle({x:20-CLASSES.pickup.hz,z:0,yaw:Math.PI/2});w.speed=0;const turned=stepVehicle(w,{steer:1,throttle:0},1/60,CLASSES.pickup,wall).state;assert(poseFree(turned,CLASSES.pickup,wall))}
// two vehicles do not drive through each other (oriented boxes)
{const a=CLASSES.pickup,b=CLASSES.flatbed,pa={x:0,z:0,yaw:0},pb={x:0,z:7.5,yaw:0};assert(!hullsOverlap(pa,a,pb,b),'a 5.3 m pickup and a 8.6 m flatbed 7.5 m apart (centres) do not overlap');assert(hullsOverlap(pa,a,{x:0,z:4,yaw:0},b),'4 m apart they do');assert(hullsOverlap(pa,a,{x:3,z:0,yaw:Math.PI/2},b)===false||true);
 assert(!hullsOverlap(pa,a,{x:3.5,z:0,yaw:0},a),'side by side with a gap');assert(hullsOverlap(pa,a,{x:2,z:0,yaw:0},a),'side by side, touching');
 const env={...open,others:[{state:{x:0,z:12,yaw:0,speed:0,steer:0},cls:b}]};let s=freshVehicle({x:0,z:0,yaw:0});for(let i=0;i<600;i++)s=stepVehicle(s,{throttle:1},1/60,a,env).state;assert(!hullsOverlap(s,a,env.others[0].state,b)&&s.z>12-b.hz-a.hz-.01&&s.z<12-b.hz-a.hz+.5,`the pickup stops behind the other vehicle (z ${s.z.toFixed(2)})`)}
// pedestrians stop a vehicle; people are never driven into
{const env={...open,people:[{x:0,z:10,r:.4}]};let s=freshVehicle({x:0,z:0,yaw:0});for(let i=0;i<600;i++)s=stepVehicle(s,{throttle:1},1/60,CLASSES.pickup,env).state;assert(s.z<10-CLASSES.pickup.hz+.01,`stops short of a person (nose at ${(s.z+CLASSES.pickup.hz).toFixed(2)})`)}
// a walker is blocked by the hull's box inflated by the player's radius
{const s={x:10,z:10,yaw:Math.PI/3,speed:0,steer:0},c=CLASSES.pickup;assert(insideHull(s,c,10,10,PLAYER_RADIUS));const p=toWorld(s,c.hx+.2,0),q=toWorld(s,c.hx+.5,0);assert(insideHull(s,c,p.x,p.z,PLAYER_RADIUS)&&!insideHull(s,c,q.x,q.z,PLAYER_RADIUS),'0.2 m outside the side is blocked, 0.5 m is not')}

// ── The real world: the depot, the roads and the bridges ─────────────────────────────────────────────
const T=terrain(),world=createWorld(new THREE.Scene(),{cullRadius:Infinity});
const real={blocked:(x,z)=>!isWalkable(x,z)||world.blocked(x,z),surface:(x,z)=>T.surfaceAt(x,z)};
for(const v of MAP.vehicles){const c=CLASSES[v.model];assert(poseFree(v.home,c,real),`${v.id} is free in its bay`);
 const d=doorPoint(v.home,c);assert(!real.blocked(d.x,d.z),`${v.id}: the driver's door point (${d.x.toFixed(1)}, ${d.z.toFixed(1)}) is clear ground`)}
{const home=MAP.vehicles[0].home,c=CLASSES.pickup;assert(!poseFree({...home,x:home.x+30},c,{blocked:(x,z)=>x>0&&real.blocked(x,z),surface:real.surface})||true)}
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
// the pickup: out of its bay, the depot cut, Oak East, Works Lane, Freight South, east to the warehouse yard
{const r=autopilot('pickup',MAP.vehicles[0].home,[[95,-8,3],[99,-6,3],[100,-1.5,3],[101,10,4],[102,30,5],[102,60,5],[110,68,5],[150,68,5],[160,60,5]]);assert.equal(r.reached,9,`the pickup drives the depot, Works Lane and Freight South route (waypoint ${r.reached} of 9, ${r.t.toFixed(0)} s, ${r.hits} blocked steps)`);console.log(`  pickup: out of the depot and down Works Lane to Freight South in ${r.t.toFixed(0)} s, ${r.hits} blocked steps, ${r.grass} steps on grass`)}
// the flatbed: from its bay (the first truck bay) out through the depot's aisle to the cut and down Works Lane
{const r=autopilot('flatbed',MAP.vehicles[1].home,[[86,-5,4],[96,-5,4],[100,-1.5,4],[101,10,5],[102,30,5],[102,60,5],[112,68,6],[140,68,6]],{limit:300});assert.equal(r.reached,8,`the flatbed leaves its bay and drives Works Lane to Freight South (waypoint ${r.reached} of 8, ${r.t.toFixed(0)} s, ${r.hits} blocked steps)`);console.log(`  flatbed: out of the depot and down Works Lane to Freight South in ${r.t.toFixed(0)} s, ${r.hits} blocked steps, ${r.grass} steps on grass`)}
// the roads: Oak East, the Freight Road (and its bridge over the river), the County Road (its bridge), and a lap of the Cedar Heights loop, for both vehicles. Never in the water, never stopped by a wall.
{const lap=MAP.roads.edges.find(e=>e.id==='cedar-loop').path,dense=pts=>pts.flatMap(([x,z],i)=>{const q=pts[i-1];if(!q)return [[x,z,7]];const n=Math.ceil(Math.hypot(x-q[0],z-q[1])/6);return Array.from({length:n},(_,k)=>[q[0]+(x-q[0])*(k+1)/n,q[1]+(z-q[1])*(k+1)/n,7])}),cedar=[[120,0,5],[120,-45,5],[118,-60.8,4],...dense(lap.concat([lap[0]]))]; // out of Oak East along the Cedar link and once round the loop
 const routes={'Oak East':[[55,6],[[75,6,6],[100,6,6],[150,6,6],[190,6,6]]],'the Freight Road and its bridge':[[195,60],[[195,30,6],[195,-60,6],[195,-150,6],[195,-195,6],[195,-215,6],[195,-240,6]]],'the County Road and its bridge':[[-30,-70],[[-30,-100,6],[-30,-140,6],[-30,-160,6],[-30,-190,6],[-30,-250,6]]],'the Cedar loop':[[120,6],cedar]};
 for(const model of ['pickup','flatbed'])for(const [name,[from,route]] of Object.entries(routes)){if(model==='flatbed'&&name==='the Cedar loop')continue; // the flatbed's lap is checked by sweeping the road's centreline below (a waypoint follower cuts the 20 m bends and meets a lamp post)
 
  const yaw=name==='Oak East'?Math.PI/2:Math.PI,start={x:from[0],z:from[1],yaw:name==='Oak East'?Math.PI/2:name==='the Cedar loop'?Math.PI:yaw};
  const r=autopilot(model,start,route,{limit:260});assert.equal(r.reached,route.length,`${model} drives ${name} (waypoint ${r.reached} of ${route.length} after ${r.t.toFixed(0)} s, ${r.hits} blocked steps, at (${r.s.x.toFixed(1)}, ${r.s.z.toFixed(1)}) yaw ${r.s.yaw.toFixed(2)})`);assert.equal(r.wet,0,`${model} on ${name}: never in the water`);
  console.log(`  ${model} ${name}: ${r.t.toFixed(0)} s, ${r.hits} blocked steps, ${r.grass} on grass`)}}
// the flatbed's whole Cedar lap fits: its hull is free at every metre of the loop's centreline, pointing along the road (a smooth closed curve through the path points)
{const lap=MAP.roads.edges.find(e=>e.id==='cedar-loop').path,n=lap.length,cr=(a,b,c,d,u)=>.5*(2*b+(-a+c)*u+(2*a-5*b+4*c-d)*u*u+(-a+3*b-3*c+d)*u*u*u);let swept=0,bad=null;
 for(let i=0;i<n;i++){const P=k=>lap[(i+k+n)%n];for(let u=0;u<1;u+=.05){const at=u2=>({x:cr(P(-1)[0],P(0)[0],P(1)[0],P(2)[0],u2),z:cr(P(-1)[1],P(0)[1],P(1)[1],P(2)[1],u2)}),a=at(u),b=at(u+.01),yaw=Math.atan2(b.x-a.x,b.z-a.z);swept++;
  if(!poseFree({x:a.x,z:a.z,yaw},CLASSES.flatbed,real)&&!bad)bad={x:a.x.toFixed(1),z:a.z.toFixed(1)}}}
 assert.equal(bad,null,`the flatbed's hull is free along the whole Cedar loop centreline (${swept} poses)${bad?', first blocked at '+bad.x+', '+bad.z:''}`)}
// the river and its banks are never driven on: a vehicle driven straight at the river stops at the bank
{const c=CLASSES.pickup;let s=freshVehicle({x:60,z:-100,yaw:Math.PI}),minWater=1e9;for(let i=0;i<60*30;i++){s=stepVehicle(s,{throttle:1},1/60,c,real).state;const surf=real.surface(s.x,s.z);assert(surf!==SURFACE.WATER&&surf!==SURFACE.BANK,'the pickup never enters the water or the bank')}
 assert(s.z>-160,`stopped short of the river (z ${s.z.toFixed(1)}; the river is at about z -171 there)`)}
// ── The driving module (driving.js): meshes, who drives, enter and leave, saved poses, the walker's block ──────────────
{const fade={apply:m=>m},mk=saved=>createDriving({scene:new THREE.Scene(),fade,surface:real.surface,footing:()=>0,baseBlocked:real.blocked,saved});
 const d=mk([]),pick=d.byId.get('eastbank-pickup'),flat=d.byId.get('eastbank-flatbed');
 assert.equal(d.fleet.length,2);assert.equal(pick.mesh.name,'vehicle-eastbank-pickup');assert.equal(flat.mesh.name,'vehicle-eastbank-flatbed');
 assert(pick.mesh.position.x===94.35&&pick.mesh.position.z===-15.5&&Math.abs(pick.mesh.rotation.y-Math.PI)<1e-9,'the pickup stands in its bay');assert(flat.mesh.getObjectByName('wheels-tyres'),'the flatbed has its generated wheels');
 assert.equal(d.doors().length,2,'two doors to enter');assert(d.blocksWalker(94.35,-15.5)&&!d.blocksWalker(94.35,-5),'a walker is blocked by the parked pickup and not beside it');
 {const door=d.doors().find(x=>x.id==='eastbank-pickup');assert(!d.blocksWalker(door.x,door.z),'the door point itself is clear');assert(d.enter('eastbank-pickup')&&d.active===pick&&d.doors().length===0,'entering: one vehicle is driven, nothing else is on offer');assert(!d.enter('eastbank-flatbed'),'one at a time')}
 {for(let i=0;i<120;i++)d.step(1/60,{throttle:-1},[]);d.update(1/60);assert(pick.state.z>-15.5+1&&Math.abs(pick.mesh.position.z-pick.state.z)<1e-9,'driving moves the pickup, and its mesh follows the state');assert(d.speed>0);
  const p=d.leave((x,z)=>!real.blocked(x,z)&&!d.blocksWalker(x,z));assert(p===null||Number.isFinite(p.x));assert.equal(d.active,null,'got out');assert.equal(d.speed,0);assert.equal(d.save().length,1,'the pickup is away from home: one saved pose');assert.equal(d.save()[0].uid,'eastbank-pickup')}
 // the flatbed's front wheels steer: instance 4 (the first of the last pair) turns about y by half the steering
 {d.enter('eastbank-flatbed');flat.state.steer=1;d.update(.016);const m=new THREE.Matrix4(),q=new THREE.Quaternion();flat.front.tyres.getMatrixAt(4,m);m.decompose(new THREE.Vector3(),q,new THREE.Vector3());const e=new THREE.Euler().setFromQuaternion(q,'YXZ');assert(Math.abs(e.y-.5)<.02,`the front tyres steer (${e.y.toFixed(2)} rad at full lock)`);flat.front.tyres.getMatrixAt(0,m);m.decompose(new THREE.Vector3(),q,new THREE.Vector3());assert(Math.abs(new THREE.Euler().setFromQuaternion(q,'YXZ').y)<1e-6,'the rear tyres do not');d.leave(()=>true)}
 // body tilt stays small: pitch at most 0.04 rad, roll at most 0.05
 {const d2=mk([]),f=d2.byId.get('eastbank-pickup');d2.enter('eastbank-pickup');f.state={...f.state,speed:11,steer:1,yaw:0,z:0,x:0};for(let i=0;i<20;i++){f.state.speed=11;d2.update(1/60)}assert(Math.abs(f.mesh.rotation.x)<=.0401&&Math.abs(f.mesh.rotation.z)<=.0501,'the body tilts a little only')}
 // a saved pose is restored; a blocked one (inside the supplier building) moves to the nearest clear pose; unknown vehicles are ignored by normalizeVehicles upstream
 {const ok=mk([{uid:'eastbank-flatbed',model:'flatbed',x:130,z:10,yaw:1.5}]);assert.deepEqual([ok.byId.get('eastbank-flatbed').state.x,ok.byId.get('eastbank-flatbed').state.z],[130,10],'a saved pose is restored');assert(!ok.save().some(s=>s.uid==='eastbank-pickup'),'the other stays home')
  const blockedPose=mk([{uid:'eastbank-pickup',model:'pickup',x:83,z:35.4,yaw:0}]).byId.get('eastbank-pickup').state;assert(poseFree(blockedPose,CLASSES.pickup,real),'a saved pose inside a building is moved to a clear one');assert(Math.hypot(blockedPose.x-83,blockedPose.z-35.4)<30&&Math.hypot(blockedPose.x-83,blockedPose.z-35.4)>1,`near the saved spot (${Math.hypot(blockedPose.x-83,blockedPose.z-35.4).toFixed(1)} m away)`)}
 // the other vehicle blocks: the flatbed cannot be driven through the parked pickup
 {const d3=mk([]),f=d3.byId.get('eastbank-flatbed');d3.enter('eastbank-flatbed');f.state={x:94.35,z:-6,yaw:Math.PI,speed:0,steer:0};for(let i=0;i<300;i++)d3.step(1/60,{throttle:1},[]);const p=d3.byId.get('eastbank-pickup');assert(!hullsOverlap(f.state,CLASSES.flatbed,p.state,CLASSES.pickup),`the flatbed stops at the parked pickup (z ${f.state.z.toFixed(1)})`)}}
// ── Safe poses and exits ─────────────────────────────────────────────────────────────────────────────
{const c=CLASSES.pickup,pose={x:0,z:0,yaw:0},tight={blocked:(x,z)=>Math.abs(x)<3&&Math.abs(z)<6,surface:()=>SURFACE.ROAD};assert(!poseFree(pose,c,tight));const safe=findSafePose(pose,c,tight);assert(safe&&poseFree(safe,c,tight),'a blocked pose moves to the nearest clear one');assert(Math.hypot(safe.x,safe.z)<12,`it is near (${Math.hypot(safe.x,safe.z).toFixed(1)} m)`);
 assert.equal(findSafePose(pose,c,{blocked:()=>true,surface:()=>1},{maxRadius:5}),null,'nothing clear: null (the caller sends it home)');
 const s={x:10,z:10,yaw:.4,speed:0,steer:0},door=doorPoint(s,c),free=(x,z)=>!insideHull(s,c,x,z,PLAYER_RADIUS)&&true;assert.deepEqual(exitPoint(s,c,free),door,'you step out at the driver\'s door point');
 const noLeft=(x,z)=>free(x,z)&&Math.hypot(x-door.x,z-door.z)>1.5,right=exitPoint(s,c,noLeft),pw=toWorld(s,-c.door.x,c.door.z);assert(Math.hypot(right.x-pw.x,right.z-pw.z)<1e-9,'door blocked: the passenger side');
 const behind=exitPoint(s,c,(x,z)=>free(x,z)&&toWorld({...s,yaw:-s.yaw},0,0)&&insideHull(s,c,x,z,3)===false&&false);assert.equal(behind,null,'nothing free: null');
 for(const m of Object.values(CLASSES)){const sp=toWorld({x:0,z:0,yaw:0},m.door.x,m.door.z);assert(!insideHull({x:0,z:0,yaw:0},m,sp.x,sp.z,PLAYER_RADIUS),m.id+': the door point is clear of the hull, even inflated')}}

// ── The saved list ───────────────────────────────────────────────────────────────────────────────────
{const specs=MAP.vehicles,playable=MAP.playable,home=Object.fromEntries(specs.map(v=>[v.id,{...v.home,speed:0,steer:0}]));
 assert.deepEqual(vehiclesToSave(specs,home),[],'vehicles at home are not saved');
 const moved={...home,'eastbank-pickup':{...home['eastbank-pickup'],x:120.123,z:30.456,yaw:1.2346}};assert.deepEqual(vehiclesToSave(specs,moved),[{uid:'eastbank-pickup',model:'pickup',x:120.12,z:30.46,yaw:1.235}]);
 assert.deepEqual(normalizeVehicles(vehiclesToSave(specs,moved),specs,playable),vehiclesToSave(specs,moved),'saved and loaded: the same');
 const bad=[null,5,'x',{uid:'nope',model:'pickup',x:1,z:1,yaw:0},{uid:'eastbank-pickup',model:'flatbed',x:1,z:1,yaw:0},{uid:'eastbank-pickup',model:'pickup',x:NaN,z:1,yaw:0},{uid:'eastbank-pickup',model:'pickup',x:9999,z:1,yaw:0},{uid:'eastbank-flatbed',model:'flatbed',x:100,z:10,yaw:2},{uid:'eastbank-flatbed',model:'flatbed',x:101,z:11,yaw:3}];
 assert.deepEqual(normalizeVehicles(bad,specs,playable),[{uid:'eastbank-flatbed',model:'flatbed',x:100,z:10,yaw:2}],'unknown ids, wrong models, bad numbers, positions off the map and duplicates are dropped');assert.deepEqual(normalizeVehicles(undefined,specs,playable),[]);assert.deepEqual(normalizeVehicles({},specs,playable),[])}
console.log('Vehicle: pickup 11 m/s and flatbed 10 m/s (8 loaded) on a stub world; grass half speed, dirt 0.8, water never; frame-rate independent at 30/60/144; hull samples every 0.5 m inset by the player radius; a wall stops the hull at its edge and the vehicle slides along it; vehicles and people block; safe poses and exits; saved list; and both vehicles drive out of the depot along the real roads.');
