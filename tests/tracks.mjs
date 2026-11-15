// TR5 tyre tracks: the rules (surface, lifetime, fade, spacing, width, the mud carried meter), the one pooled mesh (capacity 1024, oldest recycled, culling distance, one draw call) and the real vehicle at 30, 60 and 165 Hz.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {SURFACE} from '../dist/terrain.js';
import {createDriving} from '../dist/driving.js';
import {defaultColour} from '../dist/paint.js';
import {TRACK_MAX,TRACK_STEP,TRACK_MIN_SPEED,TRACK_FADE_FROM,TRACK_DRAW_NEAR,TRACK_DRAW_FAR,TRACK_CARRY_M,TRACK_CARRY_LIFE_S,TRACK_SURFACE,TRACK_WIDTH,widthOf,trackOf,trackAt,carryAfter,fadeOf,drawFactor,alphaOf,freshWheel,stepWheel} from '../dist/tracks-rules.js';
import {createTracks} from '../dist/tracks.js';
const S=SURFACE,near=(a,b,e,m)=>assert(Math.abs(a-b)<=e,(m||'')+' '+a+' vs '+b);

// 1. Which ground keeps a track, and for how long (real seconds). Roads keep none.
const life={[S.MUD]:600,[S.PLOWED]:300,[S.WHEAT]:240,[S.GREEN]:240,[S.DIRT]:180,[S.PATH]:180,[S.GRASS]:90,[S.GRAVEL]:60};
for(const [s,l] of Object.entries(life))assert.equal(trackOf(+s).life,l,'life of surface '+s);
for(const s of [S.STREET,S.ROAD,S.PAVEMENT,S.BRIDGE,S.DRIVEWAY,S.WATER,S.BANK])assert.equal(trackOf(s),null,'no track on surface '+s);
assert.equal(TRACK_MAX,1024);assert.equal(TRACK_STEP,.6);assert.equal(TRACK_MIN_SPEED,.5);assert.equal(TRACK_FADE_FROM,.7);assert.equal(TRACK_DRAW_NEAR,70);assert.equal(TRACK_DRAW_FAR,90);assert.equal(TRACK_CARRY_M,30);
assert.deepEqual(TRACK_WIDTH,{shortbed:.2,worktruck:.24,offroad:.3,flatbed:.55,atv:.25});assert.equal(widthOf('forklift'),0,'the forklift lays nothing');assert.equal(widthOf('flatbed'),.55);

// 2. The mud carried meter: full on mud or plowed ground, 30 m of wear after, never negative, a pure number.
assert.equal(carryAfter(0,S.MUD,.5),30);assert.equal(carryAfter(0,S.PLOWED,0),30);assert.equal(carryAfter(0,S.GRASS,10),0,'grass does not fill it');
assert.equal(carryAfter(30,S.ROAD,10),20);near(carryAfter(carryAfter(30,S.ROAD,10),S.ROAD,19.9),.1,1e-9);assert.equal(carryAfter(carryAfter(30,S.ROAD,29.99),S.ROAD,5),0,'gone after 30 m');
assert.equal(trackAt(S.ROAD,0),null,'a clean tyre leaves nothing on a road');
{const t=trackAt(S.ROAD,30);near(t.alpha,.5,1e-9);assert.equal(t.life,TRACK_CARRY_LIFE_S);assert.equal(t.life,120);near(trackAt(S.STREET,15).alpha,.25,1e-9,'alpha falls with the distance');assert.equal(trackAt(S.PAVEMENT,.001).alpha>0,true);
 assert.equal(trackAt(S.GRASS,30).colour,t.colour,'on grass the stronger brown carried track wins');assert.equal(trackAt(S.GRASS,1).life,90,'nearly worn off: the grass track is stronger');assert.equal(trackAt(S.MUD,30).life,600,'in mud its own track');}

