import assert from 'node:assert/strict';
import {CLASSES,SURFACE_SPEED,surfaceSpeed,freshVehicle,stepVehicle} from '../dist/vehicle.js';
import {SURFACE} from '../dist/terrain.js';
import {SURFACE_SPEED_BY_GROUP,GRIP,GRIP_MIN,ROLL_DRAG,GROUPS,speedFactor,gripOf,rollDragOf} from '../dist/surface-table.js';

// TR2 (notes/terrain-vehicle-design.md section 1): surface table per vehicle group, grip, rolling drag. Pure rules, no scene.
const S=SURFACE,{shortbed:S70,worktruck:TRUCK,flatbed:FLAT,offroad:OFF}=CLASSES;
assert.equal(S.MUD,14,'the mud id exists (nothing paints it yet)');

// 1. Road and off-road columns reproduce today's numbers exactly, for every surface that existed.
const OLD_ROUGH=.35;
for(const [name,id] of Object.entries(S)){if(id===S.MUD)continue;
 const base=SURFACE_SPEED[id];assert.equal(surfaceSpeed(id,S70),base,`S70 on ${name} is the old number`);assert.equal(surfaceSpeed(id,TRUCK),base,`worktruck on ${name}`);
 const legacy=base>0&&base<1?Math.min(1,base+OLD_ROUGH):base;assert.equal(+surfaceSpeed(id,OFF).toFixed(6),+legacy.toFixed(6),`off-road on ${name} is the old lift`)}
assert.equal(surfaceSpeed(S.GRASS),.5,'a bare class keeps the road numbers');assert.equal(surfaceSpeed(S.WATER,OFF),0);assert.equal(surfaceSpeed(S.BANK,FLAT),0);assert.equal(surfaceSpeed(0,S70),0,'off the map');

// 2. The table: every group, every surface, ordered sensibly.
for(const id of Object.values(S))for(const g of GROUPS){const f=speedFactor(id,g);assert(f>=0&&f<=1,`speed ${id} ${g}`);if(id===S.WATER||id===S.BANK)assert.equal(f,0)}
for(const g of GROUPS){const f=k=>speedFactor(S[k],g);assert(f('ROAD')>=f('DIRT')&&f('DIRT')>=f('GRASS')&&f('GRASS')>=f('PLOWED')&&f('PLOWED')>f('MUD'),`${g}: slower on worse ground`)}
assert.equal(speedFactor(S.MUD,'road'),.3);assert.equal(speedFactor(S.MUD,'offroad'),.6);assert.equal(speedFactor(S.MUD,'heavy'),.25);assert.equal(speedFactor(S.MUD,'atv'),.7);assert.equal(speedFactor(S.MUD,'fork'),.15);
assert.equal(surfaceSpeed(S.GRASS,FLAT),.45,'the flatbed is the heavy group: a little worse than road');assert.equal(surfaceSpeed(S.PLOWED,FLAT),.4);
assert.equal(speedFactor(S.GRASS,'nonsense'),.5,'an unknown group falls back to road');

// 3. Grip: 1 on tarmac for everyone, the table by surface, tyre bonus on loose ground, floor .3, wet hook.
for(const g of GROUPS)for(const k of ['STREET','ROAD','BRIDGE','DRIVEWAY'])assert.equal(gripOf(S[k],g),1,`${g} grips tarmac fully`);
assert.equal(gripOf(S.GRASS,'road'),.65);assert.equal(gripOf(S.DIRT,'road'),.75);assert.equal(gripOf(S.PLOWED,'road'),.5);assert.equal(gripOf(S.MUD,'road'),.35);assert.equal(gripOf(S.PAVEMENT,'road'),.95);
assert.equal(+gripOf(S.GRASS,'offroad').toFixed(3),.8);assert.equal(+gripOf(S.GRASS,'atv').toFixed(3),.85);assert.equal(+gripOf(S.GRASS,'heavy').toFixed(3),.6);assert.equal(+gripOf(S.GRASS,'fork').toFixed(3),.455);
for(const id of Object.values(S))for(const g of GROUPS){const v=gripOf(id,g);assert(v>=GRIP_MIN-1e-9&&v<=1,`grip ${id} ${g} within floor and 1`)}
assert.equal(gripOf(S.MUD,'fork'),GRIP_MIN,'mud with solid tyres hits the floor (.245 raised to .3)');
assert(gripOf(S.GRASS,'road',1)<gripOf(S.GRASS,'road',0)&&gripOf(S.GRASS,'road',0)===gripOf(S.GRASS,'road'),'wet takes grip off, dry is the default');
assert.equal(gripOf(S.WATER,'road'),1,'never driven on: no effect');

