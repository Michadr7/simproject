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
export const CUTTER_CYCLE_MIN=5,HAULER_CYCLE_MIN=8;
export const FELLER_LOGS_PER_TRUNK=2,FELLER_TRUNKS_PER_DAY=2,BUCK_CUT_END=.8;
// Owner eye-check 0.35.20: the crew walked at up to 138 m/s because every walk and carry had a fixed number of game minutes. Now only the station phases
// have fixed minutes; a walk lasts its route length at WALK_SPEED and a carry at HAUL_SPEED (game minutes = metres / speed * GAME_MINUTES_PER_SECOND),
// so a feller's slot (walk to a tree, chop, buck, two carries to the log deck and back) is as long as its routes need (about 40-200 game minutes).
// Calm crew (owner 2026-11-18, prompts/opus-timber-storage.md): the game clock runs GAME_MINUTES_PER_SECOND = 0.5 (2 real seconds a game minute), so a tree's chop + buck
// (30 game minutes) takes the visible feller a real minute, each bend 3 s. Only ONE feller works at a time: the cutter in the morning, the hauler in the afternoon
// (FELLER_CHAIN); outside its turn a feller stands at rest (phase null, tag 'rest'). The visible crew makes no stock: workforce-tick.js is the economy.
export const FELLER_PHASE_MIN=Object.freeze({chop:18,buck:12,bend:1.5});
export const FELLER_CHAIN=Object.freeze({cutter:Object.freeze([360,720]),hauler:Object.freeze([720,1080])}); // [first slot start, last slot end] in game minutes
export const FELLER_CHAIN_START=Object.freeze({cutter:FELLER_CHAIN.cutter[0],hauler:FELLER_CHAIN.hauler[0]});
export const SWING_SECONDS=.74,CHOP_BEAT_SECONDS=1.6; // one swing, then a breath before the next
export const swingAt=sec=>{const b=sec>0?sec%CHOP_BEAT_SECONDS:0;return b<SWING_SECONDS?b/SWING_SECONDS:0}; // the swing's progress at sec real seconds into a chop (0 while resting between swings)
export const SAWYER_PHASE_MIN=Object.freeze({pick:1.5,feed:2,saw:12,belt:1.5,hut:1.5}); // the sawyer's station minutes (a log fed, sawn, the boards carried into the lumber hut)
export const HAUL_SPEED=+(WALK_SPEED*LOG_CARRY_FACTOR).toFixed(4);
export const SECONDS_PER_MINUTE=1/GAME_MINUTES_PER_SECOND;
export const minutesFor=(metres,speed)=>metres/speed*GAME_MINUTES_PER_SECOND; // game minutes to cover `metres` at `speed` m/s

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
 yard:pt(114.0,-273.6),
 hut:pt(124.0,-275.2,124.0,-278.0) // the lumber hut's south end: the boards go in here (owner 2026-11-18: the sawmill deck is no store)
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
const SAW_W4=buildPoly([S.belt,S.se,S.yard,S.hut]);
const SAW_W5=buildPoly([S.hut,S.yard,S.ep,S.ne,S.logDeck]);
// The sawyer's loop: station minutes fixed, the five walks as long as their routes need. SAW_T: the minute each step ends.
const SP=SAWYER_PHASE_MIN,SAW_T=(()=>{let t=0;const end=d=>(t+=d);return Object.freeze({pick:end(SP.pick),w1:end(minutesFor(SAW_W1.length,HAUL_SPEED)),feed:end(SP.feed),w2:end(minutesFor(SAW_W2.length,WALK_SPEED)),
 saw:end(SP.saw),w3:end(minutesFor(SAW_W3.length,WALK_SPEED)),belt:end(SP.belt),w4:end(minutesFor(SAW_W4.length,HAUL_SPEED)),pile:end(SP.hut),w5:end(minutesFor(SAW_W5.length,WALK_SPEED))})})();
export const SAWYER_CYCLE_MIN=SAW_T.w5;

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
// Off duty inside the work hours (the other feller's turn): standing still where the last slot ended (or where the first will start), facing its tree.
function restAt(out,role,at){out.x=at.x;out.z=at.z;out.yaw=Number.isFinite(at.tx)?Math.atan2(at.tx-at.x,at.tz-at.z):0;out.phase=null;out.tag='rest';out.moving=false;out.speed=0;out.progress=0;out.prop=null;out.role=role;out.state='stand';out.targetX=NaN;out.targetZ=NaN;clearTrunk(out);return out}

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

