// WebGPU ground-quality live rebuild test (R2 item d, world.rebuildGroundTSL):
// changing quality from high -> low -> high on the WebGPU mock-renderer path rebuilds every TSL ground material live,
// disposes the old materials, updates groundProgramKey (-lo vs high), and preserves polygonOffset.
import assert from 'node:assert/strict';
import {copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {bootGame} from './support/boot-game.mjs';
import {writeMockRenderer} from './support/mock-renderer.mjs';

globalThis.location={search:'?webgpu=1',pathname:'/'};
Object.defineProperty(globalThis.navigator,'gpu',{value:{},configurable:true});

const g=await bootGame({play:false,editRelease:async dir=>{
 const v=join(dir,'vendor');
 await copyFile(resolve('dist/vendor/three.module.js'),join(v,'three.module.real.js'));
 await copyFile(resolve('dist/vendor/three.webgpu.js'),join(v,'three.webgpu.real.js'));
 await writeMockRenderer(dir,pathToFileURL(join(v,'three.module.real.js')).href,{backend:'auto',webgpuModule:pathToFileURL(join(v,'three.webgpu.real.js')).href});
}});
try{
 g.pump(1);
 await new Promise(resolve=>setImmediate(resolve));
 g.ids.get('start').click();
 g.pump(2);
 assert(globalThis.__webgpuRenderer?.initialized,'WebGPURenderer initialized');

 const groundMeshes=()=>{
  const list=[];
  g.scene().traverse(o=>{
   if(!o.material)return;
   for(const m of [].concat(o.material))if(m?.userData?.groundKind&&m.isNodeMaterial)list.push({mesh:o,mat:m});
  });
  return list;
 };

 const hi1=groundMeshes();
 assert(hi1.length>5,'world has TSL ground meshes: '+hi1.length);
 for(const {mat} of hi1)assert(!mat.userData.groundProgramKey.endsWith('-lo'),'initial high groundProgramKey: '+mat.userData.groundProgramKey);

 g.ids.get('menuQuality').onchange();
 assert.deepEqual(groundMeshes().map(e=>e.mat),hi1.map(e=>e.mat),'selecting the current quality retains the built materials');

 const disposed1=new Set();
 const uniqueHi1=new Set(hi1.map(e=>e.mat));
 for(const m of uniqueHi1){const orig=m.dispose?.bind(m);m.dispose=()=>{disposed1.add(m);orig?.()}}

 // Switch quality high -> low live (without reload).
 g.ids.get('menuQuality').value='low';
 g.ids.get('menuQuality').onchange();
 g.pump(.2);

 assert.equal(globalThis.__webgpuRenderer.shadowMap.enabled,false,'Low turns off the shadow map');
 const lo=groundMeshes();
 assert.equal(lo.length,hi1.length,'same number of TSL ground meshes after low rebuild');
 for(let i=0;i<hi1.length;i++){
  assert.notEqual(lo[i].mat,hi1[i].mat,'mesh '+hi1[i].mesh.name+' got a rebuilt TSL material');
  assert(lo[i].mat.userData.groundProgramKey.endsWith('-lo'),'low groundProgramKey ends with -lo: '+lo[i].mat.userData.groundProgramKey);
  assert.equal(lo[i].mat.polygonOffset,hi1[i].mat.polygonOffset,'polygonOffset preserved');
  assert.equal(lo[i].mat.polygonOffsetFactor,hi1[i].mat.polygonOffsetFactor,'polygonOffsetFactor preserved');
  assert.equal(lo[i].mat.polygonOffsetUnits,hi1[i].mat.polygonOffsetUnits,'polygonOffsetUnits preserved');
 }
 assert.equal(disposed1.size,uniqueHi1.size,`all ${uniqueHi1.size} old high TSL ground materials disposed (got ${disposed1.size})`);

 // Switch quality low -> high live.
 const disposed2=new Set();
 const uniqueLo=new Set(lo.map(e=>e.mat));
 for(const m of uniqueLo){const orig=m.dispose?.bind(m);m.dispose=()=>{disposed2.add(m);orig?.()}}
 g.ids.get('menuQuality').value='high';
 g.ids.get('menuQuality').onchange();
 g.pump(.2);

 assert.equal(globalThis.__webgpuRenderer.shadowMap.enabled,true,'High turns on the shadow map');
 const hi2=groundMeshes();
 assert.equal(hi2.length,lo.length,'same number of TSL ground meshes after high rebuild');
 for(let i=0;i<lo.length;i++){
  assert.notEqual(hi2[i].mat,lo[i].mat,'mesh '+lo[i].mesh.name+' rebuilt back to high');
  assert(!hi2[i].mat.userData.groundProgramKey.endsWith('-lo'),'high groundProgramKey restored: '+hi2[i].mat.userData.groundProgramKey);
 }
 assert.equal(disposed2.size,uniqueLo.size,`all ${uniqueLo.size} old low TSL ground materials disposed (got ${disposed2.size})`);

 console.log(`PASS webgpu-ground-quality.mjs: live high->low->high rebuilt ${uniqueHi1.size} TSL ground materials (${hi1.length} meshes), disposed old materials, updated groundProgramKey, preserved polygonOffset, and reused the materials when reselecting the current tier.`);
}finally{
 await g.done();
}
process.exit(0);
