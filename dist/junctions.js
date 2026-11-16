// Road joints without hard edges (0.34). The map's roads are straight, axis-aligned rectangles that meet at right angles, so every junction has sharp inside corners and every change of
// width a step. This pure module finds them from the map and returns the patches that round them off:
//  - `fillet`: where two roads cross or meet in a T or an L, each open inside corner gets a quarter-round patch (radius FILLET_R, or less if a road is short), bounded by the two road edges and an arc;
//  - `taper`: where two roads of different widths meet end to end, the narrower road flares out to the wider one over a few metres.
// A patch is {kind, points: [[x, z], ...]} (a polygon, in order). Patches never overlap a road (they only fill the gaps) and are asphalt: terrain.js paints them as ROAD, world.js draws them.
import {MAP,roadGraph} from './map-definition.js';
export const FILLET_R=6,ARC_STEPS=8;
const straight=(map)=>map.roads.edges.filter(e=>e.surface==='asphalt'&&!e.path&&!e.closed).map(e=>{const a=map.roads.nodes[e.from],b=map.roads.nodes[e.to];return {id:e.id,w:e.width,h:e.width/2,a,b,vertical:a.x===b.x,x0:Math.min(a.x,b.x),x1:Math.max(a.x,b.x),z0:Math.min(a.z,b.z),z1:Math.max(a.z,b.z)}});
// Patches stay out of the towns (Westside, Alder Center and Cedar Heights have their own kerbs and pavements) and off any paving, pavement, lot, driveway or path.
// R4: Kaspian Bay joins the list (its names and signs live in MAP.towns); there is no 'kaspian' zone yet, so nothing is suppressed there and its angled T joins still get their patches.
export const TOWNS=['city','alder','cedar','kaspian'];
const inRect=(r,x,z)=>x>r.x0+1e-6&&x<r.x1-1e-6&&z>r.z0+1e-6&&z<r.z1-1e-6; // strictly inside: touching an edge is fine
function touchesBuilt(map,patch){
 const rects=[...(map.zones||[]).filter(z=>TOWNS.includes(z.id)).map(z=>z.bounds),...(map.paving||[]),...(map.pavements||[]),...(map.lots||[]),...(map.reserved||[]).flatMap(p=>[p,p.driveway,p.path].filter(r=>r&&Number.isFinite(r.x0))),...(map.buildings||[]).filter(b=>Number.isFinite(b.x0)),...(map.fields||[])];
 const c=patch.points.reduce((a,q)=>[a[0]+q[0]/patch.points.length,a[1]+q[1]/patch.points.length],[0,0]);
 return [...patch.points,c].some(([x,z])=>rects.some(r=>inRect(r,x,z)));
}
// ── R4: angled T, Y and L joins (map-master 6.5) ─────────────────────────────────────────────────────────────────────────────────────────────────
// At every node of the road graph that a `wild` road touches (T joins are graph nodes too: an end on another road's body splits it), take the legs that leave the node, sort them by angle, and fill each open wedge
// between neighbouring legs (20 to 150 degrees) with a fillet: the corner where the two road edges cross, then an arc tangent to both. A wedge between two asphalt legs is rounded with FILLET_R; a wedge with a gravel
// leg gets a small asphalt apron (APRON_R) so the gravel does not meet the asphalt edge square. Axis-aligned asphalt T joins stay with pass 1 above (no double patch).
export const APRON_R=4,WEDGE_MIN=20*Math.PI/180,WEDGE_MAX=150*Math.PI/180,FILLET_KMAX=14;
const pointAt=(P,s)=>{let run=0;for(let i=0;i<P.length-1;i++){const l=Math.hypot(P[i+1][0]-P[i][0],P[i+1][1]-P[i][1]);if(run+l>=s||i===P.length-2){const t=l?Math.max(0,Math.min(1,(s-run)/l)):0;return [P[i][0]+(P[i+1][0]-P[i][0])*t,P[i][1]+(P[i+1][1]-P[i][1])*t]}run+=l}return P[P.length-1]};
const unit=(x,z)=>{const l=Math.hypot(x,z)||1;return [x/l,z/l]};
function wedgePatches(map){
 const g=roadGraph(map),byId=new Map(map.roads.edges.map(e=>[e.id,e])),plain=new Set(straight(map).map(e=>e.id)),out=[],R3=n=>+n.toFixed(3);
 for(const node of Object.values(g.nodes)){
  if(node.virtual||!node.edges.some(id=>byId.get(id)?.wild))continue;
  const legs=[];
  for(const id of node.edges){const E=g.edges[id];if(E.closed)continue;
   for(const leg of E.legs){if(leg.from===leg.to)continue;let at=null;
    if(leg.from===node.id)at=pointAt(E.poly,leg.s0+Math.min(6,leg.length/2));else if(leg.to===node.id)at=pointAt(E.poly,leg.s1-Math.min(6,leg.length/2));
    if(at){const d=unit(at[0]-node.x,at[1]-node.z);legs.push({id,E,u:d,len:leg.length,h:E.width/2,asphalt:E.surface==='asphalt',ang:Math.atan2(d[1],d[0])})}}}
  if(legs.length<2)continue;legs.sort((a,b)=>a.ang-b.ang);
  for(let i=0;i<legs.length;i++){const A=legs[i],B=legs[(i+1)%legs.length];if(A===B)continue;
   let phi=B.ang-A.ang;if(phi<=0)phi+=2*Math.PI;if(phi<WEDGE_MIN||phi>WEDGE_MAX)continue;
   if(!A.asphalt&&!B.asphalt)continue;if(!byId.get(A.id)?.wild&&!byId.get(B.id)?.wild)continue;
   const axis=u=>Math.abs(u[0])<1e-6||Math.abs(u[1])<1e-6;if(A.asphalt&&B.asphalt&&plain.has(A.id)&&plain.has(B.id)&&axis(A.u)&&axis(B.u)&&Math.abs(phi-Math.PI/2)<1e-6)continue; // pass 1 has it
   const dot=A.u[0]*B.u[0]+A.u[1]*B.u[1],pA=unit(B.u[0]-dot*A.u[0],B.u[1]-dot*A.u[1]),pB=unit(A.u[0]-dot*B.u[0],A.u[1]-dot*B.u[1]); // each road's edge on the wedge side
   const rx=B.h*pB[0]-A.h*pA[0],rz=B.h*pB[1]-A.h*pA[1],a1=A.u[0],b1=-B.u[0],a2=A.u[1],b2=-B.u[1],det=a1*b2-a2*b1;if(Math.abs(det)<1e-9)continue;
   const t=(rx*b2-rz*b1)/det,s=(a1*rz-a2*rx)/det,C=[node.x+A.h*pA[0]+t*A.u[0],node.z+A.h*pA[1]+t*A.u[1]];
   const half=phi/2,r0=A.asphalt&&B.asphalt?FILLET_R:APRON_R,r=Math.min(r0,FILLET_KMAX*Math.tan(half)),k=r/Math.tan(half);
   if(r<1.5||A.len<Math.max(t,0)+k+1||B.len<Math.max(s,0)+k+1)continue;
   const T1=[C[0]+k*A.u[0],C[1]+k*A.u[1]],T2=[C[0]+k*B.u[0],C[1]+k*B.u[1]],bis=unit(A.u[0]+B.u[0],A.u[1]+B.u[1]),d=r/Math.sin(half),O=[C[0]+bis[0]*d,C[1]+bis[1]*d];
   const a0=Math.atan2(T1[1]-O[1],T1[0]-O[0]);let da=Math.atan2(T2[1]-O[1],T2[0]-O[0])-a0;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
   const pts=[C,T1];for(let q=1;q<ARC_STEPS;q++){const w=a0+da*q/ARC_STEPS;pts.push([O[0]+r*Math.cos(w),O[1]+r*Math.sin(w)])}pts.push(T2);
   out.push({kind:'fillet',roads:[A.id,B.id],node:node.id,points:pts.map(p=>[R3(p[0]),R3(p[1])])})}}
 return out;
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
 out.push(...wedgePatches(map));
 return out.filter(p=>!touchesBuilt(map,p));
}