// 4. Rolling drag: 0 on roads, the table on rough ground, x.6 for off-road and ATV.
assert.equal(rollDragOf(S.ROAD,'road'),0);assert.equal(rollDragOf(S.GRASS,'road'),.8);assert.equal(rollDragOf(S.PLOWED,'heavy'),1.4);assert.equal(rollDragOf(S.MUD,'road'),2.5);
assert.equal(+rollDragOf(S.GRASS,'offroad').toFixed(3),.48);assert.equal(+rollDragOf(S.MUD,'atv').toFixed(3),1.5);
for(const id of Object.keys(ROLL_DRAG))assert(ROLL_DRAG[id]>=0);

// 5. In the step: top speed unchanged, corner radius and braking grow with the loss of grip, coasting stops sooner.
const env=k=>({blocked:()=>false,surface:()=>S[k]});
const drive=(cls,k,input,seconds,{dt=1/60,speed=0,steer=0}={})=>{let s={...freshVehicle({x:0,z:0,yaw:0}),speed,steer},path=0;for(let t=0;t<seconds-1e-9;t+=dt){const r=stepVehicle(s,input,dt,cls,env(k));path+=Math.hypot(r.state.x-s.x,r.state.z-s.z);s=r.state}return {s,path}};
const topOf=(cls,k)=>drive(cls,k,{throttle:1},60).s.speed;
assert.equal(+topOf(S70,'GRASS').toFixed(3),+(29*.5).toFixed(3),'S70 grass top speed is the old 14.5');assert.equal(+topOf(S70,'ROAD').toFixed(3),29);assert.equal(+topOf(OFF,'GRASS').toFixed(2),+(26.8*.85).toFixed(2));assert.equal(+topOf(OFF,'DIRT').toFixed(3),26.8);
// radius from the yaw rate at a steady 13 m/s with full lock held
const radius=(cls,k,v=13)=>{let s={...freshVehicle({x:0,z:0,yaw:0}),speed:v,steer:1};const dt=1/60;let turned=0;for(let i=0;i<30;i++){const n=stepVehicle(s,{throttle:v>0?(s.speed<v?1:0):0,steer:1},dt,cls,env(k)).state;turned+=Math.abs(n.yaw-s.yaw);s={...n,speed:v};}return v*30*dt/turned};
const r1=radius(S70,'ROAD'),r2=radius(S70,'GRASS');assert(Math.abs(r1-13*13/9)<.3,`S70 road radius ${r1.toFixed(1)} m (v^2/aLat = 18.8)`);assert(Math.abs(r2/r1-1/.65)<.03,`grass radius is 1/.65 of the road radius (${r2.toFixed(1)} vs ${r1.toFixed(1)})`);
// braking distance from 13 m/s (Space)
const stop=(cls,k)=>drive(cls,k,{brake:true},10,{speed:13}).path;const b1=stop(S70,'ROAD'),b2=stop(S70,'GRASS'),b3=stop(S70,'PLOWED');
assert(Math.abs(b2/b1-1/.65)<.02,`brakes in 1.54x the distance on grass (${b1.toFixed(1)} to ${b2.toFixed(1)} m)`);assert(b3>b2,'plowed brakes longer than grass');assert(stop(OFF,'GRASS')<stop(S70,'GRASS'),'the off-road pickup out-brakes the S70 on grass');
// coasting
const coast=(cls,k)=>drive(cls,k,{throttle:0},30,{speed:8}).path;assert(coast(S70,'GRASS')<coast(S70,'ROAD')&&coast(S70,'PLOWED')<coast(S70,'GRASS')&&coast(S70,'MUD')<coast(S70,'PLOWED'),'coasting reaches less far on rougher ground');
assert(coast(OFF,'GRASS')>coast(OFF,'MUD')&&Math.abs(coast(S70,'ROAD')-(64/(2*.8)))<.5,'on a road coasting is the old drag (v^2 / 2 drag)');
// accel: the road launch is unchanged (grip 1), the field launch is slower
assert(drive(S70,'ROAD',{throttle:1},5).s.speed>=7.4,'road launch 1.5 m/s2 x 5 s');assert(drive(S70,'GRASS',{throttle:1},5).s.speed<drive(S70,'ROAD',{throttle:1},5).s.speed);

