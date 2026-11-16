// GD5 (notes/ground-detail-design.md 2b, 4): the pure parts of the ground cover wiring: the real per-chunk sampler (cover-sampler.js), the baked MegaKit models and the code-made reeds and crop (cover-assets.js, cover-pack.js) and the shader patch (ground-cover-view.js). The view's three.js side is checked by the packaged-release tests; nothing here needs a GPU.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chamfer,rectDistance,turnedRect,footprintRects,makeCoverSampler,FAR} from '../dist/cover-sampler.js';
import {decodeModel,reedModel,cropModel,kindModel,kindRuns,packRun,kindUniform,COVER_SINK} from '../dist/cover-pack.js';
import {COVER_ATLAS,COVER_MODELS} from '../dist/cover-assets.js';
import {patchCoverShader,COVER_UP} from '../dist/ground-cover-view.js';
import {coverFor,coverStats,COVER_RULES,COVER_KINDS,COVER_TIER,SURF} from '../dist/ground-cover-rules.js';
import {WIND_KIND_MUL} from '../dist/wind.js';
import {maskTile,chunkBounds} from '../dist/chunks.js';
import {heightAt} from '../dist/height.js';
import {MAP} from '../dist/map-definition.js';
import {FOOTING} from '../dist/terrain.js';

// chamfer distance: one set cell, distances in cells
{const cols=9,rows=9,m=new Uint8Array(cols*rows);m[4*cols+4]=1;const D=chamfer(m,cols,rows);assert.equal(D[4*cols+4],0);assert.equal(D[4*cols+7],3);assert.ok(Math.abs(D[7*cols+7]-3*Math.SQRT2)<1e-5);assert.ok(D[0]<=4*Math.SQRT2+1e-5);
 const empty=chamfer(new Uint8Array(16),4,4);assert.ok(empty.every(v=>v>=1e8),'no set cell: everything far')}
// rect distance and turned footprints
assert.equal(rectDistance({x0:0,x1:2,z0:0,z1:2},1,1),0);assert.equal(rectDistance({x0:0,x1:2,z0:0,z1:2},5,1),3);assert.ok(Math.abs(rectDistance({x0:0,x1:2,z0:0,z1:2},5,6)-5)<1e-9);
{const r=turnedRect({x0:-1,x1:3,z0:-2,z1:2},10,20,0);assert.deepEqual(r,{x0:9,x1:13,z0:18,z1:22});const q=turnedRect({x0:-1,x1:3,z0:-2,z1:2},10,20,Math.PI/2);assert.ok(Math.abs(q.x1-q.x0-4)<1e-9&&Math.abs(q.z1-q.z0-4)<1e-9);
 const q2=turnedRect({x0:0,x1:6,z0:0,z1:2},0,0,Math.PI/2);assert.ok(Math.abs((q2.x1-q2.x0)-2)<1e-9&&Math.abs((q2.z1-q2.z0)-6)<1e-9,'a quarter turn swaps the sides');
 assert.equal(footprintRects([{x:0,z:0,w:4,d:2}],[{x:5,z:5,yaw:0,footprint:{x0:-1,x1:1,z0:-1,z1:1}},{x:9,z:9,yaw:0}]).length,2,'a prop without footprint is skipped')}
