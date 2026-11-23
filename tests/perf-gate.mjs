// RU6 performance gate (notes/streaming-brief.md section 3 "Hitch budget" and section 4 "RU6"). Real FPS cannot be measured in Node, so this guards what CAN be:
// how long chunk build steps take (geometry only, no GPU), how many meshes (draw-call proxy) chunks add, the load order, the update() budget, the dispose pacing and memory held.
// Timing checks take the best (min) or median of several repeats after one warm-up, and every threshold is several times the measured value, so a slow CI box passes
// but a real regression (an order of magnitude, a second pass over the whole map) fails. The FIRST (cold) tile and chunk are always excluded: JIT warm-up is not a regression.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createWorld,worldLayout,fenceSegments,createColliders} from '../dist/world.js';
import {MAP} from '../dist/map-definition.js';
import {CHUNK,chunkIndex,chunkKey,chunkBounds,chunkRange,chunksAround,createChunkIndex,maskTile,worldRange} from '../dist/chunks.js';
import {createChunkView} from '../dist/chunks-view.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
let n=0;const ok=(c,m)=>{assert(c,m);n++};const log=[];const note=s=>log.push(s);
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s[s.length>>1]},ms=()=>performance.now();
const range=chunkRange(),WR=worldRange();

// ── (4) chunksAround: order, count, duplicates, clipping (brief 3: "inner 3 x 3 first, then the 5 x 5 by distance, ties broken toward the direction of travel") ──
{const a=chunksAround(100,-700,3,{range:WR}); // an interior chunk of the world (wilds), nothing clipped
 const c0=chunkIndex(100,-700);
 ok(a.length===49&&new Set(a.map(c=>c.key)).size===49,'ring 3 is 7 x 7 = 49 chunks, no duplicates');
 ok(chunksAround(100,-700,2,{range:WR}).length===25,'ring 2 is 5 x 5 = 25 chunks');ok(chunksAround(100,-700,1,{range:WR}).length===9,'ring 1 is 9 chunks');
 ok(a[0].i===c0.i&&a[0].j===c0.j&&a[0].d===0,'the own chunk is first');
 ok(a.every((c,k)=>k===0||c.d>=a[k-1].d),'nearest ring first (Chebyshev distance never decreases)');
 ok(a.filter(c=>c.d===1).length===8&&a.filter(c=>c.d===2).length===16&&a.filter(c=>c.d===3).length===24,'ring sizes 1, 8, 16, 24');
 for(const dir of [{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}]){const r=chunksAround(100,-700,2,{range:WR,dir}).filter(c=>c.d===2);
  ok(r.every((c,k)=>k===0||c.ahead<=r[k-1].ahead+1e-9),'inside ring 2 the chunks ahead of travel '+JSON.stringify(dir)+' come first');
  const first=r[0];ok((first.i-c0.i)*dir.x+(first.j-c0.j)*dir.z>0,'and the first one really is on the travel side')}
 const e=chunksAround(-440,-1190,2,{range:WR});ok(e.length===9&&e.every(c=>c.i>=0&&c.j>=0),'at the world corner the 5 x 5 is clipped to 3 x 3 = 9, none outside');
 const f=chunksAround(1040,590,2,{range:WR});ok(f.length===9&&f.every(c=>c.i<=14&&c.j<=17),'same at the opposite corner');
 ok(chunksAround(-440,100,2,{range:WR}).length===15,'along an edge the 5 x 5 is clipped to 3 x 5')}

// ── (1) mask tile (brief 2.1 / 3: no step over about 1 ms, maskTile build under 5 ms) ──
// Threshold 5 ms: the brief's RU6 line. Measured about 1 ms (see log). Cold first tile is excluded (warm-up call below).
{maskTile(4,12);const samples=[],busy=[];
 for(let rep=0;rep<3;rep++)for(let j=range.j0;j<=range.j1;j++)for(let i=range.i0;i<=range.i1;i++){const t=ms();maskTile(i,j);samples.push(ms()-t)}
 const avg=samples.reduce((a,b)=>a+b,0)/samples.length,med=median(samples);
 // best of 3 repeats per tile, then the worst tile: a single GC pause cannot fail this
 const best=[];for(let j=range.j0;j<=range.j1;j++)for(let i=range.i0;i<=range.i1;i++){let b=1e9;for(let r=0;r<3;r++){const t=ms();maskTile(i,j);b=Math.min(b,ms()-t)}best.push(b)}
 const worstBest=Math.max(...best);
 ok(avg<5,'(3) mask tile average under 5 ms (brief 4 RU6): '+avg.toFixed(2));ok(med<5,'median mask tile under 5 ms: '+med.toFixed(2));
 ok(worstBest<10,'(1) the slowest tile (best of 3) under 10 ms, 2x the brief figure as margin for the busiest chunk: '+worstBest.toFixed(2));
 note('mask tile: '+samples.length+' builds, avg '+avg.toFixed(2)+' ms, median '+med.toFixed(2)+', slowest tile best-of-3 '+worstBest.toFixed(2)+' (limits 5 / 5 / 10)')}

