// Workforce poses: fellers (fell, buck, haul) and sawyer (workforce-design.md W1/W4).
import {MAP} from './map-definition.js';
import {hashOf,WALK_SPEED,GAME_MINUTES_PER_SECOND} from './population.js';
import {BLOCK_IDS,LANDING,markedBlocks} from './forest.js';
import {LOG_CARRY_FACTOR} from './plank-economy.js';

export const DAY_MINUTES=1440;
export const WORK_HOURS=Object.freeze([360,1080]);
export const OUTDOOR_WORK_PLACES=Object.freeze(['zone:forest','property:sawmill']);
export const WORKFORCE_POSTS=Object.freeze(['ridgeline-fellers#1','ridgeline-fellers#2','ridgeline-sawyer']);
export const WORK_PHASES=Object.freeze(['chop','buck','carry','bend','walk','saw']);
export const CUTTER_CYCLE_MIN=5,HAULER_CYCLE_MIN=8,SAWYER_CYCLE_MIN=6;
export const FELLER_CYCLE_MIN=15,FELLER_LOGS_PER_TRUNK=2,FELLER_TRUNKS_PER_DAY=2,BUCK_CUT_END=.8;
export const FELLER_PHASE_MIN=Object.freeze({
 walkTree:1.6,chop:2.4,buck:1.5,
 bendPick1:.4,carry1:2.2,bendDrop1:.4,walkBack1:1.75,
 bendPick2:.4,carry2:2.2,bendDrop2:.4,walkBack2:1.75
});
export const SWING_SECONDS=.74;
export const HAUL_SPEED=+(WALK_SPEED*LOG_CARRY_FACTOR).toFixed(4);
export const SECONDS_PER_MINUTE=1/GAME_MINUTES_PER_SECOND;

const pt=(x,z,tx=NaN,tz=NaN)=>Object.freeze({x,z,tx,tz});
export const BLOCK_TREES=Object.freeze({
 A1:Object.freeze([pt(-18.5,-301.15,-18.5,-302.5),pt(-13.5,-308.15,-13.5,-309.5),pt(-10.5,-304.15,-10.5,-305.5),pt(-1.5,-308.15,-1.5,-309.5)]),
 B1:Object.freeze([pt(18.5,-292.15,18.5,-293.5),pt(21.5,-296.15,21.5,-297.5),pt(25.5,-300.15,25.5,-301.5),pt(29.5,-297.15,29.5,-298.5)]),
 C1:Object.freeze([pt(66.5,-308.15,66.5,-309.5),pt(61.5,-309.15,61.5,-310.5),pt(70.5,-308.15,70.5,-309.5),pt(77.5,-308.15,77.5,-309.5)]),
 D1:Object.freeze([pt(105.5,-308.15,105.5,-309.5),pt(109.5,-309.15,109.5,-310.5),pt(114.5,-304.15,114.5,-305.5),pt(122.5,-305.15,122.5,-306.5)]),
 E1:Object.freeze([pt(150.5,-300.15,150.5,-301.5),pt(154.5,-301.15,154.5,-302.5),pt(158.5,-300.15,158.5,-301.5),pt(165.5,-300.15,165.5,-301.5)]),
 A2:Object.freeze([pt(-9.5,-232.15,-9.5,-233.5),pt(-18.5,-240.15,-18.5,-241.5),pt(-14.5,-236.15,-14.5,-237.5),pt(-1.5,-224.15,-1.5,-225.5)]),
 B2:Object.freeze([pt(41.5,-260.15,41.5,-261.5),pt(25.5,-256.15,25.5,-257.5),pt(29.5,-257.15,29.5,-258.5),pt(38.5,-256.15,38.5,-257.5)]),
 C2:Object.freeze([pt(61.5,-257.15,61.5,-258.5),pt(66.5,-261.15,66.5,-262.5),pt(69.5,-256.15,69.5,-257.5),pt(78.5,-264.15,78.5,-265.5)]),
 D2:Object.freeze([pt(109.5,-256.15,109.5,-257.5),pt(121.5,-257.15,121.5,-258.5),pt(125.5,-257.15,125.5,-258.5),pt(129.5,-257.15,129.5,-258.5)]),
 E2:Object.freeze([pt(181.5,-237.15,181.5,-238.5),pt(158.5,-232.15,158.5,-233.5),pt(170.5,-224.15,170.5,-225.5),pt(174.5,-229.15,174.5,-230.5)])
});

