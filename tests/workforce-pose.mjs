import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MAP} from '../dist/map-definition.js';
import {townPopulation,GAME_MINUTES_PER_SECOND,WALK_SPEED} from '../dist/population.js';
import {BLOCK_IDS,markedBlocks} from '../dist/forest.js';
import {terrain} from '../dist/terrain.js';
import {createWorld} from '../dist/world.js';
import * as THREE from '../dist/vendor/three.module.js';
import {
 WORK_HOURS,OUTDOOR_WORK_PLACES,WORKFORCE_POSTS,WORK_PHASES,
 CUTTER_CYCLE_MIN,HAULER_CYCLE_MIN,SAWYER_CYCLE_MIN,
 FELLER_CYCLE_MIN,FELLER_LOGS_PER_TRUNK,FELLER_TRUNKS_PER_DAY,FELLER_PHASE_MIN,BUCK_CUT_END,
 SWING_SECONDS,HAUL_SPEED,
 BLOCK_TREES,SAWMILL_STATIONS,HAUL_WAYPOINTS,isOutdoorWork,workerRoleOf,workforcePose
} from '../dist/workforce-pose.js';

globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};

const pop=townPopulation();
const peter=pop.people.find(p=>p.post==='ridgeline-fellers#1');
const tom=pop.people.find(p=>p.post==='ridgeline-fellers#2');
const priya=pop.people.find(p=>p.post==='ridgeline-sawyer');
const walt=pop.people.find(p=>p.post==='ridgeline-owner');
const anton=pop.people.find(p=>p.post==='ridgeline-yard');
assert.ok(peter&&tom&&priya&&walt&&anton,'real Ridgeline staff exist in townPopulation()');

// 1. isOutdoorWork and workerRoleOf
assert.deepEqual(WORKFORCE_POSTS,['ridgeline-fellers#1','ridgeline-fellers#2','ridgeline-sawyer']);
assert.deepEqual(OUTDOOR_WORK_PLACES,['zone:forest','property:sawmill']);
assert.deepEqual(WORK_PHASES,['chop','buck','carry','bend','walk','saw']);
assert.deepEqual(WORK_HOURS,[360,1080]);
assert.equal(HAUL_SPEED,+(WALK_SPEED*0.95).toFixed(4));
assert.equal(isOutdoorWork('zone:forest'),true);
assert.equal(isOutdoorWork('property:sawmill'),true);
assert.equal(isOutdoorWork({act:'work',place:'zone:forest'}),true);
assert.equal(isOutdoorWork({act:'work',place:'property:sawmill'}),true);
assert.equal(isOutdoorWork({act:'sleep',place:'property:sawmill'}),false);
assert.equal(isOutdoorWork({act:'travel',place:'zone:forest'}),false);
assert.equal(isOutdoorWork({act:'work',place:'office:ridgeline-warehouse'}),false);
assert.equal(isOutdoorWork(peter),true);
assert.equal(isOutdoorWork(tom),true);
assert.equal(isOutdoorWork(priya),true);
assert.equal(isOutdoorWork(walt),false);
assert.equal(isOutdoorWork(anton),false);
assert.equal(workerRoleOf(peter),'cutter');
assert.equal(workerRoleOf(tom),'hauler');
assert.equal(workerRoleOf(priya),'sawyer');
assert.equal(workerRoleOf(walt),null);

// 2. All named waypoints and block tree points are walkable and clear on the real MAP
const T=terrain(),world=createWorld(new THREE.Scene(),{cullRadius:Infinity});
for(const blk of BLOCK_IDS){
 const list=BLOCK_TREES[blk];
 assert.equal(list.length,4,`BLOCK_TREES[${blk}] has 4 trees`);
 for(const pt of list){
  assert.equal(T.walkable(pt.x,pt.z),true,`${blk} tree (${pt.x},${pt.z}) walkable`);
  assert.equal(world.blocked(pt.x,pt.z),false,`${blk} tree (${pt.x},${pt.z}) unblocked`);
 }
}
for(const [k,pt] of Object.entries(SAWMILL_STATIONS)){
 assert.equal(T.walkable(pt.x,pt.z),true,`sawmill station ${k} (${pt.x},${pt.z}) walkable`);
 assert.equal(world.blocked(pt.x,pt.z),false,`sawmill station ${k} (${pt.x},${pt.z}) unblocked`);
}
for(const [k,pt] of Object.entries(HAUL_WAYPOINTS)){
 assert.equal(T.walkable(pt.x,pt.z),true,`haul waypoint ${k} (${pt.x},${pt.z}) walkable`);
 assert.equal(world.blocked(pt.x,pt.z),false,`haul waypoint ${k} (${pt.x},${pt.z}) unblocked`);
}

