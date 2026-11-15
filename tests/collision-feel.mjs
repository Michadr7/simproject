import assert from 'node:assert/strict';
import {CLASSES,freshVehicle,stepVehicle,poseFree,hullsOverlap,hullSamples,toWorld,PLAYER_RADIUS} from '../dist/vehicle.js';
import {SURFACE} from '../dist/terrain.js';

// C1 collision feel (notes/collision-feel.md): a vehicle gets right up to things (no gap over 5 cm), slides along them, never sticks, and only a real crash stops it hard.
// Pure: stub worlds that behave like the game's blocked() (a solid box inflated by the player radius, points tested one by one).
const R=PLAYER_RADIUS,S70=CLASSES.shortbed,TRUCK=CLASSES.worktruck,surface=()=>SURFACE.ROAD;
const boxEnv=(x0,x1,z0,z1,extra={})=>({blocked:(x,z)=>x>x0-R&&x<x1+R&&z>z0-R&&z<z1+R,surface,...extra}); // a solid box [x0,x1] x [z0,z1], like colliders.some(...) in game.js
const wallX=boxEnv(20,60,-400,400); // a long wall whose face is x = 20
const round=(cx,cz,r)=>({blocked:(x,z)=>Math.hypot(x-cx,z-cz)<r+R,surface});
const both=(a,b)=>({blocked:(x,z)=>a.blocked(x,z)||b.blocked(x,z),surface});
const run=(cls,start,env,input,seconds,{dt=1/60,speed=0,steer=0}={})=>{let s={...freshVehicle(start),speed,steer},hits=0,maxImpact=0,pen=0,stuckSince=null;const trace=[];for(let t=0;t<seconds-1e-9;t+=dt){const r=stepVehicle(s,typeof input==='function'?input(t,s):input,dt,cls,env);s=r.state;if(r.hit)hits++;maxImpact=Math.max(maxImpact,r.impact||0);if(!poseFree(s,cls,env))pen++;trace.push({t,x:s.x,z:s.z,yaw:s.yaw,speed:s.speed,hit:r.hit})}return {s,hits,pen,maxImpact,trace}};
const front=s=>s.x+Math.sin(s.yaw)*0+0;
void front;

// 1. Head on, every approach speed, at 60 and 30 steps a second: the nose ends within 5 cm of the wall and never inside it.
for(const cls of [S70,TRUCK])for(const dt of [1/60,1/30])for(const v of [1,3,8,15]){
 const r=run(cls,{x:20-cls.hz-v*3-.137,z:0,yaw:Math.PI/2},wallX,{throttle:1},6,{dt,speed:v}),gap=20-(r.trace[r.trace.findIndex(p=>p.hit)].x+cls.hz); // measured at the moment of the first contact (holding the throttle afterwards creeps the last millimetres in)
 assert.equal(r.pen,0,`${cls.id} ${v} m/s dt ${dt.toFixed(3)}: never inside the wall`);
 assert(gap>=-1e-6&&gap<=.05,`${cls.id} ${v} m/s dt ${dt.toFixed(3)}: resting gap ${(gap*100).toFixed(1)} cm is at most 5 cm`)}

// 2. A gentle nose-in at low speed is not stuck: reverse out at once, and from the wall a left lock plus throttle drives away along it.
{const r=run(S70,{x:20-S70.hz-.4,z:0,yaw:Math.PI/2},wallX,{throttle:1},3,{speed:1}),gap=20-(r.s.x+S70.hz);assert(gap<=.05&&gap>=0,`nose-in at 1 m/s: gap ${(gap*100).toFixed(1)} cm`);
 const back=run(S70,{x:r.s.x,z:r.s.z,yaw:r.s.yaw},wallX,{throttle:-1},1.5);assert(r.s.x-back.s.x>1.2,`reverses straight away (${(r.s.x-back.s.x).toFixed(2)} m in 1.5 s)`);
 for(const off of [.26,-.26])for(const steerKey of [0,off>0?-1:1]){const out=run(S70,{x:20-S70.hz-1.2,z:0,yaw:Math.PI/2-off},wallX,{throttle:1,steer:steerKey},5,{speed:1});assert(Math.abs(out.s.z)>(steerKey===0?1.2:4),`nose-in 15 degrees off square, wheel ${steerKey===0?'straight':'away from the wall'}: it drives away along the wall (${Math.abs(out.s.z).toFixed(1)} m sideways in 5 s)`);assert.equal(out.pen,0)}}

// 3. At an angle the vehicle slides along the wall (never stops, never inside it), and keeps a good part of its speed.
for(const cls of [S70,TRUCK])for(const deg of [10,25,45,60,75])for(const v of [3,10]){
 const yaw=Math.PI/2-deg*Math.PI/180,r=run(cls,{x:12,z:0,yaw},wallX,{throttle:1},8,{speed:v});
 assert.equal(r.pen,0,`${cls.id} ${deg} deg ${v} m/s: never inside the wall`);
 const late=r.trace.filter(p=>p.t>5),along=late[late.length-1].z-late[0].z;
 assert(along>(deg<=10?.4:2.2),`${cls.id} ${deg} deg ${v} m/s: still sliding along the wall in the last 3 s (${along.toFixed(1)} m)`);
 }

