// Shared map bake (MM2, notes/minimap-design.md sections 2 and 6): one BASE image (2 m/px) plus 0.5 m detail tiles (128 m, LRU cache), baked in slices under a per-frame ms budget, with the relief shade grid built once. Every map (corner, full screen, phone) draws crops of it. DOM only through the injected doc.createElement('canvas'); the clock is injected.
import {MAP} from './map-definition.js';
import {terrain,MINIMAP_COLOUR} from './terrain.js';
import {propInfo} from './props.js';
import {heightAt} from './height.js';
import {drawWaterLayer} from './water-chunks.js';
import {BASE_MPP,TILE_SIZE,TILE_MPP,TILE_PX,TILE_GUTTER} from './map-view.js';
// The area that is baked. Today's map view (530 x 440 m); MAP.world (1500 x 1800 m) is the planned whole world: pass it as `bounds` when the terrain mask grows to cover it (the BASE then costs about 12x more, see the note's measured table).
export const BAKE_BOUNDS=MAP.minimap.view;
export const BAKE_BUDGET_MS=3,TILE_CACHE=24,TILE_CACHE_FULL=32,SHADE_STEP=4,UNIT_PX=4096,TILE_IMG=TILE_PX+2*TILE_GUTTER;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const hit=(a,b,m=0)=>a.x0<b.x1+m&&a.x1>b.x0-m&&a.z0<b.z1+m&&a.z1>b.z0-m;
// Relief shading (0.34): a brightness for a world point from the ground's height: slopes facing the north-west light are brighter, the others darker, higher ground a little lighter and the river valley darker. 1 on flat ground.
const shade=(h,gx,gz)=>h===0&&gx===0&&gz===0?1:Math.max(.55,Math.min(1.5,1+(gx+gz)*2.2+Math.max(0,h)*.018+Math.min(0,h)*.12));
export function relief(x,z){const d=1.5,h=heightAt(x,z);if(h===0&&heightAt(x+d,z+d)===0&&heightAt(x-d,z-d)===0)return 1;return shade(h,(heightAt(x+d,z)-heightAt(x-d,z))/(2*d),(heightAt(x,z+d)-heightAt(x,z-d))/(2*d))}
// The shade is worked out once on a coarse grid (step metres) and sampled bilinearly per pixel. buildRows(n) does n grid rows of the work (heights first, then shades) so it can be sliced; at() clamps at the grid edge.
export function makeShadeGrid(b,hf=heightAt,step=SHADE_STEP){
 const gw=Math.ceil((b.x1-b.x0)/step)+1,gh=Math.ceil((b.z1-b.z0)/step)+1,hs=new Float32Array(gw*gh),out=new Float32Array(gw*gh);
 const hAt=(i,j)=>hs[clamp(j,0,gh-1)*gw+clamp(i,0,gw-1)];let phase=0,row=0;
 return {gw,gh,get ready(){return phase===2},
  buildRows(n){
   while(n-->0&&phase<2){
    if(phase===0)for(let i=0;i<gw;i++)hs[row*gw+i]=hf(b.x0+i*step,b.z0+row*step);
    else for(let i=0;i<gw;i++)out[row*gw+i]=shade(hs[row*gw+i],(hAt(i+1,row)-hAt(i-1,row))/(2*step),(hAt(i,row+1)-hAt(i,row-1))/(2*step));
    if(++row>=gh){row=0;phase++}}
   return phase===2},
  at(x,z){const fx=clamp((x-b.x0)/step,0,gw-1.001),fz=clamp((z-b.z0)/step,0,gh-1.001),i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j,o=j*gw+i;
   return (out[o]*(1-u)+out[o+1]*u)*(1-v)+(out[o+gw]*(1-u)+out[o+gw+1]*u)*v}};
}
// Ground colours: each pixel takes its cell's surface from the terrain mask, or its zone's colour on walkable grass, or meadow (as the old minimap did).
export function makeGround(map=MAP,t=terrain()){
 const rgb=c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)],surf=[];
 for(const [k,c] of Object.entries(MINIMAP_COLOUR))surf[+k]=rgb(c);
 return {t,surf,zones:map.zones.map(z=>rgb(z.color)),meadow:rgb('#3d5a3c')}}