// ── a streaming world (the real build functions): the 5 x 5 ring round the spawn is built here, the cold first chunks are never measured ──
const scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity,streaming:true}),view=world.chunks;
ok(view.stats().loaded===25,'the ring of 25 is loaded behind the loading screen');

// ── (2) draw-call proxy per chunk (brief 3: "about 8 draw calls per chunk, 3 sparse, 20 dense; 25 chunks about 200 + 100 shared = under 300") ──
// Counts only meshes owned by chunks (view.meshesOf / stats().chunkMeshes). Global meshes (sky, sea, instanced trees, vehicles, the two base ground planes) are NOT included.
{const counts=[];for(const k of view.loadedKeys())counts.push([k,view.meshesOf(k)]);
 const ringTotal=view.stats().chunkMeshes,dense=Math.max(...counts.map(c=>c[1]));
 ok(counts.reduce((a,c)=>a+c[1],0)===ringTotal,'meshesOf adds up to stats().chunkMeshes');
 ok(dense<=20,'densest chunk of the ring at most 20 meshes (brief 3): '+dense);ok(ringTotal<=300,'ring of 25 at most 300 chunk-built meshes, global meshes not included (brief 3): '+ringTotal);
 const sparse=view.meshesOf(chunkKey(...Object.values(chunkIndex(-550,-550)))); // a wilds chunk with no data: ensure it first
 world.ensure(-550,-550,0);const wk=chunkKey(...Object.values(chunkIndex(-550,-550)));ok(view.meshesOf(wk)===0,'an empty chunk (wilds) adds 0 meshes: '+view.meshesOf(wk));
 world.ensure(1030,-1190,0);ok(view.meshesOf(chunkKey(14,0))===0,'the far corner chunk adds 0 meshes (R3b: the south-east corner is sea now, so the north-east one is the empty corner)');
 // every chunk of the old ground (42) built: the densest of all, and sparse ones stay at 3 or fewer (brief 3)
 const times=[];for(let j=range.j0;j<=range.j1;j++)for(let i=range.i0;i<=range.i1;i++){const b=chunkBounds(i,j),t=ms(),r=world.ensure((b.x0+b.x1)/2,(b.z0+b.z1)/2,0);if(r.built)times.push([ms()-t,chunkKey(i,j)])}
 const all=[];for(let j=range.j0;j<=range.j1;j++)for(let i=range.i0;i<=range.i1;i++)all.push(view.meshesOf(chunkKey(i,j)));
 const denseAll=Math.max(...all),sparseOnes=all.filter(c=>c<=3).length;
 ok(denseAll<=20,'densest of all 42 old-ground chunks at most 20 meshes (brief 3): '+denseAll);ok(sparseOnes>0&&all.some(c=>c>0),'there are sparse chunks (3 or fewer) and busy ones: '+sparseOnes+' sparse');
 ok(Math.min(...all)<=3,'the sparsest chunk adds at most 3 meshes: '+Math.min(...all));
 note('meshes: ring of 25 = '+ringTotal+' (limit 300), densest chunk '+denseAll+' (limit 20), sparsest '+Math.min(...all)+', empty chunk 0');
 // (1) whole-chunk build time (mask + live + meshes steps) for the chunks built AFTER the warm ring, i.e. steady state, cold first chunk excluded.
 // Brief 3: steps about 1 ms each, so a whole chunk (3 steps) is a few ms; limit 50 ms is the generous margin, median limit 15 ms.
 if(times.length>3){times.sort((a,b)=>a[0]-b[0]);const med=median(times.map(t=>t[0])),mx=times.at(-1)[0];ok(med<15,'(1) median whole-chunk build under 15 ms: '+med.toFixed(2));ok(mx<50,'(1) slowest whole-chunk build under 50 ms: '+mx.toFixed(2)+' ('+times.at(-1)[1]+')');
  note('whole chunk build (steady state, '+times.length+' chunks): median '+med.toFixed(2)+' ms, max '+mx.toFixed(2)+' (limits 15 / 50)')}}
{const s=view.stats().steps;note('step stats (cumulative, include the cold first chunk, informational): '+JSON.stringify(s,(k,x)=>typeof x==='number'?+x.toFixed(2):x))}

