// Road joints without hard edges (0.34). The map's roads are straight, axis-aligned rectangles that meet at right angles, so every junction has sharp inside corners and every change of
// width a step. This pure module finds them from the map and returns the patches that round them off:
//  - `fillet`: where two roads cross or meet in a T or an L, each open inside corner gets a quarter-round patch (radius FILLET_R, or less if a road is short), bounded by the two road edges and an arc;
//  - `taper`: where two roads of different widths meet end to end, the narrower road flares out to the wider one over a few metres.
// A patch is {kind, points: [[x, z], ...]} (a polygon, in order). Patches never overlap a road (they only fill the gaps) and are asphalt: terrain.js paints them as ROAD, world.js draws them.
import {MAP} from './map-definition.js';
export const FILLET_R=6,ARC_STEPS=8;
const straight=(map)=>map.roads.edges.filter(e=>e.surface==='asphalt'&&!e.path&&!e.closed).map(e=>{const a=map.roads.nodes[e.from],b=map.roads.nodes[e.to];return {id:e.id,w:e.width,h:e.width/2,a,b,vertical:a.x===b.x,x0:Math.min(a.x,b.x),x1:Math.max(a.x,b.x),z0:Math.min(a.z,b.z),z1:Math.max(a.z,b.z)}});
// Patches stay out of the towns (Westside, Alder Center and Cedar Heights have their own kerbs and pavements) and off any paving, pavement, lot, driveway or path.
const TOWNS=['city','alder','cedar'];
const inRect=(r,x,z)=>x>r.x0+1e-6&&x<r.x1-1e-6&&z>r.z0+1e-6&&z<r.z1-1e-6; // strictly inside: touching an edge is fine
function touchesBuilt(map,patch){
 const rects=[...(map.zones||[]).filter(z=>TOWNS.includes(z.id)).map(z=>z.bounds),...(map.paving||[]),...(map.pavements||[]),...(map.lots||[]),...(map.reserved||[]).flatMap(p=>[p,p.driveway,p.path].filter(r=>r&&Number.isFinite(r.x0))),...(map.buildings||[]).filter(b=>Number.isFinite(b.x0)),...(map.fields||[])];
 const c=patch.points.reduce((a,q)=>[a[0]+q[0]/patch.points.length,a[1]+q[1]/patch.points.length],[0,0]);
 return [...patch.points,c].some(([x,z])=>rects.some(r=>inRect(r,x,z)));
}
export function junctionPatches(map=MAP){
 const E=straight(map),out=[];
 // 1. fillets at every crossing of a vertical road V with a horizontal road H
 for(const V of E.filter(e=>e.vertical))for(const H of E.filter(e=>!e.vertical)){
  const jx=V.a.x,jz=H.a.z;if(jx<H.x0-1e-6||jx>H.x1+1e-6||jz<V.z0-1e-6||jz>V.z1+1e-6)continue; // the centre lines do not meet
  for(const sx of [-1,1])for(const sz of [-1,1]){
   const cx=jx+sx*V.h,cz=jz+sz*H.h; // the inside corner of this quadrant
   const r=Math.min(FILLET_R,sz>0?V.z1-cz:cz-V.z0,sx>0?H.x1-cx:cx-H.x0); // both roads must continue past the corner
   if(r<1.5)continue;
   const c=[cx+sx*r,cz+sz*r],pts=[[cx,cz],[cx,cz+sz*r]]; // the arc is centred on c and runs from the V road's edge to the H road's edge
   for(let i=1;i<ARC_STEPS;i++){const t=i/ARC_STEPS*Math.PI/2;pts.push([c[0]-sx*r*Math.cos(t),c[1]-sz*r*Math.sin(t)])}
   pts.push([cx+sx*r,cz]);out.push({kind:'fillet',roads:[V.id,H.id],points:pts.map(p=>[+p[0].toFixed(3),+p[1].toFixed(3)])})}}
 // 2. tapers where two collinear roads of different width meet at a node
 for(let i=0;i<E.length;i++)for(let j=i+1;j<E.length;j++){const A=E[i],B=E[j];if(A.vertical!==B.vertical||A.w===B.w)continue;
  for(const n of [A.a,A.b]){if(!(n===B.a||n===B.b))continue;
   const wide=A.w>B.w?A:B,thin=wide===A?B:A,len=Math.max(6,(wide.w-thin.w)*1.5),other=thin.a===n?thin.b:thin.a;
   if(Math.hypot(other.x-n.x,other.z-n.z)<len)continue;
   const dx=Math.sign(other.x-n.x),dz=Math.sign(other.z-n.z);
   for(const s of [-1,1]){ // one flare on each side of the narrow road
    const p=thin.vertical?[[n.x+s*wide.h,n.z],[n.x+s*thin.h,n.z],[n.x+s*thin.h,n.z+dz*len]]:[[n.x,n.z+s*wide.h],[n.x,n.z+s*thin.h],[n.x+dx*len,n.z+s*thin.h]];
    out.push({kind:'taper',roads:[wide.id,thin.id],points:p})}}}
 return out.filter(p=>!touchesBuilt(map,p));
}
