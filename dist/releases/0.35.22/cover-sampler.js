// GD5 ground cover sampler (notes/ground-detail-design.md 2b): builds the real sampler that ground-cover-rules.js coverFor() reads, for ONE chunk, from the chunk's surface mask, the map's building footprints and the terrain height; pure, no DOM, no three.js.
// Distances to road and water come from a chamfer distance transform over the chunk plus a margin (one pass per chunk, O(1) per question afterwards); the slope and the planting height come from one height grid.
import {SURF} from './ground-cover-rules.js';
export const SAMPLER_MARGIN=6; // metres of neighbour ground read round the chunk (the largest clearance is 4 m of reed band plus the cell size)
export const SAMPLER_CELL=.5; // metres: the distance transform cell (the surface mask's own cell)
export const SAMPLER_HEIGHT_CELL=2; // metres: the height grid cell (the hill meshes are 2 m grids)
export const ROAD_SURFACES=Object.freeze([SURF.STREET,SURF.ROAD,SURF.DIRT,SURF.PAVEMENT,SURF.BRIDGE,SURF.DRIVEWAY,SURF.GRAVEL]); // what counts as "road" for roadDist
export const WATER_SURFACES=Object.freeze([SURF.WATER]); // waterDist is the distance to open water (BANK is land: reeds grow on it)
export const FAR=1e6; // "nothing near": beyond the margin the distance is simply large
const INF=1e9;
// Euclidean-ish chamfer distance (cells) of every cell to the nearest set cell of `mask`, in place into a Float32Array.
export function chamfer(mask,cols,rows){const D=new Float32Array(cols*rows),R2=1.41421356;for(let k=0;k<D.length;k++)D[k]=mask[k]?0:INF;
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const k=j*cols+i;let d=D[k];if(d===0)continue;
  if(i>0&&D[k-1]+1<d)d=D[k-1]+1;if(j>0){const u=k-cols;if(D[u]+1<d)d=D[u]+1;if(i>0&&D[u-1]+R2<d)d=D[u-1]+R2;if(i<cols-1&&D[u+1]+R2<d)d=D[u+1]+R2}D[k]=d}
 for(let j=rows-1;j>=0;j--)for(let i=cols-1;i>=0;i--){const k=j*cols+i;let d=D[k];if(d===0)continue;
  if(i<cols-1&&D[k+1]+1<d)d=D[k+1]+1;if(j<rows-1){const u=k+cols;if(D[u]+1<d)d=D[u]+1;if(i<cols-1&&D[u+1]+R2<d)d=D[u+1]+R2;if(i>0&&D[u-1]+R2<d)d=D[u-1]+R2}D[k]=d}
 return D}
// Distance (metres, 0 inside) from a point to an axis-aligned rect {x0,x1,z0,z1}.
export const rectDistance=(r,x,z)=>{const dx=Math.max(r.x0-x,0,x-r.x1),dz=Math.max(r.z0-z,0,z-r.z1);return Math.hypot(dx,dz)};
// Axis-aligned footprint of a prop placed at (x,z) turned by yaw (a multiple of 90 degrees, as world.js rounds it) from its local footprint {x0,x1,z0,z1}.
export function turnedRect(f,x,z,yaw){const c=Math.round(Math.cos(yaw)),s=Math.round(Math.sin(yaw));let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
 for(const [lx,lz] of [[f.x0,f.z0],[f.x1,f.z0],[f.x0,f.z1],[f.x1,f.z1]]){const wx=x+lx*c+lz*s,wz=z-lx*s+lz*c;x0=Math.min(x0,wx);x1=Math.max(x1,wx);z0=Math.min(z0,wz);z1=Math.max(z1,wz)}
 return {x0,x1,z0,z1}}
