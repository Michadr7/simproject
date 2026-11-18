// PET3 prep tests (pet3-prep.md): clip selection, wander waypoints, blend times, snapshots, interior spawn and purity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fresh,accept,feed,pat,EAT_MINUTES,PURR_MINUTES,PECKISH_AT,WEEK_MINUTES,NAME_MAX} from '../dist/pets.js';
import {houseLayout,collidersOf} from '../dist/interiors.js';
import {CLIP_IDS,CLIP_LOOP,VARIETY_CLIPS,BLEND_TIMES,COORD_MAX,clipFor,blendTime,nextWaypoint,petSnapshot,applyPetSnapshot,interiorSpawn} from '../dist/pet-view.js';

// 1. clipFor: eat, purr, sleep window, hungry overrides sleep, variety by seed, determinism.
{
 const s0=accept(fresh(),'studio',500,'Milo');
 const p0=s0.pet;
 // Just adopted (fedAt === adoptedAt): NOT eating.
 assert.notEqual(clipFor(p0,500,{seed:1}).clip,'eat');
 assert.notEqual(clipFor(p0,502,{seed:1}).clip,'eat');

 // Determinism by seed & same clip at the same minute on two calls.
 const dayNoon=2*1440+12*60;
 const pCalm={...p0,fedAt:dayNoon-60,adoptedAt:0};
 const a=clipFor(pCalm,dayNoon,{seed:7});
 const b=clipFor(pCalm,dayNoon,{seed:7});
 assert.deepEqual(a,b,'same clip at the same minute on two calls');
 assert.deepEqual(clipFor(pCalm,dayNoon+0.4,{seed:7}),a,'same integer minute matches');
 assert(VARIETY_CLIPS.includes(a.clip));
 assert.equal(a.loop,CLIP_LOOP[a.clip]);

 // Across seeds, all 4 variety clips appear deterministically.
 const seen=new Set();
 for(let seed=0;seed<64;seed++){
  const r=clipFor(pCalm,dayNoon,{seed});
  assert.deepEqual(r,clipFor(pCalm,dayNoon,{seed}),`seed ${seed} deterministic`);
  seen.add(r.clip);
 }
 for(const vc of VARIETY_CLIPS)assert(seen.has(vc),`variety clip ${vc} reachable by seed`);

 // Eat window after a real meal.
 const hungryForMeal={...p0,adoptedAt:0,fedAt:0};
 const fedRes=feed(hungryForMeal,PECKISH_AT);
 assert.equal(fedRes.ok,true);
 assert.deepEqual(clipFor(fedRes.pet,PECKISH_AT,{seed:3}),{clip:'eat',loop:true,speed:1});
 assert.equal(clipFor(fedRes.pet,PECKISH_AT+EAT_MINUTES-1,{seed:3}).clip,'eat');
 assert.notEqual(clipFor(fedRes.pet,PECKISH_AT+EAT_MINUTES,{seed:3}).clip,'eat');

 // Purr ('pet') window after a pat.
 const patRes=pat(fedRes.pet,PECKISH_AT+20);
 assert.equal(patRes.ok,true);
 assert.deepEqual(clipFor(patRes.pet,PECKISH_AT+20,{seed:3}),{clip:'pet',loop:true,speed:1});
 assert.equal(clipFor(patRes.pet,PECKISH_AT+20+PURR_MINUTES-1,{seed:3}).clip,'pet');
 assert.notEqual(clipFor(patRes.pet,PECKISH_AT+20+PURR_MINUTES,{seed:3}).clip,'pet');

 // Sleep window: 23:00-06:00 when not hungry.
 const wellFed={...p0,adoptedAt:0,fedAt:2*1440+20*60};
 assert.deepEqual(clipFor(wellFed,2*1440+23*60,{seed:1}),{clip:'sleep',loop:true,speed:1});
 assert.deepEqual(clipFor(wellFed,3*1440+2*60,{seed:1}),{clip:'sleep',loop:true,speed:1});
 assert.equal(clipFor(wellFed,3*1440+5*60+59,{seed:1}).clip,'sleep');
 assert.notEqual(clipFor(wellFed,3*1440+6*60,{seed:1}).clip,'sleep');
 assert.notEqual(clipFor(wellFed,2*1440+22*60+59,{seed:1}).clip,'sleep');

 // Hungry / starving overrides sleep window -> Meow (unless moving -> walk).
 const night2am=10*1440+2*60;
 const hungryAtNight={...p0,adoptedAt:0,fedAt:night2am-WEEK_MINUTES};
 const starvingAtNight={...p0,adoptedAt:0,fedAt:night2am-2*WEEK_MINUTES};
 assert.deepEqual(clipFor(hungryAtNight,night2am,{seed:1}),{clip:'Meow',loop:false,speed:1});
 assert.equal(clipFor(starvingAtNight,night2am,{seed:1}).clip,'Meow');
 assert(clipFor(starvingAtNight,night2am,{seed:1}).speed>1);
 assert.equal(clipFor(hungryAtNight,night2am,{seed:1,moving:true}).clip,'walk');

 // Daytime moving / running and invalid inputs.
 assert.equal(clipFor(pCalm,dayNoon,{moving:true}).clip,'walk');
 assert.equal(clipFor(pCalm,dayNoon,{running:true}).clip,'Run');
 assert.deepEqual(clipFor(null,dayNoon),{clip:'idle',loop:true,speed:1});
 assert.deepEqual(clipFor(pCalm,NaN),{clip:'idle',loop:true,speed:1});
}

