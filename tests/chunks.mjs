import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createWorld,worldLayout,fenceSegments,isWalkableLive as isWalkable} from '../dist/world.js';
import {createColliders} from '../dist/world.js';
import {MAP} from '../dist/map-definition.js';
import {buildTerrain,terrain} from '../dist/terrain.js';
import {CHUNK,FRAME,chunkIndex,chunkKey,chunkBounds,chunkRange,chunksAround,splitByChunk,splitByRect,createChunkIndex,maskTile,WORLD,worldRange} from '../dist/chunks.js';
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
const whole=terrain(),inGate=(x,z)=>MAP.gates.some(g=>x>=g.x0&&x<=g.x1&&z>=g.z0&&z<=g.z1);let sampled=0,tileMs=0,tiles=0,maxTile=0;
for(let j=range.j0;j<=range.j1;j++)for(let i=range.i0;i<=range.i1;i++){
 const t0=performance.now(),tile=maskTile(i,j);const ms=performance.now()-t0;tileMs+=ms;maxTile=Math.max(maxTile,ms);tiles++;ok(tile,'tile '+i+':'+j);
 const ox=Math.round((tile.x0-whole.x0)/whole.cell),oz=Math.round((tile.z0-whole.z0)/whole.cell);ok(Number.isInteger(ox)&&Number.isInteger(oz),'tile is cell aligned');
 for(let n=0;n<tile.walk.length;n+=7){const a=n%tile.cols,b=(n-a)/tile.cols,cx=tile.x0+(a+.5)*.5,cz=tile.z0+(b+.5)*.5,w=whole.index(cx,cz);if(w<0||inGate(cx,cz))continue;
  if(tile.walk[n]!==whole.walk[w]||tile.surface[n]!==whole.surface[w]||tile.zone[n]!==whole.zone[w])assert.fail('tile '+i+':'+j+' cell '+a+','+b+' differs from the whole mask');sampled++}}
tests++;
{ // every cell of one busy tile (the city and the river), not just a sample
 const tile=maskTile(4,12),ox=Math.round((tile.x0-whole.x0)/whole.cell),oz=Math.round((tile.z0-whole.z0)/whole.cell);let bad=0;
 for(let n=0;n<tile.walk.length;n++){const a=n%tile.cols,b=(n-a)/tile.cols,cx=tile.x0+(a+.5)*.5,cz=tile.z0+(b+.5)*.5,w=whole.index(cx,cz);if(w<0||inGate(cx,cz))continue;if(tile.walk[n]!==whole.walk[w]||tile.surface[n]!==whole.surface[w]||tile.zone[n]!==whole.zone[w])bad++}
 ok(bad===0,'the spawn chunk matches the whole mask cell for cell')}
