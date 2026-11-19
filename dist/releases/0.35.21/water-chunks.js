// W3: chunk water geometry from the W1 contract, no three.js import (the caller passes THREE); legacy rivers stay world.js's flat ribbon.
// One mesh per 100 m chunk, every kind in it, clipped to the chunk. Vertex: x y z | u v | depth | flow dx dz speed | foam | kind | nx ny nz.
// u,v: river = metres along / across from the centre; lake, sea, pool = world x, z (pool: metres from its centre); curtain = metres down / across. depth = water over the bed (m).
// flow: river = tangent and speed; curtain = outward direction and 6 m/s fall; still water 0. foam = metres to the bank (lake, river, pool) or from the shoreline (sea).
// kind: 0 river 1 lake 2 sea 3 fall (the curtain has a horizontal normal and speed 6, the plunge pool is flat and speed 0).
import {riverPath,riverIsLegacy,riverDepthAt,cosEase,polyDistance,seaLineZ,fallPoolCentre} from './map-definition.js';
import {chunkBounds,FRAME} from './chunks.js';

export const WATER_ATTRIBUTES=Object.freeze(['position','normal','uv','aDepth','aFlow','aFoam','aKind']);
export const FALL_SPEED=6,RIVER_ACROSS=[-1,-.5,0,.5,1],LAKE_EDGE=8,SEA_NEAR_EDGE=8,SEA_FAR_EDGE=25;
const lerp=(a,b,t)=>a.map((q,i)=>q+(b[i]-q)*t);
// Sutherland-Hodgman against the chunk rectangle (x then z); every attribute interpolates, the cut coordinate lands exactly on the border.
function clip(poly,r){
 for(const [axis,s,l] of [[0,1,r.x0],[0,-1,-r.x1],[2,1,r.z0],[2,-1,-r.z1]]){
  const out=[];
  for(let i=0;i<poly.length;i++){const c=poly[i],p=poly[(i+poly.length-1)%poly.length],dc=s*c[axis]-l,dp=s*p[axis]-l;
   if((dc>=0)!==(dp>=0)){const v=lerp(p,c,dp/(dp-dc));v[axis]=s*l;out.push(v)}
   if(dc>=0)out.push(c)}
  poly=out;if(poly.length<3)return []}
 return poly;
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function earClip(P){ // [[x,z]...] -> triangles [[a,b,c]...]
 const idx=P.map((_,i)=>i),area=P.reduce((s,p,i)=>{const q=P[(i+1)%P.length];return s+p[0]*q[1]-q[0]*p[1]},0);if(area<0)idx.reverse();
 const inTri=(p,a,b,c)=>cross(a,b,p)>=0&&cross(b,c,p)>=0&&cross(c,a,p)>=0,out=[];
 while(idx.length>3){let cut=false;
  for(let k=0;k<idx.length&&!cut;k++){const a=P[idx[(k+idx.length-1)%idx.length]],b=P[idx[k]],c=P[idx[(k+1)%idx.length]];
   if(cross(a,b,c)<=1e-12||idx.some(j=>{const p=P[j];return p!==a&&p!==b&&p!==c&&inTri(p,a,b,c)}))continue;
   out.push([a,b,c]);idx.splice(k,1);cut=true}
  if(!cut)break}
 for(let k=1;k+1<idx.length;k++)out.push([P[idx[0]],P[idx[k]],P[idx[k+1]]]);
 return out;
}
function collector(){
 const verts=[],keyed=new Map(),index=[];
 const at=v=>{const k=v.map(q=>Math.round(q*1e4)).join();let n=keyed.get(k);if(n===undefined){n=verts.length;keyed.set(k,n);verts.push(v)}return n};
 return {verts,index,
  poly(p){for(let k=1;k+1<p.length;k++){const a=p[0],b=p[k],c=p[k+1],u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],w=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],nx=u[1]*w[2]-u[2]*w[1],ny=u[2]*w[0]-u[0]*w[2],nz=u[0]*w[1]-u[1]*w[0];
   if(Math.hypot(nx,ny,nz)<1e-6)continue;const t=ny>=0?[a,b,c]:[a,c,b];index.push(at(t[0]),at(t[1]),at(t[2]))}}};
}
const overlaps=(xs,zs,r)=>Math.max(...xs)>=r.x0&&Math.min(...xs)<=r.x1&&Math.max(...zs)>=r.z0&&Math.min(...zs)<=r.z1;
// Split a triangle until its edges are short enough (only where it meets the chunk), then clip and emit it.
function fill(col,tri,V,edgeOf,r){
 if(!overlaps(tri.map(p=>p[0]),tri.map(p=>p[1]),r))return;
 const [a,b,c]=tri,mid=(p,q)=>[(p[0]+q[0])/2,(p[1]+q[1])/2],e=[[a,b,c],[b,c,a],[c,a,b]].map(([p,q,o])=>({p,q,o,l:Math.hypot(p[0]-q[0],p[1]-q[1])})).sort((s,t)=>t.l-s.l)[0];
 if(e.l>edgeOf([a,b,c,mid(a,b),mid(b,c),mid(c,a)])){const m=mid(e.p,e.q);fill(col,[e.p,m,e.o],V,edgeOf,r);fill(col,[m,e.q,e.o],V,edgeOf,r);return} // bisect the longest edge: slivers become even triangles
 col.poly(clip(tri.map(p=>V(p[0],p[1])),r));
}
function riverMesh(col,map,river,r){
 const path=riverPath(river,2),rows=new Map();
 const row=i=>{let v=rows.get(i);if(!v){const s=path[i];v=RIVER_ACROSS.map(t=>{const h=t*s.w/2,x=s.x-s.tz*h,z=s.z+s.tx*h;
  return [x,s.y,z,s.u,h,riverDepthAt(map,river,{s,d:Math.abs(h)},x,z),s.tx,s.tz,s.speed,s.w/2-Math.abs(h),0,0,1,0]});rows.set(i,v)}return v};
 for(let i=0;i+1<path.length;i++){const a=path[i],b=path[i+1],m=Math.max(a.w,b.w)/2+1;
  if(!overlaps([a.x-m,a.x+m,b.x-m,b.x+m],[a.z-m,a.z+m,b.z-m,b.z+m],r))continue;
  const A=row(i),B=row(i+1);for(let c=0;c+1<A.length;c++)col.poly(clip([A[c],A[c+1],B[c+1],B[c]],r))}
}
function lakeMesh(col,lake,r){
 const V=(x,z)=>{const d=polyDistance(lake.outline,x,z);return [x,lake.y,z,x,z,lake.depth*cosEase(d/lake.shore),0,0,0,d,1,0,1,0]};
 const edgeOf=pts=>Math.min(...pts.map(p=>polyDistance(lake.outline,p[0],p[1])))<lake.shore+LAKE_EDGE?LAKE_EDGE:SEA_FAR_EDGE; // fine only in the shore band where the depth changes
 for(const t of earClip(lake.outline))fill(col,t,V,edgeOf,r);
}
function seaMesh(col,sea,r,world){
 const L=sea.shoreline,g=world,P=[[g.x0,seaLineZ(sea,g.x0)],...L.filter(p=>p[0]>g.x0&&p[0]<g.x1),[g.x1,seaLineZ(sea,g.x1)],[g.x1,g.z1],[g.x0,g.z1]];
 const V=(x,z)=>{const dz=Math.max(0,z-seaLineZ(sea,x));return [x,sea.y,z,x,z,(sea.depth??.6)*cosEase(dz/sea.beach),0,0,0,dz,2,0,1,0]};
 const edgeOf=pts=>Math.min(...pts.map(p=>p[1]-seaLineZ(sea,p[0])))<sea.beach+12?SEA_NEAR_EDGE:SEA_FAR_EDGE;
 for(const t of earClip(P))fill(col,t,V,edgeOf,r);
}
function fallMesh(col,f,r){
 const l=Math.hypot(f.dir[0],f.dir[1])||1,dx=f.dir[0]/l,dz=f.dir[1]/l,sx=-dz,sz=dx,C=4,R=8,rows=[];
 for(let k=0;k<=R;k++){const t=k/R,row=[];for(let c=0;c<=C;c++){const s=(c/C-.5)*f.w,out=t*t*f.drop*.12;
  row.push([f.lip.x+sx*s+dx*out,f.lip.y-t*f.drop,f.lip.z+sz*s+dz*out,t*f.drop,s,.3,dx,dz,FALL_SPEED,0,3,dx,0,dz])}rows.push(row)}
 for(let k=0;k<R;k++)for(let c=0;c<C;c++)col.poly(clip([rows[k][c],rows[k][c+1],rows[k+1][c+1],rows[k+1][c]],r));
 const p=fallPoolCentre(f),R0=f.pool.r,y=f.lip.y-f.drop,N=24,pd=f.pool.depth??1.5,rad=[0,.5,.8,1],ring=(k,n)=>{const a=n/N*Math.PI*2,d=R0*rad[k],px=p.x+Math.cos(a)*d,pz=p.z+Math.sin(a)*d;
  return [px,y,pz,px-p.x,pz-p.z,pd*Math.min(1,(R0-d)/(R0*.4)),0,0,0,R0-d,3,0,1,0]};
 for(let n=0;n<N;n++){col.poly(clip([ring(0,0),ring(1,n),ring(1,n+1)],r));for(let k=1;k<3;k++)col.poly(clip([ring(k,n),ring(k+1,n),ring(k+1,n+1),ring(k,n+1)],r))}
}
// The water of chunk (i, j) as flat typed arrays, or null when none reaches it.
export function waterChunkData(map,i,j){
 const W=map.water;if(!W)return null;
 const r=chunkBounds(i,j),col=collector(),world=map.world||FRAME;
 for(const river of W.rivers||[])if(!riverIsLegacy(river))riverMesh(col,map,river,r);
 for(const lake of W.lakes||[])lakeMesh(col,lake,r);
 if(W.sea?.shoreline?.length>=2)seaMesh(col,W.sea,r,world);
 for(const f of W.falls||[])fallMesh(col,f,r);
 const n=col.verts.length;if(!n)return null;
 const out={position:new Float32Array(n*3),normal:new Float32Array(n*3),uv:new Float32Array(n*2),aDepth:new Float32Array(n),aFlow:new Float32Array(n*3),aFoam:new Float32Array(n),aKind:new Float32Array(n),index:Uint32Array.from(col.index),vertices:n,triangles:col.index.length/3};
 col.verts.forEach((v,k)=>{out.position.set(v.slice(0,3),k*3);out.uv.set([v[3],v[4]],k*2);out.aDepth[k]=v[5];out.aFlow.set([v[6],v[7],v[8]],k*3);out.aFoam[k]=v[9];out.aKind[k]=v[10];out.normal.set(v.slice(11,14),k*3)});
 return out.triangles?out:null;
}
// The one mesh a chunk adds (one draw call), or null. `material` is shared by every chunk (plain for now; W4 swaps in the shader).
export function waterChunkMesh(THREE,material,map,i,j){
 const d=waterChunkData(map,i,j);if(!d)return null;
 const g=new THREE.BufferGeometry(),A=(a,n)=>new THREE.BufferAttribute(a,n);
 g.setAttribute('position',A(d.position,3));g.setAttribute('normal',A(d.normal,3));g.setAttribute('uv',A(d.uv,2));g.setAttribute('aDepth',A(d.aDepth,1));g.setAttribute('aFlow',A(d.aFlow,3));g.setAttribute('aFoam',A(d.aFoam,1));g.setAttribute('aKind',A(d.aKind,1));
 g.setIndex(A(d.index,1));g.computeBoundingSphere();
 const mesh=new THREE.Mesh(g,material);mesh.name='water-'+i+':'+j;mesh.renderOrder=1;return mesh;
}
// Minimap: the new water kinds on a 2D context (legacy rivers are not drawn here: the terrain mask already shows them). px, pz map world x, z to pixels; k is pixels per metre.
export function drawWaterLayer(ctx,map,px,pz,k){
 const W=map.water;if(!W)return 0;let n=0;
 const poly=pts=>{ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(px(p[0]),pz(p[1])):ctx.moveTo(px(p[0]),pz(p[1])));ctx.closePath();ctx.fill();n++};
 if(W.sea?.shoreline?.length>=2){const g=map.world||FRAME;ctx.fillStyle='#2f6f93';poly([[g.x0,seaLineZ(W.sea,g.x0)],...W.sea.shoreline.filter(p=>p[0]>g.x0&&p[0]<g.x1),[g.x1,seaLineZ(W.sea,g.x1)],[g.x1,g.z1],[g.x0,g.z1]])}
 ctx.fillStyle='#3f7ea3';for(const lake of W.lakes||[])poly(lake.outline);
 ctx.strokeStyle='#3f7ea3';ctx.lineJoin=ctx.lineCap='round';
 for(const river of W.rivers||[]){if(riverIsLegacy(river))continue;const path=riverPath(river,6);
  for(let i=1;i<path.length;i++){ctx.lineWidth=Math.max(1,path[i].w*k);ctx.beginPath();ctx.moveTo(px(path[i-1].x),pz(path[i-1].z));ctx.lineTo(px(path[i].x),pz(path[i].z));ctx.stroke();n++}}
 ctx.strokeStyle='#e8f6ff';for(const f of W.falls||[]){const c=fallPoolCentre(f);ctx.lineWidth=Math.max(2,f.w*k);ctx.beginPath();ctx.moveTo(px(f.lip.x),pz(f.lip.z));ctx.lineTo(px(c.x),pz(c.z));ctx.stroke();n++}
 return n;
}
