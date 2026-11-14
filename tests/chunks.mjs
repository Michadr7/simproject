import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createWorld,worldLayout,fenceSegments,isWalkableLive as isWalkable} from '../dist/world.js';
import {createColliders} from '../dist/world.js';
import {MAP} from '../dist/map-definition.js';
import {buildTerrain,terrain} from '../dist/terrain.js';
import {CHUNK,FRAME,chunkIndex,chunkKey,chunkBounds,chunkRange,chunksAround,splitByChunk,splitByRect,createChunkIndex,maskTile} from '../dist/chunks.js';
import {createChunkView} from '../dist/chunks-view.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
let tests=0;const ok=(c,m)=>{assert(c,m);tests++};const eq=(a,b,m)=>{assert.deepEqual(a,b,m);tests++};

// ── chunk maths ──
eq(chunkIndex(-450,-1200),{i:0,j:0});eq(chunkIndex(-350.001,-1100.1),{i:0,j:0});eq(chunkIndex(-350,-1100),{i:1,j:1});eq(chunkIndex(1049.9,599.9),{i:14,j:17});
eq(chunkBounds(1,8),{x0:-350,z0:-400,x1:-250,z1:-300});ok(chunkKey(3,9)==='3:9','key');
ok((FRAME.x1-FRAME.x0)/CHUNK*((FRAME.z1-FRAME.z0)/CHUNK)===270,'15 x 18 frame');
const range=chunkRange();eq([range.i0,range.i1,range.j0,range.j1],[1,7,8,13],'today\'s ground touches chunks 1..7 x 8..13');ok(range.cols*range.rows===42,'42 chunks');
{const a=chunksAround(-5,15,2,{range});ok(a.length===20&&a[0].d===0,'the 5 x 5 round the spawn, cut to the map (rows 14+ have no ground): 20, own chunk first');ok(a.every((c,k)=>k===0||c.d>=a[k-1].d),'nearest ring first');
 const ahead=chunksAround(-5,15,1,{dir:{x:1,z:0},range}).filter(c=>c.d===1);ok(ahead[0].i>=ahead.at(-1).i&&ahead[0].ahead>=ahead.at(-1).ahead,'inside a ring the chunks ahead of the travel direction come first');
 ok(chunksAround(-255,-385,2,{range}).every(c=>c.i>=range.i0&&c.j>=range.j0),'the map\'s corner never lists a chunk outside the map')}

// ── buckets keep the global order ──
const layout=worldLayout(),fences=fenceSegments(),index=createChunkIndex({layout,fences});
const union=name=>{const out=[];for(const k of index.keys()){const {i,j}=Object.fromEntries(k.split(':').map((v,n)=>[n?'j':'i',+v]));out.push(...index.slice(i,j)[name])}return out};
for(const name of ['cuttable','decor']){const all=union(name).sort((a,b)=>a.gi-b.gi),src=layout[name];
 ok(all.length===src.length,name+': every tree is in exactly one chunk ('+all.length+' of '+src.length+')');ok(all.every((e,k)=>e.gi===k&&e.item===src[k]),'union of all chunk slices == worldLayout().'+name+' in order, same objects')}
for(const [name,src] of [['landmarks',MAP.landmarks]]){const all=union(name).sort((a,b)=>a.gi-b.gi);ok(all.length===src.length&&all.every((e,k)=>e.item===src[k]),name+' bucketed once each, in order')}
for(const [name,src] of [['fences',fences],['buildings',MAP.buildings],['fields',MAP.fields],['paving',MAP.paving||[]],['pavements',MAP.pavements||[]],['lots',MAP.lots||[]],['roads',MAP.roads.edges]]){
 const got=new Set(union(name).map(e=>e.gi));ok(got.size===src.length,name+': every item is in at least one chunk ('+got.size+' of '+src.length+')')}
{const m=splitByChunk([{x:-449,z:-1199},{x:-340,z:-1190},{x:-451,z:0}],o=>o,chunkRange({x0:-450,x1:-250,z0:-1200,z1:-1000}));ok(m.get('0:0').length===1&&m.get('1:0').length===1&&[...m.values()].flat().length===3,'a point outside the range lands in the nearest chunk of the range, never lost')}
{const m=splitByRect([{x0:-340,x1:-240,z0:-399,z1:-301}],r=>r);eq([...m.keys()].sort(),['1:8','2:8'],'a rectangle goes into every chunk it touches')}

