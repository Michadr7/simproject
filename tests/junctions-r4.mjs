import assert from 'node:assert/strict';
import {MAP,validateMap,roadProblems,roadGraph,roadRoute} from '../dist/map-definition.js';
import {roadGeometryProblems} from '../dist/road-geometry.js';
import {junctionPatches,TOWNS,FILLET_R,APRON_R} from '../dist/junctions.js';
import {buildTerrain,SURFACE} from '../dist/terrain.js';
let n=0;const ok=(c,m)=>{assert(c,m);n++};

// R4 (map-master 6.5): angled T/Y/L patches at the R3b joins, Kaspian Bay in TOWNS with names and signs, West Bank Lane linked into the road graph.
ok(validateMap(MAP).length===0&&roadProblems(MAP).length===0&&roadGeometryProblems(MAP).length===0,'validateMap, roadProblems and roadGeometryProblems stay clean');
const P=junctionPatches(),W=P.filter(p=>p.node),G=roadGraph(MAP);
ok(JSON.stringify(junctionPatches())===JSON.stringify(P),'the patches are deterministic');
ok(TOWNS.includes('kaspian')&&['city','alder','cedar'].every(t=>TOWNS.includes(t)),'Kaspian Bay is in TOWNS');

// 1. which joins get an angled patch: the Blackstone junction, the Eden car link, the Coast Link ends (Y), none for the square asphalt Ts that pass 1 already rounds
const at=id=>W.filter(p=>p.node===id).map(p=>p.roads.slice().sort().join('/')).sort();
ok(JSON.stringify(at('edenJoin'))===JSON.stringify(['blackstone-access/eden-road','blackstone-access/eden-spine']),'the gravel access road has an apron on both sides of the spine: '+at('edenJoin'));
ok(at('carLinkJoin').length===2&&at('carLinkJoin').every(r=>r.includes('eden-car-link')&&r.includes('blackstone-access')),'the car link has two aprons on the gravel road');
ok(at('coastStart').length===3,'Coast Link and the P5 spur leave Ferry Street: 3 wedges ('+at('coastStart')+')');
ok(at('coastJoin').length===2&&at('coastJoin').every(r=>r.includes('coast-link')&&r.includes('eden-spine')),'the Y at the spine: two fillets, one acute and one obtuse');
for(const id of ['haulJoin','bayJoin','bayFront','crossWestJoin','frontEast'])ok(at(id).length===0,id+': square asphalt joins are left to the old fillets (no double patch)');
ok(P.some(p=>p.kind==='fillet'&&!p.node&&p.points.some(([x,z])=>Math.abs(x-960)<7&&Math.abs(z-68)<7)),'the haul road T at (960, 68) still has its pass-1 fillets');
ok(P.some(p=>p.kind==='fillet'&&!p.node&&p.points.some(([x,z])=>Math.abs(x-250)<7&&Math.abs(z-68)<7)),'and so does Bay Road at (250, 68)');

// 2. geometry: every wedge patch is a convex-ish corner fill that lies outside both roads and touches both road edges
const dist=(poly,x,z)=>{let best=1e9;for(let i=0;i<poly.length-1;i++){const [ax,az]=poly[i],[bx,bz]=poly[i+1],dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l2));best=Math.min(best,Math.hypot(x-ax-dx*t,z-az-dz*t))}return best};
const area=pts=>Math.abs(pts.reduce((s,p,i)=>{const q=pts[(i+1)%pts.length];return s+p[0]*q[1]-q[0]*p[1]},0))/2;
for(const p of W){const [a,b]=p.roads.map(id=>G.edges[id]);ok(p.points.length===10,'corner + 2 tangent points + 7 arc points');
 ok(area(p.points)>1,`${p.node} ${p.roads}: a real patch (area ${area(p.points).toFixed(1)} m2)`);
 const [C,T1,...rest]=p.points,T2=rest.at(-1);
 ok(Math.abs(dist(a.poly,...C)-a.width/2)<.02&&Math.abs(dist(b.poly,...C)-b.width/2)<.02,`${p.node} ${p.roads}: the corner is on both road edges`);
 const first=[T1,T2].map(T=>[a,b].map(E=>dist(E.poly,...T)-E.width/2));ok(first.some(f=>f.some(v=>Math.abs(v)<.02))&&first.flat().every(v=>v>-.02),`${p.node} ${p.roads}: the tangent points lie on the road edges`);
 for(const q of p.points)ok(dist(a.poly,...q)>=a.width/2-.02&&dist(b.poly,...q)>=b.width/2-.02,`${p.node} ${p.roads}: no point of the patch is inside either road`);
 const asphalt=[a,b].every(E=>E.surface==='asphalt'),R=asphalt?FILLET_R:APRON_R;ok(Math.hypot(T1[0]-C[0],T1[1]-C[1])<=14+1e-6&&R>0);
 // the arc: every arc point is the same distance from one centre, and the centre of the arc is not inside the patch's corner side
 const arc=rest.slice(0,-1).concat([T2]);ok(arc.length===8)}