export const SAWMILL_STATIONS=Object.freeze({
 logDeck:pt(104.8,-283.0,102.4,-284.75),
 logIn:pt(103.05,-281.2,104.0,-278.0),
 nw:pt(99.8,-283.0),
 sw:pt(99.8,-282.0,100.65,-282.0),
 ne:pt(108.2,-283.0),
 se:pt(108.2,-271.6),
 belt:pt(107.2,-271.6,106.3,-271.6),
 ep:pt(108.2,-275.5),
 pile:pt(105.6,-275.5,104.0,-272.0)
});

export const HAUL_WAYPOINTS=Object.freeze({
 hub:pt(115.0,-285.5),
 hutNorth:pt(129.2,-285.5),
 landing:pt(LANDING.x,LANDING.z,131.0,-279.8),
 logDeck:SAWMILL_STATIONS.logDeck,
 logIn:SAWMILL_STATIONS.logIn
});

const MARKED_PAIRS=Object.freeze(Array.from({length:100},(_,i)=>Object.freeze(markedBlocks(i+1))));

function buildPoly(pts){
 const n=pts.length,xs=new Float64Array(n),zs=new Float64Array(n),cum=new Float64Array(n);let len=0;
 for(let i=0;i<n;i++){xs[i]=pts[i].x;zs[i]=pts[i].z;if(i){len+=Math.hypot(xs[i]-xs[i-1],zs[i]-zs[i-1])}cum[i]=len}
 return Object.freeze({xs,zs,cum,n,length:len,start:pts[0],end:pts[n-1]});
}
function samplePoly(poly,u,out,txFallback=NaN,tzFallback=NaN){
 const {xs,zs,cum,n,length}=poly;
 if(n===1||!(length>0)){out.x=xs[0];out.z=zs[0];out.yaw=Number.isFinite(txFallback)?Math.atan2(txFallback-out.x,tzFallback-out.z):0;return}
 const t=u<=0?0:u>=1?1:u,d=t*length;let i=1;while(i<n-1&&cum[i]<d)i++;
 const a=i-1,seg=cum[i]-cum[a],f=seg>0?(d-cum[a])/seg:1,dx=xs[i]-xs[a],dz=zs[i]-zs[a];
 out.x=xs[a]+dx*f;out.z=zs[a]+dz*f;out.yaw=dx||dz?Math.atan2(dx,dz):0;
}

const S=SAWMILL_STATIONS;
const RAW_HAUL_DECK={
 A1:[BLOCK_TREES.A1[0],HAUL_WAYPOINTS.hub,S.logDeck],
 B1:[BLOCK_TREES.B1[0],HAUL_WAYPOINTS.hub,S.logDeck],
 C1:[BLOCK_TREES.C1[0],HAUL_WAYPOINTS.hub,S.logDeck],
 D1:[BLOCK_TREES.D1[0],S.logDeck],
 E1:[BLOCK_TREES.E1[0],S.logDeck],
 A2:[BLOCK_TREES.A2[0],pt(99.8,-271.6),S.nw,S.logDeck],
 B2:[BLOCK_TREES.B2[0],S.nw,S.logDeck],
 C2:[BLOCK_TREES.C2[0],S.logDeck],
 D2:[BLOCK_TREES.D2[0],pt(99.8,-271.6),S.nw,S.logDeck],
 E2:[BLOCK_TREES.E2[0],S.ne,S.logDeck]
};
const LANDING_TAIL=[HAUL_WAYPOINTS.hub,HAUL_WAYPOINTS.hutNorth,HAUL_WAYPOINTS.landing];
const HAUL_ROUTES=Object.freeze(Object.fromEntries(BLOCK_IDS.map(id=>{
 const toDeck=RAW_HAUL_DECK[id];
 const toSaw=toDeck.concat([S.logIn]);
 const toLanding=toDeck.concat(LANDING_TAIL);
 return [id,Object.freeze({
  toDeck:buildPoly(toDeck),fromDeck:buildPoly([...toDeck].reverse()),
  toSaw:buildPoly(toSaw),fromSaw:buildPoly([...toSaw].reverse()),
  toLanding:buildPoly(toLanding),fromLanding:buildPoly([...toLanding].reverse())
 })];
})));

const SAW_W1=buildPoly([S.logDeck,S.logIn]);
const SAW_W2=buildPoly([S.logIn,S.logDeck,S.nw,S.sw]);
const SAW_W3=buildPoly([S.sw,S.nw,S.ne,S.se,S.belt]);
const SAW_W4=buildPoly([S.belt,S.se,S.ep,S.pile]);
const SAW_W5=buildPoly([S.pile,S.ep,S.ne,S.logDeck]);

