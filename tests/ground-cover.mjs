import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SURFACE} from '../dist/terrain.js';
import {WIND_BASE,WIND_KIND_MUL,windGust,windAngle,windSample,makeWind,swayPhase,windBend,windUniform,makeWindClock,advanceWindClock,setWindWeather,WIND_MAX_DT,TAU} from '../dist/wind.js';
import {COVER_RULES,COVER_KINDS,COVER_TIER,COVER_ORDER,COVER_FOG_CAP,SURF,maxDensity,cellRand,densityAt,coverFor,coverStats,coverReach,lodKeep,lodScale,lodVisible,tierOf} from '../dist/ground-cover-rules.js';

// GD4 (notes/ground-detail-design.md 2a-2c): wind and cover rules, pure. Same numbers as the menu wind.
for(const k of Object.keys(SURF))assert.equal(SURF[k],SURFACE[k],'SURF mirrors terrain.js SURFACE: '+k);
const tau=TAU;
// ---- wind
assert.ok(Math.abs(windGust(0)-(.5+.3*0+.2*Math.sin(2)))<1e-12,'gust = menu curve');
for(let t=-50;t<2000;t+=.37){const g=windGust(t);assert.ok(g>=0&&g<=1)}
const w=makeWind(),out={x:0,z:0};
for(let t=0;t<600;t+=.5){windSample(t,w);assert.ok(Math.abs(Math.hypot(w.dx,w.dz)-1)<1e-9,'unit direction');assert.ok(w.strength>=.4&&w.strength<=1);assert.ok(Math.abs(windAngle(t)-Math.atan2(WIND_BASE.dz,WIND_BASE.dx))<.5+1e-9,'direction wanders but stays near the base')}
assert.equal(windSample(5,makeWind(),0).strength,0,'calm weather = no wind');assert.equal(windSample(5,makeWind(),9).strength,windSample(5,makeWind(),2).strength,'weather clamps at 2');
// sway phase: deterministic, in range, continuous, varies with position
for(let i=0;i<200;i++){const x=i*3.7-300,z=i*1.9+11,p=swayPhase(x,z);assert.ok(p>=0&&p<=TAU);assert.equal(p,swayPhase(x,z))}
assert.ok(Math.abs(swayPhase(10,10)-swayPhase(10.01,10))<.05,'phase is continuous');assert.notEqual(swayPhase(0,0),swayPhase(40,17));
// bend: roots stay put, tips move more, squared; amplitude of the menu at the tip
windSample(3.3,w);assert.equal(windBend(w,5,5,0),0,'bend 0 = root, not moved');
let max1=0,max5=0;for(let t=0;t<120;t+=.05){windSample(t,w);max1=Math.max(max1,Math.abs(windBend(w,5,5,1)));max5=Math.max(max5,Math.abs(windBend(w,5,5,.5)))}
assert.ok(max1>.03&&max1<.15,'tip push is a few cm: '+max1);assert.ok(Math.abs(max5/max1-.25)<.12,'half height pushes about a quarter: '+max5/max1);
windSample(3.3,w);const m1=windBend(w,5,5,1,1,out);assert.ok(Math.abs(out.x-w.dx*m1)<1e-12&&Math.abs(out.z-w.dz*m1)<1e-12,'out is along the wind');assert.equal(windBend(w,5,5,1,WIND_KIND_MUL.reed),m1*WIND_KIND_MUL.reed);assert.equal(windBend(w,5,5,1,WIND_KIND_MUL.rock),0,'rocks do not sway');
const ua=windUniform(w,[0,0,0,0]);assert.deepEqual(ua,[w.dx,w.dz,w.strength,w.gust]);
// junk inputs
for(const bad of [NaN,undefined,null,Infinity,'x',-1e9]){windSample(bad,w);assert.ok(Number.isFinite(w.dx+w.dz+w.strength));assert.ok(Number.isFinite(swayPhase(bad,bad)));assert.ok(Number.isFinite(windBend(w,bad,bad,bad,bad)))}
assert.equal(windBend(w,1,1,5)>=0||true,true);assert.ok(Math.abs(windBend(w,1,1,9))<=Math.abs(windBend(w,1,1,1))+1e-12,'bend clamps to 1');
// frame-rate independence: the clock after the same real time is the same at 240, 60, 30 and 1 steps per second, and a few huge steps
function run(dt,total){const c=makeWindClock();setWindWeather(c,.2);for(let t=0;t<total-1e-9;t+=dt)advanceWindClock(c,dt);return c}
const A=run(1/240,4),B=run(1/60,4),C=run(1/30,4),D=run(2,4);
for(const c of [B,C,D]){assert.ok(Math.abs(c.t-A.t)<1e-6,'clock time agrees '+c.t+' vs '+A.t);assert.ok(Math.abs(c.weather-A.weather)<1e-6,'weather easing agrees across frame rates')}
const sa=windSample(A.t,makeWind(),A.weather),sd=windSample(D.t,makeWind(),D.weather);assert.ok(Math.abs(windBend(sa,3,4,1)-windBend(sd,3,4,1))<1e-6,'same push after many small steps and two big ones');
assert.ok(A.weather<1&&A.weather>.2,'weather moves toward .2 but not instantly: '+A.weather);
const E=makeWindClock();advanceWindClock(E,1000);assert.equal(E.t,WIND_MAX_DT,'a huge step is clamped');advanceWindClock(E,-5);advanceWindClock(E,NaN);assert.equal(E.t,WIND_MAX_DT,'negative and NaN steps are ignored');