// the sampler on a synthetic chunk: a road strip along x (z 40..46), water in the south-west corner, a ramp in height, one building
{const b={x0:0,z0:0,x1:100,z1:100},surf=(x,z)=>z>=40&&z<46?SURF.ROAD:(x<20&&z<20?SURF.WATER:SURF.GRASS),s=makeCoverSampler({bounds:b,surfaceAt:surf,heightAt:(x,z)=>x*.1,rects:[{x0:70,x1:80,z0:70,z1:80},{x0:500,x1:510,z0:500,z1:510}],biomeAt:()=>'farm'});
 assert.equal(s.stats.rects,1,'only the rects near the chunk are kept');assert.equal(s.biomeAt(1,1),'farm');
 assert.ok(s.roadDist(50,50)>=3&&s.roadDist(50,50)<=5,'4 m north of the road edge, got '+s.roadDist(50,50));assert.equal(s.roadDist(50,43),0);assert.ok(s.roadDist(50,46.8)<1.2,'next to the road');assert.ok(Math.abs(s.roadDist(50,80)-34)<1.5,'34 m from the road');assert.equal(s.roadDist(50,200),FAR,'outside the grid');
 assert.ok(s.waterDist(25,5)>=4&&s.waterDist(25,5)<=6,'water 5 m west, got '+s.waterDist(25,5));assert.equal(s.waterDist(5,5),0);
 assert.equal(s.buildingDist(75,75),0);assert.ok(Math.abs(s.buildingDist(65,75)-5)<1e-9);assert.ok(Math.abs(s.slopeAt(50,50)-.1)<.01,'slope of the ramp '+s.slopeAt(50,50));assert.ok(Math.abs(s.heightAt(33,57)-3.3)<.01,'height grid is bilinear');
 const sNoRoad=makeCoverSampler({bounds:b,surfaceAt:()=>SURF.GRASS,heightAt:null});assert.equal(sNoRoad.roadDist(5,5),FAR);assert.equal(sNoRoad.slopeAt(5,5),0)}
// the real sampler on real chunks of the map: nothing on roads or water, clearances kept, seamless borders, placement time
const rects=footprintRects(MAP.buildings,[]);
function realChunk(i,j,tier='high'){const b=chunkBounds(i,j),tile=maskTile(i,j,MAP);if(!tile)return null;const surfaceAt=(x,z)=>tile.surfaceAt(x,z),biomeAt=(x,z)=>{const zn=tile.zoneAt(x,z);return zn&&zn.id==='forest'?'forest':zn&&zn.id==='farm'?'farm':'open'};
 const t0=performance.now(),s=makeCoverSampler({bounds:b,surfaceAt,heightAt,biomeAt,rects}),t1=performance.now(),list=coverFor(i,j,4242,s,{tier,bounds:b}),t2=performance.now();return {b,tile,s,list,surfaceAt,samplerMs:t1-t0,placeMs:t2-t1}}
const timings=[];let anyWater=0,anyRoadNear=0,total=0;
for(const [i,j] of [[4,9],[5,10],[6,8],[3,9],[4,10],[5,9],[6,10],[4,8]]){const c=realChunk(i,j);if(!c)continue;timings.push(c.samplerMs+c.placeMs);total+=c.list.length;
 for(const e of c.list){const r=COVER_RULES[e.kind],surf=c.surfaceAt(e.x,e.z);assert.ok(r.surf[surf]>0,e.kind+' on surface '+surf+' is not allowed');assert.ok(e.x>=c.b.x0&&e.x<c.b.x1&&e.z>=c.b.z0&&e.z<c.b.z1,'inside the chunk');
  assert.ok(c.s.roadDist(e.x,e.z)>=r.roadMin-1e-9&&c.s.buildingDist(e.x,e.z)>=r.buildMin-1e-9&&c.s.waterDist(e.x,e.z)>=r.waterMin-1e-9&&c.s.slopeAt(e.x,e.z)<=r.maxSlope+1e-9,e.kind+' clearances');
  if(r.roadMin>=1){let near=false;for(let a=0;a<12&&!near;a++){const th=a/12*Math.PI*2,rr=Math.max(0,r.roadMin-.9);const sv=c.surfaceAt(e.x+Math.cos(th)*rr,e.z+Math.sin(th)*rr);if(sv===SURF.STREET||sv===SURF.ROAD||sv===SURF.PAVEMENT)near=true}assert.ok(!near,e.kind+' keeps its distance from the road (tile check)');anyRoadNear++}
  if(r.waterBand)assert.ok(c.s.waterDist(e.x,e.z)>=r.waterBand[0]-.01&&c.s.waterDist(e.x,e.z)<=r.waterBand[1]+.01,'reed band')}
 const kinds=new Set(c.list.map(e=>e.kind));assert.ok(kinds.has('grass'),'chunk '+i+':'+j+' has grass');
 const again=coverFor(i,j,4242,c.s,{tier:'high',bounds:c.b});assert.deepEqual(again.map(e=>[e.kind,e.x,e.z]),c.list.map(e=>[e.kind,e.x,e.z]),'deterministic');
 assert.ok(coverStats(c.list).drawCalls<=11,'draw calls per chunk '+coverStats(c.list).drawCalls)}
