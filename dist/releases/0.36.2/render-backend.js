// WebGPU T5 renderer switch (notes/webgpu-spike.md T5): reads ?webgpu=1 / ?webgl=1, names the backend for the HUD, and holds the ONE TSL kit the shader modules read (null = the WebGL path, nothing changes).
// game.js sets the kit once, right after `await renderer.init()` and before any material is built; every module that has a TSL twin (sky, shadows, ground, paint, tracks, smoke, debris,
// night lights, cover, pallet tags, menu cover, sightline fade) asks tslKit('<name>') when it builds its material and takes the TSL path only when a kit is set.
// The kit is module state on purpose (like dev-flag.js): the alternative was threading it through createWorld, driving.js and every call site.
export const BACKEND_WEBGL='WebGL',BACKEND_WEBGPU='WebGPU',BACKEND_WEBGL2='WebGL2 via WebGPU';
const ON=new Set(['','1','true','on','yes']);
// search: location.search ('?webgpu=1'). webgpu: use WebGPURenderer; forceWebGL: ?webgl=1 as well (WebGPURenderer on its WebGL2 backend, for testing the fallback on a WebGPU machine).
export function backendFlag(search='',defaultOn=false){
 let q;try{q=new URLSearchParams(String(search||''))}catch{return {webgpu:false,forceWebGL:false}}
 const on=k=>q.has(k)&&ON.has(String(q.get(k)).toLowerCase());
 const webgpu=q.has('webgpu')?on('webgpu'):!!defaultOn;return {webgpu,forceWebGL:webgpu&&on('webgl')}; // 0.36.0 owner: defaultOn is true in a real page (WebGPU is the default, ?webgpu=0 opts out); Node tests have no location, so they stay on WebGL
}
// T6: the node path grades + encodes per material (tsl-output.js, WebGL's look). &direct=0 keeps T5's single output pass, for A/B checks (scripts/webgpu-diff.mjs) and as a way back.
export function directOutputWanted(search=''){try{return new URLSearchParams(String(search||'')).get('direct')!=='0'}catch{return true}}
// The HUD's backend name. usedWebGPU: the WebGPURenderer was created (the flag was on and it initialised).
export function backendLabel(renderer,usedWebGPU){
 if(!usedWebGPU)return BACKEND_WEBGL;
 return renderer?.backend?.isWebGPUBackend?BACKEND_WEBGPU:BACKEND_WEBGL2;
}
let kit=null;const uses=new Map();
// k: {TSL, NodeMaterial, MeshBasicNodeMaterial, MeshStandardNodeMaterial, MeshLambertNodeMaterial} or null.
export function setTslKit(k){kit=k||null;uses.clear();return kit}
// user: which module asks (counted, for tests/webgpu-flag.mjs). Returns the kit or null.
export function tslKit(user){if(kit&&user)uses.set(user,(uses.get(user)||0)+1);return kit}
export const tslUses=()=>Object.fromEntries(uses);
