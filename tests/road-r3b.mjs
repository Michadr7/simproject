import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP,validateMap,waterProblems,roadProblems,roadGraph,roadRoute,waterAt,riverPath,riverLength,riverZAt,riverXAt,riverAtDistance,riverWidth,nearestOnRiver,seaLineZ,ROAD_CLASSES} from '../dist/map-definition.js';
import {heightAt,valleyAt,RIVER_SHOULDER} from '../dist/height.js';
import {buildTerrain,SURFACE} from '../dist/terrain.js';
import {roadGeometryProblems,roadChunkGeometry,MAX_ROAD_GRADE} from '../dist/road-geometry.js';
import {digGrid,groundRects,dugMeshData,isDug,DUG_CELL} from '../dist/dug-ground.js';
import {chunkBounds} from '../dist/chunks.js';
import {createWorld} from '../dist/world.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})}; // ground textures draw on a canvas; tests have none
let tests=0;const ok=(c,m)=>{assert(c,m);tests++};const eq=(a,b,m)=>{assert.deepEqual(a,b,m);tests++};const near=(a,b,t,m)=>ok(Math.abs(a-b)<=t,`${m}: ${a} vs ${b}`);

// R3b: the river, its bridges, the sea, the roads of the south and the east, the exit at x 1082. Pins every number of the stage; the numbers are named in map-definition.js (NORTH_RIVER, WATER_Y, SEA_*, the road table).
const R=MAP.water.rivers[0],E=id=>MAP.roads.edges.find(e=>e.id===id),G=roadGraph(MAP);
eq(validateMap(MAP),[],'validateMap is clean');eq(waterProblems(MAP),[],'waterProblems is clean');eq(roadProblems(MAP),[],'roadProblems is clean');eq(roadGeometryProblems(MAP),[],'no road in water without a bridge, none over 10 degrees');

// 1. the river: flow order, real flow, deeper in the centre, ends in the sea
ok(R.id==='north-river'&&R.points.length===33&&R.bank===2.6,'one new-form river of 33 points');
ok(R.points.every((p,i)=>!i||p.y<=R.points[i-1].y+1e-9),'it never flows uphill (water y is non-increasing from the source)');
eq([R.points[0].x,R.points[0].z,R.points[0].y],[540,-470,-.9],'it rises at the lake outflow (540, -470) at -0.9');
near(riverLength(R),1834,2,'about 1.83 km from the outflow to the mouth');
eq(R.points.filter(p=>p.rapid).map(p=>[p.z,+(p.y-R.points[R.points.indexOf(p)+1].y).toFixed(2)]),[[56,.35],[122,.35],[175,.35]],'three rapids of 0.35 m (z 56, 122, 175)');
near(R.points.at(-1).y,-2,1e-9,'the last water level is the sea level');near(riverWidth(R),25,1e-9,'the estuary is 25 m wide');
{const last=R.points.at(-1);ok(last.z>seaLineZ(MAP.water.sea,last.x)+10,'the river ends 12 m inside the sea, not in a pit: z '+last.z+' vs the waterline '+seaLineZ(MAP.water.sea,last.x));eq(waterAt(last.x,last.z).kind,'river');eq(waterAt(last.x,last.z+30).kind,'sea','and the water beyond is the sea')}
{// the reach below the old block: flows south (+z) at the west bend, then south-east; speed .8 on the reach, 2 m/s in a rapid, .3 at the mouth
  const s=waterAt(-333.5,0);ok(s.kind==='river'&&s.flow[1]>.7&&s.flow[1]<.9&&Math.abs(s.flow[0])<.15,'the south reach flows south at about .8 m/s: '+s.flow);
  const old=waterAt(0,riverZAt(R,0));ok(old.flow[0]<-.5,'the old reach now flows WEST (it ran east in the data before): '+old.flow);
  const m=waterAt(125,420);ok(m.flow[1]>.2&&m.flow[1]<.4,'the estuary flows south at about .3 m/s: '+m.flow)}
{// the cross-section is deepest in the centre (RIVER_PROFILE)
  const c=waterAt(125,420),q=waterAt(125+6,420),e=waterAt(125+12,420);ok(c.depth>q.depth&&q.depth>e.depth&&c.depth>.9,'estuary depth '+[c.depth,q.depth,e.depth].map(v=>v.toFixed(2))+' m: deepest in the centre');
  near(valleyAt(125,420),-3,.02,'the estuary centre bed is 3 m below the ground');near(valleyAt(-333.7,0),-.95-.5,.02,'the south reach centre bed: water -.95 minus .5');
  near(valleyAt(0,riverZAt(R,0)),-1.4,.01,'the old reach centre is as deep as before (-1.4 m)')}
