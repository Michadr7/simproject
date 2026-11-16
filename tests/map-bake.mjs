// MM2 (notes/minimap-design.md sections 2, 6, 8): the shared map bake. Fake canvases and a fake clock (no canvas in Node); the real ground colours are checked against the terrain mask.
import assert from 'node:assert/strict';
import {MAP} from '../dist/map-definition.js';
import {terrain,MINIMAP_COLOUR} from '../dist/terrain.js';
import {createBake,makeGround,makeShadeGrid,paintRows,landmarkPolys,BAKE_BOUNDS,BAKE_BUDGET_MS,UNIT_PX,TILE_IMG} from '../dist/map-bake.js';
import {tilesFor,BASE_MPP,TILE_PX} from '../dist/map-view.js';

const V=BAKE_BOUNDS,clock={t:0},fakeDoc=()=>{const log={created:0,put:[],draw:0};
 const doc={log,createElement(){log.created++;const c={width:0,height:0,getContext(){return c.ctx||(c.ctx=new Proxy({createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),putImageData:(i,x,y)=>log.put.push([x,y,i.width,i.height]),drawImage(){log.draw++}},{get:(o,k)=>o[k]??(()=>{}),set:()=>true}))}};return c}};return doc};
// a fake ground that charges the clock per pixel (index() is called once per pixel)
const PX_MS=.0005,ground=()=>({t:{index(){clock.t+=PX_MS;return -1},surface:[],walk:[],zone:[]},surf:[],zones:[],meadow:[60,90,60]});
const flat=()=>0,mk=(extra={})=>{clock.t=0;const doc=fakeDoc();return {doc,bake:createBake({doc,now:()=>clock.t,ground:ground(),heightFn:flat,trees:()=>[],buildings:[],...extra})}};
const drain=(bake,n=1e5)=>{for(let i=0;i<n&&bake.pending;i++){clock.t+=2;bake.step()}assert(!bake.pending,'drained')};

// 1. real ground: a road pixel is asphalt (times shade), grass is a zone colour, off-mask is meadow
{const T=terrain(),G=makeGround(MAP,T),oak=MAP.roads.nodes.oakWest,data=new Uint8ClampedArray(4);
 let found=0;for(let dx=-6;dx<=6&&!found;dx+=.5){const x=oak.x+dx,c=T.index(x,oak.z);if(c>=0&&T.surface[c]===3||T.surface[c]===2){paintRows(data,1,0,1,x-.25,oak.z-.25,.5,G,()=>1);const [r,g,b]=[69,73,75];assert.deepEqual([...data],[r,g,b,255],'asphalt');found=1}}
 assert(found,'found a street pixel');
 paintRows(data,1,0,1,V.x0-5000,V.z0-5000,.5,G,()=>.5);assert.deepEqual([...data],[30,45,30,255],'off the mask: meadow x shade');
 assert.equal(MINIMAP_COLOUR[2],'#45494b');
}
// 2. shade grid: sliced build equals the one-go build, 1 outside flat ground, clamps at the edge
{const hf=(x,z)=>Math.max(0,20-Math.hypot(x-50,z-50)/3),a=makeShadeGrid({x0:0,x1:100,z0:0,z1:100},hf),b=makeShadeGrid({x0:0,x1:100,z0:0,z1:100},hf);
 assert(!a.ready);let n=0;while(!a.buildRows(3))n++;assert(n>5,'sliced');b.buildRows(1e9);assert(b.ready);
 for(const [x,z] of [[10,10],[50,50],[73,21],[-30,500]])assert.equal(a.at(x,z),b.at(x,z));
 assert.equal(a.at(0,0),1,'flat ground = 1');assert.notEqual(a.at(40,50),1,'slope shaded');
}
// 3. landmark footprints are rotated polygons (not boxes)
{const polys=landmarkPolys(MAP);assert(polys.length>=20);assert(polys.every(p=>p.pts.length===4&&p.x1>p.x0&&p.z1>p.z0));
 const l=MAP.landmarks.find(l=>!l.decor),[a]=landmarkPolys({landmarks:[{...l,yaw:.5}]}),[b]=landmarkPolys({landmarks:[{...l,yaw:0}]});
 assert(Math.abs(a.pts[1][0]-a.pts[0][0])>1e-6&&Math.abs(a.pts[1][1]-a.pts[0][1])>1e-6,'a yaw of 0.5 gives a turned polygon, not a box');assert((a.x1-a.x0)>(b.x1-b.x0),'its bounding box grows')}
