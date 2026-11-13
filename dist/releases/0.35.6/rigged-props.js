// Rigged props (rigged-assets.js, built by scripts/build-props.mjs): models with named nodes, skins and animation clips, loaded with GLTFLoader like the characters.
// A rigged prop answers propInfo() like any converted prop (footprint, colliders, floors) from data alone, so the world can be laid out before the model has decoded;
// createRigged() returns a group at once and fills it when the model is ready (group.userData.ready resolves with the group).
// Everything is in model coordinates: the root node is the origin, 1 unit = 1 m, glTF axes (+y up, +z is the model's front).
import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {RIGGED} from './rigged-assets.js';

export const isRigged=id=>id in RIGGED;
const r2=v=>Math.round(v*100)/100;
const boxOf=b=>({x:r2((b[0]+b[3])/2),z:r2((b[2]+b[5])/2),hx:r2((b[3]-b[0])/2),hz:r2((b[5]-b[2])/2)});
const floorOf=b=>({y:r2(b[4]),x0:r2(b[0]),x1:r2(b[3]),z0:r2(b[2]),z1:r2(b[5])});
// Which parts are solid, by node name (from the converter's bounds table). The belt is one solid block (frame and rollers): its top is 0.8 m. The bench is one block (the blade slot is 8 cm wide).
// Rails, braces, beams and roof are not solid (low, or overhead).
const SOLID=[{what:'post',names:/^(Post|ShedPost)_/,each:true},{what:'bench',names:/^BenchTop_/},{what:'conveyor',names:/^Belt_(Beam|Leg|EndStop)/},{what:'log pile',names:/^PileLog_/}];
const infos=new Map();
export function riggedInfo(id){
 if(infos.has(id))return infos.get(id);
 const m=RIGGED[id];if(!m)throw new Error('Unknown rigged prop '+id);
 const names=Object.keys(m.bounds),union=list=>list.reduce((u,n)=>{const b=m.bounds[n];return u?[Math.min(u[0],b[0]),Math.min(u[1],b[1]),Math.min(u[2],b[2]),Math.max(u[3],b[3]),Math.max(u[4],b[4]),Math.max(u[5],b[5])]:b.slice()},null);
 const whole=union(names),colliders=[];
 for(const rule of SOLID){const hit=names.filter(n=>rule.names.test(n));if(!hit.length)throw new Error(`${id}: no parts named like ${rule.names} for the ${rule.what} collider`);
  if(rule.each)for(const n of hit)colliders.push(boxOf(m.bounds[n]));else colliders.push(boxOf(union(hit)))}
 const info={source:m.source,rigged:true,width:r2(whole[3]-whole[0]),depth:r2(whole[5]-whole[2]),height:r2(whole[4]),footprint:{x0:r2(whole[0]),x1:r2(whole[3]),z0:r2(whole[2]),z1:r2(whole[5])},
  colliders,floors:[floorOf(m.bounds.Deck),floorOf(m.bounds.ShedDeck)],floor:null,door:null,anchors:m.anchors,clips:m.clips};
 info.floor=info.floors[0];infos.set(id,info);return info;
}

// The rest state in the spec: lever up, lamp dark. The file stores the bind pose (lamp bone at scale 1), and the pose the spec means is the last frame of SwitchOff, so that is applied.
export function applyRestPose(gltf){
 const off=gltf.animations.find(c=>c.name==='SwitchOff');if(!off)return;
 for(const t of off.tracks){const [node,prop]=t.name.split('.'),o=gltf.scene.getObjectByName(node),size=t.getValueSize(),last=t.times.length-1;
  if(o&&o[prop]?.fromArray)o[prop].fromArray(t.values,last*size)}
}
// Loop clips were exported with one frame too many and start at 1/24 s instead of 0 (BladeSpin, BeltRun: 25 keys, 1/24 s to 25/24 s, the last key repeating the first pose).
// Shifting every key so the first is at t = 0 makes the clip exactly one turn (1.0 s) long: the closing key is the pose the loop wraps to, so the seam has no repeated frame and no hold.
// (Dropping that key outright would hold the 24th pose for a frame before wrapping.) The file is not changed; this happens on load. A clip that is not the expected length is an error.
export function trimLoop(clip,seconds){
 const t0=Math.min(...clip.tracks.map(t=>t.times[0]));
 for(const t of clip.tracks)for(let i=0;i<t.times.length;i++)t.times[i]-=t0;
 clip.resetDuration();
 if(Math.abs(clip.duration-seconds)>.002)throw new Error(`${clip.name} is ${clip.duration.toFixed(4)} s after trimming, expected ${seconds} s: the model changed, check the spec`);
 clip.duration=seconds;return clip;
}
const LOOPS={'sawmill-v4':{BladeSpin:1,BeltRun:1}};
// Only the large parts cast shadows (every cast is one more draw in the shadow pass): the roof, decks, posts and beams, the pile, the belt frame, the blade and the log. Rollers, planks, the lever and lamps do not.
export const SHADOW_CASTERS={'sawmill-v4':/^(Static_(Timber_Dark|Timber|Stone|Roof_Slate|Bark|EndGrain|Iron_Dark)|Blade_[12]|FeedLog_[12])$/};
const loader=new GLTFLoader();
export function createRigged(id,fade){
 const info=riggedInfo(id),group=new THREE.Group();group.name='prop-'+id;
 const bytes=Uint8Array.from(atob(RIGGED[id].glb),c=>c.charCodeAt(0));
 group.userData.ready=loader.parseAsync(bytes.buffer,'').then(gltf=>{
  for(const [name,seconds] of Object.entries(LOOPS[id]||{})){const clip=gltf.animations.find(c=>c.name===name);if(!clip)throw new Error(id+' has no clip '+name);trimLoop(clip,seconds)}
  applyRestPose(gltf);
  const seen=new Set();
  gltf.scene.traverse(o=>{if(!o.isMesh)return;o.receiveShadow=true;o.castShadow=SHADOW_CASTERS[id]?SHADOW_CASTERS[id].test(o.name):true;if(o.isSkinnedMesh)o.frustumCulled=false; // a skinned mesh's bounds are those of its bind pose
   if(!seen.has(o.material)){seen.add(o.material);fade.apply(o.material)}});
  group.add(gltf.scene);Object.assign(group.userData,{gltf,scene:gltf.scene,clips:new Map(gltf.animations.map(c=>[c.name,c])),anchors:info.anchors});
  return group;
 });
 return group;
}