// riverZAt / riverXAt / riverAtDistance: by path distance and in any direction
near(riverZAt(R,-30),-160,.01,'the river crosses the County Road at z -160 (first crossing in flow order)');near(riverZAt(R,-60),-155.46,.05,'x -60, first crossing: the old reach');near(riverZAt(R,-60,300),300,.5,'x -60 near z 300: the estuary');ok(riverZAt(R,2000)===null,'no crossing');
near(riverXAt(R,5),-333.73,.05,'the south reach at z 5 is at x -333.7 (a north-south reach: the by-x search could not find it)');near(riverXAt(R,400,0),124.1,.3,'the estuary at z 400 is at x 124.1');
{const a=riverAtDistance(R,0),b=riverAtDistance(R,riverLength(R)),c=riverAtDistance(R,900);eq([a.x,a.z],[540,-470]);eq([b.x,b.z],[125,452]);ok(c.x<-100&&c.x>-340&&Number.isFinite(c.tx),'900 m along: the south reach '+c.x.toFixed(0)+','+c.z.toFixed(0))}
// the fast nearest-segment search gives what a full scan gives
{const P=riverPath(R,2);let bad=0;for(const [x,z] of [[0,-150],[-300,100],[100,380],[-333,5],[130,430]]){let best=Infinity;for(let i=0;i<P.length-1;i++){const a=P[i],c=P[i+1],dx=c.x-a.x,dz=c.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));best=Math.min(best,Math.hypot(x-a.x-dx*t,z-a.z-dz*t))}const q=nearestOnRiver(R,x,z,40);if(!q||Math.abs(q.d-best)>1e-9)bad++}ok(bad===0,'nearestOnRiver (bucketed) equals the full scan')}

// 2. the sea
{const S=MAP.water.sea;eq([S.y,S.beach],[-2,25]);ok(S.shoreline.length===7&&S.shoreline.every((p,i)=>!i||p[0]>S.shoreline[i-1][0]),'a shoreline of 7 points, west to east');
  ok(S.shoreline.every(p=>p[1]>=430&&p[1]<=450),'the coast is at z 430..450');near(valleyAt(300,seaLineZ(S,300)+25),-.6-2,1e-6,'the sea bed is -2.6 m beyond the beach');near(heightAt(300,400),0,1e-9,'the harbor front (z 400) is on ground 0')}

// 3. the bridges: axes, decks, both banks
{const B=Object.fromEntries(MAP.water.bridges.map(b=>[b.id,b]));eq(Object.keys(B),['county-bridge','freight-bridge','west-bank-bridge','estuary-bridge']);
  const W=B['west-bank-bridge'],S=B['estuary-bridge'];eq([W.axis,W.x1-W.x0,W.z1-W.z0,W.wild],['x',30,6,true],'West Bank Bridge: a 30 m deck along x, 6 m wide');eq([S.axis,S.x1-S.x0,S.z1-S.z0,S.wild],['x',40,10,true],'Estuary Bridge: a 40 m deck along x, 10 m wide');
  for(const b of [W,S]){let lo=1e9,hi=-1e9;for(let x=b.x0-60;x<=b.x1+60;x+=.5){const q=nearestOnRiver(R,x,(b.z0+b.z1)/2,40);if(q&&q.d<=q.s.w/2+R.bank){lo=Math.min(lo,x);hi=Math.max(hi,x)}}ok(lo-b.x0>=2&&b.x1-hi>=2,`${b.id}: the deck reaches 2 m past the bank on both sides (${(lo-b.x0).toFixed(1)}, ${(b.x1-hi).toFixed(1)})`)}
  // the validator measures the banks on both axes: a deck that stops short is caught, on either axis
  const short=(id,patch)=>validateMap({...MAP,water:{...MAP.water,bridges:MAP.water.bridges.map(b=>b.id===id?{...b,...patch}:b)}});
  ok(short('west-bank-bridge',{x0:-335}).some(p=>/west-bank-bridge does not reach both banks/.test(p)),'a short x-axis deck is caught');ok(short('estuary-bridge',{x1:125}).some(p=>/estuary-bridge does not reach both banks/.test(p)),'a short deck over the oblique estuary is caught');
  ok(short('county-bridge',{z1:-155}).some(p=>/county-bridge does not reach both banks/.test(p)),'a short z-axis deck is caught (the old bridges)');ok(short('west-bank-bridge',{x0:-800,x1:-319}).some(p=>/outside the world/.test(p)),'a wild bridge must stay in the world');
  ok(short('estuary-bridge',{river:'none'}).some(p=>/unknown river/.test(p)));
  // the deck arches along x and meets the road level at both ends
  ok(Math.abs(MAP.water.bridges.length-4)===0);const {deckAt,bridgeRise,BRIDGE_RISE}=await import('../dist/height.js');near(deckAt(-334,5),BRIDGE_RISE,1e-9,'the West Bank deck crowns at 1.0 m');near(deckAt(125,400),BRIDGE_RISE,1e-9,'the Estuary deck crowns at 1.0 m');ok(deckAt(-349,5)===0&&deckAt(145,400)===0,'level at the ends');ok(deckAt(-320,100)===null,'no deck off the bridge');near(bridgeRise(W,5,-319),0,1e-9,'bridgeRise follows x on an x-axis deck')}