const clamp01=x=>x<=0?0:x>=1?1:x;
const wrapMin=m=>Number.isFinite(m)?((m%DAY_MINUTES)+DAY_MINUTES)%DAY_MINUTES:720;

export function workerRoleOf(person){
 if(!person)return null;
 if(typeof person==='string'){
  if(person==='ridgeline-fellers#1'||person==='farm-house#2'||person==='cutter')return 'cutter';
  if(person==='ridgeline-fellers#2'||person==='house-r4#1'||person==='hauler')return 'hauler';
  if(person==='ridgeline-sawyer'||person==='house-r6#1'||person==='sawyer')return 'sawyer';
  return null;
 }
 const key=person.post||person.id||'';
 if(key==='ridgeline-fellers#1'||key==='farm-house#2')return 'cutter';
 if(key==='ridgeline-fellers#2'||key==='house-r4#1')return 'hauler';
 if(key==='ridgeline-sawyer'||key==='house-r6#1')return 'sawyer';
 if(person.work==='property:sawmill'||person.role==='Sawyer')return 'sawyer';
 if(person.work==='zone:forest'||person.role==='Feller')return /#2$/.test(String(person.id||person.post||''))?'hauler':'cutter';
 return null;
}

export function isOutdoorWork(target,person){
 if(!target&&!person)return false;
 if(typeof target==='string'){
  if(OUTDOOR_WORK_PLACES.includes(target)||WORKFORCE_POSTS.includes(target))return true;
  if(target==='cutter'||target==='hauler'||target==='sawyer')return true;
  return workerRoleOf(target)!==null;
 }
 if(target&&typeof target==='object'){
  if('place' in target||'act' in target){
   if(target.act&&target.act!=='work')return false;
   if(typeof target.place==='string'&&OUTDOOR_WORK_PLACES.includes(target.place))return true;
   if(person&&workerRoleOf(person)!==null&&target.act==='work')return true;
   return false;
  }
  if(workerRoleOf(target)!==null)return true;
  if(typeof target.work==='string'&&OUTDOOR_WORK_PLACES.includes(target.work))return true;
 }
 return person?workerRoleOf(person)!==null:false;
}

function clearTrunk(out){out.trunkX=NaN;out.trunkZ=NaN;out.trunkYaw=NaN;out.groundLogs=0}

function setStation(out,role,station,phase,prog,prop){
 out.x=station.x;out.z=station.z;
 out.yaw=Number.isFinite(station.tx)?Math.atan2(station.tx-station.x,station.tz-station.z):0;
 out.phase=phase;out.tag=phase;out.moving=false;out.speed=0;
 out.progress=clamp01(prog);out.prop=prop;out.role=role;out.state='stand';
 out.targetX=Number.isFinite(station.tx)?station.tx:NaN;out.targetZ=Number.isFinite(station.tz)?station.tz:NaN;
}

function lerpSegment(out,ax,az,bx,bz,u,fallbackTx,fallbackTz){
 const dx=bx-ax,dz=bz-az;
 out.x=ax+dx*u;out.z=az+dz*u;
 out.yaw=dx||dz?Math.atan2(dx,dz):Math.atan2(fallbackTx-ax,fallbackTz-az);
}

function carryToDeck(out,blkId,tree,e1,u,role,groundLogs){
 if(tree===e1){samplePoly(HAUL_ROUTES[blkId].toDeck,u,out,S.logDeck.tx,S.logDeck.tz)}
 else if(u<.2){lerpSegment(out,tree.x,tree.z,e1.x,e1.z,u/.2,S.logDeck.x,S.logDeck.z)}
 else{samplePoly(HAUL_ROUTES[blkId].toDeck,(u-.2)/.8,out,S.logDeck.tx,S.logDeck.tz)}
 out.phase='carry';out.tag='carry';out.moving=true;out.speed=HAUL_SPEED;out.progress=clamp01(u);
 out.prop='log';out.role=role;out.state='walk';out.targetX=S.logDeck.tx;out.targetZ=S.logDeck.tz;
 out.trunkX=NaN;out.trunkZ=NaN;out.trunkYaw=NaN;out.groundLogs=groundLogs;
 return out;
}

function walkFromDeck(out,blkId,tree,e1,u,role,groundLogs){
 if(tree===e1){samplePoly(HAUL_ROUTES[blkId].fromDeck,u,out,tree.tx,tree.tz)}
 else if(u<.8){samplePoly(HAUL_ROUTES[blkId].fromDeck,u/.8,out,tree.x,tree.z)}
 else{lerpSegment(out,e1.x,e1.z,tree.x,tree.z,(u-.8)/.2,tree.tx,tree.tz)}
 out.phase='walk';out.tag='walk';out.moving=true;out.speed=WALK_SPEED;out.progress=clamp01(u);
 out.prop=null;out.role=role;out.state='walk';out.targetX=tree.tx;out.targetZ=tree.tz;
 out.trunkX=NaN;out.trunkZ=NaN;out.trunkYaw=NaN;out.groundLogs=groundLogs;
 return out;
}