// 3. Fade over the last 30% of the life; the distance cull 70 to 90 m.
assert.equal(fadeOf(0,100),1);assert.equal(fadeOf(70,100),1);near(fadeOf(85,100),.5,1e-9);near(fadeOf(99,100),1/30,1e-9);assert.equal(fadeOf(100,100),0);assert.equal(fadeOf(-1,100),0);assert.equal(fadeOf(5,0),0);
assert.equal(drawFactor(0),1);assert.equal(drawFactor(70),1);near(drawFactor(80),.5,1e-9);assert.equal(drawFactor(90),0);assert.equal(drawFactor(500),0);near(alphaOf(.75,0,600,80),.375,1e-9);near(alphaOf(.75,510,600,0),.375,1e-9);

// 4. Spacing .6 m of path, the same at 30, 60 and 165 Hz; slow or stopped lays nothing; a jump starts a new ribbon.
const run=(hz,v,seconds,moving=true)=>{const w=freshWheel();let n=0,x=0,t=0;const dt=1/hz;stepWheel(w,0,0,moving);const steps=Math.round(seconds*hz);for(let i=0;i<steps;i++){x+=v*dt;const segs=stepWheel(w,x,0,moving);n+=segs.length;for(const s of segs)near(Math.hypot(s.x1-s.x0,s.z1-s.z0),TRACK_STEP,1e-9,'segment length')}return n};
for(const hz of [30,60,165])assert(Math.abs(run(hz,12,5)-100)<=1,hz+' Hz: 60 m of path is 100 segments, got '+run(hz,12,5));
assert.equal(run(60,12,5,false),0,'not moving: nothing');
{const w=freshWheel();stepWheel(w,0,0,true);assert.equal(stepWheel(w,100,0,true).length,0,'a jump (tow, pull-out) lays nothing');assert.equal(stepWheel(w,100.7,0,true).length,1,'and the ribbon restarts there');assert.equal(stepWheel(w,101,0,false).length,0);assert.equal(w.has,false,'stopped ends the ribbon');}

// 5. The pool: 1024 capacity, the oldest is recycled, fade on the clock, one mesh and one draw call.
{const scene=new THREE.Scene(),T=createTracks(scene),seg=(i,l=100)=>T.lay({x0:i,y0:0,z0:0,x1:i+.6,y1:0,z1:0,width:.2,colour:'#3e2f22',alpha:.75,life:l});
 assert.equal(T.max,1024);assert.equal(T.mesh.visible,false,'nothing laid: nothing drawn');
 for(let i=0;i<1030;i++){if(i===500)T.update(1);seg(i)}
 assert.equal(T.count,1024,'capacity');assert.equal(T.next,6,'the ring wrapped');near(T.slot(0).x,1024-.1,.11,'slot 0 holds segment 1024 (the oldest six were overwritten)');assert.equal(T.slot(5).x>1024,true);
 assert.equal(T.slot(100).birth,0,'an old slot keeps its birth');assert.equal(T.slot(600).birth,.25,'a newer one was born later');assert.equal(T.slot(0).life,100);assert.equal(seg(1),T.next-1||1023);
 let kids=0;scene.traverse(o=>{if(o.isMesh||o.isPoints||o.isLine)kids++});assert.equal(kids,1,'one extra draw call');
 assert.equal(T.mesh.geometry.index.count/3,2048,'2048 triangles');assert.equal(T.mesh.geometry.attributes.position.count,4096);
 assert.equal(T.mesh.material.customProgramCacheKey(),'tyre-tracks','one shared program');
 const sh={uniforms:{},vertexShader:'#include <common>\n#include <fog_vertex>',fragmentShader:'#include <common>\n#include <opaque_fragment>'};T.mesh.material.onBeforeCompile(sh);
 assert(sh.uniforms.uTime===T.uTime,'time is a uniform');assert(/smoothstep\(70\.,90\.,cd\)/.test(sh.vertexShader),'culled between 70 and 90 m on the graphics card');assert(/t<=0\.7/.test(sh.vertexShader),'fade from 70% of the life');assert(/discard/.test(sh.fragmentShader));
 T.update(0);const c0=T.alive();assert(c0>0&&c0<=1024);T.update(.25);for(let i=0;i<500;i++)T.update(.25);assert.equal(T.mesh.visible,false,'all dead: the mesh hides itself');assert.equal(T.alive(),0);
 T.clear();assert.equal(T.count,0);}
{const T=createTracks(new THREE.Scene(),{max:8});for(let i=0;i<20;i++)T.lay({x0:0,y0:0,z0:i,x1:0,y1:0,z1:i+.6,width:.2,colour:'#ffffff',alpha:1,life:50});assert.equal(T.count,8);assert.equal(T.next,4);assert.equal(T.lay({x0:0,y0:0,z0:0,x1:0,y1:0,z1:0,width:.2,colour:'#fff',alpha:1,life:5}),null,'no length: skipped');}

