// The scene editor's overlay in the game (E2): props added by the editor are drawn (one InstancedMesh per distinct model, so one draw call each) and solid.
// Named map props that were moved or removed are handled where they are built (eastbank.js, through applyToNamed in scene-edit.js). With the shipped empty overlay nothing is added.
import * as THREE from './vendor/three.module.js';
import {propInfo,createPropInstances} from './props.js';
import {SCENE_EDITS} from './scene-edits.js';

// {prop: [added spot, ...]} in the edits' order.
export function groupByModel(added){const out=new Map();for(const a of added||[]){if(!out.has(a.prop))out.set(a.prop,[]);out.get(a.prop).push(a)}return out}

// The prop's collision boxes at a spot, turned by yaw and kept axis-aligned (the world's collision list holds axis-aligned boxes): [{x,z,hx,hz}].
// A quarter turn swaps the half sizes; other angles grow the box to the smallest axis-aligned one around the turned box.
export function turnedColliders(prop,spot){
 const c=Math.cos(spot.yaw||0),s=Math.sin(spot.yaw||0),ac=Math.abs(c),as=Math.abs(s),snapNear=v=>Math.abs(v)<1e-9?0:v;
 return (propInfo(prop).colliders||[]).map(b=>({x:spot.x+snapNear(b.x*c+b.z*s),z:spot.z+snapNear(-b.x*s+b.z*c),hx:snapNear(ac*b.hx+as*b.hz),hz:snapNear(as*b.hx+ac*b.hz)}));
}

// parent: the group to add the meshes to. colliders: the world's list ({box(x,z,hx,hz)} returning an object with `active`). heightAt: the ground height function.
export function createSceneOverlay({parent,fade,heightAt,colliders,edits=SCENE_EDITS}){
 const group=new THREE.Group();group.name='scene-overlay';parent?.add(group);
 let meshes=[],boxes=[],current=edits;
 function clear(){
  for(const m of meshes){group.remove(m);m.dispose?.();for(const mat of [].concat(m.material))mat.dispose?.()} // the geometry is shared with the cache: leave it
  for(const b of boxes)b.active=false; // the collision list has no remove: a box that is off is skipped
  meshes=[];boxes=[];
 }
 function build(next){
  current=next;
  for(const [prop,spots] of groupByModel(next.added)){
   const info=propInfo(prop),placed=spots.map(a=>({x:a.x,z:a.z,y:heightAt(a.x,a.z),yaw:a.yaw}));
   const mesh=createPropInstances(prop,placed,fade,{shadows:(info.height||0)>=2});mesh.name='scene-overlay-'+prop;group.add(mesh);meshes.push(mesh);
   for(const a of spots)for(const b of turnedColliders(prop,a))boxes.push(colliders.box(b.x,b.z,b.hx,b.hz));
  }
 }
 build(edits);
 const api={
  group,
  // Swap the drawn set without reloading: dispose the old meshes, build the new ones, switch the old colliders off and add the new.
  rebuild(next){clear();build(next)},
  edits:()=>current,meshes:()=>meshes.slice(),colliders:()=>boxes.filter(b=>b.active),
  drawCalls:()=>meshes.length,
 };
 group.userData.sceneOverlay=api; // reachable from the world's group, so the editor needs no change to world.js's return value
 return api;
}