const dist=(a,b)=>Math.hypot(b.x-a.x,b.z-a.z);
// A tree's carry to the log deck: the straight bit to the block's first tree (where the route starts), then the route. The walk back is the same path reversed.
const haulLength=(blkId,tree)=>{const e1=BLOCK_TREES[blkId][0];return (tree===e1?0:dist(tree,e1))+HAUL_ROUTES[blkId].toDeck.length};
function carryToDeck(out,blkId,tree,e1,u,len,role,groundLogs){
 const a=tree===e1?0:dist(tree,e1),r=HAUL_ROUTES[blkId].toDeck,d=clamp01(u)*len;
 if(d<a)lerpSegment(out,tree.x,tree.z,e1.x,e1.z,d/a,S.logDeck.x,S.logDeck.z);
 else samplePoly(r,r.length>0?(d-a)/r.length:1,out,S.logDeck.tx,S.logDeck.tz);
 out.phase='carry';out.tag='carry';out.moving=true;out.speed=HAUL_SPEED;out.progress=clamp01(u);
 out.prop='log';out.role=role;out.state='walk';out.targetX=S.logDeck.tx;out.targetZ=S.logDeck.tz;
 out.trunkX=NaN;out.trunkZ=NaN;out.trunkYaw=NaN;out.groundLogs=groundLogs;
 return out;
}
function walkFromDeck(out,blkId,tree,e1,u,len,role,groundLogs){
 const r=HAUL_ROUTES[blkId].fromDeck,d=clamp01(u)*len;
 if(d<r.length||tree===e1)samplePoly(r,r.length>0?d/r.length:1,out,tree.tx,tree.tz);
 else lerpSegment(out,e1.x,e1.z,tree.x,tree.z,(d-r.length)/(len-r.length),tree.tx,tree.tz);
 out.phase='walk';out.tag='walk';out.moving=true;out.speed=WALK_SPEED;out.progress=clamp01(u);
 out.prop=null;out.role=role;out.state='walk';out.targetX=tree.tx;out.targetZ=tree.tz;
 out.trunkX=NaN;out.trunkZ=NaN;out.trunkYaw=NaN;out.groundLogs=groundLogs;
 return out;
}
// The walk to the slot's tree: straight within a block; at the midday block change back along the old block's route to the deck and out along the new one.
function walkToTree(out,L){
 const {prev,curr,prevBlk,blk}=L,d=L.walkLen*clamp01(L.u);
 if(!L.change){lerpSegment(out,prev.x,prev.z,curr.x,curr.z,L.walkLen>0?d/L.walkLen:1,curr.tx,curr.tz);return}
 const e0=BLOCK_TREES[prevBlk][0],e1=BLOCK_TREES[blk][0],a=dist(prev,e0),r0=HAUL_ROUTES[prevBlk].toDeck,r1=HAUL_ROUTES[blk].fromDeck;
 if(d<a)lerpSegment(out,prev.x,prev.z,e0.x,e0.z,d/a,curr.tx,curr.tz);
 else if(d<a+r0.length)samplePoly(r0,(d-a)/r0.length,out,curr.tx,curr.tz);
 else if(d<a+r0.length+r1.length)samplePoly(r1,(d-a-r0.length)/r1.length,out,curr.tx,curr.tz);
 else{const b=L.walkLen-a-r0.length-r1.length;if(b>0)lerpSegment(out,e1.x,e1.z,curr.x,curr.z,(d-a-r0.length-r1.length)/b,curr.tx,curr.tz);else samplePoly(r1,1,out,curr.tx,curr.tz)}
}
// Finds the slot holding game minute m: slots run back to back from FELLER_CHAIN_START[role], each as long as its walks need. Writes into L (a
// module-private scratch, so nothing is allocated per call; the result is a pure function of the arguments) and returns it.
const MAX_SLOTS=64,P=FELLER_PHASE_MIN,FIXED_MIN=P.chop+P.buck+4*P.bend;
const SLOT={k:0,start:0,end:0,u:0,blk:'',prevBlk:'',prev:null,curr:null,change:false,walkLen:0,haulLen:0,walk:0,carry:0,back:0,rest:null};
function locateSlot(id,day,m,seed,role){
 const L=SLOT,blocks=MARKED_PAIRS[(day-1)%100],CH=FELLER_CHAIN[role],first=CH[0],last=CH[1];
 let start=first,prevBlk=blocks[start<720?0:1],prev=BLOCK_TREES[prevBlk][0]; // a feller's turn starts at its block's entry tree (where it rests before its turn)
 L.rest=null;if(m<start){L.rest=prev;L.start=L.end=NaN;return L}
 for(let k=0;;k++){
  const blk=blocks[start<720?0:1],trees=BLOCK_TREES[blk],curr=trees[hashOf(seed,id,day,'tree',k)%trees.length],change=blk!==prevBlk;
  const walkLen=change?dist(prev,BLOCK_TREES[prevBlk][0])+HAUL_ROUTES[prevBlk].toDeck.length+HAUL_ROUTES[blk].fromDeck.length+dist(trees[0],curr):dist(prev,curr);
  const haulLen=haulLength(blk,curr),walk=minutesFor(walkLen,WALK_SPEED),carry=minutesFor(haulLen,HAUL_SPEED),back=minutesFor(haulLen,WALK_SPEED);
  const end=start+walk+FIXED_MIN+2*(carry+back);
  if(k>0&&end>last){L.rest=prev;L.start=L.end=NaN;return L} // the turn is over: the next slot would run past it
  if(m<end||k>=MAX_SLOTS){L.k=k;L.start=start;L.end=end;L.blk=blk;L.prevBlk=prevBlk;L.prev=prev;L.curr=curr;L.change=change;L.walkLen=walkLen;L.haulLen=haulLen;L.walk=walk;L.carry=carry;L.back=back;return L}
  start=end;prevBlk=blk;prev=curr;
 }
}
function fellerPose(out,id,day,m,seed,role){
 const L=locateSlot(id,day,m,seed,role);if(L.rest)return restAt(out,role,L.rest);
 const t=Math.max(0,m-L.start),{blk,curr}=L,e1=BLOCK_TREES[blk][0];
 let acc=L.walk;
 if(t<acc){
  L.u=t/L.walk;walkToTree(out,L);
  out.phase='walk';out.tag='walk';out.moving=true;out.speed=WALK_SPEED;out.progress=clamp01(L.u);
  out.prop='axe';out.role=role;out.state='walk';out.targetX=curr.tx;out.targetZ=curr.tz;
  clearTrunk(out);
  return out;
 }
 if(t<(acc+=P.chop)){
  const swingProg=swingAt((t-L.walk)*SECONDS_PER_MINUTE);
  setStation(out,role,curr,'chop',swingProg,'axe');
  clearTrunk(out);
  return out;
 }
 if(t<(acc+=P.buck)){
  const prog=(t-(acc-P.buck))/P.buck;
  setStation(out,role,curr,'buck',prog,'axe');
  if(prog<BUCK_CUT_END){
   out.trunkX=curr.tx;out.trunkZ=curr.tz;out.trunkYaw=out.yaw+Math.PI/2;out.groundLogs=0;
  }else{
   out.trunkX=NaN;out.trunkZ=NaN;out.trunkYaw=NaN;out.groundLogs=FELLER_LOGS_PER_TRUNK;
  }
  return out;
 }
 // Log 1: bend pick -> carry -> bend drop -> walk back
 if(t<(acc+=P.bend)){setStation(out,role,curr,'bend',(t-(acc-P.bend))/P.bend,'log');out.trunkX=NaN;out.trunkZ=NaN;out.trunkYaw=NaN;out.groundLogs=2;return out}
 if(t<(acc+=L.carry))return carryToDeck(out,blk,curr,e1,(t-(acc-L.carry))/L.carry,L.haulLen,role,1);
 if(t<(acc+=P.bend)){setStation(out,role,S.logDeck,'bend',(t-(acc-P.bend))/P.bend,'log');out.trunkX=NaN;out.trunkZ=NaN;out.trunkYaw=NaN;out.groundLogs=1;return out}
 if(t<(acc+=L.back))return walkFromDeck(out,blk,curr,e1,(t-(acc-L.back))/L.back,L.haulLen,role,1);
 // Log 2: bend pick -> carry -> bend drop -> walk back
 if(t<(acc+=P.bend)){setStation(out,role,curr,'bend',(t-(acc-P.bend))/P.bend,'log');out.trunkX=NaN;out.trunkZ=NaN;out.trunkYaw=NaN;out.groundLogs=1;return out}
 if(t<(acc+=L.carry))return carryToDeck(out,blk,curr,e1,(t-(acc-L.carry))/L.carry,L.haulLen,role,0);
 if(t<(acc+=P.bend)){setStation(out,role,S.logDeck,'bend',(t-(acc-P.bend))/P.bend,'log');clearTrunk(out);return out}
 return walkFromDeck(out,blk,curr,e1,L.back>0?(t-acc)/L.back:1,L.haulLen,role,0);
}