// ── Rounded kerbs inside the towns (MAP.roundedCorners) ─────────────────────────────────────────────────────────────────────────────────────────
// A corner {x, z, sx, sz, r} is an inside corner of the road shape at (x, z); the ground it rounds lies on the (sx, sz) side. cornerArc(c) is the quarter-round arc from the point r along
// the vertical kerb to the point r along the horizontal one; cornerRegion(c) is the little patch of asphalt between the corner and the arc.
export function cornerArc(c,steps=ARC_STEPS){const cx=c.x+c.sx*c.r,cz=c.z+c.sz*c.r,out=[];for(let i=0;i<=steps;i++){const t=i/steps*Math.PI/2;out.push([+(cx-c.sx*c.r*Math.cos(t)).toFixed(3),+(cz-c.sz*c.r*Math.sin(t)).toFixed(3)])}return out}
export const cornerRegion=c=>[[c.x,c.z],...cornerArc(c)];
export const inPolygon=(P,x,z)=>{let inside=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const [xi,zi]=P[i],[xj,zj]=P[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside}return inside};
// The outline of a pavement slab {x0, x1, z0, z1} with the corners that lie on its own corners cut away: a polygon [[x, z], ...] in order round the slab.
export function slabOutline(r,corners){
 const K=[[r.x0,r.z0],[r.x1,r.z0],[r.x1,r.z1],[r.x0,r.z1]],out=[];
 K.forEach((k,i)=>{const prev=K[(i+3)%4],c=corners.find(q=>Math.abs(q.x-k[0])<1e-6&&Math.abs(q.z-k[1])<1e-6&&((q.sx>0)===(k[0]===r.x0))&&((q.sz>0)===(k[1]===r.z0)));
  if(!c){out.push(k);return}
  const arc=cornerArc(c),arrivesVertically=Math.abs(prev[0]-k[0])<1e-6; // the edge that arrives at this corner runs along x = const
  out.push(...(arrivesVertically?arc:arc.slice().reverse()))});
 return out;
}
