import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP,validateMap,roadGraph,roadRoute,roadClassOf,ROAD_CLASSES} from '../dist/map-definition.js';
import {buildTerrain,SURFACE} from '../dist/terrain.js';
import {roadGeometryProblems,roadChunkGeometry,MAX_ROAD_GRADE} from '../dist/road-geometry.js';
import {createWorld} from '../dist/world.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})}; // ground textures draw on a canvas; tests have none

// R3a: gravel roads end to end, street class tags, the first real roads of the wilds (no bridge, no river, no hills).
const E=id=>MAP.roads.edges.find(e=>e.id===id),g=roadGraph(MAP);
assert.deepEqual(validateMap(MAP),[],'the real map is valid');

// 1. class tags: Alder Street, Alder Cross and Works Lane are streets (13.4 m/s), the rest of the old rural roads unchanged
for(const id of ['alder-street','alder-cross','works-lane']){assert.equal(E(id).class,'street');assert.equal(roadClassOf(E(id)),'street');assert.equal(g.edges[id].speed,ROAD_CLASSES.street)}
for(const id of ['county-road','oak-east','freight-south','freight-out','freight-road','cedar-link','cedar-loop'])assert.equal(g.edges[id].class,'rural',id);
// the route over Works Lane is timed at street speed
{const r=roadRoute('worksN','worksS',MAP);assert.deepEqual(r.edges,['works-lane']);assert.ok(Math.abs(r.time-62/ROAD_CLASSES.street)<1e-9,'62 m at 13.4 m/s');
 const rr=roadRoute('alderCrossW','alderCrossE',MAP);assert.ok(rr.edges.includes('alder-cross'));assert.ok(Math.abs(rr.legs.reduce((s,l)=>s+(l.edge==='alder-cross'?l.length/ROAD_CLASSES.street:0),0)-rr.legs.filter(l=>l.edge==='alder-cross').reduce((s,l)=>s+l.length,0)/13.4)<1e-9)}

// 2. the new roads: data, class, length, connected to the old network
const ids=['eden-road','blackstone-access','lake-road'];
for(const id of ids){assert.ok(E(id),id);assert.ok(E(id).wild,id+' is a wild road')}
assert.equal(E('blackstone-access').surface,'gravel');assert.equal(g.edges['blackstone-access'].class,'gravel');assert.equal(g.edges['blackstone-access'].speed,13.4);
assert.equal(E('lake-road').surface,'gravel');assert.equal(g.edges['eden-road'].class,'rural');assert.equal(g.edges['eden-road'].length,310);
assert.ok(Math.abs(g.edges['blackstone-access'].length-(268+Math.hypot(20,220)))<1e-6);assert.ok(Math.abs(g.edges['lake-road'].length-(210+280))<1e-6);
{const r=roadRoute({x:-55,z:6},'lakeFoothills',MAP);assert.ok(r,'Oak Street west end reaches the Lake Road end by road');for(const id of ids)assert.ok(r.edges.includes(id),id+' is on the route');
 const leg=r.legs.find(l=>l.edge==='blackstone-access');assert.ok(leg.length>0);
 const time=r.legs.reduce((s,l)=>s+l.length/g.edges[l.edge].speed,0);assert.ok(Math.abs(time-r.time)<1e-6,'route time is length over class speed')}

// 3. validateMap: wild roads must stay inside the world and out of the old ground; gravel is a valid surface
const withEdges=extra=>({...MAP,roads:{...MAP.roads,edges:[...MAP.roads.edges,...extra]},});
const withNodes=(nodes,extra)=>({...MAP,roads:{nodes:{...MAP.roads.nodes,...nodes},edges:[...MAP.roads.edges,...extra]}});
assert.ok(validateMap(withNodes({far:{x:1200,z:68}},[{id:'t-far',from:'edenJoin',to:'far',width:8,surface:'gravel',class:'gravel',wild:true}])).some(p=>/outside the world/.test(p)),'outside the world');
assert.ok(validateMap(withNodes({inA:{x:0,z:-300},inB:{x:100,z:-300}},[{id:'t-in',from:'inA',to:'inB',width:8,surface:'gravel',class:'gravel',wild:true}])).some(p=>/lies inside the old ground/.test(p)),'wild but inside the old ground');
assert.ok(validateMap(withNodes({far2:{x:700,z:68}},[{id:'t-nowild',from:'edenJoin',to:'far2',width:8,surface:'gravel',class:'gravel'}])).some(p=>/outside the ground|does not touch any zone/.test(p)),'a road without wild:true must still touch the old ground');
assert.ok(validateMap({...MAP,world:undefined}).some(p=>/no world frame/.test(p)),'wild roads need a world frame');
assert.ok(!validateMap(withEdges([])).length);

