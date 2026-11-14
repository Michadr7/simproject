// Chunks (F1, pure: no three.js, safe for tests). The world is cut into 100 m squares on ONE fixed frame (the frame F2 will grow into, 15 x 18 = 270 chunks); today's map
// (ground x -260..300, z -390..110) touches 7 x 6 of them. Chunks only BUCKET data: worldLayout() stays the single source of every tree and every item keeps its GLOBAL index (`gi`),
// so the layout hash, the tree order and the saved tree keys never change.
import {MAP} from './map-definition.js';
import {buildTerrain,roadCenterline} from './terrain.js';

export const CHUNK=100;
export const FRAME=Object.freeze({x0:-450,z0:-1200,x1:1050,z1:600});
export const FRAME_COLS=(FRAME.x1-FRAME.x0)/CHUNK; // 15
export const FRAME_ROWS=(FRAME.z1-FRAME.z0)/CHUNK; // 18

export const chunkIndex=(x,z)=>({i:Math.floor((x-FRAME.x0)/CHUNK),j:Math.floor((z-FRAME.z0)/CHUNK)});
export const chunkKey=(i,j)=>i+':'+j;
export const parseChunkKey=key=>{const [i,j]=key.split(':').map(Number);return {i,j}};
export const chunkBounds=(i,j)=>({x0:FRAME.x0+i*CHUNK,z0:FRAME.z0+j*CHUNK,x1:FRAME.x0+(i+1)*CHUNK,z1:FRAME.z0+(j+1)*CHUNK});
// The chunk rectangle (inclusive indices) that covers a ground rectangle: today's map by default.
export function chunkRange(ground=MAP.ground){const a=chunkIndex(ground.x0,ground.z0),b=chunkIndex(ground.x1-1e-6,ground.z1-1e-6);return Object.freeze({i0:a.i,j0:a.j,i1:b.i,j1:b.j,cols:b.i-a.i+1,rows:b.j-a.j+1})}
export const inRange=(range,i,j)=>i>=range.i0&&i<=range.i1&&j>=range.j0&&j<=range.j1;
export const clampToRange=(range,i,j)=>({i:Math.max(range.i0,Math.min(range.i1,i)),j:Math.max(range.j0,Math.min(range.j1,j))});

// Chunks within `ring` chunks (Chebyshev) of the one holding (x, z), nearest ring first; inside a ring the ones ahead of the travel direction `dir` ({x,z}) come first.
export function chunksAround(x,z,ring,{dir=null,range=null}={}){
 const c=chunkIndex(x,z),out=[],len=dir?Math.hypot(dir.x,dir.z):0;
 for(let dj=-ring;dj<=ring;dj++)for(let di=-ring;di<=ring;di++){
  const i=c.i+di,j=c.j+dj;if(range&&!inRange(range,i,j))continue;
  const b=chunkBounds(i,j),d=Math.max(Math.abs(di),Math.abs(dj)),ahead=len>1e-6?((b.x0+b.x1)/2-x)*dir.x/len+((b.z0+b.z1)/2-z)*dir.z/len:0;
  out.push({i,j,d,key:chunkKey(i,j),ahead,near:Math.hypot((b.x0+b.x1)/2-x,(b.z0+b.z1)/2-z)});
 }
 out.sort((a,b)=>a.d-b.d||(len>1e-6?b.ahead-a.ahead:a.near-b.near)||a.j-b.j||a.i-b.i);
 return out;
}

