// W4 crew timber in the packaged game: while a Ridgeline feller bucks, the trunk lies at the pose's trunkX/trunkZ in the player's ground-trunks mesh, then the two cut logs
// lie there in world.js's ground-logs mesh (one stays while the first is carried to the deck, none after the second), drawn from npc-crowd.js forEachWork (no drawn() call,
// no new mesh, so no new draw call); everything is a function of the clock (workforce-pose.js), so a co-op guest computes the same spots.
import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {markedBlocks} from '../dist/forest.js';
import {MAP} from '../dist/map-definition.js';
import {townPopulation} from '../dist/population.js';
import {workforcePose,fellerSlot,HAUL_WAYPOINTS} from '../dist/workforce-pose.js';
import {readFileSync} from 'node:fs';import {readFile,writeFile} from 'node:fs/promises';import {join} from 'node:path';import * as THREE from '../dist/vendor/three.module.js';
// The trunk model's real geometry (as tests/timber-game.mjs: Node cannot decode the GLB's texture), handed to game.js through its load hook in the temp release copy only.
const glbGeometry=name=>{const b=readFileSync('dist/assets/timber/'+name+'.glb'),len=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+len).toString()),bin=b.subarray(28+len),view=i=>{const a=j.accessors[i],v=j.bufferViews[a.bufferView],off=(v.byteOffset||0)+(a.byteOffset||0),n=a.count*({SCALAR:1,VEC3:3,VEC2:2}[a.type]),T=a.componentType===5126?Float32Array:a.componentType===5125?Uint32Array:Uint16Array;return new T(bin.buffer.slice(bin.byteOffset+off,bin.byteOffset+off+n*T.BYTES_PER_ELEMENT))};
 const pr=j.meshes[0].primitives[0],g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(view(pr.attributes.POSITION),3));g.setIndex(new THREE.BufferAttribute(view(pr.indices),1));return g};
globalThis.__timberParts=Object.fromEntries(['trunk','logs2','slab'].map(n=>[n,{geometry:glbGeometry(n),material:new THREE.MeshStandardMaterial()}]));
const HOOK="if(globalThis.document?.baseURI)Promise.all(['trunk','logs2','slab']";