// 2. nextWaypoint and blendTime: in bounds, outside furniture, deterministic.
{
 const furniture=[
  {x0:-3,x1:-1,z0:-2,z1:1},
  {x:2,z:0.5,hx:0.8,hz:1.2},
  {x:0,z:-2.2,w:1.8,d:0.9}
 ];
 const bounds={x0:-4,x1:4,z0:-3,z1:3,furniture};
 const inRect=(p,r)=>r.x0!==undefined?(p.x>=r.x0&&p.x<=r.x1&&p.z>=r.z0&&p.z<=r.z1):(Math.abs(p.x-r.x)<=r.hx&&Math.abs(p.z-r.z)<=r.hz);
 const checkPt=(p)=>{
  assert(p&&Number.isFinite(p.x)&&Number.isFinite(p.z));
  assert(p.x>=bounds.x0&&p.x<=bounds.x1&&p.z>=bounds.z0&&p.z<=bounds.z1,'waypoint inside bounds');
  assert(!inRect(p,furniture[0])&&!inRect(p,furniture[1]),'waypoint outside furniture');
  assert(!(Math.abs(p.x-0)<=0.9&&Math.abs(p.z+2.2)<=0.45),'waypoint outside w/d rect');
 };
 const w0=nextWaypoint(bounds,42,0);
 assert.deepEqual(w0,nextWaypoint(bounds,42,0),'waypoint deterministic');
 const steps=new Set();
 for(let step=0;step<60;step++){
  const w=nextWaypoint(bounds,42,step);
  checkPt(w);
  steps.add(`${w.x},${w.z}`);
 }
 assert(steps.size>10,'steps explore multiple points');

 // Tight room leaving only one corner corridor free -> grid fallback finds valid point.
 const tight={W:4,D:4,avoid:[{x0:-2,x1:2,z0:-2,z1:1},{x0:-2,x1:1,z0:1,z1:2}]};
 const wt=nextWaypoint(tight,5,2);
 assert(wt&&wt.x>=1&&wt.x<=2&&wt.z>=1&&wt.z<=2,'tight room finds free corner');

 // Fully blocked room -> null.
 assert.equal(nextWaypoint({x0:-1,x1:1,z0:-1,z1:1,avoid:[{x0:-1,x1:1,z0:-1,z1:1}]},1,0),null);
 assert.equal(nextWaypoint(null,1,0),null);

 // blendTime table and helper.
 assert.equal(blendTime('idle','idle'),0);
 assert.equal(blendTime(null,'idle'),0);
 assert(blendTime('idle','walk')>0&&blendTime('idle','walk')<1);
 assert(blendTime('sleep','Get_Up')>0);
 assert(blendTime('Meow','Stretch')>0);
 for(const from of Object.keys(BLEND_TIMES))for(const [to,t] of Object.entries(BLEND_TIMES[from])){
  assert(CLIP_IDS.includes(from)&&CLIP_IDS.includes(to)&&Number.isFinite(t)&&t>=0);
 }
}

