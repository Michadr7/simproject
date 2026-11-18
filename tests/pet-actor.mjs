// PET3 actor tests: GLB verification, pure stride/turn/crossfade/anchor math, real THREE mixer/clone & zero-alloc update.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../dist/vendor/three.module.js';
import {CLIP_IDS, blendTime} from '../dist/pet-view.js';
import {
 WALK_STRIDE, RUN_STRIDE, RUN_CLIP_DUR, MAX_DT, ARRIVE_DIST, PICK_RADIUS, BACK_OFFSET_Y,
 clampDt, wrapAngle, strideSpeed, turnToward, stepLocomotion, scheduleClip, resolveAnchor,
 createPetActor, clearPetCache
} from '../dist/pet-actor.js';

// 1. Verify dist/assets/pets/cat.glb matches assets-src/cat/cat_v2.glb (header, 24 joints, 12 clips, anchors).
{
 const glbPath=new URL('../dist/assets/pets/cat.glb',import.meta.url);
 const srcPath=new URL('../assets-src/cat/cat_v2.glb',import.meta.url);
 const buf=fs.readFileSync(glbPath);
 const srcBuf=fs.readFileSync(srcPath);
 assert.equal(buf.length,630880,'cat.glb byte size');
 assert.equal(buf.equals(srcBuf),true,'cat.glb matches cat_v2.glb bytes');
 assert.equal(buf.readUInt32LE(0),0x46546C67,'glTF magic');
 assert.equal(buf.readUInt32LE(4),2,'glTF v2');
 assert.equal(buf.readUInt32LE(8),buf.length,'total GLB length');
 const jsonLen=buf.readUInt32LE(12);
 assert.equal(buf.readUInt32LE(16),0x4E4F534A,'JSON chunk');
 const gltf=JSON.parse(buf.subarray(20,20+jsonLen).toString('utf8'));
 assert.equal(gltf.meshes.length,1,'one mesh');
 assert.equal(gltf.meshes[0].primitives.length,1,'one primitive');
 const targets=gltf.meshes[0].extras?.targetNames||gltf.meshes[0].primitives[0]?.extras?.targetNames||[];
 assert(targets.includes('mouth_open'),'mouth_open shape key present');
 assert.equal(gltf.skins.length,1,'one skin');
 assert.equal(gltf.skins[0].joints.length,24,'24 skeleton joints');
 const clipNames=gltf.animations.map(a=>a.name);
 assert.equal(clipNames.length,12,'12 animation clips');
 assert.deepEqual([...clipNames].sort(),[...CLIP_IDS].sort(),'animation names match CLIP_IDS');
 const nodeNames=new Set(gltf.nodes.map(n=>n.name));
 assert(nodeNames.has('anchor_mouth')&&nodeNames.has('anchor_head')&&nodeNames.has('spine2'),'anchor & back nodes present');
 assert.equal(gltf.extensions?.KHR_lights_punctual?.lights?.length||0,0,'no extra lights in GLB');
}

// 2. Pure helpers: dt clamp, stride speed, frame-rate independent turn smoothing, zero-alloc stepLocomotion.
{
 assert.equal(clampDt(-1),0);
 assert.equal(clampDt(NaN),0);
 assert.equal(clampDt(0.016),0.016);
 assert.equal(clampDt(0.5),MAX_DT);

 assert.equal(strideSpeed('walk',1),WALK_STRIDE);
 assert(Math.abs(strideSpeed('walk',1.15)-WALK_STRIDE*1.15)<1e-12);
 assert(Math.abs(strideSpeed('Run',1)-RUN_STRIDE/RUN_CLIP_DUR)<1e-12);
 assert.equal(strideSpeed('idle',1),0);

 // Turn smoothing: shortest arc across +/-PI and frame-rate independence.
 const a1=turnToward(Math.PI-0.1,-Math.PI+0.1,0.1);
 assert(a1>Math.PI-0.1||a1<-Math.PI+0.1,'wraps through +/-PI instead of spinning long way');
 const oneStep=turnToward(0,1.2,0.1);
 const twoSteps=turnToward(turnToward(0,1.2,0.05),1.2,0.05);
 assert(Math.abs(oneStep-twoSteps)<1e-12,'exponential turn smoothing is frame-rate independent');

 // stepLocomotion: stride-matched walk, turn toward travel, idle on arrival, no per-call alloc.
 const out={x:0,z:0,yaw:0,clip:'idle',loop:true,speed:1,arrived:true};
 const s1=stepLocomotion(0,0,0,{x:2,z:0,yaw:0,clip:'walk',loop:true,speed:1},0.1,out);
 assert.equal(s1,out,'reuses provided output object');
 assert(Math.abs(s1.x-WALK_STRIDE*0.1)<1e-12,'walk advances by WALK_STRIDE * dt');
 assert.equal(s1.z,0);
 assert(s1.yaw>0,'turns toward +X travel (yaw PI/2)');
 assert.equal(s1.clip,'walk');
 assert.equal(s1.arrived,false);

 // Arrival within ARRIVE_DIST transitions to idle.
 const s2=stepLocomotion(2-ARRIVE_DIST*0.5,0,Math.PI/2,{x:2,z:0,yaw:0.4,clip:'walk',loop:true,speed:1},0.05,out);
 assert.equal(s2.x,2);assert.equal(s2.z,0);
 assert.equal(s2.clip,'idle');
 assert.equal(s2.arrived,true);
}