// 3. Co-op determinism & 30/60/144 Hz frame-rate independence across shift minutes and 10 days
const makeOut=()=>Object.seal({x:0,z:0,yaw:0,phase:null,tag:null,moving:false,speed:0,progress:0,prop:null,role:null,state:'',targetX:NaN,targetZ:NaN,trunkX:NaN,trunkZ:NaN,trunkYaw:NaN,groundLogs:0});
const a=makeOut(),b=makeOut();
const checkEqual=(p,d,m,seed=MAP.seed)=>{
 const ra=workforcePose(a,p,d,m,{seed}),rb=workforcePose(b,p,d,m,{seed});
 assert.equal(ra,a,'returns mutated out object');
 assert.equal(rb,b);
 assert.deepEqual({...a},{...b},`${p.id} day ${d} min ${m} co-op identical`);
};
for(const worker of [peter,tom,priya]){
 for(const hz of [30,60,144]){
  const dt=1/hz;
  let m=360;
  for(let step=0;step<=1800;step++){ // 1800 steps covers different real spans across 30/60/144 Hz; plus direct exact target times
   m=360+step*dt*GAME_MINUTES_PER_SECOND;
   checkEqual(worker,1,m,MAP.seed);
   assert.equal(T.walkable(a.x,a.z),true,`${worker.id} ${hz}Hz (${a.x.toFixed(2)},${a.z.toFixed(2)}) walkable`);
   assert.equal(world.blocked(a.x,a.z),false,`${worker.id} ${hz}Hz (${a.x.toFixed(2)},${a.z.toFixed(2)}) unblocked`);
  }
 }
 // Stepping at 30/60/144 Hz to the exact same elapsed target time lands on identical poses
 for(const targetSec of [0,1.5,12,75,360.75,720.5,1200]){
  let t30=0,t60=0,t144=0;
  for(let i=0;i<Math.round(targetSec*30);i++)t30+=1/30;
  for(let i=0;i<Math.round(targetSec*60);i++)t60+=1/60;
  for(let i=0;i<Math.round(targetSec*144);i++)t144+=1/144;
  const o30=makeOut(),o60=makeOut(),o144=makeOut();
  workforcePose(o30,worker,2,360+t30*GAME_MINUTES_PER_SECOND,{seed:MAP.seed});
  workforcePose(o60,worker,2,360+t60*GAME_MINUTES_PER_SECOND,{seed:MAP.seed});
  workforcePose(o144,worker,2,360+t144*GAME_MINUTES_PER_SECOND,{seed:MAP.seed});
  assert.ok(Math.hypot(o30.x-o60.x,o30.z-o60.z)<.6&&Math.hypot(o60.x-o144.x,o60.z-o144.z)<.1,`${worker.id} t=${targetSec}s converges across 30/60/144 Hz`);
 }
}

// 4. All 5 phases occur, 10-day sweep is 100% walkable & clear, non-worker stays hidden
const seenByRole={cutter:new Set(),hauler:new Set(),sawyer:new Set()};
for(let day=1;day<=10;day++){
 for(let m=360;m<=1080;m+=0.25){
  for(const worker of [peter,tom,priya]){
   workforcePose(a,worker,day,m,{seed:MAP.seed});
   assert.ok(WORK_PHASES.includes(a.phase),`valid phase ${a.phase}`);
   assert.equal(a.phase,a.tag,'tag mirrors phase');
   assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.z)&&Number.isFinite(a.yaw),'finite coordinates and heading');
   assert.ok(a.progress>=0&&a.progress<=1,'progress in 0..1');
   assert.equal(T.walkable(a.x,a.z),true,`d${day} m${m} ${worker.id} walkable`);
   assert.equal(world.blocked(a.x,a.z),false,`d${day} m${m} ${worker.id} unblocked`);
   seenByRole[a.role].add(a.phase);
  }
 }
}
for(const p of ['walk','chop','buck','carry','bend'])assert.ok(seenByRole.cutter.has(p),`cutter hits ${p}`);
for(const p of ['walk','chop','buck','carry','bend'])assert.ok(seenByRole.hauler.has(p),`hauler hits ${p}`);
for(const p of ['walk','carry','bend','saw'])assert.ok(seenByRole.sawyer.has(p),`sawyer hits ${p}`);