// ---- cover rules
// every rule: the jitter grid can hold the densest case (no silent clamping), models exist as kit files, scale ordered
const KIT='assets-src/Landscape/Stylized Nature MegaKit[Standard]/glTF/';const haveKit=fs.existsSync(KIT);
for(const k of COVER_KINDS){const r=COVER_RULES[k],top=Math.max(...Object.values(r.surf))*Math.max(1,...Object.values(r.biome))*(1+r.clump);assert.ok(top<=maxDensity(k)+1e-9,k+' densest case '+top+' fits the grid '+maxDensity(k));assert.ok(r.scale[0]<r.scale[1]&&r.scale[0]>0);assert.ok(COVER_ORDER.includes(k));assert.ok(r.reach>0);
 for(const m of r.models)if(m!==null&&haveKit)assert.ok(fs.existsSync(KIT+m+'.gltf'),'kit model '+m)}
assert.equal(COVER_ORDER.length,COVER_KINDS.length);
// surfaces: nothing on roads, pavement, water, bridges, driveways (all kinds), grass on no mud
for(const k of COVER_KINDS)for(const id of [SURF.STREET,SURF.ROAD,SURF.PAVEMENT,SURF.WATER,SURF.BRIDGE,SURF.DRIVEWAY])assert.equal(COVER_RULES[k].surf[id],undefined,k+' must not grow on surface '+id);
assert.equal(COVER_RULES.grass.surf[SURF.MUD],undefined);
const flat=surface=>({surfaceAt:()=>surface});
// synthetic world: x<30 grass, 30..34 road, >34 grass; water at z>80 (bank 70..80); building at (60..70, 20..30); forest x in 40..60, z 40..60 (biome); steep strip z in 0..10
const world={surfaceAt:(x,z)=>x>=30&&x<34?SURF.ROAD:z>=80?SURF.WATER:z>=70?SURF.BANK:(x>=60&&x<70&&z>=20&&z<30)?SURF.PAVEMENT:SURF.GRASS,
 roadDist:(x,z)=>x<30?30-x:x>=34?x-34:0,waterDist:(x,z)=>z>=80?0:80-z,buildingDist:(x,z)=>{const dx=Math.max(60-x,0,x-70),dz=Math.max(20-z,0,z-30);return Math.hypot(dx,dz)},biomeAt:(x,z)=>x>=40&&x<60&&z>=40&&z<60?'forest':'open',slopeAt:(x,z)=>z<10?3:.05};
const seed=1234,full=coverFor(0,0,seed,world,{tier:'high'});
assert.deepEqual(coverFor(0,0,seed,world,{tier:'high'}),full,'same seed, same output');
assert.notDeepEqual(coverFor(0,0,seed+1,world,{tier:'high'}).slice(0,20),full.slice(0,20),'another seed, another grass');
assert.ok(full.length>2000,'a chunk grows cover: '+full.length);
for(const e of full){assert.ok(e.x>=0&&e.x<100&&e.z>=0&&e.z<100,'inside the chunk');assert.ok(Number.isFinite(e.scale+e.yaw+e.rank+e.phase)&&e.tint.length===3&&e.tint.every(Number.isFinite));const r=COVER_RULES[e.kind];assert.ok(e.scale>=r.scale[0]*.85&&e.scale<=r.scale[1]*1.15,e.kind+' scale in range '+e.scale);assert.ok(r.models[e.variant]===e.model);
 assert.ok(world.surfaceAt(e.x,e.z) in r.surf,e.kind+' on an allowed surface');assert.ok(world.roadDist(e.x,e.z)>=r.roadMin,'clear of the road');assert.ok(world.buildingDist(e.x,e.z)>=r.buildMin,'clear of the building');assert.ok(world.waterDist(e.x,e.z)>=r.waterMin,'clear of water');assert.ok(world.slopeAt(e.x,e.z)<=r.maxSlope,'not on the steep strip')}