function sawyerPose(out,id,day,m,seed){
 clearTrunk(out);
 const offset=(hashOf(seed,id,day,'saw')%150)/100,T=SAW_T,C=SAWYER_CYCLE_MIN;
 const t=((m+offset)%C+C)%C;
 if(t<T.pick){setStation(out,'sawyer',S.logDeck,'bend',t/T.pick,'log');return out}
 if(t<T.w1){const u=(t-T.pick)/(T.w1-T.pick);samplePoly(SAW_W1,u,out,S.logIn.tx,S.logIn.tz);out.phase='carry';out.tag='carry';out.moving=true;out.speed=HAUL_SPEED;out.progress=clamp01(u);out.prop='log';out.role='sawyer';out.state='walk';out.targetX=S.logIn.tx;out.targetZ=S.logIn.tz;return out}
 if(t<T.feed){setStation(out,'sawyer',S.logIn,'bend',(t-T.w1)/(T.feed-T.w1),'log');return out}
 if(t<T.w2){const u=(t-T.feed)/(T.w2-T.feed);samplePoly(SAW_W2,u,out,S.sw.tx,S.sw.tz);out.phase='walk';out.tag='walk';out.moving=true;out.speed=WALK_SPEED;out.progress=clamp01(u);out.prop=null;out.role='sawyer';out.state='walk';out.targetX=S.sw.tx;out.targetZ=S.sw.tz;return out}
 if(t<T.saw){setStation(out,'sawyer',S.sw,'saw',(t-T.w2)/(T.saw-T.w2),null);return out}
 if(t<T.w3){const u=(t-T.saw)/(T.w3-T.saw);samplePoly(SAW_W3,u,out,S.belt.tx,S.belt.tz);out.phase='walk';out.tag='walk';out.moving=true;out.speed=WALK_SPEED;out.progress=clamp01(u);out.prop=null;out.role='sawyer';out.state='walk';out.targetX=S.belt.tx;out.targetZ=S.belt.tz;return out}
 if(t<T.belt){setStation(out,'sawyer',S.belt,'bend',(t-T.w3)/(T.belt-T.w3),'planks');return out}
 if(t<T.w4){const u=(t-T.belt)/(T.w4-T.belt);samplePoly(SAW_W4,u,out,S.hut.tx,S.hut.tz);out.phase='carry';out.tag='carry';out.moving=true;out.speed=HAUL_SPEED;out.progress=clamp01(u);out.prop='planks';out.role='sawyer';out.state='walk';out.targetX=S.hut.tx;out.targetZ=S.hut.tz;return out}
 if(t<T.pile){setStation(out,'sawyer',S.hut,'bend',(t-T.w4)/(T.pile-T.w4),'planks');return out}
 const u=(t-T.pile)/(T.w5-T.pile);samplePoly(SAW_W5,u,out,S.logDeck.tx,S.logDeck.tz);
 out.phase='walk';out.tag='walk';out.moving=true;out.speed=WALK_SPEED;out.progress=clamp01(u);out.prop=null;out.role='sawyer';out.state='walk';out.targetX=S.logDeck.tx;out.targetZ=S.logDeck.tz;
 return out;
}