// 6. Frame-rate independence: the same 6 s drive (launch, turn, brake, coast) on grass at 30, 60 and 165 Hz lands in the same place.
const script=t=>t<2?{throttle:1}:t<3.5?{throttle:1,steer:1}:t<4.5?{brake:true}:{throttle:0};
const sim=(cls,k,dt)=>{let s=freshVehicle({x:0,z:0,yaw:0}),t=0;for(let i=0;i<Math.round(8/dt);i++,t+=dt)s=stepVehicle(s,script(t),dt,cls,env(k)).state;return s};
for(const [cls,k] of [[S70,'GRASS'],[OFF,'PLOWED'],[FLAT,'MUD'],[TRUCK,'DIRT']]){const a=sim(cls,k,1/60);for(const hz of [30,165]){const b=sim(cls,k,1/hz);assert(Math.hypot(a.x-b.x,a.z-b.z)<.8&&Math.abs(a.yaw-b.yaw)<.05&&Math.abs(a.speed-b.speed)<.2,`${cls.id} on ${k}: ${hz} Hz matches 60 Hz (off by ${Math.hypot(a.x-b.x,a.z-b.z).toFixed(2)} m)`)}}

// 7. TR4 bogging (pure meter): rates per group, frame-rate independence, the ways out, the safety net, firm ground, the pull-out spot.
const B=await import('../dist/surface-table.js'),{findFirmPose,hullSamples,poseFree,toWorld}=await import('../dist/vehicle.js');
const HZ=[30,60,165],near=(a,b,tol,msg)=>assert(Math.abs(a-b)<=tol,`${msg}: ${a.toFixed(3)} vs ${b}`);
const toStuck=(group,{dt,load=0,surface=S.MUD,throttle=1,speed=0,limit=200}={})=>{let b=B.freshBog(),t=0;for(let i=0;i<Math.round(limit/dt);i++){b=B.stepBog(b,{throttle,speed,surface,group,load,dt});t+=dt;if(b.event==='stuck')return t}return null};
for(const hz of HZ){const dt=1/hz;
 near(toStuck('road',{dt}),4,.05,`road truck in mud, ${hz} Hz`);near(toStuck('offroad',{dt}),1/(.25*.35),.05,`off-road pickup in mud, ${hz} Hz (about 11 s)`);near(toStuck('atv',{dt}),20,.05,`ATV in mud, ${hz} Hz`);
 near(toStuck('heavy',{dt}),1/(.25*1.3),.05,`flatbed in mud, ${hz} Hz`);near(toStuck('heavy',{dt,load:1}),1/(.25*1.3*2),.05,`a full flatbed sinks twice as fast, ${hz} Hz`);
 near(toStuck('road',{dt,surface:S.PLOWED}),10,.05,`plowed is .4: 10 s of wheelspin, ${hz} Hz`);assert.equal(toStuck('road',{dt,surface:S.GRASS,limit:60}),null,'grass takes 80 s of wheelspin: not within 60');near(toStuck('road',{dt,surface:S.GRASS,limit:100}),80,.05,`grass 80 s, ${hz} Hz`)}
