// R2 (pure, no meshes): road heights over the relief and the water. map-master 6.4: the road runs at the height of the undug ground (relief) under its centreline, flat across the width
// (no cross slope, no banking), on a bridge it follows the deck arch, in a ford it follows the ford bed; the ground under the road and a 2 m shoulder is pulled to the road (roadGradeAt, not wired yet).
// Pieces are cut at the REAL chunk borders (chunks.js CHUNK and FRAME) and subdivided every ROAD_STEP m or less. Nothing here changes MAP, heightAt or any existing road.
import {MAP,roadGraph,roadChunkPieces,polylineLength,waterAt} from './map-definition.js';
import {reliefHeight,heightIn,bridgeRise,BRIDGE_RISE} from './height.js';
import {CHUNK,FRAME} from './chunks.js';
export const ROAD_STEP=3,ROAD_SHOULDER=2,MAX_ROAD_GRADE=Math.tan(10*Math.PI/180); // 10 degrees = 17.6 % (map-master 4.1)
const bridgeAt=(map,x,z)=>(map.water?.bridges||[]).find(b=>x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1)||null;
// The road surface height at (x, z) and what carries it: {y, kind:'ground'|'bridge'|'ford'|'water'}. 'water' means the road lies in water with no bridge or ford (a data problem).
export function roadHeightAt(map,x,z){
 const R=map.relief,b=bridgeAt(map,x,z);
 if(b){const ax=b.axis==='x',a=ax?reliefHeight(R,b.x0,z):reliefHeight(R,x,b.z0),c=ax?reliefHeight(R,b.x1,z):reliefHeight(R,x,b.z1),t=ax?(x-b.x0)/(b.x1-b.x0):(z-b.z0)/(b.z1-b.z0); // the deck joins the two banks, then arches over them
  return {y:a+(c-a)*Math.max(0,Math.min(1,t))+bridgeRise(b,z,x),kind:'bridge'}}
 const w=waterAt(x,z,map);
 if(w&&w.kind==='ford')return {y:heightIn(map,x,z),kind:'ford'};
 if(w&&w.depth>0)return {y:heightIn(map,x,z),kind:'water'};
 return {y:reliefHeight(R,x,z),kind:'ground'};
}
// Subdivide a polyline so no step is longer than `step` (every original vertex kept): [[x,z],...] -> [[x,z],...]
export function subdividePolyline(P,step=ROAD_STEP){const out=[P[0].slice()];for(let i=0;i<P.length-1;i++){const [ax,az]=P[i],[bx,bz]=P[i+1],n=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/step));for(let k=1;k<=n;k++)out.push([ax+(bx-ax)*k/n,az+(bz-az)*k/n])}return out}
// Points with heights and the two strip edges (l, r: the flat cross-section, y the same on both sides): [{x,z,y,s,kind,l:[x,z],r:[x,z]}]. s is metres from the edge start (s0 + along this run).
export function roadProfile(map,poly,width,{s0=0,step=ROAD_STEP}={}){
 const P=subdividePolyline(poly,step),half=width/2,out=[];let s=s0;
 for(let i=0;i<P.length;i++){if(i)s+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);
  const a=P[Math.max(0,i-1)],b=P[Math.min(P.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,nx=-dz/l,nz=dx/l,h=roadHeightAt(map,P[i][0],P[i][1]);
  out.push({x:P[i][0],z:P[i][1],y:h.y,s,kind:h.kind,l:[P[i][0]+nx*half,P[i][1]+nz*half],r:[P[i][0]-nx*half,P[i][1]-nz*half]})}
 return out;
}
const gradeOf=pts=>{let g=0;for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z);if(d>1e-9)g=Math.max(g,Math.abs(pts[i].y-pts[i-1].y)/d)}return g};
// Every road cut at chunk borders, with heights: [{edge, chunk:'i:j', i, j, class, surface, width, s0, length, maxGrade, points:[...roadProfile]}]. Pass the real chunk constants (the defaults are CHUNK and FRAME).
export function roadChunkGeometry(map=MAP,{size=CHUNK,x0=FRAME.x0,z0=FRAME.z0,step=ROAD_STEP}={}){
 const g=roadGraph(map),run={};
 return roadChunkPieces(map,{size,x0,z0}).map(p=>{const E=g.edges[p.edge],s0=run[p.edge]||0,len=polylineLength(p.points);run[p.edge]=s0+len;
  const points=roadProfile(map,p.points,E.width,{s0,step});
  return {edge:p.edge,chunk:p.chunk,i:p.i,j:p.j,class:E.class,surface:E.surface,width:E.width,s0,length:len,maxGrade:gradeOf(points),points}});
}
// Ground under a road: the road pulls the ground to its own height across the width and eases back over ROAD_SHOULDER. {y, w} with w 1 on the road, 0 beyond the shoulder, or null (nothing near). Linear scan of the pieces: build once per map and chunk in the caller.
export function roadGradeAt(pieces,x,z){let best=null;
 for(const p of pieces){const reach=p.width/2+ROAD_SHOULDER;
  for(let k=0;k<p.points.length-1;k++){const a=p.points[k],b=p.points[k+1],dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l2)),d=Math.hypot(x-a.x-dx*t,z-a.z-dz*t);if(d>=reach)continue;
   const w=d<=p.width/2?1:(1+Math.cos(Math.PI*(d-p.width/2)/ROAD_SHOULDER))/2;if(!best||w>best.w)best={y:a.y+(b.y-a.y)*t,w}}}
 return best}
// Problems (empty when sound): a road in water with no bridge or ford, a grade over 10 degrees (curves and hairpins are the data's job), a bridge that carries no road.
export function roadGeometryProblems(map=MAP,opts={}){
 const out=[],pieces=roadChunkGeometry(map,opts),max=opts.maxGrade??MAX_ROAD_GRADE;
 for(const p of pieces){if(p.points.some(q=>q.kind==='water'))out.push(`road ${p.edge} chunk ${p.chunk} lies in water with no bridge or ford`);
  if(p.maxGrade>max)out.push(`road ${p.edge} chunk ${p.chunk} climbs ${(p.maxGrade*100).toFixed(1)} % (limit ${(max*100).toFixed(1)} %)`)}
 for(const b of map.water?.bridges||[])if(!pieces.some(p=>p.points.some(q=>q.kind==='bridge'&&q.x>=b.x0&&q.x<=b.x1&&q.z>=b.z0&&q.z<=b.z1)))out.push(`bridge ${b.id} carries no road`);
 return out;
}
export {BRIDGE_RISE};
