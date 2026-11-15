// R1: the road graph (roadGraph, roadRoute, nearestRoad, roadChunkPieces, roadProblems) over the shipped map and synthetic maps. Pure data.
import assert from 'node:assert/strict';
import {MAP,validateMap,roadGraph,roadRoute,nearestRoad,roadChunkPieces,roadProblems,roadPolyline,roadLength,roadClassOf,roadSpeed,ROAD_CLASSES,polylineLength} from '../dist/map-definition.js';

assert.deepEqual(validateMap(MAP),[]);assert.deepEqual(roadProblems(MAP),[]);
assert.deepEqual(ROAD_CLASSES,{street:13.4,rural:22.4,gravel:13.4,dirt:8.9});

// every old edge is in the graph with a class, a speed and a length that matches its geometry
const g=roadGraph(MAP);
assert.equal(Object.keys(g.edges).length,MAP.roads.edges.length);
for(const e of MAP.roads.edges){const E=g.edges[e.id];assert(E,e.id);assert.equal(E.class,roadClassOf(e));assert.equal(E.speed,roadSpeed(e));assert(E.length>0);assert(Math.abs(E.length-roadLength(e,MAP))<1e-9);
 assert(Math.abs(E.legs.reduce((s,l)=>s+l.length,0)-E.length)<1e-6,`${e.id} legs add up`)}
assert.equal(g.edges['oak-street'].class,'street');assert.equal(g.edges['county-road'].class,'rural');assert.equal(g.edges['farm-road'].class,'dirt');
// straight edges: exact node-to-node length
assert.equal(g.edges['freight-south'].length,127.5);assert.equal(g.edges['freight-out'].length,90.5);assert.equal(g.edges['works-lane'].length,62);
// the closed Cedar loop closes and its length is a plausible oval (about 76 x 56 m)
{const loop=roadPolyline(MAP.roads.edges.find(e=>e.id==='cedar-loop'),MAP);assert.deepEqual(loop[0],loop.at(-1));const L=polylineLength(loop);assert(L>180&&L<230,`loop ${L}`)}

// T joins and crossings: the old network is ONE connected piece where it looks connected
const comp=id=>g.components.findIndex(c=>c.includes(id));
assert(comp('oakWest')>=0);
assert.equal(comp('oakWest'),comp('outEast'),'Oak Street -> Works Lane -> Freight South -> exit');
assert.equal(comp('oakWest'),comp('countyEnd'),'Alder Avenue meets Oak Street');
assert.equal(comp('woodsEnd'),comp('countyEnd'),'Woods Road meets the County Road');
assert.equal(comp('woodsLaneNorth'),comp('woodsEnd'),'the lane crosses Woods Road (a virtual junction)');
assert(Object.values(g.nodes).some(n=>n.virtual),'a crossing makes a virtual node');
const roads=['alderStreetS','farmGate','cedarLoopStart'];for(const n of roads)assert(comp(n)>=0);
console.log('components',g.components.map(c=>c.length+':'+c[0]));

// routes: fastest by class speed, deterministic, and symmetric in length
{const r=roadRoute('oakWest','outEast',MAP);assert(r&&r.length>250&&r.time>0);assert.equal(r.nodes[0],'oakWest');assert.equal(r.nodes.at(-1),'outEast');
 const back=roadRoute('outEast','oakWest',MAP);assert(Math.abs(back.length-r.length)<1e-6&&Math.abs(back.time-r.time)<1e-9);
 assert(r.edges.includes('oak-street')&&r.edges.includes('freight-out'));
 // time = sum of leg length / class speed
 let t=0;for(const l of r.legs)t+=l.length/g.edges[l.edge].speed;assert(Math.abs(t-r.time)<1e-9);
 assert.deepEqual(roadRoute('oakWest','oakWest',MAP).legs,[]);
 // points snap to the nearest node
 assert.equal(roadRoute({x:-54,z:5},{x:289,z:67},MAP).nodes[0],'oakWest')}
assert.equal(roadRoute('nope','oakWest',MAP),null);