// Paint rows y0..y1 of an image w px wide whose top-left is world (ox,oz) at mpp metres per pixel, into RGBA data (a Uint8ClampedArray).
export function paintRows(data,w,y0,y1,ox,oz,mpp,G,shadeAt){
 const {t,surf,zones,meadow}=G;
 for(let y=y0;y<y1;y++){const wz=oz+(y+.5)*mpp;
  for(let x=0;x<w;x++){const wx=ox+(x+.5)*mpp,c=t.index(wx,wz);let col=meadow;
   if(c>=0){const s=surf[t.surface[c]];if(s)col=s;else if(t.walk[c]&&t.zone[c])col=zones[t.zone[c]-1]}
   const sh=shadeAt(wx,wz),o=(y*w+x)*4;data[o]=col[0]*sh;data[o+1]=col[1]*sh;data[o+2]=col[2]*sh;data[o+3]=255}}}
// Footprints of the landmarks (houses, shops, barns, the sawmill), turned to face the way they stand, as polygons with a bounding box.
export function landmarkPolys(map=MAP){
 const out=[];
 for(const l of map.landmarks){if(l.decor)continue;const f=propInfo(l.prop).footprint,s=Math.sin(l.yaw),c=Math.cos(l.yaw);
  const pts=[[f.x0,f.z0],[f.x1,f.z0],[f.x1,f.z1],[f.x0,f.z1]].map(([x,z])=>[l.x+x*c+z*s,l.z-x*s+z*c]),xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]);
  out.push({pts,x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)})}
 return out}

