import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createWorld,worldLayout} from '../dist/world.js';
import {MAP} from '../dist/map-definition.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})}; // ground textures draw on a canvas; tests have none

const R=MAP.scenery.view.distance,layout=worldLayout(),scene=new THREE.Scene(),world=createWorld(scene);
const everything=createWorld(new THREE.Scene(),{cullRadius:Infinity}).cullStats();
assert.equal(everything.drawn,everything.total,'with no culling every tree is drawn');assert.equal(everything.total,layout.cuttable.length+layout.decor.length);
assert(R>=155&&R<=200,'the view distance is just beyond where the fog (155 m) hides everything: '+R);

// The cost follows what is near: a view from the city, the bridge, the forest and the farm draws a fraction of all the trees.
const share=(x,z,fx,fz)=>{world.setViewer(x,z,fx,fz);const s=world.cullStats();return s.triangles/s.allTriangles};
const city=share(-5,15,0,-1),bridge=share(-30,-80,0,-1),forest=share(60,-195,-1,0),farm=share(-100,-160,1,0);
assert(city<.15,'the city draws '+(city*100).toFixed(0)+'% of the tree triangles');assert(bridge<.6&&farm<.6&&forest<.75,`bridge ${(bridge*100).toFixed(0)}%, farm ${(farm*100).toFixed(0)}%, forest ${(forest*100).toFixed(0)}%`);
assert(everything.allTriangles<1.1e6,'all the trees together: '+everything.allTriangles);

// Nothing pops in: every choppable pine within 70 m is drawn, nothing beyond the view distance is, and scenery within 30 m is drawn on every side.
const decorMeshes=[];scene.traverse(o=>{if(o.isInstancedMesh&&o.name.startsWith('decor-')&&o.name.endsWith('bark'))decorMeshes.push(o)});
const drawnScenery=new Set();for(const mesh of decorMeshes)for(let i=0;i<mesh.count;i++)drawnScenery.add(mesh.instanceMatrix.array[i*16+12].toFixed(3)+','+mesh.instanceMatrix.array[i*16+14].toFixed(3));
for(const [vx,vz,fx,fz] of [[-90,20,1,0],[-90,20,-1,0],[60,-195,0,-1],[60,-195,0,1]]){
 world.setViewer(vx,vz,fx,fz);
 for(const t of world.trees.values()){const d=Math.hypot(t.x-vx,t.z-vz);if(d<=70)assert(t.slot>=0,'a pine within 70 m is drawn');if(d>R)assert.equal(t.slot,-1,'a pine beyond the view distance is not')}
 const drawn=new Set();for(const mesh of decorMeshes)for(let i=0;i<mesh.count;i++){const x=mesh.instanceMatrix.array[i*16+12],z=mesh.instanceMatrix.array[i*16+14],d=Math.hypot(x-vx,z-vz);
  assert(d<=R+.01,'scenery beyond the view distance is not drawn');if(d>30)assert(((x-vx)*fx+(z-vz)*fz)>=-.35*d-.01,'scenery well behind the camera is not drawn');drawn.add(x.toFixed(3)+','+z.toFixed(3))}
 for(const t of layout.decor)if(Math.hypot(t.x-vx,t.z-vz)<=29)assert(drawn.has(t.x.toFixed(3)+','+t.z.toFixed(3)),'scenery within 30 m is drawn in every direction');
}
// Collisions never depend on what is drawn: a pine far from the viewer still blocks.
world.setViewer(-5,15,0,-1);{const far=layout.cuttable[0];assert.equal(world.trees.get(far.key).slot,-1);assert(world.blocked(far.x,far.z),'a culled pine still blocks')}

// A felled tree leaves the draw lists, a sapling and a regrown tree come back.
{const t=layout.cuttable.find(c=>c.x>20&&c.x<60&&c.z<-195)||layout.cuttable[100];
 const camera=new THREE.PerspectiveCamera(),target=new THREE.Vector3(t.x-4,0,t.z);camera.position.set(t.x-12,2,t.z);camera.lookAt(t.x,2,t.z);camera.updateMatrixWorld();world.update(.016,camera,target); // looking east at the tree
 const before=world.cullStats().drawn,state=world.trees.get(t.key);assert(state.slot>=0);
 assert(world.setFelled(t.key));assert.equal(world.cullStats().drawn,before-1,'a stump is not drawn as a tree');assert.equal(state.slot,-1);
 assert(world.setStage(t.key,'sapling'));assert.equal(world.cullStats().drawn,before,'the sapling is drawn');assert(state.slot>=0);
 assert(world.setRegrown(t.key));assert.equal(world.cullStats().drawn,before);assert(state.slot>=0);
 // Falling: drawn while it falls, gone when it has landed.
 world.fellTree(t.key,{x:t.x-1,z:t.z});assert(state.slot>=0,'drawn while falling');
 for(let i=0;i<20;i++)world.update(.1,camera,target);assert.equal(state.slot,-1,'gone once it has landed');assert.equal(world.cullStats().drawn,before-1);
}
// The lists are rebuilt when you move far or turn, not every frame.
{const camera=new THREE.PerspectiveCamera();camera.position.set(0,2,0);camera.lookAt(0,2,-10);camera.updateMatrixWorld();
 const target=new THREE.Vector3(60,0,-195),bark=scene.getObjectByName(scene.children[0].children.find(o=>o.name.startsWith('pine-')&&o.name.endsWith('bark')).name);
 world.update(.016,camera,target);const version=bark.instanceMatrix.version;
 target.x+=1;world.update(.016,camera,target);assert.equal(bark.instanceMatrix.version,version,'1 m of movement does not rebuild');
 target.x+=120;world.update(.016,camera,target);assert(bark.instanceMatrix.version>version,'120 m does');
 const v2=bark.instanceMatrix.version;camera.lookAt(10,2,0);camera.updateMatrixWorld();world.update(.016,camera,target);assert(bark.instanceMatrix.version>v2,'turning around rebuilds');}
console.log(`Tree culling: ${(city*100).toFixed(0)}% of tree triangles drawn from the city, ${(bridge*100).toFixed(0)}% at the bridge, ${(forest*100).toFixed(0)}% in Pine Ridge, ${(farm*100).toFixed(0)}% on the farm; no pop-in within 30 m (70 m for choppable pines); felling removes a tree from the draw lists; collisions unchanged.`);
