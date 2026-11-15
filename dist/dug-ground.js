// R3b (pure, no three.js): the dug ground. height.js digs rivers, lakes and the sea below the flat ground planes; a flat plane would hide every one of them, so the planes are cut where the
// ground is dug and a second mesh (the dug mesh, sampled from heightIn) fills the cut. Both are built from ONE grid of cells (DUG_CELL m, aligned to the 100 m chunks): a cell is `dug` when
// the dig could be below 0 anywhere inside it (rivers: the water, the bank and the shoulder; lakes: the water and LAKE_BANK; the sea: from SEA_BANK m inland of the shoreline to the world's edge).
// Cut planes and dug meshes share the cell edges, and the dug mesh is level with the planes at the cell edge (the dig is 0 there), so there is no seam to see. Nothing here reads a mesh or a material.
import {riverPath,riverBank,seaLineZ,polyDistance,inPolygon} from './map-definition.js';
import {heightIn,LAKE_BANK,SEA_BANK,RIVER_SLOPE} from './height.js';
export const DUG_CELL=4;       // m: the cut grid; 100 m chunks hold 25 x 25 cells
export const DUG_FINE=2;       // m: the dug mesh's step where the ground is not flat (a flat cell is one quad)
export const DUG_FLAT=.003;    // m: a cell whose nine height samples differ by less than this is drawn as one quad (the sea bed beyond the beach is flat)
export const DUG_COVER=.71;    // cell diagonals' half: how far past a cell's centre the dig is still counted as inside it
export const DUG_Y=-.079;      // the dug mesh lies 3 mm above the base plane (-.082), as the old river valley did
export const DUG_GRASS=[.541,.604,.486],DUG_MUD=[.42,.384,.267]; // #8a9a7c at the lip, #6b6244 at the bed: the colour of a vertex goes from grass to mud with the depth (mud at DUG_MUD_DEPTH)
export const DUG_MUD_DEPTH=.7;
const grids=new WeakMap();
// The cut grid of a map: {x0, z0, cols, rows, cell, dug (1 where dug), count}. Built once per map object.
export function digGrid(map){
 let g=grids.get(map);if(g)return g;
 const W=map.world||map.ground,cell=DUG_CELL,cols=Math.ceil((W.x1-W.x0)/cell),rows=Math.ceil((W.z1-W.z0)/cell),dug=new Uint8Array(cols*rows);
 const cx=i=>W.x0+(i+.5)*cell,cz=j=>W.z0+(j+.5)*cell,pad=cell*DUG_COVER;
 const stamp=(x,z,r)=>{const R=r+pad,i0=Math.max(0,Math.floor((x-R-W.x0)/cell)),i1=Math.min(cols-1,Math.floor((x+R-W.x0)/cell)),j0=Math.max(0,Math.floor((z-R-W.z0)/cell)),j1=Math.min(rows-1,Math.floor((z+R-W.z0)/cell));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)if(Math.hypot(cx(i)-x,cz(j)-z)<=R)dug[j*cols+i]=1};
 for(const river of map.water?.rivers||[]){const bank=riverBank(river);for(const s of riverPath(river,2))stamp(s.x,s.z,s.w/2+bank+RIVER_SLOPE)}
 for(const lake of map.water?.lakes||[]){const O=lake.outline,xs=O.map(p=>p[0]),zs=O.map(p=>p[1]),m=LAKE_BANK+pad;
  for(let j=Math.max(0,Math.floor((Math.min(...zs)-m-W.z0)/cell));j<=Math.min(rows-1,Math.floor((Math.max(...zs)+m-W.z0)/cell));j++)for(let i=Math.max(0,Math.floor((Math.min(...xs)-m-W.x0)/cell));i<=Math.min(cols-1,Math.floor((Math.max(...xs)+m-W.x0)/cell));i++)
   if(inPolygon(O,cx(i),cz(j))||polyDistance(O,cx(i),cz(j))<=m)dug[j*cols+i]=1}
 const sea=map.water?.sea;
 if(sea?.shoreline?.length>=2)for(let i=0;i<cols;i++){const from=seaLineZ(sea,cx(i))-SEA_BANK-pad;for(let j=Math.max(0,Math.floor((from-W.z0)/cell));j<rows;j++)if(cz(j)>=from)dug[j*cols+i]=1}
 let count=0;for(const d of dug)count+=d;
 g={x0:W.x0,z0:W.z0,cols,rows,cell,dug,count};grids.set(map,g);return g;
}
export const isDug=(g,x,z)=>{const i=Math.floor((x-g.x0)/g.cell),j=Math.floor((z-g.z0)/g.cell);return i>=0&&j>=0&&i<g.cols&&j<g.rows&&g.dug[j*g.cols+i]===1};
// The rectangles of flat ground inside [x0,x1] x [z0,z1] that are NOT dug: [{x0,x1,z0,z1}]. Outside the grid everything is flat ground; inside, each row of cells gives runs, and equal runs of neighbouring rows are merged.
export function groundRects(g,x0,x1,z0,z1){
 const out=[],gx1=g.x0+g.cols*g.cell,gz1=g.z0+g.rows*g.cell,ix0=Math.max(x0,g.x0),ix1=Math.min(x1,gx1),iz0=Math.max(z0,g.z0),iz1=Math.min(z1,gz1);
 if(ix0>=ix1||iz0>=iz1)return [{x0,x1,z0,z1}];
 if(z0<iz0)out.push({x0,x1,z0,z1:iz0});if(z1>iz1)out.push({x0,x1,z0:iz1,z1});if(x0<ix0)out.push({x0,x1:ix0,z0:iz0,z1:iz1});if(x1>ix1)out.push({x0:ix1,x1,z0:iz0,z1:iz1});
 const open=new Map(); // key x0:x1 -> the rectangle still growing downwards
 const j0=Math.floor((iz0-g.z0)/g.cell),j1=Math.ceil((iz1-g.z0)/g.cell)-1,i0=Math.floor((ix0-g.x0)/g.cell),i1=Math.ceil((ix1-g.x0)/g.cell)-1;
 for(let j=j0;j<=j1;j++){const rz0=Math.max(iz0,g.z0+j*g.cell),rz1=Math.min(iz1,g.z0+(j+1)*g.cell),seen=new Set();
  for(let i=i0;i<=i1;){if(g.dug[j*g.cols+i]){i++;continue}let k=i;while(k+1<=i1&&!g.dug[j*g.cols+k+1])k++;
   const rx0=Math.max(ix0,g.x0+i*g.cell),rx1=Math.min(ix1,g.x0+(k+1)*g.cell),key=rx0+':'+rx1;seen.add(key);const r=open.get(key);
   if(r&&Math.abs(r.z1-rz0)<1e-9)r.z1=rz1;else{if(r)out.push(r);open.set(key,{x0:rx0,x1:rx1,z0:rz0,z1:rz1})}
   i=k+1}
  for(const [key,r] of open)if(!seen.has(key)){out.push(r);open.delete(key)}}
 for(const r of open.values())out.push(r);
 return out;
}
// The dug mesh of the cells whose centres lie inside `win` ({x0,x1,z0,z1}, [x0,x1) x [z0,z1)): {pos, col, idx}, positions and vertex colours (grass at the lip to mud at the bed), triangles facing up. Every cell is one quad when its
// nine samples are level, else DUG_FINE m quads. Each cell has its own vertices (no sharing), so a chunk's mesh is independent of its neighbours.
export function dugMeshData(map,g,win){
 const pos=[],col=[],idx=[],c=g.cell,n=Math.round(c/DUG_FINE);
 const i0=Math.max(0,Math.ceil((win.x0-g.x0)/c-.5)),i1=Math.min(g.cols-1,Math.ceil((win.x1-g.x0)/c-.5)-1),j0=Math.max(0,Math.ceil((win.z0-g.z0)/c-.5)),j1=Math.min(g.rows-1,Math.ceil((win.z1-g.z0)/c-.5)-1);
 const colour=h=>{const t=Math.min(1,-h/DUG_MUD_DEPTH);return [DUG_GRASS[0]+(DUG_MUD[0]-DUG_GRASS[0])*t,DUG_GRASS[1]+(DUG_MUD[1]-DUG_GRASS[1])*t,DUG_GRASS[2]+(DUG_MUD[2]-DUG_GRASS[2])*t]};
 for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
  if(!g.dug[j*g.cols+i])continue;
  const x0=g.x0+i*c,z0=g.z0+j*c,H=new Array(9).fill(NaN),at=(a,b)=>H[b*3+a]=Number.isNaN(H[b*3+a])?heightIn(map,x0+a*c/2,z0+b*c/2):H[b*3+a];
  let lo=Infinity,hi=-Infinity;for(const [a,b] of [[0,0],[2,0],[0,2],[2,2],[1,1]]){const h=at(a,b);if(h<lo)lo=h;if(h>hi)hi=h} // five samples decide whether the cell is level (the sea bed beyond the beach is: one quad, 5 height calls)
  const steps=hi-lo<DUG_FLAT?1:n,k0=pos.length/3;
  if(steps>1)for(let b=0;b<=2;b++)for(let a=0;a<=2;a++)at(a,b); // DUG_FINE = c / 2: the vertex lattice IS the nine samples
  for(let b=0;b<=steps;b++)for(let a=0;a<=steps;a++){const x=x0+a*c/steps,z=z0+b*c/steps,h=steps===1?H[(b*2)*3+a*2]:steps===2?H[b*3+a]:heightIn(map,x,z);pos.push(x,DUG_Y+h,z);col.push(...colour(h))}
  const row=steps+1;
  for(let b=0;b<steps;b++)for(let a=0;a<steps;a++){const p=k0+b*row+a;idx.push(p,p+row,p+row+1,p,p+row+1,p+1)} // (x0,z0) (x0,z1) (x1,z1) (x1,z0): faces up
 }
 return {pos,col,idx};
}