// opts: doc (needs createElement('canvas')), bounds, now (ms clock), buildings [{x,z,hx,hz}], trees () => iterable of {x,z,standing}, map, heightFn, ground (makeGround result), budgetMs, cap, onJob(info).
export function createBake({doc,bounds=BAKE_BOUNDS,now=()=>performance.now(),buildings=[],trees=()=>[],map=MAP,heightFn=heightAt,ground=null,budgetMs=BAKE_BUDGET_MS,cap=TILE_CACHE,onJob=null}){
 const G=ground||makeGround(map),grid=makeShadeGrid(bounds,heightFn),bw=Math.ceil((bounds.x1-bounds.x0)/BASE_MPP),bh=Math.ceil((bounds.z1-bounds.z0)/BASE_MPP);
 const mk=(w,h)=>{const c=doc.createElement('canvas');c.width=w;c.height=h;return c};
 const base=mk(bw,bh),gm=TILE_GUTTER*TILE_MPP;
 const bRects=buildings.map(b=>({x0:b.x-b.hx,x1:b.x+b.hx,z0:b.z-b.hz,z1:b.z+b.hz})),polys=landmarkPolys(map),plots=map.reserved||[];
 const plotColour={residential:'#2fbf9f',commercial:'#b0529b',industrial:'#e0a02e'};
 let baseReady=false,needBase=true,job=null,queue=[],wanted=new Set(),center={x:0,z:0},work=null,baseWork=null,tick=0,lastEnd=-Infinity,version=0,capNow=cap;
 const cache=new Map(),pool=[],stats={jobs:0,pixels:0,baseMs:0,tileMs:0,tiles:0,lastTileMs:0,lastBaseMs:0,maxUnitMs:0};
 // Vector layers drawn over the ground of one image (box = its world box, mpp metres per pixel). `region` (a world box) limits the work to what touches it; the caller clips.
 const phases=[
  (ctx,box,mpp)=>{const k=1/mpp;drawWaterLayer(ctx,map,x=>(x-box.x0)*k,z=>(z-box.z0)*k,k)}, // lakes, sea, falls and new-form rivers (the old river is already in the terrain mask)
  (ctx,box,mpp,region)=>{const k=1/mpp,px=x=>(x-box.x0)*k,pz=z=>(z-box.z0)*k;
   ctx.fillStyle='#33383a';for(const r of bRects)if(hit(r,region))ctx.fillRect(px(r.x0),pz(r.z0),(r.x1-r.x0)*k,(r.z1-r.z0)*k);
   ctx.fillStyle='#3f4548';for(const p of polys){if(!hit(p,region))continue;ctx.beginPath();p.pts.forEach(([x,z],i)=>i?ctx.lineTo(px(x),pz(z)):ctx.moveTo(px(x),pz(z)));ctx.closePath();ctx.fill()}
   ctx.lineWidth=Math.max(1,.6*k);for(const p of plots)if(hit(p,region)){ctx.strokeStyle=plotColour[p.kind];ctx.strokeRect(px(p.x0),pz(p.z0),(p.x1-p.x0)*k,(p.z1-p.z0)*k)}}, // plot ids are drawn by the map as labels, not baked
  (ctx,box,mpp,region)=>{const k=1/mpp,s=Math.max(1,.9*k);ctx.fillStyle='#1f3a22';for(const t of trees())if(t.standing&&t.x>=region.x0-2&&t.x<=region.x1+2&&t.z>=region.z0-2&&t.z<=region.z1+2)ctx.fillRect((t.x-box.x0)*k-s/2,(t.z-box.z0)*k-s/2,s,s)}];
 function newJob(kind,tile){
  if(kind==='base'){const direct=!baseReady,canvas=direct?base:(baseWork||(baseWork=mk(bw,bh)));return {kind,key:'base',box:bounds,mpp:BASE_MPP,w:bw,h:bh,canvas,row:0,phase:0,ms:0,stale:false,done:false,img:null}}
  const box={x0:tile.x0-gm,x1:tile.x1+gm,z0:tile.z0-gm,z1:tile.z1+gm};if(!work)work=mk(TILE_IMG,TILE_IMG);
  return {kind,key:tile.key,tile,box,mpp:TILE_MPP,w:TILE_IMG,h:TILE_IMG,canvas:work,row:0,phase:0,ms:0,stale:false,done:false,img:null}}
 function commit(j){
  if(j.kind==='base'){if(j.canvas!==base)base.getContext('2d').drawImage(j.canvas,0,0);baseReady=true;if(j.stale)needBase=true}
  else{let e=cache.get(j.key);if(!e){e={canvas:pool.pop()||mk(TILE_IMG,TILE_IMG),tile:j.tile,last:0,dirty:false};cache.set(j.key,e)}
   e.canvas.getContext('2d').drawImage(j.canvas,0,0);e.dirty=j.stale;e.last=++tick;evict(j.key)}
  version++;j.done=true}
 function evict(keep){
  while(cache.size>capNow){let worst=null,wd=-1;
   for(const [k,e] of cache){if(k===keep)continue;const d=Math.hypot((e.tile.x0+e.tile.x1)/2-center.x,(e.tile.z0+e.tile.z1)/2-center.z)+(wanted.has(k)?0:1e5);if(d>wd){wd=d;worst=k}} // tiles the view no longer needs go first (farthest of them), then the farthest needed one
   if(worst===null)break;pool.push(cache.get(worst).canvas);cache.delete(worst)}}
 function runUnit(j){
  const ctx=j.canvas.getContext('2d');
  if(!grid.ready){grid.buildRows(4);return}
  if(j.row<j.h){
   if(j.row===0)j.img=ctx.createImageData?.(j.w,j.h)||null;
   const n=Math.max(1,Math.ceil(UNIT_PX/j.w)),y1=j.img?.data?Math.min(j.h,j.row+n):j.h;
   if(j.img?.data){paintRows(j.img.data,j.w,j.row,y1,j.box.x0,j.box.z0,j.mpp,G,grid.at);stats.pixels+=(y1-j.row)*j.w}
   j.row=y1;if(j.row>=j.h&&j.img?.data)ctx.putImageData(j.img,0,0);return}
  if(j.phase<phases.length){phases[j.phase++](ctx,j.box,j.mpp,j.box);return}
  commit(j)}
 function finish(j){
  job=null;stats.jobs++;
  if(j.kind==='base'){stats.baseMs+=j.ms;stats.lastBaseMs=j.ms}else{stats.tileMs+=j.ms;stats.tiles++;stats.lastTileMs=j.ms}
  onJob?.({kind:j.kind,key:j.key,ms:j.ms})}
 const next=()=>{if(job)return job;if(needBase){needBase=false;return job=newJob('base')}
  while(queue.length){const t=queue.shift(),e=cache.get(t.key);if(e&&!e.dirty)continue;return job=newJob('tile',t)}return null};
 // BASE patch for a small change (a felled tree): repaint the few ground pixels of the box and redraw the vector layers clipped to it. Synchronous, a few pixels.
 function patchBase(box){
  if(!baseReady||!grid.ready)return;
  const i0=clamp(Math.floor((box.x0-bounds.x0)/BASE_MPP),0,bw),i1=clamp(Math.ceil((box.x1-bounds.x0)/BASE_MPP),0,bw),j0=clamp(Math.floor((box.z0-bounds.z0)/BASE_MPP),0,bh),j1=clamp(Math.ceil((box.z1-bounds.z0)/BASE_MPP),0,bh),w=i1-i0,h=j1-j0;
  if(w<=0||h<=0)return;
  const ctx=base.getContext('2d'),region={x0:bounds.x0+i0*BASE_MPP,x1:bounds.x0+i1*BASE_MPP,z0:bounds.z0+j0*BASE_MPP,z1:bounds.z0+j1*BASE_MPP},img=ctx.createImageData?.(w,h);
  if(img?.data){paintRows(img.data,w,0,h,region.x0,region.z0,BASE_MPP,G,grid.at);ctx.putImageData(img,i0,j0)}
  ctx.save();ctx.beginPath();ctx.rect(i0,j0,w,h);ctx.clip();for(const p of phases)p(ctx,bounds,BASE_MPP,region);ctx.restore();version++}
 return {
  base,bounds,stats,get baseReady(){return baseReady},get version(){return version},get pending(){return !!job||needBase||queue.length>0},get cacheSize(){return cache.size},cacheKeys:()=>[...cache.keys()],
  // One slice: work units until `budget` ms are used (it may overrun by one unit, at most UNIT_PX pixels). A second call right after the first (two maps in one frame) does nothing.
  step(budget=budgetMs){
   const t0=now();if(t0-lastEnd<1)return false;let did=false;
   for(;;){const j=next();if(!j)break;const u0=now();runUnit(j);const t=now();j.ms+=t-u0;stats.maxUnitMs=Math.max(stats.maxUnitMs,t-u0);did=true;if(j.done)finish(j);if(t-t0>=budget)break}
   lastEnd=now();return did},
  // The tiles the view needs (tilesFor result, nearest first) and where the view is centred: queue the missing or dirty ones, drop queued ones that are no longer needed.
  want(tiles,c={x:0,z:0}){center=c;wanted=new Set(tiles.map(t=>t.key));queue=tiles.filter(t=>{const e=cache.get(t.key);return(!e||e.dirty)&&!(job&&job.key===t.key)})},
  // A ready tile as {canvas,dirty} (dirty = still the old picture while the new one bakes), or null.
  tile(key){const e=cache.get(key);if(!e)return null;e.last=++tick;return e},
  setCap(n){capNow=n;evict(null)},
  // Something changed in a circle (tree felled, stump cleared, regrowth): dirty the tiles under it and patch the BASE pixels. Returns the dirtied tile keys.
  invalidateAt(x,z,r=3){
   const box={x0:x-r,x1:x+r,z0:z-r,z1:z+r},out=[];
   for(const [k,e] of cache){const t=e.tile;if(hit({x0:t.x0-gm,x1:t.x1+gm,z0:t.z0-gm,z1:t.z1+gm},box)){e.dirty=true;out.push(k)}}
   if(job&&job.kind==='tile'&&hit(job.box,box))job.stale=true;
   patchBase(box);return out},
  // Rebake everything (the safe fallback).
  invalidateAll(){for(const e of cache.values())e.dirty=true;if(job)job.stale=true;needBase=true;if(!baseReady)needBase=true}
 };
}
let shared=null;
// The one bake every map draws from (corner map, full map, phone): made on first use for a document, reused after.
export function sharedBake(doc,opts={}){if(!shared||shared.doc!==doc)shared={doc,bake:createBake({doc,...opts})};return shared.bake}
export const resetSharedBake=()=>{shared=null};