function fellerPose(out,id,day,m,seed,role){
 const P=FELLER_PHASE_MIN,offset=role==='hauler'?FELLER_CYCLE_MIN/2:0;
 const tm=m+offset,slot=Math.floor(tm/FELLER_CYCLE_MIN),t=tm-slot*FELLER_CYCLE_MIN;
 const half=(slot*FELLER_CYCLE_MIN-offset)<720?0:1;
 const blocks=MARKED_PAIRS[(day-1)%100],blkId=blocks[half],trees=BLOCK_TREES[blkId];
 const prevSlot=slot>0?slot-1:0,prevHalf=slot>0?(((prevSlot*FELLER_CYCLE_MIN-offset)<720)?0:1):0;
 const prevBlk=blocks[prevHalf],prevTrees=BLOCK_TREES[prevBlk];
 const prevIdx=slot>0?hashOf(seed,id,day,'tree',prevSlot)%prevTrees.length:(hashOf(seed,id,day,'tree',0)+1)%trees.length;
 const prevTree=prevTrees[prevIdx],currTree=trees[hashOf(seed,id,day,'tree',slot)%trees.length];
 const e0=prevTrees[0],e1=trees[0];
 let acc=P.walkTree;
 if(t<acc){
  const u=t/P.walkTree;
  if(slot>0&&prevHalf!==half){
   if(u<.2)lerpSegment(out,prevTree.x,prevTree.z,e0.x,e0.z,u/.2,e0.tx,e0.tz);
   else if(u<.5)samplePoly(HAUL_ROUTES[prevBlk].toDeck,(u-.2)/.3,out,currTree.tx,currTree.tz);
   else if(u<.8)samplePoly(HAUL_ROUTES[blkId].fromDeck,(u-.5)/.3,out,currTree.tx,currTree.tz);
   else lerpSegment(out,e1.x,e1.z,currTree.x,currTree.z,(u-.8)/.2,currTree.tx,currTree.tz);
  }else{
   lerpSegment(out,prevTree.x,prevTree.z,currTree.x,currTree.z,u,currTree.tx,currTree.tz);
  }
  out.phase='walk';out.tag='walk';out.moving=true;out.speed=WALK_SPEED;out.progress=clamp01(u);
  out.prop='axe';out.role=role;out.state='walk';out.targetX=currTree.tx;out.targetZ=currTree.tz;
  clearTrunk(out);
  return out;
 }
 if(t<(acc+=P.chop)){
  const swingProg=((t-P.walkTree)*SECONDS_PER_MINUTE/SWING_SECONDS)%1;
  setStation(out,role,currTree,'chop',swingProg,'axe');
  clearTrunk(out);
  return out;
 }
 if(t<(acc+=P.buck)){
  const prog=(t-(P.walkTree+P.chop))/P.buck;
  setStation(out,role,currTree,'buck',prog,'axe');
  if(prog<BUCK_CUT_END){
   out.trunkX=currTree.tx;out.trunkZ=currTree.tz;out.trunkYaw=out.yaw+Math.PI/2;out.groundLogs=0;
  }else{
   out.trunkX=NaN;out.trunkZ=NaN;out.trunkYaw=NaN;out.groundLogs=FELLER_LOGS_PER_TRUNK;
  }
  return out;
 }
 // Log 1: bend pick -> carry -> bend drop -> walk back
 if(t<(acc+=P.bendPick1)){setStation(out,role,currTree,'bend',(t-(acc-P.bendPick1))/P.bendPick1,'log');out.trunkX=NaN;out.trunkZ=NaN;out.trunkYaw=NaN;out.groundLogs=2;return out}
 if(t<(acc+=P.carry1))return carryToDeck(out,blkId,currTree,e1,(t-(acc-P.carry1))/P.carry1,role,1);
 if(t<(acc+=P.bendDrop1)){setStation(out,role,S.logDeck,'bend',(t-(acc-P.bendDrop1))/P.bendDrop1,'log');out.trunkX=NaN;out.trunkZ=NaN;out.trunkYaw=NaN;out.groundLogs=1;return out}
 if(t<(acc+=P.walkBack1))return walkFromDeck(out,blkId,currTree,e1,(t-(acc-P.walkBack1))/P.walkBack1,role,1);
 // Log 2: bend pick -> carry -> bend drop -> walk back
 if(t<(acc+=P.bendPick2)){setStation(out,role,currTree,'bend',(t-(acc-P.bendPick2))/P.bendPick2,'log');out.trunkX=NaN;out.trunkZ=NaN;out.trunkYaw=NaN;out.groundLogs=1;return out}
 if(t<(acc+=P.carry2))return carryToDeck(out,blkId,currTree,e1,(t-(acc-P.carry2))/P.carry2,role,0);
 if(t<(acc+=P.bendDrop2)){setStation(out,role,S.logDeck,'bend',(t-(acc-P.bendDrop2))/P.bendDrop2,'log');clearTrunk(out);return out}
 return walkFromDeck(out,blkId,currTree,e1,(t-acc)/P.walkBack2,role,0);
}