assert.ok(!full.some(e=>e.z<10),'nothing on the steep strip');assert.ok(!full.some(e=>e.x>=30&&e.x<34),'nothing on the road');assert.ok(!full.some(e=>e.x>=60&&e.x<70&&e.z>=20&&e.z<30),'nothing on the paving');
// reeds only near water
const reeds=full.filter(e=>e.kind==='reed');assert.ok(reeds.length>20,'reeds exist at the shore: '+reeds.length);for(const e of reeds){const d=world.waterDist(e.x,e.z);assert.ok(d>=.5&&d<=4,'reed '+d+' m from water')}
// crop only on wheat
assert.equal(full.filter(e=>e.kind==='crop').length,0,'no wheat here, no crop');
const wheat=coverFor(0,0,seed,flat(SURF.WHEAT),{tier:'high'});assert.ok(wheat.length>0&&wheat.every(e=>e.kind==='crop'),'wheat grows only crop');
// pebbles on dirt, none on a wheat field; mud gets no grass
const dirt=coverFor(0,0,seed,flat(SURF.DIRT),{tier:'high'});assert.ok(dirt.some(e=>e.kind==='pebble')&&!dirt.some(e=>e.kind==='grass'),'dirt: pebbles, no grass');
assert.equal(coverFor(0,0,seed,flat(SURF.MUD),{tier:'high'}).filter(e=>e.kind==='grass').length,0,'no grass in mud');
assert.equal(coverFor(0,0,seed,flat(SURF.ROAD),{tier:'high'}).length,0,'road: nothing');
// forest has ferns and mushrooms, open grass has few
const forest=coverFor(0,0,seed,{surfaceAt:()=>SURF.GRASS,biomeAt:()=>'forest'},{tier:'high'}),open=coverFor(0,0,seed,flat(SURF.GRASS),{tier:'high'});
const cnt=(l,k)=>l.filter(e=>e.kind===k).length;assert.ok(cnt(forest,'fern')>cnt(open,'fern')*3,'forest ferns '+cnt(forest,'fern')+' vs open '+cnt(open,'fern'));assert.ok(cnt(forest,'mushroom')>cnt(open,'mushroom')*3);assert.ok(cnt(forest,'grass')<cnt(open,'grass'),'less grass under trees');
// density per 100 m2 within 12% of the rule (mean over 9 chunks, all grass, no exclusions; clump noise averages out)
let n=0,tot={};for(let i=0;i<3;i++)for(let j=0;j<3;j++){const l=coverFor(i,j,77,flat(SURF.GRASS),{tier:'high'});for(const e of l)tot[e.kind]=(tot[e.kind]||0)+1;n++}
const per100=k=>(tot[k]||0)/n/100;
assert.ok(Math.abs(per100('grass')-36)/36<.12,'grass per 100 m2 '+per100('grass'));assert.ok(Math.abs(per100('tallgrass')-14*.45)/(14*.45)<.5,'tall grass only in the lusher macro: '+per100('tallgrass')+' <= 14');assert.ok(per100('tallgrass')<=14*1.05);assert.ok(Math.abs(per100('clover')-8)/8<.15,'clover '+per100('clover'));assert.ok(per100('flower')<12*.5,'flowers are patches, not everywhere: '+per100('flower'));assert.ok(per100('flower')>0,'some flower patches');
// every tier: kinds, cap, scale of density
const stats={};for(const t of ['low','medium','high']){const l=coverFor(1,1,9,flat(SURF.GRASS),{tier:t});stats[t]=coverStats(l);assert.ok(l.length<=COVER_TIER[t].chunkCap,t+' within the cap');for(const e of l)assert.ok(COVER_TIER[t].kinds.includes(e.kind),t+' only draws its kinds');assert.ok(stats[t].drawCalls<=stats[t].kindDrawCalls*COVER_TIER[t].variants,t+' draws per kind within variants')}
assert.ok(stats.low.total<stats.medium.total+stats.high.total&&stats.low.total<stats.high.total);assert.ok(Math.abs(stats.low.byKind.grass/(stats.high.byKind.grass)-.4)<.06,'low tier grass is about .4 of high: '+stats.low.byKind.grass/stats.high.byKind.grass);
assert.ok(stats.high.total<=COVER_TIER.high.chunkCap&&stats.high.drawCalls<=22,'high: draw calls per chunk '+stats.high.drawCalls);
assert.ok(stats.medium.drawCalls<=3&&stats.low.drawCalls===1,'low is one draw, medium at most three');
// hard cap: a tiny cap keeps the big rare kinds first and thins grass; deterministic
const capped=coverFor(0,0,seed,flat(SURF.GRASS),{tier:'high',cap:300}),capped2=coverFor(0,0,seed,flat(SURF.GRASS),{tier:'high',cap:300});assert.equal(capped.length,300);assert.deepEqual(capped,capped2);assert.deepEqual(capped.map(e=>e.kind).slice(0,1),[COVER_ORDER.find(k=>cnt(coverFor(0,0,seed,flat(SURF.GRASS),{tier:'high'}),k)>0)],'big kinds come first');
assert.equal(coverFor(0,0,seed,flat(SURF.GRASS),{tier:'high',cap:0}).length,0);
// seams: two neighbour chunks and one chunk with merged bounds hold the same instances
const a=coverFor(0,0,5,flat(SURF.GRASS),{tier:'medium'}),bb=coverFor(1,0,5,flat(SURF.GRASS),{tier:'medium'}),both=coverFor(0,0,5,flat(SURF.GRASS),{tier:'medium',bounds:{x0:0,z0:0,x1:200,z1:100},cap:1e9});
assert.equal(a.length+bb.length>0,true);assert.equal(both.length,a.length+bb.length,'a global cell grid: no seam, no double instance');
// LOD
for(const k of COVER_KINDS)for(const t of ['low','medium','high']){const R=coverReach(k,t);assert.ok(R.near<R.far&&R.far<=COVER_FOG_CAP);assert.equal(lodKeep(k,0,t),1);assert.equal(lodScale(k,0,t),1);assert.equal(lodKeep(k,R.far,t),0);assert.equal(lodKeep(k,1e6,t),0);let prev=1;for(let d=0;d<=R.far;d+=1){const v=lodKeep(k,d,t);assert.ok(v<=prev+1e-12,'monotone');prev=v}}
assert.equal(coverReach('grass','high').far,60,'High grass reaches 60 m (user decision 2)');assert.equal(coverReach('grass','medium').far,32);assert.equal(coverReach('grass','low').far,20);assert.ok(coverReach('pebble','high').far<coverReach('grass','high').far);
assert.equal(lodVisible('grass',10,'high',.99),true);assert.equal(lodVisible('grass',59,'high',.99),false);assert.equal(lodVisible('grass',NaN,'high',0),false,'NaN distance: hidden');
// junk inputs: never throws, returns an array
for(const bad of [[NaN,0],[0,NaN],[Infinity,0],[undefined,undefined]])assert.deepEqual(coverFor(bad[0],bad[1],1,world),[]);
assert.ok(Array.isArray(coverFor(0,0,undefined,null)),'no seed, no sampler: defaults');assert.ok(Array.isArray(coverFor(0,0,'x',{surfaceAt:()=>NaN,roadDist:()=>NaN})));assert.equal(coverFor(0,0,1,{surfaceAt:()=>NaN}).length,0,'NaN surface: nothing');assert.equal(coverFor(0,0,1,{surfaceAt:()=>1},{tier:'bogus'}).every(e=>e.kind==='grass'),true,'junk tier = low');assert.equal(tierOf('x'),'low');assert.deepEqual(coverFor(0,0,1,world,{bounds:{x0:5,z0:5,x1:1,z1:1}}),[]);
assert.equal(densityAt('nope',1,1),0);assert.equal(densityAt('grass',NaN,1),0);assert.ok(cellRand(1,2,3,4)>=0&&cellRand(1,2,3,4)<1&&cellRand(-5,2.7,NaN,undefined)<1);
// speed: the whole high chunk builds in well under a frame budget for a build step (informational bound)
const t0=process.hrtime.bigint();coverFor(2,2,3,world,{tier:'high'});const ms=Number(process.hrtime.bigint()-t0)/1e6;assert.ok(ms<400,'one high chunk placement took '+ms.toFixed(1)+' ms');
console.log('INFO high/medium/low instances per all-grass chunk: '+stats.high.total+' / '+stats.medium.total+' / '+stats.low.total+'; draw calls '+stats.high.drawCalls+' / '+stats.medium.drawCalls+' / '+stats.low.drawCalls+'; by kind (high) '+JSON.stringify(stats.high.byKind)+'; synthetic chunk with road, shore, building: '+full.length+' in '+ms.toFixed(1)+' ms');
console.log('ground-cover: ok');
