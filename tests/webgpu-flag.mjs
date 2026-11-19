// WebGPU T5 renderer switch (notes/webgpu-spike.md T5, dist/render-backend.js): the packaged game booted four times, each in its own process.
// off: no flag = WebGLRenderer, three.webgpu.js and three.tsl.js never loaded, every GLSL path as before. on: ?webgpu=1 with a WebGPU adapter = WebGPURenderer (mock renderer,
// REAL node materials from the vendored three.webgpu.js), init() awaited before the first render, every TSL twin built, no GLSL patch left in the world or the menu.
// force: ?webgpu=1&webgl=1 = the WebGL2 backend of WebGPURenderer. nogpu: ?webgpu=1 without navigator.gpu = the library's WebGL2 fallback. No GPU here: nothing is drawn.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {copyFile,rename,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const CASES={off:{search:'',gpu:true,label:'WebGL'},on:{search:'?webgpu=1',gpu:true,label:'WebGPU'},force:{search:'?webgpu=1&webgl=1',gpu:true,label:'WebGL2 via WebGPU'},nogpu:{search:'?webgpu=1',gpu:false,label:'WebGL2 via WebGPU'}};
// the modules that build a TSL twin during a boot in Node (ground cover needs Image to load its atlas, so it never builds here: see cover-view.mjs / tsl-materials.mjs)
const TWINS=['sky','shadows','world','paint','tracks','smoke','debris','lights','tags','menu','points']; // T6: points = sawdust + menu dust as sized sprites
const which=process.argv[2];

if(!which){
 const {backendFlag,backendLabel,setTslKit,tslKit,tslUses,BACKEND_WEBGL,BACKEND_WEBGPU,BACKEND_WEBGL2}=await import('../dist/render-backend.js');
 assert.deepEqual(backendFlag(''),{webgpu:false,forceWebGL:false});assert.deepEqual(backendFlag('?webgpu=1'),{webgpu:true,forceWebGL:false});assert.deepEqual(backendFlag('?webgpu'),{webgpu:true,forceWebGL:false});
 assert.deepEqual(backendFlag('?webgpu=0'),{webgpu:false,forceWebGL:false});assert.deepEqual(backendFlag('?webgl=1'),{webgpu:false,forceWebGL:false},'webgl alone changes nothing');
 assert.deepEqual(backendFlag('?debug&webgpu=true&webgl=1'),{webgpu:true,forceWebGL:true});assert.deepEqual(backendFlag(null),{webgpu:false,forceWebGL:false});
 assert.equal(backendLabel({backend:{isWebGPUBackend:true}},false),BACKEND_WEBGL);assert.equal(backendLabel({backend:{isWebGPUBackend:true}},true),BACKEND_WEBGPU);assert.equal(backendLabel({backend:{isWebGLBackend:true}},true),BACKEND_WEBGL2);
 assert.equal(tslKit('x'),null);assert.deepEqual(tslUses(),{},'no kit: nothing counted');setTslKit({TSL:{}});tslKit('a');tslKit('a');assert.deepEqual(tslUses(),{a:2});setTslKit(null);assert.equal(tslKit('a'),null);
 const out=[];
 for(const name of Object.keys(CASES)){
  const r=spawnSync(process.execPath,[fileURLToPath(import.meta.url),name],{encoding:'utf8',timeout:300000});
  if(r.status!==0){console.error(r.stdout);console.error(r.stderr);assert.fail(`case ${name} failed (exit ${r.status})`)}
  out.push(r.stdout.trim().split('\n').pop());
 }
 for(const line of out)console.log(line);
 console.log('PASS webgpu-flag: off = WebGLRenderer with no WebGPU/TSL download; ?webgpu=1 = WebGPURenderer, init awaited before the first render, '+TWINS.length+' TSL twins built, no GLSL patch left; &webgl=1 and no navigator.gpu = WebGL2 via WebGPU.');
 process.exit(0);
}