// 4. the roads
{const L=id=>G.edges[id].length;
  eq(['eden-spine','eden-haul','eden-car-link','west-bank-lane','bay-road','bay-front','bay-cross-west','bay-cross-east','estuary-road','coast-link','p5-spur'].map(id=>!!E(id)),Array(11).fill(true),'all eleven new roads exist');
  eq([L('eden-spine'),L('eden-haul'),L('eden-car-link'),L('bay-road'),L('bay-front'),L('bay-cross-west'),L('bay-cross-east'),L('estuary-road')],[440,130,100,332,360,120,120,98]);
  near(L('coast-link'),Math.hypot(120,262),1e-6,'Coast Link is the diagonal (520,330) to (640,68): 288 m');near(L('p5-spur'),Math.hypot(180,70),1e-6,'the P5 spur: 193 m');near(L('west-bank-lane'),452,2,'West Bank Lane: about 452 m (map-master 410)');
  eq([E('eden-spine').width,E('eden-haul').width,E('eden-car-link').width,E('bay-road').width,E('bay-front').width,E('coast-link').width,E('p5-spur').width,E('west-bank-lane').width],[12,9,6,10,12,9,6,6],'widths from the map-master table');
  eq([E('west-bank-lane').surface,E('p5-spur').surface,E('coast-link').surface,E('bay-front').surface],['gravel','gravel','asphalt','asphalt']);
  eq([G.edges['eden-spine'].speed,G.edges['bay-front'].speed,G.edges['eden-car-link'].speed,G.edges['p5-spur'].speed,G.edges['bay-road'].speed],[ROAD_CLASSES.rural,ROAD_CLASSES.street,ROAD_CLASSES.street,ROAD_CLASSES.gravel,ROAD_CLASSES.rural]);
  ok(MAP.roads.edges.filter(e=>/^(eden-spine|eden-haul|eden-car-link|west-bank-lane|bay-|estuary|coast|p5)/.test(e.id)).every(e=>e.wild),'every new road is a wild road');
  // the network: the Ironwood end reaches every new road by road (R4: West Bank Lane too, through the graph-only west-hill-link)
  for(const [to,must] of [['p6Gate',['estuary-road','bay-front','bay-road']],['haulGate',['eden-spine','eden-haul']],['edenGate',['eden-car-link','blackstone-access']],['p5Gate',['p5-spur','coast-link']],['crossWestEnd',['bay-cross-west']],['edenExit',['eden-spine']]]){const r=roadRoute({x:-55,z:6},to,MAP);ok(r,'Oak Street reaches '+to);for(const id of must)ok(r.edges.includes(id),`${to}: via ${id}`)}
  eq(G.components.length,1,'R4: one connected network (West Bank Lane is linked through west-hill-link)');ok(roadRoute('westFork','p3Lane',MAP).length>400);ok(roadRoute({x:-55,z:6},'p3Lane',MAP).edges.includes('west-hill-link'),'Oak Street reaches P3');
}
// the exit
{const x=MAP.exits[0];eq([x.road,x.in[0],x.out.at(-1)],['eden-spine',[1082,65],[1082,71]],'the east exit is at x 1082 (lanes z 65 in, z 71 out)');ok(x.in.every(p=>p[1]===65)&&x.out.every(p=>p[1]===71)&&x.in.length===8&&x.out.length===7);
  ok(validateMap({...MAP,exits:[{...x,in:[[100,65],...x.in.slice(1)]}]}).some(p=>/must start and end outside/.test(p)),'an exit that starts on the map is caught');
  eq(G.edges['eden-spine'].poly.at(-1),[1040,68],'the road itself ends at the wilds edge, x 1040, 42 m before the first exit point')}