// 4. A round collider (a lamp post, a tree trunk): hit with the nose corner it slides round and carries on; never inside it. (The flat nose square on to a post is a head-on stop, like a flat wall: steer or reverse.)
for(const off of [1.3,1.8,-1.3,-2])for(const cls of [S70,TRUCK]){const env=round(25,0,.6),r=run(cls,{x:5,z:off,yaw:Math.PI/2},env,{throttle:1},9,{speed:4});
 assert.equal(r.pen,0,`${cls.id} round collider off ${off}: never inside`);assert(r.s.x>31,`${cls.id} off ${off}: the corner meets the post, slides round it and carries on (x ${r.s.x.toFixed(1)})`)}
{const r=run(S70,{x:5,z:0,yaw:Math.PI/2},round(25,0,.6),{throttle:1},9,{speed:4});assert.equal(r.pen,0,'dead centre: never inside the post')}
// 5. Corners. Concave: driven in diagonally the vehicle ends in the corner, is free, and reverses out. Convex: it rounds the edge.
{const env=both(boxEnv(20,60,-400,400),boxEnv(-400,60,20,60)),r=run(S70,{x:0,z:0,yaw:Math.PI/4},env,{throttle:1},10,{speed:3});assert.equal(r.pen,0,'concave corner: never inside');
 assert(r.trace.slice(-60).every(p=>Math.abs(p.speed)<1e-6||p.hit),'wedged in the corner it stops');
 const out=run(S70,{x:r.s.x,z:r.s.z,yaw:r.s.yaw},env,{throttle:-1},2);assert(Math.hypot(out.s.x-r.s.x,out.s.z-r.s.z)>2,'and reverses out of the corner')}
{const env=boxEnv(20,40,-20,0),r=run(S70,{x:8,z:2.2,yaw:Math.PI/2-.35},env,{throttle:1},8,{speed:5});assert.equal(r.pen,0,'convex corner: never inside');assert(r.s.x>35,`rounds a convex corner and carries on (x ${r.s.x.toFixed(1)})`)}

// 6. A parked car (an oriented hull among `others`): resting gap under 5 cm head on and side on, a slide along it, a glance that does not stick.
{const car={state:{x:30,z:0,yaw:0,speed:0,steer:0},cls:TRUCK},env={blocked:()=>false,surface,others:[car]},gapTo=s=>{let lo=0,hi=1;for(let i=0;i<14;i++){const m=(lo+hi)/2;if(hullsOverlap(s,S70,car.state,TRUCK,m))hi=m;else lo=m}return hi};
 for(const v of [1,4,9]){const r=run(S70,{x:30,z:-12,yaw:0},env,{throttle:1},8,{speed:v});assert.equal(r.pen,0);assert(!hullsOverlap(r.s,S70,car.state,TRUCK)&&gapTo(r.s)<=.05,`nose-in to the parked car at ${v} m/s: gap ${(gapTo(r.s)*100).toFixed(1)} cm`)}
 for(const dx of [1.2,1.8]){const r=run(S70,{x:30-dx-S70.hx-TRUCK.hx+.3,z:-14,yaw:0},env,{throttle:1},7,{speed:4});assert.equal(r.pen,0);assert(r.s.z>car.state.z+TRUCK.hz,`glancing along the parked car (offset ${dx}): carries past its tail (z ${r.s.z.toFixed(1)})`)}}

// 7. A real crash still stops hard, and says how hard (impact is for the later damage build).
{const r=run(S70,{x:20-S70.hz-30,z:0,yaw:Math.PI/2},wallX,{throttle:1},4,{speed:25});assert.equal(r.s.speed,0,'a 25 m/s head-on crash stops dead');assert(r.maxImpact>20,`impact reported (${r.maxImpact.toFixed(1)} m/s)`);
 const first=r.trace.findIndex(p=>p.hit);assert(r.trace[first].speed<1,'the stop is at once, not eased over a second');
 const glance=run(S70,{x:5,z:0,yaw:Math.PI/2-1.396},wallX,{throttle:1},3,{speed:15});assert(glance.maxImpact<5,`a 10 degree scrape at 15 m/s is no crash (impact ${glance.maxImpact.toFixed(1)})`);
 const free=stepVehicle(freshVehicle({x:0,z:0,yaw:0}),{throttle:1},1/60,S70,{blocked:()=>false,surface});assert.equal(free.impact,0);assert.equal(free.hit,false)}

// 8. A start inside something (a prop placed later) is pushed out instead of frozen.
{const env=boxEnv(20,40,-5,5),r=run(S70,{x:20-S70.hz+.1,z:0,yaw:Math.PI/2},env,{throttle:-1},2);assert(poseFree(r.s,S70,env),'reversing from a small overlap ends clear');assert(r.s.x<20-S70.hz-.1,'it moved away')}

// 9. Cost: blocked() calls in the worst step (a contact step), so the frame cost can be stated.
{let calls=0;const env={blocked:(x,z)=>{calls++;return wallX.blocked(x,z)},surface};let s={...freshVehicle({x:20-S70.hz-.05,z:0,yaw:Math.PI/2-.4}),speed:10},worst=0;for(let i=0;i<120;i++){calls=0;s=stepVehicle(s,{throttle:1},1/60,S70,env).state;worst=Math.max(worst,calls)}
 console.log(`  collision cost: worst contact step ${worst} blocked() calls (free step: ${hullSamples(S70).length})`);assert(worst<=hullSamples(S70).length*60,'a contact step stays under 60 hull checks')}
console.log('collision-feel: resting gap, slide, nose-in, round collider, corners, parked car, crash and push-out passed.');