// 3. petSnapshot / applyPetSnapshot: compact fields, strict validation, trimming and clamping.
{
 const snap=petSnapshot({name:'  Whiskers the Brave  ',homeId:'house-r1',clip:'Sit_Groom',x:1.23456,z:-2.5,yaw:0.75,extraField:99});
 assert.deepEqual(snap,{name:'Whiskers the Bra',homeId:'house-r1',clip:'Sit_Groom',x:1.235,z:-2.5,yaw:0.75});
 assert.equal(snap.name.length<=NAME_MAX,true);
 assert.deepEqual(Object.keys(snap).sort(),['clip','homeId','name','x','yaw','z']);
 assert.deepEqual(applyPetSnapshot(snap),snap,'snapshot round-trips cleanly');

 // Finite numbers clamped and yaw wrapped; unknown fields dropped.
 const clamped=applyPetSnapshot({name:'Milo',homeId:'studio',clip:'idle',x:99999,z:-99999,yaw:Math.PI*3,evil:true});
 assert.deepEqual(Object.keys(clamped).sort(),['clip','homeId','name','x','yaw','z']);
 assert.equal(clamped.x,COORD_MAX);
 assert.equal(clamped.z,-COORD_MAX);
 assert(Math.abs(clamped.yaw)<=Math.PI,'yaw wrapped within [-pi, pi]');

 // Garbage snapshots rejected (-> null).
 const bad=[
  null,undefined,42,'str',[],
  {name:'',homeId:'studio',clip:'idle',x:0,z:0,yaw:0},
  {name:'   ',homeId:'studio',clip:'idle',x:0,z:0,yaw:0},
  {name:123,homeId:'studio',clip:'idle',x:0,z:0,yaw:0},
  {name:'Milo',homeId:'bad space!',clip:'idle',x:0,z:0,yaw:0},
  {name:'Milo',homeId:null,clip:'idle',x:0,z:0,yaw:0},
  {name:'Milo',homeId:'studio',clip:'fly',x:0,z:0,yaw:0},
  {name:'Milo',homeId:'studio',clip:0,x:0,z:0,yaw:0},
  {name:'Milo',homeId:'studio',clip:'idle',x:NaN,z:0,yaw:0},
  {name:'Milo',homeId:'studio',clip:'idle',x:0,z:Infinity,yaw:0},
  {name:'Milo',homeId:'studio',clip:'idle',x:0,z:0,yaw:'1'},
  {name:'Milo',homeId:'studio',clip:'idle',x:0,z:0}
 ];
 for(const g of bad){
  assert.equal(applyPetSnapshot(g),null,`garbage snapshot rejected: ${JSON.stringify(g)}`);
 }
 assert.equal(petSnapshot(null),null);
 assert.equal(petSnapshot({name:'Milo',homeId:'studio',clip:'bad'}),null);
 assert.equal(petSnapshot({name:'Milo',homeId:'studio',x:NaN}),null);
}

// 4. interiorSpawn: deterministic spawn inside studio, free-point lists and real houseLayout.
{
 const s1=interiorSpawn('studio');
 const s2=interiorSpawn('studio');
 assert.deepEqual(s1,s2,'studio spawn deterministic');
 assert(s1&&Math.abs(s1.x)<=6&&Math.abs(s1.z)<=5&&s1.floor===0&&Number.isFinite(s1.yaw));

 // Free-point list with an obstacle filtering out blocked points.
 const fp=interiorSpawn('house-r1',{freePoints:[{x:10,z:10},{x:-1.5,z:0.5}],avoid:[{x0:9,x1:11,z0:9,z1:11}]});
 assert.deepEqual({x:fp.x,z:fp.z,floor:fp.floor},{x:-1.5,z:0.5,floor:0});

 // Real houseLayout from interiors.js + collidersOf.
 const hl=houseLayout('house-a');
 const cols=collidersOf(hl,0);
 const hs=interiorSpawn('house-r1',{...hl,colliders:cols});
 assert(hs&&Math.abs(hs.x)<=hl.W/2&&Math.abs(hs.z)<=hl.D/2,'house spawn inside room');
 assert(!cols.some(c=>Math.abs(hs.x-c.x)<=c.hx&&Math.abs(hs.z-c.z)<=c.hz),'house spawn outside colliders');
 assert.deepEqual(interiorSpawn('house-r1',{...hl,colliders:cols}),hs,'house spawn deterministic');

 assert.equal(interiorSpawn(null),null);
 assert.equal(interiorSpawn('bad id!'),null);
}

// 5. Purity check: no DOM, no globals/clock/random, no three.js.
{
 const src=fs.readFileSync(new URL('../dist/pet-view.js',import.meta.url),'utf8');
 for(const bad of ['document','window','Date.now','Math.random','performance.now','three'])assert(!src.includes(bad),`pet-view.js must not reference ${bad}`);
}

console.log('PASS pet-view: clipFor variety/sleep/hunger, nextWaypoint bounds/furniture, blendTime, petSnapshot validation, interiorSpawn, purity.');