assert.ok(total>10000&&anyRoadNear>0,'real chunks grow cover ('+total+')');
{const a=realChunk(4,9),b=realChunk(5,9),seen=new Set();for(const e of a.list.concat(b.list)){const k=e.kind+'|'+e.x.toFixed(4)+'|'+e.z.toFixed(4);assert.ok(!seen.has(k),'no instance twice across the border');seen.add(k)}
 const east=a.list.filter(e=>e.x>a.b.x1-3),west=b.list.filter(e=>e.x<b.b.x0+3);assert.ok(east.length>0&&west.length>0,'cover reaches both sides of the border')}
{const t=timings.slice(2).sort((p,q)=>p-q);assert.ok(timings.length>=6);assert.ok(t[t.length-1]<120,'placement of one chunk under 120 ms even cold, got '+t[t.length-1])}
// instance packing
{const list=[{kind:'grass',x:10,z:20,scale:2,yaw:0,tint:[.5,.6,.7],rank:.25,phase:1},{kind:'grass',x:11,z:21,scale:1,yaw:Math.PI/2,tint:[1,1,1],rank:.5,phase:2},{kind:'rock',x:12,z:22,scale:1,yaw:1,tint:[1,1,1],rank:0,phase:0}];
 assert.deepEqual(kindRuns(list),[{kind:'grass',from:0,to:2},{kind:'rock',from:2,to:3}]);const M=new Float32Array(32),C=new Float32Array(6),I=new Float32Array(4);
 const box=packRun(list,0,2,()=>3,()=>SURF.GRASS,{matrix:M,color:C,inst:I});{const want=[2,0,0,0,0,2,0,0,0,0,2,0,10,3+FOOTING[SURF.GRASS]-COVER_SINK,20,1];want.forEach((w,k)=>assert.ok(Math.abs(M[k]-w)<1e-6,'matrix element '+k+' = '+M[k]));}
 assert.ok(Math.abs(M[16]-0)<1e-6&&Math.abs(M[18]+1)<1e-6&&Math.abs(M[24]-1)<1e-6&&Math.abs(M[26])<1e-6,'yaw 90 turns x into -z');assert.deepEqual([...C.slice(0,3)].map(v=>+v.toFixed(2)),[.5,.6,.7]);assert.deepEqual([...I.slice(0,2)],[.25,1]);assert.equal(box.minX,10);assert.equal(box.maxZ,21);
 const u=kindUniform('grass',{near:30,far:60},1,.5);assert.deepEqual(u,[30,60,1,2]);assert.equal(kindUniform('x',{near:1,far:2},1,0)[3],0)}