function sawyerPose(out,id,day,m,seed){
 clearTrunk(out);
 const offset=(hashOf(seed,id,day,'saw')%150)/100;
 const t=((m+offset)%SAWYER_CYCLE_MIN+SAWYER_CYCLE_MIN)%SAWYER_CYCLE_MIN;
 if(t<.35){setStation(out,'sawyer',S.logDeck,'bend',t/.35,'log');return out}
 if(t<.85){const u=(t-.35)/.5;samplePoly(SAW_W1,u,out,S.logIn.tx,S.logIn.tz);out.phase='carry';out.tag='carry';out.moving=true;out.speed=HAUL_SPEED;out.progress=clamp01(u);out.prop='log';out.role='sawyer';out.state='walk';out.targetX=S.logIn.tx;out.targetZ=S.logIn.tz;return out}
 if(t<1.25){setStation(out,'sawyer',S.logIn,'bend',(t-.85)/.4,'log');return out}
 if(t<1.95){const u=(t-1.25)/.7;samplePoly(SAW_W2,u,out,S.sw.tx,S.sw.tz);out.phase='walk';out.tag='walk';out.moving=true;out.speed=WALK_SPEED;out.progress=clamp01(u);out.prop=null;out.role='sawyer';out.state='walk';out.targetX=S.sw.tx;out.targetZ=S.sw.tz;return out}
 if(t<3.05){setStation(out,'sawyer',S.sw,'saw',(t-1.95)/1.1,null);return out}
 if(t<4.15){const u=(t-3.05)/1.1;samplePoly(SAW_W3,u,out,S.belt.tx,S.belt.tz);out.phase='walk';out.tag='walk';out.moving=true;out.speed=WALK_SPEED;out.progress=clamp01(u);out.prop=null;out.role='sawyer';out.state='walk';out.targetX=S.belt.tx;out.targetZ=S.belt.tz;return out}
 if(t<4.45){setStation(out,'sawyer',S.belt,'bend',(t-4.15)/.3,'planks');return out}
 if(t<4.95){const u=(t-4.45)/.5;samplePoly(SAW_W4,u,out,S.pile.tx,S.pile.tz);out.phase='carry';out.tag='carry';out.moving=true;out.speed=HAUL_SPEED;out.progress=clamp01(u);out.prop='planks';out.role='sawyer';out.state='walk';out.targetX=S.pile.tx;out.targetZ=S.pile.tz;return out}
 if(t<5.25){setStation(out,'sawyer',S.pile,'bend',(t-4.95)/.3,'planks');return out}
 const u=(t-5.25)/.75;samplePoly(SAW_W5,u,out,S.logDeck.tx,S.logDeck.tz);
 out.phase='walk';out.tag='walk';out.moving=true;out.speed=WALK_SPEED;out.progress=clamp01(u);out.prop=null;out.role='sawyer';out.state='walk';out.targetX=S.logDeck.tx;out.targetZ=S.logDeck.tz;
 return out;
}

export function workforcePose(out,person,day=1,minute=720,ctx=null){
 const role=workerRoleOf(person);
 if(!role){
  out.state='hidden';out.moving=false;out.speed=0;out.phase=null;out.tag=null;out.prop=null;out.role=null;out.progress=0;out.yaw=NaN;out.targetX=NaN;out.targetZ=NaN;
  clearTrunk(out);
  return out;
 }
 const d=Number.isFinite(day)?Math.max(1,Math.floor(day)):1;
 const m=wrapMin(minute);
 const seed=Number.isFinite(ctx?.seed)?ctx.seed:MAP.seed;
 const id=typeof person==='string'?person:(person.id||person.post||role);
 if(role==='cutter'||role==='hauler')return fellerPose(out,id,d,m,seed,role);
 return sawyerPose(out,id,d,m,seed);
}