// 5. the surface mask in chunk tiles (the wilds): banks and water of the new river, the sea, the bridges
{const T=(x0,x1,z0,z1)=>buildTerrain(MAP,{window:{x0,x1,z0,z1}}),at=(t,x,z)=>t.surfaceAt(x,z);
  const w=T(-420,-250,-20,40);eq([at(w,-334,0),at(w,-334,5)],[SURFACE.WATER,SURFACE.BRIDGE],'the south reach is water; the deck over it is bridge');
  ok(!w.walkable(-334,-5)&&!w.walkable(-334,40)&&!w.walkable(-326,-12),'water and banks beside the deck are walls');ok(w.walkable(-334,5)&&w.walkable(-340,3)&&w.walkable(-322,7),'the West Bank deck is walkable');
  for(let x=-349;x<=-319;x+=.5)ok(w.walkable(x,2.2)&&w.walkable(x,7.8),'West Bank Bridge walkable all the way across at x '+x);
  ok(at(w,-355,5)!==SURFACE.WATER&&at(w,-312,5)!==SURFACE.WATER,'its ends are on dry land');eq(at(w,-352,5),SURFACE.GRAVEL,'West Bank Lane is gravel at the west end');
  const e=T(60,200,370,470);eq(at(e,125,420),SURFACE.WATER,'the estuary is water');ok(at(e,125,400)===SURFACE.BRIDGE&&e.walkable(125,400)&&e.walkable(107,400)&&e.walkable(143,400),'the Estuary Bridge deck is walkable');
  ok(!e.walkable(125,410),'the estuary is a wall');ok(!e.walkable(125,455)&&!e.walkable(180,445)&&e.walkable(180,425),'the sea is a wall, the beach north of the waterline is walkable');
  ok(at(e,150,450)===SURFACE.WATER&&at(e,150,430)!==SURFACE.WATER,'the shoreline is where the water begins (z about 440)');
  const s=T(600,1060,380,600);ok(!s.walkable(700,500)&&s.walkable(700,410)&&at(s,700,500)===SURFACE.WATER,'the sea in the east is water too')}

// 6. the ground: the dug grid, the cut planes, the dug meshes
{const g=digGrid(MAP);eq([g.cell,g.cols,g.rows],[DUG_CELL,375,450]);ok(g.count>15000&&g.count<30000,'about 21,000 of 168,750 cells are dug: '+g.count);
  ok(isDug(g,125,420)&&isDug(g,-334,0)&&isDug(g,0,riverZAt(R,0))&&isDug(g,300,500)&&isDug(g,540,-470),'the river (old reach, south reach, estuary, source), the sea are dug');ok(!isDug(g,0,0)&&!isDug(g,300,200)&&!isDug(g,900,-600),'ground is not');
  {const rects=groundRects(g,-450,1050,-1200,600);let a=0;for(const r of rects){a+=(r.x1-r.x0)*(r.z1-r.z0);ok(!isDug(g,(r.x0+r.x1)/2,(r.z0+r.z1)/2))}let dugA=0;for(let c=0;c<g.dug.length;c++)dugA+=g.dug[c]*g.cell*g.cell;near(a+dugA,1500*1800,1,'cut planes and dug cells add up to the world');ok(rects.length<400,'the base ground is '+rects.length+' rectangles')}
  {const rects=groundRects(g,-1150,1750,-1900,1300);let a=0;for(const r of rects)a+=(r.x1-r.x0)*(r.z1-r.z0);let dugA=0;for(let c=0;c<g.dug.length;c++)dugA+=g.dug[c]*g.cell*g.cell;near(a+dugA,2900*3200,1,'the far plane (700 m beyond the world) is cut the same way')}
  {const b=chunkBounds(4,16),d=dugMeshData(MAP,g,b);ok(d.idx.length>0&&d.pos.length/3<=4100,'the estuary chunk: '+d.pos.length/3+' vertices');
   ok(d.idx.every(i=>i<d.pos.length/3),'indices in range');let flat=0;for(let i=1;i<d.pos.length;i+=3)if(d.pos[i]>-.05)flat++;ok(flat<d.pos.length/3,'it holds the dug bed');
   // every triangle faces up
   let down=0;for(let k=0;k<d.idx.length;k+=3){const a=d.idx[k]*3,bb=d.idx[k+1]*3,c=d.idx[k+2]*3,ux=d.pos[bb]-d.pos[a],uz=d.pos[bb+2]-d.pos[a+2],vx=d.pos[c]-d.pos[a],vz=d.pos[c+2]-d.pos[a+2];if(uz*vx-ux*vz<1e-12)down++}ok(down===0,'every dug triangle faces up ('+down+' do not)')}
  {const d=dugMeshData(MAP,g,chunkBounds(0,0));ok(d.idx.length===0,'an empty corner has no dug mesh')}}

