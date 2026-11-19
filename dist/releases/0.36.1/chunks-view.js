// The chunk streamer (F1). No three.js import: what is drawn per chunk comes from `build.fences(slice)` (world.js), disposal is duck-typed, so the whole thing runs in Node tests.
// A chunk is built in STEPS, each of which costs about a millisecond or less (mask tile, going live, meshes), and update() runs steps only until its time budget is spent.
//   ring 2 = the 5 x 5 chunks around the player are loaded (nearest first, the travel direction first among equals); keepRing 3 = the 7 x 7 are kept; one chunk is disposed per frame,
//   2 s after it left the keep ring. ensure(x, z) builds the 3 x 3 around a point NOW (spawn, load, teleport, safe spot) so the ground there is real before anyone stands on it.
// Hard rule: walkable() on a chunk of the map that is not loaded is FALSE (a wall at the ring edge) and warns once per chunk, never "free".
import {chunksAround,chunkIndex,chunkKey,inRange,maskTile} from './chunks.js';

export function createChunkView({index,colliders,scene=null,build={},map,ring=2,keepRing=3,disposeDelayMs=2000,budgetMs=2,now=()=>globalThis.performance?.now?.()??Date.now(),onFade=null,warn=m=>console.warn(m)}){
 const range=index.range,chunks=new Map(),grid=new Array(range.cols*range.rows).fill(null),listeners={build:[],dispose:[]};
 const slot=(i,j)=>(j-range.j0)*range.cols+(i-range.i0);
 const stat={built:0,disposed:0,wallHits:0,updates:0,maxUpdateMs:0,lastUpdateMs:0,steps:{}};
 const warned=new Set();let last=null,dir=null;
 colliders?.stream?.(true);
 const record=(name,ms)=>{const s=stat.steps[name]||(stat.steps[name]={n:0,total:0,max:0});s.n++;s.total+=ms;if(ms>s.max)s.max=ms};
 const disposeObject=o=>{o.removeFromParent?.();o.traverse?.(n=>{n.geometry?.dispose?.();if(n.isInstancedMesh)n.dispose?.()})};
 // The steps of one chunk, in order. Each returns nothing; the chunk is `ready` (solid and walkable) after 'live'.
 const STEPS=[
  ['mask',c=>{c.tile=maskTile(c.i,c.j,map)}],
  ['live',c=>{grid[slot(c.i,c.j)]=c.tile;colliders?.setChunkLive?.(c.key,true);c.ready=true;for(const f of listeners.build)f(c)}],
  ['meshes',c=>{for(const fn of Object.values(build)){const o=fn(c.slice);if(o){c.objects.push(o);if(scene)scene.add(o)}}}] // every builder in the build option (world.js: fences, merged ground) gets the chunk's slice and returns an object or null
 ];
 function chunkFor(i,j){const key=chunkKey(i,j);let c=chunks.get(key);if(!c){c={key,i,j,slice:index.slice(i,j),step:0,ready:false,tile:null,objects:[],leftAt:null};chunks.set(key,c)}return c}
 function runStep(c){const [name,fn]=STEPS[c.step],t=now();fn(c);record(name,now()-t);c.step++;if(c.step>=STEPS.length)stat.built++;return c.step>=STEPS.length}
 function dispose(c){
  if(c.tile)grid[slot(c.i,c.j)]=null;colliders?.setChunkLive?.(c.key,false);
  for(const o of c.objects)disposeObject(o);c.objects=[];
  c.tile=null;c.ready=false;chunks.delete(c.key);stat.disposed++;for(const f of listeners.dispose)f(c);
 }
 const complete=c=>{while(c.step<STEPS.length)runStep(c)};
 const done=c=>c.step>=STEPS.length;
 function trackDirection(x,z){if(last){const dx=x-last.x,dz=z-last.z;if(dx*dx+dz*dz>1){dir={x:dx,z:dz};last={x,z}}}else last={x,z}}
 const view={
  range,
  // Per frame: keep the ring loaded within the time budget, dispose what has been out of the keep ring long enough. Returns the milliseconds spent.
  update(x,z,ms=budgetMs){
   const t0=now();trackDirection(x,z);
   const wanted=chunksAround(x,z,ring,{dir,range});
   for(const w of wanted){const c=chunkFor(w.i,w.j);if(done(c))continue;while(!done(c)){runStep(c);if(now()-t0>=ms)break}if(now()-t0>=ms)break} // one step at least, then stop as soon as the budget is spent
   const centre=chunkIndex(x,z);let disposedNow=0;
   for(const c of chunks.values()){
    const far=Math.max(Math.abs(c.i-centre.i),Math.abs(c.j-centre.j))>keepRing;
    if(!far){c.leftAt=null;continue}
    if(c.leftAt===null)c.leftAt=t0;
    if(!disposedNow&&t0-c.leftAt>=disposeDelayMs){dispose(c);disposedNow++}
   }
   const spent=now()-t0;stat.updates++;stat.lastUpdateMs=spent;if(spent>stat.maxUpdateMs)stat.maxUpdateMs=spent;return spent;
  },
  // Build the chunks within `radius` of a point right now (no budget). Returns {built, ready, ms}: `ready` says the point's own chunk was already loaded (no fade needed).
  ensure(x,z,radius=1){
   const t0=now(),c0=chunkIndex(x,z),ready=!inRange(range,c0.i,c0.j)||view.isReady(x,z);let built=0;
   for(const w of chunksAround(x,z,radius,{range})){const c=chunkFor(w.i,w.j);if(done(c))continue;complete(c);built++}
   if(!ready&&built&&onFade)onFade();
   last={x,z};return {built,ready,ms:now()-t0};
  },
  isReady(x,z){const {i,j}=chunkIndex(x,z);if(!inRange(range,i,j))return true;return !!chunks.get(chunkKey(i,j))?.ready},
  // The wall: a point in a chunk that is not loaded is not walkable. Outside the map's chunks it is not walkable either (the same as the whole-map mask outside the ground).
  walkable(x,z){
   const {i,j}=chunkIndex(x,z);if(!inRange(range,i,j))return false;
   const tile=grid[slot(i,j)];
   if(!tile){stat.wallHits++;const k=chunkKey(i,j);if(!warned.has(k)){warned.add(k);warn('chunks: '+k+' is not loaded yet; treating it as a wall (streaming is behind)')}return false}
   return tile.walkable(x,z);
  },
   // PB1: the surface id under a point from the loaded tile, or 0 where no tile is loaded (the caller falls back to the whole-map mask, which has no cell outside the old ground: vehicles read speed, grip and sinking from the surface, and surface 0 is speed 0).
  surfaceAt(x,z){const {i,j}=chunkIndex(x,z);if(!inRange(range,i,j))return 0;const tile=grid[slot(i,j)];return tile?tile.surfaceAt(x,z):0},
 on(event,fn){listeners[event].push(fn)},
  // Draw calls a chunk adds (one per Mesh in what it built; an empty chunk adds none).
  meshesOf(key){const c=chunks.get(key);let n=0;for(const ob of c?.objects||[])ob.traverse?.(o=>{if(o.isMesh)n++});return n},
  loadedKeys:()=>[...chunks.values()].filter(c=>c.ready).map(c=>c.key),
  stats(){const steps={};for(const [k,s] of Object.entries(stat.steps))steps[k]={n:s.n,avgMs:s.total/s.n,maxMs:s.max};
   let ready=0;for(const c of chunks.values())if(c.ready)ready++;
   let meshes=0;for(const c of chunks.values())for(const ob of c.objects)ob.traverse?.(o=>{if(o.isMesh)meshes++});
   return {...stat,steps,loaded:ready,tracked:chunks.size,maskBytes:ready*40000*3,maskCells:ready*40000,worldCells:range.cols*range.rows*40000,chunkMeshes:meshes}},
  disposeAll(){for(const c of [...chunks.values()])dispose(c);colliders?.stream?.(false)}
 };
 return view;
}
