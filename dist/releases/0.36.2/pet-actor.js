// Three.js cat actor: GLB loader, stride-matched walk, crossfade, anchors.
import * as DEFAULT_THREE from './vendor/three.module.js';
import {GLTFLoader as DEFAULT_LOADER} from './vendor/GLTFLoader.js';
import {CLIP_LOOP, CAT_RADIUS, blendTime, applyPetSnapshot} from './pet-view.js';

export const DEFAULT_CAT_URL='assets/pets/cat.glb';
// Mean stance paw travel per 1.0 s cycle in cat_v2.glb: front 0.2428 m, hind 0.2090 m -> 0.226 m/cycle.
export const WALK_CLIP_DUR=1.0;
export const WALK_STRIDE=0.226;
export const RUN_CLIP_DUR=0.667;
export const RUN_STRIDE=2.4;
export const MAX_DT=0.1;
export const ARRIVE_DIST=0.03;
export const TURN_RATE=10;
export const PICK_RADIUS=CAT_RADIUS;
export const BACK_OFFSET_Y=0.07;

const FALLBACK_ANCHORS=Object.freeze({mouth:[0,0.26,0.21],head:[0,0.34,0.16],back:[0,0.28,0]});
const GLB_CACHE=new Map();
const SCRATCH_STEP={x:0,z:0,yaw:0,clip:'idle',loop:true,speed:1,arrived:true};

export const clearPetCache=()=>GLB_CACHE.clear();
export const clampDt=dt=>(Number.isFinite(dt)&&dt>0?Math.min(dt,MAX_DT):0);
export const wrapAngle=a=>{
 const tau=Math.PI*2;
 let r=((a+Math.PI)%tau+tau)%tau-Math.PI;
 return r===-Math.PI&&a>0?Math.PI:r;
};
export function strideSpeed(clip,clipSpeed=1){
 const s=Number.isFinite(clipSpeed)&&clipSpeed>0?clipSpeed:1;
 if(clip==='walk')return (WALK_STRIDE/WALK_CLIP_DUR)*s;
 if(clip==='Run')return (RUN_STRIDE/RUN_CLIP_DUR)*s;
 return 0;
}
export function turnToward(current,target,dt,rate=TURN_RATE){
 if(!Number.isFinite(target))return current;
 if(!Number.isFinite(dt)||dt<=0)return wrapAngle(current);
 return wrapAngle(current+wrapAngle(target-current)*(1-Math.exp(-rate*dt)));
}
export function stepLocomotion(curX,curZ,curYaw,state,dt,out=SCRATCH_STEP){
 const rawClip=state?.clip||'idle';
 const speed=Number.isFinite(state?.speed)&&state.speed>0?state.speed:1;
 const loop=state?.loop!==undefined?!!state.loop:(CLIP_LOOP[rawClip]??true);
 const tx=Number.isFinite(state?.x)?state.x:curX;
 const tz=Number.isFinite(state?.z)?state.z:curZ;
 const dx=tx-curX,dz=tz-curZ,dist=Math.hypot(dx,dz);
 if(rawClip==='walk'||rawClip==='Run'){
  if(dist>ARRIVE_DIST){
   const travelYaw=Math.atan2(dx,dz);
   const step=Math.min(dist,strideSpeed(rawClip,speed)*dt);
   out.yaw=turnToward(curYaw,travelYaw,dt);
   if(dist-step<=ARRIVE_DIST){
    out.x=tx;out.z=tz;out.clip='idle';out.loop=true;out.speed=1;out.arrived=true;
   }else{
    const k=step/dist;
    out.x=curX+dx*k;out.z=curZ+dz*k;out.clip=rawClip;out.loop=loop;out.speed=speed;out.arrived=false;
   }
   return out;
  }
  out.x=tx;out.z=tz;out.yaw=turnToward(curYaw,state?.yaw,dt);
  out.clip='idle';out.loop=true;out.speed=1;out.arrived=true;
  return out;
 }
 out.x=tx;out.z=tz;out.yaw=turnToward(curYaw,state?.yaw,dt);
 out.clip=rawClip;out.loop=loop;out.speed=speed;out.arrived=true;
 return out;
}
export function scheduleClip(ctrl,nextClip,loop,speed){
 const name=ctrl.actions.has(nextClip)?nextClip:'idle';
 const next=ctrl.actions.get(name);
 if(!next)return;
 if(ctrl.currentName===name&&ctrl.currentAction===next){
  if(next.getEffectiveTimeScale()!==speed)next.setEffectiveTimeScale(speed);
  return;
 }
 const dur=ctrl.currentName?blendTime(ctrl.currentName,name):0;
 next.stopFading?.();
 next.enabled=true;
 next.setEffectiveTimeScale(speed);
 next.setEffectiveWeight(1);
 next.setLoop(loop?ctrl.LoopRepeat:ctrl.LoopOnce,loop?Infinity:1);
 next.clampWhenFinished=!loop;
 next.reset().play();
 if(ctrl.currentAction&&dur>0)ctrl.currentAction.crossFadeTo(next,dur,false);
 else if(ctrl.currentAction)ctrl.currentAction.stop();
 ctrl.currentName=name;ctrl.currentAction=next;
}
export function resolveAnchor(kind,group,nodes,out){
 if(kind==='mouth'&&nodes?.mouth)return nodes.mouth.getWorldPosition(out);
 if(kind==='head'&&nodes?.head)return nodes.head.getWorldPosition(out);
 if(kind==='back'&&nodes?.spine2){nodes.spine2.getWorldPosition(out);out.y+=BACK_OFFSET_Y;return out}
 const off=FALLBACK_ANCHORS[kind]||FALLBACK_ANCHORS.head;
 const s=Math.sin(group.rotation.y),c=Math.cos(group.rotation.y);
 out.set(group.position.x+off[0]*c+off[2]*s,group.position.y+off[1],group.position.z-off[0]*s+off[2]*c);
 return out;
}