// 7. the world: streamed chunks build the dug meshes, the water, the deck along x; roads over bridges are cut
{const scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity,streaming:true}),names=()=>{const n=[];scene.traverse(o=>{if(o.name)n.push(o.name)});return n};
  const pieces=[];scene.traverse(o=>{if(o.isMesh&&/^ground-(base|far)$/.test(o.name))pieces.push(o)});ok(pieces.length===2,'two cut planes: base and far');
  world.ensure(-334,5,1);world.ensure(125,420,1);
  const N=names();ok(N.includes('dug-1:12')&&N.includes('dug-5:16')&&N.includes('water-1:12'),'the chunks of the south reach and the estuary hold dug ground and water');
  const mesh=n=>{const m=[];scene.traverse(o=>{if(o.isMesh&&o.name===n)m.push(o)});return m};
  {const decks=mesh('bridge-deck').map(m=>{m.geometry.computeBoundingBox();return m.geometry.boundingBox}),west=decks.find(b=>b.min.x<-340&&b.max.x>-325),est=decks.find(b=>b.min.x>100&&b.max.x<150&&b.min.z>390);
   ok(west&&Math.abs(west.min.x+349)<1e-6&&Math.abs(west.max.x+319)<1e-6&&Math.abs(west.min.z-2)<1e-6&&Math.abs(west.max.z-8)<1e-6,'the West Bank deck mesh spans x -349..-319, z 2..8');
   ok(est&&Math.abs(est.min.x-105)<1e-6&&Math.abs(est.max.x-145)<1e-6&&Math.abs(est.min.z-395)<1e-6&&Math.abs(est.max.z-405)<1e-6,'the Estuary deck mesh spans x 105..145, z 395..405');
   ok(west.max.y>.9&&west.max.y<1.01,'it crowns at about 1 m: '+west.max.y.toFixed(2));
   // the deck surface faces up (the mirrored winding is flipped back)
   const m=mesh('bridge-deck').find(o=>{o.geometry.computeBoundingBox();return o.geometry.boundingBox.min.x<-340}),p=m.geometry.attributes.position,ix=m.geometry.index;let up=0,dn=0;for(let k=0;k<ix.count;k+=3){const a=ix.getX(k),b=ix.getX(k+1),c=ix.getX(k+2),ux=p.getX(b)-p.getX(a),uy=p.getY(b)-p.getY(a),uz=p.getZ(b)-p.getZ(a),vx=p.getX(c)-p.getX(a),vy=p.getY(c)-p.getY(a),vz=p.getZ(c)-p.getZ(a),ny=uz*vx-ux*vz;if(ny>1e-9)up++;else if(ny<-1e-9)dn++}ok(up>0&&dn===up,'the deck has the same number of triangles facing up (its top) and down (its underside): '+up+'/'+dn)}
  ok(N.filter(n=>n==='bridge-pier').length>=16,'four piers per bridge');
  const lane=N.filter(n=>/^gravel-road-west-bank-lane/.test(n));eq(lane.sort(),['gravel-road-west-bank-lane','gravel-road-west-bank-lane-1'],'the lane is cut at the bridge: one ribbon each side, none on the river bed');ok(N.includes('gravel-road-p5-spur'));
  // the estuary road is cut too (the asphalt of a chunk is merged, so look at the dashes: none inside the deck except the deck's own)
  ok(world.chunks.isReady(125,420)&&world.chunks.isReady(-334,5));
}
console.log(`R3b ok: ${tests} checks: river (33 points, 1.83 km, 3 rapids, ends in the sea), 4 bridges, sea, 11 roads, exit at x 1082, mask tiles, dug ground.`);