// 4. slicing: every call stays within the budget plus one unit, BASE is done before any tile, work is only done while something is missing
{const {bake}=mk(),order=[];bake.step(0);
 const bakeLog=[];const {bake:b2}=mk({onJob:i=>bakeLog.push(i.kind+':'+i.key)});
 const tiles=tilesFor({x0:V.x0,x1:V.x0+140,z0:V.z0,z1:V.z0+140,cx:V.x0+70,cz:V.z0+70},V);assert(tiles.length>=4&&tiles.length<=9);b2.want(tiles,{x:V.x0+70,z:V.z0+70});
 const unitMs=UNIT_PX*PX_MS,worst=[];let calls=0;
 while(b2.pending&&calls<2000){clock.t+=4;const t0=clock.t;b2.step();worst.push(clock.t-t0);calls++}
 assert(!b2.pending);assert(Math.max(...worst)<=BAKE_BUDGET_MS+unitMs+1e-9,'budget kept: '+Math.max(...worst));assert(Math.max(...worst)>1,'it did real work in slices');assert(calls>5,'spread over several frames: '+calls);
 assert.equal(bakeLog[0],'base:base','BASE first');assert.equal(bakeLog.length,1+tiles.length);assert.deepEqual(bakeLog.slice(1),tiles.map(t=>'tile:'+t.key),'tiles in the wanted order (nearest first)');
 assert(b2.baseReady);assert.equal(b2.cacheSize,tiles.length);
 clock.t+=10;assert.equal(b2.step(),false,'nothing missing: no work');
 // two maps stepping in one frame: the second call right after the first does nothing
 const {bake:b3}=mk();clock.t=100;assert.equal(b3.step(),true);assert.equal(b3.step(),false,'second call in the same frame');
}
// 5. the pixels baked match the images: BASE and tile sizes, a gutter of 1 px
{const {doc,bake}=mk(),t=tilesFor({x0:V.x0,x1:V.x0+10,z0:V.z0,z1:V.z0+10,cx:V.x0+5,cz:V.z0+5},V);bake.want(t,{x:V.x0+5,z:V.z0+5});drain(bake);
 assert.equal(bake.base.width,Math.ceil((V.x1-V.x0)/BASE_MPP));assert.equal(bake.base.height,Math.ceil((V.z1-V.z0)/BASE_MPP));
 assert.equal(TILE_IMG,TILE_PX+2);assert(doc.log.put.some(p=>p[2]===TILE_IMG&&p[3]===TILE_IMG),'a 258 x 258 tile image was put');
 assert.equal(bake.stats.jobs,1+t.length);assert(bake.stats.pixels>=bake.base.width*bake.base.height+TILE_IMG*TILE_IMG);
 const e=bake.tile(t[0].key);assert(e&&!e.dirty);assert.equal(bake.tile('99,99'),null);
}
// 6. the cache evicts the tile farthest from the view centre (tiles the view no longer needs first); canvases are recycled
{const {doc,bake}=mk({cap:3}),all=tilesFor({x0:V.x0,x1:V.x1,z0:V.z0,z1:V.z1,cx:(V.x0+V.x1)/2,cz:(V.z0+V.z1)/2},V);
 const row=all.filter(t=>t.j===0).sort((a,b)=>a.i-b.i),c0={x:(row[0].x0+row[0].x1)/2,z:(row[0].z0+row[0].z1)/2};
 bake.want(row.slice(0,3),c0);drain(bake);assert.deepEqual(bake.cacheKeys().sort(),row.slice(0,3).map(t=>t.key).sort());
 const made=doc.log.created;
 bake.want(row.slice(2,5),{x:(row[3].x0+row[3].x1)/2,z:(row[3].z0+row[3].z1)/2});drain(bake);
 assert.equal(bake.cacheSize,3);assert(!bake.cacheKeys().includes(row[0].key),'the tile farthest from the new centre (and no longer wanted) is gone');assert(bake.cacheKeys().includes(row[4].key));assert(bake.cacheKeys().includes(row[3].key));
 assert(doc.log.created-made<=1,'evicted canvases are reused: new canvases '+(doc.log.created-made));
 bake.setCap(2);assert.equal(bake.cacheSize,2);
}
// 7. invalidateAt dirties only the tiles under the circle (a 1 px gutter counts); the BASE is patched in place; stale tiles stay on screen until rebaked
{const {doc,bake}=mk(),all=tilesFor({x0:V.x0,x1:V.x1,z0:V.z0,z1:V.z1,cx:(V.x0+V.x1)/2,cz:(V.z0+V.z1)/2},V);bake.want(all,{x:0,z:0});drain(bake);assert.equal(bake.cacheSize,all.length);
 const t=all.find(t=>t.i===1&&t.j===1),mid={x:(t.x0+t.x1)/2,z:(t.z0+t.z1)/2},v0=bake.version,puts=doc.log.put.length;
 const hitKeys=bake.invalidateAt(mid.x,mid.z,3);assert.deepEqual(hitKeys,[t.key],'one tile under a mid-tile circle');
 assert(bake.version>v0,'BASE patch bumps the version');assert.equal(doc.log.put.length,puts+1,'BASE ground patched with one small putImageData');const p=doc.log.put[puts];assert(p[2]<=4&&p[3]<=4,'tiny patch '+p);
 assert.equal(bake.tile(t.key).dirty,true,'dirty but still drawable');assert.equal(bake.cacheKeys().length,all.length);
 const edge=bake.invalidateAt(t.x1,t.z1,3);assert.equal(edge.length,4,'a circle on a tile corner dirties the 4 tiles around it');
 // want() requeues the dirty ones, nearest first; after the bake none is dirty
 bake.want(all,{x:mid.x,z:mid.z});assert(bake.pending);drain(bake);assert(all.every(a=>!bake.tile(a.key).dirty),'rebaked');
 // an invalidation during a tile's own bake leaves it dirty after commit
 const {bake:b2}=mk(),one=all.slice(0,1);b2.want(one,{x:0,z:0});while(b2.stats.jobs<1){clock.t+=5;b2.step(1e-9)}clock.t+=5;b2.step(1e-9);assert(b2.pending&&b2.cacheSize===0,"the tile is part-way");const key=one[0].key;
 b2.invalidateAt(one[0].x0+10,one[0].z0+10,3);drain(b2);assert.equal(b2.tile(key).dirty,true,'changed while baking: baked again on the next want');
 b2.invalidateAll();assert(b2.pending,'invalidateAll rebakes the BASE');drain(b2);
}
// 8. the real map: one tile and the BASE bake with real terrain, no NaN, opaque
{clock.t=0;const doc=fakeDoc(),bake=createBake({doc,now:()=>performance.now(),buildings:MAP.buildings.map(b=>({x:b.x,z:b.z,hx:b.w/2,hz:b.d/2})),trees:()=>[{x:0,z:60,standing:true}]});
 const t0=performance.now();let n=0;while(bake.pending&&n++<1e5){bake.step(1e9)}assert(!bake.pending);assert(bake.baseReady);const ms=performance.now()-t0;
 assert(ms<2000,'the real BASE bakes fast in Node: '+ms.toFixed(0)+' ms');
}
console.log('PASS map-bake: shade grid, ground colours, rotated footprints, sliced budget, BASE first, LRU, invalidateAt, shared bake');
