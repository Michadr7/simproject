import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP} from '../dist/map-definition.js';
import {lampSpots} from '../dist/streetfurniture.js';
import {townSpots} from '../dist/town.js';
import {terrain,SURFACE} from '../dist/terrain.js';
import {propInfo} from '../dist/props.js';
import {createWorld} from '../dist/world.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})}; // ground textures draw on a canvas; tests have none
const T=terrain(),lamps=lampSpots(),scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity});

// ── Street lamps: along the lit roads, on plain grass, clear of buildings, solid ─────────────────────────────────────────
assert(lamps.length>=10&&lamps.length<=30,'road lamps (Oak Street East, the loop, its link, the Freight Road): '+lamps.length);
const roads=new Set(lamps.map(l=>l.road));assert.deepEqual([...roads].sort(),['cedar-link','cedar-loop','freight-south','oak-east']);
for(const l of lamps){assert.equal(T.surfaceAt(l.x,l.z),SURFACE.GRASS,`lamp at ${l.x},${l.z} stands on grass`);assert.notEqual(T.zoneAt(l.x,l.z)?.id,'city','no lamps inside the old city');assert(world.blocked(l.x,l.z),'a lamp post is solid');
 for(const m of MAP.landmarks){const f=propInfo(m.prop).footprint,s=Math.round(Math.sin(m.yaw)),c=Math.round(Math.cos(m.yaw)),xs=[f.x0,f.x1].flatMap(x=>[f.z0,f.z1].map(z=>m.x+x*c+z*s)),zs=[f.x0,f.x1].flatMap(x=>[f.z0,f.z1].map(z=>m.z-x*s+z*c));
  assert(!(l.x>Math.min(...xs)-1&&l.x<Math.max(...xs)+1&&l.z>Math.min(...zs)-1&&l.z<Math.max(...zs)+1),`a lamp does not stand in or beside ${m.id}`)}}
for(let i=0;i<lamps.length;i++)for(let j=i+1;j<lamps.length;j++)assert(Math.hypot(lamps[i].x-lamps[j].x,lamps[i].z-lamps[j].z)>10,'lamps are spaced out');
for(const id of ['street-lamp-poles','street-lamp-heads'])assert.equal(scene.getObjectByName(id).count,lamps.length+townSpots().lamp.length,id+' instance count: the road lamps and the pavement rows');
// ── The distant hills ───────────────────────────────────────────────────────────────────────────
const hills=scene.getObjectByName('distant-hills');assert(hills,'a ring of hills');assert.equal(hills.material.fog,false,'ignores the fog so the horizon shows');assert(hills.geometry.index.count/3<=1000,'a few hundred triangles');
const box=new THREE.Box3().setFromBufferAttribute(hills.geometry.attributes.position);assert(box.max.y>30&&box.max.y<90,'low hills: '+box.max.y.toFixed(0)+' m high');assert(Math.min(Math.abs(box.min.x-20),Math.abs(box.max.x-20))>400,'beyond the playable ground (about 500 m out)');
console.log(`Street furniture: ${lamps.length} road lamps on 4 roads (instanced, solid, on grass, clear of buildings) and a ring of low hills (${hills.geometry.index.count/3} triangles) beyond the fog.`);