ok(maskTile(0,0)&&maskTile(14,17)&&maskTile(0,0).walkable(-400,-1150),'F2: a chunk with no old ground has a tile too (the wilds)');
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
const RING=chunksAround(MAP.spawn.x,MAP.spawn.z,2,{range}).length,WRANGE=worldRange(),WRING=chunksAround(MAP.spawn.x,MAP.spawn.z,2,{range:WRANGE}).length;
const warns=[];const scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity,streaming:true}),view=world.chunks;
ok(view,'streaming world has a chunk view');
{const s=view.stats();ok(s.loaded===WRING&&WRING===25,'the 5 x 5 ring round the spawn is built when the world is (behind the loading screen): '+s.loaded);
 ok(view.isReady(MAP.spawn.x,MAP.spawn.z),'spawn chunk ready');ok(isWalkable(MAP.spawn.x,MAP.spawn.z)===terrain().walkable(MAP.spawn.x,MAP.spawn.z),'walkable agrees with the whole mask where loaded')}
{const farX=-200,farZ=-350; // the farm's far corner chunk (not loaded from the spawn)
 ok(!view.isReady(farX,farZ),'a far chunk is not loaded');const w=console.warn;console.warn=m=>warns.push(m);
 ok(isWalkable(farX,farZ)===false,'the wall: an unloaded chunk is not walkable');isWalkable(farX+1,farZ);console.warn=w;ok(warns.length===1&&/not loaded/.test(warns[0]),'one console warning per chunk, not one per query');
 const fixed=view.stats().wallHits;ok(fixed>=2,'wall hits are counted');
 const want=chunksAround(farX,farZ,1,{range:WRANGE}).filter(c=>!view.loadedKeys().includes(c.key)).length,r=world.ensure(farX,farZ);ok(r.built===want&&want>0&&r.ready===false,'ensure builds the 3 x 3 round a point and says it was not ready (a 0.3 s fade is due): '+JSON.stringify(r));
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
// ── F2: the world rectangle ──
ok(WORLD.x0===-450&&WORLD.x1===1050&&WORLD.z0===-1200&&WORLD.z1===600,'the world is x -450..1050, z -1200..600');
eq(MAP.world,{x0:-450,x1:1050,z0:-1200,z1:600},'the map names the world');eq(MAP.ground,{x0:-260,x1:300,z0:-390,z1:110},'the old ground (the whole-map mask, the tree layout) is unchanged');
ok(WRANGE.cols===15&&WRANGE.rows===18&&WRANGE.cols*WRANGE.rows===270,'the world is 15 x 18 = 270 chunks');
{ // every chunk has a tile; the tiles cover the world exactly; the 2 m picture of them has no hole and reaches every edge from the spawn
 const GW=Math.ceil((WORLD.x1-WORLD.x0)/2),GH=Math.ceil((WORLD.z1-WORLD.z0)/2),grid=new Uint8Array(GW*GH);let area=0,n=0,t0=performance.now(),wild=MAP.wilds,bad=[];
 for(let j=WRANGE.j0;j<=WRANGE.j1;j++)for(let i=WRANGE.i0;i<=WRANGE.i1;i++){const tile=maskTile(i,j);ok(tile,'every chunk of the world has a tile: '+i+':'+j);area+=tile.cols*tile.rows*tile.cell*tile.cell;n++;
  for(let b=1;b<tile.rows;b+=4)for(let a=1;a<tile.cols;a+=4){const x=tile.x0+(a+.5)*tile.cell,z=tile.z0+(b+.5)*tile.cell,w=tile.walk[b*tile.cols+a];grid[Math.floor((z-WORLD.z0)/2)*GW+Math.floor((x-WORLD.x0)/2)]=w;
   const inGround=whole.index(x,z)>=0,want=inGround?(inGate(x,z)?1:whole.walk[whole.index(x,z)]):(x>=wild.x0&&x<=wild.x1&&z>=wild.z0&&z<=wild.z1&&tile.surface[b*tile.cols+a]<6||tile.surface[b*tile.cols+a]>7?(x>=wild.x0&&x<=wild.x1&&z>=wild.z0&&z<=wild.z1?1:0):0);if(w!==want&&bad.length<5)bad.push([x,z,w,want])}}
 ok(n===270&&area===1500*1800,'the 270 tiles cover the world exactly ('+area+' m2)');eq(bad,[],'a tile cell is walkable exactly where the whole mask says (old ground), in a gate, or in the wilds');
 const seen=new Uint8Array(GW*GH),cell=(x,z)=>Math.floor((z-WORLD.z0)/2)*GW+Math.floor((x-WORLD.x0)/2),stack=[cell(MAP.spawn.x,MAP.spawn.z)];ok(grid[stack[0]]===1,'the spawn is walkable');seen[stack[0]]=1;
 while(stack.length){const c=stack.pop(),a=c%GW,b=(c-a)/GW;for(const [da,db] of [[1,0],[-1,0],[0,1],[0,-1]]){const p=a+da,q=b+db;if(p<0||q<0||p>=GW||q>=GH)continue;const d=q*GW+p;if(!seen[d]&&grid[d]){seen[d]=1;stack.push(d)}}}
 let holes=0,wildCells=0;const lost=[];for(let q=0;q<GH;q++)for(let p=0;p<GW;p++){const x=WORLD.x0+p*2+1,z=WORLD.z0+q*2+1;if(whole.index(x,z)<0&&x>=wild.x0+1&&x<=wild.x1-1&&z>=wild.z0+1&&z<=wild.z1-1){wildCells++;if(grid[q*GW+p]&&!seen[q*GW+p]){holes++;if(lost.length<6)lost.push([x,z])}}}
 ok(wildCells>580000&&holes===0,'from the spawn the whole wilds can be walked ('+wildCells+' samples, '+holes+' unreachable, first '+JSON.stringify(lost)+'): through the freight gate, to every edge');
 for(const [x,z] of [[wild.x0+1,wild.z0+1],[wild.x1-1,wild.z0+1],[wild.x0+1,wild.z1-1],[wild.x1-1,wild.z1-1],[0,wild.z0+1],[0,wild.z1-1],[wild.x0+1,-300],[wild.x1-1,-300]])ok(seen[cell(x,z)],'the spawn reaches the world edge at '+x+','+z);
 ok(!grid[cell(WORLD.x0+3,0)]&&!grid[cell(WORLD.x1-3,0)]&&!grid[cell(0,WORLD.z1-3)],'the outermost 10 m is a wall');
 console.log('world tiles: 270 tiles in '+(performance.now()-t0).toFixed(0)+' ms')}
// the streamed world: wilds are solid ground where loaded, empty chunks cost no draw call, and the whole-world mask is never built
{const far={x:650,z:-700},edge={x:1030,z:580},r=world.ensure(far.x,far.z);ok(r.built>0&&view.isReady(far.x,far.z),'a chunk of the wilds builds on demand');
 ok(isWalkable(far.x,far.z)===true&&isWalkable(far.x+7,far.z-9)===true,'the wilds are walkable where loaded');ok(view.meshesOf(chunkKey(...Object.values(chunkIndex(far.x,far.z))))===0,'an empty chunk adds no draw call of its own');
 world.ensure(edge.x,edge.z);ok(isWalkable(edge.x,edge.z)&&isWalkable(1039,589)&&!isWalkable(1045,589)&&!isWalkable(1030,596),'the far corner is walkable up to the 10 m wall');
 world.ensure(-430,-1180);ok(isWalkable(-439,-1189)&&!isWalkable(-445,-1189),'and the opposite corner');
 const s=view.stats();ok(s.chunkMeshes===0||s.chunkMeshes<=s.loaded*3,'meshes the chunks own: '+s.chunkMeshes+' for '+s.loaded+' loaded chunks');
 ok(s.maskCells===s.loaded*40000&&s.maskCells<s.worldCells/4,'tiles held: '+s.maskCells+' cells of a '+s.worldCells+' cell world; the whole-world mask is never built');
 ok(terrain().cols*terrain().rows===1120*1000,'the whole-map mask is still only the old ground (1.12 M cells), not the 10.8 M of the world');
 ok(isWalkable(MAP.spawn.x,MAP.spawn.z),'and the old block still walks')}
// ── F2: the merged ground of the chunks is exactly the loose ground of the plain world (same triangles, same area, same layer, same dashes) ──
{const looseScene=new THREE.Scene(),loose=createWorld(looseScene,{cullRadius:Infinity});
 for(let j=range.j0;j<=range.j1;j++)for(let i=range.i0;i<=range.i1;i++){const b=chunkBounds(i,j);world.ensure((b.x0+b.x1)/2,(b.z0+b.z1)/2,0)}
 for(let x=350;x<=600;x+=50)world.ensure(x,68,0); // R3a: Eden Road runs out into the wilds (x 290 to 600): its chunks hold the rest of the asphalt
 scene.updateMatrixWorld(true);looseScene.updateMatrixWorld(true);
 const A=new THREE.Vector3(),B=new THREE.Vector3(),C=new THREE.Vector3(),tally=(root,test)=>{const r={meshes:0,tri:0,area:0,up:0,factors:new Set(),inst:0,sum:0};root.traverse(o=>{if(!o.isMesh||!test(o.name))return;
   if(o.isInstancedMesh){r.meshes++;r.inst+=o.count;const m=new THREE.Matrix4();for(let k=0;k<o.count;k++){o.getMatrixAt(k,m);r.sum+=m.elements[12]+m.elements[13]*7+m.elements[14]*13}return}
   r.meshes++;r.factors.add(o.material.polygonOffsetFactor+'/'+o.material.polygonOffsetUnits);const g=o.geometry,p=g.attributes.position,ix=g.index,n=ix?ix.count:p.count;
   for(let k=0;k<n;k+=3){const a=ix?ix.getX(k):k,b=ix?ix.getX(k+1):k+1,c=ix?ix.getX(k+2):k+2;A.fromBufferAttribute(p,a).applyMatrix4(o.matrixWorld);B.fromBufferAttribute(p,b).applyMatrix4(o.matrixWorld);C.fromBufferAttribute(p,c).applyMatrix4(o.matrixWorld);
    const cr=(B.x-A.x)*(C.z-A.z)-(B.z-A.z)*(C.x-A.x);r.tri++;r.area+=Math.abs(cr)/2;if(cr<0)r.up++}});return r};
 for(const [kind,looseTest,mergedTest] of [['asphalt (roads, joints, lots)',n=>/^road-(?!line)|^lot-/.test(n),n=>/^ground-asphalt-/.test(n)],['driveways',n=>/^driveway-/.test(n),n=>/^ground-driveway-/.test(n)],['paths',n=>/^path-/.test(n),n=>/^ground-path-/.test(n)]]){
  const a=tally(looseScene,looseTest),b=tally(scene,mergedTest);
  ok(a.tri>0&&a.tri===b.tri,kind+': the same '+a.tri+' triangles ('+b.tri+')');ok(Math.abs(a.area-b.area)<1e-6*a.area,kind+': the same ground area ('+a.area.toFixed(1)+' m2 vs '+b.area.toFixed(1)+')');ok(a.up===b.up,kind+': every triangle faces the same way ('+a.up+' vs '+b.up+')');
  eq([...a.factors].length===1?[...a.factors]:[...a.factors],a.factors.size===1?[...b.factors]:[...a.factors],kind+': one ground layer rank');ok(b.meshes<a.meshes,kind+': fewer meshes ('+a.meshes+' loose, '+b.meshes+' merged in the ring... all 42 chunks)')}
 {const a=tally(looseScene,n=>/^road-line-/.test(n)),b=tally(scene,n=>/^road-lines-/.test(n));ok(a.inst>0&&a.inst===b.inst&&Math.abs(a.sum-b.sum)<1e-3*Math.abs(a.sum)+1e-3,'road dashes: '+a.inst+' instances, same places, '+a.meshes+' meshes become '+b.meshes)}
 // every old ground rect of the plain world is covered by chunks: split each ground rectangle by chunk and the pieces add back to the rectangle exactly
 {const rects=[...MAP.fields,...MAP.lots,...(MAP.paving||[]),...MAP.reserved.flatMap(p=>[p.driveway,p.path].filter(Boolean))];let bad=0;
  for(const r of rects){const m=splitByRect([r],q=>q,worldRange());let area=0;for(const [k] of m){const [i,j]=k.split(':').map(Number),b=chunkBounds(i,j);area+=(Math.min(r.x1,b.x1)-Math.max(r.x0,b.x0))*(Math.min(r.z1,b.z1)-Math.max(r.z0,b.z0))}if(Math.abs(area-(r.x1-r.x0)*(r.z1-r.z0))>1e-6)bad++}
  ok(rects.length>20&&bad===0,'ground rectangles (fields, lots, paving, driveways, paths): '+rects.length+' split by chunk and added back exactly')}
 // the flat ground is two planes for the whole world: they cover it, whatever the chunks hold
 {const planes=[];world.group.traverse(o=>{if(/^ground-(base|far)-/.test(o.name))planes.push(o)});const base=planes.filter(o=>/base/.test(o.name)),pts=[];base.forEach(o=>{o.geometry.computeBoundingBox();pts.push(o.geometry.boundingBox)});
  const x0=Math.min(...pts.map(b=>b.min.x)),x1=Math.max(...pts.map(b=>b.max.x)),z0=Math.min(...pts.map(b=>-b.max.y)),z1=Math.max(...pts.map(b=>-b.min.y));ok(x0<=WORLD.x0&&x1>=WORLD.x1&&z0<=WORLD.z0&&z1>=WORLD.z1,'the base ground covers the whole world: x '+x0+'..'+x1+', z '+z0+'..'+z1)}}
console.log('chunks: '+tests+' checks passed');