// 4. the surface mask paints GRAVEL on the gravel roads (tile mask over the wilds) and ROAD on Eden Road
{const win={x0:560,x1:700,z0:-260,z1:100},T=buildTerrain(MAP,{window:win}),at=(x,z)=>T.surfaceAt(x,z);
 assert.equal(at(600,-100),SURFACE.GRAVEL,'Blackstone Access centre is gravel');assert.equal(at(603,-100),SURFACE.GRAVEL,'3 m off the centre (width 7) is gravel');assert.notEqual(at(606,-100),SURFACE.GRAVEL,'beyond half the width it is not');
 const T2=buildTerrain(MAP,{window:{x0:300,x1:620,z0:40,z1:100}});assert.equal(T2.surfaceAt(450,68),SURFACE.ROAD,'Eden Road is road');assert.equal(T2.surfaceAt(450,75),SURFACE.GRASS,'12 m wide: 7 m off is grass');
 assert.ok(T.walkable(600,-100)&&T.walkable(606,-100),'the wilds stay walkable');
 // a straight gravel road paints the same through the rectangle branch (surface-only change on an old road)
 const g2=buildTerrain({...MAP,roads:{...MAP.roads,edges:MAP.roads.edges.map(e=>e.id==='woods-lane'?{...e,surface:'gravel'}:e)}});assert.equal(g2.surfaceAt(90,-260),SURFACE.GRAVEL,'woods lane as gravel');
 const L=buildTerrain(MAP,{window:{x0:600,x1:860,z0:-440,z1:-400}});assert.equal(L.surfaceAt(700,-420),SURFACE.GRAVEL,'Lake Road is gravel');assert.equal(L.surfaceAt(700,-425),SURFACE.GRASS,'6 m wide: 5 m off is grass')}

// 5. the world draws a gravel mesh for every gravel road (and nothing for the old roads)
{const scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity}),names=[];scene.traverse(o=>{if(o.name)names.push(o.name)});
 for(const id of ['blackstone-access','lake-road']){assert.ok(names.includes('gravel-road-'+id),`mesh gravel-road-${id}`);const m=scene.getObjectByName('gravel-road-'+id);assert.ok(m.geometry.attributes.position.count>=100,'a ribbon with many points');
  const ys=[...m.geometry.attributes.position.array].filter((_,i)=>i%3===1);assert.ok(ys.every(y=>Math.abs(y+.066)<.02),'laid on the flat ground at the dirt-road height')}
 assert.equal(names.filter(n=>n.startsWith('gravel-road-')).length,2,'exactly the gravel edges');
}

// 6. grades: every road, chunk by chunk, stays under 10 degrees (the real map has no hills there yet)
assert.deepEqual(roadGeometryProblems(MAP),[],'no road over 10 degrees, none in water');
for(const p of roadChunkGeometry(MAP).filter(p=>ids.includes(p.edge)))assert.ok(p.maxGrade<=MAX_ROAD_GRADE,`${p.edge} ${p.chunk}`);
// and the check does catch a steep one (synthetic hill on Lake Road)
{const steep={...MAP,relief:{...MAP.relief,hills:[...(MAP.relief?.hills||[]),{id:'t-hill',x:700,z:-420,rx:12,rz:12,h:20}]}};
 const bad=roadGeometryProblems(steep);assert.ok(bad.some(p=>/lake-road|blackstone-access/.test(p)||/climbs/.test(p)),'a steep road is reported')}
console.log('R3a ok: gravel roads drawn and painted, 3 street tags, 3 new wild roads, grades fine.');