const c=CASES[which];assert(c,'unknown case '+which);
const {bootGame}=await import('./support/boot-game.mjs');const {writeMockRenderer}=await import('./support/mock-renderer.mjs');
if(c.search)globalThis.location={search:c.search,pathname:'/'};
if(c.gpu)Object.defineProperty(globalThis.navigator,'gpu',{value:{},configurable:true});
const g=await bootGame({play:false,editRelease:async dir=>{
 const v=join(dir,'vendor');
 // three.tsl.js: counted when loaded (the default path must never load it)
 await rename(join(v,'three.tsl.js'),join(v,'three.tsl.real.js'));await writeFile(join(v,'three.tsl.js'),"globalThis.__tslLoads=(globalThis.__tslLoads||0)+1;\nexport * from './three.tsl.real.js';\n");
 if(which==='off')return; // the plain mock (boot-game.mjs), as every other boot test
 // one three.core.js for everything: the mock three.module.js re-exports a copy of the real one next to it, the mock three.webgpu.js re-exports the real WebGPU build (real NodeMaterials)
 await copyFile(resolve('dist/vendor/three.module.js'),join(v,'three.module.real.js'));await copyFile(resolve('dist/vendor/three.webgpu.js'),join(v,'three.webgpu.real.js'));
 await writeMockRenderer(dir,pathToFileURL(join(v,'three.module.real.js')).href,{backend:'auto',webgpuModule:pathToFileURL(join(v,'three.webgpu.real.js')).href});
}});
const mats=new Set(),points=[],collect=s=>s?.traverse(o=>{for(const m of [].concat(o.material||[]))mats.add(m);if(o.isPoints)points.push(o.name||'(points)')});
g.pump(1);const menu=g.menuScene();assert(menu,'the live menu scene drew');collect(menu); // the menu scene is disposed at Play: read it first
g.ids.get('start').click();g.pump(2);collect(g.scene());
const {tslUses}=await import(pathToFileURL(join(g.dir,'render-backend.js')).href);
const uses=tslUses(),fps=g.ids.get('fps').textContent||'';
const glsl=[...mats].filter(m=>m.isShaderMaterial||Object.hasOwn(m,'onBeforeCompile')).map(m=>m.name||m.type);
assert(globalThis.__renders>0,'the game drew frames');
if(which==='off'){
 assert.equal(globalThis.__webgpuModuleLoads,undefined,'three.webgpu.js is not loaded without the flag');assert.equal(globalThis.__tslLoads,undefined,'three.tsl.js is not loaded without the flag');
 assert.equal(globalThis.__webgpuRenderer,undefined,'WebGLRenderer drew');assert.deepEqual(uses,{},'no module took a TSL path');
 assert(!fps.includes('|'),'the HUD line is unchanged on WebGL: '+fps);
 assert(g.scene().getObjectByName('sky-dome').material.isShaderMaterial,'the GLSL sky is still the default');assert(glsl.length>5,'the GLSL patches are still on the default path');
 console.log(`off: WebGLRenderer, three.webgpu.js/three.tsl.js not loaded, ${glsl.length} GLSL-patched materials as before, HUD "${fps}"`);
 await g.done();process.exit(0);
}
const r=globalThis.__webgpuRenderer;
assert.equal(globalThis.__webgpuModuleLoads,1,'three.webgpu.js loaded once');assert(globalThis.__tslLoads>=1,'three.tsl.js loaded');
assert(r&&r.initialized,'WebGPURenderer.init() resolved before render() (the mock throws otherwise)');assert.equal(!!r.options.forceWebGL,which==='force');
assert(fps.endsWith('| '+c.label),`HUD names the backend: "${fps}"`);
for(const t of TWINS)assert(uses[t]>=1,`${t} built its TSL twin (uses: ${JSON.stringify(uses)})`);
assert.deepEqual(glsl,[],'no ShaderMaterial or onBeforeCompile patch left in the world or the menu');
const nodeMats=[...mats].filter(m=>m.isNodeMaterial);
for(const name of ['sky-dome-tsl','sky-stars-tsl','blob-shadows-tsl','night-sprites-tsl','night-ground-tsl','tyre-tracks-tsl','exhaust-smoke-tsl','crash-debris-tsl','menu-cover-tsl'])assert(nodeMats.some(m=>m.name===name),name+' is in a scene');
assert(nodeMats.some(m=>m.name.startsWith('ground-tsl-')),'the TSL ground is in the world');assert(nodeMats.some(m=>m.userData?.paint&&m.isMeshStandardNodeMaterial),'a vehicle wears the TSL paint');
assert(r.__directOutput&&typeof r.contextNode?.getFlowContextData?.().getOutput==='function','T6: direct output installed (per-material grade + sRGB, display fog)');assert.deepEqual([...new Set(points)],[],'T6: no 1 px THREE.Points left on the node path');assert(nodeMats.some(m=>m.name==='sawdust-tsl'),'T6: the sawdust is a sized sprite');
assert(!nodeMats.some(m=>Object.hasOwn(m,'customProgramCacheKey')),'no node material shares a program key (WebGPURenderer would reuse the first one\'s node build)');
console.log(`${which}: WebGPURenderer (${c.label}), init awaited, ${nodeMats.length} node materials, TSL twins ${JSON.stringify(uses)}, points left at 1 px: ${[...new Set(points)].join(', ')||'none'}, HUD "${fps}"`);
await g.done();process.exit(0);