// Bucket items by chunk. Every item is kept as {gi, item}: gi is its index in the source list, so the source order can always be rebuilt (sort by gi).
// getXZ(item) -> {x,z} puts a point in one chunk; with `range` a point outside it goes to the nearest chunk of the range, so nothing is ever lost.
export function splitByChunk(items,getXZ,range=null){
 const map=new Map();
 items.forEach((item,gi)=>{const p=getXZ(item);let {i,j}=chunkIndex(p.x,p.z);if(range)({i,j}=clampToRange(range,i,j));const k=chunkKey(i,j);if(!map.has(k))map.set(k,[]);map.get(k).push({gi,item})});
 return map;
}
// Same for things with an extent (rectangles, segments): the item goes into EVERY chunk it touches, still with its global index.
export function splitByRect(items,getRect,range=null){
 const map=new Map();
 items.forEach((item,gi)=>{const r=getRect(item),a=chunkIndex(Math.min(r.x0,r.x1),Math.min(r.z0,r.z1)),b=chunkIndex(Math.max(r.x0,r.x1)-1e-9,Math.max(r.z0,r.z1)-1e-9);
  for(let j=a.j;j<=b.j;j++)for(let i=a.i;i<=b.i;i++){if(range&&!inRange(range,i,j))continue;const k=chunkKey(i,j);if(!map.has(k))map.set(k,[]);map.get(k).push({gi,item})}});
 return map;
}

// chunkData: the slice of every list for one chunk. Computed once from the map data (small); the meshes are the big part and are built per chunk later.
export function createChunkIndex({layout,fences,map=MAP,range=chunkRange(map.ground)}){
 const pt=o=>o,box=b=>({x0:b.x-b.w/2,x1:b.x+b.w/2,z0:b.z-b.d/2,z1:b.z+b.d/2}),rect=r=>r;
 const lists={
  cuttable:splitByChunk(layout.cuttable,pt,range),decor:splitByChunk(layout.decor,pt,range),landmarks:splitByChunk(map.landmarks,pt,range),
  fences:splitByRect(fences,s=>({x0:s.x0,x1:s.x1,z0:s.z0,z1:s.z1}),range),buildings:splitByRect(map.buildings,box,range),
  paving:splitByRect(map.paving||[],rect,range),pavements:splitByRect(map.pavements||[],rect,range),lots:splitByRect(map.lots||[],rect,range),fields:splitByRect(map.fields,rect,range),
  roads:new Map()
 };
 map.roads.edges.forEach((edge,gi)=>{const line=roadCenterline(edge,map),seen=new Set();
  for(let s=0;s<line.length;s++){const [ax,az]=line[s],[bx,bz]=s?line[s-1]:line[s],len=Math.hypot(ax-bx,az-bz),steps=Math.max(1,Math.ceil(len/25));
   for(let u=0;u<=steps;u++){const x=bx+(ax-bx)*u/steps,z=bz+(az-bz)*u/steps;let {i,j}=chunkIndex(x,z);({i,j}=clampToRange(range,i,j));const k=chunkKey(i,j);if(seen.has(k))continue;seen.add(k);if(!lists.roads.has(k))lists.roads.set(k,[]);lists.roads.get(k).push({gi,item:edge})}}});
 const names=Object.keys(lists),empty=Object.freeze([]);
 return {
  range,names,
  keys(){const out=[];for(let j=range.j0;j<=range.j1;j++)for(let i=range.i0;i<=range.i1;i++)out.push(chunkKey(i,j));return out},
  slice(i,j){const key=chunkKey(i,j),out={key,i,j,bounds:chunkBounds(i,j)};for(const n of names)out[n]=lists[n].get(key)||empty;return out},
  list:name=>lists[name]
 };
}

// The 0.5 m walk/surface/zone mask of one chunk (200 x 200 cells = 40,000 per layer, 120 KB), painted by the SAME code as the whole-map build and clipped to the chunk
// (and to the ground at the map's edge). Every cell equals the matching cell of buildTerrain(map): tests/chunks.mjs compares them.
export function maskTile(i,j,map=MAP){
 const b=chunkBounds(i,j),g=map.ground,w={x0:Math.max(b.x0,g.x0),x1:Math.min(b.x1,g.x1),z0:Math.max(b.z0,g.z0),z1:Math.min(b.z1,g.z1)};
 if(w.x1<=w.x0||w.z1<=w.z0)return null;
 return buildTerrain(map,{window:w});
}
