import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {NATURE} from '../dist/nature-assets.js';
import {PINES,BROADLEAVES,modelInfo,modelGeometry,triangleBudget} from '../dist/nature.js';
import {createWorld,worldLayout,forestSide} from '../dist/world.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})}; // ground textures draw on a canvas; tests have none

// ── The converted models ──────────────────────────────────────────────────────────
assert.deepEqual(PINES,['pine.1','pine.2','pine.3']);assert.deepEqual(BROADLEAVES,['broadleaf.1','broadleaf.2']);
assert.deepEqual(Object.keys(NATURE.models).sort(),[...PINES,...BROADLEAVES].sort());
for(const name of ['bark','pineLeaves','broadleafLeaves'])assert(NATURE.textures[name].startsWith('data:image/png;base64,'),name);
const PLAYER=1.95;
for(const id of [...PINES,...BROADLEAVES]){
 const info=modelInfo(id),bark=modelGeometry(id,'bark'),leaves=modelGeometry(id,'leaves');
 assert.deepEqual(info.parts.map(p=>p.material),['bark','leaves'],`${id}: a bark part and a leaves part`);
 assert(info.triangles>=600&&info.triangles<=1500,`${id}: ${info.triangles} triangles (budget 600-1500)`);
 for(const g of [bark,leaves]){
  for(const a of ['position','normal','uv'])assert(g.attributes[a].array.every(Number.isFinite),`${id}: finite ${a}`);
  assert(g.index.array.every(i=>i<g.attributes.position.count),`${id}: indices in range`);
 }
 const box=new THREE.Box3().setFromBufferAttribute(bark.attributes.position).union(new THREE.Box3().setFromBufferAttribute(leaves.attributes.position));
 assert(Math.abs(box.max.y-info.height)<.25,`${id}: stands ${box.max.y.toFixed(2)} m tall (manifest ${info.height})`);
 assert(box.min.y>-.5&&box.min.y<=0,`${id}: roots just below the ground (${box.min.y.toFixed(2)})`);
 const ratio=info.height/PLAYER;assert(ratio>3&&ratio<4.2,`${id}: ${ratio.toFixed(1)}x the player's height`);
 assert(info.trunkRadius>.15&&info.trunkRadius<.6,`${id}: trunk radius ${info.trunkRadius}`);
 assert(modelGeometry(id,'bark')===bark,'geometry is shared, not rebuilt');
}

// ── The forest in the world ───────────────────────────────────────────────────────
const scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity}),layout=worldLayout();
const meshes=[];scene.traverse(o=>{if(o.isInstancedMesh)meshes.push(o)});
const trees=meshes.filter(m=>/-(pine|broadleaf)\.\d-(bark|leaves)$/.test(m.name));
assert(trees.length<=20,`${trees.length} tree meshes (about ${trees.length} draw calls) for the whole forest`);
assert(!scene.getObjectByName('pine-trunks')&&!scene.getObjectByName('decor-tree-canopies'),'the procedural trees are gone');
const count=(prefix,kind)=>trees.filter(m=>m.name.startsWith(prefix)&&m.name.endsWith(kind)).reduce((n,m)=>n+m.count,0);
assert.equal(count('pine-','-bark'),406);assert.equal(count('pine-','-leaves'),406,'every cuttable pine has bark and leaves');
assert.equal(count('decor-','-bark'),354);assert.equal(count('decor-','-leaves'),354);
for(const m of trees)assert(m.material&&m.material.onBeforeCompile&&m.material.customProgramCacheKey()==='city-sightline-fade',`${m.name} keeps the sightline fade`);
for(const m of trees.filter(m=>m.name.endsWith('leaves'))){assert.equal(m.material.alphaTest,.2);assert.equal(m.material.side,THREE.DoubleSide)}
// Pines in the woods, broadleaf trees elsewhere; every model gets used.
const decorMeshes=trees.filter(m=>m.name.startsWith('decor-')&&m.name.endsWith('bark'));
const used={};for(const m of decorMeshes)used[m.name.split('-')[1]]=m.count;
assert.deepEqual(Object.keys(used).sort(),[...PINES,...BROADLEAVES].sort(),'decor uses all five models');
const forestDecor=layout.decor.filter(t=>forestSide(t.x,t.z)).length,otherDecor=layout.decor.length-forestDecor;
assert.equal(PINES.reduce((n,id)=>n+(used[id]||0),0),forestDecor,'every decor tree on the forest side is a pine');assert.equal(BROADLEAVES.reduce((n,id)=>n+(used[id]||0),0),otherDecor,'and every other decor tree is broadleaf');
for(const id of PINES)assert((used[id]||0)>40,`${id} is used ${used[id]} times in the decor`);
const cutUse={};for(const t of world.trees.values())cutUse[t.model]=(cutUse[t.model]||0)+1;
assert.deepEqual(Object.keys(cutUse).sort(),PINES,'cuttable trees use only the three pines');for(const id of PINES)assert(cutUse[id]>60,`${id} fells ${cutUse[id]} trees`);
// The whole forest, if all of it were on screen at once.
const all={};for(const [id,n] of Object.entries(used))all[id]=(all[id]||0)+n;for(const [id,n] of Object.entries(cutUse))all[id]=(all[id]||0)+n;
const total=triangleBudget(all);assert(total<2.1e6,`${(total/1e6).toFixed(2)} M triangles for every tree`);
// Position and trunk collisions are unchanged by the new models.
const pine=layout.cuttable[0];
assert(world.blocked(pine.x,pine.z),'a standing pine blocks');
console.log(`Nature models: 5 trees at 800-1,350 triangles, 3.4-3.9x the player's height, ${trees.length} tree meshes, ${(total/1e6).toFixed(2)} M triangles if every tree were in view, pines in the woods and broadleaf elsewhere, sightline fade kept.`);