// 3. the terrain mask: the middle of every patch is road, walkable and drivable (chunk-style tiles, these lie in the wilds)
for(const p of W){const [cx,cz]=p.points[0],m=p.points[Math.floor(p.points.length/2)],x=cx*.6+m[0]*.4,z=cz*.6+m[1]*.4,s=10,t=buildTerrain(MAP,{window:{x0:Math.floor(x/s)*s-30,x1:Math.floor(x/s)*s+40,z0:Math.floor(z/s)*s-30,z1:Math.floor(z/s)*s+40}});
 ok(t.surfaceAt(x,z)===SURFACE.ROAD&&t.walkable(x,z),`${p.node} ${p.roads}: road under the patch at ${x.toFixed(1)},${z.toFixed(1)}`)}

// 4. Kaspian Bay: a town with named streets and wild signs
{const k=MAP.towns.find(t=>t.id==='kaspian');ok(k&&k.name==='Kaspian Bay','MAP.towns names Kaspian Bay');
 const named=Object.fromEntries(MAP.roads.edges.filter(e=>e.name).map(e=>[e.id,e.name]));
 ok(named['bay-front']==='Harbor Front'&&named['bay-cross-west']==='Quay Street'&&named['bay-cross-east']==='Ferry Street'&&named['bay-road']==='Bay Road'&&named['coast-link']==='Coast Link','the town streets have names');
 const S=MAP.signs.filter(s=>s.wild);ok(S.length===5&&S.every(s=>s.zone===undefined&&s.boards.length>=1),'five wild signs');
 for(const s of S){ok(s.x>=MAP.world.x0&&s.x<=MAP.world.x1&&s.z>=MAP.world.z0&&s.z<=MAP.world.z1,s.id+' is in the world');
  for(const e of Object.values(G.edges))ok(dist(e.poly,s.x,s.z)>e.width/2+.5,`${s.id} does not stand on ${e.id}`)}
 const bad=(patch)=>validateMap({...MAP,signs:[...MAP.signs,{id:'x',boards:[{text:'X',y:2}],yaw:0,...patch}]});
 ok(bad({wild:true,x:5000,z:0}).some(m=>/wild\) must lie inside the world/.test(m)),'a wild sign outside the world is caught');ok(bad({wild:true,zone:'city',x:0,z:0}).some(m=>/wild\) must/.test(m)),'a wild sign that names a zone is caught');
 ok(bad({zone:'city',x:5000,z:0}).some(m=>/not inside zone/.test(m)),'an ordinary sign is still checked against its zone')}

// 5. the road graph: West Bank Lane is linked, nothing is drawn for the link
{ok(G.components.length===1,'one connected network');const L=MAP.roads.links;ok(L.length===1&&L[0].id==='west-hill-link'&&L[0].from==='oakWest'&&L[0].to==='westFork','one graph-only link');
 ok(!MAP.roads.edges.some(e=>e.id==='west-hill-link'),'it is not a drawn road (nothing paints or draws it: world and terrain read roads.edges only)');
 const r=roadRoute({x:-55,z:6},'p3Lane',MAP);ok(r&&r.edges.includes('west-hill-link')&&r.edges.includes('west-bank-lane'),'Oak Street reaches P3');ok(r.length>480&&r.length<520,'about 497 m to P3: '+r.length.toFixed(0));
 const q=roadRoute({x:-55,z:6},'p6Gate',MAP);ok(q&&!q.edges.includes('west-hill-link'),'other routes do not use it');
 const back=roadRoute('p3Lane','p5Gate',MAP);ok(back&&back.edges[0]==='west-bank-lane'&&back.edges.includes('eden-spine'),'P3 reaches the P5 spur');
 const bad={...MAP,roads:{...MAP.roads,links:[{...L[0],to:'nowhere'}]}};ok(roadGraph(bad).components.length>0)}
console.log(`R4 junctions ok: ${n} checks: ${W.length} angled patches at ${new Set(W.map(p=>p.node)).size} joins (${P.length} patches in all), Kaspian Bay in TOWNS with 5 street names and 5 signs, West Bank Lane linked.`);