// ── mask tiles equal the matching window of the whole mask (sampled 1 in 7) ──
const whole=terrain();let sampled=0,tileMs=0,tiles=0,maxTile=0;
for(let j=range.j0;j<=range.j1;j++)for(let i=range.i0;i<=range.i1;i++){
 const t0=performance.now(),tile=maskTile(i,j);const ms=performance.now()-t0;tileMs+=ms;maxTile=Math.max(maxTile,ms);tiles++;ok(tile,'tile '+i+':'+j);
 const ox=Math.round((tile.x0-whole.x0)/whole.cell),oz=Math.round((tile.z0-whole.z0)/whole.cell);ok(Number.isInteger(ox)&&Number.isInteger(oz),'tile is cell aligned');
 for(let n=0;n<tile.walk.length;n+=7){const a=n%tile.cols,b=(n-a)/tile.cols,w=(oz+b)*whole.cols+ox+a;
  if(tile.walk[n]!==whole.walk[w]||tile.surface[n]!==whole.surface[w]||tile.zone[n]!==whole.zone[w])assert.fail('tile '+i+':'+j+' cell '+a+','+b+' differs from the whole mask');sampled++}}
tests++;
{ // every cell of one busy tile (the city and the river), not just a sample
 const tile=maskTile(4,12),ox=Math.round((tile.x0-whole.x0)/whole.cell),oz=Math.round((tile.z0-whole.z0)/whole.cell);let bad=0;
 for(let n=0;n<tile.walk.length;n++){const a=n%tile.cols,b=(n-a)/tile.cols,w=(oz+b)*whole.cols+ox+a;if(tile.walk[n]!==whole.walk[w]||tile.surface[n]!==whole.surface[w]||tile.zone[n]!==whole.zone[w])bad++}
 ok(bad===0,'the spawn chunk matches the whole mask cell for cell')}
ok(maskTile(0,0)===null&&maskTile(14,17)===null,'a chunk with no ground has no tile');
ok(tileMs/tiles<5,'average mask tile under 5 ms ('+(tileMs/tiles).toFixed(2)+' ms, max '+maxTile.toFixed(2)+')');
console.log('mask tiles: '+tiles+' tiles, '+sampled+' cells compared, avg '+(tileMs/tiles).toFixed(2)+' ms, max '+maxTile.toFixed(2)+' ms');

// ── colliders: owner chunk, remove, live chunks ──
{const c=createColliders(),a=c.circle(0,0,1),b=c.box(-300,-350,2,2),far=c.circle(40,0,1);
 ok(a.chunk===chunkKey(4,12)&&b.chunk===chunkKey(1,8),'each collider is owned by the chunk its centre is in');ok(c.blocked(0,0)&&c.blocked(-300,-350),'solid by default (streaming off)');
 c.stream(true);ok(!c.blocked(0,0)&&!c.blocked(-300,-350),'streaming on: nothing is solid until its chunk is live');
 ok(c.setChunkLive(a.chunk,true)===2,'the chunk holds both colliders');ok(c.blocked(0,0)&&c.blocked(40,0)&&!c.blocked(-300,-350),'only live chunks are solid');
 c.setChunkLive(a.chunk,false);ok(!c.blocked(0,0),'a disposed chunk is not solid');c.setChunkLive(a.chunk,true);ok(c.blocked(0,0),'and solid again when it comes back');
 a.active=false;c.setChunkLive(a.chunk,false);c.setChunkLive(a.chunk,true);ok(!c.blocked(0,0),'a felled tree (active=false) stays felled across a dispose and a reload');
 c.remove(far);ok(!c.blocked(40,0)&&c.countIn(a.chunk)===1,'remove() takes a collider out for good');
 const late=c.circle(-300,-340,1);ok(late.off===true,'a collider made in a chunk that is not live starts off');c.stream(false);ok(c.blocked(-300,-340),'stream(false) puts everything back')}