// nearestRoad
{const q=nearestRoad(0,6,MAP);assert.equal(q.edge,'oak-street');assert(q.onRoad&&q.d<1e-9);assert(Math.abs(q.s-55)<1e-9);
 const far=nearestRoad(0,50,MAP);assert(far.d>0&&!far.onRoad||far.onRoad)}

// chunk pieces: cut at 100 m borders, every piece inside one chunk, lengths add up
{const pieces=roadChunkPieces(MAP);assert(pieces.length>MAP.roads.edges.length);
 const per={};for(const p of pieces){per[p.edge]=(per[p.edge]||0)+polylineLength(p.points);
  const x0=-450+p.i*100,z0=-1200+p.j*100;for(const [x,z] of p.points)assert(x>=x0-1e-6&&x<=x0+100+1e-6&&z>=z0-1e-6&&z<=z0+100+1e-6,`${p.edge} ${p.chunk} point ${x},${z}`)}
 for(const e of MAP.roads.edges)assert(Math.abs(per[e.id]-g.edges[e.id].length)<1e-6,`${e.id} pieces ${per[e.id]} vs ${g.edges[e.id].length}`);
 // Freight South (x 72..199.5 at z 68) crosses the x 50 and x 150 borders: chunks x index 5, 6
 const fs=pieces.filter(p=>p.edge==='freight-south');assert.equal(fs.length,2);assert.deepEqual(fs.map(p=>p.i),[5,6])}

// synthetic: new fields, gravel class, a diagonal road with a path and curve, a T join, a crossing, a disconnected piece, and validation
{const base=()=>structuredClone({...MAP.roads});
 const map={...MAP,roads:{nodes:{...base().nodes,a:{x:0,z:0},b:{x:100,z:0},c:{x:50,z:60},d:{x:50,z:-60},e:{x:300,z:300},f:{x:340,z:330}},
  edges:[{id:'t-main',from:'a',to:'b',width:8,surface:'asphalt',level:'rural',class:'rural'},
   {id:'t-side',from:'c',to:'d',width:6,surface:'dirt',class:'gravel'}, // crosses t-main at (50,0), no shared end
   {id:'t-diag',from:'b',to:'c',width:6,surface:'dirt',class:'gravel',path:[[90,20],[70,45]],curve:true},
   {id:'t-far',from:'e',to:'f',width:6,surface:'dirt'}]}};
 const G=roadGraph(map);assert.deepEqual(roadProblems(map),[]);
 assert.equal(G.edges['t-side'].class,'gravel');assert.equal(G.edges['t-side'].speed,13.4);assert.equal(G.edges['t-far'].class,'dirt');
 assert(G.nodes['t-main+t-side'].virtual);assert.equal(G.nodes['t-main+t-side'].x,50);assert.equal(G.edges['t-main'].legs.length,2);
 assert.equal(G.components.length,2);
 const r=roadRoute('a','c',map);assert(r);assert.equal(roadRoute('a','e',map),null,'disconnected');
 const direct=roadRoute('a','d',map);assert.deepEqual(direct.nodes,['a','t-main+t-side','d']);assert.equal(direct.length,110);
 // a route through b and the diagonal is longer than through the crossing
 assert(r.nodes.includes('t-main+t-side'));
 // validation
 const bad=(patch,text)=>{const m={...map,roads:{...map.roads,edges:[...map.roads.edges,patch]}};assert(roadProblems(m).some(p=>p.includes(text)),text+' in '+JSON.stringify(roadProblems(m)))};
 bad({id:'x1',from:'a',to:'b',width:6,surface:'dirt',class:'highway'},'unknown class');
 bad({id:'x2',from:'a',to:'a',width:6,surface:'dirt'},'not closed');
 bad({id:'x3',from:'a',to:'b',width:6,surface:'dirt',closed:true},'closed but');
 bad({id:'x4',from:'a',to:'b',width:6,surface:'dirt',path:[[1,'q']]},'bad path point');
 // an unknown node is reported by validateMap's own rule and does not crash the graph
 const broken={...map,roads:{...map.roads,edges:[...map.roads.edges,{id:'x5',from:'a',to:'zz',width:6,surface:'dirt'}]}};assert.doesNotThrow(()=>roadGraph(broken));
}

// roadRects stays the straight-edge list (R1 adds no behaviour to it)
console.log('road-graph ok');