function parallelMap(a,b,srcMap,dstMap){
 srcMap.set(b,a);dstMap.set(a,b);
 for(let i=0;i<a.children.length;i++)parallelMap(a.children[i],b.children[i],srcMap,dstMap);
}
function cloneSkinnedScene(source){
 const srcMap=new Map(),dstMap=new Map(),cloned=source.clone();
 parallelMap(source,cloned,srcMap,dstMap);
 cloned.traverse(node=>{
  if(!node.isSkinnedMesh)return;
  const src=srcMap.get(node);
  node.skeleton=src.skeleton.clone();
  node.bindMatrix.copy(src.bindMatrix);
  node.skeleton.bones=src.skeleton.bones.map(b=>dstMap.get(b));
  node.bind(node.skeleton,node.bindMatrix);
 });
 return cloned;
}
function resolveAssetUrl(url){
 const base=globalThis.document?.baseURI;
 if(!base)return url;
 try{return new URL(url,base).href}catch{return url}
}
function loadSharedGlb(LoaderClass,url){
 const resolved=resolveAssetUrl(url);
 if(GLB_CACHE.has(resolved))return GLB_CACHE.get(resolved);
 const loader=typeof LoaderClass==='function'?new LoaderClass():LoaderClass;
 const p=loader.loadAsync(resolved).then(gltf=>{
  const lights=[];
  gltf.scene.traverse(o=>{if(o.isLight)lights.push(o)});
  for(const l of lights)l.parent?.remove(l);
  return {scene:gltf.scene,animations:gltf.animations||[]};
 }).catch(err=>{GLB_CACHE.delete(resolved);throw err});
 GLB_CACHE.set(resolved,p);
 return p;
}

/** Build a Three.js cat actor bound to a single shared GLB load. */
export function createPetActor({THREE=DEFAULT_THREE,GLTFLoader=DEFAULT_LOADER,url=DEFAULT_CAT_URL}={}){
 const group=new THREE.Group();
 group.name='pet-cat';
 const stepOut={x:0,z:0,yaw:0,clip:'idle',loop:true,speed:1,arrived:true};
 const anchorOut=new THREE.Vector3();
 const ctrl={actions:new Map(),currentName:'',currentAction:null,LoopOnce:THREE.LoopOnce,LoopRepeat:THREE.LoopRepeat};
 const nodes={mouth:null,head:null,spine2:null};
 let root=null,mixer=null,loading=null,disposed=false,pendingClip='idle',pendingLoop=true,pendingSpeed=1;

 function attachAsset(asset){
  if(disposed)return group;
  root=cloneSkinnedScene(asset.scene);
  root.traverse(o=>{
   if(!o.isMesh)return;
   o.castShadow=true;o.receiveShadow=true;
   if(o.isSkinnedMesh)o.frustumCulled=false;
  });
  nodes.mouth=root.getObjectByName('anchor_mouth')||null;
  nodes.head=root.getObjectByName('anchor_head')||null;
  nodes.spine2=root.getObjectByName('spine2')||null;
  mixer=new THREE.AnimationMixer(root);
  for(const clip of asset.animations)ctrl.actions.set(clip.name,mixer.clipAction(clip));
  group.add(root);
  scheduleClip(ctrl,pendingClip,pendingLoop,pendingSpeed);
  mixer.update(0);
  return group;
 }

 const actor={
  group,
  pickRadius:PICK_RADIUS,
  get visible(){return group.visible},
  set visible(v){group.visible=!!v},
  load(){
   if(root)return Promise.resolve(group);
   loading??=loadSharedGlb(GLTFLoader,url).then(attachAsset);
   return loading;
  },
  setPet(raw){
   if(!raw){group.visible=false;return null}
   const snap=applyPetSnapshot(raw)||raw;
   if(Number.isFinite(snap.x)&&Number.isFinite(snap.z))group.position.set(snap.x,Number.isFinite(snap.y)?snap.y:group.position.y,snap.z);
   if(Number.isFinite(snap.yaw))group.rotation.y=snap.yaw;
   const clip=typeof snap.clip==='string'?snap.clip:'idle';
   pendingClip=clip;pendingLoop=CLIP_LOOP[clip]??true;pendingSpeed=1;
   if(mixer&&!disposed){scheduleClip(ctrl,pendingClip,pendingLoop,pendingSpeed);mixer.update(0)}
   return snap;
  },
  update(dt,state){
   const cdt=clampDt(dt);
   stepLocomotion(group.position.x,group.position.z,group.rotation.y,state,cdt,stepOut);
   group.position.x=stepOut.x;group.position.z=stepOut.z;group.rotation.y=stepOut.yaw;
   pendingClip=stepOut.clip;pendingLoop=stepOut.loop;pendingSpeed=stepOut.speed;
   if(mixer&&!disposed){scheduleClip(ctrl,stepOut.clip,stepOut.loop,stepOut.speed);mixer.update(cdt)}
   return stepOut;
  },
  anchorPoint(kind='head',out=anchorOut){return resolveAnchor(kind,group,nodes,out)},
  dispose(){
   disposed=true;
   if(mixer){mixer.stopAllAction();if(root)mixer.uncacheRoot(root)}
   if(root){group.remove(root);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton?.dispose?.()})}
   ctrl.actions.clear();ctrl.currentAction=null;ctrl.currentName='';
   nodes.mouth=nodes.head=nodes.spine2=null;mixer=null;root=null;
  },
 };
 return actor;
}