// the baked models: one per kind that the rules take from the kit, small, sane, UVs inside the atlas
{const need=COVER_KINDS.filter(k=>COVER_RULES[k].models[0]!==null);assert.ok(need.length>=9);const size=fs.statSync(new URL('../dist/cover-assets.js',import.meta.url)).size;assert.ok(size<450000,'cover-assets.js stays small (startup is untouched: it loads lazily), got '+size);
 for(const k of need){const m=COVER_MODELS[k];assert.ok(m,'model for '+k);assert.equal(m.source,COVER_RULES[k].models[0],k+' uses the first model of its rule (one variant)');const d=decodeModel(m);assert.equal(d.pos.length,d.nrm.length);assert.equal(d.uv.length/2,d.pos.length/3);assert.equal(d.col.length,d.pos.length);assert.ok(d.idx.length%3===0&&d.idx.length/3===m.tris);
  let maxIdx=0;for(const v of d.idx)if(v>maxIdx)maxIdx=v;assert.ok(maxIdx<d.pos.length/3,'indices in range');for(const v of d.pos)assert.ok(Number.isFinite(v));for(const v of d.uv)assert.ok(v>=0&&v<=1,'uv inside the atlas');
  let maxY=-1e9,minY=1e9;for(let q=1;q<d.pos.length;q+=3){maxY=Math.max(maxY,d.pos[q]);minY=Math.min(minY,d.pos[q])}assert.ok(maxY>.02&&maxY<1.6,k+' height '+maxY);assert.ok(minY>-.3,'root near y 0 (the bush skirt sinks a little)');assert.ok(m.tris<=1000,k+' tris '+m.tris)}
 assert.ok(COVER_ATLAS.png.startsWith('data:image/png;base64,')&&COVER_ATLAS.png.length<120000&&COVER_ATLAS.width===512&&COVER_ATLAS.height===384,'one small atlas');assert.ok(COVER_ATLAS.white.u>0&&COVER_ATLAS.white.u<1);
 for(const k of ['reed','crop']){const d=kindModel(k,{white:COVER_ATLAS.white,models:COVER_MODELS});assert.ok(d&&d.idx.length>=60&&d.idx.length<=300,k+' is code-made and tiny');assert.equal(d.pos.length,d.col.length);let mx=0;for(const v of d.idx)mx=Math.max(mx,v);assert.ok(mx<d.pos.length/3)}
 assert.equal(reedModel(COVER_ATLAS.white).height,1);assert.equal(cropModel(COVER_ATLAS.white).height,.8);
 for(const k of COVER_KINDS){assert.ok(k in WIND_KIND_MUL,k+' has a wind multiplier');assert.ok(k in COVER_UP,k+' has a normal lean');if(COVER_RULES[k].models[0]===null)assert.ok(kindModel(k,{white:COVER_ATLAS.white,models:COVER_MODELS}),k+' has a code-made shape')}
 assert.equal(WIND_KIND_MUL.rock,0);assert.equal(WIND_KIND_MUL.pebble,0)}
// the shader patch (pure string work)
{const v='#include <common>\nvoid main(){\n#include <beginnormal_vertex>\n#include <begin_vertex>\n#include <project_vertex>\n}',fr='void main(){\n#include <normal_fragment_begin>\n}',chunk='float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;',p=patchCoverShader(v,fr,chunk);
 for(const need of ['uKind','uWind','uWindT','aInst','cameraPosition','smoothstep','mvPosition.xz+=uWind.xy*cvM'])assert.ok(p.vertexShader.includes(need),'vertex shader has '+need);assert.ok(!/#include <(begin_vertex|project_vertex|beginnormal_vertex)>/.test(p.vertexShader),'all three chunks replaced');assert.ok(p.vertexShader.includes('#include <common>'),'common kept');
 assert.ok(p.fragmentShader.includes('faceDirection = 1.0')&&!p.fragmentShader.includes('#include <normal_fragment_begin>'),'back faces keep the normal');assert.equal(patchCoverShader(v,fr,null).fragmentShader,fr,'without the chunk text the fragment shader is untouched')}
// the tier: one variant per kind keeps High at 11 draw calls or fewer
assert.equal(COVER_TIER.high.variants,1);
const med=timings.slice(2).reduce((a,b)=>a+b,0)/Math.max(1,timings.length-2);
console.log('INFO real chunks: '+timings.length+', '+total+' instances, sampler+placement ms per chunk (after 2 warm-up): avg '+med.toFixed(1)+', max '+Math.max(...timings.slice(2)).toFixed(1)+'; cover-assets.js '+fs.statSync(new URL('../dist/cover-assets.js',import.meta.url)).size+' bytes');
console.log('cover-view: ok');