// ── the streamer, on a real world ──
const RING=chunksAround(MAP.spawn.x,MAP.spawn.z,2,{range}).length;
const warns=[];const scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity,streaming:true}),view=world.chunks;
ok(view,'streaming world has a chunk view');
{const s=view.stats();ok(s.loaded===RING,'the ring round the spawn is built when the world is (behind the loading screen): '+s.loaded);
 ok(view.isReady(MAP.spawn.x,MAP.spawn.z),'spawn chunk ready');ok(isWalkable(MAP.spawn.x,MAP.spawn.z)===terrain().walkable(MAP.spawn.x,MAP.spawn.z),'walkable agrees with the whole mask where loaded')}
{const farX=-200,farZ=-350; // the farm's far corner chunk (not loaded from the spawn)
 ok(!view.isReady(farX,farZ),'a far chunk is not loaded');const w=console.warn;console.warn=m=>warns.push(m);
 ok(isWalkable(farX,farZ)===false,'the wall: an unloaded chunk is not walkable');isWalkable(farX+1,farZ);console.warn=w;ok(warns.length===1&&/not loaded/.test(warns[0]),'one console warning per chunk, not one per query');
 const fixed=view.stats().wallHits;ok(fixed>=2,'wall hits are counted');
 const want=chunksAround(farX,farZ,1,{range}).filter(c=>!view.loadedKeys().includes(c.key)).length,r=world.ensure(farX,farZ);ok(r.built===want&&want>0&&r.ready===false,'ensure builds the 3 x 3 round a point and says it was not ready (a 0.3 s fade is due): '+JSON.stringify(r));
 ok(view.isReady(farX,farZ)&&isWalkable(farX,farZ)===terrain().walkable(farX,farZ),'after ensure the ground is real and answers like the whole mask');
 ok(world.ensure(farX,farZ).built===0&&world.ensure(farX,farZ).ready===true,'ensuring a loaded place builds nothing and needs no fade')}
{ // update: budgeted, nearest first, disposal delayed and one per frame
 let t=0,adv=0;const col=createColliders(),v=createChunkView({index,colliders:col,map:MAP,now:()=>(t+=adv),budgetMs:2,disposeDelayMs:2000});
 const a=(x,z)=>v.update(x,z,2);a(-5,15);ok(v.stats().loaded===RING,'with a clock that never advances the budget is never spent, so one update loads the ring');v.disposeAll();t=0;
 let k0=0;adv=.25;const tick=()=>{};while(v.stats().loaded<RING&&k0<300){tick();a(-5,15);k0++}adv=0;ok(v.stats().loaded===RING&&v.isReady(-5,15)&&k0>2,'with a clock that runs, a 2 ms budget spreads the ring over '+k0+' updates');
 const base=v.stats().disposed;for(let k=0;k<3;k++)a(-5,15);ok(v.stats().disposed===base,'nothing is disposed while everything is in the keep ring');
 t=0;for(let k=0;k<400;k++)a(250,-250);const before=v.stats().loaded;ok(before>RING,'moving loads the new ring while the old chunks are kept (7 x 7)');
 t=1999;a(250,-250);const d0=v.stats().disposed;t=2001;a(250,-250);ok(v.stats().disposed-d0===1,'one chunk disposed per frame, only after 2 s outside the keep ring');
 const left=v.stats().disposed;for(let k=0;k<60;k++){t+=20;a(250,-250)}ok(v.stats().disposed>left,'the rest follow one frame at a time');
 v.disposeAll();ok(v.stats().loaded===0&&v.stats().tracked===0,'disposeAll frees everything')}
{ // real clock: how long does one budgeted update take while the ring fills?
 const col=createColliders(),v=createChunkView({index,colliders:col,map:MAP,scene:new THREE.Group(),build:{fences:s=>new THREE.Group()}});let worst=0,frames=0;
 while(v.stats().loaded<RING&&frames<500){const ms=v.update(-5,15,2);worst=Math.max(worst,ms);frames++}
 ok(v.stats().loaded===RING,'ring filled in '+frames+' frames');console.log('ring fill: '+frames+' frames at a 2 ms budget, worst frame '+worst.toFixed(2)+' ms, steps '+JSON.stringify(v.stats().steps,(k,x)=>typeof x==='number'?+x.toFixed(2):x))}
// trees are still global: streaming does not touch culling or the draw lists
{const plain=createWorld(new THREE.Scene(),{cullRadius:Infinity}),a=plain.cullStats(),b=world.cullStats();ok(a.total===b.total&&a.allTriangles===b.allTriangles,'streaming leaves the instanced trees alone ('+a.total+' trees, '+a.allTriangles+' triangles either way)')}
{const fencesIn=[];world.group.traverse(o=>{if(o.name==='fence-posts')fencesIn.push(o)});ok(fencesIn.length>0&&fencesIn.length<=25,'fence meshes exist only for loaded chunks: '+fencesIn.length+' pair(s)')}
console.log('chunks: '+tests+' checks passed');