// 3. Crossfade scheduling: uses blendTime(from, to), never restarts same clip.
{
 const makeAction=name=>{
  const log={name,resets:0,plays:0,stops:0,fades:[],timeScale:1,weight:1,loop:null,clamp:false,enabled:false};
  return {
   log,
   stopFading(){return this},
   setEffectiveTimeScale(s){log.timeScale=s;return this},
   getEffectiveTimeScale(){return log.timeScale},
   setEffectiveWeight(w){log.weight=w;return this},
   setLoop(m){log.loop=m;return this},
   set clampWhenFinished(v){log.clamp=v},
   set enabled(v){log.enabled=v},
   reset(){log.resets++;return this},
   play(){log.plays++;return this},
   stop(){log.stops++;return this},
   crossFadeTo(next,dur){log.fades.push({to:next.log.name,dur});return this}
  };
 };
 const idle=makeAction('idle'),walk=makeAction('walk'),meow=makeAction('Meow');
 const ctrl={actions:new Map([['idle',idle],['walk',walk],['Meow',meow]]),currentName:'',currentAction:null,LoopOnce:2200,LoopRepeat:2201};
 scheduleClip(ctrl,'idle',true,1);
 assert.equal(idle.log.resets,1);assert.equal(idle.log.plays,1);
 scheduleClip(ctrl,'idle',true,1);
 assert.equal(idle.log.resets,1,'same clip never restarts');
 scheduleClip(ctrl,'walk',true,1.15);
 assert.equal(idle.log.fades.length,1);
 assert.equal(idle.log.fades[0].to,'walk');
 assert.equal(idle.log.fades[0].dur,blendTime('idle','walk'));
 assert.equal(walk.log.timeScale,1.15);
 scheduleClip(ctrl,'walk',true,1.25);
 assert.equal(walk.log.resets,1,'same walk clip updates speed without restart');
 assert.equal(walk.log.timeScale,1.25);
}