// the source: the frame never calls drawn() (it allocates); the accessor is used instead
{const game=readFileSync('dist/game.js','utf8'),crowd=readFileSync('dist/npc-crowd.js','utf8');assert(!/npcCrowd\.drawn\(/.test(game),'game.js never calls npcCrowd.drawn()');assert(/npcCrowd\.forEachWork\(crewVisit\)/.test(game));
 const fe=crowd.slice(crowd.indexOf('forEachWork(fn)'),crowd.indexOf('\n',crowd.indexOf('forEachWork(fn)')));assert(!/=>|\[|new /.test(fe),'forEachWork makes no closures, arrays or objects: '+fe)}

const NEAR=['C1','D1','C2','D2'],DAY=[...Array(60).keys()].map(i=>i+3).find(d=>NEAR.includes(markedBlocks(d)[0])),SPOT=HAUL_WAYPOINTS.hub,cutter=townPopulation().people.find(q=>q.post==='ridgeline-fellers#1'),hauler=townPopulation().people.find(q=>q.post==='ridgeline-fellers#2');
const poseAt=m=>workforcePose({},cutter,DAY,m,{seed:MAP.seed});
// minutes (from 07:00) where the cutter is: bucking (trunk down), carrying the first log (one log left), carrying the second (none left)
// the hauler (the other feller) must have nothing on the ground then, so the counts below are the cutter's alone (crew-speed fix: the slots are as long as their walks, so the two drift apart)
const haulerClear=m=>{const h=workforcePose({},hauler,DAY,m,{seed:MAP.seed});return Number.isNaN(h.trunkX)&&!h.groundLogs};
const find=(test,from=420)=>{for(let m=from;m<1000;m+=.02){const p=poseAt(m);if(test(p)&&haulerClear(m-1)&&haulerClear(m-.5)&&haulerClear(m)&&haulerClear(m+.5))return m}throw new Error('no such minute')};
const slotOf=m=>fellerSlot(cutter,DAY,m,{seed:MAP.seed}).start;let mBuck=420,mCarry1;
for(;;mBuck+=1){mBuck=find(p=>p.phase==='buck'&&p.progress>.15&&p.progress<.25,mBuck);mCarry1=find(p=>p.phase==='carry'&&p.groundLogs===1&&p.progress>.3&&p.progress<.4,mBuck);if(slotOf(mCarry1)===slotOf(mBuck))break} // the first log carried from the same trunk
const mCarry2=find(p=>p.groundLogs===0&&Number.isNaN(p.trunkX)&&p.phase!=='chop',mCarry1+1); // the second log gone (carried, dropped or walking back for the next tree)
const trunkPose=poseAt(mBuck),rot=trunkPose.trunkYaw-Math.PI/2;

const OWN={id:9001,x:SPOT.x+2,z:SPOT.z,rot:0,t:DAY*1440+400}; // one log of the player's own, put down earlier (drawn first)
const g=await bootGame({position:{x:SPOT.x,z:SPOT.z},progress:{logs:[OWN],nextLogId:9002},editRelease:async dir=>{const f=join(dir,'game.js'),src=await readFile(f,'utf8');assert(src.includes(HOOK));await writeFile(f,src.replace(HOOK,'if(globalThis.__timberParts){Object.assign(TIMBER,globalThis.__timberParts);timberLoaded()}else '+HOOK))}});
try{
 const {GameState,pump,scene}=g,p=()=>GameState.progress,obj=n=>scene().getObjectByName(n),M=new THREE.Matrix4(),P=new THREE.Vector3(),Q=new THREE.Quaternion(),S=new THREE.Vector3();
 const instances=mesh=>{const out=[];for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,M);M.decompose(P,Q,S);out.push({x:P.x,z:P.z,yaw:new THREE.Euler().setFromQuaternion(Q,'YXZ').y})}return out};
 const near=(list,x,z,yaw)=>list.some(o=>Math.hypot(o.x-x,o.z-z)<.02&&Math.abs(Math.atan2(Math.sin(o.yaw-yaw),Math.cos(o.yaw-yaw)))<.02);
 const at=minute=>{for(let i=0;i<4000&&!globalThis.__npcRoutes;i++)pump(.05);GameState.progress={...p(),housing:{...p().housing,day:DAY},routine:{...p().routine,minutes:minute-.3}};GameState.me.position.x=SPOT.x;GameState.me.position.z=SPOT.z;pump(.6)};
 const drawCalls=()=>{let n=0;scene().traverse(o=>{if(!(o.isMesh||o.isPoints))return;for(let x=o;x;x=x.parent)if(!x.visible)return;if(o.isInstancedMesh&&!o.count)return;n++});return n}; // a proxy: visible meshes with something to draw (the stub renderer counts nothing)
 const meshes=()=>{let n=0;scene().traverse(o=>{if((o.isMesh||o.isPoints)&&!/^(worker-|axe-)/.test(o.name))n++});return n}; // the crew's hand props (an axe, a log, boards) come and go with what each worker holds (calm crew timing, 2026-11-18): not counted
 at(mCarry2);const before={calls:drawCalls(),meshes:meshes()},logs0=obj('ground-logs').count;
 assert.equal(obj('ground-trunks').count,0,'no trunk while the cutter carries the second log');assert.equal(logs0,1,'only the player\'s own log');
 // bucking: the trunk at the pose
 at(mBuck);assert.equal(poseAt(p().routine.minutes).phase,'buck','still bucking');
 const trunks=instances(obj('ground-trunks'));assert(near(trunks,trunkPose.trunkX,trunkPose.trunkZ,rot),'the crew trunk lies at trunkX/trunkZ across the feller: '+JSON.stringify(trunks)+' want '+[trunkPose.trunkX,trunkPose.trunkZ,rot]);
 const during={calls:drawCalls(),meshes:meshes()};assert.equal(during.meshes,before.meshes,'no new mesh for the crew trunk');
 {const names=[];scene().traverse(o=>{if(o.name==='ground-trunks'||o.name==='ground-logs')names.push(o.name)});assert.deepEqual(names.sort(),['ground-logs','ground-trunks'],'the player\'s two meshes, one each')}
 // the first log carried away: one log still lies where the trunk was (the spot worked out from the clock), along its axis
 at(mCarry1);{const now=poseAt(p().routine.minutes);assert(now.phase==='carry'&&now.groundLogs===1&&Number.isNaN(now.trunkX))}
 assert.equal(obj('ground-trunks').count,0,'the trunk is gone once it is cut');
 const one=instances(obj('ground-logs'));assert.equal(one.length,2,'the player\'s log, then one crew log left');assert(Math.hypot(one[0].x-OWN.x,one[0].z-OWN.z)<.01,'the player\'s own log first');assert(near(one.slice(1),trunkPose.trunkX+Math.cos(rot)*.6,trunkPose.trunkZ-Math.sin(rot)*.6,rot),'it lies where the trunk was: '+JSON.stringify(one));
 // the second carried: nothing left
 at(mCarry2);assert.equal(obj('ground-trunks').count,0);assert.equal(obj('ground-logs').count,1,'both crew logs gone to the deck (the player\'s stays)');
 console.log(`crew-trunk draw-call proxy at the hub (${SPOT.x}, ${SPOT.z}), day ${DAY}: ${before.calls} before the trunk is down, ${during.calls} while it lies there (meshes ${before.meshes} -> ${during.meshes})`);
}finally{await g.done()}
console.log('PASS crew-trunk.mjs: day '+DAY+': while the cutter bucks, the crew trunk lies at the pose\'s trunkX/trunkZ (across the feller) in ground-trunks; the first log carried away leaves one log where the trunk was, after the player\'s own logs in ground-logs; none after the second; no new mesh; the frame uses npcCrowd.forEachWork, never drawn().');