// W4 crew timber (npc-crowd.js forEachWork): the game minute in the middle of the first log's pick-up in the feller's slot holding `minute` (the second log lies
// where that pose stands until it is picked up). NaN for anyone who is not a feller. Pure; allocates nothing.
export function fellerPickMinute(person,day=1,minute=720,ctx=null){
 const role=workerRoleOf(person);if(role!=='cutter'&&role!=='hauler')return NaN;
 const d=Number.isFinite(day)?Math.max(1,Math.floor(day)):1,seed=Number.isFinite(ctx?.seed)?ctx.seed:MAP.seed,id=typeof person==='string'?person:(person.id||person.post||role);
 const L=locateSlot(id,d,wrapMin(minute),seed,role);return L.rest?NaN:L.start+L.walk+P.chop+P.buck+P.bend/2;
}
// The start and end minute of the feller's slot holding `minute` (tests and debugging): fills out.start/out.end (NaN while the feller rests) and returns out.
export function fellerSlot(person,day=1,minute=720,ctx=null,out={start:NaN,end:NaN}){
 const role=workerRoleOf(person);if(role!=='cutter'&&role!=='hauler'){out.start=out.end=NaN;return out}
 const d=Number.isFinite(day)?Math.max(1,Math.floor(day)):1,seed=Number.isFinite(ctx?.seed)?ctx.seed:MAP.seed,id=typeof person==='string'?person:(person.id||person.post||role);
 const L=locateSlot(id,d,wrapMin(minute),seed,role);out.start=L.start;out.end=L.end;return out;
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