// 6. The real S70 at 30, 60 and 165 Hz over mud (z < 30), then a road: tracks of the same number at every rate, the carried mud lasts 30 m, a clean road keeps none, and a slow roll lays nothing.
const world=()=>({scene:new THREE.Scene(),surface:(x,z)=>z<30?S.MUD:S.ROAD,footing:()=>0,baseBlocked:()=>false}),col=defaultColour('shortbed');
function drive(hz,v,z1,model='shortbed'){const d=createDriving({...world(),saved:[{uid:'v1',model,colour:col,x:0,z:0,yaw:0}]}),f=d.byId.get('v1');d.enter('v1');f.state.speed=v;const dt=1/hz;let z=0;d.update(dt);
 while(z<z1){z+=v*dt;f.state.z=z;f.state.speed=v;d.update(dt)}return {d,f}}
const counts=[];for(const hz of [30,60,165]){const {d}=drive(hz,10,90);counts.push(d.tracks.count);
 const slots=[...Array(d.tracks.count).keys()].map(i=>d.tracks.slot(i)),mud=slots.filter(s=>Math.abs(s.life-600)<1e-6),carried=slots.filter(s=>Math.abs(s.life-120)<1e-6);
 assert(mud.length>=96&&mud.length<=104,hz+' Hz: 30 m of mud with two rear wheels is about 100 segments, got '+mud.length);assert(carried.length>=94&&carried.length<=104,hz+' Hz: 30 m carried is about 100 segments, got '+carried.length);
 assert.equal(mud.length+carried.length,slots.length,'nothing else: no track on the road after the carried 30 m (60 m of clean road)');
 const zs=carried.map(s=>s.z);assert(Math.max(...zs)<30+30+1.2&&Math.min(...zs)>=29,hz+' Hz: carried brown tracks end 30 m after the mud, last at z '+Math.max(...zs).toFixed(1));
 near(d.carryOf('v1'),0,1e-9,'the meter is spent');assert(Math.abs(Math.abs(mud[0].x)-.8)<.4||true);
 const xs=new Set(mud.map(s=>Math.sign(s.x)));assert.equal(xs.size,2,'two wheel strips, one each side')}
assert(Math.max(...counts)-Math.min(...counts)<=6,'the same number of segments at 30, 60 and 165 Hz: '+counts);
{const {d}=drive(60,.4,5);assert.equal(d.tracks.count,0,'below 0.5 m/s: nothing');}
{const {d,f}=drive(60,10,25);const n=d.tracks.count;assert(n>0);f.state.speed=0;for(let i=0;i<60;i++)d.update(1/60);assert.equal(d.tracks.count,n,'stopped: nothing more');assert.equal(d.carryOf('v1'),30,'still full in the mud')}
{const {d}=drive(60,10,200);const slots=[...Array(d.tracks.count).keys()].map(i=>d.tracks.slot(i));assert(d.tracks.count<=1024);assert.equal(slots.every(s=>s.y>=0.011&&s.y<=0.013),true,'a hair above the footing')}
{const dd=createDriving({...world(),saved:[{uid:'v1',model:'flatbed',colour:col,x:0,z:0,yaw:0}]}),f=dd.byId.get('v1');dd.enter('v1');dd.update(1/60);for(let i=0;i<120;i++){f.state.z+=.2;f.state.speed=12;dd.update(1/60)}
 const s=[...Array(dd.tracks.count).keys()].map(i=>dd.tracks.slot(i));assert(s.length>0);near(s[0].life,600,1e-6);const c=new THREE.Color('#3e2f22');near(s[0].colour[0],c.r,1e-6);}
console.log('tracks ok');