// 4b. W4: buck phase occurs once per tree between chop and carry, trunk position exposed, cycle sums right for 2 trunks/day
const phaseSum=Object.values(FELLER_PHASE_MIN).reduce((s,v)=>s+v,0);
assert.ok(Math.abs(phaseSum-FELLER_CYCLE_MIN)<1e-9,`feller phases sum to FELLER_CYCLE_MIN (${phaseSum} === ${FELLER_CYCLE_MIN})`);
assert.equal(FELLER_TRUNKS_PER_DAY*FELLER_LOGS_PER_TRUNK,4,'2 trunks x 2 logs = 4 logs/day');
for(const [worker,startM] of [[peter,360],[tom,360+FELLER_CYCLE_MIN/2]]){
 const seq=[];let buckCount=0,trunkSeen=false,logs2Seen=false,logs1Seen=false;
 for(let dt=0.05;dt<FELLER_CYCLE_MIN;dt+=0.1){
  workforcePose(a,worker,1,startM+dt,{seed:MAP.seed});
  if(seq[seq.length-1]!==a.phase)seq.push(a.phase);
  if(a.phase==='buck'){
   if(a.progress<BUCK_CUT_END){
    assert.ok(Number.isFinite(a.trunkX)&&Number.isFinite(a.trunkZ)&&Number.isFinite(a.trunkYaw),'trunk pose finite during buck cuts');
    assert.ok(Math.hypot(a.trunkX-a.x,a.trunkZ-a.z)<3,'trunk lies where feller works');
    assert.equal(a.groundLogs,0);
    trunkSeen=true;
   }else{
    assert.ok(Number.isNaN(a.trunkX)&&Number.isNaN(a.trunkZ),'trunk replaced by 2 logs at buck pause');
    assert.equal(a.groundLogs,2);
    logs2Seen=true;
   }
  }else{
   assert.ok(Number.isNaN(a.trunkX)&&Number.isNaN(a.trunkZ)&&Number.isNaN(a.trunkYaw),'no ground trunk outside buck');
   if(a.phase==='carry'&&a.groundLogs===1)logs1Seen=true;
  }
 }
 for(const ph of seq)if(ph==='buck')buckCount++;
 assert.equal(buckCount,1,`${worker.id} buck occurs once per tree`);
 assert.deepEqual(seq,['walk','chop','buck','bend','carry','bend','walk','bend','carry','bend','walk'],`${worker.id} exact feller cycle`);
 assert.ok(trunkSeen&&logs2Seen&&logs1Seen,`${worker.id} exposes trunk during buck and 2->1->0 ground logs`);
}

// Midday transition continuity check for Cutter across markedBlocks(day)[0] -> markedBlocks(day)[1]
for(let day=1;day<=10;day++){
 const [b0,b1]=markedBlocks(day);
 assert.notEqual(b0,b1);
 let prev=null;
 for(let m=719.9;m<=721.5;m+=0.05){
  workforcePose(a,peter,day,m,{seed:MAP.seed});
  assert.equal(T.walkable(a.x,a.z),true);assert.equal(world.blocked(a.x,a.z),false);
  if(prev)assert.ok(Math.hypot(a.x-prev.x,a.z-prev.z)<18,`day ${day} midday smooth step at m=${m.toFixed(2)}`);
  prev={x:a.x,z:a.z};
 }
}

// Non-worker stays hidden cleanly
workforcePose(a,walt,1,720,{seed:MAP.seed});
assert.equal(a.state,'hidden');assert.equal(a.phase,null);assert.equal(a.role,null);assert.equal(a.moving,false);

// 5. Zero-allocation check on sealed `out` and source purity check
const sealed=makeOut();
for(let i=0;i<5000;i++){
 workforcePose(sealed,i%3===0?peter:i%3===1?tom:priya,1+(i%10),360+(i*0.37)%720,{seed:MAP.seed});
}
const src=fs.readFileSync(new URL('../dist/workforce-pose.js',import.meta.url),'utf8');
const firstLine=src.split(/\r?\n/)[0];
assert.ok(firstLine.length<90&&firstLine.includes('workforce-design.md W1'),`short header <90 chars: ${firstLine}`);
assert.ok(!/document|window|three\.module|Date\.now|Math\.random/.test(src),'pure source');
const poseFn=src.slice(src.indexOf('export function workforcePose'));
assert.ok(!/\[|\{[^\n]*:/.test(poseFn),'workforcePose itself allocates no array or object literals');

console.log(`PASS workforce-pose.mjs: cutter/hauler/sawyer deterministic across 30/60/144 Hz, co-op exact, 10 days x all waypoints walkable & unblocked, all 5 phases (${WORK_PHASES.join('/')}), zero allocations on sealed out, pure.`);