assert.equal(toStuck('road',{dt:1/60,surface:S.ROAD,limit:60}),null,'never on a road');assert.equal(toStuck('road',{dt:1/60,surface:S.DIRT,limit:60}),null,'never on dirt');assert.equal(toStuck('road',{dt:1/60,speed:2.01,limit:60}),null,'above 2 m/s you plough through');near(toStuck('road',{dt:1/60,speed:1.99}),4,.05,'just under 2 m/s the wheels spin');assert.equal(toStuck('road',{dt:1/60,throttle:0,limit:60}),null,'no throttle, no wheelspin');
assert(B.bogRate(S.MUD,'road',0,1)===B.bogRate(S.MUD,'road')*3,'wet ground sinks x3');assert.equal(B.bogRate(S.ROAD,'road'),0);
// The ways out: rocking (W then S, each phase inside 1.2 s), waiting 5 s, creeping onto firm ground, the 45 s net. Each is the same at 30, 60 and 165 Hz.
const stuckState=dt=>{let b=B.freshBog();while(!b.stuck)b=B.stepBog(b,{throttle:1,speed:.3,surface:S.MUD,group:'road',dt});return b};
for(const hz of HZ){const dt=1/hz;
 {let b=stuckState(dt),t=0,rocks=0,free=null;const phases=[-1,1,-1,1,-1,1];for(const th of phases){for(let i=0,n=Math.round(.5/dt);i<n;i++){const before=b.bog;b=B.stepBog(b,{throttle:th,speed:.3,surface:S.MUD,group:'road',dt});t+=dt;if(b.event==='free'){free=t}}rocks++;if(free!==null)break}
  assert(free!==null&&free<3.01&&rocks<=4,`rocking frees it within 4 reversals (${rocks}) and 3 s (${free}) at ${hz} Hz`)}
 {let b=stuckState(dt),t=0,free=null;while(free===null&&t<20){b=B.stepBog(b,{throttle:0,speed:0,surface:S.MUD,group:'road',dt});t+=dt;if(b.event==='free')free=t}near(free,5,.05,`waiting 5 s with the throttle released, ${hz} Hz`)}
 {let b=stuckState(dt),t=0,free=null;while(free===null&&t<5){b=B.stepBog(b,{throttle:1,speed:.7,surface:S.ROAD,group:'road',dt});t+=dt;if(b.event==='free')free=t}near(free,.8,.05,`crawled onto firm ground: free in .8 s, ${hz} Hz`)}
 {let b=B.freshBog(),t=0,stuckAt=null,freeAt=null;for(let i=0,n=Math.round(60/dt);i<n&&freeAt===null;i++){b=B.stepBog(b,{throttle:1,speed:.7,surface:S.MUD,group:'road',dt});t+=dt;if(b.event==='stuck')stuckAt=t;if(b.event==='free')freeAt=t}
  near(stuckAt,4,.05,`stuck at 4 s with W held, ${hz} Hz`);near(freeAt-stuckAt,45,.05,`the safety net frees it 45 s later even if W is held the whole time, ${hz} Hz`)}
 {let b=stuckState(dt);for(let i=0,n=Math.round(10/dt);i<n;i++)b=B.stepBog(b,{throttle:1,speed:.3,surface:S.MUD,group:'road',dt});assert(b.stuck&&b.bog===1,'W held does not make it worse and does not free it before the net')}
 {let b=stuckState(dt);for(let i=0,n=Math.round(3/dt);i<n;i++)b=B.stepBog(b,{throttle:i<n/2?-1:1,speed:.3,surface:S.MUD,group:'road',dt});assert.equal(b.stuck,true,'one slow reversal (outside the 1.2 s window) is not rocking')}}