// 4. Real THREE scene test: load once, clone-safe SkinnedMesh, shared geometry, no lights, real AnimationMixer, anchors, zero-alloc update.
{
 clearPetCache();
 const buildStubGltf=()=>{
  const scene=new THREE.Group();
  const root=new THREE.Bone();root.name='root';
  const spine2=new THREE.Bone();spine2.name='spine2';spine2.position.set(0,0.23,0);
  const head=new THREE.Bone();head.name='head';head.position.set(0,0.08,0.14);
  const aHead=new THREE.Object3D();aHead.name='anchor_head';aHead.position.set(0,0.04,0.02);
  const aMouth=new THREE.Object3D();aMouth.name='anchor_mouth';aMouth.position.set(0,-0.02,0.06);
  head.add(aHead,aMouth);spine2.add(head);root.add(spine2);

  const geo=new THREE.BoxGeometry(0.1,0.1,0.1);
  const pos=geo.attributes.position;
  const idx=new Uint16Array(pos.count*4),wts=new Float32Array(pos.count*4);
  for(let i=0;i<pos.count;i++)wts[i*4]=1;
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(idx,4));
  geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(wts,4));
  const mat=new THREE.MeshStandardMaterial({color:0xcc8844});
  const mesh=new THREE.SkinnedMesh(geo,mat);mesh.name='Cat';
  const skel=new THREE.Skeleton([root,spine2,head]);
  mesh.add(root);mesh.bind(skel);
  const extraLight=new THREE.PointLight(0xffffff,1);
  scene.add(mesh,extraLight);

  const track=(name,times,vals)=>new THREE.QuaternionKeyframeTrack(name+'.quaternion',times,vals);
  const q0=[0,0,0,1,0,0,0,1];
  const animations=[
   new THREE.AnimationClip('idle',3,[track('spine2',[0,3],q0)]),
   new THREE.AnimationClip('walk',1,[track('spine2',[0,1],q0)]),
   new THREE.AnimationClip('eat',2,[track('head',[0,2],q0)]),
   new THREE.AnimationClip('Meow',1,[track('head',[0,1],q0)])
  ];
  return {scene,animations};
 };

 let loads=0,spying=false,allocs=0;
 const spyTHREE={
  ...THREE,
  Vector3:function(...a){if(spying)allocs++;return new THREE.Vector3(...a)},
  Quaternion:function(...a){if(spying)allocs++;return new THREE.Quaternion(...a)},
  Matrix4:function(...a){if(spying)allocs++;return new THREE.Matrix4(...a)}
 };
 class FakeLoader{
  async loadAsync(){loads++;return buildStubGltf()}
 }
 const a1=createPetActor({THREE:spyTHREE,GLTFLoader:FakeLoader,url:'mem://cat.glb'});
 const a2=createPetActor({THREE:spyTHREE,GLTFLoader:FakeLoader,url:'mem://cat.glb'});
 await Promise.all([a1.load(),a2.load()]);
 assert.equal(loads,1,'GLB loaded once and shared across actors');

 const meshesOf=g=>{const out=[];g.traverse(o=>{if(o.isSkinnedMesh)out.push(o)});return out};
 const lightsOf=g=>{const out=[];g.traverse(o=>{if(o.isLight)out.push(o)});return out};
 const m1=meshesOf(a1.group),m2=meshesOf(a2.group);
 assert.equal(m1.length,1);assert.equal(m2.length,1);
 assert.equal(m1[0].geometry,m2[0].geometry,'geometry shared across clones');
 assert.equal(m1[0].material,m2[0].material,'material shared across clones');
 assert.notEqual(m1[0].skeleton,m2[0].skeleton,'skeleton cloned per actor');
 assert.equal(m1[0].frustumCulled,false);
 assert.equal(lightsOf(a1.group).length,0,'no extra lights');

 assert.equal(a1.pickRadius,PICK_RADIUS);
 a1.visible=false;assert.equal(a1.group.visible,false);
 a1.visible=true;assert.equal(a1.group.visible,true);

 a1.setPet({name:'Milo',homeId:'studio',clip:'idle',x:0,z:0,yaw:0});
 // Walk along +Z (0.5 m): check stride speed, dt clamp, arrival idle, and zero allocation in steady update.
 const r1=a1.update(0.5,{x:0,z:0.5,yaw:0,clip:'walk',loop:true,speed:1});
 assert(Math.abs(a1.group.position.z-WALK_STRIDE*MAX_DT)<1e-9,'dt clamped to MAX_DT (0.1 s)');
 assert.equal(r1.clip,'walk');
 for(let i=0;i<30;i++)a1.update(0.1,{x:0,z:0.5,yaw:0,clip:'walk',loop:true,speed:1});
 assert(Math.abs(a1.group.position.z-0.5)<1e-6,'arrived at waypoint');
 assert.equal(a1.update(0.016,{x:0,z:0.5,yaw:0,clip:'walk',loop:true,speed:1}).clip,'idle','idles on arrival');

 // Verify world anchor points reflect cat position and bone offsets.
 const mouth=a1.anchorPoint('mouth').clone();
 const head=a1.anchorPoint('head').clone();
 const back=a1.anchorPoint('back').clone();
 assert(Math.abs(mouth.z-(0.5+0.14+0.06))<1e-6,'anchor_mouth world Z');
 assert(Math.abs(head.y-(0.23+0.08+0.04))<1e-6,'anchor_head world Y');
 assert(Math.abs(back.y-(0.23+BACK_OFFSET_Y))<1e-6,'back anchor world Y');

 // Steady-state zero allocation check (both idle and walking): stepOut & anchorOut reused, 0 allocations.
 spying=true;allocs=0;
 try{
  const uA=a1.update(0.016,{x:0,z:0.5,yaw:0,clip:'idle',loop:true,speed:1});
  const uB=a1.update(0.016,{x:0,z:0.5,yaw:0,clip:'idle',loop:true,speed:1});
  const uC=a1.update(0.016,{x:2,z:2,yaw:0,clip:'walk',loop:true,speed:1});
  const uD=a1.update(0.016,{x:2,z:2,yaw:0,clip:'walk',loop:true,speed:1});
  assert.equal(uA,uB,'idle update reuses result object');
  assert.equal(uC,uD,'walk update reuses result object');
  const pHead1=a1.anchorPoint('head'),pHead2=a1.anchorPoint('head');
  assert.equal(pHead1,pHead2,'anchorPoint reuses vector');
  assert.equal(allocs,0,'zero THREE math allocations per update/anchorPoint');
 }finally{
  spying=false;
 }

 a1.dispose();
 // Disposing a1 must not break a2.
 a2.update(0.05,{x:1,z:0,yaw:0,clip:'walk',loop:true,speed:1});
 assert(a2.group.position.x>0);
 a2.dispose();
}

// 5. Module hygiene: under 220 lines, short header comment, no BOM.
{
 const src=fs.readFileSync(new URL('../dist/pet-actor.js',import.meta.url),'utf8');
 assert.equal(src.charCodeAt(0)===0xFEFF,false,'no UTF-8 BOM');
 const lines=src.split(/\r?\n/);
 assert(lines.length<220,`pet-actor.js line count (${lines.length}) < 220`);
 assert(lines[0].startsWith('//')&&lines[0].length<100,'header comment under 100 chars');
}

console.log('PASS pet-actor: GLB verified (630880B, 24 joints, 12 clips), stride/turn/crossfade/anchors, shared clone & zero-alloc update.');