// ── (7) the whole-map 0.5 m mask is not built when streaming (brief 4 F2 "whole-map mask NOT built in the browser (assert in stats)") ──
{const s=view.stats();ok(s.maskCells===s.loaded*40000,'mask cells held are exactly the loaded tiles: '+s.maskCells);ok(s.maskCells<s.worldCells/4,'and far fewer than the whole world ('+s.worldCells+' cells)');
 ok(s.worldCells===270*40000,'the world is 270 chunks x 40,000 cells')}

// ── (8) memory proxy (brief 3: "mask tiles 49 x 120 KB = 6 MB") ──
{const c=createColliders(),idx=createChunkIndex({layout:worldLayout(),fences:fenceSegments(),range:WR}),v=createChunkView({index:idx,colliders:c,map:MAP,ring:3,keepRing:3});
 v.ensure(250,-700,3);const s=v.stats();ok(s.loaded===49,'7 x 7 keep ring loaded: '+s.loaded);ok(s.maskBytes<=49*120*1024,'mask tiles at most 49 x 120 KB = '+(49*120)+' KB: '+(s.maskBytes/1024)+' KB');
 ok(s.maskBytes===49*120000,'one tile is 40,000 cells x 3 layers = 120,000 bytes');note('mask memory: '+s.maskBytes/1024+' KB for 49 tiles (limit '+49*120+' KB)')
 // ── (5)(6) update budget, dispose pacing: a fake clock, so no wall-time asserts ──
 // (5) every step advances the clock 0.5 ms; with a 2 ms budget update() may run about 4 steps (one at least, then stop when spent)
 let t=0,adv=0.5,stepsRun=0;const v2=createChunkView({index:idx,colliders:createColliders(),map:MAP,now:()=>(t+=adv),budgetMs:2,disposeDelayMs:2000});
 const runs=[];let frames=0;while(v2.stats().loaded<25&&frames<500){const b=v2.stats(),s0=Object.values(b.steps).reduce((a,x)=>a+x.n,0);v2.update(250,-700,2);const s1=Object.values(v2.stats().steps).reduce((a,x)=>a+x.n,0);runs.push(s1-s0);frames++}
 ok(v2.stats().loaded===25,'the ring loads in '+frames+' frames');ok(Math.max(...runs)<=8,'(5) with a 2 ms budget and 0.5 ms per clock read, at most 8 steps run per call (each step reads the clock twice): '+Math.max(...runs));
 ok(Math.max(...runs)>=1&&frames>=5,'at least one step runs per call (progress) and the ring is spread over several frames: '+frames);
 ok(v2.stats().maxUpdateMs<=2+4*adv,'update() overshoots its budget by at most one step: '+v2.stats().maxUpdateMs.toFixed(2)+' ms on the fake clock');
 // (6) dispose: nothing while inside the keep ring, then one per frame and only after 2 s
 const d0=v2.stats().disposed;for(let k=0;k<5;k++)v2.update(250,-700,2);ok(v2.stats().disposed===d0,'(6) nothing disposed while chunks are inside the 7 x 7 keep ring');
 adv=0;t=0;for(let k=0;k<300;k++)v2.update(-300,-1100,2);const mid=v2.stats();ok(mid.disposed===d0,'chunks that left the keep ring are NOT disposed before 2 s: '+mid.disposed);
 t=1999;v2.update(-300,-1100,2);ok(v2.stats().disposed===d0,'1999 ms: still kept');
 t=2001;v2.update(-300,-1100,2);ok(v2.stats().disposed===d0+1,'2001 ms: exactly one chunk disposed in that frame');
 let max=0,prev=v2.stats().disposed;for(let k=0;k<80;k++){t+=16;v2.update(-300,-1100,2);const d=v2.stats().disposed;max=Math.max(max,d-prev);prev=d}
 ok(max===1&&prev>d0+1,'(6) never more than one dispose per frame, and the rest do follow: max '+max+', total '+(prev-d0));
 note('update budget: '+Math.max(...runs)+' steps/call max at 0.5 ms per step (limit 8), ring in '+frames+' frames; dispose 1 per frame after 2 s');
 v2.disposeAll();v.disposeAll()}

console.log(log.join('\n'));console.log('perf-gate: '+n+' checks passed');