// Easing: the top-speed factor goes 1 to .08 over .8 s and back, never a jump.
{const dt=1/60;let b=B.freshBog(),prev=1,maxJump=0;for(let i=0;i<60*8;i++){b=B.stepBog(b,{throttle:1,speed:.3,surface:S.MUD,group:'road',dt});const f=B.topFactor(b);maxJump=Math.max(maxJump,prev-f);prev=f}
 near(B.topFactor(b),.08,1e-9,'fully Stuck: top speed x .08');assert(maxJump<(.92*dt/.8)+1e-9,`the factor eases down (largest step ${maxJump.toFixed(4)})`);assert.equal(B.topFactor(B.freshBog()),1);assert.equal(B.topFactor(null),1)}
// In the vehicle step: a Stuck S70 in mud crawls at .7 m/s (29 x .3 x .08), speed never drops harder than the off-road drag, on every frame rate; the road truck on a road is untouched by all this.
for(const hz of HZ){const dt=1/hz,cl=S70;let s=freshVehicle({x:0,z:0,yaw:0}),b=B.freshBog(),worst=0,stuckAt=null,t=0;
 for(let i=0,n=Math.round(14/dt);i<n;i++,t+=dt){b=B.stepBog(b,{throttle:1,speed:s.speed,surface:S.MUD,group:'road',dt});if(b.event==='stuck')stuckAt=t;const k=B.topFactor(b),eff=k<1?{...cl,top:cl.top*k,reverse:cl.reverse*k}:cl,n2=stepVehicle(s,{throttle:1},dt,eff,env('MUD'));worst=Math.max(worst,s.speed-n2.state.speed);s=n2.state}
 assert(stuckAt!==null&&stuckAt<6,`an S70 flooring it in mud is Stuck by ${stuckAt?.toFixed(1)} s at ${hz} Hz`);assert(s.speed<=.75&&s.speed>=.3,`it still crawls: ${s.speed.toFixed(2)} m/s`);assert(worst<=6.6*dt,`no hard stop: the biggest speed drop in one step is ${worst.toFixed(4)} (about 6.5 m/s2: the off-road drag plus the slow launch pull; allows ${(6.6*dt).toFixed(4)})`)}
// 'Pull me out' spot: the nearest firm free pose, every hull point (and a 1 m margin) on ground that does not sink, never a blocked pose.
{const mudBox=(x,z)=>x>=-6&&x<=6&&z>=-4&&z<=4,wall=(x,z)=>x>=-12&&x<=-9&&z>=-40&&z<=40,surface=(x,z)=>mudBox(x,z)?S.MUD:S.ROAD,env2={blocked:wall,surface};
 for(const cls of [S70,FLAT,OFF]){const spot=findFirmPose({x:0,z:0,yaw:0},cls,env2);assert(spot,`${cls.id}: a spot exists`);assert(poseFree(spot,cls,env2),`${cls.id}: not blocked`);
  for(const p of hullSamples(cls)){const w=toWorld(spot,p.x,p.z);assert.notEqual(surface(w.x,w.z),S.MUD,`${cls.id}: the hull is on firm ground`)}
  assert(Math.hypot(spot.x,spot.z)<14,`${cls.id}: close by (${Math.hypot(spot.x,spot.z).toFixed(1)} m)`);assert(Number.isFinite(spot.yaw),`${cls.id}: it has a heading`)}
 assert.equal(findFirmPose({x:0,z:0,yaw:0},S70,{blocked:()=>true,surface}),null,'nowhere free: null, not a blocked spot');assert.equal(findFirmPose({x:0,z:0,yaw:0},S70,{blocked:()=>false,surface:()=>S.MUD}),null,'all mud: null')}
assert.equal(B.pullOutAvailable({inVehicle:true,stuck:true}),true);assert.equal(B.pullOutAvailable({inVehicle:true,soft:true}),true);assert.equal(B.pullOutAvailable({inVehicle:true}),false,'firm ground and not stuck: not offered');assert.equal(B.pullOutAvailable({inVehicle:false,stuck:true}),false,'on foot: the line is busy');
assert.equal(B.BOG_PULL_CENTS,4000);assert.equal(B.BOG_PULL_HOURS,.5);
console.log('surface-table: ok');