// Footprint rects of the map's buildings ({x,z,w,d}) and, when `props` is given as [{x,z,yaw,footprint}], of the landmark props.
export function footprintRects(buildings,props){const out=[];for(const b of buildings||[])out.push({x0:b.x-b.w/2,x1:b.x+b.w/2,z0:b.z-b.d/2,z1:b.z+b.d/2});for(const p of props||[])if(p.footprint)out.push(turnedRect(p.footprint,p.x,p.z,p.yaw||0));return out}
// The sampler of one chunk. o = {bounds:{x0,z0,x1,z1}, surfaceAt(x,z), heightAt(x,z), biomeAt(x,z), rects:[footprint rects of the whole map], cell, heightCell, margin}. Every function in the result is O(1) (buildingDist loops only the few rects near the chunk).
export function makeCoverSampler(o){
 const b=o.bounds,M=o.margin??SAMPLER_MARGIN,C=o.cell??SAMPLER_CELL,HC=o.heightCell??SAMPLER_HEIGHT_CELL,surf=o.surfaceAt,hAt=typeof o.heightAt==='function'?o.heightAt:()=>0;
 const gx0=b.x0-M,gz0=b.z0-M,cols=Math.ceil((b.x1-b.x0+2*M)/C),rows=Math.ceil((b.z1-b.z0+2*M)/C),roadMask=new Uint8Array(cols*rows),waterMask=new Uint8Array(cols*rows);
 let anyRoad=false,anyWater=false;
 for(let j=0;j<rows;j++){const z=gz0+(j+.5)*C;for(let i=0;i<cols;i++){const s=surf(gx0+(i+.5)*C,z);if(s===SURF.WATER){waterMask[j*cols+i]=1;anyWater=true}else if(s===SURF.STREET||s===SURF.ROAD||s===SURF.DIRT||s===SURF.PAVEMENT||s===SURF.BRIDGE||s===SURF.DRIVEWAY||s===SURF.GRAVEL){roadMask[j*cols+i]=1;anyRoad=true}}}
 const roadD=anyRoad?chamfer(roadMask,cols,rows):null,waterD=anyWater?chamfer(waterMask,cols,rows):null;
 const at=(D,x,z)=>{if(!D)return FAR;const i=Math.floor((x-gx0)/C),j=Math.floor((z-gz0)/C);if(i<0||j<0||i>=cols||j>=rows)return FAR;const d=D[j*cols+i];return d>=INF?FAR:Math.max(0,(d-.5)*C)}; // the cell holding the point is 0.5 cell from its own centre: subtract so a cell next to the road reads about 0
 // height grid
 const hx0=b.x0-HC,hz0=b.z0-HC,hc=Math.ceil((b.x1-b.x0)/HC)+3,hr=Math.ceil((b.z1-b.z0)/HC)+3,H=new Float32Array(hc*hr);
 for(let j=0;j<hr;j++)for(let i=0;i<hc;i++)H[j*hc+i]=hAt(hx0+i*HC,hz0+j*HC);
 const hGrid=(x,z)=>{const fx=(x-hx0)/HC,fz=(z-hz0)/HC;let i=Math.floor(fx),j=Math.floor(fz);if(i<0)i=0;else if(i>hc-2)i=hc-2;if(j<0)j=0;else if(j>hr-2)j=hr-2;const u=fx-i,v=fz-j,a=H[j*hc+i],bb=H[j*hc+i+1],c=H[(j+1)*hc+i],d=H[(j+1)*hc+i+1];return a+(bb-a)*u+(c-a)*v+(a-bb-c+d)*u*v};
 const slopeAt=(x,z)=>{const e=HC*.5,dx=(hGrid(x+e,z)-hGrid(x-e,z))/(2*e),dz=(hGrid(x,z+e)-hGrid(x,z-e))/(2*e);return Math.hypot(dx,dz)};
 const rects=(o.rects||[]).filter(r=>r.x1>=b.x0-M&&r.x0<=b.x1+M&&r.z1>=b.z0-M&&r.z0<=b.z1+M);
 const buildingDist=(x,z)=>{let d=FAR;for(let k=0;k<rects.length;k++){const e=rectDistance(rects[k],x,z);if(e<d)d=e}return d};
 const biome=typeof o.biomeAt==='function'?o.biomeAt:()=>'open';
 return {surfaceAt:surf,slopeAt,roadDist:(x,z)=>at(roadD,x,z),waterDist:(x,z)=>at(waterD,x,z),buildingDist,biomeAt:biome,heightAt:hGrid,
  stats:{cols,rows,rects:rects.length,hasRoad:anyRoad,hasWater:anyWater,heightSamples:hc*hr}}}